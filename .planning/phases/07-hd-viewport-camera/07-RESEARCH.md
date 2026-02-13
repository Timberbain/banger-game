# Phase 7: HD Viewport & Camera - Research

**Researched:** 2026-02-13
**Domain:** Phaser 3 camera system, pixel art scaling, viewport architecture
**Confidence:** HIGH

## Summary

This phase transforms the game from an 800x600 static viewport (where the arena fills the screen) to a 1280x720 HD canvas with 2x integer-scaled pixel art, a scrolling camera that follows the player, and all UI/scenes adapted to the new resolution. The core architectural shift is: physics and camera logic operate in **logical coordinates (640x360)** while Phaser's zoom handles the 2x visual scaling to the 1280x720 canvas.

Phaser 3.90 has excellent built-in support for everything needed: `camera.startFollow()` with lerp + deadzone, `camera.setBounds()` for world edge clamping, `camera.setZoom(2)` for integer pixel scaling, `camera.shake()` for impact effects, `camera.setRoundPixels(true)` for shimmer prevention, and the Scale Manager's `FIT` mode with letterboxing. The HUD overlay scene already has its own camera with fixed scroll -- this just needs coordinate updates.

The biggest complexity is the **2x asset creation**: all sprites (3 characters x 26 frames, projectiles, particles) and 4 tilesets need new 2x versions with hand-drawn detail (not naive upscale). The Tiled JSON maps also reference tileset dimensions, so maps need updating. The existing `generate-assets.py` script provides the PIL pipeline for procedural art generation. The `ARENA` constant must become dynamic (read from map metadata) for physics edge-clamping to work with any future map size.

**Primary recommendation:** Set canvas to 1280x720 with `pixelArt: true`, use `camera.setZoom(2)` on the GameScene camera for 640x360 logical viewport, keep HUDScene camera at zoom=1 (it renders at full 1280x720 for crisp UI), create all 2x assets with richer detail through the existing PIL pipeline, and make `ARENA` bounds dynamic from map metadata.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tight follow with small deadzone -- camera reacts to most movement, player stays near center
- Smooth lerp easing (not instant snap) -- camera eases toward player with damping
- Camera clamps at world edges -- no black void visible, player shifts off-center near walls
- Look-ahead in movement direction -- camera shifts slightly ahead to show what's coming
- Paran gets stronger look-ahead than Guardians (tuned to movement speed difference)
- Gentle ease on direction reversal -- camera transitions smoothly, not jarring on fast Paran turns
- Subtle camera shake on impact events (wall hits, taking damage) -- kept small to not disrupt gameplay
- Subtle speed zoom-out when Paran at max velocity -- camera pulls back slightly, returns to normal when slowing
- Uniform camera settings across all maps -- no per-map camera tuning
- Match-start overview: quick ~1.5s zoom showing full arena with all players visible, then zoom in to player position
- Controls locked during match-start overview animation
- 2x integer scaling: 1280x720 canvas, 640x360 logical resolution
- Nearest-neighbor filtering -- sharp, hard pixel edges, classic retro look
- Logical coordinates (640x360) for camera and physics -- Phaser zoom handles the 2x visual scaling
- Resizable window with letterboxing to maintain aspect ratio
- Keep current arena sizes (800x608) -- camera scrolls them at 640x360 viewport. Phase 8 handles arena overhaul
- Snap all sprites to pixel grid -- no sub-pixel rendering, no shimmer
- Create ALL sprites at 2x resolution (characters, projectiles, tiles, particles, HUD icons)
- More detailed art -- use extra pixels for additional shading, detail, and visual richness (still pixel art)
- More animation frames -- smoother walk cycles, attacks, and death animations
- Add idle breathing/bobbing animation (2-3 frame cycle when standing still)
- Tiles and obstacles remain static (no ambient animation like grass sway)
- Viewport-relative positioning (% of screen) -- adapts to resolution, future-proof
- HUD elements stay compact (same visual size) -- extra resolution gives more visible arena
- Kill feed stays in top-right
- Ping indicator stays in current position
- Fixed screen overlay (not scrolling with world camera)
- HUD renders through the 2x pixel grid -- pixelated text/icons matching game world aesthetic
- All scenes (Lobby, Victory, Help, Boot) also render at 2x pixel art scale
- Timer stays as text counter (not visual bar/circle)
- Camera follows closest alive player when dead
- Tab key cycles between surviving players
- "Spectating: [Player Name]" banner displayed while watching someone

