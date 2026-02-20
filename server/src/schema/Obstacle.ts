import { Schema, type } from '@colyseus/schema';

export class ObstacleState extends Schema {
  @type('uint8') tileX: number = 0;
  @type('uint8') tileY: number = 0;
  @type('uint8') hp: number = 0;
  @type('uint8') maxHp: number = 0;
  @type('boolean') destroyed: boolean = false;
}
