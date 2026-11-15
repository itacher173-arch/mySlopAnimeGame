import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { Save, TEAM_SIZE } from '../core/SaveManager';
import { CARDS } from '../data/cards';
import { collectionGrid } from '../ui/collection';
import { button, cardView, menuBackground, title } from '../ui/widgets';

const SLOT_W = 124;
const SLOT_H = 165;
const SLOT_Y = 250;
const GRID_Y = 500;

export class TeamScene extends Phaser.Scene {
  private selectedSlot = 0;
  private content!: Phaser.GameObjects.Container;

  constructor() {
    super('Team');
  }

  create(): void {
    this.selectedSlot = 0;
    menuBackground(this);
    title(this, 'Команда');
    button(this, 80, 60, 120, 64, 'Назад', () => this.scene.start('MainMenu'));
    this.add
      .text(GAME_W / 2, 455, 'Выбери слот, затем персонажа из коллекции', {
        fontFamily: FONT,
        fontSize: '22px',
        color: '#c9b8ff',
      })
      .setOrigin(0.5);
    this.content = this.add.container(0, 0);
    this.render();
  }

  private render(): void {
    this.tweens.killAll();
    this.content.removeAll(true);
    const save = Save.get();

    const startX = GAME_W / 2 - ((TEAM_SIZE - 1) * (SLOT_W + 12)) / 2;
    for (let i = 0; i < TEAM_SIZE; i++) {
      const x = startX + i * (SLOT_W + 12);
      const id = save.team[i];
      const slot = id
        ? cardView(this, x, SLOT_Y, SLOT_W, SLOT_H, CARDS[id], save.cards[id].level, save.cards[id].awakening)
        : this.add.container(x, SLOT_Y, [this.add.rectangle(0, 0, SLOT_W, SLOT_H, 0x000000, 0.4)]).setSize(SLOT_W, SLOT_H);
      slot.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        this.selectedSlot = i;
        this.render();
      });
      this.content.add(slot);
      if (i === this.selectedSlot) {
        const sel = this.add.rectangle(x, SLOT_Y, SLOT_W + 12, SLOT_H + 12).setStrokeStyle(5, 0xffe066);
        this.tweens.add({ targets: sel, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
        this.content.add(sel);
      }
      this.content.add(
        this.add
          .text(x, SLOT_Y + SLOT_H / 2 + 22, i === 0 ? 'Лидер' : `Слот ${i + 1}`, {
            fontFamily: FONT,
            fontSize: '20px',
            color: i === 0 ? '#ffe066' : '#ffffff',
          })
          .setOrigin(0.5),
      );
    }

    const grid = collectionGrid(this, {
      y: GRID_Y,
      onPick: (id) => this.assign(id),
      decorate: (view, id) => {
        const inTeam = save.team.indexOf(id);
        if (inTeam < 0) return;
        view.setAlpha(0.55);
        view.add(
          this.add
            .text(0, 0, inTeam === 0 ? 'Лидер' : `Слот ${inTeam + 1}`, { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
            .setOrigin(0.5)
            .setStroke('#000000', 6),
        );
      },
    });
    this.content.add(grid);
  }

  /** Ставит карту в выбранный слот; если она уже в команде — меняет слоты местами. */
  private assign(id: string): void {
    const save = Save.get();
    const from = save.team.indexOf(id);
    const to = this.selectedSlot;
    if (from === to) return;
    if (from >= 0 && to < save.team.length) {
      [save.team[from], save.team[to]] = [save.team[to], save.team[from]];
    } else if (from < 0) {
      // Пустой слот в неполной команде (старые сохранения) — без дыр в массиве.
      save.team[Math.min(to, save.team.length)] = id;
    }
    Save.write();
    this.render();
  }
}
