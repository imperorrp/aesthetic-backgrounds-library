/**
 * The machines of the chase, side-on, facing right (the way the convoy runs): the rig (a
 * long-nosed armoured tractor with twin blowers and stacks, hauling a riveted tank with a gun
 * nest, catwalk and crew), and the war party's cars: spiked hot rods, porcupines, polecats with
 * their sway poles and boarders, the music truck with its speaker wall, drummers and flame-throwing
 * guitarist, the monster-wheeled tank, buggies, bikes, ram trucks, and the warlord's stacked
 * throne-car. Burnt wrecks of any of them.
 *
 * Everything is drawn in vehicle units (a car is about 80 long) with the ground under the middle
 * at (0, 0) and up negative; the caller places and scales. The light: the key light (sun or moon)
 * is beyond the scene, so the faces we see are in the teal fill and the tops and the edges toward
 * the light are rimmed in it.
 */
import type { Clan, Kind, Mark } from './types';
import { fillCrisp } from '../../instruments/kit';
import { clamp01, hash, hexA, mix, posmod, type Env } from './env';

export type Mats = {
  d: number; burnt: boolean;
  dark: string; steelD: string; steel: string; steelL: string; rust: string; rustL: string;
  chrome: string; chromeL: string; chromeD: string; tyre: string; tyreL: string;
  paint: string; paintL: string; paintD: string; accent: string; glass: string;
  skin: string; skinL: string; cloth: string; clothL: string; rim: string; rimA: number;
  /** Which way the key light is, along the vehicle (+1 from ahead). */
  side: number;
};

const PAINTS: Record<Clan, string[]> = {
  party: ['#2a2622', '#3a2e26', '#c8b8a0', '#1e1e20', '#5a3a26'],
  rival: ['#9a3a24', '#b0502a', '#7a2e20'],
  ravens: ['#18181a', '#2a2a2e'],
  ally: ['#1c1c1e'],
};
const ACCENTS: Record<Clan, string> = { party: '#ece2cc', rival: '#4aa0d0', ravens: '#d8c8a8', ally: '#b8b0a0' };
const SKINS: Record<Clan | 'rig', string> = { party: '#ddd6ca', rival: '#9a6a4a', ravens: '#7a5a46', rig: '#8a6448', ally: '#8a6448' };
const CLOTHS: Record<Clan | 'rig', string> = { party: '#3a3430', rival: '#5a3a2a', ravens: '#1c1a1c', rig: '#4a3a2a', ally: '#2a2420' };

/** The materials of one vehicle at its distance, in this light. */
export function mats(E: Env, d: number, clan: Clan | 'rig', seed: number, x: number, burnt = false): Mats {
  const T = (c: string, lift = 0) => (burnt ? E.tone(mix(c, '#1a1410', 0.75), d, lift * 0.3) : E.tone(c, d, lift));
  const paints = clan === 'rig' ? ['#3a3a38'] : PAINTS[clan];
  const paint = paints[seed % paints.length];
  return {
    d, burnt,
    dark: T('#141210'), steelD: T('#2e2c2a', 0.05), steel: T('#5a5650', 0.2), steelL: T('#a09a90', 0.65),
    rust: T('#7a3a1e', 0.15), rustL: T('#c06a34', 0.55),
    chrome: T('#9aa0a6', 0.45), chromeL: T('#f2f2ee', 1), chromeD: T('#3a4048', 0.05),
    tyre: T('#161414'), tyreL: T('#4a4440', 0.35),
    paint: T(paint, 0.2), paintL: T(paint, 0.75), paintD: T(mix(paint, '#000000', 0.45), 0),
    accent: T(clan === 'rig' ? '#d8a040' : ACCENTS[clan], 0.4), glass: T('#22343a', 0.3),
    skin: T(SKINS[clan], 0.25), skinL: T(SKINS[clan], 0.8), cloth: T(CLOTHS[clan], 0.1), clothL: T(CLOTHS[clan], 0.6),
    rim: E.tone(E.L.sun, d * 0.5, 1), rimA: burnt ? 0.15 : 0.35 + E.L.rim * 0.55,
    side: E.keyX > x ? 1 : -1,
  };
}

const vgrad = (c: CanvasRenderingContext2D, y0: number, y1: number, stops: [number, string][]) => {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};
/** A path's top edge lit by the key light: stroke it again, clipped to a band at its top. */
function rimEdge(c: CanvasRenderingContext2D, p: Path2D, top: number, band: number, M: Mats, w = 1.2) {
  if (M.rimA <= 0.05) return;
  c.save();
  c.beginPath();
  c.rect(-400, top - 4, 800, band + 4);
  c.clip();
  c.strokeStyle = hexA(M.rim, M.rimA);
  c.lineWidth = w;
  c.stroke(p);
  c.restore();
}
/** Light across a part from the key light's side. */
function sideLight(c: CanvasRenderingContext2D, p: Path2D, x0: number, x1: number, M: Mats, a = 0.22) {
  if (M.rimA <= 0.05) return;
  const g = c.createLinearGradient(x0, 0, x1, 0);
  const lit = hexA(M.rim, a * M.rimA);
  g.addColorStop(M.side > 0 ? 1 : 0, lit);
  g.addColorStop(0.5, hexA(M.rim, 0));
  g.addColorStop(M.side > 0 ? 0 : 1, hexA(M.rim, 0));
  c.fillStyle = g;
  c.fill(p);
}

