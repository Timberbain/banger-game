import Phaser from 'phaser';
import { ParticleFactory } from '../systems/ParticleFactory';
import { AudioManager } from '../systems/AudioManager';
import { Colors, TextStyle, Buttons, charColor } from '../ui/designTokens';
import { createLayeredButton } from '../ui/createLayeredButton';
import { drawGoldDivider } from '../ui/UIFactory';

export class VictoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'VictoryScene' });
  }

  create(data: {
    winner: string;
    stats: Record<string, any>;
    duration: number;
    localSessionId: string;
    room: any;
    stageResults?: Array<{
      stageNumber: number;
      arenaName: string;
      winner: string;
      duration: number;
      stats: Record<
        string,
        { kills: number; deaths: number; damageDealt: number; shotsFired: number; shotsHit: number }
      >;
    }>;
  }) {
    const { winner, stats, duration, localSessionId, room } = data;

    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Determine if local player won
    const localStats = stats[localSessionId];
    const localRole = localStats?.role || 'unknown';
    const didWin =
      (winner === 'paran' && localRole === 'paran') ||
      (winner === 'guardians' && localRole !== 'paran');

    // Get AudioManager from registry
    const audioManager = this.registry.get('audioManager') as AudioManager | null;

    // Play victory or defeat music
    if (didWin) {
      // Small delay (music was fading in GameScene), then play victory track once
      this.time.delayedCall(600, () => {
        if (audioManager) {
          audioManager.playMusic('audio/gameover/victory.mp3', false);
        }
      });
    } else {
      // Defeat sting first, then defeat track
      if (audioManager) {
        audioManager.playWAVSFX('lose_1');
        this.time.delayedCall(1200, () => {
          audioManager.playMusic('audio/gameover/defeat.mp3', false);
        });
      }
    }

    // Victory splash image background (different for each outcome)
    const splashKey = didWin ? 'victory-guardian' : 'victory-paran';
    const splashBg = this.add.image(cx, cy, splashKey);
    splashBg.setDisplaySize(w, h);
    splashBg.setDepth(0);

    // Dark overlay for readability
    this.add.rectangle(cx, cy, w, h, 0x000000, Colors.bg.overlayAlpha).setDepth(0.5);

    // Color wash overlay (between image and content)
    const washColor = didWin ? Colors.status.successNum : Colors.status.dangerNum;
    this.add.rectangle(cx, cy, w, h, washColor, 0.1).setDepth(0.6);

    // Victory/Defeat title
    const titleText = didWin ? 'VICTORY!' : 'DEFEAT';
    const titleColor = didWin ? Colors.gold.primary : Colors.status.danger;
    this.add
      .text(cx, 70, titleText, {
        ...TextStyle.hero,
        color: titleColor,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Winner subtitle with series score
    const stageResults = data.stageResults || [];
    let paranWins = 0,
      guardianWins = 0;
    for (const stage of stageResults) {
      if (stage.winner === 'paran') paranWins++;
      else guardianWins++;
    }
    const winnerLabel =
      stageResults.length > 0
        ? `${winner === 'paran' ? 'Paran' : 'Guardians'} Win (${paranWins} - ${guardianWins})`
        : winner === 'paran'
          ? 'Paran Wins!'
          : 'Guardians Win!';
    this.add
      .text(cx, 150, winnerLabel, {
        fontSize: '24px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Match duration
    const durationSec = Math.round(duration / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    this.add
      .text(cx, 190, `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
        fontSize: '16px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Gold divider above stats
    const dividerGfx = drawGoldDivider(this, cx - 350, 225, cx + 350, 225, 0.7);
    dividerGfx.setDepth(1);

    // Stats header -- golden
    this.add
      .text(cx, 245, 'MATCH STATISTICS', {
        ...TextStyle.heroHeading,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Table header row -- positions scaled for 1280 width
    const headerY = 285;
    const cols = {
      name: 140,
      role: 340,
      kills: 470,
      deaths: 550,
      damage: 650,
      accuracy: 780,
    };
    const headerStyle = {
      fontSize: '14px',
      color: Colors.text.secondary,
      fontFamily: 'monospace',
      stroke: '#000000' as string,
      strokeThickness: 1,
    };
    this.add.text(cols.name, headerY, 'Player', headerStyle).setDepth(1);
    this.add.text(cols.role, headerY, 'Role', headerStyle).setDepth(1);
    this.add.text(cols.kills, headerY, 'K', headerStyle).setDepth(1);
    this.add.text(cols.deaths, headerY, 'D', headerStyle).setDepth(1);
    this.add.text(cols.damage, headerY, 'Damage', headerStyle).setDepth(1);
    this.add.text(cols.accuracy, headerY, 'Accuracy', headerStyle).setDepth(1);

    // Header underline -- gold
    const line = this.add.graphics();
    line.lineStyle(1, Colors.gold.darkNum, 0.5);
    line.lineBetween(110, headerY + 22, w - 110, headerY + 22);
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
        this.add.rectangle(cx, yOffset + 8, w - 200, 28, Colors.bg.elevatedNum, 0.5).setDepth(1);
      }

      // Player name (truncate)
      const displayName =
        playerStats.name.length > 12 ? playerStats.name.substring(0, 10) + '..' : playerStats.name;
      this.add.text(cols.name, yOffset, displayName, style).setDepth(2);

      // Role
      const roleLabel =
        playerStats.role === 'paran' ? 'Paran' : playerStats.role === 'faran' ? 'Faran' : 'Baran';
      this.add
        .text(cols.role, yOffset, roleLabel, {
          ...style,
          color: charColor(playerStats.role),
        })
        .setDepth(2);

      // K/D/Damage/Accuracy
      this.add.text(cols.kills, yOffset, String(playerStats.kills), style).setDepth(2);
      this.add.text(cols.deaths, yOffset, String(playerStats.deaths), style).setDepth(2);
      this.add.text(cols.damage, yOffset, String(playerStats.damageDealt), style).setDepth(2);
      this.add
        .text(cols.accuracy, yOffset, `${playerStats.accuracy.toFixed(1)}%`, style)
        .setDepth(2);

      yOffset += 35;
    });

    // Gold divider below stats
    const dividerGfx2 = drawGoldDivider(this, cx - 350, yOffset + 5, cx + 350, yOffset + 5, 0.7);
    dividerGfx2.setDepth(1);

    // Per-Stage Breakdown (only if stageResults available)
    if (stageResults.length > 0) {
      yOffset += 20; // Space after divider

      this.add
        .text(cx, yOffset, 'STAGE BREAKDOWN', {
          ...TextStyle.heroHeading,
          fontSize: '18px',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
        .setDepth(1);
      yOffset += 30;

      for (const stage of stageResults) {
        const stageWinColor = stage.winner === 'paran' ? Colors.char.paran : Colors.char.faran;
        const stageWinLabel = stage.winner === 'paran' ? 'Paran' : 'Guardians';
        const durationSec = Math.round(stage.duration / 1000);
        const min = Math.floor(durationSec / 60);
        const sec = durationSec % 60;

        // Stage line: "Stage 1: Hedge Garden"
        this.add
          .text(cx, yOffset, `Stage ${stage.stageNumber}: ${stage.arenaName}`, {
            fontSize: '15px',
            color: Colors.text.primary,
            fontFamily: 'monospace',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(1);
        yOffset += 22;

        // Winner line: "Winner: Paran  (2:34)"
        this.add
          .text(
            cx,
            yOffset,
            `Winner: ${stageWinLabel}  (${min}:${sec.toString().padStart(2, '0')})`,
            {
              fontSize: '13px',
              color: stageWinColor,
              fontFamily: 'monospace',
              stroke: '#000000',
              strokeThickness: 2,
            },
          )
          .setOrigin(0.5)
          .setDepth(1);
        yOffset += 26;
      }
    }

    // Return to Lobby button -- primary layered (dynamic Y based on content)
    const buttonY = Math.max(580, yOffset + 30);
    createLayeredButton(this, cx, buttonY, 'Return to Lobby', {
      size: 'md',
      bgNum: Buttons.primary.bgNum,
      hoverNum: Buttons.primary.hoverNum,
      depth: 2,
      onClick: () => {
        // Play button click SFX and fade out result music
        // Delay returnToLobby until fade completes so isPlayingMusic() returns false
        // when LobbyScene.create() runs -- allowing lobby music to start
        if (audioManager) {
          audioManager.playWAVSFX('select_1');
          audioManager.fadeOutMusic(500, () => {
            this.returnToLobby(room);
          });
        } else {
          this.returnToLobby(room);
        }
      },
    });

    // --- Particle Effects ---
    const particleFactory = new ParticleFactory(this);
    const particleColor = didWin ? Colors.status.successNum : Colors.status.dangerNum;

    // Multiple victory/defeat bursts at different positions (scaled for 1280x720)
    particleFactory.victoryBurst(w * 0.2, 120, particleColor);
    particleFactory.victoryBurst(w * 0.8, 120, particleColor);
    particleFactory.victoryBurst(cx, 240, particleColor);

    // Delayed secondary bursts for staggered celebration
    this.time.delayedCall(400, () => {
      particleFactory.victoryBurst(w * 0.15, 240, particleColor);
      particleFactory.victoryBurst(w * 0.85, 240, particleColor);
    });
    this.time.delayedCall(800, () => {
      particleFactory.victoryBurst(w * 0.35, 140, particleColor);
      particleFactory.victoryBurst(w * 0.65, 140, particleColor);
    });

    // Victory firework SFX tied to particle bursts (only on win)
    if (didWin && audioManager) {
      const fireworkTimes = [800, 1400, 2000, 2600, 3200];
      for (const delay of fireworkTimes) {
        this.time.delayedCall(delay, () => {
          audioManager.playRandomWAV(['fire_1', 'fire_2', 'fire_3']);
          // Additional particle burst at random position for each firework
          const rx = cx + Phaser.Math.Between(-200, 200);
          const ry = cy + Phaser.Math.Between(-150, 50);
          particleFactory.victoryBurst(rx, ry, particleColor);
        });
      }
    }
  }

  private returnToLobby(room: any) {
    // Clear reconnection token on intentional leave
    sessionStorage.removeItem('bangerActiveRoom');

    // Disconnect from room if still connected
    if (room) {
      try {
        room.leave();
      } catch (e) {
        /* already disconnected */
      }
    }

    // Stop victory overlay and game scene
    this.scene.stop('VictoryScene');
    this.scene.stop('GameScene');

    // Return to lobby scene
    this.scene.start('LobbyScene');
  }
}
