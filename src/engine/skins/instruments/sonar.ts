/**
 * Sonar: a submarine's passive broadband waterfall. Bearing runs across the screen,
 * time scrolls downward, and each contact draws a trace that drifts as it moves.
 * Biologics sing on and off, the stern arc is deaf (the baffles), transients flare
 * across a span of bearings, and now and then the operator marks a contact and the
 * fire-control solution types out.
 */
import type { BackgroundSkin, FrameInfo, SkinHost, Viewport } from '../../core/skin';
import type { Schema } from '../../core/schema';
import { resolveOptions } from '../../core/schema';
import { fillCrisp, clamp01, hash, hexA, mixRgb, mono, plate, scanlines, typed } from './kit';

const schema = {
  contacts: { type: 'number', min: 2, max: 10, default: 6, step: 1, label: 'Contacts' },
  speed: { type: 'number', min: 0.3, max: 2.5, default: 1, label: 'Scroll speed' },
  grain: { type: 'number', min: 0, max: 1, default: 0.55, label: 'Ocean noise' },
  labels: { type: 'boolean', default: true, label: 'Contact labels' },
  activity: { type: 'number', min: 0, max: 3, default: 1, label: 'Events (torpedoes, pings, evasions)' },
} satisfies Schema;

/** Events come in fixed slots of time, decided by hash, so the waterfall's history is the same however it was reached. */
const SLOT = 80;
type Ev = { kind: 'torpedo' | 'ping'; t0: number; b: number; turn: number };
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const angDiff = (a: number, b: number) => {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

type Kind = 'MERCHANT' | 'BIOLOGIC' | 'WARSHIP' | 'TRAWLER' | 'UNKNOWN' | 'SUBMARINE';
type Contact = {
  id: number;
  kind: Kind;
  b0: number;
  drift: number;
  wobble: number;
  phase: number;
  width: number;
  strength: number;
  born: number;
  dies: number;
};

const KINDS: Kind[] = ['MERCHANT', 'MERCHANT', 'BIOLOGIC', 'TRAWLER', 'WARSHIP', 'UNKNOWN', 'SUBMARINE'];
const ROW_PX = 3;
const ROWS_PER_SEC = 6;

export const sonarSkin: BackgroundSkin<Partial<Record<keyof typeof schema, unknown>>> = {
  id: 'sonar',
  label: 'Sonar waterfall',
  description: 'A submarine\'s passive sonar: contacts drifting across a scrolling bearing-time waterfall.',
  tags: ['instrument', 'naval', 'dark', 'green'],
  crisp: true,
  schema,
  defaults: { palette: { from: '#4ade80' }, intensity: 0.6 },
  mount(host: SkinHost) {
    const o = resolveOptions(schema, host.options);
    const { ctx, palette } = host;
    const rng = host.fork('sonar');
    const wf = document.createElement('canvas');
    const wctx = wf.getContext('2d')!;
    let W = host.viewport.width;
    let H = host.viewport.height;
    const area = { x: 58, y: 46, w: 0, h: 0 };
    let rows = 1;
    let row = 0;
    let acc = 0;
    let nextId = 1;
    const contacts: Contact[] = [];
    const accent = palette.accent;
    const hot = mixRgb(accent, '#ffffff', 0.55);
    const base = mixRgb(palette.bg, accent, 0.08);
    const lineRgb = mixRgb(accent, accent, 0);

    const spawn = (t: number): Contact => {
      const kind = KINDS[Math.floor(rng() * KINDS.length)];
      let b0 = rng() * 360;
      if (b0 > 160 && b0 < 200) b0 += 60; // not in the baffles at birth
      return {
        id: nextId++,
        kind,
        b0,
        drift: (rng() - 0.5) * (kind === 'WARSHIP' ? 3 : 1.4),
        wobble: kind === 'BIOLOGIC' ? 6 + rng() * 8 : rng() * 2.5,
        phase: rng() * Math.PI * 2,
        width: kind === 'MERCHANT' ? 2.2 + rng() : kind === 'SUBMARINE' ? 0.9 : 1.4 + rng(),
        strength: kind === 'SUBMARINE' ? 0.35 : kind === 'UNKNOWN' ? 0.45 : 0.6 + rng() * 0.4,
        born: t,
        dies: t + 40 + rng() * 90,
      };
    };
    // The events: a torpedo and the evasion that follows, or an active ping and its echoes.
    const evCache = new Map<number, Ev | null>();
    const eventIn = (slot: number): Ev | null => {
      let e = evCache.get(slot);
      if (e !== undefined) return e;
      const roll = hash(slot, 101);
      const b = hash(slot, 103) * 360;
      const turn = hash(slot, 104) < 0.5 ? 55 : -55;
      if (o.activity <= 0) e = null;
      else if (slot === 0 || roll < Math.min(0.85, 0.32 * o.activity)) e = { kind: 'torpedo', t0: slot === 0 ? 14 : slot * SLOT + 3 + hash(slot, 102) * 8, b, turn };
      else if (roll < Math.min(0.95, 0.32 * o.activity + 0.45)) e = { kind: 'ping', t0: slot * SLOT + 4 + hash(slot, 102) * (SLOT - 12), b, turn };
      else e = null;
      evCache.set(slot, e);
      if (evCache.size > 64) evCache.delete(evCache.keys().next().value!);
      return e;
    };
    const eventsNear = (t: number) => {
      const s = Math.floor(t / SLOT);
      return [eventIn(s - 1), eventIn(s)].filter((e): e is Ev => !!e);
    };
    /** Own ship's heading offset: hard over to evade, then back to base course. */
    const turnAt = (t: number) => {
      let off = 0;
      for (const e of eventsNear(t)) if (e.kind === 'torpedo') off += e.turn * smooth((t - e.t0 - 12) / 9) * (1 - smooth((t - e.t0 - 48) / 12));
      return off;
    };
    const decoyOf = (e: Ev) => e.b + (e.turn > 0 ? -38 : 38);
    const torpedoTrue = (e: Ev, t: number) => {
      const b = e.b + 0.25 * (t - e.t0);
      return b + (decoyOf(e) - b) * smooth((t - e.t0 - 18) / 8);
    };
    const bearingOf = (c: Contact, t: number) => (((c.b0 + c.drift * (t - c.born) + Math.sin(t * 0.07 + c.phase) * c.wobble - turnAt(t)) % 360) + 360) % 360;

    // Transients: short broadband flares (a hatch, a pump, a torpedo tube flooding).
    const transientAt = (r: number) => {
      const slot = Math.floor(r / 90);
      if (hash(slot, 77) > 0.55) return null;
      const start = slot * 90 + Math.floor(hash(slot, 78) * 70);
      if (r < start || r > start + 4) return null;
      return { bearing: hash(slot, 79) * 360, span: 6 + hash(slot, 80) * 16 };
    };

    const img = () => wctx.createImageData(360, 1);
    let rowImg = img();
    const emitRow = (r: number) => {
      const t = r / ROWS_PER_SEC;
      for (let i = contacts.length - 1; i >= 0; i--) if (t > contacts[i].dies) contacts.splice(i, 1, spawn(t));
      const tr = transientAt(r);
      const d = rowImg.data;
      // Everything that sounds this row, as (relative bearing, strength, width) lines.
      const off = turnAt(t);
      const lines: { b: number; s: number; w: number }[] = [];
      for (const c of contacts) {
        const life = clamp01((t - c.born) / 6) * clamp01((c.dies - t) / 6);
        if (life <= 0) continue;
        let s = c.strength * life;
        if (c.kind === 'BIOLOGIC') s *= Math.sin(t * 0.9 + c.phase) > 0.2 ? 0.6 + 0.4 * hash(r, c.id) : 0.06;
        lines.push({ b: bearingOf(c, t), s, w: c.width });
      }
      let floor = 0;
      const spans: { b: number; s: number; span: number }[] = [];
      if (tr) spans.push({ b: tr.bearing, s: 0.45, span: tr.span });
      for (const ev of eventsNear(t)) {
        const k = t - ev.t0;
        if (ev.kind === 'torpedo') {
          if (k >= 0 && k < 1.2) spans.push({ b: ev.b - off, s: 0.6, span: 5 });
          if (k >= 3 && k < 28) lines.push({ b: torpedoTrue(ev, t) - off, s: (0.55 + 0.45 * clamp01((k - 3) / 10)) * clamp01(28 - k), w: 0.7 });
          if (k >= 16 && k < 36) lines.push({ b: decoyOf(ev) - off, s: 0.5 * (0.55 + 0.45 * hash(r, 7)) * clamp01((k - 16) * 2) * clamp01((36 - k) / 4), w: 8 });
          if (k >= 28 && k < 29.6) {
            spans.push({ b: decoyOf(ev) - off, s: 1, span: 46 });
            floor += 0.18;
          }
        } else {
          // One ping across every bearing, then each contact answers after its range delay.
          if (k >= 0 && k < 0.4) floor += 0.5;
          for (const c of contacts) {
            const delay = 1 + hash(c.id, 33) * 5;
            if (k >= delay && k < delay + 0.4) lines.push({ b: bearingOf(c, t), s: 1, w: 1.6 });
          }
        }
      }
      for (let b = 0; b < 360; b++) {
        let e = 0.07 + floor + o.grain * (0.2 * hash(r, b) + 0.16 * (host.noise.noise2(b * 0.045, r * 0.015) * 0.5 + 0.5));
        for (const l of lines) {
          const db = angDiff(l.b, b);
          if (db < l.w * 4) e += l.s * Math.exp(-(db * db) / (2 * l.w * l.w));
        }
        for (const sp of spans) {
          const db = angDiff(sp.b, b);
          if (db < sp.span) e += sp.s * (1 - db / sp.span);
        }
        // Baffles: the stern arc hears only the boat itself.
        if (b > 165 && b < 195) e = e * 0.25 + 0.04;
        e = clamp01(e);
        // A dark floor with speckle; only real energy lights up.
        const k = Math.pow(e, 1.5);
        const heat = clamp01((e - 0.55) / 0.45) * 0.6;
        for (let ch = 0; ch < 3; ch++) {
          const lit = base[ch] + (lineRgb[ch] - base[ch]) * k;
          d[b * 4 + ch] = lit + (hot[ch] - lit) * heat;
        }
        d[b * 4 + 3] = Math.round(255 * clamp01(0.08 + k * 1.5));
      }
      wctx.drawImage(wf, 0, 0, 360, rows - 1, 0, 1, 360, rows - 1);
      wctx.putImageData(rowImg, 0, 0);
    };

    const layout = () => {
      area.w = Math.max(100, W - area.x - 24);
      area.h = Math.max(100, H - area.y - 40);
      const next = Math.max(10, Math.ceil(area.h / ROW_PX));
      if (next !== rows) {
        rows = next;
        wf.width = 360;
        wf.height = rows;
        rowImg = img();
        // Fill the history so the waterfall is full from the first frame.
        const start = row - rows;
        if (!contacts.length) for (let i = 0; i < o.contacts; i++) contacts.push(spawn(start / ROWS_PER_SEC - rng() * 30));
        for (let r = start; r < row; r++) emitRow(r);
      }
    };
    layout();

    // The operator's cursor: marks a contact, the solution types out, then it moves on.
    let mark: { id: number; at: number; text: string } | null = null;
    let nextMark = 4;
    let cursor = 0;

    const bx = (b: number) => area.x + (b / 360) * area.w;

    return {
      resize(v: Viewport) {
        W = v.width;
        H = v.height;
        layout();
      },
      frame(info: FrameInfo) {
        const t = info.t;
        if (host.motion !== 'off') {
          acc += info.dt * ROWS_PER_SEC * o.speed;
          let n = 0;
          while (acc >= 1 && n < 30) {
            emitRow(row++);
            acc -= 1;
            n++;
          }
        }
        const now = row / ROWS_PER_SEC;
        const level = 0.55 + 0.45 * host.intensity;
        const ink = palette.ink;

        plate(ctx, W, H, palette.bg, accent, 0.5, 0.4, 0.07);
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.x, area.y, area.w, area.h);
        ctx.clip();
        ctx.globalAlpha = level;
        ctx.imageSmoothingEnabled = true;
        // The fractional row offset keeps the scroll smooth between emitted rows.
        ctx.drawImage(wf, 0, 0, 360, rows, area.x, area.y + acc * ROW_PX, area.w, rows * ROW_PX);
        ctx.restore();
        scanlines(ctx, W, H, palette.bg, 0.18, 3);

        // Grid: bearings every 30 degrees, time every 10 s.
        ctx.strokeStyle = hexA(accent, 0.12 * level);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let b = 0; b <= 360; b += 30) {
          ctx.moveTo(Math.round(bx(b)) + 0.5, area.y);
          ctx.lineTo(Math.round(bx(b)) + 0.5, area.y + area.h);
        }
        const pxPerSec = ROWS_PER_SEC * ROW_PX;
        for (let s = 0; s * pxPerSec < area.h; s += 10) {
          const y = Math.round(area.y + s * pxPerSec) + 0.5;
          ctx.moveTo(area.x, y);
          ctx.lineTo(area.x + area.w, y);
        }
        ctx.stroke();

        // Bearing ruler.
        ctx.fillStyle = hexA(ink, 0.6 * level);
        ctx.font = mono(10);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.strokeStyle = hexA(accent, 0.45 * level);
        ctx.beginPath();
        for (let b = 0; b <= 360; b += 5) {
          const x = Math.round(bx(b)) + 0.5;
          const len = b % 30 === 0 ? 8 : b % 10 === 0 ? 5 : 3;
          ctx.moveTo(x, area.y - 2);
          ctx.lineTo(x, area.y - 2 - len);
          if (b % 30 === 0 && b < 360) fillCrisp(ctx, String(b).padStart(3, '0'), x, area.y - 12);
        }
        ctx.stroke();

        // Time axis.
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let s = 0; s * pxPerSec < area.h; s += 30) {
          ctx.fillStyle = hexA(ink, 0.45 * level);
          fillCrisp(ctx, s === 0 ? 'NOW' : `-${s}S`, area.x - 8, area.y + s * pxPerSec);
        }

        // Contact labels along the ruler.
        if (o.labels) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = mono(10);
          const placed: number[] = [];
          for (const c of contacts) {
            const life = clamp01((now - c.born) / 6) * clamp01((c.dies - now) / 6);
            if (life < 0.4) continue;
            const b = bearingOf(c, now);
            const x = bx(b);
            const lane = placed.filter((p) => Math.abs(p - x) < 110).length;
            placed.push(x);
            const y = area.y + 14 + lane * 14;
            ctx.strokeStyle = hexA(accent, 0.5 * level * life);
            ctx.beginPath();
            ctx.moveTo(x, area.y);
            ctx.lineTo(x, y - 5);
            ctx.stroke();
            ctx.fillStyle = hexA(ink, 0.75 * level * life);
            fillCrisp(ctx, `S${c.id} ${c.kind}`, x + 4, y);
          }
        }

        // Designation cursor and the typed solution.
        if (!mark && t >= nextMark && contacts.length) {
          const live = contacts.filter((c) => now - c.born > 8 && c.dies - now > 12);
          const c = live.length ? live[Math.floor(hash(Math.floor(t), 9) * live.length)] : null;
          if (c) {
            const rng2 = hash(c.id, Math.floor(t));
            const range = (3 + rng2 * 18).toFixed(1);
            const crs = String(Math.floor(hash(c.id, 3) * 360)).padStart(3, '0');
            const spd = 4 + Math.floor(hash(c.id, 4) * (c.kind === 'WARSHIP' ? 24 : 12));
            mark = { id: c.id, at: t, text: `S${c.id} ${c.kind} · RNG ${range} KYD · CRS ${crs} · SPD ${spd} KT` };
          }
          nextMark = t + 12 + hash(Math.floor(t), 2) * 10;
        }
        if (mark) {
          const c = contacts.find((k) => k.id === mark!.id);
          const age = t - mark.at;
          if (!c || age > 9) {
            mark = null;
          } else {
            const target = bx(bearingOf(c, now));
            cursor += (target - cursor) * Math.min(1, info.dt * 4);
            if (age < 0.05) cursor = target;
            const a = level * Math.min(1, age * 3) * Math.min(1, (9 - age) * 2);
            ctx.strokeStyle = hexA(ink, 0.7 * a);
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(Math.round(cursor) + 0.5, area.y);
            ctx.lineTo(Math.round(cursor) + 0.5, area.y + area.h);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = mono(11);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = hexA(accent, 0.95 * a);
            fillCrisp(ctx, typed(`MARK · ${mark.text}`, age - 0.3, 34, t), W - 24, H - 12);
          }
        }

        // Events as the watch hears them: tags on the ruler and the call-outs, typed.
        const alarm = '#f87171';
        const off = turnAt(now);
        let call: { text: string; at: number; hot: boolean } | null = null;
        let flank = 0;
        for (const ev of eventsNear(now)) {
          const k = now - ev.t0;
          const brg = (b: number) => String(Math.round((((b - off) % 360) + 360) % 360)).padStart(3, '0');
          const steps: [number, string, boolean][] = ev.kind === 'torpedo'
            ? [
              [0, `TRANSIENT · BRG ${brg(ev.b)} · LAUNCH TRANSIENT`, true],
              [3, `TORPEDO IN THE WATER · BRG ${brg(ev.b)} · HIGH-SPEED SCREWS`, true],
              [12, `OWN SHIP · HARD ${ev.turn > 0 ? 'RIGHT' : 'LEFT'} RUDDER · AHEAD FLANK`, true],
              [16, `COUNTERMEASURE AWAY · BRG ${brg(decoyOf(ev))}`, false],
              [22, 'TORPEDO BEARING DRIFT · TRACKING DECOY', false],
              [28, `DETONATION · BRG ${brg(decoyOf(ev))} · TORPEDO DEFEATED`, true],
              [48, 'RESUMING BASE COURSE · ALL AHEAD ONE THIRD', false],
            ]
            : [
              [-1.5, 'GOING ACTIVE · SINGLE PING', false],
              [1, `ECHOES · ${contacts.length} RETURNS · RANGES UPDATED`, false],
            ];
          for (const [at, text, hot] of steps) if (k >= at && k < at + 8) call = { text, at: ev.t0 + at, hot };
          if (ev.kind === 'torpedo') {
            flank = Math.max(flank, smooth((k - 12) / 6) * (1 - smooth((k - 48) / 10)));
            if (k >= 3 && k < 28) {
              const x = bx((((torpedoTrue(ev, now) - off) % 360) + 360) % 360);
              ctx.font = mono(10);
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillStyle = hexA(alarm, (Math.floor(t * 4) % 2 ? 1 : 0.55) * level);
              fillCrisp(ctx, 'TORP', x, area.y + 3);
              ctx.strokeStyle = hexA(alarm, 0.7 * level);
              ctx.beginPath();
              ctx.moveTo(x - 6, area.y + 1);
              ctx.lineTo(x, area.y - 5);
              ctx.lineTo(x + 6, area.y + 1);
              ctx.stroke();
            }
          }
        }
        if (call) {
          const age = now - call.at;
          ctx.font = mono(12);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const a = level * clamp01((8 - age) * 1.5);
          ctx.fillStyle = hexA(palette.bg, 0.7 * a);
          ctx.fillRect(area.x + area.w / 2 - 260, area.y + 38, 520, 22);
          ctx.fillStyle = hexA(call.hot ? alarm : accent, (call.hot && Math.floor(t * 3) % 2 ? 0.7 : 1) * a);
          fillCrisp(ctx, typed(call.text, age, 40, t), area.x + area.w / 2, area.y + 43);
        }

        // Readouts.
        ctx.font = mono(10);
        ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left';
        ctx.fillStyle = hexA(ink, 0.5 * level);
        fillCrisp(ctx, `PASSIVE BB · 50–2000 HZ · ${contacts.length} TRACKS`, area.x, H - 12);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        const crs = String(Math.round((((90 + off) % 360) + 360) % 360)).padStart(3, '0');
        fillCrisp(ctx, `DEPTH ${210 + Math.round(Math.sin(t * 0.05) * 6 + flank * 40)} M · CRS ${crs} · ${Math.round(6 + flank * 22)} KT`, W - 24, area.y - 22);
      },
      destroy() {},
    };
  },
};
