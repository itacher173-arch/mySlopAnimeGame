# Эффекты стихий по цепочке

Система ролей героев (attacker/defender/healer) удалена. Теперь бонус от цепочки
определяет **стихия** собранных камней, а не роль героя.

## Игровое правило

- Цепочка **3–4** камня — обычный удар без дополнительных эффектов.
- Цепочка **5+** камней активирует эффект стихии; чем длиннее цепочка, тем сильнее эффект.
- Огонь и Тьма — чистый урон (эффекта нет).
- Вода и Свет — лечение команды.
- Земля — щит команде.

## Изменённые файлы

### `src/battle/roles.ts` (переписан)

```typescript
export type ChainEffect = 'heal' | 'shield' | 'none';
export const EFFECT_MIN_CHAIN = 5;

export function elementChainEffect(element: Element): ChainEffect {
  // water/light -> 'heal', earth -> 'shield', fire/dark -> 'none'
}

export function healForChain(teamMaxHp, chainLength): number {
  const basePercent = 0.06 + 0.02 * (chainLength - EFFECT_MIN_CHAIN);
  return Math.round(teamMaxHp * basePercent);
}

export function shieldForChain(teamMaxHp, chainLength): number {
  const basePercent = 0.08 + 0.02 * (chainLength - EFFECT_MIN_CHAIN);
  return Math.round(teamMaxHp * basePercent);
}
```

### `src/data/cards.ts`

- Удалены тип `HeroRole`, поле `role` у героев и духов, карты `ROLE_NAME`/`ROLE_SHORT`.

### `src/scenes/BattleScene.ts`

- `heroAttack` наносит одинаковый урон (без множителя роли и без встроенного
  щита/лечения).
- Эффект стихии применяется один раз за ход в `applyChainEffect(element, chainLength)`
  при `chainLength >= 5`.
- Подсказка по стихиям описывает эффект стихии, а не роли.

### `src/ui/widgets.ts`

- Убран бейдж роли с карточки персонажа.
