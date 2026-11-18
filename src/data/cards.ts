import { ELEMENTS, type Element } from './elements';

export interface CardDef {
  id: string;
  name: string;
  anime: string;
  element: Element;
  atk: number;
  hp: number;
  /** Редкость ★1–★5. */
  rarity: number;
  /** Духи — временные «разминочные» юниты Аквы: слабые, есть с самого начала, из призыва не выпадают. */
  kind?: 'hero' | 'spirit';
  /** Может выпасть из призыва (кроме стартера, выбранного игроком). */
  summonable?: boolean;
  /** Сюжетный герой: присоединяется после этапа или главы и никогда не выпадает из призыва. */
  unlock?: { stage?: string; chapter?: number };
  /** Потолок уровня; по умолчанию MAX_LEVEL. */
  maxLevel?: number;
  /** Доля высоты героя в бою (духи — маленькие). */
  battleScale?: number;
  /** Летающий юнит: на сколько px спрайт висит над своей тенью. */
  hover?: number;
  /** Боевой спрайт нарисован смотрящим влево — в бою героя нужно отразить. */
  spriteFacesLeft?: boolean;
  /** id навыка из SKILLS. Срабатывает по тапу, когда шкала заряжена. */
  skill: string;
}

const HEROES: CardDef[] = [
  { id: 'naruto', name: 'Наруто', anime: 'Naruto', element: 'fire', atk: 135, hp: 680, rarity: 3, summonable: true, skill: 'naruto' },
  { id: 'rem', name: 'Рем', anime: 'Re:Zero', element: 'water', atk: 130, hp: 640, rarity: 3, summonable: true, skill: 'rem' },
  { id: 'zoro', name: 'Зоро', anime: 'One Piece', element: 'earth', atk: 140, hp: 660, rarity: 3, summonable: true, spriteFacesLeft: true, skill: 'zoro' },
  { id: 'aqua', name: 'Аква', anime: 'KonoSuba', element: 'water', atk: 120, hp: 760, rarity: 4, unlock: { stage: '1-2' }, skill: 'aqua' },
  { id: 'itachi', name: 'Итачи', anime: 'Naruto', element: 'dark', atk: 155, hp: 560, rarity: 4, summonable: true, spriteFacesLeft: true, skill: 'itachi' },
  { id: 'kurumi', name: 'Куруми', anime: 'Date A Live', element: 'dark', atk: 150, hp: 580, rarity: 4, summonable: true, skill: 'kurumi' },
  { id: 'saitama', name: 'Сайтама', anime: 'One Punch Man', element: 'light', atk: 170, hp: 620, rarity: 5, summonable: true, skill: 'saitama' },
  { id: 'mikasa', name: 'Микаса', anime: 'Attack on Titan', element: 'earth', atk: 160, hp: 600, rarity: 4, unlock: { chapter: 2 }, skill: 'mikasa' },
  { id: 'rengoku', name: 'Ренгоку', anime: 'Demon Slayer', element: 'fire', atk: 170, hp: 650, rarity: 5, unlock: { chapter: 3 }, skill: 'rengoku' },
  { id: 'gojo', name: 'Годжо', anime: 'Jujutsu Kaisen', element: 'light', atk: 175, hp: 600, rarity: 5, unlock: { chapter: 4 }, skill: 'gojo' },
];

const SPIRIT_BASE = { anime: 'Духи Аквы', rarity: 1, kind: 'spirit', maxLevel: 10, battleScale: 0.75 } as const;
const SPIRIT_DEFS: CardDef[] = [
  // Саламандра и Тень — широкие четвероногие: ниже ростом, иначе выглядят крупнее героев.
  { ...SPIRIT_BASE, id: 'spirit_fire', name: 'Саламандра', element: 'fire', atk: 72, hp: 330, battleScale: 0.62, skill: 'spirit_fire' },
  { ...SPIRIT_BASE, id: 'spirit_water', name: 'Ундина', element: 'water', atk: 66, hp: 360, hover: 22, skill: 'spirit_water' },
  { ...SPIRIT_BASE, id: 'spirit_earth', name: 'Дриада', element: 'earth', atk: 68, hp: 350, skill: 'spirit_earth' },
  { ...SPIRIT_BASE, id: 'spirit_light', name: 'Светлячок', element: 'light', atk: 72, hp: 320, battleScale: 0.68, hover: 30, skill: 'spirit_light' },
  { ...SPIRIT_BASE, id: 'spirit_dark', name: 'Тень', element: 'dark', atk: 76, hp: 310, battleScale: 0.62, skill: 'spirit_dark' },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries([...HEROES, ...SPIRIT_DEFS].map((c) => [c.id, c]));

/** Из кого игрок выбирает первого героя. */
export const STARTERS = ['naruto', 'rem', 'zoro'];

export const HERO_IDS = HEROES.map((c) => c.id);
export const SPIRIT_IDS = SPIRIT_DEFS.map((c) => c.id);

export function isSpirit(def: CardDef): boolean {
  return def.kind === 'spirit';
}

export function spiritOf(element: Element): CardDef {
  return SPIRIT_DEFS.find((s) => s.element === element)!;
}

/** Стартовая команда: выбранный герой и духи остальных стихий. */
export function starterTeam(starterId: string): string[] {
  const starter = CARDS[starterId];
  return [starterId, ...ELEMENTS.filter((e) => e !== starter.element).map((e) => spiritOf(e).id)];
}

/** Где взять героя — подсказка на закрытой карточке коллекции. */
export function unlockHint(def: CardDef): string {
  if (def.unlock?.stage) return `Сюжет: после ${def.unlock.stage}`;
  if (def.unlock?.chapter) return `Сюжет: гл. ${def.unlock.chapter}`;
  if (def.summonable) return `Призыв ★${def.rarity}`;
  return '';
}
