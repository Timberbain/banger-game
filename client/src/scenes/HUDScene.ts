import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { MessageRouter } from '../systems/MessageRouter';
import { CHARACTERS } from '../../../shared/characters';
import { PowerupType } from '../../../shared/powerups';
import { CollisionGrid } from '../../../shared/collisionGrid';
import {
  Colors,
  TextStyle,
  CooldownBar,
  Layout,
  HudBackdrop,
  charColor,
  charColorNum,
} from '../ui/designTokens';

const MATCH_DURATION_MS = 300000; // 5 minutes

interface KillFeedEntry {
  objects: Phaser.GameObjects.GameObject[];
  bg: Phaser.GameObjects.Rectangle;
  addedAt: number;
}

/**
 * HUDScene - Overlay scene for in-game HUD elements.
 * Launched alongside GameScene (not started) so it renders on top.
 * Uses viewport-relative positioning (camera width/height) for all elements.
 * Camera stays at zoom=1, scroll (0,0) -- independent of GameScene camera.
 */
export class HUDScene extends Phaser.Scene {
  // Room reference
  private room: Room | null = null;
  private messageRouter: MessageRouter | null = null;
  private localSessionId: string = '';
  private localRole: string = '';

  // Viewport dimensions (set in create)
  private W: number = 1280;
  private H: number = 720;

  // Heart-based health display (local player only)
  private heartIcons: Phaser.GameObjects.Image[] = [];
  private localPlayerLabel: Phaser.GameObjects.Text | null = null;

  // Match timer
  private timerText: Phaser.GameObjects.Text | null = null;
  private timerIcon: Phaser.GameObjects.Image | null = null;
  private timerFlashTimer: Phaser.Time.TimerEvent | null = null;
  private isTimerFlashing: boolean = false;

  // Kill feed
  private killFeedEntries: KillFeedEntry[] = [];
  private killFeedMaxEntries: number = 4;
  private killFeedFadeDuration: number = 5000;

  // Cooldown display
  private cooldownBg: Phaser.GameObjects.Rectangle | null = null;
  private cooldownFill: Phaser.GameObjects.Rectangle | null = null;
  private lastFireTime: number = 0;
  private cooldownMs: number = 0;

  // Ping display
  private pingText: Phaser.GameObjects.Text | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private currentPing: number = 0;

  // Role identity
  private roleBanner: Phaser.GameObjects.Text | null = null;
  private roleReminder: Phaser.GameObjects.Text | null = null;

  // Spectator HUD
  private spectatorBar: Phaser.GameObjects.Text | null = null;
  private spectatorInstruction: Phaser.GameObjects.Text | null = null;
  private isSpectating: boolean = false;
  private spectatorTargetName: string = '';
  private spectatorTargetRole: string = '';

  // Match countdown
  private countdownText: Phaser.GameObjects.Text | null = null;

  // Round score display (pips)
  private roundScorePipsGfx: Phaser.GameObjects.Graphics | null = null;
  private stageLabel: Phaser.GameObjects.Text | null = null;

  // Buff indicators (radial timer sweep)
  private buffIndicators: Map<
    number,
    {
      icon: Phaser.GameObjects.Image;
      radialGfx: Phaser.GameObjects.Graphics;
      startTime: number;
      duration: number;
      flashTimer?: Phaser.Time.TimerEvent;
    }
  > = new Map();

  // Minimap
  private minimapGfx: Phaser.GameObjects.Graphics | null = null;
  private minimapVisible: boolean = true;
  private minimapUserToggled: boolean = true;
  private minimapToggleKey: Phaser.Input.Keyboard.Key | null = null;
  private minimapFrameCounter: number = 0;
  private minimapDeathMarkers: Array<{ x: number; y: number; color: number; time: number }> = [];
  private minimapToggleJustPressed: boolean = false;

  // Top-center backdrop
  private topCenterBackdrop: Phaser.GameObjects.Graphics | null = null;

  // Death overlay
  private deathOverlayObjects: Phaser.GameObjects.GameObject[] = [];

