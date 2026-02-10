import { Room } from 'colyseus.js';
import {
  applyMovementPhysics,
  updateFacingDirection,
  InputState,
  PHYSICS,
} from '../../../shared/physics';
import { CHARACTERS } from '../../../shared/characters';

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

  constructor(initialState: PlayerState, role: string) {
    this.localState = { ...initialState, role };
    this.role = role;
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

    // Apply prediction locally (same physics as server)
    applyMovementPhysics(this.localState, input, 1 / 60, {
      acceleration: stats.acceleration,
      drag: stats.drag,
      maxVelocity: stats.maxVelocity,
    });
    updateFacingDirection(this.localState);

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
    this.pendingInputs = this.pendingInputs.filter(
      (p) => p.seq > serverState.lastProcessedSeq
    );

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
      applyMovementPhysics(this.localState, pending.input, 1 / 60, {
        acceleration: stats.acceleration,
        drag: stats.drag,
        maxVelocity: stats.maxVelocity,
      });
      updateFacingDirection(this.localState);
    }
  }

  getState(): PlayerState {
    return this.localState;
  }

  reset(state: PlayerState): void {
    this.localState = { ...state, role: this.role };
    this.pendingInputs = [];
  }
}
