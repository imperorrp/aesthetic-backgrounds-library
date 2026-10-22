/**
 * Last Loop, painted: the little system as an orrery on a desk of stars.
 *
 * Back to front: the sky (baked once per size: a dust band of the page's hues, stars, two far
 * galaxies; a few bright stars twinkle); the far halves of the orbits; then every body by its
 * nearness, the sun among them at the middle: each world a lit ball from its surface map (./surface)
 * with what stands on it drawn after (the woods bristling on the limb, the village, the tower and
 * the ship on it, campfires, tornadoes and islands, thorns and the lights in the fog, shards falling
 * into the dark), the sand column between the twins, the comet's tails, the cannon, the ship and its
 * trail; the near halves of the orbits under them; meteors, the probe, notes of music, sparks; then the
 * supernova (a flash, and the shockwave crossing everything), the dark, and the waking (eyelids
 * opening on the fire); the grade; call-outs, name tags and the HUD with the loop clock.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, createGrain, runWorld, vignette, type CameraMode } from '../../../kit';
import { hash, hexA } from '../../instruments/kit';
import { drawClock, drawSubtitle, drawTitle, letter } from './words';
import { clamp01, drawCampfire, drawComet, drawHouse, drawNote, drawShip, drawStation, drawSun, drawThornBranch, drawTornado, makeGranules, mixRGB, rgbA, toRGB, type RGB } from './craft';
import { createLastLoop } from './sim';
import { mountChart } from './map';
import { buildMap, createSphere, sampleMap, type Light, type SurfaceMap } from './surface';
import type { Body, LoopWorld } from './types';

export type LoopPaintOptions = { view: string; loop: number; traffic: number; camera: string; labels: boolean; hud: boolean };

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** The sky's families: deep indigo and teal, violet and rose, ink blue and cyan, green aurora, ember dusk. */
const SKIES: { base: [string, string]; dust: [RGB, RGB] }[] = [
  { base: ['#0c1428', '#03050c'], dust: [[40, 110, 130], [70, 60, 140]] },
  { base: ['#140e26', '#04030a'], dust: [[120, 60, 140], [170, 80, 110]] },
  { base: ['#0a1630', '#02040a'], dust: [[50, 90, 170], [60, 150, 180]] },
  { base: ['#0a1820', '#02060a'], dust: [[50, 140, 110], [90, 70, 150]] },
  { base: ['#1a1018', '#060306'], dust: [[150, 80, 70], [90, 60, 120]] },
];

