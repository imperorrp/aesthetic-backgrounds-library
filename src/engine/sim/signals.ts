/**
 * Signals: a network of nodes and links that carries visible packets.
 *
 * Nodes are places that relay (relays, stations, servers); links join each node to its
 * nearest neighbours in range, plus any explicit ones. `send` routes a packet hop by hop
 * along the shortest path; `broadcast` lights the network outward in rings from one
 * node (a distress call, an alarm, a song spreading). The domain decides what a node is
 * and what a packet means; this module only moves light along lines.
 *
 *   const net = createNetwork();
 *   net.setNodes(relays, 700, 3);                 // rebuild links: k nearest within 700
 *   net.send('relay-2', 'dock-9', { color, kind: 'chatter', onArrive })
 *   net.broadcast('relay-2', { color: '#f87171', kind: 'distress' })
 *   net.update(dt)                                // returns hops and arrivals this frame
 *   drawSignals(ctx, net, (x, y) => [sx, sy], t)  // packets, tails, blinking nodes
 */

export type SignalNode = { id: string; x: number; y: number };

export type Packet = {
  path: string[];
  /** Index of the link being travelled (path[hop] → path[hop + 1]). */
  hop: number;
  /** 0..1 along the current link. */
  s: number;
  /** Speed in world units per second. */
  speed: number;
  color: string;
  kind: string;
  onArrive?: () => void;
  done: boolean;
};

export type Wave = { from: string; t0: number; color: string; kind: string; depth: Map<string, number>; hopTime: number };

export type SendOptions = { color: string; kind?: string; speed?: number; onArrive?: () => void };

export type Network = {
  /** Replace the node set and rebuild automatic links (k nearest within `range`). */
  setNodes(nodes: SignalNode[], range: number, k: number): void;
  /** Add a link that survives `setNodes` while both ends exist. */
  link(a: string, b: string): void;
  readonly nodes: ReadonlyMap<string, SignalNode>;
  readonly links: readonly [string, string][];
  nearest(x: number, y: number, maxDist?: number): SignalNode | undefined;
  /** Shortest hop path (BFS), or null when unreachable. */
  route(from: string, to: string): string[] | null;
  send(from: string, to: string, opts: SendOptions): Packet | null;
  broadcast(from: string, opts: { color: string; kind?: string; hopTime?: number }): Wave | null;
  /** Advance packets and waves; returns what happened this step. */
  update(dt: number, t: number): { hops: { node: string; packet: Packet }[]; arrivals: Packet[] };
  readonly packets: readonly Packet[];
  readonly waves: readonly Wave[];
  /** When each node last blinked (a packet passed or a wave reached it). */
  readonly blinks: ReadonlyMap<string, number>;
};