### Claude's Discretion
- Exact deadzone dimensions and lerp speed values
- Look-ahead distance and speed zoom-out magnitude
- Camera shake intensity and duration
- Overview animation easing curve
- Exact viewport-relative HUD percentages and spacing
- Spectator banner styling and positioning
- How to handle letterbox bars visually (black or themed)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.x | Game framework (camera, scaling, rendering) | Already in use; has all needed camera/zoom APIs built-in |
| PIL/Pillow | (system) | 2x asset generation via Python script | Already used for v1.0 asset pipeline (`scripts/generate-assets.py`) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tiled JSON | 1.10 | Map format with tileset references | Map JSONs need `tilewidth`/`tileheight` updated to 64 for 2x tiles |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Phaser camera zoom | Scale Manager ZOOM_2X | Scale Manager zoom applies globally including UI; camera zoom is per-scene, giving HUD independence |
| PIL Python scripts | Canvas/sharp in Node | PIL pipeline already exists and works; no reason to switch |

**Installation:**
No new packages needed. All required APIs exist in Phaser 3.90 and PIL/Pillow.

## Architecture Patterns

### Recommended Approach: Camera Zoom vs. Scale Manager Zoom

**What:** Use `camera.setZoom(2)` on GameScene's main camera instead of the Scale Manager's `ZOOM_2X` config option.

**Why:** The Scale Manager zoom applies to ALL cameras across ALL scenes. Since HUDScene is a separate overlay scene, its camera would also get 2x zoom, making HUD elements massive. By using per-camera zoom:
- GameScene camera: `zoom = 2` (world renders at 2x, 640x360 logical viewport)
- HUDScene camera: `zoom = 1` (HUD renders at full 1280x720, allowing precise positioning)
- Lobby/Boot/Victory/Help scenes: `zoom = 1` (full 1280x720 with 2x-resolution pixel art assets)

**Critically important pattern:**
```typescript
// GameScene create():
const cam = this.cameras.main;
cam.setZoom(2);
cam.setRoundPixels(true);
cam.setBounds(0, 0, mapMeta.width, mapMeta.height);
cam.startFollow(localSprite, true, 0.08, 0.08); // roundPixels=true, lerpX/Y=0.08
cam.setDeadzone(40, 30); // Small deadzone in logical pixels
```

### Pattern 1: Dynamic Look-Ahead via followOffset

**What:** Dynamically update `camera.followOffset` each frame based on player velocity direction to achieve look-ahead.

**When to use:** Every frame in GameScene.update() when not spectating.

**Example:**
```typescript
// Source: Phaser 3 API - camera.followOffset / setFollowOffset
// Look-ahead: shift camera offset based on velocity direction
const LOOK_AHEAD_PARAN = 60;   // pixels ahead for Paran (fast mover)
const LOOK_AHEAD_GUARDIAN = 30; // pixels ahead for Guardians

const maxLookAhead = localRole === 'paran' ? LOOK_AHEAD_PARAN : LOOK_AHEAD_GUARDIAN;
const speed = Math.sqrt(vx * vx + vy * vy);
const maxSpeed = CHARACTERS[localRole].maxVelocity;
const lookFactor = Math.min(speed / maxSpeed, 1);

// Target offset based on velocity direction
const targetOffsetX = speed > 5 ? -(vx / speed) * maxLookAhead * lookFactor : 0;
const targetOffsetY = speed > 5 ? -(vy / speed) * maxLookAhead * lookFactor : 0;

// Smooth interpolation (gentle ease on direction reversal)
const OFFSET_LERP = 0.04; // Low value = smooth transition
cam.followOffset.x += (targetOffsetX - cam.followOffset.x) * OFFSET_LERP;
cam.followOffset.y += (targetOffsetY - cam.followOffset.y) * OFFSET_LERP;
```

Note: `followOffset` values are **subtracted** from the target position, so negative offset = camera looks ahead in the positive direction.

### Pattern 2: Speed Zoom-Out for Paran

