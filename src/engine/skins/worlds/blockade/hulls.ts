/**
 * Blockade's hulls: a ship's shape from its class, its fleet's style and its seed (no drawing
 * here; ./ships bakes and lights them).
 *
 * A hull is seen from the side and a little above: a side face between `top` and `bot` (heights
 * above and below the keel line, in lengths), and a deck whose plan half-width `wid` shows as a
 * band above the side face (the far edge raised by 2·wid·KK). Superstructure boxes stand on the
 * deck; a tower; turrets; engines at the stern (x = 0; the bow is x = 1); bays and windows in
 * the side; pods and containers; fins.
 */
import { hash } from '../../instruments/kit';
import type { FleetLook, HullStyle } from './design';
import type { Cls } from './types';

/** How much of the deck shows: the elevation of our view. */
export const KK = 0.16;
export const N = 64;

export type Box = { x0: number; x1: number; z0: number; h: number; bw: number; win: number };
export type Tower = { x: number; w: number; h: number; headW: number; headH: number; bw: number; dome: boolean };
export type Eng = { y: number; r: number; len: number };
export type Tur = { x: number; r: number; barrels: number; big: boolean };
export type Bay = { x0: number; x1: number; f0: number; f1: number };
export type Win = { f: number; x0: number; x1: number; step: number };
export type Fin = { x: number; len: number; h: number; up: boolean };
export type Pod = { x0: number; x1: number; y: number; r: number; color: string };
export type Light = { x: number; y: number; kind: 'port' | 'star' | 'strobe' | 'beacon' };

export type Design = {
  key: string; cls: Cls; style: HullStyle;
  top: Float32Array; bot: Float32Array; wid: Float32Array;
  boxes: Box[]; tower: Tower | null; engines: Eng[]; turrets: Tur[]; bays: Bay[]; windows: Win[];
  /** A row of gun ports along the side (fraction down it), or -1. */
  ports: number;
  /** A trench of machinery along the side (fraction down it), or -1. */
  trench: number;
  stripe: [number, number] | null; fins: Fin[]; pods: Pod[];
  /** Engine overhang past the stern (lengths). */
  ov: number;
  /** The tallest point above the keel line and the lowest below (lengths), for the sprite's size. */
  up: number; down: number;
  hull: string; hull2: string; trim: string; engine: string; window: string;
  panel: number; seed: number;
};

const CONT = ['#b8442e', '#3a6a9a', '#c89a3a', '#4a8a5a', '#8a4a7a', '#c8c0b0', '#2a7a8a', '#9a6a3a'];

