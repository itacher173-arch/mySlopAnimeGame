/** Пороги длины цепочки. Эффект с 5 камней сюда не входит: его заменяют эти ступени. */
export interface ChainTier {
  /** Подпись на бейдже, пока игрок ведёт цепочку. */
  name: 'Удар' | 'Заряд' | 'Усиление' | 'Приём';
  /** Множитель поверх обычного бонуса длины. */
  damageMultiplier: number;
  /** Сколько делений добавить. Не используется, если fill. */
  charge: number;
  /** Заполнить шкалу навыка до максимума. */
  fill: boolean;
  /** Стихийный приём после атак. */
  technique: boolean;
}

export const SKILL_CHARGE_MAX = 3;
/** Общий щит команды не превышает эту долю максимального HP. */
export const SHIELD_CAP_RATIO = 0.25;

export function chainTier(length: number): ChainTier {
  if (length >= 10) return { name: 'Приём', damageMultiplier: 1.6, charge: 0, fill: true, technique: true };
  if (length >= 7) return { name: 'Усиление', damageMultiplier: 1.25, charge: 2, fill: false, technique: false };
  if (length >= 4) return { name: 'Заряд', damageMultiplier: 1, charge: 1, fill: false, technique: false };
  return { name: 'Удар', damageMultiplier: 1, charge: 0, fill: false, technique: false };
}

export function nextCharge(current: number, length: number): number {
  const tier = chainTier(length);
  if (tier.fill) return SKILL_CHARGE_MAX;
  return Math.min(SKILL_CHARGE_MAX, current + tier.charge);
}

/** Доля максимального HP, которую приём восстанавливает. */
export function techniqueHealRatio(element: string): number {
  if (element === 'water') return 0.12;
  if (element === 'light') return 0.08;
  return 0;
}

/** Доля максимального HP, которую приём добавляет щитом. */
export function techniqueShieldRatio(element: string): number {
  if (element === 'earth') return 0.12;
  if (element === 'light') return 0.08;
  return 0;
}

/** Доля урона последней атаки, которую огонь наносит каждому живому врагу. */
export function techniqueSplashRatio(element: string): number {
  return element === 'fire' ? 0.7 : 0;
}

/** На сколько ходов приём тьмы откладывает атаку каждого врага. */
export function techniqueDelay(element: string): number {
  return element === 'dark' ? 1 : 0;
}
