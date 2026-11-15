import Phaser from 'phaser';

/**
 * Картинка, заполняющая прямоугольник w×h с обрезкой лишнего (как CSS object-fit: cover).
 * alignY — какую часть по вертикали оставить при обрезке: 0 — верх, 0.5 — центр.
 */
export function coverImage(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  alignY = 0.5,
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, key);
  const scale = Math.max(w / img.width, h / img.height);
  const cw = w / scale;
  const ch = h / scale;
  img.setCrop((img.width - cw) / 2, (img.height - ch) * alignY, cw, ch);
  // Обрезка не сдвигает origin, поэтому смещаем картинку так, чтобы видимая часть встала в (x, y).
  img.setOrigin(0.5, 0.5).setScale(scale);
  img.y = y + (img.height / 2 - (img.height - ch) * alignY - ch / 2) * scale;
  return img;
}
