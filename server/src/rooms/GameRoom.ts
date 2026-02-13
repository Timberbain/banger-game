import { Room, Client } from "colyseus";
import { GameState, Player, MatchState, PlayerStats } from "../schema/GameState";
import { Projectile } from "../schema/Projectile";
import { ObstacleState } from "../schema/Obstacle";
import { SERVER_CONFIG, GAME_CONFIG } from "../config";
import { applyMovementPhysics, updateFacingDirection, PHYSICS } from "../../../shared/physics";
import { CHARACTERS, COMBAT } from "../../../shared/characters";
import { MAPS, MapMetadata } from "../../../shared/maps";
import { LOBBY_CONFIG } from "../../../shared/lobby";
import { CollisionGrid, resolveCollisions } from "../../../shared/collisionGrid";
import { OBSTACLE_TILE_IDS, OBSTACLE_TIER_HP } from "../../../shared/obstacles";
import * as fs from "fs";
import * as path from "path";

const MATCH_DURATION_MS = 5 * 60 * 1000; // 5 minutes -- guardians win on timeout

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;
  patchRate = SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync

  // Static map rotation index shared across room instances
  private static currentMapIndex: number = 0;
  private mapMetadata!: MapMetadata;
  private roleAssignments?: Record<string, string>;
  private collisionGrid!: CollisionGrid;

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

  onCreate(options: any) {
    this.setState(new GameState());
    this.state.matchState = MatchState.WAITING; // Explicit state initialization
    this.autoDispose = true;

    // Store role assignments if from lobby
    if (options.fromLobby && options.roleAssignments) {
      this.roleAssignments = options.roleAssignments;
      console.log("GameRoom created from lobby with role assignments:", this.roleAssignments);
    }

    // Select map (sequential rotation across room instances)
    this.mapMetadata = MAPS[GameRoom.currentMapIndex % MAPS.length];
    this.state.mapName = this.mapMetadata.name;

    // Advance rotation for next room
    GameRoom.currentMapIndex++;

    console.log(`GameRoom created with map: ${this.mapMetadata.displayName}`);

    // Load Tiled JSON map file and build collision grid
    const mapPath = path.join(__dirname, '../../../client/public', this.mapMetadata.file);
    const mapJson = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const wallLayer = mapJson.layers.find((l: any) => l.name === 'Walls');

    this.collisionGrid = new CollisionGrid(
      wallLayer.data,
      mapJson.width,
      mapJson.height,
      mapJson.tilewidth,
      OBSTACLE_TILE_IDS.destructible,
      OBSTACLE_TILE_IDS.indestructible
    );

    // Initialize destructible obstacles in state for client sync
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
          obstacleCount++;
        }
      }
    }
    console.log(`Collision grid loaded: ${mapJson.width}x${mapJson.height} tiles, ${obstacleCount} destructible obstacles`);

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
    this.onMessage("input", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Validate input structure and types
      if (!this.isValidInput(message)) {
        console.warn(`Invalid input from ${client.sessionId}:`, message);
        return; // Silently reject -- don't kick (could be a bug, not necessarily cheating)
      }

      // Extract seq and input state
      const { seq = 0, ...inputState } = message;
      const queuedInput = { seq, ...inputState };

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

  onJoin(client: Client, options?: any) {
    const player = new Player();

    let role: string;

    // If client sends role from lobby, use it (with validation)
    if (options?.role && ["paran", "faran", "baran"].includes(options.role)) {
      role = options.role;
    } else if (this.roleAssignments && this.roleAssignments[client.sessionId]) {
      // Fallback to roleAssignments lookup (unlikely to match but kept for safety)
      role = this.roleAssignments[client.sessionId];
    } else {
      // Final fallback: assign by join order (backward compatibility for direct joins)
      const playerCount = this.state.players.size;
      if (playerCount === 0) {
        role = "paran";
      } else if (playerCount === 1) {
        role = "faran";
      } else {
        role = "baran";
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
      this.state.players.forEach((p) => { takenRoles.add(p.role); });
      const availableRoles = ["paran", "faran", "baran"].filter(r => !takenRoles.has(r));
      role = availableRoles[0] || "baran";
    }

    // Set spawn position based on role
    if (role === "paran") {
      player.x = this.mapMetadata.spawnPoints.paran.x;
      player.y = this.mapMetadata.spawnPoints.paran.y;
    } else if (role === "faran") {
      player.x = this.mapMetadata.spawnPoints.guardians[0].x;
      player.y = this.mapMetadata.spawnPoints.guardians[0].y;
    } else {
      player.x = this.mapMetadata.spawnPoints.guardians[1].x;
      player.y = this.mapMetadata.spawnPoints.guardians[1].y;
    }

    const stats = CHARACTERS[role];

    // Initialize player stats BEFORE adding player to state
    const playerStats = new PlayerStats();
    this.state.matchStats.set(client.sessionId, playerStats);
    player.vx = 0;
    player.vy = 0;
    player.health = stats.maxHealth;
    player.name = options?.name
      ? String(options.name).substring(0, 20)
      : client.sessionId.substring(0, 20);
    player.angle = 0;
    player.role = role;
    player.lastProcessedSeq = 0;

    this.state.players.set(client.sessionId, player);

    console.log(`Player joined: ${client.sessionId} (${player.name}) as ${role} with ${stats.maxHealth} health`);

    // Start match when all players have joined
    if (this.state.players.size === this.maxClients) {
      this.startMatch();
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

    // If consented (intentional leave), handle based on match state
    if (consented) {
      console.log(`Player left (consented): ${client.sessionId}`);

      if (this.state.matchState === MatchState.PLAYING) {
        // During active match: show disconnect state briefly before removing
        // This gives clients time to render the ghosted state
        this.clock.setTimeout(() => {
          this.state.players.delete(client.sessionId);
          this.checkWinConditions();
        }, 2000);
      } else {
        // Not in active match: remove immediately
        this.state.players.delete(client.sessionId);
      }
      return;
    }

    // Non-consented leave: handle reconnection based on match state
    if (this.state.matchState === MatchState.PLAYING) {
      // Active match: allow reconnection with grace period
      console.log(`Player disconnected during match: ${client.sessionId}, grace period: ${LOBBY_CONFIG.MATCH_RECONNECT_GRACE}s`);

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

        // Check win conditions after grace period expiration
        this.checkWinConditions();
      }
    } else {
      // Not in active match (WAITING or ENDED): no point reconnecting
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

  fixedTick(deltaTime: number) {
    // Guard: only run game logic during PLAYING state
    if (this.state.matchState !== MatchState.PLAYING) {
      // Still increment serverTime during WAITING (needed for matchStartTime comparison)
      this.state.serverTime += deltaTime;
      return;
    }

    // Increment tick counter
    this.state.tickCount++;

    // Update server time
    this.state.serverTime += deltaTime;

    // Match timer: guardians win if time runs out (forces aggressive Paran play)
    if (this.state.serverTime - this.state.matchStartTime >= MATCH_DURATION_MS) {
      this.endMatch("guardians");
      return;
    }

    // Fixed delta time for deterministic physics (must match client)
    const FIXED_DT = 1 / 60; // seconds

    // Process all player inputs and resolve tile collisions
    this.state.players.forEach((player, sessionId) => {
      // Ignore dead player input
      if (player.health <= 0) {
        player.inputQueue = []; // Drain dead player input
        return; // Skip processing
      }

      // Ignore disconnected player input and freeze them in place
      if (!player.connected) {
        player.vx = 0;
        player.vy = 0;
        player.inputQueue = [];
        return; // Skip all processing for disconnected player
      }

      // Get character stats
      const stats = CHARACTERS[player.role];

      // Drain input queue
      let processedAny = false;
      while (player.inputQueue.length > 0) {
        const { seq, fire, ...input } = player.inputQueue.shift()!;

        // Handle fire input
        if (fire && player.health > 0) {
          // Check cooldown
          if (this.state.serverTime - player.lastFireTime >= stats.fireRate) {
            // Spawn projectile
            const projectile = new Projectile();
            projectile.x = player.x;
            projectile.y = player.y;
            projectile.vx = Math.cos(player.angle) * stats.projectileSpeed;
            projectile.vy = Math.sin(player.angle) * stats.projectileSpeed;
            projectile.ownerId = sessionId;
            projectile.damage = stats.damage;
            projectile.spawnTime = this.state.serverTime;
            this.state.projectiles.push(projectile);

            // Update cooldown
            player.lastFireTime = this.state.serverTime;

            // Track stats
            const shooterStats = this.state.matchStats.get(sessionId);
            if (shooterStats) shooterStats.shotsFired++;
          }
        }

        // Save position before physics for collision resolution
        const prevX = player.x;
        const prevY = player.y;

        // Apply character-specific physics
        applyMovementPhysics(player, input, FIXED_DT, {
          acceleration: stats.acceleration,
          drag: stats.drag,
          maxVelocity: stats.maxVelocity,
        });

        // Resolve tile collisions after each physics step
        this.resolvePlayerCollision(player, prevX, prevY);

        // Update facing direction
        updateFacingDirection(player);

        // Track last processed input sequence for client reconciliation
        player.lastProcessedSeq = seq;
        processedAny = true;
      }

      // If no inputs this tick (network timing gap), maintain velocity
      // and just integrate position. Instant stop only triggers from actual
      // input with no directions, not from missing network frames.
      if (!processedAny) {
        const prevX = player.x;
        const prevY = player.y;
        player.x += player.vx * FIXED_DT;
        player.y += player.vy * FIXED_DT;
        // Resolve tile collisions in no-input path too (prevents clipping during network gaps)
        this.resolvePlayerCollision(player, prevX, prevY);
      }
    });

    // Paran contact kill: check for Paran-guardian body overlap
    let paranPlayer: Player | null = null;
    let paranId: string = '';
    this.state.players.forEach((p, id) => {
      if (p.role === 'paran' && p.health > 0) { paranPlayer = p; paranId = id; }
    });

    if (paranPlayer) {
      const paran = paranPlayer as Player; // TypeScript narrowing helper
      this.state.players.forEach((target, targetId) => {
        if (target.role === 'paran') return;
        if (target.health <= 0) return;
        if (targetId === paranId) return;

        const dx = paran.x - target.x;
        const dy = paran.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < COMBAT.playerRadius * 2) {
          // Contact kill: instant death regardless of HP
          target.health = 0;
          // Track stats
          const paranStats = this.state.matchStats.get(paranId);
          if (paranStats) paranStats.kills++;
          const targetStats = this.state.matchStats.get(targetId);
          if (targetStats) targetStats.deaths++;

          // Broadcast kill event for HUD kill feed
          this.broadcast("kill", {
            killer: paran.name,
            victim: target.name,
            killerRole: paran.role,
            victimRole: target.role,
          });
        }
      });
    }

    // Process projectiles (iterate backwards for safe removal)
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const proj = this.state.projectiles[i];
      if (!proj) continue; // Safety check for TypeScript strict null checking

      // Move projectile
      proj.x += proj.vx * FIXED_DT;
      proj.y += proj.vy * FIXED_DT;

      // Lifetime check
      if (this.state.serverTime - proj.spawnTime > COMBAT.projectileLifetime) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Tile/obstacle collision check (replaces old bounds check)
      const projTile = this.collisionGrid.worldToTile(proj.x, proj.y);
      if (this.collisionGrid.isSolid(projTile.tileX, projTile.tileY)) {
        // Check if destructible obstacle -- damage it
        const obsKey = `${projTile.tileX},${projTile.tileY}`;
        const obs = this.state.obstacles.get(obsKey);
        if (obs && !obs.destroyed) {
          obs.hp--;
          if (obs.hp <= 0) {
            obs.destroyed = true;
            this.collisionGrid.clearTile(projTile.tileX, projTile.tileY);
          }
        }
        // Destroy projectile on any solid tile contact
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Safety bounds check (in case projectile escapes tile grid)
      if (proj.x < 0 || proj.x > this.mapMetadata.width || proj.y < 0 || proj.y > this.mapMetadata.height) {
        this.state.projectiles.splice(i, 1);
        continue;
      }

      // Collision with players
      let hit = false;
      this.state.players.forEach((target, targetId) => {
        if (hit) return;
        if (targetId === proj.ownerId) return; // No self-hit
        if (target.health <= 0) return; // Skip dead

        const dx = proj.x - target.x;
        const dy = proj.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < COMBAT.playerRadius + COMBAT.projectileRadius) {
          // Apply damage
          const wasAlive = target.health > 0;
          target.health = Math.max(0, target.health - proj.damage);
          const isDead = target.health === 0;

          // Track stats
          const shooterStats = this.state.matchStats.get(proj.ownerId);
          if (shooterStats) {
            shooterStats.shotsHit++;
            shooterStats.damageDealt += proj.damage;
            if (wasAlive && isDead) {
              shooterStats.kills++;
              const targetStats = this.state.matchStats.get(targetId);
              if (targetStats) targetStats.deaths++;

              // Broadcast kill event for HUD kill feed
              const shooter = this.state.players.get(proj.ownerId);
              this.broadcast("kill", {
                killer: shooter?.name || "Unknown",
                victim: target.name,
                killerRole: shooter?.role || "unknown",
                victimRole: target.role,
              });
            }
          }

          hit = true;
        }
      });

      if (hit) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // Check win conditions after combat processing
    this.checkWinConditions();
  }

  private startMatch() {
    this.state.matchState = MatchState.PLAYING;
    this.state.matchStartTime = this.state.serverTime;
    this.lock(); // Prevent additional joins
    this.broadcast("matchStart", { startTime: this.state.matchStartTime });
    console.log("Match started!");
  }

  private checkWinConditions() {
    const players = Array.from(this.state.players.values());
    const aliveParan = players.find(p => p.role === "paran" && p.health > 0);
    const aliveGuardians = players.filter(p => p.role !== "paran" && p.health > 0);

    if (!aliveParan) {
      this.endMatch("guardians");
    } else if (aliveGuardians.length === 0) {
      this.endMatch("paran");
    }
  }

  private endMatch(winner: string) {
    // Drain all input queues
    this.state.players.forEach(p => { p.inputQueue = []; });

    // Set winner
    this.state.winner = winner;

    // Serialize stats for broadcast (client can also read from matchStats, but broadcast provides clean object)
    const stats: Record<string, any> = {};
    this.state.matchStats.forEach((playerStats, sessionId) => {
      const player = this.state.players.get(sessionId);
      stats[sessionId] = {
        name: player?.name || "Unknown",
        role: player?.role || "unknown",
        kills: playerStats.kills,
        deaths: playerStats.deaths,
        damageDealt: playerStats.damageDealt,
        shotsFired: playerStats.shotsFired,
        shotsHit: playerStats.shotsHit,
        accuracy: playerStats.shotsFired > 0
          ? Math.round(playerStats.shotsHit / playerStats.shotsFired * 1000) / 10
          : 0
      };
    });

    // Broadcast final stats
    this.broadcast("matchEnd", {
      winner,
      stats,
      duration: this.state.serverTime - this.state.matchStartTime
    });

    // Set match state to ENDED (triggers client scene transitions)
    this.state.matchState = MatchState.ENDED;
    this.state.matchEndTime = this.state.serverTime;

    console.log(`Match ended! Winner: ${winner}`);

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
