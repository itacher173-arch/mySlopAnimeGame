// Проверки устойчивости и краевых случаев: node scripts/qa/robust.mjs [out]
// Ввод (откат цепочки, диагонали, отпускание за канвасом, тапы во время анимации, мультитач), пауза, поражение,
// повторные рестарты (утечки), быстрый бой, миграция сохранений, «Новая игра», перезагрузка, призыв, команда, прокачка.
import { cell, freshSave, launch, openPage, sleep, waitIdle, KEY } from './lib.mjs';

const out = process.argv[2] ?? 'qa-shots/robust';
const browser = await launch();
const api = await openPage(browser, { out });
const { page } = api;
let fails = 0;
const check = (label, ok, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
};
const E = { F: 'fire', W: 'water', E: 'earth', L: 'light', D: 'dark' };
// Поле без случайных цепочек, кроме нужных тесту.
const BOARD = ['FFFLDWE', 'WEDWLFD', 'LWDEFLW', 'DLFWEDL', 'EDWLFEW', 'FWLDWLE'];
const setGrid = (rows) =>
  page.evaluate(
    (rows, E) => {
      const s = window.game.scene.getScene('Battle');
      s.model.grid = rows.map((r) => [...r].map((ch) => E[ch]));
      s.stones.flat().forEach((st) => st?.destroy());
      s.buildStones();
    },
    rows,
    E,
  );
const battle = (fn, arg) => api.scene('Battle', fn, arg);
const chainLen = () => battle((s) => s.chain.length);

let cdp;
async function touchRaw(type, points) {
  cdp ??= await page.createCDPSession();
  const pts = [];
  for (const p of points) {
    const c = await api.toClient(p.x, p.y);
    pts.push({ x: c.x, y: c.y, id: p.id });
  }
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
}

