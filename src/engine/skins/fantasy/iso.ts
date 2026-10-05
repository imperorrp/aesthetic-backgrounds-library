/**
 * Marching squares for the fantasy maps: the line where a grid of values crosses a level,
 * interpolated along each cell edge, so coasts and borders come out smooth.
 */

/** Add the `level` line of `v` (cols × rows samples, `cell` px apart, starting at ox, oy) to the current path. */
export function isoPath(g: CanvasRenderingContext2D, v: ArrayLike<number>, cols: number, rows: number, cell: number, level: number, ox = 0, oy = 0) {
  const at = (i: number, j: number) => v[j * cols + i] - level;
  const lerp = (a: number, b: number) => a / (a - b);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i + 1, j + 1);
      const d = at(i, j + 1);
      if ((a > 0) === (b > 0) && (b > 0) === (c > 0) && (c > 0) === (d > 0)) continue;
      let n = 0;
      const xs: number[] = [];
      const ys: number[] = [];
      if (a > 0 !== b > 0) {
        xs.push((i + lerp(a, b)) * cell);
        ys.push(j * cell);
        n++;
      }
      if (b > 0 !== c > 0) {
        xs.push((i + 1) * cell);
        ys.push((j + lerp(b, c)) * cell);
        n++;
      }
      if (c > 0 !== d > 0) {
        xs.push((i + 1 - lerp(c, d)) * cell);
        ys.push((j + 1) * cell);
        n++;
      }
      if (d > 0 !== a > 0) {
        xs.push(i * cell);
        ys.push((j + 1 - lerp(d, a)) * cell);
        n++;
      }
      for (let k = 0; k + 1 < n; k += 2) {
        g.moveTo(ox + xs[k], oy + ys[k]);
        g.lineTo(ox + xs[k + 1], oy + ys[k + 1]);
      }
    }
  }
}

/** A 3×3 box blur, in place (with a scratch buffer): softens a mask before tracing it. */
export function blur3(v: Float32Array, cols: number, rows: number, scratch = new Float32Array(v.length)) {
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const y = j + dj;
        if (y < 0 || y >= rows) continue;
        for (let di = -1; di <= 1; di++) {
          const x = i + di;
          if (x < 0 || x >= cols) continue;
          s += v[y * cols + x];
          n++;
        }
      }
      scratch[j * cols + i] = s / n;
    }
  }
  v.set(scratch);
  return v;
}
