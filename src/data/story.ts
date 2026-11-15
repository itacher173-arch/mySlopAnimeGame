import type { Element } from './elements';

export interface DialogueLine {
  /** id карты ('aqua', 'zoro'), id врага ('goblin_king'), 'narrator' или 'starter' (выбранный игроком герой). */
  speaker: string;
  text: string;
  /** Реплика звучит, только если этот герой есть в коллекции. */
  requires?: string;
}

export interface StageDef {
  /** Формат «глава-номер»: '1-3'. */
  id: string;
  chapter: number;
  title: string;
  /** Ключ текстуры фона боя (bg_<name>). */
  background: string;
  /** Волны: в каждой 1–3 врага по id из ENEMIES. */
  waves: string[][];
  /** Третья звезда — победа не более чем за столько ходов. */
  parMoves: number;
  /** Билеты призыва за первое прохождение. */
  ticketReward?: number;
  pre: DialogueLine[];
  post: DialogueLine[];
}

export interface ChapterDef {
  id: number;
  title: string;
  anime: string;
  element: Element;
  /** Ключ текстуры карты главы (bg_<name>). */
  map: string;
  /** Пара строк о главе для экрана выбора. */
  teaser: string;
  /** Пока глава не готова — показываем «Скоро». */
  comingSoon?: boolean;
  /** Узлы этапов на карте 720×1280, по порядку этапов. */
  nodes: { x: number; y: number }[];
  stages: StageDef[];
  reward: { gold: number; spiritStone: Element };
}

/** Вторая звезда — к концу боя у команды осталось больше этой доли HP. */
export const STAR_HP_RATIO = 0.5;
export const STAGE_GOLD_FIRST = 200;
export const STAGE_GOLD_REPEAT = 50;
export const STAGE_CRYSTALS_FIRST = 5;
export const STAGE_CRYSTALS_THREE_STARS = 5;
export const CHAPTER_CRYSTALS = 20;

/** Имена для говорящих, которых нет в CARDS/ENEMIES. */
export const EXTRA_SPEAKERS: Record<string, string> = {
  narrator: 'Рассказчик',
};