  // GameScene reference for cross-scene events
  private gameScene: Phaser.Scene | null = null;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(data: { room: Room; localSessionId: string; localRole: string }) {
    // Reset ALL member variables for scene reuse (scene.start skips constructor)
    if (this.messageRouter) this.messageRouter.clear();
    this.messageRouter = null;
    this.room = null;
    this.localSessionId = '';
    this.localRole = '';
    this.heartIcons = [];
    this.localPlayerLabel = null;
    this.timerText = null;
    this.timerIcon = null;
    this.timerFlashTimer = null;
    this.isTimerFlashing = false;
    this.killFeedEntries = [];
    this.cooldownBg = null;
    this.cooldownFill = null;
    this.lastFireTime = 0;
    this.cooldownMs = 0;
    this.pingText = null;
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.currentPing = 0;
    this.roleBanner = null;
    this.roleReminder = null;
    this.spectatorBar = null;
    this.spectatorInstruction = null;
    this.isSpectating = false;
    this.spectatorTargetName = '';
    this.spectatorTargetRole = '';
    this.countdownText = null;
    this.roundScorePipsGfx = null;
    this.stageLabel = null;
    this.buffIndicators = new Map();
    this.minimapGfx = null;
    this.minimapVisible = true;
    this.minimapUserToggled = this.registry.get('minimapUserToggled') ?? true;
    this.minimapToggleKey = null;
    this.minimapFrameCounter = 0;
    this.minimapDeathMarkers = [];
    this.minimapToggleJustPressed = false;
    this.topCenterBackdrop = null;
    this.deathOverlayObjects = [];
    this.gameScene = null;

    // Transparent background so GameScene shows through
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');
    // HUD should not scroll with game camera -- fixed overlay at zoom=1
    this.cameras.main.setScroll(0, 0);

    // Viewport dimensions for all positioning
    this.W = this.cameras.main.width;
    this.H = this.cameras.main.height;

    // Store references
    this.room = data.room;
    this.messageRouter = new MessageRouter(this.room);
    this.localSessionId = data.localSessionId;
    this.localRole = data.localRole;

    // Get GameScene reference for cross-scene events
    this.gameScene = this.scene.get('GameScene');

    // 1. Create health display (heart icons, bottom of screen, local player only)
    this.createHealthBars();

    // 2. Create match timer (top center)
    this.createMatchTimer();

    // 3. Set up kill feed listener (top-right)
    this.setupKillFeed();

    // 4. Create cooldown display (above local health bar)
    this.createCooldownDisplay();

    // 5. Create ping display (top-right corner)
    this.createPingDisplay();

    // 6. Show role identity banner
    this.showRoleBanner();

    // 7. Set up spectator HUD (hidden by default)
    this.createSpectatorHUD();

    // 8. Set up match countdown listener
    this.setupMatchCountdown();

    // 9. Create round score display (top center, below timer)
    this.createRoundScore();

    // 9b. Dark backdrop behind top-center HUD cluster
    this.createTopCenterBackdrop();

    // 10. Create minimap overlay (top-right)
    this.createMinimap();

    // Cross-scene event listeners
    this.setupCrossSceneEvents();

    // Cleanup on shutdown
    this.events.on('shutdown', this.onShutdown, this);
    this.events.on('destroy', this.onShutdown, this);
  }

  update(time: number, _delta: number) {
    if (!this.room) return;

    // Update health display (heart icons)
    this.updateHealthBars();

    // Update match timer
    this.updateMatchTimer();

    // Update kill feed (fade out old entries)
    this.updateKillFeed(time);

    // Update cooldown display
    this.updateCooldownDisplay();

    // Update ping display color
    this.updatePingDisplay();

    // Update buff indicator fill bars (shrinking over time)
    this.updateBuffIndicators();

    // Update minimap (toggle + throttled redraw at ~10Hz)
    this.updateMinimap();
  }

  // =====================
  // 1. HEALTH DISPLAY (Heart Icons - Local Player Only)
  // =====================

  private createHealthBars(): void {
    if (!this.room) return;

    // Use a slight delay to allow state sync
    this.time.delayedCall(100, () => {
      this.rebuildHealthBars();
    });

    // Re-build hearts when players are added or removed
    if (this.room.state.players) {
      this.room.state.players.onAdd(() => {
        this.time.delayedCall(50, () => this.rebuildHealthBars());
      });
      this.room.state.players.onRemove(() => {
        this.time.delayedCall(50, () => this.rebuildHealthBars());
      });
    }
  }

