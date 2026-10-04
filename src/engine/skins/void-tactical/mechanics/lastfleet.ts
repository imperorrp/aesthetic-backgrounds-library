/**
 * The Last Fleet: everyone left alive, moving together, never stopping.
 *
 *   useArk(api)   the shared state: the ark (a long flexible spine of hull segments that
 *                 keeps pace with the map), the flotilla's ships, and the fleet's counts
 *                 (souls, born, lost, fuel).
 *   'ark'         draws the ark segment by segment (prow, habitat rings with lit windows
 *                 going round, farm domes, trusses, a reactor, cargo, engines with plumes)
 *                 and the fleet's counters.
 *   'flotilla'    hundreds of small civilian ships holding loose stations around the ark.
 *                 Now and then one falls behind (a straggler) and a tug goes back for it.
 *                 Children are born aboard.
 *   'pursuit'     contacts at the trailing edge: the pursuers jump in behind the fleet and
 *                 go for stragglers and the ark's engines; escorts peel off to meet them.
 *   'skimming'    gas giants drift past; skimmers dive to the limb, skim fuel, and return.
 *
 * Civilian ships are plain particles, not fleets, so hundreds cost little. Tugs, escorts,
 * pursuers, and skimmers are real fleets (they fight, dock, and are labeled).
 */
import type { Fleet } from '../types';
import { createBody, normalAt, seek, stepBody, type Body } from '../../../sim/bodies';
import { cellHash } from '../../../sim/cells';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { createCombat } from './combat';
import { registerMechanic, steerOrbit, steerToward, type MechanicApi } from './types';

type P = { x: number; y: number };

export type SegmentKind = 'prow' | 'hab' | 'farm' | 'truss' | 'reactor' | 'cargo' | 'engine';
const SEGMENTS: SegmentKind[] = ['prow', 'hab', 'farm', 'hab', 'truss', 'reactor', 'hab', 'cargo', 'farm', 'hab', 'truss', 'engine'];

/** A civilian ship: a particle that keeps a station relative to an ark segment. */
export type Civ = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which segment it keeps station on, and where relative to it (along, across). */
  slot: number;
  ox: number;
  oy: number;
  /** Its station before it fell behind. */
  home: number;
  kind: number;
  name: string;
  crew: number;
  state: 'flock' | 'straggling' | 'towed';
};

export type Ark = {
  body: Body;
  kinds: SegmentKind[];
  /** Size of the ark relative to a 1280 px wide screen. */
  scale: number;
  souls: number;
  born: number;
  lost: number;
  /** 0..1 fuel reserves. */
  fuel: number;
  civs: Civ[];
  /** Segment i: where it is and which way the spine runs there. */
  at(i: number): { x: number; y: number; ang: number };
  /** Where a station (along, across) on segment i is now. */
  station(i: number, ox: number, oy: number): P;
};

const HULL = '#93c5fd';
const WINDOW = '#fde68a';
const NAMES = ['ARGO', 'HALCYON', 'MERIDIAN', 'LANTERN', 'OSPREY', 'WAYFARER', 'CALLIOPE', 'TERN', 'PILGRIM', 'SEDNA', 'HESTIA', 'MARROW', 'KITE', 'BRAMBLE'];

export function useArk(api: MechanicApi): Ark {
  return api.use('ark', () => {
    const scale = Math.max(0.45, Math.min(1.2, api.width / 1280));
    const spacing = 58 * scale;
    const v = api.view();
    const body = createBody('ark', v.left + api.width * 0.78, api.height * 0.52, SEGMENTS.length, spacing, 0, 1);
    const ark: Ark = {
      body,
      kinds: SEGMENTS,
      scale,
      souls: 41203,
      born: 0,
      lost: 0,
      fuel: 0.62,
      civs: [],
      at(i) {
        const s = body.seg;
        const j = Math.max(0, Math.min(body.n - 1, i));
        const [nx, ny] = normalAt(body, j);
        // The spine runs perpendicular to the normal, pointing toward the head.
        return { x: s[j * 2], y: s[j * 2 + 1], ang: Math.atan2(-nx, ny) };
      },
      station(i, ox, oy) {
        const a = ark.at(i);
        const c = Math.cos(a.ang);
        const s = Math.sin(a.ang);
        return { x: a.x + c * ox - s * oy, y: a.y + s * ox + c * oy };
      },
    };
    // The ark keeps pace with the map: its head heads for a point that drifts with the view.
    api.onUpdate((dt) => {
      const view = api.view();
      const tx = view.left + api.width * 0.78;
      const ty = api.height * (0.5 + 0.08 * Math.sin(api.t * 0.03));
      const d = Math.hypot(tx - body.x, ty - body.y);
      seek(body, tx, ty, Math.max(2, Math.min(40, d * 0.4)), 0.08, dt);
      stepBody(body, dt, 0.02);
      ark.fuel = Math.max(0, ark.fuel - dt * 0.002);
    });
    return ark;
  });
}

