import { Schema, MapSchema } from "@colyseus/schema";
export declare class Player extends Schema {
    x: number;
    y: number;
    health: number;
    name: string;
    angle: number;
    role: string;
    inputQueue: any[];
}
export declare class GameState extends Schema {
    players: MapSchema<Player, string>;
    serverTime: number;
    mapName: string;
    tickCount: number;
}
