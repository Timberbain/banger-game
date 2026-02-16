---
status: resolved
trigger: "The zooming and transition between stages is a bit janky - suggested using masked transition from https://github.com/devshareacademy/phaser-3-typescript-games-and-examples/tree/main/examples/3.80/scene-transition-geometry-mask"
created: 2026-02-14T00:00:00Z
updated: 2026-02-16T21:30:00Z
---

## Current Focus

hypothesis: Current implementation uses sequential transitions (zoom → fade → swap → fade in) which may have timing issues or abrupt state changes causing jankiness
test: Analyze GameScene.ts stage transition handlers for timing, sequencing, and state management issues
expecting: Find timing conflicts, hard state changes, or missing easing between transition phases
next_action: Document root cause and recommended fix approach

## Symptoms

expected: Smooth camera zoom out on stage end, followed by clean fade transition to next stage
actual: Transition feels janky (unsmooth, possibly choppy or poorly timed)
errors: None reported
reproduction: Play through a match to stage end and observe the zoom/transition
started: User reported after Phase 9 completion

## Eliminated

## Evidence

- timestamp: 2026-02-14T00:01:00Z
  checked: GameScene.ts lines 328-398 (stage transition handlers)
  found: Three sequential message handlers: stageEnd (zoom out), stageTransition (fade/swap), stageStart (fade in/overview)
  implication: Transitions are handled across separate async events, creating potential timing gaps

- timestamp: 2026-02-14T00:02:00Z
  checked: stageEnd handler (lines 328-338)
  found: |
    - controlsLocked = true
    - cam.zoomTo(0.5, 1500, 'Sine.easeInOut') -- zooms out over 1.5 seconds
    - No coordination with next transition phase
    - Audio plays immediately
  implication: Zoom completes but doesn't trigger next phase; server sends stageTransition message separately

- timestamp: 2026-02-14T00:03:00Z
  checked: stageTransition handler (lines 341-375)
  found: |
    - Immediately starts cam.fade(500, ...) -- 500ms fade to black
    - Fade callback at progress >= 1 swaps tilemap
    - No timing coordination with previous zoom effect
    - Hard cutover: destroys old tilemap, creates new one instantly
  implication: If stageTransition arrives before zoom completes, visual conflict; if after, there's a gap

- timestamp: 2026-02-14T00:04:00Z
  checked: stageStart handler (lines 378-398)
  found: |
    - fadeIn(500) from black
    - Immediately calls startMatchOverview() which does its own camera animation
    - startMatchOverview() stops follow, sets zoom, centerOn, then after 1.5s zooms back
  implication: Multiple camera animations stacking/conflicting

- timestamp: 2026-02-14T00:05:00Z
  checked: startMatchOverview() implementation (lines 1462-1503)
  found: |
    - Stops follow, sets overview zoom, centers camera
    - After 1500ms: starts following, zoomTo(2, 800, 'Sine.easeInOut')
    - After 800ms more: unlocks controls
    - Total duration: 2.3 seconds of locked controls
  implication: Long animation sequence with multiple hard state changes

- timestamp: 2026-02-14T00:06:00Z
  checked: Timing coordination between handlers
  found: |
    - stageEnd: 1.5s zoom animation
    - Server broadcasts stageTransition after 2s delay (from GameRoom STAGE_END duration)
    - 500ms gap between zoom completion and fade start = dead time
    - stageTransition: 500ms fade in callback
    - Server broadcasts stageStart after 4s delay (from GameRoom STAGE_TRANSITION duration)
    - Total: ~7s of transitions with multiple hard state changes
  implication: Multiple timing gaps and hard cutoffs create janky feel

- timestamp: 2026-02-14T00:07:00Z
  checked: Server-side timing (GameRoom.ts lines 700-733)
  found: |
    - Line 700-703: After broadcasting stageEnd, setTimeout 2000ms before beginStageTransition
    - Line 730-733: After broadcasting stageTransition, setTimeout 4000ms before startStage
    - Total server-controlled timing: 6 seconds
  implication: Confirmed timing gaps; server waits fixed durations regardless of client animation state

