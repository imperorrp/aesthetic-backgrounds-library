/**
 * Lenia: a continuous cellular automaton (Bert Chan's), on a torus of N × N cells.
 *
 * Each cell holds a value in [0, 1]. Each step, every cell looks at a ring of its
 * neighbours (a smooth shell kernel of radius R), and grows or shrinks by how close that
 * neighbourhood is to a sweet spot (a gaussian of mu and sigma). From that alone come
 * gliding, breathing creatures. The neighbourhood sum is a convolution, done with FFTs, so
 * a step costs a few hundred thousand butterflies, not millions of multiplies.
 *
 * DOM-free: the dish steps it headless.
 */

/** In-place radix-2 FFT of one line (length a power of two), stride `s` from `o`. */
function fft1(re: Float64Array, im: Float64Array, o: number, s: number, n: number, inv: boolean, cos: Float64Array, sin: Float64Array, rev: Uint16Array) {
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = o + i * s;
      const b = o + j * s;
      let t = re[a];
      re[a] = re[b];
      re[b] = t;
      t = im[a];
      im[a] = im[b];
      im[b] = t;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step];
        const wi = inv ? sin[k * step] : -sin[k * step];
        const a = o + (i + k) * s;
        const b = o + (i + k + half) * s;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

export type LeniaRule = { R: number; mu: number; sigma: number; dt: number };

/** The rule of the gliders (Orbium's): a single smooth ring. */
export const ORBIUM: LeniaRule = { R: 13, mu: 0.15, sigma: 0.015, dt: 0.1 };

/** Orbium itself, 20 × 20, as Chan published it: it glides, nose first, about a cell every few steps. */
export const ORBIUM_CELLS = [
  [0, 0, 0, 0, 0, 0, 0.1, 0.14, 0.1, 0, 0, 0.03, 0.03, 0, 0, 0.3, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0.08, 0.24, 0.3, 0.3, 0.18, 0.14, 0.15, 0.16, 0.15, 0.09, 0.2, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0.15, 0.34, 0.44, 0.46, 0.38, 0.18, 0.14, 0.11, 0.13, 0.19, 0.18, 0.45, 0, 0, 0],
  [0, 0, 0, 0, 0.06, 0.13, 0.39, 0.5, 0.5, 0.37, 0.06, 0, 0, 0, 0.02, 0.16, 0.68, 0, 0, 0],
  [0, 0, 0, 0.11, 0.17, 0.17, 0.33, 0.4, 0.38, 0.28, 0.14, 0, 0, 0, 0, 0, 0.18, 0.42, 0, 0],
  [0, 0, 0.09, 0.18, 0.13, 0.06, 0.08, 0.26, 0.32, 0.32, 0.27, 0, 0, 0, 0, 0, 0, 0.82, 0, 0],
  [0.27, 0, 0.16, 0.12, 0, 0, 0, 0.25, 0.38, 0.44, 0.45, 0.34, 0, 0, 0, 0, 0, 0.22, 0.17, 0],
  [0, 0.07, 0.2, 0.02, 0, 0, 0, 0.31, 0.48, 0.57, 0.6, 0.57, 0, 0, 0, 0, 0, 0, 0.49, 0],
  [0, 0.59, 0.19, 0, 0, 0, 0, 0.2, 0.57, 0.69, 0.76, 0.76, 0.49, 0, 0, 0, 0, 0, 0.36, 0],
  [0, 0.58, 0.19, 0, 0, 0, 0, 0, 0.67, 0.83, 0.9, 0.92, 0.87, 0.12, 0, 0, 0, 0, 0.22, 0.07],
  [0, 0, 0.46, 0, 0, 0, 0, 0, 0.7, 0.93, 1, 1, 1, 0.61, 0, 0, 0, 0, 0.18, 0.11],
  [0, 0, 0.82, 0, 0, 0, 0, 0, 0.47, 1, 1, 0.98, 1, 0.96, 0.27, 0, 0, 0, 0.19, 0.1],
  [0, 0, 0.46, 0, 0, 0, 0, 0, 0.25, 1, 1, 0.84, 0.92, 0.97, 0.54, 0.14, 0.04, 0.1, 0.21, 0.05],
  [0, 0, 0, 0.4, 0, 0, 0, 0, 0.09, 0.8, 1, 0.82, 0.8, 0.85, 0.63, 0.31, 0.18, 0.19, 0.2, 0.01],
  [0, 0, 0, 0.36, 0.1, 0, 0, 0, 0.05, 0.54, 0.86, 0.79, 0.74, 0.72, 0.6, 0.39, 0.28, 0.24, 0.13, 0],
  [0, 0, 0, 0.01, 0.3, 0.07, 0, 0, 0.08, 0.36, 0.64, 0.7, 0.64, 0.6, 0.51, 0.39, 0.29, 0.19, 0.04, 0],
  [0, 0, 0, 0, 0.1, 0.24, 0.14, 0.1, 0.15, 0.29, 0.45, 0.53, 0.52, 0.46, 0.4, 0.31, 0.21, 0.08, 0, 0],
  [0, 0, 0, 0, 0, 0.08, 0.21, 0.21, 0.22, 0.29, 0.36, 0.39, 0.37, 0.33, 0.26, 0.18, 0.09, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0.03, 0.13, 0.19, 0.22, 0.24, 0.24, 0.23, 0.18, 0.13, 0.05, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0.02, 0.06, 0.08, 0.09, 0.07, 0.05, 0.01, 0, 0, 0, 0, 0],
];

