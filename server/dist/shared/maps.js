"use strict";
/**
 * Map metadata registry
 * Shared between client and server for consistent map loading and spawn points
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAPS = void 0;
exports.MAPS = [
    {
        name: "test_arena",
        displayName: "Test Arena",
        file: "maps/test_arena.json",
        tileset: "tiles",
        width: 800,
        height: 608,
        spawnPoints: {
            paran: { x: 400, y: 304 },
            guardians: [{ x: 150, y: 150 }, { x: 650, y: 460 }]
        }
    },
    {
        name: "corridor_chaos",
        displayName: "Corridor Chaos",
        file: "maps/corridor_chaos.json",
        tileset: "tiles",
        width: 800,
        height: 608,
        spawnPoints: {
            paran: { x: 400, y: 304 },
            guardians: [{ x: 100, y: 100 }, { x: 700, y: 500 }]
        }
    },
    {
        name: "cross_fire",
        displayName: "Cross Fire",
        file: "maps/cross_fire.json",
        tileset: "tiles",
        width: 800,
        height: 608,
        spawnPoints: {
            paran: { x: 400, y: 304 },
            guardians: [{ x: 100, y: 500 }, { x: 700, y: 100 }]
        }
    },
    {
        name: "pillars",
        displayName: "Pillars",
        file: "maps/pillars.json",
        tileset: "tiles",
        width: 800,
        height: 608,
        spawnPoints: {
            paran: { x: 400, y: 304 },
            guardians: [{ x: 130, y: 304 }, { x: 670, y: 304 }]
        }
    }
];
//# sourceMappingURL=maps.js.map