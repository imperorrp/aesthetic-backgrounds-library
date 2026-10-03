/**
 * Economy: goods made, carried, and used, so traffic has a reason.
 *
 * Every structure with a role in the pack's economy holds stock in the shared ledger
 * (`sim/economy.ts`). Mines dig ore, docks refine fuel and parts, habitats grow food;
 * docks, shipyards, defenses, and relays use them up. When a place runs short, the
 * dispatcher sends a convoy from the nearest place that has the good: a freighter column
 * with glowing pods in the cargo's color, flown to the consumer and unloaded when it
 * docks. Shipyards build ships only from stock they actually hold. Raid a convoy and the
 * cargo is lost and the shortage stays.
 *
 * What you see: a small manifest beside each structure (a row of cells per good, blinking
 * when short), ore stacking up at depots, and a price ticker in the corner.
 *
 * Other mechanics can read and move goods through `useLedger(api)`.
 */
import type { Fleet, Structure } from '../types';
import { createLedger, type Ledger } from '../../../sim/economy';
import { DEFAULT_ECONOMY, type PackEconomy, type PackGood, type ShipClass } from '../universe';
import { allStructures } from '../fleets';
import { hexRgba } from '../renderers/utils';
import { registerMechanic, type MechanicApi } from './types';

export type EconomyService = {
  ledger: Ledger;
  goods: PackGood[];
  good(id: string): PackGood | undefined;
  /** Convoys in flight, by fleet id. */
  convoys: Map<string, { fleet: Fleet; good: string; amount: number; to: string; from: string }>;
};

/** The shared ledger for this world, created on first use and kept in step with the map. */
export function useLedger(api: MechanicApi): EconomyService {
  return api.use('economy', () => {
    const spec: PackEconomy = api.pack.economy ?? DEFAULT_ECONOMY;
    const goods = spec.goods.length ? spec.goods : DEFAULT_ECONOMY.goods;
    const roles = spec.roles ?? DEFAULT_ECONOMY.roles ?? {};
    const ledger = createLedger(goods.map((g) => g.id));
    const svc: EconomyService = { ledger, goods, good: (id) => goods.find((g) => g.id === id), convoys: new Map() };

    /** Bring holdings in line with the structures on the map, every couple of seconds. */
    let nextSync = 0;
    const sync = () => {
      const live = new Set<string>();
      for (const s of allStructures(api.world)) {
        const r = roles[s.role];
        if (!r) continue;
        live.add(s.id);
        if (ledger.get(s.id)) continue;
        // Opening stock: producers part full, consumers somewhere between short and fine.
        const stock: Record<string, number> = {};
        for (const g of Object.keys(r.makes ?? {})) stock[g] = (r.cap ?? 120) * (0.15 + api.rng() * 0.35);
        for (const [g, rate] of Object.entries(r.uses ?? {})) stock[g] = rate * 30 * (0.4 + api.rng() * 1.1);
        ledger.add(s.id, { cap: r.cap ?? 120, makes: r.makes, uses: r.uses, stock });
      }
      for (const id of [...ledger.holdings.keys()]) if (!live.has(id)) ledger.remove(id);
    };
    api.onUpdate((dt) => {
      if (api.t >= nextSync) {
        sync();
        nextSync = api.t + 2;
      }
      ledger.tick(dt);
    });

    // Deliveries: a convoy that docks at its consumer unloads there; any other ship
    // carrying cargo (a miner with a full hold) unloads wherever it docks.
    api.bus.on('dock', (e) => {
      let c = svc.convoys.get(String(e.fleet));
      if (!c) {
        const f = api.world.fleets.find((fl) => fl.id === e.fleet);
        if (f?.cargo && typeof e.at === 'string' && ledger.get(e.at)) c = { fleet: f, good: f.cargo.good, amount: f.cargo.amount, to: e.at, from: '' };
      }
      if (!c || e.at !== c.to) return;
      const put = ledger.give(c.to, c.good, c.amount);
      svc.convoys.delete(c.fleet.id);
      c.fleet.cargo = undefined;
      const s = allStructures(api.world).find((x) => x.id === c.to);
      const g = svc.good(c.good);
      if (s && g) {
        s.flashAt = api.t;
        api.say(`${Math.round(put)} ${g.label} DELIVERED · ${s.label}`, s.x, s.y + 22, g.color, { priority: 'low', duration: 3200 });
        api.emit({ type: 'delivery', x: s.x, y: s.y, weight: 0.15, good: c.good, amount: put });
      }
    });
    // A convoy shot down takes its cargo with it.
    api.bus.on('lost', (e) => {
      for (const [id, c] of svc.convoys) {
        if (c.fleet.mode !== 'gone' && c.fleet.ships.length) continue;
        svc.convoys.delete(id);
        const g = svc.good(c.good);
        if (g && e.x !== undefined && e.y !== undefined) api.say(`CARGO LOST · ${Math.round(c.amount)} ${g.label}`, e.x, e.y + 18, '#f87171', { priority: 'medium' });
      }
    });
    return svc;
  });
}

