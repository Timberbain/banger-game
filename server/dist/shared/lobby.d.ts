/**
 * Lobby system constants shared between client and server
 */
export declare const LOBBY_CONFIG: {
    MAX_PLAYERS: number;
    ROOM_CODE_LENGTH: number;
    LOBBY_RECONNECT_GRACE: number;
    MATCH_RECONNECT_GRACE: number;
    QUEUE_TIMEOUT: number;
    COUNTDOWN_SECONDS: number;
};
export declare const VALID_ROLES: readonly ["paran", "faran", "baran"];
export declare const ROLE_LIMITS: {
    paran: number;
    faran: number;
    baran: number;
};
