import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { chooseStarter } from '../core/collection';
import { cardStats } from '../core/progression';
import { CARDS, STARTERS, starterTeam } from '../data/cards';
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_NAME, elementMultiplier } from '../data/elements';
import { button, cardView, hex, menuBackground, setButtonEnabled } from '../ui/widgets';

const CARD_W = 200;
const CARD_H = 280;
const CARD_Y = 420;

/** Выбор первого героя после пролога: один из трёх, остальные стихии закроют духи. */
export class StarterSelectScene extends Phaser.Scene {
  private selected: string | null = null;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super('StarterSelect');
  }

  create(): void {
    this.selected = null;
    menuBackground(this);
    this.add
      .text(GAME_W / 2, 60, 'Выбери первого героя', { fontFamily: FONT, fontSize: '42px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke('#000000', 8);
    this.add
      .text(GAME_W / 2, 140, 'Аква: «Силы хватит только на одного. Выбирай с умом!\nОстальные стихии пока закроют мои духи»', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#8fd3ff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setStroke('#000000', 5);
    this.content = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.tweens.killAll();
    this.content.removeAll(true);
    const gap = CARD_W + 35;

    STARTERS.forEach((id, i) => {
      const def = CARDS[id];
      const x = GAME_W / 2 + (i - 1) * gap;
      const chosen = this.selected === id;
      if (chosen) {
        const ring = this.add.rectangle(x, CARD_Y, CARD_W + 18, CARD_H + 18).setStrokeStyle(7, 0xffe066);
        this.tweens.add({ targets: ring, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
        this.content.add(ring);
      }
      const view = cardView(this, x, CARD_Y, CARD_W, CARD_H, def, 1);
      view.setAlpha(this.selected && !chosen ? 0.6 : 1).setScale(chosen ? 1.04 : 1);
      view.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selected = id;
        this.render();
      });
      this.content.add(view);

      const stats = cardStats(def, 1);
      const strong = ELEMENTS.find((e) => elementMultiplier(def.element, e) > 1)!;
      const info = [
        { t: def.anime, c: '#c9b8ff', s: 18 },
        { t: ELEMENT_NAME[def.element], c: hex(ELEMENT_COLOR[def.element]), s: 26 },
        { t: `Атака ${stats.atk}`, c: '#ffffff', s: 22 },
        { t: `HP ${stats.hp}`, c: '#ffffff', s: 22 },
        { t: `Силён против:\n${ELEMENT_NAME[strong]}`, c: hex(ELEMENT_COLOR[strong]), s: 19 },
      ];
      let y = CARD_Y + CARD_H / 2 + 26;
      for (const line of info) {
        this.content.add(
          this.add
            .text(x, y, line.t, { fontFamily: FONT, fontSize: `${line.s}px`, color: line.c, align: 'center' })
            .setOrigin(0.5, 0)
            .setStroke('#000000', 5),
        );
        y += line.t.includes('\n') ? line.s * 2.4 : line.s + 14;
      }
    });

    this.content.add(
      this.add
        .text(GAME_W / 2, 880, 'Твоя команда', { fontFamily: FONT, fontSize: '24px', color: '#ffe066' })
        .setOrigin(0.5)
        .setStroke('#000000', 5),
    );
    const team = this.selected ? starterTeam(this.selected) : [];
    for (let i = 0; i < 5; i++) {
      const x = GAME_W / 2 + (i - 2) * 128;
      const id = team[i];
      this.content.add(
        id
          ? cardView(this, x, 1000, 116, 155, CARDS[id], 1)
          : this.add.rectangle(x, 1000, 116, 155, 0x000000, 0.4).setStrokeStyle(2, 0xffffff, 0.3),
      );
    }

    const label = this.selected ? `Призвать: ${CARDS[this.selected].name}` : 'Выбери героя';
    const confirm = button(this, GAME_W / 2, 1180, 440, 100, label, () => this.confirm(), 0xd8323c);
    setButtonEnabled(confirm, !!this.selected);
    this.content.add(confirm);
  }

  private confirm(): void {
    if (!this.selected) return;
    chooseStarter(this.selected);
    this.scene.start('MainMenu');
  }
}
