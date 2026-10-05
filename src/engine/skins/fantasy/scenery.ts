/**
 * Scenery for maps seen from above: trees, cottages, a keep, tents, rocks, a windmill,
 * fields. Pixel art like the people (sprites.ts), in its own small atlas, plus the
 * rules for where things go on a battlefield map.
 */
import type { Rng } from '../../rng';
import { finish } from './sprites';

export type Prop = 'pine' | 'oak' | 'bush' | 'rock' | 'cottage' | 'keep' | 'tent' | 'mill' | 'well' | 'ship' | 'hut' | 'stonehouse' | 'spire' | 'palace' | 'galley' | 'galleon' | 'cart'
  | 'longhouse' | 'stilthouse' | 'adobe' | 'ballista' | 'sheep' | 'cattle' | 'goat' | 'deadtree' | 'reeds' | 'snowpine';

const SIZES: Record<Prop, [number, number]> = {
  ship: [11, 9],
  longhouse: [20, 10],
  stilthouse: [13, 15],
  adobe: [14, 10],
  ballista: [13, 22],
  sheep: [6, 4],
  cattle: [9, 6],
  goat: [6, 5],
  deadtree: [11, 14],
  reeds: [7, 6],
  snowpine: [9, 15],
  hut: [8, 7],
  stonehouse: [12, 13],
  spire: [7, 19],
  palace: [24, 20],
  galley: [14, 7],
  galleon: [16, 14],
  cart: [11, 7],
  pine: [9, 15],
  oak: [12, 12],
  bush: [7, 5],
  rock: [7, 5],
  cottage: [15, 13],
  keep: [26, 28],
  tent: [11, 8],
  mill: [11, 15],
  well: [7, 7],
};
/** Variants per prop (tents: one per army color, set by the caller). */
const VARIANTS: Record<Prop, number> = {
  pine: 3, oak: 3, bush: 2, rock: 2, cottage: 3, keep: 1, tent: 2, mill: 1, well: 1, ship: 1, hut: 2, stonehouse: 3, spire: 1, palace: 1, galley: 1, galleon: 1, cart: 1,
  longhouse: 2, stilthouse: 2, adobe: 3, ballista: 2, sheep: 2, cattle: 2, goat: 2, deadtree: 2, reeds: 2, snowpine: 2,
};

type Pen = (x: number, y: number, w: number, h: number, c: string) => void;

