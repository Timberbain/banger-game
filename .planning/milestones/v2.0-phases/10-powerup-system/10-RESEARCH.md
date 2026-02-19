# Phase 10: Powerup System - Research

**Researched:** 2026-02-16
**Domain:** Server-authoritative powerup spawning, collection, buffs, HUD integration
**Confidence:** HIGH

## Summary

Phase 10 adds a powerup system to the arena combat: server-authoritative spawning of potion items on walkable tiles, instant collection on contact, three buff types (speed boost, invincibility, projectile/beam), and HUD indicators for active buffs. The system integrates deeply with existing architecture: GameRoom's 60Hz tick loop for spawning/collection/buff timers, Colyseus Schema (MapSchema) for state synchronization, GameScene for rendering powerup sprites and buff auras, HUDScene for duration indicators, and ParticleFactory/AudioManager for feedback.

The codebase already has all prerequisites: potion icon sprites (red/green/orange/blue in `assets/icons/`), the `particle` texture for runtime-tinted aura effects, a kill feed system for announcements, the `broadcast()` pattern for events, and the `cleanupStageVisuals()` + `resetStage()` patterns for stage lifecycle integration. The obstacle system (`ObstacleState` in MapSchema) provides a proven template for adding another synced collection to `GameState`.

**Primary recommendation:** Model powerups as a new `PowerupState` Schema class synced via `MapSchema<PowerupState>` on `GameState`, with server-side spawn logic in `fixedTick()`, collection detection alongside projectile/contact-kill checks, and buff state tracked as server-only fields on `Player` (not synced as Schema -- broadcast buff events instead for client feedback).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Spawn Rules
- Random open tiles (walkable, no walls/obstacles) -- not fixed hotspots
- Spawn every 8-12s (frequent cadence)
- Maximum 2 powerups on the map simultaneously
- Minimum distance from alive players to prevent instant grabs (dead players don't count)
- First spawn delayed 10-15s into a stage -- players settle into positions first
- Powerups despawn after ~15s if uncollected
- Despawning powerups flash/blink for last 3-5s as warning
- New spawn waits for next timer tick (no immediate respawn on collect/despawn)
- Powerup type selection is purely random (no rubber-banding/weighting)
- Only spawn on fully open ground tiles (no obstacle tiles, no destroyed obstacle locations)

#### Buff Design
- **Speed Boost:** +50% movement speed for 4-5s -- same effect for both Paran and Guardians
- **Invincibility:** Fully immune to all damage for 2-3s -- same for both roles. Wall velocity penalty still applies to Paran
- **Projectile Buff (role-specific):**
  - Guardian: 2x projectile hitbox + 2x projectile speed for 5-6s
  - Paran: "Paran's Beam" -- 5x size projectile that travels through obstacles AND walls, destroying any obstacle in its path. Damages Guardians on hit. Continuous fire with 2x longer cooldown. Duration 5-6s
- Different buff types are stackable (can have speed + invincibility simultaneously)
- Same buff type does NOT stack effects -- refreshes timer only
- Three powerup types total for Phase 10 (speed, invincibility, projectile/beam)

#### Visual Feedback
- Buffed players display distinct particle aura per powerup type (no color tint on sprite)
  - Speed: distinct particle style (e.g., blue streaks)
  - Invincibility: distinct particle style (e.g., gold shield)
  - Projectile/Beam: distinct particle style (e.g., red sparks)
- Opponents can identify which buff type by the particle aura -- supports counter-play readability
- Powerup items on the ground use potion bottle icon sprites, colored by type, with bobbing animation
- Paran's Beam projectile has a distinct large glowing beam visual -- clearly different from normal Guardian projectiles

#### Collection Mechanics
- Instant on contact -- no pause, no pickup animation, keeps momentum
- Pickup feedback: SFX chime + brief screen flash + floating text showing powerup name
- First server tick wins on simultaneous collision -- frame-perfect races possible
- Full visibility: everyone sees who picked up what (pickup particles visible to all)
- Kill feed announces all pickups ("Paran collected Speed Boost")
- Kill feed also announces spawns ("Speed Boost appeared!")
- Spectators (dead/eliminated players) can see all powerup spawns and pickups

#### HUD Display
- Active powerup indicator below health bar
- Shrinking bar for remaining duration (not numeric countdown)
- Multiple active buffs shown side by side (up to 3 max)
- Visual flash on HUD indicator when buff is about to expire (last 1-2s) -- no sound warning

### Claude's Discretion
- Exact minimum spawn distance from players
- Particle aura color palette and style per buff type
- Potion bottle sprite design details
- Beam visual rendering approach
- Exact spawn timer randomization within 8-12s range
- SFX design for pickup and despawn
- Kill feed message formatting

### Deferred Ideas (OUT OF SCOPE)
- Phantom powerup (phase through walls/obstacles)
- Heal potion (instant HP restore)
- Rapid fire powerup (reduced cooldown)
- Magnet powerup (pull nearby powerups)
- Rubber-banding/weighted spawn by game state
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Colyseus | 0.15.57 | Server-authoritative powerup state sync | Already used, MapSchema pattern proven with ObstacleState |
| Colyseus.js | 0.15.28 | Client-side state listeners for powerup rendering | Already used, onAdd/onChange/onRemove pattern established |
| Phaser 3 | 3.90 | Powerup sprite rendering, particle auras, tweens | Already used, particle API + follow proven in ParticleFactory |
| jsfxr | (existing) | Procedural SFX for pickup/despawn sounds | Already used via AudioManager + SoundDefs pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PIL/Pillow | (existing) | Generate potion bottle sprites if needed | Only if existing icon assets need modification |

### Alternatives Considered
None -- all decisions lock into the existing stack. No new dependencies required.

**Installation:** No new packages needed. All systems already exist.

## Architecture Patterns

### Recommended File Changes
```
server/src/
  schema/
    GameState.ts      # Add PowerupState Schema, add MapSchema<PowerupState> to GameState
    Powerup.ts        # NEW: PowerupState Schema class (x, y, type, spawnTime)
  rooms/
    GameRoom.ts       # Add spawn logic, collection detection, buff timers, buff effects

shared/
  powerups.ts         # NEW: Powerup type enum, buff durations, spawn constants

client/src/
  scenes/
    GameScene.ts      # Render powerup sprites, aura particles, beam projectiles, stage cleanup
    HUDScene.ts       # Buff duration indicators below health bar
    BootScene.ts      # Preload potion icon sprites
  systems/
    ParticleFactory.ts # Add aura effect methods (speed/invincibility/projectile continuous emitters)
  config/
    SoundDefs.ts      # Add powerup_pickup, powerup_spawn, powerup_despawn SFX
```

### Pattern 1: PowerupState Schema (follows ObstacleState pattern)
**What:** A Colyseus Schema class synced via MapSchema on GameState, keyed by unique ID
**When to use:** For powerup position and type sync to all clients
**Example:**
```typescript
// server/src/schema/Powerup.ts
import { Schema, type } from '@colyseus/schema';

export class PowerupState extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('uint8') powerupType: number = 0; // 0=speed, 1=invincibility, 2=projectile
  @type('number') spawnTime: number = 0;  // serverTime when spawned (for despawn timer)
}
```

```typescript
// In GameState.ts
@type({ map: PowerupState }) powerups = new MapSchema<PowerupState>();
```

### Pattern 2: Server-Side Spawn Logic (in fixedTick or dedicated method)
**What:** Timer-based spawn check each tick, with walkable tile validation and player distance check
**When to use:** Every fixedTick during PLAYING state
**Example:**
```typescript
// Pseudocode for spawn logic
private nextSpawnTime: number = 0; // server-only
private spawnId: number = 0;       // server-only counter

private checkPowerupSpawn(): void {
  if (this.state.matchState !== MatchState.PLAYING) return;
  if (this.state.powerups.size >= 2) return; // Max 2 on map
  if (this.state.serverTime < this.nextSpawnTime) return;

  // Find random walkable tile not near alive players
  const tile = this.findSpawnTile();
  if (!tile) return; // No valid tile found (extremely unlikely)

  const powerup = new PowerupState();
  powerup.x = tile.x;
  powerup.y = tile.y;
  powerup.powerupType = Math.floor(Math.random() * 3);
  powerup.spawnTime = this.state.serverTime;

  const id = `pwr_${this.spawnId++}`;
  this.state.powerups.set(id, powerup);

  // Broadcast spawn event for kill feed
  this.broadcast('powerupSpawn', { type: powerup.powerupType, x: powerup.x, y: powerup.y });

  // Schedule next spawn
  this.nextSpawnTime = this.state.serverTime + 8000 + Math.random() * 4000;
}
```

### Pattern 3: Collection Detection (alongside projectile/contact-kill checks)
**What:** Circle-vs-circle overlap test between player and powerup, checked in fixedTick
**When to use:** Every tick, after player movement resolution
**Example:**
```typescript
// In fixedTick, after player collision resolution
this.state.powerups.forEach((powerup, id) => {
  // Check despawn
  if (this.state.serverTime - powerup.spawnTime > 15000) {
    this.state.powerups.delete(id);
    this.broadcast('powerupDespawn', { id });
    return;
  }

  // Check collection vs alive players
  this.state.players.forEach((player, sessionId) => {
    if (player.health <= 0) return;
    const dx = player.x - powerup.x;
    const dy = player.y - powerup.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < COMBAT.playerRadius + POWERUP_RADIUS) {
      this.collectPowerup(sessionId, player, powerup, id);
    }
  });
});
```

### Pattern 4: Buff State (server-only, communicated via broadcast)
**What:** Track active buffs per player as server-only fields (not synced via Schema to avoid unnecessary bandwidth). Broadcast buff events for client rendering.
**When to use:** When a buff is applied, expires, or affects gameplay
**Why not Schema:** Buff timers tick at 60Hz -- syncing that to clients wastes bandwidth. Client only needs discrete events (buffApplied, buffExpired) plus the initial duration to render locally.
**Example:**
```typescript
// Server-only buff tracking on Player (NOT @type decorated)
interface ActiveBuff {
  type: number; // 0=speed, 1=invincibility, 2=projectile
  expiresAt: number; // serverTime when buff expires
  duration: number; // total duration in ms
}

// On Player class (server-only field, similar to inputQueue/lastFireTime)
activeBufFs: ActiveBuff[] = [];
```

### Pattern 5: Speed Boost Application
**What:** Modify maxVelocity in the physics call when speed buff is active
**When to use:** In fixedTick player processing, before applyMovementPhysics
**Example:**
```typescript
// In fixedTick player processing
const stats = CHARACTERS[player.role];
let effectiveMaxVelocity = stats.maxVelocity;

// Check for speed boost buff
const speedBuff = player.activeBuffs.find(b => b.type === POWERUP_TYPE.SPEED);
if (speedBuff && this.state.serverTime < speedBuff.expiresAt) {
  effectiveMaxVelocity *= 1.5; // +50%
}

applyMovementPhysics(player, input, FIXED_DT, {
  acceleration: stats.acceleration,
  drag: stats.drag,
  maxVelocity: effectiveMaxVelocity,
});
```

### Pattern 6: Invincibility Application
**What:** Skip damage application when invincibility buff is active
**When to use:** In projectile-player collision check and contact kill check
**Example:**
```typescript
// In projectile collision check
const isInvincible = target.activeBuffs?.some(
  b => b.type === POWERUP_TYPE.INVINCIBILITY && this.state.serverTime < b.expiresAt
);
if (isInvincible) return; // Skip damage, but still destroy projectile

// In Paran contact kill check
const guardianInvincible = target.activeBuffs?.some(
  b => b.type === POWERUP_TYPE.INVINCIBILITY && this.state.serverTime < b.expiresAt
);
if (guardianInvincible) return; // Skip kill
```

### Pattern 7: Projectile/Beam Buff Application
**What:** Modify projectile properties at spawn time; Paran's Beam is a special projectile type
**When to use:** When fire input is processed and projectile buff is active
**Key considerations:**
- Guardian: 2x hitbox (projectileRadius) + 2x speed at projectile spawn
- Paran: Create special "beam" projectile -- needs new fields on Projectile Schema (`isBeam: boolean`, `hitboxScale: number`)
- Beam ignores wall/obstacle collision (passes through), destroys obstacles in path
- Beam uses 2x cooldown (fireRate doubled)
**Example:**
```typescript
// Projectile Schema additions
@type('boolean') isBeam: boolean = false;
@type('uint8') hitboxScale: number = 1; // multiplier for radius (1=normal, 2=guardian buff, 5=paran beam)

// In fire processing
const hasProjBuff = player.activeBuffs?.some(
  b => b.type === POWERUP_TYPE.PROJECTILE && this.state.serverTime < b.expiresAt
);

if (hasProjBuff && player.role === 'paran') {
  // Paran's Beam: 5x hitbox, passes through walls, 2x cooldown
  projectile.isBeam = true;
  projectile.hitboxScale = 5;
  // Use 2x cooldown
  if (this.state.serverTime - player.lastFireTime < stats.fireRate * 2) return;
} else if (hasProjBuff) {
  // Guardian: 2x hitbox + 2x speed
  projectile.hitboxScale = 2;
  projectile.vx *= 2;
  projectile.vy *= 2;
}
```

### Pattern 8: Client Aura Particles (continuous emitter following player)
**What:** Use ParticleFactory.createTrail-like pattern but attached to player sprites
**When to use:** When client receives buffApplied event, destroy on buffExpired
**Example:**
```typescript
// In ParticleFactory -- new method
speedAura(followTarget: Phaser.GameObjects.Sprite): Phaser.GameObjects.Particles.ParticleEmitter {
  return this.scene.add.particles(0, 0, 'particle', {
    frequency: 50,
    lifespan: 400,
    speed: { min: 20, max: 60 },
    scale: { start: 0.6, end: 0 },
    alpha: { start: 0.5, end: 0 },
    tint: 0x4488ff, // Blue streaks
    angle: { min: 0, max: 360 },
    follow: followTarget,
    emitting: true,
  });
}
```

### Pattern 9: Stage Lifecycle Integration
**What:** Clear powerups in resetStage(), reset spawn timers in startStage()
**When to use:** Between stages in best-of-3 matches
**Example:**
```typescript
// In resetStage() -- follows existing MapSchema cleanup pattern
const powerupKeys: string[] = [];
this.state.powerups.forEach((_, key) => powerupKeys.push(key));
for (const key of powerupKeys) {
  this.state.powerups.delete(key);
}

// Reset server-only spawn timer state
this.nextSpawnTime = 0;
// Player buff arrays cleared in player reset loop
player.activeBuffs = [];
```

### Pattern 10: Finding Walkable Spawn Tiles
**What:** Query CollisionGrid for non-solid tiles, filter by player distance
**When to use:** In findSpawnTile() server method
**Key insight:** The CollisionGrid marks tiles as `solid` if wall or obstacle. A tile with `!isSolid(tx, ty)` is walkable. Additionally, must exclude destroyed obstacle positions (tile cleared from grid but was originally an obstacle -- user requirement says "no destroyed obstacle locations"). Track original obstacle positions in a Set.
**Example:**
```typescript
private findSpawnTile(): { x: number; y: number } | null {
  const maxAttempts = 50;
  for (let i = 0; i < maxAttempts; i++) {
    const tileX = 1 + Math.floor(Math.random() * (this.collisionGrid.width - 2));
    const tileY = 1 + Math.floor(Math.random() * (this.collisionGrid.height - 2));

    // Must be walkable (not solid)
    if (this.collisionGrid.isSolid(tileX, tileY)) continue;

    // Must not be a destroyed obstacle location
    if (this.originalObstacleTiles.has(`${tileX},${tileY}`)) continue;

    // Convert to world coords (center of tile)
    const worldX = tileX * 32 + 16;
    const worldY = tileY * 32 + 16;

    // Check minimum distance from alive players
    let tooClose = false;
    this.state.players.forEach((player) => {
      if (player.health <= 0) return;
      const dx = player.x - worldX;
      const dy = player.y - worldY;
      if (Math.sqrt(dx * dx + dy * dy) < MIN_SPAWN_DISTANCE) {
        tooClose = true;
      }
    });
    if (tooClose) continue;

    return { x: worldX, y: worldY };
  }
  return null; // Extremely unlikely -- arena has many open tiles
}
```

### Anti-Patterns to Avoid
- **Syncing buff timers via Schema:** Wastes bandwidth at 60Hz. Use broadcast events for discrete state changes (applied/expired) and let client track locally.
- **Using .clear() on MapSchema:** Known Colyseus 0.15 bug. Always iterate+delete.
- **Storing powerup visuals on Schema:** Keep visual-only data (aura type, flash state) client-side. Schema should only sync gameplay-relevant state (position, type, spawnTime).
- **Checking buffs after physics:** Speed buff must be applied BEFORE `applyMovementPhysics()` call, not after.
- **Forgetting client prediction impact:** Speed buff changes maxVelocity -- client prediction must also apply this. Options: (a) sync a `speedMultiplier` field on Player Schema, or (b) broadcast buff to local player and have prediction adjust. Option (a) is simpler and more reliable.
- **Not cleaning up aura emitters:** Aura particle emitters must be destroyed when buff expires, player dies, or stage transitions. Track in a Map and clean up in `cleanupStageVisuals()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State synchronization | Custom WebSocket sync | Colyseus MapSchema | Delta encoding, automatic client callbacks |
| Particle aura effects | Custom sprite animation | Phaser ParticleEmitter with `follow` | Built-in tracking, performance, automatic cleanup |
| Timer management | Manual Date.now() tracking | serverTime comparisons | Already used for match timer, stage timer, projectile lifetime |
| Sound generation | WAV/MP3 files | jsfxr SoundDefs + AudioManager | Procedural, no file management, consistent with existing SFX |

**Key insight:** Every subsystem needed for powerups already exists in the codebase. The implementation is wiring existing patterns together with new data, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: Client Prediction Desync with Speed Buff
**What goes wrong:** Local player has speed buff but prediction uses base maxVelocity, causing jitter as server reconciliation corrects position.
**Why it happens:** Speed buff is server-only knowledge; prediction replays don't account for it.
**How to avoid:** Sync a `speedMultiplier` field on the Player Schema (simple `@type('number')`) so prediction can read it. Only this one field needs syncing -- not the full buff state.
**Warning signs:** Local player rubber-bands when speed boost is active.

### Pitfall 2: Beam Projectile Collision Skip
**What goes wrong:** Beam projectile stops at first wall like normal projectiles.
**Why it happens:** Projectile processing in fixedTick has a `splice(i, 1); continue;` for solid tile hits.
**How to avoid:** Check `proj.isBeam` before the wall collision check. If beam: destroy the obstacle tile (if destructible) but do NOT remove the projectile.
**Warning signs:** Beam disappears on first wall contact.

### Pitfall 3: Powerup Collection Race Condition
**What goes wrong:** Two players collect same powerup on same tick, both get buff.
**Why it happens:** forEach over players doesn't break after first collection.
**How to avoid:** Track collected flag per powerup per tick, or delete immediately after first collection and break out of player loop.
**Warning signs:** Both players visually collect the same powerup.

### Pitfall 4: Stage Transition Powerup Ghosts
**What goes wrong:** Powerup sprites remain on screen after stage transition.
**Why it happens:** Powerup sprites not cleaned up in cleanupStageVisuals().
**How to avoid:** Add powerup sprite cleanup to cleanupStageVisuals() alongside projectile and eliminated text cleanup.
**Warning signs:** Ghost powerup sprites visible in wrong arena after transition.

### Pitfall 5: Buff Expires During Stage Transition
**What goes wrong:** Buff expiry broadcast arrives during iris wipe, client misses it or creates stale aura.
**Why it happens:** fixedTick doesn't run during STAGE_END/STAGE_TRANSITION but buff timers may have expired.
**How to avoid:** Clear all buffs server-side in resetStage() and clean up all aura emitters client-side in cleanupStageVisuals(). Buff state is fresh each stage.
**Warning signs:** Aura particles visible at start of new stage.

### Pitfall 6: Paran Beam Continuous Fire Logic
**What goes wrong:** Paran fires beam at normal fire rate instead of 2x cooldown, or fires once and stops.
**Why it happens:** Fire rate check uses `stats.fireRate` without the 2x multiplier.
**How to avoid:** When projectile buff is active for Paran, multiply `stats.fireRate` by 2 in the cooldown check. The "continuous fire" is automatic because input sends `fire: true` every frame while space is held.
**Warning signs:** Beam fires too fast or only once.

### Pitfall 7: Destroyed Obstacle Position Tracking
**What goes wrong:** Powerup spawns on a tile where an obstacle was destroyed.
**Why it happens:** `collisionGrid.isSolid()` returns false for cleared tiles, so they pass the walkable check.
**How to avoid:** Maintain a `Set<string>` of original obstacle tile positions (populated during loadMap). Check this set in findSpawnTile().
**Warning signs:** Powerup appears on rubble/destroyed obstacle location.

### Pitfall 8: Invincibility Not Blocking Contact Kill
**What goes wrong:** Invincible guardian still dies from Paran contact.
**Why it happens:** Contact kill check doesn't consult buff state.
**How to avoid:** Check invincibility buff in BOTH the projectile damage path AND the Paran contact kill path.
**Warning signs:** Guardian with gold shield aura dies from Paran touch.

### Pitfall 9: HUD Buff Indicator Positioning
**What goes wrong:** Buff indicators overlap with health bars or cooldown bar.
**Why it happens:** HUD uses viewport-relative positioning; adding new elements at wrong Y offset.
**How to avoid:** Place buff indicators between health bar labels and cooldown bar. Health bar Y is at 95% (H * 0.95), cooldown at 89% (H * 0.89). Buff indicators go at ~85% (H * 0.85) or just above the cooldown bar.
**Warning signs:** Visual overlap in HUD at different viewport sizes.

### Pitfall 10: Powerup Sprite Bobbing Z-Order
**What goes wrong:** Powerup sprite renders behind ground or above players.
**Why it happens:** Incorrect depth value.
**How to avoid:** Set powerup sprite depth to 8 (above ground layers at default, below player sprites at 10, below projectile trails at 4-5... wait, trails are at 4, projectiles at 5, players at 10). Actually: ground=default, walls=default, trails=4, projectiles=5, powerups=8, players=10, eliminated text=12.
**Warning signs:** Powerup visually hidden behind tiles or floating above players.

## Code Examples

### Shared Powerup Constants
```typescript
// shared/powerups.ts
export enum PowerupType {
  SPEED = 0,
  INVINCIBILITY = 1,
  PROJECTILE = 2,
}

export const POWERUP_NAMES: Record<number, string> = {
  [PowerupType.SPEED]: 'Speed Boost',
  [PowerupType.INVINCIBILITY]: 'Invincibility',
  [PowerupType.PROJECTILE]: 'Power Shot',
};

export const POWERUP_CONFIG = {
  maxOnMap: 2,
  spawnIntervalMin: 8000,  // ms
  spawnIntervalMax: 12000, // ms
  firstSpawnDelay: 12000,  // ms after stage start (10-15s range, pick middle)
  despawnTime: 15000,      // ms before uncollected powerup disappears
  despawnWarningTime: 4000, // ms before despawn to start blinking
  collectionRadius: 14,    // slightly larger than playerRadius for generous pickup
  minSpawnDistance: 160,    // ~5 tiles from alive players

  // Buff durations
  speedDuration: 4500,     // ms (4-5s range)
  invincibilityDuration: 2500, // ms (2-3s range)
  projectileDuration: 5500,    // ms (5-6s range)

  // Buff effects
  speedMultiplier: 1.5,       // +50%
  guardianHitboxScale: 2,     // 2x projectile hitbox for guardian
  guardianSpeedScale: 2,      // 2x projectile speed for guardian
  paranBeamHitboxScale: 5,    // 5x projectile hitbox for paran beam
  paranBeamCooldownMultiplier: 2, // 2x longer cooldown for paran beam
};
```

### PowerupState Schema
```typescript
// server/src/schema/Powerup.ts
import { Schema, type } from '@colyseus/schema';

export class PowerupState extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('uint8') powerupType: number = 0;
  @type('number') spawnTime: number = 0;
}
```

### Projectile Schema Additions
```typescript
// Add to existing Projectile class
@type('boolean') isBeam: boolean = false;
@type('uint8') hitboxScale: number = 1;
```

### Player Schema Addition for Prediction Sync
```typescript
// Add to existing Player class (Schema-synced for client prediction)
@type('number') speedMultiplier: number = 1; // 1.0 = normal, 1.5 = speed boosted
```

### Potion Icon Asset Loading (BootScene)
```typescript
// In BootScene.preload()
// Powerup potion sprites (16x16 icons)
this.load.image('potion_speed', 'icons/potion-blue.png');
this.load.image('potion_invincibility', 'icons/potion-orange.png');
this.load.image('potion_projectile', 'icons/potion-red.png');
```

### Powerup SFX Definitions
```typescript
// In SoundDefs.ts -- add powerup sounds
const powerup_pickup = defaults({
  wave_type: 2, // sine
  p_env_attack: 0,
  p_env_sustain: 0.1,
  p_env_punch: 0.3,
  p_env_decay: 0.3,
  p_base_freq: 0.45,
  p_freq_ramp: 0.2,
  p_arp_mod: 0.5,
  p_arp_speed: 0.4,
  sound_vol: 0.3,
});

