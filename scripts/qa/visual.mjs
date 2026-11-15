// Точечные скриншоты для визуальной проверки: node scripts/qa/visual.mjs [out] [--desktop]
import { freshSave, launch, openPage, sleep } from './lib.mjs';

const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'qa-shots/visual';
const mobile = !process.argv.includes('--desktop');
const browser = await launch();
const api = await openPage(browser, { mobile, out });
const card = (id, level = 1, awakening = 0) => [id, { id, level, awakening }];
const SPIRITS = ['spirit_fire', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'];
const remSave = freshSave({
  starter: 'rem',
  cards: Object.fromEntries(['rem', ...SPIRITS].map((id) => card(id))),
  team: ['rem', 'spirit_fire', 'spirit_earth', 'spirit_light', 'spirit_dark'],
  story: { stars: { '1-1': 3 }, chaptersClaimed: [], spiritStones: [] },
});

async function jumpWave(n) {
  await api.page.evaluate(async (n) => {
    const s = window.game.scene.getScene('Battle');
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.waveIndex = n - 2;
    await s.nextWave();
  }, n);
  await sleep(700);
}
const forceWin = () =>
  api.page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.waveIndex = s.waves.length - 1;
    s.moves = 9;
    s.finish(true);
  });

try {
  await api.goto('?scene=StoryMap', freshSave({ story: { stars: { '1-1': 3, '1-2': 2 }, chaptersClaimed: [], spiritStones: [] } }));
  await api.shot('map');
  await api.goto('', freshSave({ gold: 12345, crystals: 120, tickets: 2 }));
  await api.shot('menu');

  await api.goto('?scene=Battle&stage=1-2', freshSave({ team: ['naruto', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'] }));
  await api.shot('battle_spirits');
  await jumpWave(3);
  await api.shot('battle_frog');
  await api.goto('?scene=Battle&stage=1-4', remSave);
  await jumpWave(2);
  await api.shot('battle_3goblins');
  await jumpWave(3);
  await api.shot('battle_hob');
  await api.goto('?scene=Battle&stage=1-5', freshSave({ starter: 'zoro', cards: Object.fromEntries(['zoro', 'rem', 'aqua', 'naruto', ...SPIRITS].map((id) => card(id))), team: ['zoro', 'naruto', 'rem', 'spirit_light', 'spirit_dark'] }));
  await jumpWave(3);
  await api.shot('battle_boss');
  // Пауза с идущей анимацией
  await api.tap(52, 130, 500);
  await api.shot('battle_pause');
  await api.tap(360, 640, 400);

  // Рем-стартер, 1-2: Аква не помещается — окно с выбором слота
  await api.goto('?scene=Battle&stage=1-2', remSave);
  await forceWin();
  await sleep(2000);
  await api.shot('win_offer');
  await api.tap(116 + 124 * 4, 880, 600); // заменить Тень
  await api.shot('win_offer_placed');
  await api.tap(360, 1090, 500);
  await api.shot('win_after_offer');
  const s1 = await api.save();
  console.log('команда после выбора:', s1.team.join());

  // Призыв: всё, кроме Куруми, открыто, Итачи на месте тьмы → гарантия даст Куруми, ей нужен слот
  await api.goto(
    '?scene=Summon',
    freshSave({
      crystals: 100,
      tickets: 1,
      pullsSinceNew: 4,
      cards: Object.fromEntries(['naruto', 'rem', 'zoro', 'itachi', 'saitama', ...SPIRITS].map((id) => card(id))),
      team: ['naruto', 'rem', 'zoro', 'saitama', 'itachi'],
    }),
  );
  await api.shot('summon');
  await api.tap(200, 590, 400);
  await sleep(3500);
  await api.shot('summon_offer');
  await api.tap(360, 1110, 600);
  await api.shot('summon_after');
  await api.goto('?scene=Upgrade', freshSave({ gold: 50 }));
  await api.shot('upgrade_poor');
} catch (e) {
  console.log('ОШИБКА', e.stack);
} finally {
  console.log(api.issues.join('\n') || 'console clean');
  await Promise.race([browser.close(), sleep(3000)]);
  process.exit(0);
}
