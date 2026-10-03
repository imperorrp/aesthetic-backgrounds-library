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
import { fillCrisp, clamp01, hash, hexA, mono, typed } from './kit';

const schema = {
  life: { type: 'number', min: 0.3, max: 2, default: 1, label: 'Life' },
  snow: { type: 'number', min: 0, max: 2, default: 1, label: 'Marine snow' },
  scan: { type: 'boolean', default: true, label: 'Sonar fan' },
} satisfies Schema;

type Kind = 'medusa' | 'siphonophore' | 'lanternfish' | 'angler' | 'ctenophore' | 'vampire' | 'shrimp' | 'dragonfish';
type Creature = {
  kind: Kind; x: number; y: number; vx: number; vy: number; size: number; phase: number; color: string; scannedAt: number; id: number;
  /** When it flashed its alarm display, when its school scattered, when it spat a glowing cloud. */
  flashAt: number; scatterAt: number; cloudAt: number;
  /** Where the last cloud was left, so it stays put while the shrimp darts off. */
  cloudX: number; cloudY: number; cloudFor: number;
};

const SPECIES: Record<Kind, { name: string; colors: string[] }> = {
  medusa: { name: 'ATOLLA WYVILLEI', colors: ['#7dd3fc', '#c4b5fd'] },
  siphonophore: { name: 'PRAYA DUBIA', colors: ['#5eead4', '#93c5fd'] },
  lanternfish: { name: 'MYCTOPHIDAE · SCHOOL', colors: ['#67e8f9'] },
  angler: { name: 'MELANOCETUS JOHNSONII', colors: ['#a5f3fc'] },
  ctenophore: { name: 'BEROE · COMB JELLY', colors: ['#f0abfc', '#a5b4fc'] },
  vampire: { name: 'VAMPYROTEUTHIS INFERNALIS', colors: ['#93c5fd', '#a5f3fc'] },
  shrimp: { name: 'ACANTHEPHYRA PURPUREA', colors: ['#7dd3fc'] },
  dragonfish: { name: 'MALACOSTEUS NIGER · DRAGONFISH', colors: ['#f87171'] },
};
const ALARM = '#60a5fa';

