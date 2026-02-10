# Phase 3: Combat System - Research

**Researched:** 2026-02-10
**Domain:** Multiplayer projectile systems, collision detection, damage calculation, character stats
**Confidence:** HIGH

## Summary

Phase 3 implements a server-authoritative combat system with projectile firing, collision detection, and character-specific stats. This phase adds the core gameplay loop on top of the movement foundation from Phase 2, introducing three distinct character archetypes (Faran, Baran, Paran) with asymmetric stats and collision mechanics.

The core technical challenge is handling projectiles in a server-authoritative multiplayer environment while maintaining the responsive feel established in Phase 2. Projectiles are fundamentally different from player movement—they're spawned dynamically, have limited lifetimes, travel autonomously, and require collision detection against multiple targets. The server must be the source of truth for all combat events (hits, damage, deaths) to prevent cheating, while clients need immediate visual feedback for firing.

Key decisions: (1) Server spawns and simulates all projectiles; clients render them via state sync, (2) Character stats live in shared constants for deterministic behavior, (3) Collision detection runs server-side using simple circle-circle checks (fast enough for 3 players + projectiles at 60Hz), (4) Paran's unique mechanics (instant turning, collision velocity reset) implemented as character-specific physics modifiers.

**Primary recommendation:** Implement projectile system server-first (spawn, movement, collision, despawn), then add client rendering, then layer character stats and unique mechanics, testing at each increment to maintain the responsive feel from Phase 2.

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Colyseus Schema | 0.15.57 | Projectile state sync | ArraySchema for dynamic projectile collection; established in Phase 1 |
| Phaser 3 Arcade Physics | 3.90.0 | Client-side collision visualization | Groups and overlap detection for visual feedback; server does authoritative checks |
| TypeScript | 5.x | Shared combat constants | Character stats, projectile speed, damage values shared between client/server |
| Existing shared/physics.ts | - | Physics constants | Extend with character-specific stats and projectile constants |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | All combat logic uses built-in Colyseus and Phaser features |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side circle checks | Phaser Physics on server | Circle checks are 10x faster for small player counts; Phaser adds unnecessary complexity |
| ArraySchema for projectiles | MapSchema | Arrays better for iteration/cleanup; Maps better for keyed access (not needed) |
| Shared character stats | Server-only config | Shared constants enable client prediction of damage (for UI); small duplication cost |
| Instant projectile spawn | Client prediction | Projectiles travel fast and are visible immediately via delta sync; prediction adds complexity |

**Installation:**
```bash
# No new dependencies required
# All combat logic built on existing Colyseus + Phaser stack
```

## Architecture Patterns

### Recommended Project Structure
```
shared/
├── physics.ts                # Extend with character stats and projectile constants
└── combat.ts                 # New: damage calculation, collision detection helpers

server/src/
├── schema/
│   ├── GameState.ts          # Add projectiles ArraySchema, character role to Player
│   └── Projectile.ts         # New: Schema for projectile state (x, y, vx, vy, ownerId)
├── rooms/
│   └── GameRoom.ts           # Add fire input, projectile simulation, collision detection
└── systems/
    ├── ProjectileSystem.ts   # New: spawn, move, despawn projectiles
    └── CombatSystem.ts       # New: damage calculation, death handling

client/src/
├── scenes/
│   └── GameScene.ts          # Add fire input, render projectiles, damage feedback
└── entities/
    └── ProjectileSprite.ts   # New: visual representation of projectiles
```

### Pattern 1: Server-Authoritative Projectile Lifecycle

**What:** Server creates, simulates, and destroys all projectiles; clients render via state synchronization.

**When to use:** Always for multiplayer combat—prevents cheating and ensures consistent hit detection.

**How it works:**
1. Client sends "fire" input to server (similar to movement input)
2. Server validates (cooldown check, player alive, not reloading)
3. Server spawns projectile in GameState.projectiles ArraySchema
4. Server simulates projectile movement in fixedTick
5. Server checks collisions against players each tick
6. Server applies damage and removes projectile on hit
7. Client receives state delta, creates/updates/destroys sprites

