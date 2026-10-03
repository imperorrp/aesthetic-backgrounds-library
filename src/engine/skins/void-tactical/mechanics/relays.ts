/**
 * Relays: the map's message network, made visible. Relays, docks, defenses, gates, and
 * systems are nodes; each links to its nearest few. When something is said on the map, a
 * pulse of light carries it hop by hop from the nearest node to the network's hub. When
 * something goes wrong (a raid, a ship lost, a scramble), the nearest node sends a
 * distress call, and the alarm ripples outward ring by ring.
 *
 * `useNetwork(api)` gives other mechanics the same network to send their own signals.
 */
import { createNetwork, drawSignals, type Network } from '../../../sim/signals';
import { allStructures } from '../fleets';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, type MechanicApi } from './types';

const NODE_ROLES = new Set(['relay', 'dock', 'defense', 'gate', 'shipyard']);

/** The world's signal network, kept in step with what is on the map (main plane only). */
export function useNetwork(api: MechanicApi): Network {
  return api.use('network', () => {
    const net = createNetwork();
    let next = 0;
    api.onUpdate((dt) => {
      if (api.t >= next) {
        next = api.t + 1;
        const nodes = [
          ...allStructures(api.world).filter((s) => !s.z && NODE_ROLES.has(s.role) && api.onScreen(s.x, s.y, -400)).map((s) => ({ id: s.id, x: s.x, y: s.y })),
          ...api.world.systems.filter((s) => !s.z && api.onScreen(s.x, s.y, -400)).map((s) => ({ id: s.id, x: s.x, y: s.y })),
        ];
        net.setNodes(nodes, 680, 3);
      }
      net.update(dt, api.t);
    });
    return net;
  });
}

registerMechanic({
  id: 'relays',
  label: 'Signal relays',
  description: 'Messages travel the relay network as pulses of light; distress calls ripple outward from the nearest relay.',
  schema: {
    chatter: { type: 'number', min: 0, max: 1, default: 0.6, label: 'Share of messages you see travel' },
    distress: { type: 'boolean', default: true, label: 'Distress calls' },
    links: { type: 'boolean', default: true, label: 'Show relay links' },
  },
  create(api, p) {
    const net = useNetwork(api);
    let nextPacket = 0;
    let nextDistress = 0;
    const accent = api.host.palette.accent;

    /** The hub: the best-connected relay (or node) on the map. */
    const hub = () => {
      let best: string | undefined;
      let deg = -1;
      const count = new Map<string, number>();
      for (const [a, b] of net.links) {
        count.set(a, (count.get(a) ?? 0) + 1);
        count.set(b, (count.get(b) ?? 0) + 1);
      }
      const relays = new Set(allStructures(api.world).filter((s) => s.role === 'relay').map((s) => s.id));
      for (const [id, n] of count) {
        const score = n + (relays.has(id) ? 2 : 0);
        if (score > deg) {
          deg = score;
          best = id;
        }
      }
      return best;
    };

    api.bus.on('say', (e) => {
      if (e.x === undefined || e.y === undefined || e.priority === 'low' || api.t < nextPacket) return;
      if (api.rng() > (Number(p.chatter) ?? 0.6)) return;
      const from = net.nearest(e.x, e.y, 520);
      const to = hub();
      if (!from || !to || from.id === to) return;
      if (net.send(from.id, to, { color: typeof e.color === 'string' && e.color.startsWith('#') ? e.color : accent, kind: 'chatter', speed: 320 })) nextPacket = api.t + 0.8;
    });

    const distress = (e: { x?: number; y?: number }) => {
      if (p.distress === false || e.x === undefined || e.y === undefined || api.t < nextDistress) return;
      const from = net.nearest(e.x, e.y, 600);
      if (!from) return;
      if (net.broadcast(from.id, { color: '#f87171', kind: 'distress', hopTime: 0.4 })) {
        nextDistress = api.t + 6;
        api.say('DISTRESS · RELAYED', from.x, from.y - 22, '#f87171', { priority: 'medium', duration: 2600 });
        api.emit({ type: 'distress', x: from.x, y: from.y, weight: 0.4 });
      }
    };
    for (const type of ['raid', 'lost', 'scramble']) api.bus.on(type, distress);

    return {
      draw(ctx, pass, frame) {
        if (pass === 'under' && p.links !== false) {
          // Links that touch a relay: thin dotted lines, so the network reads as infrastructure.
          const relays = new Set(allStructures(api.world).filter((s) => s.role === 'relay').map((s) => s.id));
          ctx.strokeStyle = hexRgba(accent, 0.16);
          ctx.lineWidth = 1;
          ctx.setLineDash([1, 5]);
          ctx.beginPath();
          for (const [a, b] of net.links) {
            if (!relays.has(a) && !relays.has(b)) continue;
            const na = net.nodes.get(a)!;
            const nb = net.nodes.get(b)!;
            ctx.moveTo(api.screenX(na.x), na.y);
            ctx.lineTo(api.screenX(nb.x), nb.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (pass === 'over') {
          drawSignals(ctx, net, (x, y) => [api.screenX(x), y], frame.time, hexRgba);
          // A node that just passed a message on blinks.
          for (const [id, at] of net.blinks) {
            const age = frame.time - at;
            if (age > 0.6) continue;
            const n = net.nodes.get(id);
            if (!n) continue;
            ctx.strokeStyle = hexRgba('#ffffff', 0.6 * (1 - age / 0.6));
            ctx.beginPath();
            ctx.arc(api.screenX(n.x), n.y, 5 + age * 10, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      },
    };
  },
});
