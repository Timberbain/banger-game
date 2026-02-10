import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { LOBBY_CONFIG, VALID_ROLES } from '../../../shared/lobby';
import { CHARACTERS } from '../../../shared/characters';

export class LobbyScene extends Phaser.Scene {
  private client!: Client;
  private room: Room | null = null;
  private currentView: 'menu' | 'lobby' = 'menu';
  private playerName: string = 'Player';
  private selectedRole: string | null = null;

  // UI elements storage for cleanup
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private htmlInput: HTMLInputElement | null = null;
  private characterPanelUpdaters: (() => void)[] = [];

  constructor() {
    super({ key: 'LobbyScene' });
  }

  async create() {
    // Initialize Colyseus client
    this.client = new Client('ws://localhost:2567');

    // Set default player name (could be from localStorage later)
    this.playerName = localStorage.getItem('playerName') || `Player${Math.floor(Math.random() * 1000)}`;

    // Check for active session before showing menu
    await this.checkReconnection();
  }

  private async checkReconnection() {
    // Check for stored reconnection token
    const stored = localStorage.getItem('bangerActiveRoom');

    if (!stored) {
      // No active session, show menu normally
      this.showMainMenu();
      return;
    }

    try {
      const { token, timestamp } = JSON.parse(stored);

      // Check if token is expired (grace period + 30s buffer)
      const graceMs = LOBBY_CONFIG.MATCH_RECONNECT_GRACE * 1000;
      const bufferMs = 30000; // 30 seconds
      const elapsed = Date.now() - timestamp;

      if (elapsed > graceMs + bufferMs) {
        console.log('Stored session expired, clearing token');
        localStorage.removeItem('bangerActiveRoom');
        this.showMainMenu();
        return;
      }

      // Show reconnecting message
      const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
      this.uiElements.push(bg);

      const text = this.add.text(400, 300, 'Reconnecting to match...', {
        fontSize: '24px',
        color: '#ffff00'
      }).setOrigin(0.5);
      this.uiElements.push(text);

      // Attempt reconnection with retries (server may not have processed disconnect yet)
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 800; // ms

      let reconnectedRoom: Room | null = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          reconnectedRoom = await this.client.reconnect(token);
          console.log(`Successfully reconnected on attempt ${attempt}`);
          break;
        } catch (e) {
          console.log(`Reconnection attempt ${attempt}/${MAX_RETRIES} failed:`, e);
          if (attempt < MAX_RETRIES) {
            // Wait before retrying -- gives server time to process disconnect
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            text.setText(`Reconnecting to match... (attempt ${attempt + 1}/${MAX_RETRIES})`);
          }
        }
      }

