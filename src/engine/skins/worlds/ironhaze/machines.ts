/**
 * The city's machinery, out in the open and moving, and the words on its walls (see Machine and Sign).
 *
 * Machines: beam engines rocking on the factory roofs (the beam, the cylinder and its rod, the
 * flywheel and crank); gear trains on the walls, meshed and turning; flyball governors spinning;
 * pipe runs between the buildings (flanges, elbows, a valve wheel, a gauge); pneumatic tubes slung
 * between the towers, their brass capsules shooting through; hydraulic cranes on the roofs (the ram
 * pushing the jib up, the load coming up on the hook); steam hammers thumping; great flywheels and
 * their belts; bucket elevators climbing the walls. Signs: painted walls, enamel boards, hanging
 * signs, tall signs down a tower, and neon, lit at night (flickering now and then).
 */
import { hexA, type Env } from './env';
import { gear, gearPair, piston } from './rig';
import type { Frame, Machine, Sign } from './types';

/** Where the promenade's deck is (people's feet), by its kind. */
export function frameDeck(frame: Frame, GH: number, u: number) {
  return frame === 'balcony' ? GH * 0.93 + 44 * 1.2 * u : frame === 'station' ? GH * 0.94 + 30 * 1.2 * u : frame === 'bridge' ? GH * 0.92 : GH * 0.955;
}
/** Where along each width of the promenade its pressure stations stand. */
export const STATIONS = [0.36, 0.71];
/** The top of a station's riser (where it vents), above the deck. */
export const riserOf = (u: number) => 300 * 1.2 * u;

const IRON = '#3a3430';
const DARK = '#1e1a17';
const COPPER = '#a0603a';
const BRASS = '#b8913e';
const hashOf = (a: number, b: number) => {
  const x = Math.sin(a * 91.7 + b * 47.3) * 43758.5453;
  return x - Math.floor(x);
};