**What:** Slightly reduce camera zoom when Paran is at high velocity to show more of the arena.

**Example:**
```typescript
// Source: Phaser 3 API - camera.setZoom()
if (localRole === 'paran') {
  const speed = Math.sqrt(vx * vx + vy * vy);
  const maxSpeed = CHARACTERS.paran.maxVelocity;
  const speedRatio = Math.min(speed / maxSpeed, 1);

  // Zoom range: 2.0 (stationary) to 1.85 (max speed)
  const BASE_ZOOM = 2.0;
  const MIN_ZOOM = 1.85;
  const targetZoom = BASE_ZOOM - (BASE_ZOOM - MIN_ZOOM) * speedRatio;

  // Smooth lerp to avoid jarring zoom changes
  const currentZoom = cam.zoom;
  cam.setZoom(currentZoom + (targetZoom - currentZoom) * 0.03);
}
```

**Caution:** Non-integer zoom values can cause sub-pixel shimmer. With `roundPixels: true` and the zoom staying near 2.0 (range 1.85-2.0), this should be acceptable. The shimmer is barely perceptible at these values. If it becomes an issue, snap to fixed values like 1.875 (15/8) or 2.0.

### Pattern 3: Match-Start Overview Animation

**What:** Show the full arena for ~1.5s at match start, then zoom in to the player position.

**Example:**
```typescript
// Source: Phaser 3 API - camera.pan(), camera.zoomTo()
// Calculate zoom needed to show full arena
const arenaW = mapMeta.width;
const arenaH = mapMeta.height;
const viewW = 1280; // canvas width
const viewH = 720;  // canvas height
const overviewZoom = Math.min(viewW / arenaW, viewH / arenaH);

// Start zoomed out, centered on arena
cam.setZoom(overviewZoom);
cam.centerOn(arenaW / 2, arenaH / 2);
cam.stopFollow(); // Don't follow during overview

// Lock controls during overview
this.controlsLocked = true;

// After 1.5s, zoom to player
this.time.delayedCall(1500, () => {
  cam.startFollow(localSprite, true, 0.08, 0.08);
  cam.setDeadzone(40, 30);
  cam.zoomTo(2, 800, 'Sine.easeInOut'); // 800ms zoom-in
  this.controlsLocked = false;
});
```

### Pattern 4: Dynamic Arena Bounds

**What:** Replace the hardcoded `ARENA` constant with per-map bounds read from `MapMetadata`.

**Current problem:** `ARENA.width` and `ARENA.height` in `shared/physics.ts` are hardcoded to 800x608. The `PredictionSystem` and `GameRoom` use these for edge clamping. All 4 current maps happen to be 800x608, but Phase 8 will create different-sized arenas.

**Solution:**
```typescript
// shared/physics.ts: Keep ARENA as defaults, but allow override
export const ARENA = {
  width: 800,    // default, used if no map-specific bounds provided
  height: 608,
};

// PredictionSystem: Accept arena bounds in constructor
constructor(initialState: PlayerState, role: string, arenaBounds?: { width: number; height: number }) {
  this.arenaBounds = arenaBounds || ARENA;
}

// GameRoom: Use mapMetadata dimensions instead of ARENA constant
this.arenaWidth = this.mapMetadata.width;
this.arenaHeight = this.mapMetadata.height;
// Then use this.arenaWidth/this.arenaHeight instead of ARENA.width/ARENA.height
```

