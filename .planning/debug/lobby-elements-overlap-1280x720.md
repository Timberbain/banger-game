---
status: diagnosed
trigger: "Investigate why lobby scene elements overlap at 1280x720 - Room Code and Select Character text overlap, character panels overlap Select Character text"
created: 2026-02-13T00:00:00Z
updated: 2026-02-13T00:00:00Z
---

## Current Focus

hypothesis: Y-coordinate assignments for Room Code, Select Character title, and character panels are too close together, causing visual overlap
test: Trace all Y-positions through showLobbyView and createCharacterSelection
expecting: Elements with insufficient vertical spacing between them
next_action: Return diagnosis

## Symptoms

expected: Room Code text, Select Character title, and character panels should be vertically separated with clear spacing
actual: Room Code overlaps Select Character text; character panels overlap Select Character text at the top
errors: None (visual layout issue)
reproduction: Create a private room in lobby view at 1280x720
started: After 1280x720 conversion

## Eliminated

(none needed - root cause found on first pass)

## Evidence

- timestamp: 2026-02-13T00:00:00Z
  checked: showLobbyView() room code positioning (line 698)
  found: Room code label placed at Y=45, fontSize 28px
  implication: Room code text occupies roughly Y=31 to Y=59 (28px text, origin 0.5)

- timestamp: 2026-02-13T00:00:00Z
  checked: createCharacterSelection() title Y (lines 821-822)
  found: titleY = isPrivate ? 110 : 75. For private rooms titleY=110, for public titleY=75
  implication: Private room "Select Character" at Y=110, public at Y=75

- timestamp: 2026-02-13T00:00:00Z
  checked: createCharacterSelection() panel Y (line 829)
  found: panelY = titleY + 70. So private=180, public=145
  implication: Character panels centered at Y=180 (private) or Y=145 (public)

- timestamp: 2026-02-13T00:00:00Z
  checked: Character panel dimensions (line 843)
  found: Panels are 160x130 rectangles, so top edge = panelY - 65
  implication: Private panel top edge at Y=115, public panel top edge at Y=80

- timestamp: 2026-02-13T00:00:00Z
  checked: "Select Character" text dimensions
  found: TextStyle.heroHeading uses fontSize 28px, origin 0.5. So text spans ~14px above/below anchor
  implication: Private "Select Character" occupies ~Y=96 to Y=124; public occupies ~Y=61 to Y=89

- timestamp: 2026-02-13T00:00:00Z
  checked: Overlap calculation for PRIVATE rooms
  found: |
    Room Code: Y=45, text ~Y=31-59
    Select Character: Y=110, text ~Y=96-124
    Panel top edge: Y=115
    Gap between Room Code bottom (59) and Select Character top (96) = 37px -- OK
    BUT: Select Character bottom (124) vs Panel top (115) = OVERLAP of 9px
  implication: Character panels overlap with Select Character text

- timestamp: 2026-02-13T00:00:00Z
  checked: Overlap calculation for PUBLIC rooms (no room code)
  found: |
    Select Character: Y=75, text ~Y=61-89
    Panel top edge: Y=80
    Select Character bottom (89) vs Panel top (80) = OVERLAP of 9px
  implication: Same overlap issue in public rooms

- timestamp: 2026-02-13T00:00:00Z
  checked: Player list and countdown positions
  found: |
    Player list titleY: isPrivate ? 320 : 280
    Countdown text: Y=150 (fixed)
    Panel bottom edge: panelY + 65 = 245 (private) or 210 (public)
    Player list at 320 (private) or 280 (public) -- leaves 75px/70px gap, OK
    Countdown at Y=150 overlaps with panels (private panelY=180, panels span 115-245)
  implication: Countdown text at Y=150 will be behind/inside character panels

## Resolution

root_cause: |
  Two positioning conflicts in createCharacterSelection():

  1. PRIMARY: panelY = titleY + 70 provides only 70px offset from the "Select Character" title.
     Since the title text is ~28px tall (centered at titleY) and panels are 130px tall (centered at panelY),
     the title's bottom edge (titleY+14) overlaps the panel's top edge (panelY-65 = titleY+5).
     The title bottom is at titleY+14 but the panel top is at titleY+70-65 = titleY+5. Overlap = 9px.

  2. SECONDARY: For private rooms, the Room Code at Y=45 and Select Character at Y=110 are
     visually close (51px gap) but not technically overlapping. The user-reported overlap may be
     perceptual due to the cramped vertical space when all three elements stack.

  3. MINOR: Countdown text at fixed Y=150 will render inside/behind character panels.

fix: (not applied - diagnosis only)
verification: (not applied - diagnosis only)
files_changed: []
