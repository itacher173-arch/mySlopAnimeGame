import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { Save } from '../core/SaveManager';
import { CARDS, HERO_IDS, SPIRIT_IDS, unlockHint } from '../data/cards';
import { cardView, lockedCardView } from './widgets';

export interface CollectionOptions {
  y: number;
  cols?: number;
  w?: number;
  h?: number;
  onPick: (id: string) => void;
  /** Дорисовать что-то поверх карты (метка «в команде», рамка выбора). */
  decorate?: (view: Phaser.GameObjects.Container, id: string) => void;
}

/** Коллекция: герои (закрытые — силуэтами с подсказкой), ниже отдельный ряд «Духи». */
export function collectionGrid(scene: Phaser.Scene, opt: CollectionOptions): Phaser.GameObjects.Container {
  const cols = opt.cols ?? 5;
  const w = opt.w ?? 124;
  const h = opt.h ?? 165;
  const gapX = 12;
  const gapY = 16;
  const save = Save.get();
  const root = scene.add.container(0, 0);
  const startX = GAME_W / 2 - ((cols - 1) * (w + gapX)) / 2;

  const section = (label: string, y: number) =>
    root.add(
      scene.add.text(24, y, label, { fontFamily: FONT, fontSize: '22px', color: '#c9b8ff' }).setStroke('#000000', 5),
    );

  const grid = (ids: string[], top: number): number => {
    ids.forEach((id, i) => {
      const x = startX + (i % cols) * (w + gapX);
      const y = top + Math.floor(i / cols) * (h + gapY) + h / 2;
      const owned = save.cards[id];
      if (!owned) {
        root.add(lockedCardView(scene, x, y, w, h, CARDS[id], unlockHint(CARDS[id])));
        return;
      }
      const view = cardView(scene, x, y, w, h, CARDS[id], owned.level, owned.awakening);
      opt.decorate?.(view, id);
      view.setInteractive({ useHandCursor: true }).on('pointerup', () => opt.onPick(id));
      root.add(view);
    });
    return top + Math.ceil(ids.length / cols) * (h + gapY);
  };

  // Открытые герои — первыми, чтобы закрытые не разрывали ряд.
  const heroes = [...HERO_IDS].sort((a, b) => Number(!save.cards[a]) - Number(!save.cards[b]));
  section('Герои', opt.y);
  const after = grid(heroes, opt.y + 32);
  section('Духи', after + 4);
  grid(SPIRIT_IDS, after + 36);
  return root;
}
