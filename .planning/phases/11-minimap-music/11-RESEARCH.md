# Phase 11: Minimap & Music - Research

**Researched:** 2026-02-18
**Domain:** Phaser 3 game overlay rendering (minimap) + HTML5 audio management (music crossfade, WAV SFX)
**Confidence:** HIGH

## Summary

Phase 11 has two independent subsystems: (1) a minimap overlay showing simplified arena layout with player/powerup markers, and (2) a music system with looping tracks, crossfade transitions, and WAV SFX replacements for jsfxr sounds.

The minimap is best implemented using `Phaser.GameObjects.Graphics` on the HUDScene (which already renders as a fixed overlay on top of GameScene). The Graphics object supports `fillRect` and `fillCircle` for drawing simplified wall blocks and player dots. It should use `setScrollFactor(0)` (inherited from HUDScene camera) to stay viewport-fixed. The collision grid (`CollisionGrid` in `shared/collisionGrid.ts`) already provides a 2D tile grid with solid/non-solid info -- iterating it to draw dark gray rectangles is straightforward. Player positions come from the room state already available in HUDScene.

The music system extends the existing `AudioManager` singleton. The current implementation already has `playMusic(src, loop)`, `stopMusic()`, `setMusicVolume()`, and localStorage persistence. What's missing: crossfade support (two simultaneous HTMLAudioElements with opposing volume ramps), the lobby loop pause gap, stage volume dip, and WAV SFX registration for the new sound files. All WAV files exist in `assets/soundeffects/` and music tracks exist in `assets/soundtrack/` -- they need to be copied to `client/public/` for Vite serving.

**Primary recommendation:** Implement minimap as a `Phaser.GameObjects.Graphics` redrawn on the HUDScene update loop (throttled to ~10Hz). Extend AudioManager with `crossfadeTo()` for music transitions and `registerWAV()` bulk registration for all new SFX files. Copy all audio assets to `client/public/` subdirectories.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Minimap layout & content
- Top-right corner of the viewport
- Small size (~150x115px)
- Fairly transparent (~40% opacity), no border (floating overlay)
- Simplified block rendering: dark gray rectangles for walls, transparent ground
- Shows: player colored dots + wall blocks + powerup colored dots
- Destroyed obstacles update in real-time (disappear from minimap when destroyed)
- No camera viewport rectangle indicator
- Player markers: simple colored dots using role colors (green Paran, blue Faran, red Baran)
- No special marker for local player (role color is sufficient)
- Eliminated players: death marker shows briefly (~2s) then fades out
- Powerups: tiny colored dots matching powerup type color (gold/cyan/purple)

#### Minimap interaction
- Toggle on/off with keybind (M or Tab)
- Visible by default when match starts
- Hidden during stage transitions and overview camera, reappears when gameplay starts
- Toggle state persists across stages (remembers if you turned it off)
- Toggle SFX: `select_1.wav` on hide, `select_2.wav` on show

#### Music tracks & selection
- **Lobby:** `assets/soundtrack/lobby/Pixel Jitter Jive.mp3` -- loops with ~1s pause between loops
- **Stage:** Random pick from 3 tracks in `assets/soundtrack/stage/` -- same track plays all stages of a match; simple random (may repeat across matches)
- **Victory:** `assets/soundtrack/gameover/victory.mp3` -- plays once; firework SFX (`fire_1.wav`, `fire_2.wav`, `fire_3.wav` randomized) tied to particle burst spawns
- **Defeat:** `assets/soundeffects/lose_1.wav` first, then `assets/soundtrack/gameover/defeat.mp3` -- both play once
- Default volume: music ~40%, SFX ~70%
- Separate music + SFX volume sliders in lobby scene settings area
- Volume settings persist to localStorage across sessions

