# Phase 8: Arena Overhaul - Research

**Researched:** 2026-02-13
**Domain:** Phaser 3 tilemaps, Tiled JSON map format, tileset art pipeline, collision grid architecture
**Confidence:** HIGH

## Summary

This phase replaces the current 4 small placeholder arenas (25x19 tiles, 800x608px) with 3+ larger arenas (~50x38 tiles, 1600x1216px) that use the provided tileset art (hedge, brick, wood, ground). The core challenge is threefold: (1) designing a human-readable map JSON format that works with both the existing CollisionGrid server-side and Phaser's Tilemap client-side, (2) creating composite tileset spritesheets that combine ground tiles from the "32x32 topdown tileset" with wall/obstacle tiles from the themed tilesets (hedge, brick, wood), and (3) ensuring the new larger maps integrate cleanly with the Phase 7 camera system (dynamic bounds, overview animation, zoom).

The existing codebase is well-prepared for this. Phase 7 already made arena bounds dynamic (read from MapMetadata), the PredictionSystem accepts constructor-injected bounds, and the camera system uses mapMetadata.width/height for setBounds. The CollisionGrid is pure TypeScript and size-agnostic -- it just needs a flat wallLayerData array and dimensions. The main work is: creating composite tilesets, writing a map generator script, updating the map loading pipeline to support multiple tilesets per map, and updating shared/maps.ts with new map metadata.

**Primary recommendation:** Create 3 composite tileset PNGs (one per arena theme) that each contain ground + wall + obstacle tiles in a single image, write a Python map generator that outputs human-readable JSON with named tile types, and update the map loading pipeline (server + client) to use the new tilesets and larger dimensions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.x | Tilemap rendering, multiple tileset support | Already in use; addTilesetImage supports margin/spacing for bleed prevention |
| PIL/Pillow | (system) | Composite tileset generation + map generation | Already used for asset pipeline (scripts/generate-assets.py) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CollisionGrid | shared | Server + client AABB collision | Already in use; size-agnostic, just needs wallLayerData + dimensions |
| MapMetadata | shared/maps.ts | Map registry with spawn points and dimensions | Already in use; needs new entries for larger maps |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JSON map format | Tiled editor .tmx/.json export | Tiled editor is overkill for programmatic maps; custom format gives full control over readability |
| Single composite tileset per map | Multiple tilesets per layer in Phaser | Phaser supports multi-tileset layers but adds complexity; single composite is simpler and avoids GID offset bugs |
| Hand-authored maps | Python generator script | Generator ensures consistency, reproducibility, and human-readable output; hand-editing 50x38=1900 tiles is error-prone |

## Architecture Patterns

### Recommended Project Structure
```
assets/tilesets/               # Source tileset art (provided, not modified)
  hedge_tileset.png            # 128x192 (4x6 tiles)
  brick_tileset.png            # 128x192 (4x6 tiles)
  wood_tileset.png             # 128x192 (4x6 tiles)
  32x32 topdown tileset*.png   # 1344x384 (42x12 tiles) -- ground source
  The Ground v2-4 Alpha.png    # 448x320 -- alternative ground source

scripts/
  generate-arenas.py           # NEW: generates composite tilesets + map JSONs

client/public/tilesets/
  arena_hedge.png              # NEW: composite (ground + hedge walls/obstacles)
  arena_brick.png              # NEW: composite (ground + brick walls/obstacles)
  arena_wood.png               # NEW: composite (ground + wood walls/obstacles)

client/public/maps/
  hedge_garden.json            # NEW: 50x38 hedge-themed arena
  brick_fortress.json          # NEW: 50x38 brick-themed arena
  timber_yard.json             # NEW: 50x38 wood-themed arena

shared/
  maps.ts                      # Updated with new map entries
  obstacles.ts                 # Updated tile IDs for new tilesets
```

### Pattern 1: Composite Tileset Spritesheet
**What:** Combine ground tiles + themed wall/obstacle tiles into a single tileset PNG per arena theme. This avoids multi-tileset GID offset complexity in the map JSON and simplifies both server and client loading.

**When to use:** When each map uses tiles from multiple source images but a single Phaser tileset per layer is simpler.

