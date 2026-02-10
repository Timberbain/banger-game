/**
 * Matchmaking queue manager (singleton, not a Room)
 * Manages automatic matchmaking by role
 */
export declare class MatchmakingQueue {
    private paranQueue;
    private guardianQueue;
    private queueTimestamps;
    /**
     * Add a player to the matchmaking queue
     * @param sessionId Player session ID
     * @param preferredRole Player's preferred role ("paran" or "faran"/"baran")
     */
    addToQueue(sessionId: string, preferredRole: string): void;
    /**
     * Remove a player from all queues
     * @param sessionId Player session ID
     */
    removeFromQueue(sessionId: string): void;
    /**
     * Try to form a match from queued players
     * @returns Match composition if successful, null otherwise
     */
    tryFormMatch(): {
        paran: string;
        guardians: string[];
    } | null;
    /**
     * Get current queue sizes
     * @returns Queue size by role
     */
    getQueueSize(): {
        paran: number;
        guardian: number;
    };
    /**
     * Check for players who exceeded timeout
     * @param timeoutMs Timeout in milliseconds
     * @returns Array of timed-out session IDs
     */
    checkTimeouts(timeoutMs: number): string[];
}
export declare const matchmakingQueue: MatchmakingQueue;
