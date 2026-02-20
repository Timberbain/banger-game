/**
 * Matchmaking queue manager (singleton, not a Room)
 * Manages automatic matchmaking by role
 */

export class MatchmakingQueue {
  private paranQueue: string[] = [];
  private guardianQueue: string[] = [];
  private queueTimestamps: Map<string, number> = new Map();

  /**
   * Add a player to the matchmaking queue
   * @param sessionId Player session ID
   * @param preferredRole Player's preferred role ("paran" or "faran"/"baran")
   */
  addToQueue(sessionId: string, preferredRole: string): void {
    // Remove from queues first (in case they're switching)
    this.removeFromQueue(sessionId);

    // Add to appropriate queue
    if (preferredRole === 'paran') {
      this.paranQueue.push(sessionId);
    } else {
      // faran and baran both go to guardian queue
      this.guardianQueue.push(sessionId);
    }

    // Track timestamp for timeout
    this.queueTimestamps.set(sessionId, Date.now());

    console.log(`Added ${sessionId} to ${preferredRole === 'paran' ? 'paran' : 'guardian'} queue`);
  }

  /**
   * Remove a player from all queues
   * @param sessionId Player session ID
   */
  removeFromQueue(sessionId: string): void {
    this.paranQueue = this.paranQueue.filter((id) => id !== sessionId);
    this.guardianQueue = this.guardianQueue.filter((id) => id !== sessionId);
    this.queueTimestamps.delete(sessionId);
  }

  /**
   * Try to form a match from queued players
   * @returns Match composition if successful, null otherwise
   */
  tryFormMatch(): { paran: string; guardians: string[] } | null {
    if (this.paranQueue.length >= 1 && this.guardianQueue.length >= 2) {
      // Pop 1 paran and 2 guardians
      const paran = this.paranQueue.shift()!;
      const guardians = [this.guardianQueue.shift()!, this.guardianQueue.shift()!];

      // Remove timestamps
      this.queueTimestamps.delete(paran);
      guardians.forEach((g) => this.queueTimestamps.delete(g));

      console.log(`Match formed: ${paran} vs ${guardians.join(', ')}`);

      return { paran, guardians };
    }

    return null;
  }

  /**
   * Get current queue sizes
   * @returns Queue size by role
   */
  getQueueSize(): { paran: number; guardian: number } {
    return {
      paran: this.paranQueue.length,
      guardian: this.guardianQueue.length,
    };
  }

  /**
   * Check for players who exceeded timeout
   * @param timeoutMs Timeout in milliseconds
   * @returns Array of timed-out session IDs
   */
  checkTimeouts(timeoutMs: number): string[] {
    const now = Date.now();
    const timedOut: string[] = [];

    this.queueTimestamps.forEach((timestamp, sessionId) => {
      if (now - timestamp > timeoutMs) {
        timedOut.push(sessionId);
      }
    });

    // Remove timed-out players
    timedOut.forEach((sessionId) => this.removeFromQueue(sessionId));

    return timedOut;
  }
}

// Export singleton instance
export const matchmakingQueue = new MatchmakingQueue();