// ---- wheels ---------------------------------------------------------------------------------------
export type WheelOpts = { spokes?: number; deep?: boolean; chromeHub?: boolean; spike?: boolean; wire?: boolean };
/** A wheel: the tyre and its tread blocks, the rim and spokes turning (blurring when fast), the hub; rimmed on top. */
export function wheel(E: Env, M: Mats, x: number, y: number, r: number, spin: number, o: WheelOpts = {}) {
  const c = E.ctx;
  c.fillStyle = M.tyre;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  // Tread: blocks round the tyre (deep lugs on the monster wheels).
  const n = o.deep ? 14 : o.wire ? 0 : 16;
  if (n) {
    c.strokeStyle = M.tyreL;
    c.lineWidth = o.deep ? r * 0.16 : r * 0.1;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = spin + (i / n) * Math.PI * 2;
      const r0 = r * (o.deep ? 0.8 : 0.86);
      c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      c.lineTo(x + Math.cos(a) * r * 0.99, y + Math.sin(a) * r * 0.99);
    }
    c.stroke();
  }
  // Sidewall ring.
  c.strokeStyle = hexA(M.tyreL, 0.5);
  c.lineWidth = r * 0.05;
  c.beginPath();
  c.arc(x, y, r * 0.74, 0, Math.PI * 2);
  c.stroke();
  // The rim.
  const rr = r * (o.wire ? 0.86 : o.deep ? 0.5 : 0.6);
  if (!o.wire) {
    c.fillStyle = o.chromeHub ? vgrad(c, y - rr, y + rr, [[0, M.chromeL], [0.45, M.chrome], [1, M.chromeD]]) : vgrad(c, y - rr, y + rr, [[0, M.steelL], [0.5, M.steel], [1, M.steelD]]);
    c.beginPath();
    c.arc(x, y, rr, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hexA(M.dark, 0.6);
    c.beginPath();
    c.arc(x, y, rr * 0.78, 0, Math.PI * 2);
    c.fill();
  }
  // Spokes: crisp, and a blur of them over.
  const sp = o.spokes ?? 6;
  c.strokeStyle = o.wire ? hexA(M.chrome, 0.8) : o.chromeHub ? M.chrome : M.steel;
  c.lineWidth = o.wire ? r * 0.035 : rr * 0.18;
  c.beginPath();
  for (let i = 0; i < sp; i++) {
    const a = spin * (o.wire ? 1 : 1) + (i / sp) * Math.PI * 2;
    c.moveTo(x + Math.cos(a) * rr * 0.2, y + Math.sin(a) * rr * 0.2);
    c.lineTo(x + Math.cos(a) * rr * 0.95, y + Math.sin(a) * rr * 0.95);
  }
  c.stroke();
  c.strokeStyle = hexA(o.chromeHub ? M.chromeL : M.steelL, 0.18);
  c.lineWidth = rr * 0.5;
  c.beginPath();
  c.arc(x, y, rr * 0.6, spin, spin + 1.6);
  c.stroke();
  // Hub, lug nuts, and the spike if it has one.
  c.fillStyle = vgrad(c, y - rr * 0.35, y + rr * 0.35, [[0, M.chromeL], [1, M.chromeD]]);
  c.beginPath();
  c.arc(x, y, rr * 0.3, 0, Math.PI * 2);
  c.fill();
  if (o.spike) {
    c.fillStyle = M.chrome;
    c.beginPath();
    c.moveTo(x - rr * 0.2, y - rr * 0.18);
    c.lineTo(x + r * 0.9, y);
    c.lineTo(x - rr * 0.2, y + rr * 0.18);
    c.fill();
  }
  // The rim light along the tyre's top.
  if (M.rimA > 0.05) {
    c.strokeStyle = hexA(M.rim, M.rimA * 0.55);
    c.lineWidth = r * 0.08;
    c.beginPath();
    c.arc(x, y, r * 0.96, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
  }
}

// ---- people ----------------------------------------------------------------------------------------
export type Pose = 'stand' | 'throw' | 'gun' | 'sit' | 'drum' | 'guitar' | 'hang' | 'cheer' | 'drive' | 'fight' | 'tumble';
/**
 * A figure, `h` tall (head to feet), standing at (x, y), facing `dir`: head (with goggles or a
 * painted skull face), torso, arms and legs in the pose; a lance, gun, sticks or guitar in hand.
 */
export function figure(E: Env, M: Mats, x: number, y: number, h: number, pose: Pose, ph: number, o: { dir?: number; lance?: boolean; paint?: boolean; mask?: boolean; aim?: number } = {}) {
  const c = E.ctx;
  const dir = o.dir ?? 1;
  const k = h / 18;
  c.save();
  c.translate(x, y);
  c.scale(dir * k, k);
  if (pose === 'tumble') c.rotate(ph * 3);
  const sw = Math.sin(ph);
  const sitting = pose === 'sit' || pose === 'drive' || pose === 'drum';
  const hip = sitting ? -6 : -8;
  const sh = sitting ? -13.5 : -15;
  c.lineCap = 'round';
  // Legs.
  c.strokeStyle = M.cloth;
  c.lineWidth = 2.6;
  c.beginPath();
  if (sitting) {
    c.moveTo(0, hip);
    c.lineTo(4, hip + 0.5);
    c.lineTo(4.5, 0);
  } else if (pose === 'hang' || pose === 'tumble') {
    c.moveTo(0, hip);
    c.lineTo(-2 + sw * 3, 0);
    c.moveTo(0, hip);
    c.lineTo(2 - sw * 3, -0.5);
  } else {
    const st = pose === 'throw' || pose === 'fight' ? 3.5 : 2;
    c.moveTo(0, hip);
    c.lineTo(-st + sw * 0.6, 0);
    c.moveTo(0, hip);
    c.lineTo(st - sw * 0.6, 0);
  }
  c.stroke();
  // Torso.
  c.fillStyle = M.cloth;
  c.beginPath();
  c.moveTo(-2.2, hip);
  c.lineTo(-2.6, sh);
  c.lineTo(2.4, sh);
  c.lineTo(2, hip);
  c.fill();
  // Skin on the shoulders and arms (the war party goes bare-chested and chalked).
  if (o.paint) {
    c.fillStyle = M.skin;
    c.beginPath();
    c.moveTo(-2.4, sh + 3);
    c.lineTo(-2.6, sh);
    c.lineTo(2.4, sh);
    c.lineTo(2.2, sh + 3);
    c.fill();
  }
  // Arms.
  c.strokeStyle = o.paint ? M.skin : M.cloth;
  c.lineWidth = 2;
  c.beginPath();
  const arm = (ax: number, ay: number, hx: number, hy: number) => {
    c.moveTo(ax, ay);
    c.lineTo((ax + hx) / 2 + 0.5, (ay + hy) / 2 + 1);
    c.lineTo(hx, hy);
  };
  let hand: [number, number] = [5, sh + 4];
  if (pose === 'throw') {
    const wind = 0.5 + 0.5 * Math.sin(ph * 1.3);
    hand = [-4 + wind * 2, sh - 7];
    arm(0, sh + 0.5, hand[0], hand[1]);
    arm(0, sh + 0.5, 5, sh + 2);
  } else if (pose === 'gun') {
    const a = o.aim ?? 0;
    hand = [7, sh + 1 - a * 3];
    arm(0, sh + 0.5, hand[0], hand[1]);
    arm(0, sh + 0.5, 5, sh + 3);
  } else if (pose === 'drum') {
    const up = Math.sin(ph * 2) > 0;
    arm(0, sh + 0.5, 5, up ? sh - 5 : sh + 4);
    arm(0, sh + 0.5, -1, up ? sh + 4 : sh - 5);
  } else if (pose === 'guitar') {
    arm(0, sh + 0.5, 4, hip + 1 + sw);
    arm(0, sh + 0.5, 7, sh + 3);
  } else if (pose === 'hang') {
    arm(0, sh + 0.5, 0.5, sh - 7);
    arm(0, sh + 0.5, -0.5, sh - 7);
  } else if (pose === 'cheer') {
    arm(0, sh + 0.5, 2 + sw, sh - 8);
    arm(0, sh + 0.5, -3, sh + 6);
  } else if (pose === 'fight') {
    arm(0, sh + 0.5, 6 + sw * 2, sh - 1);
    arm(0, sh + 0.5, -2, sh - 6);
  } else if (pose === 'drive') {
    arm(0, sh + 0.5, 6, sh + 2);
  } else if (pose === 'tumble') {
    arm(0, sh + 0.5, 5, sh - 6);
    arm(0, sh + 0.5, -5, sh - 4);
  } else {
    arm(0, sh + 0.5, 3, hip + 1);
    arm(0, sh + 0.5, -2, hip + 1);
  }
  c.stroke();
  // Head: shaven and chalked with dark eye sockets, or goggles and a wrap.
  c.fillStyle = o.paint ? M.skinL : M.skin;
  c.beginPath();
  c.arc(0.3, sh - 2.6, 2.4, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = M.dark;
  if (o.paint) {
    c.fillRect(0.9, sh - 3.4, 1.2, 0.9);
    c.fillRect(0.4, sh - 1.4, 2, 0.5);
  } else if (o.mask) {
    c.fillRect(-0.5, sh - 3.6, 3, 1.2);
    c.fillStyle = M.cloth;
    c.fillRect(-2, sh - 1.8, 4.6, 1.8);
  } else {
    c.fillStyle = M.cloth;
    c.beginPath();
    c.arc(0.3, sh - 3, 2.5, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = M.chromeD;
    c.fillRect(0.6, sh - 3.2, 2.2, 1);
  }
  // In hand: a lance (a shaft with an explosive can on the tip), or a gun.
  if (o.lance) {
    const [hx, hy] = hand;
    const ang = pose === 'throw' ? -0.5 : -1.2;
    c.strokeStyle = M.steelD;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(hx - Math.cos(ang) * 8, hy - Math.sin(ang) * 8);
    c.lineTo(hx + Math.cos(ang) * 14, hy + Math.sin(ang) * 14);
    c.stroke();
    c.fillStyle = M.accent;
    c.save();
    c.translate(hx + Math.cos(ang) * 14, hy + Math.sin(ang) * 14);
    c.rotate(ang);
    c.fillRect(0, -1.3, 4, 2.6);
    c.fillStyle = M.chrome;
    c.beginPath();
    c.moveTo(4, -1.3);
    c.lineTo(6.5, 0);
    c.lineTo(4, 1.3);
    c.fill();
    c.restore();
  }
  if (pose === 'gun') {
    const [hx, hy] = hand;
    c.strokeStyle = M.steelD;
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(hx - 5, hy + 1);
    c.lineTo(hx + 5, hy - (o.aim ?? 0) * 1.5);
    c.stroke();
  }
  // A rim of light on the head and shoulders.
  if (M.rimA > 0.05) {
    c.strokeStyle = hexA(M.rim, M.rimA * 0.7);
    c.lineWidth = 0.7;
    c.beginPath();
    c.arc(0.3, sh - 2.6, 2.4, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
  }
  c.restore();
}

// ---- the parts the war party builds from -----------------------------------------------------
function spikes(c: CanvasRenderingContext2D, M: Mats, pts: [number, number, number, number][]) {
  c.fillStyle = M.chrome;
  for (const [x, y, a, len] of pts) {
    const w = len * 0.16;
    c.beginPath();
    c.moveTo(x + Math.cos(a + 1.57) * w, y + Math.sin(a + 1.57) * w);
    c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    c.lineTo(x - Math.cos(a + 1.57) * w, y - Math.sin(a + 1.57) * w);
    c.fill();
  }
  if (M.rimA > 0.1) {
    c.strokeStyle = hexA(M.rim, M.rimA * 0.5);
    c.lineWidth = 0.35;
    c.beginPath();
    for (const [x, y, a, len] of pts) {
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    }
    c.stroke();
  }
}
/** A supercharger on a hood: the case, the belt, the chrome scoop with its butterflies. */
function blower(c: CanvasRenderingContext2D, M: Mats, x: number, y: number, w: number, h: number, boost: number, t: number) {
  c.fillStyle = vgrad(c, y - h, y, [[0, M.chromeL], [0.35, M.chrome], [1, M.chromeD]]);
  c.beginPath();
  c.roundRect(x - w / 2, y - h * 0.6, w, h * 0.6, w * 0.12);
  c.fill();
  c.strokeStyle = hexA(M.dark, 0.6);
  c.lineWidth = 0.4;
  c.beginPath();
  for (let i = 1; i < 5; i++) {
    c.moveTo(x - w / 2 + (i * w) / 5, y - h * 0.58);
    c.lineTo(x - w / 2 + (i * w) / 5, y - 0.4);
  }
  c.stroke();
  // The scoop, its butterflies flicking open on the throttle.
  c.fillStyle = M.chrome;
  c.beginPath();
  c.moveTo(x - w * 0.42, y - h * 0.6);
  c.lineTo(x - w * 0.36, y - h);
  c.lineTo(x + w * 0.5, y - h * 1.02);
  c.lineTo(x + w * 0.42, y - h * 0.6);
  c.fill();
  c.fillStyle = M.dark;
  c.fillRect(x + w * 0.38, y - h * 0.98, w * 0.1, h * 0.34);
  c.strokeStyle = M.chromeL;
  c.lineWidth = 0.5;
  const open = 0.3 + boost * 0.7 * (0.6 + 0.4 * Math.sin(t * 20));
  c.beginPath();
  c.moveTo(x + w * 0.43, y - h * 0.82);
  c.lineTo(x + w * 0.43 + open * w * 0.25, y - h * 0.82 - open * h * 0.12);
  c.stroke();
  // The belt down to the crank.
  c.strokeStyle = M.dark;
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(x + w * 0.45, y - h * 0.3);
  c.lineTo(x + w * 0.55, y + h * 0.5);
  c.stroke();
}
/** A skull, painted or bolted on. */
function skull(c: CanvasRenderingContext2D, x: number, y: number, r: number, bone: string, dark: string) {
  c.fillStyle = bone;
  c.beginPath();
  c.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1);
  c.lineTo(x + r * 0.6, y + r * 0.9);
  c.lineTo(x - r * 0.6, y + r * 0.9);
  c.closePath();
  c.fill();
  c.fillStyle = dark;
  c.beginPath();
  c.arc(x - r * 0.38, y + r * 0.05, r * 0.26, 0, Math.PI * 2);
  c.arc(x + r * 0.38, y + r * 0.05, r * 0.26, 0, Math.PI * 2);
  c.fill();
  c.fillRect(x - r * 0.08, y + r * 0.35, r * 0.16, r * 0.25);
}
/** Exhaust pipes: open stubs that spit flame (the flames are drawn in the light pass). */
function pipes(c: CanvasRenderingContext2D, M: Mats, pts: [number, number, number, number][]) {
  c.lineCap = 'round';
  for (const [x0, y0, x1, y1] of pts) {
    c.strokeStyle = M.chromeD;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.strokeStyle = M.chrome;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x0, y0 - 0.6);
    c.lineTo(x1, y1 - 0.6);
    c.stroke();
  }
  c.lineCap = 'butt';
}

export type Look = {
  kind: Kind | 'rig'; clan: Clan | 'rig'; seed: number; t: number; boost: number;
  /** Polecat: pole angle and whether a boarder hangs on it. */
  pole: number; boarder: boolean;
  /** The music truck playing (0..1, the beat). */
  beat: number;
  burnt: boolean; crew: boolean;
  /** Body bounce, in units. */
  bob: number;
  /** The rig's own: its build, cargo, name, scars and tally. */
  rig?: { variant: 'tanker' | 'twin'; cargo: 'fuel' | 'water'; name: string; marks: Mark[]; kills: number; flip: boolean };
};
/** Where flames, lights and dust come from on each machine, in vehicle units (for the light pass and the plumes). */
export type Points = { pipes: [number, number, number][]; wheels: [number, number][]; lamps: [number, number][]; tail: [number, number][] };
export const POINTS: Record<Kind | 'rig', Points> = {
  hotrod: { pipes: [[-4, -11, 0], [-8, -11, 0]], wheels: [[-26, 13], [28, 9.5]], lamps: [[34, -20]], tail: [[-38, -18]] },
  porcupine: { pipes: [[-32, -10, 0]], wheels: [[-20, 11], [21, 11]], lamps: [[30, -16]], tail: [[-32, -14]] },
  polecat: { pipes: [[-44, -9, 0]], wheels: [[-28, 11.5], [29, 11.5]], lamps: [[43, -18]], tail: [[-44, -18]] },
  howler: { pipes: [[44, -96, -1.57], [40, -96, -1.57]], wheels: [[-62, 15], [-40, 15], [28, 15], [52, 15]], lamps: [[78, -24], [78, -40]], tail: [[-80, -22]] },
  crusher: { pipes: [[-46, -70, -1.57]], wheels: [[-36, 23], [36, 23]], lamps: [[54, -50]], tail: [[-54, -48]] },
  bike: { pipes: [[-14, -11, 0]], wheels: [[-15, 9.5], [16, 9.5]], lamps: [[19, -22]], tail: [[-19, -18]] },
  buggy: { pipes: [[-28, -18, 0.4], [-28, -14, 0.2]], wheels: [[-19, 12.5], [22, 9.5]], lamps: [[26, -20]], tail: [[-30, -16]] },
  ram: { pipes: [[2, -60, -1.57], [-2, -60, -1.57]], wheels: [[-30, 14], [31, 14]], lamps: [[46, -24]], tail: [[-48, -22]] },
  throne: { pipes: [[-50, -46, 0], [-50, -50, 0]], wheels: [[-44, 21], [-14, 21], [44, 21]], lamps: [[64, -36]], tail: [[-66, -34]] },
  drifter: { pipes: [[-6, -12, 0], [-10, -12, 0]], wheels: [[-30, 13], [30, 13]], lamps: [[45, -22]], tail: [[-46, -22]] },
  rig: { pipes: [[57, -126, -1.57], [51, -126, -1.57]], wheels: [[-130, 17], [-96, 17], [64, 17], [92, 17], [132, 17]], lamps: [[156, -36], [146, -60]], tail: [[-152, -30]] },
};

const spinOf = (t: number, r: number, seed: number) => t * (150 / r) + seed;

/** Draw one machine at (x, y) on the ground, `s` pixels a unit, rolled by `rot` about its middle. */
export function drawMachine(E: Env, M: Mats, lk: Look, x: number, y: number, s: number, rot: number) {
  const c = E.ctx;
  const H = lk.kind === 'rig' ? 96 : lk.kind === 'howler' ? 90 : lk.kind === 'throne' ? 84 : 36;
  c.save();
  c.translate(x, y - (H / 2) * s);
  c.rotate(rot);
  c.scale(s, s);
  c.translate(0, H / 2);
  switch (lk.kind) {
    case 'rig':
      drawRig(E, M, lk);
      break;
    case 'hotrod':
      drawHotrod(E, M, lk);
      break;
    case 'porcupine':
      drawPorcupine(E, M, lk);
      break;
    case 'polecat':
      drawPolecat(E, M, lk);
      break;
    case 'howler':
      drawHowler(E, M, lk);
      break;
    case 'crusher':
      drawCrusher(E, M, lk);
      break;
    case 'bike':
      drawBike(E, M, lk);
      break;
    case 'buggy':
      drawBuggy(E, M, lk);
      break;
    case 'ram':
      drawRam(E, M, lk);
      break;
    case 'throne':
      drawThrone(E, M, lk);
      break;
    case 'drifter':
      drawDrifter(E, M, lk);
      break;
  }
  c.restore();
}

function wheels(E: Env, M: Mats, lk: Look, list: [number, number][], o: WheelOpts = {}) {
  for (const [wx, r] of list) {
    const bump = lk.burnt ? 0 : Math.sin(lk.t * 9 + wx * 0.7 + lk.seed) * 0.4;
    wheel(E, M, wx, -r + bump, r, lk.burnt ? lk.seed : spinOf(lk.t, r, lk.seed + wx), o);
  }
}

// ---- the rig ---------------------------------------------------------------------------------------
function drawRig(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  // Chassis rails under the whole length, in shadow; the wheels' far side.
  c.fillStyle = M.dark;
  c.fillRect(-152, -32 + b, 300, 8);
  c.fillStyle = M.steelD;
  c.fillRect(-150, -34 + b, 296, 3);
  // The tank's undercarriage: tool boxes, spare tyre, chains.
  c.fillStyle = M.steelD;
  c.fillRect(-82, -30 + b, 34, 12);
  c.fillRect(-20, -30 + b, 26, 10);
  wheel(E, M, -36, -21 + b, 10, lk.seed, {});
  c.strokeStyle = M.steel;
  c.lineWidth = 0.8;
  c.beginPath();
  for (let i = 0; i < 6; i++) c.arc(-60 + i * 3, -24 + b + Math.sin(lk.t * 6 + i) * 0.6, 1.4, 0, Math.PI * 2);
  c.stroke();
  // ---- the tank (or two): long riveted cylinders, rounded at the ends ----
  const R = lk.rig;
  const water = R?.cargo === 'water';
  const twin = R?.variant === 'twin';
  const ty = -66 + b;
  const tr = twin ? 27 : 30;
  const tankAt = (tx0: number, tx1: number, big: boolean) => {
    const tank = new Path2D();
    tank.moveTo(tx0 + 12, ty - tr);
    tank.lineTo(tx1 - 10, ty - tr);
    tank.quadraticCurveTo(tx1 + 2, ty - tr, tx1 + 2, ty);
    tank.quadraticCurveTo(tx1 + 2, ty + tr, tx1 - 10, ty + tr);
    tank.lineTo(tx0 + 12, ty + tr);
    tank.quadraticCurveTo(tx0 - 2, ty + tr, tx0 - 2, ty);
    tank.quadraticCurveTo(tx0 - 2, ty - tr, tx0 + 12, ty - tr);
    // Fuel rides in a rust-black tank; water in a scrubbed steel one.
    const body = water ? M.steel : M.rust;
    const bodyL = water ? M.steelL : M.rustL;
    c.fillStyle = vgrad(c, ty - tr, ty + tr, [[0, bodyL], [0.12, body], [0.45, mix(body, M.steelD, 0.35)], [0.8, M.steelD], [1, M.dark]]);
    c.fill(tank);
    sideLight(c, tank, tx0, tx1, M, 0.25);
    c.save();
    c.clip(tank);
    for (let i = 0; i < 26; i++) {
      const sx = tx0 + hash(lk.seed, i) * (tx1 - tx0);
      c.fillStyle = hexA(i % 3 ? M.rustL : M.dark, (water ? 0.08 : 0.18) + hash(lk.seed, i, 2) * 0.2);
      c.fillRect(sx, ty - tr + hash(lk.seed, i, 1) * 20, 1.2 + hash(lk.seed, i, 3) * 3, 10 + hash(lk.seed, i, 4) * 30);
    }
    // The painted band, and the name stencilled on it.
    const bandC = water ? mix(M.accent, '#3a8ab8', 0.7) : M.accent;
    c.fillStyle = hexA(bandC, 0.8);
    c.fillRect(tx0, ty - 5, tx1 - tx0, 10);
    c.fillStyle = hexA(M.dark, 0.5);
    c.fillRect(tx0, ty + 5, tx1 - tx0, 1.2);
    if (big && R) {
      c.font = `700 8.4px "Stencil", "Oswald", "Arial Narrow", Impact, sans-serif`;
      c.textAlign = 'center';
      c.fillStyle = hexA(M.dark, 0.85);
      const label = R.name.split('').join(String.fromCharCode(8202));
      // Lettering reads the right way round even when the scene is mirrored.
      c.save();
      c.translate((tx0 + tx1) / 2 + (twin ? 0 : 24), ty + 3.2);
      if (R.flip) c.scale(-1, 1);
      const room = (tx1 - tx0) * (twin ? 0.9 : 0.62);
      const lw = c.measureText(label).width;
      if (lw > room) c.scale(room / lw, 1);
      fillCrisp(c, label, 0, 0);
      c.restore();
      c.textAlign = 'left';
    }
    if (big && !twin) {
      const ex = tx0 + 46;
      c.strokeStyle = hexA(M.accent, 0.85);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(ex, ty - 2, 15, 0, Math.PI * 2);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        c.moveTo(ex + Math.cos(a) * 15, ty - 2 + Math.sin(a) * 15);
        c.lineTo(ex + Math.cos(a) * 19, ty - 2 + Math.sin(a) * 19);
      }
      c.stroke();
      skull(c, ex, ty - 4, 9, M.accent, mix(M.rust, M.dark, 0.6));
    }
    const nb = Math.floor((tx1 - tx0) / 24);
    for (let i = 0; i < nb; i++) {
      const bx = tx0 + 10 + i * 24;
      c.fillStyle = vgrad(c, ty - tr, ty + tr, [[0, M.steelL], [0.2, M.steel], [1, M.dark]]);
      c.fillRect(bx, ty - tr, 3.4, tr * 2);
      c.fillStyle = hexA(M.chromeL, 0.4);
      for (let k = 0; k < 6; k++) c.fillRect(bx + 1, ty - tr + 6 + k * 9, 1.2, 1.2);
    }
    c.fillStyle = vgrad(c, ty, ty + tr, [[0, hexA(M.dark, 0)], [1, hexA(M.dark, 0.6)]]);
    c.fillRect(tx0, ty, tx1 - tx0, tr);
    c.restore();
    rimEdge(c, tank, ty - tr, 8, M, 2);
  };
  const tx0 = -150;
  const tx1 = 40;
  if (twin) {
    tankAt(-150, -60, false);
    c.fillStyle = M.steelD;
    c.fillRect(-60, -40 + b, 14, 4);
    tankAt(-48, 40, true);
  } else tankAt(tx0, tx1, true);
  // Catwalk rail and spikes along the top; the ladder at the back.
  c.strokeStyle = M.steel;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(tx0 + 4, ty - tr - 8);
  c.lineTo(tx1 - 6, ty - tr - 8);
  for (let i = 0; i < 12; i++) {
    const px = tx0 + 6 + i * 15.5;
    c.moveTo(px, ty - tr - 8);
    c.lineTo(px, ty - tr);
  }
  c.stroke();
  spikes(c, M, Array.from({ length: 10 }, (_, i) => [tx0 + 18 + i * 17, ty - tr - 8, -1.57 + (i % 2 ? 0.3 : -0.3), 6] as [number, number, number, number]));
  c.strokeStyle = M.steelL;
  c.lineWidth = 0.9;
  c.beginPath();
  c.moveTo(tx0 - 4, ty - tr - 6);
  c.lineTo(tx0 - 6, -28 + b);
  c.moveTo(tx0 + 2, ty - tr - 6);
  c.lineTo(tx0, -28 + b);
  for (let i = 0; i < 7; i++) {
    c.moveTo(tx0 - 4.5, ty - tr + i * 9);
    c.lineTo(tx0 + 1.5, ty - tr + i * 9);
  }
  c.stroke();
  // The rear platform and the gun nest on top (a shield and a mounted gun).
  c.fillStyle = M.steelD;
  c.fillRect(tx0 - 10, -40 + b, 14, 4);
  const nx = -48;
  const nest = new Path2D();
  nest.moveTo(nx - 14, ty - tr - 1);
  nest.lineTo(nx - 11, ty - tr - 12);
  nest.lineTo(nx + 11, ty - tr - 12);
  nest.lineTo(nx + 14, ty - tr - 1);
  nest.closePath();
  c.fillStyle = vgrad(c, ty - tr - 12, ty - tr, [[0, M.steelL], [0.3, M.steel], [1, M.steelD]]);
  c.fill(nest);
  rimEdge(c, nest, ty - tr - 13, 3, M);
  // The scars: scorches, lances stuck in the plate, patches welded over the holes.
  if (R) for (const mk2 of R.marks) scar(c, M, mk2, b);
  // The fifth wheel: the tank's front on the tractor.
  c.fillStyle = M.steelD;
  c.fillRect(34, -40 + b, 22, 8);
  // ---- the tractor: cab, long nose, blowers, stacks ----
  // Fuel drums behind the cab.
  for (const [dx, dy] of [[47, -54], [47, -42]] as [number, number][]) {
    c.fillStyle = vgrad(c, dy - 6 + b, dy + 6 + b, [[0, M.paintL], [0.4, M.paint], [1, M.paintD]]);
    c.fillRect(dx - 6, dy - 6 + b, 12, 12);
    c.fillStyle = hexA(M.dark, 0.5);
    c.fillRect(dx - 6, dy - 1 + b, 12, 1);
  }
  // The stacks: two tall pipes.
  for (const sx of [51, 57]) {
    c.fillStyle = vgrad(c, -126, -40, [[0, M.chromeL], [0.2, M.chrome], [1, M.chromeD]]);
    c.fillRect(sx - 1.8, -126 + b, 3.6, 86);
    c.fillStyle = M.dark;
    c.fillRect(sx - 2.4, -128 + b, 4.8, 3);
  }
  // Cab: armoured, a slit for a windscreen.
  const cab = new Path2D();
  cab.moveTo(60, -34 + b);
  cab.lineTo(60, -86 + b);
  cab.lineTo(90, -88 + b);
  cab.lineTo(100, -64 + b);
  cab.lineTo(100, -34 + b);
  cab.closePath();
  c.fillStyle = vgrad(c, -88 + b, -34 + b, [[0, M.steelL], [0.1, M.paint], [0.6, M.paintD], [1, M.dark]]);
  c.fill(cab);
  sideLight(c, cab, 60, 100, M, 0.3);
  c.fillStyle = M.glass;
  c.beginPath();
  c.moveTo(66, -80 + b);
  c.lineTo(88, -82 + b);
  c.lineTo(94, -70 + b);
  c.lineTo(66, -70 + b);
  c.fill();
  // Armour over the glass: bars.
  c.strokeStyle = M.steelD;
  c.lineWidth = 1.6;
  c.beginPath();
  for (let i = 0; i < 4; i++) {
    c.moveTo(70 + i * 6, -82 + b);
    c.lineTo(70 + i * 6, -70 + b);
  }
  c.stroke();
  if (lk.crew) {
    c.save();
    c.beginPath();
    c.moveTo(66, -80 + b);
    c.lineTo(88, -82 + b);
    c.lineTo(94, -70 + b);
    c.lineTo(66, -70 + b);
    c.clip();
    figure(E, M, 80, -54 + b, 26, 'drive', lk.t, { mask: true });
    c.restore();
  }
  // The door, rivets, a skull.
  c.strokeStyle = hexA(M.dark, 0.6);
  c.lineWidth = 0.6;
  c.strokeRect(64, -66 + b, 22, 28);
  c.fillStyle = hexA(M.steelL, 0.5);
  for (let i = 0; i < 6; i++) {
    c.fillRect(63, -64 + b + i * 5, 1, 1);
    c.fillRect(98, -60 + b + i * 4.5, 1, 1);
  }
  skull(c, 75, -60 + b, 4, hexA(M.accent, 0.8), M.dark);
  // The tally of cars put over, painted on the door in fives.
  if (R && R.kills > 0) {
    c.strokeStyle = hexA(M.accent, 0.9);
    c.lineWidth = 0.9;
    c.beginPath();
    const n = Math.min(40, R.kills);
    for (let i = 0; i < n; i++) {
      const grp = Math.floor(i / 5);
      const gx = 66 + (grp % 4) * 5;
      const gy = -52 + b + Math.floor(grp / 4) * 7;
      const k = i % 5;
      if (k < 4) {
        c.moveTo(gx + k * 1.1, gy);
        c.lineTo(gx + k * 1.1, gy + 5);
      } else {
        c.moveTo(gx - 0.5, gy + 4);
        c.lineTo(gx + 4, gy + 1);
      }
    }
    c.stroke();
  }
  rimEdge(c, cab, -90 + b, 4, M, 1.5);
  // The long nose, the bonnet with two blowers through it, the grille, the bumper.
  const nose = new Path2D();
  nose.moveTo(99, -60 + b);
  nose.quadraticCurveTo(120, -64 + b, 144, -58 + b);
  nose.lineTo(150, -52 + b);
  nose.lineTo(150, -24 + b);
  nose.lineTo(99, -24 + b);
  nose.closePath();
  c.fillStyle = vgrad(c, -64 + b, -24 + b, [[0, M.paintL], [0.12, M.paint], [0.7, M.paintD], [1, M.dark]]);
  c.fill(nose);
  sideLight(c, nose, 99, 150, M, 0.3);
  // Louvres in the side of the bonnet.
  c.strokeStyle = hexA(M.dark, 0.7);
  c.lineWidth = 0.9;
  c.beginPath();
  for (let i = 0; i < 7; i++) {
    c.moveTo(108 + i * 4, -50 + b);
    c.lineTo(108 + i * 4, -38 + b);
  }
  c.stroke();
  // The fenders over the front wheel, in rust.
  c.fillStyle = M.rust;
  c.beginPath();
  c.moveTo(112, -26 + b);
  c.quadraticCurveTo(132, -50 + b, 152, -26 + b);
  c.lineTo(148, -24 + b);
  c.quadraticCurveTo(132, -42 + b, 116, -24 + b);
  c.fill();
  rimEdge(c, nose, -66 + b, 5, M, 1.5);
  blower(c, M, 114, -60 + b, 13, 16, lk.boost, lk.t);
  blower(c, M, 130, -60 + b, 13, 16, lk.boost, lk.t + 0.3);
  // Grille: chrome slats.
  c.fillStyle = vgrad(c, -56 + b, -24 + b, [[0, M.chromeL], [0.5, M.chrome], [1, M.chromeD]]);
  c.fillRect(146, -54 + b, 6, 30);
  c.strokeStyle = M.dark;
  c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    c.moveTo(146, -52 + b + i * 3.6);
    c.lineTo(152, -52 + b + i * 3.6);
  }
  c.stroke();
  // The cowcatcher: a ram of spikes.
  c.fillStyle = M.steelD;
  c.beginPath();
  c.moveTo(150, -30 + b);
  c.lineTo(162, -14);
  c.lineTo(160, -6);
  c.lineTo(150, -10);
  c.fill();
  spikes(c, M, [[152, -28 + b, 0.1, 12], [156, -20, 0.2, 10], [158, -12, 0.3, 8], [150, -40 + b, 0, 9]]);
  // Lamps.
  c.fillStyle = E.night > 0.1 ? '#fff1c8' : M.chromeL;
  c.beginPath();
  c.arc(155, -36 + b, 2.6, 0, Math.PI * 2);
  c.arc(146, -60 + b, 2.2, 0, Math.PI * 2);
  c.fill();
  // Mud flaps, a chain, the steps.
  c.fillStyle = M.dark;
  c.fillRect(102, -32 + b, 3, 12);
  c.fillRect(-148, -32 + b, 3, 14);
  wheels(E, M, lk, [[-130, 17], [-96, 17], [64, 17], [92, 17], [132, 17]], { spokes: 8, chromeHub: true, spike: true });
}

