/**
 * Windtrap, painted: a sandstone cliff cut open like a section drawing, its caves lamp-lit inside,
 * beside the open desert.
 *
 * The rock is painted once, per pixel: beds of sandstone that wave and thicken, their colours
 * drifting, desert varnish streaking down the face, the rock darkening the deeper in it lies. Into
 * it are cut the shaft, the galleries and the caves, each an arch with the shadow of its cut round
 * it, its back wall warm with lamplight, its floor and its things (rugs, cushions and hangings in
 * the hall, the brass stills, heaps of spice, the crysknives on their racks, the urns of the dead).
 * Everything that moves is drawn live over that: the water in the cistern and the light it throws,
 * the gate's doors, the garden coming into leaf, the windtrap's cowl, the people, the lamps.
 *
 * Back to front: the sky; the desert (the dune terrain of ../sandsea/terrain, in slabs, with what is
 * out on it between them: the worm, a lander, the raiders, a stranger); the storm; the rock; the
 * night on the rock's face (not in the caves); the live things; the people; the lamps; the grade;
 * call-outs and the HUD.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, typed } from '../../instruments/kit';
import { AIRS, clamp01, createDEnv, drawFolk, drawSky, drawStorm, drawThopter, drawWorm, goldenOf, hexA, mix, mk, timeWords } from '../sandsea/desert';
import { createDuneField, createTerrain, vnoise, type Terrain, type TerrainLight } from '../sandsea/terrain';
import { createWindtrap, type Chamber, type HoldWorld, type Person } from './sim';

export type HoldPaintOptions = { people: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px "Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, Georgia, serif`;
type G = CanvasRenderingContext2D;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** The sandstone's beds, light to dark. */
const BEDS = ['#c99460', '#b07444', '#d6a670', '#9a5e34', '#bd8450', '#a8683c', '#cf9c66'].map(rgb);

