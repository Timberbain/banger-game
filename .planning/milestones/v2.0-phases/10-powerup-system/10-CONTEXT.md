# Phase 10: Powerup System - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-authoritative powerup spawning, collection, and temporary buffs during arena combat. Three powerup types (speed boost, invincibility, projectile/beam) that provide time-limited tactical advantages. Powerups integrate with the stage lifecycle (cleared between stages, spawn fresh each stage). HUD indicator for active buffs.

</domain>

<decisions>
## Implementation Decisions

### Spawn Rules
- Random open tiles (walkable, no walls/obstacles) — not fixed hotspots
- Spawn every 8-12s (frequent cadence)
- Maximum 2 powerups on the map simultaneously
- Minimum distance from alive players to prevent instant grabs (dead players don't count)
- First spawn delayed 10-15s into a stage — players settle into positions first
- Powerups despawn after ~15s if uncollected
- Despawning powerups flash/blink for last 3-5s as warning
- New spawn waits for next timer tick (no immediate respawn on collect/despawn)
- Powerup type selection is purely random (no rubber-banding/weighting)
- Only spawn on fully open ground tiles (no obstacle tiles, no destroyed obstacle locations)

### Buff Design
- **Speed Boost:** +50% movement speed for 4-5s — same effect for both Paran and Guardians
- **Invincibility:** Fully immune to all damage for 2-3s — same for both roles. Wall velocity penalty still applies to Paran (walls still punish)
- **Projectile Buff (role-specific):**
  - Guardian: 2x projectile hitbox + 2x projectile speed for 5-6s — devastating ranged suppression
  - Paran: "Paran's Beam" — 5x size projectile that travels through obstacles AND walls, destroying any obstacle in its path. Damages Guardians on hit. Continuous fire with 2x longer cooldown. Duration 5-6s. Paran normally has no ranged attack — this powerup grants temporary ranged capability
- Different buff types are stackable (can have speed + invincibility simultaneously)
- Same buff type does NOT stack effects — refreshes timer only
- Three powerup types total for Phase 10 (speed, invincibility, projectile/beam)

### Visual Feedback
- Buffed players display distinct particle aura per powerup type (no color tint on sprite)
  - Speed: distinct particle style (e.g., blue streaks)
  - Invincibility: distinct particle style (e.g., gold shield)
  - Projectile/Beam: distinct particle style (e.g., red sparks)
- Opponents can identify which buff type by the particle aura — supports counter-play readability
- Powerup items on the ground use potion bottle icon sprites, colored by type, with bobbing animation
- Paran's Beam projectile has a distinct large glowing beam visual — clearly different from normal Guardian projectiles

### Collection Mechanics
- Instant on contact — no pause, no pickup animation, keeps momentum
- Pickup feedback: SFX chime + brief screen flash + floating text showing powerup name
- First server tick wins on simultaneous collision — frame-perfect races possible
- Full visibility: everyone sees who picked up what (pickup particles visible to all)
- Kill feed announces all pickups ("Paran collected Speed Boost")
- Kill feed also announces spawns ("Speed Boost appeared!")
- Spectators (dead/eliminated players) can see all powerup spawns and pickups

### HUD Display
- Active powerup indicator below health bar
- Shrinking bar for remaining duration (not numeric countdown)
- Multiple active buffs shown side by side (up to 3 max)
- Visual flash on HUD indicator when buff is about to expire (last 1-2s) — no sound warning

### Claude's Discretion
- Exact minimum spawn distance from players
- Particle aura color palette and style per buff type
- Potion bottle sprite design details
- Beam visual rendering approach
- Exact spawn timer randomization within 8-12s range
- SFX design for pickup and despawn
- Kill feed message formatting

</decisions>

<specifics>
## Specific Ideas

- "Paran's Beam" is a signature mechanic — Paran normally has zero ranged capability, so the projectile powerup transforms gameplay temporarily. The beam should feel devastating: 5x size, wall-piercing, obstacle-destroying
- Guardian projectile buff is "bigger + faster" (2x hitbox + 2x speed) — makes Guardian shots extremely hard to dodge
- Powerup design is asymmetric: same potion item on the ground, but projectile type gives different effects per role
- Buff durations are tiered by power: invincibility (most powerful) = shortest at 2-3s, speed = 4-5s, projectile = 5-6s

</specifics>

<deferred>
## Deferred Ideas

- Phantom powerup (phase through walls/obstacles) — consider for future powerup expansion
- Heal potion (instant HP restore) — consider for future powerup expansion
- Rapid fire powerup (reduced cooldown) — consider for future powerup expansion
- Magnet powerup (pull nearby powerups) — consider for future powerup expansion
- Rubber-banding/weighted spawn by game state — revisit if balance issues arise

</deferred>

---

*Phase: 10-powerup-system*
*Context gathered: 2026-02-16*