/** One of the rig's scars, in its units. */
function scar(c: CanvasRenderingContext2D, M: Mats, m: Mark, b: number) {
  const x = m.at;
  const y = -m.up + b;
  const h = (k: number) => hash(m.seed, k);
  if (m.kind === 'scorch') {
    const g = c.createRadialGradient(x, y, 0, x, y, 9 + h(1) * 6);
    g.addColorStop(0, hexA('#0a0806', 0.85));
    g.addColorStop(0.5, hexA('#1a1410', 0.5));
    g.addColorStop(1, hexA('#1a1410', 0));
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x - 4, y, 16 + h(1) * 8, 8 + h(2) * 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = hexA(M.rustL, 0.5);
    c.fillRect(x - 1, y - 1, 2, 2);
  } else if (m.kind === 'lance') {
    const a = -0.6 - h(3) * 0.8;
    c.strokeStyle = M.steelD;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - Math.cos(a) * 26, y + Math.sin(a) * 26);
    c.stroke();
    c.fillStyle = hexA('#0a0806', 0.6);
    c.beginPath();
    c.arc(x, y, 3, 0, Math.PI * 2);
    c.fill();
  } else {
    const w = 12 + h(4) * 6;
    c.fillStyle = vgrad(c, y - 6, y + 6, [[0, M.steelL], [0.4, M.steel], [1, M.steelD]]);
    c.fillRect(x - w / 2, y - 6, w, 12);
    c.strokeStyle = hexA('#ffb060', 0.25);
    c.lineWidth = 0.8;
    c.strokeRect(x - w / 2, y - 6, w, 12);
    c.fillStyle = hexA(M.chromeL, 0.6);
    for (let k = 0; k < 4; k++) {
      c.fillRect(x - w / 2 + 1, y - 5 + k * 3.2, 1, 1);
      c.fillRect(x + w / 2 - 2, y - 5 + k * 3.2, 1, 1);
    }
  }
}

