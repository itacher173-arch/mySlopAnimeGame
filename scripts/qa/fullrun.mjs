// Полное прохождение с нуля тачем: пролог → стартер → 1-1 → призыв по билету → 1-2..1-5 → повтор 1-1.
// node scripts/qa/fullrun.mjs <naruto|rem|zoro> [out] [--max=4] [--read]  (--read — читать диалоги, а не пропускать)
import { botMove, launch, openPage, sleep, waitIdle } from './lib.mjs';

const starter = process.argv[2] ?? 'naruto';
const out = process.argv[3]?.startsWith('--') ? `qa-shots/run_${starter}` : (process.argv[3] ?? `qa-shots/run_${starter}`);
const maxChain = Number(process.argv.find((a) => a.startsWith('--max='))?.split('=')[1] ?? 4);
const read = process.argv.includes('--read');
const NODES = [
  { x: 350, y: 945 },
  { x: 368, y: 785 },
  { x: 322, y: 640 },
  { x: 252, y: 470 },
  { x: 372, y: 248 },
];
const log = (...a) => console.log(`[${starter}]`, ...a);
const browser = await launch();
const api = await openPage(browser, { out });
const { tap, shot, active } = api;

async function until(scene, step, max = 60) {
  for (let i = 0; i < max; i++) {
    if ((await active()).includes(scene)) return true;
    await step();
  }
  throw new Error(`не дошли до ${scene}, сейчас ${await active()}`);
}

async function dialogue(next, name) {
  await api.waitScene('Dialogue');
  await sleep(read ? 1800 : 400);
  await shot(`${name}`);
  if (read) await until(next, () => tap(360, 500, 250), 80);
  else await tap(600, 150, 800);
  await api.waitScene(next);
}

async function battle(stageId) {
  await api.waitScene('Battle');
  await sleep(500);
  let wave = -1;
  let moves = 0;
  for (;;) {
    const st = await api.scene('Battle', (s) => ({ outcome: s.outcome, wave: s.waveIndex, foes: s.foes.map((f) => f.def.id) }));
    if (st.outcome) break;
    if (st.wave !== wave) {
      wave = st.wave;
      await shot(`b${stageId}_w${wave + 1}`);
    }
    if (!(await botMove(api, maxChain))) throw new Error('нет хода');
    if (++moves > 120) throw new Error('слишком долго');
  }
  await sleep(2200);
  await shot(`b${stageId}_result`);
  return api.scene('Battle', (s) => ({ outcome: s.outcome, moves: s.moves, hp: Math.round((100 * s.teamHp) / s.teamMaxHp) }));
}

try {
  await api.goto('');
  await api.waitScene('Dialogue');
  log('старт:', await active());
  await dialogue('StarterSelect', '00_prologue');
  const i = ['naruto', 'rem', 'zoro'].indexOf(starter);
  await tap(360 + (i - 1) * 235, 420);
  await shot('01_starter');
  await tap(360, 1180, 900);
  await api.waitScene('MainMenu');
  let s = await api.save();
  log('команда:', s.team.join(), 'золото', s.gold);
  await shot('02_menu');

  for (let n = 0; n < 5; n++) {
    const id = `1-${n + 1}`;
    if (!(await active()).includes('StoryMap')) {
      await tap(245, 1000, 800);
      await api.waitScene('StoryMap');
    }
    await shot(`map_before_${id}`);
    await tap(NODES[n].x, NODES[n].y, 800);
    await dialogue('Battle', `d${id}_pre`);
    let r;
    let tries = 0;
    for (;;) {
      r = await battle(id);
      tries++;
      log(id, JSON.stringify(r), 'попытка', tries);
      if (r.outcome === 'win' || tries >= 3) break;
      await tap(360, 880, 1000); // Повтор
    }
    if (r.outcome !== 'win') throw new Error(`${id} не пройден`);
    // Окно «Новый герой» (Аква после 1-2)
    if (id === '1-2') {
      await sleep(800);
      await shot(`b${id}_newhero`);
      const team = (await api.save()).team;
      if (!team.includes('aqua')) {
        // Аква не встала сама — выбираем в предложении слот духа (или последний), затем «Продолжить».
        const i = Math.max(0, team.findIndex((t) => t.startsWith('spirit'))) || team.length - 1;
        await tap(112 + i * 124, 880, 700);
        await shot(`b${id}_newhero_placed`);
        await tap(360, 1090, 600);
      } else {
        await tap(360, 1000, 600);
      }
      await shot(`b${id}_newhero_closed`);
    }
    s = await api.save();
    log(`после ${id}: золото ${s.gold} крист ${s.crystals} билеты ${s.tickets} звёзды ${JSON.stringify(s.story.stars)} команда ${s.team.join()}`);
    await tap(360, 880, 900); // Далее
    await dialogue('StoryMap', `d${id}_post`);
    await shot(`map_after_${id}`);
    if (id === '1-1' || id === '1-5') {
      await tap(80, 40, 700);
      await api.waitScene('MainMenu');
      await tap(592, 1000, 800);
      await api.waitScene('Summon');
      await shot(`summon_before_${id}`);
      await tap(545, 590, 400);
      await sleep(3500);
      await shot(`summon_reveal_${id}`);
      await tap(360, 640, 700);
      s = await api.save();
      log(`призыв: карты ${Object.keys(s.cards).filter((k) => !k.startsWith('spirit')).join()} команда ${s.team.join()} билеты ${s.tickets}`);
      await shot(`summon_after_${id}`);
      await tap(80, 60, 700);
      await shot(`menu_after_${id}`);
    }
  }
  // Повтор 1-1
  await tap(245, 1000, 800);
  await api.waitScene('StoryMap');
  const gold0 = (await api.save()).gold;
  await tap(NODES[0].x, NODES[0].y, 800);
  await dialogue('Battle', 'replay_pre');
  log('повтор 1-1', JSON.stringify(await battle('replay')));
  s = await api.save();
  log('золото за повтор', s.gold - gold0, 'итог', JSON.stringify({ gold: s.gold, crystals: s.crystals, tickets: s.tickets, stones: s.story.spiritStones, claimed: s.story.chaptersClaimed }));
  await tap(360, 880 + 120, 900); // Повтор → нет, «Повтор» второй кнопкой; проверим рестарт
  await waitIdle(api);
  await shot('replay_restart');
} catch (e) {
  log('ОШИБКА', e.message);
  await shot('zz_error');
} finally {
  log('консоль:', api.issues.filter((x) => !x.includes('favicon')).join('\n') || 'чисто');
  await Promise.race([browser.close(), sleep(3000)]);
  process.exit(0);
}