**Example:**
```typescript
// Server: GameRoom.ts
import { Schema, type, ArraySchema } from "@colyseus/schema";

export class Projectile extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") vx: number;
  @type("number") vy: number;
  @type("string") ownerId: string; // sessionId of shooter
  @type("number") damage: number;
  @type("number") spawnTime: number; // for lifetime checks
}

export class GameState extends Schema {
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
}

// In GameRoom onCreate()
this.onMessage("fire", (client, message) => {
  const player = this.state.players.get(client.sessionId);
  if (!player || player.health <= 0) return;

  // Check cooldown (server tracks last fire time per player)
  const now = Date.now();
  if (now - player.lastFireTime < player.fireRate) return;

  // Spawn projectile
  const projectile = new Projectile();
  projectile.x = player.x;
  projectile.y = player.y;
  projectile.vx = Math.cos(player.angle) * PROJECTILE_SPEED;
  projectile.vy = Math.sin(player.angle) * PROJECTILE_SPEED;
  projectile.ownerId = client.sessionId;
  projectile.damage = player.damage;
  projectile.spawnTime = this.state.serverTime;

  this.state.projectiles.push(projectile);
  player.lastFireTime = now;
});

// In fixedTick()
// Move projectiles
for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
  const proj = this.state.projectiles[i];

  proj.x += proj.vx * FIXED_DT;
  proj.y += proj.vy * FIXED_DT;

  // Check lifetime (despawn after 2 seconds)
  if (this.state.serverTime - proj.spawnTime > 2000) {
    this.state.projectiles.splice(i, 1);
    continue;
  }

  // Check bounds (despawn if off-screen)
  if (proj.x < 0 || proj.x > ARENA.width || proj.y < 0 || proj.y > ARENA.height) {
    this.state.projectiles.splice(i, 1);
    continue;
  }

  // Check collisions with players
  this.state.players.forEach((target, targetId) => {
    if (targetId === proj.ownerId) return; // Don't hit self
    if (target.health <= 0) return; // Don't hit dead players

    const dx = proj.x - target.x;
    const dy = proj.y - target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {
      // Hit!
      target.health -= proj.damage;
      if (target.health <= 0) {
        target.health = 0;
        // Handle death (respawn, match end, etc.)
      }

      // Remove projectile
      this.state.projectiles.splice(i, 1);
    }
  });
}
```

**Client rendering:**
```typescript
// Client: GameScene.ts
this.room.state.projectiles.onAdd((projectile, index) => {
  // Create visual sprite
  const sprite = this.add.circle(projectile.x, projectile.y, 4, 0xffff00);
  this.projectileSprites.set(index, sprite);

  // Update on change
  projectile.onChange(() => {
    sprite.x = projectile.x;
    sprite.y = projectile.y;
  });
});

this.room.state.projectiles.onRemove((projectile, index) => {
  const sprite = this.projectileSprites.get(index);
  if (sprite) {
    sprite.destroy();
    this.projectileSprites.delete(index);
  }
});
```

### Pattern 2: Character Stats as Shared Constants

**What:** Define character archetypes (Faran, Baran, Paran) as configuration objects in shared code.

**When to use:** For any game with distinct character classes—enables deterministic behavior and client-side UI prediction.

**How it works:**
1. Define character stat interfaces and constants in shared/
2. Server applies stats when assigning player role
3. Client reads stats for UI display and prediction
4. Stats include: health, acceleration, maxVelocity, damage, fireRate

