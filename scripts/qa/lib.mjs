// Общие помощники QA-скриптов: headless Chrome с мобильным viewport и тач-вводом в координатах игры (720×1280).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

export const BASE = process.env.QA_URL ?? 'http://localhost:5173';
export const KEY = 'spirit-stones-anime/save';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch() {
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
}

/** mobile — 390×844 @3 с тачем; desktop — 720×1280 мышью. */
export async function openPage(browser, { mobile = true, out = '/tmp/qa', log } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const page = await browser.newPage();
  if (mobile) await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  else await page.setViewport({ width: 720, height: 1280 });
  const issues = [];
  page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') issues.push(`console.${m.type()}: ${m.text()}`);
    if (log) log(m);
  });
  page.on('requestfailed', (r) => issues.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on('response', (r) => r.status() >= 400 && issues.push(`http ${r.status()}: ${r.url()}`));

  const api = {
    page,
    issues,
    mobile,
    async goto(query = '', save) {
      await page.goto(`${BASE}/`);
      await page.evaluate((k, json) => {
        localStorage.clear();
        if (json) localStorage.setItem(k, json);
      }, KEY, save ? JSON.stringify(save) : null);
      await page.goto(`${BASE}/${query}`);
      await page.waitForFunction(() => window.game?.scene.getScenes(true).some((s) => s.sys.settings.key !== 'Boot'), { timeout: 20000 });
      await sleep(600);
    },
    active: () => page.evaluate(() => window.game.scene.getScenes(true).map((s) => s.sys.settings.key).join(',')),
    save: () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY),
    scene: (key, fn, arg) => page.evaluate((k, f, a) => new Function('s', 'a', `return (${f})(s, a)`)(window.game.scene.getScene(k), a), key, fn.toString(), arg),
    async waitScene(key, timeout = 8000) {
      await page.waitForFunction((k) => window.game.scene.getScenes(true).some((s) => s.sys.settings.key === k), { timeout }, key);
      await sleep(300);
    },
    async toClient(x, y) {
      const r = await page.evaluate(() => {
        const b = document.querySelector('canvas').getBoundingClientRect();
        return { x: b.x, y: b.y, k: b.width / 720 };
      });
      return { x: r.x + x * r.k, y: r.y + y * r.k };
    },
    async tap(x, y, wait = 350) {
      const p = await api.toClient(x, y);
      if (mobile) {
        await page.touchscreen.touchStart(p.x, p.y);
        await sleep(40);
        await page.touchscreen.touchEnd();
      } else {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await sleep(40);
        await page.mouse.up();
      }
      await sleep(wait);
    },
    /** Протянуть палец по точкам игры (с промежуточными шагами). */
    async drag(points, { steps = 4, release = true } = {}) {
      const pts = [];
      for (const q of points) pts.push(await api.toClient(q.x, q.y));
      if (mobile) {
        await page.touchscreen.touchStart(pts[0].x, pts[0].y);
        let prev = pts[0];
        for (const p of pts.slice(1)) {
          for (let i = 1; i <= steps; i++) {
            await page.touchscreen.touchMove(prev.x + ((p.x - prev.x) * i) / steps, prev.y + ((p.y - prev.y) * i) / steps);
          }
          prev = p;
          await sleep(15);
        }
        if (release) await page.touchscreen.touchEnd();
      } else {
        await page.mouse.move(pts[0].x, pts[0].y);
        await page.mouse.down();
        for (const p of pts.slice(1)) {
          await page.mouse.move(p.x, p.y, { steps });
          await sleep(15);
        }
        if (release) await page.mouse.up();
      }
    },
    shot: (name) => page.screenshot({ path: `${out}/${name}.png` }),
  };
  return api;
}

export function cell(r, c) {
  return { x: 24 + c * 96 + 48, y: 684 + r * 96 + 48 };
}

/** Ищет в бою лучшую цепочку (как бот playtest.mjs). Возвращает клетки и врага-цель. */
export async function planMove(api, maxChain = 5) {
  return api.page.evaluate((maxChain) => {
    const s = window.game.scene.getScene('Battle');
    const grid = s.model.grid;
    const R = grid.length;
    const C = grid[0].length;
    const owned = new Set(s.team.map((u) => u.def.element));
    const foes = s.foes;
    const guarded = foes.find((f) => f.def.traits?.some((t) => t.kind === 'guarded'));
    const pool = guarded && foes.length > 1 ? foes.filter((f) => f !== guarded) : foes;
    const target = [...pool].sort((a, b) => a.hp - b.hp)[0];
    let best = null;
    const visit = (path, seen, e) => {
      const score = path.length * (owned.has(e) ? 1 : 0.1);
      if (path.length >= 3 && (!best || score > best.score)) best = { score, path: [...path] };
      if (path.length >= maxChain) return;
      const last = path[path.length - 1];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = last.r + dr;
          const c = last.c + dc;
          if ((dr || dc) && r >= 0 && r < R && c >= 0 && c < C && grid[r][c] === e && !seen.has(r * C + c)) {
            seen.add(r * C + c);
            path.push({ r, c });
            visit(path, seen, e);
            path.pop();
            seen.delete(r * C + c);
          }
        }
    };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) visit([{ r, c }], new Set([r * C + c]), grid[r][c]);
    if (!best) return null;
    return {
      cells: best.path,
      target: target && target !== s.target ? { x: target.x, y: target.y - target.h / 2 } : null,
    };
  }, maxChain);
}

/** Ждёт, пока бой не занят анимацией. */
export async function waitIdle(api, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const st = await api.scene('Battle', (s) => ({ busy: s.busy, outcome: s.outcome }));
    if (st.outcome || !st.busy) return st;
    await sleep(120);
  }
  throw new Error('battle stuck busy');
}

/** Один ход бота тачем. */
export async function botMove(api, maxChain = 5) {
  const plan = await planMove(api, maxChain);
  if (!plan) return false;
  if (plan.target) await api.tap(plan.target.x, plan.target.y, 150);
  await api.drag(plan.cells.map((p) => cell(p.r, p.c)));
  await sleep(250);
  await waitIdle(api);
  return true;
}

export function freshSave(over = {}) {
  return {
    version: 3,
    started: true,
    starter: 'naruto',
    gold: 500,
    crystals: 0,
    tickets: 0,
    cards: Object.fromEntries(
      ['naruto', 'spirit_fire', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'].map((id) => [id, { id, level: 1, awakening: 0 }]),
    ),
    team: ['naruto', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'],
    story: { stars: {}, chaptersClaimed: [], spiritStones: [] },
    pullsSinceNew: 0,
    ...over,
  };
}
