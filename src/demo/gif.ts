/**
 * A small animated GIF encoder, for moments: one shared palette (median cut over every frame,
 * so a fire's few bright pixels keep their colour), LZW, looping forever. No dithering; the
 * worlds are flat-coloured enough not to need it at clip size.
 */

export type GifFrame = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };

const key15 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

/** Up to `n` colours for a 15-bit histogram, by median cut. */
export function medianCut(hist: Uint32Array, n = 256): [number, number, number][] {
  const keys: number[] = [];
  for (let k = 0; k < hist.length; k++) if (hist[k]) keys.push(k);
  if (!keys.length) return [[0, 0, 0]];
  const ch = (k: number, c: number) => (c === 0 ? k >> 10 : c === 1 ? (k >> 5) & 31 : k & 31);
  type Box = { keys: number[]; count: number; axis: number; range: number };
  const box = (ks: number[]): Box => {
    const lo = [31, 31, 31];
    const hi = [0, 0, 0];
    let count = 0;
    for (const k of ks) {
      count += hist[k];
      for (let c = 0; c < 3; c++) {
        const v = ch(k, c);
        if (v < lo[c]) lo[c] = v;
        if (v > hi[c]) hi[c] = v;
      }
    }
    const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const axis = ranges.indexOf(Math.max(...ranges));
    return { keys: ks, count, axis, range: ranges[axis] };
  };
  const boxes = [box(keys)];
  while (boxes.length < n) {
    // Split where the colours are both spread out and used: big spreads of rare colours still split.
    let best = -1;
    let score = 0;
    boxes.forEach((b, i) => {
      const s = b.keys.length > 1 ? b.range * Math.sqrt(b.count) : 0;
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best < 0) break;
    const b = boxes[best];
    const sorted = [...b.keys].sort((x, y) => ch(x, b.axis) - ch(y, b.axis));
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += hist[sorted[i]];
      cut = i + 1;
      if (acc >= b.count / 2) break;
    }
    boxes.splice(best, 1, box(sorted.slice(0, cut)), box(sorted.slice(cut)));
  }
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const k of b.keys) {
      const w = hist[k];
      r += ch(k, 0) * w;
      g += ch(k, 1) * w;
      bl += ch(k, 2) * w;
    }
    const d = Math.max(1, b.count);
    return [Math.round((r / d) * 8.226), Math.round((g / d) * 8.226), Math.round((bl / d) * 8.226)];
  });
}

class Bytes {
  private buf = new Uint8Array(1 << 16);
  length = 0;
  byte(v: number) {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = v & 255;
  }
  word(v: number) {
    this.byte(v);
    this.byte(v >> 8);
  }
  text(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

/** GIF's LZW, in sub-blocks of up to 255 bytes. */
function lzw(indices: Uint8Array, minSize: number, out: Bytes) {
  out.byte(minSize);
  const clear = 1 << minSize;
  const eoi = clear + 1;
  let codeSize = minSize + 1;
  let next = eoi + 1;
  let table = new Map<number, number>();
  let bits = 0;
  let nbits = 0;
  const block: number[] = [];
  const flushBlock = () => {
    if (!block.length) return;
    out.byte(block.length);
    for (const b of block) out.byte(b);
    block.length = 0;
  };
  const emit = (code: number) => {
    bits |= code << nbits;
    nbits += codeSize;
    while (nbits >= 8) {
      block.push(bits & 255);
      bits >>>= 8;
      nbits -= 8;
      if (block.length === 255) flushBlock();
    }
  };
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const code = table.get(key);
    if (code !== undefined) {
      prefix = code;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      next = eoi + 1;
      codeSize = minSize + 1;
      table = new Map();
    } else {
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (nbits > 0) block.push(bits & 255);
  flushBlock();
  out.byte(0);
}

/** Frames (all the same size, RGBA) to a looping GIF. */
export function encodeGif(frames: readonly GifFrame[], delayMs = 120): Uint8Array {
  if (!frames.length) throw new Error('encodeGif: no frames');
  const { width: w, height: h } = frames[0];
  const hist = new Uint32Array(32768);
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4) hist[key15(d[i], d[i + 1], d[i + 2])]++;
  }
  const palette = medianCut(hist, 256);
  // Each 15-bit colour maps to its nearest palette entry, worked out once.
  const lookup = new Int16Array(32768).fill(-1);
  const nearest = (k: number) => {
    const r = ((k >> 10) << 3) + 4;
    const g = (((k >> 5) & 31) << 3) + 4;
    const b = ((k & 31) << 3) + 4;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) ** 2 * 2 + (p[1] - g) ** 2 * 4 + (p[2] - b) ** 2 * 3;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };

  const out = new Bytes();
  out.text('GIF89a');
  out.word(w);
  out.word(h);
  out.byte(0xf7); // a global table of 256 colours
  out.byte(0);
  out.byte(0);
  for (let i = 0; i < 256; i++) {
    const p = palette[i] ?? [0, 0, 0];
    out.byte(p[0]);
    out.byte(p[1]);
    out.byte(p[2]);
  }
  // Loop forever.
  out.byte(0x21);
  out.byte(0xff);
  out.byte(11);
  out.text('NETSCAPE2.0');
  out.byte(3);
  out.byte(1);
  out.word(0);
  out.byte(0);

  const delay = Math.max(2, Math.round(delayMs / 10));
  const indices = new Uint8Array(w * h);
  for (const f of frames) {
    const d = f.data;
    for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
      const k = key15(d[i], d[i + 1], d[i + 2]);
      let v = lookup[k];
      if (v < 0) v = lookup[k] = nearest(k);
      indices[p] = v;
    }
    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte(0x04); // keep the frame (no transparency)
    out.word(delay);
    out.byte(0);
    out.byte(0);
    out.byte(0x2c);
    out.word(0);
    out.word(0);
    out.word(w);
    out.word(h);
    out.byte(0);
    lzw(indices, 8, out);
  }
  out.byte(0x3b);
  return out.done();
}
