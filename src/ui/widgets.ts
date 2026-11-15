import Phaser from 'phaser';
import { FONT } from '../config';
import type { CardDef } from '../data/cards';
import { ELEMENT_COLOR } from '../data/elements';

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  color = 0x6b3fd1,
): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(4, 0xffffff, 0.9);
  const text = scene.add
    .text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(h * 0.38)}px`, color: '#ffffff' })
    .setOrigin(0.5)
    .setStroke('#000000', 5);
  const c = scene.add.container(x, y, [bg, text]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.95));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    onClick();
  });
  return c;
}

export function setButtonEnabled(btn: Phaser.GameObjects.Container, enabled: boolean): void {
  btn.setAlpha(enabled ? 1 : 0.45);
  if (enabled) btn.setInteractive({ useHandCursor: true });
  else btn.disableInteractive();
}

/** Карточка персонажа: портрет с обрезкой под размер, рамка цвета стихии, имя и уровень. */
export function cardView(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  def: CardDef,
  level?: number,
): Phaser.GameObjects.Container {
  const parts: Phaser.GameObjects.GameObject[] = [];
  const key = `card_${def.id}`;
  if (scene.textures.exists(key)) {
    const img = scene.add.image(0, 0, key);
    const scale = Math.max(w / img.width, h / img.height);
    const cw = w / scale;
    const ch = h / scale;
    img.setCrop((img.width - cw) / 2, (img.height - ch) / 2, cw, ch).setScale(scale);
    parts.push(img);
  } else {
    parts.push(scene.add.rectangle(0, 0, w, h, ELEMENT_COLOR[def.element], 0.6));
  }

  const font = Math.max(14, Math.round(w / 8));
  parts.push(
    scene.add.rectangle(0, 0, w, h).setStrokeStyle(Math.max(3, w / 40), ELEMENT_COLOR[def.element]),
    scene.add.image(-w / 2 + font, -h / 2 + font, `stone_${def.element}`).setScale(font / 40),
    scene.add.rectangle(0, h / 2 - font * 0.8, w - 4, font * 1.6, 0x000000, 0.65),
    scene.add
      .text(0, h / 2 - font * 0.8, def.name, { fontFamily: FONT, fontSize: `${font}px`, color: '#ffffff' })
      .setOrigin(0.5),
  );
  if (level !== undefined) {
    parts.push(
      scene.add
        .text(w / 2 - 6, -h / 2 + 4, `Ур.${level}`, { fontFamily: FONT, fontSize: `${font}px`, color: '#ffe066' })
        .setOrigin(1, 0)
        .setStroke('#000000', 5),
    );
  }
  return scene.add.container(x, y, parts).setSize(w, h);
}

export function title(scene: Phaser.Scene, text: string): void {
  scene.add
    .text(360, 60, text, { fontFamily: FONT, fontSize: '44px', color: '#ffffff' })
    .setOrigin(0.5)
    .setStroke('#000000', 8);
}

export function goldLabel(scene: Phaser.Scene, gold: number): Phaser.GameObjects.Text {
  return scene.add
    .text(700, 20, `Золото: ${gold}`, { fontFamily: FONT, fontSize: '28px', color: '#ffe066' })
    .setOrigin(1, 0)
    .setStroke('#000000', 6);
}

export function menuBackground(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x2a1745, 0x2a1745, 0x0d0b1a, 0x0d0b1a, 1);
  g.fillRect(0, 0, 720, 1280);
}
