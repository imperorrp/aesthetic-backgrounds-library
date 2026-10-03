/**
 * Abyssal scanner: the view from a deep submersible. Marine snow falls through the
 * dark, a deep scattering layer hangs at one depth, and bioluminescent animals
 * drift: pulsing medusae, a siphonophore's long chain of lights, a school of
 * lanternfish, an anglerfish lure, comb jellies with running color. A sonar fan
 * sweeps from the vehicle; whatever it passes over brightens and gets identified.
 * Once in a long while something very large crosses the edge of the light.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';
import { resolveOptions } from '../../core/schema';
import { clamp01, hash, hexA, mono, typed } from './kit';

const schema = {
  life: { type: 'number', min: 0.3, max: 2, default: 1, label: 'Life' },
  snow: { type: 'number', min: 0, max: 2, default: 1, label: 'Marine snow' },
  scan: { type: 'boolean', default: true, label: 'Sonar fan' },
} satisfies Schema;

type Kind = 'medusa' | 'siphonophore' | 'lanternfish' | 'angler' | 'ctenophore';
type Creature = { kind: Kind; x: number; y: number; vx: number; vy: number; size: number; phase: number; color: string; scannedAt: number; id: number };

const SPECIES: Record<Kind, { name: string; colors: string[] }> = {
  medusa: { name: 'PERIPHYLLA PERIPHYLLA', colors: ['#7dd3fc', '#c4b5fd'] },
  siphonophore: { name: 'PRAYA DUBIA', colors: ['#5eead4', '#93c5fd'] },
  lanternfish: { name: 'MYCTOPHIDAE · SCHOOL', colors: ['#67e8f9'] },
  angler: { name: 'MELANOCETUS JOHNSONII', colors: ['#a5f3fc'] },
  ctenophore: { name: 'BEROE · COMB JELLY', colors: ['#f0abfc', '#a5b4fc'] },
};

export const abyssalSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'abyssal',
  label: 'Abyssal scanner',
  description: 'A deep submersible\'s view: marine snow, bioluminescent animals, and a sonar fan that identifies them.',
  tags: ['instrument', 'ocean', 'dark', 'cyan'],
  schema,
  defaults: { palette: { from: '#22d3ee' }, intensity: 0.55 },
  mount(host: SkinHost) {
    const o = resolveOptions(schema, host.options);
    const { ctx, palette } = host;
    const rng = host.fork('abyss');
    let W = host.viewport.width;
    let H = host.viewport.height;
    const accent = palette.accent;
    const ink = palette.ink;
    let nextId = 1;

    const snow = Array.from({ length: Math.round(220 * o.snow) }, () => ({ x: rng(), y: rng(), z: 0.3 + rng() * 0.7, s: rng() }));
    const creatures: Creature[] = [];
    const spawn = (kind: Kind, x: number, y: number): Creature => {
      const colors = SPECIES[kind].colors;
      return {
        kind,
        x,
        y,
        vx: (rng() - 0.5) * (kind === 'lanternfish' ? 22 : 6),
        vy: (rng() - 0.5) * 3,
        size: kind === 'siphonophore' ? 26 + rng() * 22 : kind === 'medusa' ? 11 + rng() * 12 : kind === 'ctenophore' ? 10 + rng() * 7 : 6 + rng() * 4,
        phase: rng() * 10,
        color: colors[Math.floor(rng() * colors.length)],
        scannedAt: -99,
        id: nextId++,
      };
    };
    const kinds: Kind[] = ['medusa', 'medusa', 'siphonophore', 'lanternfish', 'angler', 'ctenophore', 'medusa', 'ctenophore'];
    const populate = () => {
      creatures.length = 0;
      const n = Math.round(13 * o.life * Math.max(0.6, Math.min(1.6, (W * H) / (1280 * 800))));
      for (let i = 0; i < n; i++) creatures.push(spawn(kinds[i % kinds.length], rng() * W, 70 + rng() * (H - 140)));
    };
    populate();

    // The rare giant: a dim silhouette that crosses slowly, every few minutes.
    const giantAt = (t: number) => {
      const period = 150;
      const k = Math.floor(t / period);
      const start = k * period + 20 + hash(k, 3) * 60;
      const dur = 45;
      if (t < start || t > start + dur) return null;
      return { u: (t - start) / dur, y: 0.3 + hash(k, 4) * 0.4, dir: hash(k, 5) < 0.5 ? 1 : -1, len: 220 + hash(k, 6) * 160, k };
    };

    let fan = 0;
    const depthBase = 1180 + Math.floor(rng() * 600);

    const draw: Record<Kind, (c: Creature, t: number, a: number) => void> = {
      medusa(c, t, a) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + c.phase);
        const w = c.size * (1 + 0.15 * pulse);
        const h = c.size * (0.75 - 0.15 * pulse);
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size * 2.4);
        g.addColorStop(0, hexA(c.color, 0.4 * a));
        g.addColorStop(1, hexA(c.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(c.x - c.size * 2.4, c.y - c.size * 2.4, c.size * 4.8, c.size * 4.8);
        ctx.strokeStyle = hexA(c.color, 0.8 * a);
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, w, h, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = hexA(c.color, 0.45 * a);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const x0 = c.x - w * 0.8 + (i / 5) * w * 1.6;
          ctx.moveTo(x0, c.y);
          for (let s = 1; s <= 8; s++) ctx.lineTo(x0 + Math.sin(t * 1.3 + s * 0.7 + i + c.phase) * 2.2, c.y + s * c.size * 0.32);
        }
        ctx.stroke();
      },
      siphonophore(c, t, a) {
        const n = 26;
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const x = c.x + (u - 0.5) * c.size * 6;
          const y = c.y + Math.sin(u * 7 + t * 0.4 + c.phase) * c.size * 0.4;
          const tw = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 - u * 9 + c.phase));
          ctx.fillStyle = hexA(c.color, (0.25 + 0.65 * tw) * a);
          ctx.beginPath();
          ctx.arc(x, y, 1.1 + tw * 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      lanternfish(c, t, a) {
        for (let i = 0; i < 14; i++) {
          const ox = (hash(c.id, i) - 0.5) * 70 + Math.sin(t * 0.8 + i) * 6;
          const oy = (hash(c.id, i + 40) - 0.5) * 36 + Math.cos(t * 0.6 + i * 1.3) * 4;
          const blink = Math.sin(t * 3 + i * 1.7 + c.phase) > -0.6 ? 1 : 0.15;
          ctx.fillStyle = hexA(c.color, 0.85 * a * blink);
          ctx.fillRect(c.x + ox, c.y + oy, 2, 1.4);
          ctx.fillStyle = hexA(c.color, 0.25 * a * blink);
          ctx.fillRect(c.x + ox - (c.vx > 0 ? 4 : -2), c.y + oy, 4, 1);
        }
      },
      angler(c, t, a) {
        // Only the lure shows; the body is a darker shape you barely see.
        const lx = c.x + Math.sin(t * 0.7 + c.phase) * 3;
        const ly = c.y - 10 + Math.cos(t * 0.9 + c.phase) * 2;
        ctx.strokeStyle = hexA(c.color, 0.18 * a);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 4, 13, 8, 0, 0, Math.PI * 2);
        ctx.moveTo(c.x + 6, c.y - 3);
        ctx.quadraticCurveTo(c.x + 6, ly - 4, lx, ly);
        ctx.stroke();
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 14);
        const flick = 0.75 + 0.25 * Math.sin(t * 5 + c.phase);
        g.addColorStop(0, hexA('#ffffff', 0.9 * a * flick));
        g.addColorStop(0.15, hexA(c.color, 0.7 * a * flick));
        g.addColorStop(1, hexA(c.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(lx - 14, ly - 14, 28, 28);
      },
      ctenophore(c, t, a) {
        ctx.strokeStyle = hexA(c.color, 0.35 * a);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.size * 0.65, c.size, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Comb rows: color running down eight rows.
        const hues = ['#f472b6', '#a78bfa', '#60a5fa', '#34d399', '#facc15'];
        for (let r = 0; r < 8; r++) {
          const ang = (r / 8) * Math.PI * 2;
          const rx = Math.cos(ang) * c.size * 0.55;
          for (let s = 0; s < 5; s++) {
            const yy = c.y - c.size * 0.8 + (s / 4) * c.size * 1.6;
            const k = Math.floor(t * 6 - s + r) % hues.length;
            ctx.fillStyle = hexA(hues[(k + hues.length) % hues.length], (Math.cos(ang) > -0.2 ? 0.75 : 0.25) * a);
            ctx.fillRect(c.x + rx * Math.sqrt(1 - ((yy - c.y) / c.size) ** 2), yy, 1.6, 1.6);
          }
        }
      },
    };

    return {
      resize(v: Viewport) {
        W = v.width;
        H = v.height;
        populate();
      },
      frame(info: FrameInfo) {
        const t = info.t;
        const dt = host.motion === 'off' ? 0 : info.dt;
        const level = 0.55 + 0.45 * host.intensity;
        // A slow descent through a 900 m window, then the dive starts over.
        const depth = depthBase + ((t * 0.6) % 900);

        // Water: the faintest blue near the top, black below.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, hexA(palette.bg, 1));
        g.addColorStop(0.35, hexA(palette.bg, 0.55));
        g.addColorStop(1, hexA(palette.bg, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        const sheen = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        sheen.addColorStop(0, hexA(accent, 0.035));
        sheen.addColorStop(1, hexA(accent, 0));
        ctx.fillStyle = sheen;
        ctx.fillRect(0, 0, W, H * 0.5);

        // Deep scattering layer: a faint band of life hanging at one depth.
        const dslY = H * (0.58 + 0.06 * Math.sin(t * 0.02));
        const band = ctx.createLinearGradient(0, dslY - 60, 0, dslY + 60);
        band.addColorStop(0, hexA(accent, 0));
        band.addColorStop(0.5, hexA(accent, 0.045 * level));
        band.addColorStop(1, hexA(accent, 0));
        ctx.fillStyle = band;
        ctx.fillRect(0, dslY - 60, W, 120);

        // The giant, far off.
        const giant = giantAt(t);
        if (giant) {
          const fade = Math.sin(giant.u * Math.PI);
          const gx = giant.dir > 0 ? -giant.len + giant.u * (W + giant.len * 2) : W + giant.len - giant.u * (W + giant.len * 2);
          const gy = H * giant.y;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.scale(giant.dir, 1);
          ctx.fillStyle = hexA(accent, 0.05 * fade * level);
          ctx.strokeStyle = hexA(accent, 0.14 * fade * level);
          ctx.beginPath();
          ctx.moveTo(giant.len * 0.5, 0);
          ctx.quadraticCurveTo(giant.len * 0.2, -giant.len * 0.14, -giant.len * 0.3, -giant.len * 0.05);
          ctx.lineTo(-giant.len * 0.5, -giant.len * 0.12 * Math.sin(t * 0.8));
          ctx.lineTo(-giant.len * 0.45, 0);
          ctx.lineTo(-giant.len * 0.5, giant.len * 0.12 * Math.sin(t * 0.8));
          ctx.lineTo(-giant.len * 0.3, giant.len * 0.05);
          ctx.quadraticCurveTo(giant.len * 0.2, giant.len * 0.12, giant.len * 0.5, 0);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
          if (giant.u > 0.25 && giant.u < 0.8) {
            ctx.font = mono(10);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = hexA(ink, 0.6 * level * fade);
            ctx.fillText(typed(`UNIDENTIFIED BIOLOGIC · LENGTH ${Math.round(giant.len / 14)} M`, (giant.u - 0.25) * 45, 30, t), gx, gy + giant.len * 0.16);
          }
        }

        // Marine snow.
        for (const p of snow) {
          p.y += (dt * (6 + p.z * 10)) / H;
          p.x += (Math.sin(t * 0.3 + p.s * 20) * dt * 2) / W;
          if (p.y > 1) {
            p.y -= 1;
            p.x = hash(Math.floor(t * 10), Math.floor(p.s * 1e4));
          }
          ctx.fillStyle = hexA(ink, (0.12 + 0.3 * p.z) * level);
          ctx.fillRect(p.x * W, p.y * H, p.z * 1.6, p.z * 1.6);
        }

        // Sonar fan from the vehicle at top center.
        const ox = W * 0.5;
        const oy = -20;
        fan = Math.sin(t * 0.22) * 0.85;
        const spread = 0.13;
        const reach = Math.hypot(W, H);
        if (o.scan) {
          const fg = ctx.createRadialGradient(ox, oy, 0, ox, oy, reach * 0.8);
          fg.addColorStop(0, hexA(accent, 0.1 * level));
          fg.addColorStop(1, hexA(accent, 0));
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.arc(ox, oy, reach, Math.PI / 2 + fan - spread, Math.PI / 2 + fan + spread);
          ctx.closePath();
          ctx.fill();
        }

        // Creatures drift, wrap, and get identified when the fan passes them.
        for (const c of creatures) {
          c.x += c.vx * dt;
          c.y += (c.vy + Math.sin(t * 0.3 + c.phase) * 1.5) * dt;
          if (c.x < -120) c.x = W + 100;
          if (c.x > W + 120) c.x = -100;
          if (c.y < 60) c.vy = Math.abs(c.vy);
          if (c.y > H - 60) c.vy = -Math.abs(c.vy);
          const ang = Math.atan2(c.y - oy, c.x - ox) - Math.PI / 2;
          const inFan = o.scan && Math.abs(ang - fan) < spread;
          if (inFan && t - c.scannedAt > 8) c.scannedAt = t;
          const lit = clamp01(1 - (t - c.scannedAt) / 6);
          const a = (0.75 + 0.25 * lit) * level;
          draw[c.kind](c, t, a);
          if (lit > 0) {
            const age = t - c.scannedAt;
            ctx.font = mono(9);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = hexA(ink, 0.4 * lit * level);
            ctx.beginPath();
            ctx.moveTo(c.x + c.size + 4, c.y - 2);
            ctx.lineTo(c.x + c.size + 16, c.y - 12);
            ctx.stroke();
            ctx.fillStyle = hexA(ink, 0.8 * lit * level);
            ctx.fillText(typed(SPECIES[c.kind].name, age, 34, t), c.x + c.size + 18, c.y - 14);
            ctx.fillStyle = hexA(accent, 0.6 * lit * level);
            ctx.fillText(typed(`${Math.round(depth + ((c.y - H / 2) / H) * 80).toLocaleString('en-US')} M`, age - 0.6, 34, t), c.x + c.size + 18, c.y - 2);
          }
        }

        // Depth scale on the left.
        ctx.font = mono(9);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const pxPerM = H / 80;
        const firstM = Math.ceil((depth - 40) / 10) * 10;
        ctx.strokeStyle = hexA(accent, 0.35 * level);
        ctx.beginPath();
        for (let m = firstM; m <= depth + 40; m += 10) {
          const y = H / 2 + (m - depth) * pxPerM;
          const major = m % 50 === 0;
          ctx.moveTo(14, Math.round(y) + 0.5);
          ctx.lineTo(14 + (major ? 12 : 6), Math.round(y) + 0.5);
          if (major) {
            ctx.fillStyle = hexA(ink, 0.5 * level);
            ctx.fillText(`${m.toLocaleString('en-US')}`, 30, y);
          }
        }
        ctx.stroke();

        // Readouts.
        ctx.font = mono(10);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = hexA(ink, 0.55 * level);
        const temp = (4.2 - (depth - 1000) * 0.0006).toFixed(1);
        const bar = Math.round(depth * 0.1 + 1);
        ctx.fillText(`DEPTH ${Math.round(depth).toLocaleString('en-US')} M · ${temp}°C · ${bar} BAR`, W - 18, 16);
        ctx.fillText('LIGHT 0.00 LUX · SALINITY 34.7 PSU', W - 18, 30);
        ctx.textAlign = 'left';
        ctx.fillText('ROV ABYSSAL-3 · DESCENDING', 60, 16);
      },
      destroy() {},
    };
  },
};
