# Phase 6: UX Polish - Research

**Researched:** 2026-02-12
**Domain:** Phaser 3 HUD, Particles, Audio, Pixel Art, Procedural SFX
**Confidence:** HIGH (Phaser 3.90 is well-documented; jsfxr is stable; patterns verified via Context7 + official docs)

## Summary

Phase 6 transforms a fully functional but visually raw multiplayer game into a polished product. The game currently uses placeholder rectangles for players, colored circles for projectiles, a flat color tileset (128x64 PNG with 8 solid-color tiles), and no audio whatsoever. The UI is all plain Phaser Text objects with no visual theming. The game is playable with movement, combat, lobbies, matchmaking, and reconnection all working.

This phase touches every visual and audio surface: replacing placeholder sprites with pixel art, adding a HUD scene overlay for health/cooldowns/timer, particle effects for all feedback events, procedural chiptune SFX via jsfxr, background music, and a controls help screen. A critical server-side addition is the 5-minute match timer with guardian-wins-on-timeout logic. No new gameplay mechanics or networking features are in scope -- this is purely presentation layer.

**Primary recommendation:** Structure work in layers: (1) server match timer first (it changes win conditions), (2) asset creation pipeline (sprites, tilesets, particle textures), (3) HUD scene overlay, (4) visual effects/particles, (5) audio system, (6) lobby/menu art polish, (7) help screen. Use a dedicated HUD Scene launched in parallel with GameScene for all UI elements.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### HUD & Information Display
- Moderate HUD density: health bars, cooldown timers, match timer, kill feed
- Health bars in corner HUD only (no floating bars above characters)
- All 3 player health bars along the bottom of the screen; local player's bar highlighted/larger
- Kill feed style: Claude's discretion
- Match timer at top center
- Connection quality: show actual ping in ms
- Timed matches: 5 minutes, guardians win on time-out (forces aggressive Paran play)
- Low-time warning: visual only (timer turns red/flashes in last 30s, no audio cue)
- Cooldown display: visual timer (circular or bar that fills up)
- Everyone's health visible in HUD (not just your own)
- Nothing above characters (no name tags, no floating health bars) -- identify by color/sprite
- Controls tutorial: separate help screen accessible from lobby menu (not in-game overlay)
- Spectator HUD: Claude's discretion
- Role identity: clear banner at match start ("YOU ARE PARAN" or similar) + subtle HUD reminder

#### Hit Feedback & Juice
- No screen shake on any impacts
- Damage feedback: sprite flash (white/red) + small particle burst at impact point
- No hit markers -- enemy flash and particles are sufficient confirmation
- Death effect: explosion of particles in the player's color
- Projectiles: short fading trail behind projectile
- Paran wall collision: impact particles at the wall (emphasizes the penalty)
- Paran high speed: speed lines / blur around Paran at high velocity
- Match start: big centered countdown ("3... 2... 1... FIGHT!")
- Victory/defeat: big banner with particle effects and color wash
- Projectile wall impacts: small spark/dust particles at impact point
- Low health: flashing health bar (no screen vignette)
- No damage direction indicator -- map awareness is part of the skill

#### Audio Design
- Style: retro chiptune (8-bit/16-bit)
- Match music: energetic chiptune loop during gameplay (constant tempo, no dynamic changes)
- Lobby/menu music: separate chill chiptune track
- SFX coverage: full (combat + movement + UI sounds)
  - Combat: shooting, hit, death per role
  - Movement: Paran wall collision, speed-up whoosh
  - UI: button clicks, countdown beeps, match start/end fanfare, ready chime
- Character-specific sound profiles: Paran, Faran, and Baran each have unique shot/hit/movement sounds
- Audio generation: procedural (jsfxr or similar) -- generate chiptune SFX programmatically
- Volume controls: separate Music and SFX sliders

#### Art Direction
- Pixel scale: 32x32 tiles and sprites
- Aesthetic: heavy solarpunk throughout
- Color palette: warm greens + gold (forest greens, warm yellows, golden sunlight)
- Character differentiation: unique color AND distinct silhouette per role (instantly recognizable at 32x32)
- Projectile art: unique shapes per role (energy blasts for Paran, darts for Faran, bolts for Baran)
- Animation frames: standard 4-6 frames per action (walk, idle, shoot, death)
- Wall tiles: different style per arena map
  - Overgrown ruins, living walls (hedges/trees), tech+nature blend -- each arena gets its own
- Floor tiles: varied within each arena (grass, dirt paths, stone patches -- organic, lived-in)
- Lobby UI: full solarpunk pixel art treatment (background, themed buttons, character portraits)
- Title screen: pixel art "BANGER" logo with solarpunk background

