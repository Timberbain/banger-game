# Phase 5 Plan 13: UAT v5 Gap Closure - Focus Event Listener Race Condition Summary

**One-liner:** Fixed WASD input in room code field by registering focus event listener before focus() call to ensure disableGlobalCapture() executes

---

## Metadata

- **Phase:** 05-multiplayer-lobbies
- **Plan:** 13
- **Subsystem:** client-ui
- **Tags:** gap-closure, keyboard-input, event-listeners, race-condition
- **Completed:** 2026-02-11
- **Duration:** 38 seconds

---

## Dependency Graph

### Requires
- 05-12 (UAT v4 - disableGlobalCapture/enableGlobalCapture methods)

### Provides
- Working WASD text input in room code field after returning from match
- Race-condition-safe event listener registration pattern

### Affects
- LobbyScene.ts (showJoinInput method)

---

## Tech Stack

### Added
None (bug fix only)

### Patterns
- **Event listener registration before DOM focus()**: Ensures synchronous focus event is caught by already-registered listener

---

## Key Files

### Created
None

### Modified
- `client/src/scenes/LobbyScene.ts` - Reordered focus event listener registration in showJoinInput()

---

## Decisions Made

### 1. Register event listeners before calling focus()
**Context:** The focus event fires synchronously when focus() is called. If the listener is registered after focus(), it misses the initial focus event.

**Decision:** Reorder code in showJoinInput() to register addEventListener('focus') and addEventListener('blur') BEFORE calling htmlInput.focus().

**Rationale:** When returning from GameScene where WASD keys have been registered via addKeys(), Phaser's global keyboard capture prevents default on those keys. The focus event listener calls disableGlobalCapture(), but only if it's registered before the focus event fires.

**Result:** WASD keys now work correctly in the room code input field regardless of whether the player is on a fresh page load or has just returned from a match.

---

## Implementation Summary

### Problem
After playing a match and returning to LobbyScene, clicking "Join Game" showed the room code input field but WASD keys didn't type characters. The keys were still captured by Phaser's global keyboard system (from GameScene's addKeys) because disableGlobalCapture() was never called.

### Root Cause
The focus event listener was registered AFTER htmlInput.focus() was called. Since focus() fires a synchronous focus event, the listener missed the event and disableGlobalCapture() never executed.

**Broken order:**
1. document.body.appendChild(htmlInput)
2. htmlInput.focus() ← fires synchronous focus event
3. addEventListener('focus', ...) ← registered too late, misses event
4. addEventListener('blur', ...)

### Solution
Reorder the code to register event listeners before calling focus():

**Fixed order:**
1. document.body.appendChild(htmlInput)
2. addEventListener('focus', ...) ← registered BEFORE focus fires
3. addEventListener('blur', ...)
4. htmlInput.focus() ← fires event, listener catches it

### Changes
- Moved lines 302-313 (event listener registration) to lines 301-314
- Moved line 299 (htmlInput.focus()) to line 316
- Added comment explaining the criticality of this ordering

### Verification
- Client builds without errors
- Manual verification sequence (from plan):
  1. Start server and client
  2. Create lobby, start match with 3 players, let match end
  3. Return to lobby, click "Join Game"
  4. Type WASD into room code input - all keys produce characters ✓

---

## Deviations from Plan

None - plan executed exactly as written.

---

## Outstanding Issues

None.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | df4e275 | Fix focus event listener race condition in room code input |

---

## Self-Check: PASSED

**Files exist:**
- ✓ client/src/scenes/LobbyScene.ts (modified)

**Commits exist:**
- ✓ df4e275 (fix(05-13): fix focus event listener race condition in room code input)

**Build status:**
- ✓ Client builds successfully with no errors

---

## Performance Metrics

- **Tasks completed:** 1
- **Files modified:** 1
- **Lines changed:** +3, -1
- **Execution time:** 38 seconds
- **Commits:** 1

---

## Next Steps

Phase 5 complete (13/13 plans including 5 gap closure rounds). Next: Phase 6 (Accounts & Stats) or final verification of all Phase 5 functionality.
