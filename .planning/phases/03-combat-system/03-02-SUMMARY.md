---
phase: 03-combat-system
plan: 02
subsystem: combat-client
tags: [client, phaser, input-handling, rendering, ui, character-roles]
dependencies:
  requires:
    - phase: 03-01
      provides: Server combat core (projectiles, collision, damage, character stats)
  provides:
    - Client fire input handling (spacebar)
    - Projectile rendering with client-side interpolation
    - Health bar UI per player
    - Character role visualization (Paran vs guardians)
    - Dead player state rendering
    - Pac-Man style cardinal movement for Paran
  affects:
    - Phase 04 (Server reconciliation may need to handle Paran cardinal movement)
    - Phase 05 (Power-ups will build on health bar UI)
    - Phase 07 (Mouse aiming will replace spacebar fire)
tech-stack:
  added:
    - Client-side projectile interpolation (smooth rendering between server updates)
    - Last-key-wins input system for Paran cardinal movement
    - Health bar rendering system (Graphics API)
  patterns:
    - Character-specific input handling (Paran cardinal vs guardian free movement)
    - Client-side interpolation for projectiles (no prediction)
    - Role-based visual differentiation (size, color, behavior)
key-files:
  created:
    - None (all modifications to existing files)
  modified:
    - client/src/scenes/GameScene.ts (fire input, projectile rendering, health UI, role visualization, Paran input)
    - client/src/systems/Prediction.ts (fire field forwarding to server)
    - shared/physics.ts (Paran cardinal movement logic)
    - server/src/rooms/GameRoom.ts (server-side Paran cardinal physics, guardian instant stop)
decisions:
  - decision: Paran uses Pac-Man style cardinal-only movement (last-key-wins, instant stop, speed redirects)
    rationale: Simplifies Paran control scheme; feels like classic arcade; emphasizes high-speed glass cannon
    impact: Creates distinctive feel from guardians; may need server reconciliation adjustments
  - decision: Guardians stop instantly on input release (not gradual drag)
    rationale: Feels like humans running and stopping; more responsive control
    impact: Guardians feel snappier; easier to dodge Paran projectiles
  - decision: Projectiles use client-side interpolation (not prediction)
    rationale: Projectiles are server-authoritative; smoothing only needed for rendering between updates
    impact: Projectiles render smoothly without prediction complexity
  - decision: Guardian maxVelocity reduced to 160 (from 220)
    rationale: Original 220 felt too slidey; 160 balances mobility vs control
    impact: Guardians feel less floaty; easier to position precisely
  - decision: Fire input forwarded through prediction system (not separate message)
    rationale: Keeps all input synchronized at 60Hz; consistent with movement input
    impact: Fire timing frame-perfect with movement
metrics:
  duration_minutes: 45
  tasks_completed: 2
  files_created: 0
  files_modified: 4
  commits: 9
  completed_date: 2026-02-10
---

# Phase 03 Plan 02: Client Combat Rendering and Gameplay Tuning Summary

**Client combat loop with fire input, projectile interpolation, health bars, role differentiation, Pac-Man style Paran movement, and instant-stop guardians.**

## Performance

- **Duration:** 45 min (estimated from commit timeline)
- **Started:** 2026-02-10 (after 03-01 completion)
- **Completed:** 2026-02-10 (after checkpoint approval)
- **Tasks:** 2 (implementation + human verification)
- **Files modified:** 4 (GameScene.ts, Prediction.ts, physics.ts, GameRoom.ts)

## Accomplishments

- Fire input integrated into client prediction system (spacebar fires in facing direction)
- Projectile rendering with client-side interpolation for smooth movement between server updates
- Health bar UI displaying current/max health per player above sprites
- Character role visual differentiation (Paran: large red, guardians: small green/blue)
- Pac-Man style cardinal movement for Paran (last-key-wins, instant stop, speed redirects on direction change)
- Instant stop mechanic for guardians on input release (no gradual drag)
- Guardian movement tuning (maxVelocity 160, drag 0.4 for less floatiness)
- Dead player state rendering (ghosted alpha 0.3, "ELIMINATED" text)

## Task Commits

Each task was committed atomically, with additional fix commits during checkpoint verification:

1. **Task 1: Add fire input, projectile rendering, health display, and role differentiation** - `e2366f7` (feat)
   - Fix commits during checkpoint verification:
     - `3e7ae85` - Fix Paran instant turning (speed magnitude preserved) + smooth projectile interpolation
     - `c489bfd` - Fix Paran instant turning to redirect speed to new input direction
     - `19d2914` - Implement Pac-Man style movement for Paran (cardinal-only, instant stop)
     - `e2b7bd7` - Fix Paran velocity zeroing on empty input queue (server no-input fallback)
     - `1cd0e96` - Last-key-wins input for Paran cardinal movement
     - `24d65ce` - Tune guardian movement — slower speed (maxVelocity 160), less slidey (drag 0.4)
     - `750abf3` - Instant stop for guardians on input release

