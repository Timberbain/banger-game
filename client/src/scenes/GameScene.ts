import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { PredictionSystem } from '../systems/Prediction';
import { InterpolationSystem } from '../systems/Interpolation';
import { InputState } from '../../../shared/physics';

export class GameScene extends Phaser.Scene {
  private client!: Client;
  private room: Room | null = null;
  private playerSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private connected: boolean = false;
  private statusText!: Phaser.GameObjects.Text;

  // Client prediction and interpolation systems
  private prediction: PredictionSystem | null = null;
  private interpolation: InterpolationSystem = new InterpolationSystem();
  private remotePlayers: Set<string> = new Set();

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    // Load tileset and tilemap (cached by Phaser if already loaded in BootScene)
    this.load.image('tiles', 'tilesets/placeholder.png');
    this.load.tilemapTiledJSON('test_arena', 'maps/test_arena.json');
  }

  async create() {
    // Set up tilemap
    const map = this.make.tilemap({ key: 'test_arena' });
    const tileset = map.addTilesetImage('placeholder', 'tiles');

    if (!tileset) {
      console.error('Failed to load tileset');
      return;
    }

    // Create layers
    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);

    if (!groundLayer || !wallsLayer) {
      console.error('Failed to create layers');
      return;
    }

    // Set collision for wall tiles
    wallsLayer.setCollisionByExclusion([-1, 0]);

    // Set up keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    };

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
      this.room = await this.client.joinOrCreate('game_room');
      this.connected = true;
      this.statusText.setText(`Connected: ${this.room.sessionId}`);

      console.log('Connected to game_room:', this.room.sessionId);

      // Listen for players joining
      this.room.state.players.onAdd((player: any, sessionId: string) => {
        console.log('Player joined:', sessionId);

        const isLocal = sessionId === this.room!.sessionId;

        // Create a colored rectangle (24x24) as placeholder player sprite
        const color = isLocal ? 0x00ff88 : 0xff4444; // Green for local, red for others
        const rect = this.add.rectangle(player.x, player.y, 24, 24, color);
        rect.setDepth(10); // Above tilemap
        this.playerSprites.set(sessionId, rect);

        // Add player name text above sprite
        const nameText = this.add.text(
          player.x,
          player.y - 20,
          player.name || sessionId.slice(0, 6),
          {
            fontSize: '12px',
            color: '#ffffff',
          }
        );
        nameText.setOrigin(0.5);
        nameText.setDepth(11);
        this.playerLabels.set(sessionId, nameText);

        if (isLocal) {
          // Local player: initialize prediction system
          this.prediction = new PredictionSystem({
            x: player.x,
            y: player.y,
            vx: player.vx || 0,
            vy: player.vy || 0,
            angle: player.angle || 0,
          });

          // Set up reconciliation on server state changes
          player.onChange(() => {
            if (this.prediction) {
              this.prediction.reconcile({
                x: player.x,
                y: player.y,
                vx: player.vx || 0,
                vy: player.vy || 0,
                angle: player.angle || 0,
                lastProcessedSeq: player.lastProcessedSeq || 0,
              });

              // Update sprite from reconciled prediction state
              const state = this.prediction.getState();
              const sprite = this.playerSprites.get(sessionId);
              if (sprite) {
                sprite.x = state.x;
                sprite.y = state.y;
              }
              const label = this.playerLabels.get(sessionId);
              if (label) {
                label.x = state.x;
                label.y = state.y - 20;
              }
            }
          });
        } else {
          // Remote player: use interpolation
          this.remotePlayers.add(sessionId);

          // Add snapshots on server state changes
          player.onChange(() => {
            this.interpolation.addSnapshot(sessionId, {
              timestamp: Date.now(),
              x: player.x,
              y: player.y,
              angle: player.angle || 0,
            });
          });
        }
      });

      // Listen for players leaving
      this.room.state.players.onRemove((player: any, sessionId: string) => {
        console.log('Player left:', sessionId);

        // Clean up interpolation buffer for remote players
        if (this.remotePlayers.has(sessionId)) {
          this.interpolation.removePlayer(sessionId);
          this.remotePlayers.delete(sessionId);
        }

        const sprite = this.playerSprites.get(sessionId);
        if (sprite) {
          sprite.destroy();
          this.playerSprites.delete(sessionId);
        }
        const label = this.playerLabels.get(sessionId);
        if (label) {
          label.destroy();
          this.playerLabels.delete(sessionId);
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

    // Read current keyboard state
    const input: InputState = {
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
    };

    // Send input every frame — acceleration physics needs one input per tick
    // to match server simulation. Only skip if truly idle (no keys, no velocity).
    const hasInput = input.left || input.right || input.up || input.down;
    const hasVelocity = (() => {
      const s = this.prediction!.getState();
      return Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01;
    })();

    if (hasInput || hasVelocity) {
      this.prediction.sendInput(input, this.room);
    }

    // Update local player sprite from prediction state
    const localSessionId = this.room.sessionId;
    const state = this.prediction.getState();
    const localSprite = this.playerSprites.get(localSessionId);
    if (localSprite) {
      localSprite.x = state.x;
      localSprite.y = state.y;
      // Optionally: localSprite.rotation = state.angle;
    }
    const localLabel = this.playerLabels.get(localSessionId);
    if (localLabel) {
      localLabel.x = state.x;
      localLabel.y = state.y - 20;
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
          sprite.x = interpolated.x;
          sprite.y = interpolated.y;
          // Optionally: sprite.rotation = interpolated.angle;
        }
        const label = this.playerLabels.get(sessionId);
        if (label) {
          label.x = interpolated.x;
          label.y = interpolated.y - 20;
        }
      }
    }
  }
}
