import { Room, Client } from "colyseus";
import { Schema, MapSchema } from "@colyseus/schema";
export declare class QueuePlayer extends Schema {
    preferredRole: string;
    name: string;
}
export declare class MatchmakingState extends Schema {
    players: MapSchema<QueuePlayer, string>;
    paranCount: number;
    guardianCount: number;
}
export declare class MatchmakingRoom extends Room<MatchmakingState> {
    maxClients: number;
    private matchCheckInterval?;
    onCreate(options: any): void;
    onJoin(client: Client, options?: any): void;
    onLeave(client: Client): void;
    private updateCounts;
    private tryFormMatch;
    onDispose(): void;
}
