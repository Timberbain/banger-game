import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { VictoryScene } from './scenes/VictoryScene';
import { HelpScene } from './scenes/HelpScene';
import { StageIntroScene } from './scenes/StageIntroScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,
  height: 720,
  parent: 'game-container',
  backgroundColor: '#101E14',
  pixelArt: true,
  roundPixels: true,
  scene: [BootScene, LobbyScene, GameScene, HUDScene, VictoryScene, HelpScene, StageIntroScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
};

new Phaser.Game(config);