#### WAV sound effect replacements (fully replace jsfxr)
- **Player hurt / Paran wall collision:** randomize between `hurt_1.wav`, `hurt_2.wav`, `hurt_3.wav`, `hurt_4.wav`
- **Guardian fires:** randomize between `laser_1.wav`, `laser_4.wav`, `laser_5.wav`
- **Paran fires with weapon powerup:** play `earthquake.wav` + `lightning.wav` simultaneously
- **Player killed:** play `disappear.wav`
- **Menu button navigation:** `select_1.wav` / `select_2.wav`
- All WAV files located in `assets/soundeffects/`

#### Scene transitions
- Lobby -> stage: quick ~1s crossfade (lobby fades out, stage fades in)
- Between stages (best-of-3): music continues but brief volume dip to ~30% during iris wipe and stage intro, returns to full
- Stage -> victory/defeat: quick fade out (~0.5s), small silence gap, then result track
- Victory/defeat -> lobby: crossfade (result track fades out, lobby music fades in with 0.5s delay)
- Lobby music starts after ~0.5s delay on scene create
- Browser autoplay: unlock audio context via existing BootScene title screen click

### Claude's Discretion
- Exact minimap rendering implementation (RenderTexture, Graphics, etc.)
- Minimap update frequency (every frame vs throttled)
- Exact crossfade easing curves
- How to handle the ~1s lobby loop pause (silence gap or delayed restart)
- Volume slider visual design and positioning in lobby
- Firework particle timing/frequency in victory screen

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MMAP-01 | Semi-transparent minimap overlay shows during gameplay | Graphics object on HUDScene, 40% alpha, top-right corner, toggle with M key, hidden during overview/transitions |
| MMAP-02 | Minimap displays player positions with role-colored markers | Room state player iteration in HUD update loop; charColorNum() provides role colors; fillCircle for dots |
| MMAP-03 | Minimap shows only players (not full terrain detail) | Dark gray fillRect for solid tiles from CollisionGrid; no ground detail; powerup colored dots |
| AUD-01 | Lobby plays music from assets/soundtrack/lobby/ on loop | AudioManager.playMusic extended with loop-with-pause pattern; asset copied to client/public/ |
| AUD-02 | A random stage track is selected when a new game starts and plays throughout all stages | GameScene picks random track on matchStart; stores selection; music continues across stages with volume dip |
| AUD-03 | Music crossfades between lobby and game transitions; a different track is picked each new game | AudioManager.crossfadeTo() method with dual HTMLAudioElement; ~1s lobby->stage, ~0.5s stage->result |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser 3 | 3.90 | Game framework -- Graphics object for minimap, scene overlay system | Already in use; Graphics provides fillRect/fillCircle for efficient shape rendering |
| HTMLAudioElement | Web API | Music playback with crossfade | Already used by AudioManager; supports volume, loop, currentTime, pause/play natively |
| jsfxr | (existing) | Legacy SFX generation | Being partially replaced by WAV files; remaining jsfxr sounds (countdown_beep, match_start_fanfare, etc.) kept |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CollisionGrid | shared/ | Wall layout data for minimap rendering | Already built; provides isSolid() and grid dimensions for minimap wall drawing |
| AudioManager | client/systems/ | Centralized audio singleton | Already built; extend with crossfade, WAV bulk registration, lobby loop pause |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Graphics (recommended) | RenderTexture | RenderTexture is heavier -- creates a framebuffer, requires draw/clear cycle. Graphics is simpler for primitive shapes and auto-clears on `.clear()` |
| Graphics (recommended) | Separate Camera minimap | Using a second Phaser Camera zoomed out would show full tilemap detail but contradicts the "simplified block rendering" requirement and would be more complex to overlay |
| HTMLAudioElement crossfade | Phaser Sound Manager | Project already bypasses Phaser's sound system (uses jsfxr + raw HTMLAudioElement). Introducing Phaser.Sound now would require refactoring AudioManager. Not worth it. |

**Installation:** No new npm packages needed. All implementations use existing Phaser 3 APIs and Web Audio/HTMLAudioElement.

## Architecture Patterns

