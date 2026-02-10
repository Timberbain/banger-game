/**
 * Shared physics constants and movement logic
 * Used by both client and server for deterministic prediction
 */
export declare const PHYSICS: {
    acceleration: number;
    drag: number;
    maxVelocity: number;
    minVelocity: number;
    facingThreshold: number;
};
export declare const ARENA: {
    width: number;
    height: number;
};
export declare const NETWORK: {
    tickRate: number;
    fixedTimeStep: number;
    interpolationDelay: number;
};
export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    fire?: boolean;
}
/**
 * Apply acceleration-based physics to a player
 * Mutates player object in place
 *
 * @param player - Object with { x, y, vx, vy, angle, role? }
 * @param input - InputState with direction keys
 * @param dt - Delta time in seconds (e.g., 1/60)
 * @param stats - Optional character-specific stats to override PHYSICS defaults
 */
export declare function applyMovementPhysics(player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    role?: string;
}, input: InputState, dt: number, stats?: {
    acceleration: number;
    drag: number;
    maxVelocity: number;
}): void;
/**
 * Update player facing direction based on velocity
 * Only updates if speed is above threshold
 *
 * @param player - Object with { vx, vy, angle }
 */
export declare function updateFacingDirection(player: {
    vx: number;
    vy: number;
    angle: number;
}): void;
