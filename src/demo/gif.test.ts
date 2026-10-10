import { describe, expect, it } from 'vitest';
import { encodeGif, medianCut } from './gif';

/** Just enough of a GIF decoder to read back what encodeGif writes. */
function decode(bytes: Uint8Array) {
  let p = 0;
  const u8 = () => bytes[p++];
  const u16 = () => bytes[p++] | (bytes[p++] << 8);
  const sig = String.fromCharCode(...bytes.slice(0, 6));
  p = 6;
  const w = u16();
  const h = u16();
  const packed = u8();
  p += 2;
  const size = 2 << (packed & 7);
  const palette: number[][] = [];
  for (let i = 0; i < size; i++) palette.push([u8(), u8(), u8()]);
  const frames: number[][] = [];
  let loops = false;
  for (;;) {
    const b = u8();
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = u8();
      for (let n = u8(); n; n = u8()) {
        if (label === 0xff && bytes[p] === 0x4e) loops = true;
        p += n;
      }
      continue;
    }
    expect(b).toBe(0x2c);
    p += 8;
    u8();
    const min = u8();
    const data: number[] = [];
    for (let n = u8(); n; n = u8()) for (let i = 0; i < n; i++) data.push(u8());
    // LZW
    const clear = 1 << min;
    let codeSize = min + 1;
    let dict: number[][] = [];
    const reset = () => {
      dict = [];
      for (let i = 0; i < clear; i++) dict.push([i]);
      dict.push([], []);
      codeSize = min + 1;
    };
    reset();
    const out: number[] = [];
    let bits = 0;
    let nbits = 0;
    let di = 0;
    let prev: number[] | null = null;
    for (;;) {
      while (nbits < codeSize && di < data.length) {
        bits |= data[di++] << nbits;
        nbits += 8;
      }
      if (nbits < codeSize) break;
      const code = bits & ((1 << codeSize) - 1);
      bits >>>= codeSize;
      nbits -= codeSize;
      if (code === clear) {
        reset();
        prev = null;
        continue;
      }
      if (code === clear + 1) break;
      let entry: number[];
      if (code < dict.length) entry = dict[code];
      else entry = [...prev!, prev![0]];
      out.push(...entry);
      if (prev) dict.push([...prev, entry[0]]);
      prev = entry;
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    frames.push(out);
  }
  return { sig, w, h, palette, frames, loops };
}

function frame(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
}

describe('encodeGif', () => {
  it('writes a looping GIF that decodes back to the same picture', () => {
    const w = 64;
    const h = 40;
    const frames = [0, 1, 2].map((k) => frame(w, h, (x, y) => [(x * 4 + k * 40) & 255, (y * 6) & 255, ((x ^ y) * 8) & 255]));
    const gif = decode(encodeGif(frames, 150));
    expect(gif.sig).toBe('GIF89a');
    expect([gif.w, gif.h]).toEqual([w, h]);
    expect(gif.loops).toBe(true);
    expect(gif.frames).toHaveLength(3);
    for (const [k, f] of gif.frames.entries()) {
      expect(f).toHaveLength(w * h);
      // Within a quantization step of the source, on average.
      let err = 0;
      for (let i = 0; i < f.length; i++) {
        const c = gif.palette[f[i]];
        const s = frames[k].data;
        err += Math.abs(c[0] - s[i * 4]) + Math.abs(c[1] - s[i * 4 + 1]) + Math.abs(c[2] - s[i * 4 + 2]);
      }
      expect(err / f.length / 3).toBeLessThan(14);
    }
  });

  it('keeps a few bright pixels on a dark field (a fire at night)', () => {
    const f = frame(80, 50, (x, y) => (x > 38 && x < 42 && y > 23 && y < 27 ? [255, 140, 30] : [6, 8, 14 + ((x + y) % 3)]));
    const gif = decode(encodeGif([f]));
    const c = gif.palette[gif.frames[0][25 * 80 + 40]];
    expect(c[0]).toBeGreaterThan(220);
    expect(c[1]).toBeGreaterThan(110);
  });

  it('survives long runs past the 4096-code table', () => {
    const f = frame(256, 128, (x, y) => [(x * 37 + y * 11) & 255, (x * 13) & 255, (y * 29) & 255]);
    const gif = decode(encodeGif([f]));
    expect(gif.frames[0]).toHaveLength(256 * 128);
  });
});

describe('medianCut', () => {
  it('gives no more colours than asked, and one for an empty picture', () => {
    const hist = new Uint32Array(32768);
    for (let k = 0; k < 32768; k += 7) hist[k] = 1 + (k % 5);
    expect(medianCut(hist, 16)).toHaveLength(16);
    expect(medianCut(new Uint32Array(32768), 16)).toEqual([[0, 0, 0]]);
  });
});