### Claude's Discretion
- Kill feed visual design
- Spectator HUD layout
- Asset creation method (AI-generated + cleanup vs hand-drawn -- pick most practical approach)
- Exact spacing, typography, and HUD element sizing
- Specific particle effect parameters (count, speed, lifetime)
- Music composition approach (tracker software, web audio API, etc.)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser | 3.90.0 | Game framework | Already in use; provides particles, audio, sprites, scenes |
| Vite | 5.x | Build tool | Already in use; handles asset imports, dev server |

### Supporting (new additions)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsfxr | latest | Procedural chiptune SFX generation | Generate all game sound effects from parameter arrays |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsfxr | Pre-recorded WAV files | jsfxr is zero-licensing, tiny bundle, matches chiptune aesthetic perfectly. WAVs add download weight. jsfxr is the right choice here. |
| Phaser built-in particles | Custom WebGL shaders | Phaser particles cover all needed effects (burst, trail, flash). No reason to go lower-level. |
| Separate HUD Scene | In-game UI objects | HUD Scene is cleaner: independent lifecycle, no camera scroll issues, survives spectator mode transitions. Standard Phaser pattern. |

**Installation:**
```bash
cd client && npm install jsfxr
```

Note: jsfxr uses CommonJS (`require("jsfxr").sfxr`). For ESM/Vite projects, it should work via Vite's CJS interop, but verify at implementation time. The alternative approach is to use the sfxr.me web UI to design sounds, export the parameter arrays, and use jsfxr's `synth` function to render them to AudioBuffer/data URL at runtime.

## Current Codebase State (Critical Context for Planner)

### What Exists
- **4 scenes:** BootScene, LobbyScene, GameScene, VictoryScene
- **Players rendered as:** `Phaser.GameObjects.Rectangle` (colored rectangles, 32px paran / 24px guardians)
- **Projectiles rendered as:** `Phaser.GameObjects.Arc` (4px radius circles)
- **Health bars:** `Phaser.GameObjects.Graphics` floating ABOVE player sprites (must be REMOVED per user decision -- HUD only)
- **Name labels:** `Phaser.GameObjects.Text` floating above players (must be REMOVED per user decision -- nothing above characters)
- **Tileset:** Single 128x64 PNG with 8 solid-color tiles (white, orange, gold, dark green, gray, brown, green, silver)
- **4 maps:** test_arena, corridor_chaos, cross_fire, pillars (25x19 tiles, Tiled JSON format)
- **Tile IDs in use:** 1=floor/empty, 2=ground, 3=wall, 4=heavy, 5=medium, 6=light (destructible obstacles)
- **No audio system** whatsoever
- **No HUD scene** -- all UI is inline in GameScene
- **No particle effects** anywhere
- **No match timer** -- matches end only when a team is eliminated
- **No kill event broadcast** -- kills are tracked in PlayerStats but not announced as events
- **No ping measurement** -- no RTT tracking exists
- **Phaser config:** `pixelArt` is NOT set in game config (must add for crisp pixel art rendering)
- **Canvas size:** 800x600, Scale.FIT + CENTER_BOTH
- **Existing assets:** `assets/fonts/engebrechtre/` (8 font variants), `assets/images/` (4 images: city.png, splash-bg.png, victory-guardian-splash.png, victory-paran-splash.png), `assets/soundtrack/Pixel Jitter Jive.mp3`

### Schema Fields Available for HUD
- `player.health` (number), `player.role` (string), `player.name` (string)
- `player.lastFireTime` -- server-only, NOT synced to clients (cooldown display will need client-side tracking based on fire input timestamps)
- `state.matchState` (string: "waiting"/"playing"/"ended")
- `state.matchStartTime` (number, server time when match started)
- `state.serverTime` (number, cumulative server time in ms)
- `state.matchStats` (MapSchema of PlayerStats with kills/deaths/damageDealt/shotsFired/shotsHit)

### Server Changes Needed
1. **Match timer:** Add 5-minute (300s) time limit. Check elapsed time in `fixedTick()`. When `serverTime - matchStartTime >= 300000`, call `endMatch("guardians")`. Broadcast remaining time or let client compute from `matchStartTime` + `serverTime`.
2. **Kill event broadcast:** Add `this.broadcast("kill", { killer, victim, killerRole, victimRole })` when a kill happens (both projectile kills and Paran contact kills). Needed for kill feed.
3. **Ping measurement:** Implement ping-pong message handler. Client sends `ping` with timestamp, server responds with `pong` containing client's timestamp. Client computes RTT = `Date.now() - sentTimestamp`.

## Architecture Patterns

