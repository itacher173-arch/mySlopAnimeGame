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

    for (const card of Object.values(CARDS)) {
      this.load.image(`card_${card.id}`, `assets/cards/${card.id}.jpg`);
      this.load.image(`raw_unit_${card.id}`, `assets/units/${card.id}.jpg`);
    }
    for (const enemy of Object.values(ENEMIES)) {
      this.load.image(`enemy_${enemy.id}`, `assets/enemies/${enemy.id}.jpg`);
      this.load.image(`raw_unit_${enemy.id}`, `assets/units/${enemy.id}.jpg`);
    }
  }

  create(): void {
    for (const e of ELEMENTS) this.makeStoneTexture(e);
    this.makeSparkTexture();
    for (const id of [...Object.keys(CARDS), ...Object.keys(ENEMIES)]) {
      if (this.textures.exists(`raw_unit_${id}`)) this.makeUnitTexture(`raw_unit_${id}`, `unit_${id}`);
    }
    this.scene.start('MainMenu');
  }

  /**
   * Боевые спрайты сгенерированы на однотонном фоне (хромакей). Убираем фон заливкой от краёв
   * плюс глобально удаляем почти точные совпадения цвета (дырки между рукой и телом и т.п.),
   * затем обрезаем пустые поля, чтобы низ текстуры совпадал со ступнями.
   */
  private makeUnitTexture(srcKey: string, dstKey: string): void {
    const src = this.textures.get(srcKey).getSourceImage() as HTMLImageElement;
    const w = src.width;
    const h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;

    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    const key = [0, 1, 2].map((ch) => corners.reduce((s, i) => s + d[i * 4 + ch], 0) / corners.length);
    const dist = (i: number) => Math.hypot(d[i * 4] - key[0], d[i * 4 + 1] - key[1], d[i * 4 + 2] - key[2]);

    const FLOOD_TOL = 120;
    const GLOBAL_TOL = 70;
    const removed = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const i = stack.pop()!;
      if (removed[i] || dist(i) > FLOOD_TOL) continue;
      removed[i] = 1;
      const x = i % w;
      if (x > 0) stack.push(i - 1);
      if (x < w - 1) stack.push(i + 1);
      if (i >= w) stack.push(i - w);
      if (i < (h - 1) * w) stack.push(i + w);
    }
    for (let i = 0; i < w * h; i++) {
      if (removed[i] || dist(i) < GLOBAL_TOL) d[i * 4 + 3] = 0;
    }

    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    ctx.putImageData(img, 0, 0);

    const out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    this.textures.addCanvas(dstKey, out);
    this.textures.remove(srcKey);
  }

  private makeSparkTexture(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 0.35).fillCircle(16, 16, 16);
    g.fillStyle(0xffffff, 1).fillCircle(16, 16, 8);
    g.generateTexture('spark', 32, 32);
    g.destroy();
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