### Anti-Patterns to Avoid
- **Using Scale Manager ZOOM_2X:** This zooms ALL scenes/cameras. HUDScene would get double-zoomed, making UI elements too large.
- **Non-integer zoom for pixel art:** Zoom values like 2.5 cause sub-pixel rendering artifacts. Stay at integer multiples (2) or very close (1.85-2.0 for speed zoom with roundPixels on).
- **Mixing logical and canvas coordinates:** All physics, collision, and position logic must stay in logical coordinates (original scale). Only rendering is affected by zoom.
- **Upscaling old sprites with nearest-neighbor:** Simply doubling pixel size produces blocky, boring art. 2x sprites must be redrawn with additional detail using the extra pixel budget.
- **Hardcoded pixel positions in HUD:** Use viewport-relative percentages or calculated positions based on `this.cameras.main.width` / `this.cameras.main.height` instead of magic numbers like 400, 800, 790.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Camera follow + smoothing | Custom scroll math | `camera.startFollow(target, true, lerpX, lerpY)` | Phaser handles bounds clamping, lerp, deadzone, roundPixels automatically |
| Camera bounds clamping | Manual scroll clamp checks | `camera.setBounds(0, 0, w, h)` | Phaser's built-in correctly handles all edge cases including zoom |
| Camera shake | Custom offset jitter | `camera.shake(duration, intensity)` | Phaser's built-in shake is frame-perfect and auto-restores |
| Zoom animation | Manual zoom tween | `camera.zoomTo(targetZoom, duration, ease)` | Built-in zoom effect with easing curve support |
| Pan animation | Manual scroll tween | `camera.pan(x, y, duration, ease)` | Built-in pan effect with camera bounds awareness |
| Letterboxing | CSS hacks | Phaser Scale Manager `FIT` mode + `autoCenter: CENTER_BOTH` | Already in use, handles all browser/window sizes |
| Pixel grid snapping | Manual Math.round on positions | `camera.setRoundPixels(true)` | Phaser applies rounding at render time, not in game logic |

**Key insight:** Phaser 3 has a mature camera system with every feature this phase needs. The risk is in *not* using the built-in APIs and hand-rolling equivalent logic (which will have edge-case bugs).

## Common Pitfalls

### Pitfall 1: Sub-Pixel Shimmer with Camera Follow
**What goes wrong:** Sprites "shimmer" or appear to vibrate when the camera follows a moving player at non-integer positions.
**Why it happens:** Camera scroll values end up at fractional pixels (e.g., scrollX = 123.4567). At zoom=2, this means the camera offset between frames can differ by 1 rendered pixel, causing visible jitter.
**How to avoid:**
1. Set `camera.setRoundPixels(true)` -- rounds all render positions to integers
2. Pass `roundPixels: true` as the second argument to `startFollow()`
3. Keep zoom at integer value (2) for the main game camera
4. Set `pixelArt: true` in game config (already done) -- enables nearest-neighbor on textures
**Warning signs:** Tiles or sprites visually "shake" by 1 pixel when camera moves slowly.

### Pitfall 2: HUD Scene Double-Zoom
**What goes wrong:** HUD text and bars appear 2x too large or positioned off-screen.
**Why it happens:** If using Scale Manager zoom or accidentally applying zoom to HUDScene's camera, all overlay elements get zoomed. HUDScene's camera must stay at zoom=1.
**How to avoid:** Only apply zoom to GameScene's `this.cameras.main`. HUDScene's camera stays default (zoom=1, scroll=0,0). Currently the HUD already does `this.cameras.main.setScroll(0, 0)`.
**Warning signs:** HUD elements appear at 2x size or are positioned at half-expected coordinates.

### Pitfall 3: followOffset Sign Convention
**What goes wrong:** Look-ahead moves camera in the wrong direction.
**Why it happens:** `followOffset` is **subtracted** from the target position. So `followOffset.x = -50` means the camera looks 50 pixels to the *right* of the player (camera center is at player.x + 50).
**How to avoid:** If player moves right (vx > 0), set followOffset.x to a negative value so camera leads ahead. Think: "offset = opposite of look direction."
**Warning signs:** Camera leads behind the player instead of ahead.

### Pitfall 4: Hardcoded 800x600 / 400x300 References
**What goes wrong:** UI elements appear off-center, cut off, or mispositioned at 1280x720.
**Why it happens:** Dozens of places in the codebase use `400` (half of 800) as horizontal center and `300` (half of 600) as vertical center. These must all be updated.
**How to avoid:** Audit ALL scenes for hardcoded coordinate references. Use `this.cameras.main.width / 2` and `this.cameras.main.height / 2` for centering, or update the Layout constants in `designTokens.ts`.
**Warning signs:** Elements positioned at (400, 300) appear in the top-left quadrant at 1280x720.