### Recommended Project Structure
```
client/src/
  scenes/
    BootScene.ts         # Asset preloading, pixel art config
    LobbyScene.ts        # Solarpunk-themed lobby UI
    GameScene.ts         # Gameplay, sprites, effects
    HUDScene.ts          # NEW: overlay scene for all HUD elements
    VictoryScene.ts      # End-match overlay
    HelpScene.ts         # NEW: controls help screen
  systems/
    Prediction.ts        # Client prediction (existing)
    Interpolation.ts     # Remote player interpolation (existing)
    AudioManager.ts      # NEW: centralized audio with volume controls
    ParticleFactory.ts   # NEW: reusable particle effect presets
  config/
    SoundDefs.ts         # NEW: jsfxr parameter arrays for all SFX
client/public/
  tilesets/
    solarpunk_ruins.png     # NEW: per-map tileset
    solarpunk_living.png    # NEW: per-map tileset
    solarpunk_tech.png      # NEW: per-map tileset
    solarpunk_mixed.png     # NEW: per-map tileset
  sprites/
    paran.png               # NEW: spritesheet (walk/idle/shoot/death)
    faran.png               # NEW: spritesheet
    baran.png               # NEW: spritesheet
    projectiles.png         # NEW: projectile sprites per role
    particles.png           # NEW: particle texture atlas
  ui/
    hud_elements.png        # NEW: HUD bar backgrounds, icons
    lobby_bg.png            # NEW: solarpunk lobby background
    title_logo.png          # NEW: pixel art "BANGER" logo
```

### Pattern 1: HUD Scene Overlay
**What:** Launch a separate Phaser Scene in parallel with GameScene that handles all UI rendering.
**When to use:** Always for in-game HUD elements (health bars, timer, kill feed, cooldowns, ping).
**Why:** HUD Scene has its own camera (unaffected by game camera panning in future), survives spectator transitions, clean separation of concerns.

```typescript
// In GameScene.create(), after room is connected:
this.scene.launch('HUDScene', {
  room: this.room,
  localSessionId: this.room.sessionId,
  localRole: this.localRole
});

// HUDScene listens to room state directly:
export class HUDScene extends Phaser.Scene {
  create(data: { room: Room; localSessionId: string; localRole: string }) {
    this.room = data.room;
    // Build HUD elements...
    // Listen to room.state changes for health, timer, etc.
  }

  update(time: number, delta: number) {
    // Update timer display, cooldown bars, etc.
  }
}
```

Cross-scene communication for events the GameScene generates (like "local player fired"):
```typescript
// GameScene emits:
this.events.emit('localFired', { fireTime: Date.now(), fireRate: stats.fireRate });

// HUDScene listens via scene reference:
const gameScene = this.scene.get('GameScene');
gameScene.events.on('localFired', (data) => { this.startCooldownAnimation(data); });
```

### Pattern 2: Particle Effect Factory
**What:** Centralized factory that creates one-shot particle bursts for various game events.
**When to use:** Every visual feedback event (hit, death, wall impact, projectile impact).

```typescript
// Source: Phaser 3.90 API (verified via Context7)
export class ParticleFactory {
  private scene: Phaser.Scene;
  private particleTexture: string = 'particles'; // spritesheet with small shapes

  // One-shot burst: hit feedback
  hitBurst(x: number, y: number, tint: number): void {
    const emitter = this.scene.add.particles(x, y, this.particleTexture, {
      speed: { min: 50, max: 150 },
      lifespan: 300,
      quantity: 8,
      scale: { start: 1, end: 0 },
      tint: tint,
      emitting: false,
      gravityY: 100
    });
    emitter.explode(8); // One-shot burst
    // Auto-cleanup after lifespan
    this.scene.time.delayedCall(500, () => emitter.destroy());
  }

  // Death explosion
  deathExplosion(x: number, y: number, playerColor: number): void {
    const emitter = this.scene.add.particles(x, y, this.particleTexture, {
      speed: { min: 80, max: 250 },
      lifespan: 600,
      quantity: 20,
      scale: { start: 1.5, end: 0 },
      tint: playerColor,
      emitting: false,
      gravityY: 200,
      angle: { min: 0, max: 360 }
    });
    emitter.explode(20);
    this.scene.time.delayedCall(800, () => emitter.destroy());
  }
}
```

### Pattern 3: AudioManager with jsfxr
**What:** Centralized audio manager that pre-generates all SFX from jsfxr parameter arrays and manages volume.
**When to use:** All audio playback throughout the game.

