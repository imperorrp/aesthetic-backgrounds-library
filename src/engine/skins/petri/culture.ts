/**
 * Petri's second medium: a Lenia culture (lenia.ts) under the same microscope.
 *
 * The culture is a torus a little larger than the eyepiece's field, so its creatures glide
 * out of view and back in, as things do under a real microscope. The technician inoculates
 * Orbium, the glider, a few at a time. Alone, an Orbium glides for ever; two that meet may
 * merge, break apart, both dissolve, or set off an overgrowth that fills the field, which
 * the technician dilutes before inoculating again. The stage follows the biggest creature;
 * the focus drifts and the autofocus hunts. Each creature gets a name in the notebook.
 *
 * DOM-free until the first draw, so the headless runner steps it.
 */
import type { FrameInfo, SkinHost, SkinInspection, SkinInstance, Viewport } from '../../core/skin';
import { createBus } from '../../sim/bus';
import { fillCrisp, hexA, mixRgb, mono, typed } from '../instruments/kit';
import { createLenia, ORBIUM, ORBIUM_CELLS } from './lenia';
import { createChart, createFocus, createNames, createNotebook, DYES, paintEyepiece, reticle } from './scope';
import type { PetriOptions } from './dish';

const N = 128;
/** The eyepiece shows a circle this many cells across its radius. */
const VIEW = 62;
/** Calm: an Orbium glides about four cells a second. */
const STEPS_PER_SECOND = 7;

type Creature = { id: number; x: number; y: number; size: number; born: number; missed: number };
/** What counts as part of a creature, and how big a thing must be to count as one. */
const LIVE = 0.06;
const BODY = 40;

