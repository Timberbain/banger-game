---
status: diagnosed
trigger: "matchmaking → lobby: pre-assigned role not visually highlighted with green border"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - showLobbyView() resets this.selectedRole to null on line 568, clobbering the value set on line 522
test: traced execution order
expecting: confirmed
next_action: return diagnosis

## Symptoms

expected: When entering lobby from matchmaking, the pre-assigned role panel shows green border (4px, 0x00ff00)
actual: No green border on the role panel. Role IS functionally assigned server-side, but client UI shows no highlight until manual click
errors: none (purely visual bug)
reproduction: 1) Click Find Match, 2) Select role, 3) Wait for match found, 4) Observe lobby - no green highlight on assigned role panel
started: since matchmaking was implemented

## Eliminated

## Evidence

- timestamp: 2026-02-11T00:01:00Z
  checked: matchFound handler in joinMatchmaking() (lines 496-545)
  found: |
    Line 522: this.selectedRole = data.assignedRole (sets the role)
    Line 525: this.showLobbyView() (renders lobby UI)
    Line 568 (inside showLobbyView): this.selectedRole = null (RESETS the role!)
    Execution order: set selectedRole -> call showLobbyView -> showLobbyView nulls selectedRole -> panels render with null
  implication: ROOT CAUSE CONFIRMED. showLobbyView() unconditionally resets selectedRole to null, destroying the pre-assignment.

- timestamp: 2026-02-11T00:02:00Z
  checked: Lines 528-531 -- delayed selectRole message
  found: |
    After showLobbyView(), there is a 500ms delayed call: this.room.send('selectRole', { role: data.assignedRole }).
    This sends directly to the server, bypassing the client-side selectRole() method (line 894).
    The selectRole() method is the one that sets this.selectedRole AND calls characterPanelUpdaters.
    So the delayed message fixes the SERVER state but never updates CLIENT visual state.
  implication: Even if the reset were fixed, the delayed send bypasses the UI update path.

- timestamp: 2026-02-11T00:03:00Z
  checked: updatePanel closure (line 749-770) and how green border is determined
  found: |
    updatePanel checks: const isSelected = this.selectedRole === char.role (line 750)
    If isSelected is true -> panel.setStrokeStyle(4, 0x00ff00) (green border)
    Since this.selectedRole is null after showLobbyView resets it, isSelected is always false.
  implication: Confirms the visual symptom matches the code path.

- timestamp: 2026-02-11T00:04:00Z
  checked: Manual click path via selectRole() method (line 894-908)
  found: |
    selectRole() sets this.selectedRole = role (line 902), calls this.room.send('selectRole'),
    AND calls this.characterPanelUpdaters.forEach(fn => fn()) on line 906.
    This is why manual click works -- it goes through the proper method that handles both state and UI.
  implication: The fix should route the matchmaking role assignment through the same selectRole() method, or replicate its behavior.

## Resolution

root_cause: |
  TWO compounding bugs in the matchmaking-to-lobby transition (client/src/scenes/LobbyScene.ts):

  BUG 1 (PRIMARY) - showLobbyView() clobbers pre-set selectedRole:
    Line 522: this.selectedRole = data.assignedRole  // Sets role from matchmaking
    Line 525: this.showLobbyView()                   // Immediately calls showLobbyView
    Line 568: this.selectedRole = null                // showLobbyView RESETS it to null
    Result: selectedRole is null when panels render, so no green border appears.

  BUG 2 (SECONDARY) - delayed send bypasses client UI update path:
    Lines 528-531: this.room.send('selectRole', { role: data.assignedRole })
    This sends directly to the server, bypassing the selectRole() method (line 894)
    which is responsible for setting this.selectedRole AND triggering characterPanelUpdaters.
    So server gets the role, but client visual state never updates.

fix:
verification:
files_changed: []