**Example:**
```typescript
// Source: https://www.gamedev.net/forums/topic/681826-implementing-stats-in-an-rpg-layer-based-approach/
// Adapted for asymmetric multiplayer shooter

// shared/characters.ts
export interface CharacterStats {
  maxHealth: number;
  acceleration: number;
  maxVelocity: number;
  drag: number;
  damage: number;
  fireRate: number; // ms between shots
  projectileSpeed: number;
  turnSpeed: number; // radians/s, or Infinity for instant
}

export const CHARACTERS: Record<string, CharacterStats> = {
  faran: {
    maxHealth: 50,
    acceleration: 800,  // High agility
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,         // Weak attacks
    fireRate: 200,      // Rapid fire (5 shots/sec)
    projectileSpeed: 300,
    turnSpeed: Infinity, // Instant turning
  },
  baran: {
    maxHealth: 50,
    acceleration: 800,
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,
    fireRate: 200,
    projectileSpeed: 300,
    turnSpeed: Infinity,
  },
  paran: {
    maxHealth: 150,     // High health
    acceleration: 300,  // Slow acceleration
    maxVelocity: 300,   // High top speed
    drag: 0.95,         // Retains momentum
    damage: 40,         // Powerful attacks
    fireRate: 1000,     // Slow fire (1 shot/sec)
    projectileSpeed: 400,
    turnSpeed: Infinity, // Instant turning (unique mechanic)
  },
};

// Usage on server
player.role = "paran";
const stats = CHARACTERS[player.role];
player.health = stats.maxHealth;
player.damage = stats.damage;
// ... apply other stats to physics simulation

// Usage on client for UI
const stats = CHARACTERS[player.role];
healthBar.max = stats.maxHealth;
```

### Pattern 3: Circle-Circle Collision Detection

**What:** Fast collision checks using distance formula between circles (players and projectiles).

**When to use:** For small player counts (3-10) where broad-phase spatial partitioning isn't needed.

**How it works:**
1. Represent entities as circles (player: radius 12px, projectile: radius 4px)
2. For each projectile, check distance to each player
3. If distance < sum of radii, collision detected
4. Apply damage and remove projectile

**Example:**
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection
// Circle collision detection

function checkCircleCollision(
  x1: number, y1: number, r1: number,
  x2: number, y2: number, r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < (r1 + r2);
}

// In server fixedTick
const PLAYER_RADIUS = 12;
const PROJECTILE_RADIUS = 4;

for (const projectile of this.state.projectiles) {
  for (const [targetId, target] of this.state.players) {
    if (targetId === projectile.ownerId) continue;

    if (checkCircleCollision(
      projectile.x, projectile.y, PROJECTILE_RADIUS,
      target.x, target.y, PLAYER_RADIUS
    )) {
      // Handle hit
      target.health -= projectile.damage;
      // Remove projectile
      this.state.projectiles.splice(i, 1);
      break;
    }
  }
}
```

### Pattern 4: Paran-Specific Collision Mechanics

**What:** Character-specific physics modifiers for unique gameplay mechanics (Paran loses all velocity on wall/obstacle collision).

**When to use:** When character archetypes require different physics responses beyond stat differences.

**How it works:**
1. Check player role in collision resolution
2. Apply role-specific penalties (velocity reset for Paran)
3. Standard collision for guardians (position clamp only)

**Example:**
```typescript
// In server fixedTick, after movement simulation
this.state.players.forEach((player) => {
  // Arena edge collision
  const hitWall =
    player.x <= 0 || player.x >= ARENA.width ||
    player.y <= 0 || player.y >= ARENA.height;

  // Clamp position (all characters)
  player.x = Math.max(0, Math.min(ARENA.width, player.x));
  player.y = Math.max(0, Math.min(ARENA.height, player.y));

  if (hitWall) {
    if (player.role === "paran") {
      // Paran-specific: lose ALL velocity
      player.vx = 0;
      player.vy = 0;
    } else {
      // Guardians: just clamp velocity at edges (existing behavior)
      if (player.x <= 0 || player.x >= ARENA.width) player.vx = 0;
      if (player.y <= 0 || player.y >= ARENA.height) player.vy = 0;
    }
  }

  // TODO Phase 3: obstacle collision (similar logic)
});
```

### Pattern 5: ArraySchema Projectile Management

**What:** Use Colyseus ArraySchema for dynamic projectile collection with automatic add/remove sync.

**When to use:** For any entity that spawns/despawns dynamically during gameplay.

**Key insight from Colyseus docs:**
- ArraySchema syncs add/remove operations automatically
- Avoid manipulating indexes (shift/unshift) due to encoding cost
- Iterate backwards when removing to avoid index shifting issues

**Example:**
```typescript
// Source: https://docs.colyseus.io/state/schema
// ArraySchema best practices