// ---- the drifter: a battered black ute with a harpoon on the tray --------------------------------
function drawDrifter(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  c.fillStyle = M.dark;
  c.fillRect(-46, -14 + b, 92, 3);
  const body = new Path2D();
  body.moveTo(-46, -12 + b);
  body.lineTo(-47, -24 + b);
  body.lineTo(-8, -24 + b);
  body.lineTo(-4, -36 + b);
  body.lineTo(12, -36 + b);
  body.lineTo(18, -26 + b);
  body.lineTo(44, -24 + b);
  body.lineTo(46, -14 + b);
  body.lineTo(44, -11 + b);
  body.closePath();
  c.fillStyle = vgrad(c, -36 + b, -11 + b, [[0, M.paintL], [0.15, M.paint], [0.8, M.paintD], [1, M.dark]]);
  c.fill(body);
  sideLight(c, body, -47, 46, M, 0.3);
  rimEdge(c, body, -37 + b, 4, M);
  c.fillStyle = M.glass;
  c.beginPath();
  c.moveTo(-1, -34 + b);
  c.lineTo(10, -34 + b);
  c.lineTo(15, -27 + b);
  c.lineTo(-1, -27 + b);
  c.fill();
  // Dust-caked, a spare wheel in the tray, jerry cans, the harpoon.
  c.fillStyle = hexA(M.rust, 0.5);
  c.fillRect(-46, -16 + b, 92, 4);
  wheel(E, M, -26, -30 + b, 8, lk.seed, { spokes: 5 });
  c.fillStyle = M.paintD;
  c.fillRect(-42, -32 + b, 6, 8);
  c.fillStyle = M.steelD;
  c.fillRect(-20, -34 + b, 22, 2.6);
  c.fillStyle = M.chrome;
  c.beginPath();
  c.moveTo(2, -35 + b);
  c.lineTo(7, -32.7 + b);
  c.lineTo(2, -31.4 + b);
  c.fill();
  if (lk.crew) {
    c.save();
    c.beginPath();
    c.rect(-1, -34 + b, 15, 7);
    c.clip();
    figure(E, M, 5, -18 + b, 17, 'drive', lk.t, { mask: false });
    c.restore();
  }
  c.fillStyle = M.chrome;
  c.fillRect(43, -24 + b, 3, 10);
  blower(c, M, 30, -24 + b, 9, 10, lk.boost, lk.t);
  wheels(E, M, lk, [[-30, 13], [30, 13]], { spokes: 6, chromeHub: true });
}

