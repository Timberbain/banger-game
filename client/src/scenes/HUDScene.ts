import Phaser from 'phaser';
import { Room } from 'colyseus.js';
import { CHARACTERS } from '../../../shared/characters';
import { PowerupType } from '../../../shared/powerups';
import { CollisionGrid } from '../../../shared/collisionGrid';
import {
  Colors,
  TextStyle,
  HealthBar,
  CooldownBar,
  Layout,
  charColor,
  charColorNum,
} from '../ui/designTokens';

const MATCH_DURATION_MS = 300000; // 5 minutes

interface KillFeedEntry {
  text: Phaser.GameObjects.Text;
  bg: Phaser.GameObjects.Rectangle;
  addedAt: number;
}

interface HealthBarUI {
  bg: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  sessionId: string;
  isLocal: boolean;
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
  private localSessionId: string = '';
  private localRole: string = '';

  // Viewport dimensions (set in create)
  private W: number = 1280;
  private H: number = 720;

  // Health bars
  private healthBars: HealthBarUI[] = [];
  private lowHealthFlashTimers: Map<string, Phaser.Time.TimerEvent> = new Map();

  // Match timer
  private timerText: Phaser.GameObjects.Text | null = null;
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

  // Round score display
  private roundScoreText: Phaser.GameObjects.Text | null = null;
  private stageLabel: Phaser.GameObjects.Text | null = null;

