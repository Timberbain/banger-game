import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';
import { PredictionSystem } from '../systems/Prediction';
import { InterpolationSystem } from '../systems/Interpolation';
import { InputState } from '../../../shared/physics';
import { CHARACTERS } from '../../../shared/characters';

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
  private fireKey!: Phaser.Input.Keyboard.Key;
  private connected: boolean = false;
  private statusText!: Phaser.GameObjects.Text;

  // Client prediction and interpolation systems
  private prediction: PredictionSystem | null = null;
  private interpolation: InterpolationSystem = new InterpolationSystem();
  private remotePlayers: Set<string> = new Set();

  // Combat rendering
  private projectileSprites: Map<number, Phaser.GameObjects.Arc> = new Map();
  private healthBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private eliminatedTexts: Map<string, Phaser.GameObjects.Text> = new Map();

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
    this.fireKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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

        // Determine initial role-based visuals
        const role = player.role || 'faran'; // Default to faran if role not yet assigned
        const isParan = role === 'paran';
        const size = isParan ? 32 : 24;
        let color: number;
        if (isParan) {
          color = 0xff4444; // Red for Paran
        } else {
          color = isLocal ? 0x00ff88 : 0x4488ff; // Green for local guardian, blue for remote
        }

        // Create a colored rectangle as placeholder player sprite
        const rect = this.add.rectangle(player.x, player.y, size, size, color);
        rect.setDepth(10); // Above tilemap
        this.playerSprites.set(sessionId, rect);

        // Create health bar above player
        const healthBar = this.add.graphics();
        healthBar.setDepth(11);
        this.healthBars.set(sessionId, healthBar);
        this.updateHealthBar(sessionId, player.health, role);

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

        // Common onChange handler for role and health updates
        player.onChange(() => {
          // Update visuals when role changes
          if (player.role) {
            const sprite = this.playerSprites.get(sessionId);
            if (sprite) {
              const isParan = player.role === 'paran';
              const size = isParan ? 32 : 24;
              let color: number;
              if (isParan) {
                color = 0xff4444; // Red for Paran
              } else {
                color = isLocal ? 0x00ff88 : 0x4488ff; // Green for local guardian, blue for remote
              }
              sprite.setSize(size, size);
              sprite.setFillStyle(color);
            }
          }

          // Update health bar
          this.updateHealthBar(sessionId, player.health, player.role);

          // Handle dead state
          if (player.health <= 0) {
            const sprite = this.playerSprites.get(sessionId);
            if (sprite) {
              sprite.setAlpha(0.3); // Ghosted
            }
            // Show ELIMINATED text if not already shown
            if (!this.eliminatedTexts.has(sessionId)) {
              const eliminatedText = this.add.text(
                player.x,
                player.y - 40,
                'ELIMINATED',
                {
                  fontSize: '14px',
                  color: '#ff0000',
                  fontStyle: 'bold',
                }
              );
              eliminatedText.setOrigin(0.5);
              eliminatedText.setDepth(12);
              this.eliminatedTexts.set(sessionId, eliminatedText);
            }
          } else {
            // Alive - ensure sprite is opaque
            const sprite = this.playerSprites.get(sessionId);
            if (sprite) {
              sprite.setAlpha(1.0);
            }
            // Remove eliminated text if it exists
            const eliminatedText = this.eliminatedTexts.get(sessionId);
            if (eliminatedText) {
              eliminatedText.destroy();
              this.eliminatedTexts.delete(sessionId);
            }
          }

          // Role-specific handling
          if (isLocal) {
            // Local player: reconciliation
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
          } else {
            // Remote player: interpolation
            this.interpolation.addSnapshot(sessionId, {
              timestamp: Date.now(),
              x: player.x,
              y: player.y,
              angle: player.angle || 0,
            });
          }
        });

        if (isLocal) {
          // Local player: initialize prediction system
          this.prediction = new PredictionSystem({
            x: player.x,
            y: player.y,
            vx: player.vx || 0,
            vy: player.vy || 0,
            angle: player.angle || 0,
          });
        } else {
          // Remote player: use interpolation
          this.remotePlayers.add(sessionId);
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
        const healthBar = this.healthBars.get(sessionId);
        if (healthBar) {
          healthBar.destroy();
          this.healthBars.delete(sessionId);
        }
        const eliminatedText = this.eliminatedTexts.get(sessionId);
        if (eliminatedText) {
          eliminatedText.destroy();
          this.eliminatedTexts.delete(sessionId);
        }
      });

      // Listen for projectiles
      this.room.state.projectiles.onAdd((projectile: any, key: string) => {
        const index = parseInt(key, 10);
        const color = projectile.ownerId === this.room!.sessionId ? 0xffff00 : 0xff6600;
        const circle = this.add.circle(projectile.x, projectile.y, 4, color);
        circle.setDepth(5);
        this.projectileSprites.set(index, circle);

        projectile.onChange(() => {
          circle.x = projectile.x;
          circle.y = projectile.y;
        });
      });

      this.room.state.projectiles.onRemove((projectile: any, key: string) => {
        const index = parseInt(key, 10);
        const sprite = this.projectileSprites.get(index);
        if (sprite) {
          sprite.destroy();
          this.projectileSprites.delete(index);
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

    // Check if local player is dead
    const localPlayer = this.room.state.players.get(this.room.sessionId);
    const isDead = localPlayer && localPlayer.health <= 0;

    // Read current keyboard state
    const input: InputState = {
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
      fire: this.fireKey.isDown,
    };

    // Send input every frame — acceleration physics needs one input per tick
    // to match server simulation. Only skip if truly idle (no keys, no velocity) OR dead.
    const hasInput = input.left || input.right || input.up || input.down;
    const hasVelocity = (() => {
      const s = this.prediction!.getState();
      return Math.abs(s.vx) > 0.01 || Math.abs(s.vy) > 0.01;
    })();

    if (!isDead && (hasInput || hasVelocity || input.fire)) {
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

    // Update health bar and eliminated text positions
    this.room.state.players.forEach((player: any, sessionId: string) => {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        const healthBar = this.healthBars.get(sessionId);
        if (healthBar) {
          // Position health bar above sprite
          this.drawHealthBar(healthBar, sprite.x, sprite.y - 25, player.health, player.role);
        }
        const eliminatedText = this.eliminatedTexts.get(sessionId);
        if (eliminatedText) {
          eliminatedText.x = sprite.x;
          eliminatedText.y = sprite.y - 40;
        }
      }
    });
  }

  private updateHealthBar(sessionId: string, health: number, role: string): void {
    const healthBar = this.healthBars.get(sessionId);
    if (healthBar) {
      const sprite = this.playerSprites.get(sessionId);
      if (sprite) {
        this.drawHealthBar(healthBar, sprite.x, sprite.y - 25, health, role);
      }
    }
  }

  private drawHealthBar(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    health: number,
    role: string
  ): void {
    graphics.clear();

    const maxHealth = role ? CHARACTERS[role]?.maxHealth || 50 : 50;
    const healthPercent = Math.max(0, health) / maxHealth;

    const barWidth = 30;
    const barHeight = 4;
    const barX = x - barWidth / 2;
    const barY = y;

    // Background (red)
    graphics.fillStyle(0x990000, 1);
    graphics.fillRect(barX, barY, barWidth, barHeight);

    // Foreground (green)
    graphics.fillStyle(0x00ff00, 1);
    graphics.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    graphics.setPosition(0, 0); // Graphics object uses world coordinates
  }
}