```typescript
export class AudioManager {
  private scene: Phaser.Scene;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 0.5;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();

  // Pre-generate SFX from jsfxr definitions at game startup
  async init(scene: Phaser.Scene): Promise<void> {
    // For each sound definition, generate a data URL via jsfxr
    // Then load into Phaser's audio manager
    for (const [key, params] of Object.entries(SOUND_DEFS)) {
      const dataUrl = jsfxr(params); // Returns a WAV data URL
      // Load data URL as audio in Phaser
      scene.sound.add(key);
    }
  }

  playSFX(key: string): void {
    this.scene.sound.play(key, { volume: this.sfxVolume });
  }

  setSFXVolume(v: number): void {
    this.sfxVolume = v;
    localStorage.setItem('sfxVolume', String(v));
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    localStorage.setItem('musicVolume', String(v));
  }
}
```

### Pattern 4: Sprite Flash for Damage Feedback
**What:** Brief tint change on sprite to indicate damage taken.
**When to use:** When any player's health decreases.

```typescript
// Source: Phaser 3 setTint API (verified via Context7)
flashDamage(sprite: Phaser.GameObjects.Sprite, duration: number = 150): void {
  sprite.setTint(0xff0000); // Red flash
  this.scene.time.delayedCall(duration, () => {
    sprite.clearTint();
  });
}

// For white flash (hit confirmation):
flashWhite(sprite: Phaser.GameObjects.Sprite): void {
  sprite.setTintFill(0xffffff); // Solid white
  this.scene.time.delayedCall(100, () => {
    sprite.clearTint();
  });
}
```

### Pattern 5: Cooldown Display (Client-Side Tracking)
**What:** Track fire cooldown on the client side since `lastFireTime` is server-only.
**When to use:** Whenever the local player fires.

```typescript
// In GameScene, when fire input is sent:
private lastLocalFireTime: number = 0;

// When fire input is detected AND sent to server:
if (input.fire && !this.lastFireSent) {
  this.lastLocalFireTime = Date.now();
  this.events.emit('localFired', {
    fireTime: this.lastLocalFireTime,
    cooldownMs: CHARACTERS[this.localRole].fireRate
  });
}

// HUDScene reads this and renders a circular/bar cooldown:
// elapsed = Date.now() - lastFireTime
// progress = Math.min(1, elapsed / cooldownMs)
// Draw arc from 0 to progress * 2*PI for circular display
```

### Pattern 6: Match Timer (Server + Client)
**What:** Server enforces 5-minute time limit; client computes remaining time from synced state.
**When to use:** Every frame in HUDScene update loop.

```typescript
// Server side (GameRoom.ts fixedTick):
const MATCH_DURATION_MS = 5 * 60 * 1000; // 300,000ms
const elapsed = this.state.serverTime - this.state.matchStartTime;
if (elapsed >= MATCH_DURATION_MS) {
  this.endMatch("guardians"); // Guardians win on timeout
}

// Client side (HUDScene.update):
const elapsed = this.room.state.serverTime - this.room.state.matchStartTime;
const remaining = Math.max(0, MATCH_DURATION_MS - elapsed);
const minutes = Math.floor(remaining / 60000);
const seconds = Math.floor((remaining % 60000) / 1000);
this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

// Low-time warning (last 30s):
if (remaining <= 30000) {
  this.timerText.setColor('#ff0000');
  // Flash effect: toggle visibility every 500ms
  if (Math.floor(time / 500) % 2 === 0) {
    this.timerText.setAlpha(1);
  } else {
    this.timerText.setAlpha(0.5);
  }
}
```

### Anti-Patterns to Avoid
- **Inline HUD in GameScene:** Mixing gameplay objects and HUD objects in the same scene makes camera management, depth sorting, and cleanup painful. Use a dedicated HUD Scene.
- **Loading assets on-demand during gameplay:** All sprites, spritesheets, and audio must be preloaded in BootScene. Loading during GameScene causes frame drops.
- **Hardcoding particle parameters:** Use a ParticleFactory with named presets. Tweaking 15 particle configs scattered across GameScene is unmaintainable.
- **Using floating health bars AND HUD bars:** The user explicitly decided NO floating bars. Remove the existing above-character health bars when adding HUD bars.
- **Using Phaser's built-in pixelArt after scene creation:** The `pixelArt: true` config MUST be set in the game config object at startup, not after.
- **Generating jsfxr sounds every frame:** Pre-generate all sounds once during boot, cache as Phaser audio objects.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chiptune SFX | Custom Web Audio API oscillator chains | jsfxr | Mature library with built-in presets, parameter-based sound design, data URL output compatible with Phaser |
| Particle effects | Manual sprite pooling/animation | Phaser ParticleEmitter | Built-in pooling, physics, tint, scale curves, one-shot explode mode |
| Sprite animation | Manual frame switching with timers | Phaser AnimationManager | `this.anims.create()` + `sprite.play()` handles frame sequencing, looping, events |
| Pixel art rendering | Manual nearest-neighbor sampling | `pixelArt: true` in Phaser config | Sets `roundPixels` and texture filtering globally |
| Volume persistence | Custom save/load system | localStorage + Phaser volume API | `this.sound.setVolume()` for global, per-sound `.setVolume()` for individual |
| Timer display | Manual Date arithmetic | Compute from synced `serverTime` - `matchStartTime` | Server time is already synced via Colyseus state; no separate clock sync needed |