function draw(p: Pen, g: CanvasRenderingContext2D, prop: Prop, v: number, tents: [string, string][]) {
  switch (prop) {
    case 'pine': {
      const c = ['#1c3324', '#203a28', '#18301f'][v];
      const hi = ['#2e5238', '#33573c', '#284a32'][v];
      p(4, 12, 1, 3, '#3a2a1c');
      for (let i = 0; i < 4; i++) {
        const w = 2 + i * 2;
        p(4.5 - w / 2, 1 + i * 3, w, 3, c);
        p(4.5 - w / 2, 1 + i * 3, 1, 1, hi);
      }
      p(4, 0, 1, 1, c);
      break;
    }
    case 'oak': {
      const c = ['#24361c', '#2a3c1f', '#1f3119'][v];
      const hi = ['#3b5a2c', '#45632f', '#355226'][v];
      p(5, 8, 2, 4, '#3a2a1c');
      g.fillStyle = c;
      g.beginPath();
      g.arc(6, 5, 5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(3.5, 6.5, 3, 0, Math.PI * 2);
      g.arc(8.5, 6.5, 3, 0, Math.PI * 2);
      g.fill();
      p(3, 2, 3, 2, hi);
      p(7, 3, 2, 1, hi);
      break;
    }
    case 'bush':
      p(1, 1, 5, 3, ['#22331b', '#2a3a1d'][v]);
      p(0, 2, 7, 2, ['#22331b', '#2a3a1d'][v]);
      p(2, 1, 2, 1, '#3b5a2c');
      break;
    case 'rock':
      p(1, 1, 5, 3, ['#57534e', '#4b5563'][v]);
      p(0, 2, 7, 2, ['#44403c', '#374151'][v]);
      p(2, 1, 2, 1, '#78716c');
      break;
    case 'cottage': {
      const roof = ['#7c2d12', '#57534e', '#a16207'][v];
      p(2, 6, 11, 7, '#a8a29e');
      p(2, 6, 11, 1, '#d6d3d1');
      p(1, 2, 13, 4, roof);
      p(3, 0, 9, 2, roof);
      p(1, 5, 13, 1, '#44403c');
      p(6, 9, 3, 4, '#3f2a17');
      p(3, 8, 2, 2, '#fbbf24');
      p(10, 8, 2, 2, '#fbbf24');
      p(11, 0, 2, 3, '#57534e');
      break;
    }
    case 'keep':
      p(3, 10, 20, 18, '#6b7280');
      p(3, 10, 20, 1, '#9ca3af');
      for (let i = 0; i < 5; i++) p(3 + i * 4, 8, 2, 2, '#6b7280');
      p(8, 2, 10, 10, '#78716c');
      for (let i = 0; i < 3; i++) p(8 + i * 4, 0, 2, 2, '#78716c');
      p(0, 14, 4, 14, '#57534e');
      p(22, 14, 4, 14, '#57534e');
      p(11, 20, 4, 8, '#1c1917');
      p(12, 5, 2, 3, '#fbbf24');
      p(6, 15, 1, 2, '#fbbf24');
      p(19, 15, 1, 2, '#fbbf24');
      p(13, -4, 1, 6, '#3f2a17');
      break;
    case 'tent': {
      const [c, d] = tents[v] ?? ['#a8a29e', '#57534e'];
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, 8);
      g.lineTo(5.5, 0);
      g.lineTo(11, 8);
      g.closePath();
      g.fill();
      p(5, 1, 1, 7, d);
      p(4, 5, 3, 3, '#1c1917');
      break;
    }
    case 'mill':
      p(2, 5, 7, 10, '#a8a29e');
      p(1, 3, 9, 3, '#7c2d12');
      p(3, 1, 5, 2, '#7c2d12');
      p(4, 10, 3, 5, '#3f2a17');
      p(4, 7, 2, 2, '#fbbf24');
      break;
    case 'ship':
      p(1, 6, 9, 2, '#5b3a1e');
      p(2, 8, 7, 1, '#3f2a17');
      p(0, 5, 2, 1, '#5b3a1e');
      p(5, 0, 1, 6, '#3f2a17');
      p(2, 1, 3, 4, '#e7e5e4');
      p(6, 1, 3, 4, '#d6d3d1');
      break;
    case 'well':
      p(1, 3, 5, 4, '#78716c');
      p(1, 0, 1, 4, '#3f2a17');
      p(5, 0, 1, 4, '#3f2a17');
      p(0, 0, 7, 1, '#7c2d12');
      p(2, 3, 3, 1, '#1e293b');
      break;
    case 'hut': {
      // A round hut: daub walls, a thatched cone.
      const thatch = ['#a16207', '#854d0e'][v];
      p(1, 4, 6, 3, '#8b7355');
      p(3, 5, 2, 2, '#1c1410');
      p(0, 3, 8, 1, thatch);
      p(1, 2, 6, 1, thatch);
      p(2, 1, 4, 1, thatch);
      p(3, 0, 2, 1, thatch);
      p(2, 2, 1, 1, '#ca8a04');
      break;
    }
    case 'stonehouse': {
      // Two storeys of stone under a tiled roof; a lit window or two.
      const roof = ['#9a3412', '#7f1d1d', '#57534e'][v];
      p(1, 5, 10, 8, '#a8a29e');
      p(1, 5, 10, 1, '#d6d3d1');
      p(1, 9, 10, 1, '#78716c');
      p(0, 2, 12, 3, roof);
      p(2, 0, 8, 2, roof);
      p(0, 4, 12, 1, '#44403c');
      p(3, 6, 2, 2, '#fbbf24');
      p(7, 10, 2, 2, '#fbbf24');
      p(8, 6, 2, 2, '#292524');
      p(4, 10, 2, 3, '#3f2a17');
      p(9, 0, 2, 3, '#57534e');
      break;
    }
    case 'spire':
      // A church tower and its spire.
      p(1, 9, 5, 10, '#a8a29e');
      p(1, 9, 5, 1, '#d6d3d1');
      p(3, 12, 1, 3, '#fbbf24');
      p(2, 6, 3, 3, '#57534e');
      p(3, 1, 1, 5, '#57534e');
      p(2, 4, 3, 2, '#57534e');
      p(3, 0, 1, 1, '#facc15');
      break;
    case 'palace':
      // A palace: a long front, two towers, and a gilded dome.
      p(2, 11, 20, 9, '#d6d3d1');
      p(2, 11, 20, 1, '#f5f5f4');
      for (let i = 0; i < 6; i++) p(4 + i * 3, 13, 1, 5, '#a8a29e');
      for (let i = 0; i < 5; i++) p(5 + i * 3, 14, 1, 2, '#fbbf24');
      p(10, 16, 4, 4, '#3f2a17');
      p(0, 6, 4, 14, '#a8a29e');
      p(20, 6, 4, 14, '#a8a29e');
      p(0, 4, 4, 2, '#7f1d1d');
      p(20, 4, 4, 2, '#7f1d1d');
      g.fillStyle = '#ca8a04';
      g.beginPath();
      g.arc(12, 10, 5, Math.PI, 0);
      g.fill();
      p(9, 9, 6, 2, '#a16207');
      p(12, 2, 1, 4, '#facc15');
      break;
    case 'galley':
      // A long oared hull, one small square sail.
      p(1, 4, 12, 2, '#5b3a1e');
      p(2, 6, 10, 1, '#3f2a17');
      p(0, 3, 2, 1, '#5b3a1e');
      p(12, 3, 2, 1, '#5b3a1e');
      for (let i = 0; i < 5; i++) p(2 + i * 2, 6 + (i % 2), 1, 1, '#a8a29e');
      p(7, 0, 1, 4, '#3f2a17');
      p(5, 0, 5, 3, '#d6d3d1');
      break;
    case 'galleon':
      // A tall ship: high stern, three masts, square sails.
      p(1, 10, 14, 3, '#5b3a1e');
      p(2, 13, 12, 1, '#3f2a17');
      p(12, 7, 4, 3, '#5b3a1e');
      p(0, 9, 2, 1, '#5b3a1e');
      for (const [mx, top] of [
        [4, 1],
        [8, 0],
        [12, 3],
      ] as const) {
        p(mx, top, 1, 10 - top, '#3f2a17');
        p(mx - 2, top + 1, 5, 3, '#e7e5e4');
        p(mx - 2, top + 5, 5, 3, '#d6d3d1');
      }
      p(8, 0, 2, 1, '#b91c1c');
      break;
    case 'longhouse': {
      // A long hall under a turf roof, its gable carved.
      const turf = ['#3f5a2a', '#4b5563'][v];
      p(1, 5, 18, 5, '#5b3a1e');
      for (let i = 0; i < 6; i++) p(2 + i * 3, 5, 1, 5, '#3f2a17');
      p(0, 2, 20, 3, turf);
      p(2, 1, 16, 1, turf);
      p(0, 4, 20, 1, '#2a1c10');
      p(9, 7, 2, 3, '#1c1410');
      p(5, 6, 1, 1, '#fbbf24');
      p(15, 6, 1, 1, '#fbbf24');
      p(0, 0, 1, 2, '#7c5a3a');
      p(19, 0, 1, 2, '#7c5a3a');
      break;
    }
    case 'stilthouse': {
      // A reed-roofed hut up on stilts over the water.
      const roof = ['#78716c', '#a16207'][v];
      for (const x of [2, 6, 10]) p(x, 9, 1, 6, '#3f2a17');
      p(1, 8, 11, 1, '#5b3a1e');
      p(2, 4, 9, 4, '#7c5a3a');
      p(1, 1, 11, 3, roof);
      p(3, 0, 7, 1, roof);
      p(5, 5, 2, 3, '#1c1410');
      p(8, 5, 2, 1, '#fbbf24');
      break;
    }
    case 'adobe': {
      // Flat-roofed mud brick, beams poking through, a dark door.
      const wall = ['#b45309', '#a16207', '#92400e'][v];
      p(1, 3, 12, 7, wall);
      p(1, 3, 12, 1, '#d97706');
      p(0, 2, 14, 1, '#78350f');
      for (const x of [2, 6, 10]) p(x, 4, 2, 1, '#3f2a17');
      p(5, 6, 3, 4, '#1c1410');
      p(10, 6, 2, 2, '#fbbf24');
      p(2, 0, 3, 2, wall);
      break;
    }
    case 'ballista': {
      // A timber tower with a great crossbow on top; burnt, a black stump.
      if (v === 1) {
        p(4, 12, 5, 10, '#1c1917');
        p(3, 10, 2, 3, '#292524');
        p(8, 14, 2, 2, '#9a3412');
        break;
      }
      for (const x of [2, 10]) p(x, 8, 1, 14, '#5b3a1e');
      for (let y = 10; y < 22; y += 4) p(2, y, 9, 1, '#3f2a17');
      p(1, 7, 11, 2, '#7c5a3a');
      p(0, 3, 13, 1, '#5b3a1e');
      p(5, 2, 3, 4, '#3f2a17');
      p(0, 2, 1, 3, '#a8a29e');
      p(12, 2, 1, 3, '#a8a29e');
      p(4, 1, 6, 1, '#d6d3d1');
      break;
    }
    case 'sheep':
      p(1, 0, 4, 3, ['#e7e5e4', '#d6d3d1'][v]);
      p(0, 1, 1, 1, '#292524');
      p(1, 3, 1, 1, '#292524');
      p(4, 3, 1, 1, '#292524');
      break;
    case 'cattle':
      p(1, 1, 7, 3, ['#78350f', '#e7e5e4'][v]);
      p(0, 0, 2, 2, ['#78350f', '#e7e5e4'][v]);
      p(2, 2, 2, 1, v ? '#292524' : '#a16207');
      p(1, 4, 1, 2, '#292524');
      p(6, 4, 1, 2, '#292524');
      p(0, 0, 1, 1, '#d6d3d1');
      break;
    case 'goat':
      p(1, 1, 4, 2, ['#d6d3d1', '#78716c'][v]);
      p(0, 0, 1, 2, ['#d6d3d1', '#78716c'][v]);
      p(0, 0, 1, 1, '#a8a29e');
      p(1, 3, 1, 2, '#292524');
      p(4, 3, 1, 2, '#292524');
      break;
    case 'deadtree': {
      const c = ['#2a2420', '#1c1917'][v];
      p(5, 4, 1, 10, c);
      p(4, 9, 1, 3, c);
      p(2, 3, 3, 1, c);
      p(1, 1, 1, 2, c);
      p(6, 5, 3, 1, c);
      p(8, 2, 1, 3, c);
      p(5, 0, 1, 4, c);
      break;
    }
    case 'reeds': {
      const c = ['#4d5a2a', '#5b5530'][v];
      for (let i = 0; i < 6; i++) p(i, 1 + (i % 3), 1, 5 - (i % 3), c);
      p(1, 0, 1, 1, '#78350f');
      p(4, 1, 1, 1, '#78350f');
      break;
    }
    case 'snowpine': {
      const c = ['#1c3324', '#18301f'][v];
      p(4, 12, 1, 3, '#3a2a1c');
      for (let i = 0; i < 4; i++) {
        const w = 2 + i * 2;
        p(4.5 - w / 2, 1 + i * 3, w, 3, c);
        p(4.5 - w / 2, 1 + i * 3, w, 1, '#e2e8f0');
      }
      p(4, 0, 1, 1, '#f1f5f9');
      break;
    }
    case 'cart':
      // An ox and a covered wagon.
      p(0, 2, 4, 3, '#78716c');
      p(0, 5, 1, 2, '#57534e');
      p(3, 5, 1, 2, '#57534e');
      p(0, 1, 1, 1, '#e7e5e4');
      p(5, 1, 6, 4, '#d6cfc0');
      p(5, 4, 6, 1, '#7c5a3a');
      p(6, 5, 2, 2, '#2a1c10');
      p(9, 5, 2, 2, '#2a1c10');
      break;
  }
}

