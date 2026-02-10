import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import cors from "cors";
import { GameRoom } from "./rooms/GameRoom";
import { LobbyRoom } from "./rooms/LobbyRoom";
import { SERVER_CONFIG } from "./config";

const app = express();
const httpServer = createServer(app);

// Enable CORS for dev (client on port 8080 accessing server on port 2567)
app.use(cors());

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
const gameServer = new Server({
  server: httpServer,
});

// Register lobby room
gameServer.define("lobby_room", LobbyRoom);

// Register game room
gameServer.define("game_room", GameRoom);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    wsLatencySimulation: parseInt(process.env.SIMULATE_LATENCY || '0', 10),
  });
});

// Add Colyseus monitor for dev debugging
app.use("/colyseus", monitor());

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
  console.log(`Banger server listening on ws://localhost:${SERVER_CONFIG.port}`);
});

export default gameServer;
