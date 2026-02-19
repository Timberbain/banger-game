# Phase 12: HUD Icon Overhaul - Research

**Researched:** 2026-02-19
**Domain:** Phaser 3 HUD rendering, icon-based UI, sprite integration, Graphics API (arc/slice for radial timers)
**Confidence:** HIGH

## Summary

Phase 12 replaces text-only HUD elements with icon-based displays using the provided 32x32 pixel art sprites. The existing HUDScene (1233 lines) and GameScene (2400+ lines) provide a well-structured foundation with clear sections for health bars, timer, kill feed, cooldown, buff indicators, and round score. All required icon assets exist in `/assets/icons/` as 32x32 PNGs and need to be copied to `client/public/icons/` and preloaded in BootScene.

The work splits into six distinct areas: (1) heart-based health display replacing rectangle bars, (2) hourglass icon + timer text layout with round score pips, (3) skull icon in kill feed + gravestone on arena floor + death overlay, (4) potion icons with radial timer sweep replacing linear buff bars, (5) low-health sprite tint pulse on remote players, and (6) final positioning/layout pass. Phaser's Graphics `slice()` API provides the radial timer sweep, and `setDisplaySize` + `setTint` handle icon scaling and coloring. The `pixelArt: true` + `roundPixels: true` game config ensures crisp rendering at any scale.

**Primary recommendation:** Implement changes incrementally per HUD section (health, timer, kill feed, powerups, death, layout) since each is self-contained within existing method groups. Copy all needed icons to public/ and preload in BootScene first, then modify each HUDScene section independently.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Health Display
- Heart row replaces the current health bar in the local player's HUD (bottom of screen)
- All characters (including Paran with 1 HP) show their health as heart icons
- Standard red hearts from the icon sprite -- no character-color tinting on local HUD
- Heart-full (icon001) for remaining HP, heart-empty (icon002) for lost HP
- Icons at 2x scale (32x32)
- Flash + shrink animation when a heart transitions from full to empty on damage
- Floating health bars above other players' sprites removed entirely -- no per-player overhead health
- Low-health indicator for other players: sprite tint pulse (red flash) when below 50% HP
- HUD only shows the local player's health -- no teammate health rows

#### Kill Feed & Death
- Kill feed format: "PlayerA [skull] PlayerB" -- skull icon between killer and victim names
- Player names in kill feed tinted with their character color (killer color + victim color)
- Gravestone icon placed on the arena floor at the exact death location
- Arena gravestones persist for the entire stage (not faded)
- Arena gravestones tinted with the dead player's character color
- No gravestone markers on the minimap -- arena floor only
- Death screen: centered overlay with large gravestone icon + "Eliminated" text, fades after a few seconds before spectator mode

#### Powerup Indicators
- Active buffs shown as potion icons with radial timer sweep (circular countdown overlay)
- Positioned next to the heart row at the bottom of the HUD (health + buffs grouped)
- Color mapping: Red potion = Speed, Blue potion = Invincibility, Green potion = Larger Projectiles
- Potion icons also replace arena floor pickups (same visual language as HUD)
- Buff expiry: icon flashes a few times ~2s before expiring, then fades out
- Minimap powerup markers unchanged (keep current style)

#### Timer & Round Score
- Timer layout: hourglass icon on the left, countdown number to the right, top-center of screen
- Low time warning: timer icon and number turn red and pulse when below 30 seconds
- Round score displayed as dots/pips below the timer
- Paran wins shown as filled dots in Paran's character color; Guardian wins in Guardian's color; empty dots gray
- Cooldown bar keeps current horizontal bar style -- no icon replacement
- Volume icons unused this phase (lobby/settings controls stay as-is)

### Claude's Discretion
- Arena floor potion icon scale (2x or 3x) -- pick based on visibility during fast gameplay
- Exact positioning offsets for the heart row + powerup indicator group at bottom of HUD
- Death screen overlay timing (how long before fading to spectator)
- Radial timer sweep direction and visual style (clockwise drain, etc.)
- Exact red pulse parameters for low-health sprite tinting and low-time timer