- timestamp: 2026-02-14T00:08:00Z
  checked: Camera state changes during transitions
  found: |
    - stageEnd: cam.zoomTo() tweens zoom value over 1.5s
    - stageTransition: cam.fade() runs independently, doesn't wait for zoom
    - Tilemap swap happens at fade progress >= 1 (500ms after fade starts)
    - stageStart: cam.fadeIn() + startMatchOverview() (another 2.3s of animations)
    - Multiple camera animations running/sequencing without smooth handoff
  implication: Camera undergoes 4 separate animation sequences with state resets between them

- timestamp: 2026-02-14T00:09:00Z
  checked: Geometry mask transition approach research
  found: |
    - DevShareAcademy example uses geometry masks for smoother scene transitions
    - Geometry mask creates clipping path, revealing/concealing content smoothly
    - Can animate mask shape (circle expanding/contracting, etc.) for iris wipe effect
    - Allows single continuous animation instead of multiple discrete phases
  implication: Alternative approach could unify zoom + fade into single smooth mask animation

## Resolution

root_cause: |
  Stage transitions feel janky due to THREE ROOT ISSUES:

  1. TIMING GAPS: Multiple discrete animation phases with gaps between them
     - Zoom animation: 1.5s (client)
     - Dead time: 0.5s (zoom finishes, waiting for server)
     - Fade to black: 0.5s (client)
     - Server processing: ~3.5s (before next message)
     - Fade in + overview: 2.3s (client)
     Total: ~8s with multiple "waiting" gaps creating perceived jankiness

  2. UNCOORDINATED STATE CHANGES: Camera undergoes 4 separate animation sequences
     - stageEnd: zoomTo(0.5, 1500) -- tweens zoom over 1.5s
     - stageTransition: fade(500) starts independently (may overlap or gap)
     - Tilemap swap: Hard cutover at fade completion (instant destroy/create)
     - stageStart: fadeIn(500) + startMatchOverview() (another zoom + pan sequence)
     Each transition resets camera state, causing jarring handoffs

  3. SERVER-DRIVEN TIMING: Client animations can't coordinate with server messages
     - Server uses fixed timeouts (2s, 4s) regardless of client animation state
     - If client zoom takes longer (frame drops, lag), fade starts anyway
     - If client fade completes early, sits on black screen waiting for server
     - No client → server feedback loop for animation completion

  COMPARISON: Geometry mask approach (suggested alternative)
     - Single continuous animation (mask shape grows/shrinks)
     - No discrete phases or hard state changes
     - Can run entirely client-side during server's fixed timeout
     - Camera zoom + visual transition unified into one smooth effect

artifacts: |
  Key files involved:
  - client/src/scenes/GameScene.ts
    - Lines 328-338: stageEnd handler (zoom out)
    - Lines 341-375: stageTransition handler (fade + swap)
    - Lines 378-398: stageStart handler (fade in + overview)
    - Lines 1462-1503: startMatchOverview() (multi-stage camera animation)

  - server/src/rooms/GameRoom.ts
    - Lines 700-703: 2s delay before stageTransition message
    - Lines 730-733: 4s delay before stageStart message

missing: |
  Research needed:
  - Specific geometry mask implementation pattern for camera transitions in Phaser 3.90
  - How to create expanding/contracting circle mask for iris wipe effect
  - Performance implications of geometry masks (WebGL vs Canvas)
  - Integration with existing camera.fade() and camera.zoomTo() APIs

  Design decisions needed:
  - Keep multi-phase server timing (2s + 4s) or adjust for smoother client experience?
  - Replace all transition phases with single mask animation, or just smooth the gaps?
  - Should mask animation be tied to camera zoom, or independent effect?
  - Need to coordinate with tilemap swap timing (must happen during full obscuration)

fix: [empty until applied]
verification: [empty until verified]
files_changed: []