// ---- hot rod ----------------------------------------------------------------------------------------
function drawHotrod(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  const s = lk.seed;
  // Rails, then the body: a chopped coupe, low nose, rear deck.
  c.fillStyle = M.dark;
  c.fillRect(-38, -12 + b, 74, 3);
  const body = new Path2D();
  body.moveTo(-38, -12 + b);
  body.lineTo(-40, -22 + b);
  body.lineTo(-22, -24 + b);
  body.lineTo(-18, -34 + b);
  body.lineTo(4, -34 + b);
  body.lineTo(8, -24 + b);
  body.lineTo(34, -22 + b);
  body.lineTo(38, -14 + b);
  body.lineTo(36, -10 + b);
  body.closePath();
  c.fillStyle = vgrad(c, -34 + b, -10 + b, [[0, M.paintL], [0.15, M.paint], [0.75, M.paintD], [1, M.dark]]);
  c.fill(body);
  sideLight(c, body, -40, 38, M);
  c.save();
  c.clip(body);
  // A flame job down the side, or the clan's stripes.
  if (lk.clan === 'party' && s % 3 !== 2) {
    c.fillStyle = hexA(mix('#ffb020', M.paint, 0.35), 0.85);
    c.beginPath();
    c.moveTo(36, -18 + b);
    for (let i = 0; i < 5; i++) {
      const fx = 30 - i * 9;
      c.quadraticCurveTo(fx - 3, -24 + b, fx - 9, -19 + b - (i % 2) * 2);
      c.quadraticCurveTo(fx - 5, -16 + b, fx - 8, -13 + b);
    }
    c.lineTo(36, -13 + b);
    c.fill();
  } else {
    c.fillStyle = hexA(M.accent, 0.7);
    c.fillRect(-40, -20 + b, 80, 2.5);
  }
  // Rust where the paint has gone.
  c.fillStyle = hexA(M.rust, 0.6);
  for (let i = 0; i < 5; i++) c.fillRect(-36 + hash(s, i) * 66, -30 + b + hash(s, i, 1) * 16, 2 + hash(s, i, 2) * 5, 2 + hash(s, i, 3) * 3);
  c.restore();
  rimEdge(c, body, -35 + b, 4, M);
  // Window slit, the driver.
  c.fillStyle = M.glass;
  c.beginPath();
  c.moveTo(-15, -32 + b);
  c.lineTo(2, -32 + b);
  c.lineTo(5, -26 + b);
  c.lineTo(-15, -26 + b);
  c.fill();
  if (lk.crew) {
    c.save();
    c.beginPath();
    c.rect(-15, -33 + b, 20, 7);
    c.clip();
    figure(E, M, -6, -16 + b, 18, 'drive', lk.t, { paint: lk.clan === 'party', mask: lk.clan !== 'party' });
    c.restore();
  }
  // Headers along the flank, the blower on the nose, spikes on the bumper and the roof.
  pipes(c, M, [[12, -17 + b, -2, -12 + b], [16, -17 + b, -6, -11 + b]]);
  blower(c, M, 20, -22 + b, 10, 12, lk.boost, lk.t + s);
  spikes(c, M, [[37, -16 + b, 0.05, 8], [37, -12 + b, 0.15, 6], [-10, -34 + b, -1.4, 5], [-4, -34 + b, -1.7, 5], [-40, -20 + b, 3.1, 5]]);
  // Chrome grille and the lamp.
  c.fillStyle = M.chrome;
  c.fillRect(34, -22 + b, 3, 9);
  c.fillStyle = E.night > 0.1 ? '#fff1c8' : M.chromeL;
  c.beginPath();
  c.arc(34, -20 + b, 1.8, 0, Math.PI * 2);
  c.fill();
  // The rear fender over the big wheel.
  c.fillStyle = M.paintD;
  c.beginPath();
  c.moveTo(-42, -12 + b);
  c.quadraticCurveTo(-26, -32 + b, -10, -12 + b);
  c.lineTo(-14, -12 + b);
  c.quadraticCurveTo(-26, -26 + b, -38, -12 + b);
  c.fill();
  // The lancer on the deck.
  if (lk.crew) figure(E, M, -30, -22 + b, 18, s % 2 ? 'throw' : 'cheer', lk.t * 1.4 + s, { paint: lk.clan === 'party', lance: true, mask: lk.clan !== 'party' });
  wheels(E, M, lk, [[-26, 13], [28, 9.5]], { spokes: 5, chromeHub: true, spike: s % 2 === 0 });
}