export function mountCulture(host: SkinHost, o: PetriOptions): SkinInstance {
  const r = host.fork('culture');
  const life = host.fork('culture-life');
  let W = host.viewport.width;
  let H = host.viewport.height;
  let cx = W / 2;
  let cy = H / 2;
  let R = Math.min(W, H) * 0.46;
  let t = 0;
  const bus = createBus(() => t);
  const lenia = createLenia(N, ORBIUM);
  const names = createNames(host.config.seedHash, String(host.config.seed));
  const notebook = createNotebook();
  const chart = createChart(2);
  const focus = createFocus();
  const dye = DYES[o.stain][0];
  /** The middle of the view, in cells (the stage pans across the torus). */
  let vx = N / 2;
  let vy = N / 2;

  // ---- telling ---------------------------------------------------------------------------------

  const log: { t: number; text: string; color: string }[] = [];
  const cs = () => R / VIEW;
  /** A cell to the screen (nearest copy on the torus to the view). */
  const wrapNear = (a: number, b: number) => a + Math.round((b - a) / N) * N;
  const toScreen = (x: number, y: number) => ({ x: cx + (wrapNear(x, vx) - vx) * cs(), y: cy + (wrapNear(y, vy) - vy) * cs() });
  const say = (text: string, x: number, y: number, color: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    log.push({ t, text, color });
    if (log.length > 5) log.shift();
    const s = toScreen(x, y);
    bus.emit({ type: 'say', text, x: s.x, y: s.y, color, priority });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    const s = toScreen(x, y);
    bus.emit({ type, x: s.x, y: s.y, weight });
  };
  bus.on('*', (e) => {
    const out = host.events;
    if (!out?.active) return;
    const x = typeof e.x === 'number' ? e.x : W / 2;
    out.emit({ type: e.type, weight: e.weight ?? 0.2, pan: Math.max(-1, Math.min(1, (x / Math.max(1, W)) * 2 - 1)), near: 1, text: e.text, color: e.color, priority: e.priority });
  });
  const spec = (id: number) => `NO. ${String(id).padStart(4, '0')}`;
  const nameOf = (id: number) => `Orbium ${names.epithet(id)}`;

  // ---- the culture -------------------------------------------------------------------------------

  let creatures: Creature[] = [];
  let nextId = 1;
  const torusDist = (ax: number, ay: number, bx: number, by: number) => {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return Math.hypot(Math.min(dx, N - dx), Math.min(dy, N - dy));
  };

  /**
   * Inoculate: Orbia placed apart from each other and from what is there; `near` puts one
   * within reach of an existing creature, so they are likely to meet.
   */
  function inoculate(n: number, near = false) {
    let placed = 0;
    const taken = creatures.map((c) => [c.x, c.y]);
    const host2 = near && creatures.length ? creatures[Math.floor(r() * creatures.length)] : null;
    for (let tries = 0; tries < 60 && placed < n; tries++) {
      // Somewhere the eyepiece can see, mostly; or a little way from a creature.
      const a = r() * Math.PI * 2;
      const d = host2 ? 36 + r() * 8 : Math.sqrt(r()) * VIEW * 0.8;
      const x = ((host2 ? host2.x : vx) + Math.cos(a) * d + N) % N;
      const y = ((host2 ? host2.y : vy) + Math.sin(a) * d + N) % N;
      if (taken.some(([px, py]) => torusDist(px, py, x, y) < 34)) continue;
      taken.push([x, y]);
      lenia.place(ORBIUM_CELLS, x - 10, y - 10, Math.floor(r() * 4), r() < 0.5);
      placed++;
    }
    return placed;
  }

  // ---- watching ---------------------------------------------------------------------------------

  const seen = new Uint8Array(N * N);
  const stack = new Int32Array(N * N);
  function look() {
    seen.fill(0);
    const found: Creature[] = [];
    for (let k = 0; k < N * N; k++) {
      if (seen[k] || lenia.A[k] < LIVE) continue;
      // A blob, on the torus: its centroid unwrapped around where the search began.
      const ox = k % N;
      const oy = (k / N) | 0;
      let size = 0;
      let sx = 0;
      let sy = 0;
      let top = 0;
      stack[top++] = k;
      seen[k] = 1;
      while (top) {
        const c = stack[--top];
        const x = c % N;
        const y = (c / N) | 0;
        size++;
        sx += wrapNear(x, ox);
        sy += wrapNear(y, oy);
        // Eight neighbours: a creature's thin parts still hold it together.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = ((y + dy + N) % N) * N + ((x + dx + N) % N);
            if (!seen[j] && lenia.A[j] >= LIVE) {
              seen[j] = 1;
              stack[top++] = j;
            }
          }
        }
      }
      if (size < BODY) continue;
      found.push({ id: -1, x: ((sx / size) % N + N) % N, y: ((sy / size) % N + N) % N, size, born: t, missed: 0 });
    }
    // Match to the last look: nearest within reach.
    const prevBy = new Map<Creature, Creature[]>();
    for (const f of found) {
      let best: Creature | null = null;
      let bd = 16;
      for (const p of creatures) {
        const d = torusDist(p.x, p.y, f.x, f.y);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      if (best) {
        (prevBy.get(best) ?? prevBy.set(best, []).get(best)!).push(f);
        if (f.id < 0 && prevBy.get(best)!.length === 1) {
          f.id = best.id;
          f.born = best.born;
        }
      }
    }
    for (const f of found) if (f.id < 0) {
      f.id = nextId++;
      if (t > 2) {
        emit('emerge', f.x, f.y, 0.25);
        notebook.write(t, `A new one: ${nameOf(f.id)} (no. ${f.id})`);
      }
    }
    // Two old ones in one new one: they met.
    for (const f of found) {
      const parents = creatures.filter((p) => torusDist(p.x, p.y, f.x, f.y) < Math.sqrt(p.size) * 0.9 + 6);
      if (parents.length >= 2 && f.size > parents[0].size * 1.3) {
        say(`${spec(parents[0].id)} AND ${spec(parents[1].id)} COLLIDE`, f.x, f.y, '#f9a8d4', 'medium');
        emit('engulf', f.x, f.y, 0.55);
        notebook.write(t, `${nameOf(parents[0].id)} ran into ${nameOf(parents[1].id)}`);
      }
    }
    // One old one in two new ones: it broke apart.
    for (const [p, kids] of prevBy) if (kids.length >= 2) {
      say(`${spec(p.id)} BREAKS IN TWO`, p.x, p.y, '#e2e8f0', 'medium');
      emit('division', p.x, p.y, 0.5);
      notebook.write(t, `${nameOf(p.id)} broke in two`);
    }
    // Gone: dissolved (if it is missing two looks running; one can be a flicker).
    const keep: Creature[] = [];
    for (const p of creatures) {
      if (found.some((f) => f.id === p.id) || prevBy.has(p)) continue;
      if (p.missed < 1) {
        keep.push({ ...p, missed: p.missed + 1 });
        continue;
      }
      if (p.size < 60) continue;
      say(`${spec(p.id)} DISSOLVES`, p.x, p.y, '#94a3b8', 'low');
      emit('dissolve', p.x, p.y, 0.3);
      notebook.write(t, `${nameOf(p.id)} came apart and was gone`);
    }
    creatures = found.concat(keep);
    if (t >= nextChart) {
      nextChart = t + 2;
      chart.push([lenia.mass() / 8, creatures.length * 10]);
    }
  }
  let nextChart = 0;

  // ---- the technician ---------------------------------------------------------------------------

  let emptySince = -1;
  let overSince = -1;
  let nextInoculation = 40 + r() * 30;
  let nextDisk = 110 + r() * 90;
  const disks: { x: number; y: number; r: number; t0: number }[] = [];

  function technician() {
    const mass = lenia.mass();
    if (!creatures.length && mass < 20) {
      if (emptySince < 0) emptySince = t;
      if (t - emptySince > 3) {
        emptySince = -1;
        const n = inoculate(2 + Math.floor(r() * 2));
        say(`INOCULATION · ORBIUM × ${n}`, vx, vy, dye, 'low');
        emit('drop', vx, vy, 0.35);
        notebook.write(t, `The dish was empty. Inoculated ${n} Orbium`);
      }
    } else emptySince = -1;
    if (t >= nextInoculation && o.drops > 0) {
      // Sooner when the culture is thin; now and then one set near another, to see them meet.
      nextInoculation = t + (creatures.length < 4 ? 10 + r() * 8 : 40 + r() * 35) / o.drops;
      if (creatures.length < 5) {
        const n = inoculate(1, r() < 0.3);
        if (n) {
          say('INOCULATION · ORBIUM', vx, vy, dye, 'low');
          emit('drop', vx, vy, 0.35);
          notebook.write(t, 'Added one more Orbium');
        }
      }
    }
    // Overgrowth: a collision that set the whole field going. Dilute, and start again.
    if (mass > 900) {
      if (overSince < 0) {
        overSince = t;
        say('OVERGROWTH · THE CULTURE RUNS WILD', vx, vy, '#fde68a', 'high');
        emit('colony', vx, vy, 0.7);
        notebook.write(t, 'It has overgrown the whole field. Leaving it a moment');
      } else if (t - overSince > 10) {
        overSince = -1;
        lenia.A.fill(0);
        creatures = [];
        flash = t;
        const n = inoculate(2);
        say(`DILUTED · FRESH INOCULATION × ${n}`, vx, vy, '#c4b5fd', 'high');
        emit('dilute', vx, vy, 0.6);
        notebook.write(t, `Diluted the culture and inoculated ${n} again`);
      }
    } else overSince = -1;
    if (t >= nextDisk && o.drops > 0 && creatures.length >= 2) {
      nextDisk = t + (140 + r() * 120) / o.drops;
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * VIEW * 0.6;
      const x = (vx + Math.cos(a) * d + N) % N;
      const y = (vy + Math.sin(a) * d + N) % N;
      disks.push({ x, y, r: 9, t0: t });
      say('A DROP OF REAGENT', x, y, '#f8fafc', 'medium');
      emit('toxin', x, y, 0.5);
      notebook.write(t, 'A drop of reagent, to see what they do');
    }
    for (const d of disks) if (t - d.t0 < 6) lenia.clear(d.x, d.y, Math.round(d.r * Math.min(1, (t - d.t0) / 2)));
    for (let i = disks.length - 1; i >= 0; i--) if (t - disks[i].t0 > 14) disks.splice(i, 1);
  }
  let flash = -10;

  /** The stage follows the biggest creature, the short way round the torus. */
  function stage(dt: number) {
    const big = creatures.reduce<Creature | null>((a, b) => (!a || b.size > a.size ? b : a), null);
    if (!big) return;
    const tx = wrapNear(big.x, vx);
    const ty = wrapNear(big.y, vy);
    const k = Math.min(1, dt * 0.25);
    vx = (vx + (tx - vx) * k + N) % N;
    vy = (vy + (ty - vy) * k + N) % N;
  }

  let acc = 0;
  let nextLook = 0.5;
  let nextAmbience = 0;
  function step(dt: number) {
    if (dt <= 0) return;
    t += dt;
    acc += dt * STEPS_PER_SECOND;
    let n = 0;
    while (acc >= 1 && n < 4) {
      lenia.step();
      acc -= 1;
      n++;
    }
    acc = Math.min(acc, 1);
    technician();
    if (t >= nextLook) {
      nextLook = t + 0.5;
      look();
    }
    stage(dt);
    if (focus.step(t, dt, life)) bus.emit({ type: 'refocus', x: cx, y: cy, weight: 0.15 });
    if (t >= nextAmbience && host.events?.active) {
      nextAmbience = t + 2;
      host.events.emit({ type: 'ambience', weight: Math.min(1, creatures.length / 5), pan: 0, near: 1 });
    }
  }

  // ---- drawing -----------------------------------------------------------------------------------

  const { ctx } = host;
  let medium: { W: number; H: number; c: HTMLCanvasElement } | null = null;
  let field: { c: HTMLCanvasElement; g: CanvasRenderingContext2D; img: ImageData } | null = null;
  let soft: { c: HTMLCanvasElement; g: CanvasRenderingContext2D } | null = null;
  const [dr, dg, db] = mixRgb(dye, dye, 0);

  /** The culture as an image: dye where it lives, a pale rim where it grows, a warm one where it dies. */
  function paintField() {
    if (!field) {
      const c = document.createElement('canvas');
      c.width = N;
      c.height = N;
      const g = c.getContext('2d')!;
      field = { c, g, img: g.createImageData(N, N) };
    }
    const d = field.img.data;
    const A = lenia.A;
    const G = lenia.G;
    for (let k = 0; k < N * N; k++) {
      const a = A[k];
      const g = G[k];
      let rr: number;
      let gg: number;
      let bb: number;
      let al: number;
      if (o.stain === 'phase') {
        // Phase contrast: dark bodies with bright edges.
        const x = k % N;
        const y = (k / N) | 0;
        const e = Math.abs(A[y * N + ((x + 1) % N)] - A[y * N + ((x + N - 1) % N)]) + Math.abs(A[((y + 1) % N) * N + x] - A[((y + N - 1) % N) * N + x]);
        const v = Math.min(1, e * 3);
        rr = 30 + v * 200;
        gg = 32 + v * 200;
        bb = 34 + v * 205;
        al = Math.min(1, a * 2 + v) * 255;
      } else {
        const grow = Math.max(0, g) * a;
        const die = Math.max(0, -g) * a * 0.5;
        const k = 0.35 + a * 1.1;
        rr = dr * k + 200 * grow + 160 * die;
        gg = dg * k + 230 * grow + 40 * die;
        bb = db * k + 255 * grow + 120 * die;
        al = Math.min(1, a * 2.2) * 255;
      }
      d[k * 4] = Math.min(255, rr);
      d[k * 4 + 1] = Math.min(255, gg);
      d[k * 4 + 2] = Math.min(255, bb);
      d[k * 4 + 3] = al;
    }
    field.g.putImageData(field.img, 0, 0);
    // Out of focus: through a smaller copy first, which softens it.
    const f = focus.f;
    if (f > 0.97) return field.c;
    if (!soft) {
      const c = document.createElement('canvas');
      soft = { c, g: c.getContext('2d')! };
    }
    const s = Math.max(16, Math.round(N * (0.25 + 0.75 * f) ** 2));
    soft.c.width = s;
    soft.c.height = s;
    soft.g.imageSmoothingEnabled = true;
    soft.g.drawImage(field.c, 0, 0, s, s);
    return soft.c;
  }

  function draw() {
    const level = 0.55 + 0.45 * host.intensity;
    if (!medium || medium.W !== W || medium.H !== H) medium = { W, H, c: paintEyepiece(host, W, H, cx, cy, R, o.stain) };
    ctx.drawImage(medium.c, 0, 0, W, H);
    const img = paintField();
    const size = N * cs();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalCompositeOperation = o.stain === 'phase' ? 'source-over' : 'lighter';
    ctx.globalAlpha = level * (0.6 + 0.4 * focus.f);
    // The torus, tiled so the round view is always covered.
    const ox = cx - vx * cs();
    const oy = cy - vy * cs();
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const x = ox + i * size;
        const y = oy + j * size;
        if (x > cx + R || x + size < cx - R || y > cy + R || y + size < cy - R) continue;
        ctx.drawImage(img, x, y, size, size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // Reagent drops, spreading.
    for (const d of disks) {
      const k = Math.min(1, (t - d.t0) / 2);
      const fade = Math.max(0, 1 - (t - d.t0) / 14);
      const s = toScreen(d.x, d.y);
      ctx.strokeStyle = `rgba(248,250,252,${(0.25 * fade).toFixed(3)})`;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, d.r * k * cs(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    if (t - flash < 0.8) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = `rgba(167,139,250,${(0.22 * (1 - (t - flash) / 0.8)).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    reticle(ctx, cx, cy, R);
    if (o.tracking) brackets(level);
    if (o.hud) hud(level);
  }

  function brackets(level: number) {
    ctx.save();
    ctx.font = mono(9);
    ctx.textAlign = 'left';
    const picks = [...creatures].sort((a, b) => b.size - a.size).slice(0, 3);
    for (const c of picks) {
      const s = toScreen(c.x, c.y);
      if (Math.hypot(s.x - cx, s.y - cy) > R * 0.9) continue;
      const half = (Math.sqrt(c.size) * 0.75 + 4) * cs();
      const x0 = s.x - half;
      const y0 = s.y - half;
      const x1 = s.x + half;
      const y1 = s.y + half;
      const l = Math.min(12, half * 0.6);
      ctx.strokeStyle = hexA('#e2e8f0', 0.5 * level);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [x, y, dx, dy] of [
        [x0, y0, 1, 1],
        [x1, y0, -1, 1],
        [x0, y1, 1, -1],
        [x1, y1, -1, -1],
      ]) {
        ctx.moveTo(x, y + dy * l);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * l, y);
      }
      ctx.stroke();
      const age = t - c.born;
      const text = `${nameOf(c.id).toUpperCase()} · ${spec(c.id)} · MASS ${c.size} · ${Math.floor(age / 60)}:${String(Math.floor(age % 60)).padStart(2, '0')}`;
      const w = ctx.measureText(text).width;
      const tx = Math.max(8, Math.min(W - w - 8, x0));
      const ty = Math.max(14, y0 - 6);
      ctx.fillStyle = 'rgba(2,6,10,0.65)';
      ctx.fillRect(tx - 3, ty - 9, w + 6, 12);
      ctx.fillStyle = hexA('#e2e8f0', 0.85 * level);
      fillCrisp(ctx, text, tx, ty);
    }
    ctx.restore();
  }

  function hud(level: number) {
    ctx.save();
    ctx.font = mono(10);
    ctx.textBaseline = 'alphabetic';
    const ink = hexA('#94a3b8', 0.85 * level);
    ctx.fillStyle = ink;
    ctx.textAlign = 'left';
    const stainName = o.stain === 'darkfield' ? 'DARKFIELD' : o.stain === 'phase' ? 'PHASE CONTRAST' : 'FLUORESCENCE';
    const focusText = focus.hunting >= 0 ? 'AUTOFOCUS' : `FOCUS ${Math.round(focus.f * 100)}%`;
    fillCrisp(ctx, `PETRI // LENIA CULTURE // R ${ORBIUM.R} μ ${ORBIUM.mu} σ ${ORBIUM.sigma} // ${stainName} // ${focusText}`, 14, 20);
    ctx.textAlign = 'right';
    fillCrisp(ctx, `T+${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`, W - 14, 20);
    fillCrisp(ctx, `CREATURES ${creatures.length} // MASS ${Math.round(lenia.mass())}`, W - 14, H - 14);
    ctx.textAlign = 'left';
    const lines = log.slice(-4);
    lines.forEach((l, i) => {
      const y = H - 14 - (lines.length - 1 - i) * 14;
      ctx.fillStyle = hexA(l.color, (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, `> ${typed(l.text, t - l.t, 40, t)}`, 14, y);
    });
    ctx.restore();
    if (o.notebook) {
      notebook.draw(ctx, W - 14, 42, t, level);
      chart.draw(ctx, W - 180, H - 82, 166, 46, [dye, '#e2e8f0'], level, 'MASS · CREATURES · 2 MIN');
    }
  }

  inoculate(4);

  return {
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      cx = W / 2;
      cy = H / 2;
      R = Math.min(W, H) * 0.46;
      medium = null;
    },
    frame(info: FrameInfo) {
      step(host.motion === 'off' ? 0 : Math.min(info.dt, 0.1));
      draw();
    },
    advance(info: FrameInfo) {
      step(Math.min(info.dt, 0.1));
    },
    inspect(): SkinInspection {
      return {
        t,
        counts: { creatures: creatures.length, mass: Math.round(lenia.mass()) },
        log: bus.log.map((e) => ({ t: e.t ?? 0, text: e.type === 'say' ? e.text ?? '' : `[${e.type}]`, kind: e.type === 'say' ? e.priority ?? 'low' : e.type, type: e.type })),
        seq: bus.seq,
      };
    },
    destroy() {
      medium = null;
      field = null;
      soft = null;
    },
  };
}
