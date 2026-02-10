import { Schema, MapSchema, ArraySchema } from "@colyseus/schema";
import { InputState } from "../../../shared/physics";
import { Projectile } from "./Projectile";
export declare enum MatchState {
    WAITING = "waiting",
    PLAYING = "playing",
    ENDED = "ended"
}
export declare class PlayerStats extends Schema {
    kills: number;
    deaths: number;
    damageDealt: number;
    shotsFired: number;
    shotsHit: number;
}
export declare class Player extends Schema {
    x: number;
    y: number;
    vx: number;
    vy: number;
    health: number;
    name: string;
    angle: number;
    role: string;
    lastProcessedSeq: number;
    connected: boolean;
    inputQueue: Array<{
        seq: number;
    } & InputState>;
    lastFireTime: number;
}
export declare class GameState extends Schema {
    players: MapSchema<Player, string>;
    projectiles: ArraySchema<Projectile>;
    serverTime: number;
    mapName: string;
    tickCount: number;
    matchState: string;
    matchStartTime: number;
    matchEndTime: number;
    matchStats: MapSchema<PlayerStats, string>;
    winner: string;
}