// ---- porcupine -----------------------------------------------------------------------------------
function drawPorcupine(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  const dome = new Path2D();
  dome.moveTo(-32, -12 + b);
  dome.bezierCurveTo(-32, -40 + b, 20, -44 + b, 32, -14 + b);
  dome.lineTo(32, -10 + b);
  dome.lineTo(-32, -10 + b);
  dome.closePath();
  // The quills first, then the shell over their roots.
  const quills: [number, number, number, number][] = [];
  for (let i = 0; i < 22; i++) {
    const q = i / 21;
    const a = Math.PI * (1.02 + q * 0.96);
    const px = -2 + Math.cos(a) * 31;
    const py = -14 + b + Math.sin(a) * 26;
    quills.push([px, py, a + (hash(lk.seed, i) - 0.5) * 0.3, 10 + hash(lk.seed, i, 1) * 8]);
  }
  spikes(c, M, quills);
  c.fillStyle = vgrad(c, -40 + b, -10 + b, [[0, M.rustL], [0.2, M.rust], [0.8, mix(M.rust, M.dark, 0.5)], [1, M.dark]]);
  c.fill(dome);
  sideLight(c, dome, -32, 32, M, 0.3);
  rimEdge(c, dome, -42 + b, 8, M, 1.4);
  c.fillStyle = M.glass;
  c.beginPath();
  c.moveTo(4, -30 + b);
  c.quadraticCurveTo(14, -30 + b, 20, -22 + b);
  c.lineTo(4, -22 + b);
  c.fill();
  // Plates bolted on.
  c.strokeStyle = hexA(M.dark, 0.6);
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(-20, -30 + b);
  c.lineTo(-20, -12 + b);
  c.moveTo(-6, -34 + b);
  c.lineTo(-6, -12 + b);
  c.stroke();
  if (lk.crew) figure(E, M, -10, -30 + b, 14, 'throw', lk.t * 1.2 + lk.seed, { paint: lk.clan === 'party', lance: true });
  spikes(c, M, [[32, -14 + b, 0, 14], [30, -20 + b, -0.3, 9]]);
  wheels(E, M, lk, [[-20, 11], [21, 11]], { spokes: 6, spike: true });
}

// ---- polecat -----------------------------------------------------------------------------------
function drawPolecat(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  // The pole first (it stands behind the car body): a long sprung pole, a counterweight, the boarder.
  const px = -6;
  const py = -60 + b;
  const len = 170;
  const a = lk.pole + Math.sin(lk.t * 2.3 + lk.seed) * 0.05;
  const tipX = px + Math.sin(a) * len;
  const tipY = py - Math.cos(a) * len;
  c.lineCap = 'round';
  c.strokeStyle = M.steelD;
  c.lineWidth = 2.6;
  c.beginPath();
  c.moveTo(px - Math.sin(a) * 18, py + Math.cos(a) * 18);
  c.quadraticCurveTo(px + Math.sin(a) * len * 0.5 - 4, py - Math.cos(a) * len * 0.5, tipX, tipY);
  c.stroke();
  c.strokeStyle = hexA(M.rim, M.rimA * 0.6);
  c.lineWidth = 0.8;
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = M.steel;
  c.fillRect(px - Math.sin(a) * 18 - 4, py + Math.cos(a) * 18 - 4, 8, 8);
  if (lk.boarder) {
    // On a rope from the tip, swinging.
    const sw = Math.sin(lk.t * 2.8 + lk.seed) * 0.35;
    const hx = tipX + Math.sin(sw) * 22;
    const hy = tipY + Math.cos(sw) * 22;
    c.strokeStyle = M.steelL;
    c.lineWidth = 0.6;
    c.beginPath();
    c.moveTo(tipX, tipY);
    c.lineTo(hx, hy);
    c.stroke();
    figure(E, M, hx, hy + 18, 18, 'hang', lk.t * 2.8 + lk.seed, { paint: lk.clan === 'party', lance: true });
  }
  // The A-frame mast on the roof.
  c.strokeStyle = M.steel;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-16, -34 + b);
  c.lineTo(px, py);
  c.lineTo(6, -34 + b);
  c.stroke();
  // The saloon: a fat old sedan.
  const body = new Path2D();
  body.moveTo(-44, -10 + b);
  body.lineTo(-44, -22 + b);
  body.lineTo(-22, -24 + b);
  body.lineTo(-16, -36 + b);
  body.lineTo(12, -36 + b);
  body.lineTo(20, -24 + b);
  body.lineTo(42, -22 + b);
  body.lineTo(44, -12 + b);
  body.lineTo(42, -9 + b);
  body.closePath();
  c.fillStyle = vgrad(c, -36 + b, -9 + b, [[0, M.paintL], [0.15, M.paint], [0.8, M.paintD], [1, M.dark]]);
  c.fill(body);
  sideLight(c, body, -44, 44, M);
  rimEdge(c, body, -37 + b, 4, M);
  c.fillStyle = M.glass;
  c.fillRect(-13, -33 + b, 11, 8);
  c.fillRect(0, -33 + b, 10, 8);
  c.fillStyle = M.chrome;
  c.fillRect(-44, -16 + b, 88, 1.5);
  c.fillRect(41, -22 + b, 3, 10);
  if (lk.crew) {
    figure(E, M, -2, -36 + b, 16, 'stand', lk.t + lk.seed, { paint: lk.clan === 'party' });
    c.save();
    c.beginPath();
    c.rect(0, -33 + b, 10, 8);
    c.clip();
    figure(E, M, 4, -18 + b, 16, 'drive', lk.t, { paint: lk.clan === 'party' });
    c.restore();
  }
  spikes(c, M, [[44, -16 + b, 0.05, 7], [-44, -18 + b, 3.1, 6]]);
  wheels(E, M, lk, [[-28, 11.5], [29, 11.5]], { spokes: 5, chromeHub: true });
}

