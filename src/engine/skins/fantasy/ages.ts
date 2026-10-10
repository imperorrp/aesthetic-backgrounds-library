/**
 * Ages' mount: the continent (ages-sim.ts), painted from above at dusk.
 *
 * The sim thinks in hexes; the painting does not. Caches:
 *   relief     the land from its own height and wetness field, at fine resolution: hillshade
 *              from the upper left, shallows and a coastline traced by marching squares
 *              (for a new age or a resize)
 *   features   rivers as meandering curves that widen downstream, woods and peaks placed by
 *              the land itself, woken volcanoes (when woods are cleared or a mountain wakes)
 *   politics   fields around the towns, each realm's land washed in its color with a border
 *              traced around it, roads as curves that wear wider with traffic (when borders,
 *              roads, or towns change)
 * Live: towns built in the style of their era (huts, timber, stone, palaces; palisades,
 * walls, star forts), wonders rising under scaffolding, caravans, ships of the age, armies,
 * fire, plague, floods, a volcano's plume, a dragon, call-outs, the ruler, the chronicle,
 * and a ribbon of the age's history along the bottom.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { AGES_SCHEMA } from './index';
import { AGE_YEARS, createAgesWorld, ERA_YEARS, ERAS, regnal, type Kingdom, type Tile, type Town, type Walker } from './ages-sim';
import { buildAtlas, stamp, type Atlas, type Kit } from './sprites';
import { DRAGONS, serif } from './names';
import { buildScenery, stampProp, type Prop, type SceneryAtlas } from './scenery';
import { blur3, isoPath } from './iso';

/** Terrain colors at dusk: low, so page text stays legible over the whole map. */
const C = {
  deep: '#04080f',
  sea: '#08131d',
  shallow: '#10222c',
  sand: '#2e2a1b',
  dry: '#262818',
  plain: '#1b2714',
  lush: '#16240f',
  forest: '#0f1c0d',
  hill: '#2a2a1b',
  rock: '#34333a',
  snow: '#727a86',
  river: '#1b3448',
  riverHi: '#2b4d66',
};