**Layout (per composite tileset):**
```
Row 0: [ground_1] [ground_2] [ground_3] [ground_4]   -- 4 ground variants
Row 1: [wall]     [heavy]    [medium]   [light]       -- walls + destructibles
Row 2: [deco_1]   [deco_2]   [deco_3]   [deco_4]     -- decoration variants
```
Result: 128x96 image (4 columns x 3 rows = 12 tiles at 32x32).

**Why this layout:**
- Tile IDs stay small and sequential (firstgid=1, so tiles are 1-12)
- Ground tiles come from the provided "32x32 topdown tileset Spreadsheet" (cherry-picked, not all 504 tiles)
- Wall/obstacle tiles come from the themed tilesets (hedge/brick/wood)
- Decoration tiles add visual variety without collision

### Pattern 2: Human-Readable Map JSON Format
**What:** Map JSON files use Tiled-compatible format (layers with flat data arrays) but tile IDs map to named types that are documented in the file and in shared code.

**Current format (opaque IDs):**
```json
{ "data": [3, 3, 3, 0, 0, 0, 6, 0, 5, ...] }
```

**New format (same structure, but with documented mapping):**
The JSON retains Tiled format for Phaser compatibility, but a "tileMapping" custom property documents the semantic meaning:
```json
{
  "properties": [
    { "name": "tileMapping", "type": "string", "value": "1=grass, 2=dirt, 3=stone_floor, 4=grass_dark, 5=wall, 6=heavy, 7=medium, 8=light, 9=deco_1, 10=deco_2, 11=deco_3, 12=deco_4" }
  ]
}
```
The shared/obstacles.ts tile ID constants stay the single source of truth for collision classification. The JSON metadata just aids human readability.

### Pattern 3: Map Generator Script
**What:** A Python script that programmatically generates both the composite tileset PNGs and the map JSON files for each arena theme.

**Why:**
- 50x38 = 1900 tiles per layer -- hand-editing is impractical
- Reproducible: rerun to regenerate after tileset art changes
- Each arena gets a distinct layout (not just tile reskin): different obstacle patterns, corridors, open areas
- Spawn points are calculated based on map layout (Paran center-ish, Guardians in opposite corners)

### Pattern 4: Dynamic Map Loading with New Tilesets
**What:** Update MAP_TILESET_INFO in GameScene.ts and the Phaser tileset loading to use the new composite tilesets.

**Current flow:**
1. Server sends mapName via state
2. Client looks up MAP_TILESET_INFO[mapName] for tileset key/image
3. Client loads tileset image + tilemap JSON
4. Client calls addTilesetImage with tileset name matching JSON

**New flow (same structure, just different values):**
1. Same -- server sends mapName
2. Client looks up MAP_TILESET_INFO[mapName] -- now points to composite tileset
3. Same -- loads composite tileset image + new map JSON
4. Same -- addTilesetImage with new tileset name

### Anti-Patterns to Avoid
- **Multiple tilesets per layer without careful GID management:** Phaser supports it but the server CollisionGrid uses raw tile IDs from the Walls layer data. If multiple tilesets have overlapping GID ranges, collision classification breaks. Use single composite tileset per map to avoid this.
- **Using all 504 tiles from the ground tileset:** The map JSON would need a huge tileset image and most tiles would be unused. Cherry-pick 3-4 ground variants per theme.
- **Hardcoded map dimensions:** All dimensions must come from the JSON file and flow through MapMetadata. The server reads mapJson.width/height, the client uses mapMetadata.width/height for camera bounds.
- **Breaking the obstacle tile ID contract:** shared/obstacles.ts defines WALL=3, HEAVY=4, MEDIUM=5, LIGHT=6. The new composite tilesets MUST use the same tile positions so these IDs remain valid, OR obstacles.ts must be updated in sync.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tile bleeding at zoom=2 | Manual padding/offset | Phaser's pixelArt:true + roundPixels:true + 1px extrusion | Already configured globally in main.ts; Phaser's WebGL renderer handles this natively with these settings |
| Multi-tileset GID math | Manual firstGID offset tracking | Single composite tileset per map | GID math is a common source of off-by-one bugs; composite tileset eliminates the problem entirely |
| Tilemap rendering | Custom tile renderer | Phaser.Tilemaps.Tilemap | Phaser handles culling, camera-relative rendering, zoom, and layer ordering |
| Arena layout design | Random noise generator | Structured procedural generation with explicit wall/corridor/room patterns | Pure noise creates unplayable layouts; need intentional corridors and open areas for asymmetric gameplay |