const powerup_spawn = defaults({
  wave_type: 2, // sine
  p_env_attack: 0.05,
  p_env_sustain: 0.08,
  p_env_punch: 0.1,
  p_env_decay: 0.2,
  p_base_freq: 0.55,
  p_freq_ramp: -0.1,
  sound_vol: 0.2,
});

const powerup_despawn = defaults({
  wave_type: 3, // noise
  p_env_attack: 0,
  p_env_sustain: 0.05,
  p_env_punch: 0.2,
  p_env_decay: 0.15,
  p_base_freq: 0.3,
  p_freq_ramp: -0.3,
  sound_vol: 0.15,
});
```

### Kill Feed Powerup Messages
```typescript
// Broadcast patterns (server)
this.broadcast('powerupSpawn', {
  type: powerup.powerupType,
  typeName: POWERUP_NAMES[powerup.powerupType],
});

this.broadcast('powerupCollect', {
  playerId: sessionId,
  playerName: player.name,
  playerRole: player.role,
  type: powerup.powerupType,
  typeName: POWERUP_NAMES[powerup.powerupType],
  duration: buffDuration,
});

this.broadcast('buffExpired', {
  playerId: sessionId,
  type: buff.type,
});
```

### Client Kill Feed Integration (HUDScene)
```typescript
// In setupKillFeed() -- add powerup listeners alongside kill listener
this.room.onMessage('powerupSpawn', (data) => {
  this.addKillFeedEntry({
    killer: data.typeName,
    victim: 'appeared!',
    killerRole: 'powerup',
    victimRole: '',
  });
});

