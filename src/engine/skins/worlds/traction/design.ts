/**
 * Traction's plans: where a city's parts are, shared by the sim (where a rocket lands, where a new
 * chimney goes) and the painter (what is built there). Pure: no canvas.
 *
 * City units: 1000 from the tail to the tip of the jaws, x forward from the middle (the jaws at
 * +500), y up from the mud (negative). From the mud up: the tracks on their bogies; the
 * suspension; the hull, with the jaws in its prow and the gut behind them; then the tiers, each
 * a deck on its own pillars and narrower than the one under it, like a wedding cake: the works
 * (furnaces and chimneys), the tenements, the terraces, the gardens, and the crown on top (a
 * cathedral, a dome, a cluster of spires, or a stepped temple).
 */
import type { CityTop, TownKind } from './types';

export const hsh = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export type TierKind = 'works' | 'tenements' | 'terraces' | 'gardens' | 'crown';
export type Tier = { i: number; kind: TierKind; x0: number; x1: number; deck: number; floor: number; top: number };
export type CityPlan = {
  bogies: { x: number; len: number }[];
  trackH: number; hullBot: number; hullTop: number; hullX0: number;
  /** The jaws: the hinge, the mouth's top and bottom. */
  jawX: number; mouthTop: number; mouthBot: number;
  tiers: Tier[];
  crown: { x: number; w: number; h: number; base: number };
  /** Where chimneys stand on the works, in the order they are lit: x, foot, height. */
  chimneys: [number, number, number][];
  guns: [number, number][];
  lamps: [number, number][];
  lifts: [number, number, number][];
};