**Key insight:** The biggest risk in this phase is not the tilemap rendering (Phaser handles that well) but the tile ID mapping between the new composite tilesets and the existing collision/obstacle system. The shared/obstacles.ts constants must match the tile positions in the composite tilesets.

## Common Pitfalls

### Pitfall 1: Tile ID Mismatch Between Tilesets and Collision System
**What goes wrong:** New composite tilesets use different tile positions than the current 8-tile tilesets, but shared/obstacles.ts still references the old IDs (WALL=3, HEAVY=4, MEDIUM=5, LIGHT=6). Server classifies tiles incorrectly -- walls become passable, obstacles become indestructible.
**Why it happens:** The tile IDs in obstacles.ts are hard-coupled to the tile position in the tileset image. If the composite tileset puts wall at position 5 instead of 3, collision breaks silently.
**How to avoid:** Design the composite tileset layout so that wall/obstacle tile positions match the current IDs exactly (wall at index 3, heavy at 4, medium at 5, light at 6). If that's not possible, update obstacles.ts and all 3 map JSONs in the same commit. Run the collision grid builder against each new map JSON to verify tile classification.
**Warning signs:** Player passes through walls, obstacles don't take damage, Paran doesn't lose velocity on wall hit.

### Pitfall 2: Tiled JSON firstgid Offset
**What goes wrong:** Tiled JSON format uses firstgid (default 1) so tile index 0 in the image = tile ID 1 in JSON data. If the map generator outputs raw 0-based indices, all tiles render shifted by one position.
**Why it happens:** Tiled's convention: data value 0 means "no tile" (empty). Value 1 = first tile in the tileset. This is a critical +1 offset that's easy to forget.
**How to avoid:** The existing maps already use firstgid=1. The map generator must output data values as (tile_index + 1), where tile_index is 0-based into the image. Value 0 = empty/no-tile.
**Warning signs:** Ground renders as the wrong tile, walls look like ground, first tile in the image is never visible.

### Pitfall 3: Camera Bounds Not Updating for Larger Maps
**What goes wrong:** Arena renders at 1600x1216 but camera bounds remain at 800x608 (from old map metadata or ARENA constant fallback), causing the camera to not scroll to the full arena.
**Why it happens:** shared/maps.ts width/height values not updated, or ARENA constant used as fallback somewhere.
**How to avoid:** Update shared/maps.ts entries with correct width (50*32=1600) and height (38*32=1216). The server already uses mapMetadata.width/height for clamping. The client already uses mapMetadata for camera.setBounds(). Phase 7 verified this path works.
**Warning signs:** Camera stops scrolling at old boundary, players clamp at 800/608, overview animation shows wrong area.

### Pitfall 4: Server Map File Path Resolution
**What goes wrong:** Server can't find the new map JSON files because the path resolution in GameRoom.ts uses `path.join(__dirname, '../../../client/public', this.mapMetadata.file)` which depends on the built output directory structure.
**Why it happens:** Server is compiled to `server/dist/`, so `__dirname` is `server/dist/rooms/`. The `../../../client/public` path traversal works for the current layout. If map files move or the path changes, loading fails silently or crashes.
**How to avoid:** Keep new map JSON files in `client/public/maps/` (same directory as existing maps). The path resolution is already correct for this location. Test server map loading after adding new files.
**Warning signs:** Server crashes on room creation with "ENOENT: no such file or directory".

### Pitfall 5: Overview Animation Not Covering Full Arena
**What goes wrong:** The match-start overview (zoom=1.0 centered on arena) shows the arena too small or too large because the viewport calculations assume the old 800x608 size.
**Why it happens:** startMatchOverview() uses mapMetadata.width/2 and height/2 for centerOn. At zoom=1.0, the camera viewport is 1280x720 (the full canvas). A 1600x1216 arena at zoom=1.0 won't fully fit in view.
**How to avoid:** The overview zoom may need adjustment for larger arenas. At zoom=1.0, viewport=1280x720. Arena=1600x1216 -- neither dimension fits. May need zoom=0.6 (viewport becomes ~2133x1200 in world space) or zoom=0.8 (viewport becomes 1600x900 -- width fits, height needs adjustment). Calculate: `overviewZoom = Math.min(canvasWidth / arenaWidth, canvasHeight / arenaHeight)` to fit the full arena.
**Warning signs:** Overview animation shows only part of the arena, or shows too much empty space.