### Deferred Ideas (OUT OF SCOPE)
- Volume icons (4-level speaker sprites) for lobby/settings controls -- future polish phase
- Food icons (corn, cheese, drumstick, steak, banana, burger) -- no current use, save for future
- Teammate health display in HUD -- could revisit if playtesting shows need
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| HUD-01 | Health display uses heart icon assets | Heart icons (icon001/icon002) are 32x32 PNGs ready for preload. Current health bar uses rectangle fill + charColor. Replace with Phaser Image row using `setDisplaySize(32, 32)`. Max HP values: Paran=150 (needs multiple hearts or 1HP-per-heart mapping), Faran/Baran=50. Decision: all characters show hearts. Paran has 150HP so either each heart = some HP value, or hearts map to discrete HP ticks. |
| HUD-02 | Timer uses timer icon asset | Hourglass icon (icon005) is 32x32. Current timer is plain text at top-center. Replace with icon + text layout. Low-time pulse already exists (flashing at 30s). |
| HUD-03 | Kill feed uses skull/gravestone icon assets | Skull (icon006) and gravestone (icon398) are 32x32. Kill feed currently uses text-only format `"killer > victim"`. Replace `>` with skull icon sprite inline. Add gravestone sprites to GameScene arena on death events. Add death overlay to HUDScene. |
| HUD-04 | Round counter shows current stage progress (e.g., 1-0) | Current implementation uses text "0 - 0" with gold color. Replace with colored dot/pip system: filled=won, empty=remaining. Best-of-3 = 2 dots per side. |
| HUD-05 | Powerup indicators show active buff type and duration | Current: linear shrinking bar + small potion icon above it. Replace with larger potion icon centered with radial timer sweep overlay using Phaser Graphics `slice()`. New color mapping: Red=Speed, Blue=Invincibility, Green=Projectile (changes from current Blue=Speed, Orange=Invincibility, Red=Projectile). |
| HUD-06 | All UI elements properly positioned for 1280x720 viewport | Current layout uses percentage-based positioning. With hearts replacing bars and icons replacing text, all elements need repositioned. Bottom group: hearts + buff icons. Top-center: timer icon + text + round pips. Top-right: minimap + ping + kill feed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Phaser 3 | 3.90 | Game framework -- sprites, graphics, tweens, scene management | Already in use, provides all needed APIs (Image, Graphics.slice, tweens) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Phaser.GameObjects.Image | 3.90 | Static icon rendering at 2x | Heart icons, skull in kill feed, gravestone, timer icon |
| Phaser.GameObjects.Graphics | 3.90 | Radial timer sweep (arc/slice) | Powerup countdown overlay, round score pips |
| Phaser.Tweens | 3.90 | Animations (flash, shrink, pulse, fade) | Heart damage, death screen, low-health tint, buff expiry |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Graphics.slice() for radial timer | Shader-based approach | Graphics.slice is simpler, batched in WebGL, sufficient for 1-3 indicators |
| Individual Image objects for hearts | RenderTexture/Canvas | Images are simpler, allow individual tween targets, max 15 hearts (150HP / 10HP each) is manageable |

**Installation:** No new dependencies required. All functionality is built into Phaser 3.90.

## Architecture Patterns

### Recommended Changes to HUDScene Structure

The existing HUDScene has clearly separated sections (numbered 1-11). The icon overhaul modifies sections 1, 2, 3, 9, 10 and adds new death overlay functionality.

```
HUDScene modifications:
  Section 1 (HEALTH BARS)     -> Heart icon row (local player only)
  Section 2 (MATCH TIMER)     -> Hourglass icon + text layout
  Section 3 (KILL FEED)       -> Skull icon between names, death overlay on localDied
  Section 9 (ROUND SCORE)     -> Dot/pip system with character colors
  Section 10 (BUFF INDICATORS) -> Radial timer sweep potion icons
  NEW: Death screen overlay    -> Gravestone icon + "Eliminated" text, fades to spectator
```

GameScene modifications:
```
  createPlayerSprite()     -> No overhead health bars (already none; no changes needed)
  handlePlayerChange()     -> Add low-health tint pulse for remote players at <50% HP
  Kill message handler     -> Spawn gravestone sprite at death location
  cleanupStageVisuals()    -> Clean up gravestone sprites
```

