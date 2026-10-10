/**
 * The Pond, painted. Back to front: the bank, the water, ripples, pads (and the lotus), frogs,
 * the heron, rain, call-outs, then the HUD: the pond's name and cast top left, the chronicle
 * bottom left. Text is crisp (fillCrisp) and shortened to fit (fitText) on a narrow screen.
 *
 * The painter never decides anything: it reads the world and draws. The camera is the kit's
 * framing: the whole pond, drifting in only for the biggest moments.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hexA, typed } from '../../instruments/kit';
import { createPond, type PondWorld } from './sim';

export type PondPaintOptions = { frogs: number; camera: string; labels: boolean; hud: boolean };

const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px ui-serif, Georgia, "Times New Roman", serif`;

export function mountPond(host: SkinHost, o: PondPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: PondWorld = createPond(host.config.seed, W, H, { frogs: o.frogs, camera: o.camera }, host.palette.accent);
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' ? o.camera : 'drift') as CameraMode, world);
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const [water, deep, lily] = world.hues;

  function paint(t: number) {
    const Z = cam.zoom;
    // The bank.
    ctx.fillStyle = '#1f2a1c';
    ctx.fillRect(0, 0, W, H);
    // The water.
    const grad = ctx.createRadialGradient(SX(world.cx), SY(world.cy), 0, SX(world.cx), SY(world.cy), world.rx * Z);
    grad.addColorStop(0, hexA(deep, 0.55));
    grad.addColorStop(1, hexA(water, 0.35));
    ctx.fillStyle = '#0b1a24';
    ctx.beginPath();
    ctx.ellipse(SX(world.cx), SY(world.cy), world.rx * Z, world.ry * Z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(190, 220, 170, 0.25)';
    ctx.lineWidth = 3 * Z;
    ctx.stroke();
    // Ripples.
    for (const q of world.ripples) {
      const age = t - q.t0;
      if (age < 0) continue;
      ctx.strokeStyle = `rgba(220, 240, 255, ${Math.max(0, 0.5 - age * 0.2)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(SX(q.x), SY(q.y), (q.r + age * 22) * Z, (q.r + age * 22) * 0.5 * Z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Pads, with a notch; the lotus on the grown ones.
    for (const p of world.pads) {
      const rr = p.r * (0.4 + 0.6 * p.grown) * Z;
      ctx.fillStyle = hexA(lily, 0.85);
      ctx.beginPath();
      ctx.ellipse(SX(p.x), SY(p.y), rr, rr * 0.55, 0, 0.35, Math.PI * 2 - 0.1);
      ctx.lineTo(SX(p.x), SY(p.y));
      ctx.fill();
      if (p.bloom > 0) {
        ctx.fillStyle = `rgba(249, 168, 212, ${0.9 * world.bloom})`;
        ctx.beginPath();
        ctx.arc(SX(p.x), SY(p.y) - rr * 0.2, rr * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Frogs: a body and two eyes; a hop lifts them.
    for (const f of world.frogs) {
      if (!f.alive) continue;
      const lift = f.hop >= 0 ? Math.sin(Math.min(1, f.hop) * Math.PI) * 26 : 0;
      const x = SX(f.x);
      const y = SY(f.y) - lift * Z;
      ctx.fillStyle = '#4d7c0f';
      ctx.beginPath();
      ctx.ellipse(x, y, 6 * Z, 4 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef9c3';
      ctx.fillRect(x - 4 * Z, y - 4 * Z, 2 * Z, 2 * Z);
      ctx.fillRect(x + 2 * Z, y - 4 * Z, 2 * Z, 2 * Z);
    }
    // The heron: legs, a body, a neck, a bill.
    const h = world.heron;
    if (h) {
      const x = SX(h.x);
      const y = SY(h.y);
      const lean = h.state === 'strike' ? 1 : 0;
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2 * Z;
      ctx.beginPath();
      ctx.moveTo(x - 4 * Z, y);
      ctx.lineTo(x - 4 * Z, y - 30 * Z);
      ctx.moveTo(x + 4 * Z, y);
      ctx.lineTo(x + 4 * Z, y - 30 * Z);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.ellipse(x, y - 38 * Z, 14 * Z, 8 * Z, 0, 0, Math.PI * 2);
      ctx.fill();
      const dir = h.fromLeft ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x + dir * 8 * Z, y - 42 * Z);
      ctx.lineTo(x + dir * (14 + lean * 20) * Z, y - (62 - lean * 30) * Z);
      ctx.lineTo(x + dir * (28 + lean * 26) * Z, y - (60 - lean * 34) * Z);
      ctx.stroke();
    }
    // Rain: short slanted streaks over everything.
    if (world.rain > 0) {
      ctx.strokeStyle = `rgba(200, 225, 255, ${0.25 * world.rain})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 140 * world.rain; k++) {
        const x = ((k * 97.13 + t * 40) % (W + 40)) - 20;
        const y = (k * 53.7 + t * 420) % (H + 40) - 20;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 10);
      }
      ctx.stroke();
    }
    labels(t);
    hud(t);
  }

  function labels(t: number) {
    if (!o.labels) return;
    ctx.font = SERIF(12);
    ctx.textAlign = 'center';
    for (const l of world.labels) {
      const age = t - l.t0;
      ctx.fillStyle = hexA(l.color, Math.min(1, age * 3, (6 - age) / 1.5) * 0.95);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 40, t), W - 32), Math.max(16 + W * 0.2, Math.min(W * 0.8 - 16, SX(l.x))), Math.max(20, SY(l.y)));
    }
    ctx.textAlign = 'left';
  }

  function hud(t: number) {
    if (!o.hud) return;
    const level = 0.55 + 0.45 * host.intensity;
    ctx.font = SERIF(15);
    ctx.fillStyle = hexA('#ece4d4', 0.9 * level);
    fillCrisp(ctx, fitText(ctx, `${world.name}${world.rain > 0 ? ' · RAIN' : ''}`, W - 32), 16, 26);
    ctx.font = SERIF(12);
    ctx.fillStyle = hexA('#b8b2a8', 0.8 * level);
    const alive = world.frogs.filter((f) => f.alive).length;
    fillCrisp(ctx, fitText(ctx, `${alive} FROGS · ${world.pads.length} PADS · ${world.cast.join(', ') || 'a quiet pond'}`, W - 32), 16, 44);
    ctx.font = SERIF(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#ece4d4', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => framing.update(dt, world.t, world.director, W, H),
    paint: (t) => paint(t),
    ambience: () => (world.heron || world.rain > 0 ? 0.8 : 0.35),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
