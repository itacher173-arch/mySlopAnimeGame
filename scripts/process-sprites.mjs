// Превращает сгенерированные боевые спрайты (JPG на однотонном хромакей-фоне) в обрезанные PNG с прозрачностью.
// Запуск: npm run sprites   (исходники: art/units/*.jpg → public/assets/units/*.png)
import fs from 'node:fs';
import path from 'node:path';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const SRC = 'art/units';
const OUT = 'public/assets/units';
const FLOOD_TOL = 120;
const GLOBAL_TOL = 70;
/** В бою спрайты не выше ~380px, держим запас под чёткость. */
const MAX_H = 512;

fs.mkdirSync(OUT, { recursive: true });

for (const file of fs.readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f))) {
  const { width: w, height: h, data: d } = jpeg.decode(fs.readFileSync(path.join(SRC, file)), { useTArray: true });

  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  const key = [0, 1, 2].map((ch) => corners.reduce((s, i) => s + d[i * 4 + ch], 0) / corners.length);
  const dist = (i) => {
    const r = d[i * 4] - key[0];
    const g = d[i * 4 + 1] - key[1];
    const b = d[i * 4 + 2] - key[2];
    return Math.sqrt(r * r + g * g + b * b);
  };

  // Заливка от краёв убирает фон вокруг персонажа; глобальный порог — замкнутые «дырки» фона (между рукой и телом).
  const removed = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (removed[i] || dist(i) > FLOOD_TOL) continue;
    removed[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < (h - 1) * w) stack.push(i + w);
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let i = 0; i < w * h; i++) {
    if (removed[i] || dist(i) < GLOBAL_TOL) {
      d[i * 4 + 3] = 0;
      continue;
    }
    const x = i % w;
    const y = (i - x) / w;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) {
    console.error(`${file}: весь кадр совпал с фоном, пропускаю`);
    continue;
  }

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const scale = Math.min(1, MAX_H / ch);
  const png = new PNG({ width: Math.round(cw * scale), height: Math.round(ch * scale) });
  // Усреднение блоком с предумноженной альфой, чтобы по краям не проступал цвет фона.
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const sx0 = minX + Math.floor(x / scale);
      const sy0 = minY + Math.floor(y / scale);
      const sx1 = Math.min(minX + Math.floor((x + 1) / scale), maxX + 1);
      const sy1 = Math.min(minY + Math.floor((y + 1) / scale), maxY + 1);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < Math.max(sy1, sy0 + 1); sy++) {
        for (let sx = sx0; sx < Math.max(sx1, sx0 + 1); sx++) {
          const i = (sy * w + sx) * 4;
          const al = d[i + 3];
          r += d[i] * al;
          g += d[i + 1] * al;
          b += d[i + 2] * al;
          a += al;
          n++;
        }
      }
      const o = (y * png.width + x) * 4;
      if (a > 0) {
        png.data[o] = r / a;
        png.data[o + 1] = g / a;
        png.data[o + 2] = b / a;
      }
      png.data[o + 3] = a / n;
    }
  }
  const name = file.replace(/\.jpe?g$/i, '.png');
  fs.writeFileSync(path.join(OUT, name), PNG.sync.write(png));
  const bg = key.map((v) => Math.round(v)).join(',');
  console.log(`${name}: ${png.width}x${png.height} (фон rgb ${bg})`);
}
