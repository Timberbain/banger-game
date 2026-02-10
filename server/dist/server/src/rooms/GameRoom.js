"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const colyseus_1 = require("colyseus");
const GameState_1 = require("../schema/GameState");
const Projectile_1 = require("../schema/Projectile");
const config_1 = require("../config");
const physics_1 = require("../../../shared/physics");
const characters_1 = require("../../../shared/characters");
const maps_1 = require("../../../shared/maps");
const lobby_1 = require("../../../shared/lobby");
class GameRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = config_1.GAME_CONFIG.maxPlayers;
        this.patchRate = config_1.SERVER_CONFIG.patchRate; // 1000/60 - must match tick rate for 60Hz sync
    }
    /**
     * Validate input structure and types
     * Rejects non-object inputs, unknown keys, and non-boolean values
     * Accepts optional seq field for client prediction
     */
    isValidInput(input) {
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
    onCreate(options) {
        this.setState(new GameState_1.GameState());
        this.state.matchState = GameState_1.MatchState.WAITING; // Explicit state initialization
        this.autoDispose = true;
        // Store role assignments if from lobby
        if (options.fromLobby && options.roleAssignments) {
            this.roleAssignments = options.roleAssignments;
            console.log("GameRoom created from lobby with role assignments:", this.roleAssignments);
        }
        // Select map (sequential rotation across room instances)
        this.mapMetadata = maps_1.MAPS[GameRoom.currentMapIndex % maps_1.MAPS.length];
        this.state.mapName = this.mapMetadata.name;
        // Advance rotation for next room
        GameRoom.currentMapIndex++;
        console.log(`GameRoom created with map: ${this.mapMetadata.displayName}`);
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
            // Extract seq and input state
            const { seq = 0 } = message, inputState = __rest(message, ["seq"]);
            const queuedInput = Object.assign({ seq }, inputState);
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
    onJoin(client, options) {
        const player = new GameState_1.Player();
        let role;
        // If client sends role from lobby, use it (with validation)
        if ((options === null || options === void 0 ? void 0 : options.role) && ["paran", "faran", "baran"].includes(options.role)) {
            role = options.role;
        }
        else if (this.roleAssignments && this.roleAssignments[client.sessionId]) {
            // Fallback to roleAssignments lookup (unlikely to match but kept for safety)
            role = this.roleAssignments[client.sessionId];
        }
        else {
            // Final fallback: assign by join order (backward compatibility for direct joins)
            const playerCount = this.state.players.size;
            if (playerCount === 0) {
                role = "paran";
            }
            else if (playerCount === 1) {
                role = "faran";
            }
            else {
                role = "baran";
            }
        }
        // Validate no duplicate roles
        let roleTaken = false;
        this.state.players.forEach((p) => {
            if (p.role === role)
                roleTaken = true;
        });
        if (roleTaken) {
            // Assign first available role
            const takenRoles = new Set();
            this.state.players.forEach((p) => { takenRoles.add(p.role); });
            const availableRoles = ["paran", "faran", "baran"].filter(r => !takenRoles.has(r));
            role = availableRoles[0] || "baran";
        }
        // Set spawn position based on role
        if (role === "paran") {
            player.x = this.mapMetadata.spawnPoints.paran.x;
            player.y = this.mapMetadata.spawnPoints.paran.y;
        }
        else if (role === "faran") {
            player.x = this.mapMetadata.spawnPoints.guardians[0].x;
            player.y = this.mapMetadata.spawnPoints.guardians[0].y;
        }
        else {
            player.x = this.mapMetadata.spawnPoints.guardians[1].x;
            player.y = this.mapMetadata.spawnPoints.guardians[1].y;
        }
        const stats = characters_1.CHARACTERS[role];
        // Initialize player stats BEFORE adding player to state
        const playerStats = new GameState_1.PlayerStats();
        this.state.matchStats.set(client.sessionId, playerStats);
        player.vx = 0;
        player.vy = 0;
        player.health = stats.maxHealth;
        player.name = (options === null || options === void 0 ? void 0 : options.name)
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
    onLeave(client, consented) {
        return __awaiter(this, void 0, void 0, function* () {
            const player = this.state.players.get(client.sessionId);
            // Player doesn't exist - already removed or never joined properly
            if (!player) {
                console.log(`Player left but not found: ${client.sessionId}`);
                return;
            }
            // Mark player as disconnected
            player.connected = false;
            // If consented (intentional leave), remove player immediately
            if (consented) {
                console.log(`Player left (consented): ${client.sessionId}`);
                this.state.players.delete(client.sessionId);
                // Keep stats for display (don't delete from matchStats)
                // Check win conditions after intentional leave during match
                if (this.state.matchState === GameState_1.MatchState.PLAYING) {
                    this.checkWinConditions();
                }
                return;
            }
            // Non-consented leave: handle reconnection based on match state
            if (this.state.matchState === GameState_1.MatchState.PLAYING) {
                // Active match: allow reconnection with grace period
                console.log(`Player disconnected during match: ${client.sessionId}, grace period: ${lobby_1.LOBBY_CONFIG.MATCH_RECONNECT_GRACE}s`);
                try {
                    yield this.allowReconnection(client, lobby_1.LOBBY_CONFIG.MATCH_RECONNECT_GRACE);
                    // Successfully reconnected
                    player.connected = true;
                    player.inputQueue = []; // Clear stale inputs
                    console.log(`Player reconnected: ${client.sessionId}`);
                }
                catch (e) {
                    // Grace period expired or reconnection failed
                    console.log(`Player failed to reconnect (grace period expired): ${client.sessionId}`);
                    this.state.players.delete(client.sessionId);
                    // Keep stats for display
                    // Check win conditions after grace period expiration
                    this.checkWinConditions();
                }
            }
            else {
                // Not in active match (WAITING or ENDED): no point reconnecting
                console.log(`Player left during ${this.state.matchState}: ${client.sessionId}`);
                this.state.players.delete(client.sessionId);
            }
        });
    }
    fixedTick(deltaTime) {
        // Guard: only run game logic during PLAYING state
        if (this.state.matchState !== GameState_1.MatchState.PLAYING) {
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
        const noInput = { left: false, right: false, up: false, down: false };
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
            const stats = characters_1.CHARACTERS[player.role];
            // Drain input queue
            let processedAny = false;
            while (player.inputQueue.length > 0) {
                const _a = player.inputQueue.shift(), { seq, fire } = _a, input = __rest(_a, ["seq", "fire"]);
                // Handle fire input
                if (fire && player.health > 0) {
                    // Check cooldown
                    if (this.state.serverTime - player.lastFireTime >= stats.fireRate) {
                        // Spawn projectile
                        const projectile = new Projectile_1.Projectile();
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
                        if (shooterStats)
                            shooterStats.shotsFired++;
                    }
                }
                // Apply character-specific physics
                (0, physics_1.applyMovementPhysics)(player, input, FIXED_DT, {
                    acceleration: stats.acceleration,
                    drag: stats.drag,
                    maxVelocity: stats.maxVelocity,
                });
                // Update facing direction
                (0, physics_1.updateFacingDirection)(player);
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
            player.x = Math.max(0, Math.min(physics_1.ARENA.width, player.x));
            player.y = Math.max(0, Math.min(physics_1.ARENA.height, player.y));
            // Check if wall collision occurred
            const hitWallX = player.x !== prevX;
            const hitWallY = player.y !== prevY;
            // Paran-specific wall penalty: lose ALL velocity on wall collision
            if (player.role === "paran" && (hitWallX || hitWallY)) {
                player.vx = 0;
                player.vy = 0;
            }
            else {
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
            if (!proj)
                continue; // Safety check for TypeScript strict null checking
            // Move projectile
            proj.x += proj.vx * FIXED_DT;
            proj.y += proj.vy * FIXED_DT;
            // Lifetime check
            if (this.state.serverTime - proj.spawnTime > characters_1.COMBAT.projectileLifetime) {
                this.state.projectiles.splice(i, 1);
                continue;
            }
            // Bounds check
            if (proj.x < 0 || proj.x > physics_1.ARENA.width || proj.y < 0 || proj.y > physics_1.ARENA.height) {
                this.state.projectiles.splice(i, 1);
                continue;
            }
            // Collision with players
            let hit = false;
            this.state.players.forEach((target, targetId) => {
                if (hit)
                    return;
                if (targetId === proj.ownerId)
                    return; // No self-hit
                if (target.health <= 0)
                    return; // Skip dead
                const dx = proj.x - target.x;
                const dy = proj.y - target.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < characters_1.COMBAT.playerRadius + characters_1.COMBAT.projectileRadius) {
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
                            if (targetStats)
                                targetStats.deaths++;
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
    startMatch() {
        this.state.matchState = GameState_1.MatchState.PLAYING;
        this.state.matchStartTime = this.state.serverTime;
        this.lock(); // Prevent additional joins
        this.broadcast("matchStart", { startTime: this.state.matchStartTime });
        console.log("Match started!");
    }
    checkWinConditions() {
        const players = Array.from(this.state.players.values());
        const aliveParan = players.find(p => p.role === "paran" && p.health > 0);
        const aliveGuardians = players.filter(p => p.role !== "paran" && p.health > 0);
        if (!aliveParan) {
            this.endMatch("guardians");
        }
        else if (aliveGuardians.length === 0) {
            this.endMatch("paran");
        }
    }
    endMatch(winner) {
        // Drain all input queues
        this.state.players.forEach(p => { p.inputQueue = []; });
        // Set winner
        this.state.winner = winner;
        // Serialize stats for broadcast (client can also read from matchStats, but broadcast provides clean object)
        const stats = {};
        this.state.matchStats.forEach((playerStats, sessionId) => {
            const player = this.state.players.get(sessionId);
            stats[sessionId] = {
                name: (player === null || player === void 0 ? void 0 : player.name) || "Unknown",
                role: (player === null || player === void 0 ? void 0 : player.role) || "unknown",
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
        this.state.matchState = GameState_1.MatchState.ENDED;
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
}
exports.GameRoom = GameRoom;
// Static map rotation index shared across room instances
GameRoom.currentMapIndex = 0;
//# sourceMappingURL=GameRoom.js.map