this.room.onMessage('powerupCollect', (data) => {
  this.addKillFeedEntry({
    killer: data.playerName,
    victim: data.typeName,
    killerRole: data.playerRole,
    victimRole: 'powerup',
  });
});
```

## Discretion Recommendations

### Minimum Spawn Distance from Players
**Recommendation:** 160 pixels (~5 tiles). This gives players ~1 second of travel time at guardian speed (110 px/s) or ~0.4s at Paran speed (400 px/s), preventing instant grabs while keeping powerups reachable.

### Particle Aura Colors and Styles
**Recommendation:**
- **Speed Aura:** Blue-cyan particles (`0x4488FF`), fast outward radial burst, small scale, 50ms frequency. Suggests velocity/motion.
- **Invincibility Aura:** Gold-amber particles (`0xFFCC00`), orbiting circle pattern (use `emitZone` with circle), larger scale, 40ms frequency. Suggests shield/protection.
- **Projectile Aura:** Red-orange particles (`0xFF4422`), spark-like with gravity, medium scale, 60ms frequency. Suggests power/energy.

### Beam Visual Rendering
**Recommendation:** Use the existing `projectiles` spritesheet frame for Paran (frame 0) but at 5x display size (40x40 instead of 8x8). Add a bright white-gold glow by layering a second sprite with `blendMode: 'ADD'` and slight alpha pulse. The beam trail should use the `createTrail` pattern but with larger, brighter particles (gold tint `0xFFDD00`, scale start 2.0). This reuses existing systems without needing new texture assets.

### Spawn Timer Randomization
**Recommendation:** `8000 + Math.random() * 4000` gives uniform distribution between 8-12 seconds. Simple, unbiased.

### SFX Design
**Recommendation:**
- **Pickup:** Ascending sine chime with arpeggio -- pleasant, rewarding (similar to ready_chime but brighter)
- **Spawn:** Soft sine tone with slight reverb/decay -- ambient notification
- **Despawn:** Short noise burst with downward frequency -- disappearance whoosh

### Kill Feed Message Formatting
**Recommendation:**
- Spawn: "Speed Boost appeared!" (gold color, like powerup UI)
- Collect: "PlayerName collected Speed Boost" (player's role color)
- Use existing `addKillFeedEntry` with `killerRole: 'powerup'` for spawn messages, letting the color default to white or gold.

### Potion Bottle Sprite Approach
**Recommendation:** Use the existing 16x16 icon sprites from `assets/icons/` directly:
- `icon280.png` (potion-blue) for Speed Boost
- `icon279.png` (potion-orange) for Invincibility
- `icon277.png` (potion-red) for Projectile/Beam
Copy to `client/public/icons/` and load in BootScene. Display at 16x16 with a Phaser tween for bobbing animation (y oscillation +/- 4px, duration 1000ms, yoyo repeat).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed powerup spawn points | Random walkable tile spawning | Industry standard since ~2015 | More dynamic, prevents camping |
| Client-authoritative pickup | Server-authoritative with Schema sync | Colyseus 0.15 pattern | No desync on who collected |
| Full buff state via Schema | Discrete broadcast events + minimal Schema field | This project's optimization | Reduces bandwidth, cleaner separation |

## Open Questions

1. **Paran Beam vs. Client Prediction**
   - What we know: Speed buff can be handled by syncing `speedMultiplier` to prediction. Projectile buff doesn't affect movement prediction directly.
   - What's unclear: Paran's Beam fires with 2x cooldown -- client-side fire cooldown tracking in GameScene uses `CHARACTERS[role].fireRate`. Should we sync an `effectiveFireRate` field, or have the client check the buff state locally?
   - Recommendation: Since the client already plays shoot SFX based on local cooldown tracking (`lastLocalFireTime`), sync a `fireRateMultiplier` field on Player Schema (default 1, set to 2 during Paran beam buff). This keeps prediction and SFX aligned.

2. **Beam Projectile Visual Size**
   - What we know: Existing projectiles render at 8x8 display size from 16x16 texture.
   - What's unclear: A 5x hitbox beam at 8*5=40px display might look too large or clip oddly with the 16x16 source texture.
   - Recommendation: Use the projectile texture at 40x40 display size (setDisplaySize). The pixel art aesthetic means upscaling a 16x16 sprite to 40x40 is visually acceptable (pixelArt rendering mode already handles this). Add glow effect with additive blend sprite layered on top.

3. **Despawn Blink Implementation**
   - What we know: Powerups should flash/blink for last 3-5s before despawning.
   - What's unclear: Should this be driven by Schema (add a `blinking` flag) or client-side based on `spawnTime` comparison?
   - Recommendation: Client-side. The client knows `spawnTime` (synced via Schema) and `POWERUP_CONFIG.despawnTime`. It can calculate remaining time and start blinking when < `despawnWarningTime` remains. No extra Schema field needed.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: Direct reading of all integration files (GameRoom.ts, GameState.ts, GameScene.ts, HUDScene.ts, ParticleFactory.ts, AudioManager.ts, SoundDefs.ts, Prediction.ts, collisionGrid.ts, characters.ts, physics.ts, obstacles.ts, maps.ts, designTokens.ts, BootScene.ts)
- `/colyseus/docs` Context7 library -- MapSchema patterns, onAdd/onChange callbacks, Schema migration 0.15
- `/phaserjs/phaser/v3_90_0` Context7 library -- ParticleEmitter follow, tint, color interpolation
- `assets/icons/icon-map.json` -- Potion bottle sprites confirmed available (icon277-280)

### Secondary (MEDIUM confidence)
- Phaser 3.60+ particle API patterns from ParticleFactory.ts (project-verified, matches official docs)
- Colyseus 0.15 MapSchema safe patterns from project MEMORY.md (verified against existing ObstacleState implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, all patterns already exist in codebase
- Architecture: HIGH -- Direct extension of proven ObstacleState + Player Schema patterns
- Pitfalls: HIGH -- Identified from direct code analysis of existing collision, prediction, and stage lifecycle systems
- Discretion items: HIGH -- Recommendations based on existing design tokens and codebase conventions

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (stable -- no external dependency changes expected)