const CHAPTER1_STAGES: StageDef[] = [
  {
    id: '1-1',
    chapter: 1,
    title: 'Опушка',
    background: 'forest',
    waves: [['slime'], ['slime', 'slime'], ['slime', 'slime', 'slime']],
    parMoves: 10,
    ticketReward: 1,
    pre: [
      { speaker: 'narrator', text: 'Разлом выплюнул Призывателя и его команду прямо на опушку у стартовой деревни. Из кустов уже ползут слизни.' },
      { speaker: 'aqua', text: 'Призыватель, ты связываешь силу камней с героями. Проведи цепочку из трёх и больше камней одного цвета — и герой этой стихии ударит!' },
      { speaker: 'aqua', text: 'Камни без хозяина в команде просто пропадут. Поэтому духи и закрывают все пять стихий. Видишь, всё продумано!' },
      { speaker: 'starter', text: 'Слизни. Ладно, с чего-то надо начинать.' },
      { speaker: 'spirit_earth', text: 'Шурх-шурх!' },
      { speaker: 'aqua', text: 'Видишь? Духи тоже рвутся в бой! ...Наверное, это значит «да».' },
    ],
    post: [
      { speaker: 'aqua', text: 'Видели?! Безупречная победа! Всё благодаря моему божественному руководству!' },
      { speaker: 'starter', text: 'Ты весь бой стояла сзади и ела онигири.' },
      { speaker: 'aqua', text: 'Это была стратегическая подзарядка маны! ...Ладно. Вот, держи билет призыва! Не всё же мне одной стараться.' },
      { speaker: 'aqua', text: 'Загляни в «Призыв» в главном меню. Вдруг вытянешь кого-нибудь посильнее разминочных духов!' },
    ],
  },
  {
    id: '1-2',
    chapter: 1,
    title: 'Жабье болото',
    background: 'forest',
    waves: [['slime', 'slime'], ['frog'], ['frog', 'slime']],
    parMoves: 14,
    pre: [
      { speaker: 'narrator', text: 'Тропа уходит в болото. Из тумана доносится басовитое «ква».' },
      { speaker: 'aqua', text: 'Н-нет. Нет-нет-нет. Только не жабы! В прошлый раз меня проглотили ЦЕЛИКОМ!' },
      { speaker: 'rem', requires: 'rem', text: 'Аква-сама, держитесь позади. Рем обо всём позаботится.' },
      { speaker: 'starter', text: 'Держись позади, богиня. Мы справимся.' },
      { speaker: 'frog', text: 'КВА-А-А-А.' },
      { speaker: 'aqua', text: 'Она на меня посмотрела! Призыватель, бей её первой! ПЕРВОЙ!' },
    ],
    post: [
      { speaker: 'aqua', text: '...Я не плакала. Это болотная вода.' },
      { speaker: 'starter', text: 'Конечно. Болотная вода.' },
      { speaker: 'aqua', text: 'Знаешь что? Без меня вы тут пропадёте. Так и быть — я иду с вами! Лично! Цени, Призыватель!' },
      { speaker: 'narrator', text: 'Аква присоединилась к команде! Она заменит духа воды — если, конечно, место воды не занято героем.' },
      { speaker: 'narrator', text: 'В тине блеснула зелёная искра. Где-то рядом пульсирует Камень Духа Земли.' },
    ],
  },
  {
    id: '1-3',
    chapter: 1,
    title: 'Гоблинская тропа',
    background: 'forest',
    waves: [['goblin'], ['goblin', 'goblin'], ['goblin', 'goblin_archer']],
    parMoves: 14,
    pre: [
      { speaker: 'narrator', text: 'На стволах — зарубки и черепа. Гоблинские метки.' },
      { speaker: 'goblin', text: 'Гыр! Новенькие! Блестящие! Забрать всё!' },
      { speaker: 'starter', text: 'Тропа, полная врагов. Отлично — разомнёмся.' },
      { speaker: 'zoro', requires: 'zoro', text: 'Я разведаю дорогу. Налево.' },
      { speaker: 'aqua', requires: 'zoro', text: 'Зоро, лес — направо! Налево — обрыв!' },
      { speaker: 'aqua', text: 'Только не разбегайтесь! Я не умею искать потерявшихся. Я умею только плакать.' },
    ],
    post: [
      { speaker: 'aqua', text: 'Они бьют стаей и исподтишка. Лучников — первыми! Нажми на врага, чтобы выбрать цель.' },
      { speaker: 'zoro', requires: 'zoro', text: 'Я нашёл короткий путь.' },
      { speaker: 'aqua', requires: 'zoro', text: 'Мы стоим ровно там, откуда вышли!' },
      { speaker: 'starter', text: 'Гоблины тащат добычу на север. Похоже, у них есть главарь.' },
    ],
  },
  {
    id: '1-4',
    chapter: 1,
    title: 'Застава хобгоблина',
    background: 'forest',
    waves: [['goblin_archer', 'goblin_archer'], ['goblin', 'goblin', 'goblin_archer'], ['hobgoblin', 'goblin']],
    parMoves: 18,
    pre: [
      { speaker: 'narrator', text: 'У старой заставы караулит хобгоблин — громила втрое крупнее сородичей.' },
      { speaker: 'hobgoblin', text: 'Король сказал: к трону никто не пройдёт! Камень — наш!' },
      { speaker: 'saitama', requires: 'saitama', text: 'Хм. Большой. Надеюсь, хоть этот выдержит больше одного удара.' },
      { speaker: 'aqua', requires: 'saitama', text: 'Сайтама, не бей в полную силу! Снесёшь лес — и меня точно уволят!' },
      { speaker: 'starter', text: 'Здоровяк. Значит, и падать будет громко.' },
    ],
    post: [
      { speaker: 'hobgoblin', text: 'Король... отомстит... У него камень... и друг... в белом...' },
      { speaker: 'starter', text: 'Друг в белом? Звучит подозрительно.' },
      { speaker: 'aqua', text: 'В белом тут хожу только я! Ну... и ещё один тип. Но о нём не будем.' },
    ],
  },
  {
    id: '1-5',
    chapter: 1,
    title: 'Трон Короля Гоблинов',
    background: 'forest',
    waves: [['goblin', 'goblin_archer'], ['hobgoblin'], ['goblin_king', 'goblin', 'goblin']],
    parMoves: 30,
    ticketReward: 1,
    pre: [
      { speaker: 'narrator', text: 'В сердце леса — трон из костей. На нём восседает Король Гоблинов, и в его короне пульсирует зелёный свет.' },
      { speaker: 'goblin_king', text: 'Человечишки добрались до моего трона? Стража! Рвите их!' },
      { speaker: 'aqua', text: 'Это же осколок Камня Земли! Вставлен в корону! Какая безвкусица!' },
      { speaker: 'goblin_king', text: 'Пока жива моя свита, меня не достать. А свиты у меня — бесконечно!' },
      { speaker: 'starter', text: 'Значит, прорубимся сквозь всех. Огонь бьёт землю — Призыватель, начинай!' },
    ],
    post: [
      { speaker: 'goblin_king', text: 'Невозможно... Он обещал... что камень сделает меня богом...' },
      { speaker: 'aqua', text: 'Кто «он»? А ну говори!' },
      { speaker: 'goblin_king', text: 'Человек... в белом... с улыбкой... Сказал, скоро все миры станут одним...' },
      { speaker: 'narrator', text: 'Король рассыпается прахом. В руках Призывателя — Камень Духа Земли. Первый из пяти.' },
      { speaker: 'aqua', text: 'Ура! Минус один камень — минус один повод меня уволить! Держи ещё билет призыва. Следующая остановка — Падшая Стена!' },
    ],
  },
];

