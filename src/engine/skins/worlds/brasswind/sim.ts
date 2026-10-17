/**
 * Brasswind: a skyport city of brass and steam, seen from across the river.
 *
 * On screen, at a glance: a city climbing a crag, spread along a canal, or stacked on terraces;
 * towers of brick, stone, iron and verdigris copper; a clocktower, a cathedral, an observatory,
 * gasometers, factory chimneys, a shipyard; and the lattice mooring masts where the airships
 * dock. Viaducts carry trams, cable cars hang between the tops, pneumatic tubes shoot their
 * capsules from wall to wall. Liners, freighters, couriers and naval corvettes come and go,
 * small ships pass far off in the haze, ornithopters and pigeons fill the air between.
 *
 * Always happening: ships arrive, dock, unload and leave; trams, cars and capsules run; smoke
 * and steam rise; the clock turns and chimes; lamps are lit at dusk; a day goes by every four
 * minutes, and the year by the seasons.
 * The cast (per seed): sky pirates (and the corvettes that chase them), storms (lightning on the
 * masts), races round the spires, festivals (fireworks), the shipyard (a great ship growing
 * until it launches), a walking engine in the lower town, and, very rarely, the great comet.
 * Keeps going: ships lost are replaced, the city builds upward floor by floor, new masts go up,
 * the shipyard lays down the next hull when one launches.
 * A touch: in the sky, a signal flare that calls the nearest ship in to dock; on a building,
 * its bells or its whistle.
 */
import { createBus, type Bus } from '../../../sim/bus';
import { forkRng, type Rng } from '../../../rng';
import { ARCS, compose, createDirector, createGenome, WORLD_SCALE, type Director, type Genome, type SystemDef } from '../../../kit';

export type Site = 'crag' | 'canal' | 'decks';
export type Roof = 'mansard' | 'dome' | 'spire' | 'gable' | 'flat' | 'onion' | 'clock' | 'observatory' | 'sawtooth' | 'cupola';
export type BKind = 'house' | 'tower' | 'clock' | 'cathedral' | 'observatory' | 'factory' | 'gasometer' | 'guild' | 'shipyard' | 'warehouse' | 'engine';
export type Building = {
  id: number; kind: BKind; x: number; w: number; base: number; floors: number; floorH: number; target: number;
  roof: Roof; wall: string; trim: string; roofColor: string; window: string; seed: number;
  /** 0..1 while a new floor goes up; -1 when none. */
  scaffold: number;
  /** 0: the far row (smaller, hazier, behind); 1: the main row. */
  layer: 0 | 1;
  chimneys: number[]; gas: number; name: string;
};
export type Mast = { id: number; x: number; base: number; top: number; ship: number; naval: boolean; grand: boolean; name: string; built: number };
export type LinkKind = 'viaduct' | 'cable' | 'tube';
export type Link = { kind: LinkKind; ax: number; ay: number; bx: number; by: number; sag: number };
export type Rider = { link: number; u: number; dir: 1 | -1; speed: number; kind: 'tram' | 'car' | 'capsule'; wait: number };
export type ShipKind = 'liner' | 'freighter' | 'corvette' | 'pirate' | 'courier' | 'balloon' | 'racer' | 'leviathan';
export type ShipState = 'cruise' | 'approach' | 'docked' | 'depart' | 'chase' | 'flee' | 'fight' | 'burning' | 'falling' | 'wreck' | 'race' | 'launch';
export type Ship = {
  id: number; kind: ShipKind; name: string; from: string; x: number; y: number; dir: 1 | -1; speed: number; len: number;
  /** Depth: 1 is the near air in front of the city; below 0.8 it passes behind, small and hazy. */
  z: number;
  state: ShipState; t0: number; mast: number; target: number; hp: number; cargo: number; colors: [string, string, string];
  bob: number; tilt: number; fire: number; flag: string; lap: number; alive: boolean;
};
export type Flier = { x: number; y: number; vx: number; vy: number; phase: number; kind: 'ornithopter' | 'gyro' | 'kite' };
export type Flock = { x: number; y: number; vx: number; vy: number; n: number; scatter: number; home: [number, number]; seed: number };
export type FxKind = 'smoke' | 'steam' | 'spark' | 'flash' | 'firework' | 'cannon' | 'fire' | 'splash' | 'crate' | 'flare' | 'bell' | 'debris' | 'chute';
export type Fx = { kind: FxKind; x: number; y: number; vx: number; vy: number; t0: number; dur: number; r: number; color: string; seed: number };
export type Bolt = { pts: [number, number][]; t0: number };
export type Label = { text: string; x: number; y: number; t0: number; color: string };
export type Walker = { x: number; dir: 1 | -1; t0: number; step: number } | null;

export type BrassOptions = { traffic: number; camera?: string };

export type BrassWorld = {
  t: number; W: number; H: number; GW: number; GH: number; u: number; bus: Bus; director: Director;
  name: string; site: Site; side: 1 | -1; year: number; season: number; cast: string[]; castIds: string[];
  /** The time of day, 0..1 (0 midnight, 0.5 noon). */
  day: number;
  /** The ground's top (world y) at x; the river runs below `river` where there is one. */
  groundAt(x: number): number;
  GY: number; river: number | null;
  buildings: Building[]; masts: Mast[]; links: Link[]; riders: Rider[]; lamps: [number, number][];
  ships: Ship[]; fliers: Flier[]; flocks: Flock[]; boats: { x: number; dir: 1 | -1; kind: 'barge' | 'paddle'; seed: number }[];
  fx: Fx[]; bolts: Bolt[];
  /** Weather: 0 clear .. 1 storm; smog 0..1. */
  storm: number; smog: number; wind: number;
  /** Lamps lit from one end at dusk: how far along (0..1). */
  lampsLit: number;
  shipyard: { x: number; base: number; progress: number; name: string } | null;
  walker: Walker;
  comet: { t0: number } | null;
  festival: number; race: { t0: number; laps: number; ids: number[] } | null;
  /** Bumped when the city's buildings change, so the painter redraws its picture of them. */
  version: number;
  labels: Label[]; chronicle: { t: number; text: string }[];
  step(dt: number): void;
  nudge(x: number, y: number): string | null;
  counts(): Record<string, number>;
};

const CITIES = ['NEW ALBION', 'COGSMOUTH', 'AETHERBURY', 'PORT VELLUM', 'HIGHGATE-ON-STEAM', 'KESTRELWICK', 'GILDENHAVEN', 'BRASSWIND', 'SOOTHAVEN', 'MERIDIAN HEIGHTS'];
const LINERS = ['AURELIA', 'MAJESTIC', 'QUEEN TITANIA', 'INDOMITABLE', 'PERSEVERANCE', 'ALBATROSS', 'EMPRESS OF THE AIR', 'GLORIANA', 'COLOSSUS', 'CELESTINE'];
const FREIGHTERS = ['HELENA', 'BRAMBLE', 'IRON SWALLOW', 'CORMORANT', 'PATIENCE', 'MOLLY BROWN', 'COALBARROW', 'STEADFAST', 'OLD TOM', 'HUMBLE BEE', 'GREY GOOSE', 'TALLOW'];
const NAVY = ['HMS VIGILANT', 'HMS DAUNTLESS', 'HMS SPARROWHAWK', 'HMS RESOLUTE', 'HMS TEMPEST', 'HMS ARDENT'];
const PIRATES = ['THE CRIMSON KITE', 'THE BLACK GULL', 'THE SCARLET WIDOW', 'THE MAGPIE', 'THE RAG-AND-BONE', 'THE HANGED MAN'];
const COURIERS = ['SWIFT', 'PIGEON', 'DART', 'NIMBLE', 'HERALD', 'ZEPHYR', 'WREN', 'QUICKSILVER'];
const FROM = ['FROM CALCUTTA', 'FROM THE CAPE', 'FROM NEW AMSTERDAM', 'FROM ZANZIBAR', 'FROM THE POLAR STATION', 'FROM VENICE-ALOFT', 'FROM CONSTANTINOPLE', 'FROM THE ORIENT', 'FROM BUENOS AIRES', 'FROM THE COLONIES'];
const MASTS = ['THE GRAND MAST', 'VICTORIA MAST', 'THE IRON NEEDLE', 'KINGSWAY MAST', 'THE COPPER SPIRE', 'HARBOUR MAST', 'THE ADMIRALTY MAST'];
const GUILDS = ['THE AERONAUTS\' GUILD', 'THE EXCHANGE', 'THE ROYAL SOCIETY', 'THE GUILDHALL', 'THE CUSTOMS HOUSE', 'THE ACADEMY', 'THE INSTITUTE', 'THE ASSEMBLY ROOMS'];
export const SEASONS = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const;

