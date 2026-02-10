"use strict";
/**
 * Room code generation utility
 * Generates short alphanumeric codes for private lobbies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRoomCode = generateRoomCode;
// Excludes ambiguous characters (0/O, 1/I/L)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/**
 * Generate a random room code
 * @param length Code length (default 6)
 * @returns Random alphanumeric code
 */
function generateRoomCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * CHARS.length);
        code += CHARS[randomIndex];
    }
    return code;
}
//# sourceMappingURL=roomCode.js.map