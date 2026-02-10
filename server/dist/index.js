"use strict";
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
// Add Colyseus monitor for dev debugging
app.use("/colyseus", (0, monitor_1.monitor)());
// Start server
httpServer.listen(config_1.SERVER_CONFIG.port, () => {
    console.log(`Banger server listening on ws://localhost:${config_1.SERVER_CONFIG.port}`);
});
exports.default = gameServer;
//# sourceMappingURL=index.js.map