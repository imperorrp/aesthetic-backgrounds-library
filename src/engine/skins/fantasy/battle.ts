/**
 * Shieldwall's mount: the battle simulation (battle-sim.ts), painted side-on.
 *
 * One frame, back to front:
 *   sky (weather, moon, stars) → mountains → hills with a keep → the treeline → the field
 *   (craters, scorch, spent arrows, the fallen) → the armies by depth, banners with their
 *   bearers → shots in flight → spells and fire → the dragon → crows → haze over the far
 *   ranks → rain or snow → call-outs → the chronicle
 *
 * The backdrop for each field is painted once into canvases and scrolled with parallax.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { forkRng } from '../../rng';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { SHIELDWALL_SCHEMA } from './index';
import { createBattleWorld, type Battle, type Effect, type Shot, type Unit } from './battle-sim';
import { buildAtlas, stamp, SHAPES, type Atlas } from './sprites';
import { DRAGONS } from './names';
import { buildScenery, layoutMap, stampProp, type MapLayout, type Placed, type SceneryAtlas } from './scenery';

export const SERIF = '"IM Fell English SC", "Cinzel", Georgia, "Times New Roman", serif';
const serif = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px ${SERIF}`;

type Sky = { top: string; mid: string; low: string; ground: [string, string]; hills: string; far: string; stars: boolean; moon: boolean; sun: string | null };
const SKIES: Record<Battle['weather'], Sky> = {
  night: { top: '#03050c', mid: '#0a1224', low: '#1b2740', ground: ['#0d140f', '#141c12'], hills: '#070b0a', far: '#101a2a', stars: true, moon: true, sun: null },
  dusk: { top: '#06060f', mid: '#1c1328', low: '#4a2430', ground: ['#16130d', '#211c12'], hills: '#0b0809', far: '#2a1a26', stars: true, moon: false, sun: '#b45309' },
  overcast: { top: '#0a0d12', mid: '#161b22', low: '#262d36', ground: ['#121610', '#1a1f16'], hills: '#0a0c0c', far: '#1c2129', stars: false, moon: false, sun: null },
  storm: { top: '#04060a', mid: '#0d1117', low: '#1a2029', ground: ['#0c100c', '#131810'], hills: '#050707', far: '#121820', stars: false, moon: false, sun: null },
  snow: { top: '#0a0e16', mid: '#1a2130', low: '#2f3848', ground: ['#3a4250', '#4b5363'], hills: '#141821', far: '#262e3c', stars: false, moon: true, sun: null },
  fog: { top: '#0b0e12', mid: '#191e24', low: '#2a3038', ground: ['#121510', '#191d16'], hills: '#13171b', far: '#20262d', stars: false, moon: true, sun: null },
  dawn: { top: '#05070f', mid: '#141a30', low: '#3b2a3c', ground: ['#11140e', '#1a1e14'], hills: '#08090b', far: '#232038', stars: true, moon: false, sun: '#c2410c' },
};

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(SHIELDWALL_SCHEMA, host.options) as { view: 'side' | 'above'; troops: number; magic: number; dragons: number; weather: string; camera: string; labels: boolean; hud: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const above = o.view === 'above';
  const world = createBattleWorld(host.config.seed, W, H, { troops: o.troops * host.config.density, magic: o.magic, dragons: o.dragons, weather: o.weather, view: o.view });
  let camX = world.battle.focusX - W / 2;
  let nextAmbience = 0;

  // What happens, out to the host (sound and the journal bind here).
  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active || e.type === 'ambience') return;
    const sx = typeof e.x === 'number' ? e.x - camX : W / 2;
    const onScreen = sx > -40 && sx < W + 40;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (sx / Math.max(1, W)) * 2 - 1)), near: onScreen ? 1 : 0.4, text: e.text, color: e.color, priority: e.priority });
  });

  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    world.step(dt);
    const b = world.battle;
    const target = o.camera === 'still' ? b.BW / 2 - W / 2 : b.focusX - W / 2;
    camX += (Math.max(-60, Math.min(b.BW - W + 60, target)) - camX) * Math.min(1, dt * 0.6);
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      host.events.emit({ type: 'ambience', weight: b.heat, pan: 0, near: 1 });
    }
  };

  // ---- cached art --------------------------------------------------------------------------

  /**
   * CSS pixels per art pixel. From above, people are smaller: about 1.4 px, rounded so an
   * art pixel is a whole number of device pixels (crisp at any device ratio).
   */
  const P = () => {
    if (!above) return H >= 1100 ? 3 : H >= 560 ? 2 : 1;
    const dpr = host.viewport.dpr || 1;
    return Math.max(1, Math.round((H >= 1000 ? 1.9 : 1.4) * dpr)) / dpr;
  };
  let atlases: { war: number; a: Atlas; b: Atlas } | null = null;
  const dragonAtlases = new Map<number, Atlas>();
  type Backdrop = {
    battle: Battle;
    W: number;
    H: number;
    sky: HTMLCanvasElement;
    far: HTMLCanvasElement;
    hills: HTMLCanvasElement;
    trees: HTMLCanvasElement;
    ground: HTMLCanvasElement;
    /** Campfires along the treeline (trees-layer coordinates), and smoke from burning places in the hills (hills-layer coordinates). */
    fires: { x: number; y: number }[];
    smoke: { x: number; y: number; seed: number }[];
  };
  let backdrop: Backdrop | null = null;

  const atlasFor = (side: 0 | 1) => {
    if (!atlases || atlases.war !== world.war.n) {
      atlases = { war: world.war.n, a: buildAtlas(world.war.factions[0].kit), b: buildAtlas(world.war.factions[1].kit) };
    }
    return side === 0 ? atlases.a : atlases.b;
  };
  const dragonAtlas = (i: number) => {
    let a = dragonAtlases.get(i);
    if (!a) {
      a = buildAtlas(world.war.factions[0].kit, DRAGONS[i % DRAGONS.length], ['dragon']);
      dragonAtlases.set(i, a);
    }
    return a;
  };

  const canvas = (w: number, h: number, scale = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    return { c, g };
  };

  /** A ridge of `n(x)` heights, filled down to the bottom. */
  const ridge = (g: CanvasRenderingContext2D, w: number, base: number, amp: number, freq: number, seed: number, color: string, h: number) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const n = host.noise.noise2(x * freq + seed, seed * 0.37) * 0.65 + host.noise.noise2(x * freq * 3.1 + seed, seed) * 0.25 + host.noise.noise2(x * freq * 9 + seed, 3) * 0.1;
      g.lineTo(x, base - amp * (0.5 + n * 0.5));
    }
    g.lineTo(w, h);
    g.closePath();
    g.fill();
  };

  function paintBackdrop(b: Battle) {
    const sky = SKIES[b.weather];
    const r = forkRng(host.config.seed, `backdrop-${world.war.n}-${b.n}`);
    const gt = world.groundTop;
    // Sky: gradient, stars, moon or a low sun's glow, a few cloud banks.
    const s = canvas(W, gt + 40);
    const grad = s.g.createLinearGradient(0, 0, 0, gt + 40);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(0.55, sky.mid);
    grad.addColorStop(1, sky.low);
    s.g.fillStyle = grad;
    s.g.fillRect(0, 0, W, gt + 40);
    if (sky.sun) {
      const sx = W * (0.2 + r() * 0.6);
      const glow = s.g.createRadialGradient(sx, gt, 0, sx, gt, W * 0.45);
      glow.addColorStop(0, hexA(sky.sun, 0.32));
      glow.addColorStop(1, hexA(sky.sun, 0));
      s.g.fillStyle = glow;
      s.g.fillRect(0, 0, W, gt + 40);
    }
    if (sky.stars) {
      for (let i = 0; i < 160; i++) {
        const y = r() ** 1.6 * gt * 0.8;
        s.g.fillStyle = `rgba(226,232,240,${(0.15 + r() * 0.5) * (1 - y / gt)})`;
        s.g.fillRect(Math.floor(r() * W), Math.floor(y), 1, 1);
      }
    }
    if (sky.moon) {
      const mx = W * (0.12 + r() * 0.76);
      const my = gt * (0.14 + r() * 0.2);
      const glow = s.g.createRadialGradient(mx, my, 0, mx, my, 90);
      glow.addColorStop(0, 'rgba(203,213,225,0.16)');
      glow.addColorStop(1, 'rgba(203,213,225,0)');
      s.g.fillStyle = glow;
      s.g.fillRect(mx - 90, my - 90, 180, 180);
      s.g.fillStyle = b.weather === 'fog' ? 'rgba(203,213,225,0.25)' : 'rgba(226,232,240,0.75)';
      s.g.beginPath();
      s.g.arc(mx, my, 11, 0, Math.PI * 2);
      s.g.fill();
      s.g.fillStyle = sky.mid;
      s.g.beginPath();
      s.g.arc(mx + 5, my - 3, 10, 0, Math.PI * 2);
      s.g.fill();
    }
    for (let i = 0; i < 7; i++) {
      const cy = gt * (0.15 + r() * 0.55);
      const cx = r() * W;
      const cw = 140 + r() * 260;
      s.g.fillStyle = hexA(sky.low, 0.08 + r() * 0.1);
      s.g.beginPath();
      s.g.ellipse(cx, cy, cw, 6 + r() * 10, 0, 0, Math.PI * 2);
      s.g.fill();
    }
    // Far mountains: two ridges, bluer and lighter the farther.
    const farW = W + b.BW * 0.15 + 120;
    const far = canvas(farW, gt + 4);
    ridge(far.g, farW, gt * 0.78, gt * 0.32, 0.0021, r() * 100, sky.far, gt + 4);
    ridge(far.g, farW, gt * 0.9, gt * 0.22, 0.0035, r() * 100, `rgb(${mixRgb(sky.far, sky.hills, 0.45).map(Math.round).join(',')})`, gt + 4);
    // Hills: rolling, wooded, with a keep on one and a village's roofs below another.
    const hillW = W + b.BW * 0.45 + 120;
    const hills = canvas(hillW, gt + 4);
    ridge(hills.g, hillW, gt * 0.98, gt * 0.16, 0.004, r() * 100, sky.hills, gt + 4);
    hills.g.fillStyle = sky.hills;
    for (let x = 0; x < hillW; x += 3 + r() * 5) {
      if (host.noise.noise2(x * 0.01, 9) < 0.05) continue;
      const base = gt * 0.98 - gt * 0.16 * (0.5 + (host.noise.noise2(x * 0.004 + 1, 1) * 0.5));
      const th = 6 + r() * 12;
      hills.g.beginPath();
      hills.g.moveTo(x - 4, base + 3);
      hills.g.lineTo(x, base - th);
      hills.g.lineTo(x + 4, base + 3);
      hills.g.fill();
    }
    const keepX = hillW * (0.3 + r() * 0.4);
    const keepY = gt * 0.86;
    const kw = 46;
    hills.g.fillRect(keepX, keepY - 40, kw, 46);
    hills.g.fillRect(keepX - 10, keepY - 26, 10, 32);
    hills.g.fillRect(keepX + kw, keepY - 26, 12, 32);
    hills.g.fillRect(keepX + 14, keepY - 60, 16, 24);
    for (let i = 0; i < 6; i++) hills.g.fillRect(keepX + i * 8, keepY - 44, 5, 5);
    for (let i = 0; i < 3; i++) hills.g.fillRect(keepX + 14 + i * 6, keepY - 64, 4, 5);
    // Lit windows in the keep, if night falls.
    hills.g.fillStyle = hexA('#fbbf24', 0.55);
    for (let i = 0; i < 4; i++) hills.g.fillRect(keepX + 6 + i * 10, keepY - 24 + (i % 2) * 10, 2, 3);
    // Places burning in the hills: their smoke is drawn live.
    const smoke: Backdrop['smoke'] = [];
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const x = hillW * (0.1 + r() * 0.8);
      smoke.push({ x, y: gt * 0.98 - gt * 0.16 * (0.5 + host.noise.noise2(x * 0.004 + 1, 1) * 0.5) + 4, seed: Math.floor(r() * 1e6) });
    }
    // The treeline at the back of the field.
    const treeW = W + b.BW * 0.8 + 120;
    const trees = canvas(treeW, 60);
    trees.g.fillStyle = `rgb(${mixRgb(sky.hills, sky.ground[0], 0.4).map(Math.round).join(',')})`;
    trees.g.fillRect(0, 44, treeW, 16);
    for (let x = 0; x < treeW; x += 4 + r() * 7) {
      if (host.noise.noise2(x * 0.006, 21) < -0.25) continue;
      const th = 10 + r() * 26;
      const tw = 5 + r() * 7;
      trees.g.beginPath();
      if (r() < 0.6) {
        trees.g.moveTo(x - tw, 50);
        trees.g.lineTo(x, 50 - th);
        trees.g.lineTo(x + tw, 50);
      } else trees.g.ellipse(x, 50 - th * 0.6, tw, th * 0.6, 0, 0, Math.PI * 2);
      trees.g.fill();
    }
    // Each army's camp on the ridge behind it: tents in its colors, fires between them.
    const fires: Backdrop['fires'] = [];
    for (const s of [0, 1] as const) {
      const f = world.war.factions[s];
      const center = (s === 0 ? b.BW * 0.12 : b.BW * 0.88) * 0.8 + 60;
      for (let i = 0; i < 9; i++) {
        const x = center + (i - 4) * (14 + r() * 8);
        const tw = 6 + r() * 4;
        const y = 52;
        trees.g.fillStyle = i % 3 ? f.dark : f.color;
        trees.g.beginPath();
        trees.g.moveTo(x - tw, y);
        trees.g.lineTo(x, y - tw * 1.1);
        trees.g.lineTo(x + tw, y);
        trees.g.fill();
        trees.g.fillStyle = 'rgba(0,0,0,0.5)';
        trees.g.fillRect(x - 1, y - 4, 2, 4);
        if (i % 3 === 1) fires.push({ x: x + tw + 4, y: y - 1 });
      }
    }
    // The field: earth, grass streaks, worn ground where the lines will stand.
    const gw = b.BW + 400;
    const gh = H - gt + 20;
    const ground = canvas(gw, gh);
    const gg = ground.g.createLinearGradient(0, 0, 0, gh);
    gg.addColorStop(0, sky.ground[0]);
    gg.addColorStop(1, sky.ground[1]);
    ground.g.fillStyle = gg;
    ground.g.fillRect(0, 0, gw, gh);
    for (let i = 0; i < gw * gh * 0.0025; i++) {
      const x = r() * gw;
      const y = r() ** 0.8 * gh;
      const k = y / gh;
      ground.g.fillStyle = hexA(r() < 0.5 ? '#3f4a2a' : '#2a2416', 0.25 + k * 0.35);
      ground.g.fillRect(x, y, 1 + k * 3, 1);
    }
    for (let i = 0; i < 18; i++) {
      ground.g.fillStyle = hexA('#000000', 0.08 + r() * 0.08);
      ground.g.beginPath();
      ground.g.ellipse(r() * gw, r() * gh, 40 + r() * 120, 4 + r() * 10, 0, 0, Math.PI * 2);
      ground.g.fill();
    }
    // Some fields are fords: a stream between the armies, catching the sky.
    if (r() < 0.45) {
      const cx = 200 + b.BW * (0.46 + r() * 0.08);
      const bend = (r() - 0.5) * 160;
      const path = (side: number) => {
        for (let i = 0; i <= 20; i++) {
          const k = i / 20;
          const x = cx + bend * Math.sin(k * Math.PI) + (k - 0.5) * 60 + side * (10 + k * 26);
          if (i === 0 && side < 0) ground.g.moveTo(x, k * gh);
          else ground.g.lineTo(x, k * gh);
        }
      };
      ground.g.beginPath();
      path(-1);
      for (let i = 20; i >= 0; i--) {
        const k = i / 20;
        ground.g.lineTo(cx + bend * Math.sin(k * Math.PI) + (k - 0.5) * 60 + (10 + k * 26), k * gh);
      }
      ground.g.closePath();
      const water = ground.g.createLinearGradient(0, 0, 0, gh);
      water.addColorStop(0, sky.low);
      water.addColorStop(1, sky.mid);
      ground.g.fillStyle = water;
      ground.g.fill();
      ground.g.strokeStyle = hexA('#e2e8f0', 0.12);
      for (let i = 0; i < 40; i++) {
        const k = r();
        const x = cx + bend * Math.sin(k * Math.PI) + (k - 0.5) * 60 + (r() - 0.5) * (14 + k * 30);
        ground.g.beginPath();
        ground.g.moveTo(x - 3 - k * 4, k * gh);
        ground.g.lineTo(x + 3 + k * 4, k * gh);
        ground.g.stroke();
      }
    }
    backdrop = { battle: b, W, H, sky: s.c, far: far.c, hills: hills.c, trees: trees.c, ground: ground.c, fires, smoke };
  }

  /** Smoke rising from the hills, leaning with the wind, lit from below by what burns. */
  function smoke(bd: Backdrop, t: number) {
    const ox = -camX * 0.45 - 60;
    for (const s of bd.smoke) {
      const x = s.x + ox;
      if (x < -120 || x > W + 120) continue;
      glow(x, s.y, 26, '#f97316', 0.18 + 0.06 * Math.sin(t * 7 + s.seed));
      for (let i = 0; i < 12; i++) {
        const k = ((t * 0.05 + i / 12 + hash(s.seed, i) * 0.02) % 1);
        const px = x + k * 70 + Math.sin(t * 0.4 + i + s.seed) * 6 * k;
        const py = s.y - k * world.groundTop * 0.55;
        ctx.fillStyle = `rgba(30,27,34,${(0.32 * (1 - k)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, 6 + k * 26, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** The camps' fires on the ridge, flickering. */
  function campfires(bd: Backdrop, t: number) {
    const ox = -camX * 0.8 - 60;
    const top = world.groundTop - 50;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, f] of bd.fires.entries()) {
      const x = f.x + ox;
      if (x < -20 || x > W + 20) continue;
      const fl = 0.7 + 0.3 * Math.sin(t * 9 + i * 2.3) * Math.sin(t * 5.7 + i);
      glow(x, top + f.y - 2, 9 * fl, '#fb923c', 0.55);
      ctx.fillStyle = hexA('#fde68a', 0.9 * fl);
      ctx.fillRect(Math.round(x), Math.round(top + f.y - 3), 1, 2);
    }
    ctx.restore();
  }

  // ---- the view from above --------------------------------------------------------------------

  type MapArt = { battle: Battle; W: number; H: number; war: number; terrain: HTMLCanvasElement; shade: HTMLCanvasElement; layout: MapLayout; scenery: SceneryAtlas };
  let map: MapArt | null = null;

  function paintMap(b: Battle) {
    const r = forkRng(host.config.seed, `map-${world.war.n}-${b.n}`);
    const layout = layoutMap(r, b.BW, world.groundTop / H, world.groundBottom / H);
    const snow = b.weather === 'snow';
    const base = snow ? '#2c3442' : '#1a2414';
    const light = snow ? '#3d4757' : '#2b3a1e';
    const dark = snow ? '#232a36' : '#0f160b';
    const earth = snow ? '#3a3f4a' : '#2a2316';
    const gw = b.BW + 400;
    const { c, g } = canvas(gw, H);
    g.fillStyle = base;
    g.fillRect(0, 0, gw, H);
    // Meadow, bare earth, and dark hollows in soft patches: computed small, drawn smooth.
    const off = r() * 100;
    const cell = 8;
    const pw = Math.ceil(gw / cell);
    const ph = Math.ceil(H / cell);
    const patch = canvas(pw, ph);
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const X = x * cell;
        const Y = y * cell;
        const v = host.noise.noise2(X * 0.004 + off, Y * 0.004) + host.noise.noise2(X * 0.02, Y * 0.02 + off) * 0.35;
        const e = host.noise.noise2(X * 0.007 + 50, Y * 0.007 + off);
        if (e > 0.45) patch.g.fillStyle = hexA(earth, Math.min(0.85, (e - 0.45) * 3));
        else if (v > 0.15) patch.g.fillStyle = hexA(light, Math.min(0.85, (v - 0.15) * 1.8));
        else if (v < -0.25) patch.g.fillStyle = hexA(dark, Math.min(0.85, (-0.25 - v) * 1.8));
        else continue;
        patch.g.fillRect(x, y, 1, 1);
      }
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(patch.c, 0, 0, pw * cell, ph * cell);
    // Ground worn bare where the armies stand and fight.
    const worn = g.createLinearGradient(0, world.groundTop, 0, world.groundBottom);
    worn.addColorStop(0, hexA(earth, 0));
    worn.addColorStop(0.5, hexA(earth, 0.18));
    worn.addColorStop(1, hexA(earth, 0));
    g.fillStyle = worn;
    g.fillRect(200 + b.BW * 0.2, world.groundTop, b.BW * 0.6, world.groundBottom - world.groundTop);
    // Forest floors, darker, under the trees.
    for (const pr of layout.props) {
      if (pr.prop !== 'pine' && pr.prop !== 'oak') continue;
      g.fillStyle = hexA(dark, 0.35);
      g.beginPath();
      g.arc(pr.x + 200, pr.y * H - 4, 12, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < gw * H * 0.002; i++) {
      g.fillStyle = hexA(r() < 0.5 ? (snow ? '#64748b' : '#33442a') : snow ? '#1f2937' : '#0a0d08', 0.5);
      g.fillRect(r() * gw, r() * H, 1, 1 + Math.floor(r() * 2));
    }
    // Farm plots, furrowed.
    for (const [fx, fy, fw, fh, a] of layout.fields) {
      g.save();
      g.translate(fx + 200, fy * H);
      g.rotate(a);
      g.fillStyle = snow ? '#3b4352' : '#2a2814';
      g.fillRect(-fw / 2, -fh / 2, fw, fh);
      g.fillStyle = snow ? '#4b5563' : '#38341a';
      for (let k = -fh / 2; k < fh / 2; k += 3) g.fillRect(-fw / 2, k, fw, 1);
      g.restore();
    }
    // The road from camp to camp.
    const roadPath = () => {
      g.beginPath();
      layout.road.forEach(([x, y], i) => (i ? g.lineTo(x + 200, y * H) : g.moveTo(x + 200, y * H)));
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    roadPath();
    g.strokeStyle = snow ? '#4b5563' : '#2b2418';
    g.lineWidth = 11;
    g.stroke();
    roadPath();
    g.strokeStyle = snow ? '#5b6474' : '#3a3122';
    g.lineWidth = 5;
    g.stroke();
    // The river, banks first, then water catching the sky; a bridge where the road crosses.
    if (layout.river) {
      const river = layout.river;
      for (const [w, col] of [
        [40, snow ? '#1f2633' : '#0a0e10'],
        [28, snow ? '#3a4a5c' : '#16222e'],
        [12, snow ? '#4a5d72' : '#1e3040'],
      ] as const) {
        g.beginPath();
        for (let y = -10; y <= H + 10; y += 6) {
          const x = river(y / H) + 200;
          if (y < 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.strokeStyle = col;
        g.lineWidth = w;
        g.stroke();
      }
      g.strokeStyle = 'rgba(226,232,240,0.18)';
      g.lineWidth = 1;
      for (let i = 0; i < 70; i++) {
        const y = r() * H;
        const x = river(y / H) + 200 + (r() - 0.5) * 16;
        g.beginPath();
        g.moveTo(x - 3, y);
        g.lineTo(x + 3, y);
        g.stroke();
      }
      let best = layout.road[0];
      for (const p of layout.road) if (Math.abs(p[0] - river(p[1])) < Math.abs(best[0] - river(best[1]))) best = p;
      const bx = river(best[1]) + 200;
      const by = best[1] * H;
      g.fillStyle = '#4a3423';
      g.fillRect(bx - 24, by - 6, 48, 12);
      g.fillStyle = '#6b4c33';
      for (let k = -22; k < 22; k += 4) g.fillRect(bx + k, by - 5, 2, 10);
      g.fillStyle = '#2a1c12';
      g.fillRect(bx - 24, by - 7, 48, 2);
      g.fillRect(bx - 24, by + 5, 48, 2);
    }
    // A shade over the map: dusk light from one side, the edges falling away.
    const sh = canvas(W, H);
    const sky = SKIES[b.weather];
    const side = sh.g.createLinearGradient(0, 0, W, H);
    side.addColorStop(0, hexA(sky.low, 0.22));
    side.addColorStop(0.5, hexA(sky.mid, 0.08));
    side.addColorStop(1, hexA(sky.top, 0.3));
    sh.g.fillStyle = side;
    sh.g.fillRect(0, 0, W, H);
    const v = sh.g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, 'rgba(2,3,6,0)');
    v.addColorStop(1, 'rgba(2,3,6,0.5)');
    sh.g.fillStyle = v;
    sh.g.fillRect(0, 0, W, H);
    const fa = world.war.factions;
    map = { battle: b, W, H, war: world.war.n, terrain: c, shade: sh.c, layout, scenery: buildScenery([[fa[0].color, fa[0].dark], [fa[1].color, fa[1].dark]]) };
  }

  /** Soldiers and scenery together, back to front, with shadows under the soldiers. */
  function fieldAbove(b: Battle, t: number, p: number, m: MapArt) {
    // The fallen, subdued.
    ctx.globalAlpha = 0.5;
    for (const u of b.units) {
      if (u.alive || u.fled || u.risenAt === 0) continue;
      const x = sx(u.x);
      if (x < -40 || x > W + 40) continue;
      stamp(ctx, atlasFor(u.side), u.kind, deadFrame(u), u.facing < 0, x, world.sy(u.z), p, u.variant);
    }
    ctx.globalAlpha = 1;
    type D = { y: number; u?: Unit; prop?: Placed };
    const list: D[] = [];
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    for (const pr of m.layout.props) {
      const x = sx(pr.x);
      if (x < -60 || x > W + 60) continue;
      list.push({ y: pr.y * H, prop: pr });
      // Shadows fall away from the low light, to the lower right.
      const [w] = m.scenery.size(pr.prop);
      const r = (w / 2) * p;
      ctx.moveTo(x + r + 3, pr.y * H);
      ctx.ellipse(x + 3, pr.y * H, r, r * 0.35, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    for (const u of b.units) {
      if (!u.alive || u.fled) continue;
      const x = sx(u.x);
      if (x < -40 || x > W + 40) continue;
      const y = world.sy(u.z);
      list.push({ y, u });
      const r = (u.kind === 'cav' || u.kind === 'lord' ? 7 : u.kind === 'treb' ? 10 : 4) * p;
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    list.sort((a, c) => a.y - c.y);
    const bearers = new Set<Unit>();
    for (const g of b.regs) {
      if (g.routed || g.kind === 'arch' || g.kind === 'mage' || g.kind === 'treb') continue;
      const front = g.units.filter((u) => u.alive && !u.fled && u.rank === 0);
      if (front.length) bearers.add(front[Math.floor(front.length / 2)]);
    }
    for (const d of list) {
      if (d.prop) {
        stampProp(ctx, m.scenery, d.prop.prop, d.prop.variant, sx(d.prop.x), d.y, p);
        continue;
      }
      const u = d.u!;
      const x = sx(u.x);
      if (u.risenAt > 0 && t - u.risenAt < 1.2) {
        ctx.globalAlpha = (t - u.risenAt) / 1.2;
        stamp(ctx, atlasFor(u.side), 'inf', 0, u.facing < 0, x, d.y, p, u.variant);
        ctx.globalAlpha = 1;
        continue;
      }
      stamp(ctx, atlasFor(u.side), u.kind, frameOf(u, t), u.facing < 0, x, d.y, p, u.variant);
      if (bearers.has(u)) banner(u, x, d.y, p, t);
      if (u.kind === 'mage' && u.swingUntil > t) glow(x, d.y - 18 * p, 18 * p, world.war.factions[u.side].kit.magic, 0.5);
    }
  }

  /** Night lights: hearths, camp fires, the keep's windows; and the mill's sails turning. */
  function mapLights(m: MapArt, t: number, p: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, l] of m.layout.lights.entries()) {
      const x = sx(l.x);
      if (x < -60 || x > W + 60) continue;
      const fl = 0.75 + 0.25 * Math.sin(t * 7 + i * 1.7) * Math.sin(t * 4.3 + i);
      glow(x, l.y * H, l.r * fl, l.color, 0.32);
    }
    ctx.restore();
    if (m.layout.mill) {
      const x = sx(m.layout.mill.x);
      const y = m.layout.mill.y * H - 12 * p;
      if (x > -60 && x < W + 60) {
        ctx.save();
        ctx.strokeStyle = '#d6d3d1';
        ctx.lineWidth = Math.max(1, p);
        ctx.beginPath();
        for (let k = 0; k < 4; k++) {
          const a = t * 0.8 + (k * Math.PI) / 2;
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * 11 * p, y + Math.sin(a) * 11 * p);
        }
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Cloud shadows drifting over the map. */
  function cloudShadows(t: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let i = 0; i < 4; i++) {
      const w = 260 + hash(i, 7) * 300;
      const x = ((hash(i, 1) * (W + w * 2) + t * (6 + hash(i, 2) * 6) - camX * 0.2) % (W + w * 2)) - w;
      const y = hash(i, 3) * H;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.32, 0.2, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.4, y + w * 0.08, w * 0.6, w * 0.24, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- drawing the field ------------------------------------------------------------------

  const sx = (x: number) => x - camX;

  function frameOf(u: Unit, t: number): number {
    const moving = u.anim % 1000;
    const walk = Math.floor(moving) % 2;
    switch (u.kind) {
      case 'inf':
        return u.swingUntil > t ? 2 : walk;
      case 'arch':
        return u.swingUntil > t ? 2 : walk;
      case 'cav':
        return u.swingUntil > t ? 3 : Math.floor(moving) % 3;
      case 'mage':
        return u.swingUntil > t ? 1 : 0;
      case 'lord':
        return u.swingUntil > t ? 0 : Math.floor(moving) % 2;
      case 'treb':
        return u.swingUntil > t ? 1 : 0;
    }
  }
  const deadFrame = (u: Unit) => SHAPES[u.kind].frames - 1;

  function marks(b: Battle) {
    for (const e of b.effects) {
      if (e.kind !== 'crater' && e.kind !== 'scorch') continue;
      const x = sx(e.x);
      if (x < -80 || x > W + 80) continue;
      const fade = Math.min(1, (e.t0 + e.dur - world.t) / 4);
      ctx.fillStyle = hexA(e.color, (e.kind === 'crater' ? 0.55 : 0.4) * fade);
      ctx.beginPath();
      ctx.ellipse(x, world.sy(e.z), e.r, e.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spent arrows in the turf.
    ctx.strokeStyle = 'rgba(214,211,196,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const s of b.shots) {
      if (!s.landed || s.kind !== 'arrow' || s.air) continue;
      const x = sx(s.x1);
      const y = world.sy(s.z1);
      const lean = s.x1 > s.x0 ? 3 : -3;
      ctx.moveTo(x, y);
      ctx.lineTo(x - lean, y - 6);
    }
    ctx.stroke();
  }

  function armies(b: Battle, t: number, p: number) {
    const live: Unit[] = [];
    // The fallen first, flat on the field and subdued, so the living stand out.
    ctx.globalAlpha = 0.5;
    for (const u of b.units) {
      if (u.fled) continue;
      const x = sx(u.x);
      if (x < -60 || x > W + 60) continue;
      if (!u.alive) {
        if (u.risenAt === 0) continue;
        stamp(ctx, atlasFor(u.side), u.kind, deadFrame(u), u.facing < 0, x, world.sy(u.z), p, u.variant);
      } else live.push(u);
    }
    ctx.globalAlpha = 1;
    live.sort((a, c) => a.z - c.z || a.id - c.id);
    const bearers = new Set<Unit>();
    for (const g of b.regs) {
      if (g.routed || g.kind === 'arch' || g.kind === 'mage' || g.kind === 'treb') continue;
      const mid = g.units.filter((u) => u.alive && !u.fled && u.rank === 0);
      if (mid.length) bearers.add(mid[Math.floor(mid.length / 2)]);
    }
    for (const u of live) {
      const x = sx(u.x);
      const y = world.sy(u.z);
      const atlas = atlasFor(u.side);
      if (u.risenAt > 0 && t - u.risenAt < 1.2) {
        // Clawing up out of the ground.
        const k = (t - u.risenAt) / 1.2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 30, y - 40 * p, 60, 40 * p);
        ctx.clip();
        stamp(ctx, atlas, 'inf', 0, u.facing < 0, x, y + (1 - k) * 16 * p, p, u.variant);
        ctx.restore();
        continue;
      }
      stamp(ctx, atlas, u.kind, frameOf(u, t), u.facing < 0, x, y, p, u.variant);
      if (bearers.has(u)) banner(u, x, y, p, t);
      if (u.kind === 'mage' && u.swingUntil > t) glow(x, y - 18 * p, 18 * p, world.war.factions[u.side].kit.magic, 0.5);
    }
  }

  function banner(u: Unit, x: number, y: number, p: number, t: number) {
    const f = world.war.factions[u.side];
    const top = y - (u.kind === 'inf' ? 30 : 38) * p;
    const px = x - u.facing * 4 * p;
    ctx.fillStyle = '#3f2a17';
    ctx.fillRect(Math.round(px), top, Math.max(1, p * 0.75), (u.kind === 'inf' ? 22 : 26) * p);
    const w = 11 * p;
    const h = 7 * p;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(px, top);
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      ctx.lineTo(px - u.facing * w * k, top + Math.sin(t * 5 + k * 4 + u.id) * 1.6 * p * k);
    }
    for (let i = 6; i >= 0; i--) {
      const k = i / 6;
      ctx.lineTo(px - u.facing * w * k, top + h + Math.sin(t * 5 + k * 4 + u.id) * 1.6 * p * k - (i === 6 ? 2 * p : 0));
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = f.dark;
    ctx.fillRect(Math.round(px - u.facing * w * 0.45 - p), top + h * 0.35, p * 2, p * 2);
  }

  function glow(x: number, y: number, r: number, color: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(color, a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function shotPos(s: Shot, t: number) {
    const k = Math.max(0, Math.min(1, (t - s.t0) / s.dur));
    const x = s.x0 + (s.x1 - s.x0) * k;
    const z = s.z0 + (s.z1 - s.z0) * k;
    const h = s.h0 * (1 - k) + 4 * s.peak * k * (1 - k);
    return { x, z, h, k };
  }

  function shots(b: Battle, t: number, p: number) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(231,229,228,0.8)';
    ctx.lineWidth = Math.max(1, p * 0.6);
    ctx.beginPath();
    for (const s of b.shots) {
      if (s.landed || t < s.t0 || s.kind !== 'arrow') continue;
      const a = shotPos(s, t);
      const c = shotPos(s, t - 0.03);
      const x = sx(a.x);
      if (x < -20 || x > W + 20) continue;
      const y = world.sy(a.z) - a.h;
      const dx = x - sx(c.x);
      const dy = y - (world.sy(c.z) - c.h);
      const len = Math.hypot(dx, dy) || 1;
      ctx.moveTo(x, y);
      ctx.lineTo(x - (dx / len) * 5 * p, y - (dy / len) * 5 * p);
    }
    ctx.stroke();
    for (const s of b.shots) {
      if (s.landed || t < s.t0 || s.kind === 'arrow') continue;
      const a = shotPos(s, t);
      const x = sx(a.x);
      const y = world.sy(a.z) - a.h;
      if (s.kind === 'boulder') {
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.arc(x, y, 3 * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, world.sy(a.z), 4 * p * (1 - a.h / 400), p, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const color = world.war.factions[s.side].kit.magic;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 6; i >= 0; i--) {
          const q = shotPos(s, t - i * 0.035);
          glow(sx(q.x), world.sy(q.z) - q.h, (8 - i) * p * 1.2, color, 0.35 * (1 - i / 7));
        }
        glow(x, y, 6 * p, '#ffffff', 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  function effects(b: Battle, t: number, p: number) {
    ctx.save();
    for (const e of b.effects) {
      const age = t - e.t0;
      const k = age / e.dur;
      let x = sx(e.x);
      let z = e.z;
      if (e.kind === 'ward' && e.reg) {
        const live = e.reg.units.filter((u) => u.alive && !u.fled);
        if (live.length) {
          x = sx(live.reduce((s, u) => s + u.x, 0) / live.length);
          z = live.reduce((s, u) => s + u.z, 0) / live.length;
        }
      }
      if (x < -150 || x > W + 150) continue;
      const y = world.sy(z) - e.h;
      switch (e.kind) {
        case 'blast': {
          ctx.globalCompositeOperation = 'lighter';
          glow(x, y - 8 * p, e.r * (0.8 + k), e.color, 0.7 * (1 - k));
          glow(x, y - 4 * p, e.r * 0.5, '#fff7ed', 0.6 * (1 - k) ** 2);
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 14; i++) {
            const a = hash(e.seed, i) * Math.PI;
            const d = e.r * k * (0.4 + hash(e.seed, i, 2) * 0.8);
            ctx.fillStyle = hexA(i % 3 ? e.color : '#fde68a', 1 - k);
            ctx.fillRect(x + Math.cos(a + Math.PI) * d, y - Math.sin(a) * d * 0.9 - 4 * p, p * 1.5, p * 1.5);
          }
          break;
        }
        case 'bolt': {
          const top = -10;
          const bottom = y;
          ctx.globalCompositeOperation = 'lighter';
          for (const [w, a] of [
            [6 * p, 0.25],
            [2 * p, 0.9],
          ] as const) {
            ctx.strokeStyle = w > 3 ? hexA(e.color, a * (1 - k)) : hexA('#ffffff', a * (1 - k));
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(x + (hash(e.seed, 0) - 0.5) * 80, top);
            const n = 9;
            for (let i = 1; i <= n; i++) {
              const yy = top + ((bottom - top) * i) / n;
              const jitter = i === n ? 0 : (hash(e.seed, i) - 0.5) * 28;
              ctx.lineTo(x + jitter * (1 - i / n) + (hash(e.seed, 0) - 0.5) * 80 * (1 - i / n), yy);
            }
            ctx.stroke();
          }
          glow(x, bottom, 40, e.color, 0.5 * (1 - k));
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'smite': {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createLinearGradient(x - 8, 0, x + 8, 0);
          g.addColorStop(0, hexA(e.color, 0));
          g.addColorStop(0.5, hexA(e.color, 0.7 * (1 - k)));
          g.addColorStop(1, hexA(e.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - 10 * p, 0, 20 * p, y);
          glow(x, y, 30 * p, e.color, 0.5 * (1 - k));
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'ward': {
          const fade = Math.min(1, age * 2, (e.dur - age) * 1.5);
          const rx = 70;
          const ry = 46;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA(e.color, 0.06 * fade);
          ctx.strokeStyle = hexA(e.color, (0.35 + 0.15 * Math.sin(t * 6)) * fade);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(x, world.sy(z) + 4, rx, ry, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Runes turning around the rim.
          for (let i = 0; i < 6; i++) {
            const a = Math.PI + ((i + t * 0.3) % 6) / 6 * Math.PI;
            ctx.fillStyle = hexA(e.color, 0.8 * fade);
            ctx.fillRect(x + Math.cos(a) * rx - 1, world.sy(z) + 4 + Math.sin(a) * ry - 1, 2, 2);
          }
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'raise':
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 8; i++) {
            const yy = y - k * 30 * p * hash(e.seed, i) - 4;
            ctx.fillStyle = hexA(e.color, 0.8 * (1 - k));
            ctx.fillRect(x + (hash(e.seed, i, 1) - 0.5) * 16, yy, p, p);
          }
          glow(x, y - 6, 18, e.color, 0.3 * (1 - k));
          ctx.globalCompositeOperation = 'source-over';
          break;
        case 'dust':
          for (let i = 0; i < 6; i++) {
            const d = e.r * (0.3 + k) * hash(e.seed, i);
            ctx.fillStyle = hexA(e.color, 0.22 * (1 - k));
            ctx.beginPath();
            ctx.ellipse(x + (hash(e.seed, i, 3) - 0.5) * e.r, y - d * 0.4, d * 0.7, d * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'spark':
          ctx.fillStyle = hexA(e.color, 1 - k);
          ctx.fillRect(x - p, y - p * 3, p * 2, p * 6);
          ctx.fillRect(x - p * 3, y - p, p * 6, p * 2);
          break;
        case 'fire': {
          ctx.globalCompositeOperation = 'lighter';
          glow(x, y - 10, e.r * 1.6, '#f97316', 0.35 * (1 - k));
          for (let i = 0; i < 7; i++) {
            const fx = x + (hash(e.seed, i) - 0.5) * e.r * 2;
            const fy = y - hash(e.seed, i, 1) * 24 * p * (0.4 + k) - 2;
            ctx.fillStyle = hexA(i % 2 ? '#fdba74' : '#ef4444', 0.8 * (1 - k));
            ctx.fillRect(fx, fy, p * 2, p * 3);
          }
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        default:
          break;
      }
    }
    ctx.restore();
  }

  function dragon(b: Battle, t: number, p: number) {
    const d = b.dragon;
    if (!d) return;
    const x = sx(d.x);
    const ground = world.sy(d.z);
    const y = ground - d.h;
    if (x < -200 || x > W + 200) return;
    // Its shadow on the field.
    ctx.fillStyle = `rgba(0,0,0,${(0.35 * Math.max(0, 1 - d.h / 400)).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, ground, 46 * p * 0.5 + d.h * 0.1, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    const atlas = dragonAtlas(d.colors);
    const flip = d.vx < 0;
    const frame = d.state === 'dead' ? 1 : Math.floor(d.wing) % 4;
    if (d.state === 'fall' || d.state === 'dead') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((flip ? -1 : 1) * Math.min(0.9, (t - d.t0) * 1.2));
      stamp(ctx, atlas, 'dragon', frame, flip, 0, 0, p);
      ctx.restore();
      if (d.state === 'dead') for (let i = 0; i < 4; i++) {
        const age = (t * 0.6 + i * 0.25) % 1;
        ctx.fillStyle = `rgba(120,113,108,${(0.25 * (1 - age)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + (hash(i, 3) - 0.5) * 60, y - 10 - age * 60, 6 + age * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    stamp(ctx, atlas, 'dragon', frame, flip, x, y, p);
    if (d.breathing) {
      // A cone of fire from the jaws to the field.
      const mx = x + (flip ? -1 : 1) * 26 * p;
      const my = y - 11 * p;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const k = ((t * 3 + i / 18) % 1);
        const fx = mx + (flip ? -1 : 1) * k * 30 * p + (hash(i, Math.floor(t * 20)) - 0.5) * 18 * k * p;
        const fy = my + k * (ground - my);
        ctx.fillStyle = hexA(k < 0.3 ? '#fef08a' : k < 0.7 ? '#fb923c' : '#dc2626', 0.75 * (1 - k * 0.6));
        ctx.fillRect(fx, fy, p * (2 + k * 3), p * (2 + k * 3));
      }
      glow(mx, (my + ground) / 2, 60, '#f97316', 0.3);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function crows(b: Battle, t: number, p: number) {
    const atlas = atlasFor(0);
    for (const c of b.crows) {
      const x = sx(c.x);
      if (x < -20 || x > W + 20) continue;
      const fly = c.h > 0;
      stamp(ctx, atlas, 'crow', fly ? Math.floor(t * 6 + c.seed) % 2 : 1, c.vx < 0, x, world.sy(c.z) - c.h, p);
    }
  }

  function weather(b: Battle, t: number) {
    if (b.weather === 'storm') {
      ctx.strokeStyle = 'rgba(148,163,184,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 260; i++) {
        const x = ((hash(i, 1) * (W + 200) + t * 220) % (W + 200)) - 100;
        const y = ((hash(i, 2) * H + t * 900 * (0.8 + hash(i, 3) * 0.4)) % H);
        ctx.moveTo(x, y);
        ctx.lineTo(x - 4, y + 14);
      }
      ctx.stroke();
    } else if (b.weather === 'snow') {
      ctx.fillStyle = 'rgba(241,245,249,0.6)';
      for (let i = 0; i < 220; i++) {
        const x = ((hash(i, 1) * W + t * 18 + Math.sin(t + i) * 12) % W + W) % W;
        const y = (hash(i, 2) * H + t * (30 + hash(i, 3) * 30)) % H;
        const s = hash(i, 4) < 0.2 ? 2 : 1;
        ctx.fillRect(x, y, s, s);
      }
    } else if (b.weather === 'fog') {
      for (let i = 0; i < 4; i++) {
        const y = world.groundTop + (i / 4) * world.depth * 0.8 - 20;
        const g = ctx.createLinearGradient(0, y - 30, 0, y + 30);
        g.addColorStop(0, 'rgba(148,163,184,0)');
        g.addColorStop(0.5, `rgba(148,163,184,${(0.06 + 0.03 * Math.sin(t * 0.3 + i)).toFixed(3)})`);
        g.addColorStop(1, 'rgba(148,163,184,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 30, W, 60);
      }
    }
  }

  function labels(b: Battle, t: number, level: number) {
    if (!o.labels) return;
    ctx.save();
    ctx.font = serif(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const placed: [number, number, number][] = [];
    for (const l of b.labels) {
      const age = t - l.t0;
      const a = Math.min(1, age * 3, (l.dur - age) / 0.8) * level;
      if (a <= 0) continue;
      const w = ctx.measureText(l.text).width;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, sx(l.x)));
      let y = Math.max(28, world.sy(l.z) - l.h);
      // Step up past any call-out already there.
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      const text = typed(l.text, age, 40, t);
      ctx.strokeStyle = hexA(l.color, 0.4 * a);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, Math.min(world.sy(l.z) - 18, y + 22));
      ctx.stroke();
      ctx.fillStyle = `rgba(6,5,8,${(0.55 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      // A banner color can be dark; the words are always lightened toward parchment.
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.5);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, text, x, y);
    }
    ctx.restore();
  }

  function hud(b: Battle, t: number, level: number) {
    if (!o.hud) return;
    const [fa, fb] = world.war.factions;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = serif(13);
    ctx.textAlign = 'left';
    ctx.fillStyle = hexA('#e7dcc4', 0.82 * level);
    fillCrisp(ctx, `THE FIELD OF ${b.name} · DAY ${b.day}`, 16, 26);
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a8a29e', 0.8 * level);
    fillCrisp(ctx, `THE WAR OF ${world.war.name} · BATTLE ${b.n + 1}`, 16, 42);
    ctx.textAlign = 'right';
    ctx.font = serif(12);
    const score = `${fa.name}  ${world.war.wins[0]} · ${world.war.wins[1]}  ${fb.name}`;
    ctx.fillStyle = hexA('#e7dcc4', 0.8 * level);
    fillCrisp(ctx, score, W - 16, 26);
    const wa = ctx.measureText(`${world.war.wins[1]}  ${fb.name}`).width;
    ctx.fillStyle = fa.color;
    ctx.fillRect(W - 16 - ctx.measureText(score).width - 10, 18, 6, 6);
    ctx.fillStyle = fb.color;
    ctx.fillRect(W - 12, 18, 6, 6);
    void wa;
    // The chronicle, in the lower left.
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      const a = Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level;
      ctx.fillStyle = hexA('#e7dcc4', a);
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      world.resize(W, H);
      backdrop = null;
      map = null;
    },
    frame(info: FrameInfo) {
      step(info);
      const b = world.battle;
      const t = world.t;
      const p = P();
      const level = 0.55 + 0.45 * host.intensity;
      if (above) {
        if (!map || map.battle !== b || map.W !== W || map.H !== H || map.war !== world.war.n) paintMap(b);
        const m = map!;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(m.terrain, Math.round(-camX - 200), 0);
        ctx.imageSmoothingEnabled = false;
        marks(b);
        fieldAbove(b, t, p, m);
        ctx.imageSmoothingEnabled = true;
        mapLights(m, t, p);
        shots(b, t, p);
        effects(b, t, p);
        cloudShadows(t);
        ctx.imageSmoothingEnabled = false;
        dragon(b, t, p * 1.5);
        crows(b, t, p);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(m.shade, 0, 0, W, H);
        weather(b, t);
        if (b.flash > 0) {
          ctx.fillStyle = `rgba(226,232,240,${(Math.min(1, b.flash * 3) * 0.08).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
        if (b.phase === 'dusk') {
          const k = Math.min(1, (t - b.phaseAt) / 1.5);
          ctx.fillStyle = `rgba(3,3,6,${(k * 0.92).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
        labels(b, t, level);
        hud(b, t, level);
        return;
      }
      if (!backdrop || backdrop.battle !== b || backdrop.W !== W || backdrop.H !== H) paintBackdrop(b);
      const bd = backdrop!;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bd.sky, 0, 0, W, world.groundTop + 40);
      ctx.drawImage(bd.far, Math.round(-camX * 0.15 - 60), 0);
      ctx.drawImage(bd.hills, Math.round(-camX * 0.45 - 60), 0);
      smoke(bd, t);
      ctx.drawImage(bd.trees, Math.round(-camX * 0.8 - 60), world.groundTop - 50);
      campfires(bd, t);
      ctx.drawImage(bd.ground, Math.round(-camX - 200), world.groundTop);
      ctx.imageSmoothingEnabled = false;
      marks(b);
      armies(b, t, p);
      dragon(b, t, p);
      ctx.imageSmoothingEnabled = true;
      shots(b, t, p);
      effects(b, t, p);
      ctx.imageSmoothingEnabled = false;
      crows(b, t, p);
      ctx.imageSmoothingEnabled = true;
      // Haze over the far ranks.
      const sky = SKIES[b.weather];
      const haze = ctx.createLinearGradient(0, world.groundTop - 10, 0, world.groundTop + world.depth * 0.45);
      haze.addColorStop(0, hexA(sky.low, 0.5));
      haze.addColorStop(1, hexA(sky.low, 0));
      ctx.fillStyle = haze;
      ctx.fillRect(0, world.groundTop - 10, W, world.depth * 0.45 + 10);
      weather(b, t);
      // Lightning lights the sky.
      if (b.flash > 0) {
        ctx.fillStyle = `rgba(226,232,240,${(Math.min(1, b.flash * 3) * 0.12).toFixed(3)})`;
        ctx.fillRect(0, 0, W, world.groundTop);
      }
      // Dusk: fade toward the next day.
      if (b.phase === 'dusk') {
        const k = Math.min(1, (t - b.phaseAt) / 1.5);
        ctx.fillStyle = `rgba(3,3,6,${(k * 0.92).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      labels(b, t, level);
      hud(b, t, level);
    },
    advance(info: FrameInfo) {
      step(info);
    },
    inspect(): SkinInspection {
      return {
        t: world.t,
        counts: world.counts(),
        log: world.bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: world.bus.seq,
      };
    },
    destroy() {
      backdrop = null;
      map = null;
      atlases = null;
      dragonAtlases.clear();
    },
  };
}

export type { Effect };