### Pitfall 6: Tile Bleeding / Seams at Zoom=2
**What goes wrong:** Faint lines appear between tiles when the camera is at zoom=2 or during sub-pixel camera positions.
**Why it happens:** WebGL texture sampling can bleed adjacent pixels when tiles are packed tightly with no margin/spacing in the tileset image.
**How to avoid:** The game already uses `pixelArt: true` and `roundPixels: true` in Phaser config, which prevents most bleeding. If issues persist, add 1px extrusion (duplicate edge pixels) to the composite tileset images or add 1px spacing in the tileset with corresponding margin/spacing values in the JSON. Phaser's addTilesetImage accepts tileMargin and tileSpacing parameters.
**Warning signs:** Thin colored lines between tiles, flickering seam lines when camera moves.

## Code Examples

### Example 1: Composite Tileset Generator (Python)
```python
# Source: project-specific pattern based on existing generate-assets.py
from PIL import Image
import os

def create_composite_tileset(ground_tiles, wall_tile, obstacle_tiles, deco_tiles, output_path):
    """
    Create a 128x96 composite tileset (4 cols x 3 rows of 32x32 tiles).
    Row 0: ground variants
    Row 1: wall + destructible obstacles
    Row 2: decoration variants
    """
    TILE = 32
    img = Image.new("RGBA", (4 * TILE, 3 * TILE), (0, 0, 0, 0))

    # Row 0: 4 ground tiles
    for i, gt in enumerate(ground_tiles[:4]):
        img.paste(gt, (i * TILE, 0))

    # Row 1: wall, heavy, medium, light
    img.paste(wall_tile, (0, TILE))
    for i, ot in enumerate(obstacle_tiles[:3]):
        img.paste(ot, ((i + 1) * TILE, TILE))

    # Row 2: 4 decoration tiles
    for i, dt in enumerate(deco_tiles[:4]):
        img.paste(dt, (i * TILE, 2 * TILE))

    img.save(output_path)
```

### Example 2: Map JSON Structure (50x38)
```json
{
  "width": 50,
  "height": 38,
  "tilewidth": 32,
  "tileheight": 32,
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "type": "map",
  "version": "1.10",
  "infinite": false,
  "properties": [
    {
      "name": "tileMapping",
      "type": "string",
      "value": "1=grass, 2=dirt, 3=stone, 4=moss, 5=wall, 6=heavy, 7=medium, 8=light, 9-12=deco"
    }
  ],
  "tilesets": [
    {
      "firstgid": 1,
      "columns": 4,
      "image": "../tilesets/arena_hedge.png",
      "imagewidth": 128,
      "imageheight": 96,
      "margin": 0,
      "name": "arena_hedge",
      "spacing": 0,
      "tilecount": 12,
      "tilewidth": 32,
      "tileheight": 32
    }
  ],
  "layers": [
    {
      "name": "Ground",
      "type": "tilelayer",
      "data": [1, 2, 1, 3, ...],
      "width": 50,
      "height": 38
    },
    {
      "name": "Walls",
      "type": "tilelayer",
      "data": [5, 5, 5, 0, 0, ...],
      "width": 50,
      "height": 38
    }
  ]
}
```

### Example 3: Updated obstacles.ts Tile IDs
```typescript
// Composite tileset layout (firstgid=1):
// Row 0: tiles 1-4 = ground variants (non-solid)
// Row 1: tile 5=wall, 6=heavy, 7=medium, 8=light
// Row 2: tiles 9-12 = decoration (non-solid)
export const OBSTACLE_TILES = {
  WALL: 5,    // Indestructible wall (was 3)
  HEAVY: 6,   // Heavy destructible obstacle (was 4)
  MEDIUM: 7,  // Medium destructible obstacle (was 5)
  LIGHT: 8,   // Light destructible obstacle (was 6)
} as const;
```