export const abyssalSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'abyssal',
  label: 'Abyssal scanner',
  description: 'A deep submersible\'s view: marine snow, bioluminescent animals, and a sonar fan that identifies them.',
  tags: ['instrument', 'ocean', 'dark', 'cyan'],
  crisp: true,
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
        vx: (rng() - 0.5) * (kind === 'lanternfish' ? 22 : kind === 'shrimp' ? 14 : 6),
        vy: (rng() - 0.5) * 3,
        size: kind === 'siphonophore' ? 26 + rng() * 22 : kind === 'medusa' ? 11 + rng() * 12 : kind === 'ctenophore' ? 10 + rng() * 7 : kind === 'vampire' ? 11 + rng() * 5 : kind === 'dragonfish' ? 26 : 6 + rng() * 4,
        phase: rng() * 10,
        color: colors[Math.floor(rng() * colors.length)],
        scannedAt: -99,
        id: nextId++,
        flashAt: -99,
        scatterAt: -99,
        cloudAt: -99,
        cloudX: x,
        cloudY: y,
        cloudFor: -99,
      };
    };
    const kinds: Kind[] = ['medusa', 'medusa', 'siphonophore', 'lanternfish', 'angler', 'ctenophore', 'shrimp', 'vampire', 'medusa', 'lanternfish', 'shrimp', 'ctenophore'];
    const populate = () => {
      creatures.length = 0;
      const n = Math.round(18 * o.life * Math.max(0.6, Math.min(1.6, (W * H) / (1280 * 800))));
      for (let i = 0; i < n; i++) creatures.push(spawn(kinds[i % kinds.length], rng() * W, 70 + rng() * (H - 140)));
    };
    populate();

    // The rare giant: a dim silhouette that crosses slowly, every few minutes.
    const giantAt = (t: number) => {
      const period = 95;
      const k = Math.floor(t / period);
      const start = k * period + 20 + hash(k, 3) * 60;
      const dur = 45;
      if (t < start || t > start + dur) return null;
      return { u: (t - start) / dur, y: 0.3 + hash(k, 4) * 0.4, dir: hash(k, 5) < 0.5 ? 1 : -1, len: 220 + hash(k, 6) * 160, k };
    };

    // The seafloor rising into view over a hydrothermal vent field, now and then.
    const ventAt = (t: number) => {
      const period = 150;
      const k = Math.floor(t / period);
      const start = k * period + 30 + hash(k, 13) * 50;
      const dur = 70;
      if (t < start || t > start + dur) return null;
      const u = (t - start) / dur;
      return { u, rise: Math.min(1, u * 6, (1 - u) * 6), x: 0.25 + hash(k, 14) * 0.5, k };
    };

    // Events on their own stream, so the population stays the same per seed.
    const ev = host.fork('abyss-events');
    let nextCascade = 4 + ev() * 4;
    let nextHunt = 12 + ev() * 8;
    let hunter: (Creature & { prey: number; lunged: number }) | null = null;
    let banner: { text: string; at: number } | null = null;
    const say = (text: string, t: number) => {
      banner = { text, at: t };
    };
    const happen = (t: number, dt: number) => {
      // A startled jelly flashes its alarm, and the flash runs outward through its neighbors.
      if (t >= nextCascade) {
        const pool = creatures.filter((c) => c.kind !== 'lanternfish' && c.x > 80 && c.x < W - 80);
        const c = pool[Math.floor(ev() * pool.length)];
        if (c) {
          c.flashAt = t;
          for (const n of creatures) {
            if (n === c) continue;
            const d = Math.hypot(n.x - c.x, n.y - c.y);
            if (d > 340) continue;
            const at = t + 0.5 + d / 160;
            if (n.kind === 'lanternfish') n.scatterAt = at;
            else if (n.kind === 'shrimp') n.cloudAt = at;
            else n.flashAt = at;
          }
          say(`STARTLE CASCADE · ${SPECIES[c.kind].name} ALARM DISPLAY`, t);
        }
        nextCascade = t + (24 + ev() * 20) / Math.max(0.3, o.life);
      }
      // A dragonfish, hunting by its own red light, which nothing else can see.
      if (!hunter && t >= nextHunt) {
        const pool = creatures.filter((c) => c.kind === 'lanternfish' && c.x > 60 && c.x < W - 60);
        const prey = pool[Math.floor(ev() * pool.length)];
        if (prey) {
          const fromLeft = prey.x > W / 2;
          hunter = { ...spawn('dragonfish', fromLeft ? -80 : W + 80, prey.y + (ev() - 0.5) * 60), prey: prey.id, lunged: -1 };
          hunter.vx = fromLeft ? 30 : -30;
          hunter.vy = 0;
          say('DRAGONFISH · RED SEARCHLIGHT · STALKING', t);
          nextHunt = t + (45 + ev() * 30) / Math.max(0.3, o.life);
        } else nextHunt = t + 4;
      }
      if (hunter) {
        const prey = creatures.find((c) => c.id === hunter!.prey);
        if (prey && hunter.lunged < 0) {
          const dx = prey.x - hunter.x;
          const dy = prey.y - hunter.y;
          const d = Math.hypot(dx, dy);
          hunter.vx = (dx / d) * 40;
          hunter.vy = (dy / d) * 40;
          if (d < 46) {
            hunter.lunged = t;
            prey.scatterAt = t;
            say('PREDATION EVENT · STRIKE · SCHOOL SCATTERS', t);
          }
        }
        const burst = hunter.lunged >= 0 && t - hunter.lunged < 0.7 ? 5 : 1;
        hunter.x += hunter.vx * burst * dt;
        hunter.y += hunter.vy * burst * dt;
        for (const s of creatures) if (s.kind === 'shrimp' && t - s.cloudAt > 6 && Math.hypot(s.x - hunter.x, s.y - hunter.y) < 110) s.cloudAt = t;
        if (hunter.x < -140 || hunter.x > W + 140 || hunter.y < -120 || hunter.y > H + 120 || (!prey && hunter.lunged < 0)) hunter = null;
      }
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
        // Scattering: the school bursts outward and most of them go dark, then regroups.
        const since = t - c.scatterAt;
        const sc = since < 0 ? 0 : clamp01(since / 0.8) * (1 - clamp01((since - 7) / 6));
        for (let i = 0; i < 14; i++) {
          const ox = ((hash(c.id, i) - 0.5) * 70 + Math.sin(t * 0.8 + i) * 6) * (1 + sc * 2.6);
          const oy = ((hash(c.id, i + 40) - 0.5) * 36 + Math.cos(t * 0.6 + i * 1.3) * 4) * (1 + sc * 3.2);
          const dark = hash(c.id, i + 80) < sc * 0.8;
          const blink = dark ? 0.05 : Math.sin(t * 3 + i * 1.7 + c.phase) > -0.6 ? 1 : 0.15;
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
      vampire(c, t, a) {
        // Nearly black; it shows itself by the lights on its fins and arm tips.
        const s = c.size;
        ctx.fillStyle = hexA('#000000', 0.85 * a);
        ctx.strokeStyle = hexA(c.color, 0.2 * a);
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, s * 0.45, s * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const flare = clamp01(1 - (t - c.flashAt) / 3) * (t >= c.flashAt ? 1 : 0);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const ang = Math.PI / 2 + (i / 7 - 0.5) * (1.6 + 0.4 * Math.sin(t * 0.9 + c.phase));
          ctx.moveTo(c.x, c.y + s * 0.6);
          ctx.quadraticCurveTo(c.x + Math.cos(ang) * s * 0.9, c.y + s * 0.9, c.x + Math.cos(ang) * s * 1.4, c.y + s * 0.6 + Math.sin(ang) * s * 1.1);
        }
        ctx.stroke();
        const lights: [number, number, number][] = [[-s * 0.5, -s * 0.45, 0.5 + 0.5 * Math.sin(t * 1.1 + c.phase)], [s * 0.5, -s * 0.45, 0.5 + 0.5 * Math.sin(t * 1.1 + c.phase + 1)]];
        for (let i = 0; i < 8; i++) {
          const ang = Math.PI / 2 + (i / 7 - 0.5) * 1.6;
          lights.push([Math.cos(ang) * s * 1.4, s * 0.6 + Math.sin(ang) * s * 1.1, flare]);
        }
        for (const [dx, dy, k] of lights) {
          if (k <= 0.02) continue;
          const g = ctx.createRadialGradient(c.x + dx, c.y + dy, 0, c.x + dx, c.y + dy, 6);
          g.addColorStop(0, hexA('#ffffff', 0.8 * k * a));
          g.addColorStop(0.3, hexA(c.color, 0.6 * k * a));
          g.addColorStop(1, hexA(c.color, 0));
          ctx.fillStyle = g;
          ctx.fillRect(c.x + dx - 6, c.y + dy - 6, 12, 12);
        }
      },
      shrimp(c, t, a) {
        const dir = c.vx >= 0 ? 1 : -1;
        ctx.strokeStyle = hexA(c.color, 0.45 * a);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.size * 0.8, dir > 0 ? Math.PI * 0.8 : -Math.PI * 0.2, dir > 0 ? Math.PI * 2.2 : Math.PI * 1.2);
        ctx.moveTo(c.x + dir * c.size * 0.8, c.y);
        ctx.lineTo(c.x + dir * c.size * 2.4, c.y - c.size * 0.9);
        ctx.stroke();
        ctx.fillStyle = hexA(c.color, (0.5 + 0.4 * Math.sin(t * 4 + c.phase)) * a);
        ctx.fillRect(c.x - 1, c.y + c.size * 0.4, 2, 2);
      },
      dragonfish(c, t, a) {
        const dir = Math.atan2(c.vy, c.vx);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(dir);
        // Its red searchlight: invisible to its prey, faint to us.
        const beam = ctx.createLinearGradient(8, 0, 120, 0);
        beam.addColorStop(0, hexA('#ef4444', 0.22 * a));
        beam.addColorStop(1, hexA('#ef4444', 0));
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(120, -26);
        ctx.lineTo(120, 22);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexA('#fca5a5', 0.3 * a);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        for (let x = 10; x >= -c.size * 1.8; x -= 4) ctx.lineTo(x, Math.sin(t * 5 + x * 0.12) * (1 - x / 10) * 0.12 * 6);
        ctx.moveTo(6, 3);
        ctx.quadraticCurveTo(0, 14, 4 + Math.sin(t * 2) * 3, 22);
        ctx.stroke();
        ctx.fillStyle = hexA('#f87171', 0.95 * a);
        ctx.fillRect(5, -2.5, 3, 2);
        ctx.fillStyle = hexA(ALARM, 0.8 * a);
        ctx.fillRect(1, -1.5, 2, 1.5);
        ctx.restore();
      },
    };

    /** The alarm display: a pinwheel of blue light, the jelly's call for a bigger predator. */
    const alarmFlash = (c: Creature, t: number, a: number) => {
      const k = t - c.flashAt;
      if (k < 0 || k > 2.4) return;
      const e = Math.min(1, k * 6) * (1 - k / 2.4);
      const r = Math.min(46, Math.max(14, c.size * 1.3)) * (1 + k * 0.6);
      ctx.strokeStyle = hexA('#bfdbfe', e * a);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = t * 7 + (i / 10) * Math.PI * 2;
        ctx.moveTo(c.x + Math.cos(ang) * r, c.y + Math.sin(ang) * r);
        ctx.arc(c.x, c.y, r, ang, ang + 0.32);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 2);
      g.addColorStop(0, hexA(ALARM, 0.45 * e * a));
      g.addColorStop(1, hexA(ALARM, 0));
      ctx.fillStyle = g;
      ctx.fillRect(c.x - r * 2, c.y - r * 2, r * 4, r * 4);
    };
    /** A shrimp's defense: a spat cloud of glowing fluid that lingers while it darts away. */
    const cloud = (c: Creature, t: number, a: number) => {
      const k = t - c.cloudAt;
      if (k < 0 || k > 6) return;
      const e = 1 - k / 6;
      const r = 6 + Math.sqrt(k) * 18;
      for (let i = 0; i < 26; i++) {
        const ang = hash(c.id, i + 200) * Math.PI * 2;
        const d = hash(c.id, i + 300) * r;
        ctx.fillStyle = hexA(c.color, 0.7 * e * a * (1 - d / (r + 1)));
        ctx.fillRect(c.cloudX + Math.cos(ang) * d, c.cloudY + Math.sin(ang) * d, 1.6, 1.6);
      }
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
            fillCrisp(ctx, typed(`UNIDENTIFIED BIOLOGIC · LENGTH ${Math.round(giant.len / 14)} M`, (giant.u - 0.25) * 45, 30, t), gx, gy + giant.len * 0.16);
          }
        }

        // The seafloor, when the dive reaches the vent field.
        const vent = ventAt(t);
        if (vent) {
          const floorY = H + 10 - vent.rise * 150;
          const vx = W * vent.x;
          ctx.fillStyle = '#000000';
          ctx.strokeStyle = hexA(accent, 0.3 * level * vent.rise);
          ctx.beginPath();
          ctx.moveTo(0, H + 20);
          for (let x = 0; x <= W; x += 12) {
            const mound = Math.max(0, 1 - Math.abs(x - vx) / 120) * 40;
            ctx.lineTo(x, floorY + host.noise.noise2(x * 0.01, vent.k * 3) * 22 - mound);
          }
          ctx.lineTo(W, H + 20);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          const top = floorY - 40 - 34;
          // The chimney, glowing at its mouth.
          ctx.strokeStyle = hexA(accent, 0.45 * level * vent.rise);
          ctx.beginPath();
          ctx.moveTo(vx - 9, floorY - 36);
          ctx.lineTo(vx - 4, top);
          ctx.lineTo(vx + 4, top);
          ctx.lineTo(vx + 10, floorY - 36);
          ctx.stroke();
          const mouth = ctx.createRadialGradient(vx, top, 0, vx, top, 26);
          mouth.addColorStop(0, hexA('#fb923c', 0.35 * level * vent.rise * (0.8 + 0.2 * Math.sin(t * 7))));
          mouth.addColorStop(1, hexA('#fb923c', 0));
          ctx.fillStyle = mouth;
          ctx.fillRect(vx - 26, top - 26, 52, 52);
          // The plume: hot water carrying mineral smoke up and off on the current.
          for (let i = 0; i < 70; i++) {
            const h = ((t * 0.09 + hash(i, 21)) % 1);
            const y = top - h * H * 0.55;
            const x = vx + Math.sin(t * 0.8 + i) * 3 + h * h * 90 + (hash(i, 22) - 0.5) * (6 + h * 60);
            ctx.fillStyle = hexA(ink, 0.16 * (1 - h) * level * vent.rise);
            ctx.fillRect(x, y, 1.5 + h * 3, 1.5 + h * 3);
          }
          // Tube worms crowding the warm base.
          for (let i = 0; i < 14; i++) {
            const wx = vx + (hash(vent.k, i + 30) - 0.5) * 110;
            const wy = floorY - 36 + Math.abs(wx - vx) * 0.3;
            const sway = Math.sin(t * 1.2 + i) * 2;
            ctx.strokeStyle = hexA(ink, 0.35 * level * vent.rise);
            ctx.beginPath();
            ctx.moveTo(wx, wy);
            ctx.lineTo(wx + sway, wy - 10 - hash(vent.k, i + 50) * 10);
            ctx.stroke();
            ctx.fillStyle = hexA('#ef4444', 0.75 * level * vent.rise);
            ctx.fillRect(wx + sway - 1, wy - 12 - hash(vent.k, i + 50) * 10, 2.5, 2.5);
          }
          if (vent.rise > 0.9) {
            ctx.font = mono(10);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = hexA(ink, 0.7 * level);
            fillCrisp(ctx, typed(`HYDROTHERMAL VENT · ${340 + Math.floor(hash(vent.k, 9) * 60)}°C · RIFTIA COLONY`, (vent.u - 0.15) * 70, 34, t), vx + 30, top - 6);
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
        happen(t, dt);
        for (const c of creatures) {
          if (t >= c.cloudAt && c.cloudFor !== c.cloudAt) {
            // Spit the cloud here, then dart away from it.
            c.cloudFor = c.cloudAt;
            c.cloudX = c.x;
            c.cloudY = c.y;
            c.vx = -Math.sign(c.vx || 1) * 34;
          }
          if (c.kind === 'shrimp' && Math.abs(c.vx) > 8) c.vx *= 1 - Math.min(1, dt * 0.6);
          cloud(c, t, level);
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
          alarmFlash(c, t, level);
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
            fillCrisp(ctx, typed(SPECIES[c.kind].name, age, 34, t), c.x + c.size + 18, c.y - 14);
            ctx.fillStyle = hexA(accent, 0.6 * lit * level);
            fillCrisp(ctx, typed(`${Math.round(depth + ((c.y - H / 2) / H) * 80).toLocaleString('en-US')} M`, age - 0.6, 34, t), c.x + c.size + 18, c.y - 2);
          }
        }

        if (hunter) {
          draw.dragonfish(hunter, t, level);
          if (hunter.lunged < 0 && hunter.x > 0 && hunter.x < W) {
            ctx.font = mono(9);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = hexA('#fca5a5', 0.7 * level);
            fillCrisp(ctx, SPECIES.dragonfish.name, hunter.x + 14, hunter.y + 20);
          }
        }

        // What just happened, typed along the bottom.
        if (banner && t - banner.at < 9) {
          const age = t - banner.at;
          ctx.font = mono(11);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = hexA(accent, 0.9 * level * clamp01((9 - age) * 1.5));
          fillCrisp(ctx, typed(banner.text, age, 36, t), 60, H - 16);
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
            fillCrisp(ctx, `${m.toLocaleString('en-US')}`, 30, y);
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
        fillCrisp(ctx, `DEPTH ${Math.round(depth).toLocaleString('en-US')} M · ${temp}°C · ${bar} BAR`, W - 18, 16);
        fillCrisp(ctx, 'LIGHT 0.00 LUX · SALINITY 34.7 PSU', W - 18, 30);
        ctx.textAlign = 'left';
        fillCrisp(ctx, `ROV ABYSSAL-3 · ${vent && vent.rise > 0.5 ? 'HOLDING AT VENT FIELD' : hunter ? 'OBSERVING · LIGHTS DIMMED' : 'DESCENDING'}`, 60, 16);
      },
      destroy() {},
    };
  },
};
