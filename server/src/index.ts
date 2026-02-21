import express from 'express';
import { createServer } from 'http';
import { Server, matchMaker } from 'colyseus';
import { monitor } from '@colyseus/monitor';
import cors from 'cors';
import path from 'path';
import { GameRoom } from './rooms/GameRoom';
import { LobbyRoom } from './rooms/LobbyRoom';
import { MatchmakingRoom } from './rooms/MatchmakingRoom';
import { SERVER_CONFIG } from './config';

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

// CORS: only needed in development (separate client/server ports)
if (!isProduction) {
  app.use(cors());
}

// Latency simulation for testing (dev only)
const simulateLatency = parseInt(process.env.SIMULATE_LATENCY || '0', 10);
if (simulateLatency > 0) {
  console.log(`HTTP latency simulation enabled: ${simulateLatency}ms`);
  app.use((req, res, next) => {
    setTimeout(next, simulateLatency);
  });
}

// Create Colyseus server
const gameServer = new Server({
  server: httpServer,
});

// Register rooms
gameServer.define('lobby_room', LobbyRoom);
gameServer.define('matchmaking_room', MatchmakingRoom);
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
    const rooms = await matchMaker.query({ name: 'lobby_room' });
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

// Colyseus monitor: disabled in production unless explicitly enabled
if (!isProduction || process.env.ENABLE_MONITOR === '1') {
  app.use('/colyseus', monitor());
}

// Serve client static files in production
const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '../../public');
app.use(express.static(clientDistPath));

// SPA fallback: serve index.html for unmatched routes (must be after API routes)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Process-level error safety net -- prevent unhandled errors from crashing server
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection at:', promise, 'reason:', reason);
});

// Start server
httpServer.listen(SERVER_CONFIG.port, () => {
  console.log(
    `Banger server listening on port ${SERVER_CONFIG.port} (${isProduction ? 'production' : 'development'})`,
  );
});

export default gameServer;
