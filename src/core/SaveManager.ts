import { CARDS, STARTER_TEAM } from '../data/cards';
import type { Element } from '../data/elements';

export interface OwnedCard {
  id: string;
  level: number;
}

export interface StoryProgress {
  /** Лучший результат по этапам: id этапа → звёзды (1–3). Есть запись — этап пройден. */
  stars: Record<string, number>;
  /** Главы, за прохождение которых награда уже выдана. */
  chaptersClaimed: number[];
  /** Собранные Камни Духа. */
  spiritStones: Element[];
}

export interface SaveData {
  version: 2;
  gold: number;
  cards: Record<string, OwnedCard>;
  /** Состав команды: id карт, первая — лидер. */
  team: string[];
  story: StoryProgress;
}

const KEY = 'spirit-stones-anime/save';
export const TEAM_SIZE = 5;

function freshStory(): StoryProgress {
  return { stars: {}, chaptersClaimed: [], spiritStones: [] };
}

function fresh(): SaveData {
  return {
    version: 2,
    gold: 500,
    cards: Object.fromEntries(Object.keys(CARDS).map((id) => [id, { id, level: 1 }])),
    team: [...STARTER_TEAM],
    story: freshStory(),
  };
}

/** Старые сохранения (v1) не знают про сюжет — дополняем недостающие поля. */
function migrate(data: Partial<SaveData>): SaveData {
  const base = fresh();
  const story = { ...freshStory(), ...(data.story ?? {}) };
  return {
    ...base,
    ...data,
    version: 2,
    cards: data.cards ?? base.cards,
    team: data.team ?? base.team,
    story,
  };
}

let cache: SaveData | null = null;

export const Save = {
  get(): SaveData {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? migrate(JSON.parse(raw) as Partial<SaveData>) : fresh();
    } catch {
      cache = fresh();
    }
    // Карты могли удалить из data/cards.ts после сохранения.
    for (const id of Object.keys(cache.cards)) if (!CARDS[id]) delete cache.cards[id];
    // Пока нет призыва, вся коллекция открыта сразу — включая персонажей, добавленных после сохранения.
    for (const id of Object.keys(CARDS)) cache.cards[id] ??= { id, level: 1 };
    cache.team = cache.team.filter((id) => cache!.cards[id]);
    return cache;
  },

  write(): void {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
  },

  reset(): void {
    cache = fresh();
    this.write();
  },
};
