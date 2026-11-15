// Автоигра этапа сюжета в headless Chrome: бот ищет длинные цепочки и проводит их мышью.
// Запуск (dev-сервер должен работать): node scripts/playtest.mjs 1-5 [--max=4] [--team=naruto,spirit_water,...] [--level=1]
//   [--shots=/tmp/ss] [--url=http://localhost:5173]
// --team подменяет сохранение: только эти карты, все на уровне --level.
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const opt = (name, def) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? def;
const stages = args.filter((a) => !a.startsWith('--'));
const base = opt('url', 'http://localhost:5173');
const shots = opt('shots', '');
const chrome = opt('chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
const MAX_MOVES = 80;
const team = opt('team', '');
const level = Number(opt('level', '1'));
// --max=4 — ограничить длину цепочки, чтобы бот играл как обычный игрок, а не идеальный.
const maxChain = Number(opt('max', '9'));

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--window-size=720,1280'] });
try {
  for (const stage of stages.length ? stages : ['1-1']) console.log(JSON.stringify(await play(stage)));
} finally {
  await browser.close();
}

async function play(stageId) {
  const page = await browser.newPage();
  await page.setViewport({ width: 720, height: 1280 });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  if (team) {
    const ids = team.split(',');
    const save = {
      version: 3,
      started: true,
      starter: ids[0],
      gold: 0,
      crystals: 0,
      tickets: 0,
      cards: Object.fromEntries(ids.map((id) => [id, { id, level, awakening: 0 }])),
      team: ids,
      story: { stars: {}, chaptersClaimed: [], spiritStones: [] },
      pullsSinceNew: 0,
    };
    await page.evaluateOnNewDocument((json) => localStorage.setItem('spirit-stones-anime/save', json), JSON.stringify(save));
  }
  await page.goto(`${base}/?scene=Battle&stage=${stageId}`);
  await page.waitForFunction(() => window.game?.scene.getScene('Battle')?.model, { timeout: 15000 });
  await sleep(800);

  let moves = 0;
  let shotWave = -1;
  while (moves < MAX_MOVES) {
    const state = await page.evaluate(() => {
      const s = window.game.scene.getScene('Battle');
      return { busy: s.busy, outcome: s.outcome, wave: s.waveIndex };
    });
    if (state.outcome) break;
    if (state.busy) {
      await sleep(150);
      continue;
    }
    if (shots && state.wave !== shotWave) {
      shotWave = state.wave;
      await page.screenshot({ path: `${shots}/play_${stageId}_wave${state.wave + 1}.png` });
    }
    const plan = await page.evaluate(planMove, maxChain);
    if (!plan) break;
    if (plan.target) await tap(page, plan.target.x, plan.target.y);
    await drag(page, plan.path);
    moves++;
    await sleep(300);
  }
  await sleep(1500);
  if (shots) await page.screenshot({ path: `${shots}/play_${stageId}_result.png` });
  const result = await page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    return { outcome: s.outcome, moves: s.moves, teamHp: s.teamHp, teamMaxHp: s.teamMaxHp, wave: s.waveIndex + 1 };
  });
  await page.close();
  return { stage: stageId, ...result };
}

/** Выполняется в странице: самая выгодная цепочка + кого выбрать целью. */
function planMove(maxChain) {
  const s = window.game.scene.getScene('Battle');
  const grid = s.model.grid;
  const R = grid.length;
  const C = grid[0].length;
  const beats = { fire: 'earth', earth: 'water', water: 'fire', light: 'dark', dark: 'light' };
  const foes = s.foes;
  // Цель: если есть босс со щитом свиты — сначала добиваем свиту, иначе самого слабого.
  const guarded = foes.find((f) => f.def.traits?.some((t) => t.kind === 'guarded'));
  const pool = guarded && foes.length > 1 ? foes.filter((f) => f !== guarded) : foes;
  const target = [...pool].sort((a, b) => a.hp - b.hp)[0];

  let best = null;
  const visit = (path, seen, e) => {
    const score = path.length * (beats[e] === target?.def.element ? 1.5 : beats[target?.def.element] === e ? 0.75 : 1);
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
  const { BOARD_X, BOARD_Y, CELL } = { BOARD_X: 24, BOARD_Y: 684, CELL: 96 };
  return {
    target: target && target !== s.target ? { x: target.x, y: target.y - target.h / 2 } : null,
    path: best.path.map((p) => ({ x: BOARD_X + p.c * CELL + CELL / 2, y: BOARD_Y + p.r * CELL + CELL / 2 })),
  };
}

async function toClient(page, x, y) {
  const rect = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.x, y: r.y, k: r.width / 720 };
  });
  return { x: rect.x + x * rect.k, y: rect.y + y * rect.k };
}

async function tap(page, x, y) {
  const p = await toClient(page, x, y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(100);
}

async function drag(page, path) {
  const pts = [];
  for (const q of path) pts.push(await toClient(page, q.x, q.y));
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) {
    await page.mouse.move(p.x, p.y, { steps: 4 });
    await sleep(20);
  }
  await page.mouse.up();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
