import Phaser from 'phaser';
import { FONT } from '../config';

/** Иконки валют и меток рисуются при загрузке: эмодзи на разных устройствах выглядят по-разному или не отображаются. */
export type IconKey = 'icon_gold' | 'icon_crystal' | 'icon_ticket' | 'icon_lock' | 'icon_skull';

const S = 64;

export function makeIconTextures(scene: Phaser.Scene): void {
  const make = (key: IconKey, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };
  const h = S / 2;

  make('icon_gold', S, S, (g) => {
    g.fillStyle(0x7a4a00, 1).fillCircle(h, h, h - 1);
    g.fillStyle(0xe0a419, 1).fillCircle(h, h - 1, h - 5);
    g.fillStyle(0xffd34d, 1).fillCircle(h, h - 2, h - 11);
    g.lineStyle(4, 0xb9780c, 1).strokeCircle(h, h - 2, h - 15);
    g.fillStyle(0xfff3b0, 0.8).fillEllipse(h - 9, h - 13, 18, 9);
  });

  make('icon_crystal', S, S, (g) => {
    const top = 10;
    const mid = 26;
    const bottom = S - 4;
    g.fillStyle(0x0b4f7a, 1).fillPoints(
      [
        { x: 14, y: top - 2 },
        { x: S - 14, y: top - 2 },
        { x: S - 1, y: mid },
        { x: h, y: bottom + 2 },
        { x: 1, y: mid },
      ],
      true,
    );
    g.fillStyle(0x4fd8ff, 1).fillPoints(
      [
        { x: 16, y: top },
        { x: S - 16, y: top },
        { x: S - 5, y: mid },
        { x: h, y: bottom - 2 },
        { x: 5, y: mid },
      ],
      true,
    );
    g.fillStyle(0xbff4ff, 1).fillTriangle(16, top, h, mid, 5, mid);
    g.fillStyle(0x9eeaff, 1).fillTriangle(16, top, S - 16, top, h, mid);
    g.fillStyle(0x1fa6e0, 1).fillTriangle(S - 16, top, S - 5, mid, h, mid);
    g.fillStyle(0x2bb8ef, 1).fillTriangle(5, mid, h, mid, h, bottom - 2);
    g.fillStyle(0x128cc4, 1).fillTriangle(h, mid, S - 5, mid, h, bottom - 2);
  });

  make('icon_ticket', S, 44, (g) => {
    const w = S;
    const th = 44;
    const notch = 8;
    const body = (inset: number) => {
      const pts: { x: number; y: number }[] = [];
      const x0 = inset;
      const x1 = w - inset;
      const y0 = inset;
      const y1 = th - inset;
      pts.push({ x: x0, y: y0 }, { x: x1, y: y0 });
      for (let a = -90; a <= 90; a += 15) {
        const r = Phaser.Math.DegToRad(a);
        pts.push({ x: x1 - Math.cos(r) * (notch - inset), y: th / 2 + Math.sin(r) * (notch - inset) });
      }
      pts.push({ x: x1, y: y1 }, { x: x0, y: y1 });
      for (let a = 90; a >= -90; a -= 15) {
        const r = Phaser.Math.DegToRad(a);
        pts.push({ x: x0 + Math.cos(r) * (notch - inset), y: th / 2 + Math.sin(r) * (notch - inset) });
      }
      return pts;
    };
    g.fillStyle(0x7a1d3a, 1).fillPoints(body(0), true);
    g.fillStyle(0xff6f91, 1).fillPoints(body(3), true);
    g.fillStyle(0xffffff, 0.25).fillRect(6, 6, w - 12, 8);
    g.fillStyle(0x7a1d3a, 0.7);
    for (let y = 8; y < th - 6; y += 7) g.fillRect(44, y, 3, 4);
    const star: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? 11 : 4.5;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      star.push({ x: 25 + Math.cos(a) * rad, y: th / 2 + 1 + Math.sin(a) * rad });
    }
    g.fillStyle(0xfff1a8, 1).fillPoints(star, true);
  });

  make('icon_lock', S, S, (g) => {
    g.lineStyle(9, 0x3a3550, 1).beginPath().arc(h, 28, 14, Math.PI, 0).strokePath();
    g.lineStyle(5, 0xd6d0e6, 1).beginPath().arc(h, 28, 14, Math.PI, 0).strokePath();
    g.lineStyle(9, 0x3a3550, 1).lineBetween(h - 14, 28, h - 14, 34).lineBetween(h + 14, 28, h + 14, 34);
    g.lineStyle(5, 0xd6d0e6, 1).lineBetween(h - 14, 28, h - 14, 34).lineBetween(h + 14, 28, h + 14, 34);
    g.fillStyle(0x3a3550, 1).fillRoundedRect(10, 30, S - 20, 30, 6);
    g.fillStyle(0xf2c531, 1).fillRoundedRect(13, 33, S - 26, 24, 5);
    g.fillStyle(0x6b4a00, 1).fillCircle(h, 42, 4).fillRect(h - 2, 42, 4, 9);
  });

  make('icon_skull', S, S, (g) => {
    g.fillStyle(0x000000, 0.6).fillCircle(h, 27, 23).fillRoundedRect(h - 15, 36, 30, 22, 6);
    g.fillStyle(0xf4efe6, 1).fillCircle(h, 27, 20).fillRoundedRect(h - 12, 36, 24, 19, 5);
    g.fillStyle(0x1b1030, 1).fillCircle(h - 8, 27, 6).fillCircle(h + 8, 27, 6);
    g.fillTriangle(h, 33, h - 3, 40, h + 3, 40);
    g.fillRect(h - 6, 46, 3, 8).fillRect(h + 3, 46, 3, 8);
  });
}

type Part = string | { icon: IconKey; size?: number };

/**
 * Строка из текста и иконок в контейнере. originX как у текста: 0 — левый край в x, 0.5 — центр, 1 — правый край.
 * Иконка по умолчанию — под высоту шрифта.
 */
export function iconText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  parts: Part[],
  style: { size: number; color: string; stroke?: number },
  originX = 0.5,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  let cx = 0;
  const gap = Math.round(style.size * 0.2);
  for (const p of parts) {
    if (typeof p === 'string') {
      if (!p) continue;
      const t = scene.add
        .text(cx, 0, p, { fontFamily: FONT, fontSize: `${style.size}px`, color: style.color })
        .setOrigin(0, 0.5)
        .setStroke('#000000', style.stroke ?? Math.max(3, Math.round(style.size / 5)));
      c.add(t);
      cx += t.width;
    } else {
      const img = scene.add.image(0, 0, p.icon).setOrigin(0, 0.5);
      img.setScale((p.size ?? style.size * 1.15) / img.height);
      img.x = cx + gap / 2;
      c.add(img);
      cx += img.displayWidth + gap;
    }
  }
  for (const o of c.list as (Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject)[]) o.x -= cx * originX;
  c.setSize(cx, style.size * 1.3);
  return c;
}
