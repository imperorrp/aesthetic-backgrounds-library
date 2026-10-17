/**
 * An airship's own build, from her seed: no two alike. What she has hung on her, bolted to her, and
 * trailing behind her: extra engine nacelles (propellers, ducted fans, paddle wheels), an exposed
 * engine car (pistons, a flywheel, a pusher screw), gear housings, pipe runs, boiler stacks, gas
 * cells, a lattice nose, an aerial, an advertising banner or a string of signal flags, an
 * observation basket on a cable, an anchor, a crane. Pure: the sim reads it too (for her steam).
 *
 * Coordinates are her own: +x forward (the bow), y down, her centre at 0.
 */
import type { Ship, ShipKind } from './types';

export const hsh = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Where her parts are: the envelope (if she has one), her gondola or hull, her keel. */
export type Dims = {
  env: { y: number; h: number; l: number; x: number } | null;
  /** Gondola (or hull): x0..x1, top..bot. */
  gx0: number; gx1: number; gTop: number; gBot: number;
  keel: number;
};
export function dimsOf(kind: ShipKind, L: number): Dims {
  switch (kind) {
    case 'zeppelin':
    case 'scout': {
      const Hh = L * (kind === 'scout' ? 0.24 : 0.19);
      return { env: { y: 0, h: Hh, l: L, x: 0 }, gx0: L * 0.1, gx1: L * (kind === 'scout' ? 0.32 : 0.28), gTop: Hh * 0.46, gBot: Hh * (kind === 'scout' ? 0.82 : 0.72), keel: Hh * 0.5 };
    }
    case 'liner': {
      const Hh = L * 0.15;
      return { env: { y: 0, h: Hh, l: L, x: 0 }, gx0: -L * 0.3, gx1: L * 0.3, gTop: Hh * 0.46, gBot: Hh * 1.08, keel: Hh * 0.46 };
    }
    case 'hauler': {
      const Hh = L * 0.27;
      return { env: { y: 0, h: Hh, l: L, x: 0 }, gx0: L * 0.3, gx1: L * 0.42, gTop: Hh * 0.46, gBot: Hh * 0.68, keel: Hh * 0.54 };
    }
    case 'twin': {
      const Hh = L * 0.12;
      return { env: { y: 0, h: Hh, l: L, x: 0 }, gx0: -L * 0.06, gx1: L * 0.1, gTop: Hh * 0.2, gBot: Hh * 0.9, keel: Hh * 0.5 };
    }
    case 'tender': {
      const Hh = L * 0.26;
      return { env: { y: 0, h: Hh, l: L, x: 0 }, gx0: -L * 0.25, gx1: L * 0.25, gTop: Hh * 0.55, gBot: Hh * 0.93, keel: Hh * 0.52 };
    }
    case 'galleon': {
      const D = L * 0.12;
      return { env: { y: -L * 0.52, h: L * 0.14, l: L * 0.86, x: 0 }, gx0: -L * 0.46, gx1: L * 0.44, gTop: -D * 0.4, gBot: D, keel: D };
    }
    case 'hulk': {
      const D = L * 0.12;
      return { env: null, gx0: -L * 0.46, gx1: L * 0.46, gTop: -D * 0.2, gBot: D, keel: D };
    }
    case 'junk': {
      const D = L * 0.13;
      return { env: null, gx0: -L * 0.44, gx1: L * 0.44, gTop: -D * 0.5, gBot: D, keel: D };
    }
    case 'gunship': {
      const H = L * 0.24;
      return { env: null, gx0: -L * 0.46, gx1: L * 0.42, gTop: -H * 0.5, gBot: H * 0.4, keel: H * 0.3 };
    }
    case 'dreadnought':
    case 'carrier': {
      const D = L * (kind === 'carrier' ? 0.075 : 0.1);
      return { env: null, gx0: -L * 0.47, gx1: L * 0.44, gTop: 0, gBot: D, keel: D };
    }
    default:
      return { env: null, gx0: -L * 0.2, gx1: L * 0.2, gTop: 0, gBot: L * 0.1, keel: L * 0.1 };
  }
}

export type NacelleKind = 'prop' | 'ducted' | 'twin' | 'pusher';
export type Nacelle = { at: number; drop: number; kind: NacelleKind; size: number };
export type Design = {
  cells: number; nose: boolean; aerial: boolean; banner: string | null; flags: boolean; basket: boolean; anchor: boolean;
  nacelles: Nacelle[]; engineCar: boolean; gears: boolean; pipes: boolean; stacks: number; dorsal: boolean;
  stripes: number; paddles: boolean; crane: boolean; ladder: boolean; spine: boolean; vanes: boolean;
};

