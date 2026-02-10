import { Room, Client } from "colyseus";
import { GameState } from "../schema/GameState";
export declare class GameRoom extends Room<GameState> {
    maxClients: number;
    patchRate: number;
    private static currentMapIndex;
    private mapMetadata;
    private roleAssignments?;
    /**
     * Validate input structure and types
     * Rejects non-object inputs, unknown keys, and non-boolean values
     * Accepts optional seq field for client prediction
     */
    private isValidInput;
    onCreate(options: any): void;
    onJoin(client: Client, options?: any): void;
    onLeave(client: Client, consented: boolean): Promise<void>;
    fixedTick(deltaTime: number): void;
    private startMatch;
    private checkWinConditions;
    private endMatch;
    onDispose(): void;
}
