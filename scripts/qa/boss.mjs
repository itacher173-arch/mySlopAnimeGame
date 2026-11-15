// Механики босса 1-5 и кадры посреди анимаций: node scripts/qa/boss.mjs [out]
import { botMove, cell, freshSave, launch, openPage, sleep, waitIdle } from './lib.mjs';

const out = process.argv[2] ?? 'qa-shots/boss';
const browser = await launch();
const api = await openPage(browser, { out });
const { page } = api;
const check = (label, ok, extra = '') => console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? ` — ${extra}` : ''}`);
const SPIRITS = ['spirit_fire', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'];
const save = freshSave({
  cards: Object.fromEntries(['naruto', 'aqua', 'zoro', ...SPIRITS].map((id) => [id, { id, level: 1, awakening: 0 }])),
  team: ['naruto', 'aqua', 'zoro', 'spirit_light', 'spirit_dark'],
});
const state = () =>
  api.scene('Battle', (s) => ({
    foes: s.foes.map((f) => ({ id: f.def.id, hp: f.hp, slot: f.slot, guard: f.guardText?.visible ?? null })),
    target: s.target?.def.id,
    moves: s.moves,
  }));

try {
  await api.goto('?scene=Battle&stage=1-5', save);
  await page.evaluate(async () => {
    const s = window.game.scene.getScene('Battle');
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.waveIndex = 1;
    await s.nextWave();
  });
  await sleep(600);
  let st = await state();
  check('волна босса: король + 2 гоблина, щит виден', st.foes.length === 3 && st.foes[0].id === 'goblin_king' && st.foes[0].guard === true, JSON.stringify(st.foes));

  // Бьём босса огнём: урон должен быть с пометкой «щит» (половинный)
  await page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    s.selectTarget(s.foes.find((f) => f.def.id === 'goblin_king'));
    s.model.grid[5] = ['fire', 'fire', 'fire', 'light', 'dark', 'water', 'earth'];
    s.stones.flat().forEach((x) => x?.destroy());
    s.buildStones();
  });
  const hp0 = (await state()).foes[0].hp;
  await api.drag([cell(5, 0), cell(5, 1), cell(5, 2)]);
  // Кадры во время анимации: камни летят, удар, цифры урона
  for (let i = 0; i < 6; i++) {
    await sleep(170);
    await api.shot(`anim_${i}`);
  }
  await waitIdle(api);
  const dmg = hp0 - (await state()).foes[0].hp;
  // Наруто: 135 × 3 × 0.5 × 1.5 (огонь > земля) × 0.5 (щит) ≈ 152
  check('щит свиты режет урон вдвое', dmg > 0 && dmg <= 160, `урон ${dmg}`);

  // Убиваем свиту → щит пропадает; через 3 хода босса — призыв
  await page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    for (const f of [...s.foes]) if (f.def.id !== 'goblin_king') s.killFoe(f);
    s.foes[0].turns = 0;
  });
  await sleep(600);
  st = await state();
  check('без свиты щит снят', st.foes.length === 1 && st.foes[0].guard === false, JSON.stringify(st.foes));
  let summoned = false;
  for (let i = 0; i < 4 && !summoned; i++) {
    await page.evaluate(() => {
      const s = window.game.scene.getScene('Battle');
      s.teamHp = s.teamMaxHp;
      s.foes.forEach((f) => (f.hp = Math.max(f.hp, 2000)));
    });
    await botMove(api, 3);
    st = await state();
    summoned = st.foes.length > 1;
    if (summoned) await api.shot('summoned');
  }
  check('король призывает гоблина за 3 хода', summoned, JSON.stringify(st.foes));
  check('после призыва щит снова виден', st.foes[0].guard === true);

  // Тап по врагу меняет цель
  const g = await api.scene('Battle', (s) => {
    const f = s.foes.find((x) => x.def.id === 'goblin');
    const boss = s.foes.find((x) => x.def.id === 'goblin_king');
    if (!f) return null;
    s.selectTarget(boss);
    // Точка, где виден только гоблин (не перекрыт королём)
    for (let y = f.y - f.h + 10; y < f.y; y += 6)
      for (let x = f.x - f.w / 2; x < f.x + f.w / 2; x += 6)
        if (s.opaqueAt(f, x, y) && !s.opaqueAt(boss, x, y)) return { x, y, bar: { x: f.ui.x, y: f.ui.y - f.h - 18 }, picked: s.foeAt(x, y)?.def.id };
    return { none: true };
  });
  console.log('точка гоблина:', JSON.stringify(g));
  if (g && !g.none) {
    await api.tap(g.x, g.y, 300);
    check('тап по видимой части гоблина выбирает его', (await state()).target === 'goblin');
    await api.shot('target_goblin');
    await api.scene('Battle', (s) => s.selectTarget(s.foes[0]));
    await api.tap(g.bar.x, g.bar.y, 300);
    check('тап по полоске HP гоблина выбирает его', (await state()).target === 'goblin');
  }
  // Волна-баннер посреди анимации
  await page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    s.waveIndex = 0;
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    void s.nextWave();
  });
  await sleep(350);
  await api.shot('wave_banner');
  await sleep(1500);
} catch (e) {
  console.log('ОШИБКА', e.stack);
} finally {
  console.log(api.issues.join('\n') || 'console clean');
  await Promise.race([browser.close(), sleep(3000)]);
  process.exit(0);
}