2. **Task 2: Verify combat gameplay feel** - approved by human after iterative tuning

**Plan metadata:** (to be committed with STATE.md update)

## Files Created/Modified

- `client/src/scenes/GameScene.ts` - Fire input binding, projectile rendering with interpolation, health bars, role-based visuals, Paran cardinal input (last-key-wins), dead player rendering
- `client/src/systems/Prediction.ts` - Added fire field forwarding to server input messages
- `shared/physics.ts` - Added Paran cardinal movement logic (last-key-wins direction selection)
- `server/src/rooms/GameRoom.ts` - Server-side Paran cardinal physics application, guardian instant stop on input release

## Decisions Made

**Gameplay Decisions (made during checkpoint verification):**

1. **Paran Pac-Man movement** - Cardinal-only, last-key-wins input, instant stop, speed redirects on direction change
   - Rationale: Simplifies Paran's high-speed control; feels arcade-like; emphasizes glass cannon role
   - Impact: Distinct from guardian free movement; easier to control at high speed

2. **Guardian instant stop** - Zero velocity on input release (not gradual drag)
   - Rationale: Feels like humans running and stopping; more responsive for dodging
   - Impact: Guardians more nimble; easier to position precisely

3. **Guardian speed reduction** - maxVelocity 160 (down from 220), drag 0.4
   - Rationale: Original values too floaty/slidey; 160 balances mobility vs control
   - Impact: More precise guardian movement; better for tactical positioning

4. **Projectile interpolation** - Client-side smoothing (not prediction)
   - Rationale: Server-authoritative projectiles; smoothing only needed for rendering
   - Impact: Smooth visual movement without prediction complexity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Paran instant turning not preserving speed magnitude**
- **Found during:** Task 2 checkpoint verification (human feedback)
- **Issue:** When Paran changed direction, velocity was set directly to new direction without preserving speed magnitude, causing slowdown
- **Fix:** Calculate current speed magnitude, apply to new direction vector
- **Files modified:** shared/physics.ts
- **Verification:** Tested by human — Paran maintains speed when changing direction
- **Commit:** 3e7ae85

**2. [Rule 1 - Bug] Fixed Paran velocity zeroing on empty input queue**
- **Found during:** Task 2 checkpoint verification (Paran stopped when not sending input)
- **Issue:** Server wasn't applying drag physics when input queue empty, but was zeroing velocity
- **Fix:** Added no-input fallback in server GameRoom.ts to apply drag even with empty queue
- **Files modified:** server/src/rooms/GameRoom.ts
- **Verification:** Paran now decelerates naturally when input stops
- **Commit:** e2b7bd7

**3. [Rule 1 - Bug] Fixed projectile jittery movement**
- **Found during:** Task 2 checkpoint verification (projectiles teleported between positions)
- **Issue:** Projectiles updated position only on server onChange events (choppy at 60Hz sync)
- **Fix:** Added client-side interpolation — store projectile velocities, update position every frame
- **Files modified:** client/src/scenes/GameScene.ts
- **Verification:** Projectiles move smoothly between server updates
- **Commit:** 3e7ae85

**4. [Rule 1 - Bug] Fixed guardian floaty/slidey movement**
- **Found during:** Task 2 checkpoint verification (human feedback)
- **Issue:** Guardian maxVelocity 220 with default drag felt too slippery; hard to control precisely
- **Fix:** Reduced maxVelocity to 160, increased drag to 0.4
- **Files modified:** shared/characters.ts
- **Verification:** Tested by human — guardians feel more controlled
- **Commit:** 24d65ce

**5. [Rule 4 - Architectural] Implemented Paran Pac-Man style cardinal movement**
- **Found during:** Task 2 checkpoint verification (human wanted simpler Paran control)
- **Proposal:** Replace free movement with cardinal-only (like Pac-Man): last-key-wins, instant stop, speed redirects
- **User decision:** Approved — simplifies high-speed Paran control, creates arcade feel
- **Implementation:** Added direction press order tracking, last-key-wins logic in GameScene.ts; cardinal-only physics in shared/physics.ts; server-side enforcement in GameRoom.ts
- **Files modified:** client/src/scenes/GameScene.ts, shared/physics.ts, server/src/rooms/GameRoom.ts
- **Commits:** 19d2914, c489bfd, 1cd0e96

**6. [Rule 1 - Bug] Implemented guardian instant stop**
- **Found during:** Task 2 checkpoint verification (human wanted responsive guardian control)
- **Issue:** Guardians applied drag on input release, causing gradual slowdown (felt sluggish)
- **Fix:** Zero velocity immediately on input release (like humans running and stopping)
- **Files modified:** server/src/rooms/GameRoom.ts
- **Verification:** Tested by human — guardians stop instantly, easier to dodge
- **Commit:** 750abf3