### Recommended Project Structure
```
client/
  src/
    systems/
      AudioManager.ts    # Extended: crossfadeTo(), playMusicWithPause(), registerWAVBulk()
    scenes/
      HUDScene.ts        # Extended: minimap rendering in update(), toggle keybind
      GameScene.ts        # Modified: stage music selection, crossfade triggers at transitions
      LobbyScene.ts       # Modified: lobby music start, volume sliders (existing enhanced)
      VictoryScene.ts     # Modified: victory/defeat music + firework SFX
      BootScene.ts        # Modified: register all WAV sounds, preload audio assets
  public/
    audio/
      lobby/             # Lobby music MP3
      stage/             # Stage music MP3s (3 tracks)
      gameover/          # Victory + defeat MP3s
    soundeffects/        # All WAV SFX files
```

### Pattern 1: Minimap as Graphics on HUD Overlay
**What:** A `Phaser.GameObjects.Graphics` object created in HUDScene, redrawn periodically with wall blocks and player dots. HUDScene already renders as a fixed viewport overlay (camera at scroll 0,0, zoom 1).

**When to use:** When you need a simple, low-overhead overlay that draws primitive shapes without requiring textures or framebuffers.

**Key implementation details:**
- Scale factor: `scaleX = minimapWidth / arenaWidthPx`, `scaleY = minimapHeight / arenaHeightPx`
- Arena dimensions from `mapMetadata` (1600x1216 pixels for all current maps)
- For 150x115px minimap: scaleX = 150/1600 = 0.09375, scaleY = 115/1216 = 0.09457
- Position: top-right corner, e.g. `x = W - 150 - 10`, `y = 10`
- Wall drawing: iterate CollisionGrid rows/cols, for each `isSolid()` tile draw a scaled fillRect
- Player dots: `fillCircle(playerX * scaleX + offsetX, playerY * scaleY + offsetY, dotRadius)`
- Throttle redraws to ~100ms (10Hz) via frame counter to avoid unnecessary GPU work

**Example:**
```typescript
// In HUDScene
private minimapGfx: Phaser.GameObjects.Graphics | null = null;
private minimapVisible: boolean = true;
private minimapToggleKey: Phaser.Input.Keyboard.Key | null = null;
private minimapFrameCounter: number = 0;

// In create():
this.minimapGfx = this.add.graphics();
this.minimapGfx.setDepth(150);
this.minimapToggleKey = this.input.keyboard?.addKey('M') || null;

// In update():
this.minimapFrameCounter++;
if (this.minimapFrameCounter % 6 === 0) { // ~10Hz at 60fps
  this.redrawMinimap();
}

private redrawMinimap(): void {
  if (!this.minimapGfx || !this.minimapVisible) return;
  this.minimapGfx.clear();

  const mmX = this.W - 160; // 10px margin from right
  const mmY = 10;
  const mmW = 150;
  const mmH = 115;
  const scaleX = mmW / arenaWidth;
  const scaleY = mmH / arenaHeight;

  // Semi-transparent background
  this.minimapGfx.fillStyle(0x000000, 0.4);
  this.minimapGfx.fillRect(mmX, mmY, mmW, mmH);

  // Walls: dark gray blocks
  this.minimapGfx.fillStyle(0x444444, 0.8);
  for (let ty = 0; ty < grid.height; ty++) {
    for (let tx = 0; tx < grid.width; tx++) {
      if (grid.isSolid(tx, ty)) {
        this.minimapGfx.fillRect(
          mmX + tx * tileSize * scaleX,
          mmY + ty * tileSize * scaleY,
          Math.ceil(tileSize * scaleX),
          Math.ceil(tileSize * scaleY)
        );
      }
    }
  }

  // Player dots
  this.room.state.players.forEach((player, sessionId) => {
    if (player.health <= 0) return; // Skip dead players (or show death marker)
    const color = charColorNum(player.role);
    this.minimapGfx!.fillStyle(color, 1.0);
    this.minimapGfx!.fillCircle(
      mmX + player.x * scaleX,
      mmY + player.y * scaleY,
      3
    );
  });
}
```

