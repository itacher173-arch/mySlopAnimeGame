import { ELEMENTS, type Element } from '../data/elements';

export interface Pos {
  r: number;
  c: number;
}

export interface Fall {
  c: number;
  fromR: number;
  toR: number;
}

export interface Spawn {
  c: number;
  r: number;
  element: Element;
  /** На сколько клеток выше своей позиции камень появляется перед падением. */
  offset: number;
}

type Cell = Element | null;

/** Поле в стиле Spirit Stones: игрок соединяет цепочку соседних (включая диагональ) камней одного цвета. */
export class BoardModel {
  grid: Cell[][] = [];

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly minChain: number,
  ) {
    this.fillInitial();
  }

  static adjacent(a: Pos, b: Pos): boolean {
    return Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1;
  }

  get(p: Pos): Cell {
    return this.grid[p.r][p.c];
  }

  fillInitial(): void {
    do {
      this.grid = Array.from({ length: this.rows }, () =>
        Array.from({ length: this.cols }, () => randomElement() as Cell),
      );
    } while (!this.hasChain());
  }

  /** Есть ли на поле хотя бы одна цепочка длиной minChain. */
  hasChain(): boolean {
    const seen = new Uint8Array(this.rows * this.cols);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (seen[r * this.cols + c]) continue;
        const e = this.grid[r][c];
        let size = 0;
        const stack: Pos[] = [{ r, c }];
        seen[r * this.cols + c] = 1;
        while (stack.length) {
          const p = stack.pop()!;
          size++;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const n = { r: p.r + dr, c: p.c + dc };
              if (n.r < 0 || n.r >= this.rows || n.c < 0 || n.c >= this.cols) continue;
              const k = n.r * this.cols + n.c;
              if (seen[k] || this.grid[n.r][n.c] !== e) continue;
              seen[k] = 1;
              stack.push(n);
            }
          }
        }
        if (e && size >= this.minChain) return true;
      }
    }
    return false;
  }

  clear(cells: Pos[]): void {
    for (const p of cells) this.grid[p.r][p.c] = null;
  }

  /** Сдвигает камни вниз в пустые клетки. Порядок падений важен для зеркалирования во view. */
  collapse(): Fall[] {
    const falls: Fall[] = [];
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r][c] === null) continue;
        if (r !== write) {
          this.grid[write][c] = this.grid[r][c];
          this.grid[r][c] = null;
          falls.push({ c, fromR: r, toR: write });
        }
        write--;
      }
    }
    return falls;
  }

  refill(): Spawn[] {
    const spawns: Spawn[] = [];
    for (let c = 0; c < this.cols; c++) {
      let empty = 0;
      while (empty < this.rows && this.grid[empty][c] === null) empty++;
      for (let r = 0; r < empty; r++) {
        const element = randomElement();
        this.grid[r][c] = element;
        spawns.push({ c, r, element, offset: empty });
      }
    }
    return spawns;
  }

  shuffle(): void {
    const all = this.grid.flat() as Element[];
    for (let attempt = 0; attempt < 100; attempt++) {
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
      }
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) this.grid[r][c] = all[r * this.cols + c];
      }
      if (this.hasChain()) return;
    }
    this.fillInitial();
  }
}

function randomElement(): Element {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
}
