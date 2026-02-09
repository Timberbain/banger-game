import express from "express";
import { createServer } from "http";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor";
import { GameRoom } from "./rooms/GameRoom";
import { SERVER_CONFIG } from "./config";

const app = express();
const httpServer = createServer(app);

// Create Colyseus server
const gameServer = new Server({
  server: httpServer,
});

// Register game room
gameServer.define("game_room", GameRoom);

// Add Colyseus monitor for dev debugging
app.use("/colyseus", monitor());

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
  console.log(`Banger server listening on ws://localhost:${SERVER_CONFIG.port}`);
});

export default gameServer;
