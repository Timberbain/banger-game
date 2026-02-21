/**
 * Shared type definitions for room boundaries (options, messages, map JSON).
 * Eliminates `any` types at server/client interface boundaries.
 */

// ─── GameRoom ─────────────────────────────────────────

export interface GameRoomCreateOptions {
  fromLobby?: boolean;
  roleAssignments?: Record<string, string>;
}

export interface GameRoomJoinOptions {
  name?: string;
  role?: string;
}

// ─── LobbyRoom ────────────────────────────────────────

export interface LobbyRoomCreateOptions {
  private?: boolean;
}

export interface LobbyRoomJoinOptions {
  name?: string;
}

// ─── MatchmakingRoom ──────────────────────────────────

export interface MatchmakingRoomJoinOptions {
  preferredRole?: string;
  name?: string;
}

// ─── Tiled JSON Map ───────────────────────────────────

export interface TiledLayer {
  name: string;
  data: number[];
  width: number;
  height: number;
  type: string;
}

export interface TiledMapJSON {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets?: Array<{ firstgid: number; name: string }>;
}
