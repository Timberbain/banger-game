---
name: game-design
description: Expert multiplayer game developer specializing in Phaser 3 + Colyseus + TypeScript with deep pixel art and solarpunk aesthetic knowledge. Use this skill when the user asks to (1) design or implement game mechanics, physics, or UI, (2) create or modify pixel art assets, spritesheets, or tilesets, (3) build game scenes, HUD overlays, or visual effects, (4) apply the solarpunk design schema to any visual element, (5) optimize game performance or rendering, (6) implement multiplayer features or server-authoritative gameplay. Generates distinctive, cohesive game visuals that avoid generic AI aesthetics. Always follows the established design schema.
---

# Game Design Skill

Build multiplayer arena combat with Phaser 3 + Colyseus 0.15 + TypeScript. All visual output follows the **"Golden Afternoon"** design system: 1940s Art Deco Streamline Moderne fused with solarpunk pixel art. Warm golds, deep forest greens, vibrant accents. Never generic.

## Design Thinking — Before Any Code

Every visual element, mechanic, and UI component must pass four gates:

1. **Purpose**: What gameplay need does this serve? A decorative vine line guides the eye. A gold sparkle communicates life. A screen-shake signals impact. If it doesn't serve the player, cut it.

2. **Tone**: Does this feel like a golden afternoon in a thriving garden city? Solarpunk is hopeful, warm, and alive — not dystopian, cold, or sterile. Art Deco adds structure and geometry — not rigidity. The world breathes.

3. **Consistency**: Does this match the established palette, proportions, and pixel art constraints? Read the design tokens. Use them. Don't invent new colors when the palette already has what you need.

4. **Distinctiveness**: Could this have been produced by a template, a default shader, or an AI with no context? If yes, push harder. The difference between "functional" and "memorable" is intentionality.

Bold pixel maximalism and refined minimalism both work. The key is **intentionality over intensity**.

## Code Quality Gates

All implementations must be:

- **Production-grade**: Handle edge cases, clean up resources (destroy emitters, remove listeners), manage scene lifecycle (reset ALL member vars in `create()`)
- **Visually cohesive**: Every element reinforces the Golden Afternoon aesthetic through the design token system
- **Performance-conscious**: 60fps target, efficient particle cleanup via delayed destroy, texture reuse via tinting
- **Server-authoritative**: Never trust client state for gameplay logic. Physics runs on shared code (`shared/physics.ts`). Client predicts, server corrects.

## The Design Token System

**Source of truth**: `client/src/ui/designTokens.ts`

```typescript
import {
  Colors,
  Type,
  TextStyle,
  Spacing,
  Buttons,
  Panels,
  Layout,
  Decorative,
} from '../ui/designTokens';
```

Use these tokens for every visual decision. For the full palette, typography scale, spacing grid, component specs, character design, particle configs, and audio design, read [references/design-schema.md](references/design-schema.md).

## Aesthetic Mandates

### Do

- **Warm golds** for titles, accents, trim — the gold range spans 5 tones from aged brass to gleaming temple
- **Deep forest greens** for backgrounds — saturated enough to read as "forest" not "black screen"
- **Solarpunk spectrum** for accents — vine green, solar blue, leaf chartreuse, sky azure, sandy earth, aqua glow
- **Art Deco geometry** on all UI — sharp corners (0 radius), strong horizontal/vertical lines, metallic trim
- **Pixel art discipline** — 32x32 tiles, 5 colors per character, black outlines, dithering over gradients
- **Monospace bold + black stroke** on ALL game text — 2-8px stroke, non-negotiable
- **Decorative golden elements** — sparkle dots, vine lines, sun rays, divider bars
- **Layered depth** — dark bg → mid-tone content → bright gold/green accents
- **Runtime tinting** — white base textures (`particle.png`), colored via `setTint()` for flexibility
- **Character identity** through color — Paran=#FFCC00, Faran=#FF4444, Baran=#44CC66, always consistent
- **Procedural audio** via jsfxr — no generic sound libraries, synthesized SFX from parameter sets

### Do NOT

- No generic rounded-corner card UIs or Material Design patterns
- No pastel gradients, glassmorphism, or modern web aesthetics
- No white/light backgrounds (solarpunk is lush and deep-toned)
- No fonts other than monospace (except Engebrechtre Art Deco for display/heading)
- No untinted placeholder elements — everything gets themed
- No particle effects with default colors, uniform speed, or missing scale curves
- No smooth vector sprites in a pixel art game
- No drop shadows, CSS blur, or web-style effects on game elements
- No HUD text without black stroke background contrast
- No sound effects from generic libraries — use jsfxr synthesis
- No symmetrical grid menus — use visual weight, asymmetry, overlap

## Implementation Patterns

### Scene Foundation

```typescript
// Every scene starts with the solarpunk base
this.add.rectangle(400, 300, 800, 600, Colors.bg.deepNum);

// Golden sparkle decorations
const sparkles = this.add.graphics();
sparkles.fillStyle(Colors.gold.primaryNum, 0.4);
for (let i = 0; i < 30; i++) {
  sparkles.fillCircle(
    Phaser.Math.Between(40, 760),
    Phaser.Math.Between(40, 560),
    Phaser.Math.FloatBetween(1, 3),
  );
}

// Vine decorative lines on margins
const vines = this.add.graphics();
vines.lineStyle(1, Colors.accent.vineNum, 0.3);
vines.beginPath();
vines.moveTo(50, 100);
vines.lineTo(60, 200);
vines.lineTo(45, 300);
vines.lineTo(65, 400);
vines.lineTo(50, 500);
vines.strokePath();
```

