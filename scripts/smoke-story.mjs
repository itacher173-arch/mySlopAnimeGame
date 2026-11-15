// Сквозной смоук-тест сюжета: меню → карта → диалог → бой → пауза/сдаться → победа → пост-диалог → награда главы.
// Запуск (dev-сервер должен работать): node scripts/smoke-story.mjs [папка для скриншотов]
import puppeteer from 'puppeteer-core';

const out = process.argv[2] ?? '/tmp/ss/flow';
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
const tap = async (x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await sleep(50);
  await page.mouse.up();
  await sleep(400);
};
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const forceWin = () =>
  page.evaluate(() => {
    const s = window.game.scene.getScene('Battle');
    s.foes.forEach((f) => (f.root.destroy(), f.ui.destroy()));
    s.foes = [];
    s.waveIndex = s.waves.length - 1;
    s.moves = 7;
    s.finish(true);
  });

await page.goto('http://localhost:5173/');
await page.evaluate(() =>
  localStorage.setItem(
    'spirit-stones-anime/save',
    JSON.stringify({ version: 1, gold: 777, cards: { rengoku: { id: 'rengoku', level: 3 } }, team: ['rengoku', 'rem', 'zoro', 'saitama', 'itachi'] }),
  ),
);
await page.reload();
await page.waitForFunction(() => window.game?.scene.getScene('MainMenu')?.sys.isActive());
await sleep(800);
await shot('01_menu');
console.log('menu:', await active());

await tap(245, 1005);
await sleep(500);
console.log('after Сюжет:', await active());
await shot('02_map');

await tap(330, 960);
await sleep(1500);
console.log('after node:', await active());
await shot('03_dialogue');
await tap(360, 600);
await tap(360, 600);
await sleep(1500);
await shot('04_dialogue2');
await tap(600, 150);
await sleep(1200);
console.log('after skip:', await active());

await tap(52, 130);
await shot('05_pause');
await tap(360, 760);
await sleep(600);
console.log('after surrender:', await active());

await tap(330, 960);
await sleep(500);
await tap(600, 150);
await sleep(1200);
// Выбор цели тапом (волна 1 из одного слизня — выбор не меняется, но проверим, что нет ошибок)
await tap(560, 540);
await forceWin();
await sleep(1500);
await shot('06_win');
await tap(360, 850);
await sleep(1500);
console.log('after Далее:', await active());
await shot('07_post');
await tap(600, 150);
await sleep(800);
console.log('after post skip:', await active());
await shot('08_map_after');
console.log('save:', await page.evaluate(() => localStorage.getItem('spirit-stones-anime/save')));

for (const id of ['1-2', '1-3', '1-4', '1-5']) {
  await page.evaluate((id) => window.game.scene.getScene('StoryMap').scene.start('Battle', { stageId: id }), id);
  await sleep(1200);
  await forceWin();
  await sleep(1500);
}
await shot('09_chapter_win');
await tap(360, 850);
await sleep(800);
await tap(600, 150);
await sleep(800);
await shot('10_map_done');
await tap(232, 1222);
await sleep(600);
await shot('11_chapter2_locked');
console.log('final save:', await page.evaluate(() => localStorage.getItem('spirit-stones-anime/save')));

await page.goto('http://localhost:5173/?scene=Battle');
await sleep(2500);
await shot('12_quick');

await page.goto('http://localhost:5173/?scene=Dialogue&stage=1-5');
await sleep(2000);
await tap(360, 600);
await tap(360, 600);
await sleep(2500);
await shot('13_boss_dialogue');
// close() иногда зависает в headless Chrome — не ждём дольше пары секунд.
await Promise.race([browser.close(), sleep(3000)]);
process.exit(0);
