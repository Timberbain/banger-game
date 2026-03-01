import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { MessageRouter } from '../systems/MessageRouter';
import { LOBBY_CONFIG } from '../../../shared/lobby';
import { CHARACTER_DISPLAY } from '../../../shared/characters';
import { AudioManager } from '../systems/AudioManager';
import {
  Colors,
  TextStyle,
  Buttons,
  Panels,
  Spacing,
  charColor,
  charColorNum,
} from '../ui/designTokens';
import { createLayeredButton } from '../ui/createLayeredButton';
import { drawGoldDivider } from '../ui/UIFactory';
import { getServerUrl, getApiBaseUrl } from '../config/connection';

export class LobbyScene extends Phaser.Scene {
  private client!: Client;
  private room: Room | null = null;
  private messageRouter: MessageRouter | null = null;
  private currentView: 'menu' | 'lobby' = 'menu';
  private playerName: string = 'Player';
  private selectedRole: string | null = null;
  private matchmakingSelectedRole: string | null = null;

  // UI elements storage for cleanup
  private uiElements: Phaser.GameObjects.GameObject[] = [];
  private htmlInput: HTMLInputElement | null = null;
  private nameEditInput: HTMLInputElement | null = null;
  private characterPanelUpdaters: (() => void)[] = [];

  // Controls tooltip
  private tooltipElements: Phaser.GameObjects.GameObject[] = [];
  private tooltipVisible: boolean = false;

  // Online player count
  private onlineCountText: Phaser.GameObjects.Text | null = null;
  private onlineCountTimer: Phaser.Time.TimerEvent | null = null;

