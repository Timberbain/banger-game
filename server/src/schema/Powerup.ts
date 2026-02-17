import { Schema, type } from '@colyseus/schema';

export class PowerupState extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('uint8') powerupType: number = 0;
  @type('number') spawnTime: number = 0;
}
