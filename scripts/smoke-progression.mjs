// Смоук-тест прогрессии: новая игра → пролог → выбор стартера → меню → 1-1 (билет) → призыв по билету
// → автозамена духа в команде → 1-2 (Аква присоединяется) → коллекция и прокачка → подтверждение «Новой игры».
// Запуск (dev-сервер должен работать): node scripts/smoke-progression.mjs [папка для скриншотов]
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? '/tmp/ss/prog';
const base = 'http://localhost:5173';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 720, height: 1280 });
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const active = () => page.evaluate(() => window.game.scene.getScenes(true).map((s) => s.sys.settings.key).join(','));
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('spirit-stones-anime/save') ?? 'null'));
const tap = async (x, y, wait = 400) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(50);
  await page.mouse.up();
  await sleep(wait);
};
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const check = (label, ok) => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`);
const forceWin = () =>
  page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.waveIndex = s.waves.length - 1;
    s.moves = 5;
    s.finish(true);
  });
const playStage = async (nodeX, nodeY) => {
  await tap(nodeX, nodeY, 900);
  await tap(600, 150, 1200);
  await forceWin();
  await sleep(1600);
};

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.game?.scene.getScenes(true).length > 0);
await sleep(2500);
check('новая игра открывает пролог', (await active()) === 'Dialogue');
await shot('01_prologue');

await tap(600, 150, 800);
check('после пролога — выбор стартера', (await active()) === 'StarterSelect');
await shot('02_starter_empty');
await tap(125, 420);
await shot('03_starter_naruto');
await tap(360, 1180, 800);
let s = await save();
check('меню после выбора', (await active()) === 'MainMenu');
check(`команда = стартер + 4 духа: ${s.team}`, s.team.join() === 'naruto,spirit_water,spirit_earth,spirit_light,spirit_dark');
check('кристаллы 0, билеты 0', s.crystals === 0 && s.tickets === 0);
await shot('04_menu');

await tap(245, 1000, 700);
await playStage(330, 960);
await shot('05_win_1-1');
s = await save();
check(`после 1-1: билет 1, кристаллы 10 (${s.tickets}, ${s.crystals})`, s.tickets === 1 && s.crystals === 10);
await tap(360, 880, 1200);
for (let i = 0; i < 4; i++) await tap(360, 600);
await sleep(3000);
await shot('06_post_1-1_ticket');
await tap(600, 150, 800);
await tap(80, 40, 700);
check('назад в меню', (await active()) === 'MainMenu');

await tap(592, 1000, 900);
check('экран призыва', (await active()) === 'Summon');
await shot('07_summon');
await tap(545, 590, 600);
await shot('08_summon_reveal_mid');
await sleep(3500);
await shot('09_summon_reveal');
s = await save();
const got = Object.keys(s.cards).filter((id) => !id.startsWith('spirit_') && id !== 'naruto');
check(`призыв дал героя: ${got}`, got.length === 1 && s.tickets === 0);
await tap(360, 640, 600);
await tap(80, 60, 600);

await tap(360, 1140, 800);
check('экран команды', (await active()) === 'Team');
s = await save();
console.log('команда после призыва:', s.team.join());
await shot('10_team_after_summon');
await tap(80, 60, 600);

await tap(245, 1000, 700);
await playStage(375, 790);
await sleep(800);
await shot('11_new_hero_aqua');
s = await save();
check(`Аква в коллекции`, !!s.cards.aqua);
console.log('команда после 1-2:', s.team.join());
await tap(360, 640, 600);
await shot('12_win_1-2');
await tap(360, 880, 1000);
await tap(600, 150, 800);
await tap(80, 40, 700);

await tap(592, 1140, 800);
check('экран прокачки', (await active()) === 'Upgrade');
await shot('13_upgrade');
await tap(80, 60, 600);

await tap(100, 44, 500);
await shot('14_new_game_confirm');
await tap(360, 820, 600);
check('отмена новой игры', (await active()) === 'MainMenu' && !!(await save()).starter);

// Логика призыва напрямую (тот же модуль, что у игры, через dev-сервер Vite): гарантия и пробуждения.
// После HMR Vite отдаёт модули с ?t=..., поэтому импортируем ровно те URL, что загрузила игра.
const pity = await page.evaluate(async () => {
  const loaded = performance.getEntriesByType('resource').map((e) => e.name);
  const mod = (path) => import(loaded.find((n) => new URL(n).pathname === path) ?? path);
  const { Save } = await mod('/src/core/SaveManager.ts');
  const { chooseStarter } = await mod('/src/core/collection.ts');
  const { pull, rarityRates, summonPool } = await mod('/src/core/summon.ts');
  Save.reset();
  chooseStarter('rem');
  Save.get().crystals = 100000;
  const pool = summonPool().map((d) => d.id);
  const rates = rarityRates().map((r) => `★${r.rarity}:${Math.round(r.chance * 100)}%`);
  const seq = [];
  for (let i = 0; i < 40; i++) {
    const r = pull('crystals');
    seq.push(r.acquire.kind === 'new' ? `NEW:${r.def.id}` : r.acquire.kind);
  }
  const s = Save.get();
  Save.reset();
  return { pool, rates, seq, awakenings: Object.values(s.cards).map((c) => `${c.id}:${c.awakening}`), gold: s.gold };
});
console.log('пул:', pity.pool.join(), '| шансы:', pity.rates.join(' '));
console.log('40 призывов:', pity.seq.join(' '));
console.log('пробуждения:', pity.awakenings.join(' '), '| золото:', pity.gold);
let since = 0;
let pityOk = true;
let firsts = 0;
for (const k of pity.seq) {
  if (k.startsWith('NEW')) (since = 0), firsts++;
  else if (firsts < pity.pool.length && ++since >= 5) pityOk = false;
}
check('гарантия: не больше 4 повторов подряд, пока есть новые', pityOk && firsts === pity.pool.length);
check('стартер Рем не в пуле', !pity.pool.includes('rem'));
// close() иногда зависает в headless Chrome — не ждём дольше пары секунд.
await Promise.race([browser.close(), sleep(3000)]);
process.exit(0);
