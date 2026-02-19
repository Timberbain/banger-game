# Phase 11: Minimap & Music - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Two subsystems: (1) minimap overlay for global arena awareness during gameplay, and (2) music system with looping tracks, crossfade transitions, and WAV sound effect replacements. Victory/defeat screen audio and menu navigation sounds are included. The HUD icon overhaul is Phase 12.

</domain>

<decisions>
## Implementation Decisions

### Minimap layout & content
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

### Minimap interaction
- Toggle on/off with keybind (M or Tab)
- Visible by default when match starts
- Hidden during stage transitions and overview camera, reappears when gameplay starts
- Toggle state persists across stages (remembers if you turned it off)
- Toggle SFX: `select_1.wav` on hide, `select_2.wav` on show

### Music tracks & selection
- **Lobby:** `assets/soundtrack/lobby/Pixel Jitter Jive.mp3` — loops with ~1s pause between loops
- **Stage:** Random pick from 3 tracks in `assets/soundtrack/stage/` — same track plays all stages of a match; simple random (may repeat across matches)
- **Victory:** `assets/soundtrack/gameover/victory.mp3` — plays once; firework SFX (`fire_1.wav`, `fire_2.wav`, `fire_3.wav` randomized) tied to particle burst spawns
- **Defeat:** `assets/soundeffects/lose_1.wav` first, then `assets/soundtrack/gameover/defeat.mp3` — both play once
- Default volume: music ~40%, SFX ~70%
- Separate music + SFX volume sliders in lobby scene settings area
- Volume settings persist to localStorage across sessions

### WAV sound effect replacements (fully replace jsfxr)
- **Player hurt / Paran wall collision:** randomize between `hurt_1.wav`, `hurt_2.wav`, `hurt_3.wav`, `hurt_4.wav`
- **Guardian fires:** randomize between `laser_1.wav`, `laser_4.wav`, `laser_5.wav`
- **Paran fires with weapon powerup:** play `earthquake.wav` + `lightning.wav` simultaneously
- **Player killed:** play `disappear.wav`
- **Menu button navigation:** `select_1.wav` / `select_2.wav`
- All WAV files located in `assets/soundeffects/`

### Scene transitions
- Lobby → stage: quick ~1s crossfade (lobby fades out, stage fades in)
- Between stages (best-of-3): music continues but brief volume dip to ~30% during iris wipe and stage intro, returns to full
- Stage → victory/defeat: quick fade out (~0.5s), small silence gap, then result track
- Victory/defeat → lobby: crossfade (result track fades out, lobby music fades in with 0.5s delay)
- Lobby music starts after ~0.5s delay on scene create
- Browser autoplay: unlock audio context via existing BootScene title screen click

### Claude's Discretion
- Exact minimap rendering implementation (RenderTexture, Graphics, etc.)
- Minimap update frequency (every frame vs throttled)
- Exact crossfade easing curves
- How to handle the ~1s lobby loop pause (silence gap or delayed restart)
- Volume slider visual design and positioning in lobby
- Firework particle timing/frequency in victory screen

</decisions>

<specifics>
## Specific Ideas

- Minimap should feel lightweight and unobtrusive — transparent floating overlay, no heavy frame
- WAV SFX fully replace jsfxr for the specified events (remove old jsfxr definitions)
- Defeat screen: lose_1.wav plays first as a sting, THEN defeat.mp3 starts
- Firework SFX must be tied to actual particle spawn events, not a separate timer
- The existing AudioManager singleton pattern should be extended for music (not a new system)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-minimap-music*
*Context gathered: 2026-02-18*
