import Phaser from 'phaser';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data: { winner: string; stats: Record<string, any>; duration: number; localSessionId: string; room: any }) {
    const { winner, stats, duration, localSessionId, room } = data;

    // Semi-transparent black overlay
    this.add.rectangle(400, 300, 800, 600, 0x000000, 0.85).setDepth(0);

    // Determine if local player won
    const localStats = stats[localSessionId];
    const localRole = localStats?.role || "unknown";
    const didWin = (winner === "paran" && localRole === "paran") ||
                   (winner === "guardians" && localRole !== "paran");

    // Victory/Defeat title
    const titleText = didWin ? "VICTORY!" : "DEFEAT";
    const titleColor = didWin ? "#00ff00" : "#ff0000";
    this.add.text(400, 60, titleText, {
      fontSize: '64px',
      color: titleColor,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1);

    // Winner subtitle
    const winnerLabel = winner === "paran" ? "Paran Wins!" : "Guardians Win!";
    this.add.text(400, 130, winnerLabel, {
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(1);

    // Match duration
    const durationSec = Math.round(duration / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    this.add.text(400, 165, `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
      fontSize: '16px',
      color: '#aaaaaa'
    }).setOrigin(0.5).setDepth(1);

    // Stats header
    this.add.text(400, 210, "MATCH STATISTICS", {
      fontSize: '22px',
      color: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1);

    // Table header row
    const headerY = 250;
    const cols = { name: 100, role: 250, kills: 340, deaths: 400, damage: 470, accuracy: 570 };
    this.add.text(cols.name, headerY, "Player", { fontSize: '14px', color: '#888888' }).setDepth(1);
    this.add.text(cols.role, headerY, "Role", { fontSize: '14px', color: '#888888' }).setDepth(1);
    this.add.text(cols.kills, headerY, "K", { fontSize: '14px', color: '#888888' }).setDepth(1);
    this.add.text(cols.deaths, headerY, "D", { fontSize: '14px', color: '#888888' }).setDepth(1);
    this.add.text(cols.damage, headerY, "Damage", { fontSize: '14px', color: '#888888' }).setDepth(1);
    this.add.text(cols.accuracy, headerY, "Accuracy", { fontSize: '14px', color: '#888888' }).setDepth(1);

    // Header underline
    const line = this.add.graphics();
    line.lineStyle(1, 0x555555);
    line.lineBetween(80, headerY + 22, 720, headerY + 22);
    line.setDepth(1);

    // Player stats rows
    let yOffset = headerY + 35;
    Object.entries(stats).forEach(([sessionId, playerStats]: [string, any]) => {
      const isLocal = sessionId === localSessionId;
      const color = isLocal ? '#ffff00' : '#ffffff';
      const style = { fontSize: '16px', color, fontStyle: isLocal ? 'bold' : 'normal' };

      // Highlight row for local player
      if (isLocal) {
        this.add.rectangle(400, yOffset + 8, 640, 28, 0x333333, 0.5).setDepth(1);
      }

      // Player name (truncate)
      const displayName = playerStats.name.length > 12
        ? playerStats.name.substring(0, 10) + ".."
        : playerStats.name;
      this.add.text(cols.name, yOffset, displayName, style).setDepth(2);

      // Role
      const roleLabel = playerStats.role === 'paran' ? 'Paran' :
                         playerStats.role === 'faran' ? 'Faran' : 'Baran';
      this.add.text(cols.role, yOffset, roleLabel, style).setDepth(2);

      // K/D/Damage/Accuracy
      this.add.text(cols.kills, yOffset, String(playerStats.kills), style).setDepth(2);
      this.add.text(cols.deaths, yOffset, String(playerStats.deaths), style).setDepth(2);
      this.add.text(cols.damage, yOffset, String(playerStats.damageDealt), style).setDepth(2);
      this.add.text(cols.accuracy, yOffset, `${playerStats.accuracy.toFixed(1)}%`, style).setDepth(2);

      yOffset += 35;
    });

    // Return to Lobby button
    const button = this.add.text(400, 500, "Return to Lobby", {
      fontSize: '24px',
      color: '#ffffff',
      backgroundColor: '#0066cc',
      padding: { x: 24, y: 12 }
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .setDepth(2);

    button.on('pointerover', () => button.setBackgroundColor('#0088ff'));
    button.on('pointerout', () => button.setBackgroundColor('#0066cc'));
    button.on('pointerdown', () => this.returnToLobby(room));
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
