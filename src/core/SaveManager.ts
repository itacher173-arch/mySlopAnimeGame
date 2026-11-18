import { CARDS, HERO_IDS, SPIRIT_IDS } from '../data/cards';
import type { Element } from '../data/elements';

export interface OwnedCard {
  id: string;
  level: number;
  /** Пробуждения от повторов в призыве, 0–MAX_AWAKENING. */
  awakening: number;
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
  version: 3;
  /** Пролог пройден и стартер выбран (старые сохранения — сразу true). */
  started: boolean;
  starter: string | null;
  gold: number;
  crystals: number;
  /** Билеты бесплатного призыва. */
  tickets: number;
  /** Только полученные карты: духи есть всегда, герои — из стартера, сюжета и призыва. */
  cards: Record<string, OwnedCard>;
  /** Состав команды: id карт по слотам. */
  team: string[];
  /** Название команды. Пустое сохранение получает «5ка». */
  teamName: string;
  story: StoryProgress;
  /** Призывов подряд без нового героя — для гарантии. */
  pullsSinceNew: number;
}

const KEY = 'spirit-stones-anime/save';
export const TEAM_SIZE = 5;
export const DEFAULT_TEAM_NAME = '5ка';
const TEAM_NAME_LIMIT = 16;

function freshStory(): StoryProgress {
  return { stars: {}, chaptersClaimed: [], spiritStones: [] };
}

function fresh(): SaveData {
  return {
    version: 3,
    started: false,
    starter: null,
    gold: 500,
    crystals: 0,
    tickets: 0,
    cards: {},
    team: [],
    teamName: DEFAULT_TEAM_NAME,
    story: freshStory(),
    pullsSinceNew: 0,
  };
}

/** v1/v2 не знают про сюжет, валюту и стартера. В них была открыта вся коллекция — её и оставляем. */
function migrate(data: Partial<SaveData> & { version?: number }): SaveData {
  const base = fresh();
  const legacy = (data.version ?? 1) < 3;
  if (legacy) {
    data.cards ??= {};
    for (const id of HERO_IDS) data.cards[id] ??= { id, level: 1, awakening: 0 };
  }
  return {
    ...base,
    ...data,
    version: 3,
    started: data.started ?? (legacy && (data.team?.length ?? 0) > 0),
    cards: data.cards ?? base.cards,
    team: data.team ?? base.team,
    teamName: (data.teamName ?? '').trim().slice(0, TEAM_NAME_LIMIT) || DEFAULT_TEAM_NAME,
    story: { ...freshStory(), ...(data.story ?? {}) },
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
    for (const c of Object.values(cache.cards)) c.awakening ??= 0;
    // Духи принадлежат игроку всегда — в том числе в сохранениях, сделанных до их появления.
    for (const id of SPIRIT_IDS) cache.cards[id] ??= { id, level: 1, awakening: 0 };
    cache.team = cache.team.filter((id, i, all) => cache!.cards[id] && all.indexOf(id) === i);
    // Команда могла уменьшиться (удалённые карты, старые версии) — недостающие стихии закрывают духи.
    if (cache.started) {
      for (const id of SPIRIT_IDS) {
        if (cache.team.length >= TEAM_SIZE) break;
        const e = CARDS[id].element;
        if (!cache.team.some((t) => CARDS[t].element === e)) cache.team.push(id);
      }
    }
    return cache;
  },

  write(): void {
    if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
  },

  reset(): void {
    cache = null;
    localStorage.removeItem(KEY);
    this.get();
    this.write();
  },
};
