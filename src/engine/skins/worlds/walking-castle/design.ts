/**
 * The castle's design for one seed, as data: a heap of iron hull, cottages, turrets, chimneys,
 * pipes and balconies, a face at the front, a door with a dial, and two hen's legs. No canvas here:
 * the sim reads where the chimneys, vents, door and hips are; the painter (./castle) bakes the body
 * from this and draws the legs and the live parts.
 *
 * Space: castle units, x forward (the way it walks), y down; (0, 0) is the belly, where the legs
 * meet the hull. The body stands about 340 units tall above the belly, and the legs reach 175 below.
 */
import type { Genome } from '../../../kit';

export type Mat = 'iron' | 'rust' | 'bronze' | 'wood' | 'plaster' | 'brick' | 'stone' | 'tin';
export type RoofKind = 'gable' | 'cone' | 'dome' | 'onion' | 'flat' | 'mansard' | 'lean';
export type Win = { x: number; y: number; w: number; h: number; round: boolean; lit: number };
export type Block = { x: number; y: number; w: number; h: number; mat: Mat; roof: RoofKind; roofH: number; roofCol: string; wins: Win[]; seed: number; overhang: number };
export type Turret = { x: number; y: number; r: number; h: number; mat: Mat; roof: RoofKind; roofH: number; roofCol: string; wins: Win[]; seed: number; flag: boolean; ring: boolean };
export type Chimney = { x: number; y: number; w: number; h: number; mat: Mat; pot: boolean; smoke: string; seed: number };
export type Pipe = { pts: [number, number][]; r: number; mat: Mat; vent: boolean };
export type Balcony = { x: number; y: number; w: number; plants: number; seed: number };
export type Line = { x0: number; y0: number; x1: number; y1: number; items: { k: number; w: number; h: number; col: string; kind: 'shirt' | 'sheet' | 'sock' | 'dress' }[] };
export type Flag = { x: number; y: number; h: number; col: string; seed: number };

export type Design = {
  seed: number;
  /** The hull's outline (closed), its deck line (top) as samples, and its plates. */
  hull: [number, number][];
  deck: (x: number) => number;
  plates: { x: number; y: number; w: number; h: number; mat: Mat; seed: number }[];
  face: { cx: number; cy: number; r: number; eyeX: number; eyeY: number; eyeR: number; jawX: number; jawY: number; jawW: number; brow: string; teeth: number };
  blocks: Block[];
  turrets: Turret[];
  chimneys: Chimney[];
  pipes: Pipe[];
  balconies: Balcony[];
  lines: Line[];
  flags: Flag[];
  door: { x: number; y: number; w: number; h: number };
  dial: { x: number; y: number; r: number };
  /** The vents that puff steam on each step; the knees puff too. */
  vents: [number, number][];
  /** The hearth's window, where the fire spirit's glow shows. */
  hearth: { x: number; y: number; r: number };
  /** The rear: a dinghy on davits, barrels, a water wheel. */
  rear: { boat: boolean; wheel: { x: number; y: number; r: number } | null; barrels: [number, number][]; cage: [number, number] | null };
  vane: { x: number; y: number };
  hips: { near: [number, number]; far: [number, number] };
  leg: { thigh: number; shin: number; foot: number; toe: number; w: number; col: string };
  palette: { iron: string; rust: string; bronze: string; wood: string; plaster: string; brick: string; stone: string; tin: string; ink: string };
  width: number;
  top: number;
};

const ROOFS = { slate: '#4d5866', tile: '#b4553c', copper: '#5f9c8a', shingle: '#7c5a3e', blue: '#3e5c8c', moss: '#6a7a44', plum: '#7a4a5a' };

