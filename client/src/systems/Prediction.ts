import { Room } from 'colyseus.js';
import {
  applyMovementPhysics,
  updateFacingDirection,
  InputState,
  PHYSICS,
  NETWORK,
  ARENA,
} from '../../../shared/physics';
import { CHARACTERS, COMBAT } from '../../../shared/characters';
import { CollisionGrid, resolveCollisions } from '../../../shared/collisionGrid';

interface PendingInput {
  seq: number;
  input: InputState;
}

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  role?: string;
}

export class PredictionSystem {
  private inputSequence: number = 0;
  private pendingInputs: PendingInput[] = [];
  private localState: PlayerState;
  private role: string;
  private collisionGrid: CollisionGrid | null = null;
  private arenaBounds: { width: number; height: number };
  private speedMultiplier: number = 1;
  /** True only on the first frame of a new wall contact (rising edge). */
  private hadCollision: boolean = false;
  /** Tracks whether the player was already against a wall last frame. */
  private wasAgainstWall: boolean = false;

  constructor(
    initialState: PlayerState,
    role: string,
    arenaBounds?: { width: number; height: number },
  ) {
    this.localState = { ...initialState, role };
    this.role = role;
    this.arenaBounds = arenaBounds || ARENA;
  }

  setCollisionGrid(grid: CollisionGrid | null): void {
    this.collisionGrid = grid;
  }

  setArenaBounds(bounds: { width: number; height: number }): void {
    this.arenaBounds = bounds;
  }

  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  clearCollisionTile(tileX: number, tileY: number): void {
    if (this.collisionGrid) this.collisionGrid.clearTile(tileX, tileY);
  }

  sendInput(input: InputState, room: Room): void {
    // Increment input sequence
    this.inputSequence++;

    // Send to server with sequence number
    room.send('input', {
      seq: this.inputSequence,
      left: input.left,
      right: input.right,
      up: input.up,
      down: input.down,
      fire: input.fire || false,
    });

    // Get character stats for prediction
    const stats = CHARACTERS[this.role];

    // Capture position before physics for collision resolution
    const prevX = this.localState.x;
    const prevY = this.localState.y;

    // Apply prediction locally (same physics as server)
    applyMovementPhysics(this.localState, input, NETWORK.fixedDtSeconds, {
      acceleration: stats.acceleration,
      drag: stats.drag,
      maxVelocity: stats.maxVelocity * this.speedMultiplier,
    });
    updateFacingDirection(this.localState);

    // Apply tile collision (must match server)
    if (this.collisionGrid) {
      const result = resolveCollisions(
        this.localState,
        COMBAT.playerRadius,
        this.collisionGrid,
        prevX,
        prevY,
      );
      const hitWall = result.hitX || result.hitY;
      if (hitWall) {
        // Rising-edge detection: only signal hadCollision on the FIRST frame of contact
        if (!this.wasAgainstWall) {
          this.hadCollision = true;
        }
        this.wasAgainstWall = true;
        if (this.role === 'paran') {
          // Paran wall penalty: lose ALL velocity on any collision
          this.localState.vx = 0;
          this.localState.vy = 0;
        } else {
          // Guardian: only zero the axis that hit
          if (result.hitX) this.localState.vx = 0;
          if (result.hitY) this.localState.vy = 0;
        }
      } else {
        this.wasAgainstWall = false;
      }
    }

    // Safety net edge clamp (same as server)
    this.localState.x = Math.max(0, Math.min(this.arenaBounds.width, this.localState.x));
    this.localState.y = Math.max(0, Math.min(this.arenaBounds.height, this.localState.y));

    // Store pending input for reconciliation
    this.pendingInputs.push({
      seq: this.inputSequence,
      input: { ...input },
    });
  }

  reconcile(serverState: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    lastProcessedSeq: number;
  }): void {
    // Discard acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((p) => p.seq > serverState.lastProcessedSeq);

    // Reset local state to server authoritative state
    this.localState.x = serverState.x;
    this.localState.y = serverState.y;
    this.localState.vx = serverState.vx;
    this.localState.vy = serverState.vy;
    this.localState.angle = serverState.angle;

    // Get character stats for prediction replay
    const stats = CHARACTERS[this.role];

    // Replay all remaining pending inputs
    for (const pending of this.pendingInputs) {
      const prevX = this.localState.x;
      const prevY = this.localState.y;

      applyMovementPhysics(this.localState, pending.input, 1 / 60, {
        acceleration: stats.acceleration,
        drag: stats.drag,
        maxVelocity: stats.maxVelocity * this.speedMultiplier,
      });
      updateFacingDirection(this.localState);

      // Apply tile collision during replay (physics only -- do NOT set hadCollision
      // because replay is historical, not a new collision event for effects)
      if (this.collisionGrid) {
        const result = resolveCollisions(
          this.localState,
          COMBAT.playerRadius,
          this.collisionGrid,
          prevX,
          prevY,
        );
        if (result.hitX || result.hitY) {
          if (this.role === 'paran') {
            this.localState.vx = 0;
            this.localState.vy = 0;
          } else {
            if (result.hitX) this.localState.vx = 0;
            if (result.hitY) this.localState.vy = 0;
          }
        }
      }

      // Safety net edge clamp
      this.localState.x = Math.max(0, Math.min(this.arenaBounds.width, this.localState.x));
      this.localState.y = Math.max(0, Math.min(this.arenaBounds.height, this.localState.y));
    }
  }

  getState(): PlayerState {
    return this.localState;
  }

  /**
   * Returns true if a tile collision occurred since the last call, then resets the flag.
   * Used by GameScene to trigger wall impact effects only on actual collisions.
   */
  getHadCollision(): boolean {
    const value = this.hadCollision;
    this.hadCollision = false;
    return value;
  }

  reset(state: PlayerState): void {
    this.localState = { ...state, role: this.role };
    this.pendingInputs = [];
  }
}