// ---- the ark --------------------------------------------------------------------------------

registerMechanic({
  id: 'ark',
  label: 'The ark',
  description: 'An enormous generation ark of linked hulls keeps pace with the map: habitat rings with windows going round, farm domes, a reactor, cargo, engines with plumes. The fleet counts its souls.',
  schema: {
    counters: { type: 'boolean', default: true, label: 'Souls, born, lost, fuel' },
    chatter: { type: 'number', min: 0, max: 2, default: 1, label: 'Ark chatter' },
  },
  create(api, p) {
    const ark = useArk(api);
    const lines = ['HABITAT {n} · LIGHTS DIMMED FOR NIGHT CYCLE', 'FARM {n} · HARVEST IN', 'REACTOR · OUTPUT 71%', 'SCHOOL IN SESSION · HABITAT {n}', 'WATER RECLAIM 99.2%', 'HULL PATCH · RING {n}', 'MEMORIAL HOUR · ALL DECKS'];
    const chatter = Number(p.chatter ?? 1);
    let next = api.t + 8;
    const day0 = 2116;

    /** Draw one segment in local space: x runs toward the prow, y across. */
    const segment = (ctx: CanvasRenderingContext2D, kind: SegmentKind, i: number, t: number, k: number) => {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = hexRgba(HULL, 0.75);
      ctx.fillStyle = 'rgba(8,12,24,0.92)';
      const lit = (j: number) => cellHash(i * 31 + j, Math.floor(t * 0.4 + cellHash(j, i) * 9)) > 0.28;
      switch (kind) {
        case 'prow': {
          ctx.beginPath();
          ctx.moveTo(34 * k, 0);
          ctx.lineTo(10 * k, -15 * k);
          ctx.lineTo(-22 * k, -17 * k);
          ctx.lineTo(-22 * k, 17 * k);
          ctx.lineTo(10 * k, 15 * k);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = hexRgba(WINDOW, 0.85);
          for (let j = 0; j < 5; j++) if (lit(j)) ctx.fillRect((-14 + j * 7) * k, -2 * k, 3 * k, 1.5 * k);
          break;
        }
        case 'hab': {
          // A ring seen edge-on: windows travel round it, brighter on the near side.
          ctx.beginPath();
          ctx.ellipse(0, 0, 10 * k, 28 * k, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 5 * k, 0, Math.PI * 2);
          ctx.stroke();
          for (let j = 0; j < 14; j++) {
            const a = (j / 14) * Math.PI * 2 + t * 0.25;
            const near = Math.cos(a);
            if (!lit(j)) continue;
            ctx.fillStyle = hexRgba(WINDOW, 0.35 + 0.55 * Math.max(0, near));
            ctx.fillRect(Math.cos(a) * 9 * k - 1, Math.sin(a) * 27 * k - 1, 2, 2);
          }
          break;
        }
        case 'farm': {
          const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 20 * k);
          g.addColorStop(0, 'rgba(134,239,172,0.45)');
          g.addColorStop(1, 'rgba(22,101,52,0.25)');
          ctx.beginPath();
          ctx.arc(0, 0, 19 * k, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = hexRgba('#86efac', 0.35);
          for (const rx of [6, 13]) {
            ctx.beginPath();
            ctx.ellipse(0, 0, rx * k, 19 * k, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;
        }
        case 'truss': {
          ctx.beginPath();
          ctx.moveTo(-29 * k, -6 * k);
          ctx.lineTo(29 * k, -6 * k);
          ctx.moveTo(-29 * k, 6 * k);
          ctx.lineTo(29 * k, 6 * k);
          for (let x = -29; x < 29; x += 8) {
            ctx.moveTo(x * k, -6 * k);
            ctx.lineTo((x + 4) * k, 6 * k);
            ctx.lineTo((x + 8) * k, -6 * k);
          }
          ctx.strokeStyle = hexRgba(HULL, 0.5);
          ctx.stroke();
          break;
        }
        case 'reactor': {
          const pulse = 0.6 + 0.4 * Math.sin(t * 2.2);
          const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 22 * k);
          g.addColorStop(0, `rgba(224,242,254,${0.9 * pulse})`);
          g.addColorStop(0.35, `rgba(56,189,248,${0.45 * pulse})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g;
          ctx.fillRect(-22 * k, -22 * k, 44 * k, 44 * k);
          ctx.beginPath();
          ctx.arc(0, 0, 12 * k, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'cargo': {
          for (let a = 0; a < 3; a++)
            for (let b = 0; b < 2; b++) {
              const x = (-14 + a * 10) * k;
              const y = (-11 + b * 12) * k;
              ctx.fillStyle = 'rgba(8,12,24,0.92)';
              ctx.fillRect(x, y, 8 * k, 9 * k);
              ctx.strokeRect(x, y, 8 * k, 9 * k);
              ctx.fillStyle = hexRgba(['#f59e0b', '#22d3ee', '#4ade80'][(a + b * 3 + i) % 3], 0.45);
              ctx.fillRect(x + 2 * k, y + 2 * k, 4 * k, 5 * k);
            }
          break;
        }
        case 'engine': {
          // Plumes first, behind the block.
          for (const y of [-10, 0, 10]) {
            const len = (60 + 18 * Math.sin(t * 9 + y)) * k;
            const g = ctx.createLinearGradient(-16 * k, 0, -16 * k - len, 0);
            g.addColorStop(0, 'rgba(224,242,254,0.85)');
            g.addColorStop(0.3, 'rgba(96,165,250,0.4)');
            g.addColorStop(1, 'rgba(96,165,250,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(-16 * k, (y - 3.5) * k);
            ctx.lineTo(-16 * k - len, y * k);
            ctx.lineTo(-16 * k, (y + 3.5) * k);
            ctx.closePath();
            ctx.fill();
          }
          ctx.fillStyle = 'rgba(8,12,24,0.92)';
          ctx.beginPath();
          ctx.rect(-12 * k, -16 * k, 24 * k, 32 * k);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          for (const y of [-10, 0, 10]) {
            ctx.moveTo(-12 * k, (y - 3) * k);
            ctx.lineTo(-17 * k, (y - 4.5) * k);
            ctx.lineTo(-17 * k, (y + 4.5) * k);
            ctx.lineTo(-12 * k, (y + 3) * k);
          }
          ctx.stroke();
          break;
        }
      }
    };

    return {
      update() {
        if (chatter <= 0 || api.t < next) return;
        next = api.t + (24 + api.rng() * 20) / chatter;
        const i = 1 + Math.floor(api.rng() * (ark.body.n - 2));
        const a = ark.at(i);
        const text = lines[Math.floor(api.rng() * lines.length)].replace('{n}', String(1 + Math.floor(api.rng() * 9)));
        api.say(text, a.x, a.y - 40 * ark.scale, HULL, { priority: 'low' });
      },
      draw(ctx, pass, frame) {
        if (pass === 'mid') {
          const ox = api.screenX(0);
          const b = ark.body;
          ctx.save();
          // The spine: a heavy line through every segment.
          ctx.strokeStyle = hexRgba(HULL, 0.35);
          ctx.lineWidth = 4 * ark.scale;
          ctx.beginPath();
          for (let i = 0; i < b.n; i++) {
            const x = b.seg[i * 2] + ox;
            const y = b.seg[i * 2 + 1];
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          // Segments from the tail forward, so the prow sits on top.
          for (let i = b.n - 1; i >= 0; i--) {
            const a = ark.at(i);
            ctx.save();
            ctx.translate(a.x + ox, a.y);
            ctx.rotate(a.ang);
            segment(ctx, ark.kinds[i], i, frame.time, ark.scale);
            ctx.restore();
          }
          ctx.restore();
        } else if (pass === 'hud' && p.counters !== false) {
          const text = `THE LAST FLEET · SOULS ${ark.souls.toLocaleString('en-US')} · BORN ${ark.born} · LOST ${ark.lost} · FUEL ${Math.round(ark.fuel * 100)}% · DAY ${(day0 + Math.floor(frame.time / 45)).toLocaleString('en-US')}`;
          ctx.save();
          ctx.font = '9px "Orbit", "Syne Mono", ui-monospace, monospace';
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          const w = ctx.measureText(text).width;
          ctx.fillStyle = hexRgba(api.host.palette.bg, 0.75);
          ctx.fillRect(10, api.height - 23, w + 8, 15);
          ctx.fillStyle = hexRgba(ark.fuel < 0.25 ? '#fca5a5' : HULL, 0.85);
          ctx.fillText(text, 14, api.height - 12);
          ctx.restore();
        }
      },
    };
  },
});

// ---- the flotilla ---------------------------------------------------------------------------

const CIV_COLORS = ['#cbd5e1', '#fde68a', '#93c5fd', '#a7f3d0'];

registerMechanic({
  id: 'flotilla',
  label: 'The flotilla',
  description: 'Hundreds of small civilian ships keep loose station around the ark. Stragglers fall behind and tugs go back for them; children are born aboard.',
  schema: {
    ships: { type: 'number', min: 40, max: 400, default: 220, step: 10, label: 'Ships' },
    stragglers: { type: 'number', min: 0, max: 4, default: 1, label: 'Stragglers per minute' },
  },
  create(api, p) {
    const ark = useArk(api);
    const noise = api.host.noise;
    /** `phase` 'wait': the straggler drifts back on its own for a while before the tug launches. */
    type Tow = { tug: Fleet | null; civ: Civ; phase: 'wait' | 'out' | 'tow' | 'home'; launchAt: number };
    const tows: Tow[] = [];
    let nextStraggler = api.t + 20 + api.rng() * 20;
    let nextBirth = api.t + 6 + api.rng() * 10;

    // Stations: a loose cloud around the ark, thicker near the habitats.
    const count = Math.round((Number(p.ships) || 220) * Math.max(0.4, Math.min(1, api.width / 1280)));
    for (let i = 0; i < count; i++) {
      const slot = Math.floor(api.rng() * ark.body.n);
      const side = api.rng() < 0.5 ? -1 : 1;
      const oy = side * (34 + api.rng() ** 1.6 * 170) * ark.scale;
      const ox = (api.rng() - 0.5) * 70 * ark.scale;
      const at = ark.station(slot, ox, oy);
      ark.civs.push({ x: at.x, y: at.y, vx: 0, vy: 0, slot, ox, oy, home: ox, kind: Math.floor(api.rng() * 4), name: `${NAMES[i % NAMES.length]} ${10 + i}`, crew: 20 + Math.floor(api.rng() * 400), state: 'flock' });
    }

    const straggle = () => {
      const pool = ark.civs.filter((c) => c.state === 'flock' && c.slot > ark.body.n / 2);
      if (!pool.length) return;
      const c = pool[Math.floor(api.rng() * pool.length)];
      c.state = 'straggling';
      const why = ['ENGINE FAILURE', 'NAV FAULT', 'FUEL LINE FROZEN', 'REACTOR SCRAM'][Math.floor(api.rng() * 4)];
      api.say(`STRAGGLER · ${c.name} · ${why}`, c.x, c.y - 14, '#fca5a5', { priority: 'high' });
      api.emit({ type: 'straggler', x: c.x, y: c.y, weight: 0.55, follow: () => (ark.civs.includes(c) ? { x: c.x, y: c.y } : null) });
      tows.push({ tug: null, civ: c, phase: 'wait', launchAt: api.t + 8 + api.rng() * 8 });
    };

    /** A tug goes back for a straggler from the tail of the ark. */
    const launchTug = (tow: Tow) => {
      const from = ark.at(ark.body.n - 2);
      const sp = SHIP_SPECS.freighter.speed * 1.4;
      tow.phase = 'out';
      tow.tug = api.spawnFleet(
        { x: from.x, y: from.y, vx: 0, vy: 0 },
        {
          cls: 'freighter',
          faction: 0,
          color: '#e2e8f0',
          tag: 'tug',
          callsign: `TUG ${1 + Math.floor(api.rng() * 9)}`,
          fadeIn: true,
          steer: (f, dt) => {
            const L = f.ships[0];
            if (tow.phase === 'home') {
              const h = ark.at(ark.body.n - 2);
              steerToward(L, h.x, h.y, sp, 1.2, dt, 30);
              if (Math.hypot(L.x - h.x, L.y - h.y) < 20) f.mode = 'gone';
            } else steerToward(L, tow.civ.x + 12, tow.civ.y, sp, 1.5, dt, 30);
          },
        },
      );
      api.say(`${tow.tug.callsign} · GOING BACK FOR ${tow.civ.name}`, from.x, from.y - 20 * ark.scale, '#e2e8f0', { priority: 'medium', followId: tow.tug.id });
    };

    return {
      update(dt) {
        const drift = 1;
        for (const c of ark.civs) {
          // Fall behind, or be towed back up, by sliding the station.
          if (c.state === 'straggling') {
            const at = ark.station(c.slot, c.ox, c.oy);
            if (api.screenX(at.x) > 50) c.ox -= dt * 16 * drift;
          } else if (c.state === 'towed') {
            c.ox = Math.min(c.home, c.ox + dt * 11);
            if (c.ox >= c.home) c.state = 'flock';
          }
          const at = ark.station(c.slot, c.ox, c.oy);
          const w = noise.noise2(c.home * 0.05 + api.t * 0.06, c.oy * 0.05) * 14;
          const tx = at.x + w;
          const ty = at.y + noise.noise2(c.oy * 0.05, api.t * 0.06 + c.home) * 10;
          const stiff = c.state === 'straggling' ? 0.4 : 0.9;
          c.vx += ((tx - c.x) * stiff - c.vx * 1.3) * dt;
          c.vy += ((ty - c.y) * stiff - c.vy * 1.3) * dt;
          c.x += c.vx * dt;
          c.y += c.vy * dt;
        }
        // Tugs: reach the straggler, then bring it home.
        for (let i = tows.length - 1; i >= 0; i--) {
          const tw = tows[i];
          if (tw.phase === 'wait') {
            if (!ark.civs.includes(tw.civ)) tows.splice(i, 1);
            else if (api.t >= tw.launchAt) launchTug(tw);
            continue;
          }
          const L = tw.tug?.ships[0];
          if (!tw.tug || !L || tw.tug.mode === 'gone') {
            tows.splice(i, 1);
            continue;
          }
          if (!ark.civs.includes(tw.civ) && tw.phase !== 'home') tw.phase = 'home';
          if (tw.phase === 'out' && Math.hypot(L.x - tw.civ.x, L.y - tw.civ.y) < 22) {
            tw.phase = 'tow';
            tw.civ.state = 'towed';
            api.say(`${tw.tug.callsign} HAS THEM · ${tw.civ.name}`, L.x, L.y - 14, '#e2e8f0', { priority: 'medium' });
            api.emit({ type: 'rescue', x: L.x, y: L.y, weight: 0.4 });
          }
          if (tw.phase === 'tow' && tw.civ.state === 'flock') {
            tw.phase = 'home';
            api.say(`${tw.civ.name} BACK IN FORMATION`, tw.civ.x, tw.civ.y - 14, HULL, { priority: 'low' });
          }
        }
        if (Number(p.stragglers ?? 1) > 0 && api.t >= nextStraggler) {
          if (tows.length < 2) straggle();
          nextStraggler = api.t + (60 / Number(p.stragglers ?? 1)) * (0.6 + api.rng() * 0.8);
        }
        // Life goes on aboard.
        if (api.t >= nextBirth) {
          nextBirth = api.t + 8 + api.rng() * 14;
          ark.born++;
          ark.souls++;
          const habs = ark.kinds.map((k, i) => (k === 'hab' ? i : -1)).filter((i) => i >= 0);
          const h = habs[Math.floor(api.rng() * habs.length)];
          const a = ark.at(h);
          api.say(`BIRTH ABOARD HABITAT ${h} · ${api.rng() < 0.5 ? 'A GIRL' : 'A BOY'}`, a.x, a.y - 36 * ark.scale, WINDOW, { priority: api.rng() < 0.25 ? 'medium' : 'low' });
          api.emit({ type: 'birth', x: a.x, y: a.y, weight: 0.25 });
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'mid') return;
        const ox = api.screenX(0);
        ctx.save();
        // Hulls as small chevrons pointing along the ark's course, batched by color.
        for (let kind = 0; kind < CIV_COLORS.length; kind++) {
          ctx.beginPath();
          for (const c of ark.civs) {
            if (c.kind !== kind) continue;
            const x = c.x + ox;
            if (x < -10 || x > api.width + 10) continue;
            const a = ark.at(c.slot).ang + Math.max(-0.5, Math.min(0.5, c.vy * 0.03));
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            ctx.moveTo(x + ca * 3.5, c.y + sa * 3.5);
            ctx.lineTo(x - ca * 2.5 - sa * 2, c.y - sa * 2.5 + ca * 2);
            ctx.lineTo(x - ca * 2.5 + sa * 2, c.y - sa * 2.5 - ca * 2);
            ctx.closePath();
          }
          ctx.fillStyle = hexRgba(CIV_COLORS[kind], 0.75);
          ctx.fill();
        }
        // Running lights on a few; stragglers blink red.
        for (const c of ark.civs) {
          const x = c.x + ox;
          if (c.state === 'straggling') {
            if (Math.sin(frame.time * 6) > 0) {
              ctx.fillStyle = '#f87171';
              ctx.fillRect(x - 1, c.y - 1, 3, 3);
            }
            continue;
          }
          if (c.crew % 7 === 0 && Math.sin(frame.time * 2 + c.crew) > 0.9) {
            ctx.fillStyle = c.crew % 2 ? '#4ade80' : '#f87171';
            ctx.fillRect(x, c.y, 1.5, 1.5);
          }
        }
        ctx.restore();
      },
    };
  },
});

// ---- pursuit --------------------------------------------------------------------------------

registerMechanic({
  id: 'pursuit',
  label: 'Pursuit',
  description: 'Contacts at the trailing edge: the pursuers jump in behind the fleet and go for stragglers and the ark\'s engines. Escorts peel off to meet them.',
  schema: {
    every: { type: 'number', min: 0.5, max: 6, default: 1.6, label: 'Minutes between attacks' },
  },
  create(api, p) {
    const ark = useArk(api);
    const combat = createCombat(api);
    type Attack = { pursuers: Fleet[]; escorts: Fleet[]; until: number; warnUntil: number; spawned: boolean; at: P; kills: number };
    let attack: Attack | null = null;
    let next = api.t + 45 + api.rng() * 30;
    const RED = '#f87171';
    const ESCORT = '#e2e8f0';

    const spawnPursuers = (a: Attack) => {
      const v = api.view();
      const sp = SHIP_SPECS.fighter.speed * 1.2;
      for (let g = 0; g < 2; g++) {
        const y = api.height * (0.25 + 0.5 * api.rng());
        const f = api.spawnFleet(
          { x: v.left + 40 + api.rng() * 40, y, vx: 60, vy: 0 },
          {
            cls: g === 0 ? 'cruiser' : 'fighter',
            wings: ['fighter', 'fighter'],
            faction: 2,
            color: RED,
            tag: 'pursuer',
            hostile: true,
            warpIn: true,
            steer: (fl, dt) => {
              const L = fl.ships[0];
              if (api.t > a.until) {
                steerToward(L, L.x - 300, L.y, sp * 1.2, 1.2, dt);
                return;
              }
              // Stragglers first; otherwise the engines.
              const prey = ark.civs.filter((c) => c.state !== 'flock').sort((c1, c2) => Math.hypot(c1.x - L.x, c1.y - L.y) - Math.hypot(c2.x - L.x, c2.y - L.y))[0];
              const t = prey ?? ark.at(ark.body.n - 1);
              steerToward(L, t.x - 30, t.y + (g ? 20 : -20), sp, 1.6, dt, 30);
            },
          },
        );
        a.pursuers.push(f);
      }
      // Escorts peel off the ark's flanks to meet them.
      for (const i of [3, 7]) {
        const s = ark.at(i);
        const f = api.spawnFleet(
          { x: s.x, y: s.y, vx: -30, vy: 0 },
          {
            cls: 'cruiser',
            wings: ['fighter', 'fighter'],
            faction: 1,
            color: ESCORT,
            tag: 'escort',
            fadeIn: true,
            steer: (fl, dt) => {
              const L = fl.ships[0];
              if (api.t > a.until) {
                const h = ark.at(i);
                steerToward(L, h.x, h.y, SHIP_SPECS.cruiser.speed * 1.5, 1.2, dt, 30);
                if (Math.hypot(L.x - h.x, L.y - h.y) < 20) fl.mode = 'gone';
                return;
              }
              const foe = a.pursuers.find((q) => q.ships[0]);
              if (foe) steerToward(L, foe.ships[0].x + 40, foe.ships[0].y, SHIP_SPECS.cruiser.speed * 1.6, 1.6, dt, 50);
            },
          },
        );
        a.escorts.push(f);
      }
      combat.engage(a.escorts, a.pursuers, { weaponA: 'mixed', weaponB: 'mixed', seconds: 30, colorA: ESCORT, colorB: RED });
      api.say('ESCORTS · BREAKING TO ENGAGE', ark.at(5).x, ark.at(5).y + 60 * ark.scale, ESCORT, { priority: 'medium' });
    };

    return {
      update(dt) {
        combat.update(dt);
        if (!attack) {
          if (api.t >= next) {
            const v = api.view();
            const n = 4 + Math.floor(api.rng() * 9);
            attack = { pursuers: [], escorts: [], warnUntil: api.t + 6, until: api.t + 40, spawned: false, at: { x: v.left + 60, y: api.height / 2 }, kills: 0 };
            api.say(`CONTACTS · TRAILING EDGE · ${n} SIGNATURES`, v.left + 140, api.height * 0.5, RED, { priority: 'high', duration: 5000 });
            api.emit({ type: 'pursuit', x: v.left + 60, y: api.height / 2, weight: 0.8, color: RED });
          }
          return;
        }
        const a = attack;
        if (!a.spawned && api.t >= a.warnUntil) {
          a.spawned = true;
          spawnPursuers(a);
        }
        // Pursuers catch what falls behind; the close flock is harder to pick off.
        for (const f of a.pursuers) {
          const L = f.ships[0];
          if (!L || api.t > a.until || a.kills >= 4) continue;
          for (let i = ark.civs.length - 1; i >= 0; i--) {
            const c = ark.civs[i];
            const chance = c.state === 'flock' ? 0.15 : 2;
            if (Math.hypot(c.x - L.x, c.y - L.y) > 26 || api.rng() > dt * chance) continue;
            a.kills++;
            api.fx.tracer(L.x, L.y, c.x, c.y, RED);
            api.fx.explode(c.x, c.y, CIV_COLORS[c.kind], 0.6);
            ark.civs.splice(i, 1);
            ark.lost += c.crew;
            ark.souls -= c.crew;
            api.say(`${c.name} LOST · ${c.crew} ABOARD`, c.x, c.y - 14, RED, { priority: 'high', duration: 5000 });
            api.emit({ type: 'lost', x: c.x, y: c.y, weight: 0.7, color: RED });
          }
          // At the engines: they strafe the ark.
          const e = ark.at(ark.body.n - 1);
          if (Math.hypot(L.x - e.x, L.y - e.y) < 70 && api.rng() < dt * 1.5) {
            api.fx.tracer(L.x, L.y, e.x + (api.rng() - 0.5) * 20, e.y + (api.rng() - 0.5) * 20, RED);
            api.fx.sparks(e.x, e.y, '#fdba74', 4, 40);
            if (api.rng() < 0.15) api.say('ARK · ENGINE SECTION TAKING FIRE', e.x, e.y - 30 * ark.scale, RED, { priority: 'medium' });
          }
        }
        if (api.t > a.until + 15) {
          for (const f of [...a.pursuers, ...a.escorts]) f.mode = 'gone';
          attack = null;
          next = api.t + (Number(p.every) || 1.6) * 60 * (0.7 + api.rng() * 0.6);
          api.say('TRAILING EDGE CLEAR', api.view().left + 140, api.height * 0.5, HULL, { priority: 'medium' });
        }
      },
      draw(ctx, pass, frame) {
        if (pass !== 'hud' || !attack || api.t > attack.until) return;
        // The trailing edge burns red while they are coming or here.
        const pulse = 0.5 + 0.5 * Math.sin(frame.time * 5);
        const g = ctx.createLinearGradient(0, 0, 90, 0);
        g.addColorStop(0, `rgba(248,113,113,${0.28 * pulse})`);
        g.addColorStop(1, 'rgba(248,113,113,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 90, api.height);
      },
    };
  },
});

// ---- skimming -------------------------------------------------------------------------------

type Giant = { x: number; y: number; r: number; bands: string[]; tilt: number };
const BANDS = [
  ['#e8cfa8', '#c79a6b', '#f1dfc0', '#a8774c', '#d9b48a'],
  ['#bae6fd', '#7dd3fc', '#e0f2fe', '#60a5fa', '#93c5fd'],
  ['#f5d0fe', '#d8b4fe', '#fae8ff', '#c084fc', '#e9d5ff'],
];

registerMechanic({
  id: 'skimming',
  label: 'Gas giant skimming',
  description: 'Gas giants drift past. Skimmers dive from the ark to the limb, skim fuel from the upper atmosphere, and bring it home.',
  schema: {
    every: { type: 'number', min: 0.5, max: 6, default: 2, label: 'Minutes between gas giants' },
  },
  create(api, p) {
    const ark = useArk(api);
    const giants: Giant[] = [];
    type Skim = { f: Fleet; g: Giant; phase: 'dive' | 'skim' | 'home'; ang: number; until: number };
    const skims: Skim[] = [];
    let nextGiant = api.t;
    let nextSkim = api.t + 8;
    let first = true;

    const addGiant = (x: number) => {
      const r = (140 + api.rng() * 90) * ark.scale;
      const low = api.rng() < 0.5;
      giants.push({ x, y: low ? api.height + r * 0.15 : -r * 0.15, r, bands: BANDS[Math.floor(api.rng() * BANDS.length)], tilt: (api.rng() - 0.5) * 0.4 });
    };

    return {
      update() {
        const v = api.view();
        if (api.t >= nextGiant) {
          nextGiant = api.t + (Number(p.every) || 2) * 60 * (0.7 + api.rng() * 0.6);
          // The first one is already in view; later ones come in from the right.
          addGiant(first ? v.left + api.width * 0.62 : v.right + 200);
          first = false;
        }
        for (let i = giants.length - 1; i >= 0; i--) if (giants[i].x + giants[i].r < v.left - 50) giants.splice(i, 1);
        const g = giants.find((gg) => gg.x > v.left + 120 && gg.x < v.right - 120);
        if (g && api.t >= nextSkim && skims.length < 2) {
          nextSkim = api.t + 14 + api.rng() * 10;
          const from = ark.at(4);
          const sp = SHIP_SPECS.freighter.speed * 1.6;
          const sk: Skim = { f: null as unknown as Fleet, g, phase: 'dive', ang: g.y > api.height / 2 ? -Math.PI / 2 - 0.6 : Math.PI / 2 + 0.6, until: 0 };
          sk.f = api.spawnFleet(
            { x: from.x, y: from.y, vx: 0, vy: 0 },
            {
              cls: 'freighter',
              faction: 0,
              color: '#fdba74',
              tag: 'skimmer',
              callsign: `SKIMMER ${1 + Math.floor(api.rng() * 6)}`,
              fadeIn: true,
              steer: (f, dt) => {
                const L = f.ships[0];
                if (sk.phase === 'dive') steerToward(L, sk.g.x + Math.cos(sk.ang) * (sk.g.r + 6), sk.g.y + Math.sin(sk.ang) * (sk.g.r + 6), sp, 1.5, dt, 30);
                else if (sk.phase === 'skim') steerOrbit(L, sk.g.x, sk.g.y, sk.g.r + 5, sp * 1.2, sk.g.y > api.height / 2 ? 1 : -1, 2.5, dt);
                else {
                  const h = ark.at(4);
                  steerToward(L, h.x, h.y, sp, 1.3, dt, 30);
                  if (Math.hypot(L.x - h.x, L.y - h.y) < 22) f.mode = 'gone';
                }
              },
            },
          );
          api.say(`${sk.f.callsign} · DIVING FOR FUEL`, from.x, from.y + 40 * ark.scale, '#fdba74', { priority: 'medium', followId: sk.f.id });
          api.emit({ type: 'skim', x: g.x, y: g.y, weight: 0.45, follow: api.follow(sk.f) });
          skims.push(sk);
        }
        for (let i = skims.length - 1; i >= 0; i--) {
          const sk = skims[i];
          const L = sk.f.ships[0];
          if (!L || sk.f.mode === 'gone') {
            skims.splice(i, 1);
            continue;
          }
          if (sk.phase === 'dive' && Math.hypot(L.x - (sk.g.x + Math.cos(sk.ang) * (sk.g.r + 6)), L.y - (sk.g.y + Math.sin(sk.ang) * (sk.g.r + 6))) < 20) {
            sk.phase = 'skim';
            sk.until = api.t + 5;
          }
          if (sk.phase === 'skim') {
            // The atmosphere glows where it cuts through.
            if (api.rng() < 0.6) api.fx.sparks(L.x, L.y, '#fdba74', 2, 20);
            if (api.t >= sk.until) {
              sk.phase = 'home';
              ark.fuel = Math.min(1, ark.fuel + 0.07);
              api.say(`FUEL SKIM COMPLETE · RESERVES ${Math.round(ark.fuel * 100)}%`, L.x, L.y - 14, '#fdba74', { priority: 'medium' });
            }
          }
        }
      },
      draw(ctx, pass) {
        if (pass !== 'under' || !giants.length) return;
        const ox = api.screenX(0);
        ctx.save();
        for (const g of giants) {
          const x = g.x + ox;
          if (x + g.r < -10 || x - g.r > api.width + 10) continue;
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, g.y, g.r, 0, Math.PI * 2);
          ctx.clip();
          // Bands, tilted.
          ctx.translate(x, g.y);
          ctx.rotate(g.tilt);
          const n = 11;
          for (let i = 0; i < n; i++) {
            const y0 = -g.r + (i / n) * g.r * 2;
            ctx.fillStyle = hexRgba(g.bands[i % g.bands.length], 0.55);
            ctx.fillRect(-g.r, y0, g.r * 2, (g.r * 2) / n + 1);
          }
          ctx.rotate(-g.tilt);
          // Night side: lit from the upper left.
          const shade = ctx.createLinearGradient(-g.r * 0.6, -g.r * 0.6, g.r, g.r);
          shade.addColorStop(0, 'rgba(0,0,0,0)');
          shade.addColorStop(0.55, 'rgba(2,6,23,0.35)');
          shade.addColorStop(1, 'rgba(2,6,23,0.92)');
          ctx.fillStyle = shade;
          ctx.fillRect(-g.r, -g.r, g.r * 2, g.r * 2);
          ctx.restore();
          // A thin atmosphere at the limb.
          ctx.strokeStyle = hexRgba(g.bands[0], 0.35);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, g.y, g.r + 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      },
    };
  },
});
