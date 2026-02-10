"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyState = exports.LobbyPlayer = void 0;
const schema_1 = require("@colyseus/schema");
/**
 * Player state within a lobby
 */
class LobbyPlayer extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.name = "";
        this.role = ""; // empty = not selected
        this.ready = false;
        this.connected = true;
    }
}
exports.LobbyPlayer = LobbyPlayer;
__decorate([
    (0, schema_1.type)("string")
], LobbyPlayer.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("string")
], LobbyPlayer.prototype, "role", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], LobbyPlayer.prototype, "ready", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], LobbyPlayer.prototype, "connected", void 0);
/**
 * Lobby room state
 * Manages pre-match player setup with character selection and ready system
 */
class LobbyState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.roomCode = "";
        this.isPrivate = false;
        this.countdown = 0; // seconds remaining, 0 = not counting
    }
}
exports.LobbyState = LobbyState;
__decorate([
    (0, schema_1.type)({ map: LobbyPlayer })
], LobbyState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("string")
], LobbyState.prototype, "roomCode", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], LobbyState.prototype, "isPrivate", void 0);
__decorate([
    (0, schema_1.type)("number")
], LobbyState.prototype, "countdown", void 0);
//# sourceMappingURL=LobbyState.js.map