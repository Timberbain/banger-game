---
status: diagnosed
trigger: "Investigate why collision is broken on the new Phase 8 arenas"
created: 2026-02-14T12:00:00Z
updated: 2026-02-14T12:00:00Z
---

## Current Focus

hypothesis: Client prediction uses wrong arena bounds (800x608 instead of 1600x1216) causing position clamping desync with server
test: Trace the timing of mapMetadata assignment vs PredictionSystem construction
expecting: mapMetadata is null when PredictionSystem is created, causing fallback to old ARENA constant
next_action: Report root cause

## Symptoms

expected: Smooth movement and collision with walls/obstacles matching visual tilemap
actual: Invisible collisions, character jumps around, characters get bugged through walls
errors: No error messages - behavioral bug
reproduction: Play on any Phase 8 arena (50x38 tiles, 1600x1216px), move around the arena
started: After Phase 8 arena changes (new tile IDs, larger map size)

## Eliminated

- hypothesis: Tile ID mismatch between obstacles.ts and map JSON data
  evidence: Map uses tile IDs 3-46 for walls (within WALL_MIN=1 to WALL_MAX=48), 101/102/103 for destructibles -- all match OBSTACLE_TILES exactly
  timestamp: 2026-02-14T12:00:00Z

- hypothesis: Client and server build collision grids differently
  evidence: Both use identical code path -- same wallLayer.data, same OBSTACLE_TILE_IDS, same CollisionGrid constructor
  timestamp: 2026-02-14T12:00:00Z

- hypothesis: firstgid offset causing tile ID mismatch
  evidence: firstgid=1 in tileset, raw JSON data is passed directly to CollisionGrid (not Phaser-transformed), so no offset issue
  timestamp: 2026-02-14T12:00:00Z

## Evidence

- timestamp: 2026-02-14T12:00:00Z
  checked: shared/obstacles.ts tile ID definitions
  found: WALL_MIN=1, WALL_MAX=48 (indestructible range), HEAVY=101, MEDIUM=102, LIGHT=103
  implication: Tile ID definitions cover the actual map tile values correctly

- timestamp: 2026-02-14T12:00:00Z
  checked: hedge_garden.json Walls layer data
  found: Walls layer uses tile IDs 0,3,4,5,13,21,28,37,39,44,45,46 (walls) and 101,102,103 (destructibles)
  implication: All wall tiles fall within 1-48 indestructible range, all destructibles match 101-103

- timestamp: 2026-02-14T12:00:00Z
  checked: Server vs client CollisionGrid construction
  found: Both use identical inputs - same JSON data, same OBSTACLE_TILE_IDS, same constructor
  implication: Collision grids should be identical between server and client

- timestamp: 2026-02-14T12:00:00Z
  checked: PredictionSystem arena bounds initialization
  found: PredictionSystem constructor receives arenaBounds param, falls back to ARENA={width:800,height:608}
  implication: If mapMetadata is null at construction time, prediction uses wrong bounds

- timestamp: 2026-02-14T12:00:00Z
  checked: Timing of mapMetadata vs PredictionSystem creation in GameScene.ts
  found: mapMetadata set in onStateChange.once() (line 221), PredictionSystem created in createPlayerSprite() called from players.onAdd (line 328). In Colyseus, onAdd fires BEFORE onStateChange.once.
  implication: CONFIRMED - mapMetadata is null when PredictionSystem is created

- timestamp: 2026-02-14T12:00:00Z
  checked: PredictionSystem.sendInput() edge clamping (lines 108-109) and reconcile() clamping (lines 170-172)
  found: Both clamp to this.arenaBounds which is set to ARENA={800,608} since mapMetadata was null
  implication: Client clamps player to 800x608, server allows up to 1600x1216 - causes massive desync

- timestamp: 2026-02-14T12:00:00Z
  checked: Server resolvePlayerCollision() bounds (GameRoom.ts line 342-343)
  found: Server clamps to this.mapMetadata.width/height = 1600x1216
  implication: Server and client have completely different position clamp boundaries

- timestamp: 2026-02-14T12:00:00Z
  checked: Spawn points in maps.ts
  found: Guardian 2 spawns at (1400, 1016) - far beyond client bounds of (800, 608)
  implication: Guardian 2 would be immediately clamped/snapped on the client, causing constant jump

- timestamp: 2026-02-14T12:00:00Z
  checked: PredictionSystem API for updating bounds after construction
  found: No method exists to update arenaBounds post-construction
  implication: Even after mapMetadata loads, prediction system keeps wrong 800x608 bounds forever

## Resolution

root_cause: |
  TWO ROOT CAUSES found:

  ROOT CAUSE 1 (PRIMARY - causes jumping/teleporting):
  PredictionSystem is constructed with wrong arena bounds (800x608 instead of 1600x1216).
  The PredictionSystem is created in createPlayerSprite() which is called from players.onAdd.
  The map metadata (which has the correct 1600x1216 dimensions) is set in onStateChange.once().
  In Colyseus, onAdd fires BEFORE onStateChange, so mapMetadata is null at construction time.
  The PredictionSystem falls back to the old ARENA constant (800x608).
  There is NO method to update arenaBounds after construction.

  This causes the client prediction to clamp all positions to 800x608, while the server
  allows positions up to 1600x1216. Every server reconciliation for positions beyond
  800x608 results in a snap, and the next client frame clamps it back -- creating
  constant "jumping around."

  Guardian 2 spawns at (1400, 1016), which is far beyond the client's 800x608 clamp,
  making it immediately and permanently affected.

  ROOT CAUSE 2 (SECONDARY - causes invisible walls during initial frames):
  The collision grid is not available when PredictionSystem first starts processing inputs.
  The grid is only created after the tilemap JSON finishes loading (async), but input
  processing starts immediately when the player sprite is created. During this window,
  the client does NO collision resolution while the server does, causing additional desync.
  (This existed before Phase 8 but is more noticeable with larger arenas.)

fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