### Pattern 1: Heart Row Rendering
**What:** Replace rectangle-based health bar with a row of Image objects (heart-full / heart-empty)
**When to use:** Local player health display only
**Example:**
```typescript
// In createHealthBars() - local player only
private heartIcons: Phaser.GameObjects.Image[] = [];

// Create hearts based on maxHealth / hpPerHeart
const hpPerHeart = 10; // 10 HP per heart: Paran=15 hearts, Faran/Baran=5 hearts
const heartCount = Math.ceil(maxHealth / hpPerHeart);
for (let i = 0; i < heartCount; i++) {
  const icon = this.add.image(startX + i * 34, y, 'icon_heart_full');
  icon.setDisplaySize(32, 32); // 2x scale (icons are already 32x32 native)
  icon.setDepth(200);
  this.heartIcons.push(icon);
}

// In updateHealthBars() - swap textures based on current HP
const fullHearts = Math.ceil(currentHealth / hpPerHeart);
for (let i = 0; i < this.heartIcons.length; i++) {
  const shouldBeFull = i < fullHearts;
  const key = shouldBeFull ? 'icon_heart_full' : 'icon_heart_empty';
  if (this.heartIcons[i].texture.key !== key) {
    // Flash + shrink animation on transition from full to empty
    if (!shouldBeFull && this.heartIcons[i].texture.key === 'icon_heart_full') {
      this.tweens.add({
        targets: this.heartIcons[i],
        scaleX: 0.5, scaleY: 0.5,
        duration: 150,
        yoyo: true,
        onStart: () => this.heartIcons[i].setTexture(key),
      });
    } else {
      this.heartIcons[i].setTexture(key);
    }
  }
}
```

### Pattern 2: Radial Timer Sweep with Graphics.slice()
**What:** Draw a circular countdown overlay on top of potion icons using Graphics `slice()`
**When to use:** Powerup buff duration indicator
**Example:**
```typescript
// Source: Phaser 3.90 Graphics API
// Graphics.slice creates a pie-chart slice (filled arc segment)

// Create a Graphics object for each buff indicator
const gfx = this.add.graphics();
gfx.setDepth(102); // Above the potion icon

// Update every frame: draw remaining time as a slice
const fraction = remaining / duration; // 1.0 = full, 0.0 = empty
const endAngle = Phaser.Math.DegToRad(-90 + 360 * fraction);
const startAngle = Phaser.Math.DegToRad(-90); // Start from top (12 o'clock)

gfx.clear();
gfx.fillStyle(0x000000, 0.5); // Semi-transparent black overlay
gfx.slice(iconX, iconY, iconRadius, startAngle, endAngle, true); // anticlockwise = drain effect
gfx.fillPath();
```

### Pattern 3: Low-Health Sprite Tint Pulse
**What:** Red tint flash on remote player sprites when health < 50% max
**When to use:** Remote player health indication (replaces overhead health bars)
**Example:**
```typescript
// In GameScene.handlePlayerChange() or update loop
const healthPct = player.health / maxHealth;
if (healthPct < 0.5 && healthPct > 0) {
  // Pulse: alternate between red tint and clear
  // Use a tween for smooth pulsing
  if (!this.lowHealthPulseTweens.has(sessionId)) {
    const tween = this.tweens.add({
      targets: sprite,
      alpha: { from: 1, to: 0.6 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      onYoyo: () => sprite.setTint(0xff0000),
      onRepeat: () => sprite.clearTint(),
    });
    this.lowHealthPulseTweens.set(sessionId, tween);
  }
} else {
  // Clear pulse
  const tween = this.lowHealthPulseTweens.get(sessionId);
  if (tween) { tween.destroy(); sprite.clearTint(); sprite.setAlpha(1); }
  this.lowHealthPulseTweens.delete(sessionId);
}
```

### Pattern 4: Inline Icon in Kill Feed
**What:** Embed skull icon sprite between killer and victim text in kill feed entries
**When to use:** Kill feed rendering
**Example:**
```typescript
// Kill feed entry: [KillerName] [skull_icon] [VictimName]
const killerText = this.add.text(x, y, data.killer, {
  fontSize: '12px', color: charColor(data.killerRole), fontFamily: 'monospace',
  fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
});
killerText.setOrigin(1, 0.5);

const skullIcon = this.add.image(x + 2, y, 'icon_skull');
skullIcon.setDisplaySize(16, 16); // Smaller scale for kill feed

const victimText = this.add.text(x + 20, y, data.victim, {
  fontSize: '12px', color: charColor(data.victimRole), fontFamily: 'monospace',
  fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
});
```

