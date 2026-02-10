import { Schema } from "@colyseus/schema";
export declare class Projectile extends Schema {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ownerId: string;
    damage: number;
    spawnTime: number;
}
