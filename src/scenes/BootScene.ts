import Phaser from 'phaser';
import { FONT, GAME_H, GAME_W } from '../config';
import { CARDS } from '../data/cards';
import { ELEMENTS, ELEMENT_COLOR, type Element } from '../data/elements';
import { ENEMIES } from '../data/enemies';

export const STONE_SIZE = 88;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const label = this.add
      .text(GAME_W / 2, GAME_H / 2, 'Загрузка...', { fontFamily: FONT, fontSize: '36px', color: '#ffffff' })
      .setOrigin(0.5);
    this.load.on('progress', (v: number) => label.setText(`Загрузка... ${Math.round(v * 100)}%`));
    // Картинки необязательны: если файла нет, сцена боя нарисует заглушку.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.info(`[assets] нет файла ${file.src}, будет заглушка`));

    for (const card of Object.values(CARDS)) this.load.image(`card_${card.id}`, `assets/cards/${card.id}.jpg`);
    for (const enemy of Object.values(ENEMIES)) this.load.image(`enemy_${enemy.id}`, `assets/enemies/${enemy.id}.jpg`);
  }

  create(): void {
    for (const e of ELEMENTS) this.makeStoneTexture(e);
    this.scene.start('Battle');
  }

  private makeStoneTexture(e: Element): void {
    const s = STONE_SIZE;
    const h = s / 2;
    const color = ELEMENT_COLOR[e];
    const dark = Phaser.Display.Color.IntegerToColor(color).darken(30).color;
    const g = this.add.graphics();

    g.fillStyle(dark, 1).fillCircle(h, h, h - 2);
    g.fillStyle(color, 1).fillCircle(h, h - 3, h - 7);
    g.fillStyle(0xffffff, 0.25).fillEllipse(h - 10, h - 18, 38, 18);

    g.fillStyle(0xffffff, 0.9);
    switch (e) {
      case 'fire':
        g.fillTriangle(h, h - 22, h - 15, h + 16, h + 15, h + 16);
        break;
      case 'water':
        g.fillCircle(h, h + 6, 12);
        g.fillTriangle(h, h - 20, h - 11, h + 1, h + 11, h + 1);
        break;
      case 'earth':
        g.fillPoints(
          [
            { x: h, y: h - 20 },
            { x: h + 15, y: h - 2 },
            { x: h, y: h + 16 },
            { x: h - 15, y: h - 2 },
          ],
          true,
        );
        break;
      case 'light': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? 20 : 8;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push({ x: h + Math.cos(a) * rad, y: h - 2 + Math.sin(a) * rad });
        }
        g.fillPoints(pts, true);
        break;
      }
      case 'dark':
        g.fillCircle(h, h - 2, 17);
        g.fillStyle(color, 1).fillCircle(h + 8, h - 8, 14);
        break;
    }

    g.generateTexture(`stone_${e}`, s, s);
    g.destroy();
  }
}