try {
  // ---------- ввод ----------
  await api.goto('?scene=Battle&stage=1-3', freshSave());
  await setGrid(BOARD);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 1)], { release: false });
  check('откат цепочки пальцем назад', (await chainLen()) === 2, `длина ${await chainLen()}`);
  await page.touchscreen.touchEnd();
  await sleep(300);
  check('цепочка из 2 не тратит ход', (await battle((s) => s.moves)) === 0);

  await setGrid(['WFFLDWE', 'DWEFLFD', 'LDWEFLW', ...BOARD.slice(3)]);
  await api.drag([cell(0, 0), cell(1, 1), cell(2, 2)], { release: false });
  check('диагональная цепочка', (await chainLen()) === 3, `длина ${await chainLen()}`);
  await page.touchscreen.touchEnd();
  await sleep(200);
  check('диагональ засчитана как ход', (await battle((s) => s.moves)) === 1);
  await waitIdle(api);

  // Чужой цвет и прыжок через клетку не добавляются
  await setGrid(BOARD);
  await api.drag([cell(0, 0), cell(0, 1), cell(1, 1), cell(0, 3)], { release: false });
  check('чужой цвет/несмежная клетка игнорируются', (await chainLen()) === 2);
  await page.touchscreen.touchEnd();
  await sleep(200);

  // Отпускание за пределами канваса (в чёрной полосе снизу)
  await setGrid(BOARD);
  const m0 = await battle((s) => s.moves);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2)], { release: false });
  await page.touchscreen.touchMove(195, 840);
  await page.touchscreen.touchEnd();
  await sleep(300);
  const after = await battle((s) => ({ moves: s.moves, chain: s.chain.length, el: s.chainElement }));
  check('отпускание за канвасом завершает цепочку', after.moves === m0 + 1 && after.chain === 0 && !after.el, JSON.stringify(after));
  await waitIdle(api);

  // Повторный ход во время анимации игнорируется
  await setGrid(['FFFLDWE', 'WWWDLFD', ...BOARD.slice(2)]);
  const m1 = await battle((s) => s.moves);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2)]);
  await sleep(60);
  const busyNow = await battle((s) => s.busy);
  await api.drag([cell(1, 0), cell(1, 1), cell(1, 2)]);
  await api.tap(560, 500, 50);
  await api.tap(480, 380, 50);
  await waitIdle(api);
  check('во время анимации второй ход не проходит', busyNow && (await battle((s) => s.moves)) === m1 + 1);

  // Мультитач: второй палец не ломает цепочку
  await setGrid(BOARD);
  const m2 = await battle((s) => s.moves);
  const a = cell(0, 0);
  const b = cell(0, 1);
  const c = cell(0, 2);
  const far = cell(4, 4);
  await touchRaw('touchStart', [{ ...a, id: 1 }]);
  await touchRaw('touchMove', [{ ...b, id: 1 }]);
  await touchRaw('touchStart', [{ ...b, id: 1 }, { ...far, id: 2 }]);
  await touchRaw('touchMove', [{ ...c, id: 1 }, { ...cell(5, 5), id: 2 }]);
  await touchRaw('touchEnd', [{ ...c, id: 1 }]);
  await touchRaw('touchEnd', []);
  await sleep(300);
  check('мультитач: ход один и без зависания', (await battle((s) => s.moves)) === m2 + 1, `moves ${await battle((s) => s.moves)}`);
  await waitIdle(api);

  // ---------- пауза во время хода ----------
  await setGrid(BOARD);
  await battle((s) => s.foes.forEach((f) => (f.cd = 1)));
  const hp0 = await battle((s) => s.teamHp);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2)]);
  await sleep(100);
  await api.tap(52, 130, 50);
  await sleep(2500);
  const paused = await battle((s) => ({ hp: s.teamHp, busy: s.busy, paused: s.paused }));
  check('пауза замораживает ход врагов', paused.paused && paused.busy && paused.hp === hp0, JSON.stringify(paused));
  await api.shot('pause_mid_turn');
  await api.tap(360, 640, 200);
  await waitIdle(api);
  check('после «Продолжить» ход доигрывается', (await battle((s) => s.teamHp)) < hp0);

  // Сдаться посреди анимации, потом снова в бой — без ошибок и зависаний
  await setGrid(BOARD);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2)]);
  await sleep(80);
  await api.tap(52, 130, 200);
  await api.tap(360, 760, 900);
  check('«Сдаться» ведёт на карту', (await api.active()).includes('StoryMap'));
  await page.evaluate(() => window.game.scene.getScene('StoryMap').scene.start('Battle', { stageId: '1-3' }));
  await api.waitScene('Battle');
  await sleep(500);
  const st = await battle((s) => ({ busy: s.busy, paused: s.paused, timePaused: s.time.paused, moves: s.moves }));
  check('бой после сдачи стартует чистым', !st.busy && !st.paused && !st.timePaused && st.moves === 0, JSON.stringify(st));

  // ---------- поражение ----------
  await battle((s) => {
    s.teamHp = 1;
    s.foes.forEach((f) => ((f.cd = 1), (f.hp = 99999)));
  });
  await setGrid(BOARD);
  await api.drag([cell(0, 0), cell(0, 1), cell(0, 2)]);
  await sleep(3500);
  await api.shot('defeat');
  const lost = await battle((s) => s.outcome);
  const sv = await api.save();
  check('поражение: исход lose', lost === 'lose');
  check('поражение не даёт звёзд', !sv.story.stars['1-3']);
  await api.tap(360, 880, 900);
  check('«Повтор» после поражения перезапускает бой', (await battle((s) => s.outcome === null && s.moves === 0 && s.waveIndex === 0)) === true);

  // ---------- рестарты: утечки ----------
  const probe = () =>
    battle((s) => ({
      objs: s.children.list.length,
      tweens: s.tweens.getTweens().length,
      timers: s.time.getAllEvents?.().length ?? 0,
      down: s.input.listenerCount('pointerdown'),
      up: s.input.listenerCount('pointerup'),
    }));
  const p0 = await probe();
  for (let i = 0; i < 15; i++) {
    await battle((s) => s.scene.restart({ stageId: '1-5' }));
    await sleep(150);
  }
  await sleep(800);
  const p1 = await probe();
  check('рестарты не плодят слушателей/объекты', p1.down === p0.down && p1.up === p0.up && Math.abs(p1.objs - p0.objs) < 15 && p1.tweens <= p0.tweens + 10, `${JSON.stringify(p0)} → ${JSON.stringify(p1)}`);

  // ---------- быстрый бой ----------
  await api.goto('', freshSave({ gold: 100 }));
  await api.tap(128, 1140, 900);
  check('быстрый бой открывается', (await api.active()).includes('Battle'));
  await battle((s) => {
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.finish(true);
  });
  await sleep(1200);
  await api.shot('quick_win');
  check('быстрый бой: +300 золота', (await api.save()).gold === 400);
  await api.tap(360, 1000, 800);
  check('«В меню» из быстрого боя', (await api.active()).includes('MainMenu'));

  // ---------- миграция ----------
  const v1 = { version: 1, gold: 777, cards: { rengoku: { id: 'rengoku', level: 3 } }, team: ['rengoku', 'rem', 'zoro', 'saitama', 'itachi'] };
  await api.goto('', v1);
  let s = await api.save();
  const menu = await api.active();
  check('v1 → меню без пролога', menu.includes('MainMenu'), menu);
  await api.goto('', v1);
  await page.evaluate(() => window.game.scene.getScene('MainMenu').scene.start('Team'));
  await sleep(500);
  s = await page.evaluate(async () => {
    const loaded = performance.getEntriesByType('resource').map((e) => e.name);
    const mod = (p) => import(loaded.find((n) => new URL(n).pathname === p) ?? p);
    const { Save } = await mod('/src/core/SaveManager.ts');
    return Save.get();
  });
  check(
    'v1: золото, уровень, команда, духи, валюта 0',
    s.version === 3 && s.gold === 777 && s.cards.rengoku.level === 3 && s.cards.rengoku.awakening === 0 && s.team.length === 5 && !!s.cards.spirit_fire && s.crystals === 0 && s.tickets === 0 && s.started,
    JSON.stringify({ v: s.version, gold: s.gold, team: s.team, started: s.started }),
  );
  await api.shot('migrated_v1_team');
  const v2 = { version: 2, gold: 50, cards: { naruto: { id: 'naruto', level: 2 }, ghost: { id: 'ghost', level: 1 } }, team: ['naruto', 'ghost'], story: { stars: { '1-1': 3, '1-2': 1 } } };
  await api.goto('?scene=StoryMap', v2);
  await api.shot('migrated_v2_map');
  check('v2: карта открывается с прогрессом', (await api.active()).includes('StoryMap'));
  await page.goto(`${api.page.url().split('?')[0]}`);
  await api.goto('', v2);
  await api.shot('migrated_v2_menu');
  check('v2 с удалённой картой: меню без ошибок', (await api.active()).includes('MainMenu'));
  await page.evaluate((k) => localStorage.setItem(k, '{битый json'), KEY);
  await page.reload();
  await sleep(2000);
  check('битое сохранение → пролог новой игры', (await api.active()).includes('Dialogue'));
  // Неполная команда (v1 с 2 героями) дополняется духами недостающих стихий
  await api.goto('?scene=Team', { version: 1, gold: 0, cards: {}, team: ['naruto', 'rem', 'naruto'] });
  await api.tap(116 + 124 * 4, 250, 300);
  await api.tap(116 + 124 * 3, 1000 - 340, 400);
  s = await api.save();
  check('неполная команда дополнена духами', s.team.length === 5 && s.team.every(Boolean) && new Set(s.team).size === 5, s.team.join());

  // ---------- новая игра и перезагрузка ----------
  await api.goto('', freshSave({ gold: 999, story: { stars: { '1-1': 2 }, chaptersClaimed: [], spiritStones: [] } }));
  await page.reload();
  await sleep(1500);
  check('перезагрузка сохраняет прогресс', (await api.save()).story.stars['1-1'] === 2 && (await api.active()).includes('MainMenu'));
  await api.tap(100, 44, 400);
  await api.shot('new_game_confirm');
  await api.tap(360, 820, 400);
  check('отмена «Новой игры»', (await api.save()).gold === 999);
  await api.tap(100, 44, 400);
  await api.tap(360, 700, 900);
  s = await api.save();
  check('«Да, начать» стирает и запускает пролог', (await api.active()).includes('Dialogue') && !s.started && s.gold === 500);

  // ---------- призыв ----------
  const base = freshSave({ crystals: 29, tickets: 0 });
  await api.goto('?scene=Summon', base);
  await api.tap(200, 590, 300);
  await api.tap(545, 590, 300);
  check('нет валюты — призыв не идёт', (await api.save()).crystals === 29 && !(await api.scene('Summon', (s) => s.revealing)));
  const maxed = freshSave({
    crystals: 60,
    tickets: 1,
    cards: Object.fromEntries(['naruto', 'rem', 'zoro', 'itachi', 'kurumi', 'saitama', 'spirit_fire', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'].map((id) => [id, { id, level: 1, awakening: id.startsWith('spirit') ? 0 : 5 }])),
    team: ['naruto', 'rem', 'zoro', 'saitama', 'itachi'],
  });
  await api.goto('?scene=Summon', maxed);
  await api.tap(545, 590, 300);
  await sleep(3500);
  await api.shot('summon_maxed_gold');
  s = await api.save();
  check('максимально пробуждённый повтор → +500 золота, билет списан', s.gold === 1000 && s.tickets === 0);
  await api.tap(360, 640, 500);
  maxed.cards.saitama.awakening = 2;
  await api.goto('?scene=Summon', { ...maxed, cards: Object.fromEntries(Object.entries(maxed.cards).map(([k, v]) => [k, { ...v, awakening: k.startsWith('spirit') ? 0 : 2 }])) });
  await api.tap(200, 590, 300);
  await sleep(3500);
  await api.shot('summon_awaken');
  s = await api.save();
  const awakened = Object.values(s.cards).filter((c) => c.awakening === 3);
  check('повтор → пробуждение +1, 30 кристаллов списано', awakened.length === 1 && s.crystals === 30, awakened.map((c) => c.id).join());

  // ---------- команда и прокачка ----------
  await api.goto('?scene=Team', freshSave({ cards: { ...freshSave().cards, zoro: { id: 'zoro', level: 1, awakening: 0 } } }));
  await api.tap(116 + 124 * 2, 250, 300); // слот 3 (дух земли)
  await api.tap(116 + 124 * 1, 500 + 32 + 82, 400); // Зоро — вторая карта в ряду героев
  s = await api.save();
  check('замена в слоте', s.team[2] === 'zoro', s.team.join());
  await api.tap(116, 250, 300);
  await api.tap(116 + 124 * 1, 500 + 32 + 82, 400);
  s = await api.save();
  check('Зоро стал лидером (обмен слотов)', s.team[0] === 'zoro' && s.team[2] === 'naruto', s.team.join());
  const before = JSON.stringify(s.team);
  await api.tap(116 + 124 * 4, 500 + 32 + 82, 400); // закрытый силуэт
  check('закрытый герой не назначается', JSON.stringify((await api.save()).team) === before);
  await api.shot('team');

  await api.goto('?scene=Upgrade', freshSave({ gold: 100000, cards: { ...freshSave().cards, spirit_water: { id: 'spirit_water', level: 9, awakening: 0 } } }));
  await api.tap(116 + 124, 1112, 300); // Ундина в ряду духов
  await api.tap(500, 480, 300);
  await api.tap(500, 480, 300);
  s = await api.save();
  check('дух упирается в 10 уровень, золото за 1 уровень', s.cards.spirit_water.level === 10 && s.gold === 100000 - 900, `ур.${s.cards.spirit_water.level}, золото ${s.gold}`);
  await api.shot('upgrade_spirit_max');
} catch (e) {
  fails++;
  console.log('ОШИБКА', e.stack);
  await api.shot('zz_error');
} finally {
  console.log(api.issues.join('\n') || 'console clean');
  console.log(fails ? `${fails} FAIL` : 'ALL OK');
  await Promise.race([browser.close(), sleep(3000)]);
  process.exit(0);
}
