/**
 * The microscope, shared by Petri's two media (the particle dish and the Lenia culture):
 * the eyepiece and its stain, the focus that drifts and the autofocus that hunts for it,
 * the lab notebook with each organism's Latin name, and the population chart.
 */
import type { SkinHost } from '../../core/skin';
import { fillCrisp, hash, hexA, mono, typed } from '../instruments/kit';

/** The notebook's hand: an italic book face. */
const hand = (px: number) => `italic ${px}px Georgia, "Times New Roman", serif`;

export type Stain = 'fluorescent' | 'darkfield' | 'phase';

/** Each stain's dyes for up to seven strains, the giant, and a contaminant. */
export const DYES: Record<Stain, string[]> = {
  fluorescent: ['#4ade80', '#f472b6', '#38bdf8', '#facc15', '#a78bfa', '#fb923c', '#2dd4bf'],
  darkfield: ['#e2e8f0', '#cbd5e1', '#bae6fd', '#e0f2fe', '#f1f5f9', '#c7d2fe', '#dbeafe'],
  phase: ['#d6d3d1', '#cbd5e1', '#e7e5e4', '#d4d4d8', '#e2e8f0', '#d6d3d1', '#e5e7eb'],
};
export const CONTAMINANT: Record<Stain, string> = { fluorescent: '#e879f9', darkfield: '#fef08a', phase: '#fafaf9' };
export const PREDATOR: Record<Stain, string> = { fluorescent: '#f87171', darkfield: '#fda4af', phase: '#a8a29e' };

// ---- the eyepiece ------------------------------------------------------------------------

/** The medium under the eyepiece, the rim with its colour fringing, the scale around it. */
export function paintEyepiece(host: SkinHost, W: number, H: number, cx: number, cy: number, R: number, stain: Stain): HTMLCanvasElement {
  const d = Math.min(2, host.viewport.dpr || 1);
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * d);
  c.height = Math.ceil(H * d);
  const g = c.getContext('2d')!;
  g.scale(d, d);
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
  const [mid, edge] = stain === 'phase' ? ['#15181b', '#0d0f11'] : stain === 'darkfield' ? ['#05070c', '#030409'] : ['#03080a', '#020507'];
  grad.addColorStop(0, mid);
  grad.addColorStop(0.85, edge);
  grad.addColorStop(1, '#000');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  const rr = host.fork('medium');
  for (let i = 0; i < R * R * 0.01; i++) {
    const a = rr() * Math.PI * 2;
    const dd = Math.sqrt(rr()) * R;
    g.fillStyle = `rgba(148,163,184,${(0.03 + rr() * 0.06).toFixed(3)})`;
    g.fillRect(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd, 1, 1);
  }
  g.lineWidth = 1.5;
  g.strokeStyle = 'rgba(248,113,113,0.18)';
  g.beginPath();
  g.arc(cx + 1, cy, R + 1, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(96,165,250,0.18)';
  g.beginPath();
  g.arc(cx - 1, cy, R + 1, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(203,213,225,0.25)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const l = k % 6 === 0 ? 9 : 4;
    g.strokeStyle = `rgba(203,213,225,${k % 6 === 0 ? 0.35 : 0.18})`;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
    g.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l));
    g.stroke();
  }
  return c;
}

/** The reticle over the field. */
export function reticle(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
  ctx.strokeStyle = 'rgba(203,213,225,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.08, 0, Math.PI * 2);
  ctx.stroke();
}

// ---- focus ---------------------------------------------------------------------------------

/**
 * The focus drifts as the stage warms; when it has gone soft enough, the autofocus hunts:
 * past sharp, back, and settles. `f` is 1 when sharp.
 */
export type Focus = { f: number; hunting: number; step(t: number, dt: number, rnd: () => number): boolean };

export function createFocus(): Focus {
  let drift = 0;
  let from = 1;
  const focus: Focus = {
    f: 1,
    hunting: -1,
    /** Returns true when the autofocus starts a hunt. */
    step(t, dt, rnd) {
      if (focus.hunting >= 0) {
        const k = (t - focus.hunting) / 2.6;
        if (k >= 1) {
          focus.hunting = -1;
          focus.f = 1;
          return false;
        }
        // Over, under, over, settle: a damped swing back to sharp.
        const swing = Math.cos(k * Math.PI * 3) * (1 - k) ** 1.5;
        focus.f = 1 - (1 - from) * Math.abs(swing);
        return false;
      }
      drift += (rnd() - 0.48) * dt * 0.05;
      drift = Math.max(-0.02, Math.min(0.02, drift));
      focus.f = Math.max(0.45, Math.min(1, focus.f - Math.abs(drift) * dt * 0.5 - dt * 0.0028));
      if (focus.f < 0.8) {
        from = focus.f;
        focus.hunting = t;
        return true;
      }
      return false;
    },
  };
  return focus;
}

