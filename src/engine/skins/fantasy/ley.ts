/**
 * Leylines' mount: the land at night (ley-sim.ts), its lines of power lit over it.
 *
 * The land is painted once (heights from the sim's noise, with contour lines, the sea round
 * the isles, trees, dunes, or snow by the land). Over it, additively: the lines (dim where
 * no order holds them, in an order's color where it holds both ends, split at the front
 * where two orders duel along one), pulses running along them as fast and as many as the
 * power flowing, the wells breathing light; then the towers in their orders' styles (spire,
 * ziggurat, crystal, tree, obelisk), rising as they are built and raised, warded, toppled;
 * walkers on the lines (builders, ritualists, elementals, shades); duel beams, lightning,
 * storms, rifts; and the moons, whose convergence floods everything with light.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, hash, hexA, mixRgb, typed } from '../instruments/kit';
import { LEYLINES_SCHEMA } from './index';
import { createLeyWorld, LAND_NAMES, type Land, type Line, type Order, type Tower } from './ley-sim';
import { serif } from './names';

type LandLook = { low: string; high: string; sea: string; line: string; speck: string };
const LOOKS: Record<Land, LandLook> = {
  isles: { low: '#13241c', high: '#2c3a2a', sea: '#061220', line: '#3b5a52', speck: '#0d1a14' },
  steppe: { low: '#1c1f14', high: '#33331f', sea: '#0a0c10', line: '#4a4a30', speck: '#14160e' },
  forest: { low: '#0c1a12', high: '#1a2c1c', sea: '#060c0a', line: '#2a4430', speck: '#06100a' },
  desert: { low: '#2a1f12', high: '#45331d', sea: '#0c0a08', line: '#5c4630', speck: '#1e160c' },
  tundra: { low: '#1c2430', high: '#3a4656', sea: '#0a0e14', line: '#56667a', speck: '#141a24' },
};

export function mount(host: SkinHost): SkinInstance {
  const o = resolveOptions(LEYLINES_SCHEMA, host.options) as { land: string; orders: number; storms: number; rifts: number; labels: boolean; hud: boolean };
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world = createLeyWorld(host.config.seed, W, H, { land: o.land, orders: o.orders, storms: o.storms, rifts: o.rifts }, host.noise);
  const look = LOOKS[world.land];
  let nextAmbience = 0;

  const cam = { x: W / 2, y: H / 2, zoom: 1 };
  function camera(dt: number) {
    const f = world.focus;
    const zoom = Math.max(1, Math.min(1.7, f.zoom));
    cam.zoom += (zoom - cam.zoom) * Math.min(1, dt * 0.5);
    const k = Math.min(1, dt * 0.7);
    cam.x += (f.x - cam.x) * k;
    cam.y += (f.y - cam.y) * k;
    const hw = W / 2 / cam.zoom;
    const hh = H / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(world.W - hw, cam.x));
    cam.y = Math.max(hh, Math.min(world.H - hh, cam.y));
  }
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;

  world.bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? SX(e.x) : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });
  const step = (info: FrameInfo) => {
    const dt = host.motion === 'off' ? 0 : Math.min(info.dt, 0.1);
    world.step(dt);
    camera(dt);
    if (world.t >= nextAmbience && host.events?.active) {
      nextAmbience = world.t + 2;
      host.events.emit({ type: 'ambience', weight: world.converging ? 1 : 0.4, pan: 0, near: 1 });
    }
  };

  // ---- the land ---------------------------------------------------------------------------------

  let landC: HTMLCanvasElement | null = null;
  function paintLand() {
    const S = 2;
    const w = Math.ceil(world.W / S);
    const h = Math.ceil(world.H / S);
    landC = document.createElement('canvas');
    landC.width = w;
    landC.height = h;
    const g = landC.getContext('2d')!;
    const img = g.createImageData(w, h);
    const lo = mixRgb(look.low, look.low, 0);
    const hi = mixRgb(look.high, look.high, 0);
    const sea = mixRgb(look.sea, look.sea, 0);
    const ln = mixRgb(look.line, look.line, 0);
    const sp = mixRgb(look.speck, look.speck, 0);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = world.height(x * S, y * S);
      const o4 = (y * w + x) * 4;
      let c: [number, number, number];
      if (world.land === 'isles' && v < 0) {
        const k = Math.max(0, 1 + v * 2);
        c = [sea[0] + 10 * k, sea[1] + 18 * k, sea[2] + 26 * k];
        if (v > -0.04) c = [ln[0] * 0.7, ln[1] * 0.7, ln[2] * 0.7];
      } else {
        const k = Math.max(0, Math.min(1, (v + 0.6) / 1.3));
        c = [lo[0] + (hi[0] - lo[0]) * k, lo[1] + (hi[1] - lo[1]) * k, lo[2] + (hi[2] - lo[2]) * k];
        // Contours, like a map's.
        const band = (v * 9 + 10) % 1;
        if (band < 0.06) c = [c[0] * 0.6 + ln[0] * 0.4, c[1] * 0.6 + ln[1] * 0.4, c[2] * 0.6 + ln[2] * 0.4];
        const n = hash(x, y, 3);
        if (world.land === 'forest' && n < 0.32) c = sp;
        else if (world.land === 'desert' && Math.sin(x * 0.35 + v * 30) > 0.92) c = [c[0] * 1.15, c[1] * 1.1, c[2] * 1.05];
        else if (world.land === 'tundra' && n < 0.06) c = [c[0] * 1.3, c[1] * 1.3, c[2] * 1.3];
        else if (n < 0.08) c = [c[0] * 0.85, c[1] * 0.85, c[2] * 0.85];
      }
      img.data[o4] = c[0];
      img.data[o4 + 1] = c[1];
      img.data[o4 + 2] = c[2];
      img.data[o4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }

  // ---- light --------------------------------------------------------------------------------------

  const glows = new Map<string, HTMLCanvasElement>();
  function glow(x: number, y: number, r: number, color: string, a: number) {
    if (r <= 0 || a <= 0.01 || x < -r || x > W + r || y < -r || y > H + r) return;
    let s = glows.get(color);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = 64;
      const g = s.getContext('2d')!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, hexA(color, 1));
      grad.addColorStop(0.35, hexA(color, 0.35));
      grad.addColorStop(1, hexA(color, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      glows.set(color, s);
    }
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prev;
  }

  /** Points along each line's curve, worked out once. */
  const curves = new Map<number, [number, number][]>();
  const curve = (l: Line) => {
    let c = curves.get(l.id);
    if (!c) {
      c = [];
      for (let i = 0; i <= 16; i++) c.push(world.lineAt(l, i / 16));
      curves.set(l.id, c);
    }
    return c;
  };
  const ownerOf = (id: number) => {
    const t = world.nodes[id].tower;
    return t && t.fell < 0 ? t.order : -1;
  };
  const stroke = (pts: [number, number][], from = 0, to = 1) => {
    ctx.beginPath();
    const n = pts.length - 1;
    const i0 = Math.floor(from * n);
    const i1 = Math.ceil(to * n);
    for (let i = i0; i <= i1; i++) {
      const [x, y] = pts[i];
      if (i === i0) ctx.moveTo(SX(x), SY(y));
      else ctx.lineTo(SX(x), SY(y));
    }
    ctx.stroke();
  };

  function lines(t: number) {
    const z = cam.zoom;
    const surge = world.converging ? 1.6 : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const l of world.lines) {
      const pts = curve(l);
      const dead = world.nodes[l.a].dead >= 0 || world.nodes[l.b].dead >= 0;
      const cut = l.cut > world.t || dead;
      const oa = ownerOf(l.a);
      const ob = ownerOf(l.b);
      const held = oa >= 0 && oa === ob ? world.orders[oa] : null;
      const base = held ? held.color : world.ley;
      const flow = Math.min(1, Math.abs(l.flow) / 2.5);
      if (cut) {
        ctx.setLineDash([3 * z, 6 * z]);
        ctx.strokeStyle = dead ? 'rgba(126,34,206,0.25)' : 'rgba(148,163,184,0.18)';
        ctx.lineWidth = 1;
        stroke(pts);
        ctx.setLineDash([]);
        continue;
      }
      const heat = Math.min(1, l.heat / 12);
      // Free lines are faint; held ones burn in their order's color.
      const strong = held || l.contest ? 1 : 0.45;
      const draw = (color: string, a0: number, a1: number) => {
        ctx.strokeStyle = hexA(color, (0.05 + flow * 0.14) * surge * strong);
        ctx.lineWidth = (5 + flow * 4) * z;
        stroke(pts, a0, a1);
        ctx.strokeStyle = hexA(heat > 0.5 ? '#fca5a5' : color, (0.18 + flow * 0.45) * surge * (0.5 + strong * 0.5));
        ctx.lineWidth = Math.max(1, 1.2 * z);
        stroke(pts, a0, a1);
      };
      if (l.contest) {
        const A = world.orders[oa];
        const B = world.orders[ob];
        draw(A.color, 0, l.front);
        draw(B.color, l.front, 1);
        const [fx, fy] = world.lineAt(l, l.front);
        glow(SX(fx), SY(fy), 18 * z * (0.8 + 0.4 * Math.sin(t * 14)), '#ffffff', 0.5);
      } else draw(base, 0, 1);
      // The pulses: as many and as quick as the power going through.
      const n = Math.min(7, 1 + Math.floor(Math.abs(l.flow) * 0.8));
      const dir = l.flow >= 0 ? 1 : -1;
      const sp = 0.05 + Math.min(0.4, Math.abs(l.flow) * 0.05);
      for (let i = 0; i < n; i++) {
        let k = (t * sp + i / n + hash(l.id, 1)) % 1;
        if (dir < 0) k = 1 - k;
        const [x, y] = world.lineAt(l, k);
        const c = l.contest ? (k < l.front ? world.orders[oa].glow : world.orders[ob].glow) : held ? held.glow : world.ley;
        glow(SX(x), SY(y), (3 + flow * 4) * z * surge, c, 0.55 + flow * 0.3);
      }
    }
    ctx.restore();
  }

  function nodes(t: number) {
    const z = cam.zoom;
    ctx.save();
    for (const n of world.nodes) {
      const X = SX(n.x);
      const Y = SY(n.y);
      if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) continue;
      if (n.dead >= 0) {
        ctx.fillStyle = 'rgba(20,8,30,0.7)';
        ctx.beginPath();
        ctx.ellipse(X, Y, 12 * z, 7 * z, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      if (n.stones && !n.tower) {
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          ctx.fillStyle = '#57534e';
          ctx.fillRect(X + Math.cos(a) * 9 * z - z, Y + Math.sin(a) * 5 * z - 3 * z, 2 * z, 3 * z);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      const charge = Math.min(1, n.charge / 30);
      if (n.well) {
        const b = 0.5 + 0.5 * Math.sin(t * 1.3 + n.id);
        glow(X, Y, (10 + n.well * 8 + charge * 10) * z * (world.converging ? 1.6 : 1), world.ley, 0.35 + b * 0.2 + charge * 0.2);
        ctx.strokeStyle = hexA(world.ley, 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(X, Y, (5 + n.well * 3) * z, (3 + n.well * 2) * z, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else glow(X, Y, (4 + charge * 8) * z, world.ley, 0.25 + charge * 0.3);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /** A tower, in its order's style, at its level; rising while it is built. */
  function tower(tw: Tower, t: number) {
    const n = world.nodes[tw.node];
    const ord = world.orders[tw.order];
    const X = Math.round(SX(n.x));
    const Y = Math.round(SY(n.y));
    if (X < -60 || X > W + 60 || Y < -120 || Y > H + 40) return;
    const p = Math.max(1.5, Math.round(cam.zoom * 3 * (tw.great ? 1.35 : 1)) / 2);
    const built = tw.built;
    const lv = tw.level;
    const R = (x: number, y: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c;
      ctx.fillRect(X + x * p, Y + y * p, w * p, h * p);
    };
    const stone = mixRgbStr('#78716c', ord.color, 0.25);
    const dark = '#292524';
    const full = 6 + lv * 3.5;
    const hgt = Math.max(2, Math.round(full * built));
    // Its shadow and footing.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(X, Y, 7 * p, 2.5 * p, 0, 0, Math.PI * 2);
    ctx.fill();
    switch (ord.style) {
      case 'spire':
        R(-3, -hgt, 6, hgt, stone);
        R(-3, -hgt, 2, hgt, '#78716c');
        if (built >= 1) {
          ctx.fillStyle = ord.color;
          ctx.beginPath();
          ctx.moveTo(X - 4 * p, Y - hgt * p);
          ctx.lineTo(X, Y - (hgt + 7) * p);
          ctx.lineTo(X + 4 * p, Y - hgt * p);
          ctx.fill();
        }
        break;
      case 'ziggurat':
        for (let k = 0; k < Math.ceil((lv + 1) * built); k++) R(-6 + k, -(k + 1) * 3, 12 - k * 2, 3, k % 2 ? '#78716c' : stone);
        if (built >= 1) R(-1, -(lv + 2) * 3, 2, 3, ord.glow);
        break;
      case 'crystal': {
        R(-4, -4, 8, 4, stone);
        if (built >= 1) {
          const fy = Y - (8 + lv * 4 + Math.sin(t * 1.5 + tw.id) * 2) * p;
          ctx.fillStyle = hexA(ord.glow, 0.9);
          ctx.beginPath();
          ctx.moveTo(X, fy - 7 * p);
          ctx.lineTo(X + 4 * p, fy);
          ctx.lineTo(X, fy + 7 * p);
          ctx.lineTo(X - 4 * p, fy);
          ctx.fill();
          ctx.fillStyle = hexA('#ffffff', 0.5);
          ctx.fillRect(X - p, fy - 5 * p, p, 6 * p);
        }
        break;
      }
      case 'tree':
        R(-2, -hgt, 4, hgt, '#5c3d24');
        R(-2, -hgt, 1, hgt, '#7c5a36');
        if (built >= 1) {
          ctx.fillStyle = mixRgbStr(ord.color, '#14532d', 0.55);
          ctx.beginPath();
          ctx.arc(X, Y - hgt * p, (4 + lv * 0.6) * p, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      default:
        // Obelisk.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(X - 3 * p, Y);
        ctx.lineTo(X - 2 * p, Y - hgt * p);
        ctx.lineTo(X, Y - (hgt + 3) * p);
        ctx.lineTo(X + 2 * p, Y - hgt * p);
        ctx.lineTo(X + 3 * p, Y);
        ctx.fill();
        break;
    }
    // Windows and runes, lit by its store of power.
    const lit = Math.min(1, ord.mana / 120);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (built >= 1) {
      for (let k = 0; k < lv; k++) {
        const wy = Y - (3 + k * 3.5) * p;
        ctx.fillStyle = hexA(ord.style === 'obelisk' ? ord.color : '#fde68a', 0.6 + 0.4 * lit);
        ctx.fillRect(X - 0.5 * p, wy, p, p * 1.5);
      }
      glow(X, Y - hgt * p * 0.7, (12 + lv * 4) * p * 0.6, ord.glow, 0.18 + lit * 0.25);
      // Runes going round it.
      for (let k = 0; k < Math.min(5, Math.floor(lit * 5) + 1); k++) {
        const a = t * 0.8 + (k / 5) * Math.PI * 2 + tw.id;
        glow(X + Math.cos(a) * 10 * p, Y - hgt * p * 0.5 + Math.sin(a) * 3 * p, 2.5 * p, ord.glow, 0.6);
      }
      if (tw.ward > world.t) {
        ctx.strokeStyle = hexA(ord.glow, 0.35 + 0.15 * Math.sin(t * 5));
        ctx.lineWidth = Math.max(1, p * 0.6);
        ctx.beginPath();
        ctx.ellipse(X, Y - 4 * p, 12 * p, (hgt + 6) * p * 0.6, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Being raised: scaffold and sparks.
      ctx.strokeStyle = 'rgba(214,211,209,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(X - 5 * p, Y - full * p, 10 * p, full * p);
      if (Math.sin(t * 9 + tw.id) > 0.6) glow(X + (hash(Math.floor(t * 4), tw.id) - 0.5) * 8 * p, Y - hgt * p, 4 * p, '#fde68a', 0.7);
    }
    ctx.restore();
    if (tw.hp < tw.hpMax * 0.5 && built >= 1 && Math.sin(t * 3 + tw.id) > 0) {
      ctx.fillStyle = 'rgba(40,36,36,0.45)';
      ctx.beginPath();
      ctx.arc(X + 2 * p, Y - (hgt + 4) * p - ((t * 6) % 10) * p, 3 * p, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const mixRgbStr = (a: string, b: string, k: number) => {
    const [r0, g0, b0] = mixRgb(a, b, k);
    return `rgb(${r0 | 0},${g0 | 0},${b0 | 0})`;
  };

  function walkers(t: number) {
    const z = cam.zoom;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const w of world.walkers) {
      if (!w.alive) continue;
      const l = world.lines[w.line];
      const [x, y] = world.lineAt(l, Math.max(0, Math.min(1, w.k)));
      const [bx, by] = world.lineAt(l, Math.max(0, Math.min(1, w.k - w.dir * 0.05)));
      const X = SX(x);
      const Y = SY(y);
      const ord: Order | undefined = world.orders[w.order];
      const color = w.kind === 'shade' ? '#7e22ce' : w.kind === 'elemental' ? '#fb923c' : w.kind === 'ritualist' ? '#e0f2fe' : ord?.glow ?? '#ffffff';
      ctx.strokeStyle = hexA(color, 0.4);
      ctx.lineWidth = Math.max(1, 2 * z);
      ctx.beginPath();
      ctx.moveTo(SX(bx), SY(by));
      ctx.lineTo(X, Y);
      ctx.stroke();
      const size = w.kind === 'elemental' ? 7 : w.kind === 'shade' ? 6 : 3.5;
      glow(X, Y, size * z * (1 + 0.2 * Math.sin(t * 10 + w.id)), color, 0.85);
      if (w.kind === 'shade') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(10,4,20,0.8)';
        ctx.beginPath();
        ctx.arc(X, Y, 2.5 * z, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.restore();
  }

  function beams(t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of world.beams) {
      const k = (t - b.t0) / b.dur;
      if (k < 0 || k > 1) continue;
      const a = 1 - k;
      const x0 = SX(b.x0);
      const y0 = SY(b.y0);
      const x1 = SX(b.x1);
      const y1 = b.kind === 'great' ? 0 : SY(b.y1);
      if (b.kind === 'great') {
        const g = ctx.createLinearGradient(x0, y0, x0, 0);
        g.addColorStop(0, hexA(b.color, 0.7 * a));
        g.addColorStop(1, hexA(b.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x0 - 5 * cam.zoom, 0, 10 * cam.zoom, y0);
        glow(x0, y0, 60 * cam.zoom, b.color, 0.6 * a);
        continue;
      }
      ctx.strokeStyle = hexA(b.color, 0.9 * a);
      ctx.lineWidth = b.kind === 'duel' ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      const segs = 7;
      for (let i = 1; i <= segs; i++) {
        const u = i / segs;
        const j = i < segs ? (hash(b.seed, i, Math.floor(t * 20)) - 0.5) * 14 * cam.zoom : 0;
        ctx.lineTo(x0 + (x1 - x0) * u + j, y0 + (y1 - y0) * u + j * 0.5);
      }
      ctx.stroke();
      glow(x1, y1, 16 * cam.zoom, b.color, 0.6 * a);
    }
    ctx.restore();
  }

  function weather(t: number) {
    const z = cam.zoom;
    for (const s of world.storms) {
      const X = SX(s.x);
      const Y = SY(s.y);
      const R = s.r * z;
      if (X < -R * 1.5 || X > W + R * 1.5) continue;
      ctx.save();
      for (let i = 0; i < 16; i++) {
        const a = t * (0.4 + (i % 3) * 0.15) + (i / 16) * Math.PI * 2;
        const d = R * (0.2 + hash(s.id, i) * 0.7);
        const x = X + Math.cos(a) * d;
        const y = Y + Math.sin(a) * d * 0.6;
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.5);
        g.addColorStop(0, i % 4 === 0 ? hexA(s.hue, 0.12) : 'rgba(30,27,45,0.22)');
        g.addColorStop(1, 'rgba(30,27,45,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - R * 0.5, y - R * 0.5, R, R);
      }
      ctx.globalCompositeOperation = 'lighter';
      glow(X, Y, R * 0.9, s.hue, 0.12 + 0.06 * Math.sin(t * 3 + s.id));
      if (Math.sin(t * 7 + s.id * 3) > 0.92) {
        ctx.strokeStyle = hexA('#f5f3ff', 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let x = X + (hash(s.id, Math.floor(t * 3)) - 0.5) * R;
        let y = Y - R * 0.5;
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (hash(k, Math.floor(t * 7), s.id) - 0.5) * 18 * z;
          y += R * 0.16;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const rift of world.rifts) {
      const age = world.t - rift.t0;
      const closing = rift.closed >= 0 ? Math.max(0, 1 - (world.t - rift.closed) / 4) : 1;
      if (closing <= 0) continue;
      const X = SX(rift.x);
      const Y = SY(rift.y);
      const R = rift.r * z * closing * Math.min(1, age / 2);
      if (R < 1) continue;
      ctx.save();
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R * 1.4);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.55, 'rgba(10,0,20,0.9)');
      g.addColorStop(0.75, 'rgba(126,34,206,0.5)');
      g.addColorStop(1, 'rgba(126,34,206,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const rr = R * 1.4 * (0.85 + 0.15 * Math.sin(a * 5 + t * 2) + (hash(k, rift.id) - 0.5) * 0.2);
        if (k) ctx.lineTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * 0.7);
        else ctx.moveTo(X + Math.cos(a) * rr, Y + Math.sin(a) * rr * 0.7);
      }
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      // Light being pulled in.
      for (let k = 0; k < 14; k++) {
        const u = (t * 0.3 + k / 14) % 1;
        const a = k * 2.4 + u * 4;
        const d = R * (2.2 - u * 1.6);
        glow(X + Math.cos(a) * d, Y + Math.sin(a) * d * 0.7, 2.5 * z, '#c084fc', 0.7 * u);
      }
      ctx.restore();
      // The ritual circle about it, if one is being drawn.
      if (rift.closing > 0 && rift.closed < 0) {
        ctx.strokeStyle = hexA('#e0f2fe', 0.25 + 0.4 * Math.min(1, rift.closing));
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(X, Y, R * 1.9, R * 1.3, t * 0.1, 0, Math.PI * 2 * Math.min(1, rift.closing));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function effects(t: number) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of world.fx) {
      const k = (t - f.t0) / f.dur;
      if (k < 0 || k > 1) continue;
      const X = SX(f.x);
      const Y = SY(f.y);
      const z = cam.zoom;
      switch (f.kind) {
        case 'burst':
          glow(X, Y, f.r * z * (0.5 + k * 1.5), f.color, 0.8 * (1 - k));
          break;
        case 'ring':
          ctx.strokeStyle = hexA(f.color, 0.8 * (1 - k));
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(X, Y, f.r * z * (0.4 + k), f.r * z * (0.4 + k) * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spark':
          glow(X + (hash(f.seed, 1) - 0.5) * 10 * z * k, Y - k * 12 * z, 4 * z, f.color, 1 - k);
          break;
        case 'rune': {
          ctx.strokeStyle = hexA(f.color, 0.6 * Math.min(1, (1 - k) * 3));
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let i = 0; i <= 6; i++) {
            const a = (i / 6) * Math.PI * 2 + t * 0.5;
            const x = X + Math.cos(a) * f.r * z;
            const y = Y + Math.sin(a) * f.r * z * 0.55;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
          break;
        }
        case 'rubble':
          ctx.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = i % 2 ? '#57534e' : '#44403c';
            ctx.fillRect(X + (hash(f.seed, i) - 0.5) * f.r * z, Y - hash(i, f.seed) * 3 * z, 3 * z, 2 * z);
          }
          ctx.globalCompositeOperation = 'lighter';
          break;
        default:
          break;
      }
    }
    ctx.restore();
  }

  /** The convergence: everything floods with light. */
  function convergence(t: number) {
    if (!world.converging) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(W / 2, H / 2, Math.max(W, H) * 0.7, world.ley, 0.08 + 0.04 * Math.sin(t * 2));
    ctx.restore();
  }

  function moonsDial(level: number) {
    // Three moons on their tracks, drawing into line at the top of the cycle.
    const cx = W - 46;
    const cy = H - 46;
    ctx.save();
    ctx.strokeStyle = hexA('#e0e7ff', 0.18 * level);
    ctx.lineWidth = 1;
    for (const rr of [12, 20, 28]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    const m = world.moons;
    [1, 2, 3].forEach((k, i) => {
      const a = -Math.PI / 2 + (m * k - Math.floor(m * k)) * Math.PI * 2 * (world.converging ? 0 : 1);
      const rr = 12 + i * 8;
      ctx.fillStyle = hexA(['#e0e7ff', '#fde68a', '#fbcfe8'][i], 0.85 * level);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
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
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, SX(l.x)));
      let y = Math.max(84, Math.min(H - 76, SY(l.y) - 30));
      for (let tries = 0; tries < 6 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 8 && Math.abs(py - y) < 18); tries++) y -= 19;
      placed.push([x, y, w]);
      ctx.fillStyle = `rgba(4,4,10,${(0.6 * a).toFixed(3)})`;
      ctx.fillRect(x - w / 2 - 6, y - 12, w + 12, 16);
      const [cr, cg, cb] = mixRgb(l.color, '#f5ecd7', 0.45);
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${(0.95 * a).toFixed(3)})`;
      fillCrisp(ctx, typed(l.text, age, 40, t), x, y);
    }
    ctx.restore();
  }

  const ORD = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH', 'SEVENTH', 'EIGHTH', 'NINTH', 'TENTH'];
  function hud(t: number, level: number) {
    if (!o.hud) return;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = serif(13);
    ctx.fillStyle = hexA('#e7e5f4', 0.88 * level);
    fillCrisp(ctx, `${LAND_NAMES[world.land]} · THE LINES OF ${world.name}`, 16, 26);
    ctx.font = serif(11);
    ctx.fillStyle = hexA('#a5a3b8', 0.88 * level);
    const toGo = Math.max(0, world.nextConvergence - world.t);
    fillCrisp(ctx, `THE ${ORD[Math.min(9, world.age - 1)]} AGE OF THE LINES · ${world.converging ? 'THE MOONS ARE IN LINE' : toGo < 30 ? 'THE MOONS DRAW TOGETHER' : 'THE MOONS WANDER'} · ${world.rifts.filter((x) => x.closed < 0).length ? 'THE WORLD IS TORN' : 'THE WORLD IS WHOLE'}`, 16, 42);
    ctx.textAlign = 'right';
    let y = 26;
    for (const ord of world.orders) {
      if (!ord.alive) continue;
      const n = world.towers.filter((x) => x.order === ord.id && x.fell < 0).length;
      const war = [...ord.wars].filter((w) => world.orders[w]?.alive).length;
      ctx.fillStyle = hexA(ord.glow, 0.85 * level);
      fillCrisp(ctx, `${ord.name} · ${n} ${n === 1 ? 'TOWER' : 'TOWERS'} · ${ord.archmage}${war ? ' · AT WAR' : ''}`, W - 16, y);
      y += 15;
    }
    ctx.textAlign = 'left';
    ctx.font = serif(12, true);
    const lines2 = world.chronicle.slice(-3);
    lines2.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#e7e5f4', Math.min(1, age * 2) * (i === lines2.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, typed(l.text, age, 50, t), 16, H - 16 - (lines2.length - 1 - i) * 17);
    });
    ctx.restore();
    moonsDial(level);
  }

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    frame(info: FrameInfo) {
      step(info);
      const t = world.t;
      const level = 0.55 + 0.45 * host.intensity;
      if (!landC) paintLand();
      ctx.fillStyle = look.sea;
      ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(landC!, SX(0), SY(0), world.W * cam.zoom, world.H * cam.zoom);
      // A dark edge, like the edge of a lamp's light.
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, 'rgba(2,2,8,0)');
      g.addColorStop(1, 'rgba(2,2,8,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      lines(t);
      nodes(t);
      weather(t);
      walkers(t);
      const ts = world.towers.filter((x) => x.fell < 0).sort((a, b) => world.nodes[a.node].y - world.nodes[b.node].y);
      for (const tw of ts) tower(tw, t);
      effects(t);
      beams(t);
      convergence(t);
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
      landC = null;
    },
  };
}
