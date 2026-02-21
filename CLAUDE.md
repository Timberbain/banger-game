# CLAUDE.md

Banger is an asymmetric 1v2 multiplayer arena shooter (Phaser 3 + Colyseus + TypeScript). Server-authoritative, 60Hz fixed timestep. See `docs/GAME_DESIGN.md` for mechanics and `docs/design-system.md` for the solarpunk visual schema.

## Dev Commands

```bash
cd server && npm run dev      # Express + Colyseus (port 2567)
cd client && npm run dev      # Vite + Phaser (port 8080)
```

Both must run simultaneously. No test or lint commands exist.

## Environment Variables

See `.env.example` for all variables:

| Variable           | Purpose                               | Default                                       |
| ------------------ | ------------------------------------- | --------------------------------------------- |
| `PORT`             | Server port                           | 2567 (dev) / 3000 (prod)                      |
| `NODE_ENV`         | Environment                           | —                                             |
| `MAPS_BASE_DIR`    | Map/asset file location               | `client/public` (dev), `/app/public` (Docker) |
| `CLIENT_DIST_PATH` | Client static file location           | `/app/public` (Docker)                        |
| `ENABLE_MONITOR`   | Colyseus monitor at `/colyseus`       | `0`                                           |
| `SIMULATE_LATENCY` | Artificial latency in ms (dev only)   | `0`                                           |
| `VITE_SERVER_URL`  | Client build-time server URL override | auto-detected                                 |
| `VITE_API_URL`     | Client build-time API URL override    | auto-detected                                 |

## CRITICAL: Colyseus Version Pinning

Server: `colyseus@0.15.57` / Client: `colyseus.js@0.15.28`. Do NOT upgrade — 0.16.x client has incompatible WebSocket protocol, 0.17.x server has missing peer deps.

## Key Technical Gotchas

### Physics

- Fixed timestep `1/60s` everywhere (not deltaTime) for deterministic client prediction
- Input must be sent EVERY FRAME for acceleration physics (not just on key change)
- Paran: cardinal-only movement (last-key-wins), loses ALL velocity on wall/obstacle hit
- Guardians: 8-directional, instant stop on release

### Networking / Colyseus

- Server no-input fallback: maintain velocity + integrate position (do NOT call physics with noInput — triggers instant stop and causes jitter)
- Use `matchMaker.createRoom` for GameRoom transition (NOT `create` — reserves a phantom seat)
- Role assignment: GameRoom reads `options.role` from client (session IDs change between rooms)
- Use `matchEnd` broadcast for stats (not Schema listener — avoids stale data)
- `Number()` cast on Colyseus message data for enum type safety

### Colyseus Schema Safe Reset

- ArraySchema: use `pop()` in a loop (NEVER `.clear()`)
- MapSchema: iterate keys + `delete()` each (NEVER `.clear()`)
- `.clear()` is broken in Colyseus 0.15 and causes silent sync corruption

### Phaser Scene Patterns

- Scenes reuse via `scene.start()` which skips the constructor — reset ALL member variables in `create()`
- VictoryScene and HUDScene are overlays (`scene.launch`, not `scene.start`)
- Stage transitions: 600ms server delay before `resetStage` ensures client iris wipe fully closes
- `InterpolationSystem.snapTo()` injects two identical snapshots for instant teleport (no lerp glide)

### Match Flow

LobbyScene → (role select + ready) → GameRoom created → GameScene + HUD overlay → VictoryScene overlay → back to LobbyScene

### Reconnection

- Server: `allowReconnection(client, 60)` with 60s grace period
- Client: localStorage token, `checkReconnection()` on LobbyScene create, 3 retries with 800ms delay
- `attachRoomListeners` must re-register ALL Schema listeners after reconnect

## Development Workflow

- **Learning docs:** After discovering a gotcha or non-obvious pattern, document it in `docs/claude-learnings.md`
- **Requirement review:** Before implementing, evaluate if the requirement could be improved — raise suggestions before coding
- **Consistency:** Verify new code follows existing conventions (naming, Schema usage, scene lifecycle, design system). Flag divergences before proceeding
- **Improvements:** When you spot tech debt or feature ideas, highlight to user. If approved, add to `docs/improvements.md`