### Pitfall 5: Tiled Map Tileset Dimensions Must Match
**What goes wrong:** Tiles render at wrong size, collision grid breaks, or tilemap fails to load.
**Why it happens:** Tiled JSON maps contain `tilewidth`/`tileheight` in the tileset definition. If 2x tileset images (64x64 tiles) are provided but the JSON still says 32x32, Phaser will slice the tileset incorrectly.
**How to avoid:** When creating 2x tilesets, also update ALL 4 map JSON files: change `tilewidth`/`tileheight` to 64 in both the root and tileset definitions, and update `imagewidth`/`imageheight`.
**Warning signs:** Tiles appear as quarters of the intended tile, or visual garbage.

### Pitfall 6: Camera Bounds with Zoom
**What goes wrong:** Camera shows black void near edges despite setBounds being called.
**Why it happens:** `setBounds` works in world coordinates. At zoom=2, the visible viewport is 640x360, so for an 800x608 arena the camera can scroll. The bounds must exactly match the world size.
**How to avoid:** `cam.setBounds(0, 0, mapMeta.width, mapMeta.height)` -- these are world pixel coordinates, not screen coordinates. Phaser automatically accounts for zoom when clamping.
**Warning signs:** Black regions visible at arena edges, or camera stops scrolling too early.

### Pitfall 7: Scene Reuse -- Camera State Reset
**What goes wrong:** Camera from a previous match retains zoom level, follow target, or offset from the last game.
**Why it happens:** Phaser scene reuse via `scene.start()` skips the constructor. Camera state persists.
**How to avoid:** In GameScene `create()`, reset camera fully: `cam.setZoom(1)`, `cam.stopFollow()`, `cam.setBounds(0, 0, ...)`, `cam.setScroll(0, 0)`, `cam.followOffset.set(0, 0)`.
**Warning signs:** Camera starts zoomed in on scene restart, or follows a destroyed sprite.

### Pitfall 8: Physics Coordinates vs. Render Coordinates
**What goes wrong:** Collision detection fails, or players appear to collide at wrong positions.
**Why it happens:** If someone accidentally scales physics coordinates by the zoom factor.
**How to avoid:** Physics, collision, input processing, and networking ALL stay in the original coordinate space (800x608 world). Only the camera zoom changes rendering. `camera.getWorldPoint()` converts screen coords to world coords for input if needed.
**Warning signs:** Collisions happening at half-distance, players teleporting on camera transitions.

## Code Examples

### Game Config Update (main.ts)
```typescript
// Source: Phaser 3 API - GameConfig
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true,    // Nearest-neighbor filtering globally
  roundPixels: true,  // Global pixel rounding (Phaser 3.70+ default)
  scene: [BootScene, LobbyScene, GameScene, HUDScene, VictoryScene, HelpScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

### GameScene Camera Setup
```typescript
// After tilemap is created and local player sprite exists:
const cam = this.cameras.main;
cam.setZoom(2);
cam.setRoundPixels(true);
cam.setBounds(0, 0, mapMeta.width, mapMeta.height);

// Start with overview (match start animation)
const overviewZoom = Math.min(1280 / mapMeta.width, 720 / mapMeta.height);
cam.setZoom(overviewZoom);
cam.centerOn(mapMeta.width / 2, mapMeta.height / 2);

// After overview completes, follow local player
cam.startFollow(localSprite, true, 0.08, 0.08);
cam.setDeadzone(40, 30); // ~6% of viewport width, ~8% of viewport height
```

### HUDScene Viewport-Relative Positioning
```typescript
// Source: Phaser 3 API - camera.width/height
// HUDScene camera stays at zoom=1, scroll=0
const W = this.cameras.main.width;   // 1280
const H = this.cameras.main.height;  // 720

// Timer: top center
this.timerText = this.add.text(W * 0.5, H * 0.03, '', { ... });

// Ping: top-right
this.pingText = this.add.text(W * 0.97, H * 0.03, '0ms', { ... });

// Kill feed: top-right below ping
const killFeedX = W * 0.98;
const killFeedBaseY = H * 0.08;

// Health bars: bottom center
const healthBarY = H * 0.95;

// Role reminder: top-left
this.roleReminder = this.add.text(W * 0.01, H * 0.01, roleName, { ... });
```

### Camera Shake on Impact
```typescript
// Source: Phaser 3 API - camera.shake(duration, intensity)
// Wall impact (Paran): subtle shake
cam.shake(80, 0.003);  // 80ms, very subtle

