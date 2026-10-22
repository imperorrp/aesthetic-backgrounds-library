/**
 * The castle, painted. The body (hull and face, the skirt of iron plates over the hips, cottages,
 * turrets, chimneys, pipes, balconies, the dinghy and barrels) is baked once from the design in
 * noon colours and coloured by the hour; the legs are drawn live, solved from the hip to where
 * each foot is, hen-fashion (the knee forward, the hock back, three toes and a spur); and the live
 * parts over the body: lit windows and the hearth by night, the door and what it opens on, the
 * dial, the paddle wheel, flags and washing in the wind, the household, and the marks of the road.
 *
 * Space: castle units (see ./design), drawn with the body's transform (belly at the origin, x the
 * way it walks), so the castle mirrors itself when it walks the other way.
 */
import { hash } from './land';
import { mix, mk, rgba, type Env } from './sky';
import type { Design, Mat } from './design';
import type { CastleWorld, Member } from './types';

type G = CanvasRenderingContext2D;
const INK = '#2a1e1c';

export function createCastlePainter(world: CastleWorld, E: Env, res: number) {
  const D: Design = world.design;
  const c = world.castle;
  const P = D.palette;
  /** The light in castle units: from the sun's side, as the castle faces. */
  const lx = world.sunSide * c.dir;
  const matCol = (m: Mat) => P[m];
  const minX = Math.min(...D.hull.map((p) => p[0])) - 70;
  const maxX = Math.max(...D.hull.map((p) => p[0])) + 70;
  const minY = D.top - 60;
  const maxY = 70;
  const K = res;
  let body: HTMLCanvasElement | null = null;
  let out: HTMLCanvasElement | null = null;
  let stamp = '';

  // ---- shading helpers -------------------------------------------------------------------------------
  const shadeX = (g: G, x0: number, x1: number, base: string, k = 0.32) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    const lit = mix(base, '#fff6e0', k * 0.9);
    const dark = mix(base, '#1c1622', k * 1.4);
    gr.addColorStop(0, lx > 0 ? dark : lit);
    gr.addColorStop(0.5, base);
    gr.addColorStop(1, lx > 0 ? lit : dark);
    return gr;
  };
  const cyl = (g: G, x0: number, x1: number, base: string) => {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    const lit = mix(base, '#fff8e8', 0.42);
    const dark = mix(base, '#18141e', 0.55);
    const a = lx > 0 ? 0.68 : 0.32;
    gr.addColorStop(0, dark);
    gr.addColorStop(Math.max(0.05, a - 0.25), base);
    gr.addColorStop(a, lit);
    gr.addColorStop(Math.min(0.97, a + 0.18), base);
    gr.addColorStop(1, mix(dark, base, 0.3));
    if (lx < 0) {
      const g2 = g.createLinearGradient(x0, 0, x1, 0);
      g2.addColorStop(0, mix(dark, base, 0.3));
      g2.addColorStop(Math.max(0.03, a - 0.18), base);
      g2.addColorStop(a, lit);
      g2.addColorStop(Math.min(0.95, a + 0.25), base);
      g2.addColorStop(1, dark);
      return g2;
    }
    return gr;
  };
  const outline = (g: G, w = 1.1, a = 0.6) => {
    g.strokeStyle = rgba(INK, a);
    g.lineWidth = w;
    g.stroke();
  };
  const R = (s: number, k: number) => hash(s, k, 311);

  /** A wall's material, painted inside its rectangle (clip first). */
  function texture(g: G, m: Mat, x: number, y: number, w: number, h: number, seed: number) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    const base = matCol(m);
    g.fillStyle = shadeX(g, x, x + w, base, 0.22);
    g.fillRect(x, y, w, h);
    if (m === 'brick') {
      for (let yy = y + 3, row = 0; yy < y + h; yy += 3.4, row++) {
        g.strokeStyle = rgba('#e8d8c0', 0.25);
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(x, yy);
        g.lineTo(x + w, yy);
        g.stroke();
        for (let xx = x + (row % 2) * 3.5; xx < x + w; xx += 7) {
          g.beginPath();
          g.moveTo(xx, yy - 3.4);
          g.lineTo(xx, yy);
          g.stroke();
          if (R(seed, Math.floor(xx * 3 + yy * 7)) < 0.2) {
            g.fillStyle = rgba(R(seed, Math.floor(xx + yy)) < 0.5 ? '#6a2a22' : '#d08a6a', 0.35);
            g.fillRect(xx + 0.4, yy - 3, 6.2, 2.6);
          }
        }
      }
    } else if (m === 'wood') {
      for (let xx = x + 2; xx < x + w; xx += 4.2 + R(seed, Math.floor(xx)) * 2) {
        g.strokeStyle = rgba('#3a2418', 0.5);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(xx, y);
        g.lineTo(xx, y + h);
        g.stroke();
        g.strokeStyle = rgba('#c8a070', 0.25);
        g.beginPath();
        g.moveTo(xx + 1, y + R(seed, xx) * h * 0.5);
        g.lineTo(xx + 1.2, y + h * (0.5 + R(seed, xx + 1) * 0.5));
        g.stroke();
      }
    } else if (m === 'plaster') {
      // Half-timbered: dark beams in a frame and braces.
      g.strokeStyle = '#4a3020';
      g.lineWidth = 2.2;
      g.strokeRect(x + 1, y + 1, w - 2, h - 2);
      const n = Math.max(1, Math.round(w / 18));
      g.beginPath();
      for (let i = 1; i < n; i++) {
        const xx = x + (w * i) / n;
        g.moveTo(xx, y);
        g.lineTo(xx, y + h);
      }
      g.moveTo(x, y + h * 0.5);
      g.lineTo(x + w, y + h * 0.5);
      for (let i = 0; i < n; i++) {
        const xa = x + (w * i) / n;
        const xb = x + (w * (i + 1)) / n;
        if (R(seed, i) < 0.5) {
          g.moveTo(xa, y + h * 0.5);
          g.lineTo(xb, y + h);
        } else {
          g.moveTo(xb, y + h * 0.5);
          g.lineTo(xa, y + h);
        }
      }
      g.stroke();
      // Stains of weather.
      for (let k = 0; k < 4; k++) {
        g.fillStyle = rgba('#8a7a60', 0.12);
        g.beginPath();
        g.ellipse(x + R(seed, k + 9) * w, y + h * (0.3 + R(seed, k + 19) * 0.7), w * 0.15, h * 0.2, 0, 0, Math.PI * 2);
        g.fill();
      }
    } else if (m === 'stone') {
      for (let yy = y, row = 0; yy < y + h; yy += 5, row++) {
        for (let xx = x - (row % 2) * 4; xx < x + w; xx += 8 + R(seed, row * 31 + Math.floor(xx)) * 4) {
          g.fillStyle = rgba(R(seed, row * 7 + Math.floor(xx)) < 0.5 ? '#c8c0b0' : '#6a6458', 0.3);
          g.fillRect(xx + 0.4, yy + 0.4, 7, 4.2);
        }
      }
    } else {
      // Iron, rust, bronze, tin: plates, seams, rivets, rust running down.
      const pw = 14 + R(seed, 1) * 8;
      const ph = 11 + R(seed, 2) * 6;
      for (let yy = y; yy < y + h; yy += ph)
        for (let xx = x; xx < x + w; xx += pw) {
          const v = R(seed, Math.floor(xx * 1.3 + yy * 2.1));
          g.fillStyle = rgba(v < 0.4 ? '#000000' : '#ffffff', 0.04 + v * 0.05);
          g.fillRect(xx, yy, pw, ph);
          g.strokeStyle = rgba(INK, 0.38);
          g.lineWidth = 0.55;
          g.strokeRect(xx, yy, pw, ph);
          g.fillStyle = rgba('#e8e0d0', 0.5);
          for (let q = 2; q < pw; q += 3.5) g.fillRect(xx + q, yy + 1, 0.8, 0.8);
        }
      if (m === 'rust' || m === 'iron') {
        for (let k = 0; k < Math.floor(w / 6); k++) {
          const sx = x + R(seed, k + 40) * w;
          const sy = y + R(seed, k + 50) * h * 0.6;
          const gr = g.createLinearGradient(0, sy, 0, sy + h * 0.4);
          gr.addColorStop(0, rgba('#8a4a2a', 0.4));
          gr.addColorStop(1, rgba('#8a4a2a', 0));
          g.fillStyle = gr;
          g.fillRect(sx, sy, 1.4, h * 0.4);
        }
      }
    }
    // The wall darkens up under the eaves, and toward its foot.
    const ao = g.createLinearGradient(0, y, 0, y + h);
    ao.addColorStop(0, rgba('#100a14', 0.32));
    ao.addColorStop(0.18, rgba('#100a14', 0));
    ao.addColorStop(0.85, rgba('#100a14', 0));
    ao.addColorStop(1, rgba('#100a14', 0.2));
    g.fillStyle = ao;
    g.fillRect(x, y, w, h);
    g.restore();
  }
  function windowAt(g: G, wn: { x: number; y: number; w: number; h: number; round: boolean }, frame = '#e8dcc0') {
    g.fillStyle = '#2a2a3a';
    g.beginPath();
    if (wn.round) g.arc(wn.x + wn.w / 2, wn.y + wn.h / 2, wn.w / 2, 0, Math.PI * 2);
    else {
      g.rect(wn.x, wn.y + wn.w * 0.3, wn.w, wn.h - wn.w * 0.3);
      g.arc(wn.x + wn.w / 2, wn.y + wn.w * 0.5, wn.w / 2, Math.PI, 0);
    }
    g.fill();
    g.strokeStyle = frame;
    g.lineWidth = 0.9;
    g.stroke();
    // Panes, and the sky caught in the glass.
    g.strokeStyle = rgba(frame, 0.8);
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(wn.x + wn.w / 2, wn.y + 1);
    g.lineTo(wn.x + wn.w / 2, wn.y + wn.h);
    if (!wn.round) {
      g.moveTo(wn.x, wn.y + wn.h * 0.55);
      g.lineTo(wn.x + wn.w, wn.y + wn.h * 0.55);
    }
    g.stroke();
    g.fillStyle = rgba('#a8c8e8', 0.35);
    g.fillRect(wn.x + (lx > 0 ? wn.w * 0.55 : 0.5), wn.y + wn.h * 0.2, wn.w * 0.35, wn.h * 0.3);
    if (!wn.round) {
      g.fillStyle = frame;
      g.fillRect(wn.x - 1, wn.y + wn.h, wn.w + 2, 1.2);
    }
  }
  function roof(g: G, kind: string, x: number, y: number, w: number, h: number, col: string, over: number, seed: number) {
    const lit = mix(col, '#fff0d8', 0.3);
    const dark = mix(col, '#1a1420', 0.38);
    g.save();
    g.beginPath();
    if (kind === 'gable') {
      g.moveTo(x - over, y);
      g.lineTo(x + w / 2, y - h);
      g.lineTo(x + w + over, y);
      g.closePath();
    } else if (kind === 'mansard') {
      g.moveTo(x - over, y);
      g.quadraticCurveTo(x - over * 0.2, y - h * 0.8, x + w * 0.2, y - h);
      g.lineTo(x + w * 0.8, y - h);
      g.quadraticCurveTo(x + w + over * 0.2, y - h * 0.8, x + w + over, y);
      g.closePath();
    } else if (kind === 'lean') {
      const hi = R(seed, 5) < 0.5;
      g.moveTo(x - over, y - (hi ? h : h * 0.15));
      g.lineTo(x + w + over, y - (hi ? h * 0.15 : h));
      g.lineTo(x + w + over, y);
      g.lineTo(x - over, y);
      g.closePath();
    } else if (kind === 'dome') {
      g.ellipse(x + w / 2, y, w / 2 + over * 0.5, h, 0, Math.PI, 0);
      g.closePath();
    } else if (kind === 'thatch') {
      // A thick thatch: a rounded hump that hangs over the eaves.
      g.moveTo(x - over * 1.6, y + 3);
      g.bezierCurveTo(x - over, y - h * 0.9, x + w * 0.2, y - h * 1.25, x + w / 2, y - h * 1.25);
      g.bezierCurveTo(x + w * 0.8, y - h * 1.25, x + w + over, y - h * 0.9, x + w + over * 1.6, y + 3);
      g.quadraticCurveTo(x + w / 2, y + 7, x - over * 1.6, y + 3);
      g.closePath();
    } else {
      g.rect(x - over * 0.5, y - h, w + over, h);
    }
    g.fillStyle = shadeX(g, x - over, x + w + over, col, 0.35);
    g.fill();
    outline(g, 1, 0.65);
    g.clip();
    if (kind === 'thatch') {
      // Straw: combed strokes down the slope, a ridge of darker straw on top.
      for (let k = 0; k < w * 1.4; k++) {
        const q = k / (w * 1.4);
        const sx = x - over * 1.4 + q * (w + over * 2.8);
        g.strokeStyle = rgba(R(seed, k + 70) < 0.5 ? mix(col, '#3a2a14', 0.35) : mix(col, '#fff0c0', 0.25), 0.5);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(sx, y - h * 1.25 * Math.sin(q * Math.PI) * 0.95);
        g.lineTo(sx + (q - 0.5) * 6, y + 4);
        g.stroke();
      }
      g.fillStyle = rgba(mix(col, '#3a2a14', 0.4), 0.8);
      g.fillRect(x + w * 0.15, y - h * 1.28, w * 0.7, 3);
    }
    // Tiles or shingles in rows, each row a shadow line; the lit slope and the dark one.
    for (let yy = y - h, row = 0; yy < y + 2 && kind !== 'thatch'; yy += 3.2, row++) {
      g.strokeStyle = rgba(dark, 0.55);
      g.lineWidth = 0.7;
      g.beginPath();
      if (kind === 'dome') {
        g.ellipse(x + w / 2, y, w / 2, Math.max(0.1, y - yy), 0, Math.PI, 0);
      } else {
        g.moveTo(x - over, yy);
        g.lineTo(x + w + over, yy);
      }
      g.stroke();
      for (let xx = x - over + (row % 2) * 2.5; xx < x + w + over; xx += 5) {
        g.beginPath();
        g.moveTo(xx, yy);
        g.lineTo(xx, yy + 3);
        g.stroke();
      }
    }
    if (kind === 'gable') {
      g.fillStyle = rgba(lx > 0 ? lit : dark, 0.35);
      g.beginPath();
      g.moveTo(x + w / 2, y - h);
      g.lineTo(lx > 0 ? x + w + over : x - over, y);
      g.lineTo(x + w / 2, y);
      g.fill();
    }
    if (kind === 'dome') {
      for (let k = 1; k < 6; k++) {
        g.strokeStyle = rgba(lit, 0.4);
        g.beginPath();
        g.ellipse(x + w / 2, y, (w / 2) * Math.abs(Math.cos((k / 6) * Math.PI)), h, 0, Math.PI, 0);
        g.stroke();
      }
    }
    // Moss and patches of different tiles.
    for (let k = 0; k < 3; k++) {
      g.fillStyle = rgba(R(seed, k) < 0.5 ? '#6a8a4a' : mix(col, '#c8a070', 0.4), 0.35);
      g.fillRect(x + R(seed, k + 3) * w, y - h * R(seed, k + 6) * 0.8, 5 + R(seed, k + 9) * 6, 3.2);
    }
    g.restore();
    // The eaves' shadow on the wall below.
    if (kind !== 'dome') {
      const sg = g.createLinearGradient(0, y, 0, y + 5);
      sg.addColorStop(0, rgba('#100a14', 0.45));
      sg.addColorStop(1, rgba('#100a14', 0));
      g.fillStyle = sg;
      g.fillRect(x, y, w, 5);
    }
  }
  function coneRoof(g: G, cx: number, y: number, r: number, h: number, kind: string, col: string) {
    const lit = mix(col, '#fff0d8', 0.35);
    g.beginPath();
    if (kind === 'onion') {
      g.moveTo(cx - r * 1.05, y);
      g.bezierCurveTo(cx - r * 1.5, y - h * 0.45, cx - r * 0.2, y - h * 0.7, cx, y - h);
      g.bezierCurveTo(cx + r * 0.2, y - h * 0.7, cx + r * 1.5, y - h * 0.45, cx + r * 1.05, y);
    } else if (kind === 'dome') {
      g.ellipse(cx, y, r * 1.1, h * 0.8, 0, Math.PI, 0);
    } else if (kind === 'flat') {
      g.rect(cx - r * 1.1, y - 6, r * 2.2, 6);
    } else {
      // A witch's hat: concave sides, flared eaves.
      g.moveTo(cx - r * 1.3, y + 1);
      g.quadraticCurveTo(cx - r * 0.55, y - h * 0.25, cx, y - h);
      g.quadraticCurveTo(cx + r * 0.55, y - h * 0.25, cx + r * 1.3, y + 1);
      g.closePath();
    }
    g.fillStyle = cyl(g, cx - r * 1.3, cx + r * 1.3, col);
    g.fill();
    outline(g, 1, 0.7);
    g.save();
    g.clip();
    for (let k = 1; k < 12; k++) {
      const yy = y - (h * k) / 12;
      const ww = r * 1.3 * (1 - k / 12) * 1.1;
      g.strokeStyle = rgba(mix(col, '#100a14', 0.5), 0.45);
      g.lineWidth = 0.6;
      g.beginPath();
      g.ellipse(cx, yy, ww, ww * 0.18, 0, 0, Math.PI);
      g.stroke();
    }
    g.strokeStyle = rgba(lit, 0.4);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx + lx * r * 0.35, y);
    g.quadraticCurveTo(cx + lx * r * 0.2, y - h * 0.4, cx, y - h);
    g.stroke();
    g.restore();
    // A finial.
    g.fillStyle = '#c8a050';
    g.beginPath();
    g.arc(cx, y - h - 1.5, 1.6, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - 0.4, y - h - 5, 0.8, 4);
  }

  // ---- the bake ---------------------------------------------------------------------------------------
  function bake() {
    body = mk((maxX - minX) * K, (maxY - minY) * K);
    out = mk(body.width, body.height);
    const g = body.getContext('2d')!;
    g.scale(K, K);
    g.translate(-minX, -minY);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const deck = D.deck;
    const hullPath = new Path2D();
    D.hull.forEach(([x, y], i) => (i ? hullPath.lineTo(x, y) : hullPath.moveTo(x, y)));
    hullPath.closePath();
    // Behind the hull: the dinghy on its davits, the far turret backs, junk at the stern.
    const back = Math.min(...D.hull.map((p) => p[0]));
    if (D.rear.boat) {
      const bx = back - 18;
      const by = deck(back + 10) - 6;
      g.strokeStyle = '#3a2c24';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(back + 8, by - 26);
      g.lineTo(bx - 6, by - 30);
      g.lineTo(bx - 6, by - 10);
      g.stroke();
      g.beginPath();
      g.moveTo(bx - 26, by - 6);
      g.quadraticCurveTo(bx - 4, by + 8, bx + 18, by - 6);
      g.closePath();
      g.fillStyle = shadeX(g, bx - 26, bx + 18, '#9a5a3a', 0.3);
      g.fill();
      outline(g);
      g.strokeStyle = rgba('#f0e0c0', 0.6);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(bx - 25, by - 5);
      g.lineTo(bx + 17, by - 5);
      g.stroke();
    }
    // The skirt: iron plates hanging over the hips like feathers.
    const hipXs = [...new Set(D.legs.map((l) => Math.round(l.hip[0] / 40) * 40))];
    const skirt = hipXs.flatMap((hx) => Array.from({ length: 13 }, (_, i) => [hx, i] as [number, number]));
    for (const [hx, i] of skirt) {
      const x = hx - 70 + i * 11 + (R(D.seed, i + hx) - 0.5) * 4;
      const dxh = x - hx;
      const top = Math.max(-40 + Math.abs(dxh) * 0.08, D.hull.length ? -40 : -40);
      const len = 30 + R(D.seed, i + 20 + hx) * 16 - Math.abs(dxh) * 0.12;
      g.beginPath();
      g.moveTo(x - 6, top);
      g.lineTo(x + 7, top);
      g.lineTo(x + 5, top + len);
      g.quadraticCurveTo(x, top + len + 5, x - 4, top + len);
      g.closePath();
      g.fillStyle = shadeX(g, x - 6, x + 7, i % 3 === 0 ? P.rust : P.iron, 0.35);
      g.fill();
      outline(g, 0.8, 0.6);
      g.fillStyle = rgba('#e8e0d0', 0.6);
      g.fillRect(x - 0.5, top + 3, 1, 1);
    }
    // The hull, its plates, and the shadow of its own belly.
    g.save();
    g.clip(hullPath);
    for (const p of D.plates) texture(g, p.mat, p.x, p.y, p.w + 1, p.h + 1, p.seed);
    const hb = g.createLinearGradient(0, -130, 0, 20);
    hb.addColorStop(0, rgba('#fff0d8', 0.12));
    hb.addColorStop(0.45, rgba('#000000', 0));
    hb.addColorStop(1, rgba('#100a14', 0.55));
    g.fillStyle = hb;
    g.fillRect(minX, -200, maxX - minX, 260);
    const side = g.createLinearGradient(minX + 70, 0, maxX - 70, 0);
    side.addColorStop(lx > 0 ? 0 : 1, rgba('#100a14', 0.35));
    side.addColorStop(0.5, rgba('#000000', 0));
    side.addColorStop(lx > 0 ? 1 : 0, rgba('#fff0d8', 0.15));
    g.fillStyle = side;
    g.fillRect(minX, -200, maxX - minX, 260);
    // A row of portholes and a hatch or two along the side.
    for (let k = 0; k < 7; k++) {
      const x = back + 30 + k * 34 + R(D.seed, k + 60) * 8;
      const y = -62 + Math.sin(k) * 6;
      if (Math.abs(x - D.door.x - 12) < 20) continue;
      g.fillStyle = '#c8a050';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      windowAt(g, { x: x - 3.5, y: y - 3.5, w: 7, h: 7, round: true }, '#a88040');
    }
    g.restore();
    g.save();
    g.lineWidth = 1.6;
    g.strokeStyle = rgba(INK, 0.75);
    g.stroke(hullPath);
    g.restore();
    // The deck's rail.
    g.strokeStyle = rgba('#3a2a22', 0.8);
    g.lineWidth = 0.9;
    g.beginPath();
    for (let x = back + 6; x < D.face.cx - D.face.r * 0.6; x += 2) g.lineTo(x, deck(x) - 6);
    g.stroke();
    for (let x = back + 6; x < D.face.cx - D.face.r * 0.6; x += 7) {
      g.beginPath();
      g.moveTo(x, deck(x));
      g.lineTo(x, deck(x) - 6);
      g.stroke();
    }
    // A barge's mast: the yard, a great patched sail bellied by the wind, the stays to bow and stern.
    if (D.mast) {
      const m = D.mast;
      const mb = deck(m.x);
      const front = Math.max(...D.hull.map((p) => p[0]));
      g.strokeStyle = rgba('#3a2a1e', 0.85);
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(m.x, m.top + 6);
      g.lineTo(front - 6, deck(front - 6) - 2);
      g.moveTo(m.x, m.top + 6);
      g.lineTo(back + 8, deck(back + 8) - 2);
      for (let k = 1; k < 5; k++) {
        g.moveTo(m.x, m.top + k * 30);
        g.lineTo(m.x + (k % 2 ? 1 : -1) * m.yard * 0.5, m.top + 22);
      }
      g.stroke();
      const sy = m.top + 22;
      const sw = m.yard;
      g.beginPath();
      g.moveTo(m.x - sw / 2, sy);
      g.lineTo(m.x + sw / 2, sy);
      g.quadraticCurveTo(m.x + sw * 0.62, sy + m.sail * 0.5, m.x + sw * 0.48, sy + m.sail);
      g.lineTo(m.x - sw * 0.48, sy + m.sail);
      g.quadraticCurveTo(m.x - sw * 0.4, sy + m.sail * 0.5, m.x - sw / 2, sy);
      g.closePath();
      g.fillStyle = shadeX(g, m.x - sw / 2, m.x + sw / 2, '#e4d6b8', 0.3);
      g.fill();
      outline(g, 1, 0.6);
      g.save();
      g.clip();
      g.strokeStyle = rgba('#8a7a60', 0.35);
      g.lineWidth = 0.7;
      for (let k = 1; k < 7; k++) {
        g.beginPath();
        g.moveTo(m.x - sw / 2 + (sw * k) / 7, sy);
        g.quadraticCurveTo(m.x - sw / 2 + (sw * k) / 7 + 5, sy + m.sail * 0.5, m.x - sw / 2 + (sw * k) / 7, sy + m.sail);
        g.stroke();
      }
      for (let k = 0; k < m.patches; k++) {
        g.fillStyle = rgba(['#c8784a', '#8aa0b8', '#b8a868', '#a85a5a'][k % 4], 0.75);
        const px = m.x - sw * 0.4 + R(D.seed, k + 300) * sw * 0.7;
        const py = sy + 10 + R(D.seed, k + 310) * (m.sail - 34);
        g.fillRect(px, py, 14 + R(D.seed, k + 320) * 10, 12 + R(D.seed, k + 330) * 8);
        g.strokeStyle = rgba('#5a4a3a', 0.6);
        g.setLineDash([1.5, 1.5]);
        g.strokeRect(px, py, 14 + R(D.seed, k + 320) * 10, 12 + R(D.seed, k + 330) * 8);
        g.setLineDash([]);
      }
      g.restore();
      g.fillStyle = shadeX(g, m.x - 3, m.x + 3, '#6a4a32', 0.4);
      g.fillRect(m.x - 3, m.top, 6, mb - m.top);
      g.fillRect(m.x - sw / 2 - 4, sy - 3, sw + 8, 4);
      g.fillStyle = '#6a4a32';
      g.fillRect(m.x - 7, m.top + 2, 14, 7);
    }
    if (D.tank) {
      const t = D.tank;
      g.strokeStyle = '#4a3828';
      g.lineWidth = 2;
      g.beginPath();
      for (const dx of [-t.r * 0.8, t.r * 0.8, -t.r * 0.3, t.r * 0.3]) {
        g.moveTo(t.x + dx, t.y);
        g.lineTo(t.x + dx * 1.2, t.y + 44);
      }
      g.moveTo(t.x - t.r, t.y + 18);
      g.lineTo(t.x + t.r, t.y + 30);
      g.moveTo(t.x + t.r, t.y + 18);
      g.lineTo(t.x - t.r, t.y + 30);
      g.stroke();
      g.beginPath();
      g.rect(t.x - t.r, t.y - t.r * 1.5, t.r * 2, t.r * 1.5);
      g.save();
      g.clip();
      texture(g, 'wood', t.x - t.r, t.y - t.r * 1.5, t.r * 2, t.r * 1.5, D.seed + 9);
      g.restore();
      g.beginPath();
      g.rect(t.x - t.r, t.y - t.r * 1.5, t.r * 2, t.r * 1.5);
      outline(g);
      g.fillStyle = '#3a3a40';
      for (const q of [0.2, 0.75]) g.fillRect(t.x - t.r - 1, t.y - t.r * 1.5 * (1 - q) - 1, t.r * 2 + 2, 2);
      coneRoof(g, t.x, t.y - t.r * 1.5, t.r * 0.9, t.r * 1.1, 'cone', '#6a5040');
    }
    if (D.mill) {
      const m = D.mill;
      const tw0 = m.r * 0.5;
      const tw1 = m.r * 0.3;
      g.beginPath();
      g.moveTo(m.x - tw0 / 2, m.y + m.r * 0.9);
      g.lineTo(m.x - tw1 / 2, m.y);
      g.lineTo(m.x + tw1 / 2, m.y);
      g.lineTo(m.x + tw0 / 2, m.y + m.r * 0.9);
      g.closePath();
      g.fillStyle = shadeX(g, m.x - tw0 / 2, m.x + tw0 / 2, P.plaster, 0.35);
      g.fill();
      outline(g);
      roof(g, 'dome', m.x - tw1 * 0.7, m.y + 2, tw1 * 1.4, 9, '#6a4a3a', 2, D.seed + 4);
    }
    // The upper works, back to front: blocks, turrets (sorted by depth), chimneys, pipes, balconies.
    for (const b of D.blocks) {
      texture(g, b.mat, b.x, b.y, b.w, b.h, b.seed);
      g.beginPath();
      g.rect(b.x, b.y, b.w, b.h);
      outline(g, 1, 0.6);
      for (const wn of b.wins) windowAt(g, wn, b.mat === 'plaster' ? '#4a3020' : '#e8dcc0');
      roof(g, b.roof, b.x, b.y, b.w, b.roofH, b.roofCol, b.overhang, b.seed);
      // Brackets under the block where it overhangs.
      g.strokeStyle = rgba('#3a2a1e', 0.8);
      g.lineWidth = 1.2;
      for (const q of [0.15, 0.85]) {
        g.beginPath();
        g.moveTo(b.x + b.w * q, b.y + b.h);
        g.lineTo(b.x + b.w * q + (q < 0.5 ? 4 : -4), b.y + b.h + 7);
        g.stroke();
      }
    }
    for (const t of D.turrets) {
      g.beginPath();
      g.rect(t.x - t.r, t.y, t.r * 2, t.h);
      g.save();
      g.clip();
      texture(g, t.mat, t.x - t.r, t.y, t.r * 2, t.h, t.seed);
      g.fillStyle = cyl(g, t.x - t.r, t.x + t.r, '#808080');
      g.globalCompositeOperation = 'overlay';
      g.fillRect(t.x - t.r, t.y, t.r * 2, t.h);
      g.globalCompositeOperation = 'source-over';
      g.restore();
      g.beginPath();
      g.rect(t.x - t.r, t.y, t.r * 2, t.h);
      outline(g, 1, 0.6);
      for (const wn of t.wins) windowAt(g, wn);
      if (t.ring) {
        g.fillStyle = '#6a4a34';
        g.fillRect(t.x - t.r - 3, t.y + t.h * 0.35, t.r * 2 + 6, 2.4);
        g.strokeStyle = '#3a2a1e';
        g.lineWidth = 0.6;
        for (let q = t.x - t.r - 2; q < t.x + t.r + 3; q += 3) {
          g.beginPath();
          g.moveTo(q, t.y + t.h * 0.35);
          g.lineTo(q, t.y + t.h * 0.35 - 5);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(t.x - t.r - 3, t.y + t.h * 0.35 - 5);
        g.lineTo(t.x + t.r + 3, t.y + t.h * 0.35 - 5);
        g.stroke();
      }
      coneRoof(g, t.x, t.y, t.r, t.roofH, t.roof, t.roofCol);
    }
    for (const ch of D.chimneys) {
      if (ch.mat === 'iron' || ch.mat === 'tin') {
        g.fillStyle = cyl(g, ch.x, ch.x + ch.w, matCol(ch.mat));
        g.fillRect(ch.x, ch.y, ch.w, ch.h);
        g.beginPath();
        g.rect(ch.x, ch.y, ch.w, ch.h);
        outline(g, 0.9);
        g.fillStyle = rgba(INK, 0.5);
        for (let yy = ch.y + 6; yy < ch.y + ch.h; yy += 9) g.fillRect(ch.x - 0.6, yy, ch.w + 1.2, 1.4);
        // A conical cap on legs.
        g.fillStyle = mix(matCol(ch.mat), '#1a1420', 0.3);
        g.beginPath();
        g.moveTo(ch.x - 3, ch.y - 4);
        g.lineTo(ch.x + ch.w / 2, ch.y - 9);
        g.lineTo(ch.x + ch.w + 3, ch.y - 4);
        g.fill();
        g.fillRect(ch.x + 1, ch.y - 4, 1, 4);
        g.fillRect(ch.x + ch.w - 2, ch.y - 4, 1, 4);
      } else {
        texture(g, ch.mat, ch.x, ch.y, ch.w, ch.h, ch.seed);
        g.beginPath();
        g.rect(ch.x, ch.y, ch.w, ch.h);
        outline(g, 0.9);
        g.fillStyle = mix(matCol(ch.mat), '#e8d8c0', 0.2);
        g.fillRect(ch.x - 1.5, ch.y, ch.w + 3, 3);
        if (ch.pot) {
          g.fillStyle = '#a0583a';
          g.fillRect(ch.x + ch.w * 0.25, ch.y - 5, ch.w * 0.5, 5);
        }
      }
      // Soot down from the top.
      const sg = g.createLinearGradient(0, ch.y, 0, ch.y + ch.h * 0.5);
      sg.addColorStop(0, rgba('#100a10', 0.45));
      sg.addColorStop(1, rgba('#100a10', 0));
      g.fillStyle = sg;
      g.fillRect(ch.x, ch.y, ch.w, ch.h * 0.5);
    }
    for (const p of D.pipes) {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const path = () => {
        g.beginPath();
        p.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      };
      path();
      g.strokeStyle = INK;
      g.lineWidth = p.r * 2 + 1.4;
      g.stroke();
      path();
      g.strokeStyle = matCol(p.mat);
      g.lineWidth = p.r * 2;
      g.stroke();
      g.save();
      g.translate(lx * p.r * 0.35, -p.r * 0.35);
      path();
      g.strokeStyle = rgba('#fff4d8', 0.45);
      g.lineWidth = p.r * 0.6;
      g.stroke();
      g.restore();
      for (const [x, y] of p.pts) {
        g.fillStyle = mix(matCol(p.mat), INK, 0.3);
        g.fillRect(x - p.r * 1.4, y - p.r * 1.4, p.r * 2.8, p.r * 2.8);
      }
      if (p.vent) {
        const [x, y] = p.pts[p.pts.length - 1];
        g.fillStyle = mix(matCol(p.mat), INK, 0.2);
        g.beginPath();
        g.moveTo(x - p.r * 2, y - 2);
        g.lineTo(x + p.r * 2, y - 2);
        g.lineTo(x + p.r, y - 8);
        g.lineTo(x - p.r, y - 8);
        g.fill();
      }
    }
    for (const b of D.balconies) {
      g.fillStyle = '#5a3e2a';
      g.fillRect(b.x, b.y, b.w, 3);
      g.strokeStyle = '#3a2a1e';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(b.x, b.y - 9);
      g.lineTo(b.x + b.w, b.y - 9);
      for (let x = b.x; x <= b.x + b.w; x += 4) {
        g.moveTo(x, b.y);
        g.lineTo(x, b.y - 9);
      }
      g.stroke();
      g.beginPath();
      g.moveTo(b.x + 4, b.y + 3);
      g.lineTo(b.x + 10, b.y + 10);
      g.moveTo(b.x + b.w - 4, b.y + 3);
      g.lineTo(b.x + b.w - 10, b.y + 10);
      g.stroke();
      for (let k = 0; k < b.plants; k++) {
        const px = b.x + 6 + k * (b.w - 12) / Math.max(1, b.plants);
        g.fillStyle = '#a0583a';
        g.fillRect(px - 2.5, b.y - 5, 5, 5);
        g.fillStyle = '#4a7a3a';
        g.beginPath();
        g.arc(px, b.y - 7, 4, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e85a6a';
        g.beginPath();
        g.arc(px + 1.5, b.y - 9, 1.4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Barrels and a bird cage on the deck.
    for (const [bx, by] of D.rear.barrels) {
      g.fillStyle = shadeX(g, bx - 5, bx + 5, '#8a5a36', 0.35);
      g.beginPath();
      g.roundRect(bx - 5, by - 12, 10, 12, 2);
      g.fill();
      outline(g, 0.8);
      g.fillStyle = rgba(INK, 0.6);
      g.fillRect(bx - 5, by - 9, 10, 1);
      g.fillRect(bx - 5, by - 4, 10, 1);
    }
    // The face: a round iron head at the bow, a great glass eye under a brow, a jaw of teeth.
    const f = D.face;
    g.beginPath();
    g.arc(f.cx, f.cy, f.r, 0, Math.PI * 2);
    g.save();
    g.clip();
    texture(g, 'iron', f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2, D.seed + 5);
    const fg = g.createRadialGradient(f.cx + lx * f.r * 0.35, f.cy - f.r * 0.4, f.r * 0.1, f.cx, f.cy, f.r * 1.05);
    fg.addColorStop(0, rgba('#fff4e0', 0.35));
    fg.addColorStop(0.6, rgba('#000000', 0));
    fg.addColorStop(1, rgba('#100a14', 0.5));
    g.fillStyle = fg;
    g.fillRect(f.cx - f.r, f.cy - f.r, f.r * 2, f.r * 2);
    // Ribs of plate round the head.
    for (let k = 1; k < 4; k++) {
      g.strokeStyle = rgba(INK, 0.4);
      g.lineWidth = 0.9;
      g.beginPath();
      g.arc(f.cx - f.r * 0.6, f.cy, f.r * (0.6 + k * 0.32), -1.2, 1.2);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    g.arc(f.cx, f.cy, f.r, 0, Math.PI * 2);
    outline(g, 1.6, 0.8);
    // The brow: an awning of roof over the eye.
    g.beginPath();
    g.moveTo(f.eyeX - f.eyeR * 2, f.eyeY - f.eyeR * 0.9);
    g.quadraticCurveTo(f.eyeX, f.eyeY - f.eyeR * 2.4, f.eyeX + f.eyeR * 2.2, f.eyeY - f.eyeR * 0.6);
    g.lineTo(f.eyeX + f.eyeR * 2, f.eyeY - f.eyeR * 0.2);
    g.quadraticCurveTo(f.eyeX, f.eyeY - f.eyeR * 1.6, f.eyeX - f.eyeR * 1.8, f.eyeY - f.eyeR * 0.4);
    g.closePath();
    g.fillStyle = shadeX(g, f.eyeX - f.eyeR * 2, f.eyeX + f.eyeR * 2, f.brow, 0.4);
    g.fill();
    outline(g, 1, 0.75);
    // The eye: a brass rim, dark glass, a gleam.
    g.fillStyle = '#b8903e';
    g.beginPath();
    g.arc(f.eyeX, f.eyeY, f.eyeR * 1.25, 0, Math.PI * 2);
    g.fill();
    outline(g, 1, 0.7);
    g.fillStyle = '#222838';
    g.beginPath();
    g.arc(f.eyeX, f.eyeY, f.eyeR, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba('#b8903e', 0.9);
    g.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(f.eyeX + Math.cos(a) * f.eyeR * 0.35, f.eyeY + Math.sin(a) * f.eyeR * 0.35);
      g.lineTo(f.eyeX + Math.cos(a) * f.eyeR, f.eyeY + Math.sin(a) * f.eyeR);
      g.stroke();
    }
    g.fillStyle = rgba('#d8ecff', 0.6);
    g.beginPath();
    g.ellipse(f.eyeX + lx * f.eyeR * 0.35, f.eyeY - f.eyeR * 0.35, f.eyeR * 0.3, f.eyeR * 0.18, -0.6, 0, Math.PI * 2);
    g.fill();
    // The jaw: an iron underlip jutting forward, a row of teeth, the dark of the mouth.
    const jx = f.jawX;
    const jy = f.jawY;
    g.fillStyle = '#1e1618';
    g.beginPath();
    g.ellipse(jx - f.jawW * 0.35, jy - 9, f.jawW * 0.5, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(jx - f.jawW, jy - 2);
    g.quadraticCurveTo(jx - f.jawW * 0.3, jy + 14, jx + 16, jy - 4);
    g.lineTo(jx + 10, jy - 8);
    g.quadraticCurveTo(jx - f.jawW * 0.3, jy + 2, jx - f.jawW, jy - 6);
    g.closePath();
    g.fillStyle = shadeX(g, jx - f.jawW, jx + 16, P.rust, 0.4);
    g.fill();
    outline(g, 1.1, 0.8);
    for (let k = 0; k < f.teeth; k++) {
      const q = (k + 0.5) / f.teeth;
      const tx = jx - f.jawW * 0.9 + q * (f.jawW * 0.9 + 10);
      const ty = jy - 6 + Math.sin(q * Math.PI) * 5;
      g.fillStyle = '#d8d0c0';
      g.beginPath();
      g.moveTo(tx - 2.6, ty);
      g.lineTo(tx, ty - 7);
      g.lineTo(tx + 2.6, ty);
      g.closePath();
      g.fill();
      outline(g, 0.6, 0.6);
    }
    // The door's frame and step (the door itself is live); the dial's brass ring.
    const d = D.door;
    g.fillStyle = '#4a3424';
    g.fillRect(d.x - 2.5, d.y - 2.5, d.w + 5, d.h + 3);
    g.beginPath();
    g.rect(d.x - 2.5, d.y - 2.5, d.w + 5, d.h + 3);
    outline(g, 0.9);
    g.fillStyle = '#6a5040';
    g.fillRect(d.x - 4, d.y + d.h, d.w + 8, 3);
    for (let k = 1; k <= 3; k++) g.fillRect(d.x + 2 + k * 2, d.y + d.h + 3 + k * 4, d.w - 4 - k * 4, 1.6);
    g.fillStyle = '#b8903e';
    g.beginPath();
    g.arc(D.dial.x, D.dial.y, D.dial.r + 1.6, 0, Math.PI * 2);
    g.fill();
    outline(g, 0.8, 0.8);
    // Rivets along the deck line, and a scatter of grime.
    g.fillStyle = rgba('#efe4cc', 0.5);
    for (let x = back + 8; x < D.face.cx; x += 5) g.fillRect(x, deck(x) + 2.5, 0.9, 0.9);
  }

  // ---- the legs ----------------------------------------------------------------------------------------
  const L = D.leg;
  type Pose = { hip: [number, number]; knee: [number, number]; hock: [number, number]; foot: [number, number]; curl: number };
  function pose(k: number): Pose {
    const f = c.feet[k];
    const fx = world.xOf(f.L, 1);
    const fy = world.land.nearY(f.L) - f.lift * c.cs;
    const dx = fx - c.x;
    const dy = fy - c.y;
    const co = Math.cos(c.tilt);
    const si = Math.sin(c.tilt);
    let x = (dx * co + dy * si) / c.cs;
    const y = (-dx * si + dy * co) / c.cs;
    x *= c.dir;
    const hip = D.legs[k].hip;
    const foot: [number, number] = [x, y - 9];
    const a = 0.32 + 0.22 * Math.max(-1, Math.min(1, (foot[0] - hip[0]) / 90));
    const knee: [number, number] = [hip[0] + Math.sin(a) * L.thigh, hip[1] + Math.cos(a) * L.thigh];
    const ddx = foot[0] - knee[0];
    const ddy = foot[1] - knee[1];
    let d = Math.hypot(ddx, ddy);
    const l1 = L.shin;
    const l2 = L.foot;
    d = Math.max(Math.abs(l1 - l2) + 2, Math.min(l1 + l2 - 0.5, d));
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const base = Math.atan2(ddy, ddx);
    // The hock bends back (away from the way it walks).
    const c1: [number, number] = [knee[0] + Math.cos(base + A) * l1, knee[1] + Math.sin(base + A) * l1];
    const c2: [number, number] = [knee[0] + Math.cos(base - A) * l1, knee[1] + Math.sin(base - A) * l1];
    const hock = c1[0] < c2[0] ? c1 : c2;
    const curl = f.planted ? 0 : Math.min(1, f.lift / 20);
    return { hip, knee, hock, foot, curl };
  }
  function limb(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], wa: number, wb: number, col: string, dark: string, lit: string) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    g.beginPath();
    g.moveTo(a[0] + nx * wa, a[1] + ny * wa);
    g.lineTo(b[0] + nx * wb, b[1] + ny * wb);
    g.lineTo(b[0] - nx * wb, b[1] - ny * wb);
    g.lineTo(a[0] - nx * wa, a[1] - ny * wa);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = 1.2;
    g.stroke();
    // The lit edge, on the side toward the light.
    const s = nx * lx > 0 ? 1 : -1;
    g.strokeStyle = lit;
    g.lineWidth = Math.max(0.8, wa * 0.35);
    g.beginPath();
    g.moveTo(a[0] + s * nx * wa * 0.55, a[1] + s * ny * wa * 0.55);
    g.lineTo(b[0] + s * nx * wb * 0.55, b[1] + s * ny * wb * 0.55);
    g.stroke();
  }
  function joint(g: CanvasRenderingContext2D, p: [number, number], r: number, col: string, dark: string) {
    g.fillStyle = col;
    g.beginPath();
    g.arc(p[0], p[1], r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = dark;
    g.lineWidth = 1;
    g.stroke();
    g.fillStyle = E.lit('#c8a050');
    g.beginPath();
    g.arc(p[0], p[1], r * 0.35, 0, Math.PI * 2);
    g.fill();
  }
  function drawLeg(g: CanvasRenderingContext2D, k: number) {
    const p = pose(k);
    const far = D.legs[k].far;
    const base = E.lit(far ? mix(L.col, '#101018', 0.35) : L.col);
    const dark = E.lit(mix(L.col, '#08060a', 0.6));
    const lit = rgba(E.lit(mix(L.col, '#fff0d8', 0.45)), 0.9);
    const w = L.w;
    // The thigh, hidden mostly under the skirt; the shin with its piston; the long foot-bone with bands.
    limb(g, p.hip, p.knee, w * 1.25, w * 1.05, base, dark, lit);
    limb(g, p.knee, p.hock, w * 0.95, w * 0.7, base, dark, lit);
    const mid: [number, number] = [(p.knee[0] + p.hock[0]) / 2, (p.knee[1] + p.hock[1]) / 2];
    g.strokeStyle = E.lit(far ? '#6a6058' : '#b0a898');
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(p.knee[0] - 6, p.knee[1] + 4);
    g.lineTo(mid[0] - 5, mid[1] + 2);
    g.stroke();
    g.strokeStyle = dark;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(mid[0] - 5, mid[1] + 2);
    g.lineTo(p.hock[0] - 3, p.hock[1] - 2);
    g.stroke();
    limb(g, p.hock, p.foot, w * 0.62, w * 0.5, base, dark, lit);
    const fa = Math.atan2(p.foot[1] - p.hock[1], p.foot[0] - p.hock[0]);
    for (let q = 0.2; q < 0.95; q += 0.15) {
      const x = p.hock[0] + (p.foot[0] - p.hock[0]) * q;
      const y = p.hock[1] + (p.foot[1] - p.hock[1]) * q;
      g.strokeStyle = dark;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x - Math.sin(fa) * -w * 0.55, y + Math.cos(fa) * -w * 0.55);
      g.lineTo(x + Math.sin(fa) * -w * 0.55, y - Math.cos(fa) * -w * 0.55);
      g.stroke();
    }
    joint(g, p.knee, w * 1.0, base, dark);
    joint(g, p.hock, w * 0.75, base, dark);
    // Three toes forward, a spur behind; curled when the foot is up.
    const [fx, fy] = p.foot;
    const ground = fy + 9;
    const toes: [number, number, number][] = [[0.05, L.toe, 1], [-0.32, L.toe * 0.8, 0.85], [0.42, L.toe * 0.7, 0.85]];
    for (const [ang, len, ww] of toes) {
      const a = ang + p.curl * 0.9;
      const ex = fx + Math.cos(a) * len;
      const ey = Math.min(ground, fy + 4 + Math.sin(a) * len * 0.35 + p.curl * len * 0.5);
      limb(g, [fx, fy + 3], [ex, ey], w * 0.45 * ww, w * 0.22 * ww, base, dark, lit);
      g.fillStyle = E.lit('#2a2224');
      g.beginPath();
      g.moveTo(ex, ey - 2);
      g.lineTo(ex + 5, ey + 1.5 - p.curl * 2);
      g.lineTo(ex, ey + 1.5);
      g.fill();
    }
    limb(g, [fx - 2, fy + 3], [fx - L.toe * 0.45, Math.min(ground, fy + 6 + p.curl * 6)], w * 0.38, w * 0.18, base, dark, lit);
    joint(g, [fx, fy + 3], w * 0.55, base, dark);
    // Tar, after the tar men, on the near leg.
    if (!far && c.marks.tar > 0.02) {
      g.strokeStyle = rgba('#141012', 0.85 * Math.min(1, c.marks.tar * 2));
      g.lineWidth = w * 1.2;
      g.beginPath();
      g.moveTo(p.hock[0], p.hock[1]);
      g.lineTo(p.foot[0], p.foot[1]);
      g.stroke();
      g.fillStyle = rgba('#141012', 0.8 * c.marks.tar);
      for (let q = 0; q < 4; q++) {
        g.beginPath();
        g.ellipse(p.knee[0] + (p.hock[0] - p.knee[0]) * (0.5 + q * 0.14), p.knee[1] + (p.hock[1] - p.knee[1]) * (0.5 + q * 0.14) + 3, 2, 4 + q, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // ---- the live parts -------------------------------------------------------------------------------------
  const night = () => E.night;
  function windowsLit(g: CanvasRenderingContext2D) {
    const lamp = Math.max(0, Math.min(1, (night() - 0.1) / 0.45)) + c.flare * 0.4;
    if (lamp <= 0.02) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const all = [...D.blocks.flatMap((b) => b.wins), ...D.turrets.flatMap((t) => t.wins)];
    for (const [i, wn] of all.entries()) {
      if (wn.lit > 0.78) continue;
      const fl = 0.8 + 0.2 * Math.sin(E.t * (2 + wn.lit * 3) + i);
      const col = wn.lit < 0.15 ? '#ffd890' : wn.lit < 0.5 ? '#ffb860' : '#ff9a50';
      E.glow(wn.x + wn.w / 2, wn.y + wn.h / 2, wn.w * 2.2, col, lamp * 0.55 * fl);
      g.fillStyle = rgba('#ffe4a8', lamp * 0.85 * fl);
      g.fillRect(wn.x + 0.6, wn.y + wn.w * 0.3, wn.w - 1.2, wn.h - wn.w * 0.3 - 0.6);
    }
    // The portholes and the great eye glow too.
    const f = D.face;
    E.glow(f.eyeX, f.eyeY, f.eyeR * 3, '#ffb860', lamp * 0.6);
    g.fillStyle = rgba('#ffd890', lamp * 0.75);
    g.beginPath();
    g.arc(f.eyeX, f.eyeY, f.eyeR * 0.85, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function hearth(g: CanvasRenderingContext2D) {
    const h = D.hearth;
    const k = 0.35 + night() * 0.5 + c.flare * 0.8;
    const fl = 0.75 + 0.25 * Math.sin(E.t * 7) * Math.sin(E.t * 3.1);
    g.save();
    g.fillStyle = '#2a1a14';
    g.beginPath();
    g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = E.lit('#b8903e');
    g.lineWidth = 1.6;
    g.stroke();
    g.globalCompositeOperation = 'lighter';
    E.glow(h.x, h.y, h.r * (2.2 + c.flare * 2), '#ff7a28', Math.min(1, k * fl));
    // The spirit itself: a little flame with two eyes, peering out.
    const s = h.r * (0.7 + c.flare * 0.3);
    g.fillStyle = rgba('#ffb040', 0.9 * fl);
    g.beginPath();
    g.moveTo(h.x - s * 0.7, h.y + s * 0.6);
    g.quadraticCurveTo(h.x - s, h.y - s * 0.2, h.x - s * 0.2 + Math.sin(E.t * 5) * s * 0.2, h.y - s * 1.1);
    g.quadraticCurveTo(h.x + s * 0.2, h.y - s * 0.5, h.x + s * 0.4 + Math.sin(E.t * 6) * s * 0.15, h.y - s * 0.9);
    g.quadraticCurveTo(h.x + s, h.y - s * 0.1, h.x + s * 0.7, h.y + s * 0.6);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#3a1a10';
    g.beginPath();
    g.arc(h.x - s * 0.25, h.y + s * 0.05, s * 0.13, 0, Math.PI * 2);
    g.arc(h.x + s * 0.25, h.y + s * 0.05, s * 0.13, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  /** What the door opens on, small and bright in the doorway. */
  function glimpse(g: CanvasRenderingContext2D, kind: string, x: number, y: number, w: number, h: number) {
    if (kind === 'port') {
      const sk = g.createLinearGradient(0, y, 0, y + h);
      sk.addColorStop(0, '#6aa8e8');
      sk.addColorStop(0.55, '#cfe4f4');
      sk.addColorStop(0.56, '#3a78b0');
      sk.addColorStop(1, '#2a5a8a');
      g.fillStyle = sk;
      g.fillRect(x, y, w, h);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = ['#f4ece0', '#e8d8c0', '#f8f0e8', '#e0c8b0'][k];
        const hx = x + k * w * 0.26;
        g.fillRect(hx, y + h * 0.36, w * 0.22, h * 0.2);
        g.fillStyle = ['#c0503a', '#4a5a7a', '#c86a4a', '#5a6a8a'][k];
        g.beginPath();
        g.moveTo(hx - 1, y + h * 0.36);
        g.lineTo(hx + w * 0.11, y + h * 0.26);
        g.lineTo(hx + w * 0.23, y + h * 0.36);
        g.fill();
      }
      g.strokeStyle = '#5a3a2a';
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x + w * 0.7, y + h * 0.56);
      g.lineTo(x + w * 0.7, y + h * 0.12);
      g.stroke();
      g.fillStyle = '#f8f4ea';
      g.beginPath();
      g.moveTo(x + w * 0.71, y + h * 0.14);
      g.lineTo(x + w * 0.92, y + h * 0.48);
      g.lineTo(x + w * 0.71, y + h * 0.48);
      g.fill();
      g.strokeStyle = rgba('#ffffff', 0.6);
      g.beginPath();
      g.moveTo(x, y + h * (0.7 + Math.sin(E.t * 2) * 0.02));
      g.lineTo(x + w, y + h * 0.7);
      g.stroke();
    } else if (kind === 'royal') {
      const sk = g.createLinearGradient(0, y, 0, y + h);
      sk.addColorStop(0, '#f0d8a0');
      sk.addColorStop(1, '#fff4e0');
      g.fillStyle = sk;
      g.fillRect(x, y, w, h);
      g.fillStyle = '#f4f0e8';
      g.fillRect(x + w * 0.1, y + h * 0.45, w * 0.8, h * 0.55);
      for (const [q, s] of [[0.25, 0.14], [0.5, 0.2], [0.75, 0.14]] as const) {
        g.fillStyle = '#f8f4ec';
        g.fillRect(x + w * (q - s / 2), y + h * 0.25, w * s, h * 0.3);
        g.fillStyle = '#e0b040';
        g.beginPath();
        g.ellipse(x + w * q, y + h * 0.25, w * s * 0.6, h * 0.08, 0, Math.PI, 0);
        g.fill();
        g.fillRect(x + w * q - 0.3, y + h * 0.1, 0.6, h * 0.08);
      }
      g.fillStyle = '#a8b8c8';
      for (let k = 0; k < 5; k++) g.fillRect(x + w * (0.15 + k * 0.16), y + h * 0.55, w * 0.06, h * 0.12);
    } else if (kind === 'war') {
      g.fillStyle = '#140c14';
      g.fillRect(x, y, w, h);
      const fire = g.createLinearGradient(0, y + h * 0.4, 0, y + h);
      fire.addColorStop(0, 'rgba(255,90,30,0)');
      fire.addColorStop(1, 'rgba(255,110,40,0.8)');
      g.fillStyle = fire;
      g.fillRect(x, y, w, h);
      g.fillStyle = '#0a0608';
      for (let k = 0; k < 5; k++) {
        const hh = h * (0.25 + hash(k, 3) * 0.3);
        g.fillRect(x + k * w * 0.2, y + h - hh, w * 0.18, hh);
      }
      g.strokeStyle = 'rgba(230,236,255,0.35)';
      g.lineWidth = 1.2;
      const a = Math.sin(E.t * 0.7) * 0.4;
      g.beginPath();
      g.moveTo(x + w * 0.4, y + h);
      g.lineTo(x + w * 0.4 + Math.sin(a) * h, y);
      g.stroke();
      E.glow(x + w * (0.3 + Math.sin(E.t * 3) * 0.1), y + h * 0.75, w * 0.5, '#ff8030', 0.5);
    } else {
      const sk = g.createLinearGradient(0, y, 0, y + h);
      sk.addColorStop(0, '#5a9ae0');
      sk.addColorStop(0.5, '#c8e0f0');
      sk.addColorStop(0.51, '#7ab84a');
      sk.addColorStop(1, '#5a9a3a');
      g.fillStyle = sk;
      g.fillRect(x, y, w, h);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = ['#f8e050', '#ffffff', '#f080a0', '#c090f0'][k % 4];
        g.fillRect(x + hash(k, 1) * w, y + h * (0.55 + hash(k, 2) * 0.45), 1.3, 1.3);
      }
    }
  }
  function doorway(g: CanvasRenderingContext2D) {
    const d = D.door;
    const st = c.door;
    const open = st.open;
    const p = world.places[st.place];
    if (open > 0.01) {
      g.save();
      g.beginPath();
      g.rect(d.x, d.y, d.w, d.h);
      g.clip();
      glimpse(g, p.kind, d.x, d.y, d.w, d.h);
      // Someone in the doorway, against the light of the other place.
      const m = world.household.find((q) => q.id === st.who);
      if (m && open > 0.6 && E.t - st.t0 < 4) figure(g, m, d.x + d.w * 0.5, d.y + d.h, 1.1, true);
      g.restore();
      if (p.kind === 'war' || night() > 0.4) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        E.glow(d.x + d.w / 2, d.y + d.h * 0.6, d.w * 1.8, p.kind === 'war' ? '#ff7030' : '#ffd8a0', 0.35 * open);
        g.restore();
      }
    }
    // The door leaf, swinging on its hinge.
    const w = d.w * Math.cos(open * 1.25);
    g.fillStyle = E.lit('#6a4a32');
    g.fillRect(d.x, d.y, Math.max(1.5, w), d.h);
    g.strokeStyle = E.lit('#2a1e16');
    g.lineWidth = 0.7;
    g.strokeRect(d.x, d.y, Math.max(1.5, w), d.h);
    if (w > 6) {
      g.beginPath();
      for (let q = 0.33; q < 1; q += 0.33) {
        g.moveTo(d.x + w * q, d.y + 2);
        g.lineTo(d.x + w * q, d.y + d.h - 1);
      }
      g.stroke();
      g.fillStyle = E.lit('#c8a050');
      g.beginPath();
      g.arc(d.x + w * 0.85, d.y + d.h * 0.55, 1.2, 0, Math.PI * 2);
      g.fill();
    }
    // The dial: four colours and a needle that swings to the one chosen.
    const dl = D.dial;
    for (let k = 0; k < 4; k++) {
      g.fillStyle = E.lit(world.places[k].col);
      g.beginPath();
      g.moveTo(dl.x, dl.y);
      g.arc(dl.x, dl.y, dl.r, -Math.PI / 2 + (k * Math.PI) / 2 - Math.PI / 4, -Math.PI / 2 + ((k + 1) * Math.PI) / 2 - Math.PI / 4);
      g.closePath();
      g.fill();
    }
    const ang = (k: number) => -Math.PI / 2 + (k * Math.PI) / 2;
    let a = ang(st.place);
    if (st.state === 'turning') {
      const q = Math.min(1, (E.t - st.t0) / 1.6);
      let from = ang(st.dial);
      if (from > a) from -= Math.PI * 2;
      const e = 1 - Math.pow(1 - q, 3);
      a = from + (a - from) * e + Math.sin(q * 14) * (1 - q) * 0.25;
    }
    g.strokeStyle = E.lit('#1a1410');
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(dl.x, dl.y);
    g.lineTo(dl.x + Math.cos(a) * dl.r * 1.05, dl.y + Math.sin(a) * dl.r * 1.05);
    g.stroke();
    g.fillStyle = E.lit('#c8a050');
    g.beginPath();
    g.arc(dl.x, dl.y, 1.4, 0, Math.PI * 2);
    g.fill();
  }
  function figure(g: CanvasRenderingContext2D, m: Member, x: number, y: number, s: number, silhouette = false) {
    const h = (m.role === 'apprentice' ? 11 : m.role === 'wizard' ? 15 : 12.5) * s;
    const sway = Math.sin(E.t * 1.3 + m.seed) * 0.6;
    const col = (c0: string) => (silhouette ? '#1a1418' : E.lit(c0));
    const coat = m.coat;
    // Body.
    g.fillStyle = col(coat);
    g.beginPath();
    g.moveTo(x - h * 0.2, y);
    g.lineTo(x - h * 0.13 + sway * 0.2, y - h * 0.68);
    g.lineTo(x + h * 0.13 + sway * 0.2, y - h * 0.68);
    g.lineTo(x + h * 0.2, y);
    g.fill();
    if (m.role === 'keeper' && !silhouette) {
      g.fillStyle = E.lit('#ece4d4');
      g.fillRect(x - h * 0.1, y - h * 0.55, h * 0.2, h * 0.5);
    }
    if (m.role === 'wizard' && !silhouette) {
      // A flamboyant jacket over the waistcoat, and the long coat's tails in the wind.
      g.fillStyle = E.lit(m.accent);
      g.fillRect(x - h * 0.07, y - h * 0.66, h * 0.14, h * 0.4);
      const flap = Math.sin(E.t * 4 + m.seed) * h * 0.06 + (world.wind * c.dir) / (30 * world.u) * h * 0.08;
      g.fillStyle = col(coat);
      g.beginPath();
      g.moveTo(x - h * 0.2, y - h * 0.3);
      g.quadraticCurveTo(x - h * 0.35 - flap, y - h * 0.1, x - h * 0.3 - flap * 1.6, y + h * 0.02);
      g.lineTo(x - h * 0.12, y);
      g.fill();
    }
    // Head and hair.
    g.fillStyle = col('#f0c8a8');
    g.beginPath();
    g.arc(x + sway * 0.25, y - h * 0.8, h * 0.13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col(m.hair);
    g.beginPath();
    g.arc(x + sway * 0.25, y - h * 0.84, h * 0.13, Math.PI, 0);
    g.fill();
    if (m.role === 'apprentice') g.fillRect(x - h * 0.15, y - h * 0.93, h * 0.3, h * 0.06);
    // Arms, by what they are doing.
    g.strokeStyle = col(coat);
    g.lineWidth = h * 0.08;
    g.lineCap = 'round';
    const t = E.t + m.seed;
    g.beginPath();
    if (m.act === 'wash' || m.act === 'wave') {
      const up = m.act === 'wave' ? Math.sin(t * 6) * 0.3 : Math.sin(t * 1.5) * 0.15;
      g.moveTo(x + h * 0.1, y - h * 0.62);
      g.lineTo(x + h * (0.28 + up * 0.3), y - h * (1.0 + up * 0.2));
      g.moveTo(x - h * 0.1, y - h * 0.62);
      g.lineTo(x - h * 0.22, y - h * (m.act === 'wash' ? 0.98 : 0.35));
    } else if (m.act === 'spyglass') {
      g.moveTo(x + h * 0.1, y - h * 0.62);
      g.lineTo(x + h * 0.32, y - h * 0.78);
      g.stroke();
      g.strokeStyle = col('#b8903e');
      g.lineWidth = h * 0.09;
      g.beginPath();
      g.moveTo(x + h * 0.12, y - h * 0.8);
      g.lineTo(x + h * 0.55, y - h * 0.86);
    } else if (m.act === 'sweep' || m.act === 'beat') {
      const sw = Math.sin(t * 4) * 0.3;
      g.moveTo(x + h * 0.1, y - h * 0.6);
      g.lineTo(x + h * (0.3 + sw * 0.3), y - h * 0.35);
      g.stroke();
      g.strokeStyle = col('#8a6a3a');
      g.lineWidth = h * 0.05;
      g.beginPath();
      g.moveTo(x + h * (0.3 + sw * 0.3), y - h * 0.35);
      g.lineTo(x + h * (0.45 + sw * 0.6), y);
    } else {
      g.moveTo(x + h * 0.12, y - h * 0.62);
      g.lineTo(x + h * 0.18, y - h * 0.32);
      g.moveTo(x - h * 0.12, y - h * 0.62);
      g.lineTo(x - h * 0.18, y - h * 0.32);
    }
    g.stroke();
  }
  function household(g: CanvasRenderingContext2D) {
    for (const m of world.household) {
      if (m.role === 'spirit' || (m.where !== 'balcony' && m.where !== 'deck' && m.where !== 'head')) continue;
      let x = 0;
      let y = 0;
      if (m.where === 'head') {
        x = D.face.cx - D.face.r * 0.15;
        y = D.face.cy - D.face.r * 0.98;
      } else if (m.where === 'balcony' && D.balconies.length) {
        const b = D.balconies[m.spot % D.balconies.length];
        x = b.x + b.w * (0.3 + (m.id % 3) * 0.2);
        y = b.y;
      } else {
        const back = Math.min(...D.hull.map((p) => p[0]));
        x = back + 28 + (m.id % 3) * 14;
        y = D.deck(x) - 1;
      }
      figure(g, m, x, y, 1.4);
    }
  }
  function flagsAndWashing(g: CanvasRenderingContext2D) {
    const wind = Math.max(-1.5, Math.min(1.5, (world.wind * c.dir - c.speed * 0.6) / (30 * world.u)));
    for (const f of D.flags) {
      g.strokeStyle = E.lit('#3a2a22');
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(f.x, f.y);
      g.lineTo(f.x, f.y - f.h);
      g.stroke();
      g.fillStyle = E.lit(f.col);
      g.beginPath();
      const len = 12 + f.h * 0.3;
      g.moveTo(f.x, f.y - f.h);
      for (let q = 0; q <= 1.001; q += 0.25) g.lineTo(f.x + wind * len * q, f.y - f.h + Math.sin(E.t * 6 + q * 4 + f.seed) * 1.6 * q + q * 1.5);
      for (let q = 1; q >= 0; q -= 0.25) g.lineTo(f.x + wind * len * q * 0.92, f.y - f.h + 6 + Math.sin(E.t * 6 + q * 4 + f.seed + 0.5) * 1.6 * q - q * 1.5);
      g.closePath();
      g.fill();
    }
    if (!c.washing) return;
    for (const ln of D.lines) {
      const sag = 8;
      const pt = (k: number): [number, number] => [ln.x0 + (ln.x1 - ln.x0) * k, ln.y0 + (ln.y1 - ln.y0) * k + Math.sin(k * Math.PI) * sag];
      g.strokeStyle = E.lit('#5a4a40');
      g.lineWidth = 0.5;
      g.beginPath();
      for (let k = 0; k <= 1.001; k += 0.1) {
        const [x, y] = pt(k);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      for (const it of ln.items) {
        const [x, y] = pt(it.k);
        const sw = wind * 0.5 + Math.sin(E.t * 3 + it.k * 9) * 0.12;
        g.save();
        g.translate(x, y);
        g.transform(1, 0, sw, 1, 0, 0);
        g.fillStyle = E.lit(it.col);
        if (it.kind === 'shirt') {
          g.fillRect(-it.w / 2, 0, it.w, it.h * 0.8);
          g.fillRect(-it.w * 0.8, 0, it.w * 1.6, it.h * 0.3);
        } else if (it.kind === 'dress') {
          g.beginPath();
          g.moveTo(-it.w * 0.3, 0);
          g.lineTo(it.w * 0.3, 0);
          g.lineTo(it.w * 0.6, it.h);
          g.lineTo(-it.w * 0.6, it.h);
          g.fill();
        } else if (it.kind === 'sock') g.fillRect(-1.2, 0, 2.4, it.h * 0.5);
        else g.fillRect(-it.w / 2, 0, it.w, it.h);
        g.fillStyle = rgba('#000000', 0.15);
        g.fillRect(lx > 0 ? -it.w / 2 : it.w * 0.2, 0, it.w * 0.3, it.h * 0.8);
        g.restore();
      }
    }
  }
  function millSails(g: CanvasRenderingContext2D) {
    const m = D.mill;
    if (!m) return;
    const a0 = E.t * (0.5 + Math.abs(world.wind) / (40 * world.u));
    g.save();
    g.translate(m.x, m.y + 2);
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      g.save();
      g.rotate(a);
      g.strokeStyle = E.lit('#4a3424');
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(m.r, 0);
      g.stroke();
      g.fillStyle = E.lit('#e8dcc4');
      g.fillRect(m.r * 0.2, 0, m.r * 0.8, m.r * 0.22);
      g.strokeStyle = E.lit('#6a5440');
      g.lineWidth = 0.4;
      for (let q = 0.3; q < 1; q += 0.14) {
        g.beginPath();
        g.moveTo(m.r * q, 0);
        g.lineTo(m.r * q, m.r * 0.22);
        g.stroke();
      }
      g.restore();
    }
    g.fillStyle = E.lit('#3a2a1e');
    g.beginPath();
    g.arc(0, 0, 2.4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  function wheel(g: CanvasRenderingContext2D) {
    const w = D.rear.wheel;
    if (!w) return;
    const a = -c.phase * Math.PI * 4 * c.dir * 0 - (world.X / (w.r * c.cs)) * 0.5;
    g.save();
    g.translate(w.x, w.y);
    g.strokeStyle = E.lit('#4a3a2e');
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, w.r, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1.2;
    for (let k = 0; k < 8; k++) {
      const q = a + (k * Math.PI) / 4;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(q) * w.r, Math.sin(q) * w.r);
      g.stroke();
      g.fillStyle = E.lit('#7a5a3e');
      g.save();
      g.translate(Math.cos(q) * w.r, Math.sin(q) * w.r);
      g.rotate(q);
      g.fillRect(-1, -4, 6, 8);
      g.restore();
    }
    g.fillStyle = E.lit('#b8903e');
    g.beginPath();
    g.arc(0, 0, 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  /** What the road has left on it: scorch and patches, soot, window boxes in flower, bunting. */
  function marks(g: CanvasRenderingContext2D) {
    const mk2 = c.marks;
    for (let k = 0; k < mk2.scorch; k++) {
      const b = D.blocks[k % D.blocks.length];
      if (!b) break;
      const x = b.x + b.w * (0.2 + hash(D.seed, k) * 0.6);
      const y = b.y + b.h * (0.3 + hash(D.seed, k, 2) * 0.5);
      g.fillStyle = rgba('#100a0a', 0.55);
      g.beginPath();
      g.ellipse(x, y, 7, 5, 0.3, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba('#000000', 0.8);
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    for (let k = 0; k < mk2.patches; k++) {
      const b = D.blocks[(k + 2) % D.blocks.length];
      if (!b) break;
      const x = b.x + b.w * (0.15 + hash(D.seed, k, 5) * 0.55);
      const y = b.y + b.h * (0.25 + hash(D.seed, k, 6) * 0.45);
      g.fillStyle = E.lit(k % 2 ? '#a8b0b8' : '#c8925a');
      g.fillRect(x, y, 9, 7);
      g.strokeStyle = E.lit('#3a2a22');
      g.lineWidth = 0.6;
      g.strokeRect(x, y, 9, 7);
      g.fillStyle = E.lit('#ece4d4');
      for (const [px, py] of [[1, 1], [7.5, 1], [1, 5.5], [7.5, 5.5]]) g.fillRect(x + px, y + py, 0.9, 0.9);
    }
    if (mk2.soot > 0.02) {
      for (const ch of D.chimneys) {
        const gr = g.createLinearGradient(0, ch.y, 0, ch.y + 40);
        gr.addColorStop(0, rgba('#0a0808', 0.5 * mk2.soot));
        gr.addColorStop(1, rgba('#0a0808', 0));
        g.fillStyle = gr;
        g.fillRect(ch.x - 4, ch.y, ch.w + 8, 40);
      }
    }
    if (mk2.flowers > 0) {
      const wins = D.blocks.flatMap((b) => b.wins.filter((w) => !w.round)).slice(0, 10);
      for (const [i, wn] of wins.entries()) {
        g.fillStyle = E.lit('#7a5a3a');
        g.fillRect(wn.x - 1.5, wn.y + wn.h + 1, wn.w + 3, 2.4);
        for (let q = 0; q < 4; q++) {
          g.fillStyle = E.lit(q % 2 ? '#5a8a3a' : ['#f05a7a', '#f8e050', '#ffffff', '#c080f0'][(i + q) % 4]);
          g.beginPath();
          g.arc(wn.x + (q + 0.5) * (wn.w / 4), wn.y + wn.h + 0.5 - (q % 2), 1.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    if (mk2.bunting > 0 && D.turrets.length > 1) {
      const a = D.turrets[0];
      const b = D.turrets[D.turrets.length - 1];
      const x0 = Math.min(a.x, b.x);
      const x1 = Math.max(a.x, b.x) + 60;
      const y0 = Math.min(a.y, b.y) + 20;
      g.strokeStyle = E.lit('#4a3a30');
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, y0 + 26, x1, y0 + 30);
      g.stroke();
      const n = Math.floor((x1 - x0) / 6);
      for (let k = 0; k < n; k++) {
        const q = (k + 0.5) / n;
        const x = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * ((x0 + x1) / 2) + q * q * x1;
        const y = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * (y0 + 26) + q * q * (y0 + 30);
        g.fillStyle = E.lit(['#e84a3a', '#f8d040', '#4a8ae0', '#ffffff', '#5ab05a'][k % 5]);
        g.beginPath();
        g.moveTo(x - 2.2, y);
        g.lineTo(x + 2.2, y);
        g.lineTo(x + Math.sin(E.t * 4 + k) * 0.8, y + 5);
        g.fill();
      }
    }
  }

  function draw(ctx: CanvasRenderingContext2D) {
    if (!body) bake();
    const key = E.L.amb;
    if (key !== stamp) {
      stamp = key;
      const o = out!.getContext('2d')!;
      o.globalCompositeOperation = 'copy';
      o.drawImage(body!, 0, 0);
      o.globalCompositeOperation = 'multiply';
      o.fillStyle = E.L.amb;
      o.fillRect(0, 0, out!.width, out!.height);
      o.globalCompositeOperation = 'destination-in';
      o.drawImage(body!, 0, 0);
      o.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.tilt);
    ctx.scale(c.dir * c.cs, c.cs);
    ctx.lineJoin = 'round';
    for (let k = 0; k < D.legs.length; k++) if (D.legs[k].far) drawLeg(ctx, k);
    wheel(ctx);
    ctx.drawImage(out!, minX, minY, maxX - minX, maxY - minY);
    marks(ctx);
    hearth(ctx);
    windowsLit(ctx);
    doorway(ctx);
    household(ctx);
    flagsAndWashing(ctx);
    millSails(ctx);
    for (let k = 0; k < D.legs.length; k++) if (!D.legs[k].far) drawLeg(ctx, k);
    ctx.restore();
  }
  /** Its shadow on the hill, cast away from the sun. */
  function shadow(ctx: CanvasRenderingContext2D) {
    const sun = (1 - E.night) * (1 - E.storm * 0.8);
    if (sun < 0.05) return;
    const y = world.land.nearY(world.X) + 6 * world.u;
    const x = c.x - world.sunSide * 60 * c.cs;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 210 * c.cs);
    g.addColorStop(0, `rgba(20,30,20,${(0.32 * sun).toFixed(3)})`);
    g.addColorStop(1, 'rgba(20,30,20,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.14);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - 220 * c.cs, y - 220 * c.cs, 440 * c.cs, 440 * c.cs);
    ctx.restore();
  }
  return { draw, shadow };
}