const plans = new Map<string, CityPlan>();
export function cityPlan(seed: number, nTiers: number, top: CityTop, nTracks: number): CityPlan {
  const key = `${seed}:${nTiers}:${top}:${nTracks}`;
  const hit = plans.get(key);
  if (hit) return hit;
  const h = (k: number) => hsh(seed, k + 0.37);
  const trackH = 62;
  const hullBot = -trackH - 20;
  const hullTop = hullBot - 112;
  const bogies: CityPlan['bogies'] = [];
  const span = 900;
  const gap = 26;
  const bl = (span - gap * (nTracks - 1)) / nTracks;
  for (let k = 0; k < nTracks; k++) bogies.push({ x: -470 + bl / 2 + k * (bl + gap), len: bl });
  const tiers: Tier[] = [];
  let deck = hullTop;
  for (let i = 0; i < nTiers; i++) {
    const q = i / Math.max(1, nTiers - 1);
    const w = 930 - q * (930 - (360 + h(1) * 90));
    const c = -40 - i * 14 + (h(2 + i) - 0.5) * 20;
    const kind: TierKind = i === 0 ? 'works' : i === nTiers - 1 ? 'crown' : i === 1 ? 'tenements' : i === nTiers - 2 ? 'gardens' : 'terraces';
    const ht = (kind === 'works' ? 84 : kind === 'crown' ? 46 : 70 - i * 3) * (0.92 + h(9 + i) * 0.16);
    const floor = deck - 11;
    tiers.push({ i, kind, x0: c - w / 2, x1: c + w / 2, deck, floor, top: floor - ht });
    deck = floor - ht;
  }
  const T = tiers[tiers.length - 1];
  const cw = (T.x1 - T.x0) * (top === 'spires' ? 0.62 : top === 'ziggurat' ? 0.56 : 0.48);
  const crown = { x: (T.x0 + T.x1) / 2 + (h(20) - 0.5) * 30, w: cw, h: (top === 'spires' ? 190 : top === 'cathedral' ? 175 : top === 'dome' ? 150 : 120) * (0.9 + h(21) * 0.2), base: T.floor };
  // Chimneys on the works where the tier above leaves it open: the tail first, then the prow.
  const w0 = tiers[0];
  const w1 = tiers[1] ?? w0;
  const chimneys: [number, number, number][] = [];
  const rear = Math.max(20, w1.x0 - w0.x0 - 8);
  const front = Math.max(20, w0.x1 - w1.x1 - 8);
  const nRear = Math.max(3, Math.floor(rear / 15));
  const nFront = Math.max(2, Math.floor(front / 15));
  const slots: [number, number, number][] = [];
  for (let k = 0; k < nRear; k++) slots.push([w0.x0 + 10 + (k + 0.5) * (rear / nRear), w0.floor - 6, 120 + h(30 + k) * 90]);
  for (let k = 0; k < nFront; k++) slots.push([w1.x1 + 4 + (k + 0.5) * (front / nFront), w0.floor - 6, 100 + h(50 + k) * 80]);
  // Then up through the tenements' margins.
  const w2 = tiers[2] ?? w1;
  for (let k = 0; k < 4; k++) slots.push([w1.x0 + 8 + k * 13, w1.floor - 4, 80 + h(70 + k) * 60]);
  for (let k = 0; k < 3; k++) slots.push([w2.x1 + 6 + k * 13, w1.floor - 4, 70 + h(80 + k) * 50]);
  // Lit in an order that alternates tail and prow, so a new one is easy to see.
  const order = slots.map((s, i) => [s, h(90 + i)] as const).sort((a, b) => a[1] - b[1]);
  for (const [s] of order) chimneys.push(s);
  const guns: [number, number][] = [];
  for (const t of tiers.slice(1, -1)) {
    guns.push([t.x1 - 12, t.floor - 6]);
    guns.push([t.x0 + 12, t.floor - 6]);
  }
  guns.push([440, hullTop + 18]);
  const lamps: [number, number][] = [[T.x0 + 14, T.top + 6], [T.x1 - 14, T.top + 6]];
  if (tiers.length > 2) {
    const G = tiers[tiers.length - 2];
    lamps.push([G.x1 - 10, G.top + 4], [G.x0 + 10, G.top + 4]);
  }
  const lifts: [number, number, number][] = [];
  for (let i = 1; i < tiers.length; i++) {
    const a = tiers[i];
    const b = tiers[i - 1];
    lifts.push([a.x0 - 10 - h(100 + i) * 10, b.floor, a.top + 10]);
    if (h(110 + i) < 0.6) lifts.push([a.x1 + 8 + h(120 + i) * 10, b.floor, a.top + 10]);
  }
  const plan: CityPlan = { bogies, trackH, hullBot, hullTop, hullX0: -500, jawX: 420, mouthTop: hullTop + 16, mouthBot: hullBot - 6, tiers, crown, chimneys, guns, lamps, lifts };
  if (plans.size > 40) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The highest point of a city, in city units (negative). */
export const cityTop = (p: CityPlan) => p.crown.base - p.crown.h;

/** A point on the city a rocket or a shell might strike: on a tier's face. */
export function strikePoint(p: CityPlan, a: number, b: number): [number, number] {
  const t = p.tiers[Math.min(p.tiers.length - 1, Math.floor(a * p.tiers.length))];
  return [t.x0 + (t.x1 - t.x0) * (0.08 + b * 0.84), t.floor + (t.top - t.floor) * (0.25 + hsh(a * 99, b * 77) * 0.6)];
}

/** A town's shape, in its own units (100 long). */
export type TownPlan = { kind: TownKind; wheels: { x: number; r: number }[]; hullTop: number; hullBot: number; tiers: { x0: number; x1: number; top: number; floor: number }[]; legs: number; mast: boolean; drill: boolean };
const towns = new Map<number, TownPlan>();
export function townPlan(seed: number, kind: TownKind, nTiers: number): TownPlan {
  const hit = towns.get(seed);
  if (hit) return hit;
  const h = (k: number) => hsh(seed, k + 0.71);
  const wheels: TownPlan['wheels'] = [];
  let hullBot = -16;
  if (kind === 'wheeled' || kind === 'suburb' || kind === 'sail') {
    const n = kind === 'suburb' ? 2 : 2 + Math.floor(h(1) * 3);
    const r = kind === 'suburb' ? 15 : n > 3 ? 12 + h(2) * 3 : 16 + h(2) * 5;
    for (let k = 0; k < n; k++) wheels.push({ x: -44 + r * 0.6 + (k / Math.max(1, n - 1)) * (88 - r * 1.2), r });
    hullBot = -r * 1.25;
  } else if (kind === 'tracked' || kind === 'mining') hullBot = -22;
  else hullBot = -30;
  const hullTop = hullBot - (kind === 'scav' ? 16 : 18 + h(3) * 8);
  const tiers: TownPlan['tiers'] = [];
  let floor = hullTop;
  for (let i = 0; i < nTiers; i++) {
    const w = (kind === 'scav' ? 70 : 86) * (1 - i * 0.24) * (0.9 + h(10 + i) * 0.12);
    const c = -6 - i * 4 + (h(20 + i) - 0.5) * 10;
    const ht = (kind === 'suburb' ? 18 : 22) * (0.85 + h(30 + i) * 0.3);
    tiers.push({ x0: c - w / 2, x1: c + w / 2, floor: floor - 3, top: floor - 3 - ht });
    floor = floor - 3 - ht;
  }
  const plan: TownPlan = { kind, wheels, hullTop, hullBot, tiers, legs: kind === 'scav' ? 6 : 0, mast: kind === 'sail', drill: kind === 'mining' };
  if (towns.size > 200) towns.clear();
  towns.set(seed, plan);
  return plan;
}

export const CITY_NAMES = ['SALTMARK', 'GRAVENHOLT', 'KESTERMOOR', 'BRASSFELL', 'OSSENBURG', 'VANTREK', 'HOLLOWMERE', 'GREAT ARNSWICK', 'OSTRAVAL', 'IRONWOLD', 'MAGNA VERRE', 'DRUMMOND STAAT', 'CORVELLE', 'HAVERGRIM'];
export const TOWN_NAMES = ['KETTLE BRIDGE', 'LITTLE OAKUM', 'PUDDLEFORD', 'WINCHMOOR', 'CINDERWICK', 'BRAMBLETOFT', 'NETHERWHEEL', 'TUMBLESTOCK', 'GORSE END', 'SPINDLEHAM', 'COPPERHOLM', 'MUDLARK', 'WILLOWBY', 'AXLEWORTH', 'SLAGBURY', 'FERNSEY', 'TINKERS RUN', 'GALLOWMERE', 'PIPPINWORTH', 'RATTLEBY', 'OXHOLM', 'CRANKSTONE', 'THRUSHFORD', 'MOLE END', 'QUILLBY', "HOBB'S CROSSING", 'CLATTERHAM', 'BUTTONMOOR', 'WHEELWRIGHT', 'LESSER TOLLING', 'SKEW BRIDGE', 'PENNYWHISTLE'];
export const SCAV_NAMES = ['RUSTWICK', 'SCRAPGATE', 'THE CARRION', 'GNAWBONE', 'MAGPIE', 'BONEPICK', 'OLD GRUB', 'THE TALLYMAN'];
export const TRADER_NAMES = ['THE LARKSPUR', 'AMBER MARIGOLD', 'MISS PERSIMMON', "THE SOU'WESTER", 'CLOUD SPARROW', 'THE TALLOW QUEEN', 'HALCYON DAYS', 'THE WANDERING TEAPOT', 'OLD BRASS BOOTS', 'ZEPHYRINE', 'THE MERRY WIDGEON', 'DANDELION', 'THE PATIENT OX', 'GOOD FORTUNE'];
export const LEAGUE_NAMES = ['STORM PETREL', 'THE JADE HERON', 'MOUNTAIN ASH', 'THE RED KESTREL', 'WHITE CRANE', 'IRON LOTUS', 'SNOW LEOPARD', 'THE QUIET ARROW', 'KINGFISHER', 'DAWN SPARROWHAWK'];
export const HARBOUR_NAMES = ['ARIOSTO HAVEN', 'CUMULUS STATION', 'THE FLOATING EXCHANGE', 'HIGHMARKET', 'THE LOFT OF SAINT ULVA', 'CIRRUS QUAY'];
export const REGIONS = ['THE GREAT HUNTING GROUND', 'THE OUT-COUNTRY', 'THE BITTER FLATS', 'THE GREY STEPPE', 'THE CHURNED PLAIN', 'THE MUDFLATS OF OSK', 'THE RUSTLANDS', 'THE LONG SOUP'];
export const TOWN_KIND_NAMES: Record<TownKind, string> = { wheeled: 'TRACTION TOWN', tracked: 'TRACKED TOWN', scav: 'SCAVENGER TOWN', suburb: 'SUBURB', mining: 'MINING TOWN', sail: 'SAIL TOWN' };
