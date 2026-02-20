import { Schema, type, MapSchema } from '@colyseus/schema';

/**
 * Player state within a lobby
 */
export class LobbyPlayer extends Schema {
  @type('string') name: string = '';
  @type('string') role: string = ''; // empty = not selected
  @type('boolean') ready: boolean = false;
  @type('boolean') connected: boolean = true;
}

/**
 * Lobby room state
 * Manages pre-match player setup with character selection and ready system
 */
export class LobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
  @type('string') roomCode: string = '';
  @type('boolean') isPrivate: boolean = false;
  @type('number') countdown: number = 0; // seconds remaining, 0 = not counting
}