### Anti-Patterns to Avoid
- **Do NOT use Container for kill feed entries:** Containers don't batch well in Phaser's WebGL renderer and complicate positioning. Use individual game objects with manual coordinate management (the existing pattern).
- **Do NOT destroy/recreate heart icons every frame:** Create them once in `createHealthBars()`, update textures in `updateHealthBars()`. Only recreate on player count change or stage transition.
- **Do NOT use RenderTexture for radial sweep:** Graphics.slice() redraws every frame cleanly and is the standard approach. RenderTexture would add unnecessary complexity.
- **Do NOT modify the cooldown bar:** The decision explicitly states the cooldown bar keeps its current horizontal bar style.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radial countdown overlay | Custom canvas-based pie chart | `Phaser.GameObjects.Graphics.slice()` | Built-in, WebGL-batched, handles anti-clockwise correctly |
| Icon scaling | Manual pixel manipulation | `Image.setDisplaySize(w, h)` with `pixelArt: true` config | Phaser handles nearest-neighbor filtering automatically |
| Tween-based flash animations | Manual timer + alpha toggling | `this.tweens.add()` with yoyo + repeat | Phaser tweens handle timing, easing, cleanup automatically |
| Inline icon in text | Custom bitmap font with embedded glyphs | Separate Text + Image objects positioned adjacently | Simpler, no font generation needed, icon can be individually animated |

**Key insight:** Every visual effect in this phase (flash, shrink, pulse, fade, radial sweep) can be done with existing Phaser APIs. No external libraries, shaders, or custom rendering needed.

## Common Pitfalls

### Pitfall 1: Icon Assets Not Found at Runtime
**What goes wrong:** Icons are in `assets/icons/` but not copied to `client/public/icons/` where Vite serves them. Or they're copied but not preloaded in BootScene.
**Why it happens:** The asset pipeline uses two separate directories -- `assets/` (source) and `client/public/` (served). Potion icons were manually copied before; new icons need the same treatment.
**How to avoid:** Copy all needed icons to `client/public/icons/` AND add `this.load.image()` calls in BootScene for each new icon texture key.
**Warning signs:** Black/missing sprites, console errors about missing textures.

### Pitfall 2: Heart Count Calculation for Different Characters
**What goes wrong:** Paran has 150 HP, Faran/Baran have 50 HP. If you use 1 heart = 1 HP, Paran needs 150 hearts (absurd). If you use a per-character mapping, the heart count varies wildly.
**Why it happens:** The decision says "All characters show their health as heart icons" without specifying HP-per-heart.
**How to avoid:** Use a consistent HP-per-heart value. At 10 HP per heart: Paran=15 hearts, Faran/Baran=5 hearts. 15 hearts at 32x32 with 2px spacing = 15*34 = 510px, fits within 1280px viewport with room to spare. This is the recommended approach.
**Warning signs:** Hearts overflowing screen width, or too few hearts to be meaningful.

### Pitfall 3: Potion Color Mapping Change Breaks Arena Floor Pickups
**What goes wrong:** The context decisions change potion color mapping (Red=Speed, Blue=Invincibility, Green=Projectile) from the current code (Blue=Speed, Orange=Invincibility, Red=Projectile). If only HUD is updated but arena floor pickup textures aren't changed, there's a visual inconsistency.
**Why it happens:** The decision explicitly says "Potion icons also replace arena floor pickups (same visual language as HUD)."
**How to avoid:** Update BOTH the HUD buff indicator textures AND the GameScene POWERUP_TEXTURE map AND the BootScene preload texture keys simultaneously. Also copy green potion (icon278) to public/icons.
**Warning signs:** HUD shows red potion for speed but arena floor shows blue potion for speed.

### Pitfall 4: Kill Feed Entry Sizing with Inline Icons
**What goes wrong:** Adding an icon sprite between two text objects changes the total width of kill feed entries. Background rectangles are sized to text width, so they need recalculation.
**Why it happens:** Current kill feed uses single Text object per entry. New format needs: killer text + skull icon + victim text, each with different colors.
**How to avoid:** Calculate total width as `killerText.width + iconWidth + gap + victimText.width`. Size the background rectangle to this total.
**Warning signs:** Kill feed background too narrow, icon overlapping text, entries misaligned.

