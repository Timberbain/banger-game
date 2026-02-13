import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { LOBBY_CONFIG, VALID_ROLES } from '../../../shared/lobby';
import { CHARACTERS } from '../../../shared/characters';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Buttons, Panels, Decorative, Spacing, charColor, charColorNum } from '../ui/designTokens';

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

  // Audio
  private audioManager: AudioManager | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  async create() {
    // Initialize Colyseus client
    this.client = new Client('ws://localhost:2567');

    // Get AudioManager from registry (initialized in BootScene)
    this.audioManager = this.registry.get('audioManager') as AudioManager || null;

    // Set default player name (could be from localStorage later)
    this.playerName = localStorage.getItem('playerName') || `Player${Math.floor(Math.random() * 1000)}`;

    // Check for active session before showing menu
    await this.checkReconnection();
  }

  /** Helper: add a solarpunk background (deep green) to any sub-view */
  private addSceneBg(): Phaser.GameObjects.Rectangle {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const bg = this.add.rectangle(cx, cy, w, h, Colors.bg.deepNum);
    this.uiElements.push(bg);
    return bg;
  }

  /** Helper: styled status text with stroke for readability */
  private addStatusText(x: number, y: number, msg: string, color: string = Colors.text.primary): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, msg, {
      fontSize: '22px',
      color,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.uiElements.push(text);
    return text;
  }

  private async checkReconnection() {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Check for lobby reconnection token FIRST (lobby refresh)
    const lobbyStored = sessionStorage.getItem('bangerLobbyRoom');
    if (lobbyStored) {
      try {
        const { token, timestamp } = JSON.parse(lobbyStored);
        const graceMs = LOBBY_CONFIG.LOBBY_RECONNECT_GRACE * 1000;
        const elapsed = Date.now() - timestamp;

        if (elapsed < graceMs) {
          this.addSceneBg();
          const text = this.addStatusText(cx, cy, 'Reconnecting to lobby...', Colors.status.warning);

          // Attempt lobby reconnection with retries (server needs ~9s to process F5 disconnect)
          const LOBBY_MAX_RETRIES = 12;
          const LOBBY_RETRY_DELAY = 1000; // ms

          let reconnectedLobby: Room | null = null;

          for (let attempt = 1; attempt <= LOBBY_MAX_RETRIES; attempt++) {
            try {
              reconnectedLobby = await this.client.reconnect(token);
              console.log(`Successfully reconnected to lobby on attempt ${attempt}`);
              break;
            } catch (e) {
              console.log(`Lobby reconnection attempt ${attempt}/${LOBBY_MAX_RETRIES} failed:`, e);
              if (attempt < LOBBY_MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, LOBBY_RETRY_DELAY));
                text.setText(`Reconnecting to lobby... (attempt ${attempt + 1}/${LOBBY_MAX_RETRIES})`);
              }
            }
          }

          if (reconnectedLobby) {
            this.room = reconnectedLobby;
            console.log('Reconnected to lobby:', this.room.id);

            // Update stored token
            if (this.room.reconnectionToken) {
              sessionStorage.setItem('bangerLobbyRoom', JSON.stringify({
                token: this.room.reconnectionToken,
                roomId: this.room.id,
                timestamp: Date.now()
              }));
            }

            this.showLobbyView();
            return;
          } else {
            console.log('All lobby reconnection attempts failed');
            sessionStorage.removeItem('bangerLobbyRoom');
            this.clearUI();
            // Fall through to check game token or show menu
          }
        } else {
          sessionStorage.removeItem('bangerLobbyRoom');
        }
      } catch (e) {
        sessionStorage.removeItem('bangerLobbyRoom');
      }
    }

    // Check for stored game reconnection token
    const stored = sessionStorage.getItem('bangerActiveRoom');

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
        sessionStorage.removeItem('bangerActiveRoom');
        this.showMainMenu();
        return;
      }

      // Show reconnecting message
      this.addSceneBg();
      const text = this.addStatusText(cx, cy, 'Reconnecting to match...', Colors.status.warning);

      // Attempt reconnection with retries (server may not have processed disconnect yet)
      const MAX_RETRIES = 12;
      const RETRY_DELAY = 1000; // ms

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
          sessionStorage.setItem('bangerActiveRoom', JSON.stringify({
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
      sessionStorage.removeItem('bangerActiveRoom');

      // Show session expired message briefly
      this.clearUI();
      this.addSceneBg();
      this.addStatusText(cx, cy, 'Session expired', Colors.status.danger);

      // Show menu after 2 seconds
      this.time.delayedCall(2000, () => this.showMainMenu());
    }
  }

  private showMainMenu() {
    this.clearUI();
    this.selectedRole = null;
    sessionStorage.removeItem('bangerLobbyRoom');
    this.currentView = 'menu';

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // City background image (solarpunk cityscape)
    const cityBg = this.add.image(cx, cy, 'city-bg');
    cityBg.setDisplaySize(w, h);
    this.uiElements.push(cityBg);

    // Dark overlay for readability
    const overlay = this.add.rectangle(cx, cy, w, h, Colors.bg.deepNum, 0.7);
    this.uiElements.push(overlay);

    // Subtle vine decorations (scaled to new resolution)
    const vineGfx = this.add.graphics();
    vineGfx.lineStyle(Decorative.vine.thickness, Decorative.vine.color, Decorative.vine.alpha);
    vineGfx.beginPath();
    vineGfx.moveTo(40, 100); vineGfx.lineTo(55, 220); vineGfx.lineTo(35, 340);
    vineGfx.lineTo(60, 460); vineGfx.lineTo(40, 580);
    vineGfx.strokePath();
    vineGfx.beginPath();
    vineGfx.moveTo(w - 40, 100); vineGfx.lineTo(w - 55, 220); vineGfx.lineTo(w - 35, 340);
    vineGfx.lineTo(w - 60, 460); vineGfx.lineTo(w - 40, 580);
    vineGfx.strokePath();
    // Small golden solar dots
    vineGfx.fillStyle(Decorative.solarDots.color, Decorative.solarDots.alphaMin);
    for (let i = 0; i < 15; i++) {
      vineGfx.fillCircle(
        Phaser.Math.Between(80, w - 80),
        Phaser.Math.Between(80, h - 80),
        Phaser.Math.FloatBetween(Decorative.solarDots.radiusMin, Decorative.solarDots.radiusMax)
      );
    }
    this.uiElements.push(vineGfx);

    // Title -- golden with green stroke
    const title = this.add.text(cx, 140, 'BANGER', {
      ...TextStyle.hero,
      fontSize: '52px',
      fontFamily: 'monospace',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Decorative gold line under title
    const lineGfx = this.add.graphics();
    lineGfx.lineStyle(Decorative.divider.thickness, Decorative.divider.color, Decorative.divider.alpha);
    lineGfx.lineBetween(cx - 200, 175, cx + 200, 175);
    this.uiElements.push(lineGfx);

    // Menu buttons -- using design token button presets
    const menuItems = [
      { text: 'Create Private Room', preset: Buttons.primary, y: 260, handler: () => this.createPrivateRoom() },
      { text: 'Join Private Room', preset: Buttons.primary, y: 340, handler: () => this.showJoinInput() },
      { text: 'Find Match', preset: Buttons.accent, y: 420, handler: () => this.showRoleSelectForMatchmaking() },
      { text: 'How to Play', preset: Buttons.secondary, y: 500, handler: () => this.scene.start('HelpScene') },
    ];

    menuItems.forEach(btn => {
      const button = this.add.text(cx, btn.y, btn.text, {
        fontSize: btn.preset.fontSize,
        color: btn.preset.text,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        backgroundColor: btn.preset.bg,
        padding: { x: Spacing.lg, y: Spacing.md }
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      button.on('pointerover', () => {
        button.setBackgroundColor(btn.preset.hover);
      });
      button.on('pointerout', () => {
        button.setBackgroundColor(btn.preset.bg);
      });
      button.on('pointerdown', () => {
        if (this.audioManager) this.audioManager.playSFX('button_click');
        btn.handler();
      });

      this.uiElements.push(button);
    });

    // Volume controls at bottom of menu
    this.createVolumeControls(600);
  }

  private async createPrivateRoom() {
    this.clearUI();
    this.addSceneBg();

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Show loading text
    const loadingText = this.addStatusText(cx, cy, 'Creating private room...');

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
      loadingText.setColor(Colors.status.danger);
      this.input.keyboard?.once('keydown', () => this.showMainMenu());
    }
  }

  private showJoinInput() {
    this.clearUI();

    const cx = this.cameras.main.centerX;

    // Background
    this.addSceneBg();

    // Label
    const label = this.add.text(cx, 240, 'Enter Room Code:', {
      ...TextStyle.heroHeading,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.uiElements.push(label);

    // HTML input element for room code -- styled to match solarpunk aesthetic
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
    this.htmlInput.style.letterSpacing = '4px';
    this.htmlInput.style.border = `2px solid ${Colors.gold.brass}`;
    this.htmlInput.style.backgroundColor = Colors.bg.surface;
    this.htmlInput.style.color = Colors.gold.primary;
    this.htmlInput.style.outline = 'none';
    this.htmlInput.style.zIndex = '1000';
    this.htmlInput.style.borderRadius = '0'; // Art Deco: sharp corners
    document.body.appendChild(this.htmlInput);

    // Disable Phaser keyboard capture while HTML input is focused
    // CRITICAL: Register event listeners BEFORE calling focus() so they catch the synchronous focus event
    this.htmlInput.addEventListener('focus', () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
        this.input.keyboard.disableGlobalCapture();
      }
    });
    this.htmlInput.addEventListener('blur', () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
        this.input.keyboard.enableGlobalCapture();
      }
    });

    this.htmlInput.focus();

    // Join button -- primary preset
    const joinButton = this.add.text(cx, 440, 'Join', {
      fontSize: Buttons.primary.fontSize,
      color: Buttons.primary.text,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: Buttons.primary.bg,
      padding: { x: 32, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    joinButton.on('pointerover', () => joinButton.setBackgroundColor(Buttons.primary.hover));
    joinButton.on('pointerout', () => joinButton.setBackgroundColor(Buttons.primary.bg));
    joinButton.on('pointerdown', () => {
      if (this.audioManager) this.audioManager.playSFX('button_click');
      if (this.htmlInput) {
        const code = this.htmlInput.value.trim().toUpperCase();
        if (code.length === LOBBY_CONFIG.ROOM_CODE_LENGTH) {
          this.joinPrivateRoom(code);
        }
      }
    });

    this.uiElements.push(joinButton);

    // Back button -- secondary preset
    const backButton = this.add.text(cx, 520, 'Back', {
      fontSize: Buttons.secondary.fontSize,
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      backgroundColor: Buttons.secondary.bg,
      padding: { x: 20, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setBackgroundColor(Buttons.secondary.hover));
    backButton.on('pointerout', () => backButton.setBackgroundColor(Buttons.secondary.bg));
    backButton.on('pointerdown', () => {
      if (this.audioManager) this.audioManager.playSFX('button_click');
      this.showMainMenu();
    });
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
    this.addSceneBg();

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    const statusText = this.addStatusText(cx, cy, `Joining room ${code}...`);

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
    } catch (e: any) {
      console.error('Failed to join room:', e);

      // Show appropriate error message
      const errorMsg = e?.message?.includes('full') || e?.message?.includes('locked')
        ? 'Room is full!'
        : 'Room not found!';
      statusText.setText(errorMsg);
      statusText.setColor(Colors.status.danger);

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => this.showMainMenu());
    }
  }

  private showRoleSelectForMatchmaking() {
    this.clearUI();

    const cx = this.cameras.main.centerX;

    // Background
    this.addSceneBg();

    // Title
    const title = this.add.text(cx, 180, 'Select Preferred Role', {
      ...TextStyle.heroHeading,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Role buttons -- use character colors from tokens
    const roles = [
      { role: 'paran', label: 'Paran (1v2)', y: 270 },
      { role: 'faran', label: 'Faran (Guardian)', y: 360 },
      { role: 'baran', label: 'Baran (Guardian)', y: 450 },
    ];

    roles.forEach(r => {
      const roleColor = charColor(r.role);
      const button = this.add.text(cx, r.y, r.label, {
        fontSize: '22px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        backgroundColor: Colors.bg.elevated,
        padding: { x: 28, y: 14 },
        stroke: '#000000',
        strokeThickness: 2,
      })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // Gold left accent bar for each role
      const accentBar = this.add.rectangle(cx - 120, r.y, 4, 40, charColorNum(r.role));
      this.uiElements.push(accentBar);

      button.on('pointerover', () => button.setBackgroundColor(Buttons.secondary.hover));
      button.on('pointerout', () => button.setBackgroundColor(Colors.bg.elevated));
      button.on('pointerdown', () => {
        if (this.audioManager) this.audioManager.playSFX('button_click');
        this.joinMatchmaking(r.role);
      });
      this.uiElements.push(button);
    });

    // Back button
    const backButton = this.add.text(cx, 580, 'Back', {
      fontSize: Buttons.secondary.fontSize,
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      backgroundColor: Buttons.secondary.bg,
      padding: { x: 20, y: 8 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setBackgroundColor(Buttons.secondary.hover));
    backButton.on('pointerout', () => backButton.setBackgroundColor(Buttons.secondary.bg));
    backButton.on('pointerdown', () => {
      if (this.audioManager) this.audioManager.playSFX('button_click');
      this.showMainMenu();
    });
    this.uiElements.push(backButton);
  }

  private async joinMatchmaking(preferredRole: string) {
    this.clearUI();

    const cx = this.cameras.main.centerX;

    // Background
    this.addSceneBg();

    const statusText = this.addStatusText(cx, 330, 'Searching for match...', Colors.status.warning);

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
    const queueText = this.add.text(cx, 380, '', {
      fontSize: '16px',
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.uiElements.push(queueText);

    // Cancel button -- danger preset
    const cancelButton = this.add.text(cx, 480, 'Cancel', {
      fontSize: Buttons.danger.fontSize,
      color: Buttons.danger.text,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: Buttons.danger.bg,
      padding: { x: 24, y: 10 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    cancelButton.on('pointerover', () => cancelButton.setBackgroundColor(Buttons.danger.hover));
    cancelButton.on('pointerout', () => cancelButton.setBackgroundColor(Buttons.danger.bg));
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
        this.addSceneBg();
        this.addStatusText(cx, this.cameras.main.centerY, 'Match found! Joining lobby...', Colors.status.success);

        try {
          // Join the lobby that matchmaking created
          this.room = await this.client.joinById(data.lobbyRoomId, {
            name: this.playerName,
            fromMatchmaking: true,
            preferredRole: data.assignedRole
          });

          console.log('Joined matchmaking lobby:', this.room.id);
          this.showLobbyView();

          // Select assigned role AFTER showLobbyView (which resets selectedRole)
          // Use a short delay to ensure characterPanelUpdaters are registered
          this.time.delayedCall(100, () => {
            if (this.room && data.assignedRole) {
              this.selectRole(data.assignedRole);
            }
          });
        } catch (e) {
          console.error('Failed to join matchmaking lobby:', e);
          this.clearUI();
          this.addSceneBg();
          this.addStatusText(cx, this.cameras.main.centerY, 'Failed to join lobby', Colors.status.danger);
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
      statusText.setColor(Colors.status.danger);
      this.time.delayedCall(3000, () => this.showMainMenu());
    }
  }

  private showLobbyView() {
    if (!this.room) return;

    this.clearUI();
    this.selectedRole = null;
    this.currentView = 'lobby';

    const cx = this.cameras.main.centerX;

    // Solarpunk dark green background
    this.addSceneBg();

    // Room code display -- use listener because state may not be synced yet
    let codeLabel: Phaser.GameObjects.Text | null = null;

    const updateRoomCode = (value: string) => {
      if (value && this.room?.state.isPrivate) {
        if (!codeLabel) {
          codeLabel = this.add.text(cx, 45, `Room Code: ${value}`, {
            fontSize: '28px',
            color: Colors.gold.primary,
            fontStyle: 'bold',
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 3,
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

    // Store lobby reconnection token for browser refresh recovery
    if (this.room.reconnectionToken) {
      sessionStorage.setItem('bangerLobbyRoom', JSON.stringify({
        token: this.room.reconnectionToken,
        roomId: this.room.id,
        timestamp: Date.now()
      }));
    }

    // Character selection section
    this.createCharacterSelection();

    // Player list
    this.createPlayerList();

    // Ready button
    this.createReadyButton();

    // Countdown display (initially hidden)
    const countdownText = this.add.text(cx, 150, '', {
      fontSize: '64px',
      color: Colors.gold.primary,
      fontFamily: 'monospace',
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
        // Audio: countdown beep
        if (this.audioManager) this.audioManager.playSFX('countdown_beep');
      } else {
        countdownText.setVisible(false);
      }
    });

    // Listen for role errors
    this.room.onMessage('roleError', (message: string) => {
      const errorText = this.add.text(cx, 640, message, {
        fontSize: '16px',
        color: Colors.status.danger,
        fontFamily: 'monospace',
        backgroundColor: '#000000',
        padding: { x: 12, y: 6 },
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.uiElements.push(errorText);

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => errorText.destroy());
    });

    // Listen for game ready message
    this.room.onMessage('gameReady', async (data: { gameRoomId: string }) => {
      console.log('Game ready! Joining game room:', data.gameRoomId);
      sessionStorage.removeItem('bangerLobbyRoom');

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
        sessionStorage.setItem('bangerActiveRoom', JSON.stringify({
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

    const cx = this.cameras.main.centerX;

    // Clear updater array for fresh character panel registration
    this.characterPanelUpdaters = [];

    const titleY = this.room.state.isPrivate ? 110 : 75;
    const title = this.add.text(cx, titleY, 'Select Character', {
      ...TextStyle.heroHeading,
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Character panels -- space evenly across wider screen
    const panelY = titleY + 100;
    const spacing = 240;
    const startX = cx - spacing;

    const characters = [
      { role: 'paran', name: 'Paran', desc: 'Force - 150HP' },
      { role: 'faran', name: 'Faran', desc: 'Guardian - 50HP' },
      { role: 'baran', name: 'Baran', desc: 'Guardian - 50HP' },
    ];

    characters.forEach((char, index) => {
      const x = startX + index * spacing;

      // Character panel background -- using Panels.card preset
      const panel = this.add.rectangle(x, panelY, 160, 130, Panels.card.bg);
      panel.setStrokeStyle(Panels.card.borderWidth, Panels.card.border);
      panel.setInteractive({ useHandCursor: true });
      this.uiElements.push(panel);

      // Character sprite (idle animation) instead of colored square
      const sprite = this.add.sprite(x, panelY - 15, char.role);
      sprite.play(`${char.role}-idle`);
      sprite.setScale(2);
      this.uiElements.push(sprite);

      // Character name -- role-colored with stroke
      const nameText = this.add.text(x, panelY + 30, char.name, {
        fontSize: '16px',
        color: charColor(char.role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.uiElements.push(nameText);

      // Character description
      const descText = this.add.text(x, panelY + 50, char.desc, {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(descText);

      // Click handler
      panel.on('pointerdown', () => {
        if (this.isRoleAvailable(char.role)) {
          if (this.audioManager) this.audioManager.playSFX('button_click');
          this.selectRole(char.role);
        }
      });

      // Update panel appearance based on selection and availability
      const updatePanel = () => {
        const isSelected = this.selectedRole === char.role;
        const isAvailable = this.isRoleAvailable(char.role);

        if (isSelected) {
          panel.setStrokeStyle(Panels.card.selectedWidth, Panels.card.selectedBorder);
        } else if (!isAvailable) {
          panel.setAlpha(Panels.card.disabledAlpha);
          sprite.setAlpha(Panels.card.disabledAlpha);
          nameText.setAlpha(Panels.card.disabledAlpha);
          descText.setAlpha(Panels.card.disabledAlpha);
          panel.setStrokeStyle(Panels.card.borderWidth, Panels.card.border);
          panel.disableInteractive();
        } else {
          panel.setAlpha(1);
          sprite.setAlpha(1);
          nameText.setAlpha(1);
          descText.setAlpha(1);
          panel.setStrokeStyle(Panels.card.borderWidth, Panels.card.border);
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

    const cx = this.cameras.main.centerX;

    const titleY = this.room.state.isPrivate ? 350 : 310;
    const title = this.add.text(cx, titleY, 'Players', {
      ...TextStyle.heroHeading,
      fontSize: '20px',
      fontFamily: 'monospace',
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
        const readyColor = player.ready ? Colors.status.success : Colors.text.disabled;
        const connectedStatus = player.connected ? '' : ' [DC]';

        const text = this.add.text(
          cx,
          y,
          `${player.name} - ${roleName} ${readyIcon}${connectedStatus}`,
          {
            fontSize: '16px',
            color: readyColor,
            fontFamily: 'monospace',
            stroke: '#000000',
            strokeThickness: 2,
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

    const cx = this.cameras.main.centerX;

    const buttonY = 580;
    const readyButton = this.add.text(cx, buttonY, 'Ready', {
      fontSize: Buttons.primary.fontSize,
      color: Buttons.primary.text,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: Buttons.disabled.bg,
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
        readyButton.setBackgroundColor(Buttons.disabled.bg);
        readyButton.setColor(Buttons.disabled.text);
        readyButton.disableInteractive();
      } else {
        readyButton.setText(isReady ? 'Not Ready' : 'Ready');
        readyButton.setBackgroundColor(isReady ? Colors.status.success : Buttons.primary.bg);
        readyButton.setColor(Buttons.primary.text);
        readyButton.setInteractive({ useHandCursor: true });
      }
    };

    if (localPlayer) {
      localPlayer.onChange(() => updateButton());
      updateButton();
    }

    readyButton.on('pointerdown', () => {
      if (this.audioManager) this.audioManager.playSFX('ready_chime');
      if (this.room) {
        this.room.send('toggleReady');
      }
    });

    this.uiElements.push(readyButton);
  }

  private selectRole(role: string) {
    if (this.room) {
      if (this.selectedRole === role) {
        // Deselect current role
        this.selectedRole = null;
        this.room.send('deselectRole');
      } else {
        // Select new role
        this.selectedRole = role;
        this.room.send('selectRole', { role });
      }
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

  private createVolumeControls(startY: number) {
    if (!this.audioManager) return;

    const cx = this.cameras.main.centerX;

    const controls = [
      { label: 'Music', get: () => this.audioManager!.getMusicVolume(), set: (v: number) => this.audioManager!.setMusicVolume(v) },
      { label: 'SFX', get: () => this.audioManager!.getSFXVolume(), set: (v: number) => this.audioManager!.setSFXVolume(v) },
    ];

    controls.forEach((ctrl, index) => {
      const y = startY + index * 35;
      const labelText = this.add.text(cx - 120, y, ctrl.label + ':', {
        fontSize: '16px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5);
      this.uiElements.push(labelText);

      const volText = this.add.text(cx, y, `${Math.round(ctrl.get() * 100)}%`, {
        fontSize: '16px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0.5);
      this.uiElements.push(volText);

      // Minus button
      const minusBtn = this.add.text(cx - 50, y, ' - ', {
        fontSize: '18px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        backgroundColor: Colors.bg.elevated,
        padding: { x: 6, y: 2 }
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      minusBtn.on('pointerover', () => minusBtn.setBackgroundColor(Buttons.secondary.hover));
      minusBtn.on('pointerout', () => minusBtn.setBackgroundColor(Colors.bg.elevated));
      minusBtn.on('pointerdown', () => {
        const newVal = Math.max(0, ctrl.get() - 0.1);
        ctrl.set(newVal);
        volText.setText(`${Math.round(newVal * 100)}%`);
      });
      this.uiElements.push(minusBtn);

      // Plus button
      const plusBtn = this.add.text(cx + 50, y, ' + ', {
        fontSize: '18px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        backgroundColor: Colors.bg.elevated,
        padding: { x: 6, y: 2 }
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      plusBtn.on('pointerover', () => plusBtn.setBackgroundColor(Buttons.secondary.hover));
      plusBtn.on('pointerout', () => plusBtn.setBackgroundColor(Colors.bg.elevated));
      plusBtn.on('pointerdown', () => {
        const newVal = Math.min(1, ctrl.get() + 0.1);
        ctrl.set(newVal);
        volText.setText(`${Math.round(newVal * 100)}%`);
      });
      this.uiElements.push(plusBtn);
    });
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
    sessionStorage.removeItem('bangerLobbyRoom');

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
