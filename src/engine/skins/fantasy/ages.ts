/**
 * Ages' mount: the continent (ages-sim.ts), painted from above at dusk.
 *
 * Caches: the land (relief-shaded terrain, coasts, rivers, woods, peaks) at device
 * resolution, redrawn only for a new age or a resize; borders and roads, redrawn when they
 * change. Live: fields and towns (houses by era, walls, a wonder, lights that grow with the
 * people), settlers, armies, ships, sieges, battles, fires, plague, a dragon, call-outs,
 * and the chronicle.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { AGES_SCHEMA } from './index';
import { createAgesWorld, ERAS, type Kingdom, type Tile, type Town, type Walker } from './ages-sim';
import { buildAtlas, stamp, type Atlas, type Kit } from './sprites';
import { DRAGONS, serif } from './names';
import { buildScenery, stampProp, type SceneryAtlas } from './scenery';

/** Terrain colors at dusk: low, so page text stays legible over the whole map. */
const C = {
  deep: '#050a12',
  sea: '#0a1520',
  shallow: '#11222f',
  sand: '#2b2719',
  plain: '#1c2714',
  plainHi: '#26321a',
  forest: '#121d10',
  hill: '#272819',
  mountain: '#34353b',
  snow: '#6b7280',
  river: '#1a3144',
};

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

  let landArt: { v: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  let politics: { v: number; W: number; H: number; c: HTMLCanvasElement } | null = null;
  let scenery: SceneryAtlas | null = null;
  let shade: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  const atlases = new Map<number, Atlas>();
  let dragonAtlas: Atlas | null = null;

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

  function paintLand() {
    const dpr = Math.min(2, host.viewport.dpr || 1);
    const { c, g } = canvas(W, H, dpr);
    const s = scenery ?? (scenery = buildScenery([['#a8a29e', '#57534e'], ['#a8a29e', '#57534e']]));
    // Relief: color by height and wetness, shaded by a low light from the upper left. Worked
    // out on a coarse grid and laid down smooth, like paint; the pixel art goes on top.
    const cell = 3;
    const sx = world.landW / W;
    const sy = world.landH / H;
    const rw = Math.ceil(W / cell);
    const rh = Math.ceil(H / cell);
    const relief = canvas(rw, rh);
    const img = relief.g.createImageData(rw, rh);
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        const lx = i * cell * sx;
        const ly = j * cell * sy;
        const { elev, moist } = world.elevAt(lx, ly);
        const e2 = world.elevAt(lx + 6, ly + 6).elev;
        const light = Math.max(-1, Math.min(1, (elev - e2) * 14));
        let col: [number, number, number];
        if (elev < -0.18) col = mixRgb(C.deep, C.sea, Math.max(0, (elev + 0.5) / 0.32));
        else if (elev < 0) col = mixRgb(C.sea, C.shallow, (elev + 0.18) / 0.18);
        else if (elev < 0.05) col = mixRgb(C.sand, C.plain, elev / 0.05);
        else if (elev > 0.55) col = mixRgb(C.mountain, C.snow, Math.min(0.7, Math.max(0, (elev - 0.76) / 0.14)));
        else if (elev > 0.36) col = mixRgb(C.hill, C.mountain, (elev - 0.36) / 0.19);
        else col = moist > 0.58 ? mixRgb(C.forest, C.plain, 0.15) : mixRgb(C.plain, C.plainHi, Math.max(0, Math.min(1, (0.58 - moist) * 2.5)));
        if (elev >= 0) col = col.map((v) => v * (1 + light * 0.3)) as [number, number, number];
        const k = (j * rw + i) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = 255;
      }
    }
    relief.g.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(relief.c, 0, 0, rw * cell, rh * cell);
    // A pale line where the sea meets the land.
    g.strokeStyle = 'rgba(148,163,184,0.12)';
    g.lineWidth = 1;
    for (const t of world.tiles) {
      if (t.terrain !== 'coast') continue;
      for (const n of world.grid.neighbors(t) as Tile[]) {
        if (n.terrain !== 'sea' && n.terrain !== 'deep') continue;
        g.beginPath();
        g.moveTo(X((t.x + n.x) / 2) - 4, Y((t.y + n.y) / 2));
        g.lineTo(X((t.x + n.x) / 2) + 4, Y((t.y + n.y) / 2));
        g.stroke();
      }
    }
    // Rivers, downhill to the sea.
    g.strokeStyle = C.river;
    g.lineCap = 'round';
    for (const t of world.tiles) {
      if (!t.river) continue;
      const next = (world.grid.neighbors(t) as Tile[]).reduce((a, b) => (b.elev < a.elev ? b : a));
      g.lineWidth = 1.6 + (0.4 - Math.max(0, t.elev)) * 3;
      g.beginPath();
      g.moveTo(X(t.x), Y(t.y));
      g.lineTo(X(next.x), Y(next.y));
      g.stroke();
    }
    // Peaks, and woods, in pixel art on top.
    const p = P();
    g.imageSmoothingEnabled = false;
    const props: { y: number; draw: () => void }[] = [];
    for (const t of world.tiles) {
      const h = (k: number) => hash(t.q * 7 + 1000, t.r * 13 + 1000, k);
      if (t.terrain === 'mountain') {
        props.push({
          y: Y(t.y),
          draw: () => {
            const x = X(t.x) + (h(1) - 0.5) * 8;
            const y = Y(t.y) + 4;
            const w = 10 + h(2) * 8;
            const hh = 9 + h(3) * 9;
            g.fillStyle = '#3f4048';
            g.beginPath();
            g.moveTo(x - w, y);
            g.lineTo(x, y - hh);
            g.lineTo(x + w, y);
            g.fill();
            g.fillStyle = '#26272c';
            g.beginPath();
            g.moveTo(x, y - hh);
            g.lineTo(x + w, y);
            g.lineTo(x + w * 0.2, y);
            g.fill();
            g.fillStyle = 'rgba(203,213,225,0.55)';
            g.beginPath();
            g.moveTo(x - w * 0.28, y - hh * 0.72);
            g.lineTo(x, y - hh);
            g.lineTo(x + w * 0.3, y - hh * 0.7);
            g.lineTo(x + w * 0.05, y - hh * 0.62);
            g.fill();
          },
        });
      } else if (t.terrain === 'forest' || (t.terrain === 'hill' && t.moist > 0.55)) {
        const n = t.terrain === 'forest' ? 4 : 2;
        for (let i = 0; i < n; i++) {
          const x = X(t.x) + (h(i * 3) - 0.5) * world.grid.size * 1.4 * kx();
          const y = Y(t.y) + (h(i * 3 + 1) - 0.5) * world.grid.size * 1.2 * ky();
          props.push({ y, draw: () => stampProp(g, s, h(i * 3 + 2) < 0.6 ? 'pine' : 'oak', Math.floor(h(i) * 3), x, y, p) });
        }
      }
    }
    props.sort((a, b) => a.y - b.y);
    for (const pr of props) pr.draw();
    landArt = { v: world.landVersion, W, H, c };
  }

  function paintPolitics() {
    const dpr = Math.min(2, host.viewport.dpr || 1);
    const { c, g } = canvas(W, H, dpr);
    const corners = (t: Tile) => world.grid.corners(t).map((v, i) => (i % 2 ? Y(v) : X(v)));
    // Each kingdom's land, washed in its color, and its border.
    for (const t of world.tiles) {
      if (!t.kingdom) continue;
      const pts = corners(t);
      g.fillStyle = hexA(t.kingdom.color, 0.1);
      g.beginPath();
      for (let i = 0; i < 12; i += 2) (i ? g.lineTo : g.moveTo).call(g, pts[i], pts[i + 1]);
      g.closePath();
      g.fill();
      const ns = world.grid.neighbors(t) as Tile[];
      // Neighbor i (east, northeast, northwest, west, southwest, southeast) shares the edge
      // from corner (6 - i) % 6 to the next. Each side draws its own color along a border.
      for (let i = 0; i < 6; i++) {
        const n = ns[i];
        if (n.kingdom === t.kingdom) continue;
        const a = (6 - i) % 6;
        const b = (a + 1) % 6;
        g.strokeStyle = hexA(t.kingdom.color, 0.75);
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(pts[a * 2], pts[a * 2 + 1]);
        g.lineTo(pts[b * 2], pts[b * 2 + 1]);
        g.stroke();
      }
    }
    // Roads.
    g.strokeStyle = 'rgba(150,120,80,0.8)';
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    for (const t of world.tiles) {
      if (!t.road) continue;
      for (const n of world.grid.neighbors(t) as Tile[]) {
        if (!n.road || n.q * 1000 + n.r < t.q * 1000 + t.r) continue;
        g.moveTo(X(t.x), Y(t.y));
        g.lineTo(X(n.x), Y(n.y));
      }
    }
    g.stroke();
    politics = { v: world.version, W, H, c };
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
    v.addColorStop(1, 'rgba(2,3,6,0.55)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    shade = { W, H, c };
  }

  // ---- the living map -------------------------------------------------------------------------

  function glow(x: number, y: number, r: number, color: string, a: number) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(color, a));
    g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const HOUSES = [2, 4, 7, 10, 13];

  function towns(t: number, p: number) {
    const s = scenery!;
    const roof = world.era <= 1 ? 0 : world.era <= 3 ? 1 : 2;
    // Fields first, under everything.
    for (const town of world.towns) {
      if (town.ruined || town.tier < 1) continue;
      const n = 1 + town.tier;
      for (let i = 0; i < n; i++) {
        const a = hash(town.seed, i) * Math.PI * 2;
        const d = (16 + hash(town.seed, i, 1) * 14) * (1 + town.tier * 0.15);
        const x = X(town.tile.x) + Math.cos(a) * d;
        const y = Y(town.tile.y) + Math.sin(a) * d * 0.7;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(hash(town.seed, i, 2) - 0.5);
        ctx.fillStyle = 'rgba(66,58,28,0.55)';
        ctx.fillRect(-7, -4, 14, 8);
        ctx.fillStyle = 'rgba(92,80,38,0.5)';
        for (let k = -4; k < 4; k += 2) ctx.fillRect(-7, k, 14, 1);
        ctx.restore();
      }
    }
    // Lights, then houses, walls, and keeps, back to front.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const town of world.towns) {
      if (town.ruined) continue;
      const r = (10 + Math.sqrt(town.pop) * 1.5) * (1 + world.era * 0.08);
      glow(X(town.tile.x), Y(town.tile.y), r, '#fbbf24', 0.16 + world.era * 0.025 + (town.burning > world.year ? 0.2 : 0));
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
      if (town.walls) {
        ctx.strokeStyle = 'rgba(168,162,158,0.6)';
        ctx.lineWidth = Math.max(1, p);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14 + town.tier * 4, (14 + town.tier * 4) * 0.7, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const houses = town.houses.slice(0, HOUSES[town.tier]).map((h, i) => ({ x: cx + h[0] * 0.7, y: cy + h[1] * 0.7, i })).sort((a, b) => a.y - b.y);
      for (const h of houses) {
        if (h.i === 0 && town.tier >= 3) stampProp(ctx, s, 'keep', 0, h.x, h.y + 4, p * 0.8);
        else stampProp(ctx, s, 'cottage', h.i % 4 === 3 ? (roof + 1) % 3 : roof, h.x, h.y, p * 0.75);
      }
      // The banner over a capital.
      if (town === town.owner.capital) {
        ctx.fillStyle = '#3f2a17';
        ctx.fillRect(cx + 10, cy - 26, 1, 14);
        ctx.fillStyle = town.owner.color;
        ctx.fillRect(cx + 11, cy - 26 + Math.sin(t * 4) * 0.5, 7, 4);
      }
      // A wonder: a pale spire, lit.
      if (town.wonder) {
        const done = town.wonderAt < 0;
        const k = done ? 1 : 0.4;
        ctx.fillStyle = done ? '#e7e5e4' : 'rgba(168,162,158,0.7)';
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy - 4);
        ctx.lineTo(cx - 10, cy - 4 - 30 * k);
        ctx.lineTo(cx - 6, cy - 4);
        ctx.fill();
        if (done) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(cx - 10, cy - 4 - 30, 16, '#fde68a', 0.5 + 0.15 * Math.sin(t * 2));
          ctx.restore();
        }
      }
      if (town.burning > world.year) fire(cx, cy, town.seed, t, p);
      if (town.plague > 0.1) {
        ctx.fillStyle = `rgba(132,204,22,${(0.12 * town.plague).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (town.besieged) {
        // Tents in a ring, and smoke.
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          stampProp(ctx, s, 'tent', 0, cx + Math.cos(a) * 30, cy + Math.sin(a) * 21, p * 0.7);
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

  function walkers(t: number, p: number) {
    const s = scenery!;
    const list = [...world.walkers].sort((a, b) => a.y - b.y);
    for (const w of list) {
      const x = X(w.x);
      const y = Y(w.y);
      if (w.kind === 'ship') {
        const bob = Math.sin(t * 2 + w.id) * 0.8;
        // A wake behind it.
        ctx.strokeStyle = 'rgba(203,213,225,0.15)';
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 2);
        ctx.lineTo(x + 8, y + 2);
        ctx.stroke();
        stampProp(ctx, s, 'ship', 0, x, y + bob, p * 0.9);
        ctx.fillStyle = w.owner.color;
        ctx.fillRect(Math.round(x), Math.round(y - 9 * p + bob), 3, 2);
        continue;
      }
      const a = atlasFor(w.owner);
      const next = w.path[Math.min(w.path.length - 1, Math.floor(w.at) + 1)];
      const flip = X(next.x) < x;
      const walk = Math.floor(t * 6 + w.id) % 2;
      if (w.kind === 'settlers') {
        stamp(ctx, a, 'peasant', walk, flip, x - 4, y, p * 0.8, 0);
        stamp(ctx, a, 'peasant', 1 - walk, flip, x + 4, y + 2, p * 0.8, 1);
        continue;
      }
      // An army: a few men stand for many, a banner over them.
      const n = Math.max(2, Math.min(7, Math.round(w.size / 30)));
      const fighting = w.state === 'battle' || w.state === 'siege';
      for (let i = 0; i < n; i++) {
        const kind = i === 0 && w.size > 120 ? 'cav' : i % 3 === 2 ? 'arch' : 'inf';
        const frame = fighting && hash(w.id, i, Math.floor(t * 3)) < 0.5 ? 2 : walk;
        stamp(ctx, a, kind, kind === 'cav' ? Math.floor(t * 8) % 3 : frame, flip, x + ((i % 4) - 1.5) * 6, y + Math.floor(i / 4) * 5 - 2, p * 0.8, i);
      }
      ctx.fillStyle = '#3f2a17';
      ctx.fillRect(Math.round(x), Math.round(y - 22), 1, 14);
      ctx.fillStyle = w.owner.color;
      ctx.fillRect(Math.round(x) + 1, Math.round(y - 22 + Math.sin(t * 5 + w.id)), 7, 4);
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
          ctx.moveTo(x, y - 20);
          ctx.lineTo(x + Math.cos(a) * 60, y - 20 + Math.sin(a) * 60);
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
      let y = Math.max(56, Math.min(H - 60, Y(l.y)));
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
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
    ctx.restore();
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      world.resize(W, H);
      landArt = null;
      politics = null;
      shade = null;
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      const p = P();
      const level = 0.55 + 0.45 * host.intensity;
      scenery ??= buildScenery([['#a8a29e', '#57534e'], ['#a8a29e', '#57534e']]);
      if (!landArt || landArt.v !== world.landVersion || landArt.W !== W || landArt.H !== H) paintLand();
      if (!politics || politics.v !== world.version || politics.W !== W || politics.H !== H) paintPolitics();
      if (!shade || shade.W !== W || shade.H !== H) paintShade();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(landArt!.c, 0, 0, W, H);
      // The sea glints, slowly.
      ctx.drawImage(politics!.c, 0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      towns(t, p);
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
      landArt = null;
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
