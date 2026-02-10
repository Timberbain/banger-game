import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { InputState } from "../../../shared/physics";
import { Projectile } from "./Projectile";

export enum MatchState {
  WAITING = "waiting",
  PLAYING = "playing",
  ENDED = "ended"
}

export class PlayerStats extends Schema {
  @type("number") kills: number = 0;
  @type("number") deaths: number = 0;
  @type("number") damageDealt: number = 0;
  @type("number") shotsFired: number = 0;
  @type("number") shotsHit: number = 0;
}

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0; // velocity X (synced for client prediction)
  @type("number") vy: number = 0; // velocity Y (synced for client prediction)
  @type("number") health: number = 100;
  @type("string") name: string = "";
  @type("number") angle: number = 0; // facing direction in radians
  @type("string") role: string = ""; // "guardian" or "paran" in later phases
  @type("number") lastProcessedSeq: number = 0; // for client reconciliation
  @type("boolean") connected: boolean = true; // connection status synced to clients

  // NOT decorated with @type -- server-only, not synced to clients
  inputQueue: Array<{ seq: number } & InputState> = [];
  lastFireTime: number = 0; // server-only cooldown tracking
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type([Projectile]) projectiles = new ArraySchema<Projectile>();
  @type("number") serverTime: number = 0;
  @type("string") mapName: string = "test_arena";
  @type("number") tickCount: number = 0;
  @type("string") matchState: string = MatchState.WAITING;
  @type("number") matchStartTime: number = 0;
  @type("number") matchEndTime: number = 0;
  @type({ map: PlayerStats }) matchStats = new MapSchema<PlayerStats>();
  @type("string") winner: string = "";
}