/** Отдельные сцены-диалоги вне этапов. После последней реплики открывается сцена `next`. */
export interface ScriptDef {
  title: string;
  background: string;
  lines: DialogueLine[];
  next: string;
}

export const SCRIPTS: Record<string, ScriptDef> = {
  prologue: {
    title: 'Пролог',
    background: 'forest',
    next: 'StarterSelect',
    lines: [
      { speaker: 'narrator', text: 'Небесная канцелярия. Утро. Очень позднее утро.' },
      { speaker: 'aqua', text: 'Ммм... ещё пять минуточек... Стоп. Почему небо в трещинах?!' },
      { speaker: 'narrator', text: 'Айзен пытался подчинить Хогёку — и тот раскололся на пять Камней Духа. Миры треснули, и сквозь разломы хлынули монстры.' },
      { speaker: 'aqua', text: 'Если начальство узнает, что я проспала конец света, меня уволят! Срочно призываю героев! Много героев!' },
      { speaker: 'aqua', text: 'Великий Божественный Призыв!!! ...Ой. Силы хватило только на одного.' },
      { speaker: 'spirit_fire', text: 'Пшш?' },
      { speaker: 'aqua', text: 'Это… разминочные духи! Временные! Не смотрите на меня так!' },
      { speaker: 'aqua', text: 'Ты — Призыватель: свяжешь силу камней с героями. Выбирай, кого призвать первым. Остальные места пока займут духи.' },
    ],
  },
};

/** Узлы вдоль тропы на chapter1_map.jpg (деревня → мост → пруд → крепость); главы-заглушки пока берут те же. */
const DEFAULT_NODES = [
  { x: 330, y: 960 },
  { x: 375, y: 790 },
  { x: 335, y: 640 },
  { x: 255, y: 475 },
  { x: 395, y: 235 },
];

export const CHAPTERS: ChapterDef[] = [
  {
    id: 1,
    title: 'Лес Новичков',
    teaser: 'Слизни, жабы и гоблинская орда. Где-то здесь — Камень Духа Земли.',
    anime: 'KonoSuba × Goblin Slayer',
    element: 'earth',
    map: 'chapter1_map',
    nodes: DEFAULT_NODES,
    stages: CHAPTER1_STAGES,
    reward: { gold: 1000, spiritStone: 'earth' },
  },
  {
    id: 2,
    title: 'Падшая Стена',
    teaser: 'Разлом пробил Стену Мария. Титаны идут, а Колоссальный кипит паром.',
    anime: 'Attack on Titan',
    element: 'fire',
    map: 'chapter2_map',
    comingSoon: true,
    nodes: DEFAULT_NODES,
    stages: [],
    reward: { gold: 1500, spiritStone: 'fire' },
  },
  {
    id: 3,
    title: 'Ночь Высших Лун',
    teaser: 'Демоны вышли на охоту. Ренгоку ждёт реванша с Аказой.',
    anime: 'Demon Slayer',
    element: 'water',
    map: 'chapter3_map',
    comingSoon: true,
    nodes: DEFAULT_NODES,
    stages: [],
    reward: { gold: 2000, spiritStone: 'water' },
  },
  {
    id: 4,
    title: 'Проклятая Сибуя',
    teaser: 'Сибуя тонет в проклятиях. Сукуна раскрывает Расширение территории.',
    anime: 'Jujutsu Kaisen',
    element: 'dark',
    map: 'chapter4_map',
    comingSoon: true,
    nodes: DEFAULT_NODES,
    stages: [],
    reward: { gold: 2500, spiritStone: 'dark' },
  },
  {
    id: 5,
    title: 'Лас Ночес',
    teaser: 'Белая крепость Айзена. Гриммджоу, Улькиорра — и три облика самого Айзена.',
    anime: 'Bleach',
    element: 'light',
    map: 'chapter5_map',
    comingSoon: true,
    nodes: DEFAULT_NODES,
    stages: [],
    reward: { gold: 3000, spiritStone: 'light' },
  },
];

export const STAGES: Record<string, StageDef> = Object.fromEntries(
  CHAPTERS.flatMap((ch) => ch.stages).map((s) => [s.id, s]),
);

export function chapterOf(stage: StageDef): ChapterDef {
  return CHAPTERS.find((c) => c.id === stage.chapter)!;
}

/** Все фоны, которые нужно попытаться загрузить (bg_<name> ← assets/bg/<name>.jpg). */
export function backgroundNames(): string[] {
  const names = new Set<string>();
  for (const ch of CHAPTERS) {
    if (!ch.comingSoon) names.add(ch.map);
    for (const s of ch.stages) names.add(s.background);
  }
  return [...names];
}
