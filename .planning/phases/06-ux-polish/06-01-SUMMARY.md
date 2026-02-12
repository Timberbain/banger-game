---
phase: 06-ux-polish
plan: 01
subsystem: gameplay, ui
tags: [match-timer, kill-broadcast, ping-pong, pixelart, jsfxr, phaser-scenes]

# Dependency graph
requires:
  - phase: 05.1-arena-collisions
    provides: GameRoom with collision system, contact kills, projectile kills
provides:
  - 5-minute match timer with guardian timeout win
  - Kill event broadcast (killer/victim/role data)
  - Ping/pong handler for RTT measurement
  - pixelArt Phaser config for crisp rendering
  - HUDScene and HelpScene stubs registered in scene array
  - jsfxr dependency installed for procedural SFX
affects: [06-02 (audio needs jsfxr), 06-03 (HUD needs HUDScene stub), 06-06 (help needs HelpScene stub)]

# Tech tracking
tech-stack:
  added: [jsfxr]
  patterns: [kill broadcast pattern, ping/pong RTT measurement, overlay scene stubs]

key-files:
  created:
    - client/src/scenes/HUDScene.ts
    - client/src/scenes/HelpScene.ts
  modified:
    - server/src/rooms/GameRoom.ts
    - client/src/main.ts
    - client/package.json

key-decisions:
  - "MATCH_DURATION_MS = 300000 (5 minutes) for aggressive Paran play"
  - "Kill broadcast includes player names and roles (not sessionIds) for display"
  - "No kill broadcast for player leave/disconnect deaths"
  - "HUDScene uses transparent background via rgba(0,0,0,0) for overlay rendering"

patterns-established:
  - "Kill broadcast: this.broadcast('kill', { killer, victim, killerRole, victimRole })"
  - "Ping/pong: client sends { t: Date.now() }, server echoes back for RTT = Date.now() - data.t"
  - "Scene stubs: minimal class with constructor super key, registered in main.ts scene array"

# Metrics
duration: 2min
completed: 2026-02-12
---

# Phase 6 Plan 01: Foundation Server & Client Config Summary

**5-minute match timer with guardian timeout win, kill event broadcasting for HUD feed, ping/pong RTT handler, and Phaser pixelArt config with scene stubs and jsfxr installed**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-12T15:19:51Z
- **Completed:** 2026-02-12T15:22:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Server enforces 5-minute match timer -- guardians win on timeout, forcing aggressive Paran play
- Kill events broadcast with killer/victim names and roles at both projectile kill and contact kill sites
- Ping/pong message handler for client-side RTT measurement
- Phaser config updated with pixelArt: true for crisp nearest-neighbor rendering
- HUDScene and HelpScene stubs created and registered in scene array
- jsfxr installed as client dependency for procedural SFX generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Server match timer, kill broadcast, and ping handler** - `1a02b2f` (feat)
2. **Task 2: Client config, scene stubs, and jsfxr dependency** - `9f730be` (feat)

## Files Created/Modified
- `server/src/rooms/GameRoom.ts` - Match timer (MATCH_DURATION_MS), kill broadcasts, ping handler
- `client/src/main.ts` - pixelArt: true, HUDScene + HelpScene imports and scene array
- `client/src/scenes/HUDScene.ts` - Overlay HUD scene stub with transparent background
- `client/src/scenes/HelpScene.ts` - Help/controls scene stub
- `client/package.json` - jsfxr dependency added
- `client/package-lock.json` - Lock file updated

## Decisions Made
- MATCH_DURATION_MS = 300000 (5 minutes) -- forces aggressive Paran play per user decision
- Kill broadcast uses player names (not sessionIds) for display readability
- No kill broadcast for player leave/disconnect deaths -- only combat kills
- HUDScene uses rgba(0,0,0,0) transparent background for overlay rendering (per research pitfall #2)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corporate npm registry auth token expired**
- **Found during:** Task 2 (jsfxr installation)
- **Issue:** Global .npmrc pointed to corporate CodeArtifact registry with expired auth token
- **Fix:** Used `--registry https://registry.npmjs.org` flag to install from public npm
- **Files modified:** client/package.json, client/package-lock.json
- **Verification:** jsfxr appears in dependencies, client compiles
- **Committed in:** 9f730be (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor registry workaround, no scope change.

## Issues Encountered
None beyond the npm registry auth issue documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Match timer enforced -- all subsequent plans can rely on 5-minute matches
- Kill broadcast ready for HUD kill feed consumption (Plan 03)
- Ping handler ready for connection quality display (Plan 03)
- pixelArt config active -- sprite assets will render crisply (Plan 04/05)
- HUDScene stub ready for full implementation (Plan 03)
- HelpScene stub ready for full implementation (Plan 06)
- jsfxr installed and ready for audio system (Plan 02)

## Self-Check: PASSED

- All 4 created/modified files verified on disk
- Commit 1a02b2f verified in git log
- Commit 9f730be verified in git log
- Server compiles: OK
- Client compiles: OK

---
*Phase: 06-ux-polish*
*Completed: 2026-02-12*
