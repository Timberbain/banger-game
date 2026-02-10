"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = exports.Player = exports.PlayerStats = exports.MatchState = void 0;
const schema_1 = require("@colyseus/schema");
const Projectile_1 = require("./Projectile");
var MatchState;
(function (MatchState) {
    MatchState["WAITING"] = "waiting";
    MatchState["PLAYING"] = "playing";
    MatchState["ENDED"] = "ended";
})(MatchState || (exports.MatchState = MatchState = {}));
class PlayerStats extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.kills = 0;
        this.deaths = 0;
        this.damageDealt = 0;
        this.shotsFired = 0;
        this.shotsHit = 0;
    }
}
exports.PlayerStats = PlayerStats;
__decorate([
    (0, schema_1.type)("number")
], PlayerStats.prototype, "kills", void 0);
__decorate([
    (0, schema_1.type)("number")
], PlayerStats.prototype, "deaths", void 0);
__decorate([
    (0, schema_1.type)("number")
], PlayerStats.prototype, "damageDealt", void 0);
__decorate([
    (0, schema_1.type)("number")
], PlayerStats.prototype, "shotsFired", void 0);
__decorate([
    (0, schema_1.type)("number")
], PlayerStats.prototype, "shotsHit", void 0);
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.x = 0;
        this.y = 0;
        this.vx = 0; // velocity X (synced for client prediction)
        this.vy = 0; // velocity Y (synced for client prediction)
        this.health = 100;
        this.name = "";
        this.angle = 0; // facing direction in radians
        this.role = ""; // "guardian" or "paran" in later phases
        this.lastProcessedSeq = 0; // for client reconciliation
        this.connected = true; // connection status synced to clients
        // NOT decorated with @type -- server-only, not synced to clients
        this.inputQueue = [];
        this.lastFireTime = 0; // server-only cooldown tracking
    }
}
exports.Player = Player;
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "vx", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "vy", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "health", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "angle", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "role", void 0);
__decorate([
    (0, schema_1.type)("number")
], Player.prototype, "lastProcessedSeq", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Player.prototype, "connected", void 0);
class GameState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.projectiles = new schema_1.ArraySchema();
        this.serverTime = 0;
        this.mapName = "test_arena";
        this.tickCount = 0;
        this.matchState = MatchState.WAITING;
        this.matchStartTime = 0;
        this.matchEndTime = 0;
        this.matchStats = new schema_1.MapSchema();
        this.winner = "";
    }
}
exports.GameState = GameState;
__decorate([
    (0, schema_1.type)({ map: Player })
], GameState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)([Projectile_1.Projectile])
], GameState.prototype, "projectiles", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "serverTime", void 0);
__decorate([
    (0, schema_1.type)("string")
], GameState.prototype, "mapName", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "tickCount", void 0);
__decorate([
    (0, schema_1.type)("string")
], GameState.prototype, "matchState", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "matchStartTime", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "matchEndTime", void 0);
__decorate([
    (0, schema_1.type)({ map: PlayerStats })
], GameState.prototype, "matchStats", void 0);
__decorate([
    (0, schema_1.type)("string")
], GameState.prototype, "winner", void 0);
//# sourceMappingURL=GameState.js.map