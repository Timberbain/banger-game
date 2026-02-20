import { Room, Client, matchMaker } from 'colyseus';
import { LobbyState, LobbyPlayer } from '../schema/LobbyState';
import { generateRoomCode } from '../utils/roomCode';
import { LOBBY_CONFIG, VALID_ROLES, ROLE_LIMITS } from '../../../shared/lobby';
import { matchmakingQueue } from './MatchmakingQueue';

/**
 * Pre-match lobby room
 * Handles character selection, ready system, and transition to GameRoom
 */
export class LobbyRoom extends Room<LobbyState> {
  maxClients = LOBBY_CONFIG.MAX_PLAYERS;
  private countdownInterval?: any;
  private matchmakingCheckInterval?: any;

  onCreate(options: any) {
    this.setState(new LobbyState());

    // Setup private room if requested
    if (options.private) {
      this.state.roomCode = generateRoomCode(LOBBY_CONFIG.ROOM_CODE_LENGTH);
      this.state.isPrivate = true;
      this.setPrivate(true); // Hide from matchmaking
      this.setMetadata({ roomCode: this.state.roomCode });
      console.log(`Private lobby created with code: ${this.state.roomCode}`);
    }

    // Register message handlers
    this.onMessage('selectRole', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const { role } = message;

      // Validate role
      if (!VALID_ROLES.includes(role)) {
        client.send('roleError', { error: 'Invalid role' });
        return;
      }

      // Check if role is already taken by another player
      let roleTaken = false;
      this.state.players.forEach((p, sessionId) => {
        if (sessionId !== client.sessionId && p.role === role) {
          roleTaken = true;
        }
      });

      if (roleTaken) {
        client.send('roleError', { error: 'Role already taken' });
        return;
      }

      // Assign role and un-ready player (changing role requires re-ready)
      player.role = role;
      player.ready = false;

      console.log(`Player ${client.sessionId} selected role: ${role}`);
    });

    this.onMessage('deselectRole', (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      player.role = '';
      player.ready = false;

      console.log(`Player ${client.sessionId} deselected role`);

      // Cancel countdown if active (role distribution now invalid)
      if (this.countdownInterval) {
        this.countdownInterval.clear();
        this.countdownInterval = undefined;
        this.state.countdown = 0;
      }
    });

    this.onMessage('toggleReady', (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Only allow ready toggle if player has selected a role
      if (!player.role) {
        return;
      }

      player.ready = !player.ready;
      console.log(`Player ${client.sessionId} ready: ${player.ready}`);

      // Check if we can start
      this.checkReadyToStart();
    });

    this.onMessage('joinQueue', (client, message) => {
      const { preferredRole } = message;
      if (!VALID_ROLES.includes(preferredRole)) {
        return;
      }
      matchmakingQueue.addToQueue(client.sessionId, preferredRole);
    });

    this.onMessage('leaveQueue', (client, message) => {
      matchmakingQueue.removeFromQueue(client.sessionId);
    });

    // Periodic matchmaking check (every 1 second)
    this.matchmakingCheckInterval = this.clock.setInterval(() => {
      const match = matchmakingQueue.tryFormMatch();
      if (match) {
        // TODO: Create lobby room for matched players
        // This requires creating reservations for specific clients, which is complex
        // For now, just log that a match was found
        console.log('Match found via matchmaking:', match);
      }

      // Check for timeouts
      const timedOut = matchmakingQueue.checkTimeouts(LOBBY_CONFIG.QUEUE_TIMEOUT);
      if (timedOut.length > 0) {
        console.log('Players timed out from queue:', timedOut);
      }
    }, 1000);

