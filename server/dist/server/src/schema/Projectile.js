"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Projectile = void 0;
const schema_1 = require("@colyseus/schema");
class Projectile extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.ownerId = "";
        this.damage = 0;
        this.spawnTime = 0;
    }
}
exports.Projectile = Projectile;
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "vx", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "vy", void 0);
__decorate([
    (0, schema_1.type)("string")
], Projectile.prototype, "ownerId", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "damage", void 0);
__decorate([
    (0, schema_1.type)("number")
], Projectile.prototype, "spawnTime", void 0);
//# sourceMappingURL=Projectile.js.map