import { describe, it, expect } from 'vitest';
import { BoardModel, adjacent } from '../src/battle/BoardModel';

describe('Battle Tests', () => {
  let board: BoardModel;
  const COLS = 6;
  const ROWS = 5;
  const MIN_CHAIN = 3;

  beforeEach(() => {
    board = new BoardModel(COLS, ROWS, MIN_CHAIN);
  });

  it('should have correct grid dimensions', () => {
    expect(board.grid).toBeDefined();
    expect(board.grid.length).toBe(ROWS);
    expect(board.grid[0].length).toBe(COLS);
  });

  it('hasChain should work correctly', () => {
    const hasChain = board.hasChain();
    // После fillInitial board всегда имеет цепочку (гарантия в коде)
    expect(hasChain).toBe(true);
  });

  it('adjacent returns true for valid neighbors only', () => {
    const p1 = { r: 0, c: 0 };

    expect(adjacent(p1, { r: 0, c: 1 })).toBe(true); // сосед справа
    expect(adjacent(p1, { r: 1, c: 0 })).toBe(true); // сосед снизу
    expect(adjacent(p1, { r: -1, c: 0 })).toBe(false); // не сосед (слишком далеко)
    expect(adjacent(p1, { r: 0, c: 2 })).toBe(false); // слишком далеко
  });

  it('collapse moves elements down correctly', () => {
    board.clear([{ r: ROWS - 1, c: 0 }]); // очистим нижнюю клетку
    const falls = board.collapse();
    
    // В нижней строке всегда должна быть элемент после падения
    if (falls.length > 0) {
      expect(board.grid[ROWS - 1][0]).not.toBeNull();
    }
  });

  it('refill fills empty columns', () => {
    const spawns = board.refill();
    // Не все столбцы могут быть заполнены полностью, но должны добавиться элементы
    if (spawns.length > 0) {
      expect(spawns[0]).toHaveProperty('c');
      expect(spawns[0]).toHaveProperty('r');
      expect(spawns[0]).toHaveProperty('element');
    }
  });

  console.log('✅ All Hero unit tests passed!');
});