type WallSet = { wall: string; trim: string; roof: string; window: string };
const WALLS: WallSet[] = [
  { wall: '#7a3b2a', trim: '#c9a227', roof: '#3f6b5c', window: '#ffd27a' },
  { wall: '#8a5a3c', trim: '#d4af37', roof: '#4b3527', window: '#ffcf70' },
  { wall: '#6b6156', trim: '#b08d57', roof: '#2f4f4f', window: '#ffe0a0' },
  { wall: '#4a4a52', trim: '#a87c3f', roof: '#5d7c6f', window: '#ffd890' },
  { wall: '#9a7b5b', trim: '#e0b84e', roof: '#5a3a2e', window: '#ffe6a8' },
  { wall: '#5c3a2e', trim: '#b87333', roof: '#3d6e63', window: '#ffc86a' },
  { wall: '#3d3f45', trim: '#cd7f32', roof: '#6f8f7a', window: '#ffd27a' },
  { wall: '#7d6b58', trim: '#c19a49', roof: '#466b5f', window: '#fff0c0' },
];

type Ctx = { world: BrassWorld; r: Rng; say(text: string, x: number, y: number, color?: string): void; emit(type: string, x: number, y: number, weight: number): void; chronicle(text: string): void; spawn(kind: ShipKind, extra?: Partial<Ship>): Ship };

const LIBRARY: SystemDef<Ctx>[] = [
  {
    id: 'pirates',
    label: 'sky pirates',
    weight: 5,
    tags: ['threat'],
    create: (c) => ({
      id: 'pirates',
      step() {
        const w = c.world;
        if (w.t < 90 || w.ships.some((s) => s.alive && s.kind === 'pirate')) return;
        const prey = w.ships.filter((s) => s.alive && s.kind === 'freighter' && (s.state === 'cruise' || s.state === 'depart') && s.z >= 0.9);
        if (!prey.length || !w.director.want('pirates', 0.8, 240)) return;
        const p = prey[Math.floor(c.r() * prey.length)];
        const fromLeft = p.dir > 0;
        const pirate = c.spawn('pirate', { x: fromLeft ? -260 * w.u : w.GW + 260 * w.u, y: p.y - 30 * w.u, dir: fromLeft ? 1 : -1, z: 1, state: 'chase', target: p.id });
        p.state = 'flee';
        p.speed *= 1.25;
        c.say(`SKY PIRATES! ${pirate.name} RUNS DOWN THE ${p.name}`, w.GW / 2, w.GH * 0.12, '#fca5a5');
        c.emit('pirates', pirate.x, pirate.y, 0.8);
        c.chronicle(`${titled(pirate.name)} came out of the clouds after the ${titled(p.name)}.`);
        w.director.look('pirates', (pirate.x + p.x) / 2, p.y, 1.6, 16, 7);
        // The navy answers.
        const naval = w.masts.find((m) => m.naval);
        for (let k = 0; k < 2; k++) {
          const cv = c.spawn('corvette', { x: naval ? naval.x : w.GW / 2, y: (naval ? naval.top : w.GH * 0.3) + 30 * w.u + k * 40 * w.u, dir: pirate.x < (naval?.x ?? 0) ? -1 : 1, z: 1, state: 'fight', target: pirate.id });
          cv.t0 = w.t + k * 3;
        }
        c.say('THE ADMIRALTY SCRAMBLES ITS CORVETTES', naval ? naval.x : w.GW / 2, (naval ? naval.top : w.GH * 0.3) - 20, '#bfdbfe');
      },
    }),
  },
  {
    id: 'storms',
    label: 'storms',
    weight: 4,
    tags: ['weather'],
    create: (c) => {
      let stormUntil = -1;
      return {
      id: 'storms',
      step(dt) {
        const w = c.world;
        if (w.storm < 0.05 && w.director.want('storm', 0.45, 260)) {
          stormUntil = w.t + 60 + c.r() * 40;
          c.say('A STORM COMES IN OVER THE ROOFTOPS; THE SHIPS MAKE FAST', w.GW / 2, w.GH * 0.14, '#cbd5e1');
          c.emit('storm', w.GW / 2, w.GH * 0.2, 0.5);
        }
        const want = w.t < stormUntil ? 1 : 0;
        w.storm += (want - w.storm) * Math.min(1, dt * 0.15);
        if (w.storm > 0.6 && c.r() < dt * 0.25) {
          // Lightning finds the tallest iron.
          const m = [...w.masts].sort((a, b) => a.top - b.top)[0];
          const tx = m ? m.x : c.r() * w.GW;
          const ty = m ? m.top - 30 * w.u : w.GY;
          const pts: [number, number][] = [];
          let x = tx + (c.r() - 0.5) * 300 * w.u;
          for (let y = 0; y < ty; y += 20 + c.r() * 30) {
            pts.push([x, y]);
            x += (tx - x) * 0.25 + (c.r() - 0.5) * 40 * w.u;
          }
          pts.push([tx, ty]);
          w.bolts.push({ pts, t0: w.t });
          for (let k = 0; k < 10; k++) w.fx.push({ kind: 'spark', x: tx, y: ty, vx: (c.r() - 0.5) * 200, vy: -c.r() * 160, t0: w.t, dur: 0.8, r: 2, color: '#e0f2fe', seed: k });
          c.emit('lightning', tx, ty, 0.6);
          if (c.r() < 0.3) c.say(`LIGHTNING STRIKES ${m ? m.name : 'THE CITY'}`, tx, ty - 30, '#e0f2fe');
        }
      },
      };
    },
  },
  {
    id: 'races',
    label: 'air races',
    weight: 3,
    tags: ['spectacle'],
    create: (c) => ({
      id: 'races',
      step() {
        const w = c.world;
        if (w.race || w.t < 120 || w.storm > 0.3 || !w.director.want('race', 0.6, 420)) return;
        const colors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e', '#a855f7'];
        const ids: number[] = [];
        for (let k = 0; k < 4; k++) {
          const s = c.spawn('racer', { x: -60 * w.u - k * 30 * w.u, y: w.GH * (0.18 + k * 0.03), dir: 1, z: 1, state: 'race', colors: [colors[k], '#f5f5f4', '#292524'] });
          s.speed = (95 + c.r() * 25) * w.u;
          ids.push(s.id);
        }
        w.race = { t0: w.t, laps: 2, ids };
        c.say('THE AIR RACE: FOUR RACERS ROUND THE SPIRES', w.GW / 2, w.GH * 0.12, '#fde68a');
        c.emit('race', w.GW / 2, w.GH * 0.2, 0.6);
        w.director.look('race', w.GW / 2, w.GH * 0.3, 1.3, 14, 6);
      },
    }),
  },
  {
    id: 'festival',
    label: 'festivals',
    weight: 3,
    tags: ['spectacle'],
    create: (c) => ({
      id: 'festival',
      step(dt) {
        const w = c.world;
        const night = w.day < 0.22 || w.day > 0.82;
        if (night && w.festival < w.t && w.storm < 0.2 && w.director.want('festival', 0.5, 600)) {
          w.festival = w.t + 40;
          c.say(`THE FESTIVAL OF ${pickOf(c.r, ['LANTERNS', 'THE FIRST FLIGHT', 'ST. ELMO', 'THE GUILDS', 'THE COMET'])}: FIREWORKS OVER ${w.name}`, w.GW / 2, w.GH * 0.12, '#fde68a');
          c.emit('festival', w.GW / 2, w.GH * 0.25, 0.6);
          c.chronicle('The city held a festival, and the sky was full of fireworks.');
        }
        if (w.festival > w.t && c.r() < dt * 2.2) {
          const x = w.GW * (0.15 + c.r() * 0.7);
          const y = w.GH * (0.08 + c.r() * 0.25);
          const color = pickOf(c.r, ['#fca5a5', '#fde68a', '#93c5fd', '#86efac', '#f0abfc', '#ffffff']);
          for (let k = 0; k < 28; k++) {
            const a = (k / 28) * Math.PI * 2;
            const v = (60 + c.r() * 40) * w.u;
            w.fx.push({ kind: 'firework', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: w.t, dur: 1.8, r: 1.5, color, seed: k });
          }
          if (c.r() < 0.4) c.emit('firework', x, y, 0.2);
        }
      },
    }),
  },
  {
    id: 'shipyard',
    label: 'the shipyard',
    weight: 4,
    tags: ['wonder'],
    create: (c) => ({
      id: 'shipyard',
      step(dt) {
        const w = c.world;
        const y = w.shipyard;
        if (!y) return;
        y.progress = Math.min(1, y.progress + dt / 360);
        if (y.progress >= 1 && w.director.want('launch', 0.9, 120)) {
          const s = c.spawn('leviathan', { name: y.name, x: y.x, y: y.base - 120 * w.u, dir: y.x < w.GW / 2 ? 1 : -1, z: 1, state: 'launch', from: 'NEW FROM THE YARD' });
          s.t0 = w.t;
          c.say(`THE ${y.name} IS LAUNCHED: THE GREATEST SHIP EVER BUILT`, y.x, y.base - 260 * w.u, '#fde68a');
          c.emit('launch', y.x, y.base, 1);
          c.chronicle(`The ${titled(y.name)} was launched from the yards.`);
          w.director.look('launch', y.x, y.base - 160 * w.u, 1.5, 16, 8);
          for (let k = 0; k < 40; k++) w.fx.push({ kind: 'firework', x: y.x + (c.r() - 0.5) * 200 * w.u, y: y.base - 200 * w.u, vx: (c.r() - 0.5) * 120, vy: -c.r() * 120, t0: w.t + c.r(), dur: 1.6, r: 1.5, color: pickOf(c.r, ['#fde68a', '#ffffff', '#fca5a5']), seed: k });
          y.progress = 0;
          y.name = `${pickOf(c.r, ['PRIDE', 'GLORY', 'SPIRIT', 'STAR', 'WONDER', 'LION', 'HEART'])} OF ${w.name}`;
        }
      },
    }),
  },
  {
    id: 'walker',
    label: 'the walking engine',
    weight: 2,
    tags: ['wonder'],
    create: (c) => ({
      id: 'walker',
      step(dt) {
        const w = c.world;
        if (!w.walker) {
          if (w.t > 200 && w.director.want('walker', 0.7, 700)) {
            const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
            w.walker = { x: dir > 0 ? -120 * w.u : w.GW + 120 * w.u, dir, t0: w.t, step: 0 };
            c.say('THE WALKING ENGINE STRIDES THROUGH THE LOWER TOWN', w.GW / 2, w.GY - 220 * w.u, '#fdba74');
            c.emit('walker', w.GW / 2, w.GY, 0.7);
            c.chronicle('The Walking Engine strode through the lower town, and everyone came out to see.');
          }
          return;
        }
        const wk = w.walker;
        wk.step += dt;
        wk.x += wk.dir * 26 * w.u * dt;
        if (Math.floor(wk.step / 1.2) !== Math.floor((wk.step - dt) / 1.2)) {
          for (let k = 0; k < 6; k++) w.fx.push({ kind: 'steam', x: wk.x + (c.r() - 0.5) * 40 * w.u, y: w.groundAt(wk.x) - 2, vx: (c.r() - 0.5) * 30, vy: -10, t0: w.t, dur: 2, r: 8 * w.u, color: '#e7e5e4', seed: k });
          c.emit('stomp', wk.x, w.GY, 0.1);
        }
        if (wk.x < -200 * w.u || wk.x > w.GW + 200 * w.u) w.walker = null;
      },
    }),
  },
  {
    id: 'comet',
    label: 'the great comet',
    weight: 1,
    tags: ['omen'],
    create: (c) => ({
      id: 'comet',
      step() {
        const w = c.world;
        const night = w.day < 0.2 || w.day > 0.85;
        if (w.comet || !night || w.t < 500 || !w.director.want('comet', 1, 2000) || c.r() < 0.5) return;
        w.comet = { t0: w.t };
        c.say('THE GREAT COMET CROSSES THE SKY OVER ' + w.name, w.GW / 2, w.GH * 0.1, '#e0f2fe');
        c.emit('comet', w.GW / 2, w.GH * 0.1, 1);
        c.chronicle('The great comet crossed the sky, and the whole city stood on its roofs to watch.');
      },
    }),
  },
];
const RULE = { total: [3, 5] as [number, number], quota: { threat: [0, 1] as [number, number], weather: [0, 1] as [number, number], spectacle: [1, 2] as [number, number] } };

