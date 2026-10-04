/**
 * The net: a wireframe overlay of nodes on the buildings, linked to their nearest
 * neighbours, carrying light (sim/signals.ts). Most of the time it hums with traffic.
 * Then a netrunner jacks in:
 *
 *   jack in   a runner in an apartment opens a trace to a corp data fortress
 *   trace     packets run hop by hop along the path; the path lights up
 *   ICE       at the fortress the ICE wakes (a ring of glyphs, amber then red) and fires
 *             counter-traces back down the path; the tower glitches
 *   then      BREACH: data streams home, the tower's ads are hijacked, and sometimes the
 *             district's grid fails, block by block, and comes back the same way
 *             FLATLINE: the counter-trace reaches the runner; the police are sent
 *
 * Node positions are screen positions, refreshed every frame from their buildings (each
 * on its own parallax layer); links are rebuilt only when buildings stream in or out.
 */
import type { Rng } from '../../rng';
import { createNetwork, drawSignals, type SignalNode } from '../../sim/signals';
import { hash, hexA } from '../instruments/kit';
import { ADS, type Building, type City } from './world';
import type { Life } from './life';

type Kind = 'apt' | 'relay' | 'core';
type Node = SignalNode & { kind: Kind; b: Building; ox: number; oy: number };
type Run = { runner: Node; core: Node; handle: string; ice: string; path: string[]; phase: 'trace' | 'ice' | 'done'; until: number; nextCounter: number };

const HANDLES = ['GHOSTWIRE', 'NULLKID', 'VANTA', 'MOTH', 'ROOK', 'LACE', 'HALCYON', 'STATIC', 'PALEFIRE', 'KESTREL', 'SPLICE', 'OKUBO'];
const ICE = ['BLACK ICE', 'HELLHOUND', 'GLASS WALL', 'TAR PIT', 'KRAKEN', 'WIDOW', 'ASP'];
const HIJACK = ['WE SEE YOU', 'YOUR DATA IS FREE', 'NOTHING IS SECURE', 'WAKE UP', 'THE CITY IS OURS'];
const CYAN = '#22d3ee';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const MAGENTA = '#f472b6';

export type NetOptions = { rate: number; overlay: boolean };

export type Net = {
  update(dt: number, streamed: boolean): void;
  draw(ctx: CanvasRenderingContext2D, level: number): void;
  readonly load: number;
  counts(): Record<string, number>;
};