  // Buff indicators
  private buffIndicators: Map<
    number,
    {
      bg: Phaser.GameObjects.Rectangle;
      fill: Phaser.GameObjects.Rectangle;
      icon: Phaser.GameObjects.Sprite;
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

  // GameScene reference for cross-scene events
  private gameScene: Phaser.Scene | null = null;

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(data: { room: Room; localSessionId: string; localRole: string }) {
    // Reset ALL member variables for scene reuse (scene.start skips constructor)
    this.room = null;
    this.localSessionId = '';
    this.localRole = '';
    this.healthBars = [];
    this.lowHealthFlashTimers = new Map();
    this.timerText = null;
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
    this.roundScoreText = null;
    this.stageLabel = null;
    this.buffIndicators = new Map();
    this.minimapGfx = null;
    this.minimapVisible = true;
    this.minimapUserToggled = this.registry.get('minimapUserToggled') ?? true;
    this.minimapToggleKey = null;
    this.minimapFrameCounter = 0;
    this.minimapDeathMarkers = [];
    this.minimapToggleJustPressed = false;
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
    this.localSessionId = data.localSessionId;
    this.localRole = data.localRole;

    // Get GameScene reference for cross-scene events
    this.gameScene = this.scene.get('GameScene');

    // 1. Create health bars (bottom of screen)
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

    // Update health bars
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
  // 1. HEALTH BARS
  // =====================

  private createHealthBars(): void {
    if (!this.room) return;

    // We'll rebuild health bars when players are available
    // Use a slight delay to allow state sync
    this.time.delayedCall(100, () => {
      this.rebuildHealthBars();
    });

    // Re-build bars when players are added or removed
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
    // Clean up existing bars
    for (const bar of this.healthBars) {
      bar.bg.destroy();
      bar.fill.destroy();
      bar.label.destroy();
    }
    this.healthBars = [];

    if (!this.room) return;

    // Collect all players
    const players: {
      sessionId: string;
      name: string;
      role: string;
      health: number;
      maxHealth: number;
    }[] = [];
    this.room.state.players.forEach((player: any, sessionId: string) => {
      const role = player.role || 'faran';
      const maxHealth = CHARACTERS[role]?.maxHealth || 100;
      players.push({
        sessionId,
        name: player.name || role,
        role,
        health: player.health,
        maxHealth,
      });
    });

    // Sort so local player is in the center
    const localIdx = players.findIndex((p) => p.sessionId === this.localSessionId);
    if (localIdx > -1) {
      const local = players.splice(localIdx, 1)[0];
      // Insert at center
      const mid = Math.floor(players.length / 2);
      players.splice(mid, 0, local);
    }

    const totalPlayers = players.length;
    const barY = this.H * 0.95;

    for (let i = 0; i < totalPlayers; i++) {
      const p = players[i];
      const isLocal = p.sessionId === this.localSessionId;
      const barW = isLocal ? 200 : 140;
      const barH = isLocal ? 16 : 12;

      // Space evenly across bottom
      const spacing = this.W / (totalPlayers + 1);
      const barX = spacing * (i + 1);

      // Background (dark red)
      const bg = this.add.rectangle(barX, barY, barW, barH, HealthBar.bg);
      bg.setOrigin(0.5, 0.5);
      bg.setDepth(200);

      // Fill (role color)
      const color = charColorNum(p.role);
      const fill = this.add.rectangle(barX - barW / 2, barY, barW, barH, color);
      fill.setOrigin(0, 0.5);
      fill.setDepth(201);

      // Label above bar
      const labelSize = isLocal ? '13px' : '11px';
      const displayName = isLocal ? `${p.name} (YOU)` : p.name;
      const label = this.add.text(barX, barY - barH / 2 - 10, displayName, {
        fontSize: labelSize,
        color: charColor(p.role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 1);
      label.setDepth(202);

      this.healthBars.push({ bg, fill, label, sessionId: p.sessionId, isLocal });
    }
  }

  private updateHealthBars(): void {
    if (!this.room) return;

    for (const bar of this.healthBars) {
      const player = this.room.state.players.get(bar.sessionId);
      if (!player) continue;

      const role = player.role || 'faran';
      const maxHealth = CHARACTERS[role]?.maxHealth || 100;
      const healthPct = Math.max(0, player.health / maxHealth);
      const barW = bar.isLocal ? 200 : 140;

      // Update fill width
      bar.fill.setSize(barW * healthPct, bar.fill.height);

      // Low health flash effect (below 25%)
      if (healthPct < 0.25 && healthPct > 0) {
        if (!this.lowHealthFlashTimers.has(bar.sessionId)) {
          const timer = this.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => {
              bar.fill.setAlpha(bar.fill.alpha === 1 ? 0.5 : 1);
            },
          });
          this.lowHealthFlashTimers.set(bar.sessionId, timer);
        }
      } else {
        const existingTimer = this.lowHealthFlashTimers.get(bar.sessionId);
        if (existingTimer) {
          existingTimer.destroy();
          this.lowHealthFlashTimers.delete(bar.sessionId);
          bar.fill.setAlpha(1);
        }
      }
    }
  }

  // =====================
  // 2. MATCH TIMER
  // =====================

  private createMatchTimer(): void {
    this.timerText = this.add.text(this.W * 0.5, this.H * 0.03, '', {
      ...TextStyle.hud,
      fontSize: '20px',
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
      return;
    }

    this.timerText.setVisible(true);

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
        this.timerFlashTimer = this.time.addEvent({
          delay: 500,
          loop: true,
          callback: () => {
            if (this.timerText) {
              this.timerText.setAlpha(this.timerText.alpha === 1 ? 0.5 : 1);
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
    }
  }

  // =====================
  // 3. KILL FEED
  // =====================

  private setupKillFeed(): void {
    if (!this.room) return;

    this.room.onMessage(
      'kill',
      (data: { killer: string; victim: string; killerRole: string; victimRole: string }) => {
        this.addKillFeedEntry(data);

        // Add minimap death marker at victim's last position
        if (this.room) {
          this.room.state.players.forEach((player: any) => {
            if (player.name === data.victim || player.role === data.victimRole) {
              this.minimapDeathMarkers.push({
                x: player.x,
                y: player.y,
                color: 0xff0000,
                time: Date.now(),
              });
            }
          });
        }
      },
    );

    // Powerup collection: show buff indicator for local player + kill feed announcement
    this.room.onMessage('powerupCollect', (data: any) => {
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
    this.room.onMessage('powerupSpawn', (data: any) => {
      this.addKillFeedEntry({
        killer: data.typeName,
        victim: 'appeared!',
        killerRole: '',
        victimRole: '',
      });
    });

    // Buff expired: remove indicator for local player
    this.room.onMessage('buffExpired', (data: any) => {
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
      entry.text.y += feedSpacing;
      entry.bg.y += feedSpacing;
    }

    // Create text first so we can measure its width for the background
    const displayText = `${data.killer} > ${data.victim}`;
    const text = this.add.text(killFeedX - 8, baseY, displayText, {
      fontSize: '12px',
      color: charColor(data.killerRole),
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    text.setOrigin(1, 0.5);
    text.setDepth(201);

    // Create background sized to fit text content (8px padding on each side)
    const bg = this.add.rectangle(killFeedX, baseY, text.displayWidth + 16, 22, 0x000000, 0.5);
    bg.setOrigin(1, 0.5);
    bg.setDepth(200);

    const entry: KillFeedEntry = {
      text,
      bg,
      addedAt: this.time.now,
    };

    this.killFeedEntries.unshift(entry);

    // Remove excess entries
    while (this.killFeedEntries.length > this.killFeedMaxEntries) {
      const removed = this.killFeedEntries.pop()!;
      removed.text.destroy();
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
        entry.text.setAlpha(alpha);
        entry.bg.setAlpha(alpha * 0.5);
      }
    }

    // Remove expired entries (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const idx = toRemove[i];
      const entry = this.killFeedEntries[idx];
      entry.text.destroy();
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

      this.room.onMessage('pong', (data: { t: number }) => {
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
    this.spectatorBar = this.add.text(this.W * 0.5, this.H * 0.07, '', {
      ...TextStyle.hud,
      backgroundColor: '#00000088',
      padding: { x: 12, y: 6 },
    });
    this.spectatorBar.setOrigin(0.5, 0.5);
    this.spectatorBar.setDepth(250);
    this.spectatorBar.setVisible(false);

    this.spectatorInstruction = this.add.text(this.W * 0.5, this.H * 0.1, 'Press TAB to cycle', {
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
        // Reset spectator HUD when new stage begins
        this.hideSpectatorHUD();
        // Restore minimap to user preference when gameplay starts
        this.minimapVisible = this.minimapUserToggled;
      } else if (value === 'stage_end') {
        // Stage ended -- keep HUD visible but show stage result briefly
        // Clear buff indicators (buffs expire at stage end)
        this.clearBuffIndicators();
        // Hide minimap during stage end
        this.minimapVisible = false;
      } else if (value === 'stage_transition') {
        // Rebuild health bars (players reset to full health)
        this.time.delayedCall(200, () => this.rebuildHealthBars());
        // Reset low health flash timers
        for (const timer of this.lowHealthFlashTimers.values()) {
          timer.destroy();
        }
        this.lowHealthFlashTimers.clear();
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
  // 9. ROUND SCORE DISPLAY
  // =====================

  private createRoundScore(): void {
    if (!this.room) return;

    // Stage label: "Stage 1" above the score
    this.stageLabel = this.add.text(this.W * 0.5, this.H * 0.06, 'Stage 1', {
      fontSize: '12px',
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.stageLabel.setOrigin(0.5, 0.5);
    this.stageLabel.setDepth(200);

    // Score text: "0 - 0" below the timer
    this.roundScoreText = this.add.text(this.W * 0.5, this.H * 0.09, '0 - 0', {
      fontSize: '16px',
      color: Colors.gold.primary,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.roundScoreText.setOrigin(0.5, 0.5);
    this.roundScoreText.setDepth(200);

    // Listen for schema changes on stage wins
    this.room.state.listen('paranStageWins', (value: number) => {
      this.updateRoundScore();
    });
    this.room.state.listen('guardianStageWins', (value: number) => {
      this.updateRoundScore();
    });
    this.room.state.listen('currentStage', (value: number) => {
      if (this.stageLabel) {
        this.stageLabel.setText(`Stage ${value}`);
      }
    });
  }

  private updateRoundScore(): void {
    if (!this.roundScoreText || !this.room) return;
    const paranWins = this.room.state.paranStageWins || 0;
    const guardianWins = this.room.state.guardianStageWins || 0;
    this.roundScoreText.setText(`${paranWins} - ${guardianWins}`);
  }

  // =====================
  // 10. BUFF INDICATORS
  // =====================

  private addBuffIndicator(buffType: number, duration: number): void {
    // If indicator already exists for this type, refresh it
    this.removeBuffIndicator(buffType);

    const indicatorWidth = 50;
    const indicatorHeight = 8;
    const iconSize = 16;

    // Position: centered at screen middle, offset by active indicator count
    const x = 0; // will be repositioned
    const y = this.H * 0.87; // Above cooldown bar

    // Background bar (dark)
    const bg = this.add.rectangle(x, y, indicatorWidth, indicatorHeight, 0x222222, 0.8);
    bg.setOrigin(0.5, 0.5);
    bg.setDepth(100);

    // Fill bar (colored by type)
    const fillColor =
      buffType === PowerupType.SPEED
        ? 0x4488ff
        : buffType === PowerupType.INVINCIBILITY
          ? 0xffcc00
          : 0xff4422;
    const fill = this.add.rectangle(x, y, indicatorWidth, indicatorHeight, fillColor, 0.9);
    fill.setOrigin(0.5, 0.5);
    fill.setDepth(101);

    // Icon sprite above bar
    const textureKey =
      buffType === PowerupType.SPEED
        ? 'potion_speed'
        : buffType === PowerupType.INVINCIBILITY
          ? 'potion_invincibility'
          : 'potion_projectile';
    const icon = this.add.sprite(x, y - iconSize, textureKey);
    icon.setDisplaySize(iconSize, iconSize);
    icon.setDepth(101);

    this.buffIndicators.set(buffType, {
      bg,
      fill,
      icon,
      startTime: Date.now(),
      duration,
    });

    this.repositionBuffIndicators();
  }

  private removeBuffIndicator(buffType: number): void {
    const indicator = this.buffIndicators.get(buffType);
    if (!indicator) return;
    indicator.bg.destroy();
    indicator.fill.destroy();
    indicator.icon.destroy();
    if (indicator.flashTimer) indicator.flashTimer.destroy();
    this.buffIndicators.delete(buffType);
    this.repositionBuffIndicators();
  }

  private repositionBuffIndicators(): void {
    const indicatorWidth = 50;
    const gap = 8;
    const count = this.buffIndicators.size;
    if (count === 0) return;

    const totalWidth = count * (indicatorWidth + gap) - gap;
    const startX = this.W / 2 - totalWidth / 2;
    const y = this.H * 0.87;
    const iconSize = 16;

    let i = 0;
    this.buffIndicators.forEach((indicator) => {
      const x = startX + i * (indicatorWidth + gap) + indicatorWidth / 2;
      indicator.bg.setPosition(x, y);
      indicator.fill.setPosition(x, y);
      indicator.icon.setPosition(x, y - iconSize);
      i++;
    });
  }

  private updateBuffIndicators(): void {
    this.buffIndicators.forEach((indicator, buffType) => {
      const elapsed = Date.now() - indicator.startTime;
      const remaining = indicator.duration - elapsed;
      const fraction = Math.max(0, remaining / indicator.duration);

      // Shrink fill bar width
      const indicatorWidth = 50;
      indicator.fill.setSize(indicatorWidth * fraction, 8);
      // Adjust position to keep left-aligned shrink
      const baseX = indicator.bg.x - indicatorWidth / 2;
      indicator.fill.setPosition(baseX + (indicatorWidth * fraction) / 2, indicator.fill.y);

      // Flash when about to expire (last 1.5 seconds)
      if (remaining < 1500 && remaining > 0 && !indicator.flashTimer) {
        indicator.flashTimer = this.time.addEvent({
          delay: 150,
          callback: () => {
            indicator.fill.setAlpha(indicator.fill.alpha === 1 ? 0.3 : 1);
            indicator.icon.setAlpha(indicator.icon.alpha === 1 ? 0.3 : 1);
          },
          loop: true,
        });
      }
    });
  }

  private clearBuffIndicators(): void {
    this.buffIndicators.forEach((indicator) => {
      indicator.bg.destroy();
      indicator.fill.destroy();
      indicator.icon.destroy();
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

    // 1. Semi-transparent black background
    this.minimapGfx.fillStyle(0x000000, 0.4);
    this.minimapGfx.fillRect(mmX, mmY, mmW, mmH);

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

    // 6. Border outline
    this.minimapGfx.lineStyle(1, 0xffffff, 0.3);
    this.minimapGfx.strokeRect(mmX, mmY, mmW, mmH);
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
        // Spectator HUD will be shown by spectatorChanged event
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
  // CLEANUP
  // =====================

  private onShutdown(): void {
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

    for (const timer of this.lowHealthFlashTimers.values()) {
      timer.destroy();
    }
    this.lowHealthFlashTimers.clear();

    // Clear buff indicators
    this.clearBuffIndicators();

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
