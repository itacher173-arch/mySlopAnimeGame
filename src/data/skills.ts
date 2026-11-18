export type GuardMode = 'normal' | 'half' | 'ignore';

/** Один эффект. Навык не тратит ход. */
export type SkillEffect =
  | { kind: 'damage'; multiplier: number; hits?: number; guard?: GuardMode }
  | { kind: 'heal'; ratio: number }
  | { kind: 'shield'; ratio: number }
  | { kind: 'delay'; turns: number; all?: boolean }
  | { kind: 'convert'; count: number }
  | { kind: 'block' };

export interface SkillDef {
  id: string;
  name: string;
  effect: SkillEffect;
}

export const SKILLS: Record<string, SkillDef> = {
  naruto: { id: 'naruto', name: 'Расенган', effect: { kind: 'damage', multiplier: 2.2, guard: 'half' } },
  rem: { id: 'rem', name: 'Ледяная глыба', effect: { kind: 'delay', turns: 2 } },
  zoro: { id: 'zoro', name: 'Санторю', effect: { kind: 'damage', multiplier: 0.9, hits: 3 } },
  aqua: { id: 'aqua', name: 'Исцеление', effect: { kind: 'heal', ratio: 0.15 } },
  itachi: { id: 'itachi', name: 'Цукуёми', effect: { kind: 'delay', turns: 1, all: true } },
  kurumi: { id: 'kurumi', name: 'Зафар', effect: { kind: 'convert', count: 6 } },
  saitama: { id: 'saitama', name: 'Серьёзный удар', effect: { kind: 'damage', multiplier: 4 } },
  mikasa: { id: 'mikasa', name: 'Манёвр', effect: { kind: 'damage', multiplier: 2, guard: 'ignore' } },
  rengoku: { id: 'rengoku', name: 'Пламенный заслон', effect: { kind: 'shield', ratio: 0.12 } },
  gojo: { id: 'gojo', name: 'Бесконечность', effect: { kind: 'block' } },
  spirit_fire: { id: 'spirit_fire', name: 'Искра', effect: { kind: 'damage', multiplier: 1.4 } },
  spirit_water: { id: 'spirit_water', name: 'Капля', effect: { kind: 'heal', ratio: 0.06 } },
  spirit_earth: { id: 'spirit_earth', name: 'Корень', effect: { kind: 'shield', ratio: 0.06 } },
  spirit_light: { id: 'spirit_light', name: 'Вспышка', effect: { kind: 'heal', ratio: 0.05 } },
  spirit_dark: { id: 'spirit_dark', name: 'Шёпот', effect: { kind: 'delay', turns: 1 } },
};
