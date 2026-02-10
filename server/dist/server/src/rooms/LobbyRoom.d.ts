import { Room, Client } from "colyseus";
import { LobbyState } from "../schema/LobbyState";
/**
 * Pre-match lobby room
 * Handles character selection, ready system, and transition to GameRoom
 */
export declare class LobbyRoom extends Room<LobbyState> {
    maxClients: number;
    private countdownInterval?;
    private matchmakingCheckInterval?;
    onCreate(options: any): void;
    onJoin(client: Client, options?: any): void;
    onLeave(client: Client, consented: boolean): Promise<void>;
    /**
     * Check if all conditions are met to start countdown
     */
    private checkReadyToStart;
    /**
     * Start the match countdown
     */
    private startCountdown;
    /**
     * Create GameRoom and transition all players
     */
    private startMatch;
    onDispose(): void;
}
