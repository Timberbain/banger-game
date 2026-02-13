# TypeScript Backend Refactoring Checklist

## Table of Contents
- [Code Duplication](#code-duplication)
- [Method Decomposition](#method-decomposition)
- [Type Safety](#type-safety)
- [Error Handling](#error-handling)
- [Shared Code](#shared-code)
- [Review Template](#review-template)

## Code Duplication

### Common Duplication Patterns

**Guard clause retrieval** — repeated `get + null check` for stateful entities:

```typescript
// BEFORE: duplicated 7+ times across rooms
const player = this.state.players.get(client.sessionId);
if (!player) return;
```

**Fix:** Extract to a base class or utility:

```typescript
// Base room helper
protected getPlayer(client: Client): Player | undefined {
  return this.state.players.get(client.sessionId);
}

// Usage — still check null but remove boilerplate
const player = this.getPlayer(client);
if (!player) return;
```

**Reconnection logic** — duplicated across room types:

```typescript
// Extract to mixin or base class
protected async handleReconnection(
  client: Client,
  player: { connected: boolean },
  gracePeriod: number,
  onTimeout: () => void
) {
  player.connected = false;
  try {
    await this.allowReconnection(client, gracePeriod);
    player.connected = true;
  } catch {
    onTimeout();
  }
}
```

**Role assignment** — spread across 3 files:

```typescript
// Centralize in shared/roles.ts
export function buildRoleAssignments(
  players: Map<string, { role: string }>,
): Record<string, string> {
  const assignments: Record<string, string> = {};
  players.forEach((p, id) => { assignments[id] = p.role; });
  return assignments;
}
```

### Detection Heuristic
If the same 3+ lines appear in 2+ places, extract. If a pattern appears in 3+ places, create a utility.

## Method Decomposition

### When to Extract Methods

A method needs decomposition when:
- It exceeds ~80 lines
- It has multiple levels of nested loops/conditionals
- You can identify distinct "phases" (input → physics → collision → win check)
- Comments act as section headers within the method

### Decomposition Pattern for Game Loops

```typescript
// BEFORE: 200+ line fixedTick
fixedTick(dt: number) {
  // ... input processing (50 lines)
  // ... physics update (40 lines)
  // ... collision resolution (50 lines)
  // ... projectile updates (30 lines)
  // ... win condition checks (30 lines)
}

// AFTER: orchestrator with focused methods
fixedTick(dt: number) {
  this.processPlayerInputs(dt);
  this.updatePhysics(dt);
  this.resolveCollisions();
  this.updateProjectiles(dt);
  this.checkWinConditions();
}
```

Each extracted method should:
- Have a single, clear responsibility
- Be independently testable
- Accept only the parameters it needs
- Return results rather than mutate distant state (when practical)

### Naming Conventions
- `process*` — transforms input into state changes
- `update*` — advances simulation by timestep
- `resolve*` — fixes conflicts (collisions, overlaps)
- `check*` — evaluates conditions, may trigger events
- `handle*` — responds to external events (messages, joins)

## Type Safety

### Eliminate `any` Where Possible

**Room options:** Define an interface instead of `any`:

```typescript
interface GameRoomOptions {
  roleAssignments: Record<string, string>;
  mapName: string;
}

onCreate(options: GameRoomOptions) { ... }
```

**Input messages:** Use discriminated unions:

```typescript
type ClientMessage =
  | { type: "input"; seq: number; up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean }
  | { type: "selectRole"; role: "paran" | "faran" | "baran" }
  | { type: "toggleReady" };
```

**Colyseus interval refs:** Use `ReturnType<typeof setTimeout>` or Colyseus's `Delayed` type.

### Const Assertions for Exhaustive Checking

```typescript
export const VALID_ROLES = ["paran", "faran", "baran"] as const;
export type Role = typeof VALID_ROLES[number]; // "paran" | "faran" | "baran"

// Type-safe role check (no `as any` needed)
function isValidRole(role: string): role is Role {
  return (VALID_ROLES as readonly string[]).includes(role);
}
```

### Record vs Map
- Use `Record<string, T>` for static config objects
- Use `Map<string, T>` for runtime collections that grow/shrink
- Use Colyseus `MapSchema<T>` only for state that must sync to clients

## Error Handling

### Layered Error Strategy

```
Layer 1: Input validation  → Silent reject (return early)
Layer 2: Business logic    → Try-catch with state recovery
Layer 3: Room lifecycle    → onUncaughtException (log, don't crash)
Layer 4: Process           → uncaughtException handler (log, don't exit)
```

### When to Throw vs Return
- **Throw:** Programmer errors, impossible states, invariant violations
- **Return early:** Invalid client input, missing entities, race conditions
- **Try-catch:** External calls (matchmaker, DB), async operations

### Structured Logging Upgrade Path

```typescript
// Minimal structured logger (no dependency)
const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(JSON.stringify({ level: "info", msg, ...ctx, ts: Date.now() })),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(JSON.stringify({ level: "error", msg, ...ctx, ts: Date.now() })),
};

// Usage
log.info("Player joined", { sessionId: client.sessionId, role });
log.error("Room creation failed", { error: err.message, roomType: "game_room" });
```

## Shared Code

### Rules for Shared Modules
1. **No environment-specific imports** — no `fs`, no `Phaser`, no `express`
2. **Pure functions preferred** — input → output, no side effects
3. **Single source of truth** — game constants live in one place
4. **Interface-driven contracts** — define shapes in shared, implement in server/client

### Shared Module Structure

```
shared/
├── types.ts        — interfaces and type definitions
├── constants.ts    — game balance, physics, arena config
├── physics.ts      — movement, collision math
├── validation.ts   — input validation, role checks
└── utils.ts        — pure helper functions
```

### When to Share vs Duplicate
- **Share:** Physics, game rules, constants, validation, types
- **Keep separate:** Rendering, networking, file I/O, platform-specific APIs

## Review Template

When reviewing code, evaluate against these categories and provide specific fixes:

```
## Code Review: [file/module]

### Duplication
- [ ] No repeated guard clauses (extract helper)
- [ ] No duplicated business logic across rooms
- [ ] Common patterns extracted to utilities

### Structure
- [ ] No methods over 80 lines
- [ ] Single responsibility per method
- [ ] Clear naming (process/update/resolve/check/handle)

### Type Safety
- [ ] No unnecessary `any` types
- [ ] Input validation at boundaries
- [ ] Const assertions for literal unions

### Error Handling
- [ ] Validation before processing
- [ ] Try-catch around external calls
- [ ] Room-level exception isolation

### Performance
- [ ] Minimal player iterations per tick
- [ ] No unnecessary allocations in hot paths
- [ ] Intervals cleaned up in onDispose

### Shared Code
- [ ] No environment imports in shared modules
- [ ] Constants defined once, imported everywhere
- [ ] Interfaces define contracts between layers
```
