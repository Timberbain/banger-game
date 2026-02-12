import Phaser from 'phaser';

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
    const bg = this.add.rectangle(400, 300, 800, 600, 0x1a2e1a);
    this.uiElements.push(bg);

    // Title
    const title = this.add.text(400, 35, 'CONTROLS', {
      fontSize: '32px',
      color: '#4a7c3f',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      stroke: '#0d1f0d',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.uiElements.push(title);

    // Decorative line under title
    const gfx = this.add.graphics();
    gfx.lineStyle(2, 0xd4a746);
    gfx.lineBetween(200, 55, 600, 55);
    this.uiElements.push(gfx);

    // --- General Controls Section ---
    const generalTitle = this.add.text(400, 80, 'General', {
      fontSize: '20px',
      color: '#d4a746',
      fontFamily: 'monospace',
      fontStyle: 'bold',
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
        color: '#cccccc',
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
        color: '#ffcc00',
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
        color: '#ff4444',
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
        color: '#44cc66',
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
      const panel = this.add.rectangle(x, rolesY + 110, 210, 255, 0x0d1f0d);
      panel.setStrokeStyle(2, 0x4a7c3f);
      this.uiElements.push(panel);

      // Character sprite (idle animation)
      try {
        const sprite = this.add.sprite(x, rolesY + 15, r.role);
        sprite.play(`${r.role}-idle`);
        sprite.setScale(2);
        this.uiElements.push(sprite);
      } catch (_e) {
        // Fallback: colored circle if sprite not available
        const circle = this.add.circle(x, rolesY + 15, 16, parseInt(r.color.replace('#', '0x')));
        this.uiElements.push(circle);
      }

      // Role name
      const nameText = this.add.text(x, rolesY + 45, r.name, {
        fontSize: '18px',
        color: r.color,
        fontFamily: 'monospace',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.uiElements.push(nameText);

      // Subtitle
      const subtitleText = this.add.text(x, rolesY + 63, r.subtitle, {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(subtitleText);

      // Stats line
      const statsText = this.add.text(x, rolesY + 82, r.stats, {
        fontSize: '11px',
        color: '#d4a746',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(statsText);

      // Detail lines
      r.details.forEach((line, lineIdx) => {
        const detailText = this.add.text(x, rolesY + 102 + lineIdx * 18, line, {
          fontSize: '12px',
          color: '#cccccc',
          fontFamily: 'monospace',
        }).setOrigin(0.5);
        this.uiElements.push(detailText);
      });
    });

    // --- Win Conditions Section ---
    const winY = 445;
    const winTitle = this.add.text(400, winY, 'Win Conditions', {
      fontSize: '20px',
      color: '#d4a746',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.uiElements.push(winTitle);

    const winConditions = [
      { text: 'Paran wins: Eliminate both guardians', color: '#ffcc00' },
      { text: 'Guardians win: Eliminate Paran OR survive 5 minutes', color: '#ff4444' },
    ];
    winConditions.forEach((wc, i) => {
      const t = this.add.text(400, winY + 25 + i * 22, wc.text, {
        fontSize: '14px',
        color: wc.color,
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.uiElements.push(t);
    });

    // --- Back Button ---
    const backButton = this.add.text(400, 540, 'Back to Lobby', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#2d5a2d',
      padding: { x: 24, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backButton.on('pointerover', () => backButton.setBackgroundColor('#3d7a3d'));
    backButton.on('pointerout', () => backButton.setBackgroundColor('#2d5a2d'));
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
