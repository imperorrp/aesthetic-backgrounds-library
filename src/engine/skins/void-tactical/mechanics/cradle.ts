/**
 * Cradle of Suns: a cosmic time-lapse. Gas collapses, stars ignite and blow bubbles,
 * disks clump into planets, planets light up with cities and send out their first
 * ships, and massive stars die and give their gas back.
 *
 *   useCosmos(api)  the shared state: gas particles, gravity wells, stars (each with a
 *                   disk, planets, and maybe a civilization), travelling ships, the age.
 *   'nebula'        the gas: hundreds of particles drifting on curl noise, pulled into
 *                   wells, pushed out by stellar wind; drawn as additive glow, colder
 *                   violet far from stars and hot pink and cyan near them.
 *   'stars'         a star's life: collapse (a well grows and swallows gas), ignition
 *                   (a flash, bipolar jets, a wind bubble), an accretion disk that clumps
 *                   into planets, and for massive stars, a supernova that returns the gas.
 *   'life'          planets in the habitable zone grow life, then cities whose lights
 *                   twinkle on the night side, then ships; ships colonize and make contact.
 *                   Sometimes the lights go out.
 *   'epochs'        the age in billions of years and the name of the era.
 *
 * Everything here is world-anchored and drifts past like any map; new gas streams in on
 * the right. Time runs fast: about a billion years every minute and a half.
 */
import { createField } from '../../../sim/fields';
import { cellHash } from '../../../sim/cells';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, type MechanicApi } from './types';

type P = { x: number; y: number };

type Gas = { x: number; y: number; vx: number; vy: number; heat: number };
type Well = { x: number; y: number; strength: number; mass: number; until: number; name: string };
type Planet = { r: number; ang: number; speed: number; size: number; color: string; stage: 0 | 1 | 2 | 3 | -1; next: number; name: string };
type DiskBit = { r: number; ang: number; speed: number };
export type Star = {
  id: number;
  name: string;
  x: number;
  y: number;
  mass: number;
  color: string;
  born: number;
  /** When it dies (massive stars only), or Infinity. */
  dies: number;
  bubble: number;
  jets: number;
  tilt: number;
  disk: DiskBit[];
  planets: Planet[];
  planetsAt: number;
  dead: boolean;
};
type Ship = { x: number; y: number; vx: number; vy: number; to: Star | null; from: Star; life: number };

export type Cosmos = {
  gas: Gas[];
  wells: Well[];
  stars: Star[];
  ships: Ship[];
  /** Billions of years. */
  age: number;
  /** Gyr per sim second. */
  rate: number;
  contacts: Set<string>;
  nextId: number;
};

const COLD = '#7c6bd6';
const WARM = '#f472b6';
const HOT = '#67e8f9';
const CITY = '#fde68a';

export function useCosmos(api: MechanicApi): Cosmos {
  return api.use('cosmos', () => ({ gas: [], wells: [], stars: [], ships: [], age: 0.38, rate: 0.011, contacts: new Set<string>(), nextId: 1 }));
}

const starColor = (mass: number) => (mass > 1.6 ? '#bfdbfe' : mass > 1.1 ? '#fef9c3' : mass > 0.7 ? '#fde68a' : '#fdba74');

// ---- the gas --------------------------------------------------------------------------------