### Pattern 2: HTMLAudioElement Crossfade
**What:** Two HTMLAudioElement instances running simultaneously with opposing volume ramps via `setInterval` or `requestAnimationFrame`. The outgoing track fades volume to 0, the incoming track fades from 0 to target volume.

**When to use:** For smooth music transitions between scenes without jarring silence.

**Key implementation details:**
- AudioManager tracks `currentMusic` (existing) and adds `fadingOutMusic` for the outgoing track
- Crossfade duration parameter (default ~1000ms)
- Linear volume ramp with 50ms step interval (~20 steps for 1s fade)
- On fade complete: pause + nullify the outgoing element
- Lobby loop pause: use `ended` event listener instead of `loop=true`, then `setTimeout(play, 1000)` for the gap

**Example:**
```typescript
crossfadeTo(src: string, loop: boolean = true, fadeDuration: number = 1000): void {
  const newMusic = new Audio(src);
  newMusic.volume = 0;
  newMusic.loop = loop;
  newMusic.play().catch(() => {});

  const oldMusic = this.currentMusic;
  this.currentMusic = newMusic;

  if (!oldMusic) {
    // No existing music -- just fade in
    this.fadeVolume(newMusic, 0, this.musicVolume, fadeDuration);
    return;
  }

  // Simultaneous fade out old + fade in new
  this.fadeVolume(oldMusic, oldMusic.volume, 0, fadeDuration, () => {
    oldMusic.pause();
    oldMusic.currentTime = 0;
  });
  this.fadeVolume(newMusic, 0, this.musicVolume, fadeDuration);
}

private fadeVolume(
  audio: HTMLAudioElement,
  from: number, to: number,
  duration: number,
  onComplete?: () => void
): void {
  const steps = Math.ceil(duration / 50);
  const stepDelta = (to - from) / steps;
  let step = 0;
  audio.volume = from;

  const interval = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, from + stepDelta * step));
    if (step >= steps) {
      clearInterval(interval);
      audio.volume = to;
      onComplete?.();
    }
  }, 50);
}
```

### Pattern 3: WAV SFX Randomization
**What:** For sounds with multiple variants (hurt_1-4, laser_1/4/5, fire_1-3), register all variants and provide a `playRandomSFX(prefix, variants)` method that picks one at random.

**Example:**
```typescript
playRandomWAV(keys: string[]): void {
  const key = keys[Math.floor(Math.random() * keys.length)];
  this.playWAVSFX(key);
}

// Usage: audioManager.playRandomWAV(['hurt_1', 'hurt_2', 'hurt_3', 'hurt_4']);
```

### Pattern 4: Lobby Loop with Pause Gap
**What:** Instead of `loop=true`, use the `ended` event to restart with a delay.

**Example:**
```typescript
playMusicWithPause(src: string, pauseMs: number = 1000): void {
  this.stopMusic();
  const audio = new Audio(src);
  audio.volume = this.musicVolume;
  audio.loop = false;

  const restart = () => {
    if (this.currentMusic !== audio) return; // Stale reference
    setTimeout(() => {
      if (this.currentMusic !== audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }, pauseMs);
  };

  audio.addEventListener('ended', restart);
  audio.play().catch(() => {});
  this.currentMusic = audio;
}
```

