/**
 * Banger Design System — "Golden Afternoon"
 * 1940s Art-Deco Streamline Moderne + Solarpunk Pixel Art
 *
 * Design direction: "Golden afternoon in a thriving garden city"
 * — warm, alive, hopeful. Every color should feel sun-touched.
 *
 * Pixel Art Constraints:
 * - Limited palette per element (12-16 colors per tileset, 4-5 per character)
 * - Crisp edges, no anti-aliasing — sprites render at integer scale
 * - Black stroke on ALL text for readability over pixel art backgrounds
 * - Readability at 32x32 — high-contrast outlines define shape
 * - Dithering over blending — hard color steps, not smooth gradients
 * - Tint-friendly base textures — white particles, runtime setTint()
 *
 * Usage: import { Colors, Type, Spacing, Buttons } from '../ui/designTokens';
 */

// ─── COLORS ────────────────────────────────────────────

export const Colors = {
  gold: {
    primary:    '#D4A84A',
    primaryNum:  0xD4A84A,
    light:      '#E8C56A',
    lightNum:    0xE8C56A,
    dark:       '#9E7828',
    darkNum:     0x9E7828,
    gleam:      '#F2DA78',
    gleamNum:    0xF2DA78,
    brass:      '#C49432',
    brassNum:    0xC49432,
  },

  bg: {
    deep:        '#101E14',
    deepNum:      0x101E14,
    surface:     '#172C1C',
    surfaceNum:   0x172C1C,
    elevated:    '#203828',
    elevatedNum:  0x203828,
    overlayAlpha: 0.85,
  },

  accent: {
    solar:       '#4A92CC',
    solarNum:     0x4A92CC,
    vine:        '#3E7C3A',
    vineNum:      0x3E7C3A,
    vineHover:   '#4E9C46',
    vineHoverNum: 0x4E9C46,
    leaf:        '#6CB84C',
    leafNum:      0x6CB84C,
    sky:         '#5CACD2',
    skyNum:       0x5CACD2,
    earth:       '#C4A260',
    earthNum:     0xC4A260,
    aqua:        '#50C8C8',
    aquaNum:      0x50C8C8,
  },

  surface: {
    ivory:    '#ECE0C2',
    ivoryNum:  0xECE0C2,
    stone:    '#D8D0BC',
    stoneNum:  0xD8D0BC,
  },

  text: {
    primary:   '#FFFFFF',
    secondary: '#B0AEA0',
    disabled:  '#5E5848',
  },

  status: {
    success:    '#44CC44',
    successNum:  0x44CC44,
    warning:    '#CCCC00',
    warningNum:  0xCCCC00,
    danger:     '#CC3333',
    dangerNum:   0xCC3333,
  },

  char: {
    paran:    '#FFCC00',
    paranNum:  0xFFCC00,
    faran:    '#FF4444',
    faranNum:  0xFF4444,
    baran:    '#44CC66',
    baranNum:  0x44CC66,
  },
} as const;

/** Lookup character color by role name */
export function charColor(role: string): string {
  const map: Record<string, string> = {
    paran: Colors.char.paran,
    faran: Colors.char.faran,
    baran: Colors.char.baran,
  };
  return map[role] || Colors.text.primary;
}

/** Lookup character color as number by role name */
export function charColorNum(role: string): number {
  const map: Record<string, number> = {
    paran: Colors.char.paranNum,
    faran: Colors.char.faranNum,
    baran: Colors.char.baranNum,
  };
  return map[role] || 0xFFFFFF;
}

/** Lookup accent color as number by key name */
export function accentColorNum(key: string): number {
  const map: Record<string, number> = {
    solar: Colors.accent.solarNum,
    vine: Colors.accent.vineNum,
    leaf: Colors.accent.leafNum,
    sky: Colors.accent.skyNum,
    earth: Colors.accent.earthNum,
    aqua: Colors.accent.aquaNum,
  };
  return map[key] || Colors.accent.vineNum;
}

// ─── PIXEL ART CONSTANTS ─────────────────────────────

export const PixelArt = {
  /** Sprite frame size */
  tileSize: 32,
  /** Max colors per tileset */
  maxTilesetColors: 16,
  /** Max colors per character sprite */
  maxCharColors: 5,
  /** Standard outline color for sprites */
  outline: 0x000000,
  /** Text always needs stroke for pixel-art readability */
  minStroke: 2,
  /** Dither patterns available: 'checker' | 'stripe' | 'scatter' */
  ditherTypes: ['checker', 'stripe', 'scatter'] as const,
} as const;

// ─── TYPOGRAPHY ────────────────────────────────────────

export const Fonts = {
  display: '"Engebrechtre Ex Bd", "Georgia", serif',
  heading: '"Engebrechtre Bd", "Georgia", serif',
  body:    'monospace',
  ui:      'monospace',
} as const;

