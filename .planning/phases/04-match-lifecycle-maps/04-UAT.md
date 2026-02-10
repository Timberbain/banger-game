---
status: complete
phase: 04-match-lifecycle-maps
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-02-10T20:00:00Z
updated: 2026-02-10T20:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Match auto-starts with 3 players
expected: Open 3 browser tabs connected to the server. As the 3rd player joins, the match transitions from "Waiting for players... (N/3)" to active gameplay. Players can move and shoot once match starts.
result: pass

### 2. Win condition — eliminate all guardians
expected: Kill both guardian players (faran/baran). Match ends and victory/defeat screen appears showing "Paran Wins!" for the paran player and defeat for guardians.
result: pass

### 3. Win condition — eliminate Paran
expected: Kill the paran player. Match ends and victory/defeat screen appears showing "Guardians Win!" for guardian players and defeat for paran.
result: pass

### 4. Spectator mode on death
expected: When your player dies, the camera switches to follow an alive player. "SPECTATING - Press Tab to cycle players" text appears. Pressing Tab cycles the camera between remaining alive players.
result: pass

### 5. Victory screen with stats
expected: After match ends, a semi-transparent overlay appears with "VICTORY!" (green) or "DEFEAT" (red) title, winner subtitle, and a stats table showing each player's name, role, kills, deaths, damage, and accuracy. Your local player row is highlighted in yellow.
result: pass

### 6. Return to Lobby
expected: On the victory screen, clicking "Return to Lobby" disconnects from the room and returns to the initial boot/title screen.
result: pass

### 7. Map rotation between matches
expected: Play two consecutive matches (complete first, rejoin for second). The second match loads a different arena map than the first.
result: pass

### 8. Maps have distinct obstacle layouts
expected: Across different matches, you see visually different maps — one with corridors, one with a cross pattern, one with scattered pillars, and the original open arena.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