// Taking damage: slightly stronger
cam.shake(100, 0.005); // 100ms, noticeable but not disruptive
```

### 2x Sprite Asset Structure
```
Current (1x):
  sprites/paran.png   - 832x32 (26 frames at 32x32)
  sprites/faran.png   - 832x32 (26 frames at 32x32)
  sprites/baran.png   - 832x32 (26 frames at 32x32)
  sprites/projectiles.png - 24x8 (3 frames at 8x8)
  sprites/particle.png    - 8x8

New (2x):
  sprites/paran.png   - ?x64 (more frames at 64x64, e.g., 40+ frames)
  sprites/faran.png   - ?x64 (more frames at 64x64)
  sprites/baran.png   - ?x64 (more frames at 64x64)
  sprites/projectiles.png - 48x16 (3 frames at 16x16)
  sprites/particle.png    - 16x16

Tilesets (2x):
  tilesets/solarpunk_ruins.png  - 256x128 (4 cols x 2 rows at 64x64)
  tilesets/solarpunk_living.png - 256x128
  tilesets/solarpunk_tech.png   - 256x128
  tilesets/solarpunk_mixed.png  - 256x128
```

### Animation Frame Layout (2x with more frames)
```
Current per character (26 frames):
  Walk Down:  0-3  (4 frames)
  Walk Up:    4-7  (4 frames)
  Walk Right: 8-11 (4 frames)
  Walk Left:  12-15 (4 frames)
  Idle:       16-17 (2 frames)
  Shoot:      18-19 (2 frames)
  Death:      20-25 (6 frames)

New per character (~36 frames, adding breathing idle):
  Walk Down:  0-5   (6 frames -- smoother cycle)
  Walk Up:    6-11  (6 frames)
  Walk Right: 12-17 (6 frames)
  Walk Left:  18-23 (6 frames)
  Idle:       24-26 (3 frames -- breathing/bobbing cycle)
  Shoot:      27-29 (3 frames)
  Death:      30-35 (6 frames)
```

### BootScene Animation Registration Update
```typescript
// Walk Down: frames 0-5 (6 frames for smoother cycle)
this.anims.create({
  key: `${role}-walk-down`,
  frames: this.anims.generateFrameNumbers(role, { start: 0, end: 5 }),
  frameRate: 10,  // Slightly faster to compensate for more frames
  repeat: -1,
});

