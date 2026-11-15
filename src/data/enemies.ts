import type { Element } from './elements';

export type EnemyRank = 'normal' | 'elite' | 'boss';

/** Особые свойства врагов — бой читает их из данных, без отдельного кода под каждого босса. */
export type EnemyTrait =
  /** Пока жив любой другой враг волны, получает только `mult` урона. */
  | { kind: 'guarded'; mult: number }
  /** Каждые `every` ходов призывает `enemyId`, если врагов на поле меньше `max`. */
  | { kind: 'summon'; enemyId: string; every: number; max: number };

export interface EnemyDef {
  id: string;
  name: string;
  anime: string;
  element: Element;
  hp: number;
  atk: number;
  /** Сколько ходов игрока между атаками врага. */
  cooldown: number;
  rank?: EnemyRank;
  /** Высота спрайта в бою, px (ступни — в точке слота). */
  height?: number;
  /** Спрайт нарисован смотрящим вправо — в бою (враги справа) его нужно отразить. */
  spriteFacesRight?: boolean;
  traits?: EnemyTrait[];
}

export const ENEMIES: Record<string, EnemyDef> = {
  sukuna: {
    id: 'sukuna',
    name: 'Сукуна',
    anime: 'Jujutsu Kaisen',
    element: 'dark',
    hp: 4500,
    atk: 450,
    cooldown: 3,
    rank: 'boss',
    height: 380,
  },

  // ---------- Глава 1: Лес Новичков ----------
  slime: {
    id: 'slime',
    name: 'Слизень',
    anime: 'KonoSuba',
    element: 'water',
    hp: 300,
    atk: 45,
    cooldown: 2,
    height: 110,
  },
  frog: {
    id: 'frog',
    name: 'Гигантская жаба',
    anime: 'KonoSuba',
    element: 'earth',
    hp: 1300,
    atk: 130,
    cooldown: 4,
    height: 230,
  },
  goblin: {
    id: 'goblin',
    name: 'Гоблин',
    anime: 'Goblin Slayer',
    element: 'earth',
    hp: 380,
    atk: 60,
    cooldown: 3,
    height: 150,
  },
  goblin_archer: {
    id: 'goblin_archer',
    name: 'Гоблин-лучник',
    anime: 'Goblin Slayer',
    element: 'fire',
    hp: 420,
    atk: 80,
    cooldown: 2,
    height: 150,
  },
  hobgoblin: {
    id: 'hobgoblin',
    name: 'Хобгоблин',
    anime: 'Goblin Slayer',
    element: 'earth',
    hp: 1900,
    atk: 170,
    cooldown: 3,
    rank: 'elite',
    height: 250,
  },
  goblin_king: {
    id: 'goblin_king',
    name: 'Король Гоблинов',
    anime: 'Goblin Slayer',
    element: 'earth',
    hp: 3000,
    atk: 170,
    cooldown: 3,
    rank: 'boss',
    height: 330,
    traits: [
      { kind: 'guarded', mult: 0.5 },
      { kind: 'summon', enemyId: 'goblin', every: 3, max: 3 },
    ],
  },
};