export function mountLastLoop(host: SkinHost, o: LoopPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  // On a tall screen the orrery is laid out wide and turned a quarter, so the orbits run down the phone.
  const turn = H > W * 1.05;
  const FW = () => (turn ? H : W);
  const FH = () => (turn ? W : H);
  const world: LoopWorld = createLastLoop(host.config.seed, FW(), FH(), { loop: o.loop, traffic: o.traffic, camera: o.camera });
  // The same system, drawn as a chart from above.
  if (o.view === 'map') return mountChart(host, world, o);
  const { GW, GH, k, cx, cy, sinE, cosE, bodies } = world;
  const mode = (o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode;
  const framing = createFraming(mode, world, { push: 1.35, closer: 2.4, maxZoom: 3.4 });
  const cam = framing.cam;
  /** A world point on the screen now. */
  const scr = (x: number, y: number): [number, number] => {
    const u = (x - cam.x) * cam.zoom;
    const v = (y - cam.y) * cam.zoom;
    return turn ? [W / 2 - v, H / 2 + u] : [W / 2 + u, H / 2 + v];
  };
  const lr = host.fork('last-loop-look');
  const tseed = Math.floor(lr() * 1e6);
  const grain = createGrain(lr);
  const phone = W < 600;

  // ---- the faces of the worlds: baked on the first paint ------------------------------------------
  let maps: SurfaceMap[] | null = null;
  const spheres = bodies.map(() => createSphere());
  const baked = bodies.map(() => ({ t: -99, R: 0 }));
  let gran: HTMLCanvasElement | null = null;
  const fallen = new Uint8Array(64);
  function ensureMaps() {
    if (maps) return;
    maps = bodies.map((b) => buildMap(b, tseed, world.shards, b.kind === 'home' ? world.village : null));
    gran = makeGranules(lr);
  }
  const sunRGB = (): RGB => toRGB(world.sun.color);
  function lightFor(b: Body): Light {
    const l = Math.hypot(b.X, b.Y, b.Z) || 1;
    const sc = sunRGB();
    const heat = world.sun.heat;
    // The orrery's licence: the light leans a little toward us, so the near worlds show a lit face
    // (crescents on the far side of the sun, half-moons in front of it) and never go black.
    const lx = -b.X / l;
    const ly = -b.Y / l + sinE * 0.75;
    const lz = -b.Z / l + cosE * 0.75;
    const ll = Math.hypot(lx, ly, lz) || 1;
    const L: Light = {
      L: [lx / ll, ly / ll, lz / ll],
      sun: [(sc[0] / 255) * 1.08, (sc[1] / 255) * 1.02, (sc[2] / 255) * 0.95],
      heat: Math.max(0.15, heat),
      ambient: [0.12, 0.13, 0.2],
    };
    if (b.kind === 'twinA') L.sandLevel = 0.1 + 0.82 * world.sand;
    if (b.kind === 'twinB') L.sandLevel = 0.1 + 0.82 * (1 - world.sand);
    if (b.kind === 'crumble') {
      for (const s of world.shards) fallen[s.id] = s.fallen ? 1 : 0;
      L.fallen = fallen;
      L.bh = 0.24;
    }
    if (b.kind === 'ocean') L.cloudSpin = world.tau * 0.035;
    if (b.kind === 'home') L.cloudSpin = world.tau * 0.02;
    return L;
  }
  /** Refresh the stalest balls (a few a frame), and any whose size changed or that a jump left behind. */
  function refreshSpheres(t: number, dpr: number) {
    const want: { i: number; R: number; stale: number; force: boolean }[] = [];
    for (const b of bodies) {
      if (b.gone || b.kind === 'comet' || b.kind === 'station') continue;
      const Rpx = Math.max(3, Math.min(170, b.R * cam.zoom * dpr));
      const Rq = Math.round(Math.pow(1.06, Math.round(Math.log(Rpx) / Math.log(1.06))) * 2) / 2;
      const bk = baked[b.id];
      const stale = t - bk.t;
      want.push({ i: b.id, R: Rq, stale, force: !spheres[b.id].canvas || bk.R !== Rq || stale > 0.6 || stale < 0 });
    }
    want.sort((a, b) => Number(b.force) - Number(a.force) || b.stale - a.stale);
    let n = 0;
    const viewY: [number, number, number] = [0, sinE, cosE];
    for (const w of want) {
      if (!w.force && (n >= 3 || w.stale < 1 / 15)) continue;
      const b = bodies[w.i];
      spheres[w.i].render(maps![w.i], w.R, sinE, cosE, b.spin, lightFor(b), viewY);
      baked[w.i] = { t, R: w.R };
      n++;
    }
  }

  // ---- the sky: baked for a size -----------------------------------------------------------------------
  let sky: HTMLCanvasElement | null = null;
  let skyKey = '';
  const stars = Array.from({ length: 900 }, () => ({ x: lr(), y: lr(), s: Math.pow(lr(), 6), c: lr() }));
  const bright = Array.from({ length: 46 }, () => ({ x: lr(), y: lr(), s: 0.6 + lr(), ph: lr() * 6, c: lr() }));
  const nebula = { ang: lr() * Math.PI, off: lr() - 0.5 };
  const SKY = SKIES[world.sky];
  const hueA = mixRGB(SKY.dust[0], toRGB(world.hues[0]), 0.2);
  const hueB = SKY.dust[1];
  function bakeSky(dpr: number) {
    const key = `${W}x${H}@${dpr}`;
    if (sky && key === skyKey) return;
    skyKey = key;
    sky = document.createElement('canvas');
    sky.width = Math.max(1, Math.round(W * dpr));
    sky.height = Math.max(1, Math.round(H * dpr));
    const g = sky.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    base.addColorStop(0, SKY.base[0]);
    base.addColorStop(1, SKY.base[1]);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // The dust band, soft blobs at low alpha, then dark lanes through it.
    const nb = document.createElement('canvas');
    nb.width = Math.max(1, Math.round(W / 4));
    nb.height = Math.max(1, Math.round(H / 4));
    const ng = nb.getContext('2d')!;
    ng.scale(nb.width / W, nb.height / H);
    const ca = Math.cos(nebula.ang);
    const sa = Math.sin(nebula.ang);
    const L = Math.hypot(W, H);
    for (let i = 0; i < 70; i++) {
      const q = lr() - 0.5;
      const off = (lr() - 0.5) * 0.18 * L + nebula.off * H * 0.4;
      const x = W / 2 + ca * q * L - sa * off;
      const y = H / 2 + sa * q * L + ca * off;
      const r = (0.06 + lr() * 0.16) * L;
      const col = mixRGB(hueA, hueB, lr());
      const gg = ng.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, rgbA(col, 0.06 + lr() * 0.08));
      gg.addColorStop(1, rgbA(col, 0));
      ng.fillStyle = gg;
      ng.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 30; i++) {
      const q = lr() - 0.5;
      const off = (lr() - 0.5) * 0.06 * L + nebula.off * H * 0.4;
      const x = W / 2 + ca * q * L - sa * off;
      const y = H / 2 + sa * q * L + ca * off;
      const r = (0.02 + lr() * 0.05) * L;
      const gg = ng.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, 'rgba(2,2,6,0.35)');
      gg.addColorStop(1, 'rgba(2,2,6,0)');
      ng.fillStyle = gg;
      ng.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(nb, 0, 0, W, H);
    // Stars: thicker in the band.
    for (const s of stars) {
      const x = s.x * W;
      const y = s.y * H;
      const band = Math.exp(-((((x - W / 2) * -sa + (y - H / 2) * ca - nebula.off * H * 0.4) / (0.12 * L)) ** 2));
      if (lr() > 0.35 + 0.65 * band) continue;
      const col = s.c < 0.2 ? [255, 210, 170] : s.c > 0.8 ? [180, 205, 255] : [235, 235, 245];
      const sz = (0.45 + s.s * 1.6) / Math.max(1, dpr * 0.75);
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${(0.25 + s.s * 0.75).toFixed(3)})`;
      g.fillRect(x, y, sz, sz);
    }
    // Two far galaxies.
    for (let i = 0; i < 2; i++) {
      const x = W * (0.1 + lr() * 0.8);
      const y = H * (0.1 + lr() * 0.8);
      const r = Math.min(W, H) * (0.02 + lr() * 0.02);
      g.save();
      g.translate(x, y);
      g.rotate(lr() * Math.PI);
      g.scale(1, 0.35);
      const gg = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gg.addColorStop(0, 'rgba(255,240,220,0.35)');
      gg.addColorStop(0.3, 'rgba(200,190,230,0.12)');
      gg.addColorStop(1, 'rgba(160,160,220,0)');
      g.fillStyle = gg;
      g.fillRect(-r, -r, r * 2, r * 2);
      g.restore();
    }
  }

  // ---- drawing the worlds ---------------------------------------------------------------------------
  let px = 1;
  let T = 0;
  const visible = (p: { c: number; x: number; y: number }, b: Body) => p.c > 0 || Math.hypot(p.x - b.x, p.y - b.y) > b.R * 1.01;
  const nightAt = (lit: number) => 1 - smooth(-0.12, 0.25, lit);
  const sunAng = (x: number, y: number) => Math.atan2(cy - y, cx - x);
  const dirOf = (nx: number, ny: number): [number, number] => {
    const l = Math.hypot(nx, ny);
    return l > 0.05 ? [nx / l, ny / l] : [0, -1];
  };

  function halo(b: Body, col: RGB, a: number, inner = 0.9, outer = 1.24) {
    const l = Math.hypot(cx - b.x, cy - b.y) || 1;
    const ox = ((cx - b.x) / l) * b.R * 0.14;
    const oy = ((cy - b.y) / l) * b.R * 0.14;
    const g = ctx.createRadialGradient(b.x + ox, b.y + oy, b.R * inner, b.x + ox, b.y + oy, b.R * outer);
    g.addColorStop(0, rgbA(col, a));
    g.addColorStop(1, rgbA(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x + ox, b.y + oy, b.R * outer, 0, TAU);
    ctx.fill();
  }

  function drawBall(b: Body) {
    const sp = spheres[b.id];
    const c = sp.canvas;
    if (!c) return;
    const R = baked[b.id].R;
    const D = c.width;
    const s = b.R / R;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(c, b.x - (D / 2) * s, b.y - (D / 2) * s, D * s, D * s);
  }

  function drawBody(b: Body) {
    if (b.gone) {
      const q = (world.t - b.burnT) / 1.6;
      if (b.burnT >= 0 && q < 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.R * (1.2 + q * 1.5));
        g.addColorStop(0, `rgba(240,248,255,${(1 - q).toFixed(3)})`);
        g.addColorStop(0.5, `rgba(170,215,255,${(0.6 * (1 - q)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(140,200,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.R * (1.2 + q * 1.5), 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      return;
    }
    if (b.kind === 'comet') return drawCometBody(b);
    if (b.kind === 'station') return drawCannon(b);
    const m = maps![b.id];
    // The air (or fog) around it, behind.
    if (b.kind === 'thorn') halo(b, [150, 175, 150], 0.2, 0.8, 1.7);
    else if (b.kind === 'shy') halo(b, [200, 185, 255], 0.3 + 0.12 * Math.sin(T * 2.3), 0.85, 1.9);
    else if (b.kind === 'cinder') halo(b, [255, 110, 50], 0.35, 0.8, 1.6);
    else if (m.atmoK > 0.3) halo(b, m.atmo as RGB, 0.32 * m.atmoK, 0.92, 1.2);
    if (b.kind === 'thorn') thornsBehind(b);
    if (b.kind === 'ocean' && world.ringed) drawRing(b, false);
    if (b.kind === 'shy') {
      ctx.globalAlpha = 0.82 + 0.18 * Math.sin(T * 3.1) * Math.sin(T * 1.7);
      drawBall(b);
      ctx.globalAlpha = 1;
    } else drawBall(b);
    if (b.kind === 'home') drawHome(b);
    if (b.kind === 'ocean') drawOcean(b);
    if (b.kind === 'ocean' && world.ringed) drawRing(b, true);
    if (b.kind === 'thorn') thornsFront(b);
    if (b.kind === 'crumble') drawCrumble(b);
    if (b.kind === 'cinder') drawCinder(b);
    if (b.kind === 'twinB') drawSandSplash(b);
    for (const camp of world.camps) if (camp.body === b.id) drawCamp(camp, b);
  }

  /** The woods on the limb: little conifers standing out against space where the ground is land. */
  function limbTrees(b: Body, n: number, kind: 'pine' | 'cactus') {
    const m = maps![b.id];
    const l = Math.hypot(b.X, b.Y, b.Z) || 1;
    for (let i = 0; i < n; i++) {
      const phi = (i / n) * TAU + hash(i, 7) * 0.03;
      const a = Math.cos(phi);
      const bb = -Math.sin(phi);
      const Nx = a;
      const Ny = bb * cosE;
      const Nz = -bb * sinE;
      const lon = Math.atan2(Nx, Nz) + b.spin;
      const lat = Math.asin(Math.max(-1, Math.min(1, Ny)));
      const sm = sampleMap(m, lon, lat);
      if (sm.wet || sm.rgb[0] + sm.rgb[1] + sm.rgb[2] > 560) continue;
      const hsh = hash(Math.floor(((lon % TAU) + TAU) % TAU * 40), Math.floor(lat * 40), b.id);
      if (hsh < 0.25) continue;
      const lit = -(Nx * b.X + Ny * b.Y + Nz * b.Z) / l;
      const shade = 0.2 + 0.8 * clamp01(lit + 0.1);
      const h = b.R * (kind === 'pine' ? 0.045 + 0.04 * hsh : 0.03 + 0.02 * hsh);
      const x = b.x + Math.cos(phi) * b.R * 0.985;
      const y = b.y + Math.sin(phi) * b.R * 0.985;
      const nx = Math.cos(phi);
      const ny = Math.sin(phi);
      const c = mixRGB([sm.rgb[0] * 0.5, sm.rgb[1] * 0.55, sm.rgb[2] * 0.5], [sm.rgb[0], sm.rgb[1], sm.rgb[2]], shade);
      ctx.fillStyle = rgbA([c[0] * shade + 6, c[1] * shade + 8, c[2] * shade + 10], 1);
      ctx.beginPath();
      ctx.moveTo(x - ny * h * 0.32, y + nx * h * 0.32);
      ctx.lineTo(x + nx * h, y + ny * h);
      ctx.lineTo(x + ny * h * 0.32, y - nx * h * 0.32);
      ctx.fill();
    }
  }

  function drawHome(b: Body) {
    limbTrees(b, phone ? 70 : 120, 'pine');
    const s = 3.1 * k;
    // The village: a cluster of houses on the rise.
    for (let i = 0; i < 7; i++) {
      const p = world.surf(b, world.village.lon + (i - 3) * 0.045 + hash(i, 1) * 0.02, world.village.lat + (hash(i, 2) - 0.5) * 0.08);
      const a = smooth(-0.04, 0.12, p.c);
      if (a <= 0) continue;
      const [nx, ny] = dirOf(p.nx, p.ny);
      const night = nightAt(p.lit);
      const lit = 0.35 + 0.65 * clamp01(p.lit + 0.1);
      ctx.globalAlpha = a;
      drawHouse(ctx, p.x, p.y, nx, ny, s * (0.8 + hash(i, 3) * 0.4), rgbA([168 * lit, 120 * lit, 74 * lit], 1), rgbA([150 * lit, 64 * lit, 40 * lit], 1), night, px);
      ctx.globalAlpha = 1;
    }
    // The launch tower: a timber lattice with a gantry.
    const p = world.surf(b, world.tower.lon, world.tower.lat);
    const a = smooth(-0.04, 0.12, p.c);
    if (a > 0) {
      const [nx, ny] = dirOf(p.nx, p.ny);
      const tx = -ny;
      const ty = nx;
      const h = b.R * 0.42;
      const w = 2.2 * k;
      const lit = 0.3 + 0.7 * clamp01(p.lit + 0.1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = rgbA([150 * lit + 20, 104 * lit + 14, 66 * lit + 10], 1);
      ctx.lineWidth = Math.max(px * 0.6, 0.7 * k);
      ctx.beginPath();
      for (const sg of [-1, 1]) {
        ctx.moveTo(p.x + tx * w * sg, p.y + ty * w * sg);
        ctx.lineTo(p.x + tx * w * 0.6 * sg + nx * h, p.y + ty * w * 0.6 * sg + ny * h);
      }
      for (let i = 0; i < 6; i++) {
        const q0 = i / 6;
        const q1 = (i + 1) / 6;
        const w0 = w * (1 - 0.4 * q0);
        const w1 = w * (1 - 0.4 * q1);
        ctx.moveTo(p.x - tx * w0 + nx * h * q0, p.y - ty * w0 + ny * h * q0);
        ctx.lineTo(p.x + tx * w1 + nx * h * q1, p.y + ty * w1 + ny * h * q1);
      }
      // The gantry arm toward the rocket.
      ctx.moveTo(p.x + tx * w * 0.6 + nx * h * 0.85, p.y + ty * w * 0.6 + ny * h * 0.85);
      ctx.lineTo(p.x + tx * w * 2.6 + nx * h * 0.85, p.y + ty * w * 2.6 + ny * h * 0.85);
      ctx.stroke();
      if (nightAt(p.lit) > 0.4 && Math.sin(T * 2.5) > 0) {
        ctx.fillStyle = 'rgba(255,90,70,0.9)';
        ctx.fillRect(p.x + nx * h - px, p.y + ny * h - px, px * 2, px * 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawOcean(b: Body) {
    // Lightning in the storms.
    const slot = Math.floor(T * 5);
    for (let i = 0; i < 2; i++) {
      if (hash(slot, i, b.id) > 0.22) continue;
      const lon = hash(slot, i + 9, 3) * TAU;
      const lat = (hash(slot, i + 11, 4) - 0.5) * 1.6;
      const p = world.surf(b, lon, lat);
      if (p.c < 0.2) continue;
      const fl = 1 - ((T * 5) % 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, b.R * 0.18);
      g.addColorStop(0, `rgba(220,235,255,${(0.7 * fl).toFixed(3)})`);
      g.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, b.R * 0.18, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Islands, on the sea or flung up into the sky.
    for (const is of world.islands) {
      const p = world.surf(b, is.lon, is.lat, is.lift);
      if (!visible(p, b)) continue;
      const a = is.lift > 0.05 ? 1 : smooth(0, 0.15, p.c);
      const [nx, ny] = is.lift > 0.05 ? dirOf(p.x - b.x, p.y - b.y) : dirOf(p.nx, p.ny);
      const s = 4.6 * k;
      const lit = 0.3 + 0.7 * clamp01(p.lit + 0.15);
      ctx.globalAlpha = a;
      if (is.lift > 0.05) {
        // Water pours off it, back toward the sea.
        const wg = ctx.createLinearGradient(p.x, p.y, p.x - nx * s * 5, p.y - ny * s * 5);
        wg.addColorStop(0, 'rgba(210,240,255,0.7)');
        wg.addColorStop(1, 'rgba(210,240,255,0)');
        ctx.strokeStyle = wg;
        ctx.lineWidth = Math.max(px * 0.8, s * 0.3);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.quadraticCurveTo(p.x - nx * s * 2 + Math.sin(T * 3) * s * 0.3, p.y - ny * s * 2, p.x - nx * s * 5, p.y - ny * s * 5);
        ctx.stroke();
        ctx.fillStyle = rgbA([90 * lit, 70 * lit, 56 * lit], 1);
        ctx.beginPath();
        ctx.moveTo(p.x - ny * s, p.y + nx * s);
        ctx.lineTo(p.x - nx * s * 1.2, p.y - ny * s * 1.2);
        ctx.lineTo(p.x + ny * s, p.y - nx * s);
        ctx.fill();
      }
      const ang = Math.atan2(ny, nx) + Math.PI / 2;
      ctx.fillStyle = rgbA([214 * lit, 196 * lit, 140 * lit], 1);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.5, ang, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgbA([70 * lit, 140 * lit, 70 * lit], 1);
      ctx.beginPath();
      ctx.ellipse(p.x + nx * s * 0.12, p.y + ny * s * 0.12, s * 0.75, s * 0.36, ang, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rgbA([30 * lit + 8, 90 * lit + 10, 46 * lit + 8], 1);
      for (let i = 0; i < 3; i++) {
        const o = (i - 1) * s * 0.4;
        const tx = -ny;
        const ty = nx;
        const bx = p.x + tx * o + nx * s * 0.2;
        const by = p.y + ty * o + ny * s * 0.2;
        ctx.beginPath();
        ctx.moveTo(bx - tx * s * 0.18, by - ty * s * 0.18);
        ctx.lineTo(bx + nx * s * 0.8, by + ny * s * 0.8);
        ctx.lineTo(bx + tx * s * 0.18, by + ty * s * 0.18);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Tornadoes.
    for (const q of world.tornadoes) {
      const p = world.surf(b, q.lon, q.lat);
      const life = Math.min(smooth(0, 4, world.t - q.born), smooth(0, 4, q.born + q.dur - world.t));
      const a = smooth(-0.2, 0.1, p.c) * life;
      if (a <= 0.02) continue;
      const [nx, ny] = dirOf(p.nx, p.ny);
      const len = Math.hypot(p.nx, p.ny);
      drawTornado(ctx, p.x, p.y, nx, ny, b.R * q.h * (0.35 + 0.65 * len), T, q.id % 97, a, clamp01(p.lit + 0.2), px);
    }
  }

  function thornsBehind(b: Body) {
    const bark = rgbA([28, 24, 20], 1);
    for (let i = 0; i < 26; i++) {
      const phi = hash(i, 31, b.id) * TAU + b.spin * 0.35;
      if (Math.sin(phi) > 0.2 && i % 2) continue;
      const len = b.R * (0.18 + hash(i, 32) * 0.34);
      drawThornBranch(ctx, b.x + Math.cos(phi) * b.R * 0.9, b.y + Math.sin(phi) * b.R * 0.9, Math.cos(phi), Math.sin(phi), len, (hash(i, 33) - 0.5) * 0.8, bark, px);
    }
  }
  function thornsFront(b: Body) {
    // Fog over the face, and the lights hunting in it.
    const g = ctx.createRadialGradient(b.x, b.y, b.R * 0.3, b.x, b.y, b.R * 1.15);
    g.addColorStop(0, 'rgba(150,175,150,0.04)');
    g.addColorStop(1, 'rgba(150,175,150,0.18)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.R * 1.15, 0, TAU);
    ctx.fill();
    const sa = sunAng(b.x, b.y);
    for (let i = 0; i < 12; i++) {
      const phi = hash(i, 41, b.id) * TAU - b.spin * 0.25;
      const facing = Math.cos(phi - sa);
      const c = rgbA([40 + 60 * clamp01(facing), 34 + 44 * clamp01(facing), 26 + 30 * clamp01(facing)], 1);
      const len = b.R * (0.12 + hash(i, 42) * 0.22);
      drawThornBranch(ctx, b.x + Math.cos(phi) * b.R * 0.96, b.y + Math.sin(phi) * b.R * 0.96, Math.cos(phi), Math.sin(phi), len, (hash(i, 43) - 0.5) * 0.9, c, px);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const phi = hash(i, 51) * TAU + T * 0.03 * (i % 2 ? 1 : -1);
      const rr = b.R * (0.7 + hash(i, 52) * 0.6);
      const x = b.x + Math.cos(phi) * rr;
      const y = b.y + Math.sin(phi) * rr * 0.8;
      const pulse = 0.5 + 0.5 * Math.sin(T * (0.8 + i * 0.3) + i);
      const g2 = ctx.createRadialGradient(x, y, 0, x, y, 6 * k);
      g2.addColorStop(0, `rgba(240,248,210,${(0.55 * pulse + 0.15).toFixed(3)})`);
      g2.addColorStop(1, 'rgba(220,240,200,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(x - 6 * k, y - 6 * k, 12 * k, 12 * k);
    }
    ctx.restore();
  }

  /** The ocean giant's ring, in the plane of the orbits: its far half behind the planet, its near half in front. */
  function drawRing(b: Body, front: boolean) {
    const bands: [number, number, RGB, number][] = [[1.42, 0.05, [200, 190, 170], 0.35], [1.55, 0.09, [222, 210, 186], 0.55], [1.7, 0.04, [170, 160, 150], 0.3], [1.86, 0.11, [210, 200, 182], 0.45], [2.02, 0.03, [190, 180, 170], 0.25]];
    const lit = 0.55 + 0.45 * world.sun.heat;
    ctx.save();
    for (const [rr, w, c, a] of bands) {
      ctx.strokeStyle = rgbA([c[0] * lit, c[1] * lit, c[2] * lit], a);
      ctx.lineWidth = b.R * w;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.R * rr, b.R * rr * sinE, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCrumble(b: Body) {
    // Where the molten rock struck: black scorches, the fresh ones still glowing.
    for (const sc of world.scorches) {
      const p = world.surf(b, sc.lon, sc.lat);
      if (p.c < 0.05) continue;
      const f = Math.sqrt(p.c);
      const age = world.t - sc.t;
      ctx.fillStyle = 'rgba(16,10,12,0.75)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, b.R * 0.09, b.R * 0.09 * f, Math.atan2(p.ny, p.nx) + Math.PI / 2, 0, TAU);
      ctx.fill();
      const ember = Math.exp(-age / 40);
      if (ember > 0.05) {
        ctx.fillStyle = `rgba(255,120,50,${(0.8 * ember).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, b.R * 0.04, b.R * 0.04 * f, 0, 0, TAU);
        ctx.fill();
      }
    }
    // Shards falling in: a slab of crust sinking toward the dark, turning as it goes.
    for (const s of world.shards) {
      if (!s.fallen) continue;
      const q = (world.t - s.fellT) / 4;
      if (q < 0 || q > 1) continue;
      const p = world.surf(b, s.lon, s.lat);
      if (p.c < 0.1) continue;
      const k2 = Math.pow(q, 1.4);
      const x = p.x + (b.x - p.x) * k2;
      const y = p.y + (b.y - p.y) * k2;
      const sz = b.R * 0.22 * (1 - q * 0.8);
      const lit = 0.3 + 0.7 * clamp01(p.lit) * (1 - q);
      ctx.fillStyle = rgbA([110 * lit, 100 * lit, 130 * lit], 1 - q * 0.6);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + q * 2 + s.id;
        const rr = sz * (0.6 + 0.4 * hash(s.id, i));
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
      }
      ctx.fill();
    }
  }
  function drawCinder(b: Body) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,150,70,0.85)';
    for (let i = 0; i < 6; i++) {
      const q = (T * 0.7 + hash(i, b.id)) % 1;
      const a = hash(i, 61) * TAU + b.spin;
      const d = b.R * (1 + q * 1.4);
      ctx.globalAlpha = 1 - q;
      ctx.fillRect(b.x + Math.cos(a) * d - px, b.y + Math.sin(a) * d - px, px * 2, px * 2);
    }
    ctx.restore();
  }
  function drawSandSplash(b: Body) {
    if (world.sand <= 0 || world.phase !== 'live') return;
    const A = bodies[world.twinA];
    const a = Math.atan2(A.y - b.y, A.x - b.x);
    const x = b.x + Math.cos(a) * b.R * 0.95;
    const y = b.y + Math.sin(a) * b.R * 0.95;
    const g = ctx.createRadialGradient(x, y, 0, x, y, b.R * 0.4);
    g.addColorStop(0, 'rgba(240,200,140,0.45)');
    g.addColorStop(1, 'rgba(240,200,140,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, b.R * 0.4, 0, TAU);
    ctx.fill();
  }

  /** The sand column: from the first twin across the gap to the second, twisting, grains running down it. */
  function drawColumn() {
    const A = bodies[world.twinA];
    const B = bodies[world.twinB];
    if (A.gone || B.gone || world.sand <= 0 || world.phase === 'wake' && world.tau < 3) return;
    const a = Math.atan2(B.y - A.y, B.x - A.x);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const x0 = A.x + ux * A.R * 0.9;
    const y0 = A.y + uy * A.R * 0.9;
    const x1 = B.x - ux * B.R * 0.92;
    const y1 = B.y - uy * B.R * 0.92;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const flow = Math.min(1, world.sand * 8);
    const lit = 0.45 + 0.55 * clamp01(Math.cos(a + Math.PI / 2 - sunAng((x0 + x1) / 2, (y0 + y1) / 2)) * 0.5 + 0.5);
    const sandC: RGB = [232 * lit, 176 * lit, 110 * lit];
    const steps = 16;
    const edge = (sg: number) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const q = i / steps;
        const w = (A.R * 0.3 * (1 - q) + B.R * 0.16 * q) * (0.55 + 0.45 * Math.abs(Math.cos(q * Math.PI))) * flow;
        const tw = Math.sin(q * 4 + T * 1.5) * A.R * 0.05;
        pts.push([x0 + (x1 - x0) * q + nx * (sg * w + tw), y0 + (y1 - y0) * q + ny * (sg * w + tw)]);
      }
      return pts;
    };
    const L1 = edge(1);
    const L2 = edge(-1);
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgbA(sandC, 0.92));
    g.addColorStop(0.5, rgbA(mixRGB(sandC, [255, 230, 190], 0.2), 0.8));
    g.addColorStop(1, rgbA(sandC, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(L1[0][0], L1[0][1]);
    for (const p of L1) ctx.lineTo(p[0], p[1]);
    for (let i = L2.length - 1; i >= 0; i--) ctx.lineTo(L2[i][0], L2[i][1]);
    ctx.fill();
    // Streaks of grains running down it.
    ctx.strokeStyle = rgbA(mixRGB(sandC, [255, 240, 210], 0.4), 0.7);
    ctx.lineWidth = Math.max(px * 0.5, 0.5 * k);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const q = (T * 0.45 + i / 14) % 1;
      const o = (hash(i, 71) - 0.5) * A.R * 0.3 * (1 - q * 0.5) * flow;
      const x = x0 + (x1 - x0) * q + nx * o;
      const y = y0 + (y1 - y0) * q + ny * o;
      ctx.moveTo(x, y);
      ctx.lineTo(x + ux * len * 0.06, y + uy * len * 0.06);
    }
    ctx.stroke();
  }

  function drawCometBody(b: Body) {
    if (world.cometCracked >= 0) {
      const pulse = 0.75 + 0.25 * Math.sin(T * 2.2);
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 14 * k);
      g.addColorStop(0, `rgba(220,170,255,${(0.9 * pulse).toFixed(3)})`);
      g.addColorStop(1, 'rgba(160,90,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 14 * k, 0, TAU);
      ctx.fill();
    }
    const d = Math.hypot(b.X, b.Z) / world.Rmax;
    const away = Math.atan2(b.y - cy, b.x - cx);
    const len = world.Rmax * (0.08 + 0.5 * Math.pow(clamp01(1 - d), 2.2)) * (world.sun.heat > 0.2 ? 1 : 0.5);
    drawComet(ctx, b.x, b.y, b.R, away, len, 0.5, T, px);
  }
  function drawCannon(b: Body) {
    const recoil = world.fired > 0 ? Math.exp(-(world.t - world.fired) * 3) : 0;
    drawStation(ctx, b.x, b.y, 7 * k, world.aim, sinE, sunAng(b.x, b.y), T, recoil, px);
  }

  function drawCamp(camp: LoopWorld['camps'][number], b: Body) {
    const p = world.surf(b, camp.lon, camp.lat, 0.01);
    const a = smooth(-0.02, 0.15, p.c);
    if (a <= 0) return;
    const [nx, ny] = dirOf(p.nx, p.ny);
    drawCampfire(ctx, p.x, p.y, nx, ny, 1.15 * k, toRGB(camp.fire), T, camp.id * 7 + 1, nightAt(p.lit), a, px);
  }

  function drawShipAll() {
    const s = world.ship;
    if (s.state === 'gone') return;
    // The trail: hot near the ship, cooling to blue smoke.
    const tr = s.trail;
    if (tr.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < tr.length; i++) {
        const age = world.t - tr[i].t;
        const q = clamp01(age / 2.6);
        ctx.strokeStyle = rgbA(mixRGB([255, 190, 110], [120, 150, 200], Math.min(1, q * 2)), (1 - q) * 0.75);
        ctx.lineWidth = Math.max(px * 0.6, (1.6 + q * 3) * k);
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
    }
    if (s.state === 'docked') {
      const p = world.surf(bodies[world.home], world.tower.lon, world.tower.lat);
      if (p.c < -0.02) return;
      const [nx, ny] = dirOf(p.nx, p.ny);
      const len = 17 * k;
      drawShip(ctx, p.x + nx * len * 0.62, p.y + ny * len * 0.62, Math.atan2(ny, nx), len, 0, sunAng(p.x, p.y), T, true, nightAt(p.lit), px);
      return;
    }
    const fallq = s.state === 'fall' ? Math.min(1, (world.t - s.t0) / 2.4) : 0;
    const len = 17 * k * (1 - fallq * 0.8);
    const sitting = s.state === 'landed' || s.state === 'wrecked' || s.state === 'land';
    const ang = s.state === 'wrecked' ? s.side + 1.2 : sitting ? s.side : s.ang;
    const ox = sitting ? Math.cos(s.side) * len * 0.45 : 0;
    const oy = sitting ? Math.sin(s.side) * len * 0.45 : 0;
    drawShip(ctx, s.x + ox, s.y + oy, ang, len, s.state === 'land' ? 0.8 : s.thrust, sunAng(s.x, s.y), T, sitting, 0, px);
  }

  function drawOrbits(front: boolean) {
    ctx.save();
    ctx.lineWidth = Math.max(px * 0.7, 0.9 * k);
    ctx.setLineDash([4 * k, 6 * k]);
    const old = world.sun.age;
    for (const b of bodies) {
      if (b.parent !== -1 || b.kind === 'twinB' || b.kind === 'comet' || b.kind === 'shy') continue;
      ctx.strokeStyle = rgbA(mixRGB([220, 196, 160], [235, 140, 110], old), front ? 0.3 : 0.18);
      ctx.beginPath();
      ctx.ellipse(cx, cy, b.a, b.a * sinE, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Small rings round the moons' hosts.
    for (const b of [bodies[world.moon], bodies[world.cinder], bodies[world.station]]) {
      const h = bodies[b.parent];
      if (h.gone) continue;
      ctx.strokeStyle = `rgba(210,200,180,${front ? 0.12 : 0.07})`;
      ctx.beginPath();
      ctx.ellipse(h.x, h.y, b.a, b.a * sinE, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFlying() {
    // Meteors.
    for (const m of world.meteors) {
      const dx = m.tx - m.sx;
      const dy = m.ty - m.sy;
      const l = Math.hypot(dx, dy) || 1;
      const tl = (m.kind === 'lava' ? 12 : 34) * k;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - (dx / l) * tl, m.y - (dy / l) * tl);
      const col: RGB = m.kind === 'lava' ? [255, 150, 70] : [220, 235, 255];
      g.addColorStop(0, rgbA(col, 0.95));
      g.addColorStop(1, rgbA(col, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(px * 0.7, (m.kind === 'lava' ? 1.8 : 1) * k);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - (dx / l) * tl, m.y - (dy / l) * tl);
      ctx.stroke();
      ctx.fillStyle = rgbA(mixRGB(col, [255, 255, 255], 0.5), 1);
      ctx.beginPath();
      ctx.arc(m.x, m.y, Math.max(px * 0.7, 1.2 * k), 0, TAU);
      ctx.fill();
    }
    // The probe and its tracer.
    for (const p of world.probes) {
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * 0.5, p.y - p.vy * 0.5);
      g.addColorStop(0, 'rgba(200,240,255,0.95)');
      g.addColorStop(1, 'rgba(120,200,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(px, 1.4 * k);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.5, p.y - p.vy * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#f0fbff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(px, 1.8 * k), 0, TAU);
      ctx.fill();
    }
    // Notes of music.
    for (const n of world.notes) {
      const age = world.t - n.t0;
      const a = Math.min(1, age * 3) * clamp01((5 - age) / 1.6) * 0.9;
      drawNote(ctx, n.x + Math.sin(age * 3 + n.kind) * 1.5 * k, n.y, 3.4 * k, n.kind, hexA(n.color, a));
    }
    // Sparks, dust, rings.
    ctx.save();
    for (const f of world.fx) {
      const q = clamp01((world.t - f.t0) / f.dur);
      const col = toRGB(f.color);
      if (f.kind === 'flash') {
        ctx.globalCompositeOperation = 'lighter';
        const r = f.r * (0.6 + q);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, rgbA([255, 255, 240], 1 - q));
        g.addColorStop(0.3, rgbA(col, 0.7 * (1 - q)));
        g.addColorStop(1, rgbA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, TAU);
        ctx.fill();
      } else if (f.kind === 'ring') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgbA(col, 0.7 * (1 - q));
        ctx.lineWidth = Math.max(px, 1.2 * k);
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, f.r * (0.2 + q), f.r * (0.2 + q) * 0.8, 0, 0, TAU);
        ctx.stroke();
      } else {
        ctx.globalCompositeOperation = 'source-over';
        const r = f.kind === 'dust' || f.kind === 'smoke' ? f.r * (0.6 + q) : f.r * (1 - q * 0.5);
        ctx.fillStyle = rgbA(col, (f.kind === 'smoke' ? 0.5 : f.kind === 'dust' ? 0.4 : 0.9) * (1 - q));
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(px * 0.5, r), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** The shockwave: a sphere of light seen as a disc with a blazing rim, its edge in the plane brightest. */
  function drawShock() {
    const S = world.sun.shock;
    if (S <= 0 || world.phase === 'wake' || world.phase === 'live') return;
    const n = world.phase === 'nova' ? world.t - world.phaseT : 16 + (world.t - world.phaseT);
    const fade = Math.exp(-n / 6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, S);
    g.addColorStop(0, `rgba(140,190,255,${(0.32 * fade).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(120,180,255,${(0.22 * fade).toFixed(3)})`);
    g.addColorStop(0.92, `rgba(190,225,255,${(0.6 * fade).toFixed(3)})`);
    g.addColorStop(0.985, `rgba(245,252,255,${(0.95 * Math.max(fade, 0.15)).toFixed(3)})`);
    g.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, S, 0, TAU);
    ctx.fill();
    // Filaments, streaming out.
    ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const a = hash(i, 81) * TAU;
      const r0 = S * (0.55 + hash(i, 82) * 0.3);
      const r1 = S * (0.98 + hash(i, 83) * 0.06);
      ctx.strokeStyle = `rgba(200,235,255,${(0.22 * Math.max(fade, 0.2)).toFixed(3)})`;
      ctx.lineWidth = Math.max(px, S * 0.006 * (1 + hash(i, 84)));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a + 0.02) * r1, cy + Math.sin(a + 0.02) * r1);
      ctx.stroke();
    }
    // Where it crosses the plane of the orbits.
    ctx.strokeStyle = `rgba(230,248,255,${(0.7 * Math.max(fade, 0.25)).toFixed(3)})`;
    ctx.lineWidth = Math.max(px * 1.5, S * 0.012);
    ctx.beginPath();
    ctx.ellipse(cx, cy, S, S * sinE, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // ---- the belt, the white hole, the eye -----------------------------------------------------------
  const spinDir = bodies[world.home].period > 0 ? 1 : -1;
  const rocks = world.belt[0] > 0
    ? Array.from({ length: phone ? 70 : 140 }, () => {
        const a = world.belt[0] + (lr() + lr() - 1) * world.belt[1];
        return { a, ph: lr() * TAU, period: (spinDir * (95 + 600 * Math.pow(a / world.Rmax, 1.5))) / TAU, s: (0.8 + Math.pow(lr(), 3) * 3.2) * k, seed: Math.floor(lr() * 1e6) };
      })
    : [];
  function drawRock(rk: (typeof rocks)[number], x: number, y: number, X: number, Z: number) {
    // Lit on the side toward the sun.
    const l = Math.hypot(X, Z) || 1;
    const lx = -X / l;
    const ly = (-Z / l) * sinE;
    const g = ctx.createLinearGradient(x - lx * rk.s, y - ly * rk.s, x + lx * rk.s, y + ly * rk.s);
    const heat = Math.max(0.2, world.sun.heat);
    g.addColorStop(0, rgbA([40, 34, 34], 1));
    g.addColorStop(1, rgbA([150 * heat + 30, 126 * heat + 24, 104 * heat + 20], 1));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + rk.seed;
      const rr = rk.s * (0.7 + 0.3 * hash(rk.seed, i));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
    }
    ctx.fill();
  }
  function drawWhiteHole(x: number, y: number) {
    const r = 6 * k;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.2, 'rgba(210,225,255,0.45)');
    g.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 5, 0, TAU);
    ctx.fill();
    // Light streaming out of it in a turning spiral.
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.strokeStyle = 'rgba(220,235,255,0.35)';
      ctx.lineWidth = Math.max(px, r * 0.3);
      ctx.beginPath();
      for (let i = 0; i <= 20; i++) {
        const q = i / 20;
        const a = arm * (TAU / 3) - T * 0.6 + q * 3.2;
        ctx.lineTo(x + Math.cos(a) * r * (0.8 + q * 3.4), y + Math.sin(a) * r * (0.8 + q * 3.4) * 0.7);
      }
      ctx.stroke();
    }
    ctx.restore();
    // The little station that watches it.
    ctx.strokeStyle = 'rgba(200,205,215,0.85)';
    ctx.lineWidth = Math.max(px, 0.9 * k);
    ctx.beginPath();
    ctx.ellipse(x + r * 4.5, y - r * 1.5, r * 0.9, r * 0.5, 0.3, 0, TAU);
    ctx.stroke();
  }
  /** Past the edge of everything: a great slow eye of light in the dark, looking back. */
  function drawEye(t: number) {
    const a = smooth(0, 0.15, world.eye) * world.eye;
    const ex = W * (W > H ? 0.8 : 0.5);
    const ey = H * (W > H ? 0.26 : 0.18);
    const R = Math.min(W, H) * 0.16;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let arm = 0; arm < 5; arm++) {
      ctx.strokeStyle = `rgba(150,170,255,${(0.16 * a).toFixed(3)})`;
      ctx.lineWidth = R * 0.08;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const q = i / 40;
        const ang = arm * (TAU / 5) + q * 4 + t * 0.05;
        ctx.lineTo(ex + Math.cos(ang) * R * (0.25 + q), ey + Math.sin(ang) * R * (0.25 + q) * 0.55);
      }
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, R * 0.45);
    g.addColorStop(0, `rgba(230,220,255,${(0.5 * a).toFixed(3)})`);
    g.addColorStop(1, 'rgba(150,140,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(ex, ey, R * 0.45, R * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(2,2,8,${(0.85 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(ex, ey, R * 0.07, R * 0.12, 0, 0, TAU);
    ctx.fill();
  }

  // ---- a frame ------------------------------------------------------------------------------------
  function paint(t: number) {
    T = t;
    const base = ctx.getTransform();
    const dpr = base.a || 1;
    ensureMaps();
    bakeSky(dpr);
    refreshSpheres(world.t, dpr);
    px = 1 / cam.zoom;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(sky!, 0, 0);
    ctx.restore();
    // A few bright stars twinkle.
    for (const s of bright) {
      const a = (0.35 + 0.35 * Math.sin(t * (0.6 + s.s) + s.ph)) * (world.phase === 'dark' ? 0.2 : 1);
      ctx.fillStyle = s.c < 0.3 ? `rgba(255,220,190,${a.toFixed(3)})` : `rgba(215,228,255,${a.toFixed(3)})`;
      const x = s.x * W;
      const y = s.y * H;
      ctx.fillRect(x - s.s * 0.6, y - 0.4, s.s * 1.2, 0.8);
      ctx.fillRect(x - 0.4, y - s.s * 0.6, 0.8, s.s * 1.2);
    }
    if (world.eye > 0) drawEye(t);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    if (turn) ctx.rotate(Math.PI / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const S = world.sun;
    const list: { d: number; draw: () => void }[] = [];
    list.push({ d: -1e9, draw: () => drawOrbits(false) });
    list.push({ d: 0.5, draw: () => drawOrbits(true) });
    const collapse = world.phase === 'collapse' ? smooth(4.6, 7, world.t - world.phaseT) : world.phase === 'nova' ? 1 : 0;
    list.push({ d: 0, draw: () => drawSun(ctx, cx, cy, { r: S.r, age: S.age, color: sunRGB(), flare: S.flare, flareAng: S.flareAng, collapse, spin: t * 0.006 }, t, gran, px) });
    for (const b of bodies) list.push({ d: b.depth, draw: () => drawBody(b) });
    if (world.belt[0] > 0 && world.phase !== 'dark')
      for (const rk of rocks) {
        const th = rk.ph + world.tau / rk.period;
        const X = Math.cos(th) * rk.a;
        const Z = Math.sin(th) * rk.a;
        if (world.sun.shock > Math.hypot(X, Z)) continue;
        list.push({ d: Z * cosE, draw: () => drawRock(rk, cx + X, cy + Z * sinE, X, Z) });
      }
    if (world.whiteHole) {
      const [wa, wr] = world.whiteHole;
      const Z = Math.sin(wa) * wr;
      list.push({ d: Z * cosE, draw: () => drawWhiteHole(cx + Math.cos(wa) * wr, cy + Z * sinE) });
    }
    const A = bodies[world.twinA];
    const B = bodies[world.twinB];
    list.push({ d: (A.depth + B.depth) / 2, draw: drawColumn });
    list.push({ d: world.ship.depth + 0.1, draw: drawShipAll });
    list.sort((a, b) => a.d - b.d);
    for (const it of list) it.draw();
    drawFlying();
    drawShock();
    ctx.restore();
    endings(t);
    grain(ctx, W, H, t, 0.045);
    vignette(ctx, W, H, 0.5);
    focus(t);
    words(t);
  }

  /** The flash, the dark, and the waking. */
  function endings(t: number) {
    const S = world.sun;
    if (world.phase === 'nova' && S.nova > 0.01) {
      ctx.fillStyle = `rgba(225,240,255,${(0.92 * S.nova).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'nova') {
      // As the light passes, the dark comes in behind it.
      const n = world.t - world.phaseT;
      ctx.fillStyle = `rgba(2,3,8,${(0.85 * smooth(8, 16, n)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'dark') {
      const n = world.t - world.phaseT;
      ctx.fillStyle = `rgba(0,0,0,${(0.85 + 0.15 * smooth(0, 2, n)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'collapse') {
      // The sky dims as the sun falls in.
      const q = smooth(0, 7, world.t - world.phaseT);
      ctx.fillStyle = `rgba(4,2,6,${(0.25 * q).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'wake' && world.tau < 5) {
      // Eyelids: closed, a first look, a blink, then open.
      const tau = world.tau;
      const open = tau < 0.8 ? 0 : tau < 1.8 ? smooth(0.8, 1.8, tau) * 0.3 : tau < 2.3 ? 0.3 - smooth(1.8, 2.3, tau) * 0.26 : 0.04 + smooth(2.4, 4.8, tau) * 1.3;
      const rx = W * (0.35 + open * 0.9);
      const ry = H * open * 0.75;
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      if (ry > 0.5) ctx.ellipse(W / 2, H / 2, rx, ry, 0, 0, TAU);
      ctx.fill('evenodd');
      if (ry > 0.5) {
        ctx.translate(W / 2, H / 2);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, rx * 0.55, 0, 0, rx);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    void t;
  }

  // ---- words ----------------------------------------------------------------------------------------
  const wo = () => ({ W, H, level: 0.6 + 0.4 * host.intensity, phone, hud: o.hud, labels: o.labels });
  function words(t: number) {
    const opts = wo();
    const cw = drawClock(ctx, world, opts);
    drawTitle(ctx, world, t, opts, cw);
    drawSubtitle(ctx, world, t, opts);
  }
  /** A ring round what the line is about, and its name hand-lettered under it. */
  function focus(t: number) {
    const s = world.sub;
    if (!s || !o.labels || s.body < 0) return;
    const b = bodies[s.body];
    if (!b || b.gone) return;
    const age = t - s.t0;
    const a = Math.min(1, age * 2.5, (s.dur - age) / 0.8);
    if (a <= 0) return;
    const [x, y] = scr(b.x, b.y);
    const R = Math.max(10, b.R * cam.zoom * (b.kind === 'station' || b.kind === 'comet' ? 3 : 1.35)) + (1 - Math.min(1, age * 2)) * 14;
    ctx.save();
    ctx.strokeStyle = `rgba(246,234,210,${(0.55 * a).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -t * 6;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.stroke();
    ctx.restore();
    letter(ctx, b.name.charAt(0).toUpperCase() + b.name.slice(1), x, Math.min(H - 90, y + R + (phone ? 16 : 19)), phone ? 13 : 15, '#f6ead2', a);
  }

  const fireAt = () => {
    const c = world.camps[0];
    const p = world.surf(bodies[world.home], c.lon, c.lat);
    return p;
  };
  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => scr(x, y),
    setCamera: (view) => {
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (turn ? [(y - H / 2) / cam.zoom + cam.x, -(x - W / 2) / cam.zoom + cam.y] : [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      const ph = world.phase;
      const fit = framing.fit(FW(), FH());
      if (ph === 'collapse' || ph === 'nova' || ph === 'dark') {
        // The end is seen whole.
        const kk = Math.min(1, dt * 1.4);
        cam.zoom += (fit - cam.zoom) * kk;
        cam.x += (GW / 2 - cam.x) * kk;
        cam.y += (GH / 2 - cam.y) * kk;
      } else {
        framing.update(dt, world.t, world.director, FW(), FH());
        if (ph === 'wake' && framing.mode !== 'still') {
          // Waking: close on the fire, then drawing back to the whole system.
          const wk = 1 - smooth(5, WAKE_END, world.tau);
          const p = fireAt();
          cam.x += (p.x - cam.x) * wk;
          cam.y += (p.y - cam.y) * wk;
          cam.zoom += (fit * 3 - cam.zoom) * wk;
        }
      }
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit };
    },
    paint: (t) => paint(t),
    ambience: () => (world.phase === 'nova' ? 1 : world.phase === 'dark' ? 0.1 : 0.4 + world.sun.age * 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
const WAKE_END = 12;