export class GameState extends Schema {
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
}

// GOOD: Remove by splicing backwards
for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
  if (shouldRemove(this.state.projectiles[i])) {
    this.state.projectiles.splice(i, 1);
  }
}

// BAD: Remove by shifting (expensive encoding)
while (this.state.projectiles.length > 0) {
  this.state.projectiles.shift(); // Costs 2 bytes per remaining item
}

// Client: Listen for add/remove
this.room.state.projectiles.onAdd((projectile, index) => {
  // Create sprite
});

this.room.state.projectiles.onRemove((projectile, index) => {
  // Destroy sprite
});
```

### Anti-Patterns to Avoid

**Client-side hit detection:**
- Don't let clients decide hits—server must be authoritative for anti-cheat
- Clients can predict visual feedback (muzzle flash, tracer) but never damage

**Projectile prediction:**
- Don't predict projectile spawns on client—too complex for minimal latency benefit
- Projectiles visible within 1 tick (16ms) due to delta sync; prediction not worth complexity

**Mixed collision systems:**
- Don't use Phaser Physics for server collision—adds dependency, slower than simple math
- Use Phaser only for client-side visual feedback (overlap effects, particles)

**Stat duplication instead of shared constants:**
- Don't hardcode stats separately on client/server—leads to desyncs
- Use shared TypeScript module for single source of truth

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spatial partitioning | Custom quadtree | Simple O(n²) checks | Only 3 players + ~10 projectiles; quadtree overhead > brute force |
| Projectile pooling | Manual reuse system | ArraySchema add/remove | Colyseus already optimizes small arrays; premature optimization |
| Damage formulas | Complex RPG stats | Flat damage values | Asymmetric balance via character selection, not progression |
| Client-side prediction for projectiles | Input replay for bullets | Server authority only | Projectiles fast + visible instantly; prediction adds complexity for no benefit |

**Key insight:** At 3 players + ~10 projectiles, O(n²) collision checks run in microseconds at 60Hz. Spatial optimization is premature until player counts exceed 20-30 entities.

## Common Pitfalls

### Pitfall 1: ArraySchema Index Shifting During Iteration

**What goes wrong:** Removing projectiles while iterating forward causes index skipping and missed collision checks.

**Why it happens:** `splice(i, 1)` shifts all subsequent elements down; next iteration skips the element that moved into position `i`.

**How to avoid:** Always iterate backwards when removing from arrays during iteration.

**Warning signs:** Intermittent collision misses, projectiles passing through players occasionally.

**Example:**
```typescript
// WRONG: Forward iteration
for (let i = 0; i < projectiles.length; i++) {
  if (shouldRemove(projectiles[i])) {
    projectiles.splice(i, 1); // Next element shifts to i, gets skipped
  }
}

// CORRECT: Backward iteration
for (let i = projectiles.length - 1; i >= 0; i--) {
  if (shouldRemove(projectiles[i])) {
    projectiles.splice(i, 1); // No skipping
  }
}
```

### Pitfall 2: Self-Hit from Projectiles

**What goes wrong:** Projectile hits the player who fired it immediately on spawn.

**Why it happens:** Projectile spawns at player position; collision check runs before projectile moves away.

**How to avoid:** Store ownerId in projectile, skip collision check if target === owner.

**Warning signs:** Players instantly die when firing, negative health values.

**Example:**
```typescript
// WRONG: No owner check
if (checkCollision(projectile, player)) {
  player.health -= projectile.damage;
}

