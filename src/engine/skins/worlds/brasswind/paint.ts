/**
 * Brasswind, painted: a steampunk skyport in amber smoke.
 *
 * The look: sepia and amber light through smog; brass, copper (gone green in streaks), riveted
 * iron and soot-dark brick; machinery in plain sight (great gears turning on the facades and
 * meshing, copper pipes with valves and gauges, pistons, a furnace's glow); sky-galleons (wooden
 * hulls with portholes, stern galleries and bowsprits, hung from netted balloons, with fan
 * propellers on brass arms, bat-wing sails and smoking deck stacks).
 *
 * Back to front: the sky by the hour; the sun and its shafts of light through the smoke, or the
 * moon and stars; smoke strata; ships far off in the haze; the far skyline; the haze; nearer far
 * ships; the rock or the iron decks; the city (one cached picture of everything that stands);
 * the city's moving machinery (gears, pistons, the furnace, clock hands, the telescope,
 * gasometers, scaffolds, the hull in the yard, lifts, flags, trams, cable cars, capsules); the
 * river with the city in it, and its steamers; the walking engine; the near ships; fliers and
 * pigeons; smoke and steam; rain; the foreground deck rail; then the night and every light in
 * it; the grade (warmth, grain, vignette); call-outs, and the brass plaque.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../../instruments/kit';
import { createBrass, SEASONS, type BrassWorld, type Building, type Mast, type Ship } from './sim';

export type BrassPaintOptions = { traffic: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
const mixHex = (a: string, b: string, k: number) => {
  const [r, g, bl] = mixRgb(a, b, Math.max(0, Math.min(1, k)));
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
};

// The metals and materials of the city.
const BRASS = '#c9a227';
const BRASS_HI = '#f0d27a';
const BRASS_DK = '#7a5a1c';
const COPPER = '#b87333';
const VERDIGRIS = '#4f8a78';
const IRON = '#2f2b2a';
const IRON_HI = '#5a524c';
const SOOT = '#1b1714';
const WOOD = '#6b4423';
const WOOD_DK = '#3d2412';
const GLASS = '#1a1612';
const LAMP = '#ffc46a';

/** The sky through the day, amber and smoky: [time, top, middle, horizon]. */
const SKY: [number, string, string, string][] = [
  [0.0, '#070f16', '#0f1f28', '#24302e'],
  [0.19, '#0e1820', '#1d2730', '#3a3632'],
  [0.25, '#2a2232', '#8c4a36', '#ee9448'],
  [0.33, '#4f5a60', '#a8875e', '#e6b874'],
  [0.5, '#5e6b70', '#b89a6c', '#e9c88c'],
  [0.68, '#55605f', '#b38a5a', '#e7b46c'],
  [0.76, '#2c1c2a', '#a0442c', '#f2883c'],
  [0.83, '#140f1e', '#3a2028', '#5a2c26'],
  [1.0, '#070f16', '#0f1f28', '#24302e'],
];
function skyAt(d: number): [string, string, string] {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [t0, ...a] = SKY[i];
    const [t1, ...b] = SKY[i + 1];
    if (d >= t0 && d <= t1) {
      const k = (d - t0) / (t1 - t0);
      return [mixHex(a[0], b[0], k), mixHex(a[1], b[1], k), mixHex(a[2], b[2], k)];
    }
  }
  return [SKY[0][1], SKY[0][2], SKY[0][3]];
}
const nightOf = (d: number) => Math.max(0, Math.min(1, d > 0.3 && d < 0.7 ? 0 : d <= 0.2 || d >= 0.84 ? 1 : d < 0.5 ? (0.3 - d) / 0.1 : (d - 0.7) / 0.14));
const goldenOf = (d: number) => Math.max(0, 1 - Math.abs(d - 0.26) / 0.07) + Math.max(0, 1 - Math.abs(d - 0.765) / 0.07);

const HOURS = ['TWELVE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN'];
function timeWords(day: number): string {
  const mins = Math.round((day * 24 * 60) / 5) * 5;
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const part = (hh: number) => (hh < 5 ? 'AT NIGHT' : hh < 12 ? 'IN THE MORNING' : hh < 18 ? 'IN THE AFTERNOON' : hh < 22 ? 'IN THE EVENING' : 'AT NIGHT');
  const name = (hh: number) => (hh === 12 ? 'NOON' : hh === 0 ? 'MIDNIGHT' : HOURS[hh % 12]);
  if (m === 0) return h === 12 || h === 0 ? name(h) : `${name(h)} O'CLOCK ${part(h)}`;
  const words = ['', 'FIVE PAST', 'TEN PAST', 'A QUARTER PAST', 'TWENTY PAST', 'TWENTY-FIVE PAST', 'HALF PAST', 'TWENTY-FIVE TO', 'TWENTY TO', 'A QUARTER TO', 'TEN TO', 'FIVE TO'][m / 5];
  if (m > 30) h = (h + 1) % 24;
  return `${words} ${name(h)}${h === 12 || h === 0 ? '' : ` ${part(h)}`}`;
}

/** A gear on a facade: where, how big, which way it turns, and its shape (built once). */
type Gear = { x: number; y: number; r: number; dir: 1 | -1; speed: number; path: Path2D; color: string; phase: number };
type Piston = { x: number; y: number; len: number; phase: number };

function gearPath(r: number, teeth: number): Path2D {
  const p = new Path2D();
  const inner = r * 0.84;
  for (let k = 0; k < teeth; k++) {
    const a0 = (k / teeth) * Math.PI * 2;
    const a1 = ((k + 0.25) / teeth) * Math.PI * 2;
    const a2 = ((k + 0.5) / teeth) * Math.PI * 2;
    const a3 = ((k + 0.75) / teeth) * Math.PI * 2;
    if (k === 0) p.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner);
    p.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    p.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
    p.lineTo(Math.cos(a3) * inner, Math.sin(a3) * inner);
    p.lineTo(Math.cos(((k + 1) / teeth) * Math.PI * 2) * inner, Math.sin(((k + 1) / teeth) * Math.PI * 2) * inner);
  }
  p.closePath();
  // The rim's inside and the spokes are cut out, so the gear reads as metal and air.
  const hole = r * 0.62;
  const spokes = r > 30 ? 6 : 4;
  for (let k = 0; k < spokes; k++) {
    const a = (k / spokes) * Math.PI * 2;
    const b = ((k + 1) / spokes) * Math.PI * 2;
    const w = 0.22;
    p.moveTo(Math.cos(a + w) * r * 0.22, Math.sin(a + w) * r * 0.22);
    p.arc(0, 0, hole, a + w, b - w);
    p.lineTo(Math.cos(b - w) * r * 0.22, Math.sin(b - w) * r * 0.22);
    p.closePath();
  }
  return p;
}