const HOUSES = [2, 4, 7, 10, 13];
const REACH = [1.5, 2.2, 3, 3.8, 4.6];

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(AGES_SCHEMA, host.options) as { speed: number; kingdoms: number; wars: number; disasters: number; dragons: number; labels: boolean; hud: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world = createAgesWorld(host.config.seed, W, H, host.noise, { speed: o.speed, kingdoms: o.kingdoms, wars: o.wars, disasters: o.disasters, dragons: o.dragons });
  let nextAmbience = 0;

  // Land coordinates to the screen (the land keeps the size it was made for).
  const kx = () => W / world.landW;
  const ky = () => H / world.landH;
  const X = (x: number) => x * kx();
  const Y = (y: number) => y * ky();

  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const sx = typeof e.x === 'number' ? X(e.x) : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (sx / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });

  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    world.step(dt);
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      const armies = world.walkers.filter((w) => w.kind === 'army').length;
      host.events.emit({ type: 'ambience', weight: Math.min(1, armies / 6), pan: 0, near: 1 });
    }
  };

  const P = () => {
    const dpr = host.viewport.dpr || 1;
    return Math.max(1, Math.round((H >= 1000 ? 1.9 : 1.4) * dpr)) / dpr;
  };

  // ---- caches -------------------------------------------------------------------------------

  /** The land's height and wetness, sampled every 2 px of screen (shared by the caches). */
  type Field = { gen: number; W: number; H: number; cell: number; cols: number; rows: number; E: Float32Array; M: Float32Array };
  let field: Field | null = null;
  let relief: { gen: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  let features: { key: string; c: HTMLCanvasElement } | null = null;
  let politics: { v: string; at: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  let scenery: SceneryAtlas | null = null;
  let shade: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  const atlases = new Map<number, Atlas>();
  let dragonAtlas: Atlas | null = null;

  const dprC = () => Math.min(2, host.viewport.dpr || 1);
  const canvas = (w: number, h: number, scale = 1) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * scale));
    c.height = Math.max(1, Math.ceil(h * scale));
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    return { c, g };
  };
  const atlasFor = (k: Kingdom) => {
    let a = atlases.get(k.id);
    if (!a) {
      a = buildAtlas(k.faction.kit);
      atlases.set(k.id, a);
    }
    return a;
  };

  function sampleField(): Field {
    const cell = 2;
    const cols = Math.ceil(W / cell) + 2;
    const rows = Math.ceil(H / cell) + 2;
    const E = new Float32Array(cols * rows);
    const M = new Float32Array(cols * rows);
    const sx = world.landW / W;
    const sy = world.landH / H;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const lx = i * cell * sx;
        const ly = j * cell * sy;
        const { elev, moist } = world.elevAt(lx, ly);
        // A little fine grain, so slopes catch the light like real ground.
        E[j * cols + i] = elev + host.noise.noise2(lx * 0.09, ly * 0.09) * 0.012;
        M[j * cols + i] = moist;
      }
    }
    return { gen: world.landVersion, W, H, cell, cols, rows, E, M };
  }
  const fieldAt = (f: Field, x: number, y: number) => {
    const i = Math.max(0, Math.min(f.cols - 1, Math.round(x / f.cell)));
    const j = Math.max(0, Math.min(f.rows - 1, Math.round(y / f.cell)));
    return j * f.cols + i;
  };

  function paintRelief(f: Field) {
    const { c, g } = canvas(W, H, dprC());
    const { cols, rows, E, M, cell } = f;
    const tmp = canvas(cols, rows);
    const img = tmp.g.createImageData(cols, rows);
    const d = img.data;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const e = E[k];
        const m = M[k];
        let col: [number, number, number];
        if (e < 0) {
          // Water: deeper is darker; a lighter shelf near the shore.
          col = e < -0.2 ? mixRgb(C.deep, C.sea, Math.max(0, (e + 0.5) / 0.3)) : mixRgb(C.sea, C.shallow, Math.max(0, (e + 0.2) / 0.2) ** 1.6);
        } else {
          if (e < 0.035) col = mixRgb(C.sand, C.plain, e / 0.035);
          else if (e > 0.5) col = mixRgb(C.rock, C.snow, Math.min(0.75, Math.max(0, (e - 0.74) / 0.14)));
          else if (e > 0.33) col = mixRgb(C.hill, C.rock, (e - 0.33) / 0.17);
          else col = m > 0.57 ? mixRgb(C.lush, C.forest, Math.min(1, (m - 0.57) * 6)) : mixRgb(C.dry, C.plain, Math.min(1, Math.max(0, (m - 0.3) * 3.5)));
          // Hillshade: the slope toward the upper-left light.
          const a = E[Math.max(0, j - 1) * cols + Math.max(0, i - 1)];
          const b = E[Math.min(rows - 1, j + 1) * cols + Math.min(cols - 1, i + 1)];
          const light = Math.max(-1, Math.min(1, (a - b) * 22));
          const lift = 1 + light * (e > 0.33 ? 0.42 : 0.3);
          col = [col[0] * lift, col[1] * lift, col[2] * lift];
        }
        d[k * 4] = col[0];
        d[k * 4 + 1] = col[1];
        d[k * 4 + 2] = col[2];
        d[k * 4 + 3] = 255;
      }
    }
    tmp.g.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(tmp.c, 0, 0, cols * cell, rows * cell);
    // The shelf's edge, faint, and the coast, pale: traced, not stepped.
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(148,163,184,0.07)';
    g.lineWidth = 1;
    g.beginPath();
    isoPath(g, E, cols, rows, cell, -0.07);
    g.stroke();
    g.strokeStyle = 'rgba(203,213,225,0.2)';
    g.lineWidth = 1.1;
    g.beginPath();
    isoPath(g, E, cols, rows, cell, 0);
    g.stroke();
    relief = { gen: f.gen, W, H, c };
  }

  /** Where a tile's center is drawn: nudged off the hex lattice (towns keep their place). */
  const spot = (t: Tile): [number, number] => {
    if (t.town && !t.town.ruined) return [X(t.x), Y(t.y)];
    const s = world.grid.size * 0.42;
    return [X(t.x + (hash(t.q * 7 + 1000, t.r * 13 + 1000, 9) - 0.5) * s), Y(t.y + (hash(t.q * 7 + 1000, t.r * 13 + 1000, 10) - 0.5) * s)];
  };
  const mid = (a: Tile, b: Tile): [number, number] => {
    const p = spot(a);
    const q = spot(b);
    return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  };
  const sea = (t: Tile) => t.terrain === 'sea' || t.terrain === 'deep';

  /** How far the axe has reached around a town (screen px). */
  const clearReach = (town: Town) => world.grid.size * kx() * (0.6 + town.tier * 0.45 + world.era * 0.12);

  function paintFeatures(f: Field, key: string) {
    const { c, g } = canvas(W, H, dprC());
    const s = scenery!;
    const p = P();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // Rivers: each stretch a curve from where the last met it, through its own (nudged) middle, on.
    const ups = new Map<Tile, Tile[]>();
    for (const t of world.tiles) if (t.river && t.down) (ups.get(t.down) ?? ups.set(t.down, []).get(t.down)!).push(t);
    for (const pass of [0, 1]) {
      for (const t of world.tiles) {
        if (!t.river) continue;
        const w = 0.7 + Math.min(3.2, t.flow * 0.55);
        g.strokeStyle = pass ? hexA(C.riverHi, 0.55) : C.river;
        g.lineWidth = pass ? Math.max(0.6, w * 0.35) : w;
        const end: [number, number] = t.down ? (sea(t.down) ? spot(t.down) : mid(t, t.down)) : spot(t);
        const from = ups.get(t) ?? [];
        const [cx, cy] = spot(t);
        g.beginPath();
        if (!from.length) {
          g.moveTo(cx, cy);
          g.quadraticCurveTo(cx, cy, end[0], end[1]);
        } else {
          for (const u of from) {
            const [mx, my] = mid(u, t);
            g.moveTo(mx, my);
            g.quadraticCurveTo(cx, cy, end[0], end[1]);
          }
        }
        g.stroke();
      }
    }
    // Woods and peaks, placed by the land itself, back to front.
    const props: { y: number; prop?: Prop; v: number; x: number; peak?: number }[] = [];
    const live = world.towns.filter((t) => !t.ruined);
    const sx = world.landW / W;
    const sy = world.landH / H;
    const step = 8;
    for (let y = 4; y < H; y += step) {
      for (let x = 4; x < W; x += step) {
        const jx = x + (hash(x, y, 1) - 0.5) * step;
        const jy = y + (hash(x, y, 2) - 0.5) * step;
        const k = fieldAt(f, jx, jy);
        const e = f.E[k];
        const m = f.M[k];
        if (e < 0.035 || e > 0.47) continue;
        // Woods where it is wet, thinning at their edges; a few on the wetter hills.
        const edge = m - 0.6 + (hash(x, y, 3) - 0.5) * 0.05;
        const wood = (edge > 0 && hash(x, y, 13) < Math.min(1, 0.45 + edge * 12)) || (e > 0.33 && m > 0.54 && hash(x, y, 4) < 0.2);
        if (!wood) continue;
        // Cleared for fields near the towns (a few hedgerow trees stay).
        const tile = world.grid.at(jx * sx, jy * sy) as Tile | undefined;
        if (tile?.cleared && hash(x, y, 5) < 0.88) continue;
        let near = false;
        for (const t of live) {
          const r = clearReach(t) * (0.8 + hash(x, y, 6) * 0.4);
          if (Math.abs(X(t.tile.x) - jx) < r && Math.abs(Y(t.tile.y) - jy) < r && Math.hypot(X(t.tile.x) - jx, Y(t.tile.y) - jy) < r) {
            near = true;
            break;
          }
        }
        if (near && hash(x, y, 7) < 0.9) continue;
        props.push({ y: jy, x: jx, prop: hash(x, y, 8) < (e > 0.3 ? 0.8 : 0.55) ? 'pine' : 'oak', v: Math.floor(hash(x, y, 9) * 3) });
      }
    }
    const ps = 13;
    for (let y = 6; y < H; y += ps) {
      for (let x = 6; x < W; x += ps) {
        const jx = x + (hash(x, y, 11) - 0.5) * ps * 0.8;
        const jy = y + (hash(x, y, 12) - 0.5) * ps * 0.8;
        const e = f.E[fieldAt(f, jx, jy)];
        if (e < 0.5) continue;
        // Only the local heights: a ridge of peaks, not a carpet.
        if ([[-7, 0], [7, 0], [0, -7], [0, 7]].some(([dx, dy]) => f.E[fieldAt(f, jx + dx, jy + dy)] > e + 0.004)) continue;
        props.push({ y: jy, x: jx, v: 0, peak: e });
      }
    }
    props.sort((a, b) => a.y - b.y);
    g.imageSmoothingEnabled = false;
    for (const pr of props) {
      if (pr.peak !== undefined) peak(g, pr.x, pr.y, pr.peak);
      else stampProp(g, s, pr.prop!, pr.v, pr.x, pr.y, p * 0.72);
    }
    // Woken volcanoes: a dark cone and its crater, lava fields around.
    for (const t of world.tiles) {
      if (t.erupted < 0) continue;
      const [x, y] = [X(t.x), Y(t.y)];
      g.fillStyle = 'rgba(12,10,9,0.55)';
      g.beginPath();
      g.ellipse(x, y + 2, 26, 15, 0, 0, Math.PI * 2);
      g.fill();
      peak(g, x, y, 0.62, '#2a2523', '#151211');
      g.fillStyle = '#7c2d12';
      g.fillRect(Math.round(x - 2), Math.round(y - 15), 4, 2);
    }
    features = { key, c };
    void sy;
  }

  /** A peak: a lit face, a shadowed face, snow on the high ones. */
  function peak(g: CanvasRenderingContext2D, x: number, y: number, e: number, lit = '#45444b', dark = '#26262b') {
    const w = 7 + (e - 0.5) * 30;
    const h = 7 + (e - 0.5) * 34;
    g.fillStyle = lit;
    g.beginPath();
    g.moveTo(x - w, y);
    g.lineTo(x, y - h);
    g.lineTo(x + w, y);
    g.fill();
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(x, y - h);
    g.lineTo(x + w, y);
    g.lineTo(x + w * 0.15, y);
    g.fill();
    if (e > 0.62) {
      g.fillStyle = 'rgba(214,220,229,0.55)';
      g.beginPath();
      g.moveTo(x - w * 0.28, y - h * 0.72);
      g.lineTo(x, y - h);
      g.lineTo(x + w * 0.3, y - h * 0.7);
      g.lineTo(x + w * 0.05, y - h * 0.62);
      g.fill();
    }
  }

  function paintPolitics(f: Field) {
    const { c, g } = canvas(W, H, dprC());
    const era = world.era;
    const live = world.towns.filter((t) => !t.ruined);
    // Fields: a patchwork around each town, and on land cleared of its woods.
    const crops = ['#3a3418', '#2d3616', '#3d2f1a', '#33381a'];
    const patch = (x: number, y: number, w: number, h: number, a: number, col: string) => {
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.fillStyle = hexA(col, 0.6);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = hexA('#000000', 0.18);
      for (let k = -h / 2 + 1; k < h / 2; k += 2) g.fillRect(-w / 2, k, w, 0.6);
      g.restore();
    };
    for (const town of live) {
      if (town.tier < 1) continue;
      const n = 2 + town.tier * 3 + Math.min(4, era);
      const cx = X(town.tile.x);
      const cy = Y(town.tile.y);
      const rr = clearReach(town);
      for (let i = 0; i < n; i++) {
        const a = hash(town.seed, i) * Math.PI * 2;
        const d = rr * (0.3 + 0.7 * Math.sqrt(hash(town.seed, i, 1)));
        const x = cx + Math.cos(a) * d;
        const y = cy + Math.sin(a) * d * 0.75;
        if (f.E[fieldAt(f, x, y)] < 0.02 || f.E[fieldAt(f, x, y)] > 0.45) continue;
        patch(x, y, 6 + hash(town.seed, i, 2) * 8, 4 + hash(town.seed, i, 3) * 5, a + (hash(town.seed, i, 4) - 0.5) * 0.6, crops[i % crops.length]);
      }
    }
    for (const t of world.tiles) {
      if (!t.cleared) continue;
      for (let i = 0; i < 3; i++) {
        const [x, y] = spot(t);
        patch(x + (hash(t.q, t.r, i) - 0.5) * 14, y + (hash(t.r, t.q, i) - 0.5) * 10, 7, 5, hash(t.q, i, t.r) - 0.5, crops[(t.q + t.r + i) & 3]);
      }
    }
    // Territory: each point to the realm whose towns reach it most strongly (with a wobble,
    // so borders wander like real ones), on a 5 px grid; washed, then its border traced.
    const cell = 6;
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    const owner = new Int16Array(cols * rows).fill(-1);
    const realms = world.kingdoms.filter((k) => !k.fallen && k.towns.some((t) => !t.ruined));
    const idx = new Map(realms.map((k, i) => [k, i]));
    const hexStep = world.grid.size * Math.sqrt(3);
    const sx = world.landW / W;
    const sy = world.landH / H;
    const reachPx = live.map((t) => (REACH[t.tier] + 0.6) * hexStep);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const px = i * cell;
        const py = j * cell;
        if (f.E[fieldAt(f, px, py)] < 0) continue;
        const lx = px * sx;
        const ly = py * sy;
        const wob = host.noise.noise2(lx * 0.012 + 31, ly * 0.012) * 0.7;
        let best = -1;
        let bv = 0;
        for (let n = 0; n < live.length; n++) {
          const t = live[n];
          const dx = lx - t.tile.x;
          const dy = ly - t.tile.y;
          if (Math.abs(dx) > reachPx[n] || Math.abs(dy) > reachPx[n]) continue;
          const d = Math.hypot(dx, dy) / hexStep + wob;
          if (d > REACH[t.tier]) continue;
          const v = Math.sqrt(t.pop) / (1 + Math.max(0, d));
          if (v > bv) {
            bv = v;
            best = idx.get(t.owner) ?? -1;
          }
        }
        owner[j * cols + i] = best;
      }
    }
    const tmp = canvas(cols, rows);
    const img = tmp.g.createImageData(cols, rows);
    const cs = realms.map((k) => mixRgb(k.color, '#000000', 0));
    for (let k = 0; k < owner.length; k++) {
      const o2 = owner[k];
      if (o2 < 0) continue;
      img.data[k * 4] = cs[o2][0];
      img.data[k * 4 + 1] = cs[o2][1];
      img.data[k * 4 + 2] = cs[o2][2];
      img.data[k * 4 + 3] = 30;
    }
    tmp.g.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(tmp.c, 0, 0, cols * cell, rows * cell);
    // Each realm's border: its mask softened and traced, only within its own bounds.
    const box = realms.map(() => [Infinity, Infinity, -1, -1]);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const o2 = owner[j * cols + i];
        if (o2 < 0) continue;
        const b = box[o2];
        b[0] = Math.min(b[0], i);
        b[1] = Math.min(b[1], j);
        b[2] = Math.max(b[2], i);
        b[3] = Math.max(b[3], j);
      }
    }
    g.lineJoin = 'round';
    g.lineCap = 'round';
    realms.forEach((k, n) => {
      const [bi0, bj0, bi1, bj1] = box[n];
      if (bi1 < 0) return;
      const i0 = Math.max(0, bi0 - 3);
      const j0 = Math.max(0, bj0 - 3);
      const w = Math.min(cols - 1, bi1 + 3) - i0 + 1;
      const h = Math.min(rows - 1, bj1 + 3) - j0 + 1;
      const mask = new Float32Array(w * h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) mask[j * w + i] = owner[(j + j0) * cols + i + i0] === n ? 1 : 0;
      const scratch = new Float32Array(w * h);
      blur3(mask, w, h, scratch);
      blur3(mask, w, h, scratch);
      g.beginPath();
      isoPath(g, mask, w, h, cell, 0.5, i0 * cell, j0 * cell);
      g.strokeStyle = hexA(k.color, 0.12);
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = hexA(k.color, 0.75);
      g.lineWidth = 1.2;
      g.stroke();
    });
    // Roads: through each tile's nudged middle, curving; wider and paler where caravans have worn them.
    for (const t of world.tiles) {
      if (!t.road) continue;
      const ns = (world.grid.neighbors(t) as Tile[]).filter((n) => n.road);
      if (!ns.length) continue;
      const [cx, cy] = spot(t);
      const worn = Math.min(1, t.traffic / 30);
      g.strokeStyle = era >= 3 ? hexA('#a39377', 0.55 + worn * 0.3) : hexA('#7d6442', 0.6 + worn * 0.3);
      g.lineWidth = 1 + worn * 1.6 + (era >= 4 ? 0.4 : 0);
      g.beginPath();
      if (ns.length === 2) {
        const a = mid(t, ns[0]);
        const b = mid(t, ns[1]);
        g.moveTo(a[0], a[1]);
        g.quadraticCurveTo(cx, cy, b[0], b[1]);
      } else {
        for (const n of ns) {
          const [mx, my] = mid(t, n);
          g.moveTo(cx, cy);
          g.lineTo(mx, my);
        }
      }
      g.stroke();
    }
    politics = { v: politicsKey(), at: world.t, W, H, c };
  }

  /**
   * What the politics layer shows, as a key: who holds which town and how big it is, the
   * roads and how worn, the cleared land. Populations drift every frame; this changes only
   * when something on the map would.
   */
  function politicsKey() {
    let k = '';
    for (const t of world.towns) k += `${t.id}${t.ruined ? 'x' : t.owner.id}${t.tier},`;
    let roads = 0;
    let worn = 0;
    let cleared = 0;
    for (const t of world.tiles) {
      if (t.road) {
        roads++;
        worn += Math.min(5, Math.floor(t.traffic / 6));
      }
      if (t.cleared) cleared++;
    }
    return `${k}|${roads}|${worn}|${cleared}|${world.era}`;
  }

  function paintShade() {
    const { c, g } = canvas(W, H);
    const side = g.createLinearGradient(0, 0, W, H);
    side.addColorStop(0, 'rgba(120,70,40,0.10)');
    side.addColorStop(1, 'rgba(10,15,40,0.22)');
    g.fillStyle = side;
    g.fillRect(0, 0, W, H);
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
    v.addColorStop(0, 'rgba(2,3,6,0)');
    v.addColorStop(1, 'rgba(2,3,6,0.4)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    shade = { W, H, c };
  }

  // ---- the living map -------------------------------------------------------------------------

  /** Soft round glows, one cached sprite per color. */
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

  /** What a house looks like in this era (some variety within it). */
  const houseOf = (i: number): [Prop, number] => {
    const e = world.era;
    if (e === 0) return ['hut', i % 2];
    if (e === 1) return i % 3 === 0 ? ['cottage', 0] : ['hut', i % 2];
    if (e === 2) return ['cottage', i % 4 === 3 ? 2 : i % 2];
    if (e === 3) return i % 2 ? ['stonehouse', i % 3] : ['cottage', 1];
    return ['stonehouse', i % 3];
  };

  /** Walls by era: a palisade of stakes, stone with towers, then a star fort with a moat. */
  function walls(town: Town, cx: number, cy: number, p: number) {
    const R = 13 + town.tier * 4;
    const e = world.era;
    if (e <= 1) {
      ctx.fillStyle = '#6b4c2a';
      for (let a = 0; a < Math.PI * 2; a += 0.17) ctx.fillRect(Math.round(cx + Math.cos(a) * R), Math.round(cy + Math.sin(a) * R * 0.7), Math.max(1, p * 0.8), Math.max(1, p * 1.4));
      return;
    }
    if (e >= 4 && town.tier >= 3) {
      // A star fort: bastions at the points, a moat outside.
      const n = 6;
      const star = (k: number) => {
        ctx.beginPath();
        for (let i = 0; i <= n * 2; i++) {
          const a = (i / (n * 2)) * Math.PI * 2 + 0.26;
          const rr = (i % 2 ? R * 0.88 : R * 1.2) * k;
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.72;
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.closePath();
      };
      star(1.18);
      ctx.strokeStyle = 'rgba(30,58,80,0.6)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      star(1);
      ctx.strokeStyle = 'rgba(168,162,158,0.75)';
      ctx.lineWidth = Math.max(1.2, p);
      ctx.stroke();
      return;
    }
    ctx.strokeStyle = 'rgba(168,162,158,0.65)';
    ctx.lineWidth = Math.max(1, p);
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#a8a29e';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.fillRect(Math.round(cx + Math.cos(a) * R - p), Math.round(cy + Math.sin(a) * R * 0.7 - p), Math.max(2, p * 2), Math.max(2, p * 2));
    }
  }

  /**
   * A wonder, by its design, built from the ground up: `k` is how far along. Under way, the
   * unfinished part is scaffolding and a crane; finished, it is lit.
   */
  function wonder(kind: number, x: number, y: number, k: number, t: number, p: number) {
    const s = Math.max(1, p * 0.9);
    const Hh = [36, 30, 22, 30, 20, 22, 24][kind] * s;
    const Ww = [9, 22, 22, 10, 20, 26, 18][kind] * s;
    const built = Hh * Math.min(1, k);
    ctx.save();
    // Only the part that is built yet.
    ctx.beginPath();
    ctx.rect(x - Ww, y - built, Ww * 2, built + 1);
    ctx.clip();
    const stone = '#d6d3d1';
    const shadow = '#8a8580';
    switch (kind) {
      case 0: {
        // The lighthouse: a tapering tower in bands, a lantern room.
        for (let i = 0; i < 6; i++) {
          const w0 = (4.5 - i * 0.45) * s;
          ctx.fillStyle = i % 2 ? '#b91c1c' : stone;
          ctx.fillRect(x - w0, y - (i + 1) * (Hh / 7), w0 * 2, Hh / 7 + 0.5);
        }
        ctx.fillStyle = '#44403c';
        ctx.fillRect(x - 2.5 * s, y - Hh, 5 * s, Hh / 7);
        break;
      }
      case 1: {
        // The cathedral: a nave, two west towers with spires, a rose window.
        ctx.fillStyle = stone;
        ctx.fillRect(x - 10 * s, y - 11 * s, 20 * s, 11 * s);
        ctx.fillStyle = shadow;
        ctx.fillRect(x - 10 * s, y - 13 * s, 20 * s, 2 * s);
        for (const sx2 of [-9, 5]) {
          ctx.fillStyle = stone;
          ctx.fillRect(x + sx2 * s, y - 20 * s, 4 * s, 20 * s);
          ctx.fillStyle = shadow;
          ctx.beginPath();
          ctx.moveTo(x + sx2 * s, y - 20 * s);
          ctx.lineTo(x + (sx2 + 2) * s, y - Hh);
          ctx.lineTo(x + (sx2 + 4) * s, y - 20 * s);
          ctx.fill();
        }
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 1.5 * s, y - 9 * s, 3 * s, 3 * s);
        break;
      }
      case 2: {
        // The hanging gardens: terraces stepping up, green falling over each edge.
        for (let i = 0; i < 4; i++) {
          const w0 = (11 - i * 2.4) * s;
          const y0 = y - (i + 1) * 5.5 * s;
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(x - w0, y0, w0 * 2, 5.5 * s);
          ctx.fillStyle = '#3f6212';
          ctx.fillRect(x - w0, y0, w0 * 2, 2 * s);
          ctx.fillStyle = '#65a30d';
          for (let j = 0; j < 5; j++) ctx.fillRect(x - w0 + j * (w0 * 0.45), y0 + 2 * s, s, 2.5 * s);
        }
        break;
      }
      case 3: {
        // The colossus: bronze, legs apart, an arm raised with a flame.
        ctx.fillStyle = '#9a6b3a';
        ctx.fillRect(x - 4 * s, y - 13 * s, 2 * s, 13 * s);
        ctx.fillRect(x + 2 * s, y - 13 * s, 2 * s, 13 * s);
        ctx.fillRect(x - 4 * s, y - 23 * s, 8 * s, 10 * s);
        ctx.fillRect(x - 1.5 * s, y - 27 * s, 3 * s, 4 * s);
        ctx.fillRect(x + 3 * s, y - Hh, 1.5 * s, 9 * s);
        ctx.fillStyle = '#6b4520';
        ctx.fillRect(x - 4 * s, y - 23 * s, 2 * s, 10 * s);
        break;
      }
      case 4: {
        // The library: columns under a pediment, a dome behind.
        ctx.fillStyle = stone;
        ctx.beginPath();
        ctx.arc(x, y - 12 * s, 7 * s, Math.PI, 0);
        ctx.fill();
        ctx.fillRect(x - 10 * s, y - 12 * s, 20 * s, 12 * s);
        ctx.fillStyle = shadow;
        for (let i = 0; i < 6; i++) ctx.fillRect(x - 9 * s + i * 3.4 * s, y - 10 * s, s, 10 * s);
        ctx.fillStyle = '#e7e5e4';
        ctx.beginPath();
        ctx.moveTo(x - 11 * s, y - 12 * s);
        ctx.lineTo(x, y - 16 * s);
        ctx.lineTo(x + 11 * s, y - 12 * s);
        ctx.fill();
        break;
      }
      case 5: {
        // The stair of kings: a stepped pyramid, a shrine on top.
        for (let i = 0; i < 5; i++) {
          const w0 = (13 - i * 2.4) * s;
          ctx.fillStyle = i % 2 ? '#a8a29e' : '#c4bdb4';
          ctx.fillRect(x - w0, y - (i + 1) * 3.6 * s, w0 * 2, 3.6 * s);
        }
        ctx.fillStyle = '#78716c';
        ctx.fillRect(x - 0.5 * s, y - 18 * s, s, 18 * s);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(x - 2 * s, y - Hh, 4 * s, 4 * s);
        break;
      }
      default: {
        // The observatory: a drum and a white dome, its slit open to the sky.
        ctx.fillStyle = stone;
        ctx.fillRect(x - 7 * s, y - 12 * s, 14 * s, 12 * s);
        ctx.fillStyle = '#f5f5f4';
        ctx.beginPath();
        ctx.arc(x, y - 12 * s, 8 * s, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x - s * 0.8, y - 20 * s, 1.6 * s, 7 * s);
        ctx.fillStyle = shadow;
        ctx.fillRect(x - 7 * s, y - 4 * s, 14 * s, s);
      }
    }
    ctx.restore();
    if (k < 1) {
      // Scaffolding over the rest, and a crane.
      ctx.strokeStyle = 'rgba(160,120,70,0.75)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let yy = y - built; yy > y - Hh; yy -= 4 * s) {
        ctx.moveTo(x - Ww * 0.6, yy);
        ctx.lineTo(x + Ww * 0.6, yy);
      }
      ctx.moveTo(x - Ww * 0.6, y);
      ctx.lineTo(x - Ww * 0.6, y - Hh);
      ctx.moveTo(x + Ww * 0.6, y);
      ctx.lineTo(x + Ww * 0.6, y - Hh);
      ctx.stroke();
      const swing = Math.sin(t * 0.6) * 0.5;
      ctx.strokeStyle = 'rgba(120,90,50,0.9)';
      ctx.beginPath();
      ctx.moveTo(x + Ww * 0.6, y);
      ctx.lineTo(x + Ww * 0.6, y - Hh - 6 * s);
      ctx.lineTo(x + Ww * 0.6 - Math.cos(swing) * 14 * s, y - Hh - 6 * s + Math.sin(swing) * 3 * s);
      ctx.stroke();
      return;
    }
    // Finished: lit.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 0) {
      // The lighthouse turns its beam.
      const a = t * 1.2;
      const lx = x;
      const ly = y - Hh + 2;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 60);
      g.addColorStop(0, 'rgba(253,230,138,0.35)');
      g.addColorStop(1, 'rgba(253,230,138,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, 60, a - 0.18, a + 0.18);
      ctx.closePath();
      ctx.fill();
      glow(lx, ly, 10, '#fde68a', 0.8);
    } else glow(x, y - Hh * 0.6, 22, '#fde68a', 0.22 + 0.08 * Math.sin(t * 2 + kind));
    ctx.restore();
  }

  function towns(t: number, p: number) {
    const s = scenery!;
    // Lights first: they grow with the people and the age (lamps in the last ones).
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const town of world.towns) {
      if (town.ruined) continue;
      const r = (10 + Math.sqrt(town.pop) * 1.5) * (1 + world.era * 0.08);
      glow(X(town.tile.x), Y(town.tile.y), r, world.era >= 5 ? '#fde68a' : '#fbbf24', 0.16 + world.era * 0.025 + (town.burning > world.year ? 0.2 : 0) + Math.min(0.08, town.trade * 0.01));
    }
    ctx.restore();
    const list = [...world.towns].sort((a, b) => a.tile.y - b.tile.y);
    for (const town of list) {
      const cx = X(town.tile.x);
      const cy = Y(town.tile.y);
      if (town.ruined) {
        ctx.fillStyle = 'rgba(28,25,23,0.8)';
        for (let i = 0; i < 6; i++) ctx.fillRect(cx + (hash(town.seed, i) - 0.5) * 18, cy + (hash(town.seed, i, 1) - 0.5) * 12, 2, 2);
        continue;
      }
      if (town.walls) walls(town, cx, cy, p);
      const houses = town.houses.slice(0, HOUSES[town.tier]).map((h, i) => ({ x: cx + h[0] * 0.7, y: cy + h[1] * 0.7, i })).sort((a, b) => a.y - b.y);
      const capital = town === town.owner.capital;
      for (const h of houses) {
        if (h.i === 0 && town.tier >= 3 && world.era >= 2) {
          // The great house of a city: a keep, or in the late ages a capital's palace.
          if (capital && world.era >= 4) stampProp(ctx, s, 'palace', 0, h.x, h.y + 4, p * 0.7);
          else stampProp(ctx, s, 'keep', 0, h.x, h.y + 4, p * 0.8);
          continue;
        }
        if (h.i === 3 && town.tier >= 3 && world.era >= 3) {
          stampProp(ctx, s, 'spire', 0, h.x, h.y, p * 0.75);
          continue;
        }
        const [prop, v] = houseOf(h.i);
        stampProp(ctx, s, prop, v, h.x, h.y, p * (prop === 'hut' ? 0.8 : 0.72));
      }
      // The banner over a capital.
      if (capital) {
        ctx.fillStyle = '#3f2a17';
        ctx.fillRect(cx + 10, cy - 26, 1, 14);
        ctx.fillStyle = town.owner.color;
        ctx.fillRect(cx + 11, cy - 26 + Math.sin(t * 4) * 0.5, 7, 4);
      }
      if (town.wonder) {
        const k = town.wonderAt < 0 ? 1 : Math.max(0.05, (world.year - town.wonderStart) / Math.max(1, town.wonderAt - town.wonderStart));
        wonder(town.wonderKind, cx - 20, cy + 2, k, t, p);
      }
      if (town.burning > world.year) fire(cx, cy, town.seed, t, p);
      if (town.plague > 0.1) {
        ctx.fillStyle = `rgba(132,204,22,${(0.12 * town.plague).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (town.besieged) {
        // Tents in a ring; in the age of powder, the guns' smoke.
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          stampProp(ctx, s, 'tent', 0, cx + Math.cos(a) * 30, cy + Math.sin(a) * 21, p * 0.7);
        }
        if (world.era >= 4) {
          for (let i = 0; i < 4; i++) {
            const k = (t * 0.7 + i / 4 + hash(town.seed, i)) % 1;
            const a = (i / 4) * Math.PI * 2 + 0.7;
            ctx.fillStyle = `rgba(203,213,225,${(0.3 * (1 - k)).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * 34 + k * 8, cy + Math.sin(a) * 24 - k * 10, 2 + k * 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  function fire(x: number, y: number, seed: number, t: number, p: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(x, y - 4, 22, '#f97316', 0.35 + 0.1 * Math.sin(t * 9 + seed));
    for (let i = 0; i < 8; i++) {
      const k = (t * 1.2 + hash(seed, i)) % 1;
      ctx.fillStyle = hexA(k < 0.4 ? '#fde68a' : '#ef4444', 0.8 * (1 - k));
      ctx.fillRect(x + (hash(seed, i, 1) - 0.5) * 16, y - k * 16 * p, p * 1.5, p * 2);
    }
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.4 + i / 4) % 1;
      ctx.fillStyle = `rgba(41,37,36,${(0.35 * (1 - k)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x + k * 20, y - 10 - k * 40, 4 + k * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Where a walker was a moment ago, along its path: for wakes and dust. */
  function behind(w: (typeof world.walkers)[number], back: number): [number, number] {
    const at = Math.max(0, w.at - back);
    const i = Math.floor(at);
    const a = w.path[Math.min(w.path.length - 1, i)];
    const b = w.path[Math.min(w.path.length - 1, i + 1)];
    const k = at - i;
    return [X(a.x + (b.x - a.x) * k), Y(a.y + (b.y - a.y) * k)];
  }

  function walkers(t: number, p: number) {
    const s = scenery!;
    const list = [...world.walkers].sort((a, b) => a.y - b.y);
    const shipProp: Prop = world.era <= 2 ? 'galley' : world.era === 3 ? 'ship' : 'galleon';
    // Movers are drawn a little larger than the towns they travel between, so the roads and
    // the sea read as busy at a glance.
    const q = p * 1.25;
    for (const w of list) {
      const x = X(w.x);
      const y = Y(w.y);
      if (w.kind === 'ship') {
        const bob = Math.sin(t * 2 + w.id) * 0.8;
        // A wake: two lines opening out behind it.
        const [bx, by] = behind(w, 1.2);
        ctx.strokeStyle = 'rgba(203,213,225,0.28)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const side of [-1, 1]) {
          const nx = -(by - y);
          const ny = bx - x;
          const nl = Math.hypot(nx, ny) || 1;
          ctx.moveTo(x, y + 2);
          ctx.lineTo(bx + (nx / nl) * 5 * side, by + 2 + (ny / nl) * 5 * side);
        }
        ctx.stroke();
        stampProp(ctx, s, shipProp, 0, x, y + bob, q);
        ctx.fillStyle = w.owner.color;
        ctx.fillRect(Math.round(x), Math.round(y - 12 * q + bob), 4, 3);
        continue;
      }
      const next = w.path[Math.min(w.path.length - 1, Math.floor(w.at) + 1)];
      const flip = X(next.x) < x;
      // Dust on the road behind carts and marching armies.
      if (w.kind === 'caravan' || (w.kind === 'army' && w.state !== 'battle' && w.state !== 'siege')) {
        for (let k = 1; k <= 3; k++) {
          const [dx, dy] = behind(w, k * 0.18);
          ctx.fillStyle = `rgba(214,200,170,${(0.22 - k * 0.05).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(dx, dy + 1, 1.2 + k * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (w.kind === 'caravan') {
        ctx.save();
        if (flip) {
          ctx.translate(x * 2, 0);
          ctx.scale(-1, 1);
        }
        stampProp(ctx, s, 'cart', 0, x, y + Math.round(Math.sin(t * 6 + w.id) * 0.4), q * 0.85);
        ctx.restore();
        ctx.fillStyle = w.owner.color;
        ctx.fillRect(Math.round(x + (flip ? -5 : 2)), Math.round(y - 8 * q), 3, 3);
        continue;
      }
      const a = atlasFor(w.owner);
      const walk = Math.floor(t * 6 + w.id) % 2;
      if (w.kind === 'settlers') {
        stamp(ctx, a, 'peasant', walk, flip, x - 5, y, q * 0.9, 0);
        stamp(ctx, a, 'peasant', 1 - walk, flip, x + 5, y + 2, q * 0.9, 1);
        continue;
      }
      // An army: a few men stand for many, a banner over them.
      const n = Math.max(2, Math.min(7, Math.round(w.size / 30)));
      const fighting = w.state === 'battle' || w.state === 'siege';
      for (let i = 0; i < n; i++) {
        const kind = i === 0 && w.size > 120 ? 'cav' : i % 3 === 2 ? 'arch' : 'inf';
        const frame = fighting && hash(w.id, i, Math.floor(t * 3)) < 0.5 ? 2 : walk;
        stamp(ctx, a, kind, kind === 'cav' ? Math.floor(t * 8) % 3 : frame, flip, x + ((i % 4) - 1.5) * 7, y + Math.floor(i / 4) * 6 - 2, q * 0.9, i);
      }
      // The banner over them, outlined so it reads on any land.
      const fy = Math.round(y - 26 + Math.sin(t * 5 + w.id));
      ctx.fillStyle = '#3f2a17';
      ctx.fillRect(Math.round(x), Math.round(y - 26), 1, 18);
      ctx.fillStyle = 'rgba(20,14,8,0.7)';
      ctx.fillRect(Math.round(x), fy - 1, 11, 7);
      ctx.fillStyle = w.owner.color;
      ctx.fillRect(Math.round(x) + 1, fy, 9, 5);
      if (w.state === 'battle') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          if (hash(w.id, i, Math.floor(t * 10)) < 0.6) continue;
          ctx.fillStyle = 'rgba(254,243,199,0.9)';
          ctx.fillRect(x + (hash(w.id, i, 2) - 0.5) * 20, y - 6 + (hash(w.id, i, 3) - 0.5) * 10, p * 1.5, p * 1.5);
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(168,162,158,0.15)';
        ctx.beginPath();
        ctx.ellipse(x, y, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- life between the events: smoke from the roofs, boats off the coast (drawn only) --------
  let coastGen = -1;
  const coast = new Map<number, [number, number] | null>();
  let tileByKey: Map<string, (typeof world.tiles)[number]> | null = null;
  /** A water tile next to a town, for its fishing boats (null inland). */
  function waterBy(town: (typeof world.towns)[number]): [number, number] | null {
    if (coastGen !== world.landVersion) {
      coastGen = world.landVersion;
      coast.clear();
      tileByKey = new Map(world.tiles.map((x) => [`${x.q},${x.r}`, x]));
    }
    const known = coast.get(town.id);
    if (known !== undefined) return known;
    const wet = world.grid.neighbors(town.tile).map((c) => tileByKey!.get(`${c.q},${c.r}`)).find((x) => x && (x.terrain === 'sea' || x.terrain === 'coast'));
    const at: [number, number] | null = wet ? [wet.x, wet.y] : null;
    coast.set(town.id, at);
    return at;
  }
  function life(t: number, p: number) {
    for (const town of world.towns) {
      if (town.ruined) continue;
      const cx = X(town.tile.x);
      const cy = Y(town.tile.y);
      // Smoke, a wisp a house, rising and fading (thick when the town burns).
      const n = Math.min(town.houses.length, Math.min(3, town.tier + 1) + (town.burning > world.year ? 3 : 0));
      for (let i = 0; i < n; i++) {
        const h = town.houses[i];
        const ph = ((t / 3.5 + hash(town.seed, i)) % 1 + 1) % 1;
        const drift = hash(town.seed, i, 7) < 0.5 ? -1 : 1;
        ctx.fillStyle = `rgba(205,200,190,${(0.24 * (1 - ph)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx + h[0] * 0.7 + ph * 5 * drift, cy + h[1] * 0.7 - 6 - ph * 16, 1.2 + ph * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Fishing boats off a coastal town, working the water by it.
      const w = town.tier >= 1 ? waterBy(town) : null;
      if (!w) continue;
      for (let i = 0; i < Math.min(2, town.tier); i++) {
        const ph = t * 0.12 + hash(town.seed, i, 3) * 6.28;
        const bx = X(w[0]) + Math.cos(ph) * 6 + (hash(town.seed, i, 4) - 0.5) * 8;
        const by = Y(w[1]) + Math.sin(ph) * 3 + Math.sin(t * 2 + i) * 0.5;
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(Math.round(bx - 3 * p), Math.round(by), Math.round(6 * p), Math.max(1, Math.round(2 * p)));
        ctx.fillStyle = 'rgba(231,229,228,0.9)';
        ctx.fillRect(Math.round(bx), Math.round(by - 4 * p), Math.max(1, Math.round(p)), Math.round(4 * p));
        ctx.fillStyle = 'rgba(203,213,225,0.18)';
        ctx.fillRect(Math.round(bx - 5 * p), Math.round(by + 2 * p), Math.round(10 * p), 1);
      }
    }
  }

  function marks(t: number) {
    for (const m of world.marks) {
      const k = (t - m.t0) / m.dur;
      const x = X(m.x);
      const y = Y(m.y);
      if (m.kind === 'found' || m.kind === 'schism') {
        ctx.strokeStyle = hexA(m.color, 0.6 * (1 - k));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(x, y, 8 + k * 40, (8 + k * 40) * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (m.kind === 'wonder') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 + t * 0.2;
          ctx.strokeStyle = hexA('#fde68a', 0.25 * (1 - k));
          ctx.beginPath();
          ctx.moveTo(x - 20, y - 20);
          ctx.lineTo(x - 20 + Math.cos(a) * 60, y - 20 + Math.sin(a) * 60);
          ctx.stroke();
        }
        ctx.restore();
      } else if (m.kind === 'razed' || m.kind === 'dragonfire' || m.kind === 'fire') {
        if (k < 0.7) fire(x, y, m.seed, t, P());
      } else if (m.kind === 'battle') {
        ctx.fillStyle = `rgba(168,162,158,${(0.2 * (1 - k)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 26 + k * 20, 12 + k * 8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (m.kind === 'volcano') {
        // Lava at the crater and down the flanks, and a plume of ash leaning away.
        const fade = Math.min(1, (1 - k) * 2.5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(x, y - 14, 34, '#f97316', 0.5 * fade);
        ctx.strokeStyle = hexA('#fb923c', 0.7 * fade);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI + 0.3;
          ctx.moveTo(x, y - 14);
          ctx.quadraticCurveTo(x + Math.cos(a) * 10, y - 6, x + Math.cos(a) * (14 + hash(m.seed, i) * 10), y + 4 + hash(i, m.seed) * 6);
        }
        ctx.stroke();
        ctx.restore();
        for (let i = 0; i < 9; i++) {
          const a = (t * 0.12 + i / 9) % 1;
          ctx.fillStyle = `rgba(36,32,30,${(0.45 * (1 - a) * fade).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x + a * 70, y - 18 - a * 90, 6 + a * 22, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (m.kind === 'flood' && m.pts) {
        // The river's banks under water: a pale wash along it, ebbing.
        ctx.strokeStyle = hexA('#3b82f6', 0.22 * (1 - k));
        ctx.lineWidth = 16 + 10 * Math.sin(Math.min(1, k * 3) * Math.PI);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        m.pts.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py))));
        ctx.stroke();
      }
    }
    // Volcanoes that woke not long ago still smoke.
    for (const tile of world.tiles) {
      if (tile.erupted < 0 || world.year - tile.erupted > 140) continue;
      const x = X(tile.x);
      const y = Y(tile.y);
      for (let i = 0; i < 4; i++) {
        const a = (t * 0.08 + i / 4) % 1;
        ctx.fillStyle = `rgba(60,56,54,${(0.2 * (1 - a)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + a * 30, y - 16 - a * 40, 3 + a * 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function dragon(t: number, p: number) {
    const d = world.dragon;
    if (!d) return;
    dragonAtlas ??= buildAtlas(world.kingdoms[0]?.faction.kit ?? FALLBACK_KIT, DRAGONS[0], ['dragon']);
    const x = X(d.x);
    const y = Y(d.y) - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 40, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    stamp(ctx, dragonAtlas, 'dragon', Math.floor(t * 7) % 4, d.flip, x, y, p);
    if (d.state === 'burn') fire(X(d.tx), Y(d.ty), 7, t, p);
  }

  function labels(t: number, level: number) {
    if (!o.labels) return;
    ctx.save();
    ctx.font = serif(12);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const placed: [number, number, number][] = [];
    for (const l of world.labels) {
      const age = t - l.t0;
      const a = Math.min(1, age * 3, (l.dur - age) / 0.8) * level;
      if (a <= 0) continue;
      const w = ctx.measureText(l.text).width;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, X(l.x)));
      let y = Math.max(72, Math.min(H - 76, Y(l.y)));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(6,5,8,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.5);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }

  /** The age's history along the bottom: its eras, what happened in each, and now. */
  function ribbon(t: number, level: number) {
    const x0 = 16;
    const x1 = W - 16;
    const y = H - 12;
    const xs = (year: number) => x0 + Math.min(1, year / AGE_YEARS) * (x1 - x0);
    ctx.save();
    for (let e = 0; e < ERAS.length; e++) {
      const a = xs(e * ERA_YEARS);
      const b = e === ERAS.length - 1 ? x1 : xs((e + 1) * ERA_YEARS);
      ctx.fillStyle = hexA('#e7dcc4', (e % 2 ? 0.07 : 0.11) * level);
      ctx.fillRect(a, y, b - a - 1, 3);
    }
    const now = xs(world.year);
    ctx.fillStyle = hexA('#e7dcc4', 0.32 * level);
    ctx.fillRect(x0, y, now - x0, 3);
    // What happened: the great things taller.
    const tall = new Set(['unified', 'wonder', 'fall', 'volcano', 'dynastyends', 'era']);
    for (const m of world.history) {
      const x = Math.round(xs(m.year));
      const h = tall.has(m.kind) ? 7 : 4;
      const fresh = Math.max(0, 1 - (world.year - m.year) / 30);
      ctx.fillStyle = hexA(m.color, (0.55 + fresh * 0.45) * level);
      ctx.fillRect(x, y - h, m.kind === 'unified' || m.kind === 'wonder' ? 2 : 1, h);
    }
    ctx.fillStyle = hexA('#fde68a', 0.9 * level);
    ctx.beginPath();
    ctx.moveTo(now, y - 2);
    ctx.lineTo(now - 3, y - 7);
    ctx.lineTo(now + 3, y - 7);
    ctx.fill();
    ctx.fillRect(now, y, 1, 4);
    ctx.restore();
    void t;
  }

  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#e7dcc4', 0.85 * level);
    fillCrisp(ctx, `YEAR ${Math.floor(world.year)}`, 16, 26);
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a8a29e', 0.85 * level);
    fillCrisp(ctx, ERAS[world.era], 16, 42);
    // The peoples, by the towns they hold.
    const live = world.kingdoms.filter((k) => !k.fallen && (k.towns.length > 0 || k.horde)).sort((a, b) => b.towns.length - a.towns.length).slice(0, 6);
    const top = live.find((k) => !k.horde);
    if (top) {
      ctx.fillStyle = hexA('#d6cbb3', 0.75 * level);
      fillCrisp(ctx, `${regnal(top.ruler)} OF ${top.short} · HOUSE ${top.house}`, 16, 57);
    }
    ctx.textAlign = 'right';
    ctx.font = serif(11);
    live.forEach((k, i) => {
      const y = 24 + i * 15;
      const war = k.wars.size > 0 ? ' ⚔' : '';
      const text = `${k.short}  ${k.horde ? 'HORDE' : k.towns.length}${war}`;
      ctx.fillStyle = hexA('#e7dcc4', 0.8 * level);
      fillCrisp(ctx, text, W - 26, y);
      ctx.fillStyle = k.color;
      ctx.fillRect(W - 20, y - 7, 6, 6);
    });
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#e7dcc4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 28 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
    ribbon(t, level);
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      world.resize(W, H);
      field = null;
      relief = null;
      features = null;
      politics = null;
      shade = null;
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      const p = P();
      const level = 0.55 + 0.45 * host.intensity;
      scenery ??= buildScenery([['#a8a29e', '#57534e'], ['#a8a29e', '#57534e']]);
      if (!field || field.gen !== world.landVersion || field.W !== W || field.H !== H) {
        field = sampleField();
        relief = null;
        features = null;
        politics = null;
      }
      if (!relief) paintRelief(field);
      const fkey = `${world.landVersion}:${world.landEdits}:${W}:${H}`;
      if (!features || features.key !== fkey) paintFeatures(field, fkey);
      // Borders and roads follow the towns; redrawn when they change, at most about once a second.
      if (!politics || politics.W !== W || politics.H !== H || (t - politics.at > 1 && politics.v !== politicsKey())) paintPolitics(field);
      if (!shade || shade.W !== W || shade.H !== H) paintShade();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(relief!.c, 0, 0, W, H);
      ctx.drawImage(politics!.c, 0, 0, W, H);
      ctx.drawImage(features!.c, 0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      towns(t, p);
      life(t, p);
      marks(t);
      walkers(t, p);
      dragon(t, p);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(shade!.c, 0, 0, W, H);
      if (world.ending >= 0) {
        ctx.fillStyle = `rgba(3,3,6,${Math.min(0.92, (t - world.ending) / 4).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      labels(t, level);
      hud(t, level);
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
      field = null;
      relief = null;
      features = null;
      politics = null;
      atlases.clear();
    },
  };
}

/** A plain kit for the dragon's atlas when no people is around to lend theirs. */
const FALLBACK_KIT: Kit = {
  cloth: '#78716c', cloth2: '#44403c', metal: '#a8a29e', metalDark: '#57534e', leather: '#5b4030', wood: '#7c5a3a', skin: ['#e8b48a'],
  mount: '#78716c', mountDark: '#44403c', magic: '#fde68a', helm: 'kettle', shield: 'kite', rider: 'horse', undead: false,
};

export type { Town, Walker };