// CORRECT: Skip self-hit
if (player.sessionId !== projectile.ownerId && checkCollision(projectile, player)) {
  player.health -= projectile.damage;
}
```

### Pitfall 3: Cooldown Bypass via Client Spam

**What goes wrong:** Clients send rapid fire messages, server accepts all, leading to machine-gun exploit.

**Why it happens:** Server doesn't track last fire time per player, trusts client timing.

**How to avoid:** Server maintains lastFireTime per player, rejects inputs that violate cooldown.

**Warning signs:** Players fire faster than intended, fire rate depends on client framerate.

**Example:**
```typescript
// WRONG: No server-side cooldown
this.onMessage("fire", (client) => {
  this.spawnProjectile(client.sessionId); // Always accepts
});

// CORRECT: Server enforces cooldown
this.onMessage("fire", (client) => {
  const player = this.state.players.get(client.sessionId);
  const now = Date.now();

  if (now - player.lastFireTime < player.fireRate) {
    return; // Reject: still on cooldown
  }

  this.spawnProjectile(client.sessionId);
  player.lastFireTime = now;
});
```

### Pitfall 4: Projectile Lifetime Memory Leak

**What goes wrong:** Projectiles never despawn, accumulating in state until server crashes.

**Why it happens:** No lifetime check or bounds check; projectiles travel forever.

**How to avoid:** Remove projectiles after fixed lifetime (2s) or when exiting arena bounds.

**Warning signs:** Steadily increasing memory usage, lag after extended play, 1000+ projectiles in state.

**Example:**
```typescript
// WRONG: No lifetime cleanup
for (const proj of this.state.projectiles) {
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  // Projectile exists forever
}

// CORRECT: Lifetime + bounds check
for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
  const proj = this.state.projectiles[i];
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;

  // Remove if too old
  if (this.state.serverTime - proj.spawnTime > 2000) {
    this.state.projectiles.splice(i, 1);
    continue;
  }

  // Remove if out of bounds
  if (proj.x < 0 || proj.x > ARENA.width || proj.y < 0 || proj.y > ARENA.height) {
    this.state.projectiles.splice(i, 1);
  }
}
```

### Pitfall 5: Instant Turning Without Velocity Direction Update

**What goes wrong:** Paran's instant turning changes facing angle but projectiles still fire in old direction.

**Why it happens:** `player.angle` updates instantly but velocity vector (vx, vy) lags behind movement simulation.

**How to avoid:** For characters with instant turning, update angle immediately from input direction when firing.

**Warning signs:** Projectiles fire perpendicular to visual facing, turning feels broken.

**Example:**
```typescript
// WRONG: Fire using angle from last tick
this.onMessage("fire", (client, input) => {
  const player = this.state.players.get(client.sessionId);
  // player.angle might not reflect current input direction yet
  const vx = Math.cos(player.angle) * PROJECTILE_SPEED;
  const vy = Math.sin(player.angle) * PROJECTILE_SPEED;
});

// CORRECT: Calculate angle from current input for instant-turn characters
this.onMessage("fire", (client, input) => {
  const player = this.state.players.get(client.sessionId);
  const stats = CHARACTERS[player.role];

  let fireAngle = player.angle;

  // For instant-turn characters, use input direction if moving
  if (stats.turnSpeed === Infinity && (input.left || input.right || input.up || input.down)) {
    let ax = 0, ay = 0;
    if (input.left) ax -= 1;
    if (input.right) ax += 1;
    if (input.up) ay -= 1;
    if (input.down) ay += 1;

    if (ax !== 0 || ay !== 0) {
      fireAngle = Math.atan2(ay, ax);
    }
  }

  const vx = Math.cos(fireAngle) * PROJECTILE_SPEED;
  const vy = Math.sin(fireAngle) * PROJECTILE_SPEED;
});
```

## Code Examples

Verified patterns from research:

### Server: Projectile Schema Definition
```typescript
// Source: Colyseus Schema docs + Phase 2 Player schema pattern
import { Schema, type, ArraySchema } from "@colyseus/schema";

export class Projectile extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("string") ownerId: string = ""; // sessionId of shooter
  @type("number") damage: number = 10;
  @type("number") spawnTime: number = 0;
}