export function mountBrass(host: SkinHost, o: BrassPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: BrassWorld = createBrass(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u } = world;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.35, closer: 1.9, maxZoom: 2.6 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const main = world.buildings.filter((b) => b.layer === 1);
  const far = world.buildings.filter((b) => b.layer === 0);
  const topOf = (b: Building) => b.base - b.floors * b.floorH;

  const cr = host.fork('brass-look');
  const stars = Array.from({ length: 170 }, () => [cr() * GW, cr() * GH * 0.55, cr()] as [number, number, number]);
  /** Smoke strata: long soft bands of puffs at a few heights, drifting with the wind. */
  const strata = Array.from({ length: 4 }, (_, k) => ({
    y: GH * (0.18 + k * 0.13 + cr() * 0.05),
    speed: (3 + cr() * 6) * u * (k % 2 ? -1 : 1),
    puffs: Array.from({ length: 22 }, () => [cr() * GW * 1.4, (cr() - 0.5) * 30 * u, (40 + cr() * 70) * u] as [number, number, number]),
    dark: k >= 2,
  }));
  // A grain tile, printed once, on the first paint (a headless run never paints, and has no document).
  let grain: HTMLCanvasElement | null = null;
  const grainTile = () => {
    if (grain) return grain;
    grain = document.createElement('canvas');
    grain.width = grain.height = 160;
    const g = grain.getContext('2d')!;
    const img = g.createImageData(160, 160);
    for (let i = 0; i < 160 * 160; i++) {
      const v = Math.floor(cr() * 255);
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v * 0.9;
      img.data[i * 4 + 2] = v * 0.75;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return grain;
  };

  // ---- the city, cached -------------------------------------------------------------------------
  const K = 1.25;
  let city: HTMLCanvasElement | null = null;
  let lit: HTMLCanvasElement | null = null;
  let cityVersion = -1;
  let cityAt = -99;
  let faces: [number, number, number][] = [];
  let domes: [number, number, number][] = [];
  let gears: Gear[] = [];
  let pistons: Piston[] = [];
  let furnaces: [number, number, number, number][] = [];

  const material = (b: Building) => {
    if (b.kind === 'engine' || b.kind === 'gasometer') return 'iron';
    if (b.kind === 'clock' || b.kind === 'guild' || b.kind === 'cathedral' || b.kind === 'observatory') return 'stone';
    if (b.kind === 'factory' || b.kind === 'warehouse') return 'brick';
    const m = b.seed % 7;
    return b.kind === 'tower' ? (m < 2 ? 'copper' : m < 4 ? 'iron' : 'brick') : m < 4 ? 'brick' : m < 6 ? 'stone' : 'iron';
  };
  const wallOf = (b: Building) => {
    const m = material(b);
    if (m === 'iron') return mixHex('#3b3532', '#4a3a30', (b.seed % 10) / 10);
    if (m === 'copper') return mixHex('#8a5530', '#6a7a62', ((b.seed >> 3) % 10) / 20);
    if (m === 'stone') return mixHex('#8a7a62', '#a08a68', (b.seed % 10) / 10);
    return mixHex('#6a3424', '#5a2e22', (b.seed % 10) / 10);
  };

  function rivets(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step: number) {
    g.fillStyle = 'rgba(255,220,160,0.18)';
    for (let yy = y + step / 2; yy < y + h; yy += step) for (let xx = x + step / 2; xx < x + w; xx += step) g.fillRect(xx, yy, 0.9 * u, 0.9 * u);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let yy = y + step; yy < y + h; yy += step) g.fillRect(x, yy, w, 0.6 * u);
  }
  function pipe(g: CanvasRenderingContext2D, pts: [number, number][], r: number, color: string) {
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = mixHex(color, '#000000', 0.45);
    g.lineWidth = r * 2 + 1.2 * u;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = r * 2;
    g.stroke();
    g.strokeStyle = 'rgba(255,240,200,0.45)';
    g.lineWidth = r * 0.5;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x - r * 0.4, y - r * 0.4) : g.moveTo(x - r * 0.4, y - r * 0.4)));
    g.stroke();
    g.fillStyle = mixHex(color, '#000000', 0.25);
    for (const [x, y] of pts) g.fillRect(x - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
    g.lineCap = 'butt';
    g.lineJoin = 'miter';
  }
  function gauge(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    g.fillStyle = BRASS;
    g.beginPath();
    g.arc(x, y, r * 1.2, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#efe2c0';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#7f1d1d';
    g.lineWidth = 0.7 * u;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + r * 0.7, y - r * 0.4);
    g.stroke();
  }
  function valve(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    g.strokeStyle = '#9f1d1d';
    g.lineWidth = 1.2 * u;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.moveTo(x - r, y);
    g.lineTo(x + r, y);
    g.moveTo(x, y - r);
    g.lineTo(x, y + r);
    g.stroke();
  }
  /** A socket for a gear on the facade, and the gear itself (turning, drawn live). */
  function addGear(g: CanvasRenderingContext2D, x: number, y: number, r: number, dir: 1 | -1, color = BRASS) {
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(x + 1.5 * u, y + 2 * u, r * 1.02, 0, Math.PI * 2);
    g.fill();
    gears.push({ x, y, r, dir, speed: (9 * u) / r, path: gearPath(r, Math.max(8, Math.round(r / (2.6 * u)))), color, phase: hash(Math.round(x), Math.round(y)) * 6 });
  }
  /** A path moved into place. */
  function withPath(p: Path2D, x: number, y: number): Path2D {
    const out = new Path2D();
    out.addPath(p, new DOMMatrix([1, 0, 0, 1, x, y]));
    return out;
  }
  function chimney(g: CanvasRenderingContext2D, cx: number, top: number, sh: number, cw: number) {
    g.fillStyle = '#4a2a1e';
    g.fillRect(cx - cw / 2, top - sh, cw, sh);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(cx + cw * 0.2, top - sh, cw * 0.3, sh);
    g.fillStyle = BRASS_DK;
    for (let k = 1; k < Math.floor(sh / (20 * u)) + 1; k++) g.fillRect(cx - cw / 2 - 0.5 * u, top - sh + k * 20 * u - 8 * u, cw + u, 1.6 * u);
    g.fillStyle = IRON;
    g.fillRect(cx - cw * 0.7, top - sh - 3 * u, cw * 1.4, 3 * u);
    g.beginPath();
    g.moveTo(cx - cw * 0.6, top - sh - 3 * u);
    g.lineTo(cx, top - sh - 3 * u - cw * 0.7);
    g.lineTo(cx + cw * 0.6, top - sh - 3 * u);
    g.fill();
  }
  function spire(g: CanvasRenderingContext2D, x: number, base: number, sw: number, sh: number, color: string) {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x + sw / 2, base - sh);
    g.lineTo(x + sw, base);
    g.fill();
    g.fillStyle = 'rgba(255,240,200,0.1)';
    g.beginPath();
    g.moveTo(x, base);
    g.lineTo(x + sw / 2, base - sh);
    g.lineTo(x + sw * 0.4, base);
    g.fill();
    g.strokeStyle = 'rgba(30,24,20,0.5)';
    g.lineWidth = 0.7 * u;
    for (let k = 1; k < 5; k++) {
      const yy = base - (sh * k) / 5;
      const half = (sw / 2) * (1 - k / 5);
      g.beginPath();
      g.moveTo(x + sw / 2 - half, yy);
      g.lineTo(x + sw / 2 + half, yy);
      g.stroke();
    }
    g.fillStyle = BRASS_HI;
    g.beginPath();
    g.arc(x + sw / 2, base - sh, 2.2 * u, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x + sw / 2 - 0.5 * u, base - sh - 12 * u, u, 10 * u);
  }
  function cresting(g: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
    g.strokeStyle = IRON;
    g.lineWidth = 0.7 * u;
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    for (let x = x0; x <= x1; x += 3 * u) {
      g.moveTo(x, y);
      g.lineTo(x, y - 3.5 * u);
    }
    g.stroke();
  }

  function drawBuilding(g: CanvasRenderingContext2D, w: CanvasRenderingContext2D, b: Building) {
    const top = topOf(b);
    const h = b.base - top;
    const x = b.x;
    const bw = b.w;
    const fh = b.floorH;
    const mat = material(b);
    const wall = wallOf(b);
    if (b.kind === 'gasometer') {
      const fH = 150 * u;
      const ft = b.base - fH;
      g.strokeStyle = IRON;
      g.lineWidth = 2.6 * u;
      for (let k = 0; k <= 6; k++) {
        const cx = x + (bw * k) / 6;
        g.beginPath();
        g.moveTo(cx, b.base);
        g.lineTo(cx, ft);
        g.stroke();
      }
      g.lineWidth = 1.2 * u;
      for (let y = ft; y < b.base; y += 30 * u) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + bw, y);
        g.stroke();
        for (let k = 0; k < 6; k++) {
          g.beginPath();
          g.moveTo(x + (bw * k) / 6, y);
          g.lineTo(x + (bw * (k + 1)) / 6, y + 30 * u);
          g.stroke();
        }
      }
      g.fillStyle = BRASS;
      for (let k = 0; k <= 6; k++) g.fillRect(x + (bw * k) / 6 - 2 * u, ft - 4 * u, 4 * u, 4 * u);
      return;
    }
    g.fillStyle = wall;
    g.fillRect(x, top, bw, h);
    if (mat === 'iron' || mat === 'copper') rivets(g, x, top, bw, h, 8 * u);
    else {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      const course = (mat === 'stone' ? 7 : 3.4) * u;
      for (let y = top + course; y < b.base; y += course) g.fillRect(x, y, bw, Math.max(0.5, 0.45 * u));
    }
    if (mat === 'copper') {
      for (let k = 0; k < Math.floor(bw / (7 * u)); k++) {
        const sx = x + (k + hash(b.seed, k)) * 7 * u;
        const sl = h * (0.2 + hash(b.seed, k, 2) * 0.6);
        const vg = g.createLinearGradient(0, top, 0, top + sl);
        vg.addColorStop(0, hexA(VERDIGRIS, 0.7));
        vg.addColorStop(1, hexA(VERDIGRIS, 0));
        g.fillStyle = vg;
        g.fillRect(sx, top, 2.6 * u, sl);
      }
    }
    const soot = g.createLinearGradient(0, b.base, 0, top);
    soot.addColorStop(0, 'rgba(10,8,6,0.45)');
    soot.addColorStop(0.4, 'rgba(10,8,6,0)');
    g.fillStyle = soot;
    g.fillRect(x, top, bw, h);
    const side = g.createLinearGradient(x, 0, x + bw, 0);
    side.addColorStop(0, 'rgba(255,214,150,0.16)');
    side.addColorStop(0.45, 'rgba(255,214,150,0)');
    side.addColorStop(1, 'rgba(0,0,0,0.32)');
    g.fillStyle = side;
    g.fillRect(x, top, bw, h);
    g.fillStyle = BRASS_DK;
    for (let f = 4; f < b.floors; f += 4) g.fillRect(x - u, b.base - f * fh - 1.4 * u, bw + 2 * u, 1.8 * u);
    g.fillStyle = BRASS;
    g.fillRect(x - 2.5 * u, top - 3 * u, bw + 5 * u, 3.2 * u);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(x - 2.5 * u, top + 0.2 * u, bw + 5 * u, 1.2 * u);
    const special = b.kind === 'cathedral' || b.kind === 'guild' || b.kind === 'factory' || b.kind === 'engine';
    if (!special) {
      const cols = Math.max(1, Math.floor((bw - 6 * u) / (11 * u)));
      const span = (bw - 6 * u) / cols;
      for (let f = b.kind === 'house' || b.kind === 'warehouse' ? 1 : 0; f < b.floors; f++) {
        const fy = b.base - (f + 1) * fh;
        for (let c = 0; c < cols; c++) {
          const cx = x + 3 * u + c * span + span / 2;
          const lightOn = hash(b.seed, f, c) < 0.45;
          if (mat === 'iron') {
            const rr = Math.min(span, fh) * 0.24;
            g.fillStyle = BRASS_DK;
            g.beginPath();
            g.arc(cx, fy + fh * 0.5, rr + 1 * u, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = GLASS;
            g.beginPath();
            g.arc(cx, fy + fh * 0.5, rr, 0, Math.PI * 2);
            g.fill();
            if (lightOn) {
              w.fillStyle = LAMP;
              w.beginPath();
              w.arc(cx, fy + fh * 0.5, rr, 0, Math.PI * 2);
              w.fill();
            }
          } else {
            const ww = span * 0.44;
            const wh = fh * 0.56;
            const wx = cx - ww / 2;
            const wy = fy + fh * 0.28;
            g.fillStyle = GLASS;
            g.fillRect(wx, wy, ww, wh);
            g.beginPath();
            g.arc(cx, wy, ww / 2, Math.PI, 0);
            g.fill();
            g.fillStyle = 'rgba(0,0,0,0.3)';
            g.fillRect(cx - 0.3 * u, wy - ww / 2, 0.6 * u, wh + ww / 2);
            g.fillStyle = hexA(BRASS, 0.55);
            g.fillRect(wx - 0.8 * u, wy + wh, ww + 1.6 * u, 1 * u);
            if (lightOn) {
              w.fillStyle = hash(b.seed, c, f) < 0.2 ? '#ff9a3c' : LAMP;
              w.fillRect(wx, wy, ww, wh);
              w.beginPath();
              w.arc(cx, wy, ww / 2, Math.PI, 0);
              w.fill();
            }
          }
        }
      }
    }
    if (b.kind !== 'cathedral' && b.kind !== 'guild' && (b.seed % 3 !== 0 || b.kind === 'tower' || b.kind === 'factory' || b.kind === 'engine')) {
      const px = x + (b.seed % 2 ? bw - 3.5 * u : 3.5 * u);
      const py = top + 8 * u;
      const col = b.seed % 5 === 0 ? BRASS : COPPER;
      pipe(g, [[px, b.base], [px, py], [x + bw / 2, py]], 1.8 * u, col);
      valve(g, px, b.base - h * 0.3, 3.2 * u);
      gauge(g, px + (b.seed % 2 ? -7 : 7) * u, b.base - h * 0.55, 3.2 * u);
    }
    if ((b.kind === 'tower' && b.seed % 2 === 0) || b.kind === 'factory' || b.kind === 'warehouse') {
      const rr = Math.min(bw * 0.3, 26 * u);
      const gx = x + bw * (b.seed % 3 === 0 ? 0.32 : 0.62);
      const gy = top + h * (0.25 + hash(b.seed, 4) * 0.4);
      addGear(g, gx, gy, rr, 1);
      addGear(g, gx + rr * 1.42, gy + rr * 0.55, rr * 0.55, -1, COPPER);
    }
    if (b.kind === 'house') {
      const awn = ['#7f1d1d', '#1e3a5f', '#14532d', '#78350f', '#4c1d95'][b.seed % 5];
      const gy = b.base - fh;
      g.fillStyle = '#20180f';
      g.fillRect(x + 3 * u, gy + fh * 0.3, bw - 6 * u, fh * 0.7);
      w.fillStyle = '#ffb44a';
      w.fillRect(x + 5 * u, gy + fh * 0.36, bw * 0.55, fh * 0.42);
      for (let k = 0; k < Math.ceil(bw / (4 * u)); k++) {
        g.fillStyle = k % 2 ? awn : '#d8c8a8';
        g.beginPath();
        g.moveTo(x + 2 * u + k * 4 * u, gy + fh * 0.22);
        g.lineTo(x + 6 * u + k * 4 * u, gy + fh * 0.22);
        g.lineTo(x + 7 * u + k * 4 * u, gy + fh * 0.42);
        g.lineTo(x + 3 * u + k * 4 * u, gy + fh * 0.42);
        g.fill();
      }
      for (const c of b.chimneys) chimney(g, x + bw * c, top, 18 * u, 6 * u);
    } else if (b.kind === 'warehouse') {
      g.fillStyle = '#20180f';
      for (let k = 0; k < 2; k++) {
        const dx = x + bw * (0.18 + k * 0.42);
        g.fillRect(dx, b.base - fh * 0.9, bw * 0.24, fh * 0.9);
        g.beginPath();
        g.arc(dx + bw * 0.12, b.base - fh * 0.9, bw * 0.12, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = '#e7d4a8';
      g.font = SERIF(Math.max(5, 7 * u));
      g.textAlign = 'center';
      g.fillText(`${['COGSWORTH', 'HARGREAVES', 'BLACKWOOD', 'ASHCOMBE', 'PENNYWHISTLE'][b.seed % 5]} & SONS`, x + bw / 2, top + 10 * u);
      g.textAlign = 'left';
    }
    if (b.kind === 'engine') return drawEngine(g, w, b, top, h);
    if (b.kind === 'cathedral') {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let k = 0; k <= 4; k++) g.fillRect(x + (bw * k) / 4 - 3 * u, top + h * 0.2, 6 * u, h * 0.8);
      const rx = x + bw / 2;
      const ry = top + h * 0.34;
      const rr = Math.min(bw * 0.18, h * 0.2);
      g.fillStyle = BRASS;
      g.fill(withPath(gearPath(rr * 1.12, 20), rx, ry), 'evenodd');
      g.fillStyle = GLASS;
      g.beginPath();
      g.arc(rx, ry, rr, 0, Math.PI * 2);
      g.fill();
      const glass = ['#be123c', '#1d4ed8', '#ca8a04', '#15803d', '#7e22ce', '#c2410c'];
      for (let k = 0; k < 12; k++) {
        w.fillStyle = glass[k % glass.length];
        w.beginPath();
        w.moveTo(rx, ry);
        w.arc(rx, ry, rr * 0.92, (k / 12) * Math.PI * 2, ((k + 1) / 12) * Math.PI * 2);
        w.fill();
      }
      for (let k = 0; k < 6; k++) {
        const lx = x + bw * (0.1 + k * 0.16);
        if (Math.abs(lx - rx) < rr + 5 * u) continue;
        g.fillStyle = GLASS;
        g.fillRect(lx, top + h * 0.3, 5 * u, h * 0.42);
        g.beginPath();
        g.arc(lx + 2.5 * u, top + h * 0.3, 2.5 * u, Math.PI, 0);
        g.fill();
        w.fillStyle = glass[k % glass.length];
        w.fillRect(lx, top + h * 0.3, 5 * u, h * 0.42);
      }
      for (const tx of [x + 4 * u, x + bw - 26 * u]) {
        const th = h * 0.95;
        g.fillStyle = wall;
        g.fillRect(tx, top - th, 22 * u, th);
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.fillRect(tx + 15 * u, top - th, 7 * u, th);
        g.fillStyle = GLASS;
        g.fillRect(tx + 7 * u, top - th + 12 * u, 8 * u, 20 * u);
        spire(g, tx - 2 * u, top - th, 26 * u, 80 * u, VERDIGRIS);
      }
      spire(g, x + bw / 2 - 16 * u, top, 32 * u, 130 * u, mixHex(VERDIGRIS, COPPER, 0.3));
      return;
    }
    if (b.kind === 'guild') {
      const ph = Math.min(h * 0.55, fh * 2.6);
      const py = b.base - ph;
      g.fillStyle = '#cdbf9e';
      g.fillRect(x + 4 * u, py - 8 * u, bw - 8 * u, 8 * u);
      g.beginPath();
      g.moveTo(x + 2 * u, py - 8 * u);
      g.lineTo(x + bw / 2, py - 28 * u);
      g.lineTo(x + bw - 2 * u, py - 8 * u);
      g.fill();
      g.fillStyle = BRASS;
      g.fill(withPath(gearPath(9 * u, 12), x + bw / 2, py - 15 * u), 'evenodd');
      g.fillStyle = '#20180f';
      g.fillRect(x + 8 * u, py, bw - 16 * u, ph);
      for (let k = 0; k < 7; k++) {
        const cx = x + 8 * u + ((bw - 16 * u) * k) / 6;
        g.fillStyle = '#ddd0b2';
        g.fillRect(cx - 2.6 * u, py, 5.2 * u, ph);
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(cx + 1 * u, py, 1.6 * u, ph);
      }
      w.fillStyle = '#ffcf7a';
      w.fillRect(x + 12 * u, py + ph * 0.25, bw - 24 * u, ph * 0.5);
      g.fillStyle = '#efe0bc';
      g.font = SERIF(Math.max(5, 6.5 * u));
      g.textAlign = 'center';
      g.fillText(b.name, x + bw / 2, py - 1.5 * u);
      g.textAlign = 'left';
      for (let f = 0; f < b.floors - 3; f++)
        for (let c = 0; c < 6; c++) {
          const wx = x + bw * (0.1 + c * 0.14);
          const wy = top + f * fh + fh * 0.3;
          g.fillStyle = GLASS;
          g.fillRect(wx, wy, bw * 0.06, fh * 0.5);
          if (hash(b.seed, f, c) < 0.5) {
            w.fillStyle = LAMP;
            w.fillRect(wx, wy, bw * 0.06, fh * 0.5);
          }
        }
    }
    if (b.kind === 'factory') {
      for (let c = 0; c < Math.floor(bw / (14 * u)); c++) {
        const wx = x + 6 * u + c * 14 * u;
        g.fillStyle = GLASS;
        g.fillRect(wx, top + 12 * u, 7 * u, h - 24 * u);
        g.beginPath();
        g.arc(wx + 3.5 * u, top + 12 * u, 3.5 * u, Math.PI, 0);
        g.fill();
        if (hash(b.seed, c) < 0.75) {
          w.fillStyle = '#ff9a3c';
          w.fillRect(wx, top + 12 * u, 7 * u, h - 24 * u);
        }
      }
      g.fillStyle = '#e7d4a8';
      g.font = SERIF(Math.max(6, 8 * u));
      g.textAlign = 'center';
      g.fillText(`${['ARGAND', 'VULCAN', 'PHOENIX', 'ATLAS', 'BRUNEL', 'ALBION'][b.seed % 6]} ENGINE WORKS`, x + bw / 2, b.base - 4 * u);
      g.textAlign = 'left';
      for (const c of b.chimneys) chimney(g, x + bw * c, top, 70 * u, 11 * u);
    }
    if (b.kind === 'clock') return drawClock(g, w, b, top);
    roof(g, w, b, top);
    if (b.kind === 'tower') for (const c of b.chimneys) chimney(g, x + bw * c, top, 20 * u, 6 * u);
  }

  function roof(g: CanvasRenderingContext2D, w: CanvasRenderingContext2D, b: Building, top: number) {
    const x = b.x;
    const bw = b.w;
    const copperRoof = b.seed % 3 === 0 ? COPPER : b.seed % 3 === 1 ? VERDIGRIS : '#3b3432';
    switch (b.roof) {
      case 'mansard': {
        const rh = 15 * u;
        g.fillStyle = copperRoof;
        g.beginPath();
        g.moveTo(x - 2 * u, top);
        g.lineTo(x + bw * 0.1, top - rh);
        g.lineTo(x + bw * 0.9, top - rh);
        g.lineTo(x + bw + 2 * u, top);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.22)';
        for (let sx = x; sx < x + bw; sx += 3 * u) g.fillRect(sx, top - rh, 0.5 * u, rh);
        for (let k = 0; k < Math.max(1, Math.floor(bw / (20 * u))); k++) {
          const dx = x + bw * 0.2 + k * 20 * u;
          g.fillStyle = BRASS_DK;
          g.fillRect(dx - u, top - rh * 0.9, 9 * u, rh * 0.8);
          g.fillStyle = GLASS;
          g.beginPath();
          g.arc(dx + 3.5 * u, top - rh * 0.48, 2.6 * u, 0, Math.PI * 2);
          g.fill();
          if (hash(b.seed, k, 9) < 0.45) {
            w.fillStyle = LAMP;
            w.beginPath();
            w.arc(dx + 3.5 * u, top - rh * 0.48, 2.6 * u, 0, Math.PI * 2);
            w.fill();
          }
        }
        cresting(g, x + bw * 0.1, x + bw * 0.9, top - rh);
        break;
      }
      case 'gable': {
        g.fillStyle = '#3b2c24';
        g.beginPath();
        g.moveTo(x - 3 * u, top);
        g.lineTo(x + bw / 2, top - bw * 0.38);
        g.lineTo(x + bw + 3 * u, top);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath();
        g.moveTo(x + bw / 2, top - bw * 0.38);
        g.lineTo(x + bw + 3 * u, top);
        g.lineTo(x + bw / 2, top);
        g.fill();
        break;
      }
      case 'flat': {
        g.fillStyle = BRASS_DK;
        g.fillRect(x - u, top - 5 * u, bw + 2 * u, 2 * u);
        cresting(g, x, x + bw, top - 5 * u);
        if (b.seed % 3 === 0) {
          const tx = x + bw * 0.55;
          g.fillStyle = IRON;
          g.fillRect(tx - 1 * u, top - 14 * u, 1.4 * u, 12 * u);
          g.fillRect(tx + 12 * u, top - 14 * u, 1.4 * u, 12 * u);
          g.fillStyle = COPPER;
          g.fillRect(tx - 2 * u, top - 30 * u, 17 * u, 16 * u);
          rivets(g, tx - 2 * u, top - 30 * u, 17 * u, 16 * u, 5 * u);
          g.fillStyle = COPPER;
          g.beginPath();
          g.moveTo(tx - 3 * u, top - 30 * u);
          g.lineTo(tx + 6.5 * u, top - 38 * u);
          g.lineTo(tx + 16 * u, top - 30 * u);
          g.fill();
        }
        break;
      }
      case 'dome':
      case 'observatory': {
        const rr = bw * 0.42;
        const cx = x + bw / 2;
        g.fillStyle = BRASS;
        g.fillRect(x + bw * 0.06, top - 6 * u, bw * 0.88, 6 * u);
        g.fillStyle = b.roof === 'observatory' ? COPPER : VERDIGRIS;
        g.beginPath();
        g.ellipse(cx, top - 6 * u, rr, rr * 0.95, 0, Math.PI, 0);
        g.fill();
        g.strokeStyle = 'rgba(20,16,12,0.35)';
        g.lineWidth = 0.9 * u;
        for (let k = 1; k < 6; k++) {
          g.beginPath();
          g.ellipse(cx, top - 6 * u, rr * (k / 6), rr * 0.95, 0, Math.PI, 0);
          g.stroke();
        }
        g.fillStyle = 'rgba(255,220,160,0.3)';
        for (let k = 1; k < 6; k++)
          for (let j = 1; j < 6; j++) {
            const a = Math.PI + (j / 6) * Math.PI;
            g.fillRect(cx + Math.cos(a) * rr * (k / 6), top - 6 * u + Math.sin(a) * rr * 0.95, 0.9 * u, 0.9 * u);
          }
        g.fillStyle = 'rgba(255,240,200,0.12)';
        g.beginPath();
        g.ellipse(cx - rr * 0.35, top - 6 * u - rr * 0.5, rr * 0.25, rr * 0.35, -0.4, 0, Math.PI * 2);
        g.fill();
        if (b.roof === 'observatory') domes.push([cx, top - 6 * u, rr]);
        else {
          g.fillStyle = BRASS;
          g.fillRect(cx - 3 * u, top - 6 * u - rr * 0.95 - 10 * u, 6 * u, 10 * u);
          g.fillStyle = BRASS_HI;
          g.fillRect(cx - 0.6 * u, top - 6 * u - rr * 0.95 - 24 * u, 1.2 * u, 14 * u);
        }
        break;
      }
      case 'cupola': {
        const cx = x + bw / 2;
        g.fillStyle = BRASS;
        g.fillRect(x - u, top - 3 * u, bw + 2 * u, 3 * u);
        g.fillStyle = wallOf(b);
        g.fillRect(cx - bw * 0.2, top - 20 * u, bw * 0.4, 17 * u);
        g.fillStyle = GLASS;
        for (let k = 0; k < 3; k++) g.fillRect(cx - bw * 0.15 + k * bw * 0.11, top - 16 * u, bw * 0.05, 10 * u);
        g.fillStyle = VERDIGRIS;
        g.beginPath();
        g.ellipse(cx, top - 20 * u, bw * 0.24, bw * 0.22, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = BRASS_HI;
        g.fillRect(cx - 0.6 * u, top - 20 * u - bw * 0.22 - 12 * u, 1.2 * u, 12 * u);
        break;
      }
      case 'onion': {
        const cx = x + bw / 2;
        const oh = bw * 0.9;
        g.fillStyle = BRASS_DK;
        g.fillRect(x + bw * 0.15, top - 8 * u, bw * 0.7, 8 * u);
        g.fillStyle = b.seed % 2 === 0 ? BRASS : VERDIGRIS;
        g.beginPath();
        g.moveTo(cx - bw * 0.3, top - 8 * u);
        g.bezierCurveTo(cx - bw * 0.62, top - 8 * u - oh * 0.45, cx - bw * 0.05, top - 8 * u - oh * 0.6, cx, top - 8 * u - oh);
        g.bezierCurveTo(cx + bw * 0.05, top - 8 * u - oh * 0.6, cx + bw * 0.62, top - 8 * u - oh * 0.45, cx + bw * 0.3, top - 8 * u);
        g.fill();
        g.fillStyle = 'rgba(255,240,200,0.16)';
        g.beginPath();
        g.ellipse(cx - bw * 0.14, top - 8 * u - oh * 0.35, bw * 0.08, oh * 0.18, -0.3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = BRASS_HI;
        g.fillRect(cx - 0.6 * u, top - 8 * u - oh - 12 * u, 1.2 * u, 12 * u);
        break;
      }
      case 'spire':
        spire(g, x - u, top, bw + 2 * u, bw * 1.6, b.seed % 2 ? VERDIGRIS : '#3b3432');
        break;
      case 'sawtooth': {
        const teeth = Math.max(2, Math.floor(bw / (24 * u)));
        const tw = bw / teeth;
        for (let k = 0; k < teeth; k++) {
          const tx = x + k * tw;
          g.fillStyle = '#3b3432';
          g.beginPath();
          g.moveTo(tx, top);
          g.lineTo(tx + tw, top - 16 * u);
          g.lineTo(tx + tw, top);
          g.fill();
          g.fillStyle = GLASS;
          g.fillRect(tx + tw - 2.4 * u, top - 16 * u, 2.4 * u, 16 * u);
          w.fillStyle = '#ff9a3c';
          w.fillRect(tx + tw - 2.4 * u, top - 15 * u, 2.4 * u, 14 * u);
        }
        break;
      }
      default:
        break;
    }
  }

  function drawClock(g: CanvasRenderingContext2D, w: CanvasRenderingContext2D, b: Building, top: number) {
    const x = b.x;
    const bw = b.w;
    const fr = bw * 0.4;
    const fx = x + bw / 2;
    const fy = top + fr + 10 * u;
    g.fillStyle = BRASS;
    g.fill(withPath(gearPath(fr + 5 * u, 32), fx, fy), 'evenodd');
    g.fillStyle = '#efe0bc';
    g.beginPath();
    g.arc(fx, fy, fr, 0, Math.PI * 2);
    g.fill();
    w.fillStyle = '#ffe7b0';
    w.beginPath();
    w.arc(fx, fy, fr, 0, Math.PI * 2);
    w.fill();
    g.strokeStyle = '#2a1f18';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.lineWidth = (k % 3 === 0 ? 2 : 1) * u;
      g.beginPath();
      g.moveTo(fx + Math.cos(a) * fr * 0.8, fy + Math.sin(a) * fr * 0.8);
      g.lineTo(fx + Math.cos(a) * fr * 0.94, fy + Math.sin(a) * fr * 0.94);
      g.stroke();
    }
    // The works show through the glass face.
    gears.push({ x: fx - fr * 0.3, y: fy + fr * 0.25, r: fr * 0.32, dir: 1, speed: 0.25, path: gearPath(fr * 0.32, 14), color: 'rgba(122,90,28,0.55)', phase: 0 });
    gears.push({ x: fx + fr * 0.28, y: fy - fr * 0.2, r: fr * 0.22, dir: -1, speed: 0.36, path: gearPath(fr * 0.22, 10), color: 'rgba(122,90,28,0.55)', phase: 0 });
    faces.push([fx, fy, fr]);
    const by = top - 36 * u;
    g.fillStyle = wallOf(b);
    g.fillRect(x + 4 * u, by, bw - 8 * u, 36 * u);
    for (let k = 0; k < 3; k++) {
      const aw = (bw - 18 * u) / 3 - 4 * u;
      const ax = x + 9 * u + k * ((bw - 18 * u) / 3);
      g.fillStyle = '#100c0a';
      g.fillRect(ax, by + 9 * u, aw, 22 * u);
      g.beginPath();
      g.arc(ax + aw / 2, by + 9 * u, aw / 2, Math.PI, 0);
      g.fill();
      g.fillStyle = BRASS_DK;
      g.beginPath();
      g.arc(ax + aw / 2, by + 22 * u, aw * 0.32, Math.PI, 0);
      g.fill();
    }
    g.fillStyle = BRASS;
    g.fillRect(x + 2 * u, by - 3 * u, bw - 4 * u, 3 * u);
    cresting(g, x + 2 * u, x + bw - 2 * u, by - 3 * u);
    spire(g, x, by - 3 * u, bw, bw * 1.9, VERDIGRIS);
  }

  /** The Great Engine: its flywheel and gear train in an open iron frame, pistons, the furnace, three great stacks. */
  function drawEngine(g: CanvasRenderingContext2D, w: CanvasRenderingContext2D, b: Building, top: number, h: number) {
    const x = b.x;
    const bw = b.w;
    const bx = x + bw * 0.12;
    const bwid = bw * 0.76;
    const btop = top + h * 0.12;
    const bh = h * 0.7;
    g.fillStyle = '#14100d';
    g.fillRect(bx, btop, bwid, bh);
    const inner = g.createRadialGradient(bx + bwid / 2, btop + bh * 0.8, 0, bx + bwid / 2, btop + bh * 0.8, bwid * 0.7);
    inner.addColorStop(0, 'rgba(255,120,40,0.35)');
    inner.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = inner;
    g.fillRect(bx, btop, bwid, bh);
    g.strokeStyle = IRON_HI;
    g.lineWidth = 2 * u;
    g.strokeRect(bx, btop, bwid, bh);
    g.lineWidth = 0.9 * u;
    for (let k = 0; k < 8; k++) {
      g.beginPath();
      g.moveTo(bx + (bwid * k) / 8, btop);
      g.lineTo(bx + (bwid * (k + 1)) / 8, btop + 10 * u);
      g.lineTo(bx + (bwid * (k + 2)) / 8, btop);
      g.stroke();
    }
    const R = Math.min(bwid * 0.32, bh * 0.4);
    const cx = bx + bwid * 0.38;
    const cy = btop + bh * 0.48;
    addGear(g, cx, cy, R, 1, BRASS);
    addGear(g, cx + R * 1.38, cy - R * 0.6, R * 0.45, -1, COPPER);
    addGear(g, cx + R * 1.38 + R * 0.75, cy - R * 0.6 + R * 0.62, R * 0.32, 1, BRASS);
    addGear(g, cx - R * 0.95, cy + R * 0.95, R * 0.3, -1, COPPER);
    furnaces.push([bx + bwid * 0.72, btop + bh * 0.62, bwid * 0.2, bh * 0.3]);
    g.fillStyle = '#2a201a';
    g.fillRect(bx + bwid * 0.7, btop + bh * 0.58, bwid * 0.24, bh * 0.38);
    pistons.push({ x: bx + bwid * 0.08, y: btop + bh * 0.1, len: bh * 0.75, phase: 0 });
    pistons.push({ x: bx + bwid * 0.92, y: btop + bh * 0.08, len: bh * 0.45, phase: Math.PI / 2 });
    g.fillStyle = BRASS_HI;
    g.font = SERIF(Math.max(7, 11 * u));
    g.textAlign = 'center';
    g.fillText('THE GREAT ENGINE', x + bw / 2, top + h * 0.09);
    g.textAlign = 'left';
    for (let k = 0; k < 9; k++) {
      const px = x + bw * (0.1 + k * 0.1);
      const py = top + h * 0.9;
      g.fillStyle = BRASS_DK;
      g.beginPath();
      g.arc(px, py, 5 * u, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = GLASS;
      g.beginPath();
      g.arc(px, py, 3.8 * u, 0, Math.PI * 2);
      g.fill();
      w.fillStyle = '#ff9a3c';
      w.beginPath();
      w.arc(px, py, 3.8 * u, 0, Math.PI * 2);
      w.fill();
    }
    pipe(g, [[x + 4 * u, b.base], [x + 4 * u, top + 10 * u], [x + bw * 0.4, top + 10 * u]], 3 * u, COPPER);
    pipe(g, [[x + bw - 4 * u, b.base], [x + bw - 4 * u, top + 24 * u], [x + bw * 0.6, top + 24 * u]], 2.4 * u, BRASS);
    gauge(g, x + 12 * u, top + h * 0.5, 6 * u);
    gauge(g, x + bw - 12 * u, top + h * 0.4, 5 * u);
    valve(g, x + 4 * u, top + h * 0.72, 5 * u);
    for (const c of b.chimneys) chimney(g, x + bw * c, top, 110 * u, 18 * u);
    g.fillStyle = BRASS;
    g.fillRect(x - 3 * u, top - 4 * u, bw + 6 * u, 4 * u);
    cresting(g, x, x + bw, top - 4 * u);
  }

  function drawMast(g: CanvasRenderingContext2D, m: Mast) {
    const H0 = m.base - m.top;
    const shown = H0 * m.built;
    const top = m.base - shown;
    const bw = (m.grand ? 50 : 36) * u;
    const tw = 9 * u;
    const at = (y: number) => bw + (tw - bw) * ((m.base - y) / H0);
    const iron = m.naval ? '#262a30' : IRON;
    g.strokeStyle = iron;
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(m.x - bw / 2, m.base);
    g.lineTo(m.x - at(top) / 2, top);
    g.moveTo(m.x + bw / 2, m.base);
    g.lineTo(m.x + at(top) / 2, top);
    g.stroke();
    g.lineWidth = 1 * u;
    const stepY = 16 * u;
    for (let y = m.base; y > top + stepY; y -= stepY) {
      const a = at(y) / 2;
      const c = at(y - stepY) / 2;
      g.beginPath();
      g.moveTo(m.x - a, y);
      g.lineTo(m.x + c, y - stepY);
      g.moveTo(m.x + a, y);
      g.lineTo(m.x - c, y - stepY);
      g.moveTo(m.x - a, y);
      g.lineTo(m.x + a, y);
      g.stroke();
    }
    g.strokeStyle = hexA(BRASS, 0.5);
    g.lineWidth = 0.7 * u;
    g.beginPath();
    g.moveTo(m.x - bw / 2 + u, m.base);
    g.lineTo(m.x - at(top) / 2 + u, top);
    g.stroke();
    if (m.built < 1) return;
    for (const f of [0.3, 0.6]) {
      const y = m.base - H0 * f;
      const a = at(y);
      g.fillStyle = iron;
      g.fillRect(m.x - a / 2 - 12 * u, y - 2 * u, a + 24 * u, 3 * u);
      cresting(g, m.x - a / 2 - 12 * u, m.x + a / 2 + 12 * u, y - 2 * u);
      g.fillStyle = m.naval ? '#3f4651' : '#5a3a26';
      g.fillRect(m.x - a / 2 - 4 * u, y - 13 * u, a + 8 * u, 11 * u);
      g.fillStyle = BRASS_DK;
      g.fillRect(m.x - a / 2 - 4 * u, y - 14 * u, a + 8 * u, 1.4 * u);
    }
    const ay = m.top + 22 * u;
    g.strokeStyle = iron;
    g.lineWidth = 2 * u;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(m.x, ay);
      g.lineTo(m.x + s * 34 * u, ay);
      g.lineTo(m.x, ay + 24 * u);
      g.stroke();
    }
    g.fillStyle = iron;
    g.fillRect(m.x - 24 * u, m.top + 18 * u, 48 * u, 3.4 * u);
    g.fillStyle = m.naval ? '#4b5563' : COPPER;
    g.beginPath();
    g.moveTo(m.x - 10 * u, m.top + 18 * u);
    g.quadraticCurveTo(m.x - 10 * u, m.top + 2 * u, m.x, m.top - 4 * u);
    g.quadraticCurveTo(m.x + 10 * u, m.top + 2 * u, m.x + 10 * u, m.top + 18 * u);
    g.fill();
    g.strokeStyle = BRASS;
    g.lineWidth = 0.8 * u;
    for (let k = -2; k <= 2; k++) {
      g.beginPath();
      g.moveTo(m.x + k * 4 * u, m.top + 18 * u);
      g.lineTo(m.x + k * 1.5 * u, m.top);
      g.stroke();
    }
    g.fillStyle = BRASS_HI;
    g.fillRect(m.x - 0.7 * u, m.top - 28 * u, 1.4 * u, 26 * u);
    g.fillStyle = '#efe0bc';
    g.font = SERIF(Math.max(5, 6.5 * u));
    g.textAlign = 'center';
    g.fillText(m.name, m.x, m.base - H0 * 0.3 + 10 * u);
    g.textAlign = 'left';
  }

  function paintCity() {
    const c = (city ??= document.createElement('canvas'));
    const l = (lit ??= document.createElement('canvas'));
    c.width = l.width = Math.ceil(GW * K);
    c.height = l.height = Math.ceil(GH * K);
    const g = c.getContext('2d')!;
    const w = l.getContext('2d')!;
    g.setTransform(K, 0, 0, K, 0, 0);
    w.setTransform(K, 0, 0, K, 0, 0);
    g.clearRect(0, 0, GW, GH);
    w.clearRect(0, 0, GW, GH);
    faces = [];
    domes = [];
    gears = [];
    pistons = [];
    furnaces = [];
    if (world.site === 'crag') {
      // The rock: a mesa in strata, its face toward the light lit, every ledge in shadow, moss along
      // the top, scree and boulders at its foot.
      const GY = world.GY;
      const rough = (x: number, y: number) => (y < GY - 4 ? Math.sin(x * 0.09) * 3 * u + Math.sin(x * 0.31) * 2 * u : 0);
      const rock = new Path2D();
      rock.moveTo(0, GH);
      let top = GY;
      for (let x = 0; x <= GW; x += 5) {
        const y = world.groundAt(x);
        top = Math.min(top, y);
        rock.lineTo(x, y + 2 + rough(x, y));
      }
      rock.lineTo(GW, GH);
      rock.closePath();
      g.fillStyle = '#3e3226';
      g.fill(rock);
      g.save();
      g.clip(rock);
      // Strata: beds of sandstone and shale, each a little wavy, thicker toward the foot.
      const BEDS = ['#5a4634', '#4a3a2c', '#64503a', '#42342a', '#56442f', '#3a2e24'];
      let k = 0;
      for (let y = top - 10 * u; y < GH; k++) {
        const th = (7 + hash(k, 11) * 9) * u * (1 + ((y - top) / (GH - top)) * 0.6);
        g.fillStyle = BEDS[k % BEDS.length];
        g.beginPath();
        g.moveTo(-10, y + Math.sin(y) * 2 * u);
        for (let x = 0; x <= GW + 10; x += 12) g.lineTo(x, y + Math.sin(x * 0.012 + k) * 2.5 * u + Math.sin(x * 0.05 + k * 3) * 1 * u);
        g.lineTo(GW + 10, y + th + 4 * u);
        g.lineTo(-10, y + th + 4 * u);
        g.fill();
        y += th;
      }
      // The light across it: the face toward the sun's side lit, the other in shade.
      const lit = world.side > 0 ? 0 : 1;
      const xg = g.createLinearGradient(GW * lit, 0, GW * (1 - lit), 0);
      xg.addColorStop(0, 'rgba(200,160,110,0.16)');
      xg.addColorStop(0.5, 'rgba(0,0,0,0)');
      xg.addColorStop(1, 'rgba(0,0,0,0.3)');
      g.fillStyle = xg;
      g.fillRect(0, 0, GW, GH);
      const rg = g.createLinearGradient(0, top, 0, GH);
      rg.addColorStop(0, 'rgba(220,180,120,0.12)');
      rg.addColorStop(0.6, 'rgba(0,0,0,0)');
      rg.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = rg;
      g.fillRect(0, 0, GW, GH);
      // Under every ledge, its shadow; over it, the moss and the grass that found a hold.
      let prev = world.groundAt(0);
      for (let x = 0; x <= GW; x += 4) {
        const y = world.groundAt(x);
        if (y < GY - 4) {
          g.fillStyle = `rgba(70,90,40,${(0.35 + hash(Math.round(x / 4), 7) * 0.3).toFixed(2)})`;
          g.fillRect(x, y + rough(x, y) - 0.5 * u, 4, (2.5 + hash(Math.round(x / 4), 8) * 2.5) * u);
        }
        if (y !== prev) {
          const yy = Math.min(y, prev);
          const h = Math.abs(y - prev);
          const sg = g.createLinearGradient(0, yy, 0, yy + Math.min(h, 22 * u));
          sg.addColorStop(0, 'rgba(0,0,0,0.42)');
          sg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = sg;
          g.fillRect(x - 60 * u, yy, 120 * u, Math.min(h, 22 * u));
          // The face of the step, cracked.
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.lineWidth = 1 * u;
          g.beginPath();
          g.moveTo(x, yy);
          g.lineTo(x + (hash(x, 3) - 0.5) * 6 * u, yy + h);
          g.stroke();
        }
        prev = y;
      }
      // Cracks and seams down the faces.
      g.strokeStyle = 'rgba(0,0,0,0.32)';
      g.lineWidth = 1.2 * u;
      for (let q = 0; q < 70; q++) {
        const x = hash(q, 1) * GW;
        const y0 = world.groundAt(x);
        if (y0 >= GY - 6) continue;
        const y = y0 + hash(q, 2) * (GY - y0);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (hash(q, 3) - 0.5) * 14 * u, y + 10 * u + hash(q, 4) * 24 * u);
        g.lineTo(x + (hash(q, 5) - 0.5) * 20 * u, y + 24 * u + hash(q, 6) * 30 * u);
        g.stroke();
      }
      g.restore();
      // Scree and boulders where the rock meets the ground.
      for (let q = 0; q < 40; q++) {
        const x = hash(q, 21) * GW;
        const y0 = world.groundAt(x);
        const near = world.groundAt(x - 40 * u) < GY - 4 || world.groundAt(x + 40 * u) < GY - 4;
        if (y0 < GY - 4 || !near) continue;
        const r = (3 + hash(q, 22) * 9) * u;
        g.fillStyle = hash(q, 23) < 0.5 ? '#4a3a2c' : '#5a4836';
        g.beginPath();
        g.moveTo(x - r, GY + 2);
        g.lineTo(x - r * 0.5, GY + 2 - r * 0.9);
        g.lineTo(x + r * 0.4, GY + 2 - r);
        g.lineTo(x + r, GY + 2);
        g.fill();
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(x - r, GY + 1, r * 2, 2 * u);
      }
      for (let x = 0; x < GW; x += 46 * u) {
        const y = world.groundAt(x);
        const yl = world.groundAt(x + 30 * u);
        if (Math.abs(y - yl) > 20 * u) {
          g.strokeStyle = IRON;
          g.lineWidth = 2.2 * u;
          g.beginPath();
          g.moveTo(x + 15 * u, Math.min(y, yl) + 2);
          g.lineTo(x + 15 * u + (y < yl ? 30 : -30) * u, Math.max(y, yl));
          g.stroke();
        }
      }
    } else if (world.site === 'decks') {
      const levels = new Map<number, [number, number]>();
      for (let x = 0; x <= GW; x += 4) {
        const y = world.groundAt(x);
        if (y >= world.GY - 2) continue;
        const span = levels.get(y) ?? [x, x];
        span[0] = Math.min(span[0], x);
        span[1] = Math.max(span[1], x);
        levels.set(y, span);
      }
      for (const [y, [a, bb]] of [...levels.entries()].sort((p, q) => q[0] - p[0])) {
        g.strokeStyle = IRON;
        g.lineWidth = 3.2 * u;
        for (let x = a + 10 * u; x < bb; x += 60 * u) {
          g.beginPath();
          g.moveTo(x, y + 14 * u);
          g.lineTo(x, world.GY);
          g.stroke();
        }
        g.lineWidth = 1 * u;
        g.beginPath();
        for (let x = a; x < bb; x += 14 * u) {
          g.moveTo(x, y + 4 * u);
          g.lineTo(x + 7 * u, y + 16 * u);
          g.lineTo(x + 14 * u, y + 4 * u);
        }
        g.stroke();
        g.fillStyle = '#3a322c';
        g.fillRect(a - 6 * u, y, bb - a + 12 * u, 5 * u);
        g.fillRect(a - 6 * u, y + 15 * u, bb - a + 12 * u, 2.4 * u);
        rivets(g, a - 6 * u, y, bb - a + 12 * u, 5 * u, 6 * u);
        g.fillStyle = BRASS_DK;
        g.fillRect(a - 6 * u, y - 1 * u, bb - a + 12 * u, 1.2 * u);
      }
      g.fillStyle = '#231c17';
      g.fillRect(0, world.GY, GW, GH - world.GY);
    } else {
      g.fillStyle = '#231c17';
      g.fillRect(0, world.GY, GW, GH - world.GY);
    }
    g.fillStyle = '#4a3a2c';
    g.fillRect(0, world.GY, GW, 5 * u);
    g.fillStyle = BRASS_DK;
    g.fillRect(0, world.GY - 1 * u, GW, 1.2 * u);
    for (const b of main) drawBuilding(g, w, b);
    for (const m of world.masts) drawMast(g, m);
    if (world.shipyard) {
      const y = world.shipyard;
      const x0 = y.x - 190 * u;
      const x1 = y.x + 190 * u;
      const ht = 250 * u;
      g.strokeStyle = IRON;
      for (const x of [x0, x1]) {
        g.lineWidth = 3 * u;
        g.beginPath();
        g.moveTo(x - 11 * u, y.base);
        g.lineTo(x - 4 * u, y.base - ht);
        g.moveTo(x + 11 * u, y.base);
        g.lineTo(x + 4 * u, y.base - ht);
        g.stroke();
        g.lineWidth = 1 * u;
        for (let yy = y.base; yy > y.base - ht + 14 * u; yy -= 14 * u) {
          g.beginPath();
          g.moveTo(x - 10 * u, yy);
          g.lineTo(x + 10 * u, yy - 14 * u);
          g.moveTo(x + 10 * u, yy);
          g.lineTo(x - 10 * u, yy - 14 * u);
          g.stroke();
        }
      }
      g.lineWidth = 5 * u;
      g.beginPath();
      g.moveTo(x0 - 24 * u, y.base - ht);
      g.lineTo(x1 + 24 * u, y.base - ht);
      g.stroke();
      g.fillStyle = BRASS_HI;
      g.font = SERIF(Math.max(6, 9 * u));
      g.textAlign = 'center';
      g.fillText(`THE ${world.name} AIRSHIP YARDS`, y.x, y.base - ht - 8 * u);
      g.textAlign = 'left';
    }
    for (const lk of world.links) {
      if (lk.kind === 'viaduct') {
        const depth = 14 * u;
        g.strokeStyle = IRON;
        g.lineWidth = 2.4 * u;
        g.beginPath();
        g.moveTo(lk.ax, lk.ay);
        g.lineTo(lk.bx, lk.ay);
        g.moveTo(lk.ax, lk.ay + depth);
        g.lineTo(lk.bx, lk.ay + depth);
        g.stroke();
        g.lineWidth = 1 * u;
        g.beginPath();
        for (let x = lk.ax; x < lk.bx; x += depth) {
          g.moveTo(x, lk.ay + depth);
          g.lineTo(x + depth / 2, lk.ay);
          g.lineTo(x + depth, lk.ay + depth);
        }
        g.stroke();
        for (let x = lk.ax + 80 * u; x < lk.bx; x += 160 * u) {
          const ground = world.groundAt(x);
          if (ground <= lk.ay + depth) continue;
          g.lineWidth = 3 * u;
          g.beginPath();
          g.moveTo(x - 6 * u, ground);
          g.lineTo(x - 3 * u, lk.ay + depth);
          g.moveTo(x + 6 * u, ground);
          g.lineTo(x + 3 * u, lk.ay + depth);
          g.stroke();
        }
        g.fillStyle = BRASS_DK;
        g.fillRect(lk.ax, lk.ay - 1.4 * u, lk.bx - lk.ax, 1.4 * u);
      } else if (lk.kind === 'tube') {
        pipe(g, [[lk.ax, lk.ay], [lk.bx, lk.by]], 3 * u, BRASS);
        g.fillStyle = 'rgba(255,240,200,0.25)';
        for (let x = lk.ax; x < lk.bx; x += 26 * u) g.fillRect(x, lk.ay - 1.2 * u, 6 * u, 1.2 * u);
      } else {
        g.strokeStyle = 'rgba(28,22,18,0.85)';
        g.lineWidth = 1 * u;
        g.beginPath();
        g.moveTo(lk.ax, lk.ay);
        g.quadraticCurveTo((lk.ax + lk.bx) / 2, (lk.ay + lk.by) / 2 + lk.sag * 2, lk.bx, lk.by);
        g.stroke();
      }
    }
    for (const [x, y] of world.lamps) {
      g.fillStyle = SOOT;
      g.fillRect(x - 0.8 * u, y, 1.6 * u, 20 * u);
      g.fillStyle = BRASS_DK;
      g.fillRect(x - 2.6 * u, y - 4.4 * u, 5.2 * u, 4.6 * u);
      g.beginPath();
      g.moveTo(x - 3.2 * u, y - 4.4 * u);
      g.lineTo(x, y - 7.4 * u);
      g.lineTo(x + 3.2 * u, y - 4.4 * u);
      g.fill();
    }
    cityVersion = world.version;
    cityAt = world.t;
  }

  // ---- sky-galleons -------------------------------------------------------------------------------
  /** Proportions per kind: envelope length, envelope height, hull length, hull depth (of the ship's length). */
  const SHAPE: Record<string, [number, number, number, number]> = {
    liner: [0.92, 0.26, 0.66, 0.15],
    freighter: [0.8, 0.3, 0.6, 0.15],
    corvette: [0.85, 0.24, 0.7, 0.13],
    pirate: [0.82, 0.3, 0.66, 0.15],
    courier: [0.7, 0.36, 0.5, 0.15],
    racer: [0.75, 0.28, 0.56, 0.12],
    leviathan: [0.95, 0.24, 0.7, 0.16],
  };
  function hullPath(hl: number, hd: number, y0: number) {
    ctx.beginPath();
    ctx.moveTo(-hl / 2, y0 - hd * 0.35);
    ctx.lineTo(hl * 0.42, y0 - hd * 0.05);
    ctx.lineTo(hl * 0.52, y0 - hd * 0.25);
    ctx.quadraticCurveTo(hl * 0.46, y0 + hd * 0.7, hl * 0.18, y0 + hd);
    ctx.lineTo(-hl * 0.32, y0 + hd * 0.92);
    ctx.quadraticCurveTo(-hl * 0.5, y0 + hd * 0.7, -hl / 2, y0 - hd * 0.35);
    ctx.closePath();
  }
  function fanProp(x: number, y: number, r: number, t: number) {
    ctx.fillStyle = 'rgba(20,16,12,0.35)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(210,190,150,0.5)';
    const a0 = t * 9 + x * 0.01;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.48, r * 0.16, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = Math.max(0.8, r * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = BRASS_HI;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
  function balloon(ex: number, ey: number, el: number, eh: number, body: string, pirate: boolean, seed: number) {
    const grad = ctx.createLinearGradient(0, ey - eh / 2, 0, ey + eh / 2);
    grad.addColorStop(0, mixHex(body, '#fff4dc', 0.3));
    grad.addColorStop(0.5, body);
    grad.addColorStop(1, mixHex(body, '#140e0a', 0.55));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(ex, ey, el / 2, eh / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, el / 2, eh / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(40,28,18,0.25)';
    ctx.lineWidth = 0.7 * u;
    for (let k = -6; k <= 6; k++) {
      ctx.beginPath();
      ctx.ellipse(ex, ey, Math.abs(k / 6) * el * 0.5, eh / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,40,24,0.45)';
    ctx.lineWidth = 0.6 * u;
    const net = Math.max(5 * u, eh / 5);
    for (let k = -el; k < el; k += net) {
      ctx.beginPath();
      ctx.moveTo(ex + k, ey - eh);
      ctx.lineTo(ex + k + eh * 2, ey + eh);
      ctx.moveTo(ex + k, ey + eh);
      ctx.lineTo(ex + k + eh * 2, ey - eh);
      ctx.stroke();
    }
    if (pirate) {
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 ? 'rgba(140,40,30,0.6)' : 'rgba(110,100,80,0.55)';
        ctx.fillRect(ex + (hash(seed, k) - 0.5) * el * 0.8, ey + (hash(seed, k, 1) - 0.6) * eh, el * 0.12, eh * 0.28);
      }
    }
    ctx.fillStyle = 'rgba(255,244,220,0.14)';
    ctx.fillRect(ex - el / 2, ey - eh * 0.44, el, eh * 0.12);
    ctx.restore();
    ctx.fillStyle = BRASS;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(ex + s * el * 0.47, ey, el * 0.04, eh * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  /** One sky-galleon, near: balloon(s) and rigging, the hull and its decks, fans, sails, stacks. */
  function drawShip(s: Ship, t: number) {
    const L = s.len;
    ctx.save();
    ctx.translate(s.x, s.y + Math.sin(s.bob * 0.9) * 1.6 * u);
    ctx.rotate(s.tilt);
    ctx.scale(s.dir, 1);
    if (s.kind === 'balloon') {
      const r = L * 0.5;
      ctx.strokeStyle = '#3a2a1c';
      ctx.lineWidth = 0.6 * u;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, r * 0.55);
      ctx.lineTo(-r * 0.25, r * 1.5);
      ctx.moveTo(r * 0.55, r * 0.55);
      ctx.lineTo(r * 0.25, r * 1.5);
      ctx.stroke();
      ctx.fillStyle = WOOD;
      ctx.fillRect(-r * 0.3, r * 1.5, r * 0.6, r * 0.42);
      ctx.fillStyle = BRASS;
      ctx.fillRect(-r * 0.32, r * 1.5, r * 0.64, r * 0.08);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      for (let k = -4; k <= 4; k++) {
        ctx.fillStyle = k % 2 ? s.colors[0] : s.colors[1];
        ctx.fillRect((k - 0.5) * r * 0.25, -r, r * 0.25, r * 2);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(r * 0.2, -r, r, r * 2);
      ctx.restore();
      ctx.restore();
      return;
    }
    const [eL, eH, hL, hD] = SHAPE[s.kind];
    const el = L * eL;
    const eh = L * eH;
    const hl = L * hL;
    const hd = L * hD;
    const y0 = eh * 0.5 + L * 0.09;
    const pirate = s.kind === 'pirate';
    const iron = s.kind === 'corvette';
    const body = pirate ? '#4a3a30' : iron ? '#8a8478' : s.colors[0];
    ctx.strokeStyle = 'rgba(40,28,18,0.75)';
    ctx.lineWidth = 0.6 * u;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const f = -0.42 + k * 0.14;
      ctx.moveTo(f * el, eh * 0.38);
      ctx.lineTo(f * hl * 0.95, y0 - hd * 0.2);
    }
    ctx.stroke();
    if (s.kind === 'liner' || s.kind === 'pirate' || s.kind === 'leviathan') {
      const sail = pirate ? '#7f1d1d' : '#d8c8a0';
      for (const [sx, scale] of [[-hl * 0.1, 1], [hl * 0.22, 0.75]] as [number, number][]) {
        const tips: [number, number][] = [];
        for (let k = 0; k <= 4; k++) {
          const a = Math.PI * 0.95 + (k / 4) * 0.9;
          const rr = hd * 2.6 * scale * (k % 2 ? 0.86 : 1);
          tips.push([sx + Math.cos(a) * rr * 1.3, y0 + Math.sin(a) * rr * 0.5 - hd * 0.5]);
        }
        ctx.fillStyle = hexA(sail, pirate ? 0.85 : 0.75);
        ctx.beginPath();
        ctx.moveTo(sx, y0);
        for (const [tx, ty] of tips) ctx.lineTo(tx, ty);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pirate ? '#2a0a0a' : BRASS_DK;
        ctx.lineWidth = 0.8 * u;
        ctx.beginPath();
        for (const [tx, ty] of tips) {
          ctx.moveTo(sx, y0);
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }
    }
    if (s.kind === 'freighter') {
      balloon(-el * 0.22, 0, el * 0.5, eh, body, false, s.id);
      balloon(el * 0.26, eh * 0.05, el * 0.46, eh * 0.95, mixHex(body, '#000000', 0.08), false, s.id + 1);
    } else {
      balloon(0, 0, el, eh, body, pirate, s.id);
      if (s.kind === 'leviathan' || s.kind === 'liner') balloon(-el * 0.05, -eh * 0.62, el * 0.6, eh * 0.55, mixHex(body, '#ffffff', 0.08), false, s.id + 3);
    }
    const hullTop = iron ? '#5a5650' : pirate ? '#2a1c16' : WOOD;
    const hullBot = iron ? '#2e2c2a' : pirate ? '#120c0a' : WOOD_DK;
    const hg = ctx.createLinearGradient(0, y0 - hd * 0.3, 0, y0 + hd);
    hg.addColorStop(0, hullTop);
    hg.addColorStop(1, hullBot);
    hullPath(hl, hd, y0);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.save();
    hullPath(hl, hd, y0);
    ctx.clip();
    if (iron) {
      ctx.fillStyle = 'rgba(255,230,180,0.2)';
      for (let yy = y0; yy < y0 + hd; yy += 4 * u) for (let xx = -hl / 2; xx < hl / 2; xx += 5 * u) ctx.fillRect(xx, yy, 0.8 * u, 0.8 * u);
    } else {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 0.5 * u;
      for (let k = 1; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(-hl / 2, y0 - hd * 0.3 + (k * hd) / 5);
        ctx.quadraticCurveTo(0, y0 - hd * 0.1 + (k * hd) / 5 + hd * 0.15, hl / 2, y0 - hd * 0.1 + (k * hd) / 6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = pirate ? '#7f1d1d' : iron ? '#1e3a5f' : s.colors[1];
    ctx.fillRect(-hl / 2, y0 + hd * 0.18, hl, hd * 0.22);
    ctx.restore();
    for (let k = 0; k < Math.floor(hl / (9 * u)); k++) {
      const px = -hl * 0.4 + k * 9 * u;
      if (px > hl * 0.38) break;
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(px, y0 + hd * 0.29, hd * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GLASS;
      ctx.beginPath();
      ctx.arc(px, y0 + hd * 0.29, hd * 0.08, 0, Math.PI * 2);
      ctx.fill();
      if ((iron || pirate) && k % 2 === 0) {
        ctx.fillStyle = '#0f0d0c';
        ctx.fillRect(px - hd * 0.1, y0 + hd * 0.55, hd * 0.2, hd * 0.16);
        ctx.fillRect(px - hd * 0.04, y0 + hd * 0.6, hd * 0.45, hd * 0.06);
      }
    }
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1.2 * u;
    ctx.beginPath();
    ctx.moveTo(-hl / 2, y0 - hd * 0.35);
    ctx.lineTo(hl * 0.42, y0 - hd * 0.05);
    ctx.stroke();
    ctx.lineWidth = 0.6 * u;
    for (let k = 0; k < 14; k++) {
      const f = -0.48 + k * 0.066;
      const yy = y0 - hd * 0.35 + (f + 0.5) * hd * 0.3;
      ctx.beginPath();
      ctx.moveTo(f * hl, yy);
      ctx.lineTo(f * hl, yy - hd * 0.25);
      ctx.stroke();
    }
    ctx.fillStyle = hullTop;
    ctx.fillRect(-hl / 2, y0 - hd * 0.75, hl * 0.18, hd * 0.42);
    ctx.fillStyle = BRASS;
    ctx.fillRect(-hl / 2, y0 - hd * 0.78, hl * 0.18, hd * 0.06);
    ctx.fillStyle = GLASS;
    for (let k = 0; k < 3; k++) ctx.fillRect(-hl / 2 + hl * 0.02 + k * hl * 0.055, y0 - hd * 0.66, hl * 0.035, hd * 0.2);
    ctx.strokeStyle = WOOD_DK;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(hl * 0.5, y0 - hd * 0.2);
    ctx.lineTo(hl * 0.5 + L * 0.12, y0 - hd * 0.75);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(40,28,18,0.6)';
    ctx.lineWidth = 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(hl * 0.5 + L * 0.12, y0 - hd * 0.75);
    ctx.lineTo(el * 0.45, 0);
    ctx.stroke();
    ctx.fillStyle = BRASS_HI;
    ctx.beginPath();
    ctx.arc(hl * 0.52, y0 - hd * 0.12, hd * 0.12, 0, Math.PI * 2);
    ctx.fill();
    const stacks = s.kind === 'leviathan' ? 3 : s.kind === 'liner' ? 2 : s.kind === 'courier' || s.kind === 'racer' ? 0 : 1;
    for (let k = 0; k < stacks; k++) {
      const sx = -hl * 0.1 + k * hl * 0.16;
      const sy = y0 - hd * 0.2 - (sx / hl) * hd * 0.3;
      ctx.fillStyle = pirate ? '#1a1412' : '#3a2a20';
      ctx.fillRect(sx - hd * 0.12, sy - hd * 0.9, hd * 0.24, hd * 0.9);
      ctx.fillStyle = BRASS;
      ctx.fillRect(sx - hd * 0.16, sy - hd * 0.95, hd * 0.32, hd * 0.1);
      for (let p = 0; p < 4; p++) {
        const age = (t * 0.8 + p * 0.25 + k * 0.3) % 1;
        ctx.fillStyle = `rgba(200,190,175,${(0.35 * (1 - age)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx - age * L * 0.12, sy - hd * 0.95 - age * hd * 1.4, hd * (0.18 + age * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const fx = -hl * 0.48;
    const fy = y0 - hd * 0.78;
    ctx.fillStyle = WOOD_DK;
    ctx.fillRect(fx, fy - hd * 1.4, 0.9 * u, hd * 1.4);
    const wave = Math.sin(t * 5 + s.id) * 1.5 * u;
    ctx.fillStyle = pirate ? '#0d0d0d' : iron ? '#1e3a8a' : s.flag;
    ctx.beginPath();
    ctx.moveTo(fx, fy - hd * 1.4);
    ctx.lineTo(fx - 13 * u, fy - hd * 1.2 + wave);
    ctx.lineTo(fx, fy - hd * 0.9);
    ctx.fill();
    if (pirate) {
      ctx.fillStyle = '#f5f5f4';
      ctx.beginPath();
      ctx.arc(fx - 5 * u, fy - hd * 1.18 + wave * 0.5, 1.5 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = BRASS_DK;
    ctx.lineWidth = 1.4 * u;
    ctx.beginPath();
    ctx.moveTo(-hl * 0.42, y0 - hd * 0.1);
    ctx.lineTo(-hl * 0.5 - L * 0.07, y0 - hd * 0.2);
    ctx.stroke();
    fanProp(-hl * 0.5 - L * 0.08, y0 - hd * 0.2, hd * 0.85, t + s.id);
    if (L > 100 * u) {
      ctx.beginPath();
      ctx.moveTo(hl * 0.05, y0 + hd * 0.3);
      ctx.lineTo(hl * 0.08, y0 + hd * 1.3);
      ctx.stroke();
      fanProp(hl * 0.08, y0 + hd * 1.5, hd * 0.6, t * 1.1 + s.id);
    }
    if ((s.kind === 'liner' || s.kind === 'leviathan' || s.kind === 'freighter') && L > 120 * u) {
      ctx.fillStyle = BRASS_HI;
      ctx.font = SERIF(Math.max(5, hd * 0.24));
      ctx.textAlign = 'center';
      ctx.fillText(s.name, hl * 0.08, y0 + hd * 0.78);
      ctx.textAlign = 'left';
    }
    if (s.kind === 'racer') {
      ctx.strokeStyle = s.colors[0];
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(-el * 0.5, 0);
      for (let k = 1; k <= 8; k++) ctx.lineTo(-el * 0.5 - k * 7 * u, Math.sin(t * 9 + k) * 3 * u);
      ctx.stroke();
    }
    if (s.kind === 'freighter') {
      ctx.fillStyle = '#7a4a22';
      ctx.strokeStyle = '#3a2412';
      ctx.lineWidth = 0.5 * u;
      for (let k = 0; k < 3; k++) {
        const bx = -hl * 0.2 + k * hl * 0.14;
        const by = y0 - hd * 0.85 + (k % 2) * hd * 0.1;
        ctx.fillRect(bx, by, hl * 0.11, hd * 0.5);
        ctx.strokeRect(bx, by, hl * 0.11, hd * 0.5);
      }
    }
    ctx.restore();
  }
  function drawFar(s: Ship, color: string) {
    const L = s.len * s.z;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(s.dir, 1);
    ctx.fillStyle = color;
    if (s.kind === 'balloon') {
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const [eL, eH, hL, hD] = SHAPE[s.kind] ?? SHAPE.freighter;
      ctx.beginPath();
      ctx.ellipse(0, 0, (L * eL) / 2, (L * eH) / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      hullPath(L * hL, L * hD, L * eH * 0.5 + L * 0.09);
      ctx.fill();
    }
    ctx.restore();
  }
  function shipLights(s: Ship, t: number, night: number) {
    if (s.kind === 'balloon') {
      if (night > 0.1) glow(s.x, s.y + s.len * 0.5, s.len * 0.6, '#ff9a3c', night * 0.5);
      return;
    }
    const L = s.len;
    const [, eH, hL, hD] = SHAPE[s.kind];
    const eh = L * eH;
    const hl = L * hL;
    const hd = L * hD;
    const y0 = eh * 0.5 + L * 0.09;
    const by = s.y + Math.sin(s.bob * 0.9) * 1.6 * u;
    if (night > 0.05 && s.state !== 'wreck') {
      ctx.save();
      ctx.translate(s.x, by);
      ctx.rotate(s.tilt);
      ctx.scale(s.dir, 1);
      ctx.fillStyle = hexA(LAMP, 0.9 * night);
      for (let k = 0; k < Math.floor(hl / (9 * u)); k++) {
        const px = -hl * 0.4 + k * 9 * u;
        if (px > hl * 0.38) break;
        if (hash(s.id, k) < 0.8) {
          ctx.beginPath();
          ctx.arc(px, y0 + hd * 0.29, hd * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (let k = 0; k < 3; k++) ctx.fillRect(-hl / 2 + hl * 0.02 + k * hl * 0.055, y0 - hd * 0.66, hl * 0.035, hd * 0.2);
      ctx.restore();
      glow(s.x + s.dir * hl * 0.5, by + y0 * 0.9, 10 * u, '#ff3b30', night * (Math.floor(t * 1.5 + s.id) % 2 ? 0.9 : 0.3));
      glow(s.x - s.dir * hl * 0.5, by + y0 * 0.9, 10 * u, '#34d399', night * 0.7);
    }
    if (s.fire > 0) {
      ctx.save();
      ctx.translate(s.x, by);
      ctx.rotate(s.tilt);
      ctx.scale(s.dir, 1);
      for (let k = 0; k < 9; k++) {
        const x = (hash(s.id, k) - 0.5) * L * 0.8;
        const fl = (0.6 + 0.4 * Math.sin(t * 13 + k * 2)) * s.fire;
        ctx.fillStyle = k % 2 ? 'rgba(251,146,60,0.85)' : 'rgba(253,224,71,0.8)';
        ctx.beginPath();
        ctx.moveTo(x - 6 * u, -eh * 0.35);
        ctx.quadraticCurveTo(x, -eh * 0.35 - 26 * u * fl, x + 6 * u, -eh * 0.35);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- the machinery, live -----------------------------------------------------------------------
  function moving(t: number) {
    for (const gr of gears) {
      ctx.save();
      ctx.translate(gr.x, gr.y);
      ctx.rotate(gr.phase + t * gr.speed * gr.dir);
      ctx.fillStyle = gr.color;
      ctx.fill(gr.path, 'evenodd');
      if (!gr.color.startsWith('rgba')) {
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 0.6 * u;
        ctx.stroke(gr.path);
        ctx.fillStyle = BRASS_HI;
        ctx.beginPath();
        ctx.arc(0, 0, gr.r * 0.14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    for (const p of pistons) {
      const k = 0.5 + 0.5 * Math.sin(t * 2.4 + p.phase);
      ctx.fillStyle = IRON_HI;
      ctx.fillRect(p.x - 5 * u, p.y, 10 * u, p.len * 0.4);
      ctx.fillStyle = '#9a948a';
      ctx.fillRect(p.x - 2 * u, p.y + p.len * 0.4, 4 * u, p.len * 0.25 + k * p.len * 0.3);
      ctx.fillStyle = BRASS;
      ctx.fillRect(p.x - 6 * u, p.y + p.len * 0.62 + k * p.len * 0.3, 12 * u, 5 * u);
    }
    const hrs = world.day * 24;
    for (const [fx, fy, fr] of faces) {
      const hA = ((hrs % 12) / 12) * Math.PI * 2 - Math.PI / 2;
      const mA = (hrs % 1) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = '#140e0a';
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(hA) * fr * 0.5, fy + Math.sin(hA) * fr * 0.5);
      ctx.stroke();
      ctx.lineWidth = 1.3 * u;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + Math.cos(mA) * fr * 0.78, fy + Math.sin(mA) * fr * 0.78);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(fx, fy, 2.4 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const [cx, cy, rr] of domes) {
      const a = -Math.PI / 2 + Math.sin(t * 0.05) * 0.6;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = GLASS;
      ctx.fillRect(-rr * 0.08, -rr * 0.95, rr * 0.16, rr * 0.95);
      ctx.restore();
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = rr * 0.14;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rr * 0.2);
      ctx.lineTo(cx + Math.cos(a) * rr * 1.3, cy - rr * 0.2 + Math.sin(a) * rr * 1.3);
      ctx.stroke();
      ctx.strokeStyle = BRASS_HI;
      ctx.lineWidth = rr * 0.04;
      ctx.stroke();
    }
    for (const b of main) {
      if (b.kind !== 'gasometer') continue;
      const fH = 150 * u;
      const th = fH * (0.25 + b.gas * 0.7);
      const ty = b.base - th;
      ctx.fillStyle = '#3e4a40';
      ctx.fillRect(b.x + 3 * u, ty, b.w - 6 * u, th);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w * 0.68, ty, b.w * 0.32 - 3 * u, th);
      ctx.fillStyle = '#566656';
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, ty, b.w / 2 - 3 * u, 5 * u, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,220,160,0.2)';
      for (let y = ty + 12 * u; y < b.base; y += 14 * u) ctx.fillRect(b.x + 3 * u, y, b.w - 6 * u, 1 * u);
    }
    for (const b of main) {
      if (b.scaffold < 0) continue;
      const top = topOf(b);
      const sh = b.floorH * b.scaffold;
      ctx.fillStyle = wallOf(b);
      ctx.fillRect(b.x, top - sh, b.w, sh);
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 0.8 * u;
      ctx.strokeRect(b.x - 3 * u, top - b.floorH - 4 * u, b.w + 6 * u, b.floorH + 4 * u);
      ctx.beginPath();
      for (let x = b.x - 3 * u; x < b.x + b.w + 3 * u; x += 8 * u) {
        ctx.moveTo(x, top);
        ctx.lineTo(x + 8 * u, top - b.floorH - 4 * u);
      }
      ctx.stroke();
      const ca = Math.sin(t * 0.3 + b.seed) * 0.8;
      ctx.strokeStyle = IRON;
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2, top - b.floorH - 4 * u);
      ctx.lineTo(b.x + b.w / 2, top - b.floorH - 36 * u);
      ctx.lineTo(b.x + b.w / 2 + Math.cos(ca) * 42 * u, top - b.floorH - 36 * u);
      ctx.stroke();
      ctx.lineWidth = 0.6 * u;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w / 2 + Math.cos(ca) * 38 * u, top - b.floorH - 36 * u);
      ctx.lineTo(b.x + b.w / 2 + Math.cos(ca) * 38 * u, top - b.floorH - 14 * u);
      ctx.stroke();
    }
    const yd = world.shipyard;
    if (yd) {
      const L = 300 * u;
      const eh = L * 0.24;
      const cy = yd.base - 150 * u;
      ctx.save();
      ctx.translate(yd.x, cy);
      ctx.strokeStyle = '#7a6040';
      ctx.lineWidth = 1 * u;
      const ribs = Math.floor(yd.progress * 26);
      for (let k = 0; k <= ribs; k++) {
        const x = -L / 2 + (k / 26) * L;
        const f = Math.sqrt(Math.max(0, 1 - Math.pow((x / (L / 2)) * 0.98, 2)));
        ctx.beginPath();
        ctx.ellipse(x, 0, 2 * u, (eh / 2) * f, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (yd.progress > 0.4) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(-L / 2, -eh, L * Math.min(1, (yd.progress - 0.4) / 0.55), eh * 3);
        ctx.clip();
        balloon(0, 0, L, eh, '#e8dcc0', false, 7);
        ctx.restore();
      }
      ctx.restore();
      if (Math.floor(t * 3) % 2 === 0) {
        ctx.fillStyle = 'rgba(253,224,71,0.9)';
        ctx.fillRect(yd.x - L / 2 + (ribs / 26) * L - 1 * u, cy - eh * 0.3 + hash(Math.floor(t * 3)) * eh * 0.6, 2 * u, 2 * u);
      }
    }
    for (const m of world.masts) {
      if (m.built < 1) continue;
      const span = m.base - m.top - 30 * u;
      const ly = m.base - 10 * u - (0.5 + 0.5 * Math.sin(t * 0.12 + m.id * 2)) * span;
      ctx.fillStyle = m.naval ? '#4b5563' : '#7a5230';
      ctx.fillRect(m.x - 5 * u, ly - 9 * u, 10 * u, 9 * u);
      ctx.fillStyle = BRASS;
      ctx.fillRect(m.x - 5 * u, ly - 10 * u, 10 * u, 1.4 * u);
      if (m.grand) {
        const fy = m.top - 28 * u;
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(m.x + 0.7 * u, fy);
        for (let k = 0; k <= 6; k++) ctx.lineTo(m.x + 0.7 * u + k * 4 * u, fy + Math.sin(t * 4 + k * 0.8) * 1.6 * u);
        ctx.lineTo(m.x + 24.7 * u, fy + 12 * u);
        for (let k = 6; k >= 0; k--) ctx.lineTo(m.x + 0.7 * u + k * 4 * u, fy + 12 * u + Math.sin(t * 4 + k * 0.8) * 1.6 * u);
        ctx.fill();
      }
    }
    for (const rd of world.riders) {
      const l = world.links[rd.link];
      const x = l.ax + (l.bx - l.ax) * rd.u;
      if (rd.kind === 'tram') {
        ctx.fillStyle = '#5c1a14';
        ctx.fillRect(x - 15 * u, l.ay - 10 * u, 30 * u, 9 * u);
        ctx.fillStyle = BRASS;
        ctx.fillRect(x - 15 * u, l.ay - 10.8 * u, 30 * u, 1.4 * u);
        ctx.fillStyle = GLASS;
        for (let k = 0; k < 5; k++) ctx.fillRect(x - 13 * u + k * 5.6 * u, l.ay - 8.2 * u, 3.6 * u, 3.4 * u);
        ctx.fillStyle = '#3a2a20';
        ctx.fillRect(x + 8 * u, l.ay - 16 * u, 3 * u, 6 * u);
      } else if (rd.kind === 'car') {
        const y = l.ay + (l.by - l.ay) * rd.u + 4 * l.sag * rd.u * (1 - rd.u);
        ctx.strokeStyle = SOOT;
        ctx.lineWidth = 0.6 * u;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 7 * u);
        ctx.stroke();
        ctx.fillStyle = COPPER;
        ctx.beginPath();
        ctx.roundRect(x - 7 * u, y + 7 * u, 14 * u, 10 * u, 3 * u);
        ctx.fill();
        ctx.fillStyle = GLASS;
        ctx.fillRect(x - 5 * u, y + 9 * u, 10 * u, 4 * u);
      } else if (rd.wait <= 0) {
        ctx.fillStyle = BRASS_HI;
        ctx.fillRect(x - 3 * u, l.ay - 1.6 * u, 6 * u, 3.2 * u);
      }
    }
  }

  function walker() {
    const wk = world.walker;
    if (!wk) return;
    const gy = world.groundAt(wk.x);
    const ph = (wk.step / 1.2) * Math.PI;
    const bodyY = gy - 150 * u + Math.abs(Math.sin(ph)) * 6 * u;
    ctx.save();
    ctx.translate(wk.x, 0);
    ctx.scale(wk.dir, 1);
    for (const side of [-1, 1]) {
      const swing = Math.sin(ph + (side > 0 ? 0 : Math.PI)) * 30 * u;
      const hipX = side * 26 * u;
      const footX = hipX + swing;
      const kneeX = (hipX + footX) / 2 + 16 * u;
      const kneeY = (bodyY + 30 * u + gy) / 2;
      ctx.strokeStyle = side > 0 ? '#3a332c' : '#2a2520';
      ctx.lineWidth = 10 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hipX, bodyY + 30 * u);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, gy - 6 * u);
      ctx.stroke();
      ctx.fillStyle = BRASS;
      ctx.beginPath();
      ctx.arc(kneeX, kneeY, 6 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2520';
      ctx.fillRect(footX - 15 * u, gy - 8 * u, 30 * u, 8 * u);
    }
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#4a3c30';
    ctx.beginPath();
    ctx.roundRect(-58 * u, bodyY - 32 * u, 116 * u, 64 * u, 16 * u);
    ctx.fill();
    ctx.fillStyle = BRASS;
    for (let k = 0; k < 4; k++) ctx.fillRect(-58 * u + k * 31 * u, bodyY - 32 * u, 3 * u, 64 * u);
    ctx.fillStyle = 'rgba(255,220,160,0.25)';
    for (let k = 0; k < 10; k++) ctx.fillRect(-52 * u + k * 11 * u, bodyY - 26 * u, 1.2 * u, 1.2 * u);
    ctx.fillStyle = '#1a1412';
    ctx.fillRect(-38 * u, bodyY - 72 * u, 18 * u, 42 * u);
    ctx.fillStyle = BRASS;
    ctx.fillRect(-40 * u, bodyY - 74 * u, 22 * u, 4 * u);
    ctx.fillStyle = WOOD;
    ctx.fillRect(28 * u, bodyY - 50 * u, 36 * u, 26 * u);
    ctx.fillStyle = '#ffc46a';
    ctx.fillRect(38 * u, bodyY - 45 * u, 20 * u, 11 * u);
    ctx.restore();
  }

  /** The deck we watch from: an iron balustrade along the bottom, a brass telescope on its tripod. */
  function foreground() {
    const y = GH - 34 * u;
    ctx.fillStyle = '#120e0b';
    ctx.fillRect(-GW, y + 18 * u, GW * 3, 40 * u);
    ctx.fillRect(-GW, y, GW * 3, 4 * u);
    ctx.fillStyle = BRASS_DK;
    ctx.fillRect(-GW, y - 1.4 * u, GW * 3, 1.6 * u);
    for (let x = 0; x < GW; x += 12 * u) {
      ctx.fillStyle = '#120e0b';
      ctx.beginPath();
      ctx.ellipse(x, y + 11 * u, 2.4 * u, 6 * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 1 * u, y + 4 * u, 2 * u, 14 * u);
    }
    const tx = world.side > 0 ? GW * 0.08 : GW * 0.92;
    ctx.save();
    ctx.translate(tx, y);
    ctx.scale(world.side > 0 ? 1 : -1, 1);
    ctx.strokeStyle = '#120e0b';
    ctx.lineWidth = 2.4 * u;
    ctx.beginPath();
    ctx.moveTo(0, -22 * u);
    ctx.lineTo(-14 * u, 0);
    ctx.moveTo(0, -22 * u);
    ctx.lineTo(14 * u, 0);
    ctx.moveTo(0, -22 * u);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.translate(0, -24 * u);
    ctx.rotate(-0.35);
    ctx.fillStyle = BRASS_DK;
    ctx.fillRect(-14 * u, -3.4 * u, 46 * u, 6.8 * u);
    ctx.fillStyle = BRASS;
    ctx.fillRect(-14 * u, -2.6 * u, 46 * u, 2 * u);
    ctx.fillRect(28 * u, -4.4 * u, 6 * u, 8.8 * u);
    ctx.restore();
  }

  // ---- the frame -----------------------------------------------------------------------------------
  function paint(t: number) {
    const Z = cam.zoom;
    const night = nightOf(world.day);
    const golden = goldenOf(world.day);
    const [skyTop, skyMid, skyLow] = skyAt(world.day);
    const storm = world.storm;
    const top = mixHex(skyTop, '#26282a', storm * 0.7);
    const mid = mixHex(skyMid, '#3e3a36', storm * 0.75);
    const low = mixHex(skyLow, '#4e4640', storm * 0.6);
    const sg = ctx.createLinearGradient(0, SY(0), 0, SY(world.GY));
    sg.addColorStop(0, top);
    sg.addColorStop(0.55, mid);
    sg.addColorStop(1, low);
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    if (night > 0.1 && storm < 0.7) {
      for (const [x, y, k] of stars) {
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + k * 2) + k * 30);
        ctx.fillStyle = `rgba(255,240,210,${(night * (0.2 + k * 0.55) * tw * (1 - storm)).toFixed(3)})`;
        ctx.fillRect(x, y, k > 0.85 ? 2 * u : 1.2 * u, k > 0.85 ? 2 * u : 1.2 * u);
      }
    }
    const sunU = (world.day - 0.25) / 0.5;
    let sunAt: [number, number] | null = null;
    if (sunU > -0.05 && sunU < 1.05) {
      const sx = GW * (0.08 + 0.84 * sunU);
      const sy = world.GY - Math.sin(Math.max(0, Math.min(1, sunU)) * Math.PI) * GH * 0.6 + GH * 0.06;
      sunAt = [sx, sy];
      glow(sx, sy, 240 * u, '#ffb060', 0.55 * (1 - storm));
      ctx.fillStyle = `rgba(255,${Math.round(226 - golden * 60)},${Math.round(170 - golden * 80)},${(0.95 * (1 - storm)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 24 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    const moonU = (((world.day + 0.5) % 1) - 0.25) / 0.5;
    if (moonU > 0 && moonU < 1 && night > 0.3) {
      const mx = GW * (0.1 + 0.8 * moonU);
      const my = world.GY - Math.sin(moonU * Math.PI) * GH * 0.6 + GH * 0.05;
      glow(mx, my, 70 * u, '#bfd8d0', night * 0.25 * (1 - storm));
      ctx.fillStyle = `rgba(236,230,210,${(night * 0.9 * (1 - storm)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 17 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = mixHex(skyTop, skyMid, 0.5);
      ctx.beginPath();
      ctx.arc(mx + 6 * u, my - 3 * u, 15 * u, 0, Math.PI * 2);
      ctx.fill();
    }
    if (world.comet) {
      const k = (world.t - world.comet.t0) / 160;
      if (k > 1) world.comet = null;
      else {
        const cx = GW * (0.05 + 0.9 * k);
        const cy = GH * (0.12 - Math.sin(k * Math.PI) * 0.04);
        const tail = ctx.createLinearGradient(cx, cy, cx - 380 * u, cy - 60 * u);
        tail.addColorStop(0, 'rgba(230,245,240,0.9)');
        tail.addColorStop(1, 'rgba(230,245,240,0)');
        ctx.strokeStyle = tail;
        ctx.lineWidth = 8 * u;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cx - 190 * u, cy - 10 * u, cx - 380 * u, cy - 60 * u);
        ctx.stroke();
        ctx.lineCap = 'butt';
        glow(cx, cy, 16 * u, '#ffffff', 0.9);
      }
    }
    const litSmoke = mixHex(mixHex(skyLow, '#fff0d0', 0.25), '#ff9a50', golden * 0.4);
    const darkSmoke = mixHex(skyMid, '#2a2018', 0.5 + storm * 0.3);
    const drawStrata = (lowOnes: boolean) => {
      for (const st of strata) {
        if (st.dark !== lowOnes) continue;
        const spr = softSprite(st.dark ? darkSmoke : litSmoke);
        const span = GW * 1.4;
        for (const [px, py, rr] of st.puffs) {
          const x = ((((px + t * (st.speed + world.wind * 0.4)) % span) + span) % span) - GW * 0.2;
          ctx.globalAlpha = (st.dark ? 0.42 : 0.35) * (0.7 + storm * 0.3) * (0.6 + world.smog * 0.6);
          ctx.drawImage(spr, x - rr * 1.6, st.y + py - rr * 0.5, rr * 3.2, rr);
        }
      }
      ctx.globalAlpha = 1;
    };
    drawStrata(false);
    if (sunAt && storm < 0.6) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * 0.5 + (k - 3) * 0.13 + Math.sin(t * 0.03 + k) * 0.02;
        const len = GH * 1.2;
        const sp = 0.025 + hash(k, 3) * 0.03;
        const lg = ctx.createLinearGradient(sunAt[0], sunAt[1], sunAt[0] + Math.cos(a) * len, sunAt[1] + Math.sin(a) * len);
        const alpha = (0.05 + golden * 0.05) * (1 - storm) * (0.6 + world.smog * 0.6);
        lg.addColorStop(0, `rgba(255,200,130,${alpha.toFixed(3)})`);
        lg.addColorStop(1, 'rgba(255,200,130,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(sunAt[0], sunAt[1]);
        ctx.lineTo(sunAt[0] + Math.cos(a - sp) * len, sunAt[1] + Math.sin(a - sp) * len);
        ctx.lineTo(sunAt[0] + Math.cos(a + sp) * len, sunAt[1] + Math.sin(a + sp) * len);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const haze = mixHex(skyLow, skyMid, 0.35);
    for (const s of world.ships) if (s.z < 0.6) drawFar(s, mixHex(haze, mixHex('#4a3c30', '#141820', night), 0.2 + s.z * 0.35));
    const skyline = mixHex(skyLow, '#2a2018', 0.5 + night * 0.25);
    for (const b of far) {
      ctx.fillStyle = skyline;
      const tp = b.base - b.floors * b.floorH;
      ctx.fillRect(b.x, tp, b.w, b.base - tp + 40 * u);
      const kind = b.seed % 6;
      if (b.kind === 'tower' && kind < 2) {
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.15, tp);
        ctx.lineTo(b.x + b.w / 2, tp - b.w * 0.8);
        ctx.lineTo(b.x + b.w * 0.85, tp);
        ctx.fill();
        ctx.fillRect(b.x + b.w / 2 - 0.5 * u, tp - b.w * 0.8 - 8 * u, u, 8 * u);
      } else if (b.kind === 'tower' || kind === 2) {
        ctx.beginPath();
        ctx.ellipse(b.x + b.w / 2, tp, b.w * 0.36, b.w * 0.34, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(b.x + b.w / 2 - 0.5 * u, tp - b.w * 0.34 - 7 * u, u, 7 * u);
      } else if (kind === 3 || kind === 5) {
        ctx.fillRect(b.x + b.w * 0.2, tp - 22 * u, 6 * u, 22 * u);
        ctx.fillRect(b.x + b.w * 0.6, tp - 16 * u, 6 * u, 16 * u);
      } else {
        ctx.beginPath();
        ctx.moveTo(b.x - u, tp);
        ctx.lineTo(b.x + b.w * 0.12, tp - 9 * u);
        ctx.lineTo(b.x + b.w * 0.88, tp - 9 * u);
        ctx.lineTo(b.x + b.w + u, tp);
        ctx.fill();
      }
      if (night > 0.1) {
        ctx.fillStyle = `rgba(255,180,90,${(night * 0.6).toFixed(3)})`;
        for (let k = 0; k < 14; k++) {
          if (hash(b.seed, k, 3) > 0.5) continue;
          ctx.fillRect(b.x + 3 * u + hash(b.seed, k) * (b.w - 6 * u), tp + 6 * u + hash(b.seed, k, 1) * (b.base - tp - 10 * u), 1.6 * u, 2 * u);
        }
      }
    }
    const hz = ctx.createLinearGradient(0, world.GY - GH * 0.5, 0, world.GY);
    hz.addColorStop(0, hexA(skyLow, 0));
    hz.addColorStop(1, hexA(skyLow, 0.6 + world.smog * 0.2));
    ctx.fillStyle = hz;
    ctx.fillRect(-GW, world.GY - GH * 0.5, GW * 3, GH * 0.5 + 2);
    for (const s of world.ships) if (s.z >= 0.6 && s.z < 0.9) drawFar(s, mixHex(haze, mixHex('#3a2e24', '#10141a', night), 0.35 + s.z * 0.3));
    drawStrata(true);
    if (!city || (world.version !== cityVersion && world.t - cityAt > 1)) paintCity();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(city!, 0, 0, GW, GH);
    moving(t);
    if (world.river !== null) {
      const ry = world.river;
      const wg = ctx.createLinearGradient(0, ry, 0, GH);
      wg.addColorStop(0, mixHex(low, '#1a1612', 0.55));
      wg.addColorStop(1, mixHex(top, '#080706', 0.7));
      ctx.fillStyle = wg;
      ctx.fillRect(-GW, ry, GW * 3, GH - ry + 200 * u);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-GW, ry, GW * 3, GH - ry + 200 * u);
      ctx.clip();
      ctx.globalAlpha = 0.3;
      ctx.translate(0, ry * 2);
      ctx.scale(1, -1);
      ctx.drawImage(city!, 0, 0, GW, GH);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,220,160,0.08)';
      ctx.lineWidth = 0.9 * u;
      for (let k = 0; k < 46; k++) {
        const y = ry + 4 * u + hash(k, 7) * (GH - ry);
        const x = ((hash(k, 3) * GW + t * 6 * (1 + hash(k))) % (GW + 80)) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (20 + hash(k, 5) * 40) * u, y);
        ctx.stroke();
      }
      for (const b of world.boats) {
        const by = ry + 10 * u;
        ctx.save();
        ctx.translate(b.x, by);
        ctx.scale(b.dir, 1);
        ctx.fillStyle = '#1e1610';
        ctx.beginPath();
        ctx.moveTo(-38 * u, -6 * u);
        ctx.lineTo(38 * u, -6 * u);
        ctx.lineTo(32 * u, 2 * u);
        ctx.lineTo(-34 * u, 2 * u);
        ctx.fill();
        ctx.fillStyle = BRASS_DK;
        ctx.fillRect(-38 * u, -7 * u, 76 * u, 1.2 * u);
        if (b.kind === 'paddle') {
          ctx.fillStyle = '#d8c8a0';
          ctx.fillRect(-20 * u, -15 * u, 34 * u, 9 * u);
          ctx.fillStyle = '#5c1a14';
          ctx.fillRect(-4 * u, -30 * u, 7 * u, 15 * u);
          ctx.fillStyle = BRASS;
          ctx.fillRect(-5 * u, -31 * u, 9 * u, 2 * u);
          ctx.strokeStyle = '#3a2a1c';
          ctx.lineWidth = 1.2 * u;
          ctx.beginPath();
          ctx.arc(-26 * u, -4 * u, 8 * u, 0, Math.PI * 2);
          for (let k = 0; k < 4; k++) {
            const a = t * 2 + (k * Math.PI) / 4;
            ctx.moveTo(-26 * u + Math.cos(a) * 8 * u, -4 * u + Math.sin(a) * 8 * u);
            ctx.lineTo(-26 * u - Math.cos(a) * 8 * u, -4 * u - Math.sin(a) * 8 * u);
          }
          ctx.stroke();
        } else {
          ctx.fillStyle = '#3a2a1c';
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(-20 * u + k * 18 * u, -6 * u, 7 * u, Math.PI, 0);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }
    walker();
    for (const s of world.ships) if (s.z >= 0.9) drawShip(s, t);
    for (const f of world.fliers) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.scale(f.vx < 0 ? -1 : 1, 1);
      if (f.kind === 'kite') {
        ctx.fillStyle = '#7f1d1d';
        ctx.beginPath();
        ctx.moveTo(0, -6 * u);
        ctx.lineTo(4 * u, 0);
        ctx.lineTo(0, 8 * u);
        ctx.lineTo(-4 * u, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,28,18,0.6)';
        ctx.lineWidth = 0.6 * u;
        ctx.beginPath();
        ctx.moveTo(0, 8 * u);
        for (let k = 1; k < 6; k++) ctx.lineTo(-k * 4 * u, 8 * u + Math.sin(t * 4 + k) * 2 * u + k * 2 * u);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3a2a1c';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8 * u, 3 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = BRASS;
        ctx.beginPath();
        ctx.arc(4 * u, -0.5 * u, 2 * u, 0, Math.PI * 2);
        ctx.fill();
        if (f.kind === 'ornithopter') {
          const flap = Math.sin(f.phase * 14) * 8 * u;
          ctx.fillStyle = 'rgba(216,200,160,0.8)';
          ctx.beginPath();
          ctx.moveTo(-1 * u, -1 * u);
          ctx.quadraticCurveTo(-8 * u, -6 * u - flap, -16 * u, -flap * 1.3);
          ctx.lineTo(-2 * u, 0);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = BRASS_DK;
          ctx.lineWidth = 0.6 * u;
          ctx.stroke();
        } else fanProp(0, -6 * u, 6 * u, f.phase);
      }
      ctx.restore();
    }
    ctx.strokeStyle = 'rgba(30,22,16,0.85)';
    ctx.lineWidth = 0.9 * u;
    for (const fl of world.flocks) {
      ctx.beginPath();
      for (let k = 0; k < fl.n; k++) {
        const ox = (hash(fl.seed, k) - 0.5) * (fl.scatter > 0 ? 120 : 50) * u + Math.sin(t * 1.3 + k) * 6 * u;
        const oy = (hash(fl.seed, k, 1) - 0.5) * (fl.scatter > 0 ? 70 : 24) * u + Math.cos(t * 1.1 + k) * 4 * u;
        const x = fl.x + ox;
        const y = fl.y + oy;
        const wing = Math.sin(t * 12 + k) * 2.4 * u;
        ctx.moveTo(x - 3 * u, y - wing);
        ctx.lineTo(x, y);
        ctx.lineTo(x + 3 * u, y - wing);
      }
      ctx.stroke();
    }
    for (const f of world.fx) {
      const age = world.t - f.t0;
      if (age < 0) continue;
      const k = age / f.dur;
      if (f.kind === 'smoke' || f.kind === 'steam') {
        const a = 0.5 * (1 - k) * Math.min(1, age * 3);
        const spr = softSprite(f.kind === 'steam' ? mixHex('#f2ead8', skyLow, 0.25) : mixHex(f.color, skyMid, 0.15));
        ctx.globalAlpha = a;
        ctx.drawImage(spr, f.x - f.r * 1.6, f.y - f.r * 1.6, f.r * 3.2, f.r * 3.2);
        ctx.globalAlpha = 1;
      } else if (f.kind === 'crate') {
        ctx.strokeStyle = 'rgba(30,22,16,0.8)';
        ctx.lineWidth = 0.6 * u;
        ctx.beginPath();
        ctx.moveTo(f.x + 12 * u, f.y - age * f.vy);
        ctx.lineTo(f.x + 12 * u, f.y);
        ctx.stroke();
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(f.x + 8 * u, f.y, 9 * u, 7 * u);
      } else if (f.kind === 'chute') {
        ctx.fillStyle = 'rgba(230,220,200,0.9)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * 1.6, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,28,18,0.6)';
        ctx.lineWidth = 0.5 * u;
        ctx.beginPath();
        ctx.moveTo(f.x - f.r * 1.6, f.y);
        ctx.lineTo(f.x, f.y + f.r * 2.4);
        ctx.lineTo(f.x + f.r * 1.6, f.y);
        ctx.stroke();
      } else if (f.kind === 'splash' || f.kind === 'debris') {
        ctx.fillStyle = hexA(f.color, 1 - k);
        ctx.fillRect(f.x, f.y, f.r, f.r);
      } else if (f.kind === 'bell') {
        ctx.strokeStyle = hexA(BRASS_HI, 0.6 * (1 - k));
        ctx.lineWidth = 1.2 * u;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r + (age * 40 + j * 14) * u, -Math.PI * 0.9, -Math.PI * 0.1);
          ctx.stroke();
        }
      }
    }
    if (storm > 0.15) {
      ctx.strokeStyle = `rgba(200,200,190,${(0.28 * storm).toFixed(3)})`;
      ctx.lineWidth = 0.8 * u;
      ctx.beginPath();
      for (let k = 0; k < 260 * storm; k++) {
        const x = (((hash(k, 1) * GW + t * 60 + world.wind * t) % GW) + GW) % GW;
        const y = (hash(k, 2) * GH + t * 520) % GH;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4 * u + world.wind * 0.1, y + 14 * u);
      }
      ctx.stroke();
    }
    const sm = ctx.createLinearGradient(0, world.GY - 240 * u, 0, world.GY + 40 * u);
    sm.addColorStop(0, 'rgba(110,80,50,0)');
    sm.addColorStop(1, `rgba(110,80,50,${(0.2 + world.smog * 0.3).toFixed(3)})`);
    ctx.fillStyle = sm;
    ctx.fillRect(-GW, world.GY - 240 * u, GW * 3, 280 * u);
    foreground();
    ctx.restore();

    // ---- night, and the lights in it ----
    if (night > 0.02) {
      ctx.fillStyle = `rgba(6,10,20,${(night * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      const y0 = SY(world.GY - GH * 0.4);
      const y1 = SY(world.GY);
      const cg = ctx.createLinearGradient(0, y0, 0, y1);
      cg.addColorStop(0, 'rgba(255,140,60,0)');
      cg.addColorStop(1, `rgba(255,140,60,${(night * 0.14).toFixed(3)})`);
      ctx.fillStyle = cg;
      ctx.fillRect(0, y0, W, y1 - y0);
    }
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    ctx.globalCompositeOperation = 'lighter';
    if (night > 0.05 && lit) {
      ctx.globalAlpha = Math.min(1, night * 1.1);
      ctx.drawImage(lit, 0, 0, GW, GH);
      ctx.globalAlpha = 1;
    }
    for (const [fx, fy, fw, fh] of furnaces) {
      const fl = 0.75 + 0.25 * Math.sin(t * 7) * Math.sin(t * 3.1);
      glow(fx + fw / 2, fy + fh / 2, fw * 1.4, '#ff7a20', 0.55 * fl + night * 0.3);
      ctx.fillStyle = `rgba(255,${Math.round(150 + 60 * fl)},60,${(0.75 * fl).toFixed(3)})`;
      ctx.fillRect(fx, fy, fw, fh);
    }
    const nLit = Math.floor(world.lamps.length * world.lampsLit);
    for (let k = 0; k < nLit; k++) {
      const [x, y] = world.lamps[k];
      glow(x, y - 2 * u, 28 * u, '#ffb850', 0.5 * Math.max(0.3, night));
      ctx.fillStyle = 'rgba(255,226,160,0.95)';
      ctx.fillRect(x - 1.6 * u, y - 3.8 * u, 3.2 * u, 3.2 * u);
    }
    for (const m of world.masts) {
      if (m.built < 1) continue;
      if (Math.floor(t * 1.2 + m.id) % 2 === 0) glow(m.x, m.top - 28 * u, 20 * u, '#ff3b30', 0.5 + night * 0.4);
      if (night > 0.2) for (const f of [0.3, 0.6]) glow(m.x, m.base - (m.base - m.top) * f - 8 * u, 16 * u, '#ffb850', night * 0.6);
    }
    if (night > 0.3) {
      for (const m of world.masts.filter((x) => x.naval || x.grand)) {
        const a = -Math.PI / 2 + Math.sin(t * 0.16 + m.id * 2) * 0.85;
        const len = GH * 0.9;
        const sp = 0.07;
        const lg = ctx.createLinearGradient(m.x, m.top, m.x + Math.cos(a) * len, m.top + Math.sin(a) * len);
        lg.addColorStop(0, `rgba(255,236,190,${(0.15 * night).toFixed(3)})`);
        lg.addColorStop(1, 'rgba(255,236,190,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(m.x, m.top);
        ctx.lineTo(m.x + Math.cos(a - sp) * len, m.top + Math.sin(a - sp) * len);
        ctx.lineTo(m.x + Math.cos(a + sp) * len, m.top + Math.sin(a + sp) * len);
        ctx.fill();
      }
    }
    for (const s of world.ships) if (s.z >= 0.9) shipLights(s, t, night);
    if (night > 0.3)
      for (const s of world.ships)
        if (s.z < 0.9) {
          ctx.fillStyle = `rgba(255,200,110,${(0.6 * night).toFixed(3)})`;
          ctx.fillRect(s.x, s.y + s.len * s.z * 0.2, 1.6 * u, 1.6 * u);
        }
    for (const f of world.fx) {
      const age = world.t - f.t0;
      if (age < 0) continue;
      const k = age / f.dur;
      if (f.kind === 'fire') glow(f.x, f.y, f.r * 2.4, '#f97316', 0.6 * (1 - k));
      else if (f.kind === 'spark' || f.kind === 'firework') {
        ctx.fillStyle = hexA(f.color, (1 - k) * (f.kind === 'firework' ? 1 : 0.9));
        ctx.fillRect(f.x - f.r * u, f.y - f.r * u, f.r * 2 * u, f.r * 2 * u);
        if (f.kind === 'firework' && age < 0.25) glow(f.x, f.y, 30 * u, f.color, 0.25);
      } else if (f.kind === 'cannon') {
        ctx.fillStyle = hexA('#fde68a', 1 - k);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        if (age < 0.1) glow(f.x - f.vx * age, f.y - f.vy * age, 18 * u, '#fdba74', 0.7);
      } else if (f.kind === 'flare') {
        glow(f.x, f.y, 32 * u, '#ef4444', 0.9 * (1 - k));
        ctx.fillStyle = '#fff1f2';
        ctx.fillRect(f.x - 1.5 * u, f.y - 1.5 * u, 3 * u, 3 * u);
      }
    }
    for (const b of world.bolts) {
      const a = 1 - (world.t - b.t0) / 0.5;
      ctx.strokeStyle = `rgba(230,240,255,${a.toFixed(3)})`;
      ctx.lineWidth = 2.4 * u;
      ctx.beginPath();
      b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    const bolt = world.bolts[world.bolts.length - 1];
    if (bolt) {
      ctx.fillStyle = `rgba(225,235,250,${(0.25 * (1 - (world.t - bolt.t0) / 0.5)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // The grade: amber warmth, grain, a vignette.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(214,150,80,${(0.35 - night * 0.15).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.06;
    const pat = ctx.createPattern(grainTile(), 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(12,8,4,0)');
    vg.addColorStop(1, 'rgba(12,8,4,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    labels(t);
    hud(t, night);
  }

  const softCache = new Map<string, HTMLCanvasElement>();
  function softSprite(color: string): HTMLCanvasElement {
    const q = color.replace(/[0-9a-f]{2}/gi, (h) => Math.min(255, Math.round(parseInt(h, 16) / 12) * 12).toString(16).padStart(2, '0'));
    let c = softCache.get(q);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(q, 1));
      grad.addColorStop(0.55, hexA(q, 0.7));
      grad.addColorStop(1, hexA(q, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      softCache.set(q, c);
    }
    return c;
  }
  const glowCache = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, rad: number, color: string, a: number) {
    if (a <= 0.01) return;
    let c = glowCache.get(color);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(0.4, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glowCache.set(color, c);
    }
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(c, x - rad, y - rad, rad * 2, rad * 2);
    ctx.globalAlpha = 1;
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
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, SX(l.x)));
      let y = Math.max(96, Math.min(H - 76, SY(l.y)));
      for (let k = 0; k < 4 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 20); k++) y -= 20;
      placed.push([x, y, w]);
      const a = Math.min(1, age * 3, (6 - age) / 1.5);
      ctx.fillStyle = `rgba(18,12,8,${(0.66 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 9, y - 14, w + 18, 20);
      ctx.strokeStyle = `rgba(201,162,39,${(0.7 * a).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2 - 9 + 0.5, y - 14 + 0.5, w + 17, 19);
      ctx.fillStyle = hexA(l.color, a);
      fillCrisp(ctx, text, x, y);
    }
    ctx.textAlign = 'left';
  }

  function hud(t: number, night: number) {
    if (!o.hud) return;
    const level = 0.6 + 0.4 * host.intensity;
    const c = world.counts();
    const lines = [
      `${world.name}${world.storm > 0.5 ? ' · IN A STORM' : ''}`,
      `${SEASONS[world.season]} OF ${world.year} · ${timeWords(world.day)}`,
      `${c.ships} SHIPS ALOFT · ${c.docked} AT THE MASTS${world.cast.length ? ` · ${world.cast.join(', ').toUpperCase()}` : ''}`,
    ];
    ctx.font = SERIF(11);
    const wMax = Math.min(W - 32, Math.max(...lines.map((s) => ctx.measureText(s).width)) + 52);
    const x = 12;
    const y = 12;
    const h = 68;
    ctx.fillStyle = `rgba(16,11,7,${(0.66 + night * 0.12).toFixed(3)})`;
    ctx.fillRect(x, y, wMax, h);
    ctx.strokeStyle = hexA(BRASS, 0.9 * level);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, wMax - 1, h - 1);
    ctx.strokeStyle = hexA(BRASS, 0.4 * level);
    ctx.strokeRect(x + 3.5, y + 3.5, wMax - 7, h - 7);
    ctx.fillStyle = hexA(BRASS_HI, 0.9 * level);
    for (const [px, py] of [[x + 3, y + 3], [x + wMax - 3, y + 3], [x + 3, y + h - 3], [x + wMax - 3, y + h - 3]]) {
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x + wMax - 18, y + 18);
    ctx.rotate(t * 0.6);
    ctx.fillStyle = hexA(BRASS, 0.8 * level);
    ctx.fill(gearPath(9, 10), 'evenodd');
    ctx.restore();
    ctx.font = SERIF(16);
    ctx.fillStyle = hexA('#f3e2b8', 0.95 * level);
    fillCrisp(ctx, fitText(ctx, `BRASSWIND · ${lines[0]}`, wMax - 48), x + 12, y + 23);
    ctx.font = SERIF(11);
    ctx.fillStyle = hexA('#d9c7a0', 0.85 * level);
    fillCrisp(ctx, fitText(ctx, lines[1], wMax - 24), x + 12, y + 41);
    fillCrisp(ctx, fitText(ctx, lines[2], wMax - 24), x + 12, y + 57);
    ctx.font = SERIF(13, true);
    const ch = world.chronicle.slice(-3);
    ch.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#f3e2b8', Math.min(1, age * 2) * (i === ch.length - 1 ? 0.92 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 52 - (ch.length - 1 - i) * 18);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => framing.update(dt, world.t, world.director, W, H),
    paint: (t) => paint(t),
    ambience: () => (world.ships.some((s) => s.state === 'fight' || s.state === 'burning') || world.storm > 0.5 ? 0.9 : 0.45),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      city = null;
      lit = null;
    },
  });
}
