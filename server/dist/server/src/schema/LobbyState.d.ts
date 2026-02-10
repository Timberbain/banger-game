import { Schema, MapSchema } from "@colyseus/schema";
/**
 * Player state within a lobby
 */
export declare class LobbyPlayer extends Schema {
    name: string;
    role: string;
    ready: boolean;
    connected: boolean;
}
/**
 * Lobby room state
 * Manages pre-match player setup with character selection and ready system
 */
export declare class LobbyState extends Schema {
    players: MapSchema<LobbyPlayer, string>;
    roomCode: string;
    isPrivate: boolean;
    countdown: number;
}