    console.log(`LobbyRoom created with roomId: ${this.roomId}`);
  }

  onJoin(client: Client, options?: any) {
    const player = new LobbyPlayer();

    // Set player name (truncate to 20 chars, fallback to sessionId prefix)
    if (options?.name) {
      player.name = String(options.name).substring(0, 20);
    } else {
      player.name = client.sessionId.substring(0, 20);
    }

    player.connected = true;

    this.state.players.set(client.sessionId, player);

    console.log(`Player joined lobby: ${client.sessionId} (${player.name})`);
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    // Remove from matchmaking queue
    matchmakingQueue.removeFromQueue(client.sessionId);

    player.connected = false;

    if (consented) {
      // Player explicitly left, remove immediately
      this.state.players.delete(client.sessionId);
      console.log(`Player left lobby (consented): ${client.sessionId}`);
    } else {
      // Player disconnected, allow reconnection
      try {
        await this.allowReconnection(client, LOBBY_CONFIG.LOBBY_RECONNECT_GRACE);
        // Reconnected successfully
        player.connected = true;
        console.log(`Player reconnected to lobby: ${client.sessionId}`);
      } catch (e) {
        // Reconnection timeout, remove player
        this.state.players.delete(client.sessionId);
        console.log(`Player reconnection timeout, removed: ${client.sessionId}`);
      }
    }

    // Cancel countdown if someone left
    if (this.countdownInterval) {
      this.countdownInterval.clear();
      this.countdownInterval = undefined;
      this.state.countdown = 0;
    }
  }

  /**
   * Check if all conditions are met to start countdown
   */
  private checkReadyToStart() {
    const players = Array.from(this.state.players.values());

    // Need exactly 3 players
    if (players.length !== LOBBY_CONFIG.MAX_PLAYERS) {
      return;
    }

    // All must be connected
    if (!players.every((p) => p.connected)) {
      return;
    }

    // All must have a role
    if (!players.every((p) => p.role)) {
      return;
    }

    // All must be ready
    if (!players.every((p) => p.ready)) {
      // If someone un-readied during countdown, cancel it
      if (this.countdownInterval) {
        this.countdownInterval.clear();
        this.countdownInterval = undefined;
        this.state.countdown = 0;
      }
      return;
    }

    // Check role distribution: exactly 1 of each role
    const roleCounts: Record<string, number> = {
      paran: 0,
      faran: 0,
      baran: 0,
    };

    players.forEach((p) => {
      if (p.role in roleCounts) {
        roleCounts[p.role]++;
      }
    });

    const validDistribution =
      roleCounts.paran === 1 && roleCounts.faran === 1 && roleCounts.baran === 1;

    if (!validDistribution) {
      return;
    }

    // All conditions met, start countdown
    this.startCountdown();
  }

  /**
   * Start the match countdown
   */
  private startCountdown() {
    // Prevent multiple countdowns
    if (this.countdownInterval) {
      return;
    }

    this.state.countdown = LOBBY_CONFIG.COUNTDOWN_SECONDS;

    this.countdownInterval = this.clock.setInterval(() => {
      this.state.countdown--;

      if (this.state.countdown <= 0) {
        this.countdownInterval.clear();
        this.countdownInterval = undefined;
        this.startMatch();
      }
    }, 1000);

    console.log('Countdown started');
  }

  /**
   * Create GameRoom and transition all players
   */
  private async startMatch() {
    // Build role assignments for GameRoom
    const roleAssignments: Record<string, string> = {};
    this.state.players.forEach((player, sessionId) => {
      roleAssignments[sessionId] = player.role;
    });

    try {
      // Create GameRoom with lobby-assigned roles
      const room = await matchMaker.createRoom('game_room', {
        fromLobby: true,
        roleAssignments,
      });

      // Notify all clients that the game is ready
      this.broadcast('gameReady', {
        gameRoomId: room.roomId,
      });

      console.log(`Game created: ${room.roomId}`);

      // Dispose lobby after clients transition (5 second grace period)
      this.clock.setTimeout(() => {
        this.disconnect();
      }, 5000);
    } catch (error) {
      console.error('Failed to create game room:', error);
      // Reset countdown on error
      this.state.countdown = 0;
    }
  }

  onDispose() {
    if (this.countdownInterval) {
      this.countdownInterval.clear();
    }
    if (this.matchmakingCheckInterval) {
      this.matchmakingCheckInterval.clear();
    }
    console.log(`LobbyRoom disposed: ${this.roomId}`);
  }
}
