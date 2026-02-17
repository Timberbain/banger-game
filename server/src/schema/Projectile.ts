import { Schema, type } from '@colyseus/schema';

export class Projectile extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') vx: number = 0;
  @type('number') vy: number = 0;
  @type('string') ownerId: string = '';
  @type('number') damage: number = 0;
  @type('number') spawnTime: number = 0;
  @type('boolean') isBeam: boolean = false;
  @type('uint8') hitboxScale: number = 1;
}
