import type { CardDef } from '../data/cards';

export const MAX_LEVEL = 30;
const GROWTH_PER_LEVEL = 0.08;
export const MAX_AWAKENING = 5;
const AWAKENING_BONUS = 0.1;

export interface Stats {
  atk: number;
  hp: number;
}

export function maxLevel(def: CardDef): number {
  return def.maxLevel ?? MAX_LEVEL;
}

/** Каждое пробуждение (повтор из призыва) даёт +10% атаки и HP. */
export function cardStats(def: CardDef, level: number, awakening = 0): Stats {
  const k = (1 + GROWTH_PER_LEVEL * (level - 1)) * (1 + AWAKENING_BONUS * awakening);
  return { atk: Math.round(def.atk * k), hp: Math.round(def.hp * k) };
}

export function upgradeCost(level: number): number {
  return 100 * level;
}

export const REWARD_WIN = 300;
export const REWARD_LOSS = 50;