### Pitfall 5: Graphics Object Leak in Radial Timer
**What goes wrong:** Creating a new Graphics object every frame instead of clearing and redrawing the existing one. Memory leak and performance degradation.
**Why it happens:** Graphics.clear() must be called before redrawing. If a new object is created instead, old ones accumulate.
**How to avoid:** Create ONE Graphics object per buff indicator, stored in the indicator data structure. Call `gfx.clear()` + `gfx.slice()` + `gfx.fillPath()` each frame in `updateBuffIndicators()`.
**Warning signs:** Increasing draw calls, memory usage climbing during buff duration.

### Pitfall 6: Stage Transition Cleanup for Arena Gravestones
**What goes wrong:** Gravestone sprites placed on the arena floor persist across stage transitions, appearing on the wrong map.
**Why it happens:** `cleanupStageVisuals()` in GameScene doesn't know about the new gravestone sprites.
**How to avoid:** Add a `gravestoneSprites` map to GameScene, clean it up in `cleanupStageVisuals()`.
**Warning signs:** Gravestones from previous stage visible on new stage's arena.

### Pitfall 7: Scene Reuse Member Variable Reset
**What goes wrong:** New member variables (heartIcons, gravestoneSprites, deathOverlay, etc.) added for this phase aren't reset in the `create()` method.
**Why it happens:** Phaser scene reuse via `scene.start()` skips the constructor. All member variables must be reset in `create()`.
**How to avoid:** For every new member variable added, add a corresponding reset line at the top of `create()`.
**Warning signs:** Stale state from previous match showing in new match.

## Code Examples

### Asset Preloading in BootScene
```typescript
// In BootScene.preload() -- add after existing icon loads
// Heart icons
this.load.image('icon_heart_full', 'icons/heart-full.png');
this.load.image('icon_heart_empty', 'icons/heart-empty.png');
// Timer/hourglass icon
this.load.image('icon_timer', 'icons/timer.png');
// Kill feed skull icon
this.load.image('icon_skull', 'icons/skull.png');
// Gravestone icon
this.load.image('icon_gravestone', 'icons/gravestone.png');
// Green potion (new -- for Projectile powerup)
this.load.image('potion_green', 'icons/potion-green.png');
```

### Round Score Pips (Replacing Text)
```typescript
// Best-of-3: need 2 pips per side (first to 2 wins)
// Layout: [P1] [P2] [--] [G1] [G2]  where P=paran, G=guardian
const pipRadius = 6;
const pipSpacing = 18;
const pipY = timerY + 30;
const totalPips = 4; // 2 paran + 2 guardian

// Draw pips using Graphics
const gfx = this.add.graphics();
gfx.setDepth(200);

for (let i = 0; i < 2; i++) {
  const x = centerX - pipSpacing * 1.5 + i * pipSpacing;
  const isFilled = i < paranWins;
  if (isFilled) {
    gfx.fillStyle(Colors.char.paranNum, 1);
  } else {
    gfx.fillStyle(0x444444, 0.6);
  }
  gfx.fillCircle(x, pipY, pipRadius);
}
// Separator
gfx.fillStyle(0xffffff, 0.3);
gfx.fillRect(centerX - 1, pipY - 4, 2, 8);
// Guardian pips
for (let i = 0; i < 2; i++) {
  const x = centerX + pipSpacing * 0.5 + i * pipSpacing;
  const isFilled = i < guardianWins;
  if (isFilled) {
    gfx.fillStyle(Colors.char.faranNum, 1); // Guardian color
  } else {
    gfx.fillStyle(0x444444, 0.6);
  }
  gfx.fillCircle(x, pipY, pipRadius);
}
```

### Arena Floor Gravestone Sprite
```typescript
// In GameScene kill message handler
this.room.onMessage('kill', (data) => {
  // Find victim position from state
  this.room.state.players.forEach((player: any) => {
    if (player.name === data.victim) {
      const gravestone = this.add.image(player.x, player.y, 'icon_gravestone');
      gravestone.setDisplaySize(32, 32);
      gravestone.setDepth(5); // Below players (10) but above ground (0)
      gravestone.setTint(charColorNum(data.victimRole));
      this.gravestoneSprites.push(gravestone);
    }
  });
});
```