export const Type = {
  title:      { fontSize: '64px', fontFamily: Fonts.display, fontStyle: 'bold' },
  splash:     { fontSize: '48px', fontFamily: Fonts.display, fontStyle: 'bold' },
  heading:    { fontSize: '28px', fontFamily: Fonts.heading, fontStyle: 'bold' },
  subheading: { fontSize: '22px', fontFamily: Fonts.heading, fontStyle: 'bold' },
  body:       { fontSize: '16px', fontFamily: Fonts.body },
  caption:    { fontSize: '14px', fontFamily: Fonts.body },
  small:      { fontSize: '12px', fontFamily: Fonts.body },
} as const;

// ─── TEXT STYLE PRESETS ────────────────────────────────

export const TextStyle = {
  /** Game title, scene headers — gold with green stroke */
  hero: {
    ...Type.title,
    color: Colors.gold.primary,
    stroke: Colors.bg.surface,
    strokeThickness: 6,
  },

  /** Heading variant of hero style */
  heroHeading: {
    ...Type.heading,
    color: Colors.gold.primary,
    stroke: Colors.bg.surface,
    strokeThickness: 3,
  },

  /** Role banner, fight countdown — bold with black stroke */
  splash: {
    ...Type.splash,
    color: Colors.text.primary,
    stroke: '#000000',
    strokeThickness: 6,
  },

  /** Timer, health labels — HUD overlay */
  hud: {
    ...Type.body,
    color: Colors.text.primary,
    fontStyle: 'bold' as const,
    stroke: '#000000',
    strokeThickness: 3,
  },

  /** Buttons, body text — clean no stroke */
  clean: {
    ...Type.body,
    color: Colors.text.primary,
  },

  /** Secondary/muted text */
  muted: {
    ...Type.body,
    color: Colors.text.secondary,
  },
} as const;

// ─── SPACING ───────────────────────────────────────────

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  24,
  xl:  40,
  xxl: 70,
} as const;

// ─── BUTTON PRESETS ────────────────────────────────────

export const Buttons = {
  primary: {
    bg:      Colors.accent.vine,
    hover:   Colors.accent.vineHover,
    active:  '#306828',
    border:  Colors.gold.brass,
    text:    Colors.text.primary,
    fontSize: '22px',
    padding: { x: Spacing.lg, y: Spacing.md },
  },

  secondary: {
    bg:      Colors.bg.elevated,
    hover:   '#2A4C2A',
    border:  Colors.accent.vine,
    text:    Colors.text.primary,
    fontSize: '16px',
    padding: { x: Spacing.lg, y: Spacing.sm },
  },

  accent: {
    bg:      Colors.accent.solar,
    hover:   Colors.accent.sky,
    border:  Colors.gold.brass,
    text:    Colors.text.primary,
    fontSize: '20px',
    padding: { x: Spacing.lg, y: Spacing.md },
  },

  danger: {
    bg:      Colors.status.danger,
    hover:   '#DD4444',
    border:  'none',
    text:    Colors.text.primary,
    fontSize: '20px',
    padding: { x: Spacing.lg, y: Spacing.md },
  },

  disabled: {
    bg:      Colors.text.disabled,
    hover:   Colors.text.disabled,
    border:  'none',
    text:    Colors.text.secondary,
    fontSize: '22px',
    padding: { x: Spacing.lg, y: Spacing.md },
  },
} as const;

// ─── PANEL PRESETS ─────────────────────────────────────

export const Panels = {
  card: {
    bg:           Colors.bg.surfaceNum,
    border:       Colors.accent.vineNum,
    borderWidth:  2,
    selectedBorder:    Colors.status.successNum,
    selectedWidth:     4,
    disabledAlpha:     0.5,
    padding:      Spacing.md,
  },
} as const;

// ─── HEALTH BAR ────────────────────────────────────────

export const HealthBar = {
  bg:       0x3A0808,
  local:    { width: 200, height: 16 },
  other:    { width: 140, height: 12 },
  lowThreshold: 0.25,
  flashInterval: 300,
} as const;

// ─── COOLDOWN BAR ──────────────────────────────────────

export const CooldownBar = {
  bg:        0x2C2A20,
  recharging: Colors.status.warningNum,
  ready:      Colors.status.successNum,
  width:     40,
  height:    6,
} as const;

// ─── LAYOUT ────────────────────────────────────────────

export const Layout = {
  canvas: { width: 800, height: 600 },
  center: { x: 400, y: 300 },
  maxContentWidth: 640,
  margin: 80,

  hud: {
    roleReminder: { x: 10, y: 10 },
    timer:        { x: 400, y: 20 },
    ping:         { x: 780, y: 20 },
    killFeed:     { x: 790, y: 60 },
    cooldown:     { x: 400, y: 538 },
    healthBarY:   575,
  },
} as const;

// ─── DECORATIVE ────────────────────────────────────────

export const Decorative = {
  divider: {
    color: Colors.gold.primaryNum,
    alpha: 0.5,
    thickness: 2,
  },
  vine: {
    color: Colors.accent.vineNum,
    alpha: 0.25,
    thickness: 1,
  },
  solarDots: {
    color: Colors.gold.gleamNum,
    alphaMin: 0.3,
    alphaMax: 0.5,
    radiusMin: 1,
    radiusMax: 3,
  },
  sunRays: {
    color: Colors.gold.lightNum,
    alpha: 0.20,
  },
} as const;