  private rebuildHealthBars(): void {
    // Clean up existing heart icons and label
    for (const icon of this.heartIcons) {
      icon.destroy();
    }
    this.heartIcons = [];
    if (this.localPlayerLabel) {
      this.localPlayerLabel.destroy();
      this.localPlayerLabel = null;
    }

    if (!this.room) return;

    // Find the local player
    const localPlayer = this.room.state.players.get(this.localSessionId);
    if (!localPlayer) return;

    const role = localPlayer.role || 'faran';
    const maxHealth = CHARACTERS[role]?.maxHealth || 100;
    const heartCount = Math.ceil(maxHealth / 10); // 10 HP per heart
    const iconSize = 32;
    const iconSpacing = 34; // 32px icon + 2px gap
    const heartY = this.H * 0.92;

    // Center the heart row horizontally
    const totalWidth = heartCount * iconSpacing - 2; // subtract last gap
    const startX = this.W / 2 - totalWidth / 2;

    for (let i = 0; i < heartCount; i++) {
      const x = startX + i * iconSpacing + iconSize / 2;
      const heart = this.add.image(x, heartY, 'icon_heart_full');
      heart.setDisplaySize(iconSize, iconSize);
      heart.setDepth(200);
      this.heartIcons.push(heart);
    }

    // Player name label below the heart row
    const playerName = localPlayer.name || role;
    this.localPlayerLabel = this.add.text(
      this.W / 2,
      heartY + iconSize / 2 + 8,
      `${playerName} (YOU)`,
      {
        fontSize: '13px',
        color: charColor(role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      },
    );
    this.localPlayerLabel.setOrigin(0.5, 0);
    this.localPlayerLabel.setDepth(202);
  }

  private updateHealthBars(): void {
    if (!this.room || this.heartIcons.length === 0) return;

    const localPlayer = this.room.state.players.get(this.localSessionId);
    if (!localPlayer) return;

    const role = localPlayer.role || 'faran';
    const maxHealth = CHARACTERS[role]?.maxHealth || 100;
    const heartCount = Math.ceil(maxHealth / 10);
    const fullHearts = Math.ceil(Math.max(0, localPlayer.health) / 10);

    for (let i = 0; i < this.heartIcons.length && i < heartCount; i++) {
      const heart = this.heartIcons[i];
      const shouldBeFull = i < fullHearts;
      const currentKey = heart.texture.key;

      if (shouldBeFull && currentKey !== 'icon_heart_full') {
        // Restore to full (e.g., heal or stage reset)
        heart.setTexture('icon_heart_full');
        heart.setScale(1);
        heart.setAlpha(1);
      } else if (!shouldBeFull && currentKey === 'icon_heart_full') {
        // Transition from full to empty: flash + shrink animation
        heart.setTexture('icon_heart_empty');
        this.tweens.add({
          targets: heart,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 150,
          yoyo: true,
          onComplete: () => {
            heart.setScale(1);
          },
        });
      }
    }
  }

  // =====================
  // 2. MATCH TIMER
  // =====================

  private createMatchTimer(): void {
    // Hourglass icon to the left of the timer text
    this.timerIcon = this.add.image(this.W * 0.5 - 30, this.H * 0.03, 'icon_timer');
    this.timerIcon.setDisplaySize(24, 24);
    this.timerIcon.setOrigin(0.5, 0.5);
    this.timerIcon.setDepth(200);
    this.timerIcon.setVisible(false);

    // Timer text to the right of the icon
    this.timerText = this.add.text(this.W * 0.5 + 5, this.H * 0.03, '', {
      ...TextStyle.hud,
      fontSize: '24px',
    });
    this.timerText.setOrigin(0.5, 0.5);
    this.timerText.setDepth(200);
    this.timerText.setVisible(false); // Hidden until match is playing
  }

  private updateMatchTimer(): void {
    if (!this.room || !this.timerText) return;

    const matchState = this.room.state.matchState;
    if (matchState !== 'playing') {
      this.timerText.setVisible(false);
      if (this.timerIcon) this.timerIcon.setVisible(false);
      return;
    }

    this.timerText.setVisible(true);
    if (this.timerIcon) this.timerIcon.setVisible(true);

    const serverTime = this.room.state.serverTime || 0;
    const matchStartTime = this.room.state.matchStartTime || 0;
    const elapsed = serverTime - matchStartTime;
    const remaining = Math.max(0, MATCH_DURATION_MS - elapsed);

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    // Low-time warning (last 30 seconds)
    if (remaining <= 30000 && remaining > 0) {
      if (!this.isTimerFlashing) {
        this.isTimerFlashing = true;
        this.timerText.setColor(Colors.status.danger);
        if (this.timerIcon) this.timerIcon.setTint(Colors.status.dangerNum);
        this.timerFlashTimer = this.time.addEvent({
          delay: 500,
          loop: true,
          callback: () => {
            if (this.timerText) {
              const newAlpha = this.timerText.alpha === 1 ? 0.5 : 1;
              this.timerText.setAlpha(newAlpha);
              if (this.timerIcon) this.timerIcon.setAlpha(newAlpha);
            }
          },
        });
      }
    } else if (this.isTimerFlashing && remaining > 30000) {
      this.isTimerFlashing = false;
      if (this.timerFlashTimer) {
        this.timerFlashTimer.destroy();
        this.timerFlashTimer = null;
      }
      this.timerText.setColor(Colors.text.primary);
      this.timerText.setAlpha(1);
      if (this.timerIcon) {
        this.timerIcon.clearTint();
        this.timerIcon.setAlpha(1);
      }
    }
  }

  // =====================
  // 3. KILL FEED
  // =====================

  private setupKillFeed(): void {
    if (!this.room) return;

    this.messageRouter!.on(
      'kill',
      (data: {
        killer: string;
        victim: string;
        killerId: string;
        victimId: string;
        killerRole: string;
        victimRole: string;
      }) => {
        this.addKillFeedEntry(data);

        // Add minimap death marker at victim's last position
        if (this.room) {
          const player = this.room.state.players.get(data.victimId);
          if (player) {
            this.minimapDeathMarkers.push({
              x: player.x,
              y: player.y,
              color: 0xff0000,
              time: Date.now(),
            });
          }
        }
      },
    );

    // Powerup collection: show buff indicator for local player + kill feed announcement
    this.messageRouter!.on('powerupCollect', (data: any) => {
      if (data.playerId === this.localSessionId) {
        this.addBuffIndicator(data.type, data.duration);
      }

      this.addKillFeedEntry({
        killer: data.playerName,
        victim: `collected ${data.typeName}`,
        killerRole: data.playerRole,
        victimRole: '',
      });
    });

    // Powerup spawn: kill feed announcement
    this.messageRouter!.on('powerupSpawn', (data: any) => {
      this.addKillFeedEntry({
        killer: data.typeName,
        victim: 'appeared!',
        killerRole: '',
        victimRole: '',
      });
    });

    // Buff expired: remove indicator for local player
    this.messageRouter!.on('buffExpired', (data: any) => {
      if (data.playerId === this.localSessionId) {
        this.removeBuffIndicator(data.type);
      }
    });
  }

  private addKillFeedEntry(data: {
    killer: string;
    victim: string;
    killerRole: string;
    victimRole: string;
  }): void {
    const killFeedX = this.W * 0.98;
    const baseY = 155; // Below minimap (mmY=10 + mmH=115 + ping + gap)
    const feedSpacing = this.H * 0.04;

    // Push existing entries down
    for (const entry of this.killFeedEntries) {
      for (const obj of entry.objects) {
        (obj as any).y += feedSpacing;
      }
      entry.bg.y += feedSpacing;
    }

    const textStyle = {
      fontSize: '12px',
      fontFamily: 'monospace',
      fontStyle: 'bold' as const,
      stroke: '#000000',
      strokeThickness: 2,
    };

    const objects: Phaser.GameObjects.GameObject[] = [];
    let totalWidth: number;

    // Kill entries (both roles are non-empty) get skull icon layout
    const isKillEntry = data.killerRole !== '' && data.victimRole !== '';

    if (isKillEntry) {
      // Create victim text (rightmost)
      const victimText = this.add.text(0, baseY, data.victim, {
        ...textStyle,
        color: charColor(data.victimRole),
      });
      victimText.setOrigin(0, 0.5);
      victimText.setDepth(201);

      // Create skull icon
      const skullIcon = this.add.image(0, baseY, 'icon_skull');
      skullIcon.setDisplaySize(14, 14);
      skullIcon.setOrigin(0.5, 0.5);
      skullIcon.setDepth(201);

      // Create killer text (leftmost)
      const killerText = this.add.text(0, baseY, data.killer, {
        ...textStyle,
        color: charColor(data.killerRole),
      });
      killerText.setOrigin(0, 0.5);
      killerText.setDepth(201);

      // Calculate total width and position from right
      totalWidth = killerText.displayWidth + 4 + 14 + 4 + victimText.displayWidth;
      const rightEdge = killFeedX - 8;

      // Position from right: victim (rightmost), skull, killer (leftmost)
      victimText.setPosition(rightEdge - victimText.displayWidth, baseY);
      skullIcon.setPosition(rightEdge - victimText.displayWidth - 4 - 7, baseY);
      killerText.setPosition(
        rightEdge - victimText.displayWidth - 4 - 14 - 4 - killerText.displayWidth,
        baseY,
      );

      objects.push(killerText, skullIcon, victimText);
    } else {
      // Non-kill entries (powerup spawn/collect) -- plain text with ">"
      const displayText = `${data.killer} > ${data.victim}`;
      const text = this.add.text(killFeedX - 8, baseY, displayText, {
        ...textStyle,
        color: charColor(data.killerRole) || Colors.text.primary,
      });
      text.setOrigin(1, 0.5);
      text.setDepth(201);
      totalWidth = text.displayWidth;
      objects.push(text);
    }

    // Create background sized to fit content (8px padding each side)
    const bg = this.add.rectangle(killFeedX, baseY, totalWidth + 16, 22, 0x000000, 0.5);
    bg.setOrigin(1, 0.5);
    bg.setDepth(200);

    const entry: KillFeedEntry = {
      objects,
      bg,
      addedAt: this.time.now,
    };

    this.killFeedEntries.unshift(entry);

    // Remove excess entries
    while (this.killFeedEntries.length > this.killFeedMaxEntries) {
      const removed = this.killFeedEntries.pop()!;
      for (const obj of removed.objects) {
        obj.destroy();
      }
      removed.bg.destroy();
    }
  }

  private updateKillFeed(time: number): void {
    const now = this.time.now;
    const toRemove: number[] = [];

    for (let i = 0; i < this.killFeedEntries.length; i++) {
      const entry = this.killFeedEntries[i];
      const age = now - entry.addedAt;

      if (age > this.killFeedFadeDuration) {
        toRemove.push(i);
      } else if (age > this.killFeedFadeDuration - 1000) {
        // Fade out in the last 1 second
        const fadeProgress = (age - (this.killFeedFadeDuration - 1000)) / 1000;
        const alpha = 1 - fadeProgress;
        for (const obj of entry.objects) {
          (obj as any).setAlpha(alpha);
        }
        entry.bg.setAlpha(alpha * 0.5);
      }
    }

    // Remove expired entries (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const entry = this.killFeedEntries[idx];
      for (const obj of entry.objects) {
        obj.destroy();
      }
      entry.bg.destroy();
      this.killFeedEntries.splice(idx, 1);
    }
  }

