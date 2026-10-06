/**
 * Fields: continuous state on a small grid, drawn through a color ramp.
 *
 * Worlds keep what they are in fields (density, heat, influence, power, water) rather than
 * in hundreds of sprites. A field looks good at any zoom (it is drawn smoothed), costs
 * little at a quarter of the screen's resolution, and is procedural by nature: blur,
 * decay, advection, and reaction turn a few rules into endless form.
 *
 * Coordinates are in cells. `w × h` cells; values are floats, usually 0..1 but unbounded.
 */

export class Field {
  readonly w: number;
  readonly h: number;
  data: Float32Array;
  private tmp: Float32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Float32Array(w * h);
    this.tmp = new Float32Array(w * h);
  }

  at(x: number, y: number): number {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return 0;
    return this.data[yi * this.w + xi];
  }

  /** Bilinear sample (cells, clamped at the edges). */
  sample(x: number, y: number): number {
    const { w, h, data } = this;
    const cx = Math.max(0, Math.min(w - 1.001, x - 0.5));
    const cy = Math.max(0, Math.min(h - 1.001, y - 0.5));
    const x0 = cx | 0;
    const y0 = cy | 0;
    const u = cx - x0;
    const v = cy - y0;
    const i = y0 * w + x0;
    const a = data[i];
    const b = data[i + 1];
    const c = data[i + w];
    const d = data[i + w + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /** Add a soft disc: falloff (1 - d²/r²)². `mode` 'max' keeps the larger value. */
  splat(x: number, y: number, r: number, v: number, mode: 'add' | 'max' | 'set' = 'add'): void {
    const { w, h, data } = this;
    const r2 = r * r;
    for (let yy = Math.max(0, Math.floor(y - r)); yy <= Math.min(h - 1, Math.ceil(y + r)); yy++) {
      for (let xx = Math.max(0, Math.floor(x - r)); xx <= Math.min(w - 1, Math.ceil(x + r)); xx++) {
        const dx = xx + 0.5 - x;
        const dy = yy + 0.5 - y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const k = (1 - d2 / r2) ** 2 * v;
        const i = yy * w + xx;
        if (mode === 'add') data[i] += k;
        else if (mode === 'max') data[i] = Math.max(data[i], k);
        else data[i] = k;
      }
    }
  }

  /**
   * One step of a 3×3 box blur mixed in by `rate` (0 none .. 1 full), then multiplied by
   * `keep` (decay). Separable; edges clamp.
   */
  diffuse(rate: number, keep = 1): number {
    const { w, h, data, tmp } = this;
    let mx = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const l = data[row + (x > 0 ? x - 1 : x)];
        const c = data[row + x];
        const r = data[row + (x < w - 1 ? x + 1 : x)];
        tmp[row + x] = (l + c + r) / 3;
      }
    }
    for (let y = 0; y < h; y++) {
      const up = (y > 0 ? y - 1 : y) * w;
      const row = y * w;
      const dn = (y < h - 1 ? y + 1 : y) * w;
      for (let x = 0; x < w; x++) {
        const blurred = (tmp[up + x] + tmp[row + x] + tmp[dn + x]) / 3;
        const v = (data[row + x] + (blurred - data[row + x]) * rate) * keep;
        data[row + x] = v;
        if (v > mx) mx = v;
      }
    }
    return mx;
  }

  scale(k: number): void {
    const d = this.data;
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }

  /**
   * Swirl the field in a disc (semi-Lagrangian): each cell takes its value from where a
   * rotation of `angle` (radians, falling off toward the rim) would have brought it from.
   */
  swirl(cx: number, cy: number, r: number, angle: number, pull = 0): void {
    const { w, h, data, tmp } = this;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tmp[y * w + x] = data[y * w + x];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d >= r) continue;
        const k = (1 - d / r) ** 2;
        const a = -angle * k;
        const s = 1 + pull * k;
        const sx = cx + (dx * Math.cos(a) - dy * Math.sin(a)) * s;
        const sy = cy + (dx * Math.sin(a) + dy * Math.cos(a)) * s;
        // Sample the untouched copy.
        const fx = Math.max(x0, Math.min(x1 - 0.001, sx - 0.5));
        const fy = Math.max(y0, Math.min(y1 - 0.001, sy - 0.5));
        const ix = fx | 0;
        const iy = fy | 0;
        const u = fx - ix;
        const v = fy - iy;
        const i = iy * w + ix;
        const ix1 = Math.min(ix + 1, x1);
        const iy1 = Math.min(iy + 1, y1);
        const a0 = tmp[i];
        const b0 = tmp[iy * w + ix1];
        const c0 = tmp[iy1 * w + ix];
        const d0 = tmp[iy1 * w + ix1];
        data[y * w + x] = a0 + (b0 - a0) * u + (c0 - a0) * v + (a0 - b0 - c0 + d0) * u * v;
      }
    }
  }

  /** Largest value (for normalizing). */
  max(): number {
    let m = 0;
    const d = this.data;
    for (let i = 0; i < d.length; i++) if (d[i] > m) m = d[i];
    return m;
  }

  sum(): number {
    let s = 0;
    const d = this.data;
    for (let i = 0; i < d.length; i++) s += d[i];
    return s;
  }
}

/**
 * Distance along a network: breadth-first from `sources` over cells where `pass(i)` holds,
 * into `out` (cells unreached get Infinity). Cheap enough to redo every second or so.
 */
export function geodesic(w: number, h: number, sources: number[], pass: (i: number) => boolean, out: Float32Array, queue = new Int32Array(w * h)): void {
  out.fill(Infinity);
  let head = 0;
  let tail = 0;
  for (const s of sources) {
    if (s < 0 || s >= out.length) continue;
    out[s] = 0;
    queue[tail++] = s;
  }
  while (head < tail) {
    const i = queue[head++];
    const d = out[i] + 1;
    const x = i % w;
    const n0 = x > 0 ? i - 1 : -1;
    const n1 = x < w - 1 ? i + 1 : -1;
    const n2 = i - w;
    const n3 = i + w < w * h ? i + w : -1;
    for (const j of [n0, n1, n2, n3]) {
      if (j < 0 || out[j] <= d || !pass(j)) continue;
      out[j] = d;
      queue[tail++] = j;
    }
  }
}
