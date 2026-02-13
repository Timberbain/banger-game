import Phaser from 'phaser';
import { ParticleFactory } from '../systems/ParticleFactory';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Buttons, Decorative, charColor } from '../ui/designTokens';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data: { winner: string; stats: Record<string, any>; duration: number; localSessionId: string; room: any }) {
    const { winner, stats, duration, localSessionId, room } = data;

    // Determine if local player won
    const localStats = stats[localSessionId];
    const localRole = localStats?.role || "unknown";
    const didWin = (winner === "paran" && localRole === "paran") ||
                   (winner === "guardians" && localRole !== "paran");

    // Victory splash image background (different for each outcome)
    const splashKey = winner === "paran" ? 'victory-paran' : 'victory-guardian';
    const splashBg = this.add.image(400, 300, splashKey);
    splashBg.setDisplaySize(800, 600);
    splashBg.setDepth(0);

    // Dark overlay for readability
    this.add.rectangle(400, 300, 800, 600, 0x000000, Colors.bg.overlayAlpha).setDepth(0.5);

    // Color wash overlay (between image and content)
    const washColor = didWin ? Colors.status.successNum : Colors.status.dangerNum;
    this.add.rectangle(400, 300, 800, 600, washColor, 0.10).setDepth(0.6);

    // Victory/Defeat title
    const titleText = didWin ? "VICTORY!" : "DEFEAT";
    const titleColor = didWin ? Colors.gold.primary : Colors.status.danger;
    this.add.text(400, 60, titleText, {
      ...TextStyle.hero,
      color: titleColor,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);

    // Winner subtitle
    const winnerLabel = winner === "paran" ? "Paran Wins!" : "Guardians Win!";
    this.add.text(400, 130, winnerLabel, {
      fontSize: '24px',
      color: Colors.text.primary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);

    // Match duration
    const durationSec = Math.round(duration / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    this.add.text(400, 165, `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
      fontSize: '16px',
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);

    // Gold divider above stats
    const dividerGfx = this.add.graphics();
    dividerGfx.lineStyle(Decorative.divider.thickness, Decorative.divider.color, 0.7);
    dividerGfx.lineBetween(150, 195, 650, 195);
    dividerGfx.setDepth(1);

    // Stats header -- golden
    this.add.text(400, 210, "MATCH STATISTICS", {
      ...TextStyle.heroHeading,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(1);

    // Table header row
    const headerY = 250;
    const cols = { name: 100, role: 250, kills: 340, deaths: 400, damage: 470, accuracy: 570 };
    const headerStyle = { fontSize: '14px', color: Colors.text.secondary, fontFamily: 'monospace', stroke: '#000000' as string, strokeThickness: 1 };
    this.add.text(cols.name, headerY, "Player", headerStyle).setDepth(1);
    this.add.text(cols.role, headerY, "Role", headerStyle).setDepth(1);
    this.add.text(cols.kills, headerY, "K", headerStyle).setDepth(1);
    this.add.text(cols.deaths, headerY, "D", headerStyle).setDepth(1);
    this.add.text(cols.damage, headerY, "Damage", headerStyle).setDepth(1);
    this.add.text(cols.accuracy, headerY, "Accuracy", headerStyle).setDepth(1);

    // Header underline -- gold
    const line = this.add.graphics();
    line.lineStyle(1, Colors.gold.darkNum, 0.5);
    line.lineBetween(80, headerY + 22, 720, headerY + 22);
    line.setDepth(1);

    // Player stats rows
    let yOffset = headerY + 35;
    Object.entries(stats).forEach(([sessionId, playerStats]: [string, any]) => {
      const isLocal = sessionId === localSessionId;
      const color = isLocal ? Colors.gold.primary : Colors.text.primary;
      const style: Phaser.Types.GameObjects.Text.TextStyle = {
        fontSize: '16px',
        color,
        fontFamily: 'monospace',
        fontStyle: isLocal ? 'bold' : 'normal',
        stroke: '#000000',
        strokeThickness: 2,
      };

      // Highlight row for local player
      if (isLocal) {
        this.add.rectangle(400, yOffset + 8, 640, 28, Colors.bg.elevatedNum, 0.5).setDepth(1);
      }

      // Player name (truncate)
      const displayName = playerStats.name.length > 12
        ? playerStats.name.substring(0, 10) + ".."
        : playerStats.name;
      this.add.text(cols.name, yOffset, displayName, style).setDepth(2);

      // Role
      const roleLabel = playerStats.role === 'paran' ? 'Paran' :
                         playerStats.role === 'faran' ? 'Faran' : 'Baran';
      this.add.text(cols.role, yOffset, roleLabel, { ...style, color: charColor(playerStats.role) }).setDepth(2);

      // K/D/Damage/Accuracy
      this.add.text(cols.kills, yOffset, String(playerStats.kills), style).setDepth(2);
      this.add.text(cols.deaths, yOffset, String(playerStats.deaths), style).setDepth(2);
      this.add.text(cols.damage, yOffset, String(playerStats.damageDealt), style).setDepth(2);
      this.add.text(cols.accuracy, yOffset, `${playerStats.accuracy.toFixed(1)}%`, style).setDepth(2);

      yOffset += 35;
    });

    // Gold divider below stats
    const dividerGfx2 = this.add.graphics();
    dividerGfx2.lineStyle(Decorative.divider.thickness, Decorative.divider.color, 0.7);
    dividerGfx2.lineBetween(150, yOffset + 5, 650, yOffset + 5);
    dividerGfx2.setDepth(1);

    // Return to Lobby button -- primary preset
    const button = this.add.text(400, 500, "Return to Lobby", {
      fontSize: Buttons.primary.fontSize,
      color: Buttons.primary.text,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: Buttons.primary.bg,
      padding: { x: 24, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    button.on('pointerover', () => button.setBackgroundColor(Buttons.primary.hover));
    button.on('pointerout', () => button.setBackgroundColor(Buttons.primary.bg));
    button.on('pointerdown', () => {
      // Play button click if audio available
      const audioManager = this.registry.get('audioManager') as AudioManager | null;
      if (audioManager) audioManager.playSFX('button_click');
      this.returnToLobby(room);
    });

    // --- Particle Effects ---
    const particleFactory = new ParticleFactory(this);
    const particleColor = didWin ? Colors.status.successNum : Colors.status.dangerNum;

    // Multiple victory/defeat bursts at different positions
    particleFactory.victoryBurst(200, 100, particleColor);
    particleFactory.victoryBurst(600, 100, particleColor);
    particleFactory.victoryBurst(400, 200, particleColor);

    // Delayed secondary bursts for staggered celebration
    this.time.delayedCall(400, () => {
      particleFactory.victoryBurst(150, 200, particleColor);
      particleFactory.victoryBurst(650, 200, particleColor);
    });
    this.time.delayedCall(800, () => {
      particleFactory.victoryBurst(300, 120, particleColor);
      particleFactory.victoryBurst(500, 120, particleColor);
    });
  }

  private returnToLobby(room: any) {
    // Clear reconnection token on intentional leave
    sessionStorage.removeItem('bangerActiveRoom');

    // Disconnect from room if still connected
    if (room) {
      try { room.leave(); } catch (e) { /* already disconnected */ }
    }

    // Stop victory overlay and game scene
    this.scene.stop('VictoryScene');
    this.scene.stop('GameScene');

    // Return to lobby scene
    this.scene.start('LobbyScene');
  }
}
