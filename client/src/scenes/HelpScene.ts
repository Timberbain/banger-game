import Phaser from 'phaser';
import { Colors, TextStyle, Buttons, Panels, charColor } from '../ui/designTokens';
import { createLayeredButton } from '../ui/createLayeredButton';
import { drawGoldDivider } from '../ui/UIFactory';

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
    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Dark green solarpunk background
    const bg = this.add.rectangle(cx, this.cameras.main.centerY, w, h, Colors.bg.surfaceNum);
    this.uiElements.push(bg);

    // Title
    const title = this.add
      .text(cx, 50, 'HOW TO PLAY', {
        fontSize: '32px',
        color: Colors.accent.vine,
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: Colors.bg.deep,
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.uiElements.push(title);

    // Decorative line under title
    const gfx = drawGoldDivider(this, cx - 250, 75, cx + 250, 75, 1);
    this.uiElements.push(gfx);

    // --- Controls Section (single line) ---
    const controlsText = this.add
      .text(cx, 100, 'WASD to move  |  SPACE to shoot  |  TAB to spectate', {
        fontSize: '14px',
        color: Colors.text.secondary,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(controlsText);

    // --- Role panels (3 columns) -- spaced for 1280 width ---
    const rolesY = 170;
    const roleSpacing = 340;
    const roleStartX = cx - roleSpacing;

    const roles = [
      {
        role: 'paran',
        name: 'Paran',
        tagline: 'Unstoppable force',
        lines: [
          'Charges through the arena at blazing speed',
          'Crushes guardians on contact',
          'One wrong wall and you lose it all',
        ],
      },
      {
        role: 'faran',
        name: 'Faran',
        tagline: 'The sharpshooter',
        lines: ['Nimble guardian with a rapid-fire blaster', 'Team up with Baran to corner Paran'],
      },
      {
        role: 'baran',
        name: 'Baran',
        tagline: 'The heavy hitter',
        lines: ['Armored guardian packing serious firepower', 'Team up with Faran to corner Paran'],
      },
    ];

    roles.forEach((r, index) => {
      const x = roleStartX + index * roleSpacing;

      // Panel background (280 x 260)
      const panel = this.add.rectangle(x, rolesY + 130, 280, 260, Colors.bg.deepNum);
      panel.setStrokeStyle(Panels.card.borderWidth, Panels.card.border);
      this.uiElements.push(panel);

      // Character sprite (idle animation)
      try {
        const sprite = this.add.sprite(x, rolesY + 45, r.role);
        sprite.play(`${r.role}-idle`);
        sprite.setScale(2);
        this.uiElements.push(sprite);
      } catch (_e) {
        // Fallback: colored circle if sprite not available
        const circle = this.add.circle(
          x,
          rolesY + 45,
          16,
          Phaser.Display.Color.HexStringToColor(charColor(r.role)).color,
        );
        this.uiElements.push(circle);
      }

      // Role name
      const nameText = this.add
        .text(x, rolesY + 85, r.name, {
          fontSize: '18px',
          color: charColor(r.role),
          fontFamily: 'monospace',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.uiElements.push(nameText);

      // Role tagline
      const taglineText = this.add
        .text(x, rolesY + 105, r.tagline, {
          fontSize: '13px',
          color: Colors.text.secondary,
          fontFamily: 'monospace',
          fontStyle: 'italic',
        })
        .setOrigin(0.5);
      this.uiElements.push(taglineText);

      // Playful description lines
      r.lines.forEach((line, lineIdx) => {
        const descText = this.add
          .text(x, rolesY + 128 + lineIdx * 28, line, {
            fontSize: '13px',
            color: Colors.text.secondary,
            fontFamily: 'monospace',
            wordWrap: { width: 250 },
          })
          .setOrigin(0.5);
        this.uiElements.push(descText);
      });
    });

    // --- Win Conditions Section ---
    const winY = 510;
    const winTitle = this.add
      .text(cx, winY, 'Win Conditions', {
        ...TextStyle.heroHeading,
        fontSize: '20px',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(winTitle);

    const winConditions = [
      { text: 'Paran wins by eliminating both guardians', color: Colors.char.paran },
      {
        text: 'Guardians win by taking down Paran or surviving the clock',
        color: Colors.char.faran,
      },
    ];
    winConditions.forEach((wc, i) => {
      const t = this.add
        .text(cx, winY + 28 + i * 24, wc.text, {
          fontSize: '14px',
          color: wc.color,
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 1,
        })
        .setOrigin(0.5);
      this.uiElements.push(t);
    });

    // Arena tip
    const tipText = this.add
      .text(cx, winY + 65, 'The arena is alive -- smash through obstacles or use them as cover!', {
        fontSize: '12px',
        color: Colors.accent.vine,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
    this.uiElements.push(tipText);

    // --- Back Button --- layered
    const backHandle = createLayeredButton(this, cx, 640, 'Back to Lobby', {
      size: 'md',
      bgNum: Buttons.primary.bgNum,
      hoverNum: Buttons.primary.hoverNum,
      onClick: () => {
        this.scene.start('LobbyScene');
      },
    });
    backHandle.elements.forEach((el) => this.uiElements.push(el));
  }

  shutdown() {
    this.uiElements.forEach((el) => {
      if (el && el.scene) el.destroy();
    });
    this.uiElements = [];
  }
}
