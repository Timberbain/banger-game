import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";
import { SERVER_CONFIG, GAME_CONFIG } from "../config";
import { applyMovementPhysics, updateFacingDirection, PHYSICS, ARENA } from "../../../shared/physics";

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

    const validKeys = ['left', 'right', 'up', 'down', 'seq'];

    // Check for unknown keys
    for (const key of Object.keys(input)) {
      if (!validKeys.includes(key)) {
        return false;
      }
    }

    // All direction values must be booleans
    const directionKeys = ['left', 'right', 'up', 'down'];
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

    // Set initial position (centered with small random offset to avoid overlap)
    player.x = ARENA.width / 2 + (Math.random() - 0.5) * 100;
    player.y = ARENA.height / 2 + (Math.random() - 0.5) * 100;
    player.vx = 0;
    player.vy = 0;
    player.health = GAME_CONFIG.playerStartHealth;
    player.name = options?.name
      ? String(options.name).substring(0, 20)
      : client.sessionId.substring(0, 20);
    player.angle = 0;
    player.role = "";
    player.lastProcessedSeq = 0;

    this.state.players.set(client.sessionId, player);

    console.log(`Player joined: ${client.sessionId} (${player.name})`);
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
      // Drain input queue
      let processedAny = false;
      while (player.inputQueue.length > 0) {
        const { seq, ...input } = player.inputQueue.shift()!;

        // Apply acceleration-based physics
        applyMovementPhysics(player, input, FIXED_DT);

        // Update facing direction
        updateFacingDirection(player);

        // Track last processed input sequence for client reconciliation
        player.lastProcessedSeq = seq;
        processedAny = true;
      }

      // If no inputs this tick, still apply physics (drag decelerates the player)
      if (!processedAny) {
        applyMovementPhysics(player, noInput, FIXED_DT);
        updateFacingDirection(player);
      }

      // Clamp player position within arena bounds
      player.x = Math.max(0, Math.min(ARENA.width, player.x));
      player.y = Math.max(0, Math.min(ARENA.height, player.y));

      // Clamp velocity to 0 if player is at arena edge (prevent sliding along walls)
      if (player.x <= 0 || player.x >= ARENA.width) {
        player.vx = 0;
      }
      if (player.y <= 0 || player.y >= ARENA.height) {
        player.vy = 0;
      }
    });
  }

  onDispose() {
    console.log(`GameRoom disposed: ${this.roomId}`);
  }
}