registerMechanic({
  id: 'nebula',
  label: 'Nebula gas',
  description: 'Hundreds of gas particles drift on curl noise, fall into collapsing clouds, and are pushed out by stellar wind. Cold violet far from stars, hot pink and cyan near them.',
  schema: {
    amount: { type: 'number', min: 0.3, max: 2, default: 1, label: 'How much gas' },
  },
  create(api, p) {
    const cosmos = useCosmos(api);
    const field = createField(api.host.noise);
    field.add({ kind: 'noise', scale: 0.0035, strength: 14, period: 90 });
    const tmp = { x: 0, y: 0 };
    const n = Math.round(Math.max(250, Math.min(900, (api.width * api.height) / 1500)) * (Number(p.amount) || 1));
    const v0 = api.view();
    for (let i = 0; i < n; i++) cosmos.gas.push({ x: v0.left - 60 + api.rng() * (api.width + 160), y: api.rng() * api.height, vx: 0, vy: 0, heat: 0 });
    let sprite: HTMLCanvasElement | null = null;
    let half = 0;

    /** A soft dot, drawn once and stamped for every particle. */
    const dot = () => {
      if (sprite) return sprite;
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 32;
      const c = sprite.getContext('2d')!;
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
      return sprite;
    };

    return {
      update(frameDt) {
        const v = api.view();
        // Half the gas each frame, at twice the step: it moves slowly enough that 30 Hz is plenty.
        half = 1 - half;
        const dt = frameDt * 2;
        for (let gi = half; gi < cosmos.gas.length; gi += 2) {
          const g = cosmos.gas[gi];
          field.sample(g.x, g.y, api.t, tmp);
          let ax = tmp.x * 0.6;
          let ay = tmp.y * 0.6;
          let heat = 0;
          // Wells pull; whatever reaches the middle is swallowed (and streams in again on the right).
          for (const w of cosmos.wells) {
            const dx = w.x - g.x;
            const dy = w.y - g.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 300) continue;
            const pull = (900 * w.strength) / (d + 30);
            ax += (dx / d) * pull;
            ay += (dy / d) * pull;
            if (d < 9 && w.strength > 0.2) {
              w.mass += 1;
              g.x = v.right + 20 + api.rng() * 120;
              g.y = api.rng() * api.height;
              g.vx = g.vy = 0;
            }
          }
          // Stars heat the gas near them, and their wind pushes it out ahead of the bubble.
          for (const s of cosmos.stars) {
            const dx = g.x - s.x;
            const dy = g.y - s.y;
            if (s.dead || dx > 260 || dx < -260 || dy > 260 || dy < -260) continue;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 220) heat = Math.max(heat, 1 - d / 220);
            if (s.bubble > 0 && Math.abs(d - s.bubble) < 16) {
              ax += (dx / d) * 160;
              ay += (dy / d) * 160;
            }
          }
          g.heat += (heat - g.heat) * Math.min(1, dt * 2);
          g.vx = (g.vx + ax * dt) * (1 - dt * 0.7);
          g.vy = (g.vy + ay * dt) * (1 - dt * 0.7);
          g.x += g.vx * dt;
          g.y += g.vy * dt;
          if (g.x < v.left - 80 || g.y < -60 || g.y > api.height + 60) {
            g.x = v.right + 20 + api.rng() * 120;
            g.y = api.rng() * api.height;
            g.vx = g.vy = 0;
          }
        }
      },
      draw(ctx, pass) {
        if (pass !== 'under') return;
        const img = dot();
        const ox = api.screenX(0);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Three temperature bands, each stamped with a pre-tinted copy of the soft dot.
        for (const [lo, hi, color, alpha, size] of [
          [0, 0.25, COLD, 0.13, 26],
          [0.25, 0.6, WARM, 0.15, 22],
          [0.6, 1.01, HOT, 0.18, 18],
        ] as const) {
          ctx.globalAlpha = alpha;
          const stamp = tinted(img, color);
          for (const g of cosmos.gas) {
            if (g.heat < lo || g.heat >= hi) continue;
            const x = g.x + ox;
            if (x < -30 || x > api.width + 30) continue;
            ctx.drawImage(stamp, x - size / 2, g.y - size / 2, size, size);
          }
        }
        ctx.restore();
      },
    };
  },
});

/** The white dot sprite tinted to a color (cached per color). */
const tints = new Map<string, HTMLCanvasElement>();
function tinted(src: HTMLCanvasElement, color: string): HTMLCanvasElement {
  let c = tints.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const x = c.getContext('2d')!;
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    tints.set(color, c);
  }
  return c;
}

// ---- stars ----------------------------------------------------------------------------------

