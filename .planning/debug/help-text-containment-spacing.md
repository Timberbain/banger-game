---
status: diagnosed
trigger: "Help screen text containment and spacing issues - text overflows panels, names overlap borders, insufficient line spacing"
created: 2026-02-13T12:00:00Z
updated: 2026-02-13T12:30:00Z
---

## Current Focus

hypothesis: CONFIRMED - Four distinct layout issues in HelpScene panel rendering
test: Layout math analysis complete
expecting: n/a - diagnosis only
next_action: Return structured diagnosis

## Symptoms

expected: Character names, taglines, and descriptions should be fully contained within their panel backgrounds with comfortable padding and readable spacing
actual: Character names appear at panel top edge overlapping borders; Paran description text extends past panel width on right; description lines have insufficient vertical spacing; sprites sit on top of panel borders
errors: Visual layout issues, not runtime errors
reproduction: Open HelpScene at 1280x720
started: After plan 07-08 redesign with playful descriptions

## Eliminated

(none - layout math confirmed all reported issues)

## Evidence

- timestamp: 2026-02-13T12:10:00Z
  checked: Panel geometry (line 89)
  found: Panel center at (x, 280), size 280x220. Top edge Y=170, bottom edge Y=390, half-width=140.
  implication: Establishes bounds for containment checks

- timestamp: 2026-02-13T12:12:00Z
  checked: Sprite positioning (line 95)
  found: Sprite at Y=180, scale 2x from 32x32 = 64px tall. Default Phaser origin (0.5, 0.5) means sprite top edge = 180-32 = Y=148. Panel top = Y=170. Sprite extends 22px ABOVE panel.
  implication: ROOT CAUSE of "sprites sit on top of panel borders"

- timestamp: 2026-02-13T12:14:00Z
  checked: Description text wordWrap (lines 126-133)
  found: NO wordWrap property set on description text objects. Text renders full width at origin 0.5.
  implication: ROOT CAUSE of horizontal overflow

- timestamp: 2026-02-13T12:16:00Z
  checked: Description text widths at 13px monospace (~7.8px/char)
  found: 3 of 7 description lines overflow 280px panel: "Charges through the arena at blazing speed" (328px), "Nimble guardian with a rapid-fire blaster" (320px), "Armored guardian packing serious firepower" (328px). Overflow = ~24px per side.
  implication: These lines extend visibly past panel right edge

- timestamp: 2026-02-13T12:18:00Z
  checked: Vertical spacing between description lines (line 127)
  found: Lines spaced 22px apart (lineIdx * 22). At 13px font, only ~9px gap between bottom of one line and top of next. Name-to-tagline gap: 22px. Tagline-to-first-description gap: 26px.
  implication: Tight but the bigger issue is inconsistent spacing ratios

- timestamp: 2026-02-13T12:20:00Z
  checked: Name text position vs panel top
  found: Name at Y=220, panel top at Y=170. Gap = 50px from panel top to name center. With 18px font, name top edge ~Y=211. This is 41px below panel top - actually acceptable.
  implication: Names are NOT overlapping panel border. The perceived overlap is from the SPRITE being above the panel, making the name look like it's at the top edge.

## Resolution

root_cause: >
  Four issues in HelpScene.ts panel layout:

  1. SPRITE ABOVE PANEL (line 95): Sprite positioned at Y=rolesY+10 (Y=180) with 2x scale
     making it 64px tall. With default origin (0.5, 0.5), sprite top edge = Y=148, which is
     22px ABOVE the panel top edge at Y=170. The sprite is not contained in the panel.

  2. NO WORD WRAP ON DESCRIPTIONS (lines 126-133): Description text objects have no wordWrap
     property. Three lines exceed 280px panel width: Paran L0 (328px), Faran L0 (320px),
     Baran L0 (328px). Text overflows ~24px past panel edge on each side.

  3. TIGHT VERTICAL SPACING (line 127): Description lines use 22px intervals with 13px font,
     leaving only ~9px between lines. Combined with the dense monospace rendering, this reads
     as cramped.

  4. PANEL TOP PADDING (line 95): Only 10px between rolesY anchor and sprite center means
     elements are crammed toward the top of the panel with no breathing room.

fix: Not applied (diagnosis only)
verification: Not applicable
files_changed: []