// Add to GameState
export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
  // ... other fields
}
```

### Server: Projectile Simulation in Fixed Tick
```typescript
// Source: Pattern from Phase 2 movement simulation
fixedTick(deltaTime: number) {
  const FIXED_DT = 1 / 60;

  // Simulate projectiles (backward iteration for safe removal)
  for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
    const proj = this.state.projectiles[i];

    // Move projectile
    proj.x += proj.vx * FIXED_DT;
    proj.y += proj.vy * FIXED_DT;

    // Check lifetime (2 second max)
    if (this.state.serverTime - proj.spawnTime > 2000) {
      this.state.projectiles.splice(i, 1);
      continue;
    }

    // Check bounds
    if (proj.x < 0 || proj.x > ARENA.width ||
        proj.y < 0 || proj.y > ARENA.height) {
      this.state.projectiles.splice(i, 1);
      continue;
    }

    // Check collisions
    let hit = false;
    this.state.players.forEach((target, targetId) => {
      if (hit) return;
      if (targetId === proj.ownerId) return;
      if (target.health <= 0) return;

      const dx = proj.x - target.x;
      const dy = proj.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PLAYER_RADIUS + PROJECTILE_RADIUS) {
        target.health -= proj.damage;
        if (target.health <= 0) target.health = 0;
        hit = true;
      }
    });

    if (hit) {
      this.state.projectiles.splice(i, 1);
    }
  }
}
```

### Client: Render Projectiles from State
```typescript
// Source: Pattern from Phase 2 player sprite creation
create() {
  // ... existing setup

  // Listen for projectile add/remove
  this.room.state.projectiles.onAdd((projectile: any, index: number) => {
    // Create sprite
    const sprite = this.add.circle(projectile.x, projectile.y, 4, 0xffff00);
    sprite.setDepth(5);
    this.projectileSprites.set(index, sprite);

    // Update position on state change
    projectile.onChange(() => {
      sprite.x = projectile.x;
      sprite.y = projectile.y;
    });
  });

  this.room.state.projectiles.onRemove((projectile: any, index: number) => {
    const sprite = this.projectileSprites.get(index);
    if (sprite) {
      sprite.destroy();
      this.projectileSprites.delete(index);
    }
  });
}
```

### Shared: Character Stats Configuration
```typescript
// Source: Game design pattern for character archetypes
// shared/characters.ts

export interface CharacterStats {
  maxHealth: number;
  acceleration: number;
  maxVelocity: number;
  drag: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
}

export const CHARACTERS: Record<string, CharacterStats> = {
  faran: {
    maxHealth: 50,
    acceleration: 800,
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,
    fireRate: 200,
    projectileSpeed: 300,
  },
  baran: {
    maxHealth: 50,
    acceleration: 800,
    maxVelocity: 220,
    drag: 0.88,
    damage: 10,
    fireRate: 200,
    projectileSpeed: 300,
  },
  paran: {
    maxHealth: 150,
    acceleration: 300,
    maxVelocity: 300,
    drag: 0.95,
    damage: 40,
    fireRate: 1000,
    projectileSpeed: 400,
  },
};

export const COMBAT = {
  playerRadius: 12,
  projectileRadius: 4,
  projectileLifetime: 2000, // ms
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side hit detection (e.g., early Call of Duty) | Server-authoritative with lag compensation | ~2010s with competitive shooters | Prevents cheating; requires careful netcode |
| Full projectile prediction | Instant visual spawn, server authority | Modern Colyseus/multiplayer frameworks | Simpler code; projectiles visible within 1 tick |
| Quadtree for all collision | O(n²) for small player counts | Continuous (depends on scale) | Simpler code for <20 entities |
| Manual object pooling | Engine-native recycling (ArraySchema) | Framework-dependent | Cleaner code; trust framework optimization |

**Deprecated/outdated:**
- Client-authoritative damage: Modern anti-cheat requires server validation
- Projectile prediction: Fast networks + delta sync make instant spawn sufficient
- Complex stat progression: Asymmetric balance via character selection (not leveling) is current trend

## Open Questions

1. **Obstacle collision detection for Paran penalty**
   - What we know: Tiled maps have obstacle layers, Phaser can check tile collisions
   - What's unclear: Best way to sync obstacle collision from server (server doesn't run Phaser)
   - Recommendation: Store obstacle positions from tilemap JSON on server load, use circle-rectangle checks in fixedTick

