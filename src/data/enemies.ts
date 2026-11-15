import type { Element } from './elements';

export interface EnemyDef {
  id: string;
  name: string;
  anime: string;
  element: Element;
  hp: number;
  atk: number;
  /** Сколько ходов игрока между атаками врага. */
  cooldown: number;
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
  },
};
