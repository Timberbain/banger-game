---
status: diagnosed
trigger: "Investigate why the geometry mask iris wipe transition is not rendering during stage transitions"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED - The circle shape has no fill, so nothing is rendered to the stencil buffer, causing the geometry mask to clip everything immediately.
test: Traced through Phaser 3 source code: Arc constructor, Shape defaults, ArcWebGLRenderer, GeometryMask.applyStencil
expecting: N/A - root cause found
next_action: Return diagnosis

## Symptoms

expected: Circular iris wipe animation - circle shrinks from full screen to zero (close), then expands from zero to full screen (open) during stage transitions
actual: Screen just turns dark (hard cut to black), stage intro appears, goes back to dark, then next stage starts. No circular iris wipe animation visible.
errors: None reported
reproduction: Complete a stage in a multi-stage match to trigger stage transition
started: After Plan 09-04 added geometry mask iris wipe

## Eliminated

- hypothesis: setVisible(false) prevents geometry mask from working
  evidence: GeometryMask.applyStencil() calls geometryMask.renderWebGL() directly, bypassing the normal render pipeline visibility check. setVisible(false) does not prevent stencil buffer rendering.
  timestamp: 2026-02-16

## Evidence

- timestamp: 2026-02-16
  checked: GameScene.ts stageEnd handler (line 365)
  found: Circle created with `this.add.circle(cx, cy, maxRadius)` -- no fillColor parameter
  implication: Arc constructor only calls setFillStyle if fillColor !== undefined; without it, isFilled stays false

- timestamp: 2026-02-16
  checked: Phaser source - Arc.js constructor (line 116-119)
  found: `if (fillColor !== undefined) { this.setFillStyle(fillColor, fillAlpha); }` -- fillColor is undefined since not passed
  implication: isFilled remains false (Shape.js default, line 149)

- timestamp: 2026-02-16
  checked: Phaser source - ArcWebGLRenderer.js (line 42-45)
  found: `if (src.isFilled) { FillPathWebGL(...) }` -- since isFilled=false, NO geometry is rendered to stencil buffer
  implication: Empty stencil buffer means stencil test fails for ALL pixels, making everything invisible immediately

- timestamp: 2026-02-16
  checked: Phaser source - GeometryMask.js applyStencil() (line 196)
  found: Calls `geometryMask.renderWebGL(renderer, geometryMask, camera)` which goes to ArcWebGLRenderer
  implication: Confirms the rendering chain: GeometryMask -> ArcWebGLRenderer -> FillPathWebGL (skipped due to isFilled=false)

## Resolution

root_cause: The iris wipe circle is created without a fill color (`this.add.circle(cx, cy, maxRadius)` with no 4th argument), so `isFilled` stays `false`. When the geometry mask renders this circle to the stencil buffer via ArcWebGLRenderer, the `if (src.isFilled)` check skips all rendering, leaving an empty stencil. An empty stencil clips everything, causing an instant black screen instead of a gradual iris wipe.
fix: Pass a fill color to the circle creation: `this.add.circle(cx, cy, maxRadius, 0xffffff)`
verification:
files_changed: []
