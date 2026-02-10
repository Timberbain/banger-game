"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakingRoom = exports.MatchmakingState = exports.QueuePlayer = void 0;
const colyseus_1 = require("colyseus");
const schema_1 = require("@colyseus/schema");
const lobby_1 = require("../../../shared/lobby");
class QueuePlayer extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.preferredRole = "";
        this.name = "";
    }
}
exports.QueuePlayer = QueuePlayer;
__decorate([
    (0, schema_1.type)("string")
], QueuePlayer.prototype, "preferredRole", void 0);
__decorate([
    (0, schema_1.type)("string")
], QueuePlayer.prototype, "name", void 0);
class MatchmakingState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.paranCount = 0;
        this.guardianCount = 0;
    }
}
exports.MatchmakingState = MatchmakingState;
__decorate([
    (0, schema_1.type)({ map: QueuePlayer })
], MatchmakingState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("number")
], MatchmakingState.prototype, "paranCount", void 0);
__decorate([
    (0, schema_1.type)("number")
], MatchmakingState.prototype, "guardianCount", void 0);
class MatchmakingRoom extends colyseus_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 50; // Allow many players to queue
    }
    onCreate(options) {
        this.setState(new MatchmakingState());
        // Check for matches every second
        this.matchCheckInterval = this.clock.setInterval(() => {
            this.tryFormMatch();
        }, 1000);
        console.log("MatchmakingRoom created");
    }
    onJoin(client, options) {
        const player = new QueuePlayer();
        player.preferredRole = (options === null || options === void 0 ? void 0 : options.preferredRole) || "faran";
        player.name = (options === null || options === void 0 ? void 0 : options.name) || client.sessionId.substring(0, 20);
        // Validate role
        if (!lobby_1.VALID_ROLES.includes(player.preferredRole)) {
            player.preferredRole = "faran";
        }
        this.state.players.set(client.sessionId, player);
        this.updateCounts();
        console.log(`Player joined matchmaking: ${client.sessionId} as ${player.preferredRole}`);
    }
    onLeave(client) {
        this.state.players.delete(client.sessionId);
        this.updateCounts();
        console.log(`Player left matchmaking: ${client.sessionId}`);
    }
    updateCounts() {
        let paranCount = 0;
        let guardianCount = 0;
        this.state.players.forEach((player) => {
            if (player.preferredRole === "paran") {
                paranCount++;
            }
            else {
                guardianCount++;
            }
        });
        this.state.paranCount = paranCount;
        this.state.guardianCount = guardianCount;
    }
    tryFormMatch() {
        return __awaiter(this, void 0, void 0, function* () {
            // Collect players by role
            const paranPlayers = [];
            const guardianPlayers = [];
            this.state.players.forEach((player, sessionId) => {
                if (player.preferredRole === "paran") {
                    paranPlayers.push(sessionId);
                }
                else {
                    guardianPlayers.push(sessionId);
                }
            });
            // Need 1 paran + 2 guardians
            if (paranPlayers.length >= 1 && guardianPlayers.length >= 2) {
                const matchedParan = paranPlayers[0];
                const matchedGuardians = [guardianPlayers[0], guardianPlayers[1]];
                const matchedIds = [matchedParan, ...matchedGuardians];
                // Build role assignments
                const roleAssignments = {};
                const paranPlayer = this.state.players.get(matchedParan);
                roleAssignments[matchedParan] = "paran";
                // Assign guardian roles: first guardian = faran, second = baran
                const g1Player = this.state.players.get(matchedGuardians[0]);
                const g2Player = this.state.players.get(matchedGuardians[1]);
                roleAssignments[matchedGuardians[0]] = (g1Player === null || g1Player === void 0 ? void 0 : g1Player.preferredRole) === "baran" ? "baran" : "faran";
                roleAssignments[matchedGuardians[1]] = roleAssignments[matchedGuardians[0]] === "faran" ? "baran" : "faran";
                try {
                    // Create a lobby room for the matched players
                    const lobbyRoom = yield colyseus_1.matchMaker.createRoom("lobby_room", {
                        fromMatchmaking: true
                    });
                    console.log(`Match formed! Lobby: ${lobbyRoom.roomId}, Players: ${matchedIds.join(", ")}`);
                    // Notify matched players with the lobby roomId and their assigned roles
                    matchedIds.forEach(sessionId => {
                        const client = this.clients.find(c => c.sessionId === sessionId);
                        if (client) {
                            client.send("matchFound", {
                                lobbyRoomId: lobbyRoom.roomId,
                                assignedRole: roleAssignments[sessionId]
                            });
                        }
                    });
                    // Remove matched players from queue
                    matchedIds.forEach(sessionId => {
                        this.state.players.delete(sessionId);
                    });
                    this.updateCounts();
                }
                catch (error) {
                    console.error("Failed to create lobby for match:", error);
                }
            }
        });
    }
    onDispose() {
        if (this.matchCheckInterval) {
            this.matchCheckInterval.clear();
        }
        console.log("MatchmakingRoom disposed");
    }
}
exports.MatchmakingRoom = MatchmakingRoom;
//# sourceMappingURL=MatchmakingRoom.js.map