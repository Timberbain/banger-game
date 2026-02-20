import Phaser from 'phaser';
import { Colors, TextStyle } from '../ui/designTokens';

export class StageIntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'StageIntroScene' });
  }

  create(data: {
    stageNumber: number;
    arenaName: string;
    paranWins: number;
    guardianWins: number;
  }) {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Semi-transparent dark overlay
    this.add.rectangle(cx, cy, w, h, 0x000000, 0.7).setDepth(0);

    // "STAGE X" large text
    this.add
      .text(cx, cy - 80, `STAGE ${data.stageNumber}`, {
        ...TextStyle.hero,
        fontSize: '56px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Arena name
    this.add
      .text(cx, cy - 10, data.arenaName, {
        fontSize: '28px',
        color: Colors.gold.light,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Score display
    const scoreText = `Paran ${data.paranWins} - ${data.guardianWins} Guardians`;
    this.add
      .text(cx, cy + 50, scoreText, {
        fontSize: '22px',
        color: Colors.text.primary,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Gold divider
    const gfx = this.add.graphics();
    gfx.lineStyle(2, Colors.gold.primaryNum, 0.7);
    gfx.lineBetween(cx - 200, cy + 90, cx + 200, cy + 90);
    gfx.setDepth(1);

    // "Get ready..." subtitle
    this.add
      .text(cx, cy + 120, 'Get ready...', {
        fontSize: '16px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(1);
  }
}