export function createDesign(g: Genome): Design {
  const seed = Math.floor(g.unit() * 1e6);
  const theme = g.weighted({ rust: 3, verdigris: 3, pastel: 2, sooty: 2 });
  const roofSet: string[] =
    theme === 'rust' ? [ROOFS.tile, ROOFS.slate, ROOFS.shingle, ROOFS.tile]
      : theme === 'verdigris' ? [ROOFS.copper, ROOFS.slate, ROOFS.copper, ROOFS.moss]
        : theme === 'pastel' ? [ROOFS.blue, ROOFS.tile, ROOFS.copper, ROOFS.plum]
          : [ROOFS.slate, ROOFS.shingle, ROOFS.slate, ROOFS.tile];
  const palette = {
    iron: theme === 'sooty' ? '#5a5c62' : '#6c7079',
    rust: theme === 'rust' ? '#9a5a36' : '#8a5e44',
    bronze: theme === 'verdigris' ? '#8a8a5a' : '#a07c4a',
    wood: '#8a6646',
    plaster: theme === 'pastel' ? '#e4d2b8' : '#d8ccb0',
    brick: '#a65a48',
    stone: '#9c968a',
    tin: '#8a949c',
    ink: '#2a2022',
  };
  const roofCol = () => g.pick(roofSet);
  const wallMats: Mat[] = theme === 'pastel' ? ['plaster', 'wood', 'plaster', 'brick', 'tin'] : theme === 'sooty' ? ['iron', 'brick', 'wood', 'stone', 'rust'] : ['wood', 'plaster', 'brick', 'rust', 'stone', 'tin'];

  // ---- the hull: a heavy round-bottomed mass, the face at the front ---------------------------------
  const back = -g.range(180, 205);
  const front = g.range(150, 170);
  const deckBase = -g.range(112, 130);
  const deckBumps = Array.from({ length: 8 }, () => g.range(-14, 14));
  const deck = (x: number) => {
    const q = (x - back) / (front - back);
    const i = Math.max(0, Math.min(6.999, q * 7));
    const k = i - Math.floor(i);
    const a = deckBumps[Math.floor(i)];
    const b = deckBumps[Math.floor(i) + 1];
    // Lower at the stern; the face rises at the bow.
    return deckBase + a + (b - a) * k * k * (3 - 2 * k) + Math.max(0, -q + 0.15) * 40;
  };
  const hull: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const q = i / 24;
    const x = back + (front - back) * q;
    hull.push([x, deck(x)]);
  }
  // Down the bow, under the belly (the keel bulges where the legs are), up the stern.
  const bowDown = 14;
  for (let i = 1; i <= bowDown; i++) {
    const a = (i / bowDown) * Math.PI * 0.5;
    hull.push([front + Math.sin(a) * 24 - (i / bowDown) * 30, deck(front) + (i / bowDown) * (-deck(front) - 40)]);
  }
  for (let i = 0; i <= 20; i++) {
    const q = i / 20;
    const x = front - 30 - q * (front - 30 - back - 20);
    const sag = Math.sin(q * Math.PI) * 52 + Math.exp(-Math.pow((x - 0) / 60, 2)) * 22;
    hull.push([x, -40 + sag - 10]);
  }
  for (let i = 1; i <= 10; i++) {
    const q = i / 10;
    hull.push([back + 20 - Math.sin(q * Math.PI) * 22, -40 + (deck(back) + 40) * q]);
  }
  const plates: Design['plates'] = [];
  for (let x = back; x < front; ) {
    const w = g.range(26, 52);
    for (let y = -36; y > deckBase - 20; ) {
      const h = g.range(20, 34);
      plates.push({ x, y: y - h, w, h, mat: (g.weighted({ iron: 5, rust: theme === 'rust' ? 4 : 2, bronze: 1.5, tin: 1, wood: theme === 'pastel' ? 2 : 0.6 }) as Mat), seed: Math.floor(g.unit() * 1e6) });
      y -= h;
    }
    x += w;
  }

  // ---- the face: a round head at the bow, one great eye, a jaw of iron teeth -----------------------
  const faceR = g.range(58, 70);
  const face = {
    cx: front - faceR * 0.55, cy: deck(front) - faceR * 0.15, r: faceR,
    eyeX: front - faceR * 0.25, eyeY: deck(front) - faceR * 0.45, eyeR: faceR * g.range(0.24, 0.3),
    jawX: front - 8, jawY: deck(front) + faceR * 0.55, jawW: faceR * 0.9,
    brow: roofCol(), teeth: g.int(4, 6),
  };

  // ---- the upper works: cottages and sheds stacked on the deck, then on each other ----------------
  const N = 120;
  const x0 = back + 10;
  const x1 = face.cx - faceR * 0.4;
  const sky = new Float64Array(N + 1);
  const xi = (x: number) => Math.max(0, Math.min(N, Math.round(((x - x0) / (x1 - x0)) * N)));
  for (let i = 0; i <= N; i++) sky[i] = deck(x0 + ((x1 - x0) * i) / N);
  const topAt = (a: number, b: number) => {
    let m = Infinity;
    for (let i = xi(a); i <= xi(b); i++) m = Math.min(m, sky[i]);
    return m;
  };
  const raise = (a: number, b: number, y: number) => {
    for (let i = xi(a); i <= xi(b); i++) sky[i] = Math.min(sky[i], y);
  };
  const windows = (x: number, y: number, w: number, h: number, round = false): Win[] => {
    const out: Win[] = [];
    const cols = Math.max(1, Math.floor(w / g.range(16, 24)));
    const rows = Math.max(1, Math.floor(h / g.range(22, 30)));
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        if (g.chance(0.25)) continue;
        const ww = g.range(6, 9);
        const wh = round ? ww : g.range(9, 13);
        out.push({ x: x + (w * (c + 0.5)) / cols - ww / 2 + g.range(-2, 2), y: y + (h * (r + 0.5)) / rows - wh / 2, w: ww, h: wh, round: round || g.chance(0.12), lit: g.unit() });
      }
    return out;
  };
  const blocks: Block[] = [];
  const nBlocks = g.int(6, 9);
  for (let k = 0; k < nBlocks; k++) {
    const w = g.range(42, 88);
    const cx = g.range(x0 + w / 2, x1 - w / 2);
    const a = cx - w / 2;
    const b = cx + w / 2;
    const base = topAt(a + w * 0.2, b - w * 0.2) + g.range(2, 8);
    const h = g.range(34, 70) * (k < 3 ? 1.1 : 0.85);
    if (base - h < -330) continue;
    const roof: RoofKind = g.weighted({ gable: 5, mansard: 2, flat: 1.4, lean: 1.5, dome: 0.8 });
    const roofH = roof === 'flat' ? 6 : roof === 'dome' ? w * 0.38 : roof === 'mansard' ? g.range(16, 24) : g.range(22, 40);
    const mat = g.pick(wallMats);
    blocks.push({ x: a, y: base - h, w, h, mat, roof, roofH, roofCol: roofCol(), wins: windows(a + 4, base - h + 4, w - 8, h - 10), seed: Math.floor(g.unit() * 1e6), overhang: g.range(3, 8) });
    raise(a, b, base - h - roofH * 0.6);
  }
  // Turrets: round towers on the heap, tall roofs.
  const turrets: Turret[] = [];
  const nTur = g.int(3, 5);
  for (let k = 0; k < nTur; k++) {
    const r = g.range(13, 24);
    const cx = g.range(x0 + r, x1 + 30 - r);
    const base = topAt(cx - r * 0.6, cx + r * 0.6) + g.range(6, 14);
    const h = g.range(40, 100) * (k === 0 ? 1.3 : 1);
    if (base - h < -380) continue;
    const roof: RoofKind = g.weighted({ cone: 6, onion: 1.2, dome: 1.2, flat: 0.6 });
    turrets.push({ x: cx, y: base - h, r, h, mat: g.pick(wallMats.concat(['stone', 'iron'])), roof, roofH: roof === 'cone' ? r * g.range(1.8, 2.8) : roof === 'flat' ? 6 : r * 1.3, roofCol: roofCol(), wins: windows(cx - r * 0.6, base - h + 6, r * 1.2, h - 14, g.chance(0.4)), seed: Math.floor(g.unit() * 1e6), flag: g.chance(0.7), ring: g.chance(0.5) });
    raise(cx - r, cx + r, base - h - 4);
  }
  turrets.sort((p, q) => p.h - q.h);
  // Chimneys: on the roofs, smoke of their own colour.
  const chimneys: Chimney[] = [];
  const nCh = g.int(3, 6);
  for (let k = 0; k < nCh; k++) {
    const w = g.range(9, 16);
    const cx = g.range(x0 + 20, x1);
    const base = topAt(cx - w / 2, cx + w / 2) + g.range(10, 18);
    const h = g.range(30, 64);
    chimneys.push({ x: cx - w / 2, y: base - h, w, h, mat: (g.weighted({ brick: 4, iron: 3, stone: 1.5, tin: 1.5 }) as Mat), pot: g.chance(0.6), smoke: g.chance(0.82) ? '#d8d4cc' : g.pick(['#9a8a9e', '#7a8aa0', '#c8a8a0', '#a0a8a0']), seed: Math.floor(g.unit() * 1e6) });
  }
  // The face's nose: a great spout on the bow, always.
  chimneys.push({ x: face.cx + faceR * 0.1, y: face.cy - faceR - 40, w: 13, h: 46, mat: 'iron', pot: true, smoke: '#cfcac0', seed: Math.floor(g.unit() * 1e6) });
  // Pipes: up the side of the heap, to vents that puff on every step.
  const pipes: Pipe[] = [];
  const vents: [number, number][] = [];
  const nPipes = g.int(3, 5);
  for (let k = 0; k < nPipes; k++) {
    let x = g.range(back + 20, front - 40);
    let y = deck(x) + g.range(10, 30);
    const pts: [number, number][] = [[x, y]];
    const steps = g.int(3, 5);
    for (let s = 0; s < steps; s++) {
      if (s % 2 === 0) y -= g.range(20, 60);
      else x += g.range(-30, 30);
      pts.push([x, y]);
    }
    const vent = g.chance(0.75);
    pipes.push({ pts, r: g.range(2.4, 4.4), mat: (g.weighted({ bronze: 3, iron: 2, tin: 1.5, rust: 1 }) as Mat), vent });
    if (vent) vents.push([x, y - 4]);
  }
  // Balconies under some of the blocks, and lines of washing between the turrets.
  const balconies: Balcony[] = [];
  for (const b of g.shuffle(blocks).slice(0, g.int(2, 3))) balconies.push({ x: b.x - 4, y: b.y + b.h - 2, w: Math.min(60, b.w + 8), plants: g.int(0, 3), seed: Math.floor(g.unit() * 1e6) });
  const tips = [...turrets.map((t) => [t.x, t.y + 8] as [number, number]), ...chimneys.map((c) => [c.x + c.w / 2, c.y + 10] as [number, number])].sort((a, b) => a[0] - b[0]);
  const lines: Line[] = [];
  const CLOTH = ['#e8e4da', '#c84a3a', '#4a6ab0', '#e8c860', '#ffffff', '#8ab06a', '#d890a0', '#6a5a8a'];
  for (let k = 0; k < g.int(1, 2) && tips.length > 2; k++) {
    const i = g.int(0, tips.length - 2);
    const [ax, ay] = tips[i];
    const [bx, by] = tips[Math.min(tips.length - 1, i + 1 + g.int(0, 1))];
    if (bx - ax < 30 || bx - ax > 160) continue;
    const n = Math.floor((bx - ax) / 14);
    lines.push({
      x0: ax, y0: ay, x1: bx, y1: by,
      items: Array.from({ length: n }, (_, j) => ({ k: (j + 0.5 + g.range(-0.2, 0.2)) / n, w: g.range(6, 11), h: g.range(8, 15), col: g.pick(CLOTH), kind: g.weighted({ shirt: 3, sheet: 1.5, sock: 1.5, dress: 1 }) })),
    });
  }
  const flags: Flag[] = turrets.filter((t) => t.flag).map((t) => ({ x: t.x, y: t.y - t.roofH - 2, h: 14 + t.r * 0.4, col: g.pick(['#c8443a', '#e8c860', '#3a6ab0', '#ffffff', '#5a9a5a']), seed: Math.floor(g.unit() * 1e6) }));
  // The door: low on the hull's flank toward the bow, and its dial above it.
  const dx = g.range(30, 70);
  const door = { x: dx, y: deck(dx) + 14, w: 24, h: 38 };
  const dial = { x: dx + 12, y: deck(dx) + 6, r: 7 };
  const hearth = { x: g.range(-40, 20), y: deck(0) + 34, r: 9 };
  const rear = {
    boat: g.chance(0.55),
    wheel: g.chance(0.6) ? { x: back + 4, y: deck(back) + 34, r: g.range(20, 30) } : null,
    barrels: Array.from({ length: g.int(1, 3) }, () => [g.range(back + 20, back + 70), deck(back + 40) - 2] as [number, number]),
    cage: g.chance(0.4) ? ([g.range(x0, x1), deck(0) + 8] as [number, number]) : null,
  };
  const tall = turrets[turrets.length - 1];
  const vane = tall ? { x: tall.x, y: tall.y - tall.roofH - 6 } : { x: 0, y: -300 };
  const top = Math.min(...turrets.map((t) => t.y - t.roofH), ...chimneys.map((c) => c.y), -200);
  return {
    seed, hull, deck, plates, face, blocks, turrets, chimneys, pipes, balconies, lines, flags, door, dial, vents, hearth, rear, vane,
    hips: { near: [-6, -14], far: [8, -18] },
    leg: { thigh: 50, shin: 72, foot: 58, toe: 30, w: g.range(15, 19), col: theme === 'rust' ? '#5a4436' : theme === 'verdigris' ? '#4a5650' : '#4a4a52' },
    palette, width: front - back + 40, top,
  };
}
