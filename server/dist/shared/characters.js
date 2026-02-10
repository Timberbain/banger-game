"use strict";
/**
 * Character archetypes and combat constants
 * Defines stats for faran, baran (guardians), and paran (force)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMBAT = exports.CHARACTERS = void 0;
exports.CHARACTERS = {
    faran: {
        maxHealth: 50,
        acceleration: 800,
        maxVelocity: 160,
        drag: 0.4,
        damage: 10,
        fireRate: 200, // 5 shots/sec
        projectileSpeed: 300,
    },
    baran: {
        maxHealth: 50,
        acceleration: 800,
        maxVelocity: 160,
        drag: 0.4,
        damage: 10,
        fireRate: 200, // 5 shots/sec
        projectileSpeed: 300,
    },
    paran: {
        maxHealth: 150,
        acceleration: 300,
        maxVelocity: 300,
        drag: 0.95,
        damage: 40,
        fireRate: 1000, // 1 shot/sec
        projectileSpeed: 400,
    },
};
exports.COMBAT = {
    playerRadius: 12,
    projectileRadius: 4,
    projectileLifetime: 2000, // ms
};
//# sourceMappingURL=characters.js.map