**Key insight:** Phaser 3.90 has mature built-in systems for particles, animation, audio, and scene management. The only external dependency needed is jsfxr for procedural SFX generation. Everything else uses existing Phaser APIs.

## Common Pitfalls

### Pitfall 1: Particle Texture Missing
**What goes wrong:** `this.add.particles(x, y, 'particles', config)` fails silently or renders invisible particles because the texture key doesn't exist.
**Why it happens:** Particle emitters require a loaded texture. Unlike rectangles/circles, you cannot create particles from nothing.
**How to avoid:** Create a small (e.g., 8x8 or 16x16) white square particle texture. Tint it at runtime for different colors. Load it in BootScene preload.
**Warning signs:** Particles appear to fire but nothing visible on screen.

### Pitfall 2: HUD Scene Transparency
**What goes wrong:** Launching HUDScene covers the GameScene with a black rectangle.
**Why it happens:** Phaser scenes have a default background color. The HUD Scene needs to be transparent.
**How to avoid:** In HUDScene, set `this.cameras.main.setBackgroundColor('rgba(0,0,0,0)')` or simply don't set any background. The scene's camera must be transparent.
**Warning signs:** Game disappears behind a solid color when HUD launches.

### Pitfall 3: Audio Autoplay Blocked by Browser
**What goes wrong:** Music doesn't play on page load; SFX are silent until first user interaction.
**Why it happens:** All modern browsers require a user gesture (click/tap) before allowing audio playback (Web Audio API policy).
**How to avoid:** Phaser handles this with `this.sound.unlock()` or by starting audio after a click event. The game already requires clicks in the lobby menu, so audio context will be unlocked by the time gameplay starts. However, lobby music needs to start AFTER the first user click in BootScene/LobbyScene.
**Warning signs:** Console warnings about "AudioContext was not allowed to start."

### Pitfall 4: Removing Floating Health Bars Breaks Player Identification
**What goes wrong:** After removing name labels and floating health bars, players cannot tell who is who.
**Why it happens:** Currently, the only visual differentiation is rectangle color (red=paran, green=local guardian, blue=remote guardian). Without labels, and with the new pixel art sprites, role must be instantly readable from sprite silhouette and color alone.
**How to avoid:** Design sprites with very distinct silhouettes at 32x32. The user explicitly wants this. Additionally, the HUD should clearly show which health bar belongs to which role.
**Warning signs:** Playtesters ask "which one am I?"

### Pitfall 5: jsfxr Data URL vs Phaser Audio Loading
**What goes wrong:** jsfxr produces a WAV data URL string, but Phaser's `this.load.audio()` expects a file path or base64 with proper MIME type.
**Why it happens:** Mismatch between jsfxr output format and Phaser's expected input.
**How to avoid:** Use jsfxr to generate sounds at build time or boot time, then load the data URLs into the Web Audio context directly. Alternatively, use `this.sound.decodeAudio(key, audioData)` or create Audio elements from data URLs and add them to Phaser's cache. The cleanest approach: generate WAV data URLs with jsfxr, create `new Audio(dataUrl)` elements, and use `this.sound.addAudioSprite()` or HTML5 audio fallback.
**Warning signs:** Sounds don't play despite jsfxr generating valid data URLs.

### Pitfall 6: Cooldown Display Drift
**What goes wrong:** Client-tracked cooldown timer shows "ready" but server still rejects fire input.
**Why it happens:** Client cooldown starts when fire input is sent, but server cooldown starts when input is processed (network delay later). Minor drift accumulates.
**How to avoid:** Cooldown display is purely visual feedback -- the server remains authoritative. Show cooldown starting from local fire time, which means it will occasionally show "ready" slightly before the server agrees. This is acceptable UX (better than showing "not ready" when it is). Never gate client input on cooldown display.
**Warning signs:** Player sees cooldown finished but click doesn't fire.

### Pitfall 7: Tileset Replacement Breaks Map Data
**What goes wrong:** Replacing the placeholder tileset with new art but not matching tile IDs causes maps to render incorrectly or collision to break.
**Why it happens:** Tiled JSON maps reference tile IDs. The obstacle system uses specific tile IDs (3=wall, 4=heavy, 5=medium, 6=light). New tilesets must preserve these IDs.
**How to avoid:** New tilesets MUST maintain the same tile ID mapping: tiles 1-6 must map to the same semantic meanings. Visual art changes only. The tileset image can have more tiles, but the first 6 must be compatible. Per-map tilesets need separate tileset images referenced in each map's JSON.
**Warning signs:** Walls invisible, obstacles have wrong HP, collisions don't work.

