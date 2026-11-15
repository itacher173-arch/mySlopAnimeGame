import { ELEMENTS, type Element } from '../data/elements';

export interface Pos {
  r: number;
  c: number;
}

export interface MatchGroup {
  element: Element;
  cells: Pos[];
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

export class BoardModel {
  grid: Cell[][] = [];

  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.fillInitial();
  }

  static adjacent(a: Pos, b: Pos): boolean {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  get(p: Pos): Cell {
    return this.grid[p.r][p.c];
  }

  swap(a: Pos, b: Pos): void {
    const t = this.grid[a.r][a.c];
    this.grid[a.r][a.c] = this.grid[b.r][b.c];
    this.grid[b.r][b.c] = t;
  }

  fillInitial(): void {
    do {
      this.grid = Array.from({ length: this.rows }, () => Array<Cell>(this.cols).fill(null));
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          let e: Element;
          do {
            e = randomElement();
          } while (this.wouldMatch(r, c, e));
          this.grid[r][c] = e;
        }
      }
    } while (!this.hasPossibleMove());
  }

  private wouldMatch(r: number, c: number, e: Element): boolean {
    const g = this.grid;
    return (c >= 2 && g[r][c - 1] === e && g[r][c - 2] === e) || (r >= 2 && g[r - 1][c] === e && g[r - 2][c] === e);
  }

  /** Находит все линии из 3+ камней; пересекающиеся линии одного цвета (L/T-формы) объединяются в одну группу. */
  findMatches(): MatchGroup[] {
    const g = this.grid;
    const runs: Pos[][] = [];

    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const e = g[r][c];
        let end = c + 1;
        while (e && end < this.cols && g[r][end] === e) end++;
        if (e && end - c >= 3) runs.push(range(c, end).map((cc) => ({ r, c: cc })));
        c = end;
      }
    }
    for (let c = 0; c < this.cols; c++) {
      let r = 0;
      while (r < this.rows) {
        const e = g[r][c];
        let end = r + 1;
        while (e && end < this.rows && g[end][c] === e) end++;
        if (e && end - r >= 3) runs.push(range(r, end).map((rr) => ({ r: rr, c })));
        r = end;
      }
    }

    const parent = runs.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map<number, number>();
    runs.forEach((run, i) => {
      for (const p of run) {
        const key = p.r * this.cols + p.c;
        const o = owner.get(key);
        if (o === undefined) owner.set(key, i);
        else parent[find(i)] = find(o);
      }
    });

    const groups = new Map<number, Map<number, Pos>>();
    runs.forEach((run, i) => {
      const root = find(i);
      if (!groups.has(root)) groups.set(root, new Map());
      for (const p of run) groups.get(root)!.set(p.r * this.cols + p.c, p);
    });

    return [...groups.values()].map((cells) => {
      const list = [...cells.values()];
      return { element: this.get(list[0])!, cells: list };
    });
  }

  hasPossibleMove(): boolean {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        for (const n of [
          { r, c: c + 1 },
          { r: r + 1, c },
        ]) {
          if (n.r >= this.rows || n.c >= this.cols) continue;
          const a = { r, c };
          this.swap(a, n);
          const ok = this.findMatches().length > 0;
          this.swap(a, n);
          if (ok) return true;
        }
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
      if (this.findMatches().length === 0 && this.hasPossibleMove()) return;
    }
    this.fillInitial();
  }
}

function randomElement(): Element {
  return ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, i) => from + i);
}