const BUILDS: ShipClass[] = ['fighter', 'fighter', 'freighter', 'cruiser', 'scout'];

registerMechanic({
  id: 'economy',
  label: 'Economy',
  description: 'Mines, refineries, and habitats make goods; shortages send convoys with glowing cargo; shipyards build only from stock; prices tick in the corner.',
  schema: {
    convoys: { type: 'number', min: 1, max: 10, default: 5, step: 1, label: 'Convoys at once' },
    load: { type: 'number', min: 10, max: 80, default: 40, label: 'Cargo per convoy' },
    manifests: { type: 'boolean', default: true, label: 'Stock beside structures' },
    ticker: { type: 'boolean', default: true, label: 'Price ticker' },
  },
  create(api, p) {
    const eco = useLedger(api);
    const { ledger } = eco;
    // The economy runs the mines and shipyards; the world's timed launches step aside.
    api.world.managedRoles ??= new Set();
    api.world.managedRoles.add('mine');
    api.world.managedRoles.add('shipyard');
    const load = Number(p.load) || 40;
    let nextDispatch = api.t + 2;
    const nextBuild = new Map<string, number>();

    const byId = () => new Map(allStructures(api.world).map((s) => [s.id, s]));

    /** Answer the worst shortages with convoys from the nearest place that has the good. */
    const dispatch = () => {
      if (eco.convoys.size >= (Number(p.convoys) || 5)) return;
      const places = byId();
      for (const need of ledger.shortages().slice(0, 4)) {
        if ([...eco.convoys.values()].some((c) => c.to === need.id && c.good === need.good)) continue;
        const to = places.get(need.id);
        if (!to || !api.onScreen(to.x, to.y, -40)) continue;
        let best: Structure | undefined;
        let bestD = 1500;
        for (const h of ledger.holdings.values()) {
          if (h.id === need.id || (h.stock[need.good] ?? 0) < load * 0.5 || h.uses[need.good]) continue;
          const s = places.get(h.id);
          if (!s) continue;
          const d = Math.hypot(s.x - to.x, s.y - to.y);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        if (!best) continue;
        const amount = ledger.take(best.id, need.good, load);
        const g = eco.good(need.good)!;
        const ang = Math.atan2(to.y - best.y, to.x - best.x);
        const f = api.spawnFleet(
          { x: best.x + Math.cos(ang) * 18, y: best.y + Math.sin(ang) * 18, vx: Math.cos(ang) * 10, vy: Math.sin(ang) * 10 },
          { cls: 'freighter', purpose: 'cargo', tag: 'convoy', fadeIn: true, z: best.z ?? 0 },
        );
        f.cargo = { good: need.good, amount, color: g.color, to: to.id };
        f.maxVisits = 2;
        api.goTo(f, to);
        eco.convoys.set(f.id, { fleet: f, good: need.good, amount, to: to.id, from: best.id });
        best.flashAt = api.t;
        api.say(`${f.callsign} · ${Math.round(amount)} ${g.label} → ${to.label}`, best.x, best.y, g.color, { priority: 'low', followId: f.id, duration: 3600 });
        api.emit({ type: 'convoy', x: best.x, y: best.y, weight: 0.25, follow: api.follow(f), good: need.good });
        if (eco.convoys.size >= (Number(p.convoys) || 5)) return;
      }
    };

    /** Shipyards turn ore and parts into ships, when they have them. */
    const build = () => {
      for (const s of allStructures(api.world)) {
        if (s.role !== 'shipyard' || !api.onScreen(s.x, s.y, 30)) continue;
        const h = ledger.get(s.id);
        if (!h || api.t < (nextBuild.get(s.id) ?? 0)) continue;
        // A ship costs about 20 seconds' worth of everything the yard uses.
        const bill = Object.entries(h.uses).map(([g, rate]) => [g, (rate ?? 0) * 20] as const);
        if (!bill.length || bill.some(([g, n]) => (h.stock[g] ?? 0) < n)) continue;
        for (const [g, n] of bill) ledger.take(s.id, g, n);
        const cls = BUILDS[Math.floor(api.rng() * BUILDS.length)];
        const ang = api.rng() * Math.PI * 2;
        const f = api.spawnFleet({ x: s.x + Math.cos(ang) * 16, y: s.y + Math.sin(ang) * 16, vx: Math.cos(ang) * 12, vy: Math.sin(ang) * 12 }, { cls, tag: 'built', fadeIn: true, z: s.z ?? 0 });
        f.tag = undefined; // a new ship joins ordinary traffic
        s.flashAt = api.t;
        api.say(`COMMISSIONED · ${f.callsign}`, s.x, s.y + 24, s.color ?? api.host.palette.accent, { priority: 'medium', followId: f.id });
        api.emit({ type: 'launch', x: s.x, y: s.y, weight: 0.35, follow: api.follow(f) });
        nextBuild.set(s.id, api.t + 10 + api.rng() * 10);
      }
    };

    return {
      update() {
        // Convoys whose fleet is gone for any reason stop counting.
        for (const [id, c] of eco.convoys) if (c.fleet.mode === 'gone' || !c.fleet.ships.length) eco.convoys.delete(id);
        if (api.t >= nextDispatch) {
          dispatch();
          build();
          nextDispatch = api.t + 1.5;
        }
      },
      draw(ctx, pass, frame) {
        if (pass === 'mid' && p.manifests !== false) {
          // Manifests: a row of cells per good this place makes or uses, beside it.
          const places = byId();
          const blink = Math.floor(frame.time * 3) % 2 === 0;
          for (const h of ledger.holdings.values()) {
            const s = places.get(h.id);
            if (!s || s.z || !api.onScreen(s.x, s.y, -20)) continue;
            const x0 = Math.round(api.screenX(s.x) + 24);
            let y0 = Math.round(s.y - 6);
            const rows = [...Object.keys(h.makes), ...Object.keys(h.uses)].slice(0, 3);
            for (const gid of rows) {
              const g = eco.good(gid);
              if (!g) continue;
              const target = h.uses[gid] ? Math.max(5, (h.uses[gid] ?? 0) * 30) : h.cap / 2;
              const filled = Math.round(Math.min(1, (h.stock[gid] ?? 0) / target) * 6);
              const short = (h.need[gid] ?? 0) > 0.66;
              for (let i = 0; i < 6; i++) {
                const on = i < filled;
                ctx.fillStyle = short && blink ? hexRgba('#f87171', 0.8) : hexRgba(g.color, on ? 0.85 : 0.18);
                ctx.fillRect(x0 + i * 4, y0, 3, 3);
              }
              y0 += 5;
            }
            // Ore piles up at depots as deliveries land: a little pyramid of crates.
            const ore = h.stock.ore ?? 0;
            if (h.uses.ore || (h.makes.ore && s.role === 'dock')) {
              const crates = Math.min(10, Math.floor(ore / 12));
              const g = eco.good('ore');
              let n = 0;
              for (let row = 0; row < 4 && n < crates; row++) {
                for (let i = 0; i < 4 - row && n < crates; i++, n++) {
                  ctx.fillStyle = hexRgba(g?.color ?? '#f59e0b', 0.75);
                  ctx.fillRect(Math.round(api.screenX(s.x) - 40 + i * 5 + row * 2.5), Math.round(s.y + 14 - row * 5), 4, 4);
                }
              }
            }
          }
        }
        if (pass === 'hud' && p.ticker !== false) {
          // The ticker: price index per good, with which way it is moving.
          ctx.font = '9px "Orbit", "Syne Mono", ui-monospace, monospace';
          ctx.textBaseline = 'alphabetic';
          let x = 14;
          const y = api.height - 12;
          // A backing plate: the ticker draws after the labels, so it must read over them.
          const parts = eco.goods.map((g) => `${g.label} ${Math.round(ledger.price(g.id) * 100)}▲`);
          const total = parts.reduce((w, s) => w + ctx.measureText(s).width + 12, 0);
          ctx.fillStyle = hexRgba(api.host.palette.bg, 0.78);
          ctx.fillRect(8, y - 11, total + 4, 15);
          for (const g of eco.goods) {
            const price = Math.round(ledger.price(g.id) * 100);
            const tr = ledger.trend(g.id);
            const text = `${g.label} ${price}${tr > 0 ? '▲' : tr < 0 ? '▼' : '·'}`;
            ctx.fillStyle = hexRgba(g.color, tr ? 0.75 : 0.5);
            ctx.fillText(text, x, y);
            x += ctx.measureText(text).width + 12;
          }
        }
      },
    };
  },
});
