import { describe, expect, it } from 'vitest';
import { chainTier, nextCharge, SKILL_CHARGE_MAX, techniqueDelay, techniqueHealRatio, techniqueShieldRatio, techniqueSplashRatio } from './chainTiers';
import { CARDS } from '../data/cards';
import { SKILLS } from '../data/skills';

describe('chainTier', () => {
  it('keeps a chain of 3 as a plain hit', () => {
    expect(chainTier(3)).toMatchObject({ name: 'Удар', damageMultiplier: 1, charge: 0, fill: false, technique: false });
  });

  it('charges from 4 and strengthens from 7', () => {
    expect(chainTier(4).charge).toBe(1);
    expect(chainTier(6).name).toBe('Заряд');
    expect(chainTier(7)).toMatchObject({ name: 'Усиление', damageMultiplier: 1.25, charge: 2 });
    expect(chainTier(9).technique).toBe(false);
  });

  it('turns 10 or more into an elemental technique and a full gauge', () => {
    expect(chainTier(10)).toMatchObject({ name: 'Приём', damageMultiplier: 1.6, fill: true, technique: true });
    expect(nextCharge(0, 10)).toBe(SKILL_CHARGE_MAX);
    expect(nextCharge(2, 7)).toBe(SKILL_CHARGE_MAX);
    expect(nextCharge(0, 4)).toBe(1);
    expect(nextCharge(0, 3)).toBe(0);
  });
});

describe('elemental technique', () => {
  it('assigns one reaction to each element', () => {
    expect(techniqueSplashRatio('fire')).toBe(0.7);
    expect(techniqueHealRatio('water')).toBe(0.12);
    expect(techniqueShieldRatio('earth')).toBe(0.12);
    expect(techniqueHealRatio('light')).toBe(0.08);
    expect(techniqueShieldRatio('light')).toBe(0.08);
    expect(techniqueDelay('dark')).toBe(1);
    expect(techniqueHealRatio('fire')).toBe(0);
    expect(techniqueSplashRatio('water')).toBe(0);
  });
});

describe('skills', () => {
  it('gives every card one defined skill', () => {
    for (const card of Object.values(CARDS)) expect(SKILLS[card.skill]?.name).toBeTruthy();
  });
});
