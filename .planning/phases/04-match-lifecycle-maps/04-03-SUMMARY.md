---
phase: 04-match-lifecycle-maps
plan: 03
subsystem: maps
tags: [maps, rotation, tilemaps, spawn-points]
dependency_graph:
  requires: [04-01-server-match-lifecycle]
  provides: [map-pool, map-rotation, dynamic-map-loading, spawn-points]
  affects: [server-room-creation, client-tilemap-loading]
tech_stack:
  added: [shared/maps.ts, map-metadata-registry]
  patterns: [sequential-rotation, dynamic-asset-loading]
key_files:
  created:
    - shared/maps.ts
    - client/public/maps/corridor_chaos.json
    - client/public/maps/cross_fire.json
    - client/public/maps/pillars.json
  modified:
    - server/src/rooms/GameRoom.ts
    - client/src/scenes/GameScene.ts
    - client/src/scenes/BootScene.ts
decisions:
  - decision: "4 maps in rotation pool (test_arena + 3 new)"
    rationale: "Provides gameplay variety while keeping pool manageable for initial release"
  - decision: "Sequential map rotation with static counter"
    rationale: "Simple round-robin ensures all maps get played; no randomness avoids repetition"
  - decision: "All maps use 800x608 dimensions (25x19 tiles)"
    rationale: "Consistent arena size simplifies physics bounds; only obstacle layouts vary"
  - decision: "Map-specific spawn points (not random)"
    rationale: "Ensures balanced starting positions appropriate for each map layout"
  - decision: "Client loads tilemap after receiving state.mapName"
    rationale: "Dynamic loading allows map selection by server without client rebuild"
metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 4
  files_modified: 3
  commits: 2
  completed_date: "2026-02-10"
---

# Phase 04 Plan 03: Arena Map System Summary

**One-liner:** 4-map rotation pool with distinct obstacle layouts (corridors, cross, pillars, open) and sequential rotation between matches

## What Was Built

### Map Metadata System
- **shared/maps.ts**: MapMetadata interface and MAPS array
  - Map name, display name, file path, tileset reference
  - Arena dimensions (800x608 pixels for all maps)
  - Spawn points: Paran center, guardians at opposite corners
  - 4 maps: test_arena, corridor_chaos, cross_fire, pillars

### New Arena Maps
- **corridor_chaos.json**: H-shaped corridor structure forcing close combat
  - Narrow passages and tight spaces
  - Vertical and horizontal corridors creating maze-like layout
- **cross_fire.json**: Central cross pattern with 4 open corner arenas
  - Large plus-shaped wall creating quadrants
  - Open corners connected by narrow passages
- **pillars.json**: Scattered 2x2 pillar obstacles
  - Individual pillar blocks providing cover
  - Open-field combat with tactical positioning options

### Server Integration
- **GameRoom.ts**: Static map rotation counter
  - `currentMapIndex` increments on room creation (round-robin)
  - Selected map stored in `state.mapName` for client sync
  - Map-specific spawn points replace random center offset
  - Arena bounds use `mapMetadata.width/height` (not hardcoded ARENA)
  - Projectile bounds also use map dimensions

### Client Integration
- **GameScene.ts**: Dynamic tilemap loading
  - `preload()` only loads tileset image (not map JSON)
  - `onStateChange.once()` reads `state.mapName` after connection
  - Dynamically loads correct map JSON and creates tilemap
  - `createTilemap()` helper method for deferred creation
- **BootScene.ts**: Simplified to title screen
  - No map rendering (GameScene handles all tilemap logic)
  - Simple "BANGER / Connecting..." screen

## Deviations from Plan

None - plan executed exactly as written.

## Technical Details

### Map Rotation Flow
1. Room created → select `MAPS[currentMapIndex % MAPS.length]`
2. Increment `currentMapIndex` for next room
3. Set `state.mapName` to selected map name
4. Clients read `mapName` from state and load corresponding JSON

### Dynamic Loading Pattern
- Client doesn't know map in advance (no preload)
- Server sends `mapName` in initial state
- Client uses `onStateChange.once()` to get map name before player spawn
- Phaser's `load.once('complete')` ensures tilemap ready before rendering

### Spawn Point Strategy
- All maps have 3 spawn points: 1 Paran (center), 2 guardians (corners)
- Guardians spawn at opposite corners for tactical balance
- No randomization (deterministic per map)

### Map Dimensions Consistency
- All maps 25 tiles wide x 19 tiles tall (800x608 pixels)
- ARENA constants in shared/physics.ts remain 800x600
- Maps slightly taller (608 vs 600) but arena bounds clamp correctly
- Keeps physics bounds simple while allowing map design flexibility

## Testing Notes

All 3 new map JSON files validated as proper Tiled format:
- Parseable JSON with correct structure
- 475 tiles per layer (25x19)
- Ground layer: all tile 2 (grass)
- Walls layer: 0 = empty, 3 = wall
- Identical metadata to test_arena.json

Server and client both compile without TypeScript errors.

## Files Modified

**Created:**
- `shared/maps.ts` (68 lines)
- `client/public/maps/corridor_chaos.json` (61 lines)
- `client/public/maps/cross_fire.json` (61 lines)
- `client/public/maps/pillars.json` (61 lines)

**Modified:**
- `server/src/rooms/GameRoom.ts` (+28 lines): Import MAPS, add rotation logic, use spawn points, update bounds
- `client/src/scenes/GameScene.ts` (+30 lines): Dynamic map loading with onStateChange
- `client/src/scenes/BootScene.ts` (-42 lines): Simplified to title screen only

## Commits

- `e0218a4`: feat(04-match-lifecycle-maps-03): create shared maps metadata and 3 new arena maps
- `0eae536`: feat(04-match-lifecycle-maps-03): integrate map rotation and dynamic loading

## Next Steps

Plan 04-03 complete. Phase 4 remaining work:
- No additional plans in phase (3 of 3 complete)
- Phase 4 complete: Match lifecycle, victory scene, and map system all functional

Ready for Phase 5: UI/UX enhancements or Phase 6: Polish & Testing.

## Self-Check: PASSED

**Files created verification:**
- shared/maps.ts: FOUND
- client/public/maps/corridor_chaos.json: FOUND
- client/public/maps/cross_fire.json: FOUND
- client/public/maps/pillars.json: FOUND

**Commits verification:**
- e0218a4: FOUND
- 0eae536: FOUND

All claimed files and commits exist.
