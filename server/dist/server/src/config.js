"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONFIG = exports.SERVER_CONFIG = void 0;
const physics_1 = require("../../shared/physics");
exports.SERVER_CONFIG = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 2567,
    tickRate: physics_1.NETWORK.tickRate,
    fixedTimeStep: physics_1.NETWORK.fixedTimeStep,
    patchRate: physics_1.NETWORK.fixedTimeStep, // must match tick rate for smooth 60Hz sync
};
exports.GAME_CONFIG = {
    maxPlayers: 3, // 1v2 asymmetric game
    playerStartHealth: 100,
};
//# sourceMappingURL=config.js.map