### Pitfall 8: Scene Reset State in HUDScene
**What goes wrong:** Returning to lobby and starting a new match shows stale HUD data from previous match.
**Why it happens:** Phaser `scene.start()` skips the constructor. The project already handles this in GameScene (resetting all member vars in `create()`). HUDScene needs the same treatment.
**How to avoid:** Reset ALL mutable state at the top of HUDScene.create(), same pattern as GameScene.create().
**Warning signs:** Kill feed shows kills from previous match, timer shows wrong time.

## Code Examples

### Pixel Art Game Config
```typescript
// Source: Phaser 3.90 API docs - pixelArt config
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  pixelArt: true, // ADD THIS: enables nearest-neighbor filtering + roundPixels
  scene: [BootScene, LobbyScene, GameScene, HUDScene, VictoryScene, HelpScene],
  // ... rest of config
};
```

### Spritesheet Loading and Animation
```typescript
// Source: Phaser 3.90 API (verified via Context7)
// In BootScene.preload():
this.load.spritesheet('paran', 'sprites/paran.png', {
  frameWidth: 32,
  frameHeight: 32
});

// In BootScene.create() or GameScene.create():
this.anims.create({
  key: 'paran-walk-right',
  frames: this.anims.generateFrameNumbers('paran', { start: 0, end: 3 }),
  frameRate: 8,
  repeat: -1
});
this.anims.create({
  key: 'paran-idle',
  frames: this.anims.generateFrameNumbers('paran', { start: 4, end: 5 }),
  frameRate: 4,
  repeat: -1
});
this.anims.create({
  key: 'paran-death',
  frames: this.anims.generateFrameNumbers('paran', { start: 12, end: 17 }),
  frameRate: 10,
  repeat: 0
});
```

### Replacing Rectangle with Sprite in GameScene
```typescript
// Current code creates rectangles:
// const rect = this.add.rectangle(player.x, player.y, size, size, color);

// Replace with sprites:
const sprite = this.add.sprite(player.x, player.y, player.role); // 'paran', 'faran', 'baran'
sprite.setDepth(10);
sprite.play(`${player.role}-idle`);
this.playerSprites.set(sessionId, sprite);
// Note: playerSprites Map type changes from Map<string, Rectangle> to Map<string, Sprite>
```

### Projectile Trail Effect
```typescript
// Continuous trail behind moving projectile
const trail = this.add.particles(projectile.x, projectile.y, 'particles', {
  speed: 0,
  lifespan: 200,
  scale: { start: 0.5, end: 0 },
  alpha: { start: 0.6, end: 0 },
  tint: projectileColor, // Different per role
  follow: projectileSprite, // Follows the projectile sprite
  frequency: 30, // Emit every 30ms
  emitting: true
});
```

### Ping Measurement
```typescript
// Client side:
private pingInterval: number = 0;
private currentPing: number = 0;

startPingLoop(room: Room): void {
  this.pingInterval = window.setInterval(() => {
    const sent = Date.now();
    room.send('ping', { t: sent });
  }, 2000); // Measure every 2 seconds

  room.onMessage('pong', (data: { t: number }) => {
    this.currentPing = Date.now() - data.t;
  });
}

// Server side (GameRoom.ts):
this.onMessage('ping', (client, data) => {
  client.send('pong', { t: data.t });
});
```

### Kill Feed (Client-Side)
```typescript
// Receive kill event from server broadcast
room.onMessage('kill', (data: { killer: string; victim: string; killerRole: string; victimRole: string }) => {
  this.addKillFeedEntry(data);
});

// Kill feed is a simple scrolling text list in HUDScene
private killFeedEntries: Phaser.GameObjects.Text[] = [];
private readonly MAX_ENTRIES = 4;
private readonly ENTRY_LIFETIME = 5000; // 5 seconds

addKillFeedEntry(data: { killer: string; victim: string; killerRole: string; victimRole: string }): void {
  const text = `${data.killer} eliminated ${data.victim}`;
  const entry = this.add.text(790, 60, text, {
    fontSize: '12px', color: '#ffffff', backgroundColor: '#00000088', padding: { x: 4, y: 2 }
  }).setOrigin(1, 0).setDepth(100);

  this.killFeedEntries.unshift(entry);
  // Reposition all entries
  this.killFeedEntries.forEach((e, i) => e.setY(60 + i * 20));

  // Remove oldest if over limit
  if (this.killFeedEntries.length > this.MAX_ENTRIES) {
    const old = this.killFeedEntries.pop();
    old?.destroy();
  }

  // Auto-remove after lifetime
  this.time.delayedCall(this.ENTRY_LIFETIME, () => {
    const idx = this.killFeedEntries.indexOf(entry);
    if (idx >= 0) { this.killFeedEntries.splice(idx, 1); entry.destroy(); }
    // Reposition remaining
    this.killFeedEntries.forEach((e, i) => e.setY(60 + i * 20));
  });
}
```

