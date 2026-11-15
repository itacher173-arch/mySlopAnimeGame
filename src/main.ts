import Phaser from 'phaser';
import { GAME_H, GAME_W } from './config';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { DialogueScene } from './scenes/DialogueScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { StoryMapScene } from './scenes/StoryMapScene';
import { TeamScene } from './scenes/TeamScene';
import { UpgradeScene } from './scenes/UpgradeScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0d0b1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MainMenuScene, TeamScene, UpgradeScene, StoryMapScene, DialogueScene, BattleScene],
});

// Доступ из консоли и автотестов (puppeteer).
(window as unknown as { game: Phaser.Game }).game = game;
