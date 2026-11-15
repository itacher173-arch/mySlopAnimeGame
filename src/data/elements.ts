export const ELEMENTS = ['fire', 'water', 'earth', 'light', 'dark'] as const;
export type Element = (typeof ELEMENTS)[number];

export const ELEMENT_COLOR: Record<Element, number> = {
  fire: 0xe8452c,
  water: 0x2f8fe8,
  earth: 0x3fb34f,
  light: 0xf2c531,
  dark: 0x9a4ad9,
};

export const ELEMENT_NAME: Record<Element, string> = {
  fire: 'Огонь',
  water: 'Вода',
  earth: 'Земля',
  light: 'Свет',
  dark: 'Тьма',
};

const BEATS: Record<Element, Element> = {
  fire: 'earth',
  earth: 'water',
  water: 'fire',
  light: 'dark',
  dark: 'light',
};

export function elementMultiplier(attacker: Element, defender: Element): number {
  if (BEATS[attacker] === defender) return 1.5;
  if (BEATS[defender] === attacker) return 0.75;
  return 1;
}