registerMechanic({
  id: 'stars',
  label: 'Star lives',
  description: 'Clouds collapse and stars ignite with a flash, jets, and a wind bubble. Disks clump into planets. Massive stars die as supernovae and give their gas back.',
  schema: {
    births: { type: 'number', min: 0.5, max: 6, default: 2.5, label: 'Collapses per minute' },
    supernovae: { type: 'boolean', default: true, label: 'Massive stars explode' },
  },
  create(api, p) {
    const cosmos = useCosmos(api);
    const births = Number(p.births) || 2.5;
    let next = api.t + 3;
    let wellNo = 1;

    const collapse = () => {
      const v = api.view();
      // Where the gas is thickest in the right two thirds, far from existing stars.
      const pool = cosmos.gas.filter((g) => g.x > v.left + api.width * 0.3 && g.x < v.right - 60 && g.y > 60 && g.y < api.height - 60);
      for (let k = 0; k < 8 && pool.length; k++) {
        const g = pool[Math.floor(api.rng() * pool.length)];
        if (cosmos.stars.some((s) => !s.dead && Math.hypot(s.x - g.x, s.y - g.y) < 170) || cosmos.wells.some((w) => Math.hypot(w.x - g.x, w.y - g.y) < 170)) continue;
        const name = `CLOUD ${wellNo++}`;
        cosmos.wells.push({ x: g.x, y: g.y, strength: 0, mass: 0, until: api.t + 16 + api.rng() * 10, name });
        api.say(`${name} · COLLAPSING`, g.x, g.y - 30, COLD, { priority: 'low' });
        api.emit({ type: 'collapse', x: g.x, y: g.y, weight: 0.35, color: COLD });
        return;
      }
    };

    const ignite = (w: Well) => {
      // Mass from the gas it swallowed, plus luck: roughly one star in eight is massive enough to die young.
      const mass = Math.max(0.4, Math.min(2.4, 0.3 + Math.min(0.6, w.mass / 100) + api.rng() * 1.3));
      const id = cosmos.nextId++;
      const name = `STAR ${id}`;
      const disk: DiskBit[] = [];
      for (let i = 0; i < 70; i++) {
        const r = 12 + api.rng() * 52;
        disk.push({ r, ang: api.rng() * Math.PI * 2, speed: 9 / Math.pow(r / 12, 1.5) });
      }
      const s: Star = {
        id,
        name,
        x: w.x,
        y: w.y,
        mass,
        color: starColor(mass),
        born: api.t,
        dies: p.supernovae !== false && mass > 1.85 ? api.t + 70 + api.rng() * 80 : Infinity,
        bubble: 1,
        jets: api.t + 7,
        tilt: api.rng() * Math.PI,
        disk,
        planets: [],
        planetsAt: api.t + 12 + api.rng() * 10,
        dead: false,
      };
      cosmos.stars.push(s);
      api.fx.flash(s.x, s.y, s.color, 60 + mass * 30, 1.2);
      api.fx.ring(s.x, s.y, s.color, 90 + mass * 40, 1.6, 4, 1.5);
      api.say(`FIRST LIGHT · ${name} IGNITES`, s.x, s.y + 34, s.color, { priority: 'high' });
      api.emit({ type: 'ignite', x: s.x, y: s.y, weight: 0.7, color: s.color });
    };

    const supernova = (s: Star) => {
      s.dead = true;
      api.fx.flash(s.x, s.y, '#ffffff', 160, 2.2);
      api.fx.ring(s.x, s.y, '#e0f2fe', 260, 3, 10, 2.5);
      api.fx.ring(s.x, s.y, WARM, 180, 2.4, 6, 1.5);
      for (let i = 0; i < 4; i++) api.fx.explode(s.x + (api.rng() - 0.5) * 30, s.y + (api.rng() - 0.5) * 30, '#fef3c7', 1.6);
      // The gas comes back: particles thrown outward from the corpse.
      let k = 0;
      for (const g of cosmos.gas) {
        if (k > 90) break;
        if (g.x > api.view().right) {
          const a = api.rng() * Math.PI * 2;
          g.x = s.x + Math.cos(a) * 6;
          g.y = s.y + Math.sin(a) * 6;
          const sp = 60 + api.rng() * 90;
          g.vx = Math.cos(a) * sp;
          g.vy = Math.sin(a) * sp;
          g.heat = 1;
          k++;
        }
      }
      const lost = s.planets.filter((pl) => pl.stage >= 2).length;
      api.say(`${s.name} · SUPERNOVA${lost ? ` · ${lost} CIVILIZATION${lost > 1 ? 'S' : ''} LOST` : ''}`, s.x, s.y + 40, '#e0f2fe', { priority: 'high', duration: 5000 });
      api.emit({ type: 'supernova', x: s.x, y: s.y, weight: 0.95, color: '#e0f2fe' });
    };

    // A couple of stars are already burning when we arrive, with their planets formed.
    for (const fx of [0.22, 0.58]) {
      const v = api.view();
      ignite({ x: v.left + api.width * (fx + api.rng() * 0.1), y: api.height * (0.3 + api.rng() * 0.4), strength: 1, mass: 30 + api.rng() * 40, until: 0, name: '' });
      const s = cosmos.stars[cosmos.stars.length - 1];
      s.jets = api.t - 1;
      s.bubble = 0;
      s.planetsAt = api.t;
    }

    return {
      update(dt) {
        if (api.t >= next) {
          if (cosmos.wells.length < 2) collapse();
          next = api.t + (60 / births) * (0.6 + api.rng() * 0.8);
        }
        for (let i = cosmos.wells.length - 1; i >= 0; i--) {
          const w = cosmos.wells[i];
          w.strength = Math.min(1, w.strength + dt * 0.12);
          if (api.t >= w.until) {
            cosmos.wells.splice(i, 1);
            ignite(w);
          }
        }
        const v = api.view();
        for (let i = cosmos.stars.length - 1; i >= 0; i--) {
          const s = cosmos.stars[i];
          if (s.x < v.left - 300) {
            cosmos.stars.splice(i, 1);
            continue;
          }
          if (s.dead) continue;
          // The wind bubble races out, then stalls.
          if (s.bubble > 0) {
            s.bubble += dt * Math.max(8, 90 - s.bubble * 0.6);
            if (s.bubble > 150 + s.mass * 40) s.bubble = 0;
          }
          for (const d of s.disk) d.ang += d.speed * dt * 0.15;
          // The disk clumps into planets.
          if (!s.planets.length && api.t >= s.planetsAt) {
            const n = 2 + Math.floor(api.rng() * 4);
            for (let k = 0; k < n; k++) {
              const r = 18 + k * (12 + api.rng() * 8);
              const hz = k === 1 || k === 2;
              s.planets.push({
                r,
                ang: api.rng() * Math.PI * 2,
                speed: 2.2 / Math.pow(r / 18, 1.5),
                size: 1.6 + api.rng() * 2,
                color: hz ? '#60a5fa' : ['#d6b38a', '#94a3b8', '#fca5a5', '#c4b5fd'][Math.floor(api.rng() * 4)],
                stage: 0,
                next: hz && api.rng() < 0.75 ? api.t + 14 + api.rng() * 20 : Infinity,
                name: `${s.id}${'bcdefg'[k]}`,
              });
            }
            s.disk.length = Math.floor(s.disk.length * 0.35);
            api.say(`${s.name} · ${n} PLANETS FORMED`, s.x, s.y - 40, s.color, { priority: 'medium' });
            api.emit({ type: 'planets', x: s.x, y: s.y, weight: 0.45, color: s.color });
          }
          for (const pl of s.planets) pl.ang += pl.speed * dt * 0.15;
          if (api.t >= s.dies) supernova(s);
        }
      },
      draw(ctx, pass, frame) {
        const ox = api.screenX(0);
        if (pass === 'mid') {
          ctx.save();
          for (const w of cosmos.wells) {
            // A collapsing cloud: a dark knot with a faint glow at its heart.
            const x = w.x + ox;
            const g = ctx.createRadialGradient(x, w.y, 0, x, w.y, 40);
            g.addColorStop(0, hexRgba(WARM, 0.25 * w.strength));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - 40, w.y - 40, 80, 80);
          }
          for (const s of cosmos.stars) {
            const x = s.x + ox;
            if (x < -200 || x > api.width + 200) continue;
            if (s.dead) {
              // A remnant: a faint expanding nebula ring and a pinprick.
              const age = frame.time - s.dies;
              ctx.strokeStyle = hexRgba(WARM, Math.max(0, 0.25 - age * 0.004));
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x, s.y, 30 + age * 6, 0, Math.PI * 2);
              ctx.stroke();
              ctx.fillStyle = hexRgba('#e0f2fe', 0.7);
              ctx.fillRect(x - 1, s.y - 1, 2, 2);
              continue;
            }
            // The wind bubble's edge.
            if (s.bubble > 0) {
              ctx.strokeStyle = hexRgba(s.color, 0.22 * (1 - s.bubble / (150 + s.mass * 40)));
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(x, s.y, s.bubble, 0, Math.PI * 2);
              ctx.stroke();
            }
            // Disk and orbits, foreshortened.
            ctx.save();
            ctx.translate(x, s.y);
            ctx.rotate(s.tilt);
            ctx.fillStyle = hexRgba('#fdba74', 0.55);
            for (const d of s.disk) ctx.fillRect(Math.cos(d.ang) * d.r - 0.7, Math.sin(d.ang) * d.r * 0.35 - 0.7, 1.4, 1.4);
            ctx.strokeStyle = hexRgba(s.color, 0.14);
            ctx.lineWidth = 1;
            for (const pl of s.planets) {
              ctx.beginPath();
              ctx.ellipse(0, 0, pl.r, pl.r * 0.35, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.restore();
            // Jets for the first seconds of its life.
            if (frame.time < s.jets) {
              const k = (s.jets - frame.time) / 7;
              const len = 90 * k * (0.8 + 0.2 * Math.sin(frame.time * 30));
              const jx = Math.cos(s.tilt + Math.PI / 2);
              const jy = Math.sin(s.tilt + Math.PI / 2);
              ctx.strokeStyle = hexRgba(HOT, 0.7 * k);
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x - jx * len, s.y - jy * len);
              ctx.lineTo(x + jx * len, s.y + jy * len);
              ctx.stroke();
            }
            // The star.
            const r = 4 + s.mass * 4;
            const g = ctx.createRadialGradient(x, s.y, 0, x, s.y, r * 6);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.15, hexRgba(s.color, 0.9));
            g.addColorStop(0.45, hexRgba(s.color, 0.18));
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r * 6, s.y - r * 6, r * 12, r * 12);
            // Planets, with the night side's lights where there are cities.
            for (const pl of s.planets) {
              const px = Math.cos(pl.ang) * pl.r;
              const py = Math.sin(pl.ang) * pl.r * 0.35;
              const wx = x + px * Math.cos(s.tilt) - py * Math.sin(s.tilt);
              const wy = s.y + px * Math.sin(s.tilt) + py * Math.cos(s.tilt);
              ctx.fillStyle = pl.stage >= 1 ? '#4ade80' : pl.color;
              ctx.beginPath();
              ctx.arc(wx, wy, pl.size, 0, Math.PI * 2);
              ctx.fill();
              if (pl.stage >= 2) {
                ctx.fillStyle = CITY;
                const away = Math.atan2(wy - s.y, wx - x);
                for (let k = 0; k < 6; k++) {
                  if (cellHash(k + pl.r, Math.floor(frame.time * 2 + k)) < 0.3) continue;
                  const a = away + (cellHash(k, pl.r) - 0.5) * 1.6;
                  ctx.fillRect(wx + Math.cos(a) * pl.size * 0.8 - 0.5, wy + Math.sin(a) * pl.size * 0.8 - 0.5, 1, 1);
                }
              }
              if (pl.stage >= 3) {
                // Satellites: a tiny ring.
                ctx.strokeStyle = hexRgba(CITY, 0.5);
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.arc(wx, wy, pl.size + 3, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          }
          ctx.restore();
        }
      },
    };
  },
});