      if (reconnectedRoom) {
        // Update stored token
        if (reconnectedRoom.reconnectionToken) {
          localStorage.setItem('bangerActiveRoom', JSON.stringify({
            token: reconnectedRoom.reconnectionToken,
            timestamp: Date.now()
          }));
        }

        // Go directly to game scene
        this.scene.start('GameScene', { room: reconnectedRoom });
      } else {
        throw new Error('All reconnection attempts failed');
      }

    } catch (e) {
      console.error('Reconnection failed:', e);

      // Clear expired token
      localStorage.removeItem('bangerActiveRoom');

      // Show session expired message briefly
      this.clearUI();
      const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
      this.uiElements.push(bg);

      const errorText = this.add.text(400, 300, 'Session expired', {
        fontSize: '22px',
        color: '#ff6666'
      }).setOrigin(0.5);
      this.uiElements.push(errorText);

      // Show menu after 2 seconds
      this.time.delayedCall(2000, () => this.showMainMenu());
    }
  }

  private showMainMenu() {
    this.clearUI();
    this.currentView = 'menu';

    // Dark background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.uiElements.push(bg);

    // Title
    const title = this.add.text(400, 150, 'BANGER', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Menu buttons
    const buttons = [
      { text: 'Create Private Room', color: 0x0066cc, y: 260, handler: () => this.createPrivateRoom() },
      { text: 'Join Private Room', color: 0x0066cc, y: 330, handler: () => this.showJoinInput() },
      { text: 'Find Match', color: 0x00aa44, y: 400, handler: () => this.showRoleSelectForMatchmaking() },
    ];

    buttons.forEach(btn => {
      const button = this.add.text(400, btn.y, btn.text, {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: `#${btn.color.toString(16).padStart(6, '0')}`,
        padding: { x: 24, y: 12 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerover', () => {
        const brighterColor = btn.color + 0x002222;
        button.setBackgroundColor(`#${brighterColor.toString(16).padStart(6, '0')}`);
      });
      button.on('pointerout', () => {
        button.setBackgroundColor(`#${btn.color.toString(16).padStart(6, '0')}`);
      });
      button.on('pointerdown', btn.handler);

      this.uiElements.push(button);
    });
  }

  private async createPrivateRoom() {
    this.clearUI();

    // Show loading text
    const loadingText = this.add.text(400, 300, 'Creating private room...', {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.uiElements.push(loadingText);

    try {
      this.room = await this.client.create('lobby_room', {
        private: true,
        name: this.playerName
      });

      console.log('Created private room:', this.room.id);
      this.showLobbyView();
    } catch (e) {
      console.error('Failed to create private room:', e);
      loadingText.setText('Failed to create room. Press any key to retry.');
      this.input.keyboard?.once('keydown', () => this.showMainMenu());
    }
  }

  private showJoinInput() {
    this.clearUI();

    // Background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.uiElements.push(bg);

    // Label
    const label = this.add.text(400, 200, 'Enter Room Code:', {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.uiElements.push(label);

    // HTML input element for room code
    this.htmlInput = document.createElement('input');
    this.htmlInput.type = 'text';
    this.htmlInput.maxLength = LOBBY_CONFIG.ROOM_CODE_LENGTH;
    this.htmlInput.placeholder = 'ABC123';
    this.htmlInput.style.position = 'absolute';
    this.htmlInput.style.left = '50%';
    this.htmlInput.style.top = '50%';
    this.htmlInput.style.transform = 'translate(-50%, -50%)';
    this.htmlInput.style.fontSize = '32px';
    this.htmlInput.style.padding = '12px 24px';
    this.htmlInput.style.textAlign = 'center';
    this.htmlInput.style.textTransform = 'uppercase';
    this.htmlInput.style.fontFamily = 'monospace';
    this.htmlInput.style.border = '2px solid #ffffff';
    this.htmlInput.style.backgroundColor = '#333333';
    this.htmlInput.style.color = '#ffffff';
    this.htmlInput.style.outline = 'none';
    this.htmlInput.style.zIndex = '1000';
    document.body.appendChild(this.htmlInput);
    this.htmlInput.focus();

    // Join button
    const joinButton = this.add.text(400, 380, 'Join', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#00aa44',
      padding: { x: 32, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    joinButton.on('pointerdown', () => {
      if (this.htmlInput) {
        const code = this.htmlInput.value.trim().toUpperCase();
        if (code.length === LOBBY_CONFIG.ROOM_CODE_LENGTH) {
          this.joinPrivateRoom(code);
        }
      }
    });

    this.uiElements.push(joinButton);

    // Back button
    const backButton = this.add.text(400, 450, 'Back', {
      fontSize: '20px',
      color: '#aaaaaa',
      backgroundColor: '#444444',
      padding: { x: 20, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => this.showMainMenu());
    this.uiElements.push(backButton);

    // Enter key to submit
    this.input.keyboard?.once('keydown-ENTER', () => {
      if (this.htmlInput) {
        const code = this.htmlInput.value.trim().toUpperCase();
        if (code.length === LOBBY_CONFIG.ROOM_CODE_LENGTH) {
          this.joinPrivateRoom(code);
        }
      }
    });
  }

  private async joinPrivateRoom(code: string) {
    this.clearUI();

    const statusText = this.add.text(400, 300, `Joining room ${code}...`, {
      fontSize: '18px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.uiElements.push(statusText);

    try {
      // Query server for room with this code
      const response = await fetch(`http://localhost:2567/rooms/find?code=${code}`);

      if (!response.ok) {
        throw new Error('Room not found');
      }

      const data = await response.json();
      const roomId = data.roomId;

      // Join the room by ID
      this.room = await this.client.joinById(roomId, { name: this.playerName });
      console.log('Joined private room:', this.room.id);
      this.showLobbyView();
    } catch (e) {
      console.error('Failed to join room:', e);

      // Show error message
      statusText.setText('Room not found!');
      statusText.setColor('#ff0000');

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => this.showMainMenu());
    }
  }

  private showRoleSelectForMatchmaking() {
    this.clearUI();

    // Background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.uiElements.push(bg);

    // Title
    const title = this.add.text(400, 150, 'Select Preferred Role', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Role buttons
    const roles = [
      { role: 'paran', label: 'Paran (1v2)', color: 0xff4444, y: 230 },
      { role: 'faran', label: 'Faran (Guardian)', color: 0x4488ff, y: 310 },
      { role: 'baran', label: 'Baran (Guardian)', color: 0x44ff88, y: 390 },
    ];

    roles.forEach(r => {
      const button = this.add.text(400, r.y, r.label, {
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: `#${r.color.toString(16).padStart(6, '0')}`,
        padding: { x: 28, y: 14 }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerdown', () => this.joinMatchmaking(r.role));
      this.uiElements.push(button);
    });

    // Back button
    const backButton = this.add.text(400, 500, 'Back', {
      fontSize: '20px',
      color: '#aaaaaa',
      backgroundColor: '#444444',
      padding: { x: 20, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerdown', () => this.showMainMenu());
    this.uiElements.push(backButton);
  }

  private async joinMatchmaking(preferredRole: string) {
    this.clearUI();

    // Background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.uiElements.push(bg);

    const statusText = this.add.text(400, 280, 'Searching for match...', {
      fontSize: '22px',
      color: '#ffff00'
    }).setOrigin(0.5);
    this.uiElements.push(statusText);

    // Add spinner animation
    let dots = 0;
    const spinnerInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        dots = (dots + 1) % 4;
        statusText.setText('Searching for match' + '.'.repeat(dots));
      },
      loop: true
    });

    // Queue size display
    const queueText = this.add.text(400, 330, '', {
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    this.uiElements.push(queueText);

    // Cancel button
    const cancelButton = this.add.text(400, 420, 'Cancel', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#aa0000',
      padding: { x: 24, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    cancelButton.on('pointerdown', () => {
      spinnerInterval.destroy();
      if (this.room) {
        this.room.leave();
        this.room = null;
      }
      this.showMainMenu();
    });
    this.uiElements.push(cancelButton);

    try {
      // Join the matchmaking room (shared instance for all queuing players)
      const matchmakingRoom = await this.client.joinOrCreate('matchmaking_room', {
        preferredRole,
        name: this.playerName
      });

      // Track queue sizes from state
      (matchmakingRoom.state as any).listen('paranCount', (value: number) => {
        const guardianCount = (matchmakingRoom.state as any).guardianCount || 0;
        queueText.setText(`In queue: ${value} Paran, ${guardianCount} Guardian`);
      });
      (matchmakingRoom.state as any).listen('guardianCount', (value: number) => {
        const paranCount = (matchmakingRoom.state as any).paranCount || 0;
        queueText.setText(`In queue: ${paranCount} Paran, ${value} Guardian`);
      });

      // Listen for match found
      matchmakingRoom.onMessage('matchFound', async (data: { lobbyRoomId: string; assignedRole: string }) => {
        console.log('Match found! Joining lobby:', data.lobbyRoomId);
        spinnerInterval.destroy();

        // Leave matchmaking room
        matchmakingRoom.leave();

        // Show transition message
        this.clearUI();
        const transitionBg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
        this.uiElements.push(transitionBg);
        const transitionText = this.add.text(400, 300, 'Match found! Joining lobby...', {
          fontSize: '22px',
          color: '#00ff00'
        }).setOrigin(0.5);
        this.uiElements.push(transitionText);

        try {
          // Join the lobby that matchmaking created
          this.room = await this.client.joinById(data.lobbyRoomId, {
            name: this.playerName,
            fromMatchmaking: true,
            preferredRole: data.assignedRole
          });

          // Pre-select the assigned role
          this.selectedRole = data.assignedRole;

          console.log('Joined matchmaking lobby:', this.room.id);
          this.showLobbyView();

          // Auto-select assigned role after lobby view loads
          this.time.delayedCall(500, () => {
            if (this.room && data.assignedRole) {
              this.room.send('selectRole', { role: data.assignedRole });
            }
          });
        } catch (e) {
          console.error('Failed to join matchmaking lobby:', e);
          this.clearUI();
          const errBg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
          this.uiElements.push(errBg);
          const errText = this.add.text(400, 300, 'Failed to join lobby', {
            fontSize: '22px',
            color: '#ff0000'
          }).setOrigin(0.5);
          this.uiElements.push(errText);
          this.time.delayedCall(3000, () => this.showMainMenu());
        }
      });

      // Update cancel to also leave matchmaking room
      cancelButton.removeAllListeners('pointerdown');
      cancelButton.on('pointerdown', () => {
        spinnerInterval.destroy();
        matchmakingRoom.leave();
        this.showMainMenu();
      });

    } catch (e) {
      console.error('Failed to join matchmaking:', e);
      spinnerInterval.destroy();
      statusText.setText('Failed to join matchmaking');
      statusText.setColor('#ff0000');
      this.time.delayedCall(3000, () => this.showMainMenu());
    }
  }

  private showLobbyView() {
    if (!this.room) return;

    this.clearUI();
    this.currentView = 'lobby';

    // Background
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a1a2e);
    this.uiElements.push(bg);

    // Room code display -- use listener because state may not be synced yet
    let codeLabel: Phaser.GameObjects.Text | null = null;

    const updateRoomCode = (value: string) => {
      if (value && this.room?.state.isPrivate) {
        if (!codeLabel) {
          codeLabel = this.add.text(400, 40, `Room Code: ${value}`, {
            fontSize: '28px',
            color: '#ffff00',
            fontStyle: 'bold',
            fontFamily: 'monospace'
          }).setOrigin(0.5);
          this.uiElements.push(codeLabel);
        } else {
          codeLabel.setText(`Room Code: ${value}`);
        }
      }
    };

    // Show immediately if already synced
    if (this.room.state.roomCode) {
      updateRoomCode(this.room.state.roomCode);
    }

    // Also listen for changes (handles race condition)
    this.room.state.listen('roomCode', (value: string) => {
      updateRoomCode(value);
    });

    // Character selection section
    this.createCharacterSelection();

    // Player list
    this.createPlayerList();

    // Ready button
    this.createReadyButton();

    // Countdown display (initially hidden)
    const countdownText = this.add.text(400, 130, '', {
      fontSize: '64px',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setVisible(false);
    this.uiElements.push(countdownText);

    // Listen for countdown changes
    this.room.state.listen('countdown', (value: number) => {
      if (value > 0) {
        countdownText.setText(String(value));
        countdownText.setVisible(true);
      } else {
        countdownText.setVisible(false);
      }
    });

    // Listen for role errors
    this.room.onMessage('roleError', (message: string) => {
      const errorText = this.add.text(400, 550, message, {
        fontSize: '16px',
        color: '#ff0000',
        backgroundColor: '#000000',
        padding: { x: 12, y: 6 }
      }).setOrigin(0.5);
      this.uiElements.push(errorText);

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => errorText.destroy());
    });

    // Listen for game ready message
    this.room.onMessage('gameReady', async (data: { gameRoomId: string }) => {
      console.log('Game ready! Joining game room:', data.gameRoomId);

      try {
        // Leave lobby
        await this.room!.leave();

        // Join game room
        const gameRoom = await this.client.joinById(data.gameRoomId, {
          name: this.playerName,
          fromLobby: true,
          role: this.selectedRole
        });

        // Store reconnection token
        localStorage.setItem('bangerActiveRoom', JSON.stringify({
          token: gameRoom.reconnectionToken,
          timestamp: Date.now()
        }));

        // Transition to GameScene
        this.scene.start('GameScene', { room: gameRoom });
      } catch (e) {
        console.error('Failed to join game room:', e);
        // Return to menu on error
        this.showMainMenu();
      }
    });
  }

  private createCharacterSelection() {
    if (!this.room) return;

    // Clear updater array for fresh character panel registration
    this.characterPanelUpdaters = [];

    const titleY = this.room.state.isPrivate ? 100 : 60;
    const title = this.add.text(400, titleY, 'Select Character', {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Character panels
    const panelY = titleY + 70;
    const spacing = 180;
    const startX = 400 - spacing;

    const characters = [
      { role: 'paran', name: 'Paran', color: 0xff4444, desc: 'Force - 150HP' },
      { role: 'faran', name: 'Faran', color: 0x4488ff, desc: 'Guardian - 50HP' },
      { role: 'baran', name: 'Baran', color: 0x44ff88, desc: 'Guardian - 50HP' },
    ];

    characters.forEach((char, index) => {
      const x = startX + index * spacing;

      // Character panel background
      const panel = this.add.rectangle(x, panelY, 140, 120, 0x333333);
      panel.setStrokeStyle(2, 0x666666);
      panel.setInteractive({ useHandCursor: true });
      this.uiElements.push(panel);

      // Character color square
      const colorSquare = this.add.rectangle(x, panelY - 15, 60, 60, char.color);
      this.uiElements.push(colorSquare);

      // Character name
      const nameText = this.add.text(x, panelY + 30, char.name, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.uiElements.push(nameText);

      // Character description
      const descText = this.add.text(x, panelY + 50, char.desc, {
        fontSize: '12px',
        color: '#aaaaaa'
      }).setOrigin(0.5);
      this.uiElements.push(descText);

      // Click handler
      panel.on('pointerdown', () => {
        if (this.isRoleAvailable(char.role)) {
          this.selectRole(char.role);
        }
      });

      // Update panel appearance based on selection and availability
      const updatePanel = () => {
        const isSelected = this.selectedRole === char.role;
        const isAvailable = this.isRoleAvailable(char.role);

        if (isSelected) {
          panel.setStrokeStyle(4, 0x00ff00);
        } else if (!isAvailable) {
          panel.setAlpha(0.5);
          colorSquare.setAlpha(0.5);
          nameText.setAlpha(0.5);
          descText.setAlpha(0.5);
          panel.setStrokeStyle(2, 0x666666);
          panel.disableInteractive();
        } else {
          panel.setAlpha(1);
          colorSquare.setAlpha(1);
          nameText.setAlpha(1);
          descText.setAlpha(1);
          panel.setStrokeStyle(2, 0x666666);
          panel.setInteractive({ useHandCursor: true });
        }
      };

      // Register this panel's updater for optimistic UI updates
      this.characterPanelUpdaters.push(updatePanel);

      // Update on player changes
      if (this.room) {
        this.room.state.players.onAdd((player: any) => {
          updatePanel();
          // Register onChange on NEWLY ADDED players too
          player.onChange(() => updatePanel());
        });
        // Register on existing players
        this.room.state.players.forEach((player: any) => {
          player.onChange(() => updatePanel());
        });
        // Also listen for removals (role becomes available again)
        this.room.state.players.onRemove(() => updatePanel());
      }

      updatePanel();
    });
  }

  private createPlayerList() {
    if (!this.room) return;

    const titleY = this.room.state.isPrivate ? 280 : 240;
    const title = this.add.text(400, titleY, 'Players', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.uiElements.push(title);

    const listStartY = titleY + 40;
    const playerTexts: Map<string, Phaser.GameObjects.Text> = new Map();

    const updatePlayerList = () => {
      // Clear existing player texts
      playerTexts.forEach(text => text.destroy());
      playerTexts.clear();

      // Create new player texts
      let index = 0;
      this.room!.state.players.forEach((player: any, sessionId: string) => {
        const y = listStartY + index * 30;
        const roleName = player.role ? player.role.charAt(0).toUpperCase() + player.role.slice(1) : 'Selecting...';
        const readyIcon = player.ready ? '✓' : '○';
        const readyColor = player.ready ? '#00ff00' : '#666666';
        const connectedStatus = player.connected ? '' : ' [DC]';

        const text = this.add.text(
          400,
          y,
          `${player.name} - ${roleName} ${readyIcon}${connectedStatus}`,
          {
            fontSize: '16px',
            color: readyColor
          }
        ).setOrigin(0.5);

        this.uiElements.push(text);
        playerTexts.set(sessionId, text);
        index++;
      });
    };

    // Update on player add/remove
    this.room.state.players.onAdd((player: any) => {
      updatePlayerList();
      player.onChange(() => updatePlayerList());
    });
    this.room.state.players.onRemove(() => updatePlayerList());

    updatePlayerList();
  }

  private createReadyButton() {
    if (!this.room) return;

    const buttonY = 500;
    const readyButton = this.add.text(400, buttonY, 'Ready', {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#666666',
      padding: { x: 32, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const localPlayer = this.room.state.players.get(this.room.sessionId);

    const updateButton = () => {
      if (!localPlayer) return;

      const hasRole = !!localPlayer.role;
      const isReady = localPlayer.ready;

      if (!hasRole) {
        readyButton.setText('Select a role first');
        readyButton.setBackgroundColor('#444444');
        readyButton.disableInteractive();
      } else {
        readyButton.setText(isReady ? 'Not Ready' : 'Ready');
        readyButton.setBackgroundColor(isReady ? '#00aa44' : '#666666');
        readyButton.setInteractive({ useHandCursor: true });
      }
    };

    if (localPlayer) {
      localPlayer.onChange(() => updateButton());
      updateButton();
    }

    readyButton.on('pointerdown', () => {
      if (this.room) {
        this.room.send('toggleReady');
      }
    });

    this.uiElements.push(readyButton);
  }

  private selectRole(role: string) {
    if (this.room) {
      this.selectedRole = role;
      this.room.send('selectRole', { role });
      // Immediate optimistic UI update
      this.characterPanelUpdaters.forEach(fn => fn());
    }
  }

  private isRoleAvailable(role: string): boolean {
    if (!this.room) return false;

    // Count how many players have this role (excluding us)
    let count = 0;
    this.room.state.players.forEach((player: any, sessionId: string) => {
      if (player.role === role && sessionId !== this.room!.sessionId) {
        count++;
      }
    });

    return count === 0; // Each role can only have one player
  }

  private clearUI() {
    // Destroy all UI elements
    this.uiElements.forEach(el => {
      if (el && !el.scene) return; // Already destroyed
      el.destroy();
    });
    this.uiElements = [];

    // Remove HTML input if exists
    if (this.htmlInput) {
      document.body.removeChild(this.htmlInput);
      this.htmlInput = null;
    }
  }

  shutdown() {
    // Clean up when scene shuts down
    this.clearUI();

    if (this.room) {
      try {
        this.room.leave();
      } catch (e) {
        console.error('Error leaving room on shutdown:', e);
      }
      this.room = null;
    }
  }
}
