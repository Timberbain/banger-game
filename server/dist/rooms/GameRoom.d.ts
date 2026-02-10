import { Room, Client } from "colyseus";
import { GameState } from "../schema/GameState";
export declare class GameRoom extends Room<GameState> {
    maxClients: number;
    patchRate: number;
    /**
     * Validate input structure and types
     * Rejects non-object inputs, unknown keys, and non-boolean values
     */
    private isValidInput;
    onCreate(options: any): void;
    onJoin(client: Client, options?: any): void;
    onLeave(client: Client, consented: boolean): void;
    fixedTick(deltaTime: number): void;
    onDispose(): void;
}