const ADS = [
  'DRINK BLACKWATER STOUT', 'KESSEL BOILERS · NONE FINER', "COGSWORTH'S CLOCKS KEEP TIME", 'THE GRAND EXHIBITION · OPENS SUNDAY',
  'PNEUMATIC POST · FOUR MINUTES TO ANYWHERE', 'SMOKE ADMIRAL CIGARS', 'LYCEUM TONIGHT: THE IRON BALLET', 'TRAVEL BY AIR · IMPERIAL AIRWAYS',
  "DR. HALLORAN'S TONIC FOR THE LUNGS", 'ASHFORD FOR MAYOR', 'BRASS & COPPER · ALDGATE', 'STEAM LAUNDRY · BY THE POUND',
  'THE ROYAL AERO CLUB · REGATTA', 'VELOX CAMERAS', 'GASLIGHT COMPANY · LIGHT FOR ALL', 'MECHANICAL MARVELS · PIER 9',
];

const cache = new Map<number, Design>();
export function designOf(s: Ship): Design {
  let d = cache.get(s.id);
  if (d) return d;
  const h = (k: number) => hsh(s.seed, k + 0.5);
  const k = s.kind;
  const env = k === 'zeppelin' || k === 'liner' || k === 'hauler' || k === 'twin' || k === 'tender' || k === 'scout';
  const nac: Nacelle[] = [];
  if (env && k !== 'scout') {
    const n = h(1) < 0.3 ? 0 : h(1) < 0.75 ? 1 : 2;
    for (let q = 0; q < n; q++) nac.push({ at: -0.36 + q * 0.5 + h(2 + q) * 0.12, drop: 0.55 + h(4 + q) * 0.5, kind: (['prop', 'ducted', 'twin', 'prop'] as NacelleKind[])[Math.floor(h(6 + q) * 4)], size: 0.8 + h(8 + q) * 0.5 });
    if (h(10) < 0.45) nac.push({ at: -0.56, drop: 0, kind: 'pusher', size: 1 });
  }
  d = {
    cells: env ? (h(11) < 0.5 ? 0 : 3 + Math.floor(h(12) * 4)) : 0,
    nose: env && h(13) < 0.4,
    aerial: h(14) < 0.55,
    banner: (k === 'liner' && h(15) < 0.6) || ((k === 'zeppelin' || k === 'hauler' || k === 'junk') && h(15) < 0.32) ? ADS[Math.floor(h(16) * ADS.length)] : null,
    flags: (k === 'dreadnought' || k === 'galleon' || k === 'twin') && h(17) < 0.6,
    basket: (k === 'zeppelin' || k === 'liner') && h(18) < 0.3,
    anchor: (env || k === 'galleon' || k === 'hulk') && h(19) < 0.45,
    nacelles: nac,
    engineCar: (k === 'zeppelin' || k === 'hauler' || k === 'liner' || k === 'tender') && h(20) < 0.55,
    gears: h(21) < 0.5 && k !== 'balloon',
    pipes: h(22) < 0.6 && k !== 'balloon',
    stacks: k === 'balloon' || k === 'scout' ? 0 : h(23) < 0.4 ? 0 : h(23) < 0.8 ? 1 : 2,
    dorsal: (k === 'zeppelin' || k === 'twin') && (s.team === 1 || h(24) < 0.25),
    stripes: Math.floor(h(25) * 3),
    paddles: k === 'galleon' || ((k === 'junk' || k === 'hulk') && h(26) < 0.6) || (k === 'hauler' && h(26) < 0.25),
    crane: (k === 'hulk' || k === 'hauler' || k === 'dreadnought') && h(27) < 0.5,
    ladder: env && h(28) < 0.6,
    spine: env && h(29) < 0.35,
    vanes: k === 'gunship' || (env && h(30) < 0.3),
  };
  if (cache.size > 400) cache.clear();
  cache.set(s.id, d);
  return d;
}

/** Where her boiler stacks stand (her own coordinates): their tops. */
export function stacksOf(s: Ship): [number, number][] {
  const d = designOf(s);
  if (!d.stacks) return [];
  const D = dimsOf(s.kind, s.len);
  const out: [number, number][] = [];
  // Under an envelope, a stack is an exhaust out of the gondola's tail; on a deck, a funnel.
  const slung = !!D.env && D.env.y + D.env.h * 0.5 > D.gTop - 1;
  for (let q = 0; q < d.stacks; q++) {
    if (slung) out.push([D.gx0 - s.len * (0.03 + q * 0.025), D.gTop + (D.gBot - D.gTop) * (0.15 + q * 0.3)]);
    else out.push([D.gx0 + (D.gx1 - D.gx0) * (0.25 + q * 0.3), D.gTop - s.len * 0.07]);
  }
  if (d.engineCar && D.env) out.push([-s.len * 0.24, D.env.y + D.env.h * 0.5 + s.len * 0.03]);
  return out;
}

/** What a ship is, said plainly. */
export const KIND_NAMES: Record<ShipKind, string> = {
  zeppelin: 'ZEPPELIN', dreadnought: 'AERIAL DREADNOUGHT', junk: 'JUNK TRADER', scout: 'SCOUT', carrier: 'SKY-CARRIER', balloon: 'BALLOON',
  liner: 'AIR LINER', galleon: 'SKY-GALLEON', twin: 'TWIN-HULL', gunship: 'GUNSHIP', hauler: 'CARGO HAULER', hulk: 'SALVAGE HULK', tender: 'FIRE TENDER',
};
