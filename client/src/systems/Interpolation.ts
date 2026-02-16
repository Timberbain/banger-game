interface Snapshot {
  timestamp: number;
  x: number;
  y: number;
  angle: number;
}

export class InterpolationSystem {
  private buffers: Map<string, Snapshot[]> = new Map();
  private renderDelay: number = 100; // ms behind server time for smooth rendering

  addSnapshot(sessionId: string, snapshot: Snapshot): void {
    // Get or create buffer for this player
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(sessionId, buffer);
    }

    // Add snapshot
    buffer.push(snapshot);

    // Prune old snapshots (keep only last 1000ms worth)
    const cutoffTime = snapshot.timestamp - 1000;
    const startIndex = buffer.findIndex((s) => s.timestamp >= cutoffTime);
    if (startIndex > 0) {
      buffer.splice(0, startIndex);
    }
  }

  removePlayer(sessionId: string): void {
    this.buffers.delete(sessionId);
  }

  /**
   * Snap a player's interpolation buffer to a specific position.
   * Used during stage transitions to prevent lerping from old positions.
   * Clears the buffer and injects a single snapshot at the given position.
   */
  snapTo(sessionId: string, x: number, y: number, angle: number): void {
    const now = Date.now();
    this.buffers.set(sessionId, [
      { timestamp: now - 1, x, y, angle },
      { timestamp: now, x, y, angle },
    ]);
  }

  getInterpolatedState(sessionId: string, currentTime: number): Snapshot | null {
    const buffer = this.buffers.get(sessionId);

    // Need at least 2 snapshots to interpolate
    if (!buffer || buffer.length < 2) {
      return buffer && buffer.length === 1 ? buffer[0] : null;
    }

    // Calculate target render time (delayed behind current time)
    const targetTime = currentTime - this.renderDelay;

    // Find bracketing snapshots
    let from: Snapshot | null = null;
    let to: Snapshot | null = null;

    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].timestamp <= targetTime && targetTime <= buffer[i + 1].timestamp) {
        from = buffer[i];
        to = buffer[i + 1];
        break;
      }
    }

    // If we found bracketing snapshots, interpolate
    if (from && to) {
      const alpha = (targetTime - from.timestamp) / (to.timestamp - from.timestamp);

      return {
        x: from.x + (to.x - from.x) * alpha,
        y: from.y + (to.y - from.y) * alpha,
        angle: from.angle + (to.angle - from.angle) * alpha,
        timestamp: targetTime,
      };
    }

    // Fallback: target time is ahead of all snapshots
    if (targetTime >= buffer[buffer.length - 1].timestamp) {
      return buffer[buffer.length - 1];
    }

    // Fallback: target time is behind all snapshots
    if (targetTime <= buffer[0].timestamp) {
      return buffer[0];
    }

    return null;
  }
}