---

**Total deviations:** 6 (5 auto-fixed bugs + 1 architectural decision with user approval)
**Impact on plan:** All fixes necessary for correct gameplay feel. Paran cardinal movement was architectural change requiring user approval (Rule 4). Other fixes were gameplay bugs discovered during verification (Rule 1).

## Technical Details

**Fire Input Flow:**
1. GameScene.ts reads spacebar state → creates InputState with fire:true
2. Prediction.ts forwards fire field to server via room.send('input', {...})
3. Server processes fire in input queue (synchronized with movement at 60Hz)
4. Server spawns projectile, syncs to clients via room.state.projectiles.onAdd

**Projectile Rendering:**
1. Server spawns projectile → client receives onAdd event
2. Client creates Phaser.GameObjects.Arc (circle) sprite
3. Client stores projectile velocity (vx, vy) from initial state
4. Every frame: client updates position using stored velocity (interpolation)
5. Server onChange events update stored velocity (corrections)
6. Server onRemove → client destroys sprite

**Health Bar System:**
1. Player onAdd → create Phaser.GameObjects.Graphics bar above sprite
2. Player onChange → redraw bar width proportional to health/maxHealth
3. Every frame: update bar position to follow player sprite
4. Color: green if health > 50%, yellow if 25-50%, red if < 25%

**Role Visualization:**
- **Paran:** 32x32 red rectangle (0xff4444), health bar shows 150 HP
- **Guardians:** 24x24 rectangle (0x00ff88 for local, 0x4488ff for remote), health bar shows 50 HP
- Sprite size and color set on role assignment (via player.onChange)

**Paran Cardinal Movement:**
- Client tracks last-pressed direction key (up/down/left/right)
- Only one direction active at a time (last-key-wins)
- Speed magnitude preserved when changing direction
- Instant stop when all keys released (no drag deceleration)
- Server enforces cardinal-only physics (normalizes input to single axis)

**Guardian Instant Stop:**
- Server detects when input queue empty (no movement keys)
- Immediately zeros velocity (vx = 0, vy = 0)
- No gradual drag deceleration on input release
- Creates responsive, precise movement feel

## Verification Results

All success criteria met:

- ✓ Client compiles without TypeScript errors
- ✓ Fire input (spacebar) sends to server via prediction system
- ✓ Projectiles render as colored circles (yellow for own, orange for enemy)
- ✓ Projectiles interpolate smoothly between server updates
- ✓ Health bars display above players, update on damage
- ✓ Paran visually distinct (larger red square, 150 HP)
- ✓ Guardians visually distinct (smaller green/blue squares, 50 HP)
- ✓ Dead players ghosted (alpha 0.3) with "ELIMINATED" text
- ✓ Paran uses Pac-Man style cardinal movement
- ✓ Guardians stop instantly on input release
- ✓ Combat feels responsive (confirmed by human at checkpoint)

**Human Verification (Task 2 Checkpoint):**
- ✓ Character differentiation clear (size, color, health)
- ✓ Fire input responsive (projectiles fire in facing direction)
- ✓ Damage application visible (health bars decrease on hit)
- ✓ Fire rates match character types (5/sec guardian, 1/sec Paran)
- ✓ Paran movement feels arcade-like (cardinal-only, instant response)
- ✓ Guardian movement precise (instant stop, balanced speed)
- ✓ Projectile cleanup works (despawn after 2s or on bounds exit)

## Issues Encountered

**1. Paran movement control complexity**
- **Problem:** Initial free movement with instant turning felt hard to control at high speed
- **Solution:** Switched to Pac-Man style cardinal movement (user-approved architectural change)
- **Outcome:** Simpler, more arcade-like; easier to control Paran's high speed

**2. Guardian movement felt floaty**
- **Problem:** maxVelocity 220 with default drag made guardians slide too much
- **Solution:** Reduced maxVelocity to 160, increased drag to 0.4
- **Outcome:** Guardians more controllable, better for tactical positioning

**3. Projectile rendering choppy**
- **Problem:** Only updating on server onChange events caused visible teleporting
- **Solution:** Added client-side interpolation (update position every frame using stored velocity)
- **Outcome:** Smooth projectile movement between server updates

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 04 (Server Reconciliation):**
- Client prediction system already in place for movement
- Paran cardinal movement may need reconciliation adjustments (server enforces cardinal physics)
- Health and combat state already server-authoritative (no reconciliation needed)

**Blockers/Concerns:**
- None — combat loop complete and verified by human

**Known Limitations:**
- Fire input is spacebar only (no mouse aiming yet — that's Phase 7)
- No visual aim indicator (facing direction shown only by projectile travel direction)
- Dead players remain on screen as ghosts (no respawn yet — future phase)

---
*Phase: 03-combat-system*
*Plan: 02*
*Completed: 2026-02-10*
