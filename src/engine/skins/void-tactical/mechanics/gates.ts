/**
 * Gate traffic: gates work in pairs joined by a faint throat, so a jump at one comes out
 * at the other and you can watch the pulse cross between them. A gate takes one ship at
 * a time: the rest wait in holding loops around it. Each ship in turn is scanned for the
 * toll; most are cleared and jump, and now and then one refuses and is turned away.
 */
import type { Fleet, Structure } from '../types';
import { SHIP_SPECS } from '../ships';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, steerOrbit } from './types';

registerMechanic({
  id: 'gates',
  label: 'Gate traffic',
  description: 'Gates link in pairs with a visible throat; ships queue in holding loops, get scanned for the toll, and sometimes refuse.',
  schema: {
    spacing: { type: 'number', min: 1, max: 10, default: 4, label: 'Seconds between jumps' },
    disputes: { type: 'number', min: 0, max: 0.6, default: 0.15, label: 'Share of toll disputes' },
    throat: { type: 'boolean', default: true, label: 'Draw the throat between paired gates' },
  },
  create(api, p) {
    const spacing = Number(p.spacing) || 4;
    const lastJump = new Map<string, number>();
    const queues = new Map<string, Fleet[]>();
    /** The ship being scanned at each gate, and when the scan ends. */
    const scanning = new Map<string, { f: Fleet; until: number }>();
    let nextPair = 0;

    const gatesNow = () => api.structures().filter((s) => s.role === 'gate' && !s.z && api.onScreen(s.x, s.y, 500));
    const find = (id: string | undefined) => (id ? api.structures().find((s) => s.id === id) : undefined);

    /** Pair each gate with its nearest unpaired neighbour. */
    const pair = () => {
      const gates = gatesNow();
      const ids = new Set(gates.map((g) => g.id));
      for (const g of gates) if (g.pairId && !ids.has(g.pairId)) g.pairId = undefined;
      for (const g of gates) {
        if (g.pairId) continue;
        const other = gates
          .filter((o) => o !== g && !o.pairId)
          .sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
        if (!other) continue;
        g.pairId = other.id;
        other.pairId = g.id;
      }
    };

    api.bus.on('jump', (e) => {
      if (typeof e.at === 'string') lastJump.set(e.at, api.t);
    });

    /** A loop around the gate, a little farther out for each ship in the queue. */
    const hold = (g: Structure, f: Fleet) => (fl: Fleet, dt: number) => {
      const i = Math.max(0, (queues.get(g.id) ?? []).indexOf(f));
      steerOrbit(fl.ships[0], g.x, g.y, 52 + i * 16, SHIP_SPECS[fl.cls].speed * 0.45, i % 2 ? 1 : -1, 2, dt);
    };

    return {
      update() {
        if (api.t >= nextPair) {
          pair();
          nextPair = api.t + 2;
        }
        // Ships arriving at a busy gate join its queue and circle.
        for (const f of api.world.fleets) {
          if (f.steer || f.mode !== 'transit' || f.target?.role !== 'gate' || !f.target.id || f.z > 0.1 || !f.ships[0]) continue;
          const g = find(f.target.id);
          if (!g) continue;
          const L = f.ships[0];
          if (Math.hypot(L.x - g.x, L.y - g.y) > 150) continue;
          const q = queues.get(g.id) ?? [];
          const busy = api.t - (lastJump.get(g.id) ?? -99) < spacing || q.length > 0 || scanning.has(g.id);
          if (!busy) {
            // Free: it goes straight through, after a quick scan.
            scanning.set(g.id, { f, until: api.t + 0.9 });
            f.steer = hold(g, f);
            continue;
          }
          q.push(f);
          queues.set(g.id, q);
          f.steer = hold(g, f);
          if (q.length === 2) api.say(`${g.label} · HOLDING · ${q.length} IN QUEUE`, g.x, g.y + 24, g.color ?? '#818cf8', { priority: 'low' });
        }
        // Each gate: finish a scan, then take the next ship when the gate has cooled.
        for (const g of gatesNow()) {
          const q = (queues.get(g.id) ?? []).filter((f) => f.mode !== 'gone' && f.ships.length > 0);
          queues.set(g.id, q);
          const sc = scanning.get(g.id);
          if (sc) {
            if (sc.f.mode === 'gone' || !sc.f.ships.length) scanning.delete(g.id);
            else if (api.t >= sc.until) {
              scanning.delete(g.id);
              const L = sc.f.ships[0];
              if (api.rng() < (Number(p.disputes) || 0)) {
                g.flashAt = api.t;
                api.fx.tracer(g.x, g.y, L.x + (api.rng() - 0.5) * 40, L.y + (api.rng() - 0.5) * 40, '#f87171');
                api.say(`TOLL DISPUTE · ${sc.f.callsign} TURNED AWAY`, g.x, g.y + 24, '#f87171', { priority: 'medium' });
                api.emit({ type: 'dispute', x: g.x, y: g.y, weight: 0.45 });
                sc.f.maxVisits = 0; // it leaves the sector
                api.release(sc.f);
              } else {
                api.say(`${sc.f.callsign} · TOLL CLEARED`, L.x, L.y, g.color ?? '#818cf8', { priority: 'low', followId: sc.f.id, duration: 2400 });
                api.goTo(sc.f, g);
              }
              lastJump.set(g.id, api.t);
            }
            continue;
          }
          if (q.length && api.t - (lastJump.get(g.id) ?? -99) >= spacing) {
            const f = q.shift()!;
            scanning.set(g.id, { f, until: api.t + 1.1 });
            api.fx.beam(() => ({ x: g.x, y: g.y }), () => (f.ships[0] ? { x: f.ships[0].x, y: f.ships[0].y } : null), g.color ?? '#818cf8', 1.1, 1);
          }
        }
      },
      draw(ctx, pass, frame) {
        const t = frame.time;
        if (pass === 'under' && p.throat !== false) {
          // The throat: a faint bowed line between partners, with flow along it, and a
          // bright pulse crossing after each jump.
          const seen = new Set<string>();
          ctx.lineWidth = 1;
          for (const g of gatesNow()) {
            const o = find(g.pairId);
            if (!o || seen.has(o.id)) continue;
            seen.add(g.id);
            const ax = api.screenX(g.x);
            const bx = api.screenX(o.x);
            const mx = (ax + bx) / 2 - (o.y - g.y) * 0.18;
            const my = (g.y + o.y) / 2 + (bx - ax) * 0.18;
            const color = g.color ?? '#818cf8';
            ctx.strokeStyle = hexRgba(color, 0.14);
            ctx.setLineDash([2, 7]);
            ctx.lineDashOffset = -t * 14;
            ctx.beginPath();
            ctx.moveTo(ax, g.y);
            ctx.quadraticCurveTo(mx, my, bx, o.y);
            ctx.stroke();
            ctx.setLineDash([]);
            for (const [from, sign] of [[g, 1], [o, -1]] as const) {
              const age = t - (lastJump.get(from.id) ?? -99);
              if (age < 0 || age > 0.9) continue;
              const k = sign > 0 ? age / 0.9 : 1 - age / 0.9;
              const px = (1 - k) * (1 - k) * ax + 2 * (1 - k) * k * mx + k * k * bx;
              const py = (1 - k) * (1 - k) * g.y + 2 * (1 - k) * k * my + k * k * o.y;
              ctx.fillStyle = hexRgba('#ffffff', 0.9 * (1 - age / 0.9));
              ctx.beginPath();
              ctx.arc(px, py, 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (pass === 'mid') {
          // Holding loops: a dashed ring for each ship waiting.
          for (const g of gatesNow()) {
            const q = queues.get(g.id);
            if (!q?.length) continue;
            ctx.strokeStyle = hexRgba(g.color ?? '#818cf8', 0.22);
            ctx.setLineDash([3, 5]);
            for (let i = 0; i < q.length; i++) {
              ctx.beginPath();
              ctx.arc(api.screenX(g.x), g.y, 52 + i * 16, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.setLineDash([]);
          }
        }
      },
    };
  },
});
