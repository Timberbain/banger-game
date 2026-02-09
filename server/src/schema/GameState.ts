import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") health: number = 100;
  @type("string") name: string = "";
  @type("number") angle: number = 0; // facing direction in radians
  @type("string") role: string = ""; // "guardian" or "paran" in later phases

  // NOT decorated with @type -- server-only, not synced to clients
  inputQueue: any[] = [];
}

export class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") serverTime: number = 0;
  @type("string") mapName: string = "test_arena";
  @type("number") tickCount: number = 0;
}
