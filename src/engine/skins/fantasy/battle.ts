/**
 * Shieldwall's mount: the battle simulation (battle-sim.ts), painted side-on or from above.
 *
 * Side-on, back to front:
 *   sky (weather, moon, stars) → mountains → hills with a keep → the treeline → the field
 *   (a hill, a ford, worn earth, burnt grass, craters, spent arrows, the fallen) → the armies,
 *   a siege's wall and towers, banners and walkers, all sorted by depth → shots in flight →
 *   spells and fire → the dragon → crows → haze → rain or snow → the dark, with its lights
 *   → call-outs → the chronicle
 *
 * The backdrop for each field is painted once into canvases and scrolled with parallax.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { forkRng } from '../../rng';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { SHIELDWALL_SCHEMA } from './index';
import { createBattleWorld, FIRE_CELL, FIRE_ROWS, isEngine, WEAR_CELL, WEAR_ROWS, type Battle, type Effect, type Shot, type Siege, type Unit } from './battle-sim';
import { buildAtlas, stamp, SHAPES, type Atlas } from './sprites';
import { DRAGONS, serif } from './names';
import { buildScenery, layoutMap, stampProp, type MapLayout, type Placed, type SceneryAtlas } from './scenery';

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

const STONE = { face: '#4b4844', faceLit: '#5f5a54', top: '#6f6a63', course: '#36332f', dark: '#262422', merlon: '#7a746c' };

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(SHIELDWALL_SCHEMA, host.options) as { view: 'side' | 'above'; battles: string; troops: number; magic: number; dragons: number; weather: string; camera: string; labels: boolean; hud: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const above = o.view === 'above';
  const world = createBattleWorld(host.config.seed, W, H, { troops: o.troops * host.config.density, magic: o.magic, dragons: o.dragons, weather: o.weather, view: o.view, battles: o.battles });
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
    /** The ambush's wood at the field's far edge: trees in battle coordinates. */
    wood: { x: number; h: number; w: number; pine: boolean }[];
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

  const rgb = (c: [number, number, number]) => `rgb(${c.map(Math.round).join(',')})`;

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
    ridge(far.g, farW, gt * 0.9, gt * 0.22, 0.0035, r() * 100, rgb(mixRgb(sky.far, sky.hills, 0.45)), gt + 4);
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
    if (!b.siege) {
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
    }
    // Places burning in the hills: their smoke is drawn live.
    const smoke: Backdrop['smoke'] = [];
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) {
      const x = hillW * (0.1 + r() * 0.8);
      smoke.push({ x, y: gt * 0.98 - gt * 0.16 * (0.5 + host.noise.noise2(x * 0.004 + 1, 1) * 0.5) + 4, seed: Math.floor(r() * 1e6) });
    }
    // The treeline at the back of the field.
    const treeW = W + b.BW * 0.8 + 120;
    const trees = canvas(treeW, 60);
    trees.g.fillStyle = rgb(mixRgb(sky.hills, sky.ground[0], 0.4));
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
      if (s === 1 && b.siege) continue;
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
    const D = world.depth;
    const zy = (z: number) => z * D;
    // A ford: the battle's river between the armies, catching the sky.
    const rv = b.terrain.river;
    if (rv) {
      ground.g.beginPath();
      for (let i = 0; i <= 30; i++) {
        const z = -0.02 + (i / 30) * 1.1;
        const x = world.riverX(z) + 200 - rv.w - z * 8;
        if (i === 0) ground.g.moveTo(x, zy(z));
        else ground.g.lineTo(x, zy(z));
      }
      for (let i = 30; i >= 0; i--) {
        const z = -0.02 + (i / 30) * 1.1;
        ground.g.lineTo(world.riverX(z) + 200 + rv.w + z * 8, zy(z));
      }
      ground.g.closePath();
      const water = ground.g.createLinearGradient(0, 0, 0, gh);
      water.addColorStop(0, sky.low);
      water.addColorStop(1, sky.mid);
      ground.g.fillStyle = water;
      ground.g.fill();
      ground.g.strokeStyle = hexA('#0a0a08', 0.5);
      ground.g.lineWidth = 2;
      ground.g.stroke();
      ground.g.strokeStyle = hexA('#e2e8f0', 0.12);
      ground.g.lineWidth = 1;
      for (let i = 0; i < 50; i++) {
        const z = r() * 1.05;
        const x = world.riverX(z) + 200 + (r() - 0.5) * (rv.w * 1.4);
        ground.g.beginPath();
        ground.g.moveTo(x - 3 - z * 4, zy(z));
        ground.g.lineTo(x + 3 + z * 4, zy(z));
        ground.g.stroke();
      }
    }
    // A hill: the ground rises; lit from the upper left, darker on its near and far faces.
    const hl = b.terrain.hill;
    if (hl) {
      // The ground's own color at its foot, grassier toward the crest; slopes toward the light
      // lighter, the others in shade; speckled like the rest of the field.
      const grass = mixRgb(b.weather === 'snow' ? '#94a3b8' : '#46552a', '#000000', 0);
      for (let x = Math.floor(hl.x - hl.rx); x <= hl.x + hl.rx; x += 2) {
        let top = Infinity;
        for (let z = Math.max(0, hl.z - hl.rz); z <= Math.min(1.08, hl.z + hl.rz); z += 1 / D) {
          const e = world.elev(x, z);
          if (e <= 0.3) continue;
          const foot = mixRgb(sky.ground[0], sky.ground[1], Math.min(1, zy(z) / gh));
          const tint = Math.min(1, e / hl.h) * 0.45;
          const lit = (world.elev(x - 4, z) - world.elev(x + 4, z)) * 0.045 + (world.elev(x, z - 0.03) - world.elev(x, z + 0.03)) * 0.025;
          const k = 1 + Math.max(-0.35, Math.min(0.35, lit)) + (hash(x, Math.floor(z * 300)) - 0.5) * 0.12;
          const [cr, cg, cb] = foot.map((c, i) => c + (grass[i] - c) * tint);
          ground.g.fillStyle = `rgb(${Math.min(255, cr * k) | 0},${Math.min(255, cg * k) | 0},${Math.min(255, cb * k) | 0})`;
          ground.g.fillRect(x + 200, zy(z) - e, 2, 2);
          if (e > 3) top = Math.min(top, zy(z) - e);
        }
        // The hill's skyline, faintly lit.
        if (top < Infinity) {
          ground.g.fillStyle = hexA(b.weather === 'snow' ? '#e2e8f0' : '#8a9a52', 0.18);
          ground.g.fillRect(x + 200, top, 2, 1);
        }
      }
      // Grass tufts on the crest.
      for (let i = 0; i < 120; i++) {
        const x = hl.x + (r() - 0.5) * hl.rx * 1.6;
        const z = hl.z + (r() - 0.5) * hl.rz * 1.4;
        const e = world.elev(x, z);
        if (e < 4) continue;
        ground.g.fillStyle = hexA('#4d5a2e', 0.5);
        ground.g.fillRect(x + 200, zy(z) - e - 1, 1, 2);
      }
    }
    // Behind a wall, the town's cobbled ground.
    const sg = b.siege;
    if (sg) {
      ground.g.save();
      ground.g.beginPath();
      ground.g.moveTo(world.wx(-0.1) + 200, zy(-0.1));
      ground.g.lineTo(world.wx(1.2) + 200, zy(1.2));
      ground.g.lineTo(gw, zy(1.2));
      ground.g.lineTo(gw, zy(-0.1));
      ground.g.closePath();
      ground.g.clip();
      ground.g.fillStyle = '#1d1a16';
      ground.g.fillRect(0, 0, gw, gh);
      for (let i = 0; i < 2600; i++) {
        const x = world.wx(0) + 200 + r() * (gw - world.wx(0) - 200);
        const y = r() * gh;
        ground.g.fillStyle = hexA(r() < 0.5 ? '#3a352e' : '#141210', 0.6);
        ground.g.fillRect(x, y, 2 + Math.floor(r() * 3), 1);
      }
      ground.g.restore();
      // The road up to the gate.
      ground.g.fillStyle = hexA('#2b2418', 0.7);
      ground.g.beginPath();
      ground.g.moveTo(0, zy(0.46));
      ground.g.lineTo(world.wx(0.5) + 200, zy(0.47));
      ground.g.lineTo(world.wx(0.5) + 200, zy(0.53));
      ground.g.lineTo(0, zy(0.56));
      ground.g.fill();
    }
    // The ambush's wood: trees standing at the field's far edge.
    const wood: Backdrop['wood'] = [];
    if (b.terrain.wood) {
      for (let i = 0; i < 46; i++) wood.push({ x: b.terrain.wood.x + (r() - 0.5) * b.terrain.wood.w * 1.3, h: 26 + r() * 30, w: 7 + r() * 7, pine: r() < 0.65 });
      wood.sort((a, c) => a.h - c.h);
    }
    backdrop = { battle: b, W, H, sky: s.c, far: far.c, hills: hills.c, trees: trees.c, ground: ground.c, fires, smoke, wood };
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

  /** The ambush's wood, standing on the far edge of the field (side-on). */
  function woodSide(bd: Backdrop, b: Battle) {
    if (!bd.wood.length) return;
    const y = world.sy(0) + 3;
    const c = rgb(mixRgb(SKIES[b.weather].hills, SKIES[b.weather].ground[0], 0.25));
    ctx.fillStyle = c;
    for (const tr of bd.wood) {
      const x = sx(tr.x);
      if (x < -40 || x > W + 40) continue;
      ctx.beginPath();
      if (tr.pine) {
        ctx.moveTo(x - tr.w, y);
        ctx.lineTo(x, y - tr.h);
        ctx.lineTo(x + tr.w, y);
      } else ctx.ellipse(x, y - tr.h * 0.55, tr.w * 1.2, tr.h * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- worn earth, burnt grass ----------------------------------------------------------------

  type Wear = { battle: Battle; seq: number; burnt: number; at: number; c: HTMLCanvasElement };
  let wear: Wear | null = null;
  let blob: HTMLCanvasElement | null = null;

  /**
   * The field's memory, painted into its own layer at half size (it is all soft blots):
   * redrawn when it changes, at most once a second.
   */
  function wearLayer(b: Battle, t: number): HTMLCanvasElement | null {
    const fresh = !wear || wear.battle !== b;
    if (!fresh && (wear!.seq === b.wearSeq && wear!.burnt === b.fire.burnt.size)) return wear!.c;
    if (!fresh && t - wear!.at < 1) return wear!.c;
    if (!blob) {
      blob = document.createElement('canvas');
      blob.width = blob.height = 32;
      const bg = blob.getContext('2d')!;
      const grad = bg.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(14,10,6,1)');
      grad.addColorStop(0.6, 'rgba(14,10,6,0.7)');
      grad.addColorStop(1, 'rgba(14,10,6,0)');
      bg.fillStyle = grad;
      bg.fillRect(0, 0, 32, 32);
    }
    const gw = b.BW + 400;
    const h = above ? H : world.depth + 30;
    const c = fresh ? canvas(gw, h, 0.5) : { c: wear!.c, g: wear!.c.getContext('2d')! };
    c.g.clearRect(0, 0, gw, h);
    const D = world.depth;
    const y0 = above ? world.groundTop : 0;
    const cols = Math.ceil(gw / WEAR_CELL);
    const rowH = D / WEAR_ROWS;
    for (let j = 0; j < WEAR_ROWS; j++) {
      for (let i = 0; i < cols; i++) {
        const v = b.wear[j * cols + i];
        if (v < 0.15) continue;
        const x = i * WEAR_CELL + WEAR_CELL / 2 + (hash(i, j) - 0.5) * 6;
        const y = y0 + j * rowH + rowH / 2 - (above ? 0 : world.elev(x - 200, (j + 0.5) / WEAR_ROWS));
        c.g.globalAlpha = Math.min(0.45, v * 0.075);
        c.g.drawImage(blob, x - WEAR_CELL * 1.1, y - rowH, WEAR_CELL * 2.2, rowH * 2);
      }
    }
    const fh = D / FIRE_ROWS;
    for (const key of b.fire.burnt) {
      const i = Math.floor(key / 32);
      const j = key % 32;
      const x = i * FIRE_CELL + FIRE_CELL / 2;
      const y = y0 + j * fh + fh / 2;
      c.g.globalAlpha = 0.6;
      c.g.drawImage(blob, x - FIRE_CELL * 0.8 + (hash(i, j, 3) - 0.5) * 8, y - fh * 0.8, FIRE_CELL * 1.6, fh * 1.6);
      c.g.globalAlpha = 1;
      c.g.fillStyle = hexA('#2a2521', 0.6);
      for (let k = 0; k < 3; k++) c.g.fillRect(x + (hash(i, j, k) - 0.5) * FIRE_CELL, y + (hash(j, i, k) - 0.5) * fh, 2, 1);
    }
    c.g.globalAlpha = 1;
    wear = { battle: b, seq: b.wearSeq, burnt: b.fire.burnt.size, at: t, c: c.c };
    return c.c;
  }

  /** Grass burning: flames leaning downwind, smoke. */
  function grassFire(b: Battle, t: number, p: number) {
    if (!b.fire.cells.size) return;
    const fh = world.depth / FIRE_ROWS;
    ctx.save();
    for (const c of b.fire.cells.values()) {
      const x = sx(c.i * FIRE_CELL - 200 + FIRE_CELL / 2);
      if (x < -60 || x > W + 60) continue;
      const z = (c.j + 0.5) / FIRE_ROWS;
      const y = world.sy(z) - (above ? 0 : world.elev(c.i * FIRE_CELL - 200, z));
      const life = Math.min(1, (t - c.t0) * 1.5, (c.until - t) / 2);
      // Smoke, drifting downwind.
      for (let k = 0; k < (above ? 2 : 3); k++) {
        const a = (t * 0.4 + k / 3 + hash(c.i, c.j, k)) % 1;
        ctx.fillStyle = `rgba(40,36,34,${(0.22 * (1 - a) * life).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + b.wind * a * 50, y - (above ? a * 18 : a * 70) - 6, 5 + a * 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      glow(x, y - 4, FIRE_CELL * 1.1, '#f97316', 0.3 * life);
      for (let k = 0; k < 6; k++) {
        const fl = hash(c.i * 7 + k, Math.floor(t * 9 + k));
        const fx = x + (hash(c.i, c.j, k) - 0.5) * FIRE_CELL;
        const fy = y + (hash(c.j, c.i, k) - 0.5) * fh * (above ? 1 : 0.6);
        ctx.fillStyle = hexA(fl < 0.4 ? '#fde68a' : fl < 0.75 ? '#fb923c' : '#ef4444', 0.85 * life);
        const hgt = (above ? 2 : 4 + fl * 6) * p;
        ctx.fillRect(Math.round(fx + b.wind * fl * 2), Math.round(fy - hgt), Math.max(1, p), hgt);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  // ---- the view from above --------------------------------------------------------------------

  type MapArt = { battle: Battle; W: number; H: number; war: number; terrain: HTMLCanvasElement; shade: HTMLCanvasElement; layout: MapLayout; scenery: SceneryAtlas };
  let map: MapArt | null = null;

  /** Depth on the field from a screen-height share (for the map's site functions). */
  const zOf = (ys: number) => (ys * H - world.groundTop) / world.depth;

  function paintMap(b: Battle) {
    const r = forkRng(host.config.seed, `map-${world.war.n}-${b.n}`);
    const layout = layoutMap(r, b.BW, world.groundTop / H, world.groundBottom / H, {
      river: b.terrain.river ? (y) => world.riverX(zOf(y)) : null,
      wall: b.siege ? (y) => world.wx(zOf(y)) : null,
      wood: b.terrain.wood ? b.terrain.wood.x : null,
    });
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
    // A hill in relief: lit from the upper left, contour lines every few paces of height.
    const hl = b.terrain.hill;
    if (hl) {
      const step = 3;
      for (let y = world.groundTop - 60; y < world.groundBottom + 60; y += step) {
        const z = (y - world.groundTop) / world.depth;
        for (let x = hl.x - hl.rx; x <= hl.x + hl.rx; x += step) {
          const e = world.elev(x, z);
          if (e <= 0.3) continue;
          const dx = world.elev(x - 4, z) - world.elev(x + 4, z);
          const dy = world.elev(x, z - 4 / world.depth) - world.elev(x, z + 4 / world.depth);
          const lit = (dx + dy) * 0.12;
          g.fillStyle = lit > 0 ? hexA(snow ? '#e2e8f0' : '#6b7f3a', Math.min(0.45, lit)) : hexA('#05070a', Math.min(0.5, -lit));
          g.fillRect(x + 200, y, step, step);
          // A contour where the height crosses a step of 8.
          if (Math.floor(e / 8) !== Math.floor(world.elev(x + step, z) / 8) || Math.floor(e / 8) !== Math.floor(world.elev(x, z + step / world.depth) / 8)) {
            g.fillStyle = hexA('#0a0d07', 0.45);
            g.fillRect(x + 200, y, 1, 1);
          }
        }
      }
    }
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
    // A town's ground behind the wall: cobbles and lanes.
    const sg = b.siege;
    if (sg) {
      g.save();
      g.beginPath();
      const yOf = (z: number) => world.groundTop + z * world.depth;
      g.moveTo(world.wx(-0.6) + 200, yOf(-0.6));
      g.lineTo(world.wx(1.6) + 200, yOf(1.6));
      g.lineTo(gw, yOf(1.6));
      g.lineTo(gw, yOf(-0.6));
      g.closePath();
      g.clip();
      g.fillStyle = snow ? '#3a3f4a' : '#24201a';
      g.fillRect(0, 0, gw, H);
      for (let i = 0; i < 5000; i++) {
        g.fillStyle = hexA(r() < 0.5 ? '#3a352e' : '#16130f', 0.5);
        g.fillRect(world.wx(0.5) + 200 + r() * (gw - world.wx(0.5)), r() * H, 2, 1);
      }
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
        [48, snow ? '#1f2633' : '#0a0e10'],
        [36, snow ? '#3a4a5c' : '#16222e'],
        [16, snow ? '#4a5d72' : '#1e3040'],
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
        const x = river(y / H) + 200 + (r() - 0.5) * 20;
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
      g.fillRect(bx - 28, by - 6, 56, 12);
      g.fillStyle = '#6b4c33';
      for (let k = -26; k < 26; k += 4) g.fillRect(bx + k, by - 5, 2, 10);
      g.fillStyle = '#2a1c12';
      g.fillRect(bx - 28, by - 7, 56, 2);
      g.fillRect(bx - 28, by + 5, 56, 2);
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

  /** The wall from above: a stone band with merlons, towers at the gate and the corners. */
  function wallAbove(sg: Siege, p: number) {
    const yOf = world.sy;
    const X = (z: number) => sx(world.wx(z));
    const T = sg.T;
    const band = (z0: number, z1: number, fill: string, inset = 0) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(X(z0) + inset, yOf(z0));
      ctx.lineTo(X(z1) + inset, yOf(z1));
      ctx.lineTo(X(z1) + T - inset, yOf(z1));
      ctx.lineTo(X(z0) + T - inset, yOf(z0));
      ctx.closePath();
      ctx.fill();
    };
    const n = sg.segs.length;
    // Shadow on the outer side, then the stone.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.moveTo(X(-0.6) + T, yOf(-0.6) + 4);
    ctx.lineTo(X(1.6) + T, yOf(1.6) + 4);
    ctx.lineTo(X(1.6) + T + 10, yOf(1.6) + 8);
    ctx.lineTo(X(-0.6) + T + 10, yOf(-0.6) + 8);
    ctx.fill();
    const stretches: [number, number][] = [[-0.6, 0]];
    for (let i = 0; i < n; i++) stretches.push([i / n, (i + 1) / n]);
    stretches.push([1, 1.6]);
    for (const [z0, z1] of stretches) {
      const seg = z0 >= 0 && z0 < 1 ? Math.floor(z0 * n) : -1;
      if (seg >= 0 && sg.segs[seg] <= 0) {
        // Breached: a gap full of rubble.
        for (let k = 0; k < 12; k++) {
          const z = z0 + hash(seg, k) * (z1 - z0);
          ctx.fillStyle = k % 2 ? STONE.top : STONE.course;
          ctx.fillRect(X(z) + hash(k, seg) * T - 2, yOf(z) - 1, 3 * p + 1, 2 * p + 1);
        }
        continue;
      }
      band(z0, z1, STONE.face);
      band(z0, z1, STONE.top, 3);
    }
    // Merlons along the outer edge.
    ctx.fillStyle = STONE.merlon;
    for (let z = -0.6; z < 1.6; z += 0.022) {
      const seg = z >= 0 && z < 1 ? Math.floor(z * n) : -1;
      if (seg >= 0 && sg.segs[seg] <= 0) continue;
      ctx.fillRect(Math.round(X(z)), Math.round(yOf(z)), 3, 3);
    }
    // The gate: oak doors, or a dark gap.
    const gz = [0.445, 0.555] as const;
    ctx.fillStyle = sg.gate.broken ? '#0c0a09' : '#5b3a1e';
    ctx.beginPath();
    ctx.moveTo(X(gz[0]) - 1, yOf(gz[0]));
    ctx.lineTo(X(gz[1]) - 1, yOf(gz[1]));
    ctx.lineTo(X(gz[1]) + T + 1, yOf(gz[1]));
    ctx.lineTo(X(gz[0]) + T + 1, yOf(gz[0]));
    ctx.fill();
    // Towers: square, darker roofs.
    for (const z of [-0.3, 0.02, 0.4, 0.6, 0.98, 1.3]) {
      const x = X(z) + T / 2;
      const y = yOf(z);
      const s = z === 0.4 || z === 0.6 ? 17 : 14;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x - s / 2 + 4, y - s / 2 + 4, s, s);
      ctx.fillStyle = STONE.face;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
      ctx.fillStyle = STONE.top;
      ctx.fillRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4);
      ctx.fillStyle = STONE.merlon;
      for (let k = 0; k < 4; k++) {
        ctx.fillRect(x - s / 2 + k * (s / 4), y - s / 2, 2, 2);
        ctx.fillRect(x - s / 2 + k * (s / 4), y + s / 2 - 2, 2, 2);
      }
    }
    // Ladders against the wall.
    ctx.strokeStyle = '#8b6b4a';
    ctx.lineWidth = 1;
    for (const l of sg.ladders) {
      const x = X(l.z);
      const y = yOf(l.z);
      ctx.beginPath();
      ctx.moveTo(x - 14, y - 2);
      ctx.lineTo(x + 3, y - 2);
      ctx.moveTo(x - 14, y + 2);
      ctx.lineTo(x + 3, y + 2);
      for (let k = -12; k < 2; k += 3) {
        ctx.moveTo(x + k, y - 2);
        ctx.lineTo(x + k, y + 2);
      }
      ctx.stroke();
    }
  }

  /** Soldiers, scenery, walkers, and banners together, back to front, with shadows under them. */
  function fieldAbove(b: Battle, t: number, p: number, m: MapArt) {
    // The fallen, subdued.
    ctx.globalAlpha = 0.5;
    for (const u of b.units) {
      if (u.alive || u.fled || u.risenAt === 0) continue;
      const x = sx(u.x);
      if (x < -40 || x > W + 40) continue;
      stamp(ctx, atlasFor(u.side), u.kind, deadFrame(u), u.facing < 0, x, uy(u), p, u.variant);
    }
    ctx.globalAlpha = 1;
    droppedBanners(b, p);
    type D = { y: number; u?: Unit; prop?: Placed; walker?: number };
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
      if (!u.alive || u.fled || u.reg.hidden) continue;
      const x = sx(u.x);
      if (x < -40 || x > W + 40) continue;
      const y = uy(u);
      list.push({ y, u });
      const r = (u.kind === 'cav' || u.kind === 'lord' ? 7 : u.kind === 'treb' || u.kind === 'tower' ? 11 : u.kind === 'ram' ? 9 : 4) * p;
      ctx.moveTo(x + r, y);
      ctx.ellipse(x, y, r, r * 0.35, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    b.walkers.forEach((w, i) => list.push({ y: world.sy(w.z), walker: i }));
    list.sort((a, c) => a.y - c.y);
    const bearers = bearersOf(b);
    for (const d of list) {
      if (d.prop) {
        stampProp(ctx, m.scenery, d.prop.prop, d.prop.variant, sx(d.prop.x), d.y, p);
        continue;
      }
      if (d.walker !== undefined) {
        const w = b.walkers[d.walker];
        stamp(ctx, atlasFor(0), 'peasant', w.wait > 0 ? 0 : Math.floor(w.anim) % 2, w.facing < 0, sx(w.x), d.y, p, w.seed % 3);
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
      if (u.std) standard(u, x, d.y, p, t);
      else if (bearers.has(u)) banner(u, x, d.y, p, t);
      if (u.kind === 'mage' && u.swingUntil > t) glow(x, d.y - 18 * p, 18 * p, world.war.factions[u.side].kit.magic, 0.5);
    }
    planted(b, p, t);
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
  /** Where a man's feet are on screen: on the hill, up the wall. From above, height barely shows. */
  const uy = (u: Unit) => world.sy(u.z) - (world.elev(u.x, u.z) + u.h) * (above ? 0.18 : 1);
  const groundY = (x: number, z: number) => world.sy(z) - world.elev(x, z) * (above ? 0.18 : 1);

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
      case 'tower':
        return world.battle.siege?.towers.find((tw) => tw.u === u)?.docked ? 2 : walk;
      case 'ram':
        return u.swingUntil > t ? 1 : 0;
    }
  }
  const deadFrame = (u: Unit) => SHAPES[u.kind].frames - 1;

  function marks(b: Battle) {
    for (const e of b.effects) {
      if (e.kind !== 'crater' && e.kind !== 'scorch' && e.kind !== 'rubble') continue;
      const x = sx(e.x);
      if (x < -80 || x > W + 80) continue;
      const y = groundY(e.x, e.z);
      if (e.kind === 'rubble') {
        ctx.fillStyle = e.color;
        ctx.fillRect(Math.round(x), Math.round(y - e.r * 0.6), Math.round(e.r * 1.4), Math.max(1, Math.round(e.r * 0.7)));
        ctx.fillStyle = STONE.top;
        ctx.fillRect(Math.round(x + 1), Math.round(y - e.r * 0.6), Math.round(e.r * 0.6), 1);
        continue;
      }
      const fade = Math.min(1, (e.t0 + e.dur - world.t) / 4);
      ctx.fillStyle = hexA(e.color, (e.kind === 'crater' ? 0.55 : 0.4) * fade);
      ctx.beginPath();
      ctx.ellipse(x, y, e.r, e.r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Spent arrows in the turf.
    ctx.strokeStyle = 'rgba(214,211,196,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const s of b.shots) {
      if (!s.landed || s.kind !== 'arrow' || s.air || s.h1 > 4) continue;
      const x = sx(s.x1);
      const y = groundY(s.x1, s.z1);
      const lean = s.x1 > s.x0 ? 3 : -3;
      ctx.moveTo(x, y);
      ctx.lineTo(x - lean, y - 6);
    }
    ctx.stroke();
  }

  /** The middle man of each block's front rank carries its banner. */
  function bearersOf(b: Battle) {
    const bearers = new Set<Unit>();
    for (const g of b.regs) {
      if (g.routed || g.hidden || g.kind === 'arch' || g.kind === 'mage' || isEngine(g.kind) || g.name.endsWith('GUARD')) continue;
      const front = g.units.filter((u) => u.alive && !u.fled && u.rank === 0);
      if (front.length) bearers.add(front[Math.floor(front.length / 2)]);
    }
    return bearers;
  }

  type Item = { z: number; x: number; u?: Unit; slice?: [number, number]; walker?: number; ladder?: number; keep?: true };

  function armies(b: Battle, t: number, p: number) {
    const sg = b.siege;
    // The fallen first, flat on the field and subdued, so the living stand out.
    ctx.globalAlpha = 0.5;
    for (const u of b.units) {
      if (u.fled || u.alive || u.risenAt === 0) continue;
      const x = sx(u.x);
      if (x < -60 || x > W + 60) continue;
      // Engines leave their wrecks at full strength (drawn with the living).
      if (isEngine(u.kind)) continue;
      stamp(ctx, atlasFor(u.side), u.kind, deadFrame(u), u.facing < 0, x, uy(u), p, u.variant);
    }
    ctx.globalAlpha = 1;
    droppedBanners(b, p);
    const items: Item[] = [];
    for (const u of b.units) {
      if (u.fled || u.reg.hidden) continue;
      if (!u.alive && !isEngine(u.kind)) continue;
      const x = sx(u.x);
      if (x < -80 || x > W + 80) continue;
      items.push({ z: u.z, x: u.x, u });
    }
    b.walkers.forEach((w, i) => items.push({ z: w.z, x: w.x, walker: i }));
    if (sg) {
      // The wall in slices, so men on both sides of it sort in front of and behind it.
      const n = 40;
      for (let i = 0; i < n; i++) {
        const za = -0.05 + (i / n) * 1.15;
        items.push({ z: za, x: world.wx(za), slice: [za, za + 1.15 / n] });
      }
      sg.ladders.forEach((l, i) => items.push({ z: l.z + 0.012, x: world.wx(l.z), ladder: i }));
      items.push({ z: -0.06, x: world.wx(0) + 180, keep: true });
    }
    items.sort((a, c) => a.z - c.z || a.x - c.x);
    const bearers = bearersOf(b);
    for (const it of items) {
      if (it.slice) {
        wallSlice(sg!, it.slice[0], it.slice[1], t, p);
        continue;
      }
      if (it.ladder !== undefined) {
        ladder(sg!, sg!.ladders[it.ladder].z);
        continue;
      }
      if (it.keep) {
        keep(sg!, p, t);
        continue;
      }
      if (it.walker !== undefined) {
        const w = b.walkers[it.walker];
        stamp(ctx, atlasFor(0), 'peasant', w.wait > 0 ? 0 : Math.floor(w.anim) % 2, w.facing < 0, sx(w.x), groundY(w.x, w.z), p, w.seed % 3);
        continue;
      }
      const u = it.u!;
      const x = sx(u.x);
      const y = uy(u);
      const atlas = atlasFor(u.side);
      if (!u.alive) {
        stamp(ctx, atlas, u.kind, deadFrame(u), u.facing < 0, x, y, p);
        continue;
      }
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
      if (u.std) standard(u, x, y, p, t);
      else if (bearers.has(u)) banner(u, x, y, p, t);
      if (u.kind === 'mage' && u.swingUntil > t) glow(x, y - 18 * p, 18 * p, world.war.factions[u.side].kit.magic, 0.5);
    }
    planted(b, p, t);
  }

  // ---- the wall, side-on ------------------------------------------------------------------------

  /**
   * One slice of the wall, from depth za to zb: its face toward the attackers (a leaning
   * parallelogram), the walkway on top, merlons; the gate, breaches, and towers where they fall.
   */
  function wallSlice(sg: Siege, za: number, zb: number, t: number, p: number) {
    const X = (z: number) => sx(world.wx(z));
    const Y = world.sy;
    if (X(za) > W + 60 || X(zb) + sg.T < -60) return;
    const n = sg.segs.length;
    const zm = (za + zb) / 2;
    const seg = zm >= 0 && zm < 1 ? Math.floor(zm * n) : -1;
    const breached = seg >= 0 && sg.segs[seg] <= 0;
    // How high this stretch stands: breaches are stumps; the ends run on off the field.
    const Hs = breached ? 12 : sg.H;
    const face = (h0: number, h1: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(X(za), Y(za) - h1);
      ctx.lineTo(X(zb), Y(zb) - h1);
      ctx.lineTo(X(zb), Y(zb) - h0);
      ctx.lineTo(X(za), Y(za) - h0);
      ctx.closePath();
      ctx.fill();
    };
    // Lit a little along its length, as the light rakes it.
    const lit = 0.5 + 0.5 * Math.sin(zm * 9 + 1);
    face(0, Hs, rgb(mixRgb(STONE.face, STONE.faceLit, lit * 0.6)));
    // Courses of stone, and the odd joint.
    ctx.strokeStyle = STONE.course;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let h = 7; h < Hs; h += 7) {
      ctx.moveTo(X(za), Y(za) - h);
      ctx.lineTo(X(zb), Y(zb) - h);
    }
    for (let h = 0; h < Hs - 3; h += 7) {
      const k = hash(Math.floor(za * 400), h);
      if (k > 0.55) continue;
      const z = za + k * (zb - za);
      ctx.moveTo(X(z), Y(z) - h);
      ctx.lineTo(X(z), Y(z) - h - 7);
    }
    ctx.stroke();
    // Damage: dark patches where the stones have struck.
    if (seg >= 0 && !breached && sg.segs[seg] < 9) {
      ctx.fillStyle = 'rgba(12,10,9,0.45)';
      for (let k = 0; k < 9 - sg.segs[seg]; k++) {
        const z = za + hash(seg, k) * (zb - za);
        const h = Hs * (0.3 + hash(k, seg) * 0.6);
        ctx.fillRect(X(z) - 2, Y(z) - h, 6, 4);
      }
    }
    if (breached) {
      // Rubble heaped where it came down.
      ctx.fillStyle = STONE.course;
      for (let k = 0; k < 6; k++) {
        const z = za + hash(seg, k, 5) * (zb - za);
        ctx.fillRect(X(z) - 6 + hash(k, 2) * 10, Y(z) - Hs - 3 - hash(k, seg) * 5, 4 + hash(seg, k) * 5, 4);
      }
    }
    // The gate: an arch in the face, oak doors or a dark mouth.
    if (zm > 0.445 && zm < 0.555) {
      const gh = sg.H * 0.58;
      ctx.fillStyle = sg.gate.broken ? '#0a0908' : '#4a2f18';
      ctx.beginPath();
      ctx.moveTo(X(za), Y(za));
      ctx.lineTo(X(za), Y(za) - gh + Math.abs(zm - 0.5) * 140);
      ctx.lineTo(X(zb), Y(zb) - gh + Math.abs(zm - 0.5) * 140);
      ctx.lineTo(X(zb), Y(zb));
      ctx.closePath();
      ctx.fill();
      if (!sg.gate.broken) {
        ctx.fillStyle = '#2a1a0e';
        ctx.fillRect(X(za), Y(za) - gh * 0.5, Math.max(1, X(zb) - X(za)), 2);
        // Iron studs; it shudders when the ram strikes.
        const shake = sg.ram?.swingUntil && sg.ram.swingUntil > t ? 1 : 0;
        ctx.fillStyle = '#57534e';
        ctx.fillRect(X(zm) + shake, Y(zm) - gh * 0.3, 2, 2);
      }
    }
    // The walkway on top.
    if (!breached) {
      ctx.fillStyle = STONE.top;
      ctx.beginPath();
      ctx.moveTo(X(za), Y(za) - Hs);
      ctx.lineTo(X(zb), Y(zb) - Hs);
      ctx.lineTo(X(zb) + sg.T, Y(zb) - Hs);
      ctx.lineTo(X(za) + sg.T, Y(za) - Hs);
      ctx.closePath();
      ctx.fill();
      // Merlons on the outer edge.
      ctx.fillStyle = STONE.merlon;
      for (let z = Math.ceil(za / 0.024) * 0.024; z < zb; z += 0.048) {
        ctx.fillRect(Math.round(X(z)), Math.round(Y(z) - Hs - 7), 6, 7);
        ctx.fillStyle = STONE.dark;
        ctx.fillRect(Math.round(X(z)) + 5, Math.round(Y(z) - Hs - 7), 1, 7);
        ctx.fillStyle = STONE.merlon;
      }
    }
    // Towers: two flanking the gate, one at each end.
    for (const tz of [0.02, 0.4, 0.6, 0.98]) {
      if (tz < za || tz >= zb) continue;
      const big = tz === 0.4 || tz === 0.6;
      const th = sg.H * (big ? 1.45 : 1.3);
      const tw = big ? 40 : 34;
      const x = X(tz) - 7;
      const y = Y(tz);
      const g = ctx.createLinearGradient(x, 0, x + tw, 0);
      g.addColorStop(0, STONE.dark);
      g.addColorStop(0.35, STONE.faceLit);
      g.addColorStop(1, STONE.face);
      ctx.fillStyle = g;
      ctx.fillRect(x, y - th, tw, th);
      ctx.strokeStyle = STONE.course;
      ctx.beginPath();
      for (let h = 8; h < th; h += 8) {
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + tw, y - h);
      }
      ctx.stroke();
      ctx.fillStyle = STONE.merlon;
      for (let k = 0; k < tw; k += 9) ctx.fillRect(x + k, y - th - 7, 6, 7);
      // An arrow slit, lit.
      ctx.fillStyle = hexA('#fbbf24', 0.6);
      ctx.fillRect(x + tw / 2, y - th * 0.6, 2, 6);
      if (big) {
        // The defenders' colors over the gate.
        const f = world.war.factions[sg.side];
        ctx.fillStyle = '#3f2a17';
        ctx.fillRect(x + tw / 2, y - th - 30, 2, 24);
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.moveTo(x + tw / 2 + 2, y - th - 30);
        for (let i = 0; i <= 5; i++) ctx.lineTo(x + tw / 2 + 2 + i * 3, y - th - 30 + Math.sin(t * 4 + i + tz * 9) * 1.5);
        for (let i = 5; i >= 0; i--) ctx.lineTo(x + tw / 2 + 2 + i * 3, y - th - 22 + Math.sin(t * 4 + i + tz * 9) * 1.5);
        ctx.fill();
      }
    }
    void p;
  }

  function ladder(sg: Siege, z: number) {
    const x = sx(world.wx(z));
    const y = world.sy(z);
    ctx.strokeStyle = '#8b6b4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 16, y);
    ctx.lineTo(x - 1, y - sg.H - 4);
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 5, y - sg.H - 4);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0.08; k < 1; k += 0.1) {
      ctx.moveTo(x - 16 + 15 * k, y - (sg.H + 4) * k);
      ctx.lineTo(x - 10 + 15 * k, y - (sg.H + 4) * k);
    }
    ctx.stroke();
  }

  /** The keep inside the walls, standing over the town. */
  function keep(sg: Siege, p: number, t: number) {
    const x = sx(world.wx(0.05) + sg.T + 150);
    if (x < -200 || x > W + 200) return;
    const y = world.sy(0.04);
    const kh = sg.H * 2.4;
    const kw = 110;
    ctx.fillStyle = STONE.dark;
    ctx.fillRect(x, y - kh, kw, kh);
    const g = ctx.createLinearGradient(x, 0, x + kw, 0);
    g.addColorStop(0, '#2c2a27');
    g.addColorStop(0.4, STONE.face);
    g.addColorStop(1, '#2c2a27');
    ctx.fillStyle = g;
    ctx.fillRect(x + 4, y - kh, kw - 8, kh);
    // Corner turrets and a high tower.
    ctx.fillStyle = STONE.face;
    ctx.fillRect(x - 8, y - kh - 22, 22, kh + 22);
    ctx.fillRect(x + kw - 14, y - kh - 22, 22, kh + 22);
    ctx.fillRect(x + kw / 2 - 16, y - kh - 50, 32, 50);
    ctx.fillStyle = STONE.merlon;
    for (const [tx, tw, ty] of [
      [x - 8, 22, y - kh - 22],
      [x + kw - 14, 22, y - kh - 22],
      [x + kw / 2 - 16, 32, y - kh - 50],
    ] as const) for (let k = 0; k < tw; k += 7) ctx.fillRect(tx + k, ty - 6, 5, 6);
    // Windows: lit.
    for (let i = 0; i < 6; i++) {
      const on = 0.45 + 0.25 * Math.sin(t * 0.7 + i * 2.1);
      ctx.fillStyle = hexA('#fbbf24', on);
      ctx.fillRect(x + 16 + (i % 3) * 32, y - kh * 0.35 - Math.floor(i / 3) * kh * 0.3, 3, 6);
    }
    const f = world.war.factions[sg.side];
    ctx.fillStyle = '#3f2a17';
    ctx.fillRect(x + kw / 2, y - kh - 86, 2, 36);
    ctx.fillStyle = f.color;
    ctx.beginPath();
    ctx.moveTo(x + kw / 2 + 2, y - kh - 86);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + kw / 2 + 2 + i * 4, y - kh - 86 + Math.sin(t * 3 + i) * 2);
    for (let i = 6; i >= 0; i--) ctx.lineTo(x + kw / 2 + 2 + i * 4, y - kh - 74 + Math.sin(t * 3 + i) * 2);
    ctx.fill();
    void p;
  }

  // ---- banners ------------------------------------------------------------------------------

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

  /** The side's standard: tall, square, with a device on it, a cross-bar, and a finial. */
  function standard(u: Unit, x: number, y: number, p: number, t: number) {
    const f = world.war.factions[u.side];
    const top = y - 46 * p;
    const px = Math.round(x - u.facing * 3 * p);
    ctx.fillStyle = '#3f2a17';
    ctx.fillRect(px, top, Math.max(1, p), 40 * p);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px - p, top - 2 * p, p * 3, p * 2);
    const w = 16 * p;
    const h = 13 * p;
    ctx.fillRect(px - u.facing * w, top + p, w, Math.max(1, p * 0.6));
    const wave = (k: number, i: number) => Math.sin(t * 3.5 + k * 3 + u.id) * 1.8 * p * k + i;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(px - u.facing * w * (i / 6), top + 2 * p + wave(i / 6, 0));
    for (let i = 6; i >= 0; i--) ctx.lineTo(px - u.facing * w * (i / 6), top + 2 * p + h + wave(i / 6, 0) - (i % 2 ? 2 * p : 0));
    ctx.closePath();
    ctx.fill();
    // A device: a light diamond on the field.
    const cx = px - u.facing * w * 0.5;
    const cy = top + 2 * p + h * 0.5 + wave(0.5, 0);
    ctx.fillStyle = mixRgbHex(f.color, '#fef3c7', 0.65);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4 * p);
    ctx.lineTo(cx + 3 * p, cy);
    ctx.lineTo(cx, cy + 4 * p);
    ctx.lineTo(cx - 3 * p, cy);
    ctx.fill();
  }

  /** Banners lying in the mud where they fell. */
  function droppedBanners(b: Battle, p: number) {
    for (const d of b.dropped) {
      const x = sx(d.x);
      if (x < -40 || x > W + 40) continue;
      const y = groundY(d.x, d.z);
      const f = world.war.factions[d.side];
      const dir = hash(d.seed, 1) < 0.5 ? -1 : 1;
      ctx.strokeStyle = '#3f2a17';
      ctx.lineWidth = Math.max(1, p * 0.75);
      ctx.beginPath();
      ctx.moveTo(x - dir * 12 * p, y);
      ctx.lineTo(x + dir * 12 * p, y - 3 * p);
      ctx.stroke();
      ctx.fillStyle = mixRgbHex(f.color, '#1c1917', 0.35);
      ctx.beginPath();
      ctx.moveTo(x + dir * 10 * p, y - 3 * p);
      ctx.lineTo(x + dir * 2 * p, y - 1 * p);
      ctx.lineTo(x + dir * 3 * p, y + 3 * p);
      ctx.lineTo(x + dir * 11 * p, y + 1 * p);
      ctx.fill();
    }
  }

  /** The victors' banner, planted where the fighting was. */
  function planted(b: Battle, p: number, t: number) {
    const pl = b.planted;
    if (!pl) return;
    const x = sx(pl.x);
    if (x < -60 || x > W + 60) return;
    const y = groundY(pl.x, pl.z);
    const f = world.war.factions[pl.side];
    const age = Math.min(1, (t - b.phaseAt) * 0.8);
    const tall = 58 * p * (b.phase === 'aftermath' ? age : 1);
    ctx.fillStyle = '#3f2a17';
    ctx.fillRect(Math.round(x), y - tall, Math.max(1, p), tall);
    if (tall < 30 * p) return;
    ctx.fillStyle = f.color;
    ctx.beginPath();
    const w = 18 * p;
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + 1 + w * (i / 6), y - tall + Math.sin(t * 3 + i) * 1.6 * p * (i / 6));
    for (let i = 6; i >= 0; i--) ctx.lineTo(x + 1 + w * (i / 6), y - tall + 12 * p + Math.sin(t * 3 + i) * 1.6 * p * (i / 6));
    ctx.fill();
  }

  const mixRgbHex = (a: string, c: string, k: number) => rgb(mixRgb(a, c, k));

  /** Soft round glows, one cached sprite per color: far cheaper than a gradient per call. */
  const glows = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (r <= 0 || a <= 0) return;
    let s = glows.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glows.set(color, s);
    }
    const prev = ctx.globalAlpha;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.globalAlpha = prev * Math.min(1, a);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.imageSmoothingEnabled = smooth;
    ctx.globalAlpha = prev;
  }

  function shotPos(s: Shot, t: number) {
    const k = Math.max(0, Math.min(1, (t - s.t0) / s.dur));
    const x = s.x0 + (s.x1 - s.x0) * k;
    const z = s.z0 + (s.z1 - s.z0) * k;
    const h = s.h0 * (1 - k) + s.h1 * k + 4 * s.peak * k * (1 - k);
    return { x, z, h, k };
  }
  const shotY = (q: { z: number; h: number }) => world.sy(q.z) - q.h * (above ? 0.5 : 1);

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
      const y = shotY(a);
      const dx = x - sx(c.x);
      const dy = y - shotY(c);
      const len = Math.hypot(dx, dy) || 1;
      ctx.moveTo(x, y);
      ctx.lineTo(x - (dx / len) * 5 * p, y - (dy / len) * 5 * p);
    }
    ctx.stroke();
    for (const s of b.shots) {
      if (s.landed || t < s.t0 || s.kind === 'arrow') continue;
      const a = shotPos(s, t);
      const x = sx(a.x);
      const y = shotY(a);
      if (s.kind === 'boulder') {
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.arc(x, y, 3 * p, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(x, world.sy(a.z), 4 * p * Math.max(0.2, 1 - a.h / 400), p, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const color = world.war.factions[s.side].kit.magic;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 6; i >= 0; i--) {
          const q = shotPos(s, t - i * 0.035);
          glow(sx(q.x), shotY(q), (8 - i) * p * 1.2, color, 0.35 * (1 - i / 7));
        }
        glow(x, y, 6 * p, '#ffffff', 0.8);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
  }

  function effects(b: Battle, t: number, p: number) {
    ctx.save();
    const hk = above ? 0.5 : 1;
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
      if (x < -400 || x > W + 400) continue;
      const ground = groundY(e.x, z);
      const y = ground - e.h * hk;
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
          ctx.ellipse(x, ground + 4, rx, ry, 0, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Runes turning around the rim.
          for (let i = 0; i < 6; i++) {
            const a = Math.PI + ((i + t * 0.3) % 6) / 6 * Math.PI;
            ctx.fillStyle = hexA(e.color, 0.8 * fade);
            ctx.fillRect(x + Math.cos(a) * rx - 1, ground + 4 + Math.sin(a) * ry - 1, 2, 2);
          }
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'flare': {
          // Magelight: a slow star sinking over the field, its light pooled on the ground.
          const fade = Math.min(1, age * 1.5, (e.dur - age) / 1.5);
          const fy = ground - (e.h - age * 11) * hk;
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = hexA(e.color, 0.07 * fade);
          ctx.beginPath();
          ctx.ellipse(x, ground, e.r * 0.8, e.r * 0.8 * (above ? 0.8 : 0.22), 0, 0, Math.PI * 2);
          ctx.fill();
          glow(x, fy, 60 * fade, e.color, 0.5 * fade);
          glow(x, fy, 10, '#ffffff', 0.95 * fade);
          // Sparks falling from it.
          for (let i = 0; i < 6; i++) {
            const a = (t * 0.8 + hash(e.seed, i)) % 1;
            ctx.fillStyle = hexA(e.color, (1 - a) * fade);
            ctx.fillRect(x + (hash(e.seed, i, 2) - 0.5) * 18, fy + a * 40, 1, 2);
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
            ctx.ellipse(x + (hash(e.seed, i, 3) - 0.5) * e.r, y - d * (above ? 0.1 : 0.4), d * 0.7, d * (above ? 0.6 : 0.35), 0, 0, Math.PI * 2);
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
    const y = ground - d.h * (above ? 0.6 : 1);
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
      stamp(ctx, atlas, 'crow', fly ? Math.floor(t * 6 + c.seed) % 2 : 1, c.vx < 0, x, world.sy(c.z) - c.h * (above ? 0.5 : 1), p);
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

  // ---- the dark -------------------------------------------------------------------------------

  let lightSprite: HTMLCanvasElement | null = null;
  let darkness: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; W: number; H: number; dpr: number } | null = null;

  const torchOf = (u: Unit) => u.alive && !u.fled && !u.reg.hidden && (u.std || u.kind === 'lord' || (u.id % 5 === 0 && (u.kind === 'inf' || u.kind === 'cav' || u.kind === 'arch')));

  /**
   * Night: the field goes dark but for its lights. Torches carried in the ranks, the camps,
   * fires, spells, the dragon's breath, and magelight hanging over everything for a while.
   */
  function night(b: Battle, t: number, p: number) {
    if (b.weather !== 'night') return;
    const dpr = host.viewport.dpr || 1;
    if (!lightSprite) {
      lightSprite = document.createElement('canvas');
      lightSprite.width = lightSprite.height = 128;
      const g = lightSprite.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.45, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
    }
    // The dark is soft-edged anyway: kept at a quarter of the CSS size, laid over smooth.
    if (!darkness || darkness.W !== W || darkness.H !== H || darkness.dpr !== dpr) {
      const c = document.createElement('canvas');
      c.width = Math.ceil(W / 4);
      c.height = Math.ceil(H / 4);
      darkness = { c, g: c.getContext('2d')!, W, H, dpr };
    }
    const g = darkness.g;
    g.setTransform(0.25, 0, 0, 0.25, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(2,4,12,0.35)');
    shade.addColorStop(above ? 0.2 : world.groundTop / H, 'rgba(2,4,12,0.7)');
    shade.addColorStop(1, 'rgba(2,4,12,0.8)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
    // Lightning and smiting light the whole field for a breath.
    if (b.flash > 0) {
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = `rgba(0,0,0,${Math.min(0.8, b.flash * 2.5).toFixed(3)})`;
      g.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, a: number) => {
      if (x < -r || x > W + r || y < -r || y > H + r) return;
      g.globalAlpha = Math.min(1, a);
      g.drawImage(lightSprite!, x - r, y - r * (above ? 1 : 0.6), r * 2, r * 2 * (above ? 1 : 0.6));
    };
    const torches: [number, number][] = [];
    for (const u of b.units) {
      if (!torchOf(u)) continue;
      const x = sx(u.x);
      if (x < -60 || x > W + 60) continue;
      const y = uy(u) - 13 * p;
      const fl = 0.85 + 0.15 * Math.sin(t * 11 + u.id);
      hole(x, y + 10 * p, 46 * fl, 0.85);
      torches.push([x + u.facing * 5 * p, y]);
    }
    for (const e of b.effects) {
      const x = sx(e.x);
      const y = groundY(e.x, e.z) - e.h * (above ? 0.5 : 1);
      const k = (t - e.t0) / e.dur;
      if (e.kind === 'flare') {
        const fade = Math.min(1, (t - e.t0) * 1.5, (e.dur - (t - e.t0)) / 1.5);
        hole(x, groundY(e.x, e.z), e.r, fade);
        hole(x, y - (t - e.t0) * 11, 90, fade);
      } else if (e.kind === 'blast') hole(x, y, 150, 1 - k);
      else if (e.kind === 'fire') hole(x, y, 80, 0.8 * (1 - k));
      else if (e.kind === 'bolt' || e.kind === 'smite') hole(x, y, 240, 1 - k);
      else if (e.kind === 'ward') hole(x, groundY(e.x, e.z), 90, 0.5);
    }
    for (const s of b.shots) {
      if (s.kind !== 'fireball' || s.landed || t < s.t0) continue;
      const q = shotPos(s, t);
      hole(sx(q.x), shotY(q), 70, 0.9);
    }
    for (const c of b.fire.cells.values()) hole(sx(c.i * FIRE_CELL - 200 + FIRE_CELL / 2), world.sy((c.j + 0.5) / FIRE_ROWS), 70, 0.9);
    const d = b.dragon;
    if (d?.breathing) hole(sx(d.x), world.sy(d.z), 160, 0.9);
    if (!above && backdrop) for (const f of backdrop.fires) hole(f.x - camX * 0.8 - 60, world.groundTop - 50 + f.y, 30, 0.8);
    if (above && map) for (const l of map.layout.lights) hole(sx(l.x), l.y * H, l.r * 2.2, 0.7);
    g.globalAlpha = 1;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(darkness.c, 0, 0, W, H);
    ctx.imageSmoothingEnabled = smooth;
    // The torches' flames, over the dark.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, [x, y]] of torches.entries()) {
      const fl = 0.7 + 0.3 * Math.sin(t * 13 + i * 1.9);
      glow(x, y, 9 * p * fl, '#fb923c', 0.5);
      ctx.fillStyle = hexA('#fde68a', 0.9 * fl);
      ctx.fillRect(Math.round(x), Math.round(y - p), Math.max(1, p), Math.max(1, p * 2));
    }
    ctx.restore();
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
      let y = Math.max(28, world.sy(l.z) - l.h * (above ? 0.6 : 1));
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
    fillCrisp(ctx, `THE ${b.siege ? 'SIEGE' : 'FIELD'} OF ${b.name} · DAY ${b.day}${b.weather === 'night' ? ' · NIGHT' : ''}`, 16, 26);
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a8a29e', 0.8 * level);
    fillCrisp(ctx, `THE WAR OF ${world.war.name} · BATTLE ${b.n + 1}`, 16, 42);
    ctx.textAlign = 'right';
    ctx.font = serif(12);
    const score = `${fa.name}  ${world.war.wins[0]} · ${world.war.wins[1]}  ${fb.name}`;
    ctx.fillStyle = hexA('#e7dcc4', 0.8 * level);
    fillCrisp(ctx, score, W - 16, 26);
    ctx.fillStyle = fa.color;
    ctx.fillRect(W - 16 - ctx.measureText(score).width - 10, 18, 6, 6);
    ctx.fillStyle = fb.color;
    ctx.fillRect(W - 12, 18, 6, 6);
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
      wear = null;
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
        const wl = wearLayer(b, t);
        if (wl) ctx.drawImage(wl, Math.round(-camX - 200), 0, wl.width * 2, wl.height * 2);
        ctx.imageSmoothingEnabled = false;
        marks(b);
        if (b.siege) wallAbove(b.siege, p);
        fieldAbove(b, t, p, m);
        ctx.imageSmoothingEnabled = true;
        grassFire(b, t, p);
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
        night(b, t, p);
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
      const wl = wearLayer(b, t);
      if (wl) ctx.drawImage(wl, Math.round(-camX - 200), world.groundTop, wl.width * 2, wl.height * 2);
      woodSide(bd, b);
      ctx.imageSmoothingEnabled = false;
      marks(b);
      armies(b, t, p);
      dragon(b, t, p);
      ctx.imageSmoothingEnabled = true;
      grassFire(b, t, p);
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
      night(b, t, p);
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
      wear = null;
      atlases = null;
      darkness = null;
      dragonAtlases.clear();
    },
  };
}

export type { Effect };
