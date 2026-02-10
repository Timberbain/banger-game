import { Room } from 'colyseus.js';
import {
  applyMovementPhysics,
  updateFacingDirection,
  InputState,
  PHYSICS,
} from '../../../shared/physics';

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
}

export class PredictionSystem {
  private inputSequence: number = 0;
  private pendingInputs: PendingInput[] = [];
  private localState: PlayerState;

  constructor(initialState: PlayerState) {
    this.localState = { ...initialState };
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
    });

    // Apply prediction locally (same physics as server)
    applyMovementPhysics(this.localState, input, 1 / 60);
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

    // Replay all remaining pending inputs
    for (const pending of this.pendingInputs) {
      applyMovementPhysics(this.localState, pending.input, 1 / 60);
      updateFacingDirection(this.localState);
    }
  }

  getState(): PlayerState {
    return this.localState;
  }

  reset(state: PlayerState): void {
    this.localState = { ...state };
    this.pendingInputs = [];
  }
}
