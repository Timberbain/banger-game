# Phase 6: UX Polish - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Polish the existing functional game with HUD, audio, visual feedback, tutorial, and pixel art. The game is fully playable (movement, combat, lobbies, matchmaking, reconnection) — this phase adds the presentation layer that makes it feel like a finished product. No new gameplay mechanics or networking features.

</domain>

<decisions>
## Implementation Decisions

### HUD & Information Display
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
- Nothing above characters (no name tags, no floating health bars) — identify by color/sprite
- Controls tutorial: separate help screen accessible from lobby menu (not in-game overlay)
- Spectator HUD: Claude's discretion
- Role identity: clear banner at match start ("YOU ARE PARAN" or similar) + subtle HUD reminder

### Hit Feedback & Juice
- No screen shake on any impacts
- Damage feedback: sprite flash (white/red) + small particle burst at impact point
- No hit markers — enemy flash and particles are sufficient confirmation
- Death effect: explosion of particles in the player's color
- Projectiles: short fading trail behind projectile
- Paran wall collision: impact particles at the wall (emphasizes the penalty)
- Paran high speed: speed lines / blur around Paran at high velocity
- Match start: big centered countdown ("3... 2... 1... FIGHT!")
- Victory/defeat: big banner with particle effects and color wash
- Projectile wall impacts: small spark/dust particles at impact point
- Low health: flashing health bar (no screen vignette)
- No damage direction indicator — map awareness is part of the skill

### Audio Design
- Style: retro chiptune (8-bit/16-bit)
- Match music: energetic chiptune loop during gameplay (constant tempo, no dynamic changes)
- Lobby/menu music: separate chill chiptune track
- SFX coverage: full (combat + movement + UI sounds)
  - Combat: shooting, hit, death per role
  - Movement: Paran wall collision, speed-up whoosh
  - UI: button clicks, countdown beeps, match start/end fanfare, ready chime
- Character-specific sound profiles: Paran, Faran, and Baran each have unique shot/hit/movement sounds
- Audio generation: procedural (jsfxr or similar) — generate chiptune SFX programmatically
- Volume controls: separate Music and SFX sliders

### Art Direction
- Pixel scale: 32x32 tiles and sprites
- Aesthetic: heavy solarpunk throughout
- Color palette: warm greens + gold (forest greens, warm yellows, golden sunlight)
- Character differentiation: unique color AND distinct silhouette per role (instantly recognizable at 32x32)
- Projectile art: unique shapes per role (energy blasts for Paran, darts for Faran, bolts for Baran)
- Animation frames: standard 4-6 frames per action (walk, idle, shoot, death)
- Wall tiles: different style per arena map
  - Overgrown ruins, living walls (hedges/trees), tech+nature blend — each arena gets its own
- Floor tiles: varied within each arena (grass, dirt paths, stone patches — organic, lived-in)
- Lobby UI: full solarpunk pixel art treatment (background, themed buttons, character portraits)
- Title screen: pixel art "BANGER" logo with solarpunk background

### Claude's Discretion
- Kill feed visual design
- Spectator HUD layout
- Asset creation method (AI-generated + cleanup vs hand-drawn — pick most practical approach)
- Exact spacing, typography, and HUD element sizing
- Specific particle effect parameters (count, speed, lifetime)
- Music composition approach (tracker software, web audio API, etc.)

</decisions>

<specifics>
## Specific Ideas

- Different wall art styles per arena: one arena gets overgrown ruins, another gets living walls (hedges/bamboo), another gets tech+nature blend (solar panels with plants). Gives each of the 4 maps a distinct visual identity.
- Paran gameplay fantasy: terrifying speed with visible speed lines, dramatic wall collision particles when they mess up, big explosion on death. Glass cannon should FEEL like a glass cannon.
- Match timer creates urgency for Paran (guardians win on timeout) — the visual timer turning red reinforces this pressure.
- Chiptune audio generated procedurally fits the solarpunk pixel art vibe and avoids licensing/sourcing issues.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-ux-polish*
*Context gathered: 2026-02-11*
