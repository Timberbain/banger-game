import { Room, Client } from 'colyseus';
import { GameState, Player, MatchState, PlayerStats, StageSnapshot } from '../schema/GameState';
import { Projectile } from '../schema/Projectile';
import { ObstacleState } from '../schema/Obstacle';
import { SERVER_CONFIG, GAME_CONFIG } from '../config';
import {
  applyMovementPhysics,
  updateFacingDirection,
  PHYSICS,
  NETWORK,
} from '../../../shared/physics';
import { CHARACTERS, COMBAT } from '../../../shared/characters';
import { parseMapMetadata, MapMetadata } from '../../../shared/maps';
import { LOBBY_CONFIG } from '../../../shared/lobby';
import { CollisionGrid, resolveCollisions } from '../../../shared/collisionGrid';
import { OBSTACLE_TILE_IDS, OBSTACLE_TIER_HP } from '../../../shared/obstacles';
import { getCollisionShapes } from '../../../shared/tileRegistry';
import {
  PowerupType,
  POWERUP_CONFIG,
  POWERUP_NAMES,
  BUFF_DURATIONS,
} from '../../../shared/powerups';
import { PowerupState } from '../schema/Powerup';
import {
  GameRoomCreateOptions,
  GameRoomJoinOptions,
  TiledMapJSON,
} from '../../../shared/roomTypes';
import * as fs from 'fs';
import * as path from 'path';

const MATCH_DURATION_MS = 5 * 60 * 1000; // 5 minutes per stage -- guardians win on timeout

/** Fixed delta time for deterministic physics (must match client) */
const FIXED_DT = NETWORK.fixedDtSeconds; // 1/60 seconds

/** Pre-computed squared distance thresholds (avoid Math.sqrt in hot loop) */
const CONTACT_KILL_DIST_SQ = (COMBAT.playerRadius * 2) ** 2;
const PROJECTILE_LIFETIME = COMBAT.projectileLifetime;
const POWERUP_COLLECTION_DIST_SQ = (COMBAT.playerRadius + POWERUP_CONFIG.collectionRadius) ** 2;
const POWERUP_MIN_SPAWN_DIST_SQ = POWERUP_CONFIG.minSpawnDistance ** 2;

/** Base directory for map/asset files. Defaults to client/public for dev, overridden in Docker. */
const MAPS_BASE_DIR = process.env.MAPS_BASE_DIR || path.join(__dirname, '../../../client/public');

