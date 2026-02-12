import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { PredictionSystem } from '../systems/Prediction';
import { InterpolationSystem } from '../systems/Interpolation';
import { AudioManager } from '../systems/AudioManager';
import { ParticleFactory } from '../systems/ParticleFactory';
import { InputState } from '../../../shared/physics';
import { CHARACTERS } from '../../../shared/characters';
import { MAPS } from '../../../shared/maps';
import { CollisionGrid } from '../../../shared/collisionGrid';
import { OBSTACLE_TILE_IDS } from '../../../shared/obstacles';

/** Map of role name to projectile spritesheet frame index */
const PROJECTILE_FRAME: Record<string, number> = {
  paran: 0,
  faran: 1,
  baran: 2,
};

/** Map of role name to color tint for particles */
const ROLE_COLOR: Record<string, number> = {
  paran: 0xffd700,  // gold/yellow
  faran: 0xff4444,  // red
  baran: 0x44cc66,  // green
};

/** Map of map name to tileset key and image path */
const MAP_TILESET_INFO: Record<string, { key: string; image: string; name: string }> = {
  test_arena: { key: 'tileset_ruins', image: 'tilesets/solarpunk_ruins.png', name: 'solarpunk_ruins' },
  corridor_chaos: { key: 'tileset_living', image: 'tilesets/solarpunk_living.png', name: 'solarpunk_living' },
  cross_fire: { key: 'tileset_tech', image: 'tilesets/solarpunk_tech.png', name: 'solarpunk_tech' },
  pillars: { key: 'tileset_mixed', image: 'tilesets/solarpunk_mixed.png', name: 'solarpunk_mixed' },
};

export class GameScene extends Phaser.Scene {
  private client!: Client;
  private room: Room | null = null;
  private playerSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private playerRoles: Map<string, string> = new Map();
  private playerAnimKeys: Map<string, string> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private fireKey!: Phaser.Input.Keyboard.Key;
  private connected: boolean = false;
  private statusText!: Phaser.GameObjects.Text;

  // Client prediction and interpolation systems
  private prediction: PredictionSystem | null = null;
  private interpolation: InterpolationSystem = new InterpolationSystem();
  private remotePlayers: Set<string> = new Set();

  // Paran cardinal input: track key press order so last-pressed wins
  private directionPressOrder: ('left' | 'right' | 'up' | 'down')[] = [];
  private prevKeyState: Record<string, boolean> = { left: false, right: false, up: false, down: false };
  private localRole: string = '';

  // Combat rendering
  private projectileSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private projectileVelocities: Map<number, { vx: number; vy: number }> = new Map();
  private eliminatedTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private dcLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  // Collision grid for client prediction
  private collisionGrid: CollisionGrid | null = null;
  private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // Spectator mode
  private spectatorTarget: string | null = null;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private isSpectating: boolean = false;
  private matchEnded: boolean = false;
  private finalStats: any = null;
  private matchWinner: string = "";

  // Audio
  private audioManager: AudioManager | null = null;
  private playerHealthCache: Map<string, number> = new Map();
  private lastWhooshTime: number = 0;

  // Visual effects
  private particleFactory: ParticleFactory | null = null;
  private prevHealth: Map<string, number> = new Map();
  private projectileTrails: Map<number, Phaser.GameObjects.Particles.ParticleEmitter> = new Map();
  private speedLineFrameCounter: number = 0;

  // Track previous position for remote player velocity estimation
  private remotePrevPos: Map<string, { x: number; y: number }> = new Map();

  // Current map tileset key for dynamic loading
  private currentTilesetKey: string = '';

