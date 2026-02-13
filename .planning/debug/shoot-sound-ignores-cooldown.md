---
status: resolved
trigger: "shooting sound plays even when player is on cooldown"
created: 2026-02-12T00:00:00Z
updated: 2026-02-12T00:00:00Z
---

## Current Focus

hypothesis: Shoot SFX is triggered on every frame where fire key is held, with zero cooldown gating
test: Read the update() input handling code
expecting: SFX call has no cooldown check
next_action: Apply fix - gate SFX on same client-side cooldown approximation used for HUD

## Symptoms

expected: Shoot sound plays only when a projectile is actually created (i.e. once per cooldown period)
actual: Shoot sound plays every single frame while fire key is held down
errors: N/A (not an error, a logic bug)
reproduction: Hold spacebar during a match - hear rapid-fire sound even though projectiles only fire at cooldown rate
started: Since audio was added

## Eliminated

(none needed - root cause found on first hypothesis)

## Evidence

- timestamp: 2026-02-12T00:00:00Z
  checked: GameScene.ts lines 460-463 (shoot SFX trigger)
  found: |
    The shoot SFX is inside the `if (hasInput || hasVelocity || input.fire)` block at line 461:
    ```
    if (input.fire && this.audioManager && this.localRole) {
      this.audioManager.playSFX(`${this.localRole}_shoot`);
    }
    ```
    This triggers on EVERY frame where `input.fire` is true (fire key is held).
    There is NO cooldown check before playing the sound.
  implication: Sound plays at 60Hz while holding fire key, regardless of actual fire rate

- timestamp: 2026-02-12T00:00:00Z
  checked: GameScene.ts lines 466-473 (HUD cooldown event)
  found: |
    Immediately below the SFX code, there IS a client-side cooldown check for the HUD:
    ```
    if (input.fire && this.localRole) {
      const cooldownMs = CHARACTERS[this.localRole]?.fireRate || 200;
      const now = Date.now();
      if (now - this.lastLocalFireTime >= cooldownMs) {
        this.lastLocalFireTime = now;
        this.events.emit('localFired', { fireTime: now, cooldownMs });
      }
    }
    ```
    This correctly gates the HUD event using `lastLocalFireTime` + `cooldownMs`.
    The SFX call at line 462 is NOT inside this cooldown-gated block.
  implication: The cooldown logic exists but SFX was placed ABOVE it without the same gate

- timestamp: 2026-02-12T00:00:00Z
  checked: Server GameRoom.ts lines 394-414 (server cooldown)
  found: |
    Server correctly checks cooldown before spawning projectiles:
    `if (this.state.serverTime - player.lastFireTime >= stats.fireRate)`
    Only creates projectile when cooldown has elapsed.
  implication: Server is authoritative on actual firing; client SFX should match this cadence

## Resolution

root_cause: |
  In GameScene.ts update(), line 461-463, the shoot SFX (`this.audioManager.playSFX(...)`) is
  triggered on every frame where `input.fire` is true, with no cooldown check. The code directly
  below it (lines 466-473) has a proper client-side cooldown approximation using
  `lastLocalFireTime` and `CHARACTERS[role].fireRate`, but the SFX call was placed outside
  this gated block. The SFX should be moved inside the cooldown check so it only plays when
  a projectile would actually be created.

fix: Move the SFX call inside the existing cooldown-gated block (lines 468-472)
verification: SFX now only plays once per cooldown period, matching actual projectile creation rate
files_changed:
  - client/src/scenes/GameScene.ts
