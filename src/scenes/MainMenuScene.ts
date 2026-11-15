import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { Save } from '../core/SaveManager';
import { CARDS } from '../data/cards';
import { button, cardView, currencyLabel, menuBackground } from '../ui/widgets';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const save = Save.get();
    menuBackground(this);
    currencyLabel(this, GAME_W - 20, 20);
    const reset = button(this, 100, 44, 170, 52, 'Новая игра', () => this.confirmNewGame(), 0x3a3157);
    (reset.list[1] as Phaser.GameObjects.Text).setFontSize(20);

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
      const big = cardView(this, GAME_W / 2, 470, 300, 400, leader, save.cards[leaderId].level, save.cards[leaderId].awakening);
      this.tweens.add({ targets: big, y: 460, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add
        .text(GAME_W / 2, 690, 'Лидер', { fontFamily: FONT, fontSize: '26px', color: '#ffe066' })
        .setOrigin(0.5)
        .setStroke('#000000', 6);
    }

    const w = 130;
    const gap = 14;
    const startX = GAME_W / 2 - ((rest.length - 1) * (w + gap)) / 2;
    rest.forEach((id, i) => cardView(this, startX + i * (w + gap), 830, w, 174, CARDS[id], save.cards[id].level, save.cards[id].awakening));

    button(this, GAME_W / 2 - 115, 1000, 430, 110, 'Сюжет', () => this.scene.start('StoryMap'), 0xd8323c);
    button(this, GAME_W / 2 + 232, 1000, 216, 110, 'Призыв', () => this.scene.start('Summon'), 0xc28a12);
    const quick = button(this, GAME_W / 2 - 232, 1140, 216, 90, 'Быстрый бой', () => this.scene.start('Battle', {}), 0x8a2b52);
    (quick.list[1] as Phaser.GameObjects.Text).setFontSize(25);
    button(this, GAME_W / 2, 1140, 216, 90, 'Команда', () => this.scene.start('Team'));
    button(this, GAME_W / 2 + 232, 1140, 216, 90, 'Прокачка', () => this.scene.start('Upgrade'));
  }

  private confirmNewGame(): void {
    const cx = GAME_W / 2;
    const cy = GAME_H / 2;
    const parts: Phaser.GameObjects.GameObject[] = [];
    const close = () => parts.forEach((p) => p.destroy());
    parts.push(
      this.add.rectangle(cx, cy, GAME_W, GAME_H, 0x000000, 0.8).setDepth(100).setInteractive(),
      this.add
        .text(cx, cy - 150, 'Начать заново?', { fontFamily: FONT, fontSize: '56px', color: '#ffffff' })
        .setOrigin(0.5)
        .setStroke('#000000', 9)
        .setDepth(101),
      this.add
        .text(cx, cy - 70, 'Герои, золото, кристаллы и сюжет будут удалены.\nЭто нельзя отменить.', {
          fontFamily: FONT,
          fontSize: '24px',
          color: '#ff9a9a',
          align: 'center',
        })
        .setOrigin(0.5)
        .setStroke('#000000', 5)
        .setDepth(101),
      button(this, cx, cy + 60, 360, 96, 'Да, начать', () => {
        Save.reset();
        this.scene.start('Dialogue', { script: 'prologue' });
      }, 0xd8323c).setDepth(101),
      button(this, cx, cy + 180, 360, 90, 'Отмена', close).setDepth(101),
    );
  }
}
