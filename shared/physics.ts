/**
 * Shared physics constants and movement logic
 * Used by both client and server for deterministic prediction
 */

export const PHYSICS = {
  acceleration: 600, // px/s^2 applied when input held
  drag: 0.85, // exponential damping factor per second
  maxVelocity: 200, // px/s max speed cap
  minVelocity: 0.01, // threshold below which velocity snaps to 0
  facingThreshold: 10, // speed threshold for updating facing angle
};

export const ARENA = {
  width: 800,
  height: 600,
};

export const NETWORK = {
  tickRate: 60,
  fixedTimeStep: 1000 / 60, // 16.67ms
  interpolationDelay: 100, // ms behind server time for remote rendering
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
 * @param player - Object with { x, y, vx, vy, angle }
 * @param input - InputState with direction keys
 * @param dt - Delta time in seconds (e.g., 1/60)
 * @param stats - Optional character-specific stats to override PHYSICS defaults
 */
export function applyMovementPhysics(
  player: { x: number; y: number; vx: number; vy: number; angle: number },
  input: InputState,
  dt: number,
  stats?: { acceleration: number; drag: number; maxVelocity: number }
): void {
  // Use character-specific stats or fallback to PHYSICS defaults
  const acceleration = stats?.acceleration ?? PHYSICS.acceleration;
  const drag = stats?.drag ?? PHYSICS.drag;
  const maxVelocity = stats?.maxVelocity ?? PHYSICS.maxVelocity;

  // Calculate acceleration from input
  let ax = 0;
  let ay = 0;

  if (input.left) ax -= acceleration;
  if (input.right) ax += acceleration;
  if (input.up) ay -= acceleration;
  if (input.down) ay += acceleration;

  // Normalize diagonal movement (divide by sqrt(2) when both axes active)
  if (ax !== 0 && ay !== 0) {
    const normalizeFactor = 1 / Math.sqrt(2);
    ax *= normalizeFactor;
    ay *= normalizeFactor;
  }

  // Integrate velocity
  player.vx += ax * dt;
  player.vy += ay * dt;

  // Apply drag (exponential damping)
  player.vx *= Math.pow(drag, dt);
  player.vy *= Math.pow(drag, dt);

  // Snap to 0 if below minVelocity threshold
  if (Math.abs(player.vx) < PHYSICS.minVelocity) player.vx = 0;
  if (Math.abs(player.vy) < PHYSICS.minVelocity) player.vy = 0;

  // Clamp to maxVelocity
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
  if (speed > maxVelocity) {
    const scale = maxVelocity / speed;
    player.vx *= scale;
    player.vy *= scale;
  }

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;
}

/**
 * Update player facing direction based on velocity
 * Only updates if speed is above threshold
 *
 * @param player - Object with { vx, vy, angle }
 */
export function updateFacingDirection(
  player: { vx: number; vy: number; angle: number }
): void {
  const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

  // Only update facing if moving above threshold
  if (speed > PHYSICS.facingThreshold) {
    player.angle = Math.atan2(player.vy, player.vx);
  }
}
