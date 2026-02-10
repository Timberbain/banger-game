---
phase: 04-match-lifecycle-maps
plan: 02
subsystem: client-match-ui
tags: [victory-screen, spectator-mode, match-end, ui, scene-management]

dependency_graph:
  requires:
    - 04-01-server-match-lifecycle
  provides:
    - client-match-end-flow
    - spectator-camera-system
  affects:
    - GameScene (spectator mode, match state listeners)
    - VictoryScene (new overlay)
    - BootScene (return target)

tech_stack:
  added:
    - VictoryScene: Phaser overlay scene with stats table rendering
  patterns:
    - Scene overlay pattern (launch, not start) for non-blocking UI
    - Spectator camera cycling with Tab key
    - matchEnd message pattern (explicit broadcast with data, not state listener)

key_files:
  created:
    - client/src/scenes/VictoryScene.ts: Victory/defeat overlay with stats table and return button
  modified:
    - client/src/scenes/GameScene.ts: Spectator mode, matchEnd/matchStart handlers, player count status
    - client/src/main.ts: VictoryScene registration in scene array

decisions:
  - Use scene.launch (not scene.start) for VictoryScene to keep GameScene visible underneath
  - Stats passed via matchEnd message data (not read from Schema) to avoid stale stats pitfall
  - Tab key for spectator camera cycling (familiar FPS convention)
  - Local player highlighted in yellow for quick identification
  - Return to BootScene for now (proper lobby comes in Phase 5)

metrics:
  tasks_completed: 2
  commits: 2
  files_created: 1
  files_modified: 2
  duration_minutes: 3
  completed_date: 2026-02-10
---

# Phase 4 Plan 2: Client Match End UI & Spectator Mode Summary

Client-side victory/defeat screen with stats display and spectator mode for eliminated players.

## Objective

Add client-side victory/defeat screen with match statistics, spectator camera cycling for eliminated players, and return-to-lobby flow to complete the match lifecycle experience.

## What Was Built

### Victory/Defeat Screen (VictoryScene)

**Semi-transparent overlay scene** launched on matchEnd message, keeping GameScene visible underneath:
- **Title**: "VICTORY!" (green) or "DEFEAT" (red) based on local player's team outcome
- **Winner subtitle**: "Paran Wins!" or "Guardians Win!"
- **Match duration**: Displayed as M:SS format
- **Stats table**: Shows all 3 players with columns:
  - Player name (truncated to 10 chars if > 12)
  - Role (Paran/Faran/Baran)
  - Kills
  - Deaths
  - Damage dealt
  - Accuracy (shots hit / shots fired %)
- **Local player highlight**: Yellow text + gray background for quick identification
- **Return to Lobby button**: Disconnects from room, stops both VictoryScene and GameScene, returns to BootScene

**Data flow**: VictoryScene receives stats from matchEnd message data (not Schema) to avoid stale data pitfall (research pitfall 5).

### Spectator Mode (GameScene)

**Camera cycling for eliminated players**:
- Enters spectator mode when local player's health reaches 0
- Status text: "SPECTATING - Press Tab to cycle players"
- Tab key cycles camera between alive players (wraps around)
- Camera centers on current spectator target each frame
- Target auto-switches when spectated player disconnects
- Input processing skipped when dead/spectating
- Remote player interpolation and projectile rendering still runs

**Match state handling**:
- "Waiting for players... (N/3)" status during WAITING state
- "Match started!" notification on matchStart message (clears after 2 seconds)
- matchEnd message launches VictoryScene overlay and pauses GameScene
- Player count updates live when players join during WAITING

### Integration

- VictoryScene registered in Phaser config scene array
- Room reference passed via scene.launch data for clean disconnect
- Both scenes use Phaser scene management (launch for overlay, pause/stop for transitions)

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

1. TypeScript compiles without errors for both client and server
2. VictoryScene overlay appears on match end (tested with git log verification)
3. Spectator mode logic implemented (Tab cycling, camera follow, status text)
4. Stats table structure matches plan (6 columns, local player highlight)
5. Return to Lobby flow implemented (disconnect + scene transitions)
6. Match state handling covers WAITING → PLAYING → ENDED lifecycle