### Example 4: Updated MapMetadata Entry
```typescript
{
  name: "hedge_garden",
  displayName: "Hedge Garden",
  file: "maps/hedge_garden.json",
  tileset: "arena_hedge",
  width: 1600,   // 50 * 32
  height: 1216,  // 38 * 32
  spawnPoints: {
    paran: { x: 800, y: 608 },   // Center
    guardians: [
      { x: 200, y: 200 },        // Top-left quadrant
      { x: 1400, y: 1016 }       // Bottom-right quadrant
    ]
  }
}
```

### Example 5: Overview Zoom Calculation for Larger Arenas
```typescript
// In startMatchOverview():
const canvasW = this.cameras.main.width;   // 1280
const canvasH = this.cameras.main.height;  // 720
const arenaW = this.mapMetadata!.width;    // 1600
const arenaH = this.mapMetadata!.height;   // 1216
const overviewZoom = Math.min(canvasW / arenaW, canvasH / arenaH);
// For 1600x1216: Math.min(1280/1600, 720/1216) = Math.min(0.8, 0.59) = 0.59
cam.setZoom(overviewZoom);
```

### Example 6: Updated MAP_TILESET_INFO in GameScene.ts
```typescript
const MAP_TILESET_INFO: Record<string, { key: string; image: string; name: string }> = {
  hedge_garden:    { key: 'tileset_hedge',   image: 'tilesets/arena_hedge.png',   name: 'arena_hedge' },
  brick_fortress:  { key: 'tileset_brick',   image: 'tilesets/arena_brick.png',   name: 'arena_brick' },
  timber_yard:     { key: 'tileset_wood',    image: 'tilesets/arena_wood.png',    name: 'arena_wood' },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single 8-tile tileset per map (128x64) | Will become 12-tile composite tileset (128x96) | Phase 8 | More tile variety, dedicated ground row + wall row + deco row |
| 25x19 tile arenas (800x608px) | Will become 50x38 tile arenas (1600x1216px) | Phase 8 | ~4x more playable area, requires scrolling camera (Phase 7 provides) |
| Hardcoded tile IDs (WALL=3) | Will shift to (WALL=5) due to composite layout | Phase 8 | obstacles.ts update required, all maps must use new IDs simultaneously |
| Procedural placeholder tilesets | Composite tilesets from provided art assets | Phase 8 | Uses hedge/brick/wood/ground PNGs from assets/tilesets/ |

**Deprecated/outdated:**
- Old 4 maps (test_arena, corridor_chaos, cross_fire, pillars) -- will be replaced entirely
- Old 4 solarpunk tilesets (solarpunk_ruins, solarpunk_living, solarpunk_tech, solarpunk_mixed) -- replaced by composites

## Existing Asset Analysis

### Provided Tilesets (assets/tilesets/)
| File | Dimensions | Tiles | Grid | Content |
|------|-----------|-------|------|---------|
| hedge_tileset.png | 128x192 | 24 | 4x6 | Green hedges: top/side/corner wall variants, hedge obstacles, ground with grass |
| brick_tileset.png | 128x192 | 24 | 4x6 | Purple/grey bricks: wall variants, cracked bricks, stone floor |
| wood_tileset.png | 128x192 | 24 | 4x6 | Brown wood: planks, logs, fence posts, dark floor |
| 32x32 topdown tileset Spreadsheet V1-1.png | 1344x384 | 504 | 42x12 | Massive ground atlas: dirt, grass, stone, sand, water, paths, many variants |
| The Ground v2-4 Alpha.png | 448x320 | ~100+ | variable | Alternative ground textures with transparency |

### Current Client Tilesets (client/public/tilesets/)
| File | Dimensions | Layout | Status |
|------|-----------|--------|--------|
| solarpunk_ruins.png | 128x64 | 4x2 = 8 tiles | WILL BE REPLACED |
| solarpunk_living.png | 128x64 | 4x2 = 8 tiles | WILL BE REPLACED |
| solarpunk_tech.png | 128x64 | 4x2 = 8 tiles | WILL BE REPLACED |
| solarpunk_mixed.png | 128x64 | 4x2 = 8 tiles | WILL BE REPLACED |

### Tile Selection Strategy
From the provided tilesets, cherry-pick tiles for each composite:

**Hedge Garden theme:**
- Ground: Select 4 grass/dirt variants from the ground tileset (rows 0-2 have many grass/earth options)
- Walls: Hedge wall tile from hedge_tileset.png (full hedge block, not corner variants)
- Obstacles: 3 hedge obstacle variants at different densities from hedge_tileset.png
- Deco: Grass tufts, flowers from hedge_tileset.png

**Brick Fortress theme:**
- Ground: Select 4 stone/brick floor variants from ground tileset
- Walls: Brick wall block from brick_tileset.png
- Obstacles: Cracked/damaged brick variants from brick_tileset.png
- Deco: Stone floor details from brick_tileset.png

**Timber Yard theme:**
- Ground: Select 4 wood/earth floor variants from ground tileset
- Walls: Wood plank wall from wood_tileset.png
- Obstacles: Log/fence variants from wood_tileset.png
- Deco: Wood shavings, bark details from wood_tileset.png

## Open Questions

1. **Tile ID shift: update obstacles.ts or preserve current IDs?**
   - What we know: Current obstacles.ts uses WALL=3, HEAVY=4, MEDIUM=5, LIGHT=6. The new composite tileset has ground tiles in positions 1-4 (row 0), pushing wall/obstacles to 5-8 (row 1).
   - What's unclear: Could we put wall/obstacles in row 0 to preserve IDs 1-4? That would mean ground tiles go in row 1 (5-8) and deco in row 2 (9-12).
   - Recommendation: Put ground tiles first (row 0, IDs 1-4) because ground is the most common tile type and having it first is more intuitive. Update obstacles.ts to WALL=5, HEAVY=6, MEDIUM=7, LIGHT=8. The change is small and atomic -- update the constants and all maps in one commit.

2. **How many ground tile variants per theme?**
   - What we know: The ground tileset has hundreds of options. We need 4 per theme (fills row 0).
   - What's unclear: Exactly which tiles look best for each theme.
   - Recommendation: Start with 4 distinct variants per theme. The map generator can use weighted random selection (e.g., 70% primary ground, 20% secondary, 10% tertiary) for natural-looking floors.

3. **Map layout design: what makes a good asymmetric arena?**
   - What we know: Paran needs long corridors to build speed. Guardians need sight lines and cover. Open areas favor Guardians (shooting range). Tight corridors favor Paran (speed + contact kill).
   - What's unclear: Exact proportions of open vs. corridor space, obstacle density.
   - Recommendation: Each arena should have a mix of: (a) 2-3 long corridors for Paran speed runs, (b) 2-3 open areas where Guardians can kite, (c) destructible obstacles as chokepoints that Paran can break through. Spawn Paran near center, Guardians in opposite corners/sides with escape routes.

4. **Should old maps be deleted or kept as fallback?**
   - What we know: There are 4 old maps. The map rotation uses a static counter mod MAPS.length.
   - What's unclear: Whether to keep backward compatibility.
   - Recommendation: Replace entirely. The old maps use the old tileset IDs (WALL=3) which will be invalid after obstacles.ts update. Keeping both old and new would require conditional ID mapping. Clean break is safer.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: shared/collisionGrid.ts, shared/maps.ts, shared/obstacles.ts, server/src/rooms/GameRoom.ts, client/src/scenes/GameScene.ts -- direct code reading
- Phaser 3.90 API docs (via Context7 /websites/phaser_io_api-documentation) -- addTilesetImage, createLayer, createBlankLayer multi-tileset support
- Phase 7 verification report (.planning/phases/07-hd-viewport-camera/07-VERIFICATION.md) -- confirmed dynamic bounds, camera system, pixelArt settings

### Secondary (MEDIUM confidence)
- Asset dimension analysis via `file` command -- hedge/brick/wood are 128x192, ground is 1344x384
- Visual inspection of provided tileset PNGs -- tile content and quality assessed

### Tertiary (LOW confidence)
- None. All findings verified against codebase or official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in use (Phaser tilemaps, PIL, CollisionGrid)
- Architecture: HIGH -- existing patterns well-understood, changes are incremental
- Pitfalls: HIGH -- identified from direct codebase analysis, not hypothetical
- Asset pipeline: MEDIUM -- exact tile selection from provided art requires visual judgment

**Research date:** 2026-02-13
**Valid until:** 2026-03-13 (stable domain -- Phaser 3.90 APIs won't change, project architecture is settled)
