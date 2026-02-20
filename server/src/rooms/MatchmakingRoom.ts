import { Room, Client, matchMaker } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';
import { VALID_ROLES } from '../../../shared/lobby';

export class QueuePlayer extends Schema {
  @type('string') preferredRole: string = '';
  @type('string') name: string = '';
}

export class MatchmakingState extends Schema {
  @type({ map: QueuePlayer }) players = new MapSchema<QueuePlayer>();
  @type('number') paranCount: number = 0;
  @type('number') guardianCount: number = 0;
}

export class MatchmakingRoom extends Room<MatchmakingState> {
  maxClients = 50; // Allow many players to queue

  private matchCheckInterval?: any;

  onCreate(options: any) {
    this.setState(new MatchmakingState());

    // Check for matches every second
    this.matchCheckInterval = this.clock.setInterval(() => {
      this.tryFormMatch();
    }, 1000);

    console.log('MatchmakingRoom created');
  }

  onJoin(client: Client, options?: any) {
    const player = new QueuePlayer();
    player.preferredRole = options?.preferredRole || 'faran';
    player.name = options?.name || client.sessionId.substring(0, 20);

    // Validate role
    if (!VALID_ROLES.includes(player.preferredRole as any)) {
      player.preferredRole = 'faran';
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
    let guardianCount = 0;
    this.state.players.forEach((player) => {
      if (player.preferredRole === 'paran') {
        paranCount++;
      } else {
        guardianCount++;
      }
    });
    this.state.paranCount = paranCount;
    this.state.guardianCount = guardianCount;
  }

  private async tryFormMatch() {
    // Collect players by role
    const paranPlayers: string[] = [];
    const guardianPlayers: string[] = [];

    this.state.players.forEach((player, sessionId) => {
      if (player.preferredRole === 'paran') {
        paranPlayers.push(sessionId);
      } else {
        guardianPlayers.push(sessionId);
      }
    });

    // Need 1 paran + 2 guardians
    if (paranPlayers.length >= 1 && guardianPlayers.length >= 2) {
      const matchedParan = paranPlayers[0];
      const matchedGuardians = [guardianPlayers[0], guardianPlayers[1]];
      const matchedIds = [matchedParan, ...matchedGuardians];

      // Build role assignments
      const roleAssignments: Record<string, string> = {};
      const paranPlayer = this.state.players.get(matchedParan);
      roleAssignments[matchedParan] = 'paran';

      // Assign guardian roles: first guardian = faran, second = baran
      const g1Player = this.state.players.get(matchedGuardians[0]);
      const g2Player = this.state.players.get(matchedGuardians[1]);
      roleAssignments[matchedGuardians[0]] =
        g1Player?.preferredRole === 'baran' ? 'baran' : 'faran';
      roleAssignments[matchedGuardians[1]] =
        roleAssignments[matchedGuardians[0]] === 'faran' ? 'baran' : 'faran';

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
  }

  onDispose() {
    if (this.matchCheckInterval) {
      this.matchCheckInterval.clear();
    }
    console.log('MatchmakingRoom disposed');
  }
}
