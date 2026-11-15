import Phaser from 'phaser';
import { FONT, GAME_W } from '../config';
import { putInTeam } from '../core/collection';
import { Save, TEAM_SIZE } from '../core/SaveManager';
import { CARDS, isSpirit } from '../data/cards';
import { ELEMENT_NAME } from '../data/elements';
import { cardView } from './widgets';

const W = 112;
const H = 150;
const GAP = 12;

/** Подпись над окном «Новый герой», когда герой не попал в команду автоматически. */
export function offerReason(id: string): string {
  const def = CARDS[id];
  const holder = Save.get().team.find((t) => CARDS[t]?.element === def.element);
  return holder
    ? `Место стихии «${ELEMENT_NAME[def.element]}» уже занято: ${CARDS[holder].name}`
    : `${def.name} ждёт в коллекции`;
}

/**
 * Ряд карт команды с центром в y: тап по карте ставит нового героя на её место (заменённый уходит в коллекцию).
 * Подсказка — над рядом. onPlaced вызывается один раз, после выбора ряд блокируется.
 */
export function teamOffer(scene: Phaser.Scene, id: string, y: number, onPlaced?: (replaced?: string) => void): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const caption = scene.add
    .text(GAME_W / 2, y - H / 2 - 34, '', { fontFamily: FONT, fontSize: '22px', color: '#ffe066', align: 'center' })
    .setOrigin(0.5)
    .setStroke('#000000', 5);
  root.add(caption);
  const row = scene.add.container(0, 0);
  root.add(row);

  const render = (placedAt: number) => {
    row.removeAll(true);
    const save = Save.get();
    const startX = GAME_W / 2 - ((TEAM_SIZE - 1) * (W + GAP)) / 2;
    for (let i = 0; i < TEAM_SIZE; i++) {
      const x = startX + i * (W + GAP);
      const tid = save.team[i];
      if (!tid) {
        row.add(scene.add.rectangle(x, y, W, H, 0x000000, 0.4).setStrokeStyle(2, 0xffffff, 0.3));
        continue;
      }
      const owned = save.cards[tid];
      const view = cardView(scene, x, y, W, H, CARDS[tid], owned.level, owned.awakening);
      row.add(view);
      if (placedAt === i) {
        row.add(scene.add.rectangle(x, y, W + 12, H + 12).setStrokeStyle(5, 0xffe066));
      } else if (placedAt < 0) {
        // Духов предлагаем заменить в первую очередь — подсвечиваем их.
        if (isSpirit(CARDS[tid])) row.add(scene.add.rectangle(x, y, W + 8, H + 8).setStrokeStyle(3, 0xffffff, 0.8));
        view.setInteractive({ useHandCursor: true }).once('pointerup', () => {
          const replaced = putInTeam(id, i);
          render(i);
          caption.setText(replaced ? `${CARDS[id].name} в команде вместо: ${CARDS[replaced].name}` : `${CARDS[id].name} в команде!`);
          onPlaced?.(replaced);
        });
      }
    }
  };
  caption.setText(`Нажми на карту — ${CARDS[id].name} займёт это место`);
  render(-1);
  return root;
}
