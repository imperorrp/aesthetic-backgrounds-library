/**
 * Dread: the cosmic horror under the Choir.
 *
 * - An eye opens in the dark behind the map: enormous, faint, almond-lidded. Its pupil
 *   finds the pointer if there is one, otherwise whatever is moving. It blinks, then closes.
 * - Stars go out: one at a time a system's star dims to a dead disc and stays dead.
 * - The light is eaten: the whole map darkens except one shrinking pool of light.
 * - The signal tears: for a moment, bands of the picture slip sideways.
 *
 * Everything here is quiet and slow on purpose; it is meant to be noticed late.
 */
import { hexRgba } from '../renderers/utils';
import { registerMechanic } from './types';

registerMechanic({
  id: 'dread',
  label: 'Dread',
  description: 'An eye opens in the dark, stars go out one by one, the light is eaten, and the signal tears.',
  schema: {
    eyes: { type: 'boolean', default: true, label: 'The eye' },
    starsOut: { type: 'number', min: 0, max: 2, default: 0.4, label: 'Stars going out per minute' },
    eclipses: { type: 'boolean', default: true, label: 'The light is eaten' },
    tears: { type: 'boolean', default: true, label: 'Signal tears' },
    color: { type: 'color', default: '#a78bfa', label: 'Color' },
  },
  create(api, p) {
    const color = String(p.color || '#a78bfa');
    type Eye = { x: number; y: number; r: number; at: number; dur: number; look: { x: number; y: number } };
    let eye: Eye | null = null;
    let nextEye = api.t + 25 + api.rng() * 25;
    let nextStarOut = api.t + 30 + api.rng() * 30;
    let eclipse: { x: number; y: number; at: number } | null = null;
    let nextEclipse = api.t + 50 + api.rng() * 50;
    let tear: { at: number; seed: number } | null = null;
    let nextTear = api.t + 12 + api.rng() * 18;

    /** What the eye looks at: the visitor, or else the busiest thing on the map. */
    const lookTarget = () => {
      const pt = api.host.pointer;
      if (pt.active && pt.idle < 6) return { x: api.camera.wx(pt.x) - api.view().left, y: api.camera.wy(pt.y) };
      const f = api.world.fleets.find((fl) => fl.ships[0] && !fl.z && api.onScreen(fl.ships[0].x, fl.ships[0].y, 0));
      return f ? { x: api.screenX(f.ships[0].x), y: f.ships[0].y } : { x: api.width / 2, y: api.height / 2 };
    };

    return {
      update() {
        if (p.eyes !== false && !eye && api.t >= nextEye) {
          const r = api.height * (0.22 + api.rng() * 0.12);
          eye = { x: api.width * (0.2 + api.rng() * 0.6), y: api.height * (0.3 + api.rng() * 0.4), r, at: api.t, dur: 14 + api.rng() * 6, look: { x: api.width / 2, y: api.height / 2 } };
          api.emit({ type: 'eye', x: api.view().left + eye.x, y: eye.y, weight: 0.5 });
          nextEye = api.t + 80 + api.rng() * 60;
        }
        if (eye) {
          const t = lookTarget();
          eye.look.x += (t.x - eye.look.x) * 0.04;
          eye.look.y += (t.y - eye.look.y) * 0.04;
          if (api.t > eye.at + eye.dur) eye = null;
        }
        const rate = Number(p.starsOut ?? 0.4);
        if (rate > 0 && api.t >= nextStarOut) {
          const lit = api.world.systems.filter((s) => !s.z && s.darkAt === undefined && api.onScreen(s.x, s.y, 80));
          if (lit.length) {
            const s = lit[Math.floor(api.rng() * lit.length)];
            s.darkAt = api.t;
            api.say(`${s.name} HAS GONE OUT`, s.x, s.y + 30, color, { priority: 'high', duration: 6000 });
            api.emit({ type: 'starout', x: s.x, y: s.y, weight: 0.75 });
          }
          nextStarOut = api.t + (60 / rate) * (0.7 + api.rng() * 0.6);
        }
        if (p.eclipses !== false && !eclipse && api.t >= nextEclipse) {
          eclipse = { x: api.width * (0.25 + api.rng() * 0.5), y: api.height * (0.3 + api.rng() * 0.4), at: api.t };
          api.say('THE LIGHT IS EATEN', api.view().left + eclipse.x, eclipse.y - 40, color, { priority: 'high', duration: 5000 });
          api.emit({ type: 'eclipse', x: api.view().left + eclipse.x, y: eclipse.y, weight: 0.55 });
          nextEclipse = api.t + 110 + api.rng() * 70;
        }
        if (eclipse && api.t - eclipse.at > 9) eclipse = null;
        if (p.tears !== false && api.t >= nextTear) {
          tear = { at: api.t, seed: api.rng() * 1000 };
          nextTear = api.t + 20 + api.rng() * 30;
        }
        if (tear && api.t - tear.at > 0.35) tear = null;
      },
      draw(ctx, pass, frame) {
        if (pass === 'ground' && eye) {
          // The eye lives behind everything, in screen space terms but drawn in map space.
          const age = frame.time - eye.at;
          const open = Math.min(1, age / 4) * Math.min(1, (eye.dur - age) / 3);
          // Blinks: two quick closings.
          const blink = [6, 6.25, 10.5, 10.75].some((b) => age > b - 0.12 && age < b + 0.12) ? 0.1 : 1;
          const lid = open * blink;
          if (lid <= 0.01) return;
          // The eye hangs in the sky: fixed in map space, not on the map.
          const cx = eye.x;
          const cy = eye.y;
          const w = eye.r * 1.9;
          const h = eye.r * 0.9 * lid;
          ctx.save();
          // Almond lids.
          ctx.beginPath();
          ctx.moveTo(cx - w, cy);
          ctx.quadraticCurveTo(cx, cy - h * 1.6, cx + w, cy);
          ctx.quadraticCurveTo(cx, cy + h * 1.6, cx - w, cy);
          ctx.closePath();
          ctx.fillStyle = hexRgba(color, 0.04 * open);
          ctx.fill();
          ctx.strokeStyle = hexRgba(color, 0.18 * open);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.clip();
          // Veins, then the iris and a slit pupil turned toward what it watches.
          ctx.strokeStyle = hexRgba('#f87171', 0.06 * open);
          ctx.beginPath();
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + 0.3;
            ctx.moveTo(cx + Math.cos(a) * w, cy + Math.sin(a) * h);
            ctx.quadraticCurveTo(cx + Math.cos(a + 0.4) * w * 0.6, cy + Math.sin(a + 0.4) * h * 0.6, cx + Math.cos(a) * eye.r * 0.6, cy + Math.sin(a) * eye.r * 0.6);
          }
          ctx.stroke();
          const dx = eye.look.x - cx;
          const dy = eye.look.y - cy;
          const d = Math.hypot(dx, dy) || 1;
          const off = Math.min(eye.r * 0.35, d * 0.15);
          const ix = cx + (dx / d) * off;
          const iy = cy + (dy / d) * off * 0.6;
          const iris = ctx.createRadialGradient(ix, iy, 0, ix, iy, eye.r * 0.62);
          iris.addColorStop(0, hexRgba(color, 0.02));
          iris.addColorStop(0.55, hexRgba(color, 0.13 * open));
          iris.addColorStop(1, hexRgba(color, 0));
          ctx.fillStyle = iris;
          ctx.beginPath();
          ctx.arc(ix, iy, eye.r * 0.62, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(0,0,0,${0.55 * open})`;
          ctx.beginPath();
          ctx.ellipse(ix, iy, eye.r * 0.07, eye.r * 0.42, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        if (pass === 'hud' && eclipse) {
          // Everything darkens but a pool of light that shrinks and returns.
          const age = frame.time - eclipse.at;
          const k = Math.min(1, age / 2) * Math.min(1, (9 - age) / 2.5);
          const r = Math.max(60, api.width * (0.5 - 0.35 * Math.min(1, age / 5)));
          const g = ctx.createRadialGradient(eclipse.x, eclipse.y, r * 0.4, eclipse.x, eclipse.y, r * 1.6);
          g.addColorStop(0, 'rgba(0,0,0,0)');
          g.addColorStop(1, `rgba(2,0,6,${0.55 * k})`);
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, api.width, api.height);
        }
        if (pass === 'hud' && tear) {
          // Bands of the frame slip sideways for a moment.
          const canvas = ctx.canvas;
          const sx = canvas.width / api.width;
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          for (let i = 0; i < 5; i++) {
            const h1 = Math.sin(tear.seed + i * 12.9898) * 43758.5453;
            const u = h1 - Math.floor(h1);
            const y = Math.floor(u * canvas.height);
            const hgt = Math.max(2, Math.floor(((u * 7) % 1) * 18 * sx));
            const shift = Math.round((u - 0.5) * 40 * sx);
            ctx.drawImage(canvas, 0, y, canvas.width, hgt, shift, y, canvas.width, hgt);
          }
          ctx.restore();
          ctx.fillStyle = hexRgba(color, 0.5);
          ctx.font = '9px "Syne Mono", ui-monospace, monospace';
          ctx.fillText('SIGNAL TORN', 14, 22);
        }
      },
    };
  },
});
