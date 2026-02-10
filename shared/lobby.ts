/**
 * Lobby system constants shared between client and server
 */

export const LOBBY_CONFIG = {
  MAX_PLAYERS: 3,
  ROOM_CODE_LENGTH: 6,
  LOBBY_RECONNECT_GRACE: 30, // seconds
  MATCH_RECONNECT_GRACE: 60, // seconds
  QUEUE_TIMEOUT: 120000, // ms (2 minutes)
  COUNTDOWN_SECONDS: 3,
};

export const VALID_ROLES = ["paran", "faran", "baran"] as const;

export const ROLE_LIMITS = {
  paran: 1,
  faran: 1,
  baran: 1,
};