### Death Screen Overlay in HUDScene
```typescript
// In HUDScene localDied event handler
private showDeathOverlay(): void {
  // Large gravestone icon + "Eliminated" text, centered
  const gravestone = this.add.image(this.W / 2, this.H / 2 - 30, 'icon_gravestone');
  gravestone.setDisplaySize(64, 64); // 4x for emphasis
  gravestone.setDepth(300);
  gravestone.setAlpha(0);

  const text = this.add.text(this.W / 2, this.H / 2 + 30, 'ELIMINATED', {
    ...TextStyle.splash, fontSize: '36px', color: Colors.status.danger,
  });
  text.setOrigin(0.5);
  text.setDepth(300);
  text.setAlpha(0);

  // Fade in
  this.tweens.add({ targets: [gravestone, text], alpha: 1, duration: 500 });
  // Fade out after ~3 seconds
  this.tweens.add({
    targets: [gravestone, text],
    alpha: 0, duration: 800, delay: 3000,
    onComplete: () => { gravestone.destroy(); text.destroy(); },
  });
}
```

## Discretion Recommendations

### Arena Floor Potion Scale: 2x (32x32)
**Recommendation:** Keep 2x (32x32) for arena floor potions. The current code already uses `setDisplaySize(32, 32)` for ground powerup sprites, and they have particle auras for extra visibility. At fast gameplay speeds, the aura matters more than the icon size for spotting pickups. Keeping 2x is consistent with current behavior and avoids potions looking oversized relative to 32x32-rendered player sprites.

### Heart Row + Powerup Positioning
**Recommendation:** Place the heart row centered at bottom-center, `y = H * 0.92` (about 662px at 720p). This is slightly above the current health bar position (0.95 = 684px) to leave room for the player name label below. Active buff potion icons go to the right of the heart row with 8px gap. The cooldown bar stays at its current position (`y = H * 0.89`), sitting above the heart row.

### Death Screen Overlay Timing
**Recommendation:** 3 seconds visible, then 0.8s fade out. This gives the player time to process their death but doesn't delay spectator mode entry. Total: ~4 seconds from death to full spectator. The spectator mode itself is entered immediately (camera follows target), but the overlay draws attention to the death event.

### Radial Timer Sweep Style
**Recommendation:** Clockwise drain starting from 12 o'clock (top). This is the standard MOBA/RPG convention (League of Legends, Diablo, etc.). Implementation: start angle = -90 degrees (top), end angle decreases clockwise as time runs out. Use `Graphics.slice()` with anticlockwise=true for the "remaining" segment, or draw the "elapsed" segment as a dark overlay on top of the icon. The semi-transparent black overlay approach (draw elapsed portion as dark) is more intuitive.

### Low-Health Sprite Tint Parameters
**Recommendation:** Threshold at 50% HP. Pulse cycle: 600ms total (300ms red tint on, 300ms clear). Use `setTint(0xff4444)` (slightly soft red, not pure red) for the tint phase, and `clearTint()` for the clear phase. The effect should be a gentle pulse, not a harsh strobe. Use a Phaser TimerEvent (not tween) since we're toggling a discrete state (tint on/off), not interpolating a value.

