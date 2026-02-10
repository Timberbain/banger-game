"use strict";
/**
 * Lobby system constants shared between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_LIMITS = exports.VALID_ROLES = exports.LOBBY_CONFIG = void 0;
exports.LOBBY_CONFIG = {
    MAX_PLAYERS: 3,
    ROOM_CODE_LENGTH: 6,
    LOBBY_RECONNECT_GRACE: 30, // seconds
    MATCH_RECONNECT_GRACE: 60, // seconds
    QUEUE_TIMEOUT: 120000, // ms (2 minutes)
    COUNTDOWN_SECONDS: 3,
};
exports.VALID_ROLES = ["paran", "faran", "baran"];
exports.ROLE_LIMITS = {
    paran: 1,
    faran: 1,
    baran: 1,
};
//# sourceMappingURL=lobby.js.map