  // =====================
  // 4. COOLDOWN DISPLAY
  // =====================

  private createCooldownDisplay(): void {
    // Small bar above the local player's health bar area (center bottom)
    const barX = this.W * 0.5;
    const barY = this.H * 0.89;
    const barW = 40;
    const barH = 6;

    this.cooldownBg = this.add.rectangle(barX, barY, barW, barH, CooldownBar.bg);
    this.cooldownBg.setOrigin(0.5, 0.5);
    this.cooldownBg.setDepth(200);

    this.cooldownFill = this.add.rectangle(barX - barW / 2, barY, 0, barH, CooldownBar.recharging);
    this.cooldownFill.setOrigin(0, 0.5);
    this.cooldownFill.setDepth(201);
  }

  private updateCooldownDisplay(): void {
    if (!this.cooldownFill || !this.cooldownBg) return;

    if (this.lastFireTime === 0 || this.cooldownMs === 0) {
      // No fire yet, show fully ready
      this.cooldownFill.setSize(40, 6);
      this.cooldownFill.setFillStyle(CooldownBar.ready);
      return;
    }

    const elapsed = Date.now() - this.lastFireTime;
    const progress = Math.min(1, elapsed / this.cooldownMs);

    this.cooldownFill.setSize(40 * progress, 6);

    if (progress >= 1) {
      this.cooldownFill.setFillStyle(CooldownBar.ready);
    } else {
      this.cooldownFill.setFillStyle(CooldownBar.recharging);
    }
  }

  // =====================
  // 5. PING DISPLAY
  // =====================

