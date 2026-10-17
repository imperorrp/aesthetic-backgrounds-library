/**
 * Ironhaze, painted: a city in five planes of fog, like a matte painting, drifting past.
 *
 * How it looks the way it does: every chunk of every plane of the city is painted once, in values
 * only (see ./planes), as it comes into view, then tinted by the hour and the fog: the near planes
 * in the dark ink of the time of day, the far ones fading into the haze, every plane's streets
 * lost in its own ground fog. Over the values go the materials (brick, limestone, verdigris,
 * slate: hue and saturation only, so the light and shade stay), strongest near and by day. The
 * edges toward the sun (or the moon) catch a rim of light; windows, lamps and foundry mouths are
 * light added on top. Between the planes drift smoke, fog, ships, fighters, walkers, islands and
 * air platforms, each toned for its depth. The view drifts rightward forever: near planes pass
 * faster than far ones. The city's mood (amber, verdigris, ashen, rust) is the same day in another
 * air: the whole palette of the hours turned toward its hue.
 *
 * Back to front: the sky; stars, the sun (and its shafts) or the moon; the clouds; then for each
 * plane, the things beyond it (islands, platforms and their people, the sea and its shipping,
 * ships, fighters, walkers, smoke and shells), the plane with its rim, windows and machinery
 * (trains, gondolas, lifts, clocks and their automata, beacons, searchlights, flares, fires,
 * bunting and red flags, people), and its fog; the promenade we walk along, and the people on it;
 * rain and lightning; the grade (mood, canvas, grain, vignette); call-outs, and the HUD.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, mixRgb, typed } from '../../instruments/kit';
import { drawIsland, drawPlatform } from './aloft';
import { dimsOf, KIND_NAMES } from './design';
import { hexA, type Env } from './env';
import { drawPerson } from './figures';
import { drawFrameWorks, drawMachine, drawSign } from './machines';
import { createTiles, mk, mulberry, type Tile, type Tinted } from './planes';
import { drawFighter, drawShip } from './ships';
import { createHaze, SEASONS, WALKER_KINDS } from './sim';
import type { Clock, HazeWorld, Mood, Person, SeaShip } from './types';
import { drawWalker } from './walkers';

export type HazePaintOptions = { traffic: number; speed: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const mix = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, clamp01(k));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};
const posmod = (a: number, n: number) => ((a % n) + n) % n;

// ---- the light through the day ---------------------------------------------------------------
type Light = { top: string; mid: string; low: string; fog: string; ink: string; sun: string; rim: number };
const KEYS: [number, Light][] = [
  [0.0, { top: '#070a12', mid: '#0e1420', low: '#1a2030', fog: '#161b27', ink: '#06070b', sun: '#8fa6c8', rim: 0.3 }],
  [0.2, { top: '#0c101a', mid: '#171c28', low: '#2a2a34', fog: '#20232c', ink: '#08090d', sun: '#a89cb0', rim: 0.2 }],
  [0.255, { top: '#2c2a3c', mid: '#7a4c46', low: '#e8945a', fog: '#9a6e5a', ink: '#1a1416', sun: '#ffb072', rim: 1 }],
  [0.32, { top: '#56606c', mid: '#a89276', low: '#e8c494', fog: '#b4a48c', ink: '#272320', sun: '#ffd8a0', rim: 0.8 }],
  [0.5, { top: '#6c7680', mid: '#a8a698', low: '#d6d0bc', fog: '#b0ad9e', ink: '#2c2a26', sun: '#fff0d4', rim: 0.45 }],
  [0.68, { top: '#626a72', mid: '#a8987c', low: '#e0c69a', fog: '#b8a68a', ink: '#2a2622', sun: '#ffd9a4', rim: 0.75 }],
  [0.755, { top: '#3a3044', mid: '#9a5a44', low: '#f09a58', fog: '#b0745a', ink: '#1e1518', sun: '#ffa45e', rim: 1 }],
  [0.81, { top: '#141220', mid: '#40283a', low: '#7a4038', fog: '#3e2e34', ink: '#0e0b10', sun: '#e07a58', rim: 0.5 }],
  [0.86, { top: '#090c16', mid: '#121828', low: '#222636', fog: '#1a1e2a', ink: '#07080c', sun: '#9aaccc', rim: 0.3 }],
  [1.0, { top: '#070a12', mid: '#0e1420', low: '#1a2030', fog: '#161b27', ink: '#06070b', sun: '#8fa6c8', rim: 0.3 }],
];
/**
 * The moods: the same day, in another city's air. Each turns the amber keys toward its own hue
 * (`hue`, by `pull`), with its own saturation and lightness; `mat` is how much the materials show.
 */
