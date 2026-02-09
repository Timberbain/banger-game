import { Room, Client } from "colyseus";
import { GameState, Player } from "../schema/GameState";
import { SERVER_CONFIG, GAME_CONFIG } from "../config";

export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONFIG.maxPlayers;
  patchRate = SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync

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

      // Queue input for processing in fixedTick
      player.inputQueue.push(message);

      // Cap queue length to prevent memory abuse
      if (player.inputQueue.length > 10) {
        player.inputQueue.shift();
      }
    });

    console.log(`GameRoom created with roomId: ${this.roomId}`);
  }

  onJoin(client: Client, options?: any) {
    const player = new Player();

    // Set initial position (centered with small random offset to avoid overlap)
    player.x = GAME_CONFIG.arenaWidth / 2 + (Math.random() - 0.5) * 100;
    player.y = GAME_CONFIG.arenaHeight / 2 + (Math.random() - 0.5) * 100;
    player.health = GAME_CONFIG.playerStartHealth;
    player.name = options?.name
      ? String(options.name).substring(0, 20)
      : client.sessionId.substring(0, 20);
    player.angle = 0;
    player.role = "";

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

    // Process all player inputs
    this.state.players.forEach((player, sessionId) => {
      // Drain input queue
      while (player.inputQueue.length > 0) {
        const input = player.inputQueue.shift();

        // Basic movement (will be replaced with acceleration physics in Phase 2)
        if (input.left) player.x -= 2;
        if (input.right) player.x += 2;
        if (input.up) player.y -= 2;
        if (input.down) player.y += 2;
      }

      // Clamp player position within arena bounds
      player.x = Math.max(0, Math.min(GAME_CONFIG.arenaWidth, player.x));
      player.y = Math.max(0, Math.min(GAME_CONFIG.arenaHeight, player.y));
    });
  }

  onDispose() {
    console.log(`GameRoom disposed: ${this.roomId}`);
  }
}