// ---- names -----------------------------------------------------------------------------------

const ROOTS = ['Lumi', 'Cyclo', 'Proto', 'Vermi', 'Glob', 'Fili', 'Cilio', 'Astro', 'Myxo', 'Sphaer', 'Plasmo', 'Thallo', 'Nocti', 'Vitro'];
const ENDS = ['cella', 'monas', 'phora', 'zoon', 'coccus', 'dinium', 'plasma', 'ella', 'opsis'];
const EPITHETS = ['pallida', 'vagans', 'minuta', 'errans', 'ferox', 'gemina', 'lucens', 'tarda', 'rapax', 'umbrosa', 'serena', 'fugax', 'vorax', 'placida', 'nebulosa', 'aurea', 'gracilis', 'magna'];

/** A genus for each strain of this sample (fixed by the seed), and an epithet for each organism. */
export function createNames(seedHash: number, seedText: string) {
  const genus = (strain: number) => ROOTS[(seedHash + strain * 5) % ROOTS.length] + ENDS[(Math.floor(seedHash / 7) + strain * 3) % ENDS.length];
  // Now and then an organism is named for the sample it was found in.
  const local = seedText.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
  const epithet = (id: number) => (local.length >= 3 && hash(id, seedHash) < 0.08 ? `${local}ae` : EPITHETS[Math.floor(hash(id, seedHash, 3) * EPITHETS.length)]);
  return { genus, epithet, name: (strain: number, id: number) => `${genus(strain)} ${epithet(id)}` };
}

// ---- the notebook ------------------------------------------------------------------------------

/** The technician's notebook: dated lines, newest last, in a hand. */
export function createNotebook() {
  const lines: { t: number; text: string }[] = [];
  return {
    lines,
    write(t: number, text: string) {
      lines.push({ t, text });
      if (lines.length > 6) lines.shift();
    },
    draw(ctx: CanvasRenderingContext2D, x: number, y: number, now: number, level: number) {
      ctx.save();
      ctx.font = hand(12);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      const shown = lines.slice(-4);
      shown.forEach((l, i) => {
        const age = now - l.t;
        const a = Math.min(1, age * 2) * (i === shown.length - 1 ? 0.85 : 0.5) * level;
        const clock = `${String(Math.floor(l.t / 60)).padStart(2, '0')}:${String(Math.floor(l.t % 60)).padStart(2, '0')}`;
        ctx.fillStyle = hexA('#cbd5e1', a);
        fillCrisp(ctx, `${typed(l.text, age, 45, now)}  ${clock}`, x, y + i * 16);
      });
      ctx.restore();
    },
  };
}

// ---- the chart --------------------------------------------------------------------------------

/** A small chart of populations over the last few minutes, one line per series. */
export function createChart(series: number, samples = 60) {
  const data: number[][] = Array.from({ length: series }, () => []);
  return {
    data,
    push(values: number[]) {
      values.forEach((v, i) => {
        data[i].push(v);
        if (data[i].length > samples) data[i].shift();
      });
    },
    draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colors: string[], level: number, label: string) {
      const max = Math.max(1, ...data.flat());
      ctx.save();
      ctx.strokeStyle = hexA('#94a3b8', 0.25 * level);
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);
      data.forEach((d, i) => {
        if (d.length < 2) return;
        ctx.strokeStyle = hexA(colors[i] ?? '#94a3b8', 0.75 * level);
        ctx.beginPath();
        d.forEach((v, k) => {
          const px = x + (k / (samples - 1)) * w;
          const py = y + h - (v / max) * (h - 2) - 1;
          if (k) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        });
        ctx.stroke();
      });
      ctx.font = mono(8);
      ctx.textAlign = 'left';
      ctx.fillStyle = hexA('#94a3b8', 0.7 * level);
      fillCrisp(ctx, label, x + 3, y - 4);
      ctx.restore();
    },
  };
}