export type Lenia = {
  n: number;
  A: Float32Array;
  /** Last step's growth at each cell (−1..1): where it is growing and where it is dying. */
  G: Float32Array;
  rule: LeniaRule;
  step(): void;
  /** Add a soft round blob of noise (a seed soup) centred at (x, y) cells. */
  seed(x: number, y: number, r: number, rnd: () => number, density?: number): void;
  /** Clear a round region (a reagent). */
  clear(x: number, y: number, r: number): void;
  /** Place a pattern (rows of values) at (x, y), turned a quarter turn `rot` times, mirrored if `flip`. */
  place(cells: number[][], x: number, y: number, rot: number, flip: boolean): void;
  mass(): number;
};

/**
 * `wall`: cells farther than this from the middle are kept empty (the dish's rim), so the
 * world is a round dish, not a torus.
 */
export function createLenia(n: number, rule: LeniaRule, wall = Infinity): Lenia {
  const N2 = n * n;
  const A = new Float32Array(N2);
  const inside = new Uint8Array(N2);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) inside[y * n + x] = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) < wall ? 1 : 0;
  const G = new Float32Array(N2);
  const re = new Float64Array(N2);
  const im = new Float64Array(N2);
  const kre = new Float64Array(N2);
  const kim = new Float64Array(N2);
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / n);
    sin[k] = Math.sin((2 * Math.PI * k) / n);
  }
  const bits = Math.log2(n);
  const rev = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    let x = i;
    let y = 0;
    for (let b = 0; b < bits; b++) {
      y = (y << 1) | (x & 1);
      x >>= 1;
    }
    rev[i] = y;
  }
  const fft2 = (r: Float64Array, i: Float64Array, inv: boolean) => {
    for (let row = 0; row < n; row++) fft1(r, i, row * n, 1, n, inv, cos, sin, rev);
    for (let col = 0; col < n; col++) fft1(r, i, col, n, n, inv, cos, sin, rev);
  };
  // The kernel: a smooth bump on a ring of radius R, normalized to sum to 1, centred at 0
  // (wrapped), transformed once.
  let sum = 0;
  for (let y = -rule.R; y <= rule.R; y++) {
    for (let x = -rule.R; x <= rule.R; x++) {
      const d = Math.hypot(x, y) / rule.R;
      if (d >= 1 || d === 0) continue;
      const v = Math.exp(4 - 4 / (4 * d * (1 - d)));
      const k = ((y + n) % n) * n + ((x + n) % n);
      kre[k] = v;
      sum += v;
    }
  }
  for (let k = 0; k < N2; k++) kre[k] /= sum;
  fft2(kre, kim, false);

  const two = 2 * rule.sigma * rule.sigma;
  const lenia: Lenia = {
    n,
    A,
    G,
    rule,
    step() {
      for (let k = 0; k < N2; k++) {
        re[k] = A[k];
        im[k] = 0;
      }
      fft2(re, im, false);
      for (let k = 0; k < N2; k++) {
        const a = re[k] * kre[k] - im[k] * kim[k];
        const b = re[k] * kim[k] + im[k] * kre[k];
        re[k] = a;
        im[k] = b;
      }
      fft2(re, im, true);
      for (let k = 0; k < N2; k++) {
        const u = re[k] / N2;
        const g = 2 * Math.exp(-((u - rule.mu) ** 2) / two) - 1;
        G[k] = g;
        const v = inside[k] ? A[k] + rule.dt * g : 0;
        A[k] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    },
    seed(x, y, r, rnd, density = 1) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx, dy) / r;
          if (d > 1) continue;
          const k = (((Math.round(y) + dy) % n + n) % n) * n + (((Math.round(x) + dx) % n + n) % n);
          A[k] = Math.min(1, A[k] + rnd() * density * (1 - d * d));
        }
      }
    },
    place(cells, x, y, rot, flip) {
      const h = cells.length;
      const w = cells[0].length;
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          let u = flip ? w - 1 - i : i;
          let v = j;
          for (let k = 0; k < (rot & 3); k++) [u, v] = [h - 1 - v, u];
          const k2 = (((Math.round(y) + v) % n + n) % n) * n + (((Math.round(x) + u) % n + n) % n);
          A[k2] = Math.max(A[k2], cells[j][i]);
        }
      }
    },
    clear(x, y, r) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.hypot(dx, dy) > r) continue;
          const k = (((Math.round(y) + dy) % n + n) % n) * n + (((Math.round(x) + dx) % n + n) % n);
          A[k] = 0;
        }
      }
    },
    mass() {
      let m = 0;
      for (let k = 0; k < N2; k++) m += A[k];
      return m;
    },
  };
  return lenia;
}
