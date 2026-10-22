/**
 * The dock, painted: a concrete cathedral on the shore, cut open like a section drawing.
 *
 * Baked once, in two layers. Behind: the hangar's back wall in its work lights (concrete panels,
 * pilasters between the bays, steel trusses under the roof, cones of light from the lamps), the
 * floor with its markings, the yellow gantry towers and their platforms; and the outside of it,
 * the roof deck with its helipads and the control tower, the end facade with the great door's
 * frame, the launch apron, the sea wall down into the water. In front: the cut itself, the
 * roof slab, the floor slab and the walls, dark concrete with a lit edge. The outside surfaces
 * are darkened by the hour with a tinted copy of their mask; the inside keeps its own light.
 *
 * Live over that: the breach clock on the back wall, the mechs' names stencilled over their bays
 * (with their kill marks), the cranes on the ceiling rail, the gantry lifts, umbilicals and clamps,
 * the crews and their sparks, the tugs, the door's leaves and the light out of it, the alarm.
 */
import { hash } from '../../instruments/kit';
import { drawPerson, drawVehicle } from './craft';
import { clamp01, hexA, mix, mk, MOODS, type Env } from './look';
import type { DockWorld, Mech } from './types';

export function createDock(E: Env, w: DockWorld) {
  const { u, x0, doorX, wallT, floorY, ceilY, roofY, apronX, dx, dy, standY, GH } = w;
  const c = E.ctx;
  const M = MOODS[w.mood];
  const work = M.work;
  const inX1 = doorX - wallT / 2;
  const fx0 = doorX + wallT / 2;
  const slab = 26 * u;
  const BX = -30;
  const BY = Math.round(roofY - dy - 120 * u);
  const BW = Math.ceil(apronX + dx + 60 * u - BX);
  const BH = Math.ceil(GH + 20 - BY);
  let back: HTMLCanvasElement | null = null;
  let front: HTMLCanvasElement | null = null;
  let skin: HTMLCanvasElement | null = null;
  const doorL = fx0 + dx * 0.16;
  const doorR = fx0 + dx * 0.84;
  const skew = (x: number) => -((x - fx0) / dx) * dy;
  const plateCol = '#5e605c';

  const quad = (g: CanvasRenderingContext2D, pts: number[]) => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  };
  /** Text in the bake that stays readable when the painter mirrors the world. */
  const sign = (g: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, color: string, font = 'bold') => {
    g.save();
    g.translate(x, y);
    if (w.flip) g.scale(-1, 1);
    g.font = `${font} ${Math.round(px)}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, 0, 0);
    g.restore();
  };
  const concrete = (g: CanvasRenderingContext2D, x: number, y: number, ww: number, hh: number, base: string, seed: number, joints = true) => {
    g.fillStyle = base;
    g.fillRect(x, y, ww, hh);
    // Stains and streaks of wet down the concrete.
    for (let k = 0; k < Math.floor((ww * hh) / (2400 * u * u)); k++) {
      const sx = x + hash(seed, k) * ww;
      const sy = y + hash(seed, k, 1) * hh;
      const sl = (20 + hash(seed, k, 2) * 80) * u;
      g.fillStyle = hexA(hash(seed, k, 3) < 0.7 ? '#000000' : '#ffffff', 0.03 + hash(seed, k, 4) * 0.05);
      g.fillRect(sx, sy, (2 + hash(seed, k, 5) * 6) * u, sl);
    }
    if (!joints) return;
    g.strokeStyle = hexA('#000000', 0.22);
    g.lineWidth = Math.max(0.6, 1 * u);
    g.beginPath();
    for (let yy = y + 30 * u; yy < y + hh; yy += 30 * u) {
      g.moveTo(x, yy);
      g.lineTo(x + ww, yy);
    }
    for (let xx = x + 46 * u; xx < x + ww; xx += 46 * u) {
      g.moveTo(xx, y);
      g.lineTo(xx, y + hh);
    }
    g.stroke();
  };

  function bake() {
    back = mk(BW, BH);
    front = mk(BW, BH);
    skin = mk(BW, BH);
    const b = back.getContext('2d')!;
    const f = front.getContext('2d')!;
    const sk = skin.getContext('2d')!;
    for (const g of [b, f, sk]) g.setTransform(1, 0, 0, 1, -BX, -BY);

    // ---- outside: the sea wall, the apron, the facade, the roof deck ----
    const wallFace = () => {
      concrete(b, BX, floorY + slab, fx0 + dx - BX, GH - floorY, '#55585a', 11);
      // The tide line and the weed under it; rust from the bollards.
      const tg = b.createLinearGradient(0, w.NY - 30 * u, 0, w.NY + 10 * u);
      tg.addColorStop(0, hexA('#1a2420', 0));
      tg.addColorStop(1, hexA('#1a2420', 0.85));
      b.fillStyle = tg;
      b.fillRect(BX, w.NY - 30 * u, apronX + dx - BX, 40 * u);
      for (let k = 0; k < 14; k++) {
        const rx = BX + hash(k, 41) * (apronX - BX);
        b.fillStyle = hexA('#6a3a1a', 0.25);
        b.fillRect(rx, floorY + slab, 3 * u, (20 + hash(k, 42) * 40) * u);
      }
    };
    wallFace();
    sk.fillStyle = '#000';
    sk.fillRect(BX, floorY + slab, apronX + dx - BX, GH - floorY);
    // The apron: its face, its side, its top with the launch markings.
    concrete(b, fx0, floorY, apronX - fx0, GH - floorY, '#5a5c5a', 12);
    quad(b, [apronX, floorY, apronX + dx, floorY - dy, apronX + dx, GH, apronX, GH]);
    b.fillStyle = '#3e403e';
    b.fill();
    quad(b, [fx0, floorY, apronX, floorY, apronX + dx, floorY - dy, fx0 + dx, floorY - dy]);
    b.fillStyle = '#6a6c68';
    b.fill();
    b.save();
    b.clip();
    b.strokeStyle = hexA('#e8b020', 0.85);
    b.lineWidth = 3 * u;
    b.beginPath();
    b.ellipse((fx0 + apronX + dx) / 2, floorY - dy / 2, (apronX - fx0) * 0.32, dy * 0.32, 0, 0, Math.PI * 2);
    b.stroke();
    for (let k = 0; k < 14; k++) {
      const hx = fx0 + (k / 14) * (apronX - fx0);
      quad(b, [hx, floorY, hx + 8 * u, floorY, hx + 8 * u + dx * 0.12, floorY - dy * 0.12, hx + dx * 0.12, floorY - dy * 0.12]);
      b.fillStyle = k % 2 ? '#1a1a1a' : '#e0a820';
      b.fill();
    }
    b.restore();
    quad(sk, [fx0, floorY, apronX, floorY, apronX + dx, floorY - dy, apronX + dx, GH, fx0, GH]);
    sk.fill();
    // The end facade: ribs, bands, the door's frame of hazard stripes, the opening cut through.
    quad(b, [fx0, roofY, fx0 + dx, roofY - dy, fx0 + dx, floorY + slab - dy, fx0, floorY + slab]);
    const fg = b.createLinearGradient(fx0, 0, fx0 + dx, 0);
    fg.addColorStop(0, '#6a6c6a');
    fg.addColorStop(1, '#4e504e');
    b.fillStyle = fg;
    b.fill();
    b.save();
    b.clip();
    b.strokeStyle = hexA('#000000', 0.3);
    b.lineWidth = 1.2 * u;
    for (let k = 1; k < 6; k++) {
      const xx = fx0 + (dx * k) / 6;
      b.beginPath();
      b.moveTo(xx, roofY + skew(xx));
      b.lineTo(xx, floorY + slab + skew(xx));
      b.stroke();
    }
    for (let yy = roofY + 40 * u; yy < floorY; yy += 52 * u) {
      b.beginPath();
      b.moveTo(fx0, yy);
      b.lineTo(fx0 + dx, yy - dy);
      b.stroke();
    }
    // Hazard frame round the door.
    const dTop = w.doorTop - 14 * u;
    for (let k = 0; k < 40; k++) {
      const yy = dTop + (k / 40) * (floorY - dTop);
      for (const ex of [doorL - 7 * u, doorR + 1 * u]) {
        quad(b, [ex, yy + skew(ex), ex + 6 * u, yy + skew(ex + 6 * u), ex + 6 * u, yy + 10 * u + skew(ex + 6 * u), ex, yy + 10 * u + skew(ex)]);
        b.fillStyle = k % 2 ? '#1c1c1c' : '#e0a820';
        b.fill();
      }
    }
    quad(b, [doorL - 7 * u, dTop + skew(doorL - 7 * u), doorR + 7 * u, dTop + skew(doorR + 7 * u), doorR + 7 * u, dTop + 12 * u + skew(doorR + 7 * u), doorL - 7 * u, dTop + 12 * u + skew(doorL - 7 * u)]);
    b.fillStyle = '#2a2c2c';
    b.fill();
    b.restore();
    quad(sk, [fx0, roofY, fx0 + dx, roofY - dy, fx0 + dx, floorY + slab - dy, fx0, floorY + slab]);
    sk.fill();
    // The opening: cut out of both (the live door and the light through it go there).
    for (const g of [b, sk]) {
      g.save();
      g.globalCompositeOperation = 'destination-out';
      quad(g, [doorL, w.doorTop + skew(doorL), doorR, w.doorTop + skew(doorR), doorR, floorY + skew(doorR), doorL, floorY + skew(doorL)]);
      g.fill();
      g.restore();
    }
    // The roof deck: helipads, the parapet, vents, the control tower and its mast.
    quad(b, [BX, roofY, fx0, roofY, fx0 + dx, roofY - dy, BX + dx, roofY - dy]);
    b.fillStyle = '#5c5e5c';
    b.fill();
    b.save();
    b.clip();
    for (const px of w.pads) {
      const py = w.deckY;
      b.strokeStyle = hexA('#f0f0e8', 0.75);
      b.lineWidth = 2 * u;
      b.beginPath();
      b.ellipse(px, py, 46 * u, dy * 0.36, 0, 0, Math.PI * 2);
      b.stroke();
      b.strokeStyle = hexA('#e8b020', 0.8);
      b.beginPath();
      b.ellipse(px, py, 36 * u, dy * 0.28, 0, 0, Math.PI * 2);
      b.stroke();
      b.fillStyle = hexA('#f0f0e8', 0.75);
      b.fillRect(px - 9 * u, py - 1.2 * u, 18 * u, 2.4 * u);
      b.fillRect(px - 9 * u, py - dy * 0.12, 2.4 * u, dy * 0.24);
      b.fillRect(px + 6.6 * u, py - dy * 0.12, 2.4 * u, dy * 0.24);
    }
    b.restore();
    // Parapet along the front edge.
    b.fillStyle = '#4a4c4a';
    b.fillRect(BX, roofY - 7 * u, fx0 - BX, 7 * u);
    // The control tower at the landward end: a block with a band of windows (lit live).
    const tx = x0 + 30 * u;
    const tw = 120 * u;
    const th = 70 * u;
    quad(b, [tx, roofY - 4 * u, tx + tw, roofY - 4 * u, tx + tw, roofY - th, tx, roofY - th]);
    b.fillStyle = '#4e504e';
    b.fill();
    quad(b, [tx + tw, roofY - 4 * u, tx + tw + dx * 0.4, roofY - 4 * u - dy * 0.4, tx + tw + dx * 0.4, roofY - th - dy * 0.4, tx + tw, roofY - th]);
    b.fillStyle = '#3a3c3a';
    b.fill();
    quad(b, [tx, roofY - th, tx + tw, roofY - th, tx + tw + dx * 0.4, roofY - th - dy * 0.4, tx + dx * 0.4, roofY - th - dy * 0.4]);
    b.fillStyle = '#6a6c6a';
    b.fill();
    b.fillStyle = '#1a1e22';
    b.fillRect(tx + 6 * u, roofY - th + 14 * u, tw - 12 * u, 16 * u);
    // Radar on its mast, the antenna, the lightning rod by the door end.
    b.strokeStyle = '#3a3c3e';
    b.lineWidth = 2.5 * u;
    b.beginPath();
    b.moveTo(tx + tw * 0.7, roofY - th - dy * 0.2);
    b.lineTo(tx + tw * 0.7, roofY - th - 40 * u);
    b.moveTo(doorX - 60 * u, roofY - dy * 0.3);
    b.lineTo(doorX - 60 * u, roofY - 90 * u);
    b.stroke();
    quad(sk, [BX, roofY, fx0, roofY, fx0 + dx, roofY - dy, BX + dx, roofY - dy]);
    sk.fill();
    sk.fillRect(tx, roofY - th - dy * 0.4, tw + dx * 0.4, th + dy * 0.4);

    // ---- inside: the back wall in its work lights ----
    b.save();
    b.beginPath();
    b.rect(x0, ceilY, inX1 - x0, floorY - ceilY);
    b.clip();
    const wg = b.createLinearGradient(0, ceilY, 0, floorY);
    wg.addColorStop(0, '#16161a');
    wg.addColorStop(0.35, mix('#3c3a36', work, 0.12));
    wg.addColorStop(1, mix('#4a463e', work, 0.2));
    b.fillStyle = wg;
    b.fillRect(x0, ceilY, inX1 - x0, floorY - ceilY);
    // Panels on the back wall.
    b.strokeStyle = hexA('#000000', 0.28);
    b.lineWidth = 1 * u;
    for (let yy = ceilY + 60 * u; yy < floorY; yy += 54 * u) {
      b.beginPath();
      b.moveTo(x0, yy);
      b.lineTo(inX1, yy);
      b.stroke();
    }
    for (let xx = x0 + 30 * u; xx < inX1; xx += 30 * u) {
      b.beginPath();
      b.moveTo(xx, ceilY + 60 * u);
      b.lineTo(xx, floorY);
      b.stroke();
    }
    // Stains on the wall, light and dark.
    for (let k = 0; k < 60; k++) {
      b.fillStyle = hexA(k % 3 ? '#000000' : work, 0.04);
      b.fillRect(x0 + hash(k, 51) * (inX1 - x0), ceilY + 60 * u + hash(k, 52) * (floorY - ceilY), (6 + hash(k, 53) * 20) * u, (30 + hash(k, 54) * 120) * u);
    }
    // Steel trusses under the roof: a deep girder of diagonals.
    const tY0 = ceilY + 6 * u;
    const tY1 = ceilY + 52 * u;
    b.strokeStyle = '#2c2a28';
    b.lineWidth = 3 * u;
    b.beginPath();
    b.moveTo(x0, tY0);
    b.lineTo(inX1, tY0);
    b.moveTo(x0, tY1);
    b.lineTo(inX1, tY1);
    for (let xx = x0; xx < inX1; xx += 46 * u) {
      b.moveTo(xx, tY0);
      b.lineTo(xx + 23 * u, tY1);
      b.lineTo(xx + 46 * u, tY0);
    }
    b.stroke();
    // The crane rail under the truss.
    b.fillStyle = '#3a3634';
    b.fillRect(x0, tY1 + 4 * u, inX1 - x0, 7 * u);
    b.fillStyle = hexA(work, 0.35);
    b.fillRect(x0, tY1 + 4 * u, inX1 - x0, 1.5 * u);
    // Pilasters between the bays.
    const edges = [x0 + 20 * u, ...w.bays.map((q) => q.x + q.w / 2)];
    for (const ex of edges) {
      const pg = b.createLinearGradient(ex - 14 * u, 0, ex + 14 * u, 0);
      pg.addColorStop(0, '#2c2a28');
      pg.addColorStop(0.4, mix('#5a5650', work, 0.25));
      pg.addColorStop(1, '#262422');
      b.fillStyle = pg;
      b.fillRect(ex - 14 * u, tY1, 28 * u, floorY - tY1);
    }
    // Cones of light from the lamps in the roof, down the wall.
    for (let k = 0; k < Math.floor((inX1 - x0) / (90 * u)); k++) {
      const lx = x0 + 45 * u + k * 90 * u;
      const cg = b.createLinearGradient(0, tY1, 0, floorY);
      cg.addColorStop(0, hexA(work, 0.22));
      cg.addColorStop(1, hexA(work, 0.02));
      b.fillStyle = cg;
      b.beginPath();
      b.moveTo(lx - 6 * u, tY1 + 12 * u);
      b.lineTo(lx + 6 * u, tY1 + 12 * u);
      b.lineTo(lx + 70 * u, floorY);
      b.lineTo(lx - 70 * u, floorY);
      b.fill();
      b.fillStyle = '#1a1a1a';
      b.fillRect(lx - 9 * u, tY1 + 8 * u, 18 * u, 5 * u);
    }
    // The left end wall's inner face: a darker strip, going back.
    quad(b, [x0, ceilY, x0 + dx, ceilY - dy, x0 + dx, floorY - dy, x0, floorY]);
    b.fillStyle = hexA('#141416', 0.6);
    b.fill();
    // The floor: concrete going back to the wall, its lines, the rails, the oil, the shine of wet.
    quad(b, [x0, floorY, inX1, floorY, inX1 + dx, floorY - dy, x0 + dx, floorY - dy]);
    const flg = b.createLinearGradient(0, floorY - dy, 0, floorY);
    flg.addColorStop(0, mix('#3a3834', work, 0.15));
    flg.addColorStop(1, mix('#5a564e', work, 0.2));
    b.fillStyle = flg;
    b.fill();
    b.save();
    b.clip();
    b.strokeStyle = hexA('#e0b020', 0.7);
    b.lineWidth = 2 * u;
    b.beginPath();
    for (const k of [0.25, 0.78]) {
      b.moveTo(x0, floorY - dy * k);
      b.lineTo(inX1 + dx, floorY - dy * k);
    }
    b.stroke();
    b.strokeStyle = hexA('#9a9a96', 0.5);
    b.lineWidth = 1.4 * u;
    b.beginPath();
    for (const k of [0.45, 0.55]) {
      b.moveTo(x0, floorY - dy * k);
      b.lineTo(inX1 + dx, floorY - dy * k);
    }
    b.stroke();
    for (const q of w.bays) {
      for (let k = 0; k < 10; k++) {
        const hx = q.x - q.w * 0.4 + (k / 10) * q.w * 0.8;
        quad(b, [hx, floorY - dy * 0.12, hx + 7 * u, floorY - dy * 0.12, hx + 7 * u + dx * 0.08, floorY - dy * 0.2, hx + dx * 0.08, floorY - dy * 0.2]);
        b.fillStyle = k % 2 ? '#1a1a1a' : '#d8a020';
        b.fill();
      }
      b.fillStyle = hexA('#000000', 0.25);
      b.beginPath();
      b.ellipse(q.x + dx * 0.1, standY + 2 * u, q.w * 0.3, dy * 0.18, 0, 0, Math.PI * 2);
      b.fill();
    }
    b.restore();
    // Gantry towers between the bays, and their platforms reaching toward the mech.
    const levels = [0.3, 0.56, 0.8];
    const yel = '#c8901c';
    for (let i = 0; i <= w.bays.length; i++) {
      const tx2 = i < w.bays.length ? w.bays[i].x - w.bays[i].w * 0.47 : w.bays[i - 1].x + w.bays[i - 1].w * 0.47;
      const top = ceilY + 64 * u;
      const tw2 = 12 * u;
      b.strokeStyle = yel;
      b.lineWidth = 2.4 * u;
      b.beginPath();
      b.moveTo(tx2 - tw2 / 2, standY);
      b.lineTo(tx2 - tw2 / 2, top);
      b.moveTo(tx2 + tw2 / 2, standY);
      b.lineTo(tx2 + tw2 / 2, top);
      for (let yy = standY; yy > top; yy -= 14 * u) {
        b.moveTo(tx2 - tw2 / 2, yy);
        b.lineTo(tx2 + tw2 / 2, yy - 14 * u);
        b.moveTo(tx2 - tw2 / 2, yy - 14 * u);
        b.lineTo(tx2 + tw2 / 2, yy);
      }
      b.stroke();
      b.strokeStyle = hexA('#fff0c0', 0.25);
      b.lineWidth = 1 * u;
      b.beginPath();
      b.moveTo(tx2 - tw2 / 2 - 1 * u, standY);
      b.lineTo(tx2 - tw2 / 2 - 1 * u, top);
      b.stroke();
    }
    for (const q of w.bays) {
      const mw = w.mechs[0] ? w.mechs[0].H * 0.22 : q.w * 0.3;
      for (const k of levels) {
        const ly = standY - (w.mechs[0]?.H ?? 300 * u) * k;
        for (const side of [-1, 1]) {
          const a = q.x + side * q.w * 0.47;
          const z = q.x + side * (mw + 4 * u);
          const lo = Math.min(a, z);
          const hi = Math.max(a, z);
          b.fillStyle = '#3a3630';
          b.fillRect(lo, ly, hi - lo, 4 * u);
          b.fillStyle = hexA(yel, 0.9);
          b.fillRect(lo, ly - 12 * u, hi - lo, 1.6 * u);
          b.fillRect(lo, ly - 6 * u, hi - lo, 1 * u);
          for (let px = lo; px <= hi; px += 12 * u) b.fillRect(px, ly - 12 * u, 1.4 * u, 12 * u);
        }
      }
    }
    b.restore();

    // ---- in front: the cut ----
    const cut = (g: CanvasRenderingContext2D, x: number, y: number, ww: number, hh: number) => {
      const cg = g.createLinearGradient(0, y, 0, y + hh);
      cg.addColorStop(0, '#3a3c3c');
      cg.addColorStop(1, '#2a2c2c');
      g.fillStyle = cg;
      g.fillRect(x, y, ww, hh);
      g.fillStyle = hexA('#d8d8d0', 0.25);
      g.fillRect(x, y, ww, Math.max(1, 1.5 * u));
      g.fillStyle = hexA('#000000', 0.4);
      g.fillRect(x, y + hh - Math.max(1, 1.5 * u), ww, Math.max(1, 1.5 * u));
    };
    cut(f, BX, roofY, fx0 - BX, ceilY - roofY);
    cut(f, BX, floorY, fx0 - BX, slab);
    cut(f, BX, roofY, x0 - BX, floorY - roofY);
    cut(f, inX1, roofY, wallT, floorY + slab - roofY);
    // Stencils on the cut: the dock's name along the roof slab.
    sign(f, `TITAN DOCK  ·  ${w.name}`, (x0 + inX1) / 2, (roofY + ceilY) / 2 + 1 * u, Math.min(28 * u, (ceilY - roofY) * 0.7), hexA('#c8c4b8', 0.55));
  }

  // ---- the hour on the outside ----------------------------------------------------------------------
  let tintC: HTMLCanvasElement | null = null;
  let tintKey = '';
  const tinted = (src: HTMLCanvasElement, color: string, key: string) => {
    if (tintC && tintKey === key + color) return tintC;
    tintC ??= mk(BW, BH);
    const g = tintC.getContext('2d')!;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, BW, BH);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, BW, BH);
    tintKey = key + color;
    return tintC;
  };
  const shadeOf = () => clamp01(0.25 + E.L.night * 0.55 + E.storm * 0.15 - E.flash * 0.6);
  const shadeCol = () => mix(E.L.ink, E.L.haze, 0.25);

  /** The back layer: the hangar's inside and the outside faces, darkened by the hour. */
  function drawBack(t: number) {
    if (!back) bake();
    c.drawImage(back!, BX, BY, BW, BH);
    c.save();
    c.globalAlpha = shadeOf();
    c.drawImage(tinted(skin!, shadeCol(), 'skin'), BX, BY, BW, BH);
    c.restore();
    // The door's opening: the hangar's light behind, the two leaves sliding apart.
    const open = w.door;
    const top = w.doorTop;
    const mid = top + (floorY - top) * 0.5;
    const opening = () => quad(c, [doorL, top + skew(doorL), doorR, top + skew(doorR), doorR, floorY + skew(doorR), doorL, floorY + skew(doorL)]);
    c.save();
    opening();
    c.clip();
    const ig = c.createLinearGradient(0, top, 0, floorY);
    ig.addColorStop(0, mix('#2a2826', work, 0.2));
    ig.addColorStop(1, mix('#6a6050', work, 0.5));
    c.fillStyle = ig;
    c.fillRect(doorL, top - dy, doorR - doorL, floorY - top + dy);
    const gap = open * (floorY - top) * 0.5;
    for (const [y0, y1, dir] of [[top - gap, mid - gap, -1], [mid + gap, floorY + gap, 1]] as const) {
      quad(c, [doorL, y0 + skew(doorL), doorR, y0 + skew(doorR), doorR, y1 + skew(doorR), doorL, y1 + skew(doorL)]);
      c.fillStyle = mix('#4a4c4a', E.L.ink, shadeOf() * 0.6);
      c.fill();
      c.strokeStyle = hexA('#000000', 0.4);
      c.lineWidth = 1.2 * u;
      for (let yy = y0 + 18 * u; yy < y1; yy += 18 * u) {
        c.beginPath();
        c.moveTo(doorL, yy + skew(doorL));
        c.lineTo(doorR, yy + skew(doorR));
        c.stroke();
      }
      // Chevrons on the meeting edges.
      const ey = dir < 0 ? y1 - 10 * u : y0;
      for (let k = 0; k < 6; k++) {
        const xx = doorL + ((doorR - doorL) * k) / 6;
        quad(c, [xx, ey + skew(xx), xx + (doorR - doorL) / 12, ey + skew(xx + (doorR - doorL) / 12), xx + (doorR - doorL) / 12, ey + 10 * u + skew(xx + (doorR - doorL) / 12), xx, ey + 10 * u + skew(xx)]);
        c.fillStyle = mix('#e0a820', E.L.ink, shadeOf() * 0.5);
        c.fill();
      }
    }
    c.restore();
    // Light out of the open door onto the apron and the rain.
    if (open > 0.05) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      const lg = c.createLinearGradient(doorR, 0, apronX + dx, 0);
      lg.addColorStop(0, hexA(work, 0.28 * open));
      lg.addColorStop(1, hexA(work, 0));
      c.fillStyle = lg;
      quad(c, [doorL, floorY + skew(doorL) - (floorY - top) * open, doorR, floorY + skew(doorR) - (floorY - top) * open, apronX + dx, floorY - dy, apronX, floorY + 4 * u]);
      c.fill();
      c.restore();
    }
    // The control tower's windows, the lit deck, the beacons.
    c.save();
    c.globalCompositeOperation = 'lighter';
    const tx = x0 + 30 * u;
    for (let k = 0; k < 8; k++) {
      const on = hash(k, Math.floor(t / 7), 3) < 0.75;
      if (on) {
        c.fillStyle = hexA(k % 3 ? '#9ad8ff' : work, 0.55);
        c.fillRect(tx + 8 * u + k * 13 * u, roofY - 70 * u + 16 * u, 10 * u, 12 * u);
      }
    }
    const beacon = Math.sin(t * 2.2) > 0.5 ? 1 : 0.15;
    E.glow(doorX - 60 * u, roofY - 92 * u, 12 * u, '#ff3020', beacon);
    E.glow(tx + 120 * u * 0.7, roofY - 70 * u - 42 * u, 9 * u, '#ff3020', 1.15 - beacon);
    for (const px of w.pads)
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        E.glow(px + Math.cos(a) * 46 * u, w.deckY + Math.sin(a) * dy * 0.36, 4 * u, k % 2 ? '#40ff70' : '#ffffff', 0.5 + 0.3 * Math.sin(t * 3 + k));
      }
    for (let k = 0; k < 8; k++) E.glow(fx0 + ((apronX - fx0) * (k + 0.5)) / 8, floorY - 2 * u, 5 * u, '#ffb040', 0.55 + 0.45 * (Math.sin(t * 4 - k * 0.6) > 0.6 ? 1 : 0));
    c.restore();
    drawInside(t);
  }

  /** The breach clock: a board on the back wall, its digits as segments. */
  function clockBoard(t: number) {
    void t;
    // It hangs on two chains from the truss over the launch lane, by the door.
    const bw = Math.min(140 * u, (w.laneX - x0) * 0.6);
    const bh = bw * 0.3;
    const bx = Math.min(inX1 - bw - 6 * u, w.laneX + (inX1 - w.laneX) / 2 - bw / 2);
    // Below the stencilled names, over the lane where no mech stands.
    const by = Math.max(ceilY + 80 * u, ceilY + (floorY - ceilY) * 0.2 + 18 * u);
    c.strokeStyle = '#1a1a1a';
    c.lineWidth = 1.5 * u;
    c.beginPath();
    c.moveTo(bx + bw * 0.15, ceilY + 52 * u);
    c.lineTo(bx + bw * 0.15, by);
    c.moveTo(bx + bw * 0.85, ceilY + 52 * u);
    c.lineTo(bx + bw * 0.85, by);
    c.stroke();
    c.fillStyle = '#0c0c0e';
    c.fillRect(bx - 4 * u, by - 4 * u, bw + 8 * u, bh + 8 * u);
    c.fillStyle = '#16181a';
    c.fillRect(bx, by, bw, bh);
    const red = w.phase === 'quiet' ? (w.clock < 30 ? '#ff4a30' : '#ff9a3a') : '#ff3a28';
    let digits: string;
    if (w.phase === 'quiet') {
      const sec = Math.max(0, Math.ceil(w.clock));
      digits = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    } else {
      // Since the breach: the time engaged, counting up in red.
      const up = Math.max(0, Math.floor(w.t - w.breachT));
      digits = `${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
    }
    const dw = bw * 0.14;
    const dh = bh * 0.62;
    let x = bx + bw * 0.13;
    const y = by + bh * 0.2;
    c.save();
    if (w.flip) {
      c.translate(bx + bw / 2, 0);
      c.scale(-1, 1);
      c.translate(-(bx + bw / 2), 0);
    }
    for (const ch of digits) {
      if (ch === ':') {
        c.fillStyle = red;
        c.fillRect(x + dw * 0.15, y + dh * 0.25, dw * 0.14, dw * 0.14);
        c.fillRect(x + dw * 0.15, y + dh * 0.65, dw * 0.14, dw * 0.14);
        x += dw * 0.5;
        continue;
      }
      seg(x, y, dw * 0.8, dh, ch, red, '#2a1410');
      x += dw;
    }
    c.restore();
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(bx + bw / 2, by + bh / 2, bw * 0.7, red, 0.18);
    c.restore();
  }
  const SEG: Record<string, number[]> = { '0': [1, 1, 1, 0, 1, 1, 1], '1': [0, 0, 1, 0, 0, 1, 0], '2': [1, 0, 1, 1, 1, 0, 1], '3': [1, 0, 1, 1, 0, 1, 1], '4': [0, 1, 1, 1, 0, 1, 0], '5': [1, 1, 0, 1, 0, 1, 1], '6': [1, 1, 0, 1, 1, 1, 1], '7': [1, 0, 1, 0, 0, 1, 0], '8': [1, 1, 1, 1, 1, 1, 1], '9': [1, 1, 1, 1, 0, 1, 1] };
  function seg(x: number, y: number, ww: number, hh: number, ch: string, on: string, off: string) {
    const s = SEG[ch] ?? SEG['8'];
    const tk = ww * 0.16;
    const rects: [number, number, number, number][] = [
      [x + tk, y, ww - tk * 2, tk], [x, y + tk, tk, hh / 2 - tk * 1.5], [x + ww - tk, y + tk, tk, hh / 2 - tk * 1.5], [x + tk, y + hh / 2 - tk / 2, ww - tk * 2, tk],
      [x, y + hh / 2 + tk / 2, tk, hh / 2 - tk * 1.5], [x + ww - tk, y + hh / 2 + tk / 2, tk, hh / 2 - tk * 1.5], [x + tk, y + hh - tk, ww - tk * 2, tk],
    ];
    rects.forEach(([rx, ry, rw, rh], i) => {
      c.fillStyle = s[i] ? on : off;
      c.fillRect(rx, ry, rw, rh);
    });
  }

  /** Inside: the clock, the names over the bays, cranes, lifts, umbilicals, crews, tugs, sparks; the alarm. */
  function drawInside(t: number) {
    c.save();
    c.beginPath();
    c.rect(x0, ceilY, inX1 - x0 + dx, floorY - ceilY);
    c.clip();
    clockBoard(t);
    // Each bay's mech, by name, stencilled over it, with its kill marks.
    for (const m of w.mechs) {
      const q = w.bays[m.bay];
      const ny = ceilY + (floorY - ceilY) * 0.2 - 4 * u;
      c.save();
      c.translate(q.x, ny);
      if (w.flip) c.scale(-1, 1);
      c.font = `bold ${Math.round(Math.min(20 * u, q.w * 0.085))}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = hexA('#e8e4d8', m.state === 'lost' ? 0.2 : 0.6);
      c.fillText(`${String(m.bay + 1).padStart(2, '0')}  ${m.state === 'building' ? `MARK ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][Math.min(10, m.mark)]} · BUILDING` : m.name}`, 0, 0);
      c.restore();
      for (let k = 0; k < Math.min(12, m.kills); k++) {
        c.fillStyle = hexA('#e8e4d8', 0.55);
        c.fillRect(q.x - (Math.min(12, m.kills) * 7 * u) / 2 + k * 7 * u, ny + 14 * u, 4 * u, 10 * u);
      }
    }
    // Cranes: the crab on the rail, the hoist, the cable, the load.
    const railY = ceilY + 56 * u;
    for (const cr of w.cranes) {
      c.fillStyle = '#c8901c';
      c.fillRect(cr.x - 24 * u, railY, 48 * u, 14 * u);
      c.fillStyle = '#2a2826';
      c.fillRect(cr.x - 20 * u, railY + 14 * u, 40 * u, 6 * u);
      c.fillStyle = hexA('#ffffff', 0.2);
      c.fillRect(cr.x - 24 * u, railY, 48 * u, 2 * u);
      const hy = ceilY + (floorY - ceilY) * cr.hook;
      c.strokeStyle = '#1a1a1a';
      c.lineWidth = 1.4 * u;
      c.beginPath();
      c.moveTo(cr.x - 4 * u, railY + 20 * u);
      c.lineTo(cr.x - 4 * u, hy);
      c.moveTo(cr.x + 4 * u, railY + 20 * u);
      c.lineTo(cr.x + 4 * u, hy);
      c.stroke();
      c.fillStyle = '#d8a020';
      c.fillRect(cr.x - 7 * u, hy, 14 * u, 8 * u);
      load(cr.load, cr.x, hy + 8 * u, cr.seed);
    }
    // Lifts on the gantries.
    for (const l of w.lifts) {
      const q = w.bays[l.bay];
      const lx = q.x - q.w * 0.47;
      c.fillStyle = '#2a2a2c';
      c.fillRect(lx - 9 * u, l.y - 18 * u, 18 * u, 18 * u);
      c.strokeStyle = '#d8a020';
      c.lineWidth = 1.2 * u;
      c.strokeRect(lx - 9 * u, l.y - 18 * u, 18 * u, 18 * u);
      c.save();
      c.globalCompositeOperation = 'lighter';
      E.glow(lx, l.y - 20 * u, 5 * u, '#ffb040', 0.7);
      c.restore();
    }
    // Umbilicals and clamps to the mechs in their bays.
    for (const m of w.mechs) {
      if (m.state !== 'bay' && m.state !== 'building') continue;
      const q = w.bays[m.bay];
      c.strokeStyle = '#141414';
      c.lineWidth = 3 * u;
      for (const k of [-0.1, 0.05, 0.12]) {
        c.beginPath();
        c.moveTo(m.x + k * m.H, railY + 16 * u);
        c.quadraticCurveTo(m.x + k * m.H * 2.2, (railY + standY - m.H) / 2 + 40 * u, m.x + k * m.H * 0.6, standY - m.H * 0.86);
        c.stroke();
      }
      for (const side of [-1, 1]) {
        const ax = q.x + side * q.w * 0.47;
        const bx = m.x + side * m.H * 0.24;
        const cy = standY - m.H * 0.78;
        c.fillStyle = '#3a3836';
        c.fillRect(Math.min(ax, bx), cy - 5 * u, Math.abs(bx - ax), 10 * u);
        c.fillStyle = '#d8a020';
        c.fillRect(Math.min(ax, bx), cy - 5 * u, Math.abs(bx - ax), 2 * u);
      }
    }
    c.restore();
  }
  function load(kind: string, x: number, y: number, seed: number) {
    if (kind === 'none') return;
    c.save();
    c.translate(x, y);
    if (kind === 'plate') {
      c.fillStyle = mix(plateCol, '#8a8a84', hash(seed, 1));
      c.beginPath();
      c.moveTo(-40 * u, 6 * u);
      c.lineTo(40 * u, 6 * u);
      c.lineTo(32 * u, 50 * u);
      c.lineTo(-34 * u, 46 * u);
      c.closePath();
      c.fill();
      c.fillStyle = hexA('#e0a820', 0.8);
      c.fillRect(-36 * u, 12 * u, 72 * u, 4 * u);
    } else if (kind === 'arm') {
      c.fillStyle = '#5a5c60';
      c.fillRect(-16 * u, 6 * u, 32 * u, 90 * u);
      c.fillStyle = '#3a3c40';
      c.fillRect(-20 * u, 90 * u, 40 * u, 26 * u);
    } else if (kind === 'barrel') {
      c.fillStyle = '#3a3c40';
      c.fillRect(-60 * u, 6 * u, 120 * u, 14 * u);
      c.fillRect(-20 * u, 20 * u, 40 * u, 20 * u);
    } else if (kind === 'head') {
      c.fillStyle = '#5a5c60';
      c.beginPath();
      c.roundRect(-26 * u, 6 * u, 52 * u, 40 * u, 8 * u);
      c.fill();
      c.fillStyle = hexA('#a8ecff', 0.8);
      c.fillRect(-18 * u, 22 * u, 36 * u, 5 * u);
    } else {
      c.fillStyle = '#2a2c30';
      c.beginPath();
      c.arc(0, 30 * u, 24 * u, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.globalCompositeOperation = 'lighter';
      E.glow(0, 30 * u, 50 * u, '#7ad8ff', 0.6);
      c.restore();
    }
    c.restore();
  }

  /** The crews, the tugs, and what they make: in front of the mechs. */
  function drawCrew(t: number) {
    for (const v of w.vehicles) drawVehicle(E, v, standY + (hash(v.seed, 1) - 0.3) * dy * 0.5, u, t);
    for (const p of w.crew) {
      const welding = p.job === 'weld' && Math.abs(p.x - p.tx) < 3 && Math.abs(p.y - p.ty) < 2 ? (Math.sin(t * 23 + p.seed) > -0.2 ? 0.7 + 0.3 * Math.sin(t * 41 + p.seed) : 0) : 0;
      drawPerson(E, p, 11 * u, welding, p.y > roofY + 10 * u);
    }
  }

  /** The front layer: the cut, darkened a little by the hour; the alarm over the inside. */
  function drawFront(t: number) {
    c.drawImage(front!, BX, BY, BW, BH);
    c.save();
    c.globalAlpha = shadeOf() * 0.6;
    c.drawImage(tinted(front!, shadeCol(), 'front'), BX, BY, BW, BH);
    c.restore();
    if (w.alarm > 0.02) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = hexA('#ff2a1a', 0.07 * w.alarm * pulse);
      c.fillRect(x0, ceilY, inX1 - x0, floorY - ceilY);
      for (const q of w.bays) {
        const a = t * 5 + q.x;
        E.glow(q.x + q.w * 0.47, ceilY + 80 * u, 60 * u * (0.6 + 0.4 * Math.abs(Math.cos(a))), '#ff2a1a', 0.7 * w.alarm);
      }
      E.glow(fx0 + dx / 2, w.doorTop - 30 * u - dy / 2, 40 * u, '#ff2a1a', w.alarm * pulse);
      c.restore();
    }
  }

  /** A mech in the dock (in its bay, walking, on the apron), and the light of its bay's floods on it. */
  const isIn = (m: Mech) => m.state === 'bay' || m.state === 'building' || m.state === 'walkout' || m.state === 'walkin' || m.state === 'hook';
  return { drawBack, drawCrew, drawFront, isIn, box: { BX, BY, BW, BH } };
}