export function mountWindtrap(host: SkinHost, o: HoldPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: HoldWorld = createWindtrap(host.config.seed, W, H, { people: o.people, camera: o.camera });
  const { GW, GH, u, HY, floor, top, side, cx0, cx1, shaftX } = world;
  const faceX = side > 0 ? cx0 : cx1;
  const out = side > 0 ? -1 : 1;
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.3, closer: 1.9, maxZoom: 2.8 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createDEnv(ctx, u, 0.8);
  const lr = host.fork('hold-look');
  const stars = Array.from({ length: 220 }, () => [lr(), lr(), lr()] as [number, number, number]);
  const moons: [number, number] = [lr(), lr()];
  const rseed = Math.floor(lr() * 1e6);
  const tseed = Math.floor(lr() * 1e6);
  const px = (x: number, d: number) => world.xOf(x, d);
  const face = (y: number) => faceX - out * (Math.sin(y * 0.021) * 9 * u + Math.sin(y * 0.077 + 1) * 4 * u + hash(Math.round(y / 6), 2) * 3 * u);

  // ---- the desert beside the cliff ------------------------------------------------------------------
  const desertMid = side > 0 ? cx0 / 2 : (cx1 + GW) / 2;
  const field = createDuneField(tseed, u, { size: 0.8 });
  const yE = (d: number) => HY + (floor - HY) * Math.pow(1 - d, 2);
  const mE = (d: number) => 0.08 + 0.92 * Math.pow(1 - d, 2);
  const groundX = (sx: number, d: number) => desertMid + (sx - desertMid) / (0.35 + 0.65 * Math.pow(1 - d, 2));
  const dNear = 1 - Math.sqrt((GH + 20 * u - HY) / (floor - HY));
  const SLABS = [dNear, 0.08, 0.2, 0.36, 0.55, 0.75];
  const dx0 = side > 0 ? 0 : cx1 - 40 * u;
  const dx1 = side > 0 ? cx0 + 40 * u : GW;
  let terrain: Terrain | null = null;
  const lightDir = (): [number, number, number] => {
    const sk = (world.day - 0.25) / 0.5;
    const day = sk > -0.02 && sk < 1.02;
    const k = clamp01(day ? sk : (((world.day + 0.5) % 1) - 0.25) / 0.5);
    const el = Math.max(0.06, Math.min(0.5, Math.sin(k * Math.PI) * (day ? 1.15 : 0.8)));
    const x = (k - 0.5) * 1.8 * Math.cos(el) * (side > 0 ? 1 : -1);
    const y = Math.sin(el);
    const z = 0.85 * Math.cos(el);
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  };
  const terrainLight = (): TerrainLight => {
    const L = E.light;
    const gold = goldenOf(world.day);
    return {
      L: lightDir(), sand: L.sand,
      lit: mix(L.sand, L.sun, 0.22 + gold * 0.25),
      shade: mix(mix(L.sand, L.top, 0.45), L.ink, 0.5 + gold * 0.12),
      haze: mix(L.haze, L.low, 0.55),
      hazeOf: (d) => E.hazeOf(d) * 0.95,
      stains: [], bowls: [],
    };
  };
  let lightT = -99;
  let litDay = -1;
  let litStorm = 0;
  function sand() {
    const jumped = Math.abs(((world.day - litDay + 1.5) % 1) - 0.5) > 0.025 || Math.abs(world.storm - litStorm) > 0.25;
    if (!terrain || jumped) {
      terrain ??= createTerrain(field, { W: GW, x0: dx0, x1: dx1, top: HY - 60 * u, bottom: GH, res: Math.min(0.55, Math.max(0.38, 720 / GW)), dNear, yOf: yE, mOf: mE, groundX, slabs: SLABS }, mk);
      terrain.full(terrainLight());
      lightT = world.t;
      litDay = world.day;
      litStorm = world.storm;
      return;
    }
    if (world.t - lightT > 5 && terrain.work(terrainLight, Math.ceil(terrain.cols / 18))) {
      lightT = world.t;
      litDay = world.day;
      litStorm = world.storm;
    }
  }
  const slabOfD = (d: number) => {
    let k = 0;
    while (k + 1 < SLABS.length && d >= SLABS[k + 1]) k++;
    return k;
  };
  const gh = (x: number, d: number) => (terrain ? terrain.groundH(x, d) : 0);
  const py = (d: number, alt = 0, x?: number) => world.yOf(d) - (alt + (x === undefined ? 0 : gh(x, d))) * world.mOf(d);

  // ---- the rock, cut, painted once --------------------------------------------------------------------
  let rock: HTMLCanvasElement | null = null;
  /** The rock's face (not its caves), for the night to fall on. */
  let skin: HTMLCanvasElement | null = null;
  let grain: HTMLCanvasElement | null = null;
  const RES = 0.75;
  const plateau = (x: number) => top - 6 * u + Math.sin(x * 0.011) * 4 * u + (vnoise(x / (30 * u), 0, rseed) - 0.5) * 8 * u;
  function rockPath(g: G) {
    const from = side > 0 ? GW + 60 : -60;
    const brow = face(top);
    g.beginPath();
    g.moveTo(from, GH + 40);
    g.lineTo(from, plateau(from));
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const x = from + ((brow - from) * i) / n;
      g.lineTo(x, plateau(x));
    }
    for (let y = top; y <= floor + 10 * u; y += 6) g.lineTo(face(y), y);
    g.lineTo(faceX + out * 30 * u, GH + 40);
    g.closePath();
  }
  /** A cave's outline: a flat floor, walls, and an arch over. */
  function cavePath(g: G, x: number, y: number, w: number, h: number) {
    const rr = Math.min(h * 0.48, w * 0.32);
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + rr);
    g.ellipse(x + w / 2, y + rr, w / 2, rr, 0, Math.PI, Math.PI * 2);
    g.lineTo(x + w, y + h);
    g.closePath();
  }
  const tunnelH = 30 * u;
  const galleries = () =>
    world.chambers.map((ch) => {
      const gy = ch.y + ch.h;
      const a = Math.min(ch.door[0], shaftX);
      const b = Math.max(ch.door[0], shaftX);
      return [a, b, gy] as [number, number, number];
    });
  /** All the cut-out places, as one path set: caves, galleries, the shaft. */
  function cuts(g: G, fn: () => void) {
    for (const ch of world.chambers) {
      cavePath(g, ch.x, ch.y, ch.w, ch.h);
      fn();
    }
    for (const [a, b, gy] of galleries()) {
      if (b - a < 2) continue;
      cavePath(g, a - 4 * u, gy - tunnelH, b - a + 8 * u, tunnelH);
      fn();
    }
    const wt = world.chambers.find((c) => c.kind === 'windtrap')!;
    const cis = world.chambers.find((c) => c.kind === 'cistern')!;
    g.beginPath();
    g.rect(shaftX - 14 * u, wt.y + wt.h - 4 * u, 28 * u, cis.y + cis.h - (wt.y + wt.h) + 4 * u);
    fn();
  }

  function paintRock() {
    const w = Math.ceil(GW * RES);
    const h = Math.ceil(GH * RES);
    rock = mk(w, h);
    const g = rock.getContext('2d')!;
    // The rock's own colour, pixel by pixel, where the rock is.
    const mask = mk(w, h);
    const mg = mask.getContext('2d')!;
    mg.setTransform(RES, 0, 0, RES, 0, 0);
    mg.fillStyle = '#fff';
    rockPath(mg);
    mg.fill();
    const md = mg.getImageData(0, 0, w, h).data;
    const img = g.createImageData(w, h);
    const p = img.data;
    const rockW = Math.abs(cx1 - cx0);
    for (let j = 0; j < h; j++) {
      const y = j / RES;
      const fxy = face(y);
      for (let i = 0; i < w; i++) {
        const o4 = (j * w + i) * 4;
        if (md[o4 + 3] < 8) continue;
        const x = i / RES;
        // The beds: wavy, thickening down; two colours blended across each.
        const s = y + 26 * u * Math.sin(x * 0.0035 + 1.3) + (vnoise(x / (260 * u), y / (260 * u), rseed) - 0.5) * 46 * u;
        const bq = s / (15 * u + y * 0.006);
        const b0 = Math.floor(bq);
        const bf = bq - b0;
        const c0 = BEDS[((b0 % BEDS.length) + BEDS.length) % BEDS.length];
        const c1 = BEDS[(((b0 + 1) % BEDS.length) + BEDS.length) % BEDS.length];
        const k = bf * bf * (3 - 2 * bf);
        let r = lerp(c0[0], c1[0], k);
        let gg = lerp(c0[1], c1[1], k);
        let b = lerp(c0[2], c1[2], k);
        // Cross-bedding: fine slanting laminae in the thicker beds.
        const lam = Math.sin((x * 0.6 + s * 1.4) / (2.2 * u)) * 0.04 * vnoise(x / (120 * u), s / (40 * u), rseed + 3);
        // The large drift of colour, and the grain.
        const big = (vnoise(x / (520 * u), y / (420 * u), rseed + 1) - 0.5) * 0.26;
        const grit = (hash(i, j, rseed) - 0.5) * 0.07;
        // Desert varnish down the face, and the rock darker the deeper it lies from the light.
        const dist = Math.abs(x - fxy);
        const varnish = dist < 90 * u ? vnoise(x / (5 * u), y / (160 * u), rseed + 2) * (1 - dist / (90 * u)) * 0.38 : 0;
        const deep = clamp01(dist / rockW) * 0.22 + clamp01((y - top) / (floor - top)) * 0.12;
        const lit = 1 + lam + big + grit - varnish - deep;
        r *= lit;
        gg *= lit * (1 - varnish * 0.15);
        b *= lit * (1 - varnish * 0.25);
        p[o4] = Math.max(0, Math.min(255, r));
        p[o4 + 1] = Math.max(0, Math.min(255, gg));
        p[o4 + 2] = Math.max(0, Math.min(255, b));
        p[o4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    g.setTransform(RES, 0, 0, RES, 0, 0);
    // The plateau's lit edge, and the sun's side of the face.
    g.save();
    rockPath(g);
    g.clip();
    const tg = g.createLinearGradient(0, top - 10 * u, 0, top + 40 * u);
    tg.addColorStop(0, 'rgba(255,230,190,0.35)');
    tg.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = tg;
    g.fillRect(-60, top - 20 * u, GW + 120, 70 * u);
    const fg = g.createLinearGradient(faceX, 0, faceX - out * 60 * u, 0);
    fg.addColorStop(0, 'rgba(255,225,180,0.28)');
    fg.addColorStop(1, 'rgba(255,225,180,0)');
    g.fillStyle = fg;
    g.fillRect(Math.min(faceX, faceX - out * 60 * u), top, 60 * u, floor - top + 40 * u);
    // Cracks.
    g.strokeStyle = 'rgba(40,18,8,0.35)';
    g.lineWidth = 1.2 * u;
    for (let q = 0; q < 70; q++) {
      const x = Math.min(cx0, cx1) + hash(q, 1, rseed) * Math.abs(cx1 - cx0);
      const y = top + hash(q, 2, rseed) * (GH - top);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (hash(q, 3, rseed) - 0.5) * 14 * u, y + 10 * u + hash(q, 4, rseed) * 24 * u);
      g.lineTo(x + (hash(q, 5, rseed) - 0.5) * 20 * u, y + 24 * u + hash(q, 6, rseed) * 34 * u);
      g.stroke();
    }
    g.restore();
    // The cuts: the shadow round each, then the inside of it.
    g.save();
    g.shadowColor = 'rgba(30,12,4,0.85)';
    g.shadowBlur = 26 * u * RES;
    g.fillStyle = '#1c0e06';
    cuts(g, () => g.fill());
    g.restore();
    // Inside: back walls warm from the lamps, floors, the shadow under every ceiling.
    for (const [a, b, gy] of galleries()) {
      if (b - a < 2) continue;
      interior(g, a - 4 * u, gy - tunnelH, b - a + 8 * u, tunnelH, 0.75, null);
    }
    const wt = world.chambers.find((c) => c.kind === 'windtrap')!;
    const cis = world.chambers.find((c) => c.kind === 'cistern')!;
    shaft(g, wt.y + wt.h - 4 * u, cis.y + cis.h);
    for (const ch of world.chambers) interior(g, ch.x, ch.y, ch.w, ch.h, 1, ch);
    // The skin: the rock less its cuts, for the night to fall on.
    skin = mk(w, h);
    const sg = skin.getContext('2d')!;
    sg.setTransform(RES, 0, 0, RES, 0, 0);
    sg.fillStyle = '#000';
    rockPath(sg);
    sg.fill();
    sg.globalCompositeOperation = 'destination-out';
    cuts(sg, () => sg.fill());
  }
  /** The inside of a cut: a warm back wall, the shadow under the ceiling and in the corners, the floor, the room's things. */
  function interior(g: G, x: number, y: number, w: number, h: number, warm: number, ch: Chamber | null) {
    g.save();
    cavePath(g, x, y, w, h);
    g.clip();
    const bg = g.createLinearGradient(0, y, 0, y + h);
    bg.addColorStop(0, '#2e170a');
    bg.addColorStop(0.45, warm < 1 ? '#5a321a' : '#7c4626');
    bg.addColorStop(1, warm < 1 ? '#6a3c20' : '#94592f');
    g.fillStyle = bg;
    g.fillRect(x, y, w, h);
    // Lamplight pooled on the back wall.
    for (const [lx, ly] of ch?.lamps ?? [[x + w / 2, y + h * 0.4]]) {
      const lg = g.createRadialGradient(lx, ly + 6 * u, 0, lx, ly + 6 * u, Math.max(w, h) * 0.55);
      lg.addColorStop(0, `rgba(255,190,110,${(0.32 * warm).toFixed(3)})`);
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg;
      g.fillRect(x, y, w, h);
    }
    // Tool marks across the back wall.
    g.strokeStyle = 'rgba(30,12,4,0.12)';
    g.lineWidth = 1 * u;
    for (let k = 0; k < Math.floor(h / (7 * u)); k++) {
      const yy = y + 6 * u + k * 7 * u;
      g.beginPath();
      g.moveTo(x, yy + (hash(k, Math.round(x), 4) - 0.5) * 2 * u);
      g.lineTo(x + w, yy + (hash(k, Math.round(x), 5) - 0.5) * 2 * u);
      g.stroke();
    }
    if (ch) things(g, ch);
    // The cut's depth: shadow under the ceiling, down the walls, and the floor's lip catching the light.
    const cg = g.createLinearGradient(0, y, 0, y + h * 0.4);
    cg.addColorStop(0, 'rgba(14,6,2,0.75)');
    cg.addColorStop(1, 'rgba(14,6,2,0)');
    g.fillStyle = cg;
    g.fillRect(x, y, w, h * 0.4);
    for (const [ex, dir] of [[x, 1], [x + w, -1]] as const) {
      const sg = g.createLinearGradient(ex, 0, ex + dir * Math.min(24 * u, w * 0.2), 0);
      sg.addColorStop(0, 'rgba(14,6,2,0.6)');
      sg.addColorStop(1, 'rgba(14,6,2,0)');
      g.fillStyle = sg;
      g.fillRect(Math.min(ex, ex + dir * 24 * u), y, 24 * u, h);
    }
    g.fillStyle = 'rgba(255,215,160,0.22)';
    g.fillRect(x, y + h - 2.5 * u, w, 2.5 * u);
    g.restore();
  }
  function shaft(g: G, y0: number, y1: number) {
    const x = shaftX - 14 * u;
    const w = 28 * u;
    g.save();
    g.beginPath();
    g.rect(x, y0, w, y1 - y0);
    g.clip();
    const bg = g.createLinearGradient(x, 0, x + w, 0);
    bg.addColorStop(0, '#2a1408');
    bg.addColorStop(0.5, '#5a321a');
    bg.addColorStop(1, '#2a1408');
    g.fillStyle = bg;
    g.fillRect(x, y0, w, y1 - y0);
    // The stair cut into the shaft's wall, zigzagging down.
    g.strokeStyle = 'rgba(255,210,150,0.35)';
    g.lineWidth = 1.4 * u;
    g.beginPath();
    let left = true;
    for (let yy = y0 + 8 * u; yy < y1; yy += 22 * u) {
      g.moveTo(left ? x + 3 * u : x + w - 3 * u, yy);
      g.lineTo(left ? x + w - 3 * u : x + 3 * u, yy + 22 * u);
      left = !left;
    }
    g.stroke();
    g.restore();
  }
  /** What is in each room. */
  function things(g: G, ch: Chamber) {
    const { x, y, w, h, kind } = ch;
    const fy = y + h;
    const R = (k: number) => hash(ch.seed, k);
    const rug = (rx: number, rw: number, c1: string, c2: string) => {
      g.fillStyle = c1;
      g.fillRect(rx, fy - 3 * u, rw, 3 * u);
      g.fillStyle = c2;
      for (let k = 0; k < rw / (6 * u); k++) g.fillRect(rx + k * 6 * u + 1 * u, fy - 2.4 * u, 3 * u, 1.4 * u);
    };
    const hanging = (hx: number, hw: number, hh: number, c1: string, c2: string) => {
      g.fillStyle = c1;
      g.fillRect(hx, y + h * 0.22, hw, hh);
      g.fillStyle = c2;
      for (let k = 0; k < 4; k++) g.fillRect(hx, y + h * 0.22 + (k + 0.5) * (hh / 4), hw, hh * 0.06);
      g.beginPath();
      g.moveTo(hx, y + h * 0.22 + hh);
      g.lineTo(hx + hw / 2, y + h * 0.22 + hh + hw * 0.4);
      g.lineTo(hx + hw, y + h * 0.22 + hh);
      g.fillStyle = c1;
      g.fill();
    };
    const RED = '#8a2a1e';
    const INDIGO = '#2a3462';
    const OCHRE = '#b88a2a';
    const TEAL = '#2a6a64';
    if (kind === 'hall') {
      // Carved pillars, hangings between, a dais and long rugs and cushions.
      const n = Math.max(3, Math.floor(w / (70 * u)));
      for (let k = 0; k <= n; k++) {
        const cx = x + (k / n) * w;
        if (k === 0 || k === n) continue;
        g.fillStyle = '#a8703e';
        g.fillRect(cx - 5 * u, y + h * 0.18, 10 * u, h * 0.82);
        g.fillStyle = 'rgba(255,220,170,0.25)';
        g.fillRect(cx - 5 * u, y + h * 0.18, 3 * u, h * 0.82);
        g.fillStyle = '#8a5a30';
        g.fillRect(cx - 8 * u, y + h * 0.16, 16 * u, 5 * u);
      }
      for (let k = 0; k < n; k++) {
        const hx = x + ((k + 0.5) / n) * w - 9 * u;
        hanging(hx, 18 * u, h * 0.34, [RED, INDIGO, OCHRE, TEAL][k % 4], [OCHRE, RED, INDIGO, OCHRE][k % 4]);
      }
      rug(x + w * 0.06, w * 0.88, RED, OCHRE);
      g.fillStyle = '#6a4024';
      g.fillRect(x + w * 0.42, fy - 9 * u, w * 0.16, 6 * u);
      for (let k = 0; k < 10; k++) {
        g.fillStyle = [RED, INDIGO, OCHRE, TEAL][k % 4];
        g.beginPath();
        g.ellipse(x + w * (0.1 + k * 0.085), fy - 4.5 * u, 4 * u, 2.2 * u, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else if (kind === 'cell') {
      rug(x + w * 0.1, w * 0.5, [RED, INDIGO, TEAL][Math.floor(R(1) * 3)], OCHRE);
      g.fillStyle = '#5a3a22';
      g.fillRect(x + w * 0.68, fy - 9 * u, w * 0.18, 9 * u);
      g.fillStyle = 'rgba(255,220,170,0.2)';
      g.fillRect(x + w * 0.68, fy - 9 * u, w * 0.18, 1.5 * u);
      // A curtain at the door.
      const dx = ch.door[0] < x + w / 2 ? x : x + w - 8 * u;
      g.fillStyle = [INDIGO, RED, TEAL][Math.floor(R(2) * 3)];
      g.fillRect(dx, y + h * 0.3, 8 * u, h * 0.7);
    } else if (kind === 'kitchen') {
      g.fillStyle = '#2a160a';
      g.beginPath();
      g.arc(x + w * 0.25, fy, 18 * u, Math.PI, 0);
      g.fill();
      g.fillStyle = '#6a4024';
      g.fillRect(x + w * 0.5, y + h * 0.4, w * 0.42, 2.5 * u);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = k % 2 ? '#8a5a30' : '#a8703e';
        g.beginPath();
        g.ellipse(x + w * (0.54 + k * 0.08), y + h * 0.4 - 5 * u, 4.5 * u, 5 * u, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = '#5a7a3a';
      g.lineWidth = 1.5 * u;
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.moveTo(x + w * (0.55 + k * 0.1), y + h * 0.2);
        g.lineTo(x + w * (0.55 + k * 0.1), y + h * 0.3);
        g.stroke();
      }
    } else if (kind === 'stills') {
      // Brass stills, round and shining, with their pipes; a rack of glass.
      for (let k = 0; k < 3; k++) {
        const sx = x + w * (0.2 + k * 0.28);
        const r = Math.min(16 * u, h * 0.24);
        const bg2 = g.createRadialGradient(sx - r * 0.35, fy - r * 1.3, r * 0.1, sx, fy - r, r);
        bg2.addColorStop(0, '#ffe6a0');
        bg2.addColorStop(0.45, '#c8902e');
        bg2.addColorStop(1, '#6a4410');
        g.fillStyle = bg2;
        g.beginPath();
        g.arc(sx, fy - r, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#b88030';
        g.lineWidth = 2 * u;
        g.beginPath();
        g.moveTo(sx, fy - r * 2);
        g.quadraticCurveTo(sx, y + h * 0.15, sx + w * 0.14, y + h * 0.2);
        g.stroke();
      }
      for (let k = 0; k < 6; k++) {
        g.fillStyle = 'rgba(120,190,220,0.55)';
        g.fillRect(x + w * 0.1 + k * 7 * u, y + h * 0.3, 4 * u, 7 * u);
      }
    } else if (kind === 'spice') {
      // Heaps of spice in baskets; sacks.
      for (let k = 0; k < 4; k++) {
        const sx = x + w * (0.14 + k * 0.24);
        const r = Math.min(18 * u, w * 0.1);
        g.fillStyle = '#5a3a1c';
        g.fillRect(sx - r, fy - r * 0.6, r * 2, r * 0.6);
        const sg = g.createRadialGradient(sx, fy - r * 0.9, 0, sx, fy - r * 0.6, r * 1.2);
        sg.addColorStop(0, '#ff9a40');
        sg.addColorStop(1, '#a8481a');
        g.fillStyle = sg;
        g.beginPath();
        g.ellipse(sx, fy - r * 0.6, r * 0.95, r * 0.7, 0, Math.PI, 0);
        g.fill();
      }
    } else if (kind === 'school') {
      g.strokeStyle = 'rgba(240,220,190,0.6)';
      g.lineWidth = 2 * u;
      g.beginPath();
      for (let k = 0; k <= 14; k++) g.lineTo(x + 12 * u + (k / 14) * (w - 24 * u), y + h * 0.34 + Math.sin(k * 0.7) * 8 * u);
      g.stroke();
      g.beginPath();
      g.arc(x + w - 12 * u, y + h * 0.34 + Math.sin(14 * 0.7) * 8 * u, 7 * u, 0, Math.PI * 2);
      g.stroke();
      for (let k = 0; k < 5; k++) rug(x + 10 * u + k * ((w - 20 * u) / 5), (w - 20 * u) / 5 - 4 * u, [INDIGO, TEAL, RED][k % 3], OCHRE);
    } else if (kind === 'armoury') {
      // Crysknives in a rack, milk-white and curved; maker hooks; shields.
      for (let k = 0; k < 6; k++) {
        const kx = x + w * 0.12 + k * 9 * u;
        g.strokeStyle = '#efe8d8';
        g.lineWidth = 2.2 * u;
        g.beginPath();
        g.moveTo(kx, y + h * 0.5);
        g.quadraticCurveTo(kx + 4 * u, y + h * 0.35, kx + 1 * u, y + h * 0.22);
        g.stroke();
        g.fillStyle = '#4a2a14';
        g.fillRect(kx - 1.5 * u, y + h * 0.5, 3 * u, 6 * u);
      }
      g.strokeStyle = '#8a6a40';
      g.lineWidth = 2 * u;
      for (let k = 0; k < 3; k++) {
        const hx = x + w * (0.62 + k * 0.1);
        g.beginPath();
        g.moveTo(hx, fy);
        g.lineTo(hx, y + h * 0.3);
        g.quadraticCurveTo(hx + 1 * u, y + h * 0.22, hx + 7 * u, y + h * 0.26);
        g.stroke();
      }
    } else if (kind === 'tomb') {
      // Niches of urns, a slab, candles.
      for (let r2 = 0; r2 < 2; r2++)
        for (let k = 0; k < Math.floor(w / (16 * u)); k++) {
          const ux = x + 10 * u + k * 16 * u;
          const uy = y + h * (0.32 + r2 * 0.28);
          g.fillStyle = '#2a140a';
          g.fillRect(ux - 5 * u, uy - 6 * u, 10 * u, 12 * u);
          g.fillStyle = '#c8a880';
          g.beginPath();
          g.ellipse(ux, uy + 2 * u, 3.5 * u, 4.5 * u, 0, 0, Math.PI * 2);
          g.fill();
        }
      g.fillStyle = '#a08060';
      g.fillRect(x + w * 0.3, fy - 8 * u, w * 0.4, 8 * u);
    } else if (kind === 'store') {
      for (let k = 0; k < Math.floor(w / (15 * u)); k++) {
        const jx = x + 10 * u + k * 15 * u;
        g.fillStyle = k % 3 ? '#9a6a3a' : '#7a5230';
        g.beginPath();
        g.ellipse(jx, fy - 9 * u, 6 * u, 9 * u, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,220,170,0.25)';
        g.fillRect(jx - 4 * u, fy - 15 * u, 2 * u, 8 * u);
      }
    } else if (kind === 'lookout') {
      // The window cut through to the outside.
      g.fillStyle = 'rgba(220,200,170,0.5)';
      const wx = side > 0 ? x : x + w - 12 * u;
      g.fillRect(wx, y + h * 0.3, 12 * u, h * 0.4);
    } else if (kind === 'windtrap') {
      // The condensing vanes, the copper coils, the drip pan.
      g.fillStyle = 'rgba(20,10,4,0.5)';
      for (let k = 0; k < 6; k++) g.fillRect(x + 12 * u, y + h * 0.2 + k * (h * 0.1), w - 24 * u, h * 0.04);
      g.strokeStyle = '#b87333';
      g.lineWidth = 2.4 * u;
      g.beginPath();
      for (let k = 0; k < 8; k++) {
        const cx = x + w * 0.2 + k * (w * 0.6 / 7);
        g.moveTo(cx, y + h * 0.2);
        g.lineTo(cx, y + h * 0.78);
      }
      g.stroke();
      g.fillStyle = '#8a6a40';
      g.fillRect(x + w * 0.15, fy - 6 * u, w * 0.7, 4 * u);
    } else if (kind === 'garden') {
      for (let k = 0; k < 4; k++) {
        g.fillStyle = '#4a2c18';
        g.fillRect(x + w * (0.08 + k * 0.23), fy - 7 * u, w * 0.18, 7 * u);
      }
    } else if (kind === 'cistern') {
      // Steps down into the basin.
      g.fillStyle = '#8a5a34';
      for (let k = 0; k < 4; k++) g.fillRect(x + k * 6 * u, y + h * (0.3 + k * 0.12), 8 * u, h);
    } else if (kind === 'gate') {
      g.fillStyle = 'rgba(255,220,170,0.1)';
      g.fillRect(x, y, w, h);
    }
  }

  // ---- the live parts of the hold ---------------------------------------------------------------------
  function drawLive(t: number) {
    const lit = world.lamps;
    const gate = world.chambers.find((c) => c.kind === 'gate')!;
    const cis = world.chambers.find((c) => c.kind === 'cistern')!;
    // The cistern's water: its level, its surface, the light it throws on the walls.
    const level = clamp01(world.water / world.capacity);
    const wy = cis.y + cis.h - 4 * u - (cis.h - 22 * u) * level;
    ctx.save();
    cavePath(ctx, cis.x, cis.y, cis.w, cis.h);
    ctx.clip();
    const wg = ctx.createLinearGradient(0, wy, 0, cis.y + cis.h);
    wg.addColorStop(0, hexA('#3a8aa8', 0.92));
    wg.addColorStop(1, hexA('#0a2a3a', 0.97));
    ctx.fillStyle = wg;
    ctx.fillRect(cis.x + 30 * u, wy, cis.w - 34 * u, cis.y + cis.h - wy);
    ctx.globalCompositeOperation = 'lighter';
    // Caustics on the wall above the water.
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = hexA('#7ad0f0', (0.08 + 0.06 * Math.sin(t * 1.3 + k)) * (0.5 + 0.5 * lit));
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      for (let xx = cis.x + 30 * u; xx <= cis.x + cis.w; xx += 6) {
        const yy = wy - 8 * u - k * 7 * u + Math.sin(xx * 0.06 + t * (1.2 + k * 0.2) + k) * 3 * u;
        if (xx === cis.x + 30 * u) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = hexA('#bfe8f8', 0.6 * lit + 0.15);
    ctx.lineWidth = Math.max(0.6, 1.2 * u);
    ctx.beginPath();
    for (let xx = cis.x + 30 * u; xx <= cis.x + cis.w - 4 * u; xx += 6) ctx.lineTo(xx, wy + Math.sin(xx * 0.08 + t * 2) * 1.2 * u);
    ctx.stroke();
    ctx.fillStyle = hexA('#f0e0c0', 0.4);
    for (let k = 1; k < 8; k++) ctx.fillRect(cis.x + cis.w - 12 * u, cis.y + cis.h - 4 * u - ((cis.h - 22 * u) * k) / 8, (k % 4 === 0 ? 10 : 5) * u, 1 * u);
    // The gate's doors and the sand drifted in.
    const dw = gate.w * 0.5;
    const open = world.gate;
    const doorX = side > 0 ? gate.x : gate.x + gate.w;
    for (const s of [0, 1]) {
      const dx = doorX - out * s * 10 * u - out * open * dw * 0.85 * (s ? 1 : 0.5);
      ctx.fillStyle = '#4a2c18';
      ctx.fillRect(dx - 5 * u, gate.y + gate.h * 0.2, 10 * u, gate.h * 0.8);
      ctx.fillStyle = hexA('#c89a4a', 0.6);
      for (let k = 0; k < 4; k++) ctx.fillRect(dx - 3 * u, gate.y + gate.h * 0.3 + k * gate.h * 0.16, 6 * u, 2 * u);
    }
    if (world.gateSand > 0.02) {
      ctx.fillStyle = E.tone(E.light.sand, 0, 0.3);
      ctx.beginPath();
      const gx = doorX;
      ctx.moveTo(gx, gate.y + gate.h);
      ctx.lineTo(gx, gate.y + gate.h - gate.h * 0.6 * world.gateSand);
      ctx.quadraticCurveTo(gx - out * gate.w * 0.3 * world.gateSand, gate.y + gate.h - gate.h * 0.3 * world.gateSand, gx - out * gate.w * 0.7 * world.gateSand, gate.y + gate.h);
      ctx.fill();
    }
    // The garden's green, and the daylight down its shaft.
    const gd = world.chambers.find((c) => c.kind === 'garden');
    if (gd) {
      const day = 1 - E.night;
      if (day > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, gd.y, 0, gd.y + gd.h);
        lg.addColorStop(0, hexA('#fff0c8', 0.35 * day));
        lg.addColorStop(1, hexA('#fff0c8', 0.05 * day));
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(gd.x + gd.w * 0.42, gd.y);
        ctx.lineTo(gd.x + gd.w * 0.58, gd.y);
        ctx.lineTo(gd.x + gd.w * 0.75, gd.y + gd.h);
        ctx.lineTo(gd.x + gd.w * 0.3, gd.y + gd.h);
        ctx.fill();
        ctx.restore();
      }
      const k = Math.max(0.15, world.garden);
      for (let q = 0; q < 12; q++) {
        const px0 = gd.x + 8 * u + (q / 12) * (gd.w - 16 * u);
        const h = (8 + hash(q, 3) * 26) * u * k;
        ctx.strokeStyle = hexA(mix('#3a7a2a', '#9ad06a', hash(q, 4)), 0.95);
        ctx.lineWidth = Math.max(0.8, 2 * u);
        ctx.beginPath();
        ctx.moveTo(px0, gd.y + gd.h - 6 * u);
        ctx.quadraticCurveTo(px0 + Math.sin(t * 0.7 + q) * 3 * u, gd.y + gd.h - h * 0.6, px0 + Math.sin(t * 0.5 + q) * 5 * u, gd.y + gd.h - h);
        ctx.stroke();
        if (world.garden > 0.6 && q % 3 === 0) {
          ctx.fillStyle = hexA('#f0c0d0', (world.garden - 0.6) * 2.5);
          ctx.beginPath();
          ctx.arc(px0 + Math.sin(t * 0.5 + q) * 5 * u, gd.y + gd.h - h, 3 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    drawTower(t);
  }
  /** The windtrap on the cliff top: a tall tower of louvres, its cowl turned to the wind, two lesser fins. */
  function drawTower(t: number) {
    const base = plateau(shaftX);
    const hi = mix('#d8b080', E.light.sun, 0.3);
    const body = E.tone('#8a5a36', 0, 0.15);
    const dark = E.tone('#3a2214', 0);
    for (const [ox, th, tw] of [[-46, 90, 22], [44, 110, 24], [0, 170, 40]] as const) {
      const x = shaftX + ox * u;
      const h = th * u;
      const w = tw * u;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, base + 2 * u);
      ctx.lineTo(x - w * 0.42, base - h);
      ctx.lineTo(x + w * 0.42, base - h);
      ctx.lineTo(x + w * 0.6, base + 2 * u);
      ctx.fill();
      // The lit edge and the louvres.
      const [lx] = lightDir();
      ctx.fillStyle = hexA(hi, 0.4 * (0.4 + E.light.rim));
      ctx.fillRect(lx > 0 ? x + w * 0.2 : x - w * 0.42, base - h, w * 0.22, h);
      ctx.fillStyle = hexA(dark, 0.6);
      for (let y = base - h + 12 * u; y < base - 10 * u; y += 10 * u) ctx.fillRect(x - w * 0.34, y, w * 0.68, 3.5 * u);
      ctx.fillStyle = dark;
      ctx.fillRect(x - w * 0.5, base - h - 4 * u, w, 4 * u);
    }
    // The cowl, turned to the wind.
    const tx = shaftX;
    const tt = plateau(shaftX) - 174 * u;
    const lean = Math.max(-1, Math.min(1, world.wind / 30));
    ctx.fillStyle = E.tone('#6a4228', 0, 0.1);
    ctx.beginPath();
    ctx.moveTo(tx - 22 * u, tt);
    ctx.lineTo(tx + 22 * u, tt);
    ctx.quadraticCurveTo(tx + lean * 30 * u, tt - 34 * u, tx - lean * 26 * u, tt - 30 * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = E.tone('#1a0c06', 0);
    ctx.beginPath();
    ctx.ellipse(tx - lean * 18 * u, tt - 18 * u, 6 * u, 9 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shutters closed in a storm, or a dry wind.
    if (world.shutters > 0.02) {
      ctx.fillStyle = hexA('#2a160a', 0.85 * world.shutters);
      ctx.fillRect(tx - 16 * u, plateau(shaftX) - 160 * u, 32 * u, 150 * u * world.shutters);
    }
    // Air drawn in when the wind blows.
    if (world.trap > 0.3 && world.storm < 0.3) {
      ctx.strokeStyle = hexA('#ffffff', 0.14);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 7; k++) {
        const ph = (t * 0.6 + k * 0.17) % 1;
        const dir = world.wind > 0 ? -1 : 1;
        const x0 = tx + dir * (80 + k * 20) * u * (1 - ph) + dir * 26 * u;
        const y0 = tt + 30 * u + k * 16 * u + Math.sin(t * 2 + k) * 3 * u;
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 - dir * 20 * u, y0);
      }
      ctx.stroke();
    }
  }

  function drawPerson(p: Person) {
    const h = (p.child ? 17 : 26) * u;
    if (p.task === 'sleep' && p.state === 'in') {
      ctx.fillStyle = ['#d8b88a', '#c8a878', '#e0c8a0', '#b89a6a', '#d0b090'][p.seed % 5];
      ctx.beginPath();
      ctx.roundRect(p.x - h * 0.5, p.y - h * 0.22, h, h * 0.2, h * 0.1);
      ctx.fill();
      ctx.fillStyle = '#a8805a';
      ctx.beginPath();
      ctx.arc(p.x + p.dir * h * 0.42, p.y - h * 0.13, h * 0.09, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const crouch = p.task === 'mourn' ? 0.6 : p.task === 'guard' ? 0 : p.state === 'in' && (p.task === 'eat' || p.task === 'gather') ? 0.45 : 0;
    const saved = E.wind;
    E.wind = 0;
    // Robes in the hold's colours, lit warm by the lamps.
    drawFolk(E, p.x, p.y, h, p.dir, 0, { phase: p.ph, crouch, seed: p.seed, pack: p.task === 'guard', weapon: p.task === 'guard', child: p.child, robe: ['#d8b88a', '#c8a070', '#8a3a2a', '#3a4a7a', '#b88a4a', '#5a7a6a'][p.seed % 6] });
    E.wind = saved;
  }

  function drawOutside(t: number) {
    type D = { d: number; draw: () => void };
    const list: D[] = [];
    for (const o2 of world.outside) {
      list.push({
        d: o2.d,
        draw: () => {
          const m = world.mOf(o2.d);
          const n = o2.kind === 'stranger' ? 1 : o2.n;
          for (let k = 0; k < n; k++) {
            const gx = o2.x - o2.dir * k * 16 * u;
            const x = px(gx, o2.d);
            const y = py(o2.d, 0, gx);
            const ph = t * (o2.state === 'wait' || o2.state === 'meet' ? 0.5 : 4 + Math.sin(t * 1.3 + k) * 2) + k;
            drawFolk(E, x, y, 24 * u * m * 1.4, o2.dir, o2.d, { phase: ph, crouch: o2.kind === 'stranger' ? 0.9 : o2.state === 'wait' ? 0.3 : 0, seed: o2.seed + k, pack: true, weapon: o2.kind === 'party' });
          }
        },
      });
    }
    const c = world.craft;
    if (c) {
      list.push({
        d: c.d,
        draw: () => {
          const m = world.mOf(c.d);
          const lx = c.x + c.dir * 160 * u + Math.sin(t * 0.7) * 80 * u;
          const lamp: [number, number] | null = c.role === 'patrol' && E.night > 0.1 ? [px(lx, c.d), py(c.d, 0, lx)] : null;
          drawThopter(E, px(c.x, c.d), py(c.d, c.alt, c.x), m * 1.4, c.dir, c.d, { seed: c.seed, lit: c.role === 'patrol', beat: c.beat, landed: c.state === 'landed', lamp });
        },
      });
    }
    const wm = world.worm;
    if (wm) list.push({ d: wm.d, draw: () => drawWorm(E, { x: px(wm.x, wm.d), y: py(wm.d, 0, wm.x), m: world.mOf(wm.d) * 1.6, dir: wm.dir, pose: wm.state, k: wm.k, d: wm.d, size: wm.size, riders: wm.riders, seed: 3 }) });
    const th = world.thumper;
    if (th) {
      list.push({
        d: th.d,
        draw: () => {
          const m = world.mOf(th.d);
          const x = px(th.x, th.d);
          const y = py(th.d, 0, th.x);
          const h = 30 * u * m;
          const beat = Math.pow(Math.abs(Math.sin(t * 4)), 6);
          ctx.fillStyle = E.tone('#3a2e22', th.d);
          ctx.fillRect(x - h * 0.08, y - h, h * 0.16, h);
          ctx.strokeStyle = hexA(E.tone(E.light.sand, th.d, 0.3), 0.35 * (1 - beat));
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(x, y, h * (0.6 + beat * 1.2), h * (0.15 + beat * 0.3), 0, 0, Math.PI * 2);
          ctx.stroke();
        },
      });
    }
    const bySlab: D[][] = SLABS.map(() => []);
    for (const it of list) bySlab[slabOfD(it.d)].push(it);
    const T = terrain!;
    const tp = HY - 60 * u;
    for (let k = SLABS.length - 1; k >= 0; k--) {
      ctx.drawImage(T.canvases[k], 0, tp, GW, GH - tp);
      for (const it of bySlab[k].sort((a, b) => b.d - a.d)) it.draw();
    }
  }

  function drawFx() {
    for (const f of world.fx) {
      const age = world.t - f.t0;
      const k = age / f.dur;
      if (f.kind === 'drop') {
        ctx.fillStyle = hexA(f.color, 0.9 * (1 - k * 0.5));
        ctx.fillRect(f.x - 0.8 * u, f.y, 1.6 * u, 4 * u);
      } else if (f.kind === 'note') {
        ctx.font = SERIF(Math.round(12 * u));
        ctx.fillStyle = hexA(f.color, 1 - k);
        ctx.fillText('♪', f.x + Math.sin(age * 3) * 3 * u, f.y - age * 14 * u);
      } else if (f.kind === 'spark' || f.kind === 'glint') {
        ctx.fillStyle = hexA(f.color, 1 - k);
        ctx.fillRect(f.x - 1, f.y - 1, 2 * u, 2 * u);
      } else {
        const s = f.r * (1.5 + k * 2);
        ctx.globalAlpha = 0.4 * (1 - k);
        ctx.drawImage(E.soft(f.color), f.x - s / 2, f.y - s / 2, s, s);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawLamps(t: number) {
    const lit = world.lamps;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ch of world.chambers) {
      const warm = ch.kind === 'spice' ? '#ff8a30' : ch.kind === 'kitchen' ? '#ffa040' : ch.kind === 'tomb' ? '#c0a8ff' : '#ffc070';
      for (const [lx, ly] of ch.lamps) {
        const fl = 0.8 + 0.2 * Math.sin(t * 7 + lx) * Math.sin(t * 3.1 + ly);
        const dim = ch.kind === 'cell' && (world.day > 0.88 || world.day < 0.2) ? 0.45 : 1;
        E.glow(lx, ly + 4 * u, Math.min(ch.w, 80 * u) * 0.8, warm, 0.42 * lit * fl * dim);
        ctx.fillStyle = hexA('#fff4d0', 0.95 * lit);
        ctx.beginPath();
        ctx.arc(lx, ly, 1.8 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ch.kind === 'kitchen') E.glow(ch.x + ch.w * 0.25, ch.y + ch.h - 6 * u, 30 * u, '#ff6a20', 0.7 * (0.8 + 0.2 * Math.sin(t * 9)));
      if (ch.kind === 'spice') E.glow(ch.x + ch.w / 2, ch.y + ch.h * 0.75, ch.w * 0.6, '#ff7a20', 0.3 * lit);
      if (ch.kind === 'cistern') E.glow(ch.x + ch.w / 2, ch.y + ch.h * 0.7, ch.w * 0.55, '#4ab0e0', 0.22);
      if (ch.kind === 'stills') E.glow(ch.x + ch.w / 2, ch.y + ch.h * 0.7, ch.w * 0.45, '#ffd080', 0.15 * lit);
    }
    if (world.feast > 0) {
      const hall = world.chambers.find((c) => c.kind === 'hall')!;
      E.glow(hall.x + hall.w / 2, hall.y + hall.h / 2, hall.w * 0.7, '#ffd080', 0.3 * world.feast * lit);
    }
    ctx.restore();
    if (lit < 1) {
      ctx.fillStyle = hexA('#0a0604', 0.7 * (1 - lit));
      cuts(ctx, () => ctx.fill());
    }
  }

  // ---- the frame ------------------------------------------------------------------------------------
  function paint(t: number) {
    E.set(t, world.day, world.air, world.storm, world.wind, world.storm * 0.5);
    sand();
    if (!rock) paintRock();
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const desertX = (k: number) => (side > 0 ? cx0 * (0.1 + 0.8 * k) : cx1 + (GW - cx1) * (0.1 + 0.8 * k));
    drawSky(E, { W: GW, H: GH, horizon: HY, stars, moons, sunX: desertX, moonX: (k) => desertX(k) });
    drawOutside(t);
    drawStorm(E, GW, GH, HY, world.storm, world.xOf(world.stormFront, 0.4), world.stormDir, world.flash);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rock!, 0, 0, GW, GH);
    // The hour on the rock's face (the caves keep their own light): blue dusk, the dark of night, a storm's dust.
    const night = E.night;
    const shade = 0.62 * night + 0.25 * world.storm + goldenOf(world.day) * 0.1;
    if (shade > 0.02) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, shade);
      ctx.drawImage(tinted(night > 0.3 ? mix('#06081a', E.light.top, 0.25) : mix('#3a2010', E.light.low, 0.4)), 0, 0, GW, GH);
      ctx.restore();
    }
    drawFoot();
    drawLive(t);
    for (const p of world.people) if (p.alive && p.state !== 'out') drawPerson(p);
    drawFx();
    drawLamps(t);
    ctx.restore();
    grade(t);
    labels(t);
    hud(t);
  }
  /** The sand banked against the cliff's foot, and the boulders fallen from it, in the light of the hour. */
  function drawFoot() {
    const [lx] = lightDir();
    // A mound against the face, fading out into the dunes below and beyond it.
    const mound = new Path2D();
    mound.moveTo(faceX + out * 190 * u, floor + 40 * u);
    mound.quadraticCurveTo(faceX + out * 60 * u, floor - 4 * u, faceX - out * 8 * u, floor - 44 * u);
    mound.lineTo(faceX - out * 14 * u, floor + 70 * u);
    mound.quadraticCurveTo(faceX + out * 80 * u, floor + 80 * u, faceX + out * 190 * u, floor + 40 * u);
    const fill = ctx.createLinearGradient(0, floor - 44 * u, 0, floor + 80 * u);
    const sandC = E.tone(E.light.sand, 0.02, 0.25);
    fill.addColorStop(0, hexA(sandC, 1));
    fill.addColorStop(0.6, hexA(sandC, 0.9));
    fill.addColorStop(1, hexA(sandC, 0));
    ctx.fillStyle = fill;
    ctx.fill(mound);
    const sg = ctx.createLinearGradient(faceX - out * 8 * u, 0, faceX + out * 120 * u, 0);
    sg.addColorStop(0, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.5), 0), 0.5));
    sg.addColorStop(1, hexA(E.tone(mix(E.light.sand, E.light.ink, 0.5), 0), 0));
    ctx.fillStyle = sg;
    ctx.fill(mound);
    for (let q = 0; q < 9; q++) {
      const bx = faceX + out * (14 + hash(q, 31, rseed) * 140) * u;
      const br = (6 + hash(q, 32, rseed) * 15) * u;
      const by = floor - 4 * u + hash(q, 33, rseed) * 24 * u;
      ctx.fillStyle = E.tone(hash(q, 34, rseed) < 0.5 ? '#7a4a2c' : '#8e5a36', 0, 0.1);
      ctx.beginPath();
      ctx.moveTo(bx - br, by + 2);
      ctx.lineTo(bx - br * 0.6, by - br * 0.9);
      ctx.lineTo(bx + br * 0.5, by - br);
      ctx.lineTo(bx + br, by + 2);
      ctx.fill();
      ctx.fillStyle = hexA(E.tone('#e0b080', 0, 0.5), 0.35 * E.light.rim);
      ctx.fillRect(lx > 0 ? bx : bx - br * 0.6, by - br * 0.95, br * 0.6, br * 0.9);
    }
  }
  let tintC: HTMLCanvasElement | null = null;
  let tintKey = '';
  /** The rock's skin in one colour (cached by colour). */
  function tinted(color: string) {
    if (tintC && tintKey === color) return tintC;
    tintC ??= mk(skin!.width, skin!.height);
    const g = tintC.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, tintC.width, tintC.height);
    g.drawImage(skin!, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, tintC.width, tintC.height);
    tintKey = color;
    return tintC;
  }

  function grade(t: number) {
    if (!grain) {
      grain = mk(128, 128);
      const g = grain.getContext('2d')!;
      const img = g.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) {
        const v = 128 + (lr() - 0.5) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pat = ctx.createPattern(grain, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.06;
      const step = Math.floor(t * 10);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(20,12,6,0)');
    vg.addColorStop(1, `rgba(20,12,6,${(0.4 + E.night * 0.15).toFixed(3)})`);
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
      const x = Math.max(w / 2 + 16, Math.min(W - w / 2 - 16, SX(l.x)));
      let y = Math.max(96, Math.min(H - 80, SY(l.y)));
      for (let k = 0; k < 4 && placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 8 && Math.abs(qy - y) < 20); k++) y -= 20;
      placed.push([x, y, w]);
      const a = Math.min(1, age * 3, (6 - age) / 1.5);
      const sg = ctx.createLinearGradient(x - w / 2 - 24, 0, x + w / 2 + 24, 0);
      sg.addColorStop(0, 'rgba(12,8,4,0)');
      sg.addColorStop(0.15, `rgba(12,8,4,${(0.55 * a).toFixed(3)})`);
      sg.addColorStop(0.85, `rgba(12,8,4,${(0.55 * a).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(12,8,4,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - w / 2 - 24, y - 15, w + 48, 21);
      ctx.fillStyle = hexA(l.color, a);
      fillCrisp(ctx, text, x, y);
    }
    // The chambers' names, small, when close enough to read them.
    if (cam.zoom > framing.fit(W, H) * 1.3) {
      ctx.font = SERIF(9);
      for (const ch of world.chambers) {
        const x = SX(ch.x + ch.w / 2);
        const y = SY(ch.y) - 4;
        if (x < 0 || x > W || y < 0 || y > H) continue;
        ctx.fillStyle = hexA('#e8d8c0', 0.6);
        fillCrisp(ctx, ch.name, x, y);
      }
    }
    ctx.textAlign = 'left';
  }

  function hud(t: number) {
    if (!o.hud) return;
    const level = 0.55 + 0.45 * host.intensity;
    ctx.textAlign = 'left';
    ctx.font = SERIF(15);
    ctx.fillStyle = hexA('#f3e9d2', 0.92 * level);
    fillCrisp(ctx, fitText(ctx, `WINDTRAP · ${world.name}`, W - 32), 16, 26);
    ctx.font = SERIF(10);
    ctx.fillStyle = hexA('#cdbf9c', 0.85 * level);
    const souls = world.people.filter((p) => p.alive).length;
    const outside = world.people.filter((p) => p.alive && p.state === 'out').length;
    const litres = Math.round(world.water).toLocaleString('en-US');
    const cond = world.storm > 0.3 ? 'A SANDSTORM' : world.lamps < 1 ? 'A PATROL: EVERY LAMP OUT' : world.drought > 0 ? 'A DRY WIND' : world.feast > 0 ? 'A FEAST' : world.mourning > 0 ? 'MOURNING' : AIRS[world.air].label.toUpperCase();
    fillCrisp(ctx, fitText(ctx, `${timeWords(world.day)} · ${cond}`, W - 32), 16, 42);
    fillCrisp(ctx, fitText(ctx, `WATER: ${litres} LITRES (${Math.round((world.water / world.capacity) * 100)}% OF THE CISTERN) · ${souls} SOULS${outside ? `, ${outside} OUT ON THE SAND` : ''} · ${world.cast.map((c) => c.toUpperCase()).join(' · ')}`, W - 32), 16, 56);
    ctx.font = SERIF(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#f3e9d2', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
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
    after: (dt) => {
      framing.update(dt, world.t, world.director, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.storm > 0.3 ? 0.9 : world.feast > 0 ? 0.7 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
