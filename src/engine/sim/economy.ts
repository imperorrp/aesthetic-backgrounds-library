/**
 * The ledger: a tiny economy of goods held at places.
 *
 * A holding is a place (a structure, a server, a depot) with stock of some goods, a cap,
 * and rates at which it makes or uses goods. Each tick, producers add stock and consumers
 * draw it down; a consumer that runs dry is SHORT, and shortages are the demand that the
 * dispatcher (in the domain) answers with convoys. Prices follow total demand over total
 * stock, so the HUD ticker moves when the map does.
 *
 *   ledger.add('dock-3', { cap: 120, uses: { food: 0.4 }, stock: { food: 30 } })
 *   ledger.add('mine-1', { cap: 200, makes: { ore: 1.2 } })
 *   ledger.tick(dt)
 *   ledger.shortages()          // [{ id: 'dock-3', good: 'food', need: 0.8 }]  most urgent first
 *   ledger.take('mine-1', 'ore', 40) / ledger.give('dock-3', 'ore', 40)
 *
 * Pure bookkeeping: no positions, no drawing, no randomness. The domain decides who
 * carries what where; the ledger only says who has and who needs.
 */

export type Good = string;
export type Rates = Partial<Record<Good, number>>;

export type HoldingSpec = {
  /** Total stock it can hold across goods. */
  cap: number;
  /** Units per second it produces. */
  makes?: Rates;
  /** Units per second it consumes. */
  uses?: Rates;
  /** Opening stock. */
  stock?: Rates;
};

export type Holding = {
  id: string;
  cap: number;
  makes: Rates;
  uses: Rates;
  stock: Record<Good, number>;
  /** 0..1 per good it uses: how close to empty (1 = empty). */
  need: Record<Good, number>;
};

export type Shortage = { id: string; good: Good; need: number };

export type Ledger = {
  add(id: string, spec: HoldingSpec): Holding;
  remove(id: string): void;
  get(id: string): Holding | undefined;
  readonly holdings: ReadonlyMap<string, Holding>;
  tick(dt: number): void;
  /** Consumers below a third of their target stock, most urgent first. */
  shortages(): Shortage[];
  /** Remove up to `amount` of a good; returns what was taken. */
  take(id: string, good: Good, amount: number): number;
  /** Add up to `amount` of a good (capped); returns what was accepted. */
  give(id: string, good: Good, amount: number): number;
  /** Relative price of a good, around 1 when supply meets demand. */
  price(good: Good): number;
  /** Which way the price moved over the last few seconds. */
  trend(good: Good): -1 | 0 | 1;
  readonly goods: readonly Good[];
};

const total = (h: Holding) => Object.values(h.stock).reduce((a, b) => a + b, 0);

export function createLedger(goods: readonly Good[]): Ledger {
  const holdings = new Map<string, Holding>();
  const prices = new Map<Good, number>(goods.map((g) => [g, 1]));
  const past = new Map<Good, number>(goods.map((g) => [g, 1]));
  let clock = 0;
  let lastSnapshot = 0;

  /** A consumer wants about 30 seconds of what it uses on hand. */
  const target = (h: Holding, g: Good) => Math.max(5, (h.uses[g] ?? 0) * 30);

  return {
    goods,
    holdings,
    add(id, spec) {
      const h: Holding = {
        id,
        cap: spec.cap,
        makes: { ...spec.makes },
        uses: { ...spec.uses },
        stock: Object.fromEntries(goods.map((g) => [g, spec.stock?.[g] ?? 0])),
        need: {},
      };
      holdings.set(id, h);
      return h;
    },
    remove: (id) => void holdings.delete(id),
    get: (id) => holdings.get(id),
    tick(dt) {
      clock += dt;
      for (const h of holdings.values()) {
        for (const [g, r] of Object.entries(h.makes)) {
          if (!r) continue;
          const room = h.cap - total(h);
          h.stock[g] = (h.stock[g] ?? 0) + Math.max(0, Math.min(room, r * dt));
        }
        for (const [g, r] of Object.entries(h.uses)) {
          if (!r) continue;
          h.stock[g] = Math.max(0, (h.stock[g] ?? 0) - r * dt);
          h.need[g] = 1 - Math.min(1, h.stock[g] / target(h, g));
        }
      }
      // Prices: demand (rates of use) over supply (stock on hand plus production).
      for (const g of goods) {
        let demand = 0;
        let supply = 0;
        for (const h of holdings.values()) {
          demand += (h.uses[g] ?? 0) * 30;
          supply += (h.stock[g] ?? 0) + (h.makes[g] ?? 0) * 30;
        }
        const p = Math.max(0.2, Math.min(5, (demand + 5) / (supply + 5)));
        prices.set(g, (prices.get(g) ?? 1) * 0.98 + p * 0.02);
      }
      if (clock - lastSnapshot > 6) {
        lastSnapshot = clock;
        for (const g of goods) past.set(g, prices.get(g) ?? 1);
      }
    },
    shortages() {
      const out: Shortage[] = [];
      for (const h of holdings.values()) for (const [g, n] of Object.entries(h.need)) if (n > 0.66) out.push({ id: h.id, good: g, need: n });
      return out.sort((a, b) => b.need - a.need);
    },
    take(id, good, amount) {
      const h = holdings.get(id);
      if (!h) return 0;
      const got = Math.max(0, Math.min(amount, h.stock[good] ?? 0));
      h.stock[good] = (h.stock[good] ?? 0) - got;
      return got;
    },
    give(id, good, amount) {
      const h = holdings.get(id);
      if (!h) return 0;
      const put = Math.max(0, Math.min(amount, h.cap - total(h)));
      h.stock[good] = (h.stock[good] ?? 0) + put;
      if (h.uses[good]) h.need[good] = 1 - Math.min(1, h.stock[good] / target(h, good));
      return put;
    },
    price: (g) => prices.get(g) ?? 1,
    trend(g) {
      const d = (prices.get(g) ?? 1) - (past.get(g) ?? 1);
      return d > 0.03 ? 1 : d < -0.03 ? -1 : 0;
    },
  };
}
