"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameState = exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
class Player extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.x = 0;
        this.y = 0;
        this.health = 100;
        this.name = "";
        this.angle = 0; // facing direction in radians
        this.role = ""; // "guardian" or "paran" in later phases
        // NOT decorated with @type -- server-only, not synced to clients
        this.inputQueue = [];
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
class GameState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.serverTime = 0;
        this.mapName = "test_arena";
        this.tickCount = 0;
    }
}
exports.GameState = GameState;
__decorate([
    (0, schema_1.type)({ map: Player })
], GameState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "serverTime", void 0);
__decorate([
    (0, schema_1.type)("string")
], GameState.prototype, "mapName", void 0);
__decorate([
    (0, schema_1.type)("number")
], GameState.prototype, "tickCount", void 0);
//# sourceMappingURL=GameState.js.map