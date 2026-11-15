import { CARDS, STARTER_TEAM } from '../data/cards';

export interface OwnedCard {
  id: string;
  level: number;
}

export interface SaveData {
  version: 1;
  gold: number;
  cards: Record<string, OwnedCard>;
  /** Состав команды: id карт, первая — лидер. */
  team: string[];
}

const KEY = 'spirit-stones-anime/save';
export const TEAM_SIZE = 5;

function fresh(): SaveData {
  return {
    version: 1,
    gold: 500,
    cards: Object.fromEntries(Object.keys(CARDS).map((id) => [id, { id, level: 1 }])),
    team: [...STARTER_TEAM],
  };
}

let cache: SaveData | null = null;

export const Save = {
  get(): SaveData {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as SaveData) : fresh();
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
