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
import { PowerupType, POWERUP_CONFIG, POWERUP_NAMES } from '../../../shared/powerups';
import { charColorNum } from '../ui/designTokens';
import { MapMetadata } from '../../../shared/maps';

/** Map of role name to projectile spritesheet frame index */
const PROJECTILE_FRAME: Record<string, number> = {
  paran: 0,
  faran: 1,
  baran: 2,
};

/** Map of map name to tileset key and image path (composite tilesets: 8x14 grid, 112 tiles each) */
const MAP_TILESET_INFO: Record<string, { key: string; image: string; name: string }> = {
  hedge_garden: { key: 'tileset_hedge', image: 'tilesets/arena_hedge.png', name: 'arena_hedge' },
  brick_fortress: { key: 'tileset_brick', image: 'tilesets/arena_brick.png', name: 'arena_brick' },
  timber_yard: { key: 'tileset_wood', image: 'tilesets/arena_wood.png', name: 'arena_wood' },
};

/** Map powerup type to texture key for ground item sprites */
const POWERUP_TEXTURE: Record<number, string> = {
  [PowerupType.SPEED]: 'potion_speed',
  [PowerupType.INVINCIBILITY]: 'potion_invincibility',
  [PowerupType.PROJECTILE]: 'potion_projectile',
};

