import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';

interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

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

        // Create a colored rectangle (24x24) as placeholder player sprite
        const isLocal = sessionId === this.room!.sessionId;
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

        // Listen for state changes on this player
        player.onChange(() => {
          const sprite = this.playerSprites.get(sessionId);
          if (sprite) {
            sprite.x = player.x;
            sprite.y = player.y;
          }
          const label = this.playerLabels.get(sessionId);
          if (label) {
            label.x = player.x;
            label.y = player.y - 20;
          }
        });
      });

      // Listen for players leaving
      this.room.state.players.onRemove((player: any, sessionId: string) => {
        console.log('Player left:', sessionId);

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
    if (!this.connected || !this.room) {
      return;
    }

    // Read current keyboard state
    const input: InputState = {
      left: this.cursors.left.isDown || this.wasd.A.isDown,
      right: this.cursors.right.isDown || this.wasd.D.isDown,
      up: this.cursors.up.isDown || this.wasd.W.isDown,
      down: this.cursors.down.isDown || this.wasd.S.isDown,
    };

    // Only send input if any key is pressed (don't spam empty inputs)
    if (input.left || input.right || input.up || input.down) {
      this.room.send('input', input);
    }

    // IMPORTANT: Do NOT apply movement locally. This is pure server authority.
    // The sprite position updates ONLY from server state via onChange callback.
  }
}
