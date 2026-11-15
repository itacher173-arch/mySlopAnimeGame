// Визуальный обход всех экранов: node scripts/qa/tour.mjs [out] [--desktop]
import { botMove, freshSave, launch, openPage, sleep } from './lib.mjs';

const out = process.argv[2] ?? 'qa-shots/tour';
const mobile = !process.argv.includes('--desktop');
const browser = await launch();
const api = await openPage(browser, { mobile, out });
const rich = freshSave({
  starter: 'rem',
  gold: 5000,
  crystals: 300,
  tickets: 3,
  cards: Object.fromEntries(
    ['rem', 'naruto', 'zoro', 'aqua', 'itachi', 'kurumi', 'saitama', 'spirit_fire', 'spirit_water', 'spirit_earth', 'spirit_light', 'spirit_dark'].map((id, i) => [
      id,
      { id, level: 1 + i, awakening: i % 3 },
    ]),
  ),
  team: ['rem', 'naruto', 'zoro', 'saitama', 'itachi'],
  story: { stars: { '1-1': 3, '1-2': 2, '1-3': 1 }, chaptersClaimed: [], spiritStones: [] },
});

try {
  await api.goto('');
  await api.shot('01_prologue');
  await sleep(2500);
  await api.shot('01b_prologue_typed');
  await api.goto('?scene=StarterSelect');
  await api.shot('02_starter');
  await api.tap(360, 420);
  await api.shot('02b_starter_rem');

  await api.goto('', freshSave());
  await api.shot('03_menu_fresh');
  await api.goto('', rich);
  await api.shot('03b_menu_rich');
  await api.goto('?scene=StoryMap', rich);
  await api.shot('04_map');
  await api.goto('?scene=Team', rich);
  await api.shot('05_team');
  await api.goto('?scene=Upgrade', rich);
  await api.shot('06_upgrade');
  await api.goto('?scene=Summon', rich);
  await api.shot('07_summon');
  await api.goto('?scene=Dialogue&stage=1-5', rich);
  await sleep(2500);
  await api.shot('08_dialogue_boss');

  for (const [st, save] of [
    ['1-1', freshSave()],
    ['1-2', freshSave({ starter: 'zoro', team: ['zoro', 'spirit_fire', 'spirit_water', 'spirit_light', 'spirit_dark'] })],
    ['1-4', rich],
    ['1-5', freshSave()],
  ]) {
    await api.goto(`?scene=Battle&stage=${st}`, save);
    await sleep(600);
    await api.shot(`09_battle_${st}`);
    await botMove(api);
    await sleep(100);
    await api.shot(`09_battle_${st}_after`);
  }
  await api.goto('?scene=Battle', rich);
  await api.shot('10_quick');
} finally {
  console.log(api.issues.join('\n') || 'no console issues');
  await Promise.race([browser.close(), sleep(3000)]);
  process.exit(0);
}
