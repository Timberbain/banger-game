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

/** Default arena bounds. Server and client should use map-specific bounds from MapMetadata instead. */
export const ARENA = {
  width: 800,
  height: 608, // 19 tiles x 32px = 608 (matches actual map pixel dimensions)
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
 * @param player - Object with { x, y, vx, vy, angle, role? }
 * @param input - InputState with direction keys
 * @param dt - Delta time in seconds (e.g., 1/60)
 * @param stats - Optional character-specific stats to override PHYSICS defaults
 */
export function applyMovementPhysics(
  player: { x: number; y: number; vx: number; vy: number; angle: number; role?: string },
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

  // Paran-specific Pac-Man style movement
  if (player.role === 'paran') {
    // 1. Cardinal-only movement: if both axes have input, filter to one axis
    if (ax !== 0 && ay !== 0) {
      // Get current velocity direction
      const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);

      // If moving with significant velocity, prioritize the perpendicular axis (allows turning)
      if (currentSpeed > PHYSICS.minVelocity) {
        const movingHorizontally = Math.abs(player.vx) > Math.abs(player.vy);
        if (movingHorizontally) {
          // Currently moving horizontally, switch to vertical input
          ax = 0;
        } else {
          // Currently moving vertically, switch to horizontal input
          ay = 0;
        }
      } else {
        // Not moving or very slow, prioritize vertical (arbitrary but consistent)
        ax = 0;
      }
    }

    // 2. Instant stop: if no input, zero velocity immediately
    const hasInput = ax !== 0 || ay !== 0;
    if (!hasInput) {
      player.vx = 0;
      player.vy = 0;
      return; // Skip rest of physics processing
    }

    // 3. Instant turning: preserve speed magnitude, redirect to new input direction
    const currentSpeed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (currentSpeed > PHYSICS.minVelocity) {
      // Redirect velocity: set to input direction with preserved speed
      const inputMagnitude = Math.sqrt(ax * ax + ay * ay);
      const inputDirX = ax / inputMagnitude;
      const inputDirY = ay / inputMagnitude;
      player.vx = inputDirX * currentSpeed;
      player.vy = inputDirY * currentSpeed;
    }
  } else {
    // Guardian behavior: normalize diagonal movement (divide by sqrt(2) when both axes active)
    if (ax !== 0 && ay !== 0) {
      const normalizeFactor = 1 / Math.sqrt(2);
      ax *= normalizeFactor;
      ay *= normalizeFactor;
    }

    // Instant stop when no input (like humans running and stopping)
    const hasInput = ax !== 0 || ay !== 0;
    if (!hasInput) {
      player.vx = 0;
      player.vy = 0;
      return;
    }
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