  // HUD scene tracking
  private hudLaunched: boolean = false;
  private lastLocalFireTime: number = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Tilemap JSON loaded dynamically in create() after receiving mapName from server
    // Tileset image also loaded dynamically per-map
  }

  async create(data?: { room?: Room }) {
    // Reset all mutable state for scene reuse (Phaser scene.start() skips constructor)
    this.room = null;
    this.connected = false;
    this.prediction = null;
    this.interpolation = new InterpolationSystem();
    this.remotePlayers = new Set();
    this.playerSprites = new Map();
    this.playerRoles = new Map();
    this.playerAnimKeys = new Map();
    this.projectileSprites = new Map();
    this.projectileVelocities = new Map();
    this.eliminatedTexts = new Map();
    this.dcLabels = new Map();
    this.directionPressOrder = [];
    this.prevKeyState = { left: false, right: false, up: false, down: false };
    this.localRole = '';
    this.collisionGrid = null;
    this.wallsLayer = null;
    this.spectatorTarget = null;
    this.isSpectating = false;
    this.matchEnded = false;
    this.finalStats = null;
    this.matchWinner = "";
    this.playerHealthCache = new Map();
    this.lastWhooshTime = 0;
    this.remotePrevPos = new Map();
    this.currentTilesetKey = '';
    this.hudLaunched = false;
    this.lastLocalFireTime = 0;
    if (this.particleFactory) { this.particleFactory.destroy(); }
    this.particleFactory = null;
    this.prevHealth = new Map();
    this.projectileTrails = new Map();
    this.speedLineFrameCounter = 0;

    // Get AudioManager from registry (initialized in BootScene)
    this.audioManager = this.registry.get('audioManager') as AudioManager || null;

    // Check if room was provided from LobbyScene
    const providedRoom = data?.room;

    // Tilemap will be created after server state is received

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.tabKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);

    // Add status text at top-left
    this.statusText = this.add.text(10, 10, 'Connecting to server...', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 },
    });
    this.statusText.setDepth(100);

    // Initialize Colyseus client
    this.client = new Client('ws://localhost:2567');

    // Connect to Colyseus
    try {
      // Use provided room from lobby, or fallback to direct join for development
      if (providedRoom) {
        this.room = providedRoom;
        console.log('Using room from lobby:', this.room.sessionId);
      } else {
        this.room = await this.client.joinOrCreate('game_room');
        console.log('Connected to game_room:', this.room.sessionId);
      }

      this.connected = true;

      // Store reconnection token
      if (this.room.reconnectionToken) {
        sessionStorage.setItem('bangerActiveRoom', JSON.stringify({
          token: this.room.reconnectionToken,
          timestamp: Date.now()
        }));
      }

      // Load map dynamically based on server's mapName
      this.room.onStateChange.once((state: any) => {
        const mapName = state.mapName || "test_arena";
        const mapData = MAPS.find(m => m.name === mapName);

        if (!mapData) {
          console.error(`Unknown map: ${mapName}, falling back to test_arena`);
        }

        const mapFile = mapData?.file || "maps/test_arena.json";
        const mapKey = mapData?.name || "test_arena";

        console.log(`Loading map: ${mapName} from ${mapFile}`);

        // Load per-map tileset image
        const tilesetInfo = MAP_TILESET_INFO[mapKey] || MAP_TILESET_INFO.test_arena;
        this.currentTilesetKey = tilesetInfo.key;
        if (!this.textures.exists(tilesetInfo.key)) {
          this.load.image(tilesetInfo.key, tilesetInfo.image);
        }

        // Load the tilemap JSON dynamically
        this.load.tilemapTiledJSON(mapKey, mapFile);
        this.load.once('complete', () => {
          this.createTilemap(mapKey);
        });
        this.load.start();
      });

      // Schema-based matchState listener -- sole source of truth for status text
      this.room.state.listen("matchState", (value: string) => {
        if (this.matchEnded) return;
        if (value === 'playing') {
          this.statusText.setText('Match started!');
          this.time.delayedCall(2000, () => {
            if (!this.matchEnded) this.statusText.setVisible(false);
          });
          // Audio: match start fanfare + music
          if (this.audioManager) {
            this.audioManager.playSFX('match_start_fanfare');
            this.audioManager.playMusic('audio/match_music.mp3');
          }
        } else if (value === 'waiting') {
          const count = this.room ? this.room.state.players.size : 0;
          this.statusText.setText(`Waiting for players... (${count}/3)`);
          this.statusText.setVisible(true);
        }
      });

      // Keep matchStart handler for backward compatibility (Schema listener handles display)
      this.room.onMessage("matchStart", () => {
        console.log('matchStart received (handled by Schema listener)');
      });

      // Listen for match end broadcast (includes final stats)
      this.room.onMessage("matchEnd", (data: any) => {
        this.finalStats = data.stats;
        this.matchWinner = data.winner;
        this.matchEnded = true;

        // Audio: match end fanfare + stop music
        if (this.audioManager) {
          this.audioManager.playSFX('match_end_fanfare');
          this.audioManager.stopMusic();
        }

        // Clear reconnection token on match end
        sessionStorage.removeItem('bangerActiveRoom');

        // Stop HUDScene before launching victory overlay
        this.scene.stop('HUDScene');
        this.hudLaunched = false;

        // Victory/defeat particle burst
        if (this.particleFactory && this.room) {
          const localStats = data.stats[this.room.sessionId];
          const localRole = localStats?.role || '';
          const didWin = (data.winner === 'paran' && localRole === 'paran') ||
                         (data.winner === 'guardians' && localRole !== 'paran');
          const burstColor = didWin ? 0x00ff00 : 0xff0000;
          this.particleFactory.victoryBurst(400, 300, burstColor);
        }

        // Launch victory scene as overlay
        this.scene.launch("VictoryScene", {
          winner: data.winner,
          stats: data.stats,
          duration: data.duration,
          localSessionId: this.room!.sessionId,
          room: this.room
        });

        // Pause game scene input (scene stays visible underneath)
        this.scene.pause();
      });

      // Handle unexpected disconnection
      this.room.onLeave((code: number) => {
        console.log('Left room with code:', code);

        // If match ended normally, token already cleared
        if (this.matchEnded) {
          return;
        }

        // Unexpected disconnect - attempt reconnection
        this.handleReconnection();
      });

      // Listen for players joining
      this.room.state.players.onAdd((player: any, sessionId: string) => {
        console.log('Player joined:', sessionId);
        this.createPlayerSprite(player, sessionId);
      });

      // Listen for players leaving
      this.room.state.players.onRemove((player: any, sessionId: string) => {
        console.log('Player left:', sessionId);
        this.removePlayerSprite(sessionId);
      });

      // Listen for projectiles
      this.room.state.projectiles.onAdd((projectile: any, key: string) => {
        this.createProjectileSprite(projectile, key);
      });

      this.room.state.projectiles.onRemove((projectile: any, key: string) => {
        this.removeProjectileSprite(key);
      });

      // Listen for obstacle state changes (destruction)
      if (this.room.state.obstacles) {
        this.room.state.obstacles.onAdd((obstacle: any, key: string) => {
          obstacle.onChange(() => {
            if (obstacle.destroyed) {
              // Update collision grid for prediction (shared reference)
              if (this.collisionGrid) {
                this.collisionGrid.clearTile(obstacle.tileX, obstacle.tileY);
              }

              // Update tilemap visual: remove obstacle tile
              if (this.wallsLayer) {
                this.wallsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY);
              }
            }
          });
        });
      }
    } catch (e) {
      console.error('Connection failed:', e);
      this.statusText.setText('Connection failed - is server running?');
    }
  }

  update(time: number, delta: number) {
    // If not connected or no room, return early
    if (!this.connected || !this.room || !this.prediction) {
      return;
    }

    // Check if local player is dead
    const localPlayer = this.room.state.players.get(this.room.sessionId);
    const isDead = localPlayer && localPlayer.health <= 0;

    // Handle spectator mode when dead
    if (isDead && !this.isSpectating && !this.matchEnded) {
      this.isSpectating = true;
      // Set initial spectator target to first alive player
      this.spectatorTarget = this.getNextAlivePlayer(null);
      this.statusText.setText('SPECTATING - Press Tab to cycle players');

      // Emit localDied event for HUDScene
      this.events.emit('localDied');

      // Emit spectatorChanged for initial target
      if (this.spectatorTarget) {
        const targetPlayer = this.room.state.players.get(this.spectatorTarget);
        this.events.emit('spectatorChanged', {
          targetName: targetPlayer?.name || 'Unknown',
          targetRole: targetPlayer?.role || 'unknown',
        });
      }
    }

    if (this.isSpectating && !this.matchEnded) {
      // Cycle through alive players with Tab key
      if (Phaser.Input.Keyboard.JustDown(this.tabKey)) {
        this.spectatorTarget = this.getNextAlivePlayer(this.spectatorTarget);

        // Emit spectatorChanged for HUDScene
        if (this.spectatorTarget) {
          const targetPlayer = this.room.state.players.get(this.spectatorTarget);
          this.events.emit('spectatorChanged', {
            targetName: targetPlayer?.name || 'Unknown',
            targetRole: targetPlayer?.role || 'unknown',
          });
        }
      }

      // Follow spectator target with camera
      if (this.spectatorTarget) {
        const targetSprite = this.playerSprites.get(this.spectatorTarget);
        if (targetSprite) {
          this.cameras.main.centerOn(targetSprite.x, targetSprite.y);
        } else {
          // Target sprite gone, find next alive player
          this.spectatorTarget = this.getNextAlivePlayer(this.spectatorTarget);
        }
      }
    }

    // Skip input processing if dead or spectating
    if (!isDead && !this.isSpectating) {
      // Read current keyboard state
    const rawInput = {
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
    };

    // Track key press order for Paran's last-key-wins cardinal movement
    const dirs = ['left', 'right', 'up', 'down'] as const;
    for (const dir of dirs) {
      if (rawInput[dir] && !this.prevKeyState[dir]) {
        // Key just pressed -- push to end (most recent)
        this.directionPressOrder = this.directionPressOrder.filter(d => d !== dir);
        this.directionPressOrder.push(dir);
      } else if (!rawInput[dir] && this.prevKeyState[dir]) {
        // Key released -- remove from order
        this.directionPressOrder = this.directionPressOrder.filter(d => d !== dir);
      }
      this.prevKeyState[dir] = rawInput[dir];
    }

    // For Paran: only send the last-pressed direction (cardinal only)
    let input: InputState;
    if (this.localRole === 'paran') {
      const lastDir = this.directionPressOrder.length > 0
        ? this.directionPressOrder[this.directionPressOrder.length - 1]
        : null;
      input = {
        left: lastDir === 'left',
        right: lastDir === 'right',
        up: lastDir === 'up',
        down: lastDir === 'down',
        fire: this.fireKey.isDown,
      };
    } else {
      // Guardians: send all pressed directions (allows diagonal)
      input = { ...rawInput, fire: this.fireKey.isDown };
    }

    // Send input every frame -- acceleration physics needs one input per tick
    // to match server simulation. Only skip if truly idle (no keys, no velocity).
    const hasInput = input.left || input.right || input.up || input.down;
    const hasVelocity = (() => {
      const s = this.prediction!.getState();
      return Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01;
    })();

    if (hasInput || hasVelocity || input.fire) {
      // Audio: play role-specific shoot sound on fire
      if (input.fire && this.audioManager && this.localRole) {
        this.audioManager.playSFX(`${this.localRole}_shoot`);
      }

      // Emit localFired event for HUDScene cooldown display (client-side approximation)
      if (input.fire && this.localRole) {
        const cooldownMs = CHARACTERS[this.localRole]?.fireRate || 200;
        const now = Date.now();
        if (now - this.lastLocalFireTime >= cooldownMs) {
          this.lastLocalFireTime = now;
          this.events.emit('localFired', { fireTime: now, cooldownMs });
        }
      }

      this.prediction.sendInput(input, this.room);
    }

    // Paran wall impact + speed effects
    if (this.localRole === 'paran' && this.prediction) {
      const pState = this.prediction.getState();
      const curSpeed = Math.abs(pState.vx) + Math.abs(pState.vy);

      // Wall impact: only trigger on actual tile collision (not direction changes or stops)
      if (this.prediction.getHadCollision()) {
        // Audio: wall impact sound
        if (this.audioManager) this.audioManager.playSFX('wall_impact');
        // Visual: wall impact dust particles
        const wallSprite = this.playerSprites.get(this.room.sessionId);
        if (wallSprite && this.particleFactory) {
          this.particleFactory.wallImpact(wallSprite.x, wallSprite.y);
        }
      }
      // Speed whoosh: play when Paran reaches high speed (rate-limited to once per second)
      if (curSpeed > 200 && time - this.lastWhooshTime > 1000) {
        if (this.audioManager) this.audioManager.playSFX('speed_whoosh');
        this.lastWhooshTime = time;
      }
      // Speed lines: emit every 3 frames when Paran is fast
      this.speedLineFrameCounter++;
      if (curSpeed > 200 && this.particleFactory && this.speedLineFrameCounter % 3 === 0) {
        const speedSprite = this.playerSprites.get(this.room.sessionId);
        if (speedSprite) {
          const angle = Math.atan2(pState.vy, pState.vx);
          this.particleFactory.speedLines(speedSprite.x, speedSprite.y, angle);
        }
      }
    }

    // Update local player sprite from prediction state
    const localSessionId = this.room.sessionId;
    const state = this.prediction.getState();
    const localSprite = this.playerSprites.get(localSessionId);
    if (localSprite) {
      localSprite.x = state.x;
      localSprite.y = state.y;
    }

    // Animate local player based on velocity
    if (localSprite && this.localRole) {
      this.updatePlayerAnimation(localSessionId, this.localRole, state.vx, state.vy);
    }
    }

    // Update remote player sprites via interpolation
    const currentTime = Date.now();
    for (const sessionId of this.remotePlayers) {
      const interpolated = this.interpolation.getInterpolatedState(
        sessionId,
        currentTime
      );
      if (interpolated) {
        const sprite = this.playerSprites.get(sessionId);
        if (sprite) {
          // Estimate velocity from position delta for animation
          const prevPos = this.remotePrevPos.get(sessionId);
          if (prevPos) {
            const estimatedVx = (interpolated.x - prevPos.x) * 60; // rough px/s
            const estimatedVy = (interpolated.y - prevPos.y) * 60;
            const role = this.playerRoles.get(sessionId);
            if (role) {
              this.updatePlayerAnimation(sessionId, role, estimatedVx, estimatedVy);
            }
          }
          this.remotePrevPos.set(sessionId, { x: interpolated.x, y: interpolated.y });

          sprite.x = interpolated.x;
          sprite.y = interpolated.y;
        }
      }
    }

    // Update eliminated text and DC label positions
    this.room.state.players.forEach((player: any, sessionId: string) => {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        const eliminatedText = this.eliminatedTexts.get(sessionId);
        if (eliminatedText) {
          eliminatedText.x = sprite.x;
          eliminatedText.y = sprite.y - 40;
        }
        const dcLabel = this.dcLabels.get(sessionId);
        if (dcLabel) {
          dcLabel.x = sprite.x;
          dcLabel.y = sprite.y + 30;
        }
      }
    });

    // Client-side projectile interpolation: move projectiles between server updates
    const dt = delta / 1000; // Convert ms to seconds
    this.projectileSprites.forEach((sprite, index) => {
      const velocity = this.projectileVelocities.get(index);
      if (velocity) {
        // Extrapolate position using known velocity
        sprite.x += velocity.vx * dt;
        sprite.y += velocity.vy * dt;
      }
    });
  }

  /**
   * Determine and play the appropriate walk/idle animation based on velocity.
   * Only calls sprite.play() if the animation key changes (avoids restart).
   */
  private updatePlayerAnimation(sessionId: string, role: string, vx: number, vy: number): void {
    const sprite = this.playerSprites.get(sessionId);
    if (!sprite || !sprite.active) return;

    // Don't override death animation
    const currentAnim = this.playerAnimKeys.get(sessionId) || '';
    if (currentAnim.endsWith('-death')) return;

    let animKey: string;
    const absVx = Math.abs(vx);
    const absVy = Math.abs(vy);
    const moving = absVx > 5 || absVy > 5;

    if (moving) {
      if (absVx >= absVy) {
        animKey = vx > 0 ? `${role}-walk-right` : `${role}-walk-left`;
      } else {
        animKey = vy > 0 ? `${role}-walk-down` : `${role}-walk-up`;
      }
    } else {
      animKey = `${role}-idle`;
    }

    if (animKey !== currentAnim) {
      sprite.play(animKey);
      this.playerAnimKeys.set(sessionId, animKey);
    }
  }

  /**
   * Create a player sprite with animated spritesheet.
   * Used by both initial onAdd and reconnect onAdd handlers.
   */
  private createPlayerSprite(player: any, sessionId: string): void {
    const isLocal = sessionId === this.room!.sessionId;

    // Determine role
    const role = player.role || 'faran';

    // Create sprite using the role's spritesheet
    const sprite = this.add.sprite(player.x, player.y, role);
    sprite.setDepth(10);
    sprite.play(`${role}-idle`);
    this.playerSprites.set(sessionId, sprite);
    this.playerRoles.set(sessionId, role);
    this.playerAnimKeys.set(sessionId, `${role}-idle`);

    // Common onChange handler for role and health updates
    player.onChange(() => {
      this.handlePlayerChange(player, sessionId, isLocal);
    });

    if (isLocal) {
      // Local player: initialize prediction system with role
      this.localRole = role;
      this.prediction = new PredictionSystem({
        x: player.x,
        y: player.y,
        vx: player.vx || 0,
        vy: player.vy || 0,
        angle: player.angle || 0,
      }, role);

      // Pass collision grid if tilemap already loaded (race condition handling)
      if (this.collisionGrid) {
        this.prediction.setCollisionGrid(this.collisionGrid);
      }

      // Launch HUDScene once when local player is identified and role is known
      if (!this.hudLaunched && this.room) {
        this.hudLaunched = true;
        this.scene.launch('HUDScene', {
          room: this.room,
          localSessionId: this.room.sessionId,
          localRole: this.localRole,
        });
      }
    } else {
      // Remote player: use interpolation
      this.remotePlayers.add(sessionId);
    }
  }

  /**
   * Remove a player sprite and all associated objects.
   */
  private removePlayerSprite(sessionId: string): void {
    // If spectating this player, switch target
    if (this.spectatorTarget === sessionId) {
      this.spectatorTarget = this.getNextAlivePlayer(sessionId);
    }

    // Clean up interpolation buffer for remote players
    if (this.remotePlayers.has(sessionId)) {
      this.interpolation.removePlayer(sessionId);
      this.remotePlayers.delete(sessionId);
    }
    this.remotePrevPos.delete(sessionId);

    const sprite = this.playerSprites.get(sessionId);
    if (sprite) {
      sprite.destroy();
      this.playerSprites.delete(sessionId);
    }
    this.playerRoles.delete(sessionId);
    this.playerAnimKeys.delete(sessionId);
    const eliminatedText = this.eliminatedTexts.get(sessionId);
    if (eliminatedText) {
      eliminatedText.destroy();
      this.eliminatedTexts.delete(sessionId);
    }
    const dcLabel = this.dcLabels.get(sessionId);
    if (dcLabel) {
      dcLabel.destroy();
      this.dcLabels.delete(sessionId);
    }
  }

  /**
   * Create a projectile sprite from the role-specific spritesheet.
   */
  private createProjectileSprite(projectile: any, key: string): void {
    const index = parseInt(key, 10);

    // Determine projectile frame from owner's role
    let frameIndex = 1; // default to faran
    if (this.room) {
      const ownerPlayer = this.room.state.players.get(projectile.ownerId);
      if (ownerPlayer && ownerPlayer.role) {
        frameIndex = PROJECTILE_FRAME[ownerPlayer.role] ?? 1;
      }
    }

    const sprite = this.add.sprite(projectile.x, projectile.y, 'projectiles', frameIndex);
    sprite.setDepth(5);
    this.projectileSprites.set(index, sprite);

    // Store velocity for client-side interpolation
    this.projectileVelocities.set(index, {
      vx: projectile.vx,
      vy: projectile.vy,
    });

    // Create projectile trail particle effect
    if (this.particleFactory) {
      let trailColor = 0xff4444; // default red (faran)
      if (this.room) {
        const ownerPlayer = this.room.state.players.get(projectile.ownerId);
        if (ownerPlayer && ownerPlayer.role) {
          trailColor = ROLE_COLOR[ownerPlayer.role] || 0xff4444;
        }
      }
      const trail = this.particleFactory.createTrail(sprite, trailColor);
      this.projectileTrails.set(index, trail);
    }

    projectile.onChange(() => {
      // Server correction: snap to authoritative position
      sprite.x = projectile.x;
      sprite.y = projectile.y;

      // Update velocities if they changed
      this.projectileVelocities.set(index, {
        vx: projectile.vx,
        vy: projectile.vy,
      });
    });
  }

  /**
   * Remove a projectile sprite.
   */
  private removeProjectileSprite(key: string): void {
    const index = parseInt(key, 10);
    const sprite = this.projectileSprites.get(index);

    // Projectile impact particles at last known position
    if (sprite && this.particleFactory) {
      // Determine color from velocity map (trail may already know)
      const trail = this.projectileTrails.get(index);
      // Use a default spark color; the trail tint is already set per-role
      this.particleFactory.projectileImpact(sprite.x, sprite.y, 0xffaa44);
    }

    // Clean up trail emitter
    const trail = this.projectileTrails.get(index);
    if (trail && this.particleFactory) {
      this.particleFactory.destroyTrail(trail);
      this.projectileTrails.delete(index);
    }

    if (sprite) {
      sprite.destroy();
      this.projectileSprites.delete(index);
    }
    this.projectileVelocities.delete(index);
  }

  private getNextAlivePlayer(currentTarget: string | null): string | null {
    if (!this.room) return null;

    const alivePlayers: string[] = [];
    this.room.state.players.forEach((player: any, sessionId: string) => {
      if (player.health > 0 && sessionId !== this.room!.sessionId) {
        alivePlayers.push(sessionId);
      }
    });

    if (alivePlayers.length === 0) return null;

    if (!currentTarget) return alivePlayers[0];

    const currentIndex = alivePlayers.indexOf(currentTarget);
    const nextIndex = (currentIndex + 1) % alivePlayers.length;
    return alivePlayers[nextIndex];
  }

  private async handleReconnection() {
    // Show reconnecting overlay
    this.statusText.setText('Reconnecting...');

    // Get stored token
    const stored = sessionStorage.getItem('bangerActiveRoom');
    if (!stored) {
      this.returnToLobby('Connection lost. No active session.');
      return;
    }

    try {
      const { token } = JSON.parse(stored);

      // Attempt reconnection
      const room = await this.client.reconnect(token);
      console.log('Successfully reconnected to room:', room.id);

      // Update room reference
      this.room = room;

      // Update stored token with new one
      if (room.reconnectionToken) {
        sessionStorage.setItem('bangerActiveRoom', JSON.stringify({
          token: room.reconnectionToken,
          timestamp: Date.now()
        }));
      }

      // Re-attach state listeners
      this.attachRoomListeners();

      // Re-launch HUDScene after reconnection if it was stopped
      if (!this.hudLaunched && this.localRole) {
        this.hudLaunched = true;
        this.scene.launch('HUDScene', {
          room: this.room,
          localSessionId: this.room.sessionId,
          localRole: this.localRole,
        });
      }

      // Update status
      this.statusText.setText(`Reconnected: ${room.sessionId}`);

    } catch (e) {
      console.error('Reconnection failed:', e);
      this.returnToLobby('Connection lost. Returning to lobby...');
    }
  }

  private handlePlayerChange(player: any, sessionId: string, isLocal: boolean) {
    // Audio + visual effects: detect health changes for hit/death
    if (player.role) {
      const prevHealth = this.playerHealthCache.get(sessionId);
      if (prevHealth !== undefined && player.health < prevHealth) {
        const sprite = this.playerSprites.get(sessionId);
        const roleColor = ROLE_COLOR[player.role] || 0xffffff;

        if (player.health <= 0) {
          // Death: audio + explosion particles
          if (this.audioManager) this.audioManager.playSFX(`${player.role}_death`);
          if (sprite && this.particleFactory) {
            this.particleFactory.deathExplosion(sprite.x, sprite.y, roleColor);
          }
        } else {
          // Damage: audio + sprite flash + hit burst
          if (this.audioManager) this.audioManager.playSFX(`${player.role}_hit`);
          if (sprite && this.particleFactory) {
            this.particleFactory.hitBurst(sprite.x, sprite.y, roleColor);
          }
          // Sprite flash: white -> red -> clear
          if (sprite) {
            sprite.setTintFill(0xffffff);
            this.time.delayedCall(100, () => {
              if (sprite.active) sprite.setTint(0xff0000);
            });
            this.time.delayedCall(200, () => {
              if (sprite.active) sprite.clearTint();
            });
          }
        }
      }
      this.playerHealthCache.set(sessionId, player.health);
    }

    // Update stored role if it changed
    if (player.role) {
      const currentRole = this.playerRoles.get(sessionId);
      if (currentRole !== player.role) {
        this.playerRoles.set(sessionId, player.role);
        // Re-set sprite texture to match new role
        const sprite = this.playerSprites.get(sessionId);
        if (sprite) {
          sprite.setTexture(player.role);
          sprite.play(`${player.role}-idle`);
          this.playerAnimKeys.set(sessionId, `${player.role}-idle`);
        }
      }
    }

    // Handle disconnected state (using dcLabels map)
    if (!player.connected && player.health > 0) {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) sprite.setAlpha(0.3);
      if (!this.dcLabels.has(sessionId)) {
        const dcText = this.add.text(player.x, player.y + 30, 'DC', {
          fontSize: '12px', color: '#ffaa00', fontStyle: 'bold',
          backgroundColor: '#000000', padding: { x: 4, y: 2 }
        });
        dcText.setOrigin(0.5);
        dcText.setDepth(12);
        this.dcLabels.set(sessionId, dcText);
      }
    } else if (player.health <= 0) {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        // Play death animation
        const role = this.playerRoles.get(sessionId) || 'faran';
        const deathKey = `${role}-death`;
        if (this.playerAnimKeys.get(sessionId) !== deathKey) {
          sprite.play(deathKey);
          this.playerAnimKeys.set(sessionId, deathKey);
          // On animation complete, dim the sprite
          sprite.once('animationcomplete', () => {
            sprite.setAlpha(0.3);
          });
        }
      }
      const dcLabel = this.dcLabels.get(sessionId);
      if (dcLabel) { dcLabel.destroy(); this.dcLabels.delete(sessionId); }
      if (!this.eliminatedTexts.has(sessionId)) {
        const eliminatedText = this.add.text(player.x, player.y - 40, 'ELIMINATED', {
          fontSize: '14px', color: '#ff0000', fontStyle: 'bold',
        });
        eliminatedText.setOrigin(0.5);
        eliminatedText.setDepth(12);
        this.eliminatedTexts.set(sessionId, eliminatedText);
      }
    } else {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) sprite.setAlpha(1.0);
      const dcLabel = this.dcLabels.get(sessionId);
      if (dcLabel) { dcLabel.destroy(); this.dcLabels.delete(sessionId); }
      const eliminatedText = this.eliminatedTexts.get(sessionId);
      if (eliminatedText) { eliminatedText.destroy(); this.eliminatedTexts.delete(sessionId); }
    }

    // Role-specific handling
    if (isLocal) {
      if (this.prediction) {
        this.prediction.reconcile({
          x: player.x, y: player.y,
          vx: player.vx || 0, vy: player.vy || 0,
          angle: player.angle || 0,
          lastProcessedSeq: player.lastProcessedSeq || 0,
        });
        const state = this.prediction.getState();
        const sprite = this.playerSprites.get(sessionId);
        if (sprite) { sprite.x = state.x; sprite.y = state.y; }
      }
    } else {
      this.interpolation.addSnapshot(sessionId, {
        timestamp: Date.now(),
        x: player.x, y: player.y,
        angle: player.angle || 0,
      });
    }
  }

  private attachRoomListeners() {
    if (!this.room) return;

    // Schema-based matchState listener -- sole source of truth for status text
    this.room.state.listen("matchState", (value: string) => {
      if (this.matchEnded) return;
      if (value === 'playing') {
        this.statusText.setText('Match started!');
        this.time.delayedCall(2000, () => {
          if (!this.matchEnded) this.statusText.setVisible(false);
        });
        // Audio: match start fanfare + music (reconnect path)
        if (this.audioManager) {
          this.audioManager.playSFX('match_start_fanfare');
          this.audioManager.playMusic('audio/match_music.mp3');
        }
      } else if (value === 'waiting') {
        const count = this.room ? this.room.state.players.size : 0;
        this.statusText.setText(`Waiting for players... (${count}/3)`);
        this.statusText.setVisible(true);
      }
    });

    // Keep matchStart handler for backward compatibility (Schema listener handles display)
    this.room.onMessage("matchStart", () => {
      console.log('matchStart received (handled by Schema listener)');
    });

    this.room.onMessage("matchEnd", (data: any) => {
      this.finalStats = data.stats;
      this.matchWinner = data.winner;
      this.matchEnded = true;

      // Audio: match end fanfare + stop music (reconnect path)
      if (this.audioManager) {
        this.audioManager.playSFX('match_end_fanfare');
        this.audioManager.stopMusic();
      }

      sessionStorage.removeItem('bangerActiveRoom');

      // Stop HUDScene before launching victory overlay (reconnect path)
      this.scene.stop('HUDScene');
      this.hudLaunched = false;

      // Victory/defeat particle burst (reconnect path)
      if (this.particleFactory && this.room) {
        const localStats = data.stats[this.room.sessionId];
        const localRole = localStats?.role || '';
        const didWin = (data.winner === 'paran' && localRole === 'paran') ||
                       (data.winner === 'guardians' && localRole !== 'paran');
        const burstColor = didWin ? 0x00ff00 : 0xff0000;
        this.particleFactory.victoryBurst(400, 300, burstColor);
      }

      this.scene.launch("VictoryScene", {
        winner: data.winner,
        stats: data.stats,
        duration: data.duration,
        localSessionId: this.room!.sessionId,
        room: this.room
      });

      this.scene.pause();
    });

    this.room.onLeave((code: number) => {
      console.log('Left room with code:', code);
      if (this.matchEnded) {
        return;
      }
      this.handleReconnection();
    });

    // Re-attach state listeners for players
    this.room.state.players.onAdd((player: any, sessionId: string) => {
      console.log('Player joined (after reconnect):', sessionId);

      // Skip if sprite already exists (player was already present before reconnect)
      if (this.playerSprites.has(sessionId)) {
        const isLocal = sessionId === this.room!.sessionId;
        // Still need to re-register onChange
        player.onChange(() => {
          this.handlePlayerChange(player, sessionId, isLocal);
        });
        return;
      }

      // Create new player sprite (same logic as create())
      this.createPlayerSprite(player, sessionId);
    });

    this.room.state.players.onRemove((player: any, sessionId: string) => {
      console.log('Player left (after reconnect):', sessionId);
      this.removePlayerSprite(sessionId);
    });

    // Re-attach projectile listeners
    this.room.state.projectiles.onAdd((projectile: any, key: string) => {
      this.createProjectileSprite(projectile, key);
    });

    this.room.state.projectiles.onRemove((projectile: any, key: string) => {
      this.removeProjectileSprite(key);
    });

    // Re-attach obstacle listeners for reconnection
    if (this.room.state.obstacles) {
      this.room.state.obstacles.onAdd((obstacle: any, key: string) => {
        // Handle already-destroyed obstacles (reconnection catches up)
        if (obstacle.destroyed) {
          if (this.collisionGrid) {
            this.collisionGrid.clearTile(obstacle.tileX, obstacle.tileY);
          }
          if (this.wallsLayer) {
            this.wallsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY);
          }
        }
        obstacle.onChange(() => {
          if (obstacle.destroyed) {
            if (this.collisionGrid) {
              this.collisionGrid.clearTile(obstacle.tileX, obstacle.tileY);
            }
            if (this.wallsLayer) {
              this.wallsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY);
            }
          }
        });
      });
    }
  }

  private returnToLobby(message: string) {
    this.statusText.setText(message);
    sessionStorage.removeItem('bangerActiveRoom');

    // Stop HUDScene before transitioning to lobby
    this.scene.stop('HUDScene');
    this.hudLaunched = false;

    this.time.delayedCall(3000, () => {
      this.scene.start('LobbyScene');
    });
  }

  private createTilemap(mapKey: string): void {
    const map = this.make.tilemap({ key: mapKey });

    // Get the tileset name from the map JSON (per-map tileset names)
    const tilesetInfo = MAP_TILESET_INFO[mapKey] || MAP_TILESET_INFO.test_arena;
    const tileset = map.addTilesetImage(tilesetInfo.name, tilesetInfo.key);

    if (!tileset) {
      console.error(`Failed to load tileset for map ${mapKey} (name=${tilesetInfo.name}, key=${tilesetInfo.key})`);
      return;
    }

    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);

    if (!wallsLayer) {
      console.error('Failed to create Walls layer');
      return;
    }

    wallsLayer.setCollisionByExclusion([-1, 0]);

    // Store walls layer reference for obstacle destruction rendering
    this.wallsLayer = wallsLayer;

    // Build collision grid from map data for client prediction
    const mapData = this.cache.tilemap.get(mapKey);
    if (mapData) {
      const wallLayerData = mapData.data.layers.find((l: any) => l.name === 'Walls');
      if (wallLayerData) {
        this.collisionGrid = new CollisionGrid(
          wallLayerData.data,
          mapData.data.width,
          mapData.data.height,
          mapData.data.tilewidth,
          OBSTACLE_TILE_IDS.destructible,
          OBSTACLE_TILE_IDS.indestructible
        );

        // Pass collision grid to prediction system
        if (this.prediction) {
          this.prediction.setCollisionGrid(this.collisionGrid);
        }
      }
    }

    // Initialize particle effects after tilemap is ready
    this.particleFactory = new ParticleFactory(this);

    console.log(`Tilemap ${mapKey} created successfully`);
  }
}