  // Audio
  private audioManager: AudioManager | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  async create() {
    // Reset stale refs from Phaser scene reuse (constructor skipped on scene.start)
    this.messageRouter = null;
    this.room = null;

    // Initialize Colyseus client
    this.client = new Client(getServerUrl());

    // Get AudioManager from registry (initialized in BootScene)
    this.audioManager = (this.registry.get('audioManager') as AudioManager) || null;

    // Set player name from localStorage, or generate and persist a new one
    const storedName = localStorage.getItem('playerName');
    if (storedName) {
      this.playerName = storedName;
    } else {
      this.playerName = `Player${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem('playerName', this.playerName);
    }

    // Check for active session before showing menu
    await this.checkReconnection();

    // Start lobby music after a short delay (skip if already playing from VictoryScene crossfade)
    if (this.audioManager && !this.audioManager.isPlayingMusic()) {
      this.time.delayedCall(500, () => {
        if (this.audioManager && !this.audioManager.isPlayingMusic()) {
          this.audioManager.playMusicWithPause('audio/lobby/Pixel Jitter Jive.mp3', 1000);
        }
      });
    }
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
  private addStatusText(
    x: number,
    y: number,
    msg: string,
    color: string = Colors.text.primary,
  ): Phaser.GameObjects.Text {
    const text = this.add
      .text(x, y, msg, {
        fontSize: '22px',
        color,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
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
          const text = this.addStatusText(
            cx,
            cy,
            'Reconnecting to lobby...',
            Colors.status.warning,
          );

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
                await new Promise((resolve) => setTimeout(resolve, LOBBY_RETRY_DELAY));
                text.setText(
                  `Reconnecting to lobby... (attempt ${attempt + 1}/${LOBBY_MAX_RETRIES})`,
                );
              }
            }
          }

          if (reconnectedLobby) {
            this.room = reconnectedLobby;
            console.log('Reconnected to lobby:', this.room.id);

            // Update stored token
            if (this.room.reconnectionToken) {
              sessionStorage.setItem(
                'bangerLobbyRoom',
                JSON.stringify({
                  token: this.room.reconnectionToken,
                  roomId: this.room.id,
                  timestamp: Date.now(),
                }),
              );
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
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            text.setText(`Reconnecting to match... (attempt ${attempt + 1}/${MAX_RETRIES})`);
          }
        }
      }

      if (reconnectedRoom) {
        // Update stored token
        if (reconnectedRoom.reconnectionToken) {
          sessionStorage.setItem(
            'bangerActiveRoom',
            JSON.stringify({
              token: reconnectedRoom.reconnectionToken,
              timestamp: Date.now(),
            }),
          );
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
    this.matchmakingSelectedRole = null;
    sessionStorage.removeItem('bangerLobbyRoom');
    if (this.messageRouter) {
      this.messageRouter.clear();
      this.messageRouter = null;
    }
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
    const overlay = this.add.rectangle(cx, cy, w, h, Colors.bg.deepNum, Colors.bg.overlayAlpha);
    this.uiElements.push(overlay);

    // Title -- golden with green stroke
    const title = this.add
      .text(cx, 140, 'BANGER', {
        ...TextStyle.hero,
        fontSize: '52px',
        fontFamily: 'monospace',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.uiElements.push(title);

    // Decorative gold line under title
    const lineGfx = drawGoldDivider(this, cx - 200, 175, cx + 200, 175);
    this.uiElements.push(lineGfx);

    // Online player count indicator
    this.onlineCountText = this.add
      .text(cx, 202, '- ONLINE', {
        fontSize: '14px',
        color: Colors.gold.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(this.onlineCountText);

    const fetchOnlineCount = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/players/online`);
        const data = await res.json();
        if (this.onlineCountText && this.onlineCountText.scene) {
          this.onlineCountText.setText(`${data.count} ONLINE`);
        }
      } catch {
        // Silent fail — keep previous text
      }
    };

    fetchOnlineCount();
    this.onlineCountTimer = this.time.addEvent({
      delay: 10000,
      callback: fetchOnlineCount,
      loop: true,
    });

    // Player name display (click-to-edit)
    const nameText = this.add
      .text(cx - 10, 242, this.playerName, {
        ...TextStyle.heroHeading,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(nameText);

    const pencilText = this.add
      .text(cx + nameText.width / 2 + 8, 242, '\u270E', {
        fontSize: '16px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);
    this.uiElements.push(pencilText);

    // Make name + pencil clickable
    nameText.setInteractive({ useHandCursor: true });
    pencilText.setInteractive({ useHandCursor: true });

    const startNameEdit = () => {
      if (this.audioManager) this.audioManager.playWAVSFX('select_1');
      nameText.setVisible(false);
      pencilText.setVisible(false);
      if (charCountText) charCountText.setVisible(true);

      // Create HTML input for name editing
      this.nameEditInput = document.createElement('input');
      this.nameEditInput.type = 'text';
      this.nameEditInput.maxLength = 12;
      this.nameEditInput.value = this.playerName;

      // Position input over the canvas at the name's location
      const canvas = this.game.canvas;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / this.cameras.main.width;
      const scaleY = rect.height / this.cameras.main.height;
      const inputWidth = 240;

      this.nameEditInput.style.position = 'absolute';
      this.nameEditInput.style.left = `${rect.left + cx * scaleX - (inputWidth * scaleX) / 2}px`;
      this.nameEditInput.style.top = `${rect.top + 242 * scaleY - 18 * scaleY}px`;
      this.nameEditInput.style.width = `${inputWidth * scaleX}px`;
      this.nameEditInput.style.height = `${36 * scaleY}px`;
      this.nameEditInput.style.fontSize = `${20 * scaleY}px`;
      this.nameEditInput.style.padding = `${4 * scaleY}px ${8 * scaleX}px`;
      this.nameEditInput.style.textAlign = 'center';
      this.nameEditInput.style.fontFamily = 'monospace';
      this.nameEditInput.style.border = `2px solid ${Colors.gold.brass}`;
      this.nameEditInput.style.backgroundColor = Colors.bg.surface;
      this.nameEditInput.style.color = Colors.gold.primary;
      this.nameEditInput.style.outline = 'none';
      this.nameEditInput.style.zIndex = '1000';
      this.nameEditInput.style.borderRadius = '0';
      this.nameEditInput.style.boxSizing = 'border-box';
      document.body.appendChild(this.nameEditInput);

      // Update character count on input
      const updateCount = () => {
        if (this.nameEditInput && charCountText) {
          charCountText.setText(`${this.nameEditInput.value.length}/12`);
        }
      };
      this.nameEditInput.addEventListener('input', updateCount);
      updateCount();

      // Disable Phaser keyboard capture while editing
      this.nameEditInput.addEventListener('focus', () => {
        if (this.input.keyboard) {
          this.input.keyboard.enabled = false;
          this.input.keyboard.disableGlobalCapture();
        }
      });
      this.nameEditInput.addEventListener('blur', () => {
        if (this.input.keyboard) {
          this.input.keyboard.enabled = true;
          this.input.keyboard.enableGlobalCapture();
        }
      });

      const confirmEdit = () => {
        if (!this.nameEditInput) return;
        const newName = this.nameEditInput.value.trim();
        if (newName.length > 0) {
          this.playerName = newName;
          localStorage.setItem('playerName', this.playerName);
        }
        // Null reference BEFORE removeChild to prevent re-entrant blur handler
        const inputEl = this.nameEditInput;
        this.nameEditInput = null;
        document.body.removeChild(inputEl);
        // Restore Phaser text
        nameText.setText(this.playerName);
        nameText.setVisible(true);
        pencilText.setVisible(true);
        pencilText.setX(cx + nameText.width / 2 - 2);
        if (charCountText) charCountText.setVisible(false);
      };

      this.nameEditInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmEdit();
        }
      });
      this.nameEditInput.addEventListener('blur', confirmEdit);

      this.nameEditInput.focus();
      this.nameEditInput.select();
    };

    nameText.on('pointerdown', startNameEdit);
    pencilText.on('pointerdown', startNameEdit);

    // Character count (hidden until editing)
    const charCountText = this.add
      .text(cx + 135, 242, `${this.playerName.length}/12`, {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.uiElements.push(charCountText);

    // Gold divider under name
    const nameDivider = drawGoldDivider(this, cx - 120, 265, cx + 120, 265);
    this.uiElements.push(nameDivider);

    // Menu buttons -- 3 options with layered depth
    const menuItems = [
      {
        text: 'Create Private Room',
        bgNum: Colors.accent.vineNum,
        hoverNum: Colors.accent.vineHoverNum,
        y: 310,
        handler: () => this.createPrivateRoom(),
      },
      {
        text: 'Join Private Room',
        bgNum: Colors.accent.vineNum,
        hoverNum: Colors.accent.vineHoverNum,
        y: 400,
        handler: () => this.showJoinInput(),
      },
      {
        text: 'Find Match',
        bgNum: Colors.accent.solarNum,
        hoverNum: Colors.accent.skyNum,
        y: 490,
        handler: () => this.showRoleSelectForMatchmaking(),
      },
    ];

    menuItems.forEach((btn) => {
      const handle = createLayeredButton(this, cx, btn.y, btn.text, {
        size: 'lg',
        bgNum: btn.bgNum,
        hoverNum: btn.hoverNum,
        onClick: () => {
          if (this.audioManager) this.audioManager.playWAVSFX('select_1');
          btn.handler();
        },
      });
      handle.elements.forEach((el) => this.uiElements.push(el));
    });

    // Volume controls at bottom of menu
    this.createVolumeControls(620);
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
        name: this.playerName,
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
    const label = this.add
      .text(cx, 240, 'Enter Room Code:', {
        ...TextStyle.heroHeading,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
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

    // Join button -- primary layered
    const joinHandle = createLayeredButton(this, cx, 440, 'Join', {
      size: 'md',
      bgNum: Buttons.primary.bgNum,
      hoverNum: Buttons.primary.hoverNum,
      onClick: () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_1');
        if (this.htmlInput) {
          const code = this.htmlInput.value.trim().toUpperCase();
          if (code.length === LOBBY_CONFIG.ROOM_CODE_LENGTH) {
            this.joinPrivateRoom(code);
          }
        }
      },
    });
    joinHandle.elements.forEach((el) => this.uiElements.push(el));

    // Back button -- secondary layered
    const backHandle = createLayeredButton(this, cx, 520, 'Back', {
      size: 'sm',
      bgNum: Buttons.secondary.bgNum,
      hoverNum: Buttons.secondary.hoverNum,
      textColor: Colors.text.secondary,
      onClick: () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_1');
        this.showMainMenu();
      },
    });
    backHandle.elements.forEach((el) => this.uiElements.push(el));

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
      const response = await fetch(`${getApiBaseUrl()}/rooms/find?code=${code}`);

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
      const errorMsg =
        e?.message?.includes('full') || e?.message?.includes('locked')
          ? 'Room is full!'
          : 'Room not found!';
      statusText.setText(errorMsg);
      statusText.setColor(Colors.status.danger);

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => this.showMainMenu());
    }
  }

  // ─── MATCHMAKING ─────────────────────────────────────

  private showRoleSelectForMatchmaking() {
    this.clearUI();
    this.matchmakingSelectedRole = null;

    const cx = this.cameras.main.centerX;

    // Background
    this.addSceneBg();

    // Title
    const title = this.add
      .text(cx, 65, 'SELECT YOUR ROLE', {
        ...TextStyle.heroHeading,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(title);

    // Gold divider
    const divGfx = drawGoldDivider(this, 340, 88, 940, 88);
    this.uiElements.push(divGfx);

    // Team labels
    this.addTeamLabels();

    // ? button
    this.addHelpButton();

    // Character panels with local selection logic
    const panelConfigs = [
      { role: 'faran', cx: 240 },
      { role: 'paran', cx: 640 },
      { role: 'baran', cx: 1040 },
    ];

    const panelUpdaters: Array<() => void> = [];

    // Queue button (accent style, initially disabled)
    const queueHandle = createLayeredButton(this, 1060, 650, 'Select role', {
      size: 'md',
      bgNum: Buttons.disabled.bgNum,
      hoverNum: Buttons.disabled.hoverNum,
      textColor: Buttons.disabled.text,
      onClick: () => {
        if (this.matchmakingSelectedRole) {
          if (this.audioManager) this.audioManager.playWAVSFX('select_2');
          this.joinMatchmaking(this.matchmakingSelectedRole);
        }
      },
    });
    queueHandle.elements.forEach((el) => this.uiElements.push(el));

    const updateQueueButton = () => {
      if (this.matchmakingSelectedRole) {
        const roleName =
          this.matchmakingSelectedRole.charAt(0).toUpperCase() +
          this.matchmakingSelectedRole.slice(1);
        queueHandle.setText(`Queue as ${roleName}`);
        queueHandle.setStyle(Buttons.accent.bgNum, Buttons.accent.hoverNum, Buttons.accent.text);
        queueHandle.face.setInteractive({ useHandCursor: true });
      } else {
        queueHandle.setText('Select role');
        queueHandle.setStyle(
          Buttons.disabled.bgNum,
          Buttons.disabled.hoverNum,
          Buttons.disabled.text,
        );
      }
    };

    panelConfigs.forEach((cfg) => {
      const result = this.createCharacterPanel(cfg.role, cfg.cx, () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_1');
        this.matchmakingSelectedRole = this.matchmakingSelectedRole === cfg.role ? null : cfg.role;
        panelUpdaters.forEach((fn) => fn());
        updateQueueButton();
      });

      result.elements.forEach((el) => this.uiElements.push(el));

      panelUpdaters.push(() => {
        result.update(this.matchmakingSelectedRole === cfg.role, true);
      });
    });

    // VS markers
    this.addVsMarkers();

    // Back button -- secondary layered
    const backHandle = createLayeredButton(this, 160, 650, 'Back', {
      size: 'sm',
      bgNum: Buttons.secondary.bgNum,
      hoverNum: Buttons.secondary.hoverNum,
      textColor: Colors.text.secondary,
      onClick: () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_1');
        this.showMainMenu();
      },
    });
    backHandle.elements.forEach((el) => this.uiElements.push(el));
  }

  private async joinMatchmaking(preferredRole: string) {
    this.clearUI();

    const cx = this.cameras.main.centerX;

    // Background
    this.addSceneBg();

    // Portrait aura glow
    const aura = this.add.graphics();
    aura.fillStyle(charColorNum(preferredRole), Panels.characterCard.portraitAuraAlpha);
    aura.fillCircle(cx, 220, Panels.characterCard.portraitAuraRadius);
    this.uiElements.push(aura);

    // Character portrait
    const portrait = this.add.image(cx, 220, `portrait-${preferredRole}`);
    this.uiElements.push(portrait);

    // Role name
    const roleName = preferredRole.charAt(0).toUpperCase() + preferredRole.slice(1);
    const roleLabel = this.add
      .text(cx, 290, `Queuing as ${roleName}`, {
        fontSize: '18px',
        color: charColor(preferredRole),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(roleLabel);

    const statusText = this.addStatusText(cx, 350, 'Searching for match...', Colors.status.warning);

    // Add spinner animation
    let dots = 0;
    const spinnerInterval = this.time.addEvent({
      delay: 500,
      callback: () => {
        dots = (dots + 1) % 4;
        statusText.setText('Searching for match' + '.'.repeat(dots));
      },
      loop: true,
    });

    // Queue size display
    const queueText = this.add
      .text(cx, 400, '', {
        fontSize: '16px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(queueText);

    // Cancel button -- danger layered
    const cancelHandle = createLayeredButton(this, cx, 500, 'Cancel', {
      size: 'md',
      bgNum: Buttons.danger.bgNum,
      hoverNum: Buttons.danger.hoverNum,
      onClick: () => {
        spinnerInterval.destroy();
        if (this.room) {
          this.room.leave();
          this.room = null;
          if (this.messageRouter) {
            this.messageRouter.clear();
            this.messageRouter = null;
          }
        }
        this.showMainMenu();
      },
    });
    cancelHandle.elements.forEach((el) => this.uiElements.push(el));

    try {
      // Join the matchmaking room (shared instance for all queuing players)
      const matchmakingRoom = await this.client.joinOrCreate('matchmaking_room', {
        preferredRole,
        name: this.playerName,
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
      matchmakingRoom.onMessage(
        'matchFound',
        async (data: { lobbyRoomId: string; assignedRole: string }) => {
          console.log('Match found! Joining lobby:', data.lobbyRoomId);
          spinnerInterval.destroy();

          // Leave matchmaking room
          matchmakingRoom.leave();

          // Show transition message
          this.clearUI();
          this.addSceneBg();
          this.addStatusText(
            cx,
            this.cameras.main.centerY,
            'Match found! Joining lobby...',
            Colors.status.success,
          );

          try {
            // Join the lobby that matchmaking created
            this.room = await this.client.joinById(data.lobbyRoomId, {
              name: this.playerName,
              fromMatchmaking: true,
              preferredRole: data.assignedRole,
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
            this.addStatusText(
              cx,
              this.cameras.main.centerY,
              'Failed to join lobby',
              Colors.status.danger,
            );
            this.time.delayedCall(3000, () => this.showMainMenu());
          }
        },
      );

      // Update cancel to also leave matchmaking room
      cancelHandle.face.removeAllListeners('pointerdown');
      cancelHandle.face.on('pointerdown', () => {
        cancelHandle.face.y = cancelHandle.face.y; // keep position
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

  // ─── LOBBY VIEW ──────────────────────────────────────

  private showLobbyView() {
    if (!this.room) return;

    this.clearUI();
    this.selectedRole = null;
    this.currentView = 'lobby';

    // Always create fresh MessageRouter bound to current room
    if (this.messageRouter) this.messageRouter.clear();
    this.messageRouter = new MessageRouter(this.room);

    const cx = this.cameras.main.centerX;

    // Solarpunk dark green background
    this.addSceneBg();

    // Room code display -- left-aligned at top for private rooms
    let codeLabel: Phaser.GameObjects.Text | null = null;

    const updateRoomCode = (value: string) => {
      if (value && this.room?.state.isPrivate) {
        if (!codeLabel) {
          codeLabel = this.add
            .text(30, 30, `Room Code: ${value}`, {
              fontSize: '22px',
              color: Colors.gold.primary,
              fontStyle: 'bold',
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 3,
            })
            .setOrigin(0, 0);
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

    // ? help button
    this.addHelpButton();

    // Title
    const title = this.add
      .text(cx, 65, 'SELECT YOUR ROLE', {
        ...TextStyle.heroHeading,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(title);

    // Gold divider
    const divGfx2 = drawGoldDivider(this, 340, 88, 940, 88);
    this.uiElements.push(divGfx2);

    // Team labels
    this.addTeamLabels();

    // Store lobby reconnection token for browser refresh recovery
    if (this.room.reconnectionToken) {
      sessionStorage.setItem(
        'bangerLobbyRoom',
        JSON.stringify({
          token: this.room.reconnectionToken,
          roomId: this.room.id,
          timestamp: Date.now(),
        }),
      );
    }

    // Character selection section (Center Stage layout)
    this.createCharacterSelection();

    // VS markers
    this.addVsMarkers();

    // Player roster strip
    this.createRosterStrip();

    // Lobby buttons (Back + Ready)
    this.createLobbyButtons();

    // Countdown display (initially hidden) — centered overlay, large
    const countdownText = this.add
      .text(cx, 360, '', {
        fontSize: '80px',
        color: Colors.gold.primary,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setVisible(false)
      .setDepth(100);
    this.uiElements.push(countdownText);

    // Listen for countdown changes
    this.room.state.listen('countdown', (value: number) => {
      if (value > 0) {
        countdownText.setText(String(value));
        countdownText.setVisible(true);
        // Scale pulse tween
        countdownText.setScale(1);
        this.tweens.add({
          targets: countdownText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 200,
          yoyo: true,
          ease: 'Back.easeOut',
        });
        // Audio: countdown beep
        if (this.audioManager) this.audioManager.playSFX('countdown_beep');
      } else {
        countdownText.setVisible(false);
      }
    });

    // Listen for role errors
    this.messageRouter!.on('roleError', (message: string) => {
      const errorText = this.add
        .text(cx, 610, message, {
          fontSize: '16px',
          color: Colors.status.danger,
          fontFamily: 'monospace',
          backgroundColor: '#000000',
          padding: { x: 12, y: 6 },
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.uiElements.push(errorText);

      // Auto-hide after 3 seconds
      this.time.delayedCall(3000, () => errorText.destroy());
    });

    // Listen for game ready message
    this.messageRouter!.on('gameReady', async (data: { gameRoomId: string }) => {
      console.log('Game ready! Joining game room:', data.gameRoomId);
      sessionStorage.removeItem('bangerLobbyRoom');

      try {
        // Leave lobby
        await this.room!.leave();

        // Join game room
        const gameRoom = await this.client.joinById(data.gameRoomId, {
          name: this.playerName,
          fromLobby: true,
          role: this.selectedRole,
        });

        // Store reconnection token
        sessionStorage.setItem(
          'bangerActiveRoom',
          JSON.stringify({
            token: gameRoom.reconnectionToken,
            timestamp: Date.now(),
          }),
        );

        // Transition to GameScene
        this.scene.start('GameScene', { room: gameRoom });
      } catch (e) {
        console.error('Failed to join game room:', e);
        if (this.messageRouter) {
          this.messageRouter.clear();
          this.messageRouter = null;
        }
        this.showMainMenu();
      }
    });
  }

  private createCharacterSelection() {
    if (!this.room) return;

    // Clear updater array for fresh character panel registration
    this.characterPanelUpdaters = [];

    const panelConfigs = [
      { role: 'faran', cx: 240 },
      { role: 'paran', cx: 640 },
      { role: 'baran', cx: 1040 },
    ];

    panelConfigs.forEach((cfg) => {
      const result = this.createCharacterPanel(cfg.role, cfg.cx, () => {
        if (this.isRoleAvailable(cfg.role)) {
          if (this.audioManager) this.audioManager.playWAVSFX('select_1');
          this.selectRole(cfg.role);
        }
      });

      result.elements.forEach((el) => this.uiElements.push(el));

      // Update panel appearance based on selection and availability
      const updatePanel = () => {
        result.update(this.selectedRole === cfg.role, this.isRoleAvailable(cfg.role));
      };

      // Register this panel's updater for optimistic UI updates
      this.characterPanelUpdaters.push(updatePanel);

      // Update on player changes
      if (this.room) {
        this.room.state.players.onAdd((player: any) => {
          updatePanel();
          player.onChange(() => updatePanel());
        });
        this.room.state.players.forEach((player: any) => {
          player.onChange(() => updatePanel());
        });
        this.room.state.players.onRemove(() => updatePanel());
      }

      updatePanel();
    });
  }

  private createRosterStrip() {
    if (!this.room) return;

    // Background strip
    const stripBg = this.add.rectangle(640, 558, 880, 45, Panels.card.bg);
    stripBg.setStrokeStyle(2, Colors.accent.vineNum);
    this.uiElements.push(stripBg);

    // Fixed role slots
    const slots: { role: string; x: number }[] = [
      { role: 'faran', x: 330 },
      { role: 'paran', x: 640 },
      { role: 'baran', x: 950 },
    ];

    // Track slot text objects for rebuilding
    const slotElements: Phaser.GameObjects.GameObject[] = [];

    const updateRoster = () => {
      // Clear previous slot texts
      slotElements.forEach((el) => {
        if (el && (el as any).scene) el.destroy();
      });
      slotElements.length = 0;

      slots.forEach((slot) => {
        const roleColor = charColor(slot.role);
        const roleColorNum = charColorNum(slot.role);
        const roleName = slot.role.charAt(0).toUpperCase() + slot.role.slice(1);

        // Find the player who has this role
        let playerName = '';
        let isReady = false;
        let isLocalPlayer = false;

        this.room!.state.players.forEach((player: any, sessionId: string) => {
          if (player.role === slot.role) {
            playerName = player.name || 'Player';
            isReady = player.ready;
            isLocalPlayer = sessionId === this.room!.sessionId;
          }
        });

        // Colored circle
        const circle = this.add.graphics();
        circle.fillStyle(roleColorNum, 1);
        circle.fillCircle(slot.x - 80, 558, 6);
        slotElements.push(circle);
        this.uiElements.push(circle);

        // Role name
        const roleText = this.add
          .text(slot.x - 68, 558, `${roleName}:`, {
            fontSize: '13px',
            color: roleColor,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0, 0.5);
        slotElements.push(roleText);
        this.uiElements.push(roleText);

        // Player name or waiting
        if (playerName) {
          // Truncate display name to fit before the ready icon (70px at 13px monospace ≈ 8 chars)
          const maxNameChars = 8;
          const displayName =
            playerName.length > maxNameChars
              ? playerName.substring(0, maxNameChars - 1) + '\u2026'
              : playerName;
          const nameText = this.add
            .text(slot.x + 2, 558, displayName, {
              fontSize: '13px',
              color: Colors.text.primary,
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0, 0.5);
          slotElements.push(nameText);
          this.uiElements.push(nameText);

          // Ready indicator
          const readyIcon = isReady ? ' \u2713' : ' \u25CB';
          const readyColor = isReady ? Colors.status.success : Colors.text.disabled;
          const readyText = this.add
            .text(slot.x + 72, 558, readyIcon, {
              fontSize: '14px',
              color: readyColor,
              fontFamily: 'monospace',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0, 0.5);
          slotElements.push(readyText);
          this.uiElements.push(readyText);
        } else {
          const waitText = this.add
            .text(slot.x + 2, 558, '(waiting...)', {
              fontSize: '13px',
              color: Colors.text.disabled,
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0, 0.5);
          slotElements.push(waitText);
          this.uiElements.push(waitText);
        }

        // Subtle gold highlight for local player's slot
        if (isLocalPlayer) {
          const highlight = this.add.rectangle(slot.x, 558, 200, 35, Colors.gold.primaryNum, 0.08);
          slotElements.push(highlight);
          this.uiElements.push(highlight);
        }
      });
    };

    // Update on player changes
    this.room.state.players.onAdd((player: any) => {
      updateRoster();
      player.onChange(() => updateRoster());
    });
    this.room.state.players.onRemove(() => updateRoster());
    this.room.state.players.forEach((player: any) => {
      player.onChange(() => updateRoster());
    });

    updateRoster();
  }

  private createLobbyButtons() {
    if (!this.room) return;

    // Back button (bottom-left) -- secondary layered
    const backHandle = createLayeredButton(this, 160, 650, 'Back', {
      size: 'sm',
      bgNum: Buttons.secondary.bgNum,
      hoverNum: Buttons.secondary.hoverNum,
      textColor: Colors.text.secondary,
      onClick: () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_1');
        if (this.room) {
          this.room.leave();
          this.room = null;
          if (this.messageRouter) {
            this.messageRouter.clear();
            this.messageRouter = null;
          }
        }
        sessionStorage.removeItem('bangerLobbyRoom');
        this.showMainMenu();
      },
    });
    backHandle.elements.forEach((el) => this.uiElements.push(el));

    // Ready button (bottom-right) -- initially disabled layered
    const readyHandle = createLayeredButton(this, 1060, 650, 'Select role', {
      size: 'md',
      bgNum: Buttons.disabled.bgNum,
      hoverNum: Buttons.disabled.hoverNum,
      textColor: Buttons.disabled.text,
      onClick: () => {
        if (this.audioManager) this.audioManager.playWAVSFX('select_2');
        if (this.room) {
          this.room.send('toggleReady');
        }
      },
    });
    readyHandle.elements.forEach((el) => this.uiElements.push(el));

    let localPlayer: any = this.room.state.players.get(this.room.sessionId);

    const updateButton = () => {
      if (!localPlayer) return;

      const hasRole = !!localPlayer.role;
      const isReady = localPlayer.ready;

      if (!hasRole) {
        readyHandle.setText('Select role');
        readyHandle.setEnabled(false);
      } else if (isReady) {
        readyHandle.setText('CANCEL');
        readyHandle.setStyle(Buttons.success.bgNum, Buttons.success.hoverNum, Buttons.success.text);
        readyHandle.face.setInteractive({ useHandCursor: true });
      } else {
        readyHandle.setText('READY');
        readyHandle.setStyle(Buttons.primary.bgNum, Buttons.primary.hoverNum, Buttons.primary.text);
        readyHandle.face.setInteractive({ useHandCursor: true });
      }
    };

    if (localPlayer) {
      localPlayer.onChange(() => updateButton());
      updateButton();
    }

    // Also listen for player being added (handles race condition where
    // state patch arrives after createLobbyButtons runs)
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      if (sessionId === this.room!.sessionId && !localPlayer) {
        localPlayer = player;
        player.onChange(() => updateButton());
        updateButton();
      }
    });
  }

  // ─── SHARED UI HELPERS ───────────────────────────────

  /** Create a single character panel with portrait, aura glow, and description */
  private createCharacterPanel(
    role: string,
    cx: number,
    onClick: () => void,
  ): {
    elements: Phaser.GameObjects.GameObject[];
    update: (isSelected: boolean, isAvailable: boolean) => void;
  } {
    const elements: Phaser.GameObjects.GameObject[] = [];
    const isParan = role === 'paran';
    const width = isParan ? Panels.characterCard.paran.width : Panels.characterCard.guardian.width;
    const height = isParan
      ? Panels.characterCard.paran.height
      : Panels.characterCard.guardian.height;
    const cy = 330;
    const borderColor = charColorNum(role);
    const display = CHARACTER_DISPLAY[role];

    // Panel background
    const panel = this.add.rectangle(cx, cy, width, height, Panels.card.bg);
    panel.setStrokeStyle(Panels.card.borderWidth, borderColor);
    panel.setInteractive({ useHandCursor: true });
    elements.push(panel);

    // Colored aura glow behind portrait
    const aura = this.add.graphics();
    aura.fillStyle(charColorNum(role), Panels.characterCard.portraitAuraAlpha);
    aura.fillCircle(cx, 235, Panels.characterCard.portraitAuraRadius);
    elements.push(aura);

    // Portrait image (200x200 native — pixel-perfect)
    const portrait = this.add.image(cx, 235, `portrait-${role}`);
    elements.push(portrait);

    // Gold Art Deco divider with accent dots at endpoints
    const dividerY = 345;
    const divHalfW = (width - 40) / 2;
    const divGfx = drawGoldDivider(this, cx - divHalfW, dividerY, cx + divHalfW, dividerY);
    elements.push(divGfx);

    // Accent dots at divider endpoints
    const dotGfx = this.add.graphics();
    dotGfx.fillStyle(Colors.gold.primaryNum, 0.7);
    dotGfx.fillCircle(cx - divHalfW, dividerY, 2.5);
    dotGfx.fillCircle(cx + divHalfW, dividerY, 2.5);
    elements.push(dotGfx);

    // Character name
    const nameText = this.add
      .text(cx, 367, role.charAt(0).toUpperCase() + role.slice(1), {
        fontSize: '22px',
        color: charColor(role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    elements.push(nameText);

    // Tagline
    const tagText = this.add
      .text(cx, 387, display.tagline, {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    elements.push(tagText);

    // Ability text
    const abilityText = this.add
      .text(cx, 410, display.ability, {
        fontSize: '11px',
        color: charColor(role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    elements.push(abilityText);

    // Risk/team text
    const riskText = this.add
      .text(cx, 427, display.risk, {
        fontSize: '11px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    elements.push(riskText);

    // Click handler
    panel.on('pointerdown', onClick);

    // Hover effect
    panel.on('pointerover', () => {
      panel.setFillStyle(Colors.bg.elevatedNum);
    });
    panel.on('pointerout', () => {
      panel.setFillStyle(Panels.card.bg);
    });

    // Update function for selection/availability state
    const update = (isSelected: boolean, isAvailable: boolean) => {
      const allEls = [panel, portrait, nameText, tagText, abilityText, riskText];

      if (isSelected) {
        panel.setStrokeStyle(Panels.card.selectedWidth, Panels.card.selectedBorder);
        allEls.forEach((el) => el.setAlpha(1));
        aura.setAlpha(1);
        panel.setInteractive({ useHandCursor: true });
      } else if (!isAvailable) {
        panel.setStrokeStyle(Panels.card.borderWidth, borderColor);
        allEls.forEach((el) => el.setAlpha(Panels.card.disabledAlpha));
        aura.setAlpha(Panels.card.disabledAlpha);
        panel.disableInteractive();
      } else {
        panel.setStrokeStyle(Panels.card.borderWidth, borderColor);
        allEls.forEach((el) => el.setAlpha(1));
        aura.setAlpha(1);
        panel.setInteractive({ useHandCursor: true });
      }
    };

    return { elements, update };
  }

  /** Add team labels above the character panels */
  private addTeamLabels() {
    // "GUARDIANS" labels
    const guardianLeft = this.add
      .text(240, 108, 'GUARDIAN', {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(guardianLeft);

    const guardianRight = this.add
      .text(1040, 108, 'GUARDIAN', {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(guardianRight);

    // "THE FORCE" label
    const forceLabel = this.add
      .text(640, 108, 'FORCE OF NATURE', {
        fontSize: '12px',
        color: Colors.char.paran,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    this.uiElements.push(forceLabel);
  }

  /** Add VS markers between panels */
  private addVsMarkers() {
    const vsStyle = {
      fontSize: '18px',
      color: Colors.gold.primary,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    };

    const vs1 = this.add.text(440, 300, 'VS', vsStyle).setOrigin(0.5);
    this.uiElements.push(vs1);

    const vs2 = this.add.text(840, 300, 'VS', vsStyle).setOrigin(0.5);
    this.uiElements.push(vs2);
  }

  /** Add ? help button at top-right */
  private addHelpButton() {
    const helpBtn = this.add
      .text(1240, 30, '?', {
        fontSize: '20px',
        color: Colors.gold.primary,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        backgroundColor: Colors.bg.elevated,
        padding: { x: 8, y: 4 },
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    helpBtn.on('pointerover', () => helpBtn.setBackgroundColor(Colors.bg.surface));
    helpBtn.on('pointerout', () => helpBtn.setBackgroundColor(Colors.bg.elevated));
    helpBtn.on('pointerdown', () => {
      if (this.audioManager) this.audioManager.playWAVSFX('select_1');
      this.toggleControlsTooltip();
    });
    this.uiElements.push(helpBtn);
  }

  /** Toggle the controls tooltip panel */
  private toggleControlsTooltip() {
    if (this.tooltipVisible) {
      this.dismissControlsTooltip();
      return;
    }

    this.tooltipVisible = true;

    // Click-outside dismissal overlay
    const dismissOverlay = this.add
      .rectangle(640, 360, 1280, 720, 0x000000, 0)
      .setInteractive()
      .setDepth(90);
    dismissOverlay.on('pointerdown', () => this.dismissControlsTooltip());
    this.tooltipElements.push(dismissOverlay);

    // Tooltip panel background
    const panelBg = this.add
      .rectangle(1060, 200, 300, 150, Colors.bg.deepNum)
      .setStrokeStyle(2, Colors.gold.primaryNum)
      .setDepth(91);
    this.tooltipElements.push(panelBg);

    // Controls text
    const controls = ['WASD \u2014 Move', 'SPACE \u2014 Shoot', 'TAB \u2014 Spectate'];
    controls.forEach((line, i) => {
      const text = this.add
        .text(1060, 160 + i * 30, line, {
          fontSize: '14px',
          color: Colors.text.primary,
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(92);
      this.tooltipElements.push(text);
    });

    // Track in uiElements for clearUI cleanup
    this.tooltipElements.forEach((el) => this.uiElements.push(el));
  }

  /** Hide controls tooltip */
  private dismissControlsTooltip() {
    this.tooltipElements.forEach((el) => {
      if (el && (el as any).scene) el.destroy();
    });
    this.tooltipElements = [];
    this.tooltipVisible = false;
  }

  // ─── SELECTION LOGIC ─────────────────────────────────

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
      this.characterPanelUpdaters.forEach((fn) => fn());
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

  // ─── VOLUME CONTROLS ────────────────────────────────

  private createVolumeControls(startY: number) {
    if (!this.audioManager) return;

    const cx = this.cameras.main.centerX;
    const sliderWidth = 120;
    const sliderHeight = 8;

    const controls = [
      {
        label: 'Music',
        get: () => this.audioManager!.getMusicVolume(),
        set: (v: number) => this.audioManager!.setMusicVolume(v),
      },
      {
        label: 'SFX',
        get: () => this.audioManager!.getSFXVolume(),
        set: (v: number) => this.audioManager!.setSFXVolume(v),
      },
    ];

    // Semi-transparent backdrop panel behind volume sliders
    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x000000, 0.45);
    backdrop.fillRoundedRect(cx - 150, startY - 23, 300, 86, 6);
    backdrop.lineStyle(1, Colors.gold.brassNum, 0.6);
    backdrop.strokeRoundedRect(cx - 150, startY - 23, 300, 86, 6);
    this.uiElements.push(backdrop);

    controls.forEach((ctrl, index) => {
      const y = startY + index * 40;

      // Label
      const labelText = this.add
        .text(cx - 130, y, ctrl.label + ':', {
          fontSize: '14px',
          color: Colors.text.secondary,
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);
      this.uiElements.push(labelText);

      // Slider background bar (dark)
      const sliderX = cx - 30;
      const sliderBg = this.add.rectangle(
        sliderX,
        y,
        sliderWidth,
        sliderHeight,
        Colors.bg.elevatedNum,
      );
      sliderBg.setOrigin(0, 0.5);
      this.uiElements.push(sliderBg);

      // Slider fill bar (colored)
      const fillWidth = ctrl.get() * sliderWidth;
      const sliderFill = this.add.rectangle(
        sliderX,
        y,
        fillWidth,
        sliderHeight,
        Colors.gold.primaryNum,
      );
      sliderFill.setOrigin(0, 0.5);
      this.uiElements.push(sliderFill);

      // Percentage text
      const volText = this.add
        .text(sliderX + sliderWidth + 12, y, `${Math.round(ctrl.get() * 100)}%`, {
          fontSize: '14px',
          color: Colors.text.primary,
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);
      this.uiElements.push(volText);

      // Clickable hit area over slider (wider for easy clicking)
      const hitArea = this.add.rectangle(
        sliderX + sliderWidth / 2,
        y,
        sliderWidth + 10,
        sliderHeight + 14,
        0x000000,
        0,
      );
      hitArea.setInteractive({ useHandCursor: true });
      this.uiElements.push(hitArea);

      const updateSlider = (pointerX: number) => {
        const localX = pointerX - sliderBg.getTopLeft().x;
        const ratio = Math.max(0, Math.min(1, localX / sliderWidth));
        ctrl.set(ratio);
        sliderFill.width = ratio * sliderWidth;
        volText.setText(`${Math.round(ratio * 100)}%`);
      };

      hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        updateSlider(pointer.x);
        // Play test sound on SFX slider change
        if (ctrl.label === 'SFX' && this.audioManager) {
          this.audioManager.playWAVSFX('select_1');
        }
      });

      // Support drag along the slider
      hitArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (pointer.isDown) {
          updateSlider(pointer.x);
        }
      });
    });
  }

  // ─── CLEANUP ─────────────────────────────────────────

  private clearUI() {
    // Destroy all UI elements
    this.uiElements.forEach((el) => {
      if (el && !el.scene) return; // Already destroyed
      el.destroy();
    });
    this.uiElements = [];

    // Stop online count polling
    if (this.onlineCountTimer) {
      this.onlineCountTimer.remove();
      this.onlineCountTimer = null;
    }
    this.onlineCountText = null;

    // Remove HTML inputs if they exist
    if (this.htmlInput) {
      document.body.removeChild(this.htmlInput);
      this.htmlInput = null;
    }
    if (this.nameEditInput) {
      // Null reference BEFORE removeChild — removing a focused element triggers
      // blur synchronously, which calls confirmEdit. Without this guard,
      // confirmEdit would double-removeChild (throws) and touch destroyed Phaser objects.
      const nameInput = this.nameEditInput;
      this.nameEditInput = null;
      document.body.removeChild(nameInput);
      // Re-enable keyboard (blur handler may not run cleanly after DOM removal)
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
        this.input.keyboard.enableGlobalCapture();
      }
    }

    // Clear tooltip state
    this.tooltipElements = [];
    this.tooltipVisible = false;
  }

  shutdown() {
    // Clean up when scene shuts down
    this.clearUI();
    sessionStorage.removeItem('bangerLobbyRoom');

    if (this.messageRouter) {
      this.messageRouter.clear();
      this.messageRouter = null;
    }

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
