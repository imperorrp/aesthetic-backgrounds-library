/**
 * Cells: a hex grid laid over the world, for territory, infestation, or anything that
 * spreads place to place.
 *
 * Pointy-top hexes in axial coordinates (q, r). Cells are created on demand (`cell(q, r)`
 * or `forEachIn(rect)`), so the grid streams with the map and only what has been seen
 * exists. Each cell keeps an owner, a 0..1 `hold` (how firmly it is held, which attackers
 * wear down), a free `value`, and a short history of who held it and when (for heat maps).
 *
 *   const grid = createHexGrid(46, (q, r, x, y) => ({ owner: x < 600 ? 0 : 1 }));
 *   grid.at(x, y)                       // the cell under a world point
 *   grid.neighbors(c)                   // six around it
 *   grid.forEachIn({ left, right, top, bottom }, (c) => ...)
 *   grid.setOwner(c, 1, t)              // records history
 *   grid.corners(c)                     // for drawing
 */

export type Cell = {
  q: number;
  r: number;
  /** Center in world units. */
  x: number;
  y: number;
  /** -1 for nobody. */
  owner: number;
  /** 0..1: how firmly the owner holds it. */
  hold: number;
  /** Free slot for the owning mechanic (fortification, infestation level, ...). */
  value: number;
  /** Who held it before, most recent last: [owner, since]. */
  history: [number, number][];
  /** Sim time of the last change of owner. */
  since: number;
};

export type HexGrid = {
  readonly size: number;
  cell(q: number, r: number): Cell;
  /** The cell under a world point. */
  at(x: number, y: number): Cell;
  neighbors(c: Cell): Cell[];
  forEachIn(rect: { left: number; right: number; top: number; bottom: number }, fn: (c: Cell) => void): void;
  setOwner(c: Cell, owner: number, t: number): void;
  /** The six corners, flat x,y pairs. */
  corners(c: Cell): number[];
  /** Forget cells left of x (the map has moved on). */
  prune(minX: number): void;
  readonly count: number;
};

const SQRT3 = Math.sqrt(3);

/** A stable 0..1 per cell (or any integer pair): seeding and jitter that never depend on visiting order. */
export function cellHash(q: number, r: number): number {
  let h = Math.imul(q, 374761393) + Math.imul(r, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export function createHexGrid(size: number, seed: (q: number, r: number, x: number, y: number) => Partial<Cell>): HexGrid {
  const cells = new Map<string, Cell>();
  const key = (q: number, r: number) => `${q},${r}`;

  const cell = (q: number, r: number): Cell => {
    const k = key(q, r);
    let c = cells.get(k);
    if (!c) {
      const x = size * SQRT3 * (q + r / 2);
      const y = size * 1.5 * r;
      c = { q, r, x, y, owner: -1, hold: 1, value: 0, history: [], since: -Infinity, ...seed(q, r, x, y) };
      cells.set(k, c);
    }
    return c;
  };

  /** Round fractional axial coordinates to the containing hex. */
  const round = (fq: number, fr: number): [number, number] => {
    const fs = -fq - fr;
    let q = Math.round(fq);
    let r = Math.round(fr);
    const s = Math.round(fs);
    const dq = Math.abs(q - fq);
    const dr = Math.abs(r - fr);
    const ds = Math.abs(s - fs);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return [q, r];
  };

  return {
    size,
    cell,
    at(x, y) {
      const fq = ((SQRT3 / 3) * x - (1 / 3) * y) / size;
      const fr = ((2 / 3) * y) / size;
      const [q, r] = round(fq, fr);
      return cell(q, r);
    },
    neighbors: (c) => DIRS.map(([dq, dr]) => cell(c.q + dq, c.r + dr)),
    forEachIn(rect, fn) {
      const r0 = Math.floor(rect.top / (size * 1.5)) - 1;
      const r1 = Math.ceil(rect.bottom / (size * 1.5)) + 1;
      for (let r = r0; r <= r1; r++) {
        const q0 = Math.floor(rect.left / (size * SQRT3) - r / 2) - 1;
        const q1 = Math.ceil(rect.right / (size * SQRT3) - r / 2) + 1;
        for (let q = q0; q <= q1; q++) fn(cell(q, r));
      }
    },
    setOwner(c, owner, t) {
      if (c.owner === owner) return;
      c.history.push([c.owner, c.since]);
      if (c.history.length > 4) c.history.shift();
      c.owner = owner;
      c.since = t;
    },
    corners(c) {
      const out: number[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        out.push(c.x + size * Math.cos(a), c.y + size * Math.sin(a));
      }
      return out;
    },
    prune(minX) {
      for (const [k, c] of cells) if (c.x < minX) cells.delete(k);
    },
    get count() {
      return cells.size;
    },
  };
}
