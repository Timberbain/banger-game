import express from 'express';
import { createServer } from 'http';
import { Server, matchMaker } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import cors from 'cors';
import { GameRoom } from './rooms/GameRoom';
import { LobbyRoom } from './rooms/LobbyRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { SERVER_CONFIG } from './config';

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
gameServer.define('lobby_room', LobbyRoom);

// Register matchmaking room
gameServer.define('matchmaking_room', MatchmakingRoom);

// Register game room
gameServer.define('game_room', GameRoom);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    wsLatencySimulation: parseInt(process.env.SIMULATE_LATENCY || '0', 10),
  });
});

// Room code lookup endpoint for private lobbies
app.get('/rooms/find', async (req, res) => {
  const code = (req.query.code as string)?.toUpperCase();

  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'Invalid room code' });
  }

  try {
    // Query all lobby rooms
    const rooms = await matchMaker.query({ name: 'lobby_room' });

    // Find room with matching code in metadata
    const matchingRoom = rooms.find((room) => room.metadata?.roomCode === code);

    if (!matchingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({ roomId: matchingRoom.roomId });
  } catch (error) {
    console.error('Error finding room:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add Colyseus monitor for dev debugging
app.use('/colyseus', monitor());

// Process-level error safety net -- prevent unhandled errors from crashing server
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
  // Log but don't exit -- Colyseus rooms should handle their own errors
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
  // Log but don't exit
});

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
  console.log(`Banger server listening on ws://localhost:${SERVER_CONFIG.port}`);
});

export default gameServer;
