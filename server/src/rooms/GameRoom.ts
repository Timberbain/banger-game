import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";
import { Projectile } from "../schema/Projectile";
import { SERVER_CONFIG, GAME_CONFIG } from "../config";
import { applyMovementPhysics, updateFacingDirection, PHYSICS, ARENA } from "../../../shared/physics";
import { CHARACTERS, COMBAT } from "../../../shared/characters";

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;
  patchRate = SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync

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
    this.autoDispose = true;

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

    // Assign character role based on join order
    // First player = paran (force), second/third = guardians
    const playerCount = this.state.players.size;
    let role: string;
    if (playerCount === 0) {
      role = "paran";
    } else if (playerCount === 1) {
      role = "faran";
    } else {
      role = "baran";
    }

    const stats = CHARACTERS[role];

    // Set initial position (centered with small random offset to avoid overlap)
    player.x = ARENA.width / 2 + (Math.random() - 0.5) * 100;
    player.y = ARENA.height / 2 + (Math.random() - 0.5) * 100;
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
  }

  onLeave(client: Client, consented: boolean) {
    this.state.players.delete(client.sessionId);
    console.log(`Player left: ${client.sessionId} (consented: ${consented})`);
  }

  fixedTick(deltaTime: number) {
    // Increment tick counter
    this.state.tickCount++;

    // Update server time
    this.state.serverTime += deltaTime;

    // Fixed delta time for deterministic physics (must match client)
    const FIXED_DT = 1 / 60; // seconds

    // Process all player inputs
    const noInput: { left: boolean; right: boolean; up: boolean; down: boolean } = { left: false, right: false, up: false, down: false };

    this.state.players.forEach((player, sessionId) => {
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
          target.health = Math.max(0, target.health - proj.damage);
          hit = true;
        }
      });

      if (hit) {
        this.state.projectiles.splice(i, 1);
      }
    }
  }

  onDispose() {
    console.log(`GameRoom disposed: ${this.roomId}`);
  }
}