/** Discover playable maps from JSON files at module load */
function discoverMaps(): MapMetadata[] {
  const mapsDir = path.join(MAPS_BASE_DIR, 'maps');
  const files = fs.readdirSync(mapsDir).filter((f: string) => f.endsWith('.json'));
  const maps: MapMetadata[] = [];
  for (const file of files) {
    const json: TiledMapJSON = JSON.parse(fs.readFileSync(path.join(mapsDir, file), 'utf-8'));
    const meta = parseMapMetadata(json, file);
    if (meta) maps.push(meta);
  }
  console.log(`Discovered ${maps.length} maps: ${maps.map((m) => m.displayName).join(', ')}`);
  return maps;
}

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;
  patchRate = SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync

  private mapMetadata!: MapMetadata;
  private roleAssignments?: Record<string, string>;
  private collisionGrid!: CollisionGrid;

  // Multi-stage round state (server-only)
  private stageArenas: MapMetadata[] = [];
  private stageSnapshots: StageSnapshot[] = [];
  private matchStartEpoch: number = 0; // Tracks overall match start for total duration

  // Powerup system state (server-only)
  private nextSpawnTime: number = 0; // When next powerup can spawn
  private powerupIdCounter: number = 0; // Unique ID generator for powerup keys
  private originalObstacleTiles: Set<string> = new Set(); // Original obstacle positions for spawn exclusion

  /**
   * Validate input structure and types
   * Rejects non-object inputs, unknown keys, and non-boolean values
   * Accepts optional seq field for client prediction
   */
  private isValidInput(input: any): boolean {
    // Must be an object
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return false;
    }

    const validKeys = ['left', 'right', 'up', 'down', 'fire', 'seq'];

    // Check for unknown keys
    for (const key of Object.keys(input)) {
      if (!validKeys.includes(key)) {
        return false;
      }
    }

    // All direction and fire values must be booleans
    const directionKeys = ['left', 'right', 'up', 'down', 'fire'];
    for (const key of directionKeys) {
      if (key in input && typeof input[key] !== 'boolean') {
        return false;
      }
    }

    // seq must be a number if present
    if ('seq' in input && typeof input.seq !== 'number') {
      return false;
    }

    return true;
  }

  /**
   * Select 3 unique arenas for the best-of-3 match via Fisher-Yates shuffle.
   * Called in onCreate so stageArenas[0] is available for initial map loading.
   */
  private selectArenas(): void {
    const maps = discoverMaps();
    const indices = maps.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    this.stageArenas = indices.slice(0, 3).map((i) => maps[i]);
    console.log(`Stage arenas selected: ${this.stageArenas.map((m) => m.displayName).join(', ')}`);
  }

  /**
   * Load a Tiled JSON map, build collision grid, and initialize obstacles.
   * Shared by onCreate (initial map) and resetStage (new map between stages).
   */
  private loadMap(mapMeta: MapMetadata): void {
    const mapPath = path.join(MAPS_BASE_DIR, mapMeta.file);
    const mapJson: TiledMapJSON = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const wallLayer = mapJson.layers.find((l) => l.name === 'Walls')!;

    this.collisionGrid = new CollisionGrid(
      wallLayer.data,
      mapJson.width,
      mapJson.height,
      mapJson.tilewidth,
      OBSTACLE_TILE_IDS.destructible,
      OBSTACLE_TILE_IDS.indestructible,
      getCollisionShapes(),
    );

    // Initialize destructible obstacles in state for client sync
    // Also track original obstacle positions for powerup spawn exclusion
    this.originalObstacleTiles = new Set();
    let obstacleCount = 0;
    for (let y = 0; y < mapJson.height; y++) {
      for (let x = 0; x < mapJson.width; x++) {
        const tileId = wallLayer.data[y * mapJson.width + x];
        if (OBSTACLE_TILE_IDS.destructible.has(tileId)) {
          const obs = new ObstacleState();
          obs.tileX = x;
          obs.tileY = y;
          obs.maxHp = OBSTACLE_TIER_HP[tileId];
          obs.hp = obs.maxHp;
          this.state.obstacles.set(`${x},${y}`, obs);
          this.originalObstacleTiles.add(`${x},${y}`);
          obstacleCount++;
        }
      }
    }

    this.mapMetadata = mapMeta;
    this.state.mapName = mapMeta.name;

    console.log(
      `Map loaded: ${mapMeta.displayName} (${mapJson.width}x${mapJson.height} tiles, ${obstacleCount} destructible obstacles)`,
    );
  }

  onCreate(options: GameRoomCreateOptions) {
    this.setState(new GameState());
    this.state.matchState = MatchState.WAITING; // Explicit state initialization
    this.state.currentStage = 1;
    this.autoDispose = true;

    // Store role assignments if from lobby
    if (options.fromLobby && options.roleAssignments) {
      this.roleAssignments = options.roleAssignments;
      console.log('GameRoom created from lobby with role assignments:', this.roleAssignments);
    }

    // Select 3 unique arenas for the best-of-3 match
    this.selectArenas();

    // Load the first arena
    this.loadMap(this.stageArenas[0]);

    // Set up fixed timestep loop using accumulator pattern
    let elapsedTime = 0;
    this.setSimulationInterval((deltaTime) => {
      elapsedTime += deltaTime;
      while (elapsedTime >= SERVER_CONFIG.fixedTimeStep) {
        elapsedTime -= SERVER_CONFIG.fixedTimeStep;
        this.fixedTick(SERVER_CONFIG.fixedTimeStep);
      }
    });

    // Ping/pong handler: client sends timestamp, server echoes it back for RTT measurement
    this.onMessage('ping', (client, data) => {
      client.send('pong', { t: data.t });
    });

    // Register message handler for input queueing
    this.onMessage('input', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Validate input structure and types
      if (!this.isValidInput(message)) {
        console.warn(`Invalid input from ${client.sessionId}:`, message);
        return; // Silently reject -- don't kick (could be a bug, not necessarily cheating)
      }

      // Queue the message directly (avoid spread-destructure allocation)
      if (!('seq' in message)) message.seq = 0;
      const queuedInput = message;

      // Check for WebSocket latency simulation
      const wsLatency = parseInt(process.env.SIMULATE_LATENCY || '0', 10);
      if (wsLatency > 0) {
        // Delay input queuing to simulate round-trip latency
        setTimeout(() => {
          // Rate limit: cap queue at 10 to prevent memory abuse
          if (player.inputQueue.length >= 10) {
            player.inputQueue.shift(); // Drop oldest
          }
          player.inputQueue.push(queuedInput);
        }, wsLatency);
        return;
      }

      // Rate limit: cap queue at 10 to prevent memory abuse
      if (player.inputQueue.length >= 10) {
        player.inputQueue.shift(); // Drop oldest
      }

      // Queue input for processing in fixedTick
      player.inputQueue.push(queuedInput);
    });

    console.log(`GameRoom created with roomId: ${this.roomId}`);
  }

  onJoin(client: Client, options?: GameRoomJoinOptions) {
    const player = new Player();

    let role: string;

    // If client sends role from lobby, use it (with validation)
    if (options?.role && ['paran', 'faran', 'baran'].includes(options.role)) {
      role = options.role;
    } else if (this.roleAssignments && this.roleAssignments[client.sessionId]) {
      // Fallback to roleAssignments lookup (unlikely to match but kept for safety)
      role = this.roleAssignments[client.sessionId];
    } else {
      // Final fallback: assign by join order (backward compatibility for direct joins)
      const playerCount = this.state.players.size;
      if (playerCount === 0) {
        role = 'paran';
      } else if (playerCount === 1) {
        role = 'faran';
      } else {
        role = 'baran';
      }
    }

    // Validate no duplicate roles
    let roleTaken = false;
    this.state.players.forEach((p) => {
      if (p.role === role) roleTaken = true;
    });
    if (roleTaken) {
      // Assign first available role
      const takenRoles = new Set<string>();
      this.state.players.forEach((p) => {
        takenRoles.add(p.role);
      });
      const availableRoles = ['paran', 'faran', 'baran'].filter((r) => !takenRoles.has(r));
      role = availableRoles[0] || 'baran';
    }

    // Set spawn position based on role
    this.setSpawnPosition(player, role);

    const stats = CHARACTERS[role];

    // Initialize player stats BEFORE adding player to state
    const playerStats = new PlayerStats();
    this.state.matchStats.set(client.sessionId, playerStats);
    player.vx = 0;
    player.vy = 0;
    player.health = stats.maxHealth;
    player.name = options?.name
      ? String(options.name).substring(0, 12)
      : client.sessionId.substring(0, 12);
    player.angle = 0;
    player.role = role;
    player.lastProcessedSeq = 0;

    this.state.players.set(client.sessionId, player);

    console.log(
      `Player joined: ${client.sessionId} (${player.name}) as ${role} with ${stats.maxHealth} health`,
    );

    // Start match when all players have joined
    if (this.state.players.size === this.maxClients) {
      this.startMatch();
    }
  }

  /**
   * Set spawn position for a player based on their role and current map metadata.
   */
  private setSpawnPosition(player: Player, role: string): void {
    if (role === 'paran') {
      player.x = this.mapMetadata.spawnPoints.paran.x;
      player.y = this.mapMetadata.spawnPoints.paran.y;
    } else if (role === 'faran') {
      player.x = this.mapMetadata.spawnPoints.guardians[0].x;
      player.y = this.mapMetadata.spawnPoints.guardians[0].y;
    } else {
      player.x = this.mapMetadata.spawnPoints.guardians[1].x;
      player.y = this.mapMetadata.spawnPoints.guardians[1].y;
    }

    // Validate spawn position against collision grid (only available after loadMap)
    if (this.collisionGrid) {
      const radius = 12; // Player collision radius (half of 24px hitbox)
      const tileSize = this.collisionGrid.tileSize;

      // Check all tiles the player's AABB overlaps
      const left = Math.floor((player.x - radius) / tileSize);
      const right = Math.floor((player.x + radius) / tileSize);
      const top = Math.floor((player.y - radius) / tileSize);
      const bottom = Math.floor((player.y + radius) / tileSize);

      let isBlocked = false;
      for (let ty = top; ty <= bottom; ty++) {
        for (let tx = left; tx <= right; tx++) {
          if (this.collisionGrid.isSolid(tx, ty)) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) break;
      }

      if (isBlocked) {
        console.warn(
          `Spawn position (${player.x}, ${player.y}) for ${role} is inside a wall! Nudging to safe position.`,
        );
        // Nudge by one tile in each direction until clear
        const offsets = [
          [0, 0],
          [32, 0],
          [-32, 0],
          [0, 32],
          [0, -32],
          [32, 32],
          [-32, -32],
          [32, -32],
          [-32, 32],
        ];
        for (const [dx, dy] of offsets) {
          const testX = player.x + dx;
          const testY = player.y + dy;
          const tl = Math.floor((testX - radius) / tileSize);
          const tr = Math.floor((testX + radius) / tileSize);
          const tt = Math.floor((testY - radius) / tileSize);
          const tb = Math.floor((testY + radius) / tileSize);
          let clear = true;
          for (let ty = tt; ty <= tb; ty++) {
            for (let tx = tl; tx <= tr; tx++) {
              if (this.collisionGrid.isSolid(tx, ty)) {
                clear = false;
                break;
              }
            }
            if (!clear) break;
          }
          if (clear) {
            player.x = testX;
            player.y = testY;
            console.log(`  Nudged to (${testX}, ${testY})`);
            break;
          }
        }
      }
    }
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);

    // Player doesn't exist - already removed or never joined properly
    if (!player) {
      console.log(`Player left but not found: ${client.sessionId}`);
      return;
    }

    // Mark player as disconnected
    player.connected = false;

    // Check if match is in an active state (PLAYING, STAGE_END, or STAGE_TRANSITION)
    const isActiveMatch =
      this.state.matchState === MatchState.PLAYING ||
      this.state.matchState === MatchState.STAGE_END ||
      this.state.matchState === MatchState.STAGE_TRANSITION;

    // If consented (intentional leave), handle based on match state
    if (consented) {
      console.log(`Player left (consented): ${client.sessionId}`);

      if (isActiveMatch) {
        // During active match: show disconnect state briefly before removing
        // This gives clients time to render the ghosted state
        this.clock.setTimeout(() => {
          this.state.players.delete(client.sessionId);
          // Only check win conditions if we're still in PLAYING state
          if (this.state.matchState === MatchState.PLAYING) {
            this.checkWinConditions();
          }
        }, 2000);
      } else {
        // Not in active match: remove immediately
        this.state.players.delete(client.sessionId);
      }
      return;
    }

    // Non-consented leave: handle reconnection based on match state
    if (isActiveMatch) {
      // Active match (including between stages): allow reconnection with grace period
      console.log(
        `Player disconnected during match: ${client.sessionId}, grace period: ${LOBBY_CONFIG.MATCH_RECONNECT_GRACE}s`,
      );

      try {
        await this.allowReconnection(client, LOBBY_CONFIG.MATCH_RECONNECT_GRACE);

        // Successfully reconnected -- validate player still exists
        const reconnectedPlayer = this.state.players.get(client.sessionId);
        if (!reconnectedPlayer) {
          console.warn(`Player ${client.sessionId} reconnected but player object was removed`);
          return;
        }
        reconnectedPlayer.connected = true;
        reconnectedPlayer.inputQueue = [];
        console.log(`Player reconnected: ${client.sessionId}`);
      } catch (e) {
        // Grace period expired or reconnection failed
        console.log(`Player failed to reconnect (grace period expired): ${client.sessionId}`);
        this.state.players.delete(client.sessionId);
        // Keep stats for display

        // Check win conditions after grace period expiration (only during PLAYING)
        if (this.state.matchState === MatchState.PLAYING) {
          this.checkWinConditions();
        }
      }
    } else {
      // Not in active match (WAITING or ENDED/MATCH_END): no point reconnecting
      console.log(`Player left during ${this.state.matchState}: ${client.sessionId}`);
      this.state.players.delete(client.sessionId);
    }
  }

  /**
   * Resolve tile collisions for a player and handle velocity response.
   * Paran loses ALL velocity on any wall/obstacle hit.
   * Guardians stop only on the colliding axis.
   * Paran instantly destroys any destructible obstacle on contact.
   */
  private resolvePlayerCollision(player: Player, prevX: number, prevY: number): void {
    const result = resolveCollisions(player, COMBAT.playerRadius, this.collisionGrid, prevX, prevY);

    if (result.hitX || result.hitY) {
      // Paran wall penalty: lose ALL velocity on any wall/obstacle hit
      if (player.role === 'paran') {
        player.vx = 0;
        player.vy = 0;
      } else {
        // Guardian: zero only the colliding axis
        if (result.hitX) player.vx = 0;
        if (result.hitY) player.vy = 0;
      }
    }

    // Paran instantly destroys any destructible obstacle on contact
    if (player.role === 'paran' && result.hitTiles.length > 0) {
      for (const tile of result.hitTiles) {
        const key = `${tile.tileX},${tile.tileY}`;
        const obs = this.state.obstacles.get(key);
        if (obs && !obs.destroyed) {
          obs.hp = 0;
          obs.destroyed = true;
          this.collisionGrid.clearTile(tile.tileX, tile.tileY);
        }
      }
    }

    // Safety net: clamp to arena bounds (tile border walls handle this normally)
    player.x = Math.max(0, Math.min(this.mapMetadata.width, player.x));
    player.y = Math.max(0, Math.min(this.mapMetadata.height, player.y));
  }

  /**
   * Find a valid spawn tile for a powerup: walkable, not an original obstacle,
   * and at minimum distance from alive players.
   */
  private findSpawnTile(): { x: number; y: number } | null {
    const maxAttempts = 50;
    const tileSize = this.collisionGrid.tileSize;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Random tile within map bounds (exclude border tiles)
      const tileX = 1 + Math.floor(Math.random() * (this.collisionGrid.width - 2));
      const tileY = 1 + Math.floor(Math.random() * (this.collisionGrid.height - 2));

      // Skip solid tiles (walls, obstacles)
      if (this.collisionGrid.isSolid(tileX, tileY)) continue;

      // Skip original obstacle positions (even if destroyed)
      if (this.originalObstacleTiles.has(`${tileX},${tileY}`)) continue;

      // Convert to world coordinates (center of tile)
      const worldX = tileX * tileSize + tileSize / 2;
      const worldY = tileY * tileSize + tileSize / 2;

      // Check minimum distance from all alive players (squared comparison)
      let tooClose = false;
      this.state.players.forEach((player) => {
        if (player.health <= 0) return;
        const dx = worldX - player.x;
        const dy = worldY - player.y;
        if (dx * dx + dy * dy < POWERUP_MIN_SPAWN_DIST_SQ) {
          tooClose = true;
        }
      });
      if (tooClose) continue;

      return { x: worldX, y: worldY };
    }

    return null; // No valid tile found after max attempts
  }

  /**
   * Check if it's time to spawn a new powerup and spawn one if conditions are met.
   */
  private checkPowerupSpawns(): void {
    // Don't exceed max powerups on map
    if (this.state.powerups.size >= POWERUP_CONFIG.maxOnMap) return;

    // Not time yet
    if (this.state.serverTime < this.nextSpawnTime) return;

    // Find a valid spawn tile
    const tile = this.findSpawnTile();
    if (!tile) return; // No valid tile found

    // Create powerup
    const powerup = new PowerupState();
    powerup.x = tile.x;
    powerup.y = tile.y;
    powerup.powerupType = Math.floor(Math.random() * 3);
    powerup.spawnTime = this.state.serverTime;

    const key = `pwr_${this.powerupIdCounter++}`;
    this.state.powerups.set(key, powerup);

    // Broadcast spawn event
    this.broadcast('powerupSpawn', {
      id: key,
      type: powerup.powerupType,
      typeName: POWERUP_NAMES[powerup.powerupType],
    });

    // Schedule next spawn
    this.nextSpawnTime =
      this.state.serverTime +
      POWERUP_CONFIG.spawnIntervalMin +
      Math.random() * (POWERUP_CONFIG.spawnIntervalMax - POWERUP_CONFIG.spawnIntervalMin);
  }

  /**
   * Check powerup despawning and collection by players.
   */
  private checkPowerupCollections(): void {
    const toRemove: string[] = [];

    this.state.powerups.forEach((powerup, id) => {
      // Despawn check: remove powerups that have been on the map too long
      if (this.state.serverTime - powerup.spawnTime > POWERUP_CONFIG.despawnTime) {
        toRemove.push(id);
        this.broadcast('powerupDespawn', { id, type: powerup.powerupType });
        return;
      }

      // Collection check: for each alive player, check distance
      let collected = false;
      this.state.players.forEach((player, sessionId) => {
        if (collected) return;
        if (player.health <= 0) return;

        const dx = powerup.x - player.x;
        const dy = powerup.y - player.y;

        if (dx * dx + dy * dy < POWERUP_COLLECTION_DIST_SQ) {
          this.collectPowerup(sessionId, player, powerup, id);
          toRemove.push(id);
          collected = true;
        }
      });
    });

    // Remove collected/despawned powerups after iteration (don't mutate during forEach)
    for (const id of toRemove) {
      this.state.powerups.delete(id);
    }
  }

  /**
   * Apply a powerup buff to a player. Same buff type refreshes timer;
   * different buff types stack.
   */
  private collectPowerup(
    sessionId: string,
    player: Player,
    powerup: PowerupState,
    id: string,
  ): void {
    const buffType = powerup.powerupType;
    const duration = BUFF_DURATIONS[buffType];
    const expiresAt = this.state.serverTime + duration;

    // Check if player already has this buff type
    const existingBuff = player.activeBuffs.find((b) => b.type === buffType);
    if (existingBuff) {
      // Same type: refresh timer only (do NOT stack same type)
      existingBuff.expiresAt = expiresAt;
      existingBuff.duration = duration;
    } else {
      // New buff type: add to active buffs
      player.activeBuffs.push({ type: buffType, expiresAt, duration });
    }

    // Apply immediate effects
    if (buffType === PowerupType.SPEED) {
      player.speedMultiplier = POWERUP_CONFIG.speedMultiplier;
    }

    // Broadcast collection event
    this.broadcast('powerupCollect', {
      id,
      playerId: sessionId,
      playerName: player.name,
      playerRole: player.role,
      type: buffType,
      typeName: POWERUP_NAMES[buffType],
      duration,
    });
  }

  /**
   * Update buff timers and expire buffs that have run out.
   */
  private updateBuffTimers(): void {
    this.state.players.forEach((player, sessionId) => {
      // Iterate backwards for safe splice
      for (let i = player.activeBuffs.length - 1; i >= 0; i--) {
        const buff = player.activeBuffs[i];
        if (this.state.serverTime >= buff.expiresAt) {
          // Broadcast expiry
          this.broadcast('buffExpired', { playerId: sessionId, type: buff.type });

          // Remove expired buff
          player.activeBuffs.splice(i, 1);
        }
      }

      // Ensure speedMultiplier is correct: reset to 1 if no speed buff active
      if (!this.hasActiveBuff(player, PowerupType.SPEED) && player.speedMultiplier !== 1) {
        player.speedMultiplier = 1;
      }
    });
  }

  /** Check if a player has an active (non-expired) buff of the given type */
  private hasActiveBuff(player: Player, buffType: PowerupType): boolean {
    return player.activeBuffs.some(
      (b) => b.type === buffType && this.state.serverTime < b.expiresAt,
    );
  }

  fixedTick(deltaTime: number) {
    // Guard: only run game logic during PLAYING state
    if (this.state.matchState !== MatchState.PLAYING) {
      this.state.serverTime += deltaTime;
      return;
    }

    this.state.tickCount++;
    this.state.serverTime += deltaTime;

    // Match timer: guardians win if time runs out
    if (this.state.serverTime - this.state.matchStartTime >= MATCH_DURATION_MS) {
      this.endStage('guardians');
      return;
    }

    this.processPlayerInputs();
    this.processParanContactKills();
    this.processProjectiles();
    this.checkWinConditions();
    this.checkPowerupSpawns();
    this.checkPowerupCollections();
    this.updateBuffTimers();
  }

  /**
   * Drain each player's input queue, apply physics + collision, handle fire.
   * For players with no inputs this tick, integrate position at current velocity.
   */
  private processPlayerInputs(): void {
    this.state.players.forEach((player, sessionId) => {
      if (player.health <= 0) {
        player.inputQueue = [];
        return;
      }

      if (!player.connected) {
        player.vx = 0;
        player.vy = 0;
        player.inputQueue = [];
        return;
      }

      const stats = CHARACTERS[player.role];
      const effectiveMaxVelocity = stats.maxVelocity * player.speedMultiplier;

      let processedAny = false;
      while (player.inputQueue.length > 0) {
        const queuedInput = player.inputQueue.shift()!;
        const seq = queuedInput.seq;
        const fire = queuedInput.fire;

        // Handle fire input
        if (fire && player.health > 0) {
          const hasProjBuff = this.hasActiveBuff(player, PowerupType.PROJECTILE);

          let effectiveFireRate = stats.fireRate;
          if (hasProjBuff && player.role === 'paran') {
            effectiveFireRate = stats.fireRate * POWERUP_CONFIG.paranBeamCooldownMultiplier;
          }

          if (this.state.serverTime - player.lastFireTime >= effectiveFireRate) {
            const projectile = new Projectile();
            projectile.x = player.x;
            projectile.y = player.y;
            projectile.vx = Math.cos(player.angle) * stats.projectileSpeed;
            projectile.vy = Math.sin(player.angle) * stats.projectileSpeed;
            projectile.ownerId = sessionId;
            projectile.damage = stats.damage;
            projectile.spawnTime = this.state.serverTime;

            if (hasProjBuff) {
              if (player.role === 'paran') {
                projectile.isBeam = true;
                projectile.hitboxScale = POWERUP_CONFIG.paranBeamHitboxScale;
              } else {
                projectile.hitboxScale = POWERUP_CONFIG.guardianHitboxScale;
                projectile.damage *= POWERUP_CONFIG.guardianDamageScale;
                projectile.vx *= POWERUP_CONFIG.guardianSpeedScale;
                projectile.vy *= POWERUP_CONFIG.guardianSpeedScale;
              }
            }

            this.state.projectiles.push(projectile);
            player.lastFireTime = this.state.serverTime;

            const shooterStats = this.state.matchStats.get(sessionId);
            if (shooterStats) shooterStats.shotsFired++;
          }
        }

        const prevX = player.x;
        const prevY = player.y;

        applyMovementPhysics(player, queuedInput, FIXED_DT, {
          acceleration: stats.acceleration,
          drag: stats.drag,
          maxVelocity: effectiveMaxVelocity,
        });
        this.resolvePlayerCollision(player, prevX, prevY);
        updateFacingDirection(player);

        player.lastProcessedSeq = seq;
        processedAny = true;
      }

      // No inputs this tick: maintain velocity and integrate position
      if (!processedAny) {
        const prevX = player.x;
        const prevY = player.y;
        player.x += player.vx * FIXED_DT;
        player.y += player.vy * FIXED_DT;
        this.resolvePlayerCollision(player, prevX, prevY);
      }
    });
  }

  /**
   * Check Paran-guardian body overlap for contact kills.
   * Uses squared distance to avoid Math.sqrt.
   */
  private processParanContactKills(): void {
    let paranPlayer: Player | null = null;
    let paranId: string = '';
    this.state.players.forEach((p, id) => {
      if (p.role === 'paran' && p.health > 0) {
        paranPlayer = p;
        paranId = id;
      }
    });

    if (!paranPlayer) return;
    const paran = paranPlayer as Player;

    this.state.players.forEach((target, targetId) => {
      if (target.role === 'paran') return;
      if (target.health <= 0) return;
      if (targetId === paranId) return;

      const dx = paran.x - target.x;
      const dy = paran.y - target.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < CONTACT_KILL_DIST_SQ) {
        if (this.hasActiveBuff(target, PowerupType.INVINCIBILITY)) return;

        target.health = 0;
        target.activeBuffs = [];
        target.speedMultiplier = 1;

        const paranStats = this.state.matchStats.get(paranId);
        if (paranStats) paranStats.kills++;
        const targetStats = this.state.matchStats.get(targetId);
        if (targetStats) targetStats.deaths++;

        this.broadcast('kill', {
          killer: paran.name,
          victim: target.name,
          killerId: paranId,
          victimId: targetId,
          killerRole: paran.role,
          victimRole: target.role,
        });
      }
    });
  }

  /**
   * Move projectiles, check lifetime/tile/player collisions.
   * Uses squared distance for player hit detection.
   */
  private processProjectiles(): void {
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      if (!proj) continue;

      proj.x += proj.vx * FIXED_DT;
      proj.y += proj.vy * FIXED_DT;

      // Lifetime check
      if (this.state.serverTime - proj.spawnTime > PROJECTILE_LIFETIME) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Tile/obstacle collision
      const projTile = this.collisionGrid.worldToTile(proj.x, proj.y);
      if (this.collisionGrid.isPointInSolidRect(proj.x, proj.y)) {
        if (proj.isBeam) {
          const obsKey = `${projTile.tileX},${projTile.tileY}`;
          const obs = this.state.obstacles.get(obsKey);
          if (obs && !obs.destroyed) {
            obs.hp = 0;
            obs.destroyed = true;
            this.collisionGrid.clearTile(projTile.tileX, projTile.tileY);
          }
        } else {
          const obsKey = `${projTile.tileX},${projTile.tileY}`;
          const obs = this.state.obstacles.get(obsKey);
          if (obs && !obs.destroyed) {
            obs.hp--;
            if (obs.hp <= 0) {
              obs.destroyed = true;
              this.collisionGrid.clearTile(projTile.tileX, projTile.tileY);
            }
          }
          this.state.projectiles.splice(i, 1);
          continue;
        }
      }

      // Safety bounds check
      if (
        proj.x < 0 ||
        proj.x > this.mapMetadata.width ||
        proj.y < 0 ||
        proj.y > this.mapMetadata.height
      ) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Player collision (squared distance)
      let hit = false;
      this.state.players.forEach((target, targetId) => {
        if (hit && !proj.isBeam) return;
        if (targetId === proj.ownerId) return;
        if (target.health <= 0) return;

        const dx = proj.x - target.x;
        const dy = proj.y - target.y;
        const distSq = dx * dx + dy * dy;

        const effectiveRadius = COMBAT.projectileRadius * (proj.hitboxScale || 1);
        const hitDistSq = (COMBAT.playerRadius + effectiveRadius) ** 2;
        if (distSq < hitDistSq) {
          if (this.hasActiveBuff(target, PowerupType.INVINCIBILITY)) {
            hit = true;
            return;
          }

          const wasAlive = target.health > 0;
          target.health = Math.max(0, target.health - proj.damage);
          const isDead = target.health === 0;

          const shooterStats = this.state.matchStats.get(proj.ownerId);
          if (shooterStats) {
            shooterStats.shotsHit++;
            shooterStats.damageDealt += proj.damage;
            if (wasAlive && isDead) {
              target.activeBuffs = [];
              target.speedMultiplier = 1;

              shooterStats.kills++;
              const targetStats = this.state.matchStats.get(targetId);
              if (targetStats) targetStats.deaths++;

              const shooter = this.state.players.get(proj.ownerId);
              this.broadcast('kill', {
                killer: shooter?.name || 'Unknown',
                victim: target.name,
                killerId: proj.ownerId,
                victimId: targetId,
                killerRole: shooter?.role || 'unknown',
                victimRole: target.role,
              });
            }
          }

          hit = true;
        }
      });

      if (hit && !proj.isBeam) {
        this.state.projectiles.splice(i, 1);
      }
    }
  }

  private startMatch() {
    this.state.matchState = MatchState.PLAYING;
    this.state.matchStartTime = this.state.serverTime;
    this.matchStartEpoch = this.state.serverTime; // Track overall match start
    this.nextSpawnTime = this.state.serverTime + POWERUP_CONFIG.firstSpawnDelay;
    this.lock(); // Prevent additional joins
    this.broadcast('matchStart', { startTime: this.state.matchStartTime });
    console.log('Match started!');
  }

  private checkWinConditions() {
    let paranAlive = false;
    let guardianAliveCount = 0;
    this.state.players.forEach((p) => {
      if (p.health <= 0) return;
      if (p.role === 'paran') paranAlive = true;
      else guardianAliveCount++;
    });

    if (!paranAlive) {
      this.endStage('guardians');
    } else if (guardianAliveCount === 0) {
      this.endStage('paran');
    }
  }

  /**
   * End the current stage. Snapshots stats, increments win count,
   * checks for match winner, and either transitions to next stage or ends match.
   */
  private endStage(stageWinner: string) {
    // Drain all input queues
    this.state.players.forEach((p) => {
      p.inputQueue = [];
    });

    // Take a StageSnapshot: capture cumulative stats at this point
    const stageDuration = this.state.serverTime - this.state.matchStartTime;
    const stageStats: StageSnapshot['stats'] = {};
    this.state.matchStats.forEach((playerStats, sessionId) => {
      stageStats[sessionId] = {
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        damageDealt: playerStats.damageDealt,
        shotsFired: playerStats.shotsFired,
        shotsHit: playerStats.shotsHit,
      };
    });

    this.stageSnapshots.push({
      stageNumber: this.state.currentStage,
      arenaName: this.mapMetadata.displayName,
      winner: stageWinner,
      duration: stageDuration,
      stats: stageStats,
    });

    // Increment stage win count
    if (stageWinner === 'paran') {
      this.state.paranStageWins++;
    } else {
      this.state.guardianStageWins++;
    }

    console.log(
      `Stage ${this.state.currentStage} ended! Winner: ${stageWinner} (Paran ${this.state.paranStageWins} - ${this.state.guardianStageWins} Guardians)`,
    );

    // Check for match winner (best of 3: first to 2 wins)
    if (this.state.paranStageWins >= 2 || this.state.guardianStageWins >= 2) {
      this.endMatch(stageWinner);
      return;
    }

    // No match winner yet -- transition to next stage
    this.state.matchState = MatchState.STAGE_END;

    // Broadcast stage result
    this.broadcast('stageEnd', {
      stageWinner,
      stageNumber: this.state.currentStage,
      paranWins: this.state.paranStageWins,
      guardianWins: this.state.guardianStageWins,
    });

    // After 2s pause, begin transition to next stage
    this.clock.setTimeout(() => {
      this.beginStageTransition();
    }, 2000);
  }

  /**
   * Begin transition to the next stage: reset state, load new map, notify clients.
   * Broadcasts stageTransition FIRST so clients start iris wipe immediately,
   * then delays resetStage by 600ms so player positions don't update until
   * the client screen is fully obscured.
   */
  private beginStageTransition() {
    this.state.matchState = MatchState.STAGE_TRANSITION;
    this.state.currentStage++;

    // Get next arena from pre-selected list
    const nextMap = this.stageArenas[this.state.currentStage - 1];

    // Broadcast transition info FIRST -- client starts iris wipe immediately
    this.broadcast('stageTransition', {
      stageNumber: this.state.currentStage,
      arenaName: nextMap.displayName,
      mapName: nextMap.name,
      paranWins: this.state.paranStageWins,
      guardianWins: this.state.guardianStageWins,
    });

    console.log(
      `Stage transition: loading ${nextMap.displayName} for stage ${this.state.currentStage}`,
    );

    // Delay resetStage by 600ms so client iris wipe fully closes before
    // position updates are sent (iris close animation is ~500ms + buffer)
    this.clock.setTimeout(() => {
      this.resetStage(nextMap);

      // After map is loaded and positions set, wait for client to show intro + open iris
      // 3400ms so total transition ~4s from client perspective (600ms + 3400ms = 4s)
      this.clock.setTimeout(() => {
        this.startStage();
      }, 3400);
    }, 600);
  }

  /**
   * Reset all game state between stages following Colyseus 0.15 safe patterns.
   * NEVER uses .clear() on ArraySchema or MapSchema.
   * NEVER deletes/re-adds players (resets in-place).
   */
  private resetStage(newMap: MapMetadata) {
    // 1. Clear projectiles: pop individually (NOT .clear() -- Colyseus 0.15 bug)
    while (this.state.projectiles.length > 0) {
      this.state.projectiles.pop();
    }

    // 2. Clear obstacles: collect keys first, then delete individually (NOT .clear())
    const obstacleKeys: string[] = [];
    this.state.obstacles.forEach((_, key) => obstacleKeys.push(key));
    for (const key of obstacleKeys) {
      this.state.obstacles.delete(key);
    }

    // 2.5 Clear powerups: collect keys first, then delete (NOT .clear())
    const powerupKeys: string[] = [];
    this.state.powerups.forEach((_, key) => powerupKeys.push(key));
    for (const key of powerupKeys) {
      this.state.powerups.delete(key);
    }

    // 3. Load new map FIRST (collision grid + obstacles + mapName)
    // Must be before player reset so collision grid is available for spawn validation
    this.loadMap(newMap);

    // 4. Reset players IN-PLACE (do NOT delete/re-add -- preserves client listeners)
    this.state.players.forEach((player) => {
      const stats = CHARACTERS[player.role];
      player.health = stats.maxHealth;
      player.vx = 0;
      player.vy = 0;
      player.inputQueue = [];
      player.lastFireTime = 0;
      player.lastProcessedSeq = 0;
      player.connected = true; // Re-confirm connection status
      player.activeBuffs = [];
      player.speedMultiplier = 1;
      // Set spawn position for new map (validated against collision grid)
      this.setSpawnPosition(player, player.role);
    });

    // Note: matchStats accumulate across stages (per research recommendation).
    // StageSnapshot already captured cumulative stats at stage end.
    // Victory screen can diff consecutive snapshots to show per-stage deltas.

    // 5. Reset winner field (stage winner is in stageSnapshots, not schema)
    this.state.winner = '';
  }

  /**
   * Start a new stage: set PLAYING, reset timer, notify clients.
   */
  private startStage() {
    this.state.matchState = MatchState.PLAYING;
    // Each stage gets a fresh 5-minute timer
    this.state.matchStartTime = this.state.serverTime;

    // Initialize powerup spawn timer with first-spawn delay
    this.nextSpawnTime = this.state.serverTime + POWERUP_CONFIG.firstSpawnDelay;
    this.powerupIdCounter = 0;

    this.broadcast('stageStart', {
      stageNumber: this.state.currentStage,
      startTime: this.state.serverTime,
    });

    console.log(`Stage ${this.state.currentStage} started!`);
  }

  /**
   * End the entire best-of-3 match. Called when one side reaches 2 stage wins.
   * Broadcasts comprehensive match results including per-stage breakdown.
   */
  private endMatch(matchWinner: string) {
    // Set winner
    this.state.winner = matchWinner;

    // Serialize cumulative stats for broadcast
    const stats: Record<string, any> = {};
    this.state.matchStats.forEach((playerStats, sessionId) => {
      const player = this.state.players.get(sessionId);
      stats[sessionId] = {
        name: player?.name || 'Unknown',
        role: player?.role || 'unknown',
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        damageDealt: playerStats.damageDealt,
        shotsFired: playerStats.shotsFired,
        shotsHit: playerStats.shotsHit,
        accuracy:
          playerStats.shotsFired > 0
            ? Math.round((playerStats.shotsHit / playerStats.shotsFired) * 1000) / 10
            : 0,
      };
    });

    // Calculate total match duration from all stage snapshots
    const totalDuration = this.stageSnapshots.reduce((sum, s) => sum + s.duration, 0);

    // Broadcast final match results with per-stage breakdown
    this.broadcast('matchEnd', {
      winner: matchWinner,
      stats,
      stageResults: this.stageSnapshots,
      duration: totalDuration,
    });

    // Set match state to MATCH_END (new terminal state for best-of-3)
    this.state.matchState = MatchState.MATCH_END;
    this.state.matchEndTime = this.state.serverTime;

    console.log(
      `Match ended! Winner: ${matchWinner} (Paran ${this.state.paranStageWins} - ${this.state.guardianStageWins} Guardians, ${this.stageSnapshots.length} stages played)`,
    );

    // Auto-disconnect after 15 seconds (gives time to view stats)
    this.clock.setTimeout(() => {
      this.disconnect();
    }, 15000);
  }

  onDispose() {
    console.log(`GameRoom disposed: ${this.roomId}`);
  }

  onUncaughtException(err: Error, methodName: string) {
    console.error(`[GameRoom] Uncaught exception in ${methodName}:`, err.message);
    console.error(err.stack);
    // Do NOT rethrow -- let the room continue running for other players
    // Only dispose if the error is truly unrecoverable
  }
}
