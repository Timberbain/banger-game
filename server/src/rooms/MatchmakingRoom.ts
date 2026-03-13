import { Room, Client, matchMaker } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';
import { MATCHMAKING_ROLES } from '../../../shared/lobby';
import { MatchmakingRoomJoinOptions } from '../../../shared/roomTypes';

export class QueuePlayer extends Schema {
  @type('string') preferredRole: string = '';
  @type('string') name: string = '';
}

export class MatchmakingState extends Schema {
  @type({ map: QueuePlayer }) players = new MapSchema<QueuePlayer>();
  @type('number') paranCount: number = 0;
  @type('number') faranCount: number = 0;
  @type('number') baranCount: number = 0;
  @type('number') randomCount: number = 0;
}

export class MatchmakingRoom extends Room<MatchmakingState> {
  maxClients = 50; // Allow many players to queue

  private matchCheckInterval?: any;

  onCreate() {
    this.setState(new MatchmakingState());

    // Check for matches every second
    this.matchCheckInterval = this.clock.setInterval(() => {
      this.tryFormMatch();
    }, 1000);

    // Allow browsing players to switch role when they click Queue
    this.onMessage('setRole', (client, role: string) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (!MATCHMAKING_ROLES.includes(role as any) || role === 'browsing') {
        role = 'random';
      }
      player.preferredRole = role;
      this.updateCounts();
    });

    console.log('MatchmakingRoom created');
  }

  onJoin(client: Client, options?: MatchmakingRoomJoinOptions) {
    const player = new QueuePlayer();
    player.preferredRole = options?.preferredRole || 'random';
    player.name = String(options?.name || client.sessionId).substring(0, 12);

    // Validate role
    if (!MATCHMAKING_ROLES.includes(player.preferredRole as any)) {
      player.preferredRole = 'random';
    }

    this.state.players.set(client.sessionId, player);
    this.updateCounts();

    console.log(`Player joined matchmaking: ${client.sessionId} as ${player.preferredRole}`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.updateCounts();
    console.log(`Player left matchmaking: ${client.sessionId}`);
  }

  private updateCounts() {
    let paranCount = 0;
    let faranCount = 0;
    let baranCount = 0;
    let randomCount = 0;
    this.state.players.forEach((player) => {
      if (player.preferredRole === 'paran') {
        paranCount++;
      } else if (player.preferredRole === 'faran') {
        faranCount++;
      } else if (player.preferredRole === 'baran') {
        baranCount++;
      } else if (player.preferredRole === 'random') {
        randomCount++;
      }
    });
    this.state.paranCount = paranCount;
    this.state.faranCount = faranCount;
    this.state.baranCount = baranCount;
    this.state.randomCount = randomCount;

    // Broadcast count changes to all clients via message
    this.broadcast('queueCounts', { paranCount, faranCount, baranCount, randomCount });
  }

  private async tryFormMatch() {
    // Collect players by role
    const paranPool: string[] = [];
    const guardianPool: string[] = [];
    const randomPool: string[] = [];

    this.state.players.forEach((player, sessionId) => {
      if (player.preferredRole === 'paran') {
        paranPool.push(sessionId);
      } else if (player.preferredRole === 'random') {
        randomPool.push(sessionId);
      } else if (player.preferredRole !== 'browsing') {
        guardianPool.push(sessionId);
      }
    });

    // Take up to 1 from paranPool, up to 2 from guardianPool
    const matchedParan: string[] = paranPool.slice(0, 1);
    const matchedGuardians: string[] = guardianPool.slice(0, 2);

    // Fill remaining slots from randomPool
    const needParan = 1 - matchedParan.length;
    const needGuardians = 2 - matchedGuardians.length;
    const totalNeeded = needParan + needGuardians;

    if (totalNeeded > randomPool.length) {
      // Not enough players to form a match
      if (matchedParan.length + matchedGuardians.length + randomPool.length < 3) return;
      return; // Can't fill remaining slots
    }

    // Fill paran first, then guardians from random pool
    const randomForParan = randomPool.slice(0, needParan);
    const randomForGuardians = randomPool.slice(needParan, needParan + needGuardians);

    const allParan = [...matchedParan, ...randomForParan];
    const allGuardians = [...matchedGuardians, ...randomForGuardians];

    if (allParan.length < 1 || allGuardians.length < 2) return;

    const matchedIds = [...allParan, ...allGuardians];

    // Build role assignments
    const roleAssignments: Record<string, string> = {};
    roleAssignments[allParan[0]] = 'paran';

    // Assign guardian roles: respect preferences, use crossover logic
    const g1Player = this.state.players.get(allGuardians[0]);
    roleAssignments[allGuardians[0]] = g1Player?.preferredRole === 'baran' ? 'baran' : 'faran';
    roleAssignments[allGuardians[1]] =
      roleAssignments[allGuardians[0]] === 'faran' ? 'baran' : 'faran';

    try {
      // Create a lobby room for the matched players
      const lobbyRoom = await matchMaker.createRoom('lobby_room', {
        fromMatchmaking: true,
      });

      console.log(`Match formed! Lobby: ${lobbyRoom.roomId}, Players: ${matchedIds.join(', ')}`);

      // Notify matched players with the lobby roomId and their assigned roles
      matchedIds.forEach((sessionId) => {
        const client = this.clients.find((c) => c.sessionId === sessionId);
        if (client) {
          client.send('matchFound', {
            lobbyRoomId: lobbyRoom.roomId,
            assignedRole: roleAssignments[sessionId],
          });
        }
      });

      // Remove matched players from queue
      matchedIds.forEach((sessionId) => {
        this.state.players.delete(sessionId);
      });
      this.updateCounts();
    } catch (error) {
      console.error('Failed to create lobby for match:', error);
    }
  }

  onDispose() {
    if (this.matchCheckInterval) {
      this.matchCheckInterval.clear();
    }
    console.log('MatchmakingRoom disposed');
  }
}