### Low-Time Timer Parameters
**Recommendation:** Keep existing 30-second threshold. Change: tint both the hourglass icon and the time text to `Colors.status.danger` (#CC3333). Pulse both with alpha oscillation (1.0 to 0.5 over 500ms, yoyo). This matches the existing timer flash behavior but extends it to the icon.

## Critical Implementation Notes

### Icon Asset Dimensions
All icons in `assets/icons/` are **32x32 pixels**, NOT 16x16 as mentioned in the phase context description. The context says "16x16 pixel art sprites rendered at 2x (32x32)" but the actual files are already 32x32. Since the decision says "Icons at 2x scale (32x32)" and the native size is already 32x32, display them at native resolution (no scaling needed) via `setDisplaySize(32, 32)`. The visual result is the same -- 32x32 on screen.

### Potion Color Mapping Change
The context decisions change the potion color assignments:

| Powerup Type | Current Color | New Color | Icon File |
|-------------|---------------|-----------|-----------|
| SPEED | Blue (potion-blue.png) | Red (icon277 / potion-red.png) | Already in public/ |
| INVINCIBILITY | Orange (potion-orange.png) | Blue (icon280 / potion-blue.png) | Already in public/ |
| PROJECTILE | Red (potion-red.png) | Green (icon278 / potion-green.png) | NOT yet in public/ |

The green potion file (icon278.png = potion-green.png) must be copied to `client/public/icons/potion-green.png`.

### Files That Need New Icons Copied to `client/public/icons/`
1. `heart-full.png` (from `assets/icons/icon001.png`)
2. `heart-empty.png` (from `assets/icons/icon002.png`)
3. `timer.png` (from `assets/icons/icon005.png`)
4. `skull.png` (from `assets/icons/icon006.png`)
5. `gravestone.png` (from `assets/icons/icon398.png`)
6. `potion-green.png` (from `assets/icons/icon278.png`)

### Health Bar HP-Per-Heart Mapping
With the character stats:
- Paran: 150 HP -> at 10 HP per heart = 15 hearts (15 * 34px = 510px total width)
- Faran: 50 HP -> at 10 HP per heart = 5 hearts (5 * 34px = 170px total width)
- Baran: 50 HP -> at 10 HP per heart = 5 hearts (5 * 34px = 170px total width)

15 hearts fits comfortably in 1280px width. The difference in heart count also communicates the HP asymmetry to the player.

### Kill Feed Data Structure
The kill broadcast sends: `{ killer: string, victim: string, killerRole: string, victimRole: string }`. Both names and roles are available, which is needed for the color-tinted names + skull icon layout. However, victim **position** is NOT in the kill message -- to place gravestones, we need to look up the victim player's position from `room.state.players` at the time of the kill event.

### Existing Event Infrastructure
- `localDied` event: Already emitted by GameScene, received by HUDScene (currently empty handler). This is where the death overlay triggers.
- `spectatorChanged` event: Emitted after localDied, provides target info. Death overlay should fade before spectator info appears.
- Kill feed currently handled by `room.onMessage('kill', ...)` in HUDScene. The gravestone spawn happens in GameScene (different handler for the same message).

### Scene Reuse Variables to Reset
Every new member variable added must be reset in `create()`:
- `heartIcons: Phaser.GameObjects.Image[]`
- `deathOverlay` objects (gravestone image, text)
- `gravestoneSprites: Phaser.GameObjects.Image[]` (in GameScene)
- `lowHealthPulseTweens: Map<string, TimerEvent>` (in GameScene)
- `roundScorePipsGfx: Phaser.GameObjects.Graphics`
- `timerIcon: Phaser.GameObjects.Image`
- `buffRadialGfx: Map<number, Phaser.GameObjects.Graphics>`

## Open Questions

1. **HP per heart granularity**
   - What we know: Paran=150HP, Guardians=50HP. Decision says all characters show hearts.
   - What's unclear: Should partial hearts be shown (e.g., half-heart for 5HP)? Or only full/empty?
   - Recommendation: Use full/empty only at 10HP per heart. Partial hearts add significant complexity for marginal benefit. The numerical health is already communicated through heart count changes. If needed later, a half-heart icon could be added as a third texture.

2. **Powerup buff expiry flash timing**
   - What we know: "icon flashes a few times ~2s before expiring, then fades out"
   - What's unclear: Exact flash count and timing
   - Recommendation: Flash 5 times over 2 seconds (400ms cycle: 200ms visible, 200ms hidden). Then 500ms fade-out. This matches the existing `updateBuffIndicators()` flash behavior (currently 1.5s with 150ms interval).

3. **Kill feed entry rewrite scope**
   - What we know: Need skull icon between names, colored names
   - What's unclear: Should powerup collection entries also get icons? Currently they use the same kill feed format.
   - Recommendation: Only modify actual kill entries (where killerRole and victimRole are both non-empty). Powerup collection and spawn entries stay text-only since they're informational, not combat events.

## Sources

### Primary (HIGH confidence)
- Phaser 3.90 API Documentation (Context7 /websites/phaser_io_api-documentation) - Graphics.arc(), Graphics.slice(), Image.setDisplaySize(), pixel art config
- Codebase direct inspection - HUDScene.ts (1233 lines), GameScene.ts (2400+ lines), BootScene.ts, designTokens.ts, characters.ts, powerups.ts, GameState.ts schema
- Icon asset files - Direct inspection of all 32x32 PNG files in assets/icons/ and client/public/icons/

### Secondary (MEDIUM confidence)
- Phaser community patterns for radial cooldown overlays (Graphics.slice with semi-transparent overlay)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All Phaser 3.90 built-in APIs, no external dependencies
- Architecture: HIGH - Direct modification of existing, well-structured HUDScene/GameScene sections
- Pitfalls: HIGH - Based on direct codebase analysis (scene reuse, asset pipeline, state schema)

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (stable -- no framework changes expected)