// ---- life -----------------------------------------------------------------------------------

registerMechanic({
  id: 'life',
  label: 'Life and the first ships',
  description: 'Habitable planets grow life, then cities whose lights twinkle on the night side, then ships that colonize other stars and make first contact. Sometimes the lights go out.',
  schema: {
    pace: { type: 'number', min: 0.3, max: 3, default: 1, label: 'How fast life gets going' },
    silence: { type: 'number', min: 0, max: 1, default: 0.15, label: 'Chance a civilization goes dark' },
  },
  create(api, p) {
    const cosmos = useCosmos(api);
    const pace = Number(p.pace) || 1;
    const silence = Number(p.silence ?? 0.15);
    let quietUntil = 0;

    const where = (s: Star, pl: Planet): P => {
      const px = Math.cos(pl.ang) * pl.r;
      const py = Math.sin(pl.ang) * pl.r * 0.35;
      return { x: s.x + px * Math.cos(s.tilt) - py * Math.sin(s.tilt), y: s.y + px * Math.sin(s.tilt) + py * Math.cos(s.tilt) };
    };

    const launch = (s: Star, pl: Planet) => {
      const at = where(s, pl);
      // Ships go where they hear voices, or to the nearest quiet stars.
      const others = cosmos.stars.filter((o) => o !== s && !o.dead && Math.hypot(o.x - s.x, o.y - s.y) < 700);
      const voices = others.filter((o) => o.planets.some((q) => q.stage >= 2));
      const pool = voices.length && api.rng() < 0.6 ? voices : others;
      const to = pool.length && api.rng() < 0.8 ? pool[Math.floor(api.rng() * pool.length)] : null;
      const a = to ? Math.atan2(to.y - at.y, to.x - at.x) : api.rng() * Math.PI * 2;
      cosmos.ships.push({ x: at.x, y: at.y, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, to, from: s, life: 40 });
    };

    return {
      update(dt) {
        for (const s of cosmos.stars) {
          if (s.dead) continue;
          for (const pl of s.planets) {
            if (pl.stage < 0 || api.t < pl.next) continue;
            const at = where(s, pl);
            if (pl.stage === 0) {
              pl.stage = 1;
              pl.next = api.t + (25 + api.rng() * 30) / pace;
              api.say(`LIFE · ${pl.name}`, at.x, at.y - 18, '#4ade80', { priority: 'low' });
              api.emit({ type: 'life', x: at.x, y: at.y, weight: 0.5, color: '#4ade80' });
            } else if (pl.stage === 1) {
              pl.stage = 2;
              pl.next = api.t + (15 + api.rng() * 20) / pace;
              api.say(`${pl.name} · THE FIRST CITIES`, at.x, at.y - 18, CITY, { priority: 'medium' });
              api.emit({ type: 'civilization', x: at.x, y: at.y, weight: 0.7, color: CITY });
            } else if (pl.stage === 2) {
              if (api.rng() < silence) {
                pl.stage = -1;
                pl.color = '#475569';
                api.say(`THE LIGHTS OF ${pl.name} GO OUT`, at.x, at.y - 18, '#94a3b8', { priority: 'high', duration: 5000 });
                api.emit({ type: 'silence', x: at.x, y: at.y, weight: 0.6 });
              } else {
                pl.stage = 3;
                pl.next = api.t + 4;
                api.say(`${pl.name} · FIRST SHIPS`, at.x, at.y - 18, CITY, { priority: 'medium' });
                api.emit({ type: 'firstships', x: at.x, y: at.y, weight: 0.65, color: CITY });
              }
            } else if (pl.stage === 3) {
              pl.next = api.t + 12 + api.rng() * 14;
              if (cosmos.ships.length < 24) launch(s, pl);
            }
          }
        }
        // Ships: fly; arriving at a living world means contact, at an empty one, a colony.
        for (let i = cosmos.ships.length - 1; i >= 0; i--) {
          const sh = cosmos.ships[i];
          sh.life -= dt;
          if (sh.to && !sh.to.dead) {
            const dx = sh.to.x - sh.x;
            const dy = sh.to.y - sh.y;
            const d = Math.hypot(dx, dy) || 1;
            sh.vx += ((dx / d) * 26 - sh.vx) * dt;
            sh.vy += ((dy / d) * 26 - sh.vy) * dt;
            if (d < 30) {
              const t = sh.to;
              const living = t.planets.find((pl) => pl.stage >= 2);
              const key = [sh.from.id, t.id].sort().join('-');
              if (living && !cosmos.contacts.has(key)) {
                cosmos.contacts.add(key);
                // Contact is news the first few times; after that, between neighbors it is quiet.
                if (api.t < quietUntil) {
                  cosmos.ships.splice(i, 1);
                  continue;
                }
                quietUntil = api.t + 45;
                api.say(`FIRST CONTACT · ${sh.from.name} ⇄ ${t.name}`, t.x, t.y - 46, CITY, { priority: 'high', duration: 5000 });
                api.emit({ type: 'contact', x: t.x, y: t.y, weight: 0.85, color: CITY });
              } else if (!living) {
                const empty = t.planets.find((pl) => pl.stage === 0);
                if (empty) {
                  empty.stage = 2;
                  empty.next = api.t + 20 / pace;
                  api.say(`COLONY · ${empty.name}`, t.x, t.y - 40, CITY, { priority: 'medium' });
                  api.emit({ type: 'colony', x: t.x, y: t.y, weight: 0.5, color: CITY });
                }
              }
              cosmos.ships.splice(i, 1);
              continue;
            }
          }
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          if (sh.life <= 0) cosmos.ships.splice(i, 1);
        }
      },
      draw(ctx, pass) {
        if (pass !== 'over' || !cosmos.ships.length) return;
        const ox = api.screenX(0);
        ctx.save();
        ctx.strokeStyle = hexRgba(CITY, 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (const sh of cosmos.ships) {
          ctx.moveTo(sh.x + ox, sh.y);
          ctx.lineTo(sh.x + ox - sh.vx * 0.6, sh.y - sh.vy * 0.6);
        }
        ctx.stroke();
        ctx.fillStyle = CITY;
        for (const sh of cosmos.ships) ctx.fillRect(sh.x + ox - 1, sh.y - 1, 2, 2);
        ctx.restore();
      },
    };
  },
});

// ---- epochs ---------------------------------------------------------------------------------

registerMechanic({
  id: 'epochs',
  label: 'The age of the universe',
  description: 'The age in billions of years, running fast, and the name of the era: the dark ages, first light, the stellar nursery, the first voices, the great silence.',
  schema: {
    rate: { type: 'number', min: 0.002, max: 0.05, default: 0.011, label: 'Billion years per second' },
  },
  create(api, p) {
    const cosmos = useCosmos(api);
    cosmos.rate = Number(p.rate) || 0.011;
    let era = '';
    let hadVoices = false;

    const eraName = () => {
      const living = cosmos.stars.filter((s) => !s.dead);
      const voices = living.some((s) => s.planets.some((pl) => pl.stage >= 2));
      if (voices) hadVoices = true;
      if (!living.length) return cosmos.wells.length ? 'THE DARK AGES' : 'THE DARK';
      if (voices) return 'THE FIRST VOICES';
      if (hadVoices) return 'THE GREAT SILENCE';
      return living.length > 2 ? 'THE STELLAR NURSERY' : 'FIRST LIGHT';
    };

    return {
      update(dt) {
        cosmos.age += dt * cosmos.rate;
        const name = eraName();
        if (name !== era) {
          if (era) api.emit({ type: 'era', x: api.view().left + api.width / 2, y: 40, weight: 0.15, text: name });
          era = name;
        }
      },
      draw(ctx, pass) {
        if (pass !== 'hud') return;
        const text = `AGE ${cosmos.age.toFixed(2)} GYR · ${era}`;
        ctx.save();
        ctx.font = '10px "Orbit", "Syne Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const w = ctx.measureText(text).width;
        ctx.fillStyle = hexRgba(api.host.palette.bg, 0.7);
        ctx.fillRect(api.width / 2 - w / 2 - 6, 10, w + 12, 16);
        ctx.fillStyle = hexRgba('#e9d5ff', 0.85);
        ctx.fillText(text, api.width / 2, 22);
        ctx.restore();
      },
    };
  },
});