export function drawMachine(E: Env, m: Machine, f: number, t: number) {
  const c = E.ctx;
  const s = m.s;
  const iron = E.tone(IRON, f, 0.15);
  const hi = E.tone('#8a8076', f, 0.45);
  const dark = E.tone(DARK, f);
  const copper = E.tone(COPPER, f, 0.3);
  const brass = E.tone(BRASS, f, 0.35);
  const sp = 0.7 + hashOf(m.seed, 1) * 0.8;
  const ph = t * sp * 2.2 + m.seed;
  const { x, y } = m;
  switch (m.kind) {
    case 'beam': {
      // A beam engine: an A-frame, the walking beam rocking on it; the cylinder at one end, the crank and flywheel at the other.
      const bl = 80 * s;
      const ah = 46 * s;
      const rock = Math.sin(ph) * 0.22;
      c.fillStyle = iron;
      c.beginPath();
      c.moveTo(x - 14 * s, y);
      c.lineTo(x - 2 * s, y - ah);
      c.lineTo(x + 2 * s, y - ah);
      c.lineTo(x + 14 * s, y);
      c.lineTo(x + 9 * s, y);
      c.lineTo(x, y - ah * 0.6);
      c.lineTo(x - 9 * s, y);
      c.fill();
      const ex = Math.cos(rock) * bl * 0.5;
      const ey = Math.sin(rock) * bl * 0.5;
      const lx = x - ex;
      const ly = y - ah - ey;
      const rx = x + ex;
      const ry = y - ah + ey;
      c.strokeStyle = dark;
      c.lineWidth = 5 * s;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(lx, ly);
      c.lineTo(rx, ry);
      c.stroke();
      c.strokeStyle = hi;
      c.lineWidth = 1.2 * s;
      c.beginPath();
      c.moveTo(lx, ly - 2 * s);
      c.lineTo(rx, ry - 2 * s);
      c.stroke();
      c.lineCap = 'butt';
      // The cylinder under the left end, its rod up to the beam.
      c.fillStyle = iron;
      c.fillRect(x - bl * 0.5 - 8 * s, y - 26 * s, 16 * s, 26 * s);
      c.fillStyle = hi;
      c.fillRect(x - bl * 0.5 - 8 * s, y - 26 * s, 3 * s, 26 * s);
      c.fillStyle = brass;
      c.fillRect(x - bl * 0.5 - 10 * s, y - 28 * s, 20 * s, 3 * s);
      c.strokeStyle = brass;
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(x - bl * 0.5, y - 28 * s);
      c.lineTo(lx, ly);
      c.stroke();
      // The crank and the flywheel on the right.
      const fx = x + bl * 0.5 + 6 * s;
      const fy = y - 20 * s;
      const fr = 18 * s;
      const ca = ph;
      c.strokeStyle = dark;
      c.lineWidth = 3 * s;
      c.beginPath();
      c.arc(fx, fy, fr, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 1.2 * s;
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = ca + (k * Math.PI) / 4;
        c.moveTo(fx, fy);
        c.lineTo(fx + Math.cos(a) * fr, fy + Math.sin(a) * fr);
      }
      c.stroke();
      const px = fx + Math.cos(ca) * fr * 0.5;
      const py = fy + Math.sin(ca) * fr * 0.5;
      c.strokeStyle = iron;
      c.lineWidth = 2.4 * s;
      c.beginPath();
      c.moveTo(rx, ry);
      c.lineTo(px, py);
      c.stroke();
      c.fillStyle = brass;
      c.beginPath();
      c.arc(fx, fy, 3 * s, 0, Math.PI * 2);
      c.arc(x, y - ah, 3 * s, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'gears': {
      // A gear train on a wall: three or four wheels, each meshed with the last.
      const n = 3 + Math.floor(hashOf(m.seed, 2) * 2);
      let gx = x;
      let gy = y;
      let r = (10 + hashOf(m.seed, 3) * 8) * s;
      let a = ph * 0.5;
      let dir = 1;
      const hub = E.tone('#2a2018', f);
      for (let k = 0; k < n; k++) {
        const teeth = Math.max(8, Math.round(r / s));
        gear(c, gx, gy, r, teeth, a * dir, k % 2 ? brass : iron, hub);
        const nr = (6 + hashOf(m.seed, k + 5) * 12) * s;
        const ang = -0.8 + hashOf(m.seed, k + 9) * 1.6;
        const d = (r + nr) * 1.08;
        const nTeeth = Math.max(8, Math.round(nr / s));
        a = (a * r) / nr + Math.PI / nTeeth;
        gx += Math.cos(ang) * d;
        gy += Math.sin(ang) * d;
        r = nr;
        dir = -dir;
      }
      break;
    }
    case 'governor': {
      // A flyball governor: a spindle, two balls flung out by the speed, turning.
      const h = 34 * s;
      const spin = ph * 2.4;
      const fling = 0.5 + 0.2 * Math.sin(t * 0.3 + m.seed);
      c.fillStyle = iron;
      c.fillRect(x - 6 * s, y - 6 * s, 12 * s, 6 * s);
      c.strokeStyle = dark;
      c.lineWidth = 2 * s;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x, y - h);
      c.stroke();
      for (const side of [0, Math.PI]) {
        const bx = x + Math.cos(spin + side) * h * 0.45 * fling;
        const by = y - h + h * 0.55 * (1 - fling * 0.4);
        c.strokeStyle = brass;
        c.lineWidth = 1.4 * s;
        c.beginPath();
        c.moveTo(x, y - h);
        c.lineTo(bx, by);
        c.lineTo(x, y - h * 0.45);
        c.stroke();
        c.fillStyle = brass;
        c.beginPath();
        c.arc(bx, by, 4.4 * s, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = hi;
      c.beginPath();
      c.arc(x, y - h, 2 * s, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'pipes': {
      // A run of pipe: along, down an elbow, along again; flanges, a valve wheel, a gauge.
      const pw = 4.5 * s;
      const midX = x + (m.x2 - x) * (0.3 + hashOf(m.seed, 4) * 0.4);
      const run: [number, number][] = [[x, y], [midX, y], [midX, m.y2], [m.x2, m.y2]];
      for (const [k, col] of [[0, copper], [1, iron]] as const) {
        const off = k * pw * 1.7;
        c.strokeStyle = col;
        c.lineWidth = k ? pw * 0.7 : pw;
        c.lineJoin = 'round';
        c.beginPath();
        run.forEach(([px, py], q) => (q ? c.lineTo(px + off, py + off) : c.moveTo(px + off, py + off)));
        c.stroke();
      }
      c.lineJoin = 'miter';
      c.fillStyle = dark;
      for (let q = 0; q < 3; q++) {
        const [ax, ay] = run[q];
        const [bx, by] = run[q + 1];
        const len = Math.hypot(bx - ax, by - ay);
        for (let d = 14 * s; d < len; d += 26 * s) {
          const fx = ax + ((bx - ax) * d) / len;
          const fy = ay + ((by - ay) * d) / len;
          if (ay === by) c.fillRect(fx - 1 * s, fy - pw * 0.8, 2 * s, pw * 1.6);
          else c.fillRect(fx - pw * 0.8, fy - 1 * s, pw * 1.6, 2 * s);
        }
      }
      const vx = (x + midX) / 2;
      c.strokeStyle = E.tone('#8a1c1c', f, 0.2);
      c.lineWidth = 1.4 * s;
      c.beginPath();
      c.arc(vx, y - 7 * s, 5 * s, 0, Math.PI * 2);
      const va = t * 0.4 + m.seed;
      for (let k = 0; k < 3; k++) {
        c.moveTo(vx, y - 7 * s);
        c.lineTo(vx + Math.cos(va + (k * Math.PI) / 3) * 5 * s, y - 7 * s + Math.sin(va + (k * Math.PI) / 3) * 5 * s);
      }
      c.stroke();
      const gx = (midX + m.x2) / 2;
      const gy = m.y2 - 9 * s;
      c.fillStyle = E.tone('#e8dcc0', f, 0.3);
      c.beginPath();
      c.arc(gx, gy, 6 * s, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = brass;
      c.lineWidth = 1.2 * s;
      c.stroke();
      const na = -Math.PI * 0.3 + Math.sin(t * 1.3 + m.seed) * 0.6 + Math.sin(t * 19 + m.seed) * 0.05;
      c.strokeStyle = dark;
      c.lineWidth = 0.8 * s;
      c.beginPath();
      c.moveTo(gx, gy);
      c.lineTo(gx + Math.cos(na) * 5 * s, gy + Math.sin(na) * 5 * s);
      c.stroke();
      break;
    }
    case 'tube': {
      // A pneumatic tube, slung between two towers: a glass bore in iron hoops, capsules shooting through.
      const dx = m.x2 - x;
      const dy = m.y2 - y;
      const len = Math.hypot(dx, dy);
      const sag = len * 0.06;
      const at = (q: number): [number, number] => [x + dx * q, y + dy * q + Math.sin(q * Math.PI) * sag];
      const tw = 7 * s;
      c.strokeStyle = hexA(E.tone('#b8c4c8', f, 0.4), 0.45);
      c.lineWidth = tw;
      c.beginPath();
      for (let q = 0; q <= 1.001; q += 0.05) {
        const [px, py] = at(q);
        if (q === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.stroke();
      c.strokeStyle = hexA(E.tone('#e8f0f0', f, 0.6), 0.5);
      c.lineWidth = Math.max(0.5, 1 * s);
      c.beginPath();
      for (let q = 0; q <= 1.001; q += 0.05) {
        const [px, py] = at(q);
        if (q === 0) c.moveTo(px, py - tw * 0.3);
        else c.lineTo(px, py - tw * 0.3);
      }
      c.stroke();
      c.fillStyle = iron;
      const hoops = Math.max(3, Math.floor(len / (22 * s)));
      for (let k = 0; k <= hoops; k++) {
        const [px, py] = at(k / hoops);
        c.fillRect(px - 1.2 * s, py - tw * 0.62, 2.4 * s, tw * 1.24);
      }
      // The capsules: quick, each its own way along, gone in a moment.
      const n = 2 + Math.floor(hashOf(m.seed, 6) * 2);
      for (let k = 0; k < n; k++) {
        const per = 2.4 + hashOf(m.seed, k + 11) * 2;
        const q0 = ((t + hashOf(m.seed, k + 13) * per) % per) / per;
        const q = k % 2 ? 1 - q0 : q0;
        if (q0 > 0.85) continue;
        const [px, py] = at(q);
        const ang = Math.atan2(dy + Math.cos(q * Math.PI) * Math.PI * sag, dx);
        c.save();
        c.translate(px, py);
        c.rotate(ang);
        c.fillStyle = brass;
        c.beginPath();
        c.roundRect(-6 * s, -tw * 0.32, 12 * s, tw * 0.64, tw * 0.3);
        c.fill();
        c.fillStyle = hexA('#000000', 0.25);
        c.fillRect(-1 * s, -tw * 0.32, 1.2 * s, tw * 0.64);
        c.restore();
        if (E.night() > 0.2) E.glow(px, py, 9 * s, '#ffd28a', 0.35 * E.night());
      }
      // The stations at either end.
      for (const [px, py] of [[x, y], [m.x2, m.y2]]) {
        c.fillStyle = iron;
        c.fillRect(px - 7 * s, py - 9 * s, 14 * s, 18 * s);
        c.fillStyle = brass;
        c.fillRect(px - 7 * s, py - 9 * s, 14 * s, 2 * s);
      }
      break;
    }
    case 'crane': {
      // A hydraulic crane: a post, a jib pushed up by its ram, a load on the hook coming up and going down.
      const cyc = (t * 0.12 * sp + hashOf(m.seed, 7)) % 1;
      const lift = cyc < 0.4 ? cyc / 0.4 : cyc < 0.55 ? 1 : cyc < 0.95 ? 1 - (cyc - 0.55) / 0.4 : 0;
      const sm = lift * lift * (3 - 2 * lift);
      const side = hashOf(m.seed, 8) < 0.5 ? 1 : -1;
      const jl = 62 * s;
      const ang = -0.25 - sm * 0.55;
      const px = x;
      const py = y - 24 * s;
      const tx = px + side * Math.cos(ang) * jl;
      const ty = py + Math.sin(ang) * jl;
      c.fillStyle = iron;
      c.fillRect(x - 6 * s, y - 26 * s, 12 * s, 26 * s);
      c.fillStyle = hi;
      c.fillRect(x - 6 * s, y - 26 * s, 2 * s, 26 * s);
      // The jib, a lattice.
      c.strokeStyle = dark;
      c.lineWidth = 2.4 * s;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(tx, ty);
      c.moveTo(px, py + 5 * s);
      c.lineTo(tx, ty + 1 * s);
      c.stroke();
      c.lineWidth = 0.8 * s;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = k / 6;
        const b = (k + 1) / 6;
        c.moveTo(px + (tx - px) * a, py + (ty - py) * a);
        c.lineTo(px + (tx - px) * b, py + 5 * s * (1 - b) + (ty + 1 * s - py - 5 * s) * b + 0);
      }
      c.stroke();
      // The ram: a cylinder from the post's foot to the jib, its polished rod sliding out.
      const rx = px + side * Math.cos(ang) * jl * 0.42;
      const ry = py + Math.sin(ang) * jl * 0.42 + 3 * s;
      const bx = x + side * 4 * s;
      const by = y - 4 * s;
      const mx = bx + (rx - bx) * 0.55;
      const my = by + (ry - by) * 0.55;
      c.strokeStyle = iron;
      c.lineWidth = 6 * s;
      c.beginPath();
      c.moveTo(bx, by);
      c.lineTo(mx, my);
      c.stroke();
      c.strokeStyle = E.tone('#d8d4cc', f, 0.5);
      c.lineWidth = 2.4 * s;
      c.beginPath();
      c.moveTo(mx, my);
      c.lineTo(rx, ry);
      c.stroke();
      // The hook and its load.
      const hang = (24 + (1 - sm) * 40) * s;
      const sw = Math.sin(t * 1.2 + m.seed) * 3 * s;
      c.strokeStyle = dark;
      c.lineWidth = 0.8 * s;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(tx + sw, ty + hang);
      c.stroke();
      c.fillStyle = E.tone(['#7a3a22', '#3a5a3a', '#8a6a2a', '#4a4a4e'][m.seed % 4], f, 0.2);
      c.fillRect(tx + sw - 9 * s, ty + hang, 18 * s, 12 * s);
      c.fillStyle = hexA('#000000', 0.25);
      for (let k = 1; k < 4; k++) c.fillRect(tx + sw - 9 * s + k * 4.5 * s, ty + hang, 0.8 * s, 12 * s);
      break;
    }
    case 'hammer': {
      // A steam hammer: an iron frame, the tup lifted on its rod and dropped, the anvil under it.
      const cyc = (t * 0.6 * sp + hashOf(m.seed, 9)) % 1;
      const up = cyc < 0.75 ? cyc / 0.75 : 1 - (cyc - 0.75) / 0.25;
      const h = 54 * s;
      c.fillStyle = iron;
      c.beginPath();
      c.moveTo(x - 20 * s, y);
      c.lineTo(x - 12 * s, y - h);
      c.lineTo(x + 12 * s, y - h);
      c.lineTo(x + 20 * s, y);
      c.lineTo(x + 13 * s, y);
      c.lineTo(x + 7 * s, y - h + 10 * s);
      c.lineTo(x - 7 * s, y - h + 10 * s);
      c.lineTo(x - 13 * s, y);
      c.fill();
      c.fillStyle = iron;
      c.fillRect(x - 9 * s, y - h - 16 * s, 18 * s, 16 * s);
      c.fillStyle = brass;
      c.fillRect(x - 10 * s, y - h - 17 * s, 20 * s, 2.4 * s);
      const tupY = y - 14 * s - up * (h - 30 * s);
      c.fillStyle = E.tone('#d8d4cc', f, 0.5);
      c.fillRect(x - 1.4 * s, y - h, 2.8 * s, tupY - (y - h));
      c.fillStyle = dark;
      c.fillRect(x - 8 * s, tupY, 16 * s, 10 * s);
      c.fillStyle = iron;
      c.fillRect(x - 11 * s, y - 4 * s, 22 * s, 4 * s);
      if (cyc > 0.74 && cyc < 0.8) E.glow(x, y - 4 * s, 22 * s, '#ffb050', 0.6);
      break;
    }
    case 'flywheel': {
      // A great flywheel, half sunk in its pit, its belt running to a smaller pulley.
      const r = 30 * s;
      const a = ph * 0.7;
      const pr = 9 * s;
      const px = m.x2;
      const py = m.y2;
      c.strokeStyle = dark;
      c.lineWidth = 1.4 * s;
      const off = Math.atan2(py - y, px - x) + Math.PI / 2;
      c.beginPath();
      c.moveTo(x + Math.cos(off) * r, y + Math.sin(off) * r);
      c.lineTo(px + Math.cos(off) * pr, py + Math.sin(off) * pr);
      c.moveTo(x - Math.cos(off) * r, y - Math.sin(off) * r);
      c.lineTo(px - Math.cos(off) * pr, py - Math.sin(off) * pr);
      c.stroke();
      c.strokeStyle = iron;
      c.lineWidth = 5 * s;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2 * s;
      c.beginPath();
      for (let k = 0; k < 6; k++) {
        const q = a + (k * Math.PI) / 3;
        c.moveTo(x + Math.cos(q) * 5 * s, y + Math.sin(q) * 5 * s);
        c.lineTo(x + Math.cos(q) * r, y + Math.sin(q) * r);
      }
      c.stroke();
      c.strokeStyle = hi;
      c.lineWidth = 1 * s;
      c.beginPath();
      c.arc(x, y, r + 1.6 * s, Math.PI * 1.1, Math.PI * 1.5);
      c.stroke();
      gear(c, px, py, pr, 10, (-a * r) / pr, brass, E.tone('#2a2018', f));
      c.fillStyle = brass;
      c.beginPath();
      c.arc(x, y, 5 * s, 0, Math.PI * 2);
      c.fill();
      break;
    }
    case 'elevator': {
      // A bucket elevator up a wall: two chains, buckets going up full and coming down empty.
      const top = m.y2;
      c.fillStyle = iron;
      c.fillRect(x - 10 * s, top - 6 * s, 20 * s, 8 * s);
      c.strokeStyle = dark;
      c.lineWidth = 1 * s;
      c.beginPath();
      c.moveTo(x - 6 * s, top);
      c.lineTo(x - 6 * s, y);
      c.moveTo(x + 6 * s, top);
      c.lineTo(x + 6 * s, y);
      c.stroke();
      gear(c, x, top, 7 * s, 9, ph * 0.8, brass, dark);
      const step = 16 * s;
      const off = (t * 22 * s * sp) % step;
      c.fillStyle = iron;
      for (let yy = top + off; yy < y; yy += step) {
        c.fillRect(x - 10 * s, yy, 5 * s, 5 * s);
        c.fillRect(x + 5 * s, top + (y - yy), 5 * s, 4 * s);
      }
      c.fillStyle = E.tone('#2a2420', f);
      for (let yy = top + off; yy < y; yy += step) c.fillRect(x + 5.5 * s, top + (y - yy) - 1 * s, 4 * s, 1.6 * s);
      break;
    }
  }
}

/**
 * The works along the promenade, by us: at each station, a riser of pipes going up to a vent and its
 * whistle, a bank of gauges, a valve wheel, a ram pumping; and along the rail, a pneumatic tube,
 * its capsules shooting past.
 */
export function drawFrameWorks(E: Env, t: number, vl: number, vr: number) {
  const w = E.world;
  const u = E.u;
  const s = 1.2 * u;
  const f = 1;
  const deck = frameDeck(w.frame, w.GH, u);
  const iron = E.tone(IRON, f, 0.2);
  const hi = E.tone('#8a8076', f, 0.5);
  const dark = E.tone(DARK, f);
  const copper = E.tone(COPPER, f, 0.35);
  const brass = E.tone(BRASS, f, 0.4);
  const c = E.ctx;
  const night = E.night();
  const GW = w.GW;
  // The tube along the rail.
  const ty = deck - 112 * s;
  const tw = 9 * s;
  c.fillStyle = hexA(E.tone('#b8c4c8', f, 0.45), 0.35);
  c.fillRect(vl - 20, ty - tw / 2, vr - vl + 40, tw);
  c.fillStyle = hexA(E.tone('#f0f4f4', f, 0.7), 0.45);
  c.fillRect(vl - 20, ty - tw * 0.32, vr - vl + 40, Math.max(1, 1.2 * s));
  c.fillStyle = iron;
  const hoop = 70 * s;
  for (let x = Math.floor(vl / hoop) * hoop; x < vr + hoop; x += hoop) {
    c.fillRect(x - 1.6 * s, ty - tw * 0.65, 3.2 * s, tw * 1.3);
    if (Math.round(x / hoop) % 4 === 0) {
      c.fillRect(x - 1 * s, ty + tw * 0.6, 2 * s, deck - ty - tw * 0.6 - 40 * s);
    }
  }
  const S = vr - vl + 400 * s;
  for (let k = 0; k < 5; k++) {
    const v = (k % 2 ? -1 : 1) * (520 + hashOf(k, 3) * 600) * u;
    const x = vl - 200 * s + (((t * v + hashOf(k, 7) * S - (vl - 200 * s)) % S) + S) % S;
    c.fillStyle = brass;
    c.beginPath();
    c.roundRect(x - 9 * s, ty - tw * 0.34, 18 * s, tw * 0.68, tw * 0.3);
    c.fill();
    c.fillStyle = hexA('#000000', 0.3);
    c.fillRect(x - 1 * s, ty - tw * 0.34, 1.6 * s, tw * 0.68);
    c.fillStyle = hexA(brass, 0.25);
    c.fillRect(x - Math.sign(v) * 40 * s, ty - tw * 0.2, Math.sign(v) * 30 * s, tw * 0.4);
    if (night > 0.2) E.glow(x, ty, 14 * s, '#ffd28a', 0.3 * night);
  }
  // The stations.
  for (let o = Math.floor(vl / GW) * GW - GW; o < vr + GW; o += GW) {
    for (const [q, at] of STATIONS.entries()) {
      const x = o + GW * at;
      if (x < vl - 120 * s || x > vr + 120 * s) continue;
      const top = deck - riserOf(u);
      // The riser: three pipes up to a header, and the vent with its whistle.
      for (const [k, col] of [[-1, iron], [0, copper], [1, iron]] as const) {
        const px = x + k * 9 * s;
        c.fillStyle = col;
        c.fillRect(px - 3.4 * s, top + k * 6 * s, 6.8 * s, deck - top - k * 6 * s);
        c.fillStyle = hexA(hi, 0.6);
        c.fillRect(px - 3.4 * s, top + k * 6 * s, 1.4 * s, deck - top - k * 6 * s);
        c.fillStyle = dark;
        for (let y = top + 30 * s; y < deck - 10 * s; y += 46 * s) c.fillRect(px - 4.6 * s, y + k * 7 * s, 9.2 * s, 2.6 * s);
      }
      c.fillStyle = iron;
      c.fillRect(x - 16 * s, top - 8 * s, 32 * s, 10 * s);
      c.fillStyle = brass;
      c.fillRect(x - 3 * s, top - 26 * s, 6 * s, 18 * s);
      c.beginPath();
      c.moveTo(x - 6 * s, top - 26 * s);
      c.lineTo(x + 6 * s, top - 26 * s);
      c.lineTo(x + 3 * s, top - 32 * s);
      c.lineTo(x - 3 * s, top - 32 * s);
      c.fill();
      // A bank of gauges on a board, their needles trembling with the pressure.
      const gy = deck - 74 * s;
      const gx = x + 30 * s;
      c.fillStyle = E.tone('#3a2c1c', f, 0.15);
      c.fillRect(gx - 4 * s, gy - 20 * s, 56 * s, 40 * s);
      c.strokeStyle = brass;
      c.lineWidth = 1.2 * s;
      c.strokeRect(gx - 4 * s, gy - 20 * s, 56 * s, 40 * s);
      c.strokeStyle = copper;
      c.lineWidth = 2.4 * s;
      c.beginPath();
      c.moveTo(x + 9 * s, gy + 10 * s);
      c.lineTo(gx - 4 * s, gy + 10 * s);
      c.stroke();
      for (let k = 0; k < 3; k++) {
        const dx = gx + 8 * s + k * 17 * s;
        const dy = gy + (k === 1 ? -6 : 4) * s;
        const r = (k === 1 ? 9 : 7) * s;
        c.fillStyle = E.tone('#ece2c8', f, 0.4);
        c.beginPath();
        c.arc(dx, dy, r, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = brass;
        c.lineWidth = 1.4 * s;
        c.stroke();
        c.strokeStyle = hexA(dark, 0.6);
        c.lineWidth = 0.6 * s;
        c.beginPath();
        for (let m = 0; m < 7; m++) {
          const a = Math.PI * 0.75 + (m / 6) * Math.PI * 1.5;
          c.moveTo(dx + Math.cos(a) * r * 0.7, dy + Math.sin(a) * r * 0.7);
          c.lineTo(dx + Math.cos(a) * r * 0.9, dy + Math.sin(a) * r * 0.9);
        }
        c.stroke();
        const na = Math.PI * 0.75 + Math.PI * 1.5 * (0.45 + 0.3 * Math.sin(t * (0.4 + k * 0.3) + q + k) + 0.03 * Math.sin(t * 23 + k));
        c.strokeStyle = E.tone('#8a1c1c', f, 0.1);
        c.lineWidth = 1 * s;
        c.beginPath();
        c.moveTo(dx, dy);
        c.lineTo(dx + Math.cos(na) * r * 0.8, dy + Math.sin(na) * r * 0.8);
        c.stroke();
        if (night > 0.2) E.glow(dx, dy, r * 2, '#ffd8a0', 0.25 * night);
      }
      // The valve wheel, turned now and then.
      const vy = deck - 120 * s;
      const va = Math.sin(t * 0.3 + q * 2) * 2.4;
      c.strokeStyle = E.tone('#8a1c1c', f, 0.25);
      c.lineWidth = 2.2 * s;
      c.beginPath();
      c.arc(x - 26 * s, vy, 11 * s, 0, Math.PI * 2);
      for (let k = 0; k < 3; k++) {
        const a = va + (k * Math.PI) / 3;
        c.moveTo(x - 26 * s - Math.cos(a) * 11 * s, vy - Math.sin(a) * 11 * s);
        c.lineTo(x - 26 * s + Math.cos(a) * 11 * s, vy + Math.sin(a) * 11 * s);
      }
      c.stroke();
      c.fillStyle = iron;
      c.fillRect(x - 26 * s, vy - 2 * s, 17 * s, 4 * s);
      // A ram, pumping; and the gears that drive it.
      piston(c, x - 52 * s, deck - 96 * s, 60 * s, 13 * s, t * 2.6 + q, iron, E.tone('#d8d4cc', f, 0.5), hi);
      gearPair(c, x - 52 * s, deck - 18 * s, 14 * s, 9 * s, -0.5, t * 1.3 + q, iron, dark);
    }
  }
}

/** A sign: the words on the walls. Neon (and lit boards) glow at night. */
export function drawSign(E: Env, g: Sign, f: number, t: number) {
  const c = E.ctx;
  const night = E.night();
  const hz = E.hazeOf(f);
  const { x, y, w, h } = g;
  const pal = [
    ['#7f1d1d', '#e8dcc0'], ['#1e3a5f', '#e8dcc0'], ['#14532d', '#e8d8a0'], ['#2a2420', '#d8b060'], ['#e8dcc0', '#2a1a12'], ['#5a1a3a', '#f0d0a0'],
  ][g.seed % 6];
  const neonCol = ['#ff4a6a', '#5ad8ff', '#ffb040', '#a8ff6a', '#ff6ad8'][g.seed % 5];
  const lit = g.kind === 'neon' ? 1 : g.kind === 'board' || g.kind === 'hanging' ? 0.5 : 0;
  const flick = g.kind === 'neon' && hashOf(g.seed, Math.floor(t * 6)) < 0.04 ? 0.15 : 1;
  c.save();
  if (g.kind === 'tall') {
    // Down a tower, letter under letter.
    c.fillStyle = E.tone(pal[0], f, 0.2);
    c.fillRect(x - w / 2, y, w, h);
    c.strokeStyle = E.tone(pal[1], f, 0.3);
    c.lineWidth = Math.max(0.4, w * 0.05);
    c.strokeRect(x - w / 2 + w * 0.08, y + w * 0.08, w * 0.84, h - w * 0.16);
    const n = g.text.length;
    const px = Math.min(w * 0.72, (h * 0.9) / n);
    c.font = `bold ${px.toFixed(2)}px "Iowan Old Style", Georgia, serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const ink = night > 0.2 ? hexA(neonCol, 0.4 + 0.6 * night) : E.tone(pal[1], f, 0.3);
    c.fillStyle = ink;
    for (let k = 0; k < n; k++) c.fillText(g.text[k], x, y + (h * (k + 0.5)) / n);
    if (night > 0.15) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = night * 0.7 * flick * (1 - hz * 0.5);
      c.fillStyle = neonCol;
      for (let k = 0; k < n; k++) c.fillText(g.text[k], x, y + (h * (k + 0.5)) / n);
      c.globalAlpha = 1;
      E.glow(x, y + h / 2, h * 0.5, neonCol, 0.18 * night * flick * (1 - hz * 0.5));
    }
    c.restore();
    return;
  }
  if (g.kind === 'hanging') {
    c.strokeStyle = E.tone('#2a2420', f);
    c.lineWidth = Math.max(0.4, h * 0.05);
    c.beginPath();
    c.moveTo(x - w / 2 - h * 0.3, y - h * 0.2);
    c.lineTo(x + w / 2, y - h * 0.2);
    c.moveTo(x - w * 0.3, y - h * 0.2);
    c.lineTo(x - w * 0.3, y);
    c.moveTo(x + w * 0.3, y - h * 0.2);
    c.lineTo(x + w * 0.3, y);
    c.stroke();
  }
  if (g.kind !== 'neon') {
    c.fillStyle = g.kind === 'painted' ? hexA(E.tone(pal[0], f, 0.15), 0.7) : E.tone(pal[0], f, 0.2);
    c.fillRect(x - w / 2, y, w, h);
    if (g.kind !== 'painted') {
      c.strokeStyle = E.tone(pal[1], f, 0.3);
      c.lineWidth = Math.max(0.4, h * 0.06);
      c.strokeRect(x - w / 2 + h * 0.1, y + h * 0.1, w - h * 0.2, h * 0.8);
    }
  } else {
    // A neon sign by day is bent glass on an iron frame.
    c.strokeStyle = E.tone('#2a2420', f);
    c.lineWidth = Math.max(0.4, h * 0.05);
    c.strokeRect(x - w / 2, y, w, h);
  }
  const px = Math.min(h * 0.62, (w * 1.75) / Math.max(4, g.text.length));
  c.font = `${g.kind === 'painted' ? '' : 'bold '}${px.toFixed(2)}px "Iowan Old Style", Georgia, serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = g.kind === 'neon' ? E.tone(neonCol, f, 0.1) : E.tone(pal[1], f, 0.35);
  if (g.kind === 'neon') c.globalAlpha = 0.6;
  c.fillText(g.text, x, y + h / 2 + px * 0.05);
  c.globalAlpha = 1;
  if (lit > 0 && night > 0.12) {
    c.globalCompositeOperation = 'lighter';
    const a = night * lit * flick * (1 - hz * 0.55);
    c.globalAlpha = Math.min(1, a);
    c.fillStyle = g.kind === 'neon' ? neonCol : '#ffd8a0';
    c.fillText(g.text, x, y + h / 2 + px * 0.05);
    c.globalAlpha = 1;
    E.glow(x, y + h / 2, w * 0.55, g.kind === 'neon' ? neonCol : '#ffc070', (g.kind === 'neon' ? 0.22 : 0.1) * a);
  }
  c.restore();
}