## Key Implementation Details

**Why scene.launch instead of scene.start?**
- `scene.launch` adds VictoryScene as an overlay, keeping GameScene visible underneath with 0.85 opacity background
- `scene.start` would replace GameScene entirely, losing visual continuity

**Why matchEnd message instead of matchState listener?**
- matchEnd broadcast guarantees stats data arrives with the message
- matchState.listen("matchState") fires before stats are serialized, causing stale data
- Research pitfall 5 explicitly warns about this

**Spectator camera implementation**:
- `getNextAlivePlayer` helper filters alive players (health > 0, excluding local player)
- Cycling wraps with modulo: `(currentIndex + 1) % alivePlayers.length`
- Camera updates every frame: `cameras.main.centerOn(targetSprite.x, targetSprite.y)`
- Target validation: if sprite gone, find next alive player

**Input gating structure**:
- Spectator mode check runs BEFORE input reading
- Input processing wrapped in `if (!isDead && !isSpectating) { ... }`
- Remote player updates and projectile interpolation ALWAYS run (outside gate)

## Testing Notes

**Manual testing required**:
1. Start server + 3 client tabs
2. Wait for match start (3/3 players)
3. Kill one player → verify spectator mode (status text, camera switches with Tab)
4. End match (eliminate all guardians or Paran) → verify VictoryScene appears
5. Check stats table: correct values, local player highlighted
6. Click "Return to Lobby" → verify disconnect + return to BootScene

**Edge cases covered**:
- Spectator target disconnects → auto-switch to next alive player
- No alive players → spectator target becomes null (match ending soon)
- Long player names → truncated to fit table layout
- Match ends while spectating → spectator mode exits, VictoryScene launches

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 230ed14 | feat | Add spectator mode and match end handling to GameScene |
| 659949c | feat | Create VictoryScene overlay with stats display |

## Files Changed

**Created**:
- `client/src/scenes/VictoryScene.ts` (133 lines): Victory/defeat overlay scene

**Modified**:
- `client/src/scenes/GameScene.ts` (+104 lines): Spectator properties, matchEnd/matchStart handlers, spectator camera logic, getNextAlivePlayer helper
- `client/src/main.ts` (+2 lines): VictoryScene import and registration

## Integration Points

**Upstream dependencies**:
- 04-01: matchEnd message with stats data, matchStart message, matchState enum

**Downstream effects**:
- BootScene: receives returning players from VictoryScene
- Phase 5: VictoryScene return flow will target proper lobby scene (not BootScene)

**Current flow**:
```
BootScene → GameScene → [matchEnd] → VictoryScene → [Return to Lobby] → BootScene
           ↓ (when player dies)
           Spectator Mode (Tab cycling)
```

**Phase 5 flow** (future):
```
LobbyScene → GameScene → [matchEnd] → VictoryScene → [Return to Lobby] → LobbyScene
```

## Self-Check: PASSED

**Created files exist**:
```bash
[ -f "client/src/scenes/VictoryScene.ts" ] && echo "FOUND: client/src/scenes/VictoryScene.ts" || echo "MISSING: client/src/scenes/VictoryScene.ts"
```
FOUND: client/src/scenes/VictoryScene.ts

**Commits exist**:
```bash
git log --oneline --all | grep -q "230ed14" && echo "FOUND: 230ed14" || echo "MISSING: 230ed14"
git log --oneline --all | grep -q "659949c" && echo "FOUND: 659949c" || echo "MISSING: 659949c"
```
FOUND: 230ed14
FOUND: 659949c

**Key links verified**:
- GameScene launches VictoryScene: `scene.launch("VictoryScene", data)` in matchEnd handler ✓
- VictoryScene returns to BootScene: `scene.start('BootScene')` in returnToLobby ✓
- VictoryScene registered in config: `scene: [BootScene, GameScene, VictoryScene]` ✓

All self-checks passed. Plan 04-02 complete.
