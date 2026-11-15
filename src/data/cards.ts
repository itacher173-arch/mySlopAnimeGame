import type { Element } from './elements';

export interface CardDef {
  id: string;
  name: string;
  anime: string;
  element: Element;
  atk: number;
  hp: number;
  /** Боевой спрайт нарисован смотрящим влево — в бою героя нужно отразить. */
  spriteFacesLeft?: boolean;
}

export const CARDS: Record<string, CardDef> = {
  rengoku: { id: 'rengoku', name: 'Ренгоку', anime: 'Demon Slayer', element: 'fire', atk: 150, hp: 600 },
  rem: { id: 'rem', name: 'Рем', anime: 'Re:Zero', element: 'water', atk: 130, hp: 560 },
  zoro: { id: 'zoro', name: 'Зоро', anime: 'One Piece', element: 'earth', atk: 145, hp: 640, spriteFacesLeft: true },
  saitama: { id: 'saitama', name: 'Сайтама', anime: 'One Punch Man', element: 'light', atk: 140, hp: 580 },
  itachi: { id: 'itachi', name: 'Итачи', anime: 'Naruto', element: 'dark', atk: 155, hp: 520, spriteFacesLeft: true },
  naruto: { id: 'naruto', name: 'Наруто', anime: 'Naruto', element: 'fire', atk: 135, hp: 680 },
  aqua: { id: 'aqua', name: 'Аква', anime: 'KonoSuba', element: 'water', atk: 115, hp: 700 },
  mikasa: { id: 'mikasa', name: 'Микаса', anime: 'Attack on Titan', element: 'earth', atk: 160, hp: 540 },
  gojo: { id: 'gojo', name: 'Годжо', anime: 'Jujutsu Kaisen', element: 'light', atk: 165, hp: 560 },
  kurumi: { id: 'kurumi', name: 'Куруми', anime: 'Date A Live', element: 'dark', atk: 150, hp: 550 },
};

export const STARTER_TEAM = ['rengoku', 'rem', 'zoro', 'saitama', 'itachi'];