// ---- the music truck ------------------------------------------------------------------------------
function drawHowler(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  const beat = lk.beat;
  // The bed and chassis.
  c.fillStyle = M.dark;
  c.fillRect(-82, -30 + b, 160, 8);
  c.fillStyle = vgrad(c, -38 + b, -28 + b, [[0, M.steelL], [0.3, M.steel], [1, M.steelD]]);
  c.fillRect(-84, -38 + b, 120, 8);
  // The speaker wall: cabinets stacked, cones pumping with the beat.
  const x0 = -60;
  const cols = 5;
  const rows = 4;
  const cw = 17;
  const ch = 13;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = x0 + i * cw;
      const cy = -40 + b - (j + 1) * ch;
      c.fillStyle = vgrad(c, cy, cy + ch, [[0, j === rows - 1 ? M.steelL : M.steel], [0.15, M.steelD], [1, M.dark]]);
      c.fillRect(cx, cy, cw - 1, ch - 1);
      const pulse = 1 + beat * 0.14 * (0.6 + 0.4 * hash(i, j, lk.seed));
      c.fillStyle = M.dark;
      c.beginPath();
      c.arc(cx + cw / 2 - 0.5, cy + ch / 2 - 0.5, 5.4 * pulse, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = vgrad(c, cy + 2, cy + ch - 2, [[0, M.chrome], [1, M.chromeD]]);
      c.beginPath();
      c.arc(cx + cw / 2 - 0.5, cy + ch / 2 - 0.5, 3.6 * pulse, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = M.chromeL;
      c.beginPath();
      c.arc(cx + cw / 2 - 0.5, cy + ch / 2 - 0.5, 1.1, 0, Math.PI * 2);
      c.fill();
    }
  }
  const wall = new Path2D();
  wall.rect(x0, -40 + b - rows * ch, cols * cw, rows * ch);
  rimEdge(c, wall, -41 + b - rows * ch, 3, M, 1.4);
  // Flags on the wall.
  for (let k = 0; k < 2; k++) {
    const fx = x0 + 6 + k * 70;
    const fy = -40 + b - rows * ch;
    c.strokeStyle = M.steelD;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(fx, fy);
    c.lineTo(fx, fy - 22);
    c.stroke();
    c.fillStyle = k ? M.accent : M.rust;
    c.beginPath();
    c.moveTo(fx, fy - 22);
    c.quadraticCurveTo(fx - 8, fy - 19 + Math.sin(lk.t * 7 + k) * 2, fx - 14, fy - 18 + Math.sin(lk.t * 8 + k) * 3);
    c.lineTo(fx, fy - 14);
    c.fill();
  }
  // The drums on the back deck, and the drummers.
  for (let k = 0; k < 3; k++) {
    const dx = -78 + k * 8;
    c.fillStyle = vgrad(c, -56 + b, -38 + b, [[0, M.rustL], [0.3, M.rust], [1, M.dark]]);
    c.fillRect(dx - 4, -54 + b + k * 2, 7, 16 - k * 2);
    c.fillStyle = M.chromeL;
    c.fillRect(dx - 4.5, -55 + b + k * 2, 8, 1.2);
  }
  if (lk.crew) {
    figure(E, M, -82, -38 + b, 18, 'drum', lk.t * 4 + 0.4, { paint: true, dir: 1 });
    figure(E, M, -67, -38 + b, 18, 'drum', lk.t * 4, { paint: true, dir: -1 });
  }
  // The cab-over at the front, and the gantry the guitarist hangs from.
  const cab = new Path2D();
  cab.moveTo(36, -30 + b);
  cab.lineTo(36, -74 + b);
  cab.lineTo(66, -76 + b);
  cab.lineTo(78, -58 + b);
  cab.lineTo(78, -30 + b);
  cab.closePath();
  c.fillStyle = vgrad(c, -76 + b, -30 + b, [[0, M.paintL], [0.1, M.paint], [0.7, M.paintD], [1, M.dark]]);
  c.fill(cab);
  sideLight(c, cab, 36, 78, M, 0.3);
  rimEdge(c, cab, -77 + b, 4, M, 1.4);
  c.fillStyle = M.glass;
  c.beginPath();
  c.moveTo(56, -70 + b);
  c.lineTo(66, -71 + b);
  c.lineTo(75, -58 + b);
  c.lineTo(56, -58 + b);
  c.fill();
  skull(c, 48, -52 + b, 6, M.accent, M.dark);
  c.fillStyle = M.chrome;
  c.fillRect(76, -46 + b, 4, 16);
  pipes(c, M, [[40, -30 + b, 40, -96 + b], [44, -30 + b, 44, -96 + b]]);
  // The gantry: a frame of scaffold off the front bumper.
  c.strokeStyle = M.steel;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(78, -32 + b);
  c.lineTo(92, -32 + b);
  c.lineTo(92, -88 + b);
  c.lineTo(70, -88 + b);
  c.lineTo(66, -76 + b);
  c.moveTo(92, -60 + b);
  c.lineTo(78, -46 + b);
  c.stroke();
  // The guitarist on his bungees, in red, with the double-necked guitar that spits fire.
  const gx = 94;
  const gy = -40 + b + Math.sin(lk.t * 3) * 3;
  c.strokeStyle = hexA(M.dark, 0.9);
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(86, -88 + b);
  c.lineTo(gx, gy - 18);
  c.moveTo(92, -88 + b);
  c.lineTo(gx + 1, gy - 18);
  c.stroke();
  if (lk.crew) {
    const red: Mats = { ...M, cloth: E.tone('#a8281c', M.d, 0.3), clothL: E.tone('#e04030', M.d, 0.7) };
    figure(E, red, gx, gy, 20, 'guitar', lk.t * 6, { mask: true });
    c.save();
    c.translate(gx + 3, gy - 9);
    c.rotate(-0.4 + Math.sin(lk.t * 6) * 0.05);
    c.fillStyle = M.paintD;
    c.fillRect(-4, -3, 8, 7);
    c.fillStyle = M.chromeD;
    c.fillRect(3, -1.8, 18, 1.4);
    c.fillRect(3, 1, 18, 1.4);
    c.fillStyle = M.chrome;
    c.fillRect(20, -2.6, 4, 5);
    c.restore();
  }
  wheels(E, M, lk, [[-62, 15], [-40, 15], [28, 15], [52, 15]], { spokes: 8, chromeHub: true });
}

// ---- the monster tank ------------------------------------------------------------------------
function drawCrusher(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob * 1.6;
  // Suspension: springs and struts between the hull and the axles.
  for (const wx of [-36, 36]) {
    c.strokeStyle = M.chrome;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= 8; i++) c.lineTo(wx + (i % 2 ? 3 : -3), -23 - i * 2.4 + (b * i) / 8);
    c.stroke();
    c.strokeStyle = M.steelD;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(wx - 6, -23);
    c.lineTo(wx - 4, -44 + b);
    c.stroke();
  }
  // The hull: sloped plate, a tank's on wheels.
  const hull = new Path2D();
  hull.moveTo(-52, -42 + b);
  hull.lineTo(-48, -62 + b);
  hull.lineTo(30, -64 + b);
  hull.lineTo(54, -50 + b);
  hull.lineTo(52, -40 + b);
  hull.closePath();
  c.fillStyle = vgrad(c, -64 + b, -40 + b, [[0, M.steelL], [0.12, M.paint], [0.7, M.paintD], [1, M.dark]]);
  c.fill(hull);
  sideLight(c, hull, -52, 54, M, 0.3);
  c.save();
  c.clip(hull);
  c.strokeStyle = hexA(M.dark, 0.55);
  c.lineWidth = 0.6;
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    c.moveTo(-40 + i * 16, -64 + b);
    c.lineTo(-40 + i * 16, -40 + b);
  }
  c.stroke();
  c.fillStyle = hexA(M.chromeL, 0.4);
  for (let i = 0; i < 18; i++) c.fillRect(-46 + i * 5.6, -60 + b, 0.9, 0.9);
  c.restore();
  rimEdge(c, hull, -65 + b, 4, M, 1.4);
  skull(c, 38, -52 + b, 5, M.accent, M.dark);
  // The turret and its gun.
  const tur = new Path2D();
  tur.moveTo(-26, -63 + b);
  tur.lineTo(-20, -76 + b);
  tur.lineTo(8, -77 + b);
  tur.lineTo(16, -64 + b);
  tur.closePath();
  c.fillStyle = vgrad(c, -77 + b, -63 + b, [[0, M.steelL], [0.2, M.steel], [1, M.steelD]]);
  c.fill(tur);
  rimEdge(c, tur, -78 + b, 3, M, 1.2);
  c.fillStyle = M.steelD;
  c.fillRect(12, -73 + b, 46, 3.4);
  c.fillStyle = M.dark;
  c.fillRect(56, -74 + b, 5, 5.4);
  pipes(c, M, [[-46, -60 + b, -46, -72 + b]]);
  if (lk.crew) figure(E, M, -12, -77 + b, 14, 'gun', lk.t + lk.seed, { paint: lk.clan === 'party', aim: 0.3 });
  wheels(E, M, lk, [[-36, 23], [36, 23]], { spokes: 6, deep: true });
}