// Idle: frames 24-26 (3-frame breathing cycle)
this.anims.create({
  key: `${role}-idle`,
  frames: this.anims.generateFrameNumbers(role, { start: 24, end: 26 }),
  frameRate: 3,   // Slow breathing: ~1 cycle per second
  repeat: -1,
});
```

### Spectator Camera (Death)
```typescript
// Already partially implemented. Enhancement:
if (this.isSpectating && this.spectatorTarget) {
  const targetSprite = this.playerSprites.get(this.spectatorTarget);
  if (targetSprite) {
    // Use camera follow with slightly more zoom-out for spectator view
    cam.startFollow(targetSprite, true, 0.1, 0.1);
    cam.setDeadzone(60, 45); // Wider deadzone for spectator (less jarring)
  }
}
```

## Codebase Impact Analysis

### Files Requiring Changes

**Core Config:**
- `client/src/main.ts` -- Canvas size 800x600 -> 1280x720, add `roundPixels: true`
- `client/src/ui/designTokens.ts` -- Layout constants: canvas 800x600 -> 1280x720, all HUD positions

**GameScene (heaviest changes):**
- `client/src/scenes/GameScene.ts` -- Camera setup (zoom, follow, bounds, deadzone), look-ahead system, speed zoom, match-start overview, spectator camera, shake effects. Remove `centerOn` calls in spectator. Update victory burst coordinates.

**HUDScene:**
- `client/src/scenes/HUDScene.ts` -- All hardcoded positions (health bars at y=575, timer at 400/20, ping at 780/20, cooldown at 400/538, kill feed at 790/60, spectator at 400/50-75, role banner at 400/200, "FIGHT!" at 400/300, etc.). Convert to viewport-relative.

**Other Scenes:**
- `client/src/scenes/BootScene.ts` -- Background sizing (800x600 -> 1280x720), text positions, sparkle ranges
- `client/src/scenes/LobbyScene.ts` -- Background sizing, all button/text positions, HTML input positioning
- `client/src/scenes/VictoryScene.ts` -- Background sizing, stats table positions, button positions
- `client/src/scenes/HelpScene.ts` -- Background sizing, panel positions, text positions

**Systems:**
- `client/src/systems/Prediction.ts` -- Accept dynamic arena bounds instead of `ARENA` constant
- `client/src/systems/ParticleFactory.ts` -- No changes needed (particles use world coordinates)

**Shared:**
- `shared/physics.ts` -- `ARENA` constant: keep as default but allow override
- `shared/maps.ts` -- Already has per-map width/height -- no changes needed

**Server:**
- `server/src/rooms/GameRoom.ts` -- Use `mapMetadata.width`/`mapMetadata.height` instead of `ARENA.width`/`ARENA.height`

**Assets (new 2x versions):**
- `scripts/generate-assets.py` -- Rewrite for 64x64 character frames, 16x16 projectiles, 16x16 particle, 64x64 tilesets, more animation frames
- `client/src/scenes/BootScene.ts` -- Update `frameWidth`/`frameHeight` to 64, update animation frame ranges
- All 4 map JSON files -- Update `tilewidth`/`tileheight` to 64, `imagewidth`/`imageheight` for 2x tilesets
- `client/src/scenes/GameScene.ts` -- Update sprite loading frame sizes, projectile frame size

### Hardcoded 800x600 Reference Audit
Locations that reference the old canvas size (found via grep):
- `main.ts:11-12` -- width: 800, height: 600
- `designTokens.ts:310` -- Layout.canvas: { width: 800, height: 600 }
- `BootScene.ts:102,105` -- setDisplaySize(800, 600), rectangle(400, 300, 800, 600)
- `LobbyScene.ts:43,211,215` -- rectangle(400, 300, 800, 600), setDisplaySize(800, 600)
- `VictoryScene.ts:23,27,31` -- setDisplaySize(800, 600), rectangle(400, 300, 800, 600)
- `HelpScene.ts:17` -- rectangle(400, 300, 800, 600)
- `HUDScene.ts:232` -- screenWidth = 800

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `renderSession.roundPixels` | `camera.setRoundPixels(true)` + config `roundPixels: true` | Phaser 3.70+ (default true) | Pixel rounding now default; explicit call still recommended for clarity |
| `game.scale.setUserScale(N, N)` | `camera.setZoom(N)` or `Phaser.Scale.ZOOM_2X` | Phaser 3.16+ | Scale Manager rewritten with proper modes; camera zoom preferred for per-scene control |
| Phaser 2 `game.world.setBounds()` | `camera.setBounds()` per camera | Phaser 3.0+ | World bounds don't exist in Phaser 3; bounds are per-camera |

**Deprecated/outdated:**
- Phaser 2 scale manager API is completely different from Phaser 3; ignore any Phaser 2 tutorials.
- `config.zoom` (integer) in game config applies to ALL cameras globally. Use `camera.setZoom()` instead for per-scene control.

## Open Questions

1. **Exact 2x sprite art complexity**
   - What we know: `generate-assets.py` uses PIL to draw procedural pixel art at 32x32. Extending to 64x64 with more detail is straightforward in the same pipeline.
   - What's unclear: How much additional detail to add per character at 64x64 (more shading gradients? more body parts? accessories?). The CONTEXT.md says "richer, not just upscaled" and "additional shading, detail."
   - Recommendation: Plan specifies "more detailed art" -- the PIL script should draw new designs at 64x64 with more color depth, body detail, and distinct visual features per role. Not a naive 2x upscale.

2. **Speed zoom-out sub-pixel risk**
   - What we know: Zoom range 1.85-2.0 with roundPixels=true should be fine for most monitors. Phaser rounds render positions.
   - What's unclear: Whether fractional zoom (e.g., 1.92) causes noticeable shimmer on certain tile patterns.
   - Recommendation: Implement with the smooth range (1.85-2.0). If shimmer is noticed during testing, snap to discrete zoom levels (e.g., 1.875, 1.9375, 2.0 -- multiples of 1/16).

3. **Match-start overview zoom calculation**
   - What we know: Current arenas are 800x608. To show the full arena in a 1280x720 canvas: min(1280/800, 720/608) = min(1.6, 1.184) = 1.184. This is the overview zoom level.
   - What's unclear: Whether 1.184 zoom shows crisp enough tiles, or if it should snap to 1.0 for cleaner rendering.
   - Recommendation: Use 1.0 zoom for the overview (shows 1280x720 area of the arena -- most of it visible with slight clipping). This gives clean integer-ratio rendering.

## Recommended Values (Claude's Discretion)

Based on analysis of movement speeds, viewport sizes, and game feel:

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| Camera lerp X/Y | 0.08 | Smooth but responsive. At 60fps, ~84% of error corrected per second |
| Deadzone width | 40px (logical) | ~6.25% of 640px viewport. Small enough to feel tight |
| Deadzone height | 30px (logical) | ~8.3% of 360px viewport |
| Paran look-ahead | 60px (logical) | ~9.4% of viewport width. Visible but not extreme |
| Guardian look-ahead | 30px (logical) | Half of Paran's -- matches slower movement |
| Look-ahead lerp | 0.04 | Slower than camera lerp for gentle direction reversal ease |
| Speed zoom-out min | 1.85 | ~7.5% more visible area at max speed. Subtle but perceptible |
| Speed zoom-out lerp | 0.03 | Very smooth return to normal zoom |
| Camera shake (wall) | 80ms, 0.003 intensity | Barely perceptible, just enough tactile feedback |
| Camera shake (damage) | 100ms, 0.005 intensity | Slightly stronger for "hit" feedback |
| Overview zoom | 1.0 | Clean integer rendering, shows most of 800x608 arena in 1280x720 |
| Overview duration | 1500ms | As specified in CONTEXT.md |
| Overview-to-play zoom | 800ms, Sine.easeInOut | Smooth natural feel |
| Letterbox bars | Black (#000000) | Clean, unobtrusive. Themed bars would distract |
| Spectator banner | Top-center, semi-transparent dark bg, role-colored text | Consistent with existing spectator bar positioning |
| Spectator deadzone | 60x45px | Wider than normal to reduce motion during spectating |

## Sources

### Primary (HIGH confidence)
- Phaser 3.90 API Documentation (Context7 `/websites/phaser_io_api-documentation`) - Camera, Scale Manager, setBounds, startFollow, setDeadzone, shake, zoom, pan, setRoundPixels
- Phaser 3.90 source code behavior - roundPixels default true since 3.70, ZOOM_2X constant, FIT scale mode
- Project codebase analysis - All files read directly for current state assessment

### Secondary (MEDIUM confidence)
- [Cameras Concepts | Phaser Help](https://docs.phaser.io/phaser/concepts/cameras) - Camera overview and usage patterns
- [Retro Crisp Pixel Art in Phaser](https://www.belenalbeza.com/articles/retro-crisp-pixel-art-in-phaser/) - Pixel art rendering best practices
- [Help with Scaling for Pixel Art - Phaser Forum](https://phaser.discourse.group/t/help-with-scaling-for-pixel-art/4782) - Camera zoom vs Scale Manager zoom for pixel art
- [Camera follow with roundPixels and game zoom - GitHub Issue #4464](https://github.com/phaserjs/phaser/issues/4464) - Known roundPixels + zoom interaction
- [Phaser v3.70.0 Discussion](https://github.com/phaserjs/phaser/discussions/6665) - roundPixels default change

### Tertiary (LOW confidence)
- None. All findings verified through official docs or direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phaser 3.90 APIs verified through Context7 official docs. No new libraries needed.
- Architecture: HIGH - Camera zoom approach verified through multiple sources. All patterns use built-in Phaser APIs.
- Pitfalls: HIGH - Common issues well-documented in Phaser community. Codebase impact fully audited.
- 2x Asset creation: MEDIUM - PIL pipeline approach verified (existing script), but exact art detail level is creative judgment.
- Recommended values: MEDIUM - Based on analysis of movement speeds and viewport ratios. Tuning will be needed during implementation.

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (Phaser 3 API is stable; no breaking changes expected)
