/**
 * The ground the battle is fought over: rises and hills that men climb, the cover they fight from,
 * and the works each army has built. DOM-free and seeded: the sim moves men behind the cover and up
 * the hills; the painter draws them.
 *
 * Space is the sim's: ground x across, depth d (0 the foot of the ridge, 1 the horizon), heights in
 * ground units. Everything here is fixed for the battle (a facility can be wrecked; a cover piece can
 * be blown apart), so it is laid out once from the seed and the field's style.
 */
import type { Rng } from '../../../rng';
import type { FieldStyle } from './fields';
import type { Side } from './types';

export type Hill = { x: number; d: number; r: number; h: number };
export type CoverKind =
  | 'sandbags' | 'barricade' | 'trench' | 'tanktrap' | 'rock' | 'boulder' | 'spire' | 'ruin' | 'crystal' | 'log' | 'stump'
  | 'crate' | 'pylon' | 'wall' | 'console' | 'fuel' | 'fighter' | 'fungus' | 'reef';
/** A piece of cover: `w` across (ground units), `h` how tall; whose side built it (null for the land's own). */
export type Cover = { id: number; x: number; d: number; w: number; h: number; kind: CoverKind; side: Side | null; seed: number; hp: number };
export type FacilityKind = 'post' | 'bunker' | 'tower' | 'factory' | 'battery' | 'hangar-door' | 'city-gate';
export type Facility = { id: number; kind: FacilityKind; side: Side; x: number; d: number; s: number; hp: number; state: 'up' | 'ruin'; t0: number; name: string; seed: number };

export type Terrain = {
  hills: Hill[];
  cover: Cover[];
  facilities: Facility[];
  /** The ground's height at (x, d), in ground units. */
  height(x: number, d: number): number;
};