/** Stage music tracks -- one is randomly selected per match and persists across all stages */
const STAGE_MUSIC_TRACKS = [
  'audio/stage/Forest Deco Run.mp3',
  'audio/stage/Art Deco Forest Arena.mp3',
  'audio/stage/Per Ropar Glas (Remastered v2).mp3',
];

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
  private prevKeyState: Record<string, boolean> = {
    left: false,
    right: false,
    up: false,
    down: false,
  };
  private localRole: string = '';

  // Combat rendering
  private projectileSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
  private projectileVelocities: Map<number, { vx: number; vy: number }> = new Map();
  private eliminatedTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private dcLabels: Map<string, Phaser.GameObjects.Text> = new Map();

  // Collision grid for client prediction
  private collisionGrid: CollisionGrid | null = null;
  private wallsLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private wallFrontsLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private currentTilemap: Phaser.Tilemaps.Tilemap | null = null;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  // Spectator mode
  private spectatorTarget: string | null = null;
  private tabKey!: Phaser.Input.Keyboard.Key;
  private isSpectating: boolean = false;
  private matchEnded: boolean = false;
  private finalStats: any = null;
  private matchWinner: string = '';

  // Audio
  private audioManager: AudioManager | null = null;
  private playerHealthCache: Map<string, number> = new Map();

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

  // Camera system
  private controlsLocked: boolean = false;
  private overviewActive: boolean = false;
  private mapMetadata: MapMetadata | null = null;
  private pendingOverview: boolean = false;

  // Stage transition iris wipe
  private inStageTransition: boolean = false;
  private irisShape: Phaser.GameObjects.Arc | null = null;
  private irisMask: Phaser.Display.Masks.GeometryMask | null = null;

  // F3 debug collision overlay
  private debugCollisionOverlay: Phaser.GameObjects.Graphics | null = null;
  private f3Key: Phaser.Input.Keyboard.Key | null = null;

  // Powerup rendering
  private powerupSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private powerupTweens: Map<string, Phaser.Tweens.Tween> = new Map();
  // Buff aura emitters: Map<sessionId, Map<buffType, ParticleEmitter>>
  private buffAuras: Map<string, Map<number, Phaser.GameObjects.Particles.ParticleEmitter>> =
    new Map();
  // Idle particle aura emitters for ground powerup sprites
  private powerupIdleEmitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> =
    new Map();

  // Music: selected stage track for current match (persists across stages)
  private stageTrack: string = '';
  // Paran projectile buff tracking for beam fire SFX
  private hasProjectileBuff: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // All tileset images and tilemap JSONs are preloaded in BootScene
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
    this.wallFrontsLayer = null;
    this.currentTilemap = null;
    this.groundLayer = null;
    this.spectatorTarget = null;
    this.isSpectating = false;
    this.matchEnded = false;
    this.finalStats = null;
    this.matchWinner = '';
    this.playerHealthCache = new Map();
    this.remotePrevPos = new Map();
    this.currentTilesetKey = '';
    this.hudLaunched = false;
    this.lastLocalFireTime = 0;
    if (this.particleFactory) {
      this.particleFactory.destroy();
    }
    this.particleFactory = null;
    this.prevHealth = new Map();
    this.projectileTrails = new Map();
    this.speedLineFrameCounter = 0;
    this.controlsLocked = false;
    this.overviewActive = false;
    this.mapMetadata = null;
    this.pendingOverview = false;
    this.inStageTransition = false;
    if (this.irisShape) {
      this.irisShape.destroy();
    }
    this.irisShape = null;
    this.irisMask = null;
    if (this.debugCollisionOverlay) {
      this.debugCollisionOverlay.destroy();
    }
    this.debugCollisionOverlay = null;
    this.powerupSprites = new Map();
    this.powerupTweens = new Map();
    this.buffAuras = new Map();
    this.powerupIdleEmitters = new Map();
    this.stageTrack = '';
    this.hasProjectileBuff = false;

    // Reset camera state for scene reuse
    const cam = this.cameras.main;
    cam.setZoom(1);
    cam.stopFollow();
    cam.setBounds(0, 0, 99999, 99999); // temporary, will be set properly after map load
    cam.setScroll(0, 0);
    cam.followOffset.set(0, 0);
    cam.setRoundPixels(true);

    // Get AudioManager from registry (initialized in BootScene)
    this.audioManager = (this.registry.get('audioManager') as AudioManager) || null;

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
    this.f3Key = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F3) || null;

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
        sessionStorage.setItem(
          'bangerActiveRoom',
          JSON.stringify({
            token: this.room.reconnectionToken,
            timestamp: Date.now(),
          }),
        );
      }

      // Load initial map based on server's mapName (assets preloaded in BootScene)
      this.room.onStateChange.once((state: any) => {
        const mapName = state.mapName || 'hedge_garden';
        const mapData = MAPS.find((m) => m.name === mapName);

        if (!mapData) {
          console.error(`Unknown map: ${mapName}, falling back to hedge_garden`);
        }

        // Store map metadata for camera bounds and other systems
        this.mapMetadata = mapData || MAPS[0];

        const mapKey = mapData?.name || 'hedge_garden';

        console.log(`Loading map: ${mapName}`);

        // Assets preloaded in BootScene -- create tilemap directly
        // Check cache in case BootScene preload hasn't completed (safety)
        const tilesetInfo = MAP_TILESET_INFO[mapKey] || Object.values(MAP_TILESET_INFO)[0];
        this.currentTilesetKey = tilesetInfo.key;
        if (this.textures.exists(tilesetInfo.key) && this.cache.tilemap.has(mapKey)) {
          this.createTilemap(mapKey);
        } else {
          // Fallback: dynamic load (shouldn't happen with BootScene preload)
          if (!this.textures.exists(tilesetInfo.key)) {
            this.load.image(tilesetInfo.key, tilesetInfo.image);
          }
          if (!this.cache.tilemap.has(mapKey)) {
            this.load.tilemapTiledJSON(mapKey, mapData?.file || `maps/${mapKey}.json`);
          }
          this.load.once('complete', () => this.createTilemap(mapKey));
          this.load.start();
        }
      });

      // Schema-based matchState listener -- sole source of truth for status text
      this.room.state.listen('matchState', (value: string) => {
        if (this.matchEnded) return;
        if (value === 'playing') {
          this.statusText.setText('Match started!');
          this.time.delayedCall(2000, () => {
            if (!this.matchEnded) this.statusText.setVisible(false);
          });
          // Audio: match start fanfare + crossfade to stage music
          if (this.audioManager) {
            this.audioManager.playSFX('match_start_fanfare');
            // Select stage track on first stage only
            if (!this.stageTrack) {
              this.stageTrack =
                STAGE_MUSIC_TRACKS[Math.floor(Math.random() * STAGE_MUSIC_TRACKS.length)];
              this.audioManager.crossfadeTo(this.stageTrack, true, 1000);
            }
          }
          // Match-start overview animation
          this.startMatchOverview();
        } else if (value === 'waiting') {
          const count = this.room ? this.room.state.players.size : 0;
          this.statusText.setText(`Waiting for players... (${count}/3)`);
          this.statusText.setVisible(true);
        } else if (value === 'stage_end') {
          // Stage ended -- controls already locked by stageEnd message
          this.statusText.setText('Stage complete!');
          this.statusText.setVisible(true);
        } else if (value === 'stage_transition') {
          this.statusText.setText('Loading next arena...');
          this.statusText.setVisible(true);
        }
      });

      // Keep matchStart handler for backward compatibility (Schema listener handles display)
      this.room.onMessage('matchStart', () => {
        console.log('matchStart received (handled by Schema listener)');
      });

      // Listen for match end broadcast (includes final stats)
      this.room.onMessage('matchEnd', (data: any) => {
        this.finalStats = data.stats;
        this.matchWinner = data.winner;
        this.matchEnded = true;

        // Audio: match end fanfare + fade out music
        if (this.audioManager) {
          this.audioManager.playSFX('match_end_fanfare');
          this.audioManager.fadeOutMusic(500);
        }

        // Clear reconnection token on match end
        sessionStorage.removeItem('bangerActiveRoom');

        // Stop HUDScene before launching victory overlay
        this.scene.stop('HUDScene');
        this.hudLaunched = false;

        // Victory/defeat particle burst (use map center)
        if (this.particleFactory && this.room) {
          const localStats = data.stats[this.room.sessionId];
          const localRole = localStats?.role || '';
          const didWin =
            (data.winner === 'paran' && localRole === 'paran') ||
            (data.winner === 'guardians' && localRole !== 'paran');
          const burstColor = didWin ? 0x00ff00 : 0xff0000;
          const burstX = this.mapMetadata ? this.mapMetadata.width / 2 : 400;
          const burstY = this.mapMetadata ? this.mapMetadata.height / 2 : 300;
          this.particleFactory.victoryBurst(burstX, burstY, burstColor);
        }

        // Launch victory scene as overlay
        this.scene.launch('VictoryScene', {
          winner: data.winner,
          stats: data.stats,
          duration: data.duration,
          localSessionId: this.room!.sessionId,
          room: this.room,
          stageResults: data.stageResults || [],
        });

        // Pause game scene input (scene stays visible underneath)
        this.scene.pause();
      });

      // Stage End: lock controls, start iris wipe CLOSE
      this.room.onMessage('stageEnd', (data: any) => {
        this.controlsLocked = true;
        this.inStageTransition = true; // Block position updates

        // Audio: stage end fanfare + dip music volume
        if (this.audioManager) {
          this.audioManager.playSFX('match_end_fanfare');
          this.audioManager.dipMusicVolume(0.3);
        }

        // Create iris wipe circle (starts at full size, shrinks to 0)
        const cam = this.cameras.main;
        const cx = cam.width / 2;
        const cy = cam.height / 2;
        const maxRadius = Math.sqrt(cx * cx + cy * cy) + 50; // Cover full screen diagonal + margin

        // Create circle shape for geometry mask (invisible -- only geometry matters)
        const irisShape = this.add
          .circle(cx, cy, maxRadius, 0xffffff)
          .setScrollFactor(0)
          .setVisible(false);
        irisShape.setDepth(1000);
        const mask = irisShape.createGeometryMask();
        cam.setMask(mask);

        // Store iris objects for stageTransition/stageStart to use
        this.irisShape = irisShape;
        this.irisMask = mask;

        // Tween: shrink circle to zero over 1500ms (iris closes)
        this.tweens.add({
          targets: irisShape,
          scaleX: 0,
          scaleY: 0,
          duration: 1500,
          ease: 'Sine.easeInOut',
        });
      });

      // Stage Transition: swap tilemap (screen already obscured by iris), show intro overlay
      this.room.onMessage('stageTransition', (data: any) => {
        // Screen should already be fully obscured by iris mask from stageEnd
        // If iris hasn't finished closing yet, force it
        if (this.irisShape) {
          this.irisShape.setScale(0);
        }

        // Clean up old stage visuals
        this.cleanupStageVisuals();

        // Destroy old tilemap
        this.destroyTilemap();

        // Update map metadata reference
        const mapData = MAPS.find((m) => m.name === data.mapName);
        this.mapMetadata = mapData || MAPS[0];

        // Create new tilemap (assets already preloaded in BootScene)
        this.createTilemap(data.mapName);

        // Update prediction arena bounds for new map
        if (this.prediction && this.mapMetadata) {
          this.prediction.setArenaBounds({
            width: this.mapMetadata.width,
            height: this.mapMetadata.height,
          });
        }

        // Launch StageIntroScene overlay
        this.scene.launch('StageIntroScene', {
          stageNumber: data.stageNumber,
          arenaName: data.arenaName,
          paranWins: data.paranWins,
          guardianWins: data.guardianWins,
        });
      });

      // Stage Start: dismiss intro, expand iris to reveal new arena + overview
      this.room.onMessage('stageStart', (data: any) => {
        // Stop stage intro overlay
        this.scene.stop('StageIntroScene');

        // Re-launch HUD if needed (it persists across stages, but re-ensure)
        if (!this.scene.isActive('HUDScene') && this.room) {
          this.hudLaunched = true;
          this.scene.launch('HUDScene', {
            room: this.room,
            localSessionId: this.room.sessionId,
            localRole: this.localRole,
          });
        }

        // Reset spectator state for new stage (safety net -- cleanupStageVisuals already resets,
        // but the update() loop can re-set isSpectating during the 600ms health reset delay)
        this.isSpectating = false;
        this.spectatorTarget = null;

        // Allow position updates again (new positions are already set)
        this.inStageTransition = false;

        // Backfill positions from server state -- blocked updates during transition are permanently lost
        // (Colyseus 0.15 delta patches are sent once, the inStageTransition guard discarded them)
        if (this.room) {
          this.room.state.players.forEach((player: any, sessionId: string) => {
            const sprite = this.playerSprites.get(sessionId);
            if (!sprite) return;

            const isLocal = sessionId === this.room!.sessionId;

            if (isLocal) {
              // Snap prediction system to server's current position
              if (this.prediction) {
                this.prediction.reset({
                  x: player.x,
                  y: player.y,
                  vx: 0,
                  vy: 0,
                  angle: player.angle || 0,
                });
              }
              // Snap sprite directly
              sprite.setPosition(player.x, player.y);
            } else {
              // Snap interpolation system to server's current position (no lerp from old position)
              if (this.interpolation) {
                this.interpolation.snapTo(sessionId, player.x, player.y, player.angle || 0);
              }
              // Snap sprite directly
              sprite.setPosition(player.x, player.y);
            }
          });
        }

        // Iris OPEN: expand circle from 0 to full size
        if (this.irisShape && this.irisMask) {
          // Set up overview camera BEFORE revealing (so reveal shows overview)
          this.matchEnded = false;
          this.overviewActive = true;
          this.events.emit('overviewStart');
          this.controlsLocked = true;
          const cam = this.cameras.main;
          cam.stopFollow();
          if (this.mapMetadata) {
            const overviewZoom = Math.min(
              cam.width / this.mapMetadata.width,
              cam.height / this.mapMetadata.height,
            );
            cam.setZoom(overviewZoom);
            cam.centerOn(this.mapMetadata.width / 2, this.mapMetadata.height / 2);
          }

          // Expand iris circle to reveal new arena
          this.tweens.add({
            targets: this.irisShape,
            scaleX: 1,
            scaleY: 1,
            duration: 800,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              // Remove mask (no longer needed)
              cam.clearMask(false);
              if (this.irisShape) {
                this.irisShape.destroy();
                this.irisShape = null;
              }
              this.irisMask = null;

              // Now do the zoom-in to player (second half of overview)
              this.time.delayedCall(700, () => {
                if (this.room) {
                  const localSprite = this.playerSprites.get(this.room.sessionId);
                  if (localSprite) {
                    cam.startFollow(localSprite, true, 0.12, 0.12);
                    cam.setDeadzone(20, 15);
                  }
                }
                cam.zoomTo(2, 800, 'Sine.easeInOut');
                this.time.delayedCall(800, () => {
                  this.controlsLocked = false;
                  this.overviewActive = false;
                  if (this.audioManager) this.audioManager.restoreMusicVolume();
                  this.events.emit('overviewEnd');
                });
              });
            },
          });
        } else {
          // Fallback: no iris (e.g., reconnect mid-transition) -- just do overview
          this.matchEnded = false;
          if (this.audioManager) this.audioManager.restoreMusicVolume();
          this.startMatchOverview();
        }
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

              // Update tilemap visual: remove obstacle canopy + front face
              if (this.wallsLayer) {
                this.wallsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY);
              }
              if (this.wallFrontsLayer) {
                this.wallFrontsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY + 1);
              }
            }
          });
        });
      }

      // Powerup state listeners
      this.room.state.powerups.onAdd((powerup: any, key: string) => {
        const textureKey = POWERUP_TEXTURE[powerup.powerupType] || 'potion_speed';
        const sprite = this.add.sprite(powerup.x, powerup.y, textureKey);
        sprite.setDisplaySize(32, 32); // 32x32 for clear visibility
        sprite.setDepth(8); // Above ground, below players (10)
        this.powerupSprites.set(key, sprite);

        // Idle particle aura around ground powerup for visibility
        if (this.particleFactory) {
          const idleTint =
            powerup.powerupType === PowerupType.SPEED
              ? 0x4488ff
              : powerup.powerupType === PowerupType.INVINCIBILITY
                ? 0xffcc00
                : 0xff4422;
          const idleEmitter = this.particleFactory.createPowerupIdleAura(sprite, idleTint);
          this.powerupIdleEmitters.set(key, idleEmitter);
        }

        // Bobbing animation: oscillate y +/- 4px, 1000ms period
        const tween = this.tweens.add({
          targets: sprite,
          y: powerup.y - 4,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.powerupTweens.set(key, tween);

        // Play spawn SFX
        if (this.audioManager) this.audioManager.playSFX('powerup_spawn');
      });

      this.room.state.powerups.onRemove((_powerup: any, key: string) => {
        // Destroy idle aura emitter before sprite
        const idleEmitter = this.powerupIdleEmitters.get(key);
        if (idleEmitter && this.particleFactory) {
          this.particleFactory.destroyTrail(idleEmitter);
          this.powerupIdleEmitters.delete(key);
        }

        const sprite = this.powerupSprites.get(key);
        if (sprite) {
          sprite.destroy();
          this.powerupSprites.delete(key);
        }
        const tween = this.powerupTweens.get(key);
        if (tween) {
          tween.destroy();
          this.powerupTweens.delete(key);
        }
      });

      // Powerup collection feedback: SFX, floating text, buff aura
      this.room.onMessage('powerupCollect', (data: any) => {
        // Play pickup SFX
        if (this.audioManager) this.audioManager.playSFX('powerup_pickup');

        // Floating text at player position showing powerup name
        const playerSprite = this.playerSprites.get(data.playerId);
        if (playerSprite) {
          const floatText = this.add
            .text(playerSprite.x, playerSprite.y - 30, data.typeName, {
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#FFFFFF',
              stroke: '#000000',
              strokeThickness: 3,
              fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(25);

          this.tweens.add({
            targets: floatText,
            y: floatText.y - 30,
            alpha: 0,
            duration: 1200,
            ease: 'Cubic.easeOut',
            onComplete: () => floatText.destroy(),
          });
        }

        // Start buff aura on the collecting player
        const sprite = this.playerSprites.get(data.playerId);
        if (sprite && this.particleFactory) {
          this.startBuffAura(data.playerId, Number(data.type), sprite);
        }

        // Track projectile buff for local player (Paran beam fire SFX)
        if (
          data.playerId === this.room!.sessionId &&
          Number(data.type) === PowerupType.PROJECTILE
        ) {
          this.hasProjectileBuff = true;
        }
      });

      this.room.onMessage('powerupDespawn', (_data: any) => {
        if (this.audioManager) this.audioManager.playSFX('powerup_despawn');
      });

      this.room.onMessage('buffExpired', (data: any) => {
        this.stopBuffAura(data.playerId, Number(data.type));
        // Clear projectile buff tracking for local player
        if (
          data.playerId === this.room!.sessionId &&
          Number(data.type) === PowerupType.PROJECTILE
        ) {
          this.hasProjectileBuff = false;
        }
      });
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

    // F3 debug collision overlay toggle
    if (this.f3Key && Phaser.Input.Keyboard.JustDown(this.f3Key)) {
      this.toggleDebugCollisionOverlay();
    }

    // Check if local player is dead
    const localPlayer = this.room.state.players.get(this.room.sessionId);
    const isDead = localPlayer && localPlayer.health <= 0;

    // Handle spectator mode when dead
    if (isDead && !this.isSpectating && !this.matchEnded && !this.inStageTransition) {
      this.isSpectating = true;

      // Find closest alive player as initial spectator target
      const localPos = localPlayer ? { x: localPlayer.x, y: localPlayer.y } : { x: 0, y: 0 };
      let closestId: string | null = null;
      let closestDist = Infinity;
      this.room.state.players.forEach((p: any, id: string) => {
        if (id !== this.room!.sessionId && p.health > 0) {
          const dist = Math.hypot(p.x - localPos.x, p.y - localPos.y);
          if (dist < closestDist) {
            closestDist = dist;
            closestId = id;
          }
        }
      });
      this.spectatorTarget = closestId || this.getNextAlivePlayer(null);
      this.statusText.setText('SPECTATING - Press Tab to cycle players');

      // Spectator camera: wider deadzone, smoother follow, no look-ahead
      const specCam = this.cameras.main;
      specCam.setDeadzone(60, 45);
      specCam.followOffset.set(0, 0);
      if (this.spectatorTarget) {
        const targetSprite = this.playerSprites.get(this.spectatorTarget);
        if (targetSprite) {
          specCam.startFollow(targetSprite, true, 0.06, 0.06);
        }
      }

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

        // Switch camera follow to new target
        if (this.spectatorTarget) {
          const targetSprite = this.playerSprites.get(this.spectatorTarget);
          if (targetSprite) {
            this.cameras.main.startFollow(targetSprite, true, 0.06, 0.06);
          }
        }

        // Emit spectatorChanged for HUDScene
        if (this.spectatorTarget) {
          const targetPlayer = this.room.state.players.get(this.spectatorTarget);
          this.events.emit('spectatorChanged', {
            targetName: targetPlayer?.name || 'Unknown',
            targetRole: targetPlayer?.role || 'unknown',
          });
        }
      }

      // If spectator target sprite was removed, find next alive player
      if (this.spectatorTarget) {
        const targetSprite = this.playerSprites.get(this.spectatorTarget);
        if (!targetSprite) {
          this.spectatorTarget = this.getNextAlivePlayer(this.spectatorTarget);
          if (this.spectatorTarget) {
            const newSprite = this.playerSprites.get(this.spectatorTarget);
            if (newSprite) {
              this.cameras.main.startFollow(newSprite, true, 0.06, 0.06);
            }
          }
        }
      }
    }

    // Skip input processing if dead, spectating, or controls locked (overview animation)
    if (!isDead && !this.isSpectating && !this.controlsLocked) {
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
          this.directionPressOrder = this.directionPressOrder.filter((d) => d !== dir);
          this.directionPressOrder.push(dir);
        } else if (!rawInput[dir] && this.prevKeyState[dir]) {
          // Key released -- remove from order
          this.directionPressOrder = this.directionPressOrder.filter((d) => d !== dir);
        }
        this.prevKeyState[dir] = rawInput[dir];
      }

      // For Paran: only send the last-pressed direction (cardinal only)
      let input: InputState;
      if (this.localRole === 'paran') {
        const lastDir =
          this.directionPressOrder.length > 0
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
        // Audio + HUD cooldown: only trigger when cooldown has elapsed (matches server fire rate)
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
          // Audio: wall impact sound (randomized hurt WAV)
          if (this.audioManager)
            this.audioManager.playRandomWAV(['hurt_1', 'hurt_2', 'hurt_3', 'hurt_4']);
          // Visual: wall impact dust particles
          const wallSprite = this.playerSprites.get(this.room.sessionId);
          if (wallSprite && this.particleFactory) {
            this.particleFactory.wallImpact(wallSprite.x, wallSprite.y);
          }
          // Camera shake on wall impact (subtle tactile feedback)
          this.cameras.main.shake(80, 0.003);
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

    // Camera look-ahead: shift camera in movement direction
    const cam = this.cameras.main;
    if (!this.overviewActive && !this.isSpectating && localPlayer && localPlayer.health > 0) {
      const predState = this.prediction.getState();
      const vx = predState.vx;
      const vy = predState.vy;

      const LOOK_AHEAD_PARAN = 60; // pixels ahead for Paran
      const LOOK_AHEAD_GUARDIAN = 30; // pixels ahead for Guardians
      const maxLookAhead = this.localRole === 'paran' ? LOOK_AHEAD_PARAN : LOOK_AHEAD_GUARDIAN;

      const speed = Math.sqrt(vx * vx + vy * vy);
      const maxSpeed = CHARACTERS[this.localRole]?.maxVelocity || 300;
      const lookFactor = Math.min(speed / maxSpeed, 1);

      // Target offset (followOffset is SUBTRACTED, so negate for look-ahead)
      const targetOffsetX = speed > 5 ? -(vx / speed) * maxLookAhead * lookFactor : 0;
      const targetOffsetY = speed > 5 ? -(vy / speed) * maxLookAhead * lookFactor : 0;

      // Lerp for smooth direction reversal (fast enough to be visible during typical runs)
      const OFFSET_LERP = 0.14;
      cam.followOffset.x += (targetOffsetX - cam.followOffset.x) * OFFSET_LERP;
      cam.followOffset.y += (targetOffsetY - cam.followOffset.y) * OFFSET_LERP;
    }

    // Speed zoom-out for Paran at high velocity
    if (
      !this.overviewActive &&
      this.localRole === 'paran' &&
      localPlayer &&
      localPlayer.health > 0
    ) {
      const predState = this.prediction.getState();
      const speed = Math.sqrt(predState.vx ** 2 + predState.vy ** 2);
      const maxSpeed = CHARACTERS.paran.maxVelocity;
      const speedRatio = Math.min(speed / maxSpeed, 1);

      const BASE_ZOOM = 2.0;
      const MIN_ZOOM = 1.85;
      const targetZoom = BASE_ZOOM - (BASE_ZOOM - MIN_ZOOM) * speedRatio;

      // Smooth lerp
      const currentZoom = cam.zoom;
      cam.setZoom(currentZoom + (targetZoom - currentZoom) * 0.03);
    }

    // Update remote player sprites via interpolation
    const currentTime = Date.now();
    for (const sessionId of this.remotePlayers) {
      const interpolated = this.interpolation.getInterpolatedState(sessionId, currentTime);
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

    // Powerup despawn blink (client-side calculation)
    if (this.room) {
      this.room.state.powerups.forEach((powerup: any, key: string) => {
        const sprite = this.powerupSprites.get(key);
        if (!sprite) return;
        const elapsed = this.room!.state.serverTime - powerup.spawnTime;
        const remaining = POWERUP_CONFIG.despawnTime - elapsed;
        if (remaining <= POWERUP_CONFIG.despawnWarningTime && remaining > 0) {
          // Blink: toggle visibility every 200ms
          const blinkPhase = Math.floor(elapsed / 200) % 2;
          sprite.setAlpha(blinkPhase === 0 ? 1 : 0.2);
        }
      });
    }
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
    sprite.setDisplaySize(32, 32); // 64x64 texture displayed at 32x32 world size
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
      // Pass dynamic arena bounds from map metadata (falls back to ARENA constant if unavailable)
      const arenaBounds = this.mapMetadata
        ? { width: this.mapMetadata.width, height: this.mapMetadata.height }
        : undefined;
      this.prediction = new PredictionSystem(
        {
          x: player.x,
          y: player.y,
          vx: player.vx || 0,
          vy: player.vy || 0,
          angle: player.angle || 0,
        },
        role,
        arenaBounds,
      );

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

    // Play shoot sound for all projectiles (server-confirmed timing)
    if (this.audioManager && this.room) {
      const ownerPlayer = this.room.state.players.get(projectile.ownerId);
      if (ownerPlayer && ownerPlayer.role) {
        if (projectile.isBeam) {
          this.audioManager.playMultipleWAV(['earthquake', 'lightning']);
        } else if (ownerPlayer.role !== 'paran') {
          this.audioManager.stopAndPlayRandomWAV(['laser_1', 'laser_4', 'laser_5']);
        } else {
          this.audioManager.playSFX('paran_shoot');
        }
      }
    }

    const sprite = this.add.sprite(projectile.x, projectile.y, 'projectiles', frameIndex);
    sprite.setDepth(5);

    // Beam projectile: large glowing display; buffed projectile: scaled up; normal: 8x8
    if (projectile.isBeam) {
      sprite.setDisplaySize(40, 40); // 5x normal size
      sprite.setTint(0xffdd00); // Gold-white beam color
      this.tweens.add({
        targets: sprite,
        alpha: { from: 1.0, to: 0.6 },
        duration: 100,
        yoyo: true,
        repeat: -1,
      });
    } else if (projectile.hitboxScale > 1) {
      // Guardian buffed projectile: display at scaled size
      const buffedSize = 8 * projectile.hitboxScale;
      sprite.setDisplaySize(buffedSize, buffedSize);
    } else {
      sprite.setDisplaySize(8, 8); // 16x16 texture displayed at 8x8 world size
    }

    this.projectileSprites.set(index, sprite);

    // Store velocity for client-side interpolation
    this.projectileVelocities.set(index, {
      vx: projectile.vx,
      vy: projectile.vy,
    });

    // Create projectile trail particle effect
    if (this.particleFactory) {
      if (projectile.isBeam) {
        // Beam trail: larger, gold particles
        const beamTrail = this.add.particles(0, 0, 'particle', {
          frequency: 20,
          lifespan: 300,
          speed: 0,
          scale: { start: 2.0, end: 0 },
          alpha: { start: 0.7, end: 0 },
          tint: 0xffdd00,
          follow: sprite,
          emitting: true,
        });
        beamTrail.setDepth(4);
        this.projectileTrails.set(index, beamTrail);
      } else {
        let trailColor = 0xff4444; // default red (faran)
        if (this.room) {
          const ownerPlayer = this.room.state.players.get(projectile.ownerId);
          if (ownerPlayer && ownerPlayer.role) {
            trailColor = charColorNum(ownerPlayer.role);
          }
        }
        const trail = this.particleFactory.createTrail(sprite, trailColor);
        this.projectileTrails.set(index, trail);
      }
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

  private startBuffAura(
    playerId: string,
    buffType: number,
    sprite: Phaser.GameObjects.Sprite,
  ): void {
    if (!this.particleFactory) return;

    // Get or create aura map for this player
    if (!this.buffAuras.has(playerId)) {
      this.buffAuras.set(playerId, new Map());
    }
    const playerAuras = this.buffAuras.get(playerId)!;

    // If aura already exists for this buff type, destroy old one first (timer refresh)
    const existing = playerAuras.get(buffType);
    if (existing) {
      this.particleFactory.destroyTrail(existing);
    }

    // Create new aura emitter
    let emitter: Phaser.GameObjects.Particles.ParticleEmitter;
    switch (buffType) {
      case PowerupType.SPEED:
        emitter = this.particleFactory.speedAura(sprite);
        break;
      case PowerupType.INVINCIBILITY:
        emitter = this.particleFactory.invincibilityAura(sprite);
        break;
      case PowerupType.PROJECTILE:
        emitter = this.particleFactory.projectileAura(sprite);
        break;
      default:
        return;
    }
    playerAuras.set(buffType, emitter);
  }

  private stopBuffAura(playerId: string, buffType: number): void {
    const playerAuras = this.buffAuras.get(playerId);
    if (!playerAuras) return;
    const emitter = playerAuras.get(buffType);
    if (emitter && this.particleFactory) {
      this.particleFactory.destroyTrail(emitter);
      playerAuras.delete(buffType);
    }
  }

  private clearAllBuffAuras(): void {
    this.buffAuras.forEach((playerAuras) => {
      playerAuras.forEach((emitter) => {
        if (this.particleFactory) {
          this.particleFactory.destroyTrail(emitter);
        } else {
          emitter.destroy();
        }
      });
      playerAuras.clear();
    });
    this.buffAuras.clear();
  }

  private clearPlayerAuras(playerId: string): void {
    const playerAuras = this.buffAuras.get(playerId);
    if (!playerAuras) return;
    playerAuras.forEach((emitter) => {
      if (this.particleFactory) {
        this.particleFactory.destroyTrail(emitter);
      } else {
        emitter.destroy();
      }
    });
    playerAuras.clear();
    this.buffAuras.delete(playerId);
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
        sessionStorage.setItem(
          'bangerActiveRoom',
          JSON.stringify({
            token: room.reconnectionToken,
            timestamp: Date.now(),
          }),
        );
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
        const roleColor = charColorNum(player.role);

        if (player.health <= 0) {
          // Death: disappear WAV + explosion particles
          if (this.audioManager) this.audioManager.playWAVSFX('disappear');
          if (sprite && this.particleFactory) {
            this.particleFactory.deathExplosion(sprite.x, sprite.y, roleColor);
          }
          // Clear buff auras on death
          this.clearPlayerAuras(sessionId);
          // Camera shake on death (stronger than damage)
          if (isLocal) {
            this.cameras.main.shake(100, 0.005);
          }
        } else {
          // Damage: randomized hurt WAV + sprite flash + hit burst
          if (this.audioManager)
            this.audioManager.playRandomWAV(['hurt_1', 'hurt_2', 'hurt_3', 'hurt_4']);
          if (sprite && this.particleFactory) {
            this.particleFactory.hitBurst(sprite.x, sprite.y, roleColor);
          }
          // Camera shake on damage taken (subtle tactile feedback)
          if (isLocal) {
            this.cameras.main.shake(100, 0.005);
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
          fontSize: '12px',
          color: '#ffaa00',
          fontStyle: 'bold',
          backgroundColor: '#000000',
          padding: { x: 4, y: 2 },
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
      if (dcLabel) {
        dcLabel.destroy();
        this.dcLabels.delete(sessionId);
      }
      if (!this.eliminatedTexts.has(sessionId)) {
        const eliminatedText = this.add.text(player.x, player.y - 40, 'ELIMINATED', {
          fontSize: '14px',
          color: '#ff0000',
          fontStyle: 'bold',
        });
        eliminatedText.setOrigin(0.5);
        eliminatedText.setDepth(12);
        this.eliminatedTexts.set(sessionId, eliminatedText);
      }
    } else {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) sprite.setAlpha(1.0);
      const dcLabel = this.dcLabels.get(sessionId);
      if (dcLabel) {
        dcLabel.destroy();
        this.dcLabels.delete(sessionId);
      }
      const eliminatedText = this.eliminatedTexts.get(sessionId);
      if (eliminatedText) {
        eliminatedText.destroy();
        this.eliminatedTexts.delete(sessionId);
      }
    }

    // Skip position updates during stage transition to prevent visible teleportation
    if (this.inStageTransition) return;

    // Role-specific handling
    if (isLocal) {
      // Sync speed multiplier for prediction accuracy (prevents rubber-banding during speed buff)
      if (this.prediction) {
        this.prediction.setSpeedMultiplier(player.speedMultiplier ?? 1);
      }

      if (this.prediction) {
        this.prediction.reconcile({
          x: player.x,
          y: player.y,
          vx: player.vx || 0,
          vy: player.vy || 0,
          angle: player.angle || 0,
          lastProcessedSeq: player.lastProcessedSeq || 0,
        });
        const state = this.prediction.getState();
        const sprite = this.playerSprites.get(sessionId);
        if (sprite) {
          sprite.x = state.x;
          sprite.y = state.y;
        }
      }
    } else {
      this.interpolation.addSnapshot(sessionId, {
        timestamp: Date.now(),
        x: player.x,
        y: player.y,
        angle: player.angle || 0,
      });
    }
  }

  private attachRoomListeners() {
    if (!this.room) return;

    // Schema-based matchState listener -- sole source of truth for status text
    this.room.state.listen('matchState', (value: string) => {
      if (this.matchEnded) return;
      if (value === 'playing') {
        this.statusText.setText('Match started!');
        this.time.delayedCall(2000, () => {
          if (!this.matchEnded) this.statusText.setVisible(false);
        });
        // Audio: match start fanfare + crossfade to stage music (reconnect path)
        if (this.audioManager) {
          this.audioManager.playSFX('match_start_fanfare');
          if (!this.stageTrack) {
            this.stageTrack =
              STAGE_MUSIC_TRACKS[Math.floor(Math.random() * STAGE_MUSIC_TRACKS.length)];
            this.audioManager.crossfadeTo(this.stageTrack, true, 1000);
          }
        }
      } else if (value === 'waiting') {
        const count = this.room ? this.room.state.players.size : 0;
        this.statusText.setText(`Waiting for players... (${count}/3)`);
        this.statusText.setVisible(true);
      } else if (value === 'stage_end') {
        this.statusText.setText('Stage complete!');
        this.statusText.setVisible(true);
      } else if (value === 'stage_transition') {
        this.statusText.setText('Loading next arena...');
        this.statusText.setVisible(true);
      }
    });

    // Keep matchStart handler for backward compatibility (Schema listener handles display)
    this.room.onMessage('matchStart', () => {
      console.log('matchStart received (handled by Schema listener)');
    });

    this.room.onMessage('matchEnd', (data: any) => {
      this.finalStats = data.stats;
      this.matchWinner = data.winner;
      this.matchEnded = true;

      // Audio: match end fanfare + fade out music (reconnect path)
      if (this.audioManager) {
        this.audioManager.playSFX('match_end_fanfare');
        this.audioManager.fadeOutMusic(500);
      }

      sessionStorage.removeItem('bangerActiveRoom');

      // Stop HUDScene before launching victory overlay (reconnect path)
      this.scene.stop('HUDScene');
      this.hudLaunched = false;

      // Victory/defeat particle burst (reconnect path, use map center)
      if (this.particleFactory && this.room) {
        const localStats = data.stats[this.room.sessionId];
        const localRole = localStats?.role || '';
        const didWin =
          (data.winner === 'paran' && localRole === 'paran') ||
          (data.winner === 'guardians' && localRole !== 'paran');
        const burstColor = didWin ? 0x00ff00 : 0xff0000;
        const burstX = this.mapMetadata ? this.mapMetadata.width / 2 : 400;
        const burstY = this.mapMetadata ? this.mapMetadata.height / 2 : 300;
        this.particleFactory.victoryBurst(burstX, burstY, burstColor);
      }

      this.scene.launch('VictoryScene', {
        winner: data.winner,
        stats: data.stats,
        duration: data.duration,
        localSessionId: this.room!.sessionId,
        room: this.room,
        stageResults: data.stageResults || [],
      });

      this.scene.pause();
    });

    // Stage End: lock controls, start iris wipe CLOSE (reconnect path)
    this.room.onMessage('stageEnd', (data: any) => {
      this.controlsLocked = true;
      this.inStageTransition = true; // Block position updates

      // Audio: stage end fanfare + dip music volume
      if (this.audioManager) {
        this.audioManager.playSFX('match_end_fanfare');
        this.audioManager.dipMusicVolume(0.3);
      }

      // Create iris wipe circle (starts at full size, shrinks to 0)
      const cam = this.cameras.main;
      const cx = cam.width / 2;
      const cy = cam.height / 2;
      const maxRadius = Math.sqrt(cx * cx + cy * cy) + 50;

      const irisShape = this.add
        .circle(cx, cy, maxRadius, 0xffffff)
        .setScrollFactor(0)
        .setVisible(false);
      irisShape.setDepth(1000);
      const mask = irisShape.createGeometryMask();
      cam.setMask(mask);

      this.irisShape = irisShape;
      this.irisMask = mask;

      this.tweens.add({
        targets: irisShape,
        scaleX: 0,
        scaleY: 0,
        duration: 1500,
        ease: 'Sine.easeInOut',
      });
    });

    // Stage Transition: swap tilemap (screen already obscured by iris), show intro overlay (reconnect path)
    this.room.onMessage('stageTransition', (data: any) => {
      // Screen should already be fully obscured by iris mask from stageEnd
      if (this.irisShape) {
        this.irisShape.setScale(0);
      }

      // Clean up old stage visuals
      this.cleanupStageVisuals();

      // Destroy old tilemap
      this.destroyTilemap();

      // Update map metadata reference
      const mapData = MAPS.find((m) => m.name === data.mapName);
      this.mapMetadata = mapData || MAPS[0];

      // Create new tilemap (assets already preloaded in BootScene)
      this.createTilemap(data.mapName);

      // Update prediction arena bounds for new map
      if (this.prediction && this.mapMetadata) {
        this.prediction.setArenaBounds({
          width: this.mapMetadata.width,
          height: this.mapMetadata.height,
        });
      }

      // Launch StageIntroScene overlay
      this.scene.launch('StageIntroScene', {
        stageNumber: data.stageNumber,
        arenaName: data.arenaName,
        paranWins: data.paranWins,
        guardianWins: data.guardianWins,
      });
    });

    // Stage Start: dismiss intro, expand iris to reveal new arena + overview (reconnect path)
    this.room.onMessage('stageStart', (data: any) => {
      // Stop stage intro overlay
      this.scene.stop('StageIntroScene');

      // Re-launch HUD if needed
      if (!this.scene.isActive('HUDScene') && this.room) {
        this.hudLaunched = true;
        this.scene.launch('HUDScene', {
          room: this.room,
          localSessionId: this.room.sessionId,
          localRole: this.localRole,
        });
      }

      // Reset spectator state for new stage (safety net -- cleanupStageVisuals already resets,
      // but the update() loop can re-set isSpectating during the 600ms health reset delay)
      this.isSpectating = false;
      this.spectatorTarget = null;

      // Allow position updates again
      this.inStageTransition = false;

      // Backfill positions from server state -- blocked updates during transition are permanently lost
      // (Colyseus 0.15 delta patches are sent once, the inStageTransition guard discarded them)
      if (this.room) {
        this.room.state.players.forEach((player: any, sessionId: string) => {
          const sprite = this.playerSprites.get(sessionId);
          if (!sprite) return;

          const isLocal = sessionId === this.room!.sessionId;

          if (isLocal) {
            // Snap prediction system to server's current position
            if (this.prediction) {
              this.prediction.reset({
                x: player.x,
                y: player.y,
                vx: 0,
                vy: 0,
                angle: player.angle || 0,
              });
            }
            // Snap sprite directly
            sprite.setPosition(player.x, player.y);
          } else {
            // Snap interpolation system to server's current position (no lerp from old position)
            if (this.interpolation) {
              this.interpolation.snapTo(sessionId, player.x, player.y, player.angle || 0);
            }
            // Snap sprite directly
            sprite.setPosition(player.x, player.y);
          }
        });
      }

      // Iris OPEN: expand circle from 0 to full size
      if (this.irisShape && this.irisMask) {
        this.matchEnded = false;
        this.overviewActive = true;
        this.events.emit('overviewStart');
        this.controlsLocked = true;
        const cam = this.cameras.main;
        cam.stopFollow();
        if (this.mapMetadata) {
          const overviewZoom = Math.min(
            cam.width / this.mapMetadata.width,
            cam.height / this.mapMetadata.height,
          );
          cam.setZoom(overviewZoom);
          cam.centerOn(this.mapMetadata.width / 2, this.mapMetadata.height / 2);
        }

        this.tweens.add({
          targets: this.irisShape,
          scaleX: 1,
          scaleY: 1,
          duration: 800,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            const cam = this.cameras.main;
            cam.clearMask(false);
            if (this.irisShape) {
              this.irisShape.destroy();
              this.irisShape = null;
            }
            this.irisMask = null;

            this.time.delayedCall(700, () => {
              if (this.room) {
                const localSprite = this.playerSprites.get(this.room.sessionId);
                if (localSprite) {
                  cam.startFollow(localSprite, true, 0.12, 0.12);
                  cam.setDeadzone(20, 15);
                }
              }
              cam.zoomTo(2, 800, 'Sine.easeInOut');
              this.time.delayedCall(800, () => {
                this.controlsLocked = false;
                this.overviewActive = false;
                if (this.audioManager) this.audioManager.restoreMusicVolume();
                this.events.emit('overviewEnd');
              });
            });
          },
        });
      } else {
        // Fallback: no iris (e.g., reconnect mid-transition) -- just do overview
        this.matchEnded = false;
        if (this.audioManager) this.audioManager.restoreMusicVolume();
        this.startMatchOverview();
      }
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
          if (this.wallFrontsLayer) {
            this.wallFrontsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY + 1);
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
            if (this.wallFrontsLayer) {
              this.wallFrontsLayer.putTileAt(0, obstacle.tileX, obstacle.tileY + 1);
            }
          }
        });
      });
    }

    // Re-attach powerup Schema listeners (reconnection)
    this.room.state.powerups.onAdd((powerup: any, key: string) => {
      const textureKey = POWERUP_TEXTURE[powerup.powerupType] || 'potion_speed';
      const sprite = this.add.sprite(powerup.x, powerup.y, textureKey);
      sprite.setDisplaySize(32, 32);
      sprite.setDepth(8);
      this.powerupSprites.set(key, sprite);

      // Idle particle aura around ground powerup for visibility
      if (this.particleFactory) {
        const idleTint =
          powerup.powerupType === PowerupType.SPEED
            ? 0x4488ff
            : powerup.powerupType === PowerupType.INVINCIBILITY
              ? 0xffcc00
              : 0xff4422;
        const idleEmitter = this.particleFactory.createPowerupIdleAura(sprite, idleTint);
        this.powerupIdleEmitters.set(key, idleEmitter);
      }

      const tween = this.tweens.add({
        targets: sprite,
        y: powerup.y - 4,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.powerupTweens.set(key, tween);

      if (this.audioManager) this.audioManager.playSFX('powerup_spawn');
    });

    this.room.state.powerups.onRemove((_powerup: any, key: string) => {
      // Destroy idle aura emitter before sprite
      const idleEmitter = this.powerupIdleEmitters.get(key);
      if (idleEmitter && this.particleFactory) {
        this.particleFactory.destroyTrail(idleEmitter);
        this.powerupIdleEmitters.delete(key);
      }

      const sprite = this.powerupSprites.get(key);
      if (sprite) {
        sprite.destroy();
        this.powerupSprites.delete(key);
      }
      const tween = this.powerupTweens.get(key);
      if (tween) {
        tween.destroy();
        this.powerupTweens.delete(key);
      }
    });

    // Re-attach powerup broadcast listeners (reconnection)
    this.room.onMessage('powerupCollect', (data: any) => {
      if (this.audioManager) this.audioManager.playSFX('powerup_pickup');

      const playerSprite = this.playerSprites.get(data.playerId);
      if (playerSprite) {
        const floatText = this.add
          .text(playerSprite.x, playerSprite.y - 30, data.typeName, {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(25);

        this.tweens.add({
          targets: floatText,
          y: floatText.y - 30,
          alpha: 0,
          duration: 1200,
          ease: 'Cubic.easeOut',
          onComplete: () => floatText.destroy(),
        });
      }

      const sprite = this.playerSprites.get(data.playerId);
      if (sprite && this.particleFactory) {
        this.startBuffAura(data.playerId, Number(data.type), sprite);
      }

      // Track projectile buff for local player (Paran beam fire SFX) -- reconnect path
      if (data.playerId === this.room!.sessionId && Number(data.type) === PowerupType.PROJECTILE) {
        this.hasProjectileBuff = true;
      }
    });

    this.room.onMessage('powerupDespawn', (_data: any) => {
      if (this.audioManager) this.audioManager.playSFX('powerup_despawn');
    });

    this.room.onMessage('buffExpired', (data: any) => {
      this.stopBuffAura(data.playerId, Number(data.type));
      // Clear projectile buff tracking for local player -- reconnect path
      if (data.playerId === this.room!.sessionId && Number(data.type) === PowerupType.PROJECTILE) {
        this.hasProjectileBuff = false;
      }
    });
  }

  /**
   * Clean up all stage-specific visual objects between stages.
   * Preserves player sprites (they persist across stages) but resets their visual state.
   */
  private cleanupStageVisuals(): void {
    // Destroy all projectile sprites and trails
    this.projectileSprites.forEach((sprite) => sprite.destroy());
    this.projectileSprites.clear();
    this.projectileVelocities.clear();
    this.projectileTrails.forEach((trail) => {
      if (this.particleFactory) this.particleFactory.destroyTrail(trail);
    });
    this.projectileTrails.clear();

    // Destroy eliminated texts and DC labels
    this.eliminatedTexts.forEach((text) => text.destroy());
    this.eliminatedTexts.clear();
    this.dcLabels.forEach((text) => text.destroy());
    this.dcLabels.clear();

    // Reset player sprite alpha and animations (but keep sprites alive -- players persist)
    this.playerSprites.forEach((sprite, sessionId) => {
      sprite.setAlpha(1.0);
      sprite.clearTint();
      const role = this.playerRoles.get(sessionId);
      if (role) {
        sprite.play(`${role}-idle`);
        this.playerAnimKeys.set(sessionId, `${role}-idle`);
      }
    });

    // Reset health cache
    this.playerHealthCache.clear();
    this.prevHealth.clear();

    // Destroy powerup sprites and tweens
    this.powerupSprites.forEach((sprite) => sprite.destroy());
    this.powerupSprites.clear();
    this.powerupTweens.forEach((tween) => tween.destroy());
    this.powerupTweens.clear();

    // Destroy powerup idle aura emitters
    this.powerupIdleEmitters.forEach((emitter) => {
      if (this.particleFactory) this.particleFactory.destroyTrail(emitter);
    });
    this.powerupIdleEmitters.clear();

    // Destroy all buff auras (must be before particleFactory.destroy())
    this.clearAllBuffAuras();

    // Destroy particle factory (recreated after new tilemap)
    if (this.particleFactory) {
      this.particleFactory.destroy();
      this.particleFactory = null;
    }

    // Reset spectator state (players are alive again)
    this.isSpectating = false;
    this.spectatorTarget = null;
  }

  /**
   * Destroy the current tilemap and all its layers.
   * Must be called before creating a new tilemap for stage transitions.
   */
  private destroyTilemap(): void {
    // Destroy layers (must destroy before tilemap)
    if (this.wallsLayer) {
      this.wallsLayer.destroy();
      this.wallsLayer = null;
    }
    if (this.wallFrontsLayer) {
      this.wallFrontsLayer.destroy();
      this.wallFrontsLayer = null;
    }
    if (this.groundLayer) {
      this.groundLayer.destroy();
      this.groundLayer = null;
    }
    // Destroy tilemap itself (cleans up layer cache)
    if (this.currentTilemap) {
      this.currentTilemap.destroy();
      this.currentTilemap = null;
    }
    // Clear collision grid
    this.collisionGrid = null;
    if (this.prediction) {
      this.prediction.setCollisionGrid(null);
    }
    // Clear debug collision overlay
    if (this.debugCollisionOverlay) {
      this.debugCollisionOverlay.destroy();
      this.debugCollisionOverlay = null;
    }
  }

  /**
   * Match-start overview: show full arena at zoom=1.0 for 1.5s, then zoom to local player.
   * Controls are locked during the animation.
   */
  private startMatchOverview(): void {
    if (!this.mapMetadata) {
      // Defer: matchState arrived before onStateChange.once() set mapMetadata
      this.pendingOverview = true;
      return;
    }

    const cam = this.cameras.main;

    // Lock controls during overview
    this.controlsLocked = true;
    this.overviewActive = true;
    this.events.emit('overviewStart');

    // Show full arena at overview zoom (dynamically calculated for arena size)
    cam.stopFollow();
    const overviewZoom = Math.min(
      cam.width / this.mapMetadata.width,
      cam.height / this.mapMetadata.height,
    );
    cam.setZoom(overviewZoom);
    cam.centerOn(this.mapMetadata.width / 2, this.mapMetadata.height / 2);

    // After 1.5s, zoom to local player position
    this.time.delayedCall(1500, () => {
      // Start following local player
      if (this.room) {
        const localSprite = this.playerSprites.get(this.room.sessionId);
        if (localSprite) {
          cam.startFollow(localSprite, true, 0.12, 0.12);
          cam.setDeadzone(20, 15);
        }
      }
      // Smooth zoom to gameplay level
      cam.zoomTo(2, 800, 'Sine.easeInOut');

      // Unlock controls after zoom completes
      this.time.delayedCall(800, () => {
        this.controlsLocked = false;
        this.overviewActive = false;
        this.events.emit('overviewEnd');
      });
    });
  }

  /**
   * Toggle F3 debug collision overlay: renders colored rectangles showing
   * per-tile collision sub-rects. Red = indestructible walls, orange/yellow/green = obstacle tiers.
   */
  private toggleDebugCollisionOverlay(): void {
    if (this.debugCollisionOverlay) {
      this.debugCollisionOverlay.destroy();
      this.debugCollisionOverlay = null;
      return;
    }

    if (!this.collisionGrid) return;

    this.debugCollisionOverlay = this.add.graphics();
    this.debugCollisionOverlay.setDepth(999);

    const grid = this.collisionGrid;
    const ts = grid.tileSize;

    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const info = grid.getTileInfo(tx, ty);
        if (!info || !info.solid) continue;

        const rect = info.collisionRect;
        const worldX = tx * ts + rect.x;
        const worldY = ty * ts + rect.y;

        // Color by type: red for indestructible walls, orange/yellow/green for obstacle tiers
        let color = 0xff0000; // indestructible walls
        if (info.destructible) {
          if (info.tileId === 101)
            color = 0xff8800; // heavy
          else if (info.tileId === 102)
            color = 0xffff00; // medium
          else color = 0x00ff00; // light
        }

        this.debugCollisionOverlay.lineStyle(1, color, 0.6);
        this.debugCollisionOverlay.fillStyle(color, 0.15);
        this.debugCollisionOverlay.fillRect(worldX, worldY, rect.w, rect.h);
        this.debugCollisionOverlay.strokeRect(worldX, worldY, rect.w, rect.h);
      }
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

    // Store tilemap reference for destroy on stage transition
    this.currentTilemap = map;

    // Get the tileset name from the map JSON (per-map tileset names)
    const tilesetInfo = MAP_TILESET_INFO[mapKey] || Object.values(MAP_TILESET_INFO)[0];
    const tileset = map.addTilesetImage(tilesetInfo.name, tilesetInfo.key);

    if (!tileset) {
      console.error(
        `Failed to load tileset for map ${mapKey} (name=${tilesetInfo.name}, key=${tilesetInfo.key})`,
      );
      return;
    }

    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallFrontsLayer = map.createLayer('WallFronts', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);

    if (!wallsLayer) {
      console.error('Failed to create Walls layer');
      return;
    }

    wallsLayer.setCollisionByExclusion([-1, 0]);

    // Store layer references for obstacle destruction rendering and stage transitions
    this.wallsLayer = wallsLayer;
    this.wallFrontsLayer = wallFrontsLayer;
    this.groundLayer = groundLayer;

    // Build collision grid from map data for client prediction
    const mapData = this.cache.tilemap.get(mapKey);
    if (mapData) {
      const wallLayerData = mapData.data.layers.find((l: any) => l.name === 'Walls');
      if (wallLayerData) {
        const collisionShapes = mapData.data.tilesets?.[0]?.properties?.collisionShapes || {};

        this.collisionGrid = new CollisionGrid(
          wallLayerData.data,
          mapData.data.width,
          mapData.data.height,
          mapData.data.tilewidth,
          OBSTACLE_TILE_IDS.destructible,
          OBSTACLE_TILE_IDS.indestructible,
          collisionShapes,
        );

        // Pass collision grid to prediction system
        if (this.prediction) {
          this.prediction.setCollisionGrid(this.collisionGrid);
        }

        // Share collision grid via registry for HUDScene minimap
        this.registry.set('collisionGrid', this.collisionGrid);

        // Update prediction arena bounds now that mapMetadata is confirmed
        if (this.prediction && this.mapMetadata) {
          this.prediction.setArenaBounds({
            width: this.mapMetadata.width,
            height: this.mapMetadata.height,
          });
        }
      }
    }

    // Share map metadata via registry for HUDScene minimap
    if (this.mapMetadata) {
      this.registry.set('mapMetadata', this.mapMetadata);
    }

    // Initialize particle effects after tilemap is ready
    this.particleFactory = new ParticleFactory(this);

    // Set up camera bounds and zoom after tilemap is ready
    if (this.mapMetadata) {
      const cam = this.cameras.main;
      cam.setBounds(0, 0, this.mapMetadata.width, this.mapMetadata.height);

      if (!this.overviewActive) {
        cam.setZoom(2);

        // Fallback: if no overview animation is pending and camera isn't following anyone,
        // start following local player directly (safety net for any missed code path)
        if (!this.pendingOverview && !(cam as any)._follow && this.room) {
          const localSprite = this.playerSprites.get(this.room.sessionId);
          if (localSprite) {
            cam.startFollow(localSprite, true, 0.12, 0.12);
            cam.setDeadzone(20, 15);
          }
        }
      }
    }

    console.log(`Tilemap ${mapKey} created successfully`);

    // Fire deferred match overview if matchState arrived before mapMetadata
    if (this.pendingOverview) {
      this.pendingOverview = false;
      this.startMatchOverview();
    }
  }
}