## Asset Creation Strategy (Claude's Discretion Recommendation)

### Recommended: AI-Generated + Manual Cleanup

**Rationale:** The project needs 50+ pixel art assets (3 character spritesheets with 4-6 animation states, 4 tilesets, projectile sprites, particle textures, UI elements, lobby background, title logo). Hand-drawing all of these is impractical for a single developer working on a code-focused project. AI-generated pixel art (via PixelLab, Stable Diffusion, or similar) with manual cleanup in Aseprite or Piskel provides the best quality/time tradeoff.

**Workflow:**
1. Use AI pixel art generators (PixelLab at pixellab.ai or similar) to generate initial 32x32 sprites with solarpunk theme
2. Clean up in Piskel (free, web-based) or Aseprite ($20, gold standard for pixel art)
3. Ensure consistent palette across all assets (warm greens: #4a7c3f, #6fa85b; golds: #d4a746, #f0c850; earth tones: #8b6d3c)
4. Export as PNG spritesheets with consistent frame sizes

**For this project specifically:** Given the heavy code focus, the most practical approach is to create pixel art assets using a combination of:
- **Tilesets:** Use PixelLab or find/modify free solarpunk-adjacent assets from itch.io, then customize colors to match the palette
- **Character sprites:** Generate with AI, clean up for consistent silhouettes. Paran should be larger and more angular; Faran more agile/sleek; Baran more sturdy/heavy
- **Particle texture:** Hand-draw a simple 8x8 white square and 8x8 white circle -- tint at runtime
- **UI elements:** Can be simple geometric shapes with the solarpunk color palette applied via Phaser's tint system

### Music Composition Approach (Claude's Discretion Recommendation)

**Recommended:** Use the existing `assets/soundtrack/Pixel Jitter Jive.mp3` as lobby/menu music if it fits the chiptune vibe. For match music, either source a free-to-use chiptune track or generate one using tools like BeepBox (web-based chiptune composer at beepbox.co). The music is the hardest asset to generate procedurally -- jsfxr handles SFX well but is not designed for full music tracks.

**Alternative:** Use Web Audio API to create a simple procedural chiptune loop from code (square wave + triangle wave patterns). This is more complex but avoids external dependencies entirely.

### Kill Feed Design (Claude's Discretion Recommendation)

**Recommended:** Right-aligned, top-right corner. Simple text entries with role-colored names. Format: `[KillerName] > [VictimName]` where `>` is a small icon or arrow. Each entry fades out after 5 seconds. Maximum 4 visible entries. Semi-transparent dark background on each entry for readability over the game. Compact design that doesn't distract from gameplay.

### Spectator HUD (Claude's Discretion Recommendation)

**Recommended:** When spectating, show a bottom bar with "SPECTATING: [PlayerName] ([Role])" and "Press TAB to cycle". Show the spectated player's health bar and cooldown prominently. The existing spectator mode logic in GameScene already handles target cycling and camera following.

## Spritesheet Layout Convention

For consistency across all character spritesheets, use this layout:
```
Row 0 (frames 0-3):   Walk Right (4 frames)
Row 1 (frames 4-7):   Walk Left (4 frames, or mirror right)
Row 2 (frames 8-9):   Idle (2 frames)
Row 3 (frames 10-11): Shoot (2 frames)
Row 4 (frames 12-17): Death (6 frames)
```
Total: 18 frames per character = 6 columns x 3 rows or 18 columns x 1 row (depending on layout preference). At 32x32, a 6x3 sheet = 192x96 pixels.

For 4-direction walking (which this game needs since movement is cardinal for Paran and 8-directional for guardians), consider:
```
Row 0: Walk Down (4 frames)
Row 1: Walk Up (4 frames)
Row 2: Walk Right (4 frames)
Row 3: Walk Left (4 frames, or mirror right)
Row 4: Idle (2 frames)
Row 5: Shoot (2 frames per direction = 8 frames, or single shoot frame + direction from facing)
Row 6: Death (6 frames)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ParticleEmitterManager | Direct ParticleEmitter creation | Phaser 3.60 | `this.add.particles()` now creates emitter directly, no manager wrapper |
| `this.sound.play()` with file paths | Phaser SoundManager handles Web Audio + HTML5 fallback | Phaser 3.0+ | No manual AudioContext management needed |
| Separate sprite + collision body | Sprite with physics body integrated | Phaser 3.0+ | This project uses custom physics (shared/physics.ts), not Phaser Arcade physics for gameplay |

**Deprecated/outdated:**
- `ParticleEmitterManager` was removed in Phaser 3.60. Code examples using `this.add.particles('key').createEmitter()` are outdated. Use `this.add.particles(x, y, 'key', config)` directly.
- Pre-3.60 particle examples will not work. Ensure all particle code uses the v3.60+ API.

## Match Timer: Server-Side Design Decision

The 5-minute timer requires a server-side change. Two approaches:

**Approach A (Recommended): Client computes from synced state**
- Server adds `MATCH_DURATION_MS = 300000` constant
- Server checks `serverTime - matchStartTime >= MATCH_DURATION_MS` in fixedTick
- Client computes remaining time from `room.state.serverTime - room.state.matchStartTime`
- Pro: No new schema fields needed. Server time is already synced.
- Con: Minor drift between client display and server enforcement (negligible at 60Hz sync).

**Approach B: Server syncs remaining time**
- Add `@type("number") matchTimeRemaining: number = 0;` to GameState
- Server sets this each tick
- Client reads directly
- Pro: No client-side computation. Con: Adds bandwidth for every tick.

Approach A is recommended since `serverTime` and `matchStartTime` are already synced.

## Open Questions

1. **Per-map tilesets: how to reference in Tiled JSON?**
   - What we know: Currently all 4 maps reference `../tilesets/placeholder.png`. Each map needs its own tileset image.
   - What's unclear: Whether to embed tileset data in each map JSON or use external tileset files (.tsx).
   - Recommendation: Update each map's JSON to reference its own tileset PNG. Keep tile IDs 1-6 the same across all tilesets. The tileset image changes but the tile data array stays identical.

2. **jsfxr ESM compatibility with Vite**
   - What we know: jsfxr uses CommonJS (`require("jsfxr").sfxr`). Vite has CJS interop.
   - What's unclear: Whether jsfxr's CJS export works cleanly with Vite's ESM build without extra config.
   - Recommendation: Test `import { sfxr } from 'jsfxr'` first. If it fails, use the alternative approach: copy the jsfxr function into a local utility file (it's small, ~300 lines) or use the data URL approach directly.

3. **Asset creation timeline and tooling**
   - What we know: ~50 assets needed (spritesheets, tilesets, UI, particles).
   - What's unclear: Exact tooling the implementer will use (PixelLab, Aseprite, Piskel, etc.).
   - Recommendation: Start with the simplest possible pixel art that meets the aesthetic requirements. Use a consistent color palette. Iterate on quality after core functionality works.

## Sources

### Primary (HIGH confidence)
- Context7 `/websites/phaser_io_api-documentation` - ParticleEmitter API, setTint, SoundManager, AnimationManager, spritesheet loading
- Phaser 3.90 official API docs (via Context7) - Particle emitter configuration, audio volume management, animation creation
- Codebase analysis - All existing scenes, schemas, shared modules, asset structure

### Secondary (MEDIUM confidence)
- [jsfxr GitHub](https://github.com/chr15m/jsfxr) - API usage, preset list, data URL generation
- [jsfxr npm](https://www.npmjs.com/package/jsfxr) - Package installation, basic usage
- [sfxr.me](https://sfxr.me/) - Web UI for designing sound parameter arrays
- [Phaser HUD Scene discussion](https://phaser.discourse.group/t/hud-scene-multiple-scenes/6348) - Scene overlay pattern
- [Phaser pixelArt config](https://phaser.io/examples/v3.85.0/game-config/view/pixel-art-mode) - Pixel art mode setup
- [PixelLab](https://www.pixellab.ai/) - AI pixel art generation for game assets

### Tertiary (LOW confidence)
- AI sprite sheet generation workflows (rapidly evolving tooling, specific recommendations may be outdated by implementation time)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Phaser 3.90 and jsfxr are well-documented, stable, verified via Context7
- Architecture: HIGH - HUD Scene overlay and ParticleFactory patterns are standard Phaser practices verified in docs and community
- Pitfalls: HIGH - Based on actual codebase analysis (e.g., placeholder tileset structure, missing pixelArt config, server-only lastFireTime)
- Asset creation: MEDIUM - AI art tooling is rapidly evolving; specific tools may change
- jsfxr Vite compatibility: MEDIUM - CJS/ESM interop usually works but needs verification

**Research date:** 2026-02-12
**Valid until:** 2026-03-15 (Phaser and jsfxr are stable; 30-day validity)