/** Lay out the field: its rises, its cover, the two armies' works. `front0` is where the front starts; `fwdGA` which way the Grand Army faces. */
export function layTerrain(r: Rng, o: { style: FieldStyle; GW: number; u: number; front0: number; gap: number; fwdGA: 1 | -1; gx: (sx: number, d: number) => number; nextId: () => number; geonosis: boolean }): Terrain {
  const { style, GW, u, front0, gap, fwdGA } = o;
  const DEPTH = 1400 * u;
  const hills: Hill[] = [];
  const cover: Cover[] = [];
  const facilities: Facility[] = [];
  const hangar = style === 'hangar';
  const platform = style === 'platform';
  // Rises: a few broad swells and a knoll or two (none on a deck).
  if (!hangar && !platform) {
    const n = style === 'arena' || style === 'canyon' || style === 'beach' ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const d = 0.08 + r() * 0.55;
      const sx = GW * (0.05 + r() * 0.9);
      hills.push({ x: o.gx(sx, d), d, r: (180 + r() * 320) * u, h: (14 + r() * (style === 'canyon' ? 46 : 32)) * u });
    }
  }
  const height = (x: number, d: number) => {
    let h = 0;
    for (const q of hills) {
      const dx = (x - q.x) / q.r;
      const dd = ((d - q.d) * DEPTH) / q.r;
      const k = dx * dx + dd * dd;
      if (k < 9) h += q.h * Math.exp(-k * 1.4);
    }
    return h;
  };
  const add = (x: number, d: number, kind: CoverKind, side: Side | null, w: number, h: number) =>
    cover.push({ id: o.nextId(), x, d, w: w * u, h: h * u, kind, side, seed: Math.floor(r() * 1e6), hp: kind === 'trench' || kind === 'rock' || kind === 'spire' || kind === 'wall' ? 999 : 60 });
  // The armies' own works: the Grand Army's sandbags and plasteel barricades, a trench line in some
  // fields; the droids' tank traps and barricades; then the land's own rocks, ruins and logs.
  const sideX = (s: Side, back: number) => front0 - (s === 'ga' ? fwdGA : -fwdGA) * (gap / 2 + back * u);
  const lineAcross = (s: Side, back: number, kind: CoverKind, n: number, w: number, h: number) => {
    for (let i = 0; i < n; i++) {
      const d = 0.05 + (i / Math.max(1, n - 1)) * 0.52 + (r() - 0.5) * 0.04;
      add(sideX(s, back + (r() - 0.5) * 30), Math.max(0.03, d), kind, s, w * (0.8 + r() * 0.4), h);
    }
  };
  if (hangar) {
    lineAcross('ga', 60, 'crate', 5, 60, 30);
    lineAcross('cf', 70, 'barricade', 4, 70, 26);
    for (let i = 0; i < 6; i++) add(o.gx(GW * (0.08 + r() * 0.84), 0.06 + r() * 0.5), 0.06 + r() * 0.5, r() < 0.5 ? 'fuel' : 'console', null, 40 + r() * 30, 30 + r() * 20);
    for (let i = 0; i < 2; i++) add(sideX(i ? 'cf' : 'ga', 260 + r() * 200), 0.12 + r() * 0.3, 'fighter', i ? 'cf' : 'ga', 120, 40);
  } else if (platform) {
    lineAcross('ga', 50, 'barricade', 5, 70, 24);
    lineAcross('cf', 80, 'crate', 4, 60, 30);
    for (let i = 0; i < 5; i++) add(o.gx(GW * (0.05 + r() * 0.9), 0.08 + r() * 0.6), 0.08 + r() * 0.6, r() < 0.5 ? 'pylon' : 'crate', null, 50, 40 + r() * 30);
  } else {
    const trench = r() < 0.55;
    if (trench) lineAcross('ga', 40, 'trench', 6, 150, 14);
    lineAcross('ga', trench ? 90 : 40, 'sandbags', 6, 90, 16);
    lineAcross('cf', 60, r() < 0.5 ? 'tanktrap' : 'barricade', 5, 70, 22);
    const natural: Record<string, CoverKind[]> = { arena: ['rock', 'boulder', 'spire'], crystal: ['crystal', 'ruin', 'ruin'], jungle: ['log', 'stump', 'fungus'], canyon: ['rock', 'boulder', 'wall'], beach: ['reef', 'log', 'rock'] };
    const kinds = natural[style] ?? ['rock'];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const d = 0.05 + Math.pow(r(), 0.9) * 0.6;
      const sx = GW * (0.04 + r() * 0.92);
      const kind = kinds[Math.floor(r() * kinds.length)];
      const big = kind === 'spire' || kind === 'ruin' || kind === 'wall';
      add(o.gx(sx, d), d, kind, null, big ? 70 + r() * 60 : 40 + r() * 50, kind === 'spire' ? 110 + r() * 90 : big ? 50 + r() * 50 : 16 + r() * 22);
    }
  }
  // The works behind the lines.
  const fac = (kind: FacilityKind, side: Side, back: number, d: number, s: number, name: string) =>
    facilities.push({ id: o.nextId(), kind, side, x: sideX(side, back), d, s, hp: kind === 'post' ? 140 : 160, state: 'up', t0: -999, name, seed: Math.floor(r() * 1e6) });
  if (hangar) {
    fac('hangar-door', 'cf', 520, 0.32, 1, 'THE BLAST DOORS');
  } else {
    fac('post', 'ga', 430 + r() * 120, 0.1 + r() * 0.15, 1, 'THE FORWARD COMMAND POST');
    if (!platform && r() < 0.6) fac('bunker', 'ga', 180 + r() * 80, 0.3 + r() * 0.2, 1, 'THE REPUBLIC BUNKER');
    fac('tower', 'cf', 520 + r() * 140, 0.4 + r() * 0.15, 1, o.geonosis ? 'THE DROID CONTROL SPIRE' : 'THE SEPARATIST COMMAND TOWER');
    if (o.geonosis) fac('factory', 'cf', 760, 0.62, 1.3, 'THE DROID FOUNDRY');
    if (r() < 0.5) fac('battery', 'cf', 360 + r() * 120, 0.18 + r() * 0.2, 1, 'THE ANTI-AIR BATTERY');
  }
  return { hills, cover, facilities, height };
}