  private createPingDisplay(): void {
    // Position below minimap (mmY=10, mmH=115, 8px gap)
    this.pingText = this.add.text(this.W - 12, 133, '0ms', {
      fontSize: '12px',
      color: Colors.status.success,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.pingText.setOrigin(1, 0.5);
    this.pingText.setDepth(200);

    // Start ping interval
    if (this.room) {
      this.pingInterval = setInterval(() => {
        if (this.room) {
          this.room.send('ping', { t: Date.now() });
        }
      }, 2000);

      this.messageRouter!.on('pong', (data: { t: number }) => {
        this.currentPing = Date.now() - data.t;
      });
    }
  }

  private updatePingDisplay(): void {
    if (!this.pingText) return;

    this.pingText.setText(`${this.currentPing}ms`);

    if (this.currentPing < 50) {
      this.pingText.setColor(Colors.status.success);
    } else if (this.currentPing <= 100) {
      this.pingText.setColor(Colors.status.warning);
    } else {
      this.pingText.setColor(Colors.status.danger);
    }
  }

  // =====================
  // 6. ROLE IDENTITY BANNER
  // =====================

  private showRoleBanner(): void {
    const roleName = this.localRole.toUpperCase();
    const roleColor = charColor(this.localRole);

    // Large banner: "YOU ARE PARAN"
    this.roleBanner = this.add.text(this.W * 0.5, this.H * 0.28, `YOU ARE ${roleName}`, {
      ...TextStyle.splash,
      color: roleColor,
    });
    this.roleBanner.setOrigin(0.5, 0.5);
    this.roleBanner.setDepth(300);

    // Fade out after 2s delay, 1s fade
    this.tweens.add({
      targets: this.roleBanner,
      alpha: 0,
      duration: 1000,
      delay: 2000,
      onComplete: () => {
        if (this.roleBanner) {
          this.roleBanner.destroy();
          this.roleBanner = null;
        }
      },
    });

    // Subtle permanent role reminder in top-left
    this.roleReminder = this.add.text(
      this.W * 0.01,
      this.H * 0.02,
      roleName.charAt(0) + roleName.slice(1).toLowerCase(),
      {
        fontSize: '14px',
        color: roleColor,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      },
    );
    this.roleReminder.setDepth(200);
  }

  // =====================
  // 7. SPECTATOR HUD
  // =====================

  private createSpectatorHUD(): void {
    // Hidden by default, shown when spectating
    // Semi-transparent background rectangle for spectator banner
    this.spectatorBar = this.add.text(this.W * 0.5, this.H * 0.16, '', {
      ...TextStyle.hud,
      backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
    });
    this.spectatorBar.setOrigin(0.5, 0.5);
    this.spectatorBar.setDepth(250);
    this.spectatorBar.setVisible(false);

    this.spectatorInstruction = this.add.text(this.W * 0.5, this.H * 0.2, 'Press TAB to cycle', {
      fontSize: '12px',
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.spectatorInstruction.setOrigin(0.5, 0.5);
    this.spectatorInstruction.setDepth(250);
    this.spectatorInstruction.setVisible(false);
  }

  private showSpectatorHUD(targetName: string, targetRole: string): void {
    this.isSpectating = true;
    this.spectatorTargetName = targetName;
    this.spectatorTargetRole = targetRole;

    if (this.spectatorBar) {
      const roleColor = charColor(targetRole);
      this.spectatorBar.setText(
        `SPECTATING: ${targetName} (${targetRole.charAt(0).toUpperCase() + targetRole.slice(1)})`,
      );
      this.spectatorBar.setColor(roleColor);
      this.spectatorBar.setVisible(true);
    }
    if (this.spectatorInstruction) {
      this.spectatorInstruction.setVisible(true);
    }
  }

  private hideSpectatorHUD(): void {
    this.isSpectating = false;
    if (this.spectatorBar) this.spectatorBar.setVisible(false);
    if (this.spectatorInstruction) this.spectatorInstruction.setVisible(false);
  }

  // =====================
  // 8. MATCH COUNTDOWN
  // =====================

  private setupMatchCountdown(): void {
    if (!this.room) return;

    // Consolidated matchState listener: handles countdown, stage transitions, and resets
    this.room.state.listen('matchState', (value: string) => {
      if (value === 'playing') {
        this.showMatchStart();
        // Reset timer flash state for new stage
        this.isTimerFlashing = false;
        if (this.timerFlashTimer) {
          this.timerFlashTimer.destroy();
          this.timerFlashTimer = null;
        }
        if (this.timerText) {
          this.timerText.setColor(Colors.text.primary);
          this.timerText.setAlpha(1);
        }
        if (this.timerIcon) {
          this.timerIcon.clearTint();
          this.timerIcon.setAlpha(1);
        }
        // Reset spectator HUD when new stage begins
        this.hideSpectatorHUD();
        // Restore minimap to user preference when gameplay starts
        this.minimapVisible = this.minimapUserToggled;
      } else if (value === 'stage_end') {
        // Stage ended -- keep HUD visible but show stage result briefly
        // Clear buff indicators (buffs expire at stage end)
        this.clearBuffIndicators();
        // Clear death overlay
        this.clearDeathOverlay();
        // Hide minimap during stage end
        this.minimapVisible = false;
      } else if (value === 'stage_transition') {
        // Rebuild health display (players reset to full health)
        this.time.delayedCall(200, () => this.rebuildHealthBars());
        // Clear any remaining buff indicators
        this.clearBuffIndicators();
        // Hide minimap during stage transition
        this.minimapVisible = false;
      }
    });
  }

  private showMatchStart(): void {
    // Show "FIGHT!" text when match starts
    this.countdownText = this.add.text(this.W * 0.5, this.H * 0.42, 'FIGHT!', {
      ...TextStyle.splash,
      fontSize: '72px',
      strokeThickness: 8,
    });
    this.countdownText.setOrigin(0.5, 0.5);
    this.countdownText.setDepth(400);

    // Fade out after 2 seconds
    this.tweens.add({
      targets: this.countdownText,
      alpha: 0,
      duration: 1000,
      delay: 1000,
      onComplete: () => {
        if (this.countdownText) {
          this.countdownText.destroy();
          this.countdownText = null;
        }
      },
    });
  }

  // =====================
  // 9b. TOP-CENTER DARK BACKDROP
  // =====================

  private createTopCenterBackdrop(): void {
    this.topCenterBackdrop = this.add.graphics();
    this.topCenterBackdrop.setDepth(199); // Behind HUD elements at 200
    // Dark backdrop panel: covers timer area through stage label
    // Timer at H*0.03, pips at H*0.06, stage label at H*0.09
    // Width enough for timer icon + text + pips spread
    const panelW = 160;
    const panelH = 80;
    const panelX = this.W / 2 - panelW / 2;
    const panelY = this.H * 0.03 - 16; // Above timer center
    this.topCenterBackdrop.fillStyle(HudBackdrop.fill, HudBackdrop.fillAlpha);
    this.topCenterBackdrop.fillRoundedRect(panelX, panelY, panelW, panelH, HudBackdrop.radius);
    this.topCenterBackdrop.lineStyle(
      HudBackdrop.borderWidth,
      HudBackdrop.borderColor,
      HudBackdrop.borderAlpha,
    );
    this.topCenterBackdrop.strokeRoundedRect(panelX, panelY, panelW, panelH, HudBackdrop.radius);
  }

  // =====================
  // 9. ROUND SCORE DISPLAY (Colored Pips)
  // =====================

  private createRoundScore(): void {
    if (!this.room) return;

    // Round score pips (Graphics-based colored circles)
    this.roundScorePipsGfx = this.add.graphics();
    this.roundScorePipsGfx.setDepth(200);

    // Stage label below the pips
    this.stageLabel = this.add.text(this.W * 0.5, this.H * 0.09, 'Stage 1', {
      fontSize: '14px',
      color: Colors.text.primary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.stageLabel.setOrigin(0.5, 0.5);
    this.stageLabel.setDepth(200);

    // Initial draw
    this.updateRoundScore();

    // Listen for schema changes on stage wins
    this.room.state.listen('paranStageWins', (_value: number) => {
      this.updateRoundScore();
    });
    this.room.state.listen('guardianStageWins', (_value: number) => {
      this.updateRoundScore();
    });
    this.room.state.listen('currentStage', (value: number) => {
      if (this.stageLabel) {
        this.stageLabel.setText(`Stage ${value}`);
      }
    });
  }

  private updateRoundScore(): void {
    if (!this.roundScorePipsGfx || !this.room) return;

    this.roundScorePipsGfx.clear();

    const paranWins = this.room.state.paranStageWins || 0;
    const guardianWins = this.room.state.guardianStageWins || 0;
    const winsToWin = 2; // Best-of-3
    const pipRadius = 7;
    const pipSpacing = 20;
    const pipY = this.H * 0.06;
    const centerX = this.W * 0.5;

    // Layout: [P1] [P2]  |  [G1] [G2]
    // Separator is a thin vertical line at center
    const separatorGap = 8; // gap between pips and separator

    // Paran pips on the left
    for (let i = 0; i < winsToWin; i++) {
      const x = centerX - separatorGap - (winsToWin - i) * pipSpacing + pipSpacing / 2;
      if (i < paranWins) {
        this.roundScorePipsGfx.fillStyle(Colors.char.paranNum, 1);
      } else {
        this.roundScorePipsGfx.fillStyle(0x666666, 1.0);
      }
      this.roundScorePipsGfx.fillCircle(x, pipY, pipRadius);
    }

    // Separator: thin vertical line
    this.roundScorePipsGfx.fillStyle(0xffffff, 0.3);
    this.roundScorePipsGfx.fillRect(centerX - 1, pipY - 4, 2, 8);

    // Guardian pips on the right
    for (let i = 0; i < winsToWin; i++) {
      const x = centerX + separatorGap + i * pipSpacing + pipSpacing / 2;
      if (i < guardianWins) {
        this.roundScorePipsGfx.fillStyle(Colors.char.faranNum, 1);
      } else {
        this.roundScorePipsGfx.fillStyle(0x666666, 1.0);
      }
      this.roundScorePipsGfx.fillCircle(x, pipY, pipRadius);
    }
  }

  // =====================
  // 10. BUFF INDICATORS
  // =====================

  private addBuffIndicator(buffType: number, duration: number): void {
    // If indicator already exists for this type, refresh it
    this.removeBuffIndicator(buffType);

    // Position will be set by repositionBuffIndicators
    const x = 0;
    const y = this.H * 0.92;

    // Potion icon (32x32)
    const textureKey =
      buffType === PowerupType.SPEED
        ? 'potion_speed'
        : buffType === PowerupType.INVINCIBILITY
          ? 'potion_invincibility'
          : 'potion_projectile';
    const icon = this.add.image(x, y, textureKey);
    icon.setDisplaySize(32, 32);
    icon.setDepth(201);

    // Radial sweep overlay (Graphics object)
    const radialGfx = this.add.graphics();
    radialGfx.setDepth(202);

    this.buffIndicators.set(buffType, {
      icon,
      radialGfx,
      startTime: Date.now(),
      duration,
    });

    this.repositionBuffIndicators();
  }

  private removeBuffIndicator(buffType: number): void {
    const indicator = this.buffIndicators.get(buffType);
    if (!indicator) return;
    indicator.icon.destroy();
    indicator.radialGfx.destroy();
    if (indicator.flashTimer) indicator.flashTimer.destroy();
    this.buffIndicators.delete(buffType);
    this.repositionBuffIndicators();
  }

  private repositionBuffIndicators(): void {
    const count = this.buffIndicators.size;
    if (count === 0) return;

    // Position buff icons to the right of the heart row
    let heartRowRight = this.W / 2;
    if (this.heartIcons.length > 0) {
      const lastHeart = this.heartIcons[this.heartIcons.length - 1];
      heartRowRight = lastHeart.x + 16; // half icon width (32/2)
    }

    const y = this.H * 0.92; // Same y as heart row
    const iconSpacing = 40;
    let i = 0;
    this.buffIndicators.forEach((indicator) => {
      const x = heartRowRight + 24 + i * iconSpacing;
      indicator.icon.setPosition(x, y);
      // radialGfx draws at icon position in updateBuffIndicators
      i++;
    });
  }

  private updateBuffIndicators(): void {
    this.buffIndicators.forEach((indicator, buffType) => {
      const elapsed = Date.now() - indicator.startTime;
      const remaining = indicator.duration - elapsed;
      const fraction = Math.max(0, remaining / indicator.duration);

      // Draw radial sweep overlay (clockwise drain from 12 o'clock)
      const gfx = indicator.radialGfx;
      const iconX = indicator.icon.x;
      const iconY = indicator.icon.y;

      gfx.clear();
      if (fraction < 1) {
        const startAngle = Phaser.Math.DegToRad(-90); // 12 o'clock
        const endAngle = Phaser.Math.DegToRad(-90 + 360 * (1 - fraction)); // elapsed portion
        gfx.fillStyle(0x000000, 0.5);
        gfx.slice(iconX, iconY, 16, startAngle, endAngle, false);
        gfx.fillPath();
      }

      // Flash when about to expire (last 2 seconds): 5 flashes over 2s = 400ms cycle
      if (remaining < 2000 && remaining > 0 && !indicator.flashTimer) {
        indicator.flashTimer = this.time.addEvent({
          delay: 200,
          callback: () => {
            indicator.icon.setAlpha(indicator.icon.alpha === 1 ? 0.3 : 1);
          },
          loop: true,
        });
      }

      // Fade out when expired
      if (remaining <= 0 && indicator.icon.alpha > 0) {
        this.tweens.add({
          targets: indicator.icon,
          alpha: 0,
          duration: 500,
        });
        gfx.clear();
      }
    });
  }

  private clearBuffIndicators(): void {
    this.buffIndicators.forEach((indicator) => {
      indicator.icon.destroy();
      indicator.radialGfx.destroy();
      if (indicator.flashTimer) indicator.flashTimer.destroy();
    });
    this.buffIndicators.clear();
  }

  // =====================
  // 11. MINIMAP
  // =====================

  private createMinimap(): void {
    this.minimapGfx = this.add.graphics();
    this.minimapGfx.setDepth(150);

    // Register M key for toggle
    this.minimapToggleKey = this.input.keyboard?.addKey('M') || null;

    // Read persisted toggle state from registry
    this.minimapUserToggled = this.registry.get('minimapUserToggled') ?? true;
    this.minimapVisible = this.minimapUserToggled;
  }

  private updateMinimap(): void {
    // Handle M key toggle (just-pressed detection to avoid rapid toggling)
    if (this.minimapToggleKey?.isDown && !this.minimapToggleJustPressed) {
      this.minimapToggleJustPressed = true;
      this.minimapUserToggled = !this.minimapUserToggled;
      this.registry.set('minimapUserToggled', this.minimapUserToggled);
      this.minimapVisible = this.minimapUserToggled;

      // Play toggle SFX
      const am = this.registry.get('audioManager');
      if (am) {
        am.playWAVSFX(this.minimapVisible ? 'select_2' : 'select_1');
      }
    }
    if (this.minimapToggleKey && !this.minimapToggleKey.isDown) {
      this.minimapToggleJustPressed = false;
    }

    // Throttle minimap redraw to ~10Hz (every 6 frames at 60fps)
    this.minimapFrameCounter++;
    if (this.minimapFrameCounter % 6 === 0) {
      this.redrawMinimap();
    }
  }

  private redrawMinimap(): void {
    // Minimap dimensions and position
    const mmW = 150;
    const mmH = 115;
    const mmX = this.W - mmW - 10; // 10px margin from right
    const mmY = 10; // 10px margin from top

    const grid = this.registry.get('collisionGrid') as CollisionGrid | null;
    const meta = this.registry.get('mapMetadata') as { width: number; height: number } | null;
    if (!grid || !meta || !this.minimapGfx) return;
    if (!this.minimapVisible) {
      this.minimapGfx.clear();
      return;
    }

    const scaleX = mmW / meta.width;
    const scaleY = mmH / meta.height;
    const tileSize = 32;

    this.minimapGfx.clear();

    // 1. Semi-transparent black background with rounded corners
    this.minimapGfx.fillStyle(HudBackdrop.fill, HudBackdrop.fillAlpha);
    this.minimapGfx.fillRoundedRect(mmX, mmY, mmW, mmH, HudBackdrop.radius);

    // 2. Wall blocks (dark gray)
    this.minimapGfx.fillStyle(0x444444, 0.8);
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        if (grid.isSolid(tx, ty)) {
          this.minimapGfx.fillRect(
            mmX + tx * tileSize * scaleX,
            mmY + ty * tileSize * scaleY,
            Math.ceil(tileSize * scaleX),
            Math.ceil(tileSize * scaleY),
          );
        }
      }
    }

    // 3. Powerup dots
    if (this.room && this.room.state.powerups) {
      this.room.state.powerups.forEach((powerup: any) => {
        const pType = Number(powerup.powerupType);
        let dotColor = 0xffcc00; // gold default
        if (pType === PowerupType.SPEED) dotColor = 0x50c8c8;
        else if (pType === PowerupType.INVINCIBILITY) dotColor = 0xffcc00;
        else if (pType === PowerupType.PROJECTILE) dotColor = 0xcc44cc;

        this.minimapGfx!.fillStyle(dotColor, 1);
        this.minimapGfx!.fillCircle(mmX + powerup.x * scaleX, mmY + powerup.y * scaleY, 2);
      });
    }

    // 4. Player dots
    if (this.room) {
      this.room.state.players.forEach((player: any) => {
        if (player.health <= 0) return; // Skip dead players
        const color = charColorNum(player.role);
        this.minimapGfx!.fillStyle(color, 1);
        this.minimapGfx!.fillCircle(mmX + player.x * scaleX, mmY + player.y * scaleY, 3);
      });
    }

    // 5. Death markers (red circles that fade over 2 seconds)
    const now = Date.now();
    const DEATH_MARKER_LIFETIME = 2000;
    this.minimapDeathMarkers = this.minimapDeathMarkers.filter((marker) => {
      const age = now - marker.time;
      if (age > DEATH_MARKER_LIFETIME) return false;
      const alpha = 1 - age / DEATH_MARKER_LIFETIME;
      this.minimapGfx!.fillStyle(marker.color, alpha);
      this.minimapGfx!.fillCircle(mmX + marker.x * scaleX, mmY + marker.y * scaleY, 4);
      return true;
    });

    // 6. Border outline (brass accent)
    this.minimapGfx.lineStyle(
      HudBackdrop.borderWidth,
      HudBackdrop.borderColor,
      HudBackdrop.borderAlpha,
    );
    this.minimapGfx.strokeRoundedRect(mmX, mmY, mmW, mmH, HudBackdrop.radius);
  }

  // =====================
  // CROSS-SCENE EVENTS
  // =====================

  private setupCrossSceneEvents(): void {
    if (!this.gameScene) return;

    // Listen for fire events from GameScene
    this.gameScene.events.on(
      'localFired',
      (data: { fireTime: number; cooldownMs: number }) => {
        this.lastFireTime = data.fireTime;
        this.cooldownMs = data.cooldownMs;
      },
      this,
    );

    // Listen for spectator target changes
    this.gameScene.events.on(
      'spectatorChanged',
      (data: { targetName: string; targetRole: string }) => {
        this.showSpectatorHUD(data.targetName, data.targetRole);
      },
      this,
    );

    // Listen for local player death
    this.gameScene.events.on(
      'localDied',
      () => {
        this.showDeathOverlay();
      },
      this,
    );

    // Listen for overview camera events to hide/show minimap
    this.gameScene.events.on(
      'overviewStart',
      () => {
        this.minimapVisible = false;
      },
      this,
    );
    this.gameScene.events.on(
      'overviewEnd',
      () => {
        this.minimapVisible = this.minimapUserToggled;
      },
      this,
    );
  }

  // =====================
  // DEATH OVERLAY
  // =====================

  private showDeathOverlay(): void {
    // Large gravestone icon centered
    const gravestone = this.add.image(this.W / 2, this.H / 2 - 30, 'icon_gravestone');
    gravestone.setDisplaySize(64, 64);
    gravestone.setDepth(300);
    gravestone.setAlpha(0);

    // ELIMINATED text below gravestone
    const eliminatedText = this.add.text(this.W / 2, this.H / 2 + 30, 'ELIMINATED', {
      fontSize: '36px',
      color: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    });
    eliminatedText.setOrigin(0.5);
    eliminatedText.setDepth(300);
    eliminatedText.setAlpha(0);

    this.deathOverlayObjects = [gravestone, eliminatedText];

    // Fade in
    this.tweens.add({
      targets: [gravestone, eliminatedText],
      alpha: 1,
      duration: 500,
    });

    // Fade out after 3 seconds
    this.tweens.add({
      targets: [gravestone, eliminatedText],
      alpha: 0,
      duration: 800,
      delay: 3000,
      onComplete: () => {
        gravestone.destroy();
        eliminatedText.destroy();
        this.deathOverlayObjects = [];
      },
    });
  }

  private clearDeathOverlay(): void {
    for (const obj of this.deathOverlayObjects) {
      obj.destroy();
    }
    this.deathOverlayObjects = [];
  }

  // =====================
  // CLEANUP
  // =====================

  private onShutdown(): void {
    // Clear message router callbacks
    if (this.messageRouter) {
      this.messageRouter.clear();
      this.messageRouter = null;
    }

    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Clear flash timers
    if (this.timerFlashTimer) {
      this.timerFlashTimer.destroy();
      this.timerFlashTimer = null;
    }

    // Destroy timer icon
    if (this.timerIcon) {
      this.timerIcon.destroy();
      this.timerIcon = null;
    }

    // Destroy top-center backdrop
    if (this.topCenterBackdrop) {
      this.topCenterBackdrop.destroy();
      this.topCenterBackdrop = null;
    }

    // Destroy round score pips graphics
    if (this.roundScorePipsGfx) {
      this.roundScorePipsGfx.destroy();
      this.roundScorePipsGfx = null;
    }

    // Clear buff indicators
    this.clearBuffIndicators();

    // Clear death overlay
    this.clearDeathOverlay();

    // Cleanup minimap
    if (this.minimapGfx) {
      this.minimapGfx.destroy();
      this.minimapGfx = null;
    }
    this.minimapDeathMarkers = [];

    // Remove GameScene event listeners
    if (this.gameScene) {
      this.gameScene.events.off('localFired', undefined, this);
      this.gameScene.events.off('spectatorChanged', undefined, this);
      this.gameScene.events.off('localDied', undefined, this);
      this.gameScene.events.off('overviewStart', undefined, this);
      this.gameScene.events.off('overviewEnd', undefined, this);
    }

    this.room = null;
  }
}
