# Phase 12: HUD Icon Overhaul - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace text-only HUD elements with icon-based displays using the provided 16x16 pixel art sprites (hearts, timer, skull, potions, gravestone). All icons rendered at 2x (32x32) for the 1280x720 viewport. Volume icons and food icons are out of scope. Cooldown bar keeps its current style.

</domain>

<decisions>
## Implementation Decisions

### Health Display
- Heart row replaces the current health bar in the local player's HUD (bottom of screen)
- All characters (including Paran with 1 HP) show their health as heart icons
- Standard red hearts from the icon sprite — no character-color tinting on local HUD
- Heart-full (icon001) for remaining HP, heart-empty (icon002) for lost HP
- Icons at 2x scale (32x32)
- Flash + shrink animation when a heart transitions from full to empty on damage
- Floating health bars above other players' sprites removed entirely — no per-player overhead health
- Low-health indicator for other players: sprite tint pulse (red flash) when below 50% HP
- HUD only shows the local player's health — no teammate health rows

### Kill Feed & Death
- Kill feed format: "PlayerA [skull] PlayerB" — skull icon between killer and victim names
- Player names in kill feed tinted with their character color (killer color + victim color)
- Gravestone icon placed on the arena floor at the exact death location
- Arena gravestones persist for the entire stage (not faded)
- Arena gravestones tinted with the dead player's character color
- No gravestone markers on the minimap — arena floor only
- Death screen: centered overlay with large gravestone icon + "Eliminated" text, fades after a few seconds before spectator mode

### Powerup Indicators
- Active buffs shown as potion icons with radial timer sweep (circular countdown overlay)
- Positioned next to the heart row at the bottom of the HUD (health + buffs grouped)
- Color mapping: Red potion = Speed, Blue potion = Invincibility, Green potion = Larger Projectiles
- Potion icons also replace arena floor pickups (same visual language as HUD)
- Buff expiry: icon flashes a few times ~2s before expiring, then fades out
- Minimap powerup markers unchanged (keep current style)

### Timer & Round Score
- Timer layout: hourglass icon on the left, countdown number to the right, top-center of screen
- Low time warning: timer icon and number turn red and pulse when below 30 seconds
- Round score displayed as dots/pips below the timer
- Paran wins shown as filled dots in Paran's character color; Guardian wins in Guardian's color; empty dots gray
- Cooldown bar keeps current horizontal bar style — no icon replacement
- Volume icons unused this phase (lobby/settings controls stay as-is)

### Claude's Discretion
- Arena floor potion icon scale (2x or 3x) — pick based on visibility during fast gameplay
- Exact positioning offsets for the heart row + powerup indicator group at bottom of HUD
- Death screen overlay timing (how long before fading to spectator)
- Radial timer sweep direction and visual style (clockwise drain, etc.)
- Exact red pulse parameters for low-health sprite tinting and low-time timer

</decisions>

<specifics>
## Specific Ideas

- Heart damage animation: flash + shrink (not just swap) makes health loss feel impactful
- Gravestones on arena floor tell the battle story — persistent markers create visual narrative
- Radial timer for powerups matches MOBA cooldown conventions (familiar to players)
- Skull icon between names in kill feed is classic FPS style — instantly readable

</specifics>

<deferred>
## Deferred Ideas

- Volume icons (4-level speaker sprites) for lobby/settings controls — future polish phase
- Food icons (corn, cheese, drumstick, steak, banana, burger) — no current use, save for future
- Teammate health display in HUD — could revisit if playtesting shows need

</deferred>

---

*Phase: 12-hud-icon-overhaul*
*Context gathered: 2026-02-19*