function titled(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}
function pickOf<T>(r: Rng, a: readonly T[]): T {
  return a[Math.floor(r() * a.length)];
}

export function createBrass(seed: string | number, W: number, H: number, opts: BrassOptions): BrassWorld {
  const bus = createBus(() => world.t);
  const r: Rng = forkRng(seed, 'brass');
  const shotR: Rng = forkRng(seed, 'brass-shots');
  const g: Genome = createGenome(seed, 'brass');
  const GW = Math.round(W * WORLD_SCALE);
  const GH = Math.round(H * WORLD_SCALE);
  const u = Math.max(0.42, Math.min(1.1, Math.min(GW, GH * 1.6) / 1600));
  const traffic = Math.max(0.3, Math.min(2.5, opts.traffic));
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  let ids = 1;

  // ---- the land -----------------------------------------------------------------------------------
  const site = g.weighted<Site>({ crag: 4, canal: 3, decks: 4 });
  const side: 1 | -1 = g.chance(0.5) ? 1 : -1;
  const GY = Math.round(GH * (site === 'canal' ? 0.8 : 0.84));
  const hasRiver = site === 'canal' || g.chance(0.6);
  const cragC = side > 0 ? GW * g.range(0.66, 0.78) : GW * g.range(0.22, 0.34);
  const cragW = GW * g.range(0.16, 0.22);
  const cragH = GH * g.range(0.24, 0.32);
  const terraceH = GH * g.range(0.12, 0.18);
  const tier = Math.max(14, Math.round(26 * u));
  const groundAt = (x: number) => {
    let h = 0;
    if (site === 'crag') {
      // A rock with a broad top and sheer sides.
      const d = Math.abs(x - cragC) / cragW;
      h = cragH * Math.max(0, Math.min(1, (1 - d) / 0.22));
    } else if (site === 'decks') {
      // Iron decks on girders: two levels stepping up toward the middle.
      const d = Math.abs(x - GW / 2) / (GW * 0.5);
      h = d < 0.32 ? terraceH * 1.6 : d < 0.66 ? terraceH * 0.8 : 0;
    }
    return GY - Math.round(h / tier) * tier;
  };

  // ---- the world --------------------------------------------------------------------------------
  // eslint-disable-next-line prefer-const
  let world: BrassWorld;
  world = {
    t: 0, W, H, GW, GH, u, bus,
    director: createDirector(forkRng(seed, 'brass-director'), { arc: g.pick(ARCS), period: g.range(360, 720), establish: () => establish() }),
    name: g.pick(CITIES), site, side, year: g.int(1872, 1909), season: g.int(0, 3), cast: [], castIds: [],
    day: g.range(0.3, 0.45), groundAt, GY, river: hasRiver ? GY + Math.round(12 * u) : null,
    buildings: [], masts: [], links: [], riders: [], lamps: [],
    ships: [], fliers: [], flocks: [], boats: [], fx: [], bolts: [],
    storm: 0, smog: g.range(0.2, 0.7), wind: g.range(-1, 1) * 14, lampsLit: 0,
    shipyard: null, walker: null, comet: null, festival: -1, race: null, version: 0,
    labels: [], chronicle: [],
    step, nudge,
    counts: () => ({
      ships: world.ships.filter((s) => s.alive).length,
      docked: world.ships.filter((s) => s.alive && s.state === 'docked').length,
      buildings: world.buildings.length,
      masts: world.masts.length,
      floors: world.buildings.reduce((sum, b) => sum + b.floors, 0),
      riders: world.riders.length,
      fx: world.fx.length,
    }),
  };

  const say = (text: string, x: number, y: number, color = '#f5e6c8') => {
    if (world.labels.some((l) => l.text === text && world.t - l.t0 < 6)) return;
    world.labels.push({ text, x, y, t0: world.t, color });
    if (world.labels.length > 6) world.labels.shift();
    bus.emit({ type: 'say', text, x, y, priority: 'high' });
  };
  const emit = (type: string, x: number, y: number, weight: number) => {
    bus.emit({ type, x, y, weight });
    world.director.note(weight * 0.4);
  };
  const chronicle = (text: string) => {
    world.chronicle.push({ t: world.t, text });
    if (world.chronicle.length > 12) world.chronicle.shift();
  };

  // ---- the city ---------------------------------------------------------------------------------
  const palette = g.shuffle(WALLS);
  const wallFor = (k: number) => palette[k % palette.length];
  const roofFor = (kind: BKind): Roof => {
    if (kind === 'clock') return 'clock';
    if (kind === 'observatory') return 'observatory';
    if (kind === 'cathedral') return 'spire';
    if (kind === 'factory') return 'sawtooth';
    if (kind === 'engine') return 'flat';
    if (kind === 'guild') return pick(['dome', 'cupola', 'mansard']);
    if (kind === 'tower') return pick(['spire', 'onion', 'dome', 'mansard', 'cupola', 'flat']);
    if (kind === 'warehouse') return pick(['gable', 'flat', 'sawtooth']);
    return pick(['mansard', 'gable', 'gable', 'flat', 'mansard']);
  };
  const addBuilding = (kind: BKind, x: number, w: number, floors: number, layer: 0 | 1, extra: Partial<Building> = {}) => {
    const set = wallFor(Math.floor(r() * 99));
    const b: Building = {
      id: world.buildings.length, kind, x, w, base: groundAt(x + w / 2), floors, floorH: Math.round((kind === 'cathedral' || kind === 'guild' || kind === 'engine' ? 30 : kind === 'factory' ? 34 : 22) * u * (layer ? 1 : 0.7)),
      target: floors, roof: roofFor(kind), wall: set.wall, trim: set.trim, roofColor: set.roof, window: set.window, seed: Math.floor(r() * 1e6), scaffold: -1, layer,
      chimneys: kind === 'engine' ? [0.16, 0.5, 0.84] : kind === 'factory' ? [0.2, 0.5, 0.8].slice(0, 1 + Math.floor(r() * 3)) : kind === 'house' && r() < 0.6 ? [r() < 0.5 ? 0.25 : 0.75] : kind === 'tower' && r() < 0.4 ? [0.8] : [],
      gas: r(), name: '', ...extra,
    };
    world.buildings.push(b);
    return b;
  };
  // The far row: a skyline behind, smaller and hazier.
  for (let x = -20; x < GW + 20; ) {
    const w = (30 + r() * 60) * u;
    const center = 1 - Math.abs(x / GW - 0.5) * 1.4;
    addBuilding(r() < 0.25 ? 'tower' : 'house', x, w, Math.max(5, Math.round((7 + r() * 12 + center * 16) * (site === 'canal' ? 1 : 0.9))), 0);
    x += w + r() * 10 * u;
  }
  // The main row, with its landmarks placed first.
  const landmarks: [BKind, number, number][] = [
    ['engine', g.range(0.4, 0.6), 0],
    ['clock', g.range(0.2, 0.8), 0],
    ['cathedral', g.range(0.12, 0.3), 0],
    ['observatory', g.range(0.6, 0.86), 0],
    ['guild', g.range(0.3, 0.7), 0],
    ['gasometer', g.range(0.05, 0.95), 0],
    ['factory', g.range(0.05, 0.95), 0],
  ];
  if (g.chance(0.6)) landmarks.push(['factory', g.range(0.05, 0.95), 0]);
  if (g.chance(0.5)) landmarks.push(['gasometer', g.range(0.05, 0.95), 0]);
  const taken: [number, number][] = [];
  const free = (x: number, w: number) => taken.every(([a, b]) => x + w < a - 8 * u || x > b + 8 * u);
  const sizeOf: Record<BKind, [number, number, number, number]> = {
    engine: [210, 250, 11, 12], clock: [74, 92, 17, 21], cathedral: [130, 170, 6, 7], observatory: [90, 110, 8, 10], guild: [130, 170, 7, 9], gasometer: [80, 110, 1, 1], factory: [130, 180, 5, 6],
    house: [44, 80, 5, 10], tower: [50, 72, 14, 25], shipyard: [0, 0, 0, 0], warehouse: [80, 120, 3, 5],
  };
  for (const [kind, f] of landmarks) {
    const [w0, w1, f0, f1] = sizeOf[kind];
    const w = (w0 + r() * (w1 - w0)) * u;
    let x = f * GW - w / 2;
    for (let k = 0; k < 20 && !free(x, w); k++) x = (0.05 + r() * 0.9) * GW - w / 2;
    if (!free(x, w)) continue;
    taken.push([x, x + w]);
    const b = addBuilding(kind, x, w, Math.round(f0 + r() * (f1 - f0)), 1);
    if (kind === 'guild') b.name = pick(GUILDS);
    if (kind === 'clock') b.name = 'THE CLOCKTOWER';
    if (kind === 'cathedral') b.name = 'THE CATHEDRAL';
    if (kind === 'observatory') b.name = 'THE OBSERVATORY';
    if (kind === 'engine') b.name = 'THE GREAT ENGINE';
  }
  // The masts: the grand one on the highest ground, the Admiralty's to one side, one or two more.
  const nMasts = Math.max(2, Math.min(4, Math.round(g.range(2, 4.4) * Math.sqrt(u))));
  const mastSpots: number[] = [];
  const high = (() => {
    let best = GW / 2;
    for (let x = GW * 0.1; x < GW * 0.9; x += 10) if (groundAt(x) < groundAt(best)) best = x;
    return best;
  })();
  mastSpots.push(high);
  for (let k = 0; k < 40 && mastSpots.length < nMasts; k++) {
    const x = GW * (0.08 + r() * 0.84);
    if (mastSpots.every((m) => Math.abs(m - x) > GW * 0.18)) mastSpots.push(x);
  }
  const usedMastNames = new Set<string>();
  mastSpots.forEach((x, k) => {
    const mw = 26 * u;
    taken.push([x - mw, x + mw]);
    let name = k === 0 ? 'THE GRAND MAST' : pick(MASTS.slice(1));
    for (let j = 0; j < 6 && usedMastNames.has(name); j++) name = pick(MASTS.slice(1));
    usedMastNames.add(name);
    const base = groundAt(x);
    const height = (k === 0 ? GH * g.range(0.5, 0.58) : GH * g.range(0.36, 0.48)) - (GY - base) * 0.6;
    world.masts.push({ id: k, x, base, top: Math.max(GH * 0.1, base - height), ship: -1, naval: k === mastSpots.length - 1 && k > 0, grand: k === 0, name: k === mastSpots.length - 1 && k > 0 ? 'THE ADMIRALTY MAST' : name, built: 1 });
  });
  // The shipyard, at one end, when the cast has one (its frame is drawn regardless of a hull).
  const yardX = side > 0 ? GW * g.range(0.17, 0.23) : GW * g.range(0.77, 0.83);
  // Fill the rest with houses, towers and warehouses, taller toward the middle and on the heights.
  for (let x = -10; x < GW + 10; ) {
    const w = (40 + r() * 46) * u;
    if (!free(x, w)) {
      x += 12 * u;
      continue;
    }
    taken.push([x, x + w]);
    const lift = (GY - groundAt(x + w / 2)) / Math.max(1, GH * 0.3);
    const center = 1 - Math.abs((x + w / 2) / GW - 0.5) * 1.6;
    const tall = r() < 0.22 + center * 0.15;
    const kind: BKind = tall ? 'tower' : r() < 0.12 ? 'warehouse' : 'house';
    const [, , f0, f1] = sizeOf[kind];
    const floors = Math.max(2, Math.round((f0 + r() * (f1 - f0)) * (0.7 + center * 0.5 + lift * 0.3)));
    const b = addBuilding(kind, x, kind === 'warehouse' ? w * 1.4 : w, floors, 1);
    b.target = floors + Math.floor(r() * 4);
    x += b.w + r() * 6 * u;
  }
  world.buildings.sort((a, b) => a.layer - b.layer || a.x - b.x);
  world.buildings.forEach((b, i) => (b.id = i));
  const main = world.buildings.filter((b) => b.layer === 1);
  const topOf = (b: Building) => b.base - b.floors * b.floorH;

  // Viaducts, cable lines, pneumatic tubes.
  const towers = main.filter((b) => b.kind === 'tower' || b.kind === 'clock' || b.kind === 'guild');
  for (let k = 0; k < 2; k++) {
    const y = GY - (k === 0 ? 46 : 120) * u;
    const a = GW * (0.05 + r() * 0.2);
    const b = GW * (0.6 + r() * 0.35);
    if (k === 1 && r() < 0.65) continue;
    world.links.push({ kind: 'viaduct', ax: a, ay: y, bx: b, by: y, sag: 0 });
  }
  for (const m of world.masts) {
    const t = towers.filter((b) => Math.abs(b.x + b.w / 2 - m.x) > GW * 0.12).sort((p, q) => Math.abs(p.x - m.x) - Math.abs(q.x - m.x))[0];
    if (t) world.links.push({ kind: 'cable', ax: m.x, ay: m.top + 60 * u, bx: t.x + t.w / 2, by: topOf(t) + 10 * u, sag: 30 * u });
  }
  for (let k = 0; k < 4; k++) {
    const a = main[Math.floor(r() * main.length)];
    const b = main.find((x) => x.x > a.x + 120 * u && x.x < a.x + 420 * u);
    if (!b) continue;
    const y = Math.max(topOf(a), topOf(b)) + 18 * u + r() * 40 * u;
    if (y > GY - 20 * u) continue;
    world.links.push({ kind: 'tube', ax: a.x + a.w, ay: y, bx: b.x, by: y, sag: 0 });
  }
  world.links.forEach((l, i) => {
    const n = l.kind === 'viaduct' ? 2 : l.kind === 'cable' ? 1 : 2;
    for (let k = 0; k < n; k++) world.riders.push({ link: i, u: r(), dir: r() < 0.5 ? 1 : -1, speed: l.kind === 'tube' ? 0.6 + r() * 0.4 : l.kind === 'cable' ? 0.04 + r() * 0.03 : 0.05 + r() * 0.04, kind: l.kind === 'viaduct' ? 'tram' : l.kind === 'cable' ? 'car' : 'capsule', wait: 0 });
  });
  // Street lamps along the viaducts and the ground, lit from one end at dusk.
  for (let x = 20 * u; x < GW; x += 46 * u) world.lamps.push([x, groundAt(x) - 22 * u]);
  for (const l of world.links) if (l.kind === 'viaduct') for (let x = l.ax; x < l.bx; x += 60 * u) world.lamps.push([x, l.ay - 18 * u]);
  world.lamps.sort((a, b) => (side > 0 ? a[0] - b[0] : b[0] - a[0]));
  // Life in the air and on the river.
  for (let k = 0; k < Math.round(5 + 4 * u); k++) world.fliers.push({ x: r() * GW, y: GH * (0.2 + r() * 0.45), vx: (r() < 0.5 ? -1 : 1) * (30 + r() * 30) * u, vy: 0, phase: r() * 10, kind: pick(['ornithopter', 'ornithopter', 'gyro', 'kite']) });
  const clock = main.find((b) => b.kind === 'clock');
  for (let k = 0; k < 3; k++) {
    const home: [number, number] = clock && k === 0 ? [clock.x + clock.w / 2, topOf(clock) - 20 * u] : [GW * (0.15 + r() * 0.7), GY - (100 + r() * 200) * u];
    world.flocks.push({ x: home[0], y: home[1], vx: 0, vy: 0, n: 8 + Math.floor(r() * 10), scatter: 0, home, seed: Math.floor(r() * 1e6) });
  }
  if (world.river !== null) for (let k = 0; k < 3; k++) world.boats.push({ x: r() * GW, dir: r() < 0.5 ? 1 : -1, kind: r() < 0.5 ? 'barge' : 'paddle', seed: Math.floor(r() * 1e6) });

  // ---- ships ----------------------------------------------------------------------------------
  const LEN: Record<ShipKind, number> = { liner: 250, freighter: 170, corvette: 100, pirate: 150, courier: 60, balloon: 34, racer: 46, leviathan: 400 };
  const SPEED: Record<ShipKind, number> = { liner: 26, freighter: 22, corvette: 60, pirate: 46, courier: 55, balloon: 8, racer: 100, leviathan: 16 };
  const COLORS: Record<ShipKind, [string, string, string][]> = {
    liner: [['#efe4cc', '#a0302a', '#c9a227'], ['#e8e2d4', '#1e3a8a', '#d4af37'], ['#f3ead8', '#14532d', '#b8860b']],
    freighter: [['#9c8e78', '#5b4636', '#8a6f3d'], ['#8a8f7a', '#4b5320', '#a0784a'], ['#a39176', '#6b3a2a', '#9a7b4f']],
    corvette: [['#6b7280', '#1f2937', '#d4af37']],
    pirate: [['#2a2024', '#7f1d1d', '#a3a3a3'], ['#1f1a17', '#991b1b', '#78716c']],
    courier: [['#d6c7a1', '#0f766e', '#b45309'], ['#cbd5e1', '#7c2d12', '#ca8a04']],
    balloon: [['#dc2626', '#fde68a', '#78350f'], ['#2563eb', '#f5f5f4', '#78350f'], ['#16a34a', '#fde68a', '#78350f']],
    racer: [['#ef4444', '#f5f5f4', '#292524']],
    leviathan: [['#f5efe0', '#7c2d12', '#d4af37']],
  };
  const NAMES: Record<ShipKind, readonly string[]> = { liner: LINERS, freighter: FREIGHTERS, corvette: NAVY, pirate: PIRATES, courier: COURIERS, balloon: ['THE BALLOON'], racer: ['RACER'], leviathan: ['LEVIATHAN'] };
  function spawn(kind: ShipKind, extra: Partial<Ship> = {}): Ship {
    const dir: 1 | -1 = r() < 0.5 ? 1 : -1;
    const z = extra.z ?? 1;
    const s: Ship = {
      id: ids++, kind, name: pick(NAMES[kind]), from: pick(FROM), x: dir > 0 ? -LEN[kind] * u : GW + LEN[kind] * u, y: GH * (0.12 + r() * 0.35), dir, speed: SPEED[kind] * u * (0.85 + r() * 0.3) * (0.6 + z * 0.4),
      len: LEN[kind] * u, z, state: 'cruise', t0: world.t, mast: -1, target: -1, hp: kind === 'leviathan' ? 20 : kind === 'liner' ? 8 : 5, cargo: 0, colors: pick(COLORS[kind]), bob: r() * 10, tilt: 0, fire: 0,
      flag: pick(['#b91c1c', '#1d4ed8', '#15803d', '#ca8a04', '#7e22ce']), lap: 0, alive: true, ...extra,
    };
    if (extra.dir !== undefined && extra.x === undefined) s.x = s.dir > 0 ? -s.len : GW + s.len;
    world.ships.push(s);
    return s;
  }
  /** A free mast for a ship of this size (the grand one for liners), or -1. */
  const freeMast = (s: Ship) => {
    const ok = world.masts.filter((m) => m.ship < 0 && (!m.naval || s.kind === 'corvette') && (s.kind !== 'liner' || m.grand || r() < 0.4));
    if (!ok.length) return -1;
    return ok.sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0].id;
  };
  /** Where a ship's nose meets its mast. */
  const dockAt = (s: Ship, m: Mast): [number, number] => [m.x - s.dir * (s.len * 0.5 + 8 * u), m.top + s.len * 0.12];

  // The opening: a ship or two at the masts already, others in the air, a few far off.
  for (const m of world.masts) {
    if (r() < 0.65) {
      const kind: ShipKind = m.naval ? 'corvette' : m.grand && r() < 0.6 ? 'liner' : r() < 0.6 ? 'freighter' : 'courier';
      const s = spawn(kind, { z: 1 });
      s.dir = m.x > GW / 2 ? 1 : -1;
      [s.x, s.y] = dockAt(s, m);
      s.state = 'docked';
      s.mast = m.id;
      s.t0 = -r() * 20;
      m.ship = s.id;
    }
  }
  for (let k = 0; k < 3; k++) {
    const s = spawn(pick(['freighter', 'courier', 'balloon'] as ShipKind[]), { z: 1 });
    s.x = r() * GW;
  }
  for (let k = 0; k < 5; k++) {
    const s = spawn(pick(['freighter', 'liner', 'courier'] as ShipKind[]), { z: 0.35 + r() * 0.35 });
    s.x = r() * GW;
    s.y = GH * (0.08 + r() * 0.25);
  }

  const ctx: Ctx = { world, r, say, emit, chronicle, spawn };
  const drawn = compose(g.fork('cast'), ctx, LIBRARY, RULE);
  const systems = drawn.map((d) => d.def.create(ctx, d.params, g.fork(d.def.id)));
  world.cast = drawn.map((d) => d.def.label ?? d.def.id);
  world.castIds = drawn.map((d) => d.def.id);
  if (world.castIds.includes('shipyard')) world.shipyard = { x: yardX, base: groundAt(yardX), progress: g.range(0.1, 0.5), name: `${pick(['PRIDE', 'GLORY', 'SPIRIT', 'STAR', 'WONDER'])} OF ${world.name}` };

  /** A quiet shot worth following: a docked ship, a ship coming in, the clock. Its own rng. */
  function establish(): { x: number; y: number; zoom: number } {
    if (!world?.ships) return { x: GW / 2, y: GH / 2, zoom: 1 };
    const pool = world.ships.filter((s) => s.alive && s.z >= 0.9 && s.x > 0 && s.x < GW);
    const s = pool[Math.floor(shotR() * pool.length)];
    if (s && shotR() < 0.7) return { x: s.x, y: s.y + 30 * u, zoom: 1.7 + shotR() * 0.5 };
    const b = world.buildings.filter((x) => x.layer === 1 && (x.kind !== 'house' || shotR() < 0.2));
    const t = b[Math.floor(shotR() * b.length)];
    return t ? { x: t.x + t.w / 2, y: topOf(t) + 40 * u, zoom: 1.8 + shotR() * 0.4 } : { x: GW / 2, y: GH / 2, zoom: 1 };
  }

  // ---- the ships at work -----------------------------------------------------------------------
  function shipStep(s: Ship, dt: number) {
    s.bob += dt;
    const wind = world.wind * (0.3 + world.storm);
    switch (s.state) {
      case 'cruise': {
        s.x += s.dir * s.speed * dt + wind * dt * 0.2;
        s.y += Math.sin(s.bob * 0.4) * 2 * dt;
        // Near ships put in at a mast when one is free (not in a storm).
        if (s.z >= 0.9 && s.kind !== 'balloon' && s.kind !== 'racer' && world.storm < 0.4 && s.x > GW * 0.05 && s.x < GW * 0.95 && world.t - s.t0 > 6) {
          const m = freeMast(s);
          if (m >= 0 && r() < dt * 0.25) {
            const mm = world.masts[m];
            mm.ship = s.id;
            s.mast = m;
            s.state = 'approach';
            s.t0 = world.t;
            s.dir = mm.x > s.x ? 1 : -1;
            if (s.kind === 'liner') {
              say(`THE ${s.name} ARRIVES ${s.from}`, mm.x, mm.top - 40 * u, '#fde68a');
              emit('arrive', mm.x, mm.top, 0.5);
            }
          }
        }
        if (s.x < -s.len * 1.5 || s.x > GW + s.len * 1.5) s.alive = false;
        break;
      }
      case 'approach': {
        const m = world.masts[s.mast];
        const [tx, ty] = dockAt(s, m);
        const dx = tx - s.x;
        const dy = ty - s.y;
        const d = Math.hypot(dx, dy);
        const v = Math.min(s.speed, Math.max(6 * u, d * 0.5));
        if (d > 2) {
          s.x += (dx / d) * v * dt;
          s.y += (dy / d) * v * dt;
          s.tilt = Math.max(-0.08, Math.min(0.08, dy / Math.max(1, d) * 0.2));
        } else {
          s.state = 'docked';
          s.t0 = world.t;
          s.tilt = 0;
          s.cargo = s.kind === 'freighter' ? 4 + Math.floor(r() * 4) : s.kind === 'liner' ? 3 : 1;
          emit('dock', m.x, m.top, s.kind === 'liner' ? 0.4 : 0.15);
          if (s.kind === 'liner' || r() < 0.25) say(`THE ${s.name} MAKES FAST AT ${m.name}`, m.x, m.top - 30 * u, '#f5e6c8');
        }
        break;
      }
      case 'docked': {
        const m = world.masts[s.mast];
        s.y = dockAt(s, m)[1] + Math.sin(s.bob * 0.6) * 1.5 * u + world.storm * Math.sin(s.bob * 3) * 3 * u;
        // Cargo comes down on the mast's crane, a crate at a time.
        if (s.cargo > 0 && r() < dt * 0.3) {
          s.cargo--;
          world.fx.push({ kind: 'crate', x: m.x, y: m.top + 20 * u, vx: 0, vy: 30 * u, t0: world.t, dur: (m.base - m.top) / (30 * u), r: 6 * u, color: '#8b5a2b', seed: s.id });
          if (r() < 0.3) emit('cargo', m.x, m.top, 0.08);
        }
        const stay = s.kind === 'liner' ? 50 : s.kind === 'corvette' ? 80 : 30;
        if (world.t - s.t0 > stay && s.cargo <= 0 && world.storm < 0.4) {
          s.state = 'depart';
          s.t0 = world.t;
          m.ship = -1;
          s.mast = -1;
          s.dir = (s.dir * -1) as 1 | -1;
          emit('depart', s.x, s.y, 0.15);
          if (s.kind === 'liner') say(`THE ${s.name} CASTS OFF ${pick(['FOR THE CAPE', 'FOR CALCUTTA', 'FOR THE NEW WORLD', 'FOR THE POLE', 'FOR THE ORIENT'])}`, s.x, s.y - 50 * u, '#f5e6c8');
        }
        break;
      }
      case 'depart': {
        s.x += s.dir * s.speed * Math.min(1, (world.t - s.t0) / 6) * dt;
        s.y -= 4 * u * dt;
        if (s.x < -s.len * 1.5 || s.x > GW + s.len * 1.5) s.alive = false;
        break;
      }
      case 'flee': {
        s.x += s.dir * s.speed * dt;
        s.y += Math.sin(s.bob * 1.4) * 6 * u * dt;
        if (s.x < -s.len * 1.5 || s.x > GW + s.len * 1.5) {
          s.alive = false;
          say(`THE ${s.name} GETS AWAY`, GW / 2, GH * 0.14, '#bbf7d0');
          emit('escape', GW / 2, GH * 0.2, 0.3);
        }
        break;
      }
      case 'chase':
      case 'fight': {
        const t = world.ships.find((x) => x.id === s.target && x.alive && x.state !== 'falling' && x.state !== 'wreck');
        if (world.t < s.t0) break;
        if (!t) {
          // The quarry is gone: pirates turn for the clouds, corvettes go home.
          s.state = s.kind === 'pirate' ? 'depart' : 'cruise';
          s.dir = s.kind === 'pirate' ? (s.x < GW / 2 ? -1 : 1) : s.dir;
          s.t0 = world.t;
          break;
        }
        const want = t.x - t.dir * (s.kind === 'pirate' ? 60 : 120) * u;
        const dx = want - s.x;
        const dy = t.y - (s.kind === 'pirate' ? 20 : -10) * u - s.y;
        s.dir = dx > 0 ? 1 : -1;
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), s.speed * dt * 1.1);
        s.y += Math.sign(dy) * Math.min(Math.abs(dy), s.speed * dt * 0.4);
        // Broadsides when close.
        if (Math.hypot(t.x - s.x, t.y - s.y) < 260 * u && r() < dt * 0.9) {
          for (let k = 0; k < 3; k++) world.fx.push({ kind: 'cannon', x: s.x + (r() - 0.5) * s.len * 0.4, y: s.y + s.len * 0.12, vx: (t.x - s.x) * 1.6, vy: (t.y - s.y) * 1.6, t0: world.t + k * 0.15, dur: 0.6, r: 3 * u, color: '#fde68a', seed: k });
          if (r() < 0.55) {
            t.hp -= 1;
            for (let k = 0; k < 6; k++) world.fx.push({ kind: 'spark', x: t.x + (r() - 0.5) * t.len * 0.5, y: t.y, vx: (r() - 0.5) * 100, vy: (r() - 0.5) * 100, t0: world.t + 0.6, dur: 0.6, r: 2, color: '#fdba74', seed: k });
          }
          emit('broadside', s.x, s.y, 0.35);
          if (t.hp <= 0) {
            t.state = 'burning';
            t.t0 = world.t;
            t.fire = 1;
            say(`THE ${t.name} IS HIT AND BURNING`, t.x, t.y - 50 * u, '#fdba74');
            emit('fire', t.x, t.y, 0.8);
            chronicle(`${t.kind === 'pirate' ? titled(t.name) : `The ${titled(t.name)}`} was shot afire over ${titled(world.name)}.`);
            world.director.look('fire', t.x, t.y, 1.6, 12, 7);
          }
        }
        break;
      }
      case 'burning': {
        s.fire = Math.min(3, s.fire + dt * 0.4);
        s.x += s.dir * s.speed * 0.4 * dt;
        s.y += 12 * u * dt;
        s.tilt = Math.min(0.35, s.tilt + dt * 0.04) * (s.dir > 0 ? 1 : -1);
        if (r() < dt * 3) world.fx.push({ kind: 'fire', x: s.x + (r() - 0.5) * s.len * 0.7, y: s.y - s.len * 0.08, vx: 0, vy: -20, t0: world.t, dur: 1.2, r: 8 * u, color: '#f97316', seed: 0 });
        if (r() < dt * 0.6) world.fx.push({ kind: 'chute', x: s.x, y: s.y + s.len * 0.15, vx: (r() - 0.5) * 20, vy: 12 * u, t0: world.t, dur: 14, r: 5 * u, color: '#f5f5f4', seed: Math.floor(r() * 99) });
        if (world.t - s.t0 > 8) {
          s.state = 'falling';
          s.t0 = world.t;
        }
        break;
      }
      case 'falling': {
        s.y += (30 + (world.t - s.t0) * 20) * u * dt;
        s.x += s.dir * s.speed * 0.3 * dt;
        if (r() < dt * 4) world.fx.push({ kind: 'smoke', x: s.x, y: s.y, vx: 0, vy: -15, t0: world.t, dur: 4, r: 12 * u, color: '#3f3f46', seed: 0 });
        const floor = world.river !== null ? world.river + 6 * u : groundAt(s.x);
        if (s.y > floor) {
          s.state = 'wreck';
          s.t0 = world.t;
          s.y = floor;
          for (let k = 0; k < 20; k++) world.fx.push({ kind: world.river !== null ? 'splash' : 'debris', x: s.x + (r() - 0.5) * s.len * 0.6, y: floor, vx: (r() - 0.5) * 120, vy: -r() * 160, t0: world.t, dur: 1.4, r: 3 * u, color: world.river !== null ? '#cbd5e1' : '#57534e', seed: k });
          emit('crash', s.x, floor, 0.8);
          say(`THE ${s.name} COMES DOWN ${world.river !== null ? 'IN THE RIVER' : 'IN THE LOWER TOWN'}`, s.x, floor - 60 * u, '#fca5a5');
        }
        break;
      }
      case 'wreck': {
        if (r() < dt * 1.5) world.fx.push({ kind: 'smoke', x: s.x + (r() - 0.5) * s.len * 0.4, y: s.y - 4, vx: world.wind, vy: -14, t0: world.t, dur: 5, r: 10 * u, color: '#44403c', seed: 0 });
        if (world.t - s.t0 > 90) s.alive = false;
        break;
      }
      case 'race': {
        // Twice round the spires: out to the far end low, back high.
        const lap = s.lap;
        s.x += s.dir * s.speed * dt;
        s.y += Math.sin(world.t * 2 + s.id) * 10 * u * dt;
        if ((s.dir > 0 && s.x > GW * 0.95) || (s.dir < 0 && s.x < GW * 0.05)) {
          s.dir = (s.dir * -1) as 1 | -1;
          s.y += (s.dir > 0 ? 1 : -1) * GH * 0.08;
          if (s.dir > 0) s.lap = lap + 1;
          s.speed *= 0.92 + r() * 0.16;
        }
        const race = world.race;
        if (race && s.lap >= race.laps && s.x > GW * 0.5) {
          const won = !world.ships.some((x) => x.alive && x.kind === 'racer' && x.lap >= race.laps && x.id !== s.id && x.state === 'cruise');
          s.state = 'cruise';
          s.t0 = world.t + 999;
          if (won) {
            const hue = ['RED', 'BLUE', 'GOLD', 'GREEN'][race.ids.indexOf(s.id)] ?? 'RED';
            say(`THE ${hue} RACER WINS THE AIR RACE`, s.x, s.y - 30 * u, '#fde68a');
            emit('racewin', s.x, s.y, 0.6);
            chronicle(`The ${hue.toLowerCase()} racer won the air race round the spires.`);
            for (let k = 0; k < 24; k++) world.fx.push({ kind: 'firework', x: s.x, y: s.y - 40 * u, vx: Math.cos(k) * 70 * u, vy: Math.sin(k) * 70 * u, t0: world.t, dur: 1.4, r: 1.5, color: s.colors[0], seed: k });
          }
        }
        break;
      }
      case 'launch': {
        s.y -= 6 * u * dt;
        s.x += s.dir * s.speed * Math.min(1, (world.t - s.t0) / 20) * dt;
        if (world.t - s.t0 > 40) {
          s.state = 'cruise';
          s.t0 = world.t + 999;
        }
        break;
      }
    }
    if (s.state !== 'docked' && s.state !== 'approach' && s.state !== 'burning' && s.state !== 'falling' && s.state !== 'wreck') s.tilt *= 1 - dt;
  }

  /** Fresh traffic, near and far, in proportion to the traffic option. */
  let nextShip = 2;
  function traffic_() {
    if (world.t < nextShip) return;
    nextShip = world.t + (7 + r() * 9) / traffic;
    const near = world.ships.filter((s) => s.alive && s.z >= 0.9).length;
    const far = world.ships.filter((s) => s.alive && s.z < 0.9).length;
    if (far < 6 && r() < 0.5) {
      const s = spawn(pick(['freighter', 'liner', 'courier', 'freighter'] as ShipKind[]), { z: 0.3 + r() * 0.4 });
      s.y = GH * (0.06 + r() * 0.26);
      return;
    }
    if (near >= 7 + Math.round(traffic * 2)) return;
    const roll = r();
    const kind: ShipKind = roll < 0.18 ? 'liner' : roll < 0.6 ? 'freighter' : roll < 0.85 ? 'courier' : 'balloon';
    const s = spawn(kind, { z: 1 });
    s.y = kind === 'balloon' ? GH * (0.3 + r() * 0.2) : GH * (0.1 + r() * 0.32);
    if (kind === 'liner' && r() < 0.5) {
      say(`THE ${s.name} IS SIGHTED, INBOUND ${s.from}`, s.dir > 0 ? GW * 0.2 : GW * 0.8, GH * 0.1, '#f5e6c8');
      emit('sighted', s.x, s.y, 0.25);
    }
  }

  // ---- the city's day --------------------------------------------------------------------------
  let lastHour = Math.floor(world.day * 24);
  let lastSeason = world.season;
  let nextBuild = 30;
  function cityStep(dt: number) {
    world.day = (world.day + dt / 240) % 1;
    const hour = Math.floor(world.day * 24);
    if (hour !== lastHour) {
      lastHour = hour;
      // The clock strikes the hours that matter; the pigeons go up.
      if (hour % 3 === 0 && hour >= 6) {
        const clk = main.find((b) => b.kind === 'clock');
        if (clk) {
          world.fx.push({ kind: 'bell', x: clk.x + clk.w / 2, y: topOf(clk) + clk.floorH * 2, vx: 0, vy: 0, t0: world.t, dur: 3, r: 10 * u, color: '#fde68a', seed: hour });
          for (const f of world.flocks) f.scatter = 6;
          if (hour === 12 || hour === 18 || r() < 0.3) say(`THE CLOCKTOWER STRIKES ${['', '', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'NOON'][hour > 12 ? hour - 12 : hour] || 'THE HOUR'}`, clk.x + clk.w / 2, topOf(clk) - 30 * u, '#fde68a');
          emit('chime', clk.x + clk.w / 2, topOf(clk), 0.3);
        }
      }
      if (hour === 19) {
        say('THE LAMPLIGHTERS GO OUT ALONG THE STREETS', GW / 2, GY - 60 * u, '#fde68a');
        emit('lamps', GW / 2, GY, 0.2);
      }
      if (hour === 6) {
        // A new day: the year turns with the seasons every few days.
        if (r() < 0.35) {
          world.season = (world.season + 1) % 4;
          if (world.season === 0) world.year++;
        }
        emit('dawn', GW / 2, GH * 0.3, 0.1);
      }
    }
    if (world.season !== lastSeason) {
      lastSeason = world.season;
      chronicle(`${titled(SEASONS[world.season])} came to ${titled(world.name)}${world.season === 0 ? `, in the year ${world.year}` : ''}.`);
    }
    // Lamps: lit from one end at dusk, put out at dawn.
    const dusk = world.day > 0.78 || world.day < 0.25;
    world.lampsLit = dusk ? Math.min(1, world.lampsLit + dt / 25) : Math.max(0, world.lampsLit - dt / 15);
    // Riders: trams wait at the ends, cars glide, capsules shoot.
    for (const rd of world.riders) {
      if (rd.wait > 0) {
        rd.wait -= dt;
        continue;
      }
      rd.u += rd.dir * rd.speed * dt;
      if (rd.u > 1 || rd.u < 0) {
        rd.u = Math.max(0, Math.min(1, rd.u));
        rd.dir = (rd.dir * -1) as 1 | -1;
        rd.wait = rd.kind === 'capsule' ? 1 + r() * 3 : 3 + r() * 4;
        if (rd.kind === 'capsule') {
          const l = world.links[rd.link];
          world.fx.push({ kind: 'steam', x: rd.u > 0.5 ? l.bx : l.ax, y: l.ay, vx: 0, vy: -8, t0: world.t, dur: 1.5, r: 5 * u, color: '#f5f5f4', seed: 0 });
        }
      }
    }
    // Smoke from the chimneys, steam from the vents.
    const pace = 1 + world.storm * 0.5;
    for (const b of main) {
      if (!b.chimneys.length) continue;
      const heavy = b.kind === 'factory' || b.kind === 'engine';
      if (r() < dt * (b.kind === 'engine' ? 4 : b.kind === 'factory' ? 1.6 : 0.25) * pace) {
        const cx = b.x + b.w * b.chimneys[Math.floor(r() * b.chimneys.length)];
        const cy = topOf(b) - (b.kind === 'engine' ? 110 : b.kind === 'factory' ? 70 : 16) * u;
        world.fx.push({ kind: 'smoke', x: cx, y: cy, vx: world.wind + (r() - 0.5) * 4, vy: -14 - r() * 10, t0: world.t, dur: 9 + r() * 6, r: (b.kind === 'engine' ? 14 : heavy ? 9 : 5) * u, color: heavy ? '#4a3f36' : '#8a7f72', seed: Math.floor(r() * 99) });
      }
    }
    if (r() < dt * 3) {
      const b = main[Math.floor(r() * main.length)];
      const x = b.x + b.w * (r() < 0.5 ? 0.08 : 0.92);
      const y = b.base - (0.2 + r() * 0.7) * (b.base - topOf(b));
      world.fx.push({ kind: 'steam', x, y, vx: world.wind * 0.5 + (r() - 0.5) * 10, vy: -16 - r() * 10, t0: world.t, dur: 2.5 + r() * 2, r: 5 * u, color: '#f5f5f4', seed: 0 });
    }
    // Gasometers breathe with the day's use.
    for (const b of main) if (b.kind === 'gasometer') b.gas = 0.55 + 0.4 * Math.sin(world.day * Math.PI * 2 + b.seed);
    // The city builds upward: a scaffold, then a floor.
    const building = main.find((b) => b.scaffold >= 0);
    if (building) {
      building.scaffold += dt / 25;
      if (building.scaffold >= 1) {
        building.scaffold = -1;
        building.floors++;
        world.version++;
        emit('floor', building.x + building.w / 2, topOf(building), 0.15);
        if (r() < 0.4) say(`A NEW STOREY IS RAISED ${building.name ? `ON ${building.name}` : 'IN THE UPPER TOWN'}`, building.x + building.w / 2, topOf(building) - 30 * u, '#f5e6c8');
      }
    } else if (world.t > nextBuild) {
      nextBuild = world.t + 30 + r() * 40;
      const can = main.filter((b) => b.floors < b.target && (b.kind === 'house' || b.kind === 'tower' || b.kind === 'warehouse'));
      const b = can[Math.floor(r() * can.length)];
      if (b) {
        b.scaffold = 0;
        world.version++;
      } else {
        // Room to grow again: the tallest towers set their sights higher.
        for (const t of main.filter((x) => x.kind === 'tower').slice(0, 3)) t.target += 2;
        if (world.masts.length < 5 && r() < 0.3) {
          const x = GW * (0.1 + r() * 0.8);
          if (world.masts.every((m) => Math.abs(m.x - x) > GW * 0.15)) {
            const base = groundAt(x);
            world.masts.push({ id: world.masts.length, x, base, top: Math.max(GH * 0.12, base - GH * g.range(0.34, 0.44)), ship: -1, naval: false, grand: false, name: pick(MASTS.slice(1)), built: 0 });
            say('A NEW MOORING MAST GOES UP', x, GY - GH * 0.4, '#f5e6c8');
            emit('newmast', x, GY, 0.5);
            chronicle(`A new mooring mast went up over ${titled(world.name)}.`);
          }
        }
      }
    }
    for (const m of world.masts) if (m.built < 1) {
      m.built = Math.min(1, m.built + dt / 60);
      world.version++;
    }
    // Fliers and flocks.
    for (const f of world.fliers) {
      f.phase += dt;
      f.x += f.vx * dt + world.wind * dt * 0.3;
      f.y += Math.sin(f.phase * 0.7) * 10 * u * dt;
      if (f.x < -40 || f.x > GW + 40) {
        f.vx = -f.vx;
        f.y = GH * (0.2 + r() * 0.45);
      }
    }
    for (const fl of world.flocks) {
      fl.scatter = Math.max(0, fl.scatter - dt);
      const a = world.t * 0.5 + fl.seed;
      const rad = (fl.scatter > 0 ? 160 : 50) * u;
      const tx = fl.home[0] + Math.cos(a) * rad;
      const ty = fl.home[1] + Math.sin(a * 1.3) * rad * 0.4 - (fl.scatter > 0 ? 40 * u : 0);
      fl.vx += (tx - fl.x) * dt * 0.8 - fl.vx * dt * 0.6;
      fl.vy += (ty - fl.y) * dt * 0.8 - fl.vy * dt * 0.6;
      fl.x += fl.vx * dt;
      fl.y += fl.vy * dt;
    }
    for (const b of world.boats) {
      b.x += b.dir * (b.kind === 'barge' ? 8 : 14) * u * dt;
      if (b.x < -80 * u || b.x > GW + 80 * u) b.dir = (b.dir * -1) as 1 | -1;
      if (b.kind === 'paddle' && r() < dt * 0.6) world.fx.push({ kind: 'smoke', x: b.x, y: (world.river ?? GY) - 26 * u, vx: world.wind, vy: -10, t0: world.t, dur: 5, r: 5 * u, color: '#78716c', seed: 0 });
    }
  }

  /** A touch: a flare in the sky calls the nearest ship in; on a building, its bells or its whistle. */
  let lastNudge = -Infinity;
  function nudge(x: number, y: number): string | null {
    if (world.t - lastNudge < 3) return null;
    const b = main.find((q) => x >= q.x && x <= q.x + q.w && y >= topOf(q) - 20 * u && y <= q.base);
    if (b) {
      lastNudge = world.t;
      if (b.kind === 'factory') {
        for (let k = 0; k < 8; k++) world.fx.push({ kind: 'steam', x: b.x + b.w * (0.2 + r() * 0.6), y: topOf(b) - 20 * u, vx: (r() - 0.5) * 20, vy: -40, t0: world.t + k * 0.1, dur: 3, r: 10 * u, color: '#f5f5f4', seed: k });
        say('THE FACTORY WHISTLE BLOWS', b.x + b.w / 2, topOf(b) - 50 * u, '#f5e6c8');
        emit('nudge', b.x + b.w / 2, topOf(b), 0.3);
        return 'THE FACTORY WHISTLE BLOWS';
      }
      world.fx.push({ kind: 'bell', x: b.x + b.w / 2, y: topOf(b), vx: 0, vy: 0, t0: world.t, dur: 3, r: 10 * u, color: '#fde68a', seed: 0 });
      for (const f of world.flocks) if (Math.hypot(f.x - x, f.y - y) < 300 * u) f.scatter = 5;
      const text = b.kind === 'cathedral' ? 'THE CATHEDRAL BELLS RING OUT' : b.kind === 'clock' ? 'THE CLOCKTOWER CHIMES' : `BELLS RING ${b.name ? `IN ${b.name}` : 'IN THE UPPER TOWN'}`;
      say(text, b.x + b.w / 2, topOf(b) - 40 * u, '#fde68a');
      emit('nudge', b.x + b.w / 2, topOf(b), 0.3);
      return text;
    }
    if (y < GY - 40 * u) {
      lastNudge = world.t;
      world.fx.push({ kind: 'flare', x, y, vx: 0, vy: -40 * u, t0: world.t, dur: 4, r: 4 * u, color: '#f87171', seed: 0 });
      const s = world.ships.filter((q) => q.alive && q.state === 'cruise' && q.z >= 0.9 && q.kind !== 'balloon' && q.kind !== 'racer').sort((a, c) => Math.hypot(a.x - x, a.y - y) - Math.hypot(c.x - x, c.y - y))[0];
      const m = s ? freeMast(s) : -1;
      if (s && m >= 0) {
        const mm = world.masts[m];
        mm.ship = s.id;
        s.mast = m;
        s.state = 'approach';
        s.t0 = world.t;
        s.dir = mm.x > s.x ? 1 : -1;
        const text = `A FLARE: THE ${s.name} TURNS IN FOR ${mm.name}`;
        say(text, x, y - 20 * u, '#fca5a5');
        emit('nudge', x, y, 0.3);
        return text;
      }
      say('A SIGNAL FLARE GOES UP OVER THE ROOFTOPS', x, y - 20 * u, '#fca5a5');
      emit('nudge', x, y, 0.3);
      return 'A SIGNAL FLARE GOES UP OVER THE ROOFTOPS';
    }
    return null;
  }

  function step(dt: number) {
    world.t += dt;
    world.director.step(world.t, dt);
    cityStep(dt);
    traffic_();
    for (const s of world.ships) if (s.alive) shipStep(s, dt);
    for (const sy of systems) sy.step?.(dt);
    // The race ends when its racers have all finished or flown off.
    if (world.race && !world.ships.some((s) => s.alive && s.kind === 'racer' && s.state === 'race')) world.race = null;
    for (const f of world.fx) {
      if (world.t < f.t0) continue;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.kind === 'firework' || f.kind === 'debris' || f.kind === 'splash' || f.kind === 'spark') f.vy += 90 * dt;
      if (f.kind === 'smoke' || f.kind === 'steam') {
        f.vx += (world.wind - f.vx) * dt * 0.3;
        f.r += dt * 2.2 * u;
      }
      if (f.kind === 'chute') f.x += Math.sin(world.t + f.seed) * 6 * dt;
    }
    world.fx = world.fx.filter((f) => world.t - f.t0 < f.dur);
    if (world.fx.length > 900) world.fx.splice(0, world.fx.length - 900);
    world.bolts = world.bolts.filter((b) => world.t - b.t0 < 0.5);
    world.ships = world.ships.filter((s) => s.alive);
    world.labels = world.labels.filter((l) => world.t - l.t0 < 6);
  }

  return world;
}