### Anti-Patterns to Avoid
- **Drawing minimap every frame at 60fps:** Wasteful -- wall layout rarely changes. Throttle to 10Hz; only player/powerup dots need frequent updates. If performance is a concern, split static wall drawing (on map load) from dynamic dot drawing (throttled).
- **Using RenderTexture for minimap:** Overkill for simple rectangles and circles. Graphics is lighter and auto-batches draw calls.
- **Creating new Audio() on every crossfade without cleanup:** HTMLAudioElements hold system resources. Always pause and null the old element after fade completes.
- **Using Phaser's Sound Manager alongside AudioManager:** The project already has a custom AudioManager pattern. Mixing two audio systems creates confusion and potential resource conflicts.
- **Forgetting to reset minimap state in HUDScene create():** Scene reuse means all member variables must be reset in `create()`. The minimap graphics, visibility flag, and frame counter must be reset.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wall layout for minimap | Custom tile parsing | `CollisionGrid.isSolid(tx, ty)` + `grid.width/height` | Already built and maintained in shared code |
| Role colors | Color lookup table | `charColorNum(role)` from designTokens | Already exists, consistent across codebase |
| Volume persistence | Custom storage | `localStorage` getItem/setItem (already in AudioManager) | Already implemented with `sfxVolume` and `musicVolume` keys |
| Audio context unlock | Manual unlock code | Existing BootScene "Click to Start" handler | Already unlocks audio context via user interaction |

**Key insight:** The minimap needs data already available in HUDScene (room state for players, collision grid for walls). The audio system already has 80% of the needed infrastructure. This phase is primarily about extending existing systems, not building from scratch.

## Common Pitfalls

### Pitfall 1: HUDScene lacks CollisionGrid reference
**What goes wrong:** HUDScene currently has no reference to the CollisionGrid or map dimensions. The minimap needs both to draw walls.
**Why it happens:** HUDScene was designed as a pure UI overlay -- it only receives room, localSessionId, and localRole in its create() data.
**How to avoid:** Pass additional data to HUDScene: either (a) pass the collision grid and map metadata directly in the launch data, or (b) use the Phaser game registry to store the collision grid reference (similar to how AudioManager is shared), or (c) use cross-scene events from GameScene. Option (a) is simplest but requires modifying all HUDScene launch sites. Option (b) is cleanest for decoupling. Option (c) requires event handling.
**Recommendation:** Use `this.registry.set('collisionGrid', grid)` in GameScene after building the grid, and `this.registry.get('collisionGrid')` in HUDScene. Same for mapMetadata. This follows the existing AudioManager registry pattern.
**Warning signs:** Minimap draws no walls, or crashes with null reference on collisionGrid.