export function designFor(cls: Cls, look: FleetLook, seed: number, merchant = false): Design {
  let k = 0;
  const R = () => hash(seed, 77, k++);
  const rg = (a: number, b: number) => a + (b - a) * R();
  const style = look.style;
  const top = new Float32Array(N + 1);
  const bot = new Float32Array(N + 1);
  const wid = new Float32Array(N + 1);
  const d: Design = {
    key: `${cls}:${seed}:${look.prefix}`, cls, style, top, bot, wid, boxes: [], tower: null, engines: [], turrets: [], bays: [], windows: [], ports: -1, trench: -1,
    stripe: null, fins: [], pods: [], ov: 0.04, up: 0, down: 0,
    hull: look.hull, hull2: look.hull2, trim: look.trim, engine: look.engine, window: look.window, panel: rg(0.012, 0.022), seed,
  };
  const fill = (f: (x: number) => [number, number, number]) => {
    for (let i = 0; i <= N; i++) {
      const [a, b, c] = f(i / N);
      top[i] = a;
      bot[i] = b;
      wid[i] = c;
    }
  };
  /** The bow's taper: 1 back from it, falling to 0 at the tip; pointed, blunt or rounded by style. */
  const bowK = (x: number, from: number) => {
    if (x < from) return 1;
    const q = (x - from) / (1 - from);
    return style === 'curved' ? Math.sqrt(Math.max(0, 1 - q * q)) : style === 'slab' ? 1 - q * 0.75 : 1 - q;
  };
  const sternK = (x: number) => Math.min(1, 0.82 + x * 6);
  const wedge = (cls === 'cruiser' && (style === 'wedge' || R() < 0.3)) || (cls === 'dreadnought' && style === 'wedge');
  if ((cls === 'cruiser' || cls === 'dreadnought') && wedge) {
    const H = cls === 'dreadnought' ? rg(0.07, 0.085) : rg(0.075, 0.095);
    const W = cls === 'dreadnought' ? rg(0.17, 0.22) : rg(0.22, 0.3);
    fill((x) => {
      const q = Math.pow(1 - x, style === 'curved' ? 0.8 : 1);
      return [0.006 + H * 0.55 * q * sternK(x), 0.005 + H * 0.45 * Math.pow(1 - x, 0.75) * sternK(x), 0.004 + W * q];
    });
    const tiers = 2 + Math.floor(R() * 3);
    let z0 = 0;
    for (let i = 0; i < tiers; i++) {
      const h = rg(0.012, 0.02);
      d.boxes.push({ x0: 0.03 + i * rg(0.015, 0.03), x1: rg(0.42, 0.55) - i * rg(0.07, 0.11), z0, h, bw: Math.max(0.02, 0.13 - i * 0.03), win: 1 });
      z0 += h;
    }
    d.tower = { x: rg(0.05, 0.1), w: rg(0.025, 0.04), h: z0 + rg(0.03, 0.05), headW: rg(0.07, 0.11), headH: rg(0.012, 0.018), bw: 0.03, dome: style !== 'slab' };
    const n = 3 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) d.engines.push({ y: -0.02 + (i / Math.max(1, n - 1) - 0.5) * 0.07, r: i === Math.floor(n / 2) ? 0.026 : 0.018, len: rg(0.03, 0.045) });
    for (let i = 0; i < 6; i++) d.turrets.push({ x: 0.3 + i * 0.09 + rg(-0.02, 0.02), r: 0.008, barrels: 2, big: false });
    d.bays.push({ x0: 0.34, x1: 0.46, f0: 0.55, f1: 0.9 });
    d.windows.push({ f: 0.2, x0: 0.06, x1: 0.5, step: 0.006 }, { f: 0.42, x0: 0.04, x1: 0.62, step: 0.008 });
    d.trench = 0.62;
    d.stripe = R() < 0.6 ? [0.86, 0.885] : null;
  } else if (cls === 'dreadnought' || cls === 'flagship' || cls === 'cruiser') {
    const big = cls === 'flagship';
    const kindK = cls === 'cruiser' ? 0.85 : 1;
    if (style === 'curved') {
      // A smooth whale of a hull: a swelling body, a rounded bow, rows of lights, a crest.
      const H = rg(0.11, 0.14) * kindK;
      const hump = rg(0.35, 0.55);
      fill((x) => {
        const body = Math.pow(Math.sin(Math.min(1, x * 1.05 + 0.04) * Math.PI), 0.55);
        const swell = 1 + 0.25 * Math.exp(-(((x - hump) / 0.18) ** 2));
        return [H * 0.5 * body * swell * sternK(x) + 0.004, H * 0.5 * Math.pow(body, 0.8) * sternK(x) + 0.004, 0.05 * body];
      });
      d.boxes.push({ x0: hump - 0.12, x1: hump + 0.16, z0: 0, h: rg(0.012, 0.02), bw: 0.03, win: 1 });
      d.tower = { x: hump - 0.05, w: 0.05, h: rg(0.035, 0.05), headW: rg(0.09, 0.13), headH: 0.016, bw: 0.024, dome: true };
      for (let i = 0; i < (big ? 8 : 4); i++) d.windows.push({ f: 0.15 + i * (big ? 0.09 : 0.16), x0: 0.08 + R() * 0.06, x1: 0.88 - R() * 0.1, step: 0.006 });
      const ne = big ? 6 : 3;
      for (let i = 0; i < ne; i++) d.engines.push({ y: -H * 0.25 + (i / Math.max(1, ne - 1)) * H * 0.5, r: H * 0.16, len: 0.03 });
      for (let i = 0; i < 4; i++) d.turrets.push({ x: 0.55 + i * 0.08, r: 0.01, barrels: 2, big: false });
      d.fins.push({ x: 0.06, len: 0.14, h: H * 0.9, up: false });
      d.bays.push({ x0: 0.62, x1: 0.72, f0: 0.55, f1: 0.85 });
      d.stripe = null;
    } else if (style === 'spine' && !big) {
      // A long keel with drum sections strung along it, a reactor block aft, a ram forward.
      const H = rg(0.032, 0.04);
      fill((x) => {
        const bow = bowK(x, 0.9);
        return [H * 0.5 * bow * sternK(x) + 0.003, H * 0.5 * Math.max(0.2, bow) * sternK(x) + 0.003, 0.025 * Math.max(0.3, bow)];
      });
      const drums = 3 + Math.floor(R() * 3);
      for (let i = 0; i < drums; i++) {
        const x0 = 0.18 + (i / drums) * 0.6;
        d.pods.push({ x0, x1: x0 + 0.6 / drums - 0.025, y: 0, r: rg(0.034, 0.05) * kindK, color: R() < 0.3 ? look.hull2 : look.hull });
      }
      d.boxes.push({ x0: 0.02, x1: 0.16, z0: 0, h: rg(0.03, 0.045), bw: 0.04, win: 1 });
      d.tower = { x: 0.08, w: 0.03, h: 0.07, headW: 0.08, headH: 0.014, bw: 0.022, dome: false };
      for (let i = 0; i < 4; i++) d.turrets.push({ x: 0.22 + i * 0.16, r: 0.012, barrels: 3, big: true });
      for (let i = 0; i < 4; i++) d.engines.push({ y: -0.03 + i * 0.02, r: 0.014, len: 0.03 });
      d.windows.push({ f: 0.3, x0: 0.03, x1: 0.15, step: 0.006 });
      d.fins.push({ x: 0.03, len: 0.1, h: 0.06, up: true }, { x: 0.03, len: 0.1, h: 0.06, up: false });
      d.stripe = R() < 0.6 ? [0.86, 0.89] : null;
    } else {
      const H = (cls === 'cruiser' ? rg(0.06, 0.072) : rg(0.07, 0.085)) * (style === 'slab' ? 1.15 : 1);
      const ram = style === 'spine' || R() < 0.4;
      fill((x) => {
        const bow = bowK(x, ram ? 0.86 : 0.9);
        const stern = x < 0.14 ? 1.15 : 1;
        const keel = x > 0.3 && x < 0.72 ? 1.15 : 1;
        return [H * 0.5 * bow * stern * sternK(x) + (ram && x > 0.86 ? 0 : 0.002), H * 0.5 * keel * (ram ? Math.max(0.15, bow) : bow) * sternK(x) + 0.002, (0.04 + (style === 'slab' ? 0.025 : 0)) * Math.max(0.2, bow) * stern];
      });
      d.boxes.push({ x0: 0.12, x1: 0.82, z0: 0, h: 0.01, bw: 0.02, win: 0 });
      const mids = big ? 6 : 2 + Math.floor(R() * 2);
      let z0 = 0.01;
      for (let i = 0; i < mids; i++) {
        const h = rg(0.012, 0.02) * (big ? 1.3 : 1) * (style === 'slab' ? 1.3 : 1);
        const c = big ? 0.15 + R() * 0.55 : rg(0.12, 0.3);
        const w = big ? rg(0.05, 0.12) : rg(0.14, 0.24) - i * 0.04;
        d.boxes.push({ x0: c, x1: c + Math.max(0.05, w), z0: big ? 0.01 + (i % 3) * 0.014 : z0, h, bw: Math.max(0.014, 0.034 - i * 0.005), win: 1 });
        if (!big) z0 += h;
      }
      d.tower = { x: rg(0.16, 0.24), w: rg(0.022, 0.03), h: z0 + rg(0.035, 0.055) * (big ? 1.3 : 1), headW: rg(0.06, 0.09), headH: rg(0.011, 0.016), bw: 0.022, dome: false };
      const nt = big ? 8 : cls === 'cruiser' ? 3 : 4 + Math.floor(R() * 3);
      for (let i = 0; i < nt; i++) {
        const x = 0.38 + (i / Math.max(1, nt - 1)) * 0.42;
        if (Math.abs(x - d.tower.x) < 0.05) continue;
        d.turrets.push({ x, r: big ? 0.012 : 0.016, barrels: 3, big: true });
      }
      const ne = big ? 7 : 4 + Math.floor(R() * 3);
      for (let i = 0; i < ne; i++) d.engines.push({ y: -H * 0.6 + (i / Math.max(1, ne - 1)) * H * 1.15, r: H * rg(0.14, 0.18), len: rg(0.025, 0.035) });
      d.ports = 0.48;
      d.windows.push({ f: 0.22, x0: 0.08, x1: 0.82, step: 0.005 }, { f: 0.72, x0: 0.15, x1: 0.7, step: 0.007 });
      if (big) d.windows.push({ f: 0.35, x0: 0.05, x1: 0.9, step: 0.004 });
      d.trench = 0.6;
      d.stripe = R() < 0.7 ? [0.82, 0.85] : null;
      if (R() < 0.5) d.bays.push({ x0: 0.48, x1: 0.56, f0: 0.62, f1: 0.95 });
    }
  } else if (cls === 'carrier') {
    const H = rg(0.085, 0.11);
    fill((x) => {
      const bow = bowK(x, 0.82);
      return [H * 0.5 * bow * sternK(x), H * 0.55 * Math.max(0.3, bow) * sternK(x), 0.07 * Math.max(0.3, bow)];
    });
    d.boxes.push({ x0: 0.08, x1: 0.97, z0: 0, h: rg(0.01, 0.014), bw: 0.08, win: 0.4 });
    d.tower = { x: rg(0.25, 0.4), w: rg(0.05, 0.08), h: 0.012 + rg(0.03, 0.045), headW: rg(0.08, 0.12), headH: 0.014, bw: 0.022, dome: false };
    const nb = 2 + Math.floor(R() * 2);
    for (let i = 0; i < nb; i++) {
      const x0 = 0.2 + i * (0.55 / nb);
      d.bays.push({ x0, x1: x0 + 0.55 / nb - 0.04, f0: 0.25, f1: 0.75 });
    }
    for (let i = 0; i < 4; i++) d.engines.push({ y: -H * 0.4 + i * H * 0.3, r: H * 0.17, len: 0.03 });
    for (let i = 0; i < 3; i++) d.turrets.push({ x: 0.12 + i * 0.3, r: 0.007, barrels: 2, big: false });
    d.windows.push({ f: 0.12, x0: 0.06, x1: 0.9, step: 0.006 }, { f: 0.88, x0: 0.1, x1: 0.85, step: 0.007 });
    d.stripe = [0.9, 0.925];
  } else if (cls === 'frigate') {
    const hammer = style === 'wedge' || style === 'slab' ? R() < 0.7 : R() < 0.35;
    const H = rg(0.1, 0.13);
    fill((x) => {
      if (hammer) {
        const body = x < 0.24 ? 1 : x < 0.62 ? 0.5 : 1.05 * bowK(x, 0.82);
        return [H * 0.5 * body * sternK(x), H * 0.5 * body * sternK(x), 0.05 * body];
      }
      const bow = bowK(x, 0.6);
      return [H * 0.4 * bow * sternK(x) + 0.004, H * 0.35 * bow * sternK(x) + 0.004, 0.04 * Math.max(0.2, bow)];
    });
    d.boxes.push({ x0: 0.08, x1: 0.3, z0: 0, h: rg(0.018, 0.026), bw: 0.03, win: 1 });
    d.tower = { x: rg(0.12, 0.2), w: 0.04, h: 0.05, headW: 0.08, headH: 0.02, bw: 0.02, dome: style === 'curved' };
    d.turrets.push({ x: hammer ? 0.75 : 0.5, r: 0.025, barrels: 2, big: true }, { x: hammer ? 0.88 : 0.68, r: 0.02, barrels: 1, big: false });
    d.engines.push({ y: -0.02, r: 0.03, len: 0.05 }, { y: 0.03, r: 0.03, len: 0.05 });
    d.windows.push({ f: 0.35, x0: 0.04, x1: 0.95, step: 0.016 });
    if (!hammer) d.fins.push({ x: 0.08, len: 0.14, h: 0.07, up: true }, { x: 0.1, len: 0.12, h: 0.05, up: false });
    d.stripe = [0.64, 0.68];
    d.trench = 0.6;
  } else if (cls === 'tender') {
    fill((x) => {
      const bow = bowK(x, 0.85);
      return [0.045 * bow * sternK(x) + 0.004, 0.045 * bow * sternK(x) + 0.004, 0.05 * Math.max(0.3, bow)];
    });
    d.tower = { x: 0.82, w: 0.08, h: 0.035, headW: 0.12, headH: 0.03, bw: 0.03, dome: false };
    const np = 3 + Math.floor(R() * 2);
    for (let i = 0; i < np; i++) {
      const x0 = 0.12 + i * (0.6 / np);
      d.pods.push({ x0, x1: x0 + 0.6 / np - 0.03, y: 0.05, r: 0.045, color: R() < 0.5 ? look.hull2 : '#c8b080' });
    }
    d.engines.push({ y: 0, r: 0.035, len: 0.05 });
    d.windows.push({ f: 0.3, x0: 0.78, x1: 0.98, step: 0.02 });
    d.fins.push({ x: 0.4, len: 0.25, h: 0.09, up: true });
  } else if (cls === 'freighter' || merchant) {
    fill((x) => {
      const bow = bowK(x, 0.9);
      return [0.03 * bow + 0.004, 0.03 * bow + 0.004, 0.04];
    });
    const rows = 2 + Math.floor(R() * 2);
    const cols = 6 + Math.floor(R() * 5);
    for (let rr = 0; rr < rows; rr++)
      for (let c = 0; c < cols; c++) {
        if (R() < 0.12) continue;
        const x0 = 0.1 + (c / cols) * 0.68;
        d.pods.push({ x0, x1: x0 + 0.68 / cols - 0.006, y: -0.065 + rr * 0.062 - (rows - 2) * 0.031, r: 0.029, color: CONT[Math.floor(R() * CONT.length)] });
      }
    d.tower = { x: 0.86, w: 0.08, h: 0.06, headW: 0.11, headH: 0.03, bw: 0.03, dome: false };
    d.engines.push({ y: -0.015, r: 0.025, len: 0.04 }, { y: 0.02, r: 0.025, len: 0.04 });
    d.windows.push({ f: 0.3, x0: 0.84, x1: 0.98, step: 0.014 });
  } else if (cls === 'corvette') {
    fill((x) => {
      const q = x < 0.3 ? 1 : Math.max(0, 1 - (x - 0.3) / 0.7);
      return [0.07 * Math.pow(q, 0.8) + 0.004, 0.04 * Math.pow(q, 1.2) + 0.004, 0.06 * q + 0.01];
    });
    d.engines.push({ y: -0.03, r: 0.04, len: 0.08 }, { y: 0.03, r: 0.04, len: 0.08 });
    d.fins.push({ x: 0.04, len: 0.28, h: 0.13, up: true }, { x: 0.06, len: 0.24, h: 0.1, up: false });
    d.windows.push({ f: 0.3, x0: 0.6, x1: 0.78, step: 0.03 });
    d.stripe = [0.4, 0.5];
    d.ov = 0.08;
  } else if (cls === 'shuttle') {
    fill((x) => {
      const q = Math.sin(Math.min(1, x * 1.15) * Math.PI * 0.5 + 0.2);
      const bow = bowK(x, 0.75);
      return [0.12 * q * bow + 0.01, 0.08 * bow + 0.01, 0.12 * bow];
    });
    d.engines.push({ y: 0, r: 0.07, len: 0.08 });
    d.fins.push({ x: 0.05, len: 0.3, h: 0.16, up: true }, { x: 0.25, len: 0.4, h: 0.08, up: false });
    d.windows.push({ f: 0.25, x0: 0.72, x1: 0.85, step: 0.04 });
    d.ov = 0.08;
  } else if (cls === 'fighter') {
    const type = Math.floor(R() * 3);
    fill((x) => {
      const bow = 1 - Math.pow(Math.max(0, (x - 0.4) / 0.6), 0.8);
      return [0.09 * bow + 0.01, 0.07 * bow + 0.01, 0.06];
    });
    d.engines.push({ y: 0, r: 0.09, len: 0.1 });
    if (type === 0) d.fins.push({ x: 0.1, len: 0.5, h: 0.22, up: true }, { x: 0.1, len: 0.5, h: 0.22, up: false });
    else if (type === 1) d.fins.push({ x: 0.2, len: 0.35, h: 0.3, up: false }, { x: 0.05, len: 0.2, h: 0.15, up: true });
    else d.fins.push({ x: 0.25, len: 0.3, h: 0.28, up: true }, { x: 0.25, len: 0.3, h: 0.28, up: false });
    d.windows.push({ f: 0.1, x0: 0.62, x1: 0.7, step: 0.04 });
    d.ov = 0.1;
  } else {
    // A gun platform: a squat drum with gun and panels.
    fill((x) => {
      const q = Math.sin(x * Math.PI);
      return [0.18 * Math.pow(q, 0.4) + 0.02, 0.18 * Math.pow(q, 0.4) + 0.02, 0.2 * Math.pow(q, 0.5)];
    });
    d.turrets.push({ x: 0.5, r: 0.09, barrels: 2, big: true });
    d.fins.push({ x: 0.05, len: 0.35, h: 0.5, up: true }, { x: 0.6, len: 0.35, h: 0.5, up: false });
    d.windows.push({ f: 0.5, x0: 0.2, x1: 0.8, step: 0.06 });
    d.ov = 0;
  }
  if (merchant && cls !== 'freighter') d.pods.length = 0;
  let up = 0;
  let down = 0;
  for (let i = 0; i <= N; i++) {
    up = Math.max(up, top[i] + 2 * wid[i] * KK);
    down = Math.max(down, bot[i]);
  }
  for (const b of d.boxes) up = Math.max(up, top[0] + 2 * 0.3 * KK + b.z0 + b.h + 0.02);
  if (d.tower) up = Math.max(up, top[Math.round(d.tower.x * N)] + wid[Math.round(d.tower.x * N)] * KK * 2 + d.tower.h + d.tower.headH + 0.04);
  for (const f of d.fins) if (f.up) up = Math.max(up, f.h + 0.02);
  else down = Math.max(down, f.h + 0.02);
  for (const p of d.pods) {
    up = Math.max(up, -p.y + p.r + 0.02);
    down = Math.max(down, p.y + p.r + 0.02);
  }
  for (const e of d.engines) {
    up = Math.max(up, -e.y + e.r * 1.4);
    down = Math.max(down, e.y + e.r * 1.4);
  }
  d.up = up + 0.02;
  d.down = down + 0.02;
  return d;
}

