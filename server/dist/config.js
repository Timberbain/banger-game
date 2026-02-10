"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_CONFIG = exports.SERVER_CONFIG = void 0;
exports.SERVER_CONFIG = {
    port: process.env.PORT ? parseInt(process.env.PORT) : 2567,
    tickRate: 60,
    fixedTimeStep: 1000 / 60, // 16.67ms
    patchRate: 1000 / 60, // 16.67ms - must match tick rate for smooth 60Hz sync
};
exports.GAME_CONFIG = {
    maxPlayers: 3, // 1v2 asymmetric game
    playerStartHealth: 100,
    arenaWidth: 800,
    arenaHeight: 600,
};
//# sourceMappingURL=config.js.map