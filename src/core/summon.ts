import { CARDS, HERO_IDS, type CardDef } from '../data/cards';
import { acquireHero, owns, type Acquire } from './collection';
import { Save } from './SaveManager';

export const SUMMON_COST = 30;
/** В каждых PITY_EVERY призывах хотя бы один новый герой, пока такие остались. */
export const PITY_EVERY = 5;
const RARITY_WEIGHT: Record<number, number> = { 3: 60, 4: 30, 5: 10 };

export type Payment = 'crystals' | 'ticket';

export interface PullResult {
  def: CardDef;
  acquire: Acquire;
  /** Сработала гарантия нового героя. */
  pity: boolean;
}

/** Герои с summonable, кроме выбранного стартера. */
export function summonPool(): CardDef[] {
  const starter = Save.get().starter;
  return HERO_IDS.map((id) => CARDS[id]).filter((d) => d.summonable && d.id !== starter);
}

/** Шансы по редкости, перенормированные на то, что реально есть в пуле. */
export function rarityRates(pool = summonPool()): { rarity: number; chance: number }[] {
  const rarities = [...new Set(pool.map((d) => d.rarity))].sort();
  const total = rarities.reduce((s, r) => s + (RARITY_WEIGHT[r] ?? 0), 0);
  return rarities.map((r) => ({ rarity: r, chance: (RARITY_WEIGHT[r] ?? 0) / total }));
}

export function pullsUntilPity(): number | null {
  if (!summonPool().some((d) => !owns(d.id))) return null;
  return PITY_EVERY - Save.get().pullsSinceNew;
}

export function canPull(pay: Payment): boolean {
  const save = Save.get();
  return pay === 'ticket' ? save.tickets > 0 : save.crystals >= SUMMON_COST;
}

export function pull(pay: Payment, rand = Math.random): PullResult | null {
  const save = Save.get();
  if (!canPull(pay) || summonPool().length === 0) return null;
  if (pay === 'ticket') save.tickets--;
  else save.crystals -= SUMMON_COST;

  const unowned = summonPool().filter((d) => !owns(d.id));
  const pity = unowned.length > 0 && save.pullsSinceNew >= PITY_EVERY - 1;
  const pool = pity ? unowned : summonPool();

  let roll = rand();
  let rarity = 0;
  for (const r of rarityRates(pool)) {
    rarity = r.rarity;
    if ((roll -= r.chance) < 0) break;
  }
  const candidates = pool.filter((d) => d.rarity === rarity);
  const def = candidates[Math.floor(rand() * candidates.length)];

  const acquire = acquireHero(def.id);
  save.pullsSinceNew = acquire.kind === 'new' ? 0 : save.pullsSinceNew + 1;
  Save.write();
  return { def, acquire, pity };
}