/** Profile at x (0..1), interpolated. */
export const at = (a: Float32Array, x: number) => {
  const f = Math.max(0, Math.min(1, x)) * N;
  const i = Math.min(N - 1, Math.floor(f));
  const q = f - i;
  return a[i] * (1 - q) + a[i + 1] * q;
};

/** Where the running lights are (lengths, from the hull's centre; y up). */
export function lightsOf(d: Design): Light[] {
  const L: Light[] = [];
  const mid = (x: number) => (at(d.top, x) - at(d.bot, x)) / 2;
  L.push({ x: 0.5, y: mid(0.97), kind: 'port' });
  L.push({ x: -0.5 + 0.01, y: at(d.top, 0) * 0.8, kind: 'star' });
  if (d.tower) L.push({ x: d.tower.x - 0.5, y: at(d.top, d.tower.x) + at(d.wid, d.tower.x) * KK * 2 + d.tower.h + d.tower.headH + 0.02, kind: 'strobe' });
  else L.push({ x: 0, y: at(d.top, 0.5) + 0.01, kind: 'strobe' });
  if (d.cls !== 'fighter' && d.cls !== 'shuttle') L.push({ x: -0.5 + 0.02, y: -at(d.bot, 0.02) * 0.8, kind: 'beacon' });
  return L;
}
