---
status: diagnosed
trigger: "When all 3 players enter the game from lobby, they see inconsistent status text. One sees 'Waiting for players...(3/3)', another sees 'Match started!', and the third sees 'Connected: <playername>'."
created: 2026-02-10T12:00:00Z
updated: 2026-02-10T12:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple independent text-setting code paths race against each other depending on join timing
test: Traced all statusText.setText calls and the timing of matchStart broadcast vs handler registration
expecting: N/A - root cause confirmed
next_action: Report findings

## Symptoms

expected: All 3 players should see the same status text when match starts (either "Match started!" or nothing)
actual: Player 1 sees "Waiting for players...(3/3)", Player 2 sees "Match started!", Player 3 sees "Connected: <playername>"
errors: No errors - visual inconsistency
reproduction: All 3 players join game from lobby simultaneously
started: Unknown - likely always been this way since lobby transition was implemented

## Eliminated

## Evidence

- timestamp: 2026-02-10T12:00:30Z
  checked: GameScene.ts - all statusText.setText calls
  found: |
    6 separate code paths set statusText:
    1. Line 78: "Connecting to server..." (initial)
    2. Line 101: "Waiting for players... (${players.size}/3)" (after connect, BEFORE handler registration)
    3. Line 135: "Match started!" (matchStart message handler)
    4. Line 139: "Connected: ${sessionId}" (2s delayed callback after matchStart)
    5. Line 189: "Waiting for players... (${count}/3)" (onAdd, but ONLY if count < 3)
    6. Line 349: "SPECTATING..." (dead player, not relevant here)
  implication: These 6 paths have no coordination - final text depends on execution order

- timestamp: 2026-02-10T12:00:40Z
  checked: GameRoom.ts lines 193-196 (onJoin) and lines 437-443 (startMatch)
  found: |
    When 3rd player joins, onJoin adds player to state.players (line 189),
    then SYNCHRONOUSLY calls startMatch() (line 196).
    startMatch() broadcasts "matchStart" immediately (line 441).
    This means the broadcast fires BEFORE clients have necessarily received
    the state patch containing the 3rd player addition.
  implication: The matchStart broadcast can arrive at client before or after the state patch

- timestamp: 2026-02-10T12:00:50Z
  checked: GameScene.ts line 101 vs line 134 registration order
  found: |
    Line 101: statusText set to "Waiting for players... (${players.size}/3)" IMMEDIATELY on connect
    Line 112: onStateChange.once registered (loads map)
    Line 134: matchStart handler registered AFTER line 101
    If all 3 players were already added to state by the time a slow-connecting
    client receives initial state sync, players.size = 3 at line 101.
    The matchStart broadcast may have already been sent before the client
    registered its handler at line 134.
  implication: Late-connecting clients get "Waiting for players... (3/3)" and miss matchStart

- timestamp: 2026-02-10T12:00:55Z
  checked: GameScene.ts line 188 guard condition
  found: |
    onAdd handler only updates waiting text when count < 3.
    When count = 3, no text update occurs. This is a gap - there is no
    "count just reached 3" handling in the client state listener.
    The client relies entirely on the matchStart broadcast for this case.
  implication: If matchStart broadcast is missed, text remains stuck at last onAdd value or line 101 value

- timestamp: 2026-02-10T12:01:00Z
  checked: The 2s delayed callback at line 137-141
  found: |
    After "Match started!" is shown, a 2s timer replaces it with
    "Connected: ${sessionId}". This is a third state the text can be in
    depending purely on timing of when the user looks at the screen.
  implication: Explains why third player sees "Connected: <name>" - they got matchStart but 2s passed

## Resolution

root_cause: |
  THREE independent race conditions in statusText management:

  1. LINE 101 RACE (client/src/scenes/GameScene.ts:101): After connecting, the client
     unconditionally sets "Waiting for players... (${players.size}/3)". If the server
     already has 3 players when this client's initial state sync arrives, this shows
     "Waiting for players... (3/3)" and is never corrected because:
     - The onAdd guard (line 188) skips updates when count >= 3
     - The matchStart broadcast was already sent before the client registered its handler

  2. BROADCAST TIMING RACE (server/src/rooms/GameRoom.ts:196 + :441): The server calls
     startMatch() synchronously inside onJoin() for the 3rd player. The broadcast goes
     out immediately. Colyseus message handlers are registered AFTER the connect resolves
     on the client (line 134 is after the await/connect at line 96). A client that connects
     slightly late may miss the one-shot matchStart broadcast entirely.

  3. DELAYED CALLBACK CONFUSION (client/src/scenes/GameScene.ts:137-141): Even clients that
     DO receive matchStart will show "Connected: ${sessionId}" after 2 seconds, which is
     meaningless status text during active gameplay.

  The combination produces all three observed states:
  - "Waiting for players...(3/3)" = Client missed matchStart, line 101 ran with size=3
  - "Match started!" = Client received matchStart, within 2s window
  - "Connected: <name>" = Client received matchStart, 2s timer fired

fix: |
  RECOMMENDED FIX: Replace one-shot broadcast reliance with Schema-based matchState listening.

  1. In GameScene.ts, add a matchState listener using room.state.listen("matchState"):
     - When matchState changes to "playing": show "Match started!" then hide after 2s
     - When matchState is "waiting": show "Waiting for players... (count/3)"
     - This is reliable because Schema state is always correct on initial sync AND on changes

  2. Remove or guard line 101: Don't unconditionally set waiting text. Instead, let the
     matchState listener handle it. If matchState is already "playing" on initial sync,
     show "Match started!" or skip the waiting text entirely.

  3. Remove the confusing "Connected: ${sessionId}" fallback text. During PLAYING state,
     either show nothing or show match-relevant info (timer, scores, etc.).

  4. Keep the matchStart broadcast handler as a backup but make it idempotent with the
     Schema listener (both should result in the same text).

  Specific code changes:

  A. After room connect (around line 100), replace line 101 with:
     ```
     // Check initial matchState
     if (this.room.state.matchState === 'playing') {
       this.statusText.setText('Match started!');
       this.time.delayedCall(2000, () => {
         if (!this.matchEnded) this.statusText.setVisible(false);
       });
     } else {
       this.statusText.setText(`Waiting for players... (${this.room.state.players.size}/3)`);
     }
     ```

  B. Add Schema listener after connect:
     ```
     this.room.state.listen("matchState", (value: string) => {
       if (value === 'playing') {
         this.statusText.setText('Match started!');
         this.time.delayedCall(2000, () => {
           if (!this.matchEnded) this.statusText.setVisible(false);
         });
       }
     });
     ```

  C. In onAdd handler (line 186-191), keep the waiting text update for count < 3, and add
     count === 3 handling that defers to matchState (don't set waiting text when match is about to start).

  D. Remove "Connected: ${sessionId}" replacement text (line 139) - replace with setVisible(false).

verification:
files_changed: []
