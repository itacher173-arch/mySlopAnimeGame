import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { Save } from '../core/SaveManager';
import { CARDS } from '../data/cards';
import { button, cardView, goldLabel, menuBackground } from '../ui/widgets';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const save = Save.get();
    menuBackground(this);
    goldLabel(this, save.gold);

    this.add
      .text(GAME_W / 2, 110, 'SPIRIT STONES', { fontFamily: FONT, fontSize: '64px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#5a2a00', 12);
    this.add
      .text(GAME_W / 2, 175, 'ANIME', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 8);

    const [leaderId, ...rest] = save.team;
    const leader = CARDS[leaderId];
    if (leader) {
      const big = cardView(this, GAME_W / 2, 470, 300, 400, leader, save.cards[leaderId].level);
      this.tweens.add({ targets: big, y: 460, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add
        .text(GAME_W / 2, 690, 'Лидер', { fontFamily: FONT, fontSize: '26px', color: '#ffe066' })
        .setOrigin(0.5)
        .setStroke('#000000', 6);
    }

    const w = 130;
    const gap = 14;
    const startX = GAME_W / 2 - ((rest.length - 1) * (w + gap)) / 2;
    rest.forEach((id, i) => cardView(this, startX + i * (w + gap), 830, w, 174, CARDS[id], save.cards[id].level));

    button(this, GAME_W / 2, 1005, 420, 110, 'В бой', () => this.scene.start('Battle'), 0xd8323c);
    button(this, GAME_W / 2 - 165, 1145, 300, 90, 'Команда', () => this.scene.start('Team'));
    button(this, GAME_W / 2 + 165, 1145, 300, 90, 'Прокачка', () => this.scene.start('Upgrade'));
  }
}