export function createNet(city: City, rng: Rng, life: Life, o: NetOptions): Net {
  const net = createNetwork();
  const nodes = new Map<string, Node>();
  const runs: Run[] = [];
  let next = 10 + rng() * 8;
  let nextChatter = 1;
  let load = 0.3;

  /** Where a node sits on its building, in screen space. */
  const place = (n: Node) => {
    n.x = city.sx(n.b.layer, n.b.x + n.ox);
    n.y = city.baseY(n.b.layer) - n.b.h + n.oy;
  };

  /** Which buildings carry nodes, and where. */
  const rebuild = () => {
    nodes.clear();
    for (const L of [1, 2]) {
      for (const b of city.visible[L]) {
        if (b.corp) nodes.set(`core:${b.id}`, { id: `core:${b.id}`, kind: 'core', b, ox: b.w / 2, oy: -16, x: 0, y: 0 });
        else if (b.roof === 'antenna' && b.masts.length && hash(b.seed, 3) < 0.7) nodes.set(`relay:${b.id}`, { id: `relay:${b.id}`, kind: 'relay', b, ox: b.masts[0][0], oy: -b.masts[0][1], x: 0, y: 0 });
        if (!b.corp && hash(b.seed, 5) < (L === 2 ? 0.55 : 0.3)) {
          const oy = b.h * (0.25 + hash(b.seed, 6) * 0.5);
          nodes.set(`apt:${b.id}`, { id: `apt:${b.id}`, kind: 'apt', b, ox: b.w * (0.25 + hash(b.seed, 7) * 0.5), oy, x: 0, y: 0 });
        }
      }
    }
    for (const n of nodes.values()) place(n);
    net.setNodes([...nodes.values()], 420, 4);
    // Runs whose ends scrolled away are over.
    for (const r of runs) if (!nodes.has(r.runner.id) || !nodes.has(r.core.id)) r.phase = 'done';
  };

  const onScreen = (n: Node, margin = 40) => n.x > margin && n.x < city.W - margin && n.y > 20;

  /** Start a run if there is a fortress and a runner far enough from it, joined by the net. */
  const begin = (): boolean => {
    const cores = [...nodes.values()].filter((n) => n.kind === 'core' && onScreen(n, 80));
    if (!cores.length) return false;
    const core = cores[Math.floor(rng() * cores.length)];
    const apts = [...nodes.values()].filter((n) => n.kind === 'apt' && onScreen(n, 60) && Math.hypot(n.x - core.x, n.y - core.y) > 220);
    if (!apts.length) return false;
    const runner = apts[Math.floor(rng() * apts.length)];
    const path = net.route(runner.id, core.id);
    if (!path || path.length < 3) return false;
    const run: Run = { runner, core, handle: HANDLES[Math.floor(rng() * HANDLES.length)], ice: ICE[Math.floor(rng() * ICE.length)], path, phase: 'trace', until: 0, nextCounter: 0 };
    runs.push(run);
    city.say(`${run.handle}@${runner.id.split(':')[1]} :: JACK IN → ${core.b.corp}`, runner.b, runner.ox, runner.oy - 8, CYAN, { priority: 'medium' });
    city.emit('jackin', runner.x, runner.y, 0.5, { color: CYAN });
    // The trace: a train of packets down the path; the first to arrive wakes the ICE.
    for (let i = 0; i < 4; i++) {
      const p = net.send(runner.id, core.id, { color: CYAN, kind: 'run', speed: 150 - i * 12 });
      if (p && i === 0)
        p.onArrive = () => {
          if (run.phase !== 'trace') return;
          run.phase = 'ice';
          run.until = city.t + 5 + rng() * 3;
          core.b.glitchUntil = run.until;
          city.say(`ICE · ${run.ice} · ENGAGED`, core.b, core.ox, core.oy - 10, AMBER, { priority: 'high' });
          city.emit('ice', core.x, core.y, 0.6, { color: AMBER });
        };
    }
    return true;
  };

  /** A district's grid fails outward from a point, block by block, and returns the same way. */
  const outage = (x0: number, y0: number) => {
    const t = city.t;
    for (const L of [1, 2]) {
      for (const b of city.visible[L]) {
        const bx = city.sx(L, b.x + b.w / 2);
        const d = Math.hypot(bx - x0, (city.baseY(L) - b.h / 2 - y0) * 0.5);
        if (d > 560) continue;
        b.darkAt = t + 0.4 + d / 320;
        b.restoreAt = b.darkAt + 14 + rng() * 8 + d / 400;
      }
    }
    const district = Math.floor(city.cam / 1500) % 9;
    city.say(`GRID FAILURE · DISTRICT ${district + 1}`, null, 0, 0, RED, { priority: 'high' });
    city.emit('outage', x0, y0, 0.75, { color: RED });
  };

  const resolve = (r: Run) => {
    r.phase = 'done';
    const core = r.core;
    if (rng() < 0.58) {
      const tb = (2 + rng() * 40).toFixed(1);
      city.say(`BREACH · ${core.b.corp} · ${tb} TB EXFIL`, core.b, core.ox, core.oy - 10, MAGENTA, { priority: 'high' });
      city.emit('breach', core.x, core.y, 0.85, { color: MAGENTA });
      core.b.glitchUntil = city.t + 3;
      core.b.hijacked = HIJACK[Math.floor(rng() * HIJACK.length)];
      core.b.hijackUntil = city.t + 30;
      for (let i = 0; i < 8; i++) net.send(core.id, r.runner.id, { color: MAGENTA, kind: 'data', speed: 120 + i * 14 });
      if (rng() < 0.5) outage(core.x, core.y);
    } else {
      city.say(`RUNNER FLATLINED · ${r.handle}`, r.runner.b, r.runner.ox, r.runner.oy - 8, RED, { priority: 'high' });
      city.emit('flatline', r.runner.x, r.runner.y, 0.8, { color: RED });
      net.broadcast(core.id, { color: RED, kind: 'trace', hopTime: 0.25 });
      r.runner.b.glitchUntil = city.t + 1.5;
      life.dispatch(r.runner.b, r.runner.ox, r.runner.oy);
      city.say('PRECINCT 9 · UNITS EN ROUTE', r.runner.b, r.runner.ox, r.runner.oy - 24, '#60a5fa', { priority: 'medium' });
      city.emit('police', r.runner.x, r.runner.y, 0.6, { color: '#60a5fa' });
    }
  };

  return {
    get load() {
      return load;
    },
    update(dt, streamed) {
      if (streamed || nodes.size === 0) rebuild();
      for (const n of nodes.values()) place(n);
      const t = city.t;
      // Background hum: packets between random neighbours.
      if (t >= nextChatter && nodes.size > 4) {
        nextChatter = t + 0.6 + rng() * 1.4;
        const list = [...nodes.values()];
        const a = list[Math.floor(rng() * list.length)];
        const b = list[Math.floor(rng() * list.length)];
        if (a !== b) net.send(a.id, b.id, { color: '#0e7490', kind: 'traffic', speed: 180 });
      }
      if (o.rate > 0 && t >= next) {
        const busy = runs.some((r) => r.phase !== 'done');
        // No fortress in reach right now: look again in a few seconds.
        next = !busy && !begin() ? t + 4 : t + (60 / o.rate) * (0.6 + rng() * 0.8);
      }
      for (let i = runs.length - 1; i >= 0; i--) {
        const r = runs[i];
        if (r.phase === 'done') {
          runs.splice(i, 1);
          continue;
        }
        if (r.phase === 'ice') {
          if (t >= r.nextCounter) {
            r.nextCounter = t + 0.45;
            net.send(r.core.id, r.runner.id, { color: RED, kind: 'ice', speed: 210 });
          }
          if (t >= r.until) resolve(r);
        }
      }
      net.update(dt, t);
      load += ((Math.min(1, net.packets.length / 30) + (runs.length ? 0.3 : 0)) - load) * Math.min(1, dt * 0.8);
      // Outages and hijacks run their course.
      for (const L of [1, 2])
        for (const b of city.visible[L]) {
          const target = t >= b.darkAt && t < b.restoreAt ? 1 : 0;
          b.dark += (target - b.dark) * Math.min(1, dt * 5);
          if (t >= b.restoreAt) {
            b.darkAt = Infinity;
            b.restoreAt = Infinity;
          }
          if (b.hijacked && t > b.hijackUntil) b.hijacked = null;
        }
    },
    draw(ctx, level) {
      const t = city.t;
      ctx.save();
      const live = runs.filter((r) => r.phase !== 'done');
      const onPath = new Set<string>();
      for (const r of live) for (let i = 0; i < r.path.length - 1; i++) onPath.add(`${r.path[i]}|${r.path[i + 1]}`);
      if (o.overlay) {
        // The grid, faint; a live run's path, bright and moving.
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexA(CYAN, 0.1 * level);
        ctx.beginPath();
        for (const [a, b] of net.links) {
          if (onPath.has(`${a}|${b}`) || onPath.has(`${b}|${a}`)) continue;
          const A = nodes.get(a);
          const B = nodes.get(b);
          if (!A || !B) continue;
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
        }
        ctx.stroke();
        for (const r of live) {
          ctx.strokeStyle = hexA(r.phase === 'ice' ? AMBER : CYAN, 0.85 * level);
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -t * 30;
          ctx.beginPath();
          r.path.forEach((id, i) => {
            const n = nodes.get(id);
            if (!n) return;
            if (i === 0) ctx.moveTo(n.x, n.y);
            else ctx.lineTo(n.x, n.y);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
        drawSignals(ctx, net, (x, y) => [x, y], t, (hex, a) => hexA(hex, a * level));
        // Nodes.
        for (const n of nodes.values()) {
          if (n.x < -20 || n.x > city.W + 20) continue;
          if (n.kind === 'core') continue;
          const blink = t - (net.blinks.get(n.id) ?? -9) < 0.4;
          ctx.fillStyle = hexA(n.kind === 'apt' ? CYAN : '#a78bfa', (blink ? 0.9 : 0.4) * level);
          ctx.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 1, n.kind === 'relay' ? 3 : 2, n.kind === 'relay' ? 3 : 2);
        }
      }
      // ICE rings at the fortresses: quiet cyan glyphs, or amber and red, spinning hard.
      ctx.font = '8px "Syne Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const n of nodes.values()) {
        if (n.kind !== 'core' || n.x < -40 || n.x > city.W + 40) continue;
        const run = live.find((r) => r.core === n && r.phase === 'ice');
        const hot = !!run;
        const pulse = hot ? 0.5 + 0.5 * Math.sin(t * 14) : 0;
        const color = hot ? (pulse > 0.5 ? RED : AMBER) : CYAN;
        const r = 15 + pulse * 3;
        ctx.strokeStyle = hexA(color, (hot ? 0.8 : 0.28) * level);
        ctx.lineWidth = hot ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();
        const spin = t * (hot ? 3 : 0.4);
        ctx.fillStyle = hexA(color, (hot ? 0.9 : 0.4) * level);
        for (let k = 0; k < 8; k++) {
          const a = spin + (k / 8) * Math.PI * 2;
          ctx.fillText('#%&@$*+='[(k + Math.floor(t * (hot ? 10 : 1))) % 8], n.x + Math.cos(a) * (r + 6), n.y + Math.sin(a) * (r + 6));
        }
        if (hot && run) {
          // The runner's end glows while they are in.
          const R = run.runner;
          ctx.strokeStyle = hexA(CYAN, 0.7 * level);
          ctx.beginPath();
          ctx.arc(R.x, R.y, 5 + 2 * Math.sin(t * 9), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
    counts: () => ({ nodes: nodes.size, cores: [...nodes.values()].filter((n) => n.kind === 'core').length, packets: net.packets.length, runs: runs.length }),
  };
}

/** The ad a tower shows now: its slogan, a hijacker's, or a corp's name. */
export function adText(b: Building, t: number): string {
  if (b.hijacked) return b.hijacked;
  if (b.corp) return b.corp;
  if (!b.ad) return '';
  // Rotate through slogans every few seconds, offset per building.
  const k = Math.floor(t / 7 + (b.seed % 7));
  return k % 3 === 0 ? b.ad.text : ADS[(b.seed + k) % ADS.length];
}
