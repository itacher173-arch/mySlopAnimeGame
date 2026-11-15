import type { Element } from './elements';

export interface CardDef {
  id: string;
  name: string;
  anime: string;
  element: Element;
  atk: number;
  hp: number;
}

export const CARDS: Record<string, CardDef> = {
  rengoku: { id: 'rengoku', name: 'Ренгоку', anime: 'Demon Slayer', element: 'fire', atk: 150, hp: 600 },
  rem: { id: 'rem', name: 'Рем', anime: 'Re:Zero', element: 'water', atk: 130, hp: 560 },
  zoro: { id: 'zoro', name: 'Зоро', anime: 'One Piece', element: 'earth', atk: 145, hp: 640 },
  saitama: { id: 'saitama', name: 'Сайтама', anime: 'One Punch Man', element: 'light', atk: 140, hp: 580 },
  itachi: { id: 'itachi', name: 'Итачи', anime: 'Naruto', element: 'dark', atk: 155, hp: 520 },
};

export const STARTER_TEAM = ['rengoku', 'rem', 'zoro', 'saitama', 'itachi'];