2. **Visual hit feedback timing**
   - What we know: Server determines hits, clients render damage numbers
   - What's unclear: Delay between server hit and client visual feedback (1-2 ticks = 16-32ms acceptable?)
   - Recommendation: Test with latency simulation; may need interpolated hit markers for smooth feel

3. **Death and respawn flow**
   - What we know: health <= 0 triggers death
   - What's unclear: Immediate respawn or wait for round end? (Phase 4 concern)
   - Recommendation: Defer to Phase 4; Phase 3 just sets health to 0 and stops input processing

4. **Projectile visual effects (trails, impacts)**
   - What we know: Phaser supports particle emitters and sprite effects
   - What's unclear: Performance impact of particles for 10+ simultaneous projectiles
   - Recommendation: Start with simple circles; add particles in Phase 7 (UX Polish) if performance allows

## Sources

### Primary (HIGH confidence)
- [Colyseus Schema Documentation](https://docs.colyseus.io/state/schema) - ArraySchema usage, best practices
- [Phaser 3 API: Arcade Physics Collision](https://docs.phaser.io/api-documentation/class/physics-arcade-arcadephysics) - Overlap/collision methods
- [Phaser 3 API: Groups](https://docs.phaser.io/api-documentation/class/physics-arcade-group) - Physics groups for projectiles
- [Phaser 3 API: Keyboard Input](https://docs.phaser.io/api-documentation/class/input-keyboard-keyboardplugin) - Fire action input

### Secondary (MEDIUM confidence)
- [Netcode Series Part 4: Projectiles (Lag Compensation and Prediction)](https://medium.com/@geretti/netcode-series-part-4-projectiles-96427ac53633) - Projectile prediction tradeoffs
- [Gabriel Gambetta: Lag Compensation](https://www.gabrielgambetta.com/lag-compensation.html) - Authoritative server patterns
- [Valve: Latency Compensating Methods](https://developer.valvesoftware.com/wiki/Latency_Compensating_Methods_in_Client/Server_In-game_Protocol_Design_and_Optimization) - Server authority best practices
- [Shooting bullets in Phaser 3 using Arcade Physics Groups](https://codecaptain.io/blog/game-development/shooting-bullets-phaser-3-using-arcade-physics-groups/696) - Bullet pooling with groups
- [Phaser 3 Object Pooling](https://blog.ourcade.co/posts/2020/phaser-3-optimization-object-pool-basic/) - Object reuse patterns
- [2D Collision Detection - MDN](https://developer.mozilla.org/en-US/docs/Games/Techniques/2D_collision_detection) - Circle-circle collision math
- [GameDev.net: Implementing stats in an RPG](https://www.gamedev.net/forums/topic/681826-implementing-stats-in-an-rpg-layer-based-approach/) - Character stat architecture

### Tertiary (LOW confidence - needs validation)
- Web search results on server-authoritative collision detection - General patterns discussed but not specific to stack
- Web search results on multiplayer physics - Broad concepts, need verification against Colyseus specifics

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project from Phase 1/2; extending existing patterns
- Architecture patterns: HIGH - Server-authoritative projectiles follow established Colyseus + Phaser patterns from research
- Character stats: HIGH - Shared constants pattern proven in Phase 2; character design from requirements
- Collision detection: HIGH - Simple circle math well-documented; sufficient for player count
- Pitfalls: MEDIUM - Common issues from web search + reasoning; need testing to validate all edge cases
- Obstacle collision: MEDIUM - Server-side tilemap collision needs implementation testing

**Research date:** 2026-02-10
**Valid until:** 60 days (stable domain - multiplayer combat patterns mature; Phaser/Colyseus APIs stable)
