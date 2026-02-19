# Phase 7: HD Viewport & Camera - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Players experience the game at 1280x720 with 2x integer-scaled pixel art, a camera that smoothly follows their character with look-ahead, and all UI/scenes rendering correctly at the new resolution. Includes 2x asset creation for all sprites, death spectator camera, and dynamic arena bounds. Does NOT include new arena designs (Phase 8) or new HUD icons (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Camera follow behavior
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

### Pixel art rendering
- 2x integer scaling: 1280x720 canvas, 640x360 logical resolution
- Nearest-neighbor filtering -- sharp, hard pixel edges, classic retro look
- Logical coordinates (640x360) for camera and physics -- Phaser zoom handles the 2x visual scaling
- Resizable window with letterboxing to maintain aspect ratio
- Keep current arena sizes (800x608) -- camera scrolls them at 640x360 viewport. Phase 8 handles arena overhaul
- Snap all sprites to pixel grid -- no sub-pixel rendering, no shimmer

### 2x sprite assets
- Create ALL sprites at 2x resolution (characters, projectiles, tiles, particles, HUD icons)
- More detailed art -- use extra pixels for additional shading, detail, and visual richness (still pixel art)
- More animation frames -- smoother walk cycles, attacks, and death animations
- Add idle breathing/bobbing animation (2-3 frame cycle when standing still)
- Tiles and obstacles remain static (no ambient animation like grass sway)

### HUD layout
- Viewport-relative positioning (% of screen) -- adapts to resolution, future-proof
- HUD elements stay compact (same visual size) -- extra resolution gives more visible arena
- Kill feed stays in top-right
- Ping indicator stays in current position
- Fixed screen overlay (not scrolling with world camera)
- HUD renders through the 2x pixel grid -- pixelated text/icons matching game world aesthetic
- All scenes (Lobby, Victory, Help, Boot) also render at 2x pixel art scale
- Timer stays as text counter (not visual bar/circle)

### Death & spectator camera
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

</decisions>

<specifics>
## Specific Ideas

- Match-start overview: brief ~1.5s pan showing full arena + all player positions, then zoom in to your spawn. Builds tension.
- Paran camera should feel thrilling at max speed: stronger look-ahead + subtle zoom-out creates a sense of danger and velocity.
- Gentle camera easing on Paran direction reversals prevents jarring whip but still communicates the speed change.
- Keep all HUD in pixel art style through the 2x grid -- native resolution text would break the aesthetic.
- 2x sprites should be richer, not just upscaled -- more shading and detail, more animation frames, plus idle breathing.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 07-hd-viewport-camera*
*Context gathered: 2026-02-13*
