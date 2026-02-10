"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const colyseus_1 = require("colyseus");
const monitor_1 = require("@colyseus/monitor");
const cors_1 = __importDefault(require("cors"));
const GameRoom_1 = require("./rooms/GameRoom");
const LobbyRoom_1 = require("./rooms/LobbyRoom");
const MatchmakingRoom_1 = require("./rooms/MatchmakingRoom");
const config_1 = require("./config");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Enable CORS for dev (client on port 8080 accessing server on port 2567)
app.use((0, cors_1.default)());
// Latency simulation for testing (dev only)
const simulateLatency = parseInt(process.env.SIMULATE_LATENCY || '0', 10);
if (simulateLatency > 0) {
    console.log(`HTTP latency simulation enabled: ${simulateLatency}ms`);
    // Add delay middleware for HTTP requests
    app.use((req, res, next) => {
        setTimeout(next, simulateLatency);
    });
}
// Create Colyseus server
const gameServer = new colyseus_1.Server({
    server: httpServer,
});
// Register lobby room
gameServer.define("lobby_room", LobbyRoom_1.LobbyRoom);
// Register matchmaking room
gameServer.define("matchmaking_room", MatchmakingRoom_1.MatchmakingRoom);
// Register game room
gameServer.define("game_room", GameRoom_1.GameRoom);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        wsLatencySimulation: parseInt(process.env.SIMULATE_LATENCY || '0', 10),
    });
});
// Room code lookup endpoint for private lobbies
app.get('/rooms/find', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const code = (_a = req.query.code) === null || _a === void 0 ? void 0 : _a.toUpperCase();
    if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Invalid room code' });
    }
    try {
        // Query all lobby rooms
        const rooms = yield colyseus_1.matchMaker.query({ name: "lobby_room" });
        // Find room with matching code in metadata
        const matchingRoom = rooms.find(room => { var _a; return ((_a = room.metadata) === null || _a === void 0 ? void 0 : _a.roomCode) === code; });
        if (!matchingRoom) {
            return res.status(404).json({ error: 'Room not found' });
        }
        res.json({ roomId: matchingRoom.roomId });
    }
    catch (error) {
        console.error('Error finding room:', error);
        res.status(500).json({ error: 'Server error' });
    }
}));
// Add Colyseus monitor for dev debugging
app.use("/colyseus", (0, monitor_1.monitor)());
// Start server
httpServer.listen(config_1.SERVER_CONFIG.port, () => {
    console.log(`Banger server listening on ws://localhost:${config_1.SERVER_CONFIG.port}`);
});
exports.default = gameServer;
//# sourceMappingURL=index.js.map