### Text Styling

```typescript
// Title: gold, stroked, Art Deco weight
this.add
  .text(400, 60, 'TITLE', {
    ...TextStyle.hero,
    fontFamily: 'monospace',
    fontStyle: 'bold',
  })
  .setOrigin(0.5);

// HUD: white, compact, always stroked
this.add.text(x, y, label, {
  ...TextStyle.hud,
});

// Role-colored label: character identity
this.add.text(x, y, roleName, {
  fontSize: '14px',
  fontFamily: 'monospace',
  fontStyle: 'bold',
  color: charColor(role),
  stroke: '#000000',
  strokeThickness: 2,
});
```

### Interactive Buttons

```typescript
// Primary button: vine green, gold trim, audio feedback
const btn = Buttons.primary;
const bg = this.add
  .rectangle(
    x,
    y,
    width,
    height,
    Phaser.Display.Color.HexStringToColor(btn.bg).color,
  )
  .setInteractive({ useHandCursor: true })
  .on('pointerover', () =>
    bg.setFillStyle(Phaser.Display.Color.HexStringToColor(btn.hover).color),
  )
  .on('pointerout', () =>
    bg.setFillStyle(Phaser.Display.Color.HexStringToColor(btn.bg).color),
  )
  .on('pointerdown', () => {
    audioManager?.playSFX('button_click');
    // action
  });
const label = this.add
  .text(x, y, 'BUTTON TEXT', {
    fontSize: btn.fontSize,
    color: btn.text,
    fontFamily: 'monospace',
    fontStyle: 'bold',
  })
  .setOrigin(0.5);
```

### Particle Effects

```typescript
// One-shot burst: create, explode, auto-destroy
const emitter = this.scene.add.particles(x, y, 'particle', {
  speed: { min: 50, max: 150 },
  lifespan: 300,
  scale: { start: 1, end: 0 },
  gravityY: 100,
  tint: roleColor, // Always tinted, never default white
  emitting: false,
});
emitter.setDepth(20);
emitter.explode(8);
this.scene.time.delayedCall(500, () => emitter.destroy());

// Continuous trail (caller destroys when done)
const trail = this.scene.add.particles(0, 0, 'particle', {
  frequency: 30,
  lifespan: 200,
  speed: 0,
  scale: { start: 0.5, end: 0 },
  alpha: { start: 0.6, end: 0 },
  tint: color,
  follow: targetSprite,
  emitting: true,
});
trail.setDepth(4);
```

### Tilemap Loading

```typescript
// Dynamic per-map tileset loading
const MAP_TILESET_INFO: Record<
  string,
  { key: string; image: string; name: string }
> = {
  test_arena: {
    key: 'tileset_ruins',
    image: 'tilesets/solarpunk_ruins.png',
    name: 'solarpunk_ruins',
  },
  corridor_chaos: {
    key: 'tileset_living',
    image: 'tilesets/solarpunk_living.png',
    name: 'solarpunk_living',
  },
  // ...
};

// Load after receiving mapName from server
const info = MAP_TILESET_INFO[mapName];
this.load.image(info.key, info.image);
this.load.tilemapTiledJSON(`map_${mapName}`, `maps/${mapName}.json`);
// After load complete:
const map = this.make.tilemap({ key: `map_${mapName}` });
const tileset = map.addTilesetImage(info.name, info.key);
map.createLayer('Ground', tileset!, 0, 0);
const wallsLayer = map.createLayer('Walls', tileset!, 0, 0);
```

## Architecture Reference

For scene flow, physics system, client prediction, interpolation, collision, multiplayer rooms, depth layering, asset loading, and server patterns, read [references/game-architecture.md](references/game-architecture.md).

## Pixel Art Reference

For spritesheet frame layouts, character body proportions, color palettes, tileset pipeline, drawing primitives, and how to add new assets, read [references/pixel-art.md](references/pixel-art.md).

## Asset Generation

All pixel art is procedurally generated:

```bash
python3 scripts/generate-assets.py
```

Outputs: 3 character spritesheets (832x32, 26 frames), 1 projectile sheet (24x8, 3 frames), 1 particle (8x8), 4 tilesets (128x64, 8 tiles each). See [references/pixel-art.md](references/pixel-art.md) for the full spec.

## Prohibitions — Anti-Patterns That Produce AI Slop

These specific patterns destroy the solarpunk Art Deco aesthetic and produce recognizable "AI-generated game" output:

1. **Smooth vector sprites** in a pixel art game — betrays the intentional lo-fi constraint
2. **Drop shadows and blur effects** — web aesthetics that break pixel art crispness
3. **White text on flat color** without stroke — unreadable over busy tilesets
4. **Symmetrical grid menus** — lifeless; use visual weight, golden ratios, asymmetric balance
5. **Default white particles** — untinted particles scream "placeholder." Always `tint: color`
6. **Uniform particle speed/scale** — natural effects need variance: `{ min: X, max: Y }`
7. **HUD without background contrast** — text needs dark bg + stroke over pixel art
8. **Generic audio** from sample packs — jsfxr synthesis or nothing
9. **CSS-inspired UI** (rounded corners, gradients, shadows) — this is Art Deco, not Material Design
10. **Placeholder art** without the solarpunk palette — even prototypes use the design tokens
