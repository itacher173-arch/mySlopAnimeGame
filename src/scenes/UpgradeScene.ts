import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { MAX_LEVEL, cardStats, upgradeCost } from '../core/progression';
import { Save } from '../core/SaveManager';
import { CARDS } from '../data/cards';
import { ELEMENT_COLOR, ELEMENT_NAME } from '../data/elements';
import { button, cardView, goldLabel, hex, menuBackground, setButtonEnabled, title } from '../ui/widgets';

const GRID_COLS = 5;
const GRID_W = 124;
const GRID_H = 165;
const GRID_Y = 640;

export class UpgradeScene extends Phaser.Scene {
  private selectedId = '';
  private content!: Phaser.GameObjects.Container;
  private gold!: Phaser.GameObjects.Text;

  constructor() {
    super('Upgrade');
  }

  create(): void {
    const save = Save.get();
    this.selectedId = save.team[0] ?? Object.keys(save.cards)[0];
    menuBackground(this);
    title(this, 'Прокачка');
    button(this, 80, 60, 120, 64, 'Назад', () => this.scene.start('MainMenu'));
    this.gold = goldLabel(this, save.gold).setPosition(700, 110);
    this.content = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.content.removeAll(true);
    const save = Save.get();
    this.gold.setText(`Золото: ${save.gold}`);

    const owned = save.cards[this.selectedId];
    const def = CARDS[this.selectedId];
    const stats = cardStats(def, owned.level);
    const maxed = owned.level >= MAX_LEVEL;
    const next = cardStats(def, owned.level + 1);
    const cost = upgradeCost(owned.level);

    this.content.add(cardView(this, 170, 360, 240, 320, def, owned.level));

    const tx = 320;
    const line = (y: number, text: string, color = '#ffffff', size = 26) =>
      this.content.add(this.add.text(tx, y, text, { fontFamily: FONT, fontSize: `${size}px`, color }).setStroke('#000000', 5));
    line(180, def.name, '#ffffff', 36);
    line(228, def.anime, '#c9b8ff', 20);
    line(262, ELEMENT_NAME[def.element], hex(ELEMENT_COLOR[def.element]), 24);
    line(304, `Уровень: ${owned.level}${maxed ? ' (макс.)' : ` → ${owned.level + 1}`}`);
    line(342, `Атака: ${stats.atk}${maxed ? '' : `  (+${next.atk - stats.atk})`}`);
    line(380, `HP: ${stats.hp}${maxed ? '' : `  (+${next.hp - stats.hp})`}`);

    const btn = button(this, 500, 500, 340, 84, maxed ? 'Максимум' : `Улучшить: ${cost}`, () => this.upgrade(), 0x2f9e4f);
    setButtonEnabled(btn, !maxed && save.gold >= cost);
    this.content.add(btn);

    const gx = GAME_W / 2 - ((GRID_COLS - 1) * (GRID_W + 12)) / 2;
    Object.values(save.cards).forEach((card, i) => {
      const x = gx + (i % GRID_COLS) * (GRID_W + 12);
      const y = GRID_Y + Math.floor(i / GRID_COLS) * (GRID_H + 24) + GRID_H / 2;
      const view = cardView(this, x, y, GRID_W, GRID_H, CARDS[card.id], card.level);
      if (card.id === this.selectedId) {
        this.content.add(this.add.rectangle(x, y, GRID_W + 12, GRID_H + 12).setStrokeStyle(5, 0xffe066));
      }
      view.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selectedId = card.id;
        this.render();
      });
      this.content.add(view);
    });
  }

  private upgrade(): void {
    const save = Save.get();
    const owned = save.cards[this.selectedId];
    const cost = upgradeCost(owned.level);
    if (owned.level >= MAX_LEVEL || save.gold < cost) return;
    save.gold -= cost;
    owned.level++;
    Save.write();
    this.render();
    const flash = this.add
      .text(170, 360, 'Уровень повышен!', { fontFamily: FONT, fontSize: '30px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke('#000000', 7);
    this.tweens.add({ targets: flash, y: 300, alpha: 0, duration: 900, onComplete: () => flash.destroy() });
  }
}