export function createNetwork(): Network {
  const nodes = new Map<string, SignalNode>();
  let links: [string, string][] = [];
  const explicit: [string, string][] = [];
  const adj = new Map<string, string[]>();
  const packets: Packet[] = [];
  const waves: Wave[] = [];
  const blinks = new Map<string, number>();
  let now = 0;

  const rebuildAdjacency = () => {
    adj.clear();
    for (const [a, b] of links) {
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    }
  };

  const net: Network = {
    nodes,
    get links() {
      return links;
    },
    packets,
    waves,
    blinks,
    setNodes(list, range, k) {
      nodes.clear();
      for (const n of list) nodes.set(n.id, n);
      const seen = new Set<string>();
      links = [];
      const add = (a: string, b: string) => {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (a === b || seen.has(key)) return;
        seen.add(key);
        links.push([a, b]);
      };
      for (const n of list) {
        const near = list
          .filter((m) => m !== n)
          .map((m) => ({ m, d: Math.hypot(m.x - n.x, m.y - n.y) }))
          .filter((e) => e.d <= range)
          .sort((a, b) => a.d - b.d)
          .slice(0, k);
        for (const { m } of near) add(n.id, m.id);
      }
      for (const [a, b] of explicit) if (nodes.has(a) && nodes.has(b)) add(a, b);
      rebuildAdjacency();
      // Packets whose road disappeared are dropped.
      for (const p of packets) if (p.path.some((id) => !nodes.has(id))) p.done = true;
    },
    link(a, b) {
      explicit.push([a, b]);
      if (nodes.has(a) && nodes.has(b)) {
        links.push([a, b]);
        rebuildAdjacency();
      }
    },
    nearest(x, y, maxDist = Infinity) {
      let best: SignalNode | undefined;
      let bd = maxDist;
      for (const n of nodes.values()) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      return best;
    },
    route(from, to) {
      if (!nodes.has(from) || !nodes.has(to)) return null;
      if (from === to) return [from];
      const prev = new Map<string, string>([[from, from]]);
      const queue = [from];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const nx of adj.get(cur) ?? []) {
          if (prev.has(nx)) continue;
          prev.set(nx, cur);
          if (nx === to) {
            const path = [to];
            let c = to;
            while (c !== from) path.unshift((c = prev.get(c)!));
            return path;
          }
          queue.push(nx);
        }
      }
      return null;
    },
    send(from, to, o) {
      const path = net.route(from, to);
      if (!path || path.length < 2) return null;
      const p: Packet = { path, hop: 0, s: 0, speed: o.speed ?? 260, color: o.color, kind: o.kind ?? 'signal', onArrive: o.onArrive, done: false };
      packets.push(p);
      blinks.set(from, now);
      return p;
    },
    broadcast(from, o) {
      if (!nodes.has(from)) return null;
      // Breadth-first depth of every reachable node: the wave reaches depth d at t0 + d * hopTime.
      const depth = new Map<string, number>([[from, 0]]);
      const queue = [from];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const nx of adj.get(cur) ?? []) {
          if (depth.has(nx)) continue;
          depth.set(nx, depth.get(cur)! + 1);
          queue.push(nx);
        }
      }
      const w: Wave = { from, t0: now, color: o.color, kind: o.kind ?? 'broadcast', depth, hopTime: o.hopTime ?? 0.45 };
      waves.push(w);
      return w;
    },
    update(dt, t) {
      now = t;
      const hops: { node: string; packet: Packet }[] = [];
      const arrivals: Packet[] = [];
      for (const p of packets) {
        if (p.done) continue;
        const a = nodes.get(p.path[p.hop]);
        const b = nodes.get(p.path[p.hop + 1]);
        if (!a || !b) {
          p.done = true;
          continue;
        }
        const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
        p.s += (p.speed * dt) / len;
        if (p.s >= 1) {
          p.hop++;
          p.s = 0;
          blinks.set(b.id, t);
          if (p.hop >= p.path.length - 1) {
            p.done = true;
            arrivals.push(p);
            p.onArrive?.();
          } else hops.push({ node: b.id, packet: p });
        }
      }
      for (let i = packets.length - 1; i >= 0; i--) if (packets[i].done) packets.splice(i, 1);
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        let max = 0;
        for (const [id, d] of w.depth) {
          max = Math.max(max, d);
          const at = w.t0 + d * w.hopTime;
          if (t >= at && t - dt < at) blinks.set(id, t);
        }
        if (t > w.t0 + (max + 3) * w.hopTime) waves.splice(i, 1);
      }
      return { hops, arrivals };
    },
  };
  return net;
}

/** Where a packet is now, in world units. */
export function packetPosition(net: Network, p: Packet): { x: number; y: number; ang: number } | null {
  const a = net.nodes.get(p.path[p.hop]);
  const b = net.nodes.get(p.path[p.hop + 1]);
  if (!a || !b) return null;
  return { x: a.x + (b.x - a.x) * p.s, y: a.y + (b.y - a.y) * p.s, ang: Math.atan2(b.y - a.y, b.x - a.x) };
}

/**
 * Draw packets (a bright head with a fading tail), waves (rings opening at each node as
 * the wave reaches it), and blinking nodes. `project` maps world to the drawing space.
 */
export function drawSignals(
  ctx: CanvasRenderingContext2D,
  net: Network,
  project: (x: number, y: number) => [number, number],
  t: number,
  rgba: (hex: string, a: number) => string,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const p of net.packets) {
    const pos = packetPosition(net, p);
    if (!pos) continue;
    const [x, y] = project(pos.x, pos.y);
    const [tx, ty] = project(pos.x - Math.cos(pos.ang) * 26, pos.y - Math.sin(pos.ang) * 26);
    const g = ctx.createLinearGradient(tx, ty, x, y);
    g.addColorStop(0, rgba(p.color, 0));
    g.addColorStop(1, rgba(p.color, 0.9));
    ctx.strokeStyle = g;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const w of net.waves) {
    for (const [id, d] of w.depth) {
      const age = t - (w.t0 + d * w.hopTime);
      if (age < 0 || age > 1.6) continue;
      const n = net.nodes.get(id);
      if (!n) continue;
      const [x, y] = project(n.x, n.y);
      ctx.strokeStyle = rgba(w.color, 0.7 * (1 - age / 1.6));
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 8 + age * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
