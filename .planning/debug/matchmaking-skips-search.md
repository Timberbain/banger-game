---
status: diagnosed
trigger: "When clicking Find Match and selecting a role, player is sent directly to a game lobby instead of seeing Searching for match animation"
created: 2026-02-10T00:00:00Z
updated: 2026-02-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Multiple interconnected issues form a broken matchmaking pipeline
test: Code analysis of all three files
expecting: N/A - root cause confirmed
next_action: Return diagnosis

## Symptoms

expected: After selecting a role in Find Match, client shows "Searching for match..." animation. Players enter lobby only when enough players queue (1 Paran + 2 Guardians).
actual: Player is sent directly to a game lobby as if they created a private room.
errors: None reported
reproduction: Click "Find Match", select a preferred role
started: Unknown - may have always been this way

## Eliminated

## Evidence

- timestamp: 2026-02-10T00:01:00Z
  checked: LobbyScene.ts joinMatchmaking() method (line 343-380)
  found: Client calls this.client.joinOrCreate('lobby_room', { matchmaking: true, preferredRole, name }) which resolves immediately when Colyseus creates or finds a lobby_room. The "Searching for match..." UI (line 346-361) IS created but is destroyed almost instantly because joinOrCreate resolves in milliseconds.
  implication: joinOrCreate is the wrong Colyseus primitive for matchmaking -- it always succeeds immediately by creating a new room if none exist.

- timestamp: 2026-02-10T00:02:00Z
  checked: LobbyRoom.ts onCreate() (line 16-107) and onJoin() (line 109-124)
  found: (1) onCreate does NOT check options.matchmaking flag at all. Private rooms are set up via options.private (line 20-26), but there is no corresponding branch for matchmaking rooms. (2) onJoin does NOT check options.matchmaking or options.preferredRole -- it adds the player to the lobby unconditionally. (3) The joinQueue/leaveQueue message handlers (lines 77-87) exist but are never called by the client.
  implication: The server treats matchmaking joins identically to private room joins. The matchmaking flag is passed but completely ignored.

- timestamp: 2026-02-10T00:03:00Z
  checked: LobbyScene.ts joinMatchmaking() post-join behavior (line 370-372)
  found: After joinOrCreate resolves, code calls spinnerInterval.destroy() and then this.showLobbyView() -- the exact same lobby view shown for private rooms (character selection, ready button, room code display).
  implication: Client never sends joinQueue message. It never enters a "waiting in queue" state. It goes directly to the full lobby UI.

- timestamp: 2026-02-10T00:04:00Z
  checked: MatchmakingQueue.ts and LobbyRoom.ts matchmaking check interval (lines 90-104)
  found: (1) MatchmakingQueue singleton exists and has correct queue logic (addToQueue, tryFormMatch with 1 paran + 2 guardians). (2) LobbyRoom sets up a 1-second interval calling tryFormMatch(). (3) BUT the match result is logged and then discarded (line 96: "TODO: Create lobby room for matched players"). (4) The queue is never populated because the client never sends joinQueue messages.
  implication: The entire matchmaking queue system is scaffolded but not wired up. It is dead code.

- timestamp: 2026-02-10T00:05:00Z
  checked: server/src/index.ts room definitions (line 32)
  found: gameServer.define("lobby_room", LobbyRoom) has no filterBy option. Colyseus joinOrCreate without filterBy will join ANY available lobby_room or create a new one.
  implication: Without filterBy, matchmaking players could even be placed into existing private rooms (though private rooms use setPrivate(true) which hides them from matchmaking, so in practice joinOrCreate always creates a NEW room for the matchmaking player).

## Resolution

root_cause: The matchmaking flow is scaffolded but never wired up end-to-end. There are 5 specific breaks in the pipeline:

1. CLIENT NEVER QUEUES: joinMatchmaking() calls joinOrCreate('lobby_room') which immediately creates/joins a LobbyRoom. It never sends a 'joinQueue' message to add the player to the MatchmakingQueue. The "Searching..." UI exists but is destroyed in milliseconds when joinOrCreate resolves.

2. SERVER IGNORES MATCHMAKING FLAG: LobbyRoom.onJoin() does not check options.matchmaking or options.preferredRole. It adds the player to the lobby unconditionally, same as a private room join.

3. SERVER IGNORES MATCH RESULTS: LobbyRoom's matchmaking interval calls tryFormMatch() but the result is discarded with a TODO comment (line 93-96). Even if a match formed, nothing would happen.

4. WRONG ARCHITECTURE: The current approach has each matchmaking player join their own LobbyRoom, then expects LobbyRoom to run queue logic. But each player is isolated in a separate room instance. The MatchmakingQueue singleton collects sessionIds but those sessions belong to different room instances, making it impossible to move them into a shared lobby.

5. NO QUEUE-TO-LOBBY TRANSITION: There is no mechanism to create a shared LobbyRoom for matched players and move them into it. The TODO at line 93-96 acknowledges this.

fix:
verification:
files_changed: []
