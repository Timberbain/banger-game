import Phaser from 'phaser';
import { Colors, Buttons, LayeredButton } from './designTokens';

export interface LayeredButtonHandle {
  elements: Phaser.GameObjects.GameObject[];
  face: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  /** Update face colors (for dynamic state buttons) */
  setStyle(bgNum: number, hoverNum: number, textColor?: string): void;
  /** Update label text */
  setText(text: string): void;
  /** Enable/disable interactivity */
  setEnabled(enabled: boolean): void;
}

export function createLayeredButton(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  text: string,
  options: {
    size?: 'lg' | 'md' | 'sm';
    bgNum: number;
    hoverNum: number;
    textColor?: string;
    onClick?: () => void;
    depth?: number;
  },
): LayeredButtonHandle {
  const size = options.size ?? 'md';
  const { width, height, fontSize } = LayeredButton.sizes[size];
  const textColor = options.textColor ?? Colors.text.primary;
  const elements: Phaser.GameObjects.GameObject[] = [];

  let currentBgNum = options.bgNum;
  let currentHoverNum = options.hoverNum;

  // Shadow layer (offset)
  const shadow = scene.add.rectangle(
    cx + LayeredButton.shadow.offsetX,
    cy + LayeredButton.shadow.offsetY,
    width,
    height,
    LayeredButton.shadow.color,
  );
  elements.push(shadow);

  // Bevel layer (slightly larger, dark gold)
  const bevel = scene.add.rectangle(
    cx,
    cy,
    width + LayeredButton.bevel.extraSize,
    height + LayeredButton.bevel.extraSize,
    LayeredButton.bevel.color,
  );
  elements.push(bevel);

  // Face layer with brass stroke
  const face = scene.add.rectangle(cx, cy, width, height, currentBgNum);
  face.setStrokeStyle(LayeredButton.stroke.width, LayeredButton.stroke.color);
  face.setInteractive({ useHandCursor: true });
  elements.push(face);

  // Text label
  const label = scene.add
    .text(cx, cy, text, {
      fontSize,
      color: textColor,
      fontFamily: 'monospace',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);
  elements.push(label);

  // Apply depth to all layers if specified
  if (options.depth !== undefined) {
    elements.forEach((el) => (el as any).setDepth(options.depth));
  }

  // Hover: change face fill
  face.on('pointerover', () => face.setFillStyle(currentHoverNum));
  face.on('pointerout', () => {
    face.y = cy;
    label.y = cy;
    face.setFillStyle(currentBgNum);
  });

  // Press: sink button down
  face.on('pointerdown', () => {
    face.y = cy + LayeredButton.pressOffset;
    label.y = cy + LayeredButton.pressOffset;
    if (options.onClick) options.onClick();
  });

  // Release: pop button back up
  face.on('pointerup', () => {
    face.y = cy;
    label.y = cy;
  });

  const handle: LayeredButtonHandle = {
    elements,
    face,
    label,

    setStyle(bgNum: number, hoverNum: number, newTextColor?: string) {
      currentBgNum = bgNum;
      currentHoverNum = hoverNum;
      face.setFillStyle(bgNum);
      if (newTextColor) label.setColor(newTextColor);
    },

    setText(newText: string) {
      label.setText(newText);
    },

    setEnabled(enabled: boolean) {
      if (enabled) {
        face.setInteractive({ useHandCursor: true });
      } else {
        face.disableInteractive();
        face.setFillStyle(Buttons.disabled.bgNum);
        label.setColor(Buttons.disabled.text);
        currentBgNum = Buttons.disabled.bgNum;
        currentHoverNum = Buttons.disabled.hoverNum;
      }
    },
  };

  return handle;
}
