import { CARDS, HERO_IDS, isSpirit, starterTeam } from '../data/cards';
import { MAX_AWAKENING } from './progression';
import { Save, TEAM_SIZE } from './SaveManager';

/** Золото за повтор героя, у которого уже все пробуждения. */
export const MAXED_DUPLICATE_GOLD = 500;

export type Acquire = { kind: 'new' } | { kind: 'awaken'; awakening: number } | { kind: 'gold'; gold: number };

export function owns(id: string): boolean {
  return !!Save.get().cards[id];
}

export function chooseStarter(id: string): void {
  const save = Save.get();
  save.cards[id] = { id, level: 1, awakening: 0 };
  save.starter = id;
  save.team = starterTeam(id);
  save.started = true;
  Save.write();
}

/** Выдать героя: новый — в коллекцию (и в команду вместо духа своей стихии), повтор — пробуждение или золото. */
export function acquireHero(id: string): Acquire {
  const save = Save.get();
  const owned = save.cards[id];
  let result: Acquire;
  if (!owned) {
    save.cards[id] = { id, level: 1, awakening: 0 };
    placeInTeam(id);
    result = { kind: 'new' };
  } else if (owned.awakening < MAX_AWAKENING) {
    owned.awakening++;
    result = { kind: 'awaken', awakening: owned.awakening };
  } else {
    save.gold += MAXED_DUPLICATE_GOLD;
    result = { kind: 'gold', gold: MAXED_DUPLICATE_GOLD };
  }
  Save.write();
  return result;
}

/** Сюжетный герой выдаётся один раз и без пробуждений. Возвращает true, если он новый. */
export function grantStoryHero(id: string): boolean {
  if (owns(id)) return false;
  acquireHero(id);
  return true;
}

/** Новый герой занимает слот духа своей стихии; дух уходит в запас. */
function placeInTeam(id: string): void {
  const save = Save.get();
  const element = CARDS[id].element;
  const slot = save.team.findIndex((t) => isSpirit(CARDS[t]) && CARDS[t].element === element);
  if (slot >= 0) save.team[slot] = id;
  else if (save.team.length < TEAM_SIZE) save.team.push(id);
}

/** Сюжетные герои, которые открываются этим этапом или главой. */
export function storyHeroesFor(trigger: { stage?: string; chapter?: number }): string[] {
  return HERO_IDS.filter((id) => {
    const u = CARDS[id].unlock;
    return !!u && ((trigger.stage && u.stage === trigger.stage) || (trigger.chapter && u.chapter === trigger.chapter));
  });
}
