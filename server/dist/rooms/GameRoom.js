"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const colyseus_1 = require("colyseus");
const GameState_1 = require("../schema/GameState");
const config_1 = require("../config");
class GameRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = config_1.GAME_CONFIG.maxPlayers;
        this.patchRate = config_1.SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync
    }
    /**
     * Validate input structure and types
     * Rejects non-object inputs, unknown keys, and non-boolean values
     */
    isValidInput(input) {
        // Must be an object
        if (typeof input !== 'object' || input === null || Array.isArray(input)) {
            return false;
        }
        const validKeys = ['left', 'right', 'up', 'down'];
        // Check for unknown keys
        for (const key of Object.keys(input)) {
            if (!validKeys.includes(key)) {
                return false;
            }
        }
        // All values must be booleans
        for (const key of validKeys) {
            if (key in input && typeof input[key] !== 'boolean') {
                return false;
            }
        }
        return true;
    }
    onCreate(options) {
        this.setState(new GameState_1.GameState());
        this.autoDispose = true;
        // Set up fixed timestep loop using accumulator pattern
        let elapsedTime = 0;
        this.setSimulationInterval((deltaTime) => {
            elapsedTime += deltaTime;
            while (elapsedTime >= config_1.SERVER_CONFIG.fixedTimeStep) {
                elapsedTime -= config_1.SERVER_CONFIG.fixedTimeStep;
                this.fixedTick(config_1.SERVER_CONFIG.fixedTimeStep);
            }
        });
        // Register message handler for input queueing
        this.onMessage("input", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player)
                return;
            // Validate input structure and types
            if (!this.isValidInput(message)) {
                console.warn(`Invalid input from ${client.sessionId}:`, message);
                return; // Silently reject -- don't kick (could be a bug, not necessarily cheating)
            }
            // Check for WebSocket latency simulation
            const wsLatency = parseInt(process.env.SIMULATE_LATENCY || '0', 10);
            if (wsLatency > 0) {
                // Delay input queuing to simulate round-trip latency
                setTimeout(() => {
                    // Rate limit: cap queue at 10 to prevent memory abuse
                    if (player.inputQueue.length >= 10) {
                        player.inputQueue.shift(); // Drop oldest
                    }
                    player.inputQueue.push(message);
                }, wsLatency);
                return;
            }
            // Rate limit: cap queue at 10 to prevent memory abuse
            if (player.inputQueue.length >= 10) {
                player.inputQueue.shift(); // Drop oldest
            }
            // Queue input for processing in fixedTick
            player.inputQueue.push(message);
        });
        console.log(`GameRoom created with roomId: ${this.roomId}`);
    }
    onJoin(client, options) {
        const player = new GameState_1.Player();
        // Set initial position (centered with small random offset to avoid overlap)
        player.x = config_1.GAME_CONFIG.arenaWidth / 2 + (Math.random() - 0.5) * 100;
        player.y = config_1.GAME_CONFIG.arenaHeight / 2 + (Math.random() - 0.5) * 100;
        player.health = config_1.GAME_CONFIG.playerStartHealth;
        player.name = (options === null || options === void 0 ? void 0 : options.name)
            ? String(options.name).substring(0, 20)
            : client.sessionId.substring(0, 20);
        player.angle = 0;
        player.role = "";
        this.state.players.set(client.sessionId, player);
        console.log(`Player joined: ${client.sessionId} (${player.name})`);
    }
    onLeave(client, consented) {
        this.state.players.delete(client.sessionId);
        console.log(`Player left: ${client.sessionId} (consented: ${consented})`);
    }
    fixedTick(deltaTime) {
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
                if (input.left)
                    player.x -= 2;
                if (input.right)
                    player.x += 2;
                if (input.up)
                    player.y -= 2;
                if (input.down)
                    player.y += 2;
            }
            // Clamp player position within arena bounds
            player.x = Math.max(0, Math.min(config_1.GAME_CONFIG.arenaWidth, player.x));
            player.y = Math.max(0, Math.min(config_1.GAME_CONFIG.arenaHeight, player.y));
        });
    }
    onDispose() {
        console.log(`GameRoom disposed: ${this.roomId}`);
    }
}
exports.GameRoom = GameRoom;
//# sourceMappingURL=GameRoom.js.map