export type SceneryAtlas = {
  canvas: HTMLCanvasElement;
  rect(prop: Prop, variant: number): [number, number, number, number];
  size(prop: Prop): [number, number];
};

/** The scenery atlas; `tents` are the two armies' colors [cloth, dark]. */
export function buildScenery(tents: [string, string][]): SceneryAtlas {
  const props = Object.keys(SIZES) as Prop[];
  const pad = 2;
  const rows = new Map<Prop, number>();
  let y = 0;
  let width = 0;
  for (const p of props) {
    rows.set(p, y);
    y += SIZES[p][1] + pad + 4;
    width = Math.max(width, (SIZES[p][0] + pad) * VARIANTS[p]);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = y;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const scratch = document.createElement('canvas');
  const sg = scratch.getContext('2d', { willReadFrequently: true })!;
  for (const prop of props) {
    const [w, h] = SIZES[prop];
    // Room above for flagpoles and smoke.
    scratch.width = w;
    scratch.height = h + 4;
    for (let v = 0; v < VARIANTS[prop]; v++) {
      sg.clearRect(0, 0, w, h + 4);
      sg.save();
      sg.translate(0, 4);
      const pen: Pen = (x, yy, ww, hh, c) => {
        sg.fillStyle = c;
        sg.fillRect(Math.round(x), Math.round(yy), ww, hh);
      };
      draw(pen, sg, prop, v, tents);
      sg.restore();
      finish(sg, w, h + 4);
      g.drawImage(scratch, v * (w + pad), rows.get(prop)!);
    }
  }
  return {
    canvas,
    rect: (prop, variant) => {
      const [w, h] = SIZES[prop];
      return [(variant % VARIANTS[prop]) * (w + pad), rows.get(prop)!, w, h + 4];
    },
    size: (prop) => SIZES[prop],
  };
}

/** Stamp a prop with its base at (x, y). */
export function stampProp(ctx: CanvasRenderingContext2D, a: SceneryAtlas, prop: Prop, variant: number, x: number, y: number, P: number) {
  const [sx, sy, w, h] = a.rect(prop, variant);
  const dx = Math.round(x / P - w / 2) * P;
  const dy = Math.round(y / P - h) * P;
  ctx.drawImage(a.canvas, sx, sy, w, h, dx, dy, w * P, h * P);
}

/** A thing on the map: battle x, and y as a share of the screen height. */
export type Placed = { prop: Prop; x: number; y: number; variant: number };

export type MapLayout = {
  props: Placed[];
  /** The river's centerline (battle x at each y share), if there is one. */
  river: ((y: number) => number) | null;
  /** The road from camp to camp: battle x and y share points. */
  road: [number, number][];
  /** Farm plots near the village: x, y share, width, height (px), angle. */
  fields: [number, number, number, number, number][];
  /** Where lights burn at night: hearths, camp fires, windows. */
  lights: { x: number; y: number; r: number; color: string }[];
  mill: { x: number; y: number } | null;
};

/**
 * What the battle puts on the map: its river, a siege's wall, an ambush's wood, a hill
 * (each as battle x at a screen-height share). The layout keeps out of their way.
 */
export type MapSite = {
  river: ((y: number) => number) | null;
  wall: ((y: number) => number) | null;
  wood: number | null;
};

/**
 * Lay out a battlefield map: the armies' band is `top`..`bottom` (screen shares); forests,
 * a village with its fields and a mill, a keep, rocks, and each army's camp go around it.
 * Behind a siege's wall, a town instead.
 */
export function layoutMap(r: Rng, BW: number, top: number, bottom: number, site: MapSite): MapLayout {
  const props: Placed[] = [];
  const lights: MapLayout['lights'] = [];
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const margin = (): number => (r() < 0.5 ? r() * (top - 0.03) + 0.02 : bottom + 0.03 + r() * (0.97 - bottom - 0.03));
  const inside = (x: number, y: number) => !!site.wall && x > site.wall(y) - 24;
  const wet = (x: number, y: number) => !!site.river && Math.abs(x - site.river(y)) < 34;
  const free = (x: number, y: number) => !inside(x, y) && !wet(x, y);
  // Forests: clumps along the top and bottom margins and at the far ends.
  for (let i = 0; i < 16; i++) {
    const cx = r() * BW;
    const cy = margin();
    const n = 14 + Math.floor(r() * 30);
    const spread = 70 + r() * 90;
    for (let k = 0; k < n; k++) {
      // Denser at the heart of a wood.
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r());
      const x = cx + Math.cos(a) * d * spread;
      const y = Math.max(0.01, Math.min(0.99, cy + Math.sin(a) * d * spread * 0.0011));
      if (y > top + 0.02 && y < bottom - 0.02) continue;
      if (!free(x, y)) continue;
      props.push({ prop: r() < 0.65 ? 'pine' : 'oak', x, y, variant: Math.floor(r() * 3) });
    }
  }
  // The ambush's wood: thick, at the band's far edge.
  if (site.wood !== null) {
    for (let k = 0; k < 90; k++) {
      const x = site.wood + (r() - 0.5) * 320;
      const y = top - 0.07 + r() * 0.08;
      if (free(x, y)) props.push({ prop: r() < 0.7 ? 'pine' : 'oak', x, y, variant: Math.floor(r() * 3) });
    }
  }
  for (const end of [0, 1]) {
    for (let k = 0; k < 70; k++) {
      const x = end ? BW - r() * 180 : r() * 180;
      const y = 0.02 + r() * 0.96;
      if (free(x, y)) props.push({ prop: r() < 0.6 ? 'pine' : 'oak', x, y, variant: Math.floor(r() * 3) });
    }
  }
  // Scattered single trees, bushes, and rocks, even on the field.
  for (let k = 0; k < 60; k++) {
    const x = r() * BW;
    const y = 0.03 + r() * 0.94;
    if (free(x, y)) props.push({ prop: pick(['bush', 'rock', 'oak', 'bush'] as const), x, y, variant: Math.floor(r() * 3) });
  }
  const fields: MapLayout['fields'] = [];
  let mill: MapLayout['mill'] = null;
  const vTop = r() < 0.5;
  // Where the village is (the road bends through it).
  const vx = BW * (0.3 + r() * 0.4);
  const vy = vTop ? top * 0.55 : bottom + (1 - bottom) * 0.45;
  if (site.wall) {
    // A walled town: roofs packed inside, a keep at its heart, lights in the windows.
    const wall = site.wall;
    for (let k = 0; k < 46; k++) {
      const y = 0.02 + r() * 0.96;
      const x = wall(y) + 50 + r() * 420;
      props.push({ prop: 'cottage', x, y, variant: Math.floor(r() * 3) });
      if (k % 3 === 0) lights.push({ x, y: y - 0.006, r: 14, color: '#fbbf24' });
    }
    const ky = top + (bottom - top) * 0.25;
    const kx = wall(ky) + 230;
    props.push({ prop: 'keep', x: kx, y: ky, variant: 0 });
    lights.push({ x: kx, y: ky - 0.03, r: 28, color: '#fbbf24' });
    props.push({ prop: 'well', x: wall(0.5) + 120, y: 0.55, variant: 0 });
  } else {
    // A village in one margin, with fields, a well, a mill.
    for (let k = 0; k < 7; k++) {
      const x = vx + (r() - 0.5) * 220;
      const y = vy + (r() - 0.5) * 0.06;
      if (wet(x, y)) continue;
      props.push({ prop: 'cottage', x, y, variant: Math.floor(r() * 3) });
      lights.push({ x, y: y - 0.006, r: 16, color: '#fbbf24' });
    }
    props.push({ prop: 'well', x: vx + 10, y: vy + 0.01, variant: 0 });
    for (let k = 0; k < 6; k++) fields.push([vx + (r() - 0.5) * 420, vy + (r() - 0.5) * 0.1, 50 + r() * 70, 18 + r() * 22, (r() - 0.5) * 0.4]);
    mill = { x: vx + (r() < 0.5 ? -1 : 1) * (150 + r() * 60), y: vy + (r() - 0.5) * 0.04 };
    props.push({ prop: 'mill', x: mill.x, y: mill.y, variant: 0 });
    // A keep on the other margin.
    const kx = BW * (0.2 + r() * 0.6);
    const ky = vTop ? bottom + (1 - bottom) * 0.5 : top * 0.5;
    props.push({ prop: 'keep', x: kx, y: ky, variant: 0 });
    lights.push({ x: kx, y: ky - 0.03, r: 26, color: '#fbbf24' });
  }
  // The camps behind each army (none for the defenders of a wall: they are home).
  for (const s of [0, 1] as const) {
    if (s === 1 && site.wall) continue;
    const cx = s === 0 ? BW * 0.355 - 360 : BW * 0.645 + 360;
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        const x = cx + (k - 1.5) * 26 + (row % 2) * 12;
        const y = top + (bottom - top) * (0.28 + row * 0.13) + (r() - 0.5) * 0.01;
        props.push({ prop: 'tent', x, y, variant: s });
      }
      lights.push({ x: cx + (row % 2 ? 40 : -40), y: top + (bottom - top) * (0.3 + row * 0.13), r: 20, color: '#fb923c' });
    }
  }
  // The river is the battle's (a ford); a road runs from camp to camp.
  const river = site.river;
  const phase = r() * 3;
  const road: [number, number][] = [];
  const roadY = top + (bottom - top) * (site.wall ? 0.5 : 0.35 + r() * 0.3);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * BW;
    if (site.wall) {
      // To the gate, and on into the town.
      if (x > site.wall(roadY) + 260) break;
      road.push([x, roadY + Math.sin(i * 0.7 + phase) * 0.02 * Math.max(0, 1 - x / site.wall(roadY))]);
      continue;
    }
    road.push([x, roadY + Math.sin(i * 0.7 + phase) * 0.03 + (Math.abs(x - vx) < 300 ? (vy - roadY) * Math.cos(((x - vx) / 300) * Math.PI * 0.5) : 0)]);
  }
  props.sort((a, b) => a.y - b.y);
  return { props, river, road, fields, lights, mill };
}