// ---- bike ---------------------------------------------------------------------------------------
function drawBike(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob * 0.6;
  wheels(E, M, lk, [[-15, 9.5], [16, 9.5]], { wire: true, spokes: 12 });
  // Frame, tank, seat, forks.
  c.lineCap = 'round';
  c.strokeStyle = M.steelD;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-15, -9.5);
  c.lineTo(-4, -18 + b);
  c.lineTo(8, -18 + b);
  c.lineTo(16, -9.5);
  c.moveTo(-15, -9.5);
  c.lineTo(0, -10 + b);
  c.lineTo(8, -18 + b);
  c.stroke();
  c.strokeStyle = M.chrome;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(16, -9.5);
  c.lineTo(11, -25 + b);
  c.lineTo(8, -27 + b);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = vgrad(c, -24 + b, -16 + b, [[0, M.paintL], [0.3, M.paint], [1, M.paintD]]);
  c.beginPath();
  c.ellipse(4, -20 + b, 6, 3.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = M.dark;
  c.fillRect(-10, -20 + b, 8, 2.2);
  c.fillStyle = M.steel;
  c.fillRect(-2, -14 + b, 7, 5);
  pipes(c, M, [[2, -11 + b, -16, -11 + b]]);
  // The rider leaning in, and the bomber behind with a flag of feathers.
  if (lk.crew) {
    const raven = lk.clan === 'ravens';
    figure(E, M, -2, -12 + b, 19, 'drive', lk.t, { paint: lk.clan === 'party', mask: raven });
    figure(E, M, -10, -14 + b, 18, 'throw', lk.t * 1.3 + lk.seed, { paint: lk.clan === 'party', mask: raven, dir: 1 });
    if (raven) {
      c.strokeStyle = M.dark;
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(-16, -18 + b);
      c.lineTo(-18, -38 + b);
      c.stroke();
      c.fillStyle = M.dark;
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.ellipse(-20 - k * 1.5, -36 + b + k * 3 + Math.sin(lk.t * 9 + k) * 0.8, 3, 0.9, 0.3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  c.fillStyle = E.night > 0.1 ? '#fff1c8' : M.chromeL;
  c.beginPath();
  c.arc(13, -22 + b, 1.6, 0, Math.PI * 2);
  c.fill();
}

// ---- buggy ---------------------------------------------------------------------------------------
function drawBuggy(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob * 1.4;
  // The tub, low and open.
  const tub = new Path2D();
  tub.moveTo(-28, -12 + b);
  tub.lineTo(-30, -20 + b);
  tub.lineTo(14, -20 + b);
  tub.lineTo(28, -16 + b);
  tub.lineTo(26, -10 + b);
  tub.closePath();
  c.fillStyle = vgrad(c, -20 + b, -10 + b, [[0, M.paintL], [0.2, M.paint], [1, M.paintD]]);
  c.fill(tub);
  rimEdge(c, tub, -21 + b, 3, M);
  // The engine out the back, its pipes.
  c.fillStyle = vgrad(c, -26 + b, -14 + b, [[0, M.chromeL], [0.4, M.chrome], [1, M.chromeD]]);
  c.fillRect(-30, -26 + b, 10, 10);
  pipes(c, M, [[-24, -20 + b, -32, -24 + b], [-24, -16 + b, -33, -18 + b]]);
  // Roll cage.
  c.strokeStyle = M.steel;
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(-20, -20 + b);
  c.lineTo(-14, -40 + b);
  c.lineTo(6, -40 + b);
  c.lineTo(14, -20 + b);
  c.moveTo(-14, -40 + b);
  c.lineTo(-4, -20 + b);
  c.stroke();
  c.strokeStyle = hexA(M.rim, M.rimA * 0.6);
  c.lineWidth = 0.5;
  c.beginPath();
  c.moveTo(-14, -40.6 + b);
  c.lineTo(6, -40.6 + b);
  c.stroke();
  if (lk.crew) {
    figure(E, M, 2, -14 + b, 17, 'drive', lk.t, { paint: lk.clan === 'party', mask: lk.clan !== 'party' });
    figure(E, M, -12, -20 + b, 17, 'gun', lk.t + lk.seed, { paint: lk.clan === 'party', mask: lk.clan !== 'party', aim: 0.4 });
  }
  // A harpoon gun on the cage.
  c.fillStyle = M.steelD;
  c.fillRect(-10, -44 + b, 16, 2.4);
  c.fillStyle = M.chrome;
  c.beginPath();
  c.moveTo(6, -44.4 + b);
  c.lineTo(10, -42.8 + b);
  c.lineTo(6, -41.4 + b);
  c.fill();
  spikes(c, M, [[28, -14 + b, 0.1, 7]]);
  wheels(E, M, lk, [[-19, 12.5], [22, 9.5]], { spokes: 5, deep: true });
}

// ---- ram truck --------------------------------------------------------------------------------
function drawRam(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  c.fillStyle = M.dark;
  c.fillRect(-48, -16 + b, 96, 4);
  // The bed, with its crew.
  const bed = new Path2D();
  bed.moveTo(-48, -14 + b);
  bed.lineTo(-48, -28 + b);
  bed.lineTo(2, -28 + b);
  bed.lineTo(2, -14 + b);
  bed.closePath();
  c.fillStyle = vgrad(c, -28 + b, -14 + b, [[0, M.rustL], [0.2, M.rust], [1, M.dark]]);
  c.fill(bed);
  rimEdge(c, bed, -29 + b, 3, M);
  // Roll bar and stacks.
  c.strokeStyle = M.steel;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(-40, -28 + b);
  c.lineTo(-36, -46 + b);
  c.lineTo(-6, -46 + b);
  c.lineTo(-2, -28 + b);
  c.stroke();
  pipes(c, M, [[2, -30 + b, 2, -60 + b], [-2, -30 + b, -2, -60 + b]]);
  if (lk.crew) {
    figure(E, M, -34, -28 + b, 18, 'throw', lk.t * 1.2 + lk.seed, { paint: lk.clan === 'party', lance: true, mask: lk.clan !== 'party' });
    figure(E, M, -18, -28 + b, 18, 'cheer', lk.t * 2 + lk.seed, { paint: lk.clan === 'party', mask: lk.clan !== 'party' });
  }
  // The cab and nose.
  const cab = new Path2D();
  cab.moveTo(2, -14 + b);
  cab.lineTo(4, -44 + b);
  cab.lineTo(22, -44 + b);
  cab.lineTo(28, -30 + b);
  cab.lineTo(46, -28 + b);
  cab.lineTo(48, -14 + b);
  cab.closePath();
  c.fillStyle = vgrad(c, -44 + b, -14 + b, [[0, M.paintL], [0.15, M.paint], [0.8, M.paintD], [1, M.dark]]);
  c.fill(cab);
  sideLight(c, cab, 2, 48, M);
  rimEdge(c, cab, -45 + b, 4, M);
  c.fillStyle = M.glass;
  c.fillRect(8, -41 + b, 13, 9);
  c.strokeStyle = M.steelD;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(12, -41 + b);
  c.lineTo(12, -32 + b);
  c.moveTo(17, -41 + b);
  c.lineTo(17, -32 + b);
  c.stroke();
  skull(c, 36, -22 + b, 4, M.accent, M.dark);
  // The ram: a plough of steel with horns.
  c.fillStyle = vgrad(c, -34 + b, -4, [[0, M.steelL], [0.3, M.steel], [1, M.steelD]]);
  c.beginPath();
  c.moveTo(46, -34 + b);
  c.lineTo(56, -30 + b);
  c.lineTo(60, -6);
  c.lineTo(46, -8);
  c.fill();
  c.strokeStyle = M.dark;
  c.lineWidth = 0.8;
  c.beginPath();
  for (let i = 0; i < 5; i++) {
    c.moveTo(48 + i * 2.2, -32 + b + i);
    c.lineTo(50 + i * 2.2, -7);
  }
  c.stroke();
  c.strokeStyle = M.accent;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(50, -34 + b);
  c.quadraticCurveTo(58, -46 + b, 66, -42 + b);
  c.stroke();
  spikes(c, M, [[58, -28 + b, 0, 10], [60, -18 + b, 0.05, 10], [60, -10, 0.1, 8]]);
  wheels(E, M, lk, [[-30, 14], [31, 14]], { spokes: 6, chromeHub: true });
}

// ---- the warlord's throne-car --------------------------------------------------------------------
function drawThrone(E: Env, M: Mats, lk: Look) {
  const c = E.ctx;
  const b = lk.bob;
  const car = (y0: number, k: number) => {
    const p = new Path2D();
    p.moveTo(-62, y0);
    p.lineTo(-64, y0 - 14);
    p.lineTo(-50, y0 - 18);
    p.lineTo(-30, y0 - 16);
    p.lineTo(-22, y0 - 26);
    p.lineTo(14, y0 - 26);
    p.lineTo(24, y0 - 16);
    p.lineTo(60, y0 - 14);
    p.lineTo(62, y0 - 4);
    p.closePath();
    c.fillStyle = vgrad(c, y0 - 26, y0, [[0, M.paintL], [0.12, M.paint], [0.7, M.paintD], [1, M.dark]]);
    c.fill(p);
    sideLight(c, p, -64, 62, M, 0.3);
    rimEdge(c, p, y0 - 27, 4, M, 1.4);
    // Fins, chrome trim, a window.
    c.fillStyle = M.chrome;
    c.fillRect(-60, y0 - 9, 120, 1.6);
    c.beginPath();
    c.moveTo(-64, y0 - 14);
    c.lineTo(-58, y0 - 24 - k * 2);
    c.lineTo(-50, y0 - 18);
    c.fill();
    c.fillStyle = M.glass;
    c.fillRect(-18, y0 - 23, 30, 7);
  };
  c.fillStyle = M.dark;
  c.fillRect(-60, -30 + b, 120, 6);
  car(-22 + b, 0);
  // Struts between the two cars.
  c.strokeStyle = M.chrome;
  c.lineWidth = 1.6;
  c.beginPath();
  for (const sx of [-40, -10, 30]) {
    c.moveTo(sx, -48 + b);
    c.lineTo(sx + 4, -58 + b);
  }
  c.stroke();
  car(-56 + b, 1);
  // Twin blowers through the upper hood, the stacks, banners, the warlord on top.
  blower(c, M, 34, -70 + b, 12, 16, lk.boost, lk.t);
  blower(c, M, 48, -70 + b, 12, 16, lk.boost, lk.t + 0.4);
  pipes(c, M, [[-40, -46 + b, -54, -46 + b], [-40, -50 + b, -54, -50 + b]]);
  for (const [fx, col] of [[-56, M.accent], [-30, M.rust]] as [number, string][]) {
    c.strokeStyle = M.steelD;
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(fx, -72 + b);
    c.lineTo(fx, -104 + b);
    c.stroke();
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(fx, -104 + b);
    c.lineTo(fx - 16, -100 + b + Math.sin(lk.t * 6 + fx) * 2);
    c.lineTo(fx - 14, -92 + b + Math.sin(lk.t * 6 + fx + 1) * 2);
    c.lineTo(fx, -92 + b);
    c.fill();
  }
  skull(c, 0, -40 + b, 6, M.accent, M.dark);
  if (lk.crew) {
    const gold: Mats = { ...M, cloth: E.tone('#3a2a1a', M.d, 0.2), skin: E.tone('#c8b8a0', M.d, 0.4), skinL: E.tone('#f0e0c0', M.d, 0.8) };
    figure(E, gold, -6, -82 + b, 24, 'sit', lk.t, { mask: true });
    // A chrome crown.
    c.fillStyle = M.chromeL;
    c.beginPath();
    c.moveTo(-10, -104 + b);
    for (let k = 0; k <= 4; k++) c.lineTo(-10 + k * 2.4, -104 + b - (k % 2 ? 0 : 4));
    c.lineTo(-0.4, -104 + b);
    c.fill();
    figure(E, M, -42, -82 + b, 18, 'cheer', lk.t * 2, { paint: true, lance: true });
  }
  wheels(E, M, lk, [[-44, 21], [-14, 21], [44, 21]], { spokes: 8, chromeHub: true, deep: true });
}

/** How tall each machine stands, in units (for tags and shadows). */
export const HEIGHT: Record<Kind | 'rig', number> = { rig: 126, hotrod: 40, porcupine: 48, polecat: 64, howler: 100, crusher: 80, bike: 40, buggy: 46, ram: 60, throne: 104, drifter: 50 };

export { clamp01, posmod };