### Pitfall 2: Minimap visible during overview camera / stage transitions
**What goes wrong:** User explicitly wants minimap hidden during overview and stage transitions. The HUDScene doesn't currently know about these states.
**Why it happens:** Overview and stage transition state lives in GameScene, not HUDScene.
**How to avoid:** GameScene already emits cross-scene events. Add events like `minimapHide` / `minimapShow` triggered by overview start/end and stage transition start/end. Or read `matchState` from room state directly in HUDScene (it's already accessible via `this.room.state.matchState`).
**Recommendation:** Use `this.room.state.matchState` checks in HUDScene update loop -- hide minimap when state is `stage_end`, `stage_transition`, or when a `overviewActive` flag is set via cross-scene event. The matchState approach is simpler.
**Warning signs:** Minimap appears on top of stage intro overlay or during iris wipe.

### Pitfall 3: Kill feed / ping conflict with minimap position
**What goes wrong:** The minimap is positioned top-right (~150x115px starting at x=1120, y=10). The ping display is at (97%, 3%) = (1242, 22) and kill feed is at (98%, 8%) = (1254, 58). These overlap.
**Why it happens:** The top-right corner is already occupied by HUD elements.
**How to avoid:** Relocate ping display below the minimap (y = 130+), and push kill feed entries below ping. Or put minimap slightly offset to avoid overlap.
**Recommendation:** Place minimap at top-right with 10px margin. Move ping display to just below minimap (y = minimap bottom + 5px = ~130). Kill feed entries start below ping. This keeps the top-right corner organized.
**Warning signs:** Minimap overlaps ping text or kill feed entries.

### Pitfall 4: Audio crossfade volume math with user volume setting
**What goes wrong:** Crossfade target volume must respect the user's music volume setting, not always fade to 1.0.
**Why it happens:** Easy to hardcode fade-to=1.0, forgetting that musicVolume may be 0.4.
**How to avoid:** Always use `this.musicVolume` as the target volume for fade-in, not 1.0.
**Warning signs:** Music volume jumps to 100% during crossfade, then drops back to user setting.

### Pitfall 5: Browser autoplay blocking music on LobbyScene
**What goes wrong:** Lobby music starts with a 0.5s delay on scene create, but if the user navigated from VictoryScene (no fresh click), autoplay may still work fine (already unlocked). However, on first load, audio context is unlocked in BootScene's click handler. If someone navigates directly to LobbyScene via bookmark/refresh, there's no fresh unlock.
**Why it happens:** Audio context unlock is a one-time requirement per page load. The BootScene click handler already does this.
**How to avoid:** The BootScene always runs first (it's the first scene in the scene array). The click-to-start ensures audio context is unlocked before any other scene. This is already handled. Just ensure `play().catch(() => {})` is used everywhere to silently handle any edge cases.
**Warning signs:** Lobby music doesn't play on first visit. Check browser console for autoplay errors.

### Pitfall 6: Stage music continues but needs volume dip during iris wipe
**What goes wrong:** During stage transitions, music should dip to ~30% volume, not stop. Need to restore volume after transition.
**Why it happens:** Current code calls `stopMusic()` on stage end. Need to change to `dipVolume()` / `restoreVolume()`.
**How to avoid:** Add `setMusicVolumeTemporary(factor)` and `restoreMusicVolume()` methods to AudioManager. Factor 0.3 = 30% of the user's set volume.
**Warning signs:** Music stops between stages (should only dip), or dips but never returns to normal.

### Pitfall 7: Destroyed obstacles not updating on minimap
**What goes wrong:** When an obstacle is destroyed (server sends obstacle.destroyed=true), the minimap still shows it as a wall block.
**Why it happens:** The collision grid IS updated in GameScene when obstacles are destroyed (`collisionGrid.clearTile()`). Since the minimap reads from the same collision grid reference (via registry), it will automatically reflect the change on the next redraw. This should work without extra code IF the registry reference is the same object (not a copy).
**How to avoid:** Ensure the registry stores a reference to the CollisionGrid object, not a copy. JavaScript object references mean mutations are shared.
**Warning signs:** Minimap shows walls that have been destroyed in game. Verify with `grid.isSolid(tx, ty)` returning false after destruction.

### Pitfall 8: Asset paths -- source vs served
**What goes wrong:** Audio files exist in `assets/` (source directory, not served) but need to be in `client/public/` (Vite-served). Current examples: `client/public/audio/match_music.mp3` and `client/public/soundeffects/powerup_1.wav`.
**Why it happens:** Vite serves files from `client/public/` at root path. Files in `assets/` are source art assets not directly served.
**How to avoid:** Copy all needed audio files from `assets/soundeffects/` and `assets/soundtrack/` to appropriate `client/public/` subdirectories. Update AudioManager paths accordingly.
**Warning signs:** 404 errors in browser console for audio file paths.

## Code Examples

### Existing AudioManager Extension Points

The current AudioManager (source: `/client/src/systems/AudioManager.ts`) already has:
- `playMusic(src, loop)` -- starts music with HTMLAudioElement
- `stopMusic()` -- pauses and nullifies current music
- `registerWAV(key, src)` -- registers a single WAV file
- `playWAVSFX(key)` -- clones and plays a WAV (supports overlapping)
- `playSFX(key)` -- checks WAV first, falls back to jsfxr
- `setSFXVolume(v)` / `setMusicVolume(v)` -- with localStorage persistence
- Volume defaults: SFX=0.7, Music=0.4 (matches user decisions)

New methods needed:
1. `crossfadeTo(src, loop, duration)` -- fade out current, fade in new
2. `fadeOutMusic(duration, onComplete)` -- fade current to 0 then stop
3. `playMusicWithPause(src, pauseMs)` -- loop with silence gap
4. `dipMusicVolume(factor)` -- temporarily reduce volume
5. `restoreMusicVolume()` -- restore to user-set level
6. `playRandomWAV(keys)` -- play a random variant from array
7. `playMultipleWAV(keys)` -- play multiple WAV files simultaneously

### Existing SFX Hook Points in GameScene

Current jsfxr SFX calls that need WAV replacement (source: `/client/src/scenes/GameScene.ts`):
- Line 887: `playSFX('${localRole}_shoot')` -- guardian fire needs WAV randomization
- Line 904: `playSFX('wall_impact')` -- Paran wall collision needs hurt WAV randomization
- Line 1466: `playSFX('${player.role}_death')` -- player killed needs `disappear.wav`
- Line 1478: `playSFX('${player.role}_hit')` -- player hurt needs hurt WAV randomization
- Line 1204: `playSFX('${ownerPlayer.role}_shoot')` -- remote player shoot (use same WAV mapping)

### Cross-Scene Data Sharing via Registry

Existing pattern (source: `/client/src/scenes/BootScene.ts` line 60):
```typescript
// BootScene: store AudioManager in registry
this.registry.set('audioManager', audioManager);

// GameScene/LobbyScene: retrieve from registry
this.audioManager = (this.registry.get('audioManager') as AudioManager) || null;
```

Same pattern for collision grid and map metadata:
```typescript
// GameScene: after building collision grid
this.registry.set('collisionGrid', this.collisionGrid);
this.registry.set('mapMetadata', this.mapMetadata);

// HUDScene: retrieve for minimap
const grid = this.registry.get('collisionGrid') as CollisionGrid | null;
const meta = this.registry.get('mapMetadata') as MapMetadata | null;
```

### HUDScene Layout Positions (Current)

Source: `/client/src/scenes/HUDScene.ts` and `/client/src/ui/designTokens.ts`:
- Role reminder: (15, 15) -- top-left
- Timer: (640, 25) -- top-center
- Ping: (97%, 3%) = (1242, 22) -- top-right
- Kill feed: (98%, 8%) = (1254, 58) -- below ping, right-aligned
- Round score: below timer
- Health bars: (bottom, 95% height)
- Cooldown bar: (center, 89% height)

**Minimap placement:** top-right, 150x115px at approximately (1120, 10). Requires relocating ping to ~(1242, 135) and kill feed to ~(1254, 155).

### Audio Asset Inventory

**Music tracks (MP3) -- in `assets/soundtrack/`:**
- Lobby: `lobby/Pixel Jitter Jive.mp3`
- Stage 1: `stage/Forest Deco Run.mp3`
- Stage 2: `stage/Art Deco Forest Arena.mp3`
- Stage 3: `stage/Per Ropar Glas (Remastered v2).mp3`
- Victory: `gameover/victory.mp3`
- Defeat: `gameover/defeat.mp3`

**WAV SFX -- in `assets/soundeffects/`:**
- Hurt variants: `hurt_1.wav`, `hurt_2.wav`, `hurt_3.wav`, `hurt_4.wav`
- Guardian fire: `laser_1.wav`, `laser_4.wav`, `laser_5.wav`
- Paran power shot: `earthquake.wav`, `lightning.wav`
- Player killed: `disappear.wav`
- Menu select: `select_1.wav`, `select_2.wav`
- Defeat sting: `lose_1.wav`
- Firework: `fire_1.wav`, `fire_2.wav`, `fire_3.wav`
- Already registered: `powerup_1.wav` (as `powerup_pickup`)

**Copy destinations (`client/public/`):**
- `client/public/audio/lobby/` -- lobby MP3
- `client/public/audio/stage/` -- 3 stage MP3s
- `client/public/audio/gameover/` -- victory + defeat MP3s
- `client/public/soundeffects/` -- all WAV files (expand existing directory)

### Map Dimensions for Minimap Scaling

Source: `/shared/maps.ts`:
- All 3 maps: 1600x1216 pixels (50x38 tiles at 32px)
- Tile size: 32px
- Grid dimensions: 50 columns x 38 rows

For 150x115px minimap:
- Each tile renders as: ~3.0px wide x ~3.03px tall
- Player dot radius: 3px (visible but not dominant)
- Powerup dot radius: 2px

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| jsfxr-only SFX | WAV files for key sounds | This phase | Better audio quality, artist-crafted sounds replace procedural generation |
| No music | Lobby + stage + result music | This phase | Atmospheric enhancement; first real music in the game |
| No minimap | Graphics-based minimap overlay | This phase | Global arena awareness; critical for 1600x1216 arenas at 2x zoom |
| Phaser Sound Manager | Custom AudioManager (HTMLAudioElement) | Phase 6 | Project committed to custom audio path; extending, not replacing |

**Deprecated/outdated:**
- `audio/match_music.mp3`: Currently referenced in GameScene lines 312, 1627 but is a placeholder. Will be replaced by randomly selected stage tracks.

## Open Questions

1. **Tab key conflict with minimap toggle**
   - What we know: The decision says "M or Tab" for minimap toggle. Tab key is currently used for spectator target switching (`this.tabKey` in GameScene).
   - What's unclear: Should Tab be repurposed for minimap (breaking spectator switch), or should M be the sole toggle key?
   - Recommendation: Use M as the sole minimap toggle key. Tab is already bound in GameScene for spectator switching. Repurposing it would require a new spectator switch keybind.

2. **Powerup color mapping for minimap dots**
   - What we know: User says "gold/cyan/purple" for powerup dot colors.
   - What's unclear: Exact hex values for these colors.
   - Recommendation: Speed=0x50C8C8 (cyan, matches existing aqua accent), Invincibility=0xFFCC00 (gold, matches paran color), Projectile=0xCC44CC (purple). These are visible against the dark minimap background.

3. **Death marker appearance on minimap**
   - What we know: "Death marker shows briefly (~2s) then fades out."
   - What's unclear: What shape/color for death markers.
   - Recommendation: Red X or flash of red at death position, fading alpha over 2s. Use a small red circle that shrinks or fades.

4. **Minimap toggle keybind -- where is it registered?**
   - What we know: HUDScene handles the minimap. GameScene handles game input.
   - What's unclear: Should the M key be registered in HUDScene or GameScene?
   - Recommendation: Register in HUDScene since the minimap is a HUD element. HUDScene's keyboard input works independently of GameScene. Use `this.input.keyboard?.addKey('M')` in HUDScene create().

## Sources

### Primary (HIGH confidence)
- Phaser 3.90 API docs via Context7 (`/websites/phaser_io_api-documentation`) -- RenderTexture, Graphics, fillRect, fillCircle, scene overlay patterns
- Codebase inspection: AudioManager.ts, GameScene.ts, HUDScene.ts, BootScene.ts, LobbyScene.ts, VictoryScene.ts, StageIntroScene.ts, collisionGrid.ts, maps.ts, obstacles.ts, powerups.ts, SoundDefs.ts, designTokens.ts
- Asset inventory: verified all WAV and MP3 file paths via glob search

### Secondary (MEDIUM confidence)
- HTMLAudioElement crossfade pattern -- standard Web API usage; well-documented behavior for volume ramping with setInterval

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official Phaser docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries; extending existing Phaser 3 + AudioManager patterns already proven in codebase
- Architecture: HIGH -- Minimap on HUDScene and AudioManager extension follow established codebase patterns (registry sharing, overlay scenes, HTMLAudioElement)
- Pitfalls: HIGH -- Identified from direct codebase analysis (HUD layout conflicts, asset paths, collision grid sharing, stage transition states)

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable -- no framework upgrades planned)
