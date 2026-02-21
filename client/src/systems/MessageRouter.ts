import { Room } from 'colyseus.js';

/**
 * Thin wrapper around Colyseus room.onMessage that prevents listener accumulation.
 *
 * Colyseus 0.15 has no off() for onMessage — listeners persist across scene restarts.
 * MessageRouter registers each message type ONCE with room.onMessage, then delegates
 * to a replaceable callback stored in a Map. Calling on() replaces (not adds) the
 * callback, and clear() nullifies all callbacks for safe scene shutdown.
 */
export class MessageRouter {
  private callbacks = new Map<string, Function | null>();
  private registered = new Set<string>();

  constructor(private room: Room) {}

  /** Register or replace a callback for a message type */
  on(type: string, callback: Function): void {
    this.callbacks.set(type, callback);

    // Only register the room.onMessage listener once per type
    if (!this.registered.has(type)) {
      this.registered.add(type);
      this.room.onMessage(type, (data: any) => {
        const cb = this.callbacks.get(type);
        if (cb) cb(data);
      });
    }
  }

  /** Nullify all callbacks (safe for scene shutdown) */
  clear(): void {
    this.callbacks.forEach((_, key) => {
      this.callbacks.set(key, null);
    });
  }
}
