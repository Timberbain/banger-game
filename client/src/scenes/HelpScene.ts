import Phaser from 'phaser';
import { Colors, TextStyle, Buttons, Decorative, Panels, charColor } from '../ui/designTokens';

/**
 * HelpScene - Controls tutorial screen with keyboard maps and role descriptions.
 * Accessible from lobby menu via "How to Play" button.
 */
export class HelpScene extends Phaser.Scene {
  private uiElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'HelpScene' });
  }

  create() {
    // Dark green solarpunk background
    const bg = this.add.rectangle(400, 300, 800, 600, Colors.bg.surfaceNum);
    this.uiElements.push(bg);

    // Title
    const title = this.add.text(400, 35, 'CONTROLS', {
      fontSize: '32px',
      color: Colors.accent.vine,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: Colors.bg.deep,
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Decorative line under title
    const gfx = this.add.graphics();
    gfx.lineStyle(Decorative.divider.thickness, Decorative.divider.color);
    gfx.lineBetween(200, 55, 600, 55);
    this.uiElements.push(gfx);

    // --- General Controls Section ---
    const generalTitle = this.add.text(400, 80, 'General', {
      ...TextStyle.heroHeading,
      fontSize: '20px',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.uiElements.push(generalTitle);

    const generalControls = [
      'Movement: WASD or Arrow Keys',
      'Fire: Spacebar',
      'Spectate (when eliminated): Tab to cycle',
    ];
    generalControls.forEach((text, i) => {
      const t = this.add.text(400, 105 + i * 22, text, {
        fontSize: '14px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(t);
    });

    // --- Role-specific sections (3 columns) ---
    const rolesY = 185;
    const roleSpacing = 240;
    const roleStartX = 400 - roleSpacing;

    const roles = [
      {
        role: 'paran',
        name: 'Paran',
        subtitle: 'The Force',
        stats: 'HP: 150 | Dmg: 40 | Fire: 1/sec',
        details: [
          'Cardinal movement only',
          '(last key wins)',
          'Builds speed over time',
          'Loses ALL speed on',
          'wall/obstacle collision',
          'Kills guardians on',
          'body contact',
          'Destroys obstacles',
        ],
      },
      {
        role: 'faran',
        name: 'Faran',
        subtitle: 'Guardian',
        stats: 'HP: 50 | Dmg: 10 | Fire: 5/sec',
        details: [
          '8-directional movement',
          '(diagonal allowed)',
          'Work with Baran to',
          'trap and eliminate',
          'Paran',
        ],
      },
      {
        role: 'baran',
        name: 'Baran',
        subtitle: 'Guardian',
        stats: 'HP: 50 | Dmg: 10 | Fire: 5/sec',
        details: [
          '8-directional movement',
          '(diagonal allowed)',
          'Work with Faran to',
          'trap and eliminate',
          'Paran',
        ],
      },
    ];

    roles.forEach((r, index) => {
      const x = roleStartX + index * roleSpacing;

      // Panel background
      const panel = this.add.rectangle(x, rolesY + 110, 210, 255, Colors.bg.deepNum);
      panel.setStrokeStyle(Panels.card.borderWidth, Panels.card.border);
      this.uiElements.push(panel);

      // Character sprite (idle animation)
      try {
        const sprite = this.add.sprite(x, rolesY + 15, r.role);
        sprite.play(`${r.role}-idle`);
        sprite.setScale(2);
        this.uiElements.push(sprite);
      } catch (_e) {
        // Fallback: colored circle if sprite not available
        const circle = this.add.circle(x, rolesY + 15, 16, Phaser.Display.Color.HexStringToColor(charColor(r.role)).color);
        this.uiElements.push(circle);
      }

      // Role name
      const nameText = this.add.text(x, rolesY + 45, r.name, {
        fontSize: '18px',
        color: charColor(r.role),
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      this.uiElements.push(nameText);

      // Subtitle
      const subtitleText = this.add.text(x, rolesY + 63, r.subtitle, {
        fontSize: '12px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(subtitleText);

      // Stats line
      const statsText = this.add.text(x, rolesY + 82, r.stats, {
        fontSize: '11px',
        color: Colors.gold.primary,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(statsText);

      // Detail lines
      r.details.forEach((line, lineIdx) => {
        const detailText = this.add.text(x, rolesY + 102 + lineIdx * 18, line, {
          fontSize: '12px',
          color: Colors.text.secondary,
          fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.uiElements.push(detailText);
      });
    });

    // --- Win Conditions Section ---
    const winY = 445;
    const winTitle = this.add.text(400, winY, 'Win Conditions', {
      ...TextStyle.heroHeading,
      fontSize: '20px',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.uiElements.push(winTitle);

    const winConditions = [
      { text: 'Paran wins: Eliminate both guardians', color: Colors.char.paran },
      { text: 'Guardians win: Eliminate Paran OR survive 5 minutes', color: Colors.char.faran },
    ];
    winConditions.forEach((wc, i) => {
      const t = this.add.text(400, winY + 25 + i * 22, wc.text, {
        fontSize: '14px',
        color: wc.color,
        fontFamily: 'monospace',
        stroke: '#000000',
        strokeThickness: 1,
      }).setOrigin(0.5);
      this.uiElements.push(t);
    });

    // --- Back Button ---
    const backButton = this.add.text(400, 540, 'Back to Lobby', {
      fontSize: '20px',
      color: Buttons.primary.text,
      fontFamily: 'monospace',
      fontStyle: 'bold',
      backgroundColor: Buttons.primary.bg,
      padding: { x: 24, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setBackgroundColor(Buttons.primary.hover));
    backButton.on('pointerout', () => backButton.setBackgroundColor(Buttons.primary.bg));
    backButton.on('pointerdown', () => {
      this.scene.start('LobbyScene');
    });
    this.uiElements.push(backButton);
  }

  shutdown() {
    this.uiElements.forEach(el => {
      if (el && el.scene) el.destroy();
    });
    this.uiElements = [];
  }
}
