import { Room, Client } from "colyseus";
import { GameState, Player, MatchState, PlayerStats } from "../schema/GameState";
import { Projectile } from "../schema/Projectile";
import { SERVER_CONFIG, GAME_CONFIG } from "../config";
import { applyMovementPhysics, updateFacingDirection, PHYSICS, ARENA } from "../../../shared/physics";
import { CHARACTERS, COMBAT } from "../../../shared/characters";
import { MAPS, MapMetadata } from "../../../shared/maps";
import { LOBBY_CONFIG } from "../../../shared/lobby";

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;
  patchRate = SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync

  // Static map rotation index shared across room instances
  private static currentMapIndex: number = 0;
  private mapMetadata!: MapMetadata;
  private roleAssignments?: Record<string, string>;

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

    // Set up fixed timestep loop using accumulator pattern
    let elapsedTime = 0;
    this.setSimulationInterval((deltaTime) => {
      elapsedTime += deltaTime;
      while (elapsedTime >= SERVER_CONFIG.fixedTimeStep) {
        elapsedTime -= SERVER_CONFIG.fixedTimeStep;
        this.fixedTick(SERVER_CONFIG.fixedTimeStep);
      }
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

    // Fixed delta time for deterministic physics (must match client)
    const FIXED_DT = 1 / 60; // seconds

    // Process all player inputs
    const noInput: { left: boolean; right: boolean; up: boolean; down: boolean } = { left: false, right: false, up: false, down: false };

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

        // Apply character-specific physics
        applyMovementPhysics(player, input, FIXED_DT, {
          acceleration: stats.acceleration,
          drag: stats.drag,
          maxVelocity: stats.maxVelocity,
        });

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
        player.x += player.vx * FIXED_DT;
        player.y += player.vy * FIXED_DT;
      }

      // Store position before clamping for collision detection
      const prevX = player.x;
      const prevY = player.y;

      // Clamp player position within arena bounds
      player.x = Math.max(0, Math.min(ARENA.width, player.x));
      player.y = Math.max(0, Math.min(ARENA.height, player.y));

      // Check if wall collision occurred
      const hitWallX = player.x !== prevX;
      const hitWallY = player.y !== prevY;

      // Paran-specific wall penalty: lose ALL velocity on wall collision
      if (player.role === "paran" && (hitWallX || hitWallY)) {
        player.vx = 0;
        player.vy = 0;
      } else {
        // Guardian behavior: only zero the axis that hit the wall
        if (hitWallX) {
          player.vx = 0;
        }
        if (hitWallY) {
          player.vy = 0;
        }
      }
    });

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

      // Bounds check
      if (proj.x < 0 || proj.x > ARENA.width || proj.y < 0 || proj.y > ARENA.height) {
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