const MOODS: Record<Mood, { tint: string; k: number; fogK: number; hue: number; pull: number; sat: number; lum: number; mat: number }> = {
  amber: { tint: '#c88a46', k: 0.16, fogK: 0.82, hue: 30, pull: 0, sat: 1, lum: 1, mat: 1 },
  verdigris: { tint: '#6f8f7f', k: 0.22, fogK: 0.9, hue: 160, pull: 0.55, sat: 0.75, lum: 1.02, mat: 1.15 },
  ashen: { tint: '#8592a6', k: 0.24, fogK: 0.88, hue: 215, pull: 0.7, sat: 0.55, lum: 1.06, mat: 0.7 },
  rust: { tint: '#b4523a', k: 0.2, fogK: 0.8, hue: 12, pull: 0.55, sat: 1.3, lum: 0.88, mat: 1 },
};
const toHsl = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [hue * 360, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${[f(0), f(8), f(4)].map((v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('')}`;
};
const shiftHue = (hex: string, M: (typeof MOODS)[Mood], k = 1) => {
  const [h, s, l] = toHsl(hex);
  let dh = ((M.hue - h + 540) % 360) - 180;
  if (s < 0.04) dh = 0;
  return fromHsl((h + dh * M.pull * k + 360) % 360, clamp01(s * (1 + (M.sat - 1) * k)), clamp01(l * (1 + (M.lum - 1) * k)));
};
const MOOD_KEYS: Record<Mood, [number, Light][]> = Object.fromEntries(
  (Object.keys(MOODS) as Mood[]).map((m) => {
    const M = MOODS[m];
    return [m, KEYS.map(([d, L]) => [d, { ...L, top: shiftHue(L.top, M), mid: shiftHue(L.mid, M), low: shiftHue(L.low, M), fog: shiftHue(L.fog, M), ink: shiftHue(L.ink, M, 0.6), sun: shiftHue(L.sun, M, 0.5) }] as [number, Light])];
  }),
) as Record<Mood, [number, Light][]>;
function lightAt(d: number, mood: Mood, storm: number, fog: number): Light {
  const KEYS = MOOD_KEYS[mood];
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++)
    if (d >= KEYS[i][0] && d <= KEYS[i + 1][0]) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  const k = (d - a[0]) / Math.max(1e-6, b[0] - a[0]);
  const M = MOODS[mood];
  const c = (x: keyof Light, mk2: number) => mix(mix(a[1][x] as string, b[1][x] as string, k), M.tint, mk2);
  const grey = '#5a5c5e';
  return {
    top: mix(c('top', M.k), grey, storm * 0.55),
    mid: mix(c('mid', M.k), mix(grey, '#8a8a86', 0.5), storm * 0.6 + fog * 0.3),
    low: mix(c('low', M.k), '#8a8680', storm * 0.5 + fog * 0.35),
    fog: mix(c('fog', M.k), '#8e8b84', storm * 0.35 + fog * 0.2),
    ink: c('ink', M.k * 0.4),
    sun: c('sun', M.k * 0.3),
    rim: (a[1].rim + (b[1].rim - a[1].rim) * k) * (1 - storm * 0.7) * (1 - fog * 0.6),
  };
}
const nightOf = (d: number) => clamp01(d > 0.3 && d < 0.7 ? 0 : d <= 0.2 || d >= 0.86 ? 1 : d < 0.5 ? (0.3 - d) / 0.1 : (d - 0.7) / 0.16);
const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.26) / 0.06) + Math.max(0, 1 - Math.abs(d - 0.76) / 0.06);

const HOURS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
function timeWords(day: number): string {
  const mins = Math.round((day * 24 * 60) / 15) * 15;
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const part = (hh: number) => (hh < 5 ? 'AT NIGHT' : hh < 12 ? 'IN THE MORNING' : hh < 18 ? 'IN THE AFTERNOON' : hh < 22 ? 'IN THE EVENING' : 'AT NIGHT');
  const name = (hh: number) => (hh === 12 ? 'NOON' : hh === 0 ? 'MIDNIGHT' : HOURS[hh % 12]);
  if (m === 0) return h === 12 || h === 0 ? name(h) : `${name(h)} ${part(h)}`;
  const words = m === 15 ? 'A QUARTER PAST' : m === 30 ? 'HALF PAST' : 'A QUARTER TO';
  if (m > 30) h = (h + 1) % 24;
  return `${words} ${name(h)}${h === 12 || h === 0 ? '' : ` ${part(h)}`}`;
}

type Cloud = { f: number; x: number; y: number; w: number; h: number; speed: number; shade: HTMLCanvasElement; tint: HTMLCanvasElement; at: Tinted };
/** The edges of the depth slots things are drawn in: slot k is drawn before plane k. */
const EDGES = [-9, 0.2, 0.38, 0.56, 0.76, 1.0, 9];

export function mountHaze(host: SkinHost, o: HazePaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: HazeWorld = createHaze(host.config.seed, W, H, { traffic: o.traffic, speed: o.speed, camera: o.camera });
  const { GW, GH, u } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.8, maxZoom: 2.4 });
  const cam = framing.cam;
  const fogK = MOODS[world.mood].fogK;
  let light: Light = lightAt(world.day, world.mood, 0, 0);
  let night = 0;

  // ---- depth --------------------------------------------------------------------------------------
  const fitOf = () => framing.fit(W, H);
  const zoomAt = (f: number) => {
    const fit = fitOf();
    return fit * (1 + (cam.zoom / fit - 1) * f);
  };
  const cxAt = (f: number) => GW / 2 + world.scroll * f + (cam.x - GW / 2) * f;
  const cyAt = (f: number) => GH / 2 + (cam.y - GH / 2) * f;
  const proj = (x: number, y: number, f: number): [number, number] => {
    const z = zoomAt(f);
    return [(x - cxAt(f)) * z + W / 2, (y - cyAt(f)) * z + H / 2];
  };
  /** The view's extent at a depth, in that depth's x. */
  const span = (f: number): [number, number] => {
    const z = zoomAt(f);
    const c = cxAt(f);
    return [c - W / 2 / z, c + W / 2 / z];
  };
  const enter = (f: number) => {
    const z = zoomAt(f);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-cxAt(f), -cyAt(f));
  };
  const leave = () => ctx.restore();
  const hazeOf = (f: number) => {
    const base = Math.pow(Math.max(0, 1 - f), 1.4) * fogK;
    const thick = world.fog * 0.85 * (1 - f * 0.35) + world.storm * 0.12;
    return clamp01(base + (1 - base) * thick);
  };
  const hazeColor = (f: number) => mix(light.fog, light.low, clamp01((1 - f) * 0.6) * (1 - world.fog * 0.6));
  const tone = (c: string, f: number, lift = 0) => mix(mix(mix(c, light.ink, 0.25 + night * 0.5), light.sun, lift * (1 - night * 0.6)), hazeColor(f), hazeOf(f));

  // ---- textures, once (made on the first paint: a headless run never paints) ------------------------
  const lr = host.fork('haze-look');
  const stars = Array.from({ length: 220 }, () => [lr() * GW, lr() * GH * 0.6, lr()] as [number, number, number]);
  let grain = null as unknown as HTMLCanvasElement;
  let brush = null as unknown as HTMLCanvasElement;
  function makeTextures() {
    grain = mk(160, 160);
    const g1 = grain.getContext('2d')!;
    const img = g1.createImageData(160, 160);
    for (let i = 0; i < 160 * 160; i++) {
      const v = Math.floor(lr() * 255);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g1.putImageData(img, 0, 0);
    brush = mk(384, 384);
    const g = brush.getContext('2d')!;
    g.fillStyle = 'rgb(128,128,128)';
    g.fillRect(0, 0, 384, 384);
    g.lineCap = 'round';
    for (let k = 0; k < 2600; k++) {
      const x = lr() * 384;
      const y = lr() * 384;
      const a = (lr() - 0.5) * 0.9;
      const len = 4 + lr() * 18;
      const v = lr() < 0.5 ? 90 + lr() * 30 : 150 + lr() * 40;
      g.strokeStyle = `rgba(${v},${v},${v},${(0.15 + lr() * 0.25).toFixed(2)})`;
      g.lineWidth = 1 + lr() * 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }

  // ---- the tiles, and tinting them -----------------------------------------------------------------
  const tiles: Map<number, Tile>[] = world.layers.map(() => new Map());
  let builder: ReturnType<typeof createTiles> | null = null;
  let frameT: Tile | null = null;
  function shadeInto(t: CanvasRenderingContext2D, shade: HTMLCanvasElement, color: string, w: number, h: number) {
    t.globalCompositeOperation = 'source-over';
    t.fillStyle = color;
    t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'multiply';
    t.drawImage(shade, 0, 0);
    t.globalCompositeOperation = 'destination-in';
    t.drawImage(shade, 0, 0);
    t.globalCompositeOperation = 'lighter';
    t.drawImage(t.canvas, 0, 0);
    t.globalCompositeOperation = 'source-over';
  }
  const lightSide = () => {
    const sk = (world.day - 0.25) / 0.5;
    if (sk >= -0.05 && sk <= 1.05) return clamp01(sk);
    return clamp01((((world.day + 0.5) % 1) - 0.25) / 0.5);
  };
  function tintTile(P: Tile) {
    const t = P.tint.getContext('2d')!;
    const w = P.tint.width;
    const h = P.tint.height;
    const L = world.layers[P.i];
    t.globalAlpha = 1;
    t.clearRect(0, 0, w, h);
    shadeInto(t, P.shade, P.i === 4 ? mix(light.ink, light.fog, 0.08) : mix(light.ink, light.fog, 0.1 + (1 - L.f) * 0.15), w, h);
    // The materials: their hue and saturation over the values (the light and shade stay), fainter at
    // night and in the far planes, then masked back to the picture.
    const mat = (P.i === 4 ? 0.7 : 0.55 + L.f * 0.4) * (1 - night * 0.55) * MOODS[world.mood].mat;
    if (mat > 0.02) {
      t.globalCompositeOperation = 'color';
      t.globalAlpha = mat;
      t.drawImage(P.paint, 0, 0);
      t.globalAlpha = 1;
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(P.shade, 0, 0);
    }
    t.globalCompositeOperation = 'source-atop';
    const hz = P.i === 4 ? world.fog * 0.25 : hazeOf(L.f);
    if (hz > 0.01) {
      t.globalAlpha = hz;
      t.fillStyle = hazeColor(L.f);
      t.fillRect(0, 0, w, h);
      t.globalAlpha = 1;
    }
    if (P.i < 4) {
      const tiers = world.layout === 'tiers' && P.i === 3;
      const fogH = GH * (0.1 + world.fog * 0.1) * (0.6 + L.m * 0.5) * (tiers ? 0.5 : 1);
      const a = (L.base - fogH - P.y0) * P.res;
      const b = (L.base - P.y0) * P.res;
      const fc = hazeColor(L.f - 0.1);
      if (tiers) {
        const end = (L.base + GH * 0.05 - P.y0) * P.res;
        const gg = t.createLinearGradient(0, a, 0, end);
        gg.addColorStop(0, hexA(fc, 0));
        gg.addColorStop(0.6, hexA(fc, 0.6));
        gg.addColorStop(1, hexA(fc, 0));
        t.fillStyle = gg;
        t.fillRect(0, a, w, end - a);
        t.globalAlpha = 0.08 + world.fog * 0.35;
        t.fillStyle = mix(fc, '#5a3a24', 0.4);
        t.fillRect(0, b, w, h - b);
        t.globalAlpha = 1;
      } else {
        const gg = t.createLinearGradient(0, a, 0, b);
        gg.addColorStop(0, hexA(fc, 0));
        gg.addColorStop(0.7, hexA(fc, 0.7));
        gg.addColorStop(1, hexA(fc, 0.92));
        t.fillStyle = gg;
        t.fillRect(0, a, w, h - a);
      }
    }
    t.globalCompositeOperation = 'source-over';
    // The rims: the picture, cut by itself moved toward the light, in the light's colour.
    const r = P.rimT.getContext('2d')!;
    const rw = P.rimT.width;
    const rh = P.rimT.height;
    const k = lightSide();
    const d = Math.max(1, 1.8 * u * L.m * P.res * 0.5 * (P.i === 4 ? 1.6 : 1));
    const dx = k < 0.38 ? d : k > 0.62 ? -d : 0;
    r.globalCompositeOperation = 'source-over';
    r.clearRect(0, 0, rw, rh);
    r.drawImage(P.shade, 0, 0, rw, rh);
    r.globalCompositeOperation = 'destination-out';
    r.drawImage(P.shade, dx, d * 0.8, rw, rh);
    // A tile's own edges are not edges of the city: no rim there.
    if (dx > 0) r.clearRect(0, 0, Math.ceil(dx) + 1, rh);
    if (dx < 0) r.clearRect(rw - Math.ceil(-dx) - 1, 0, Math.ceil(-dx) + 1, rh);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = light.sun;
    r.fillRect(0, 0, rw, rh);
    r.globalCompositeOperation = 'source-over';
    P.at = { d: world.day, fog: world.fog, storm: world.storm };
  }
  /** Paint the chunks that have come into reach (nearest the view first); let go of those gone. */
  function syncTiles(budget: number) {
    if (!builder) return;
    for (const L of world.layers) {
      if (L.i === 4) continue;
      const map = tiles[L.i];
      const chunks = world.chunks[L.i];
      for (const k of [...map.keys()]) if (!chunks.has(k)) map.delete(k);
      const mid = world.vx(L.f, 0.5);
      const want = [...chunks.keys()].filter((k) => !map.has(k) && chunks.has(k - 1) && chunks.has(k + 1)).sort((a, b) => Math.abs((a + 0.5) * L.cw - mid) - Math.abs((b + 0.5) * L.cw - mid));
      for (const k of want) {
        const [l, r] = span(L.f);
        const visible = (k + 1) * L.cw > l && k * L.cw < r;
        if (budget <= 0 && !visible) break;
        const t = builder.tile(chunks.get(k)!, [chunks.get(k - 1)!, chunks.get(k)!, chunks.get(k + 1)!]);
        tintTile(t);
        map.set(k, t);
        budget--;
      }
    }
  }
  const allTiles = () => [...tiles.flatMap((m) => [...m.values()]), ...(frameT ? [frameT] : [])];

  // ---- clouds ----------------------------------------------------------------------------------------
  const clouds: Cloud[] = [];
  function makeClouds() {
    const R = mulberry(Math.floor(lr() * 1e9));
    for (let k = 0; k < 7; k++) {
      const w = (520 + R() * 760) * u;
      const h = w * (0.15 + R() * 0.08);
      const res = 0.22;
      const shade = mk(w * res, h * res);
      const g = shade.getContext('2d')!;
      g.scale(res, res);
      const puffs = 34 + Math.floor(R() * 20);
      for (let q = 0; q < puffs; q++) {
        const px = w * (0.04 + R() * 0.92);
        const e = Math.max(0.15, 1 - Math.abs(px / w - 0.5) * 1.7);
        const rr = h * (0.1 + R() * 0.2) * Math.sqrt(e);
        const py = h * 0.78 - rr * (0.3 + R() * 0.8) * (0.4 + e);
        g.save();
        g.translate(px, py);
        g.scale(1.6, 1);
        const gr = g.createRadialGradient(-rr * 0.2, -rr * 0.35, rr * 0.05, 0, 0, rr);
        gr.addColorStop(0, 'rgba(160,160,160,0.95)');
        gr.addColorStop(0.6, 'rgba(130,130,130,0.6)');
        gr.addColorStop(1, 'rgba(120,120,120,0)');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, rr, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      g.globalCompositeOperation = 'source-atop';
      const bg = g.createLinearGradient(0, h * 0.35, 0, h * 0.85);
      bg.addColorStop(0, 'rgba(100,100,100,0)');
      bg.addColorStop(1, 'rgba(84,84,84,0.7)');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out';
      const fb = g.createLinearGradient(0, h * 0.7, 0, h);
      fb.addColorStop(0, 'rgba(0,0,0,0)');
      fb.addColorStop(1, 'rgba(0,0,0,0.9)');
      g.fillStyle = fb;
      g.fillRect(0, 0, w, h);
      clouds.push({ f: 0.05 + R() * 0.16, x: R() * GW * 1.6, y: GH * (0.04 + R() * 0.36), w, h, speed: (2 + R() * 4) * u, shade, tint: mk(w * res, h * res), at: { d: -1, fog: 0, storm: 0 } });
    }
  }
  function tintCloud(c: Cloud) {
    const t = c.tint.getContext('2d')!;
    const w = c.tint.width;
    const h = c.tint.height;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, w, h);
    shadeInto(t, c.shade, mix(mix(light.mid, light.low, 0.5), light.fog, 0.3), w, h);
    t.globalCompositeOperation = 'source-atop';
    const lg = t.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, hexA(light.sun, 0.25 + goldenOf(world.day) * 0.3));
    lg.addColorStop(0.5, hexA(light.sun, 0));
    t.fillStyle = lg;
    t.fillRect(0, 0, w, h);
    t.globalCompositeOperation = 'source-over';
    c.at = { d: world.day, fog: world.fog, storm: world.storm };
  }
  let ready = false;
  function setup() {
    ready = true;
    makeTextures();
    builder = createTiles(world);
    frameT = builder.frameTile();
    makeClouds();
    syncTiles(999);
  }
  const drift = (a: Tinted) => {
    if (a.d < 0) return 9;
    const dd = Math.abs(world.day - a.d);
    return Math.max(Math.min(dd, 1 - dd) * 50, Math.abs(world.fog - a.fog) * 8, Math.abs(world.storm - a.storm) * 8);
  };
  let rr = 0;
  /** Re-tint what the light has left behind: anything far behind at once, the rest one a frame. */
  function refreshOne() {
    const list: { at: Tinted; run: () => void }[] = [...allTiles().map((P) => ({ at: P.at, run: () => tintTile(P) })), ...clouds.map((c) => ({ at: c.at, run: () => tintCloud(c) }))];
    for (const it of list) if (drift(it.at) > 1) it.run();
    for (let k = 0; k < list.length; k++) {
      const it = list[(rr + k) % list.length];
      if (drift(it.at) > 0.1) {
        it.run();
        rr = (rr + k + 1) % list.length;
        return;
      }
    }
  }

  // ---- soft sprites, glows, and what the drawing modules share ---------------------------------------
  const softCache = new Map<string, HTMLCanvasElement>();
  function soft(color: string): HTMLCanvasElement {
    const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 10) * 10).toString(16).padStart(2, '0'));
    let c = softCache.get(q);
    if (!c) {
      c = mk(64, 64);
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, hexA(q, 0.9));
      gr.addColorStop(0.5, hexA(q, 0.55));
      gr.addColorStop(1, hexA(q, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      if (softCache.size > 300) softCache.clear();
      softCache.set(q, c);
    }
    return c;
  }
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, rad: number, color: string, a: number) {
    if (a <= 0.01 || rad <= 0) return;
    let c = glowCache.get(color);
    if (!c) {
      c = mk(64, 64);
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, hexA(color, 1));
      gr.addColorStop(0.35, hexA(color, 0.35));
      gr.addColorStop(1, hexA(color, 0));
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(color, c);
    }
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(c, x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = 1;
  }
  const E: Env = { ctx, world, u, tone, hazeOf, glow, night: () => night, serif: SERIF };

  // Bunting (for a parade) and red flags (for a rising), from what is standing now.
  let decorVersion = -1;
  let bunting: [number, number, number, number][][] = [];
  let roofFlags: [number, number][][] = [];
  function decor() {
    if (decorVersion === world.version) return;
    decorVersion = world.version;
    bunting = world.layers.map((L) => {
      const out: [number, number, number, number][] = [];
      if (L.i < 1 || L.i > 3) return out;
      const tall = L.buildings.filter((b) => b.h > GH * 0.1 * L.m && b.kind !== 'spire').sort((a, b) => a.x - b.x);
      for (let k = 0; k < tall.length - 1; k++) {
        const a = tall[k];
        const b = tall[k + 1];
        if (b.x - a.x > GW * 0.2 || hash(a.id, 5) > 0.5) continue;
        out.push([a.x + a.w * 0.8, a.base - a.h + 6 * u, b.x + b.w * 0.2, b.base - b.h + 6 * u]);
      }
      return out;
    });
    roofFlags = world.layers.map((L) => (L.i < 1 || L.i > 3 ? [] : L.buildings.filter((b) => (b.kind === 'block' || b.kind === 'stack' || b.kind === 'deco') && hash(b.id, 9) < 0.33).map((b) => [b.x + b.w * 0.5, b.base - b.h] as [number, number])));
  }

  // ---- the sea --------------------------------------------------------------------------------------
  function drawSea(t: number) {
    if (world.sea === null) return;
    const sy = world.sea;
    // The city's reflection, each plane at its own depth.
    for (const L of world.layers.slice(0, 3)) {
      enter(L.f);
      const [l, r] = span(L.f);
      ctx.save();
      ctx.beginPath();
      ctx.rect(l, sy, r - l, GH);
      ctx.clip();
      ctx.globalAlpha = 0.22;
      ctx.translate(0, sy * 2);
      ctx.scale(1, -1);
      for (const P of tiles[L.i].values()) if (P.x1 > l && P.x0 < r) ctx.drawImage(P.tint, P.x0, P.y0 + (sy - L.base), P.tint.width / P.res, P.h);
      ctx.restore();
      leave();
    }
    enter(0.7);
    const [l, r] = span(0.7);
    const wg = ctx.createLinearGradient(0, sy, 0, GH);
    wg.addColorStop(0, hexA(mix(light.fog, light.low, 0.4), 0.85));
    wg.addColorStop(0.4, hexA(mix(light.fog, light.ink, 0.45), 0.85));
    wg.addColorStop(1, mix(light.ink, light.fog, 0.2));
    ctx.fillStyle = wg;
    ctx.fillRect(l - 20, sy, r - l + 40, GH * 0.6);
    const mist = ctx.createLinearGradient(0, sy - GH * 0.06, 0, sy + GH * 0.04);
    mist.addColorStop(0, hexA(hazeColor(0.6), 0));
    mist.addColorStop(0.6, hexA(mix(hazeColor(0.6), '#7a5232', night * 0.4), 0.7));
    mist.addColorStop(1, hexA(hazeColor(0.6), 0));
    ctx.fillStyle = mist;
    ctx.fillRect(l - 20, sy - GH * 0.06, r - l + 40, GH * 0.1);
    ctx.strokeStyle = hexA(light.sun, 0.12 + goldenOf(world.day) * 0.15);
    ctx.lineWidth = 1 * u;
    const wrap = GW * 1.2;
    for (let k = 0; k < 70; k++) {
      const y = sy + 3 * u + Math.pow(hash(k, 7), 1.6) * (GH - sy);
      const x = l - 40 + posmod(hash(k, 3) * wrap + t * 5 * (1 + hash(k)) - (l - 40), wrap);
      const len = (14 + hash(k, 5) * 40) * u * (0.5 + (y - sy) / (GH - sy));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    leave();
  }
  function drawSeaShip(sh: SeaShip) {
    const sy = (world.sea ?? GH) + (sh.f - 0.6) * GH * 0.4;
    const L = sh.len;
    const body = tone('#3a3836', sh.f, 0.1);
    const hi = tone('#7a7670', sh.f, 0.35);
    const dk = tone('#1e1c1a', sh.f);
    enter(sh.f);
    ctx.save();
    ctx.translate(sh.x, sy);
    ctx.scale(sh.dir, 1);
    ctx.fillStyle = hexA(tone('#e8e4dc', sh.f, 0.3), 0.35);
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.lineTo(-L * 0.9, L * 0.012);
    ctx.lineTo(-L * 0.9, -L * 0.004);
    ctx.fill();
    ctx.fillStyle = dk;
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, -L * 0.05);
    ctx.lineTo(L * 0.46, -L * 0.05);
    ctx.lineTo(L * 0.5, L * 0.01);
    ctx.lineTo(-L * 0.48, L * 0.01);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.fillRect(-L * 0.2, -L * 0.1, L * 0.36, L * 0.05);
    ctx.fillRect(L * 0.04, -L * 0.17, L * 0.07, L * 0.07);
    for (let k = 0; k < sh.funnels; k++) {
      const fx = -L * 0.12 + k * L * 0.08;
      ctx.fillStyle = dk;
      ctx.fillRect(fx, -L * 0.2, L * 0.035, L * 0.11);
      ctx.fillStyle = hi;
      ctx.fillRect(fx, -L * 0.2, L * 0.005, L * 0.11);
    }
    if (sh.kind === 'ironclad') {
      for (const tx of [L * 0.3, -L * 0.34]) {
        ctx.fillStyle = body;
        ctx.fillRect(tx - L * 0.04, -L * 0.085, L * 0.08, L * 0.04);
        ctx.strokeStyle = dk;
        ctx.lineWidth = Math.max(0.5, L * 0.008);
        ctx.beginPath();
        ctx.moveTo(tx + (tx > 0 ? L * 0.03 : -L * 0.03), -L * 0.07);
        ctx.lineTo(tx + (tx > 0 ? L * 0.13 : -L * 0.13), -L * 0.075);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = dk;
    ctx.lineWidth = Math.max(0.4, L * 0.003);
    ctx.beginPath();
    ctx.moveTo(L * 0.07, -L * 0.17);
    ctx.lineTo(L * 0.07, -L * 0.3);
    ctx.moveTo(-L * 0.25, -L * 0.1);
    ctx.lineTo(-L * 0.25, -L * 0.24);
    ctx.stroke();
    ctx.restore();
    if (night > 0.1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hexA('#ffc878', 0.7 * night);
      for (let k = 0; k < 8; k++) ctx.fillRect(sh.x - L * 0.18 + k * L * 0.045, sy - L * 0.085, L * 0.012, L * 0.012);
      ctx.restore();
    }
    leave();
  }

  // ---- smoke, shells and sparks -----------------------------------------------------------------------
  function drawFx(f0: number, f1: number, t: number) {
    for (const fx of world.fx) {
      if (fx.f < f0 || fx.f >= f1) continue;
      const age = world.t - fx.t0;
      if (age < 0) continue;
      const k = age / fx.dur;
      const [x, y] = proj(fx.x, fx.y, fx.f);
      if (x < -200 || x > W + 200) continue;
      const z = zoomAt(fx.f);
      const r = fx.r * z;
      if (fx.kind === 'smoke' || fx.kind === 'steam' || fx.kind === 'flak') {
        const base =
          fx.kind === 'steam' ? mix(mix('#e8e4dc', light.fog, 0.4), light.ink, night * 0.5) : mix(mix(fx.color, light.ink, 0.2 + night * 0.4), hazeColor(fx.f), hazeOf(fx.f) * 0.85);
        const a = (fx.kind === 'steam' ? 0.36 : fx.kind === 'flak' ? 0.55 : 0.32) * Math.pow(1 - k, 1.3) * Math.min(1, age * (fx.kind === 'flak' ? 6 : 1.2)) * (1 - hazeOf(fx.f) * 0.3);
        const sw = r * (3 + k * (fx.kind === 'flak' ? 1 : 2.6));
        const sh = r * (2.6 + k * 0.6);
        ctx.globalAlpha = a;
        ctx.drawImage(soft(base), x - sw / 2, y - sh / 2, sw, sh);
        ctx.globalAlpha = 1;
      } else if (fx.kind === 'debris') {
        ctx.fillStyle = hexA(fx.color, 1 - k);
        ctx.fillRect(x, y, Math.max(1, fx.r * z), Math.max(1, fx.r * z));
      } else if (fx.kind === 'bomb') {
        ctx.fillStyle = tone('#111111', fx.f);
        ctx.fillRect(x - 1, y - 2, 2, 4);
      } else if (fx.kind === 'water') {
        ctx.fillStyle = hexA(mix('#dbeafe', light.fog, 0.3), 0.6 * (1 - k));
        ctx.fillRect(x, y, Math.max(1, 1.4 * z), Math.max(2, 4 * z));
      } else if (fx.kind === 'confetti') {
        ctx.fillStyle = hexA(tone(fx.color, fx.f, 0.4), 1 - k);
        const fl = Math.abs(Math.sin(t * 8 + fx.seed));
        ctx.fillRect(x, y, Math.max(1, 2.4 * z * fl), Math.max(1, 1.6 * z));
      } else if (fx.kind === 'bell') {
        ctx.strokeStyle = hexA('#fde68a', 0.5 * (1 - k));
        ctx.lineWidth = 1.2;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(x, y, r * (1.4 + age * 1.5 + j * 0.5), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const fx of world.fx) {
      if (fx.f < f0 || fx.f >= f1) continue;
      const age = world.t - fx.t0;
      if (age < 0) continue;
      const k = age / fx.dur;
      const kind = fx.kind;
      if (kind !== 'fire' && kind !== 'spark' && kind !== 'flash' && kind !== 'lantern' && kind !== 'flare' && kind !== 'muzzle' && kind !== 'shell' && kind !== 'firework') continue;
      const [x, y] = proj(fx.x, fx.y, fx.f);
      if (x < -200 || x > W + 200) continue;
      const z = zoomAt(fx.f);
      const hz = 1 - hazeOf(fx.f) * 0.5;
      if (kind === 'fire') glow(x, y, fx.r * z * 2, '#ff7a20', 0.6 * (1 - k) * hz);
      else if (kind === 'spark' || kind === 'firework') {
        ctx.fillStyle = hexA(fx.color, (1 - k) * hz);
        ctx.fillRect(x - 1, y - 1, 2, 2);
        if (kind === 'firework' && age < 0.25) glow(x, y, 24 * u * z, fx.color, 0.2);
      } else if (kind === 'flash') glow(x, y, fx.r * z * (1 + k), '#ffb060', (1 - k) * 0.9 * hz);
      else if (kind === 'muzzle') glow(x, y, fx.r * z * 2, '#ffe9a8', (1 - k) * hz);
      else if (kind === 'shell') {
        const [px, py] = proj(fx.x - fx.vx * 0.05, fx.y - fx.vy * 0.05, fx.f);
        ctx.strokeStyle = hexA(fx.color, 0.85 * hz);
        ctx.lineWidth = Math.max(1, 1.4 * z * fx.r);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (kind === 'flare') {
        glow(x, y, 30 * u * z, '#ff5040', 0.9 * (1 - k));
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      } else if (kind === 'lantern') {
        const fl = 0.8 + 0.2 * Math.sin(t * 6 + fx.seed);
        glow(x, y, fx.r * z * 5, '#ff9a3c', 0.45 * fl * Math.min(1, (1 - k) * 3) * hz);
        ctx.fillStyle = hexA('#ffd8a0', 0.9 * Math.min(1, (1 - k) * 3) * hz);
        ctx.fillRect(x - fx.r * z * 0.5, y - fx.r * z * 0.7, fx.r * z, fx.r * z * 1.4);
      }
    }
    ctx.restore();
  }

  /** The fog between the planes: a band of haze at the streets of this depth, and banks drifting in it. */
  function fogBand(f: number, t: number) {
    const hz = hazeOf(f);
    const gy = world.groundAt(f);
    enter(f);
    const [l, r] = span(f);
    const top = gy - GH * (0.13 + world.fog * 0.2);
    const g = ctx.createLinearGradient(0, top, 0, gy + GH * 0.04);
    const a = 0.22 + hz * 0.26 + world.fog * 0.4;
    const fc = mix(hazeColor(f), '#7a5232', night * 0.42 + world.pour * 0.2);
    g.addColorStop(0, hexA(fc, 0));
    g.addColorStop(0.75, hexA(fc, a * 0.65));
    g.addColorStop(1, hexA(fc, Math.min(1, a)));
    ctx.fillStyle = g;
    ctx.fillRect(l - 40, top, r - l + 80, gy - top + GH * 0.5);
    const spr = soft(mix(hazeColor(f), '#ffffff', 0.04 + (1 - night) * 0.05));
    const R = mulberry(Math.round(f * 1000));
    const wrap = GW * 1.6;
    for (let k = 0; k < 9; k++) {
      const w = (260 + R() * 360) * u * world.m(f);
      const x = l - GW * 0.3 + posmod(R() * wrap + t * (4 + R() * 6) * u * world.m(f) * (R() < 0.5 ? 1 : -1) + world.wind * t * 0.2 - (l - GW * 0.3), wrap);
      const y = gy - GH * (0.02 + R() * 0.12);
      ctx.globalAlpha = (0.18 + world.fog * 0.3) * (0.6 + R() * 0.4);
      ctx.drawImage(spr, x - w / 2, y - w * 0.12, w, w * 0.24);
    }
    ctx.globalAlpha = 1;
    leave();
  }

  // ---- the clocks ----------------------------------------------------------------------------------------
  function drawClock(ck: Clock, t: number) {
    const { x: cx, y: cy, r: cr, f } = ck;
    const hz = hazeOf(f);
    if (ck.style === 'gear') {
      for (const [gx, gy, gr, sp] of [[-0.35, 0.25, 0.42, 0.3], [0.38, -0.2, 0.3, -0.45], [0.1, 0.45, 0.22, 0.6]] as [number, number, number, number][]) {
        ctx.save();
        ctx.translate(cx + gx * cr, cy + gy * cr);
        ctx.rotate(t * sp);
        ctx.fillStyle = tone('#3a2c1c', f, 0.1);
        const n = Math.max(8, Math.round(gr * 30));
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const a1 = ((k + 0.5) / n) * Math.PI * 2;
          ctx.lineTo(Math.cos(a0) * gr * cr, Math.sin(a0) * gr * cr);
          ctx.lineTo(Math.cos(a0) * gr * cr * 1.15, Math.sin(a0) * gr * cr * 1.15);
          ctx.lineTo(Math.cos(a1) * gr * cr * 1.15, Math.sin(a1) * gr * cr * 1.15);
          ctx.lineTo(Math.cos(a1) * gr * cr, Math.sin(a1) * gr * cr);
        }
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = hexA(mix(tone('#d8c49a', f, 0.4), '#ffd890', night * 0.8), 0.55);
    } else ctx.fillStyle = mix(tone('#d8ccae', f, 0.4), '#ffe0a0', night * 0.8);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    const ink = tone('#2a2018', f);
    ctx.strokeStyle = hexA(ink, 0.8);
    ctx.lineWidth = Math.max(0.5, cr * 0.04);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * cr * (k % 3 === 0 ? 0.74 : 0.82), cy + Math.sin(a) * cr * (k % 3 === 0 ? 0.74 : 0.82));
      ctx.lineTo(cx + Math.cos(a) * cr * 0.94, cy + Math.sin(a) * cr * 0.94);
      ctx.stroke();
    }
    if (ck.style !== 'deco') {
      ctx.lineWidth = Math.max(0.3, cr * 0.015);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * cr * 0.7, cy + Math.sin(a) * cr * 0.7);
        ctx.stroke();
      }
    }
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    const hrs = world.day * 24;
    const hA = ((hrs % 12) / 12) * Math.PI * 2 - Math.PI / 2;
    const mA = (hrs % 1) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = tone('#140e0a', f);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, cr * 0.08);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hA) * cr * 0.5, cy + Math.sin(hA) * cr * 0.5);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, cr * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(mA) * cr * 0.8, cy + Math.sin(mA) * cr * 0.8);
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (night > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(cx, cy, cr * 2.6, '#ffc870', night * 0.35 * (1 - hz * 0.5));
      ctx.restore();
    }
    if (ck.great && world.automata > 0.02) {
      const s = u * world.m(f);
      const gy = cy + cr * 1.5 - 2 * s;
      const sw = cr * 3;
      for (let k = 0; k < 4; k++) {
        const side = k < 2 ? -1 : 1;
        const along = clamp01(world.automata * 1.4 - (k % 2) * 0.3);
        const x = cx + side * sw * 0.42 - side * along * sw * (0.18 + (k % 2) * 0.16);
        const p: Person = { path: 0, u: world.t * 0.02 + k, speed: 0, dir: side > 0 ? -1 : 1, kind: [0, 3, 5, 1][k], wait: 0, stand: false, flag: 0, seed: k * 77 };
        drawPerson(E, p, x, gy, 13 * s, f, along < 1, false);
      }
    }
  }

  /** One plane: its tiles in view, and its life: trains, gondolas, lifts, clocks, bunting, light, fires, people. */
  function drawPlane(i: number, t: number) {
    const L = world.layers[i];
    const f = L.f;
    const s = L.m * u;
    const hz = i === 4 ? 0 : hazeOf(f);
    const [vl, vr] = span(f);
    const view = i === 4 ? [] : [...tiles[i].values()].filter((P) => P.x1 > vl && P.x0 < vr);
    enter(f);
    if (i === 4 && frameT) {
      const o0 = Math.floor(vl / GW) * GW;
      for (let o = o0; o < vr; o += GW) ctx.drawImage(frameT.tint, o, frameT.y0, frameT.tint.width / frameT.res, frameT.h);
      drawFrameWorks(E, t, vl, vr);
    } else for (const P of view) ctx.drawImage(P.tint, P.x0, P.y0, P.tint.width / P.res, P.h);
    if (L.viaduct !== null) {
      for (const tr of world.trains) {
        if (tr.layer !== i) continue;
        const y = L.viaduct;
        const c = tone('#2a2622', f, 0.1);
        const hi = tone('#6a6258', f, 0.3);
        ctx.fillStyle = c;
        for (let k = 0; k < tr.cars; k++) {
          const x = tr.x - tr.dir * (30 * s + k * 34 * s);
          ctx.beginPath();
          ctx.roundRect(x - 15 * s, y - 13 * s, 30 * s, 12 * s, 2 * s);
          ctx.fill();
        }
        ctx.fillRect(tr.x - 16 * s, y - 12 * s, 32 * s, 11 * s);
        ctx.fillRect(tr.x + tr.dir * 8 * s - 2.5 * s, y - 22 * s, 5 * s, 10 * s);
        ctx.fillStyle = hi;
        ctx.fillRect(tr.x - 16 * s, y - 12 * s, 32 * s, 1 * s);
        if (night > 0.1) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA('#ffcf80', night * 0.85 * (1 - hz * 0.5));
          for (let k = 0; k < tr.cars; k++) {
            const x = tr.x - tr.dir * (30 * s + k * 34 * s);
            for (let q = 0; q < 5; q++) ctx.fillRect(x - 12 * s + q * 5.4 * s, y - 10 * s, 3 * s, 3.4 * s);
          }
          glow(tr.x + tr.dir * 17 * s, y - 7 * s, 30 * s, '#fff0c8', night * 0.8);
          ctx.restore();
        }
      }
    }
    for (const gd of world.gondolas) {
      if (gd.layer !== i) continue;
      const [ax, ay, bx, by] = gd.cable;
      const x = ax + (bx - ax) * gd.u;
      if (x < vl - 50 || x > vr + 50) continue;
      const y = ay + (by - ay) * gd.u + 4 * Math.abs(bx - ax) * 0.08 * gd.u * (1 - gd.u) * 2;
      ctx.strokeStyle = tone('#2a2622', f);
      ctx.lineWidth = Math.max(0.5, 0.8 * s);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10 * s);
      ctx.stroke();
      ctx.fillStyle = tone('#5a3a2a', f, 0.2);
      ctx.beginPath();
      ctx.roundRect(x - 9 * s, y + 10 * s, 18 * s, 13 * s, 3 * s);
      ctx.fill();
      ctx.fillStyle = tone('#c9a24a', f, 0.3);
      ctx.fillRect(x - 9 * s, y + 10 * s, 18 * s, 1.2 * s);
      ctx.fillStyle = night > 0.1 ? hexA('#ffcf80', 0.4 + night * 0.5) : tone('#1a1a1a', f);
      ctx.fillRect(x - 7 * s, y + 13 * s, 14 * s, 5 * s);
    }
    const under = world.layout === 'tiers' && i === 3;
    for (const P of view) {
      P.lifts.forEach(([lx, y0, y1], k) => {
        const ls = under ? u * 0.9 : s;
        const ph = 0.5 + 0.5 * Math.sin(t * 0.12 + k * 1.7 + lx * 0.01);
        const y = y0 + (y1 - y0 - 12 * ls) * ph;
        ctx.fillStyle = tone('#4a3a2a', f, 0.2);
        ctx.fillRect(lx - 5 * ls, y, 10 * ls, 12 * ls);
        ctx.fillStyle = night > 0.1 || under ? hexA('#ffcf80', 0.5 + night * 0.4) : tone('#1a1a1a', f);
        ctx.fillRect(lx - 3.5 * ls, y + 2 * ls, 7 * ls, 5 * ls);
      });
      for (const [x, y, h] of P.falls) {
        const fg = ctx.createLinearGradient(0, y, 0, y + h);
        fg.addColorStop(0, hexA(tone('#e8eef0', f, 0.5), 0.75));
        fg.addColorStop(1, hexA(tone('#e8eef0', f, 0.5), 0));
        ctx.fillStyle = fg;
        ctx.fillRect(x - 2 * s + Math.sin(t * 3 + x) * s * 0.3, y, 4 * s, h);
      }
    }
    for (const ck of world.clocks) if (ck.layer === i && ck.x > vl - ck.r * 6 && ck.x < vr + ck.r * 6) drawClock(ck, t);
    // The words on the walls, and the machinery at work on the roofs and walls (and under the decks).
    for (const sg of L.signs) if (sg.x + sg.w > vl && sg.x - sg.w < vr) drawSign(E, sg, f, t);
    for (const mc of L.machines) if (Math.max(mc.x, mc.x2) > vl - 120 * s && Math.min(mc.x, mc.x2) < vr + 120 * s) drawMachine(E, mc, f, t);
    decor();
    if (world.bunting > 0.03 && i < 4) {
      for (const [x0, y0, x1, y1] of bunting[i]) {
        if (x1 < vl || x0 > vr) continue;
        ctx.strokeStyle = tone('#2a2420', f);
        ctx.lineWidth = Math.max(0.4, 0.5 * s);
        const sag = (x1 - x0) * 0.12;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1);
        ctx.stroke();
        const n = Math.max(3, Math.floor((x1 - x0) / (8 * s)));
        for (let k = 1; k < n; k++) {
          const q = k / n;
          const x = x0 + (x1 - x0) * q;
          const y = y0 + (y1 - y0) * q + 2 * sag * q * (1 - q);
          ctx.fillStyle = hexA(tone(['#b91c1c', '#e7e5e4', '#1e3a8a'][k % 3], f, 0.3), world.bunting);
          ctx.beginPath();
          ctx.moveTo(x - 2.4 * s, y);
          ctx.lineTo(x + 2.4 * s, y);
          ctx.lineTo(x, y + 5 * s + Math.sin(t * 4 + k) * s);
          ctx.fill();
        }
      }
    }
    if (world.unrest > 0.03 && i < 4) {
      for (const [fx, fy] of roofFlags[i]) {
        if (fx < vl || fx > vr) continue;
        ctx.strokeStyle = tone('#2a2420', f);
        ctx.lineWidth = Math.max(0.4, 0.6 * s);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - 20 * s);
        ctx.stroke();
        const wave = Math.sin(t * 4 + fx) * 2 * s;
        ctx.fillStyle = hexA(tone('#b91c1c', f, 0.3), world.unrest);
        ctx.beginPath();
        ctx.moveTo(fx, fy - 20 * s);
        ctx.quadraticCurveTo(fx + 7 * s, fy - 19 * s + wave, fx + 14 * s, fy - 18 * s + wave);
        ctx.lineTo(fx + 14 * s, fy - 11 * s + wave);
        ctx.quadraticCurveTo(fx + 7 * s, fy - 12 * s - wave, fx, fy - 12 * s);
        ctx.fill();
      }
    }
    // Light.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (under && world.under) {
      const U = world.under;
      const ug = ctx.createLinearGradient(0, U.floor, 0, U.deck);
      ug.addColorStop(0, `rgba(255,120,40,${(0.16 + world.pour * 0.1).toFixed(3)})`);
      ug.addColorStop(0.6, 'rgba(255,120,40,0.04)');
      ug.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = ug;
      ctx.fillRect(vl - 40, U.deck, vr - vl + 80, U.floor - U.deck);
    }
    const rimA = light.rim * Math.pow(1 - hz, 1.6) * (i === 4 ? 0.55 : 0.42);
    const winA = Math.max(clamp01((night - 0.08) * 1.5), under ? 0.55 : 0) * (1 - hz * 0.55) * (1 - world.fog * 0.5);
    const lightTile = (P: Tile, ox: number) => {
      const w = P.tint.width / P.res;
      if (rimA > 0.02) {
        ctx.globalAlpha = rimA;
        ctx.drawImage(P.rimT, P.x0 + ox, P.y0, w, P.h);
      }
      if (winA > 0.02 || i === 4) {
        ctx.globalAlpha = i === 4 ? clamp01((night - 0.08) * 1.5) : winA;
        if (ctx.globalAlpha > 0.02) ctx.drawImage(P.win, P.x0 + ox, P.y0, w, P.h);
      }
      ctx.globalAlpha = 1;
      for (const [gx, gy, gw, gh] of P.glows) {
        const fl = 0.75 + 0.25 * Math.sin(t * 6 + gx) * Math.sin(t * 2.3);
        const a = (0.45 + world.pour * 0.55) * fl * (1 - hz * 0.5);
        const mg = ctx.createLinearGradient(0, gy + gh, 0, gy);
        mg.addColorStop(0, hexA('#ffb050', a));
        mg.addColorStop(0.5, hexA('#ff7a24', a * 0.6));
        mg.addColorStop(1, hexA('#ff5a10', 0));
        ctx.fillStyle = mg;
        ctx.fillRect(gx + ox, gy, gw, gh);
        glow(gx + ox + gw / 2, gy + gh * 0.8, gw * (1.2 + world.pour * 2), '#ff6a1a', a * 0.5);
        if (world.pour > 0.1) glow(gx + ox + gw / 2, gy - gh * 2, gw * 6 * world.pour, '#ff5a10', 0.25 * world.pour * (1 - hz * 0.5));
      }
      for (const [fx, fy] of P.flares) {
        const fl = 0.7 + 0.3 * Math.sin(t * 9 + fx) * Math.sin(t * 3.7);
        glow(fx + ox, fy - 6 * s, 26 * s * fl, '#ff8a2a', 0.7 * (1 - hz * 0.4));
        ctx.fillStyle = hexA('#ffd890', 0.85 * fl);
        ctx.beginPath();
        ctx.moveTo(fx + ox - 2.4 * s, fy);
        ctx.quadraticCurveTo(fx + ox + Math.sin(t * 7) * 3 * s, fy - 16 * s * fl, fx + ox + 2.4 * s, fy);
        ctx.fill();
      }
      for (const [lx, ly] of P.lamps) {
        const lamp = under && world.under && ly > world.under.deck ? 0.6 : night;
        if (lamp > 0.1) glow(lx + ox, ly, (i === 4 ? 60 * u : 14 * s), '#ffc070', lamp * (i === 4 ? 0.55 : 0.6) * (1 - hz * 0.5));
      }
      if (night > 0.35 || world.search) {
        for (const [k, [sx0, sy]] of P.spots.entries()) {
          const sx = sx0 + ox;
          const target = world.search;
          let a = -Math.PI / 2 + Math.sin(t * 0.13 + k * 2.3 + sx * 0.003) * 0.7;
          if (target) {
            const [tx, ty] = proj(target.x, target.y, target.f);
            const [px, py] = proj(sx, sy, f);
            a = Math.atan2(ty - py, tx - px) + Math.sin(t * 2 + k) * 0.015;
          }
          const len = GH * 1.1;
          const sp = target ? 0.022 : 0.035;
          const lg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
          lg.addColorStop(0, hexA('#e8f0ff', (target ? 0.24 : 0.16) * Math.max(night, 0.4) * (1 - hz * 0.6)));
          lg.addColorStop(1, hexA('#e8f0ff', 0));
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a - sp) * len, sy + Math.sin(a - sp) * len);
          ctx.lineTo(sx + Math.cos(a + sp) * len, sy + Math.sin(a + sp) * len);
          ctx.fill();
        }
      }
    };
    if (i === 4 && frameT) {
      const o0 = Math.floor(vl / GW) * GW;
      for (let o = o0; o < vr; o += GW) lightTile(frameT, o);
    } else for (const P of view) lightTile(P, 0);
    for (const fire of world.fires) {
      if (fire.layer !== i || world.t > fire.until) continue;
      const fl = 0.7 + 0.3 * Math.sin(t * 8 + fire.x);
      glow(fire.x, fire.y, fire.w * 1.6 * fl, '#ff6a1a', 0.7 * (1 - hz * 0.4));
      for (let k = 0; k < 5; k++) {
        const x = fire.x + (hash(Math.floor(fire.x), k) - 0.5) * fire.w;
        ctx.fillStyle = k % 2 ? 'rgba(251,146,60,0.7)' : 'rgba(253,224,71,0.6)';
        ctx.beginPath();
        ctx.moveTo(x - fire.w * 0.08, fire.y);
        ctx.quadraticCurveTo(x + Math.sin(t * 6 + k) * fire.w * 0.05, fire.y - fire.w * 0.4 * fl, x + fire.w * 0.08, fire.y);
        ctx.fill();
      }
    }
    if (Math.floor(t * 1.1 + i) % 2 === 0 && night + goldenOf(world.day) * 0.5 > 0.2) {
      for (const b of L.buildings) if (b.beacon && b.beacon[0] > vl && b.beacon[0] < vr) glow(b.beacon[0], b.beacon[1], 6 * s + 3, '#ff3020', (0.5 + night * 0.5) * (1 - hz * 0.6));
    }
    ctx.restore();
    if (i < 4) {
      const ps = (under ? u * 0.9 : s) * 15;
      for (const p of world.people) {
        const path = world.paths.get(p.path);
        if (!path || path.layer !== i) continue;
        const x = path.x0 + (path.x1 - path.x0) * p.u;
        if (x < vl - 20 || x > vr + 20) continue;
        drawPerson(E, p, x, path.y, path.kind === 'under' ? u * 0.9 * 15 : ps, f, !p.stand && p.wait <= 0, false);
      }
    }
    leave();
  }

  /** The people on the promenade with us: behind its rail (drawn before it), or on its deck (after). */
  function framePeople(behind: boolean) {
    enter(1);
    const [vl, vr] = span(1);
    for (const p of world.people) {
      const path = world.paths.get(p.path);
      if (!path || path.kind !== 'frame' || path.f < 1 !== behind) continue;
      const x = path.x0 + (path.x1 - path.x0) * p.u;
      if (x < vl - 60 || x > vr + 60) continue;
      drawPerson(E, p, x, path.y, u * 1.2 * 48, 1, !p.stand && p.wait <= 0, true);
    }
    leave();
  }

  function sky(t: number) {
    const gold = goldenOf(world.day);
    const [, hy] = proj(0, GH * 0.62, 0.05);
    const [, ty] = proj(0, 0, 0.05);
    const sg = ctx.createLinearGradient(0, ty, 0, hy);
    sg.addColorStop(0, light.top);
    sg.addColorStop(0.6, light.mid);
    sg.addColorStop(1, light.low);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);
    enter(0.04);
    const [sl] = span(0.04);
    if (night > 0.1 && world.storm < 0.7) {
      for (const [x0, y, k] of stars) {
        const x = sl - GW * 0.1 + posmod(x0 - (sl - GW * 0.1), GW * 1.2);
        const tw = 0.5 + 0.5 * Math.sin(t * (0.8 + k * 2) + k * 40);
        ctx.fillStyle = `rgba(235,235,245,${(night * (0.15 + k * 0.6) * tw * (1 - world.storm) * (1 - world.fog * 0.8)).toFixed(3)})`;
        const sz = k > 0.9 ? 2 * u : 1.1 * u;
        ctx.fillRect(x, y, sz, sz);
      }
    }
    const sk = (world.day - 0.25) / 0.5;
    if (sk > -0.06 && sk < 1.06) {
      const sx = world.vx(0.04, 0.06 + 0.88 * sk);
      const sy = GH * 0.62 - Math.sin(clamp01(sk) * Math.PI) * GH * 0.52;
      const veil = 1 - world.storm * 0.8 - world.fog * 0.6;
      glow(sx, sy, (260 + gold * 160) * u, light.sun, 0.5 * veil);
      glow(sx, sy, 90 * u, '#fff4e0', 0.6 * veil);
      ctx.fillStyle = hexA(mix('#fff6e6', light.sun, 0.4 + gold * 0.4), 0.95 * Math.max(0, veil));
      ctx.beginPath();
      ctx.arc(sx, sy, (34 + gold * 16) * u, 0, Math.PI * 2);
      ctx.fill();
      if (veil > 0.2) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 9; k++) {
          const a = Math.PI * 0.5 + (k - 4) * 0.16 + Math.sin(t * 0.02 + k) * 0.03 + (sk - 0.5) * -0.6;
          const len = GH * 1.4;
          const sp = 0.02 + hash(k, 3) * 0.035;
          const lg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
          const al = (0.035 + gold * 0.06) * veil;
          lg.addColorStop(0, hexA(light.sun, al));
          lg.addColorStop(1, hexA(light.sun, 0));
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(a - sp) * len, sy + Math.sin(a - sp) * len);
          ctx.lineTo(sx + Math.cos(a + sp) * len, sy + Math.sin(a + sp) * len);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    const mk2 = (((world.day + 0.5) % 1) - 0.25) / 0.5;
    if (mk2 > -0.05 && mk2 < 1.05 && night > 0.2) {
      const big = world.moon;
      let mx = world.vx(0.04, 0.08 + 0.84 * mk2);
      let my = GH * 0.6 - Math.sin(clamp01(mk2) * Math.PI) * GH * 0.5;
      if (big > 0.01) {
        mx += (world.vx(0.04, 0.6) - mx) * big;
        my += (GH * 0.34 - my) * big;
      }
      const mr = (26 + big * 150) * u;
      const veil = (1 - world.storm * 0.85) * (1 - world.fog * 0.5) * night;
      glow(mx, my, mr * 3.2, mix('#cfd8e8', light.sun, 0.3), 0.3 * veil);
      ctx.fillStyle = hexA(mix('#eae6da', '#f0d8b0', big * 0.5), 0.95 * veil);
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      const R = mulberry(77);
      ctx.fillStyle = hexA('#8a8478', 0.22 * veil);
      for (let k = 0; k < 9; k++) {
        ctx.beginPath();
        ctx.arc(mx + (R() - 0.5) * mr * 1.2, my + (R() - 0.5) * mr * 1.2, mr * (0.08 + R() * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    leave();
    for (const c of clouds) {
      const [cl] = span(c.f);
      const wrap = GW * 1.6 + c.w;
      const x = cl - c.w + posmod(c.x + t * c.speed + world.wind * t * 0.1 - (cl - c.w), wrap);
      enter(c.f);
      ctx.globalAlpha = 0.7 * (1 - night * 0.35);
      ctx.drawImage(c.tint, x, c.y, c.w, c.h);
      ctx.globalAlpha = 1;
      leave();
    }
  }

  function paint(t: number) {
    night = nightOf(world.day);
    light = lightAt(world.day, world.mood, world.storm, world.fog);
    if (!ready) setup();
    syncTiles(1);
    refreshOne();
    sky(t);
    for (let k = 0; k <= 5; k++) {
      const f0 = EDGES[k];
      const f1 = EDGES[k + 1];
      for (const is of world.islands)
        if (is.f >= f0 && is.f < f1 && world.inView(is.x, is.f, 0.2 + is.w / GW)) {
          enter(is.f);
          drawIsland(E, is, t);
          leave();
        }
      for (const pl of world.platforms)
        if (pl.f >= f0 && pl.f < f1 && world.inView(pl.x, pl.f, 0.2 + pl.w / GW)) {
          enter(pl.f);
          drawPlatform(E, pl, t);
          const path = world.paths.get(pl.path);
          if (path)
            for (const p of world.people) {
              if (p.path !== pl.path) continue;
              drawPerson(E, p, path.x0 + (path.x1 - path.x0) * p.u, path.y - 5 * u * world.m(pl.f), 15 * u * world.m(pl.f), pl.f, !p.stand && p.wait <= 0, false);
            }
          leave();
        }
      for (const s of world.ships)
        if (s.f >= f0 && s.f < f1 && world.inView(s.x, s.f, 0.1 + s.len / GW)) {
          enter(s.f);
          drawShip(E, s, t);
          leave();
        }
      for (const fi of world.fighters)
        if (fi.f >= f0 && fi.f < f1) {
          enter(fi.f);
          drawFighter(E, fi, t);
          leave();
        }
      for (const wk of world.walkers)
        if (wk.f >= f0 && wk.f < f1 && world.inView(wk.x, wk.f, 0.1 + (wk.h * 2.5) / GW)) {
          enter(wk.f);
          drawWalker(E, wk, t);
          leave();
        }
      drawFx(f0, f1, t);
      for (const fl of world.flocks)
        if (fl.f >= f0 && fl.f < f1) {
          enter(fl.f);
          ctx.strokeStyle = tone('#141210', fl.f);
          ctx.lineWidth = 1.1 * u * world.m(fl.f);
          ctx.beginPath();
          for (let q = 0; q < fl.n; q++) {
            const ox = (hash(fl.seed, q) - 0.5) * (fl.scatter > 0 ? 160 : 70) * u * world.m(fl.f) + Math.sin(t * 1.1 + q) * 8 * u;
            const oy = (hash(fl.seed, q, 1) - 0.5) * (fl.scatter > 0 ? 90 : 30) * u * world.m(fl.f) + Math.cos(t * 0.9 + q) * 5 * u;
            const x = fl.x + ox;
            const y = fl.y + oy;
            const wing = Math.sin(t * 10 + q) * 2.6 * u * world.m(fl.f);
            const ww = 3.4 * u * world.m(fl.f);
            ctx.moveTo(x - ww, y - wing);
            ctx.quadraticCurveTo(x - ww * 0.4, y - wing * 0.2, x, y);
            ctx.quadraticCurveTo(x + ww * 0.4, y - wing * 0.2, x + ww, y - wing);
          }
          ctx.stroke();
          leave();
        }
      const seaHere = k === 3 && world.sea !== null;
      if (k >= 2 && k <= 4 && !seaHere && !(k === 4 && world.layout === 'tiers')) fogBand((f0 + f1) / 2, t);
      if (seaHere) {
        drawSea(t);
        for (const sh of world.seaShips) drawSeaShip(sh);
      }
      if (k === 4) framePeople(true);
      if (k <= 4) drawPlane(k, t);
      if (k === 5) framePeople(false);
    }
    const winter = world.season === 3;
    if (winter) {
      // Snow: a little always, in winter; a lot in a storm. Drifting down slowly, the nearer flakes bigger.
      const n = Math.floor(160 + 520 * world.storm);
      for (let k = 0; k < n; k++) {
        const z = 0.4 + hash(k, 4) * 0.6;
        const sway = Math.sin(t * (0.6 + hash(k, 5)) + k) * 14 * z;
        const x = posmod(hash(k, 1) * W * 1.2 + sway + world.wind * t * 0.4 * z, W * 1.2) - W * 0.1;
        const y = (hash(k, 2) * H + t * (22 + 40 * z) * (1 + world.storm)) % H;
        ctx.fillStyle = hexA(mix('#f4f4f8', light.fog, 0.25), (0.35 + 0.4 * z) * (0.6 + 0.4 * world.storm));
        const sz = (0.8 + z * 1.6) * u;
        ctx.fillRect(x, y, sz, sz);
      }
    } else if (world.storm > 0.15) {
      ctx.strokeStyle = hexA(mix('#c8ccd0', light.fog, 0.3), 0.3 * world.storm);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 340 * world.storm; k++) {
        const x = posmod(hash(k, 1) * W * 1.2 + t * 50 + world.wind * t * 0.6, W * 1.2) - W * 0.1;
        const y = (hash(k, 2) * H + t * 640) % H;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3 + world.wind * 0.1, y + 16);
      }
      ctx.stroke();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of world.bolts) {
      const a = 1 - (world.t - b.t0) / 0.5;
      ctx.strokeStyle = `rgba(230,240,255,${a.toFixed(3)})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => {
        const [px, py] = proj(x, y, b.f);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
    }
    ctx.restore();
    const bolt = world.bolts[world.bolts.length - 1];
    if (bolt) {
      ctx.fillStyle = `rgba(220,230,250,${(0.22 * (1 - (world.t - bolt.t0) / 0.5)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    grade();
    labels(t);
    hud(t);
  }

  function grade() {
    const M = MOODS[world.mood];
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = hexA(M.tint, 0.28 - night * 0.1);
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.12;
    const bp = ctx.createPattern(brush, 'repeat');
    if (bp) {
      ctx.fillStyle = bp;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 0.05;
    const gp = ctx.createPattern(grain, 'repeat');
    if (gp) {
      ctx.fillStyle = gp;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    const vg = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(8,6,4,0)');
    vg.addColorStop(1, `rgba(8,6,4,${(0.5 + night * 0.15).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  function labels(t: number) {
    if (!o.labels) return;
    ctx.font = SERIF(13, true);
    ctx.textAlign = 'center';
    const placed: [number, number, number][] = [];
    for (const l of [...world.labels].reverse()) {
      const age = t - l.t0;
      const text = fitText(ctx, typed(l.text, age, 45, t), W - 48);
      const w = ctx.measureText(text).width;
      const [px, py] = proj(l.x, l.y, l.f);
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, px));
      let y = Math.max(92, Math.min(H - 80, py));
      for (let k = 0; k < 4 && placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 8 && Math.abs(qy - y) < 20); k++) y -= 20;
      placed.push([x, y, w]);
      const a = Math.min(1, age * 3, (6 - age) / 1.5);
      const sg = ctx.createLinearGradient(x - w / 2 - 24, 0, x + w / 2 + 24, 0);
      sg.addColorStop(0, 'rgba(10,8,6,0)');
      sg.addColorStop(0.15, `rgba(10,8,6,${(0.6 * a).toFixed(3)})`);
      sg.addColorStop(0.85, `rgba(10,8,6,${(0.6 * a).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - w / 2 - 24, y - 15, w + 48, 21);
      ctx.fillStyle = hexA(l.color, a);
      fillCrisp(ctx, text, x, y);
    }
    tags(t, placed);
    ctx.textAlign = 'left';
  }

  /** Who is who: a name over each near ship and walker, what she is and where bound; and what is heard from her. */
  function tags(t: number, placed: [number, number, number][]) {
    type Tag = { x: number; y: number; name: string; sub: string; line: string; lineT: number; pri: number; hostile: boolean };
    const list: Tag[] = [];
    for (const s of world.ships) {
      if (!s.alive || s.f < 0.48 || s.kind === 'balloon' || !world.inView(s.x, s.f, -0.02)) continue;
      const D = dimsOf(s.kind, s.len);
      const top = D.env ? D.env.y - D.env.h * 0.5 : D.gTop - s.len * 0.22;
      let [x, y] = proj(s.x, s.y + top - 4 * u, s.f);
      // Too near the top to label above her: label her underneath.
      if (y < 74) y = proj(s.x, s.y + D.gBot + s.len * 0.1, s.f)[1] + 30;
      const status = s.state === 'moored' ? 'MOORED' : s.state === 'burning' || s.state === 'falling' ? 'ON FIRE' : s.state === 'battle' || s.state === 'attack' ? 'IN ACTION' : s.state === 'approach' ? 'COMING IN TO MOOR' : s.state === 'depart' ? 'CASTING OFF' : s.team === 1 ? 'ENEMY' : s.bound;
      list.push({ x, y, name: s.name === 'RAIDER' ? 'RAIDER' : `${s.name}`, sub: `${KIND_NAMES[s.kind]} ${s.reg} · ${status}`, line: s.line, lineT: s.lineT, pri: s.f + (t - s.lineT < 5 ? 1 : 0) + (s.state !== 'cruise' ? 0.3 : 0), hostile: s.team === 1 });
    }
    for (const wk of world.walkers) {
      if (wk.state === 'down' || !world.inView(wk.x, wk.f, -0.02)) continue;
      const [x, y] = proj(wk.x, world.groundAt(wk.f) - wk.h * 1.12, wk.f);
      list.push({ x, y, name: wk.name, sub: `${WALKER_KINDS[wk.kind]}${wk.team === 1 ? ' · ENEMY' : wk.ambient ? ' · CITY WORKS' : ''}`, line: wk.line, lineT: wk.lineT, pri: wk.f + 0.35 + (t - wk.lineT < 5 ? 1 : 0), hostile: wk.team === 1 });
    }
    list.sort((a, b) => b.pri - a.pri);
    let shown = 0;
    for (const g of list) {
      if (shown >= 7) break;
      if (g.x < 30 || g.x > W - 30) continue;
      const edge = clamp01(Math.min(g.x - 30, W - 30 - g.x) / 90);
      ctx.font = SERIF(11);
      const nw = ctx.measureText(g.name).width;
      ctx.font = SERIF(9);
      const sw = ctx.measureText(g.sub).width;
      const w = Math.max(nw, sw);
      let y = Math.max(70, Math.min(H - 60, g.y));
      for (let k = 0; k < 4 && placed.some(([qx, qy, qw]) => Math.abs(qx - g.x) < (qw + w) / 2 + 8 && Math.abs(qy - (y - 14)) < 24); k++) y -= 24;
      if (placed.some(([qx, qy, qw]) => Math.abs(qx - g.x) < (qw + w) / 2 + 8 && Math.abs(qy - (y - 14)) < 24)) continue;
      placed.push([g.x, y - 14, w]);
      shown++;
      const a = edge * 0.9;
      // A tick down to her, the name, and what she is.
      ctx.strokeStyle = hexA('#e8dcc0', 0.45 * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(g.x) + 0.5, y - 3);
      ctx.lineTo(Math.round(g.x) + 0.5, Math.max(y - 3, Math.min(H, g.y)));
      ctx.stroke();
      const bg = ctx.createLinearGradient(g.x - w / 2 - 14, 0, g.x + w / 2 + 14, 0);
      bg.addColorStop(0, 'rgba(10,8,6,0)');
      bg.addColorStop(0.2, `rgba(10,8,6,${(0.42 * a).toFixed(3)})`);
      bg.addColorStop(0.8, `rgba(10,8,6,${(0.42 * a).toFixed(3)})`);
      bg.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(g.x - w / 2 - 14, y - 28, w + 28, 26);
      ctx.font = SERIF(11);
      ctx.fillStyle = hexA(g.hostile ? '#fca5a5' : '#f3e7cc', a);
      fillCrisp(ctx, g.name, g.x, y - 15);
      ctx.font = SERIF(9);
      ctx.fillStyle = hexA(g.hostile ? '#e8a090' : '#c9b48a', a * 0.9);
      fillCrisp(ctx, g.sub, g.x, y - 5);
      const age = t - g.lineT;
      if (g.line && age < 5) {
        ctx.font = SERIF(12, true);
        const text = `“${typed(g.line, age, 40, t)}”`;
        const lw = ctx.measureText(`“${g.line}”`).width;
        const la = Math.min(1, age * 4, (5 - age) / 0.8) * edge;
        const ly = y - 34;
        const lg = ctx.createLinearGradient(g.x - lw / 2 - 16, 0, g.x + lw / 2 + 16, 0);
        lg.addColorStop(0, 'rgba(10,8,6,0)');
        lg.addColorStop(0.15, `rgba(10,8,6,${(0.55 * la).toFixed(3)})`);
        lg.addColorStop(0.85, `rgba(10,8,6,${(0.55 * la).toFixed(3)})`);
        lg.addColorStop(1, 'rgba(10,8,6,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(g.x - lw / 2 - 16, ly - 13, lw + 32, 18);
        ctx.fillStyle = hexA(g.hostile ? '#fecaca' : '#fde68a', la);
        fillCrisp(ctx, text, Math.max(lw / 2 + 12, Math.min(W - lw / 2 - 12, g.x)), ly);
        placed.push([g.x, ly, lw]);
      }
    }
  }

  function hud(t: number) {
    if (!o.hud) return;
    const hk = Math.max(0.68, Math.min(1, W / 1000));
    const W0 = W;
    const H0 = H;
    ctx.save();
    ctx.scale(hk, hk);
    W = W0 / hk;
    H = H0 / hk;
    try {
      hudAt(t);
    } finally {
      W = W0;
      H = H0;
      ctx.restore();
    }
  }
  function hudAt(t: number) {
    const level = 0.6 + 0.4 * host.intensity;
    const c = world.counts();
    const lines = [
      `${SEASONS[world.season]} OF ${world.year} · ${timeWords(world.day)}${world.storm > 0.5 ? ' · A STORM' : world.fog > 0.5 ? ' · FOG' : ''}`,
      `${c.ships} SHIPS ALOFT · ${c.moored} MOORED${c.walkers ? ` · ${c.walkers} WALKERS IN THE STREETS` : ''}${c.fires ? ` · ${c.fires} FIRES` : ''}`,
      world.cast.join(' · ').toUpperCase(),
    ];
    ctx.save();
    ctx.scale(1, 0.2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 620);
    g.addColorStop(0, 'rgba(8,6,4,0.6)');
    g.addColorStop(0.6, 'rgba(8,6,4,0.35)');
    g.addColorStop(1, 'rgba(8,6,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 620);
    ctx.restore();
    ctx.font = SERIF(19);
    ctx.fillStyle = hexA('#efe3c8', 0.95 * level);
    fillCrisp(ctx, fitText(ctx, `IRONHAZE  ·  ${world.name}`, W - 40), 18, 30);
    ctx.fillStyle = hexA('#c9a86a', 0.7 * level);
    ctx.fillRect(18, 38, Math.min(220, W - 36), 1);
    ctx.font = SERIF(11);
    ctx.fillStyle = hexA('#d8ccb0', 0.85 * level);
    lines.forEach((s, i) => fillCrisp(ctx, fitText(ctx, s, W - 36), 18, 54 + i * 15));
    ctx.font = SERIF(13, true);
    const ch = world.chronicle.slice(-3);
    ch.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#efe3c8', Math.min(1, age * 2) * (i === ch.length - 1 ? 0.92 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 36), 18, H - 22 - (ch.length - 1 - i) * 18);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => proj(x, y, 0.7),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: fitOf() };
    },
    paint: (t) => paint(t),
    ambience: () => (world.walkers.length || world.fighters.length || world.ships.some((s) => s.fire > 0) || world.storm > 0.5 ? 0.9 : 0.45),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      softCache.clear();
      glowCache.clear();
      for (const m of tiles) m.clear();
    },
  });
}
