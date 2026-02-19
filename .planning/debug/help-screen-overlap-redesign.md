---
status: diagnosed
trigger: "Help screen has overlap between elements at 1280x720. Redesign needed: remove detailed stats, use playful high-level descriptions only."
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:00Z
---

## Current Focus

hypothesis: Too many elements crammed into fixed-height panels plus Y-position conflicts across the 720px viewport
test: Layout analysis complete - all Y positions mapped
expecting: n/a - diagnosis only
next_action: Return structured diagnosis

## Symptoms

expected: Help screen elements should be clearly readable with no overlapping text at 1280x720
actual: Elements overlap each other; panels overflow their bounds; too much technical detail crammed into small panels
errors: Visual overlap, not a runtime error
reproduction: Open HelpScene at 1280x720 viewport
started: After 1280x720 viewport conversion

## Eliminated

(none - layout analysis was sufficient)

## Evidence

- timestamp: 2026-02-13T00:00:00Z
  checked: Full layout Y-position map of HelpScene.ts
  found: See detailed layout analysis below
  implication: Multiple overlap zones identified

### Complete Y-Position Layout Map (viewport: 1280x720)

| Y Position | Element | Source Line |
|------------|---------|-------------|
| 40 | "CONTROLS" title (32px font, origin 0.5) | L25 |
| 65 | Decorative divider line | L38 |
| 92 | "General" section title (20px) | L42 |
| 118 | "Movement: WASD or Arrow Keys" (14px) | L55 |
| 140 | "Fire: Spacebar" | L55 |
| 162 | "Spectate (when eliminated): Tab to cycle" | L55 |
| **200** | **rolesY anchor** | L64 |
| 200+15=215 | Character sprites (scale 2x = ~64px tall, centered) | L123 |
| 200+50=250 | Role name text (18px) | L134 |
| 200+70=270 | Subtitle text (12px) | L145 |
| 200+92=292 | Stats line "HP: 50 | Dmg: 10 | Fire: 5/sec" (11px) | L153 |
| 200+115=315 | Detail line 0 (12px) | L162 |
| 200+133=333 | Detail line 1 | L162 |
| 200+151=351 | Detail line 2 | L162 |
| 200+169=369 | Detail line 3 | L162 |
| 200+187=387 | Detail line 4 | L162 |
| 200+205=405 | Detail line 5 | L162 |
| 200+223=423 | Detail line 6 | L162 |
| 200+241=441 | Detail line 7 (Paran only - 8 detail lines) | L162 |
| **200+120=320** | **Panel center** (270x270 rect) | L117 |
| Panel top: 320-135=**185** | Panel top edge | L117 |
| Panel bottom: 320+135=**455** | Panel bottom edge | L117 |
| **520** | "Win Conditions" title (20px) | L173 |
| 548 | "Paran wins..." (14px) | L185 |
| 572 | "Guardians win..." (14px) | L185 |
| **640** | "Back to Lobby" button (20px + padding) | L196 |

### Overlap Analysis

**OVERLAP ZONE 1: Sprite above panel**
- Character sprite at Y=215, sprite is ~64px tall at scale 2x, so top edge ~183
- Panel top edge at Y=185
- The sprite pokes slightly above the panel top edge, but more critically it sits at the very top of the panel with almost no padding

**OVERLAP ZONE 2: Paran detail lines overflow panel bottom**
- Panel bottom edge: Y=455
- Paran has 8 detail lines. Last line at Y=441 (center). With 12px font, bottom of text ~449
- This barely fits, but combined with the visual density it reads as cramped/overlapping
- Faran/Baran have 5 lines, last at Y=387 - these have slack but the panel is oversized for them

**OVERLAP ZONE 3: Panel bottom vs Win Conditions gap**
- Panel bottom: Y=455
- Win Conditions title: Y=520
- Gap = 65px. This is actually okay spacing-wise, but because the panels look so dense, the eye perceives crowding

**OVERLAP ZONE 4: General controls vs panel top**
- Last general control at Y=162 (text bottom ~170 with 14px font)
- Panel top at Y=185
- Gap = 15px. Very tight transition between sections

**PRIMARY PROBLEM: Panel content density**
- Each panel tries to fit: sprite + name + subtitle + stats line + 5-8 detail lines in a 270x270 box
- Paran panel has 8 detail lines of technical descriptions crammed in
- Stats line ("HP: 150 | Dmg: 10 | Fire: 1/sec") is game-mechanic detail that belongs in a wiki, not a help screen

### Elements with Too Much Technical Detail

1. **Stats lines** (L73, L89, L102): "HP: 150 | Dmg: 40 | Fire: 1/sec" - Raw numbers that mean nothing to a new player
2. **Paran details** (L74-83): "Cardinal movement only", "(last key wins)", "Loses ALL speed on wall/obstacle collision" - implementation details exposed as descriptions
3. **Guardian details** (L90-96, L103-109): "8-directional movement", "(diagonal allowed)" - technical movement system description
4. **Redundant Guardian panels**: Faran and Baran have nearly identical text, wasting space

## Resolution

root_cause: >
  The HelpScene crams too many elements into 270x270 role panels at 1280x720. Each panel
  contains sprite + name + subtitle + stats line + 5-8 lines of technical detail text at
  12px with 18px line spacing. The Paran panel has 8 detail lines which push content to
  Y=441, nearly overflowing the panel bottom at Y=455. The stats lines (HP/Dmg/Fire) are
  raw numbers meaningless to new players. Detail descriptions use technical language like
  "cardinal movement only (last key wins)" and "8-directional movement (diagonal allowed)"
  that reads like developer notes rather than player guidance. The tight 15px gap between
  general controls (Y=162) and panel tops (Y=185) compounds the cramped feeling.

fix: Not applied (diagnosis only)
verification: Not applicable
files_changed: []
