/**
 * The things that move in the country, and the marks left in it: sheep, rooks, geese, gulls,
 * swallows and starlings; the war's bat-winged bombers and its little flapping gunboats; the tar
 * men; people on the road with a handcart and a goat; another walking house on hen's legs; and
 * what stays behind: a town in ruins, a wreck on a hillside, a tree struck black, tar in the
 * grass, puddles after rain. All lit by the hour (`E.lit`) and smaller and hazier when far.
 */
import { hash } from './land';
import { mix, rgba, type Env } from './sky';
import type { Flock, Sheep, Ship, TarMan, Walker } from './types';


export function drawSheep(E: Env, sh: Sheep, x: number, y: number, s: number, lx: number, haze: number) {
  const g = E.ctx;
  const H = (c: string) => E.lit(mix(c, '#b8cee4', haze));
  const wool = H(sh.black ? '#3a3434' : '#f2ede2');
  const woolSh = H(sh.black ? '#1a1616' : '#b8b2a8');
  const face = H(sh.black ? '#141010' : '#2a2422');
  const sc = s * (sh.lamb ? 0.65 : 1);
  if (sc < 2.2) {
    g.fillStyle = wool;
    g.fillRect(x - sc, y - sc * 0.9, sc * 2, sc * 0.9);
    return;
  }
  const d = sh.dir;
  const graze = sh.state === 'graze' ? 0.5 + 0.5 * Math.sin(E.t * 0.6 + sh.seed) : 0;
  const step = sh.state === 'graze' ? 0 : Math.sin(sh.ph);
  // Legs.
  g.strokeStyle = face;
  g.lineWidth = Math.max(0.6, sc * 0.12);
  g.beginPath();
  for (const [lx0, ph] of [[-0.45, 0], [-0.25, Math.PI], [0.3, Math.PI], [0.5, 0]] as const) {
    const sw = step * 0.18 * Math.sin(ph + 1);
    g.moveTo(x + lx0 * sc * d, y - sc * 0.35);
    g.lineTo(x + (lx0 + sw) * sc * d, y);
  }
  g.stroke();
  // The fleece: puffs, shaded away from the light.
  const puffs: [number, number, number][] = [[-0.45, -0.62, 0.32], [-0.12, -0.75, 0.38], [0.22, -0.7, 0.34], [0.45, -0.58, 0.28], [-0.2, -0.48, 0.34], [0.15, -0.46, 0.34]];
  g.fillStyle = woolSh;
  for (const [px, py, pr] of puffs) {
    g.beginPath();
    g.arc(x + px * sc * d, y + py * sc + sc * 0.06, pr * sc, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = wool;
  for (const [px, py, pr] of puffs) {
    g.beginPath();
    g.arc(x + px * sc * d + lx * pr * sc * 0.15, y + py * sc - sc * 0.03, pr * sc * 0.85, 0, Math.PI * 2);
    g.fill();
  }
  // The head, down to the grass or up.
  const hx = x + 0.68 * sc * d;
  const hy = y - sc * (0.62 - graze * 0.42);
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(hx, hy, sc * 0.17, sc * 0.13, d * (0.5 + graze * 0.6), 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(hx - 0.06 * sc * d, hy - sc * 0.08, sc * 0.1, sc * 0.04, d * -0.4, 0, Math.PI * 2);
  g.fill();
}

export function drawFlock(E: Env, f: Flock, lx: number) {
  const g = E.ctx;
  const u = E.u;
  const col = E.lit(f.kind === 'gulls' ? '#f4f2ee' : f.kind === 'geese' ? '#4a4440' : '#1e1a1c');
  const wing = E.lit(f.kind === 'gulls' ? '#c8ccd4' : '#141014');
  for (const b of f.birds) {
    const x = f.x + b.x + b.dx;
    const y = f.y + b.y + b.dy;
    const s = (f.kind === 'geese' ? 7 : f.kind === 'gulls' ? 6.5 : f.kind === 'starlings' ? 2.6 : f.kind === 'swallows' ? 5 : 5) * u * f.m;
    const flap = Math.sin(b.ph);
    if (s < 1.6) {
      g.fillStyle = col;
      g.fillRect(x - s, y + flap * s * 0.3, s * 2, Math.max(0.8, s * 0.4));
      continue;
    }
    const d = f.vx > 0 ? 1 : -1;
    g.strokeStyle = wing;
    g.lineWidth = Math.max(0.7, s * 0.22);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - s * 1.1, y - flap * s * 0.7);
    g.quadraticCurveTo(x - s * 0.45, y - s * 0.25 - flap * s * 0.3, x, y);
    g.quadraticCurveTo(x + s * 0.45, y - s * 0.25 - flap * s * 0.3, x + s * 1.1, y - flap * s * 0.7);
    g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x + d * s * 0.15, y + s * 0.05, s * (f.kind === 'swallows' ? 0.5 : 0.45), s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    if (f.kind === 'geese') {
      g.strokeStyle = col;
      g.lineWidth = s * 0.14;
      g.beginPath();
      g.moveTo(x + d * s * 0.5, y);
      g.lineTo(x + d * s * 1.0, y - s * 0.08);
      g.stroke();
    }
    if (f.kind === 'swallows') {
      g.strokeStyle = col;
      g.lineWidth = s * 0.1;
      g.beginPath();
      g.moveTo(x - d * s * 0.4, y);
      g.lineTo(x - d * s * 0.9, y + s * 0.2);
      g.moveTo(x - d * s * 0.4, y);
      g.lineTo(x - d * s * 0.85, y - s * 0.1);
      g.stroke();
    }
    void lx;
  }
}

/** A bomber of the war: a fat armoured hull with fins and a gondola, and great bat wings that row slowly. */
export function drawBomber(E: Env, sh: Ship, x: number, y: number, s: number, haze: number, lx: number) {
  const g = E.ctx;
  const H = (c: string) => E.lit(mix(c, '#b8cee4', haze));
  const d = sh.dir;
  const L = 110 * s;
  const Hh = 30 * s;
  const hull = H(sh.side ? '#6a6a4a' : '#4a4a56');
  const dark = H(sh.side ? '#3a3a28' : '#24242e');
  const lit = H(sh.side ? '#9a9a70' : '#7a7a8a');
  const band = H(sh.side ? '#3a5a8a' : '#8a2a2a');
  const flap = Math.sin(sh.beat);
  g.save();
  g.translate(x, y);
  g.scale(d, 1);
  // The far wing, then the hull, then the near wing.
  const wing = (front: boolean) => {
    const up = flap * (front ? 1 : 0.85);
    const root: [number, number] = [-L * 0.05, -Hh * 0.2];
    const tipY = -Hh * (1.4 + up * 1.2);
    g.fillStyle = front ? H(sh.side ? '#5a5a3a' : '#3a3440') : dark;
    g.beginPath();
    g.moveTo(root[0] + L * 0.2, root[1]);
    g.lineTo(L * 0.05, tipY);
    g.lineTo(-L * 0.1, tipY - Hh * 0.3);
    // The membrane's scalloped trailing edge between the fingers.
    for (let k = 0; k <= 4; k++) {
      const q = k / 4;
      const fx = -L * 0.1 - q * L * 0.5;
      const fy = tipY * (1 - q * 0.75) - Hh * 0.3 * (1 - q);
      g.quadraticCurveTo(fx + L * 0.06, fy + Hh * 0.5, fx, fy);
    }
    g.lineTo(root[0] - L * 0.25, root[1]);
    g.closePath();
    g.fill();
    g.strokeStyle = front ? lit : dark;
    g.lineWidth = Math.max(0.6, 1.2 * s);
    g.beginPath();
    for (let k = 0; k <= 4; k++) {
      const q = k / 4;
      g.moveTo(root[0], root[1]);
      g.lineTo(-L * 0.1 - q * L * 0.5, tipY * (1 - q * 0.75) - Hh * 0.3 * (1 - q));
    }
    g.stroke();
  };
  wing(false);
  // Hull.
  g.beginPath();
  g.moveTo(L * 0.55, 0);
  g.bezierCurveTo(L * 0.5, -Hh * 0.75, -L * 0.2, -Hh * 0.75, -L * 0.5, -Hh * 0.2);
  g.lineTo(-L * 0.56, Hh * 0.1);
  g.bezierCurveTo(-L * 0.2, Hh * 0.65, L * 0.45, Hh * 0.6, L * 0.55, 0);
  const hg = g.createLinearGradient(0, -Hh * 0.7, 0, Hh * 0.6);
  hg.addColorStop(0, lit);
  hg.addColorStop(0.45, hull);
  hg.addColorStop(1, dark);
  g.fillStyle = hg;
  g.fill();
  g.strokeStyle = H('#14121a');
  g.lineWidth = Math.max(0.6, s);
  g.stroke();
  g.save();
  g.clip();
  g.strokeStyle = rgba(H('#14121a'), 0.5);
  g.lineWidth = Math.max(0.4, 0.7 * s);
  for (let k = -4; k <= 4; k++) {
    g.beginPath();
    g.moveTo(k * L * 0.11, -Hh);
    g.lineTo(k * L * 0.11 + L * 0.02, Hh);
    g.stroke();
  }
  g.fillStyle = band;
  g.fillRect(-L * 0.08, -Hh, L * 0.06, Hh * 2);
  g.restore();
  // Tail fins, a gondola with portholes, gun turrets, propellers spinning.
  g.fillStyle = dark;
  g.beginPath();
  g.moveTo(-L * 0.45, -Hh * 0.2);
  g.lineTo(-L * 0.68, -Hh * 0.75);
  g.lineTo(-L * 0.6, Hh * 0.05);
  g.fill();
  g.beginPath();
  g.moveTo(-L * 0.45, Hh * 0.1);
  g.lineTo(-L * 0.66, Hh * 0.5);
  g.lineTo(-L * 0.56, Hh * 0.15);
  g.fill();
  g.fillStyle = hull;
  g.beginPath();
  g.roundRect(-L * 0.18, Hh * 0.42, L * 0.36, Hh * 0.32, Hh * 0.12);
  g.fill();
  g.fillStyle = E.night > 0.4 ? rgba('#ffc070', 0.9) : H('#1a1820');
  for (let k = 0; k < 5; k++) g.fillRect(-L * 0.15 + k * L * 0.065, Hh * 0.52, L * 0.025, Hh * 0.1);
  for (const px of [-L * 0.28, L * 0.08]) {
    g.fillStyle = dark;
    g.fillRect(px, Hh * 0.35, L * 0.04, Hh * 0.2);
    const sp = Math.sin(E.t * 40 + px);
    g.fillStyle = rgba(H('#c8c8c8'), 0.5);
    g.beginPath();
    g.ellipse(px + L * 0.02, Hh * 0.62, Math.max(0.5, Math.abs(sp) * L * 0.05), Hh * 0.05, 0, 0, Math.PI * 2);
    g.fill();
  }
  wing(true);
  g.restore();
  void lx;
}

/** A flying gunboat: a little armoured boat with a pilot, and several pairs of wings beating fast. */
export function drawGunboat(E: Env, sh: Ship, x: number, y: number, s: number, haze: number) {
  const g = E.ctx;
  const H = (c: string) => E.lit(mix(c, '#b8cee4', haze));
  const d = sh.dir;
  const L = 34 * s;
  const hull = H(sh.side ? '#7a7448' : '#5a4e56');
  const dark = H(sh.side ? '#3a3622' : '#2a2228');
  const mark = H(sh.side ? '#3a6aa8' : '#a83a2e');
  g.save();
  g.translate(x, y);
  g.scale(d, 1);
  if (sh.state === 'fall') g.rotate(0.6 * Math.min(1, (E.t - sh.t0) * 0.5));
  const wings = (front: boolean) => {
    for (let k = 0; k < 3; k++) {
      const f = Math.sin(sh.beat * 1.6 + k * 0.8 + (front ? 0 : 1.2));
      const wx = -L * 0.3 + k * L * 0.28;
      g.fillStyle = front ? rgba(H('#d8d8e0'), 0.7) : rgba(H('#8a8a98'), 0.6);
      g.beginPath();
      g.ellipse(wx, -L * 0.2 - f * L * 0.25, L * 0.32, L * 0.08, -0.3 - f * 0.6, 0, Math.PI * 2);
      g.fill();
    }
  };
  wings(false);
  g.beginPath();
  g.moveTo(L * 0.6, -L * 0.05);
  g.lineTo(L * 0.3, L * 0.22);
  g.lineTo(-L * 0.5, L * 0.18);
  g.lineTo(-L * 0.6, -L * 0.12);
  g.lineTo(L * 0.4, -L * 0.18);
  g.closePath();
  g.fillStyle = hull;
  g.fill();
  g.strokeStyle = dark;
  g.lineWidth = Math.max(0.5, 0.8 * s);
  g.stroke();
  g.fillStyle = mark;
  g.fillRect(-L * 0.1, -L * 0.15, L * 0.12, L * 0.32);
  // The pilot's hood, the gun at the bow.
  g.fillStyle = dark;
  g.beginPath();
  g.arc(L * 0.05, -L * 0.2, L * 0.1, Math.PI, 0);
  g.fill();
  g.strokeStyle = dark;
  g.lineWidth = Math.max(0.6, 1.2 * s);
  g.beginPath();
  g.moveTo(L * 0.45, -L * 0.05);
  g.lineTo(L * 0.85, -L * 0.08);
  g.stroke();
  wings(true);
  g.restore();
}

export function drawTarMan(E: Env, tm: TarMan, x: number, y: number, s: number) {
  const g = E.ctx;
  const age = E.t - tm.t0;
  const rise = tm.state === 'rise' ? Math.min(1, Math.max(0, age / 2.2)) : tm.state === 'melt' ? Math.max(0, 1 - age / 3) : 1;
  if (rise <= 0.01) {
    g.fillStyle = rgba('#100c0e', 0.8);
    g.beginPath();
    g.ellipse(x, y, s * 0.5, s * 0.1, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  const h = s * 1.6 * rise * tm.size;
  const run = tm.state === 'chase' ? Math.sin(tm.ph) : 0;
  const tar = '#141012';
  const sheen = E.lit('#5a5a6a');
  g.fillStyle = tar;
  // The puddle it stands in, the body like a dripping sack, arms flung out, a hat.
  g.beginPath();
  g.ellipse(x, y, s * 0.55, s * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.4, y);
  g.bezierCurveTo(x - s * 0.5, y - h * 0.5, x - s * 0.3 + run * s * 0.1, y - h * 0.95, x + run * s * 0.1, y - h);
  g.bezierCurveTo(x + s * 0.3 + run * s * 0.1, y - h * 0.95, x + s * 0.5, y - h * 0.5, x + s * 0.4, y);
  g.fill();
  g.strokeStyle = tar;
  g.lineWidth = s * 0.16;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s * 0.25, y - h * 0.65);
  g.lineTo(x - s * (0.6 + run * 0.2), y - h * (0.85 + run * 0.15));
  g.moveTo(x + s * 0.25, y - h * 0.65);
  g.lineTo(x + s * (0.6 - run * 0.2), y - h * (0.8 - run * 0.15));
  g.stroke();
  g.fillRect(x - s * 0.35 + run * s * 0.1, y - h - s * 0.05, s * 0.7, s * 0.07);
  g.fillRect(x - s * 0.2 + run * s * 0.1, y - h - s * 0.35, s * 0.4, s * 0.32);
  // A gleam of the sky on the tar; drips.
  g.strokeStyle = rgba(sheen, 0.6);
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.moveTo(x - s * 0.18, y - h * 0.75);
  g.quadraticCurveTo(x - s * 0.28, y - h * 0.45, x - s * 0.22, y - h * 0.2);
  g.stroke();
  for (let k = 0; k < 3; k++) {
    const dy = ((E.t * 0.8 + hash(tm.seed, k)) % 1) * h * 0.4;
    g.fillStyle = tar;
    g.beginPath();
    g.arc(x + (hash(tm.seed, k, 2) - 0.5) * s * 0.8, y - h * 0.5 + dy, s * 0.06, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawWalker(E: Env, w: Walker, x: number, y: number, s: number) {
  const g = E.ctx;
  const step = Math.sin(w.ph);
  const ink = E.lit('#3a3036');
  if (w.kind === 'cart') {
    g.fillStyle = E.lit('#7a5a3a');
    g.fillRect(x - s * 1.2, y - s * 0.9, s * 1.6, s * 0.5);
    g.fillStyle = E.lit('#c8b898');
    g.beginPath();
    g.ellipse(x - s * 0.4, y - s * 0.95, s * 0.7, s * 0.35, 0, Math.PI, 0);
    g.fill();
    g.strokeStyle = ink;
    g.lineWidth = Math.max(0.6, s * 0.08);
    g.beginPath();
    g.arc(x - s * 0.4, y - s * 0.3, s * 0.3, 0, Math.PI * 2);
    g.moveTo(x + s * 0.4, y - s * 0.6);
    g.lineTo(x + s * 0.9 * w.dir, y - s * 0.8);
    g.stroke();
    return;
  }
  if (w.kind === 'goat') {
    g.fillStyle = E.lit('#e8e0d0');
    g.beginPath();
    g.ellipse(x, y - s * 0.4, s * 0.35, s * 0.18, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = E.lit('#8a7a6a');
    g.lineWidth = Math.max(0.5, s * 0.06);
    g.beginPath();
    g.moveTo(x - s * 0.25, y - s * 0.3);
    g.lineTo(x - s * 0.25 + step * s * 0.06, y);
    g.moveTo(x + s * 0.25, y - s * 0.3);
    g.lineTo(x + s * 0.25 - step * s * 0.06, y);
    g.moveTo(x + s * 0.3 * w.dir, y - s * 0.45);
    g.lineTo(x + s * 0.48 * w.dir, y - s * 0.7);
    g.stroke();
    return;
  }
  const h = s * (w.kind === 'child' ? 0.7 : 1);
  g.fillStyle = E.lit(hash(w.seed, 1) < 0.5 ? '#6a5a7a' : '#7a5a44');
  g.beginPath();
  g.moveTo(x - h * 0.18, y - h * 0.2);
  g.lineTo(x - h * 0.12, y - h * 0.8);
  g.lineTo(x + h * 0.12, y - h * 0.8);
  g.lineTo(x + h * 0.18, y - h * 0.2);
  g.fill();
  g.fillStyle = E.lit('#e0b898');
  g.beginPath();
  g.arc(x, y - h * 0.9, h * 0.11, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = Math.max(0.5, h * 0.07);
  g.beginPath();
  g.moveTo(x - h * 0.06, y - h * 0.22);
  g.lineTo(x - h * 0.06 + step * h * 0.12, y);
  g.moveTo(x + h * 0.06, y - h * 0.22);
  g.lineTo(x + h * 0.06 - step * h * 0.12, y);
  g.stroke();
  if (w.kind === 'walker') {
    g.fillStyle = E.lit('#9a8a6a');
    g.fillRect(x - h * 0.3 * w.dir - h * 0.1, y - h * 0.8, h * 0.22, h * 0.32);
  }
}

/** Another walking house, tiny on the far hills: a thatched cottage on two thin hen's legs. */
export function drawHen(E: Env, x: number, y: number, s: number, t: number, haze: number) {
  const g = E.ctx;
  const H = (c: string) => E.lit(mix(c, '#b8cee4', haze));
  const ph = t * 2.2;
  g.strokeStyle = H('#4a3a30');
  g.lineWidth = Math.max(0.6, s * 0.08);
  for (const o of [0, Math.PI]) {
    const fx = x + Math.sin(ph + o) * s * 0.4;
    const lift = Math.max(0, Math.cos(ph + o)) * s * 0.2;
    g.beginPath();
    g.moveTo(x, y - s * 1.1);
    g.lineTo(x + Math.sin(ph + o) * s * 0.1 - s * 0.2, y - s * 0.55 - lift * 0.5);
    g.lineTo(fx, y - lift);
    g.stroke();
  }
  const by = y - s * 1.1 + Math.abs(Math.sin(ph)) * s * 0.06;
  g.fillStyle = H('#e0d4bc');
  g.fillRect(x - s * 0.5, by - s * 0.6, s, s * 0.6);
  g.fillStyle = H('#b89a58');
  g.beginPath();
  g.moveTo(x - s * 0.65, by - s * 0.55);
  g.quadraticCurveTo(x, by - s * 1.3, x + s * 0.65, by - s * 0.55);
  g.fill();
  g.fillStyle = H('#3a3036');
  g.fillRect(x - s * 0.15, by - s * 0.42, s * 0.2, s * 0.2);
  g.fillStyle = rgba(H('#e8e4dc'), 0.6);
  g.beginPath();
  g.arc(x + s * 0.3, by - s * 1.2 - (t * 4) % (s * 0.6), s * 0.18, 0, Math.PI * 2);
  g.fill();
}

// ---- marks ------------------------------------------------------------------------------------------
export function drawRuin(E: Env, x: number, y: number, s: number, seed: number, haze: number, embers: number) {
  const g = E.ctx;
  const ink = E.lit(mix('#1e1a1c', '#b8cee4', haze * 0.8));
  g.fillStyle = ink;
  for (let k = 0; k < 9; k++) {
    const hx = x + (hash(seed, k) - 0.5) * s * 3;
    const hh = s * (0.25 + hash(seed, k, 2) * 0.45);
    g.beginPath();
    g.moveTo(hx - s * 0.18, y);
    g.lineTo(hx - s * 0.16, y - hh);
    g.lineTo(hx - s * 0.05, y - hh * (0.6 + hash(seed, k, 3) * 0.3));
    g.lineTo(hx + s * 0.06, y - hh * 0.9);
    g.lineTo(hx + s * 0.18, y);
    g.fill();
  }
  g.fillRect(x - s * 0.06, y - s * 1.1, s * 0.12, s * 1.1);
  if (embers > 0.02) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) E.glow(x + (hash(seed, k, 5) - 0.5) * s * 2.6, y - s * 0.1, s * 0.5, '#ff6020', embers * (0.4 + 0.3 * Math.sin(E.t * 3 + k)));
    g.restore();
  }
}
export function drawWreck(E: Env, x: number, y: number, s: number, seed: number, haze: number) {
  const g = E.ctx;
  const ink = E.lit(mix('#2a2428', '#b8cee4', haze));
  g.fillStyle = ink;
  g.save();
  g.translate(x, y);
  g.rotate((hash(seed, 1) - 0.5) * 0.8);
  g.beginPath();
  g.moveTo(-s, 0);
  g.lineTo(s * 0.8, -s * 0.15);
  g.lineTo(s * 0.6, s * 0.1);
  g.lineTo(-s * 0.8, s * 0.12);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = Math.max(0.6, s * 0.08);
  g.beginPath();
  g.moveTo(-s * 0.1, -s * 0.05);
  g.lineTo(s * 0.4, -s * 0.9);
  g.moveTo(s * 0.1, -s * 0.05);
  g.lineTo(-s * 0.6, -s * 0.6);
  g.stroke();
  g.restore();
  g.fillStyle = rgba('#100c0c', 0.35);
  g.beginPath();
  g.ellipse(x, y + s * 0.1, s * 1.6, s * 0.25, 0, 0, Math.PI * 2);
  g.fill();
}
export function drawStruck(E: Env, x: number, y: number, s: number, seed: number, haze: number, burn: number) {
  const g = E.ctx;
  const ink = E.lit(mix('#1a1414', '#b8cee4', haze));
  g.strokeStyle = ink;
  g.lineCap = 'round';
  const branch = (bx: number, by: number, a: number, len: number, w: number, depth: number) => {
    const ex = bx + Math.sin(a) * len;
    const ey = by - Math.cos(a) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(ex, ey);
    g.stroke();
    if (depth > 0) {
      branch(ex, ey, a - 0.5 + hash(seed, depth) * 0.2, len * 0.7, w * 0.6, depth - 1);
      branch(ex, ey, a + 0.45 + hash(seed, depth, 1) * 0.2, len * 0.65, w * 0.6, depth - 1);
    }
  };
  branch(x, y, (hash(seed, 9) - 0.5) * 0.2, s * 0.5, Math.max(0.8, s * 0.1), 3);
  if (burn > 0.02) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    E.glow(x, y - s * 0.6, s * 0.9, '#ff7020', burn * (0.6 + 0.2 * Math.sin(E.t * 9)));
    g.restore();
  }
}
export function drawStain(E: Env, x: number, y: number, s: number, seed: number, k: number) {
  const g = E.ctx;
  g.fillStyle = rgba('#0e0a0c', 0.85 * Math.min(1, k + 0.3));
  g.beginPath();
  g.ellipse(x, y, s, s * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  for (let q = 0; q < 3; q++) {
    g.beginPath();
    g.ellipse(x + (hash(seed, q) - 0.5) * s * 2, y + (hash(seed, q, 1) - 0.5) * s * 0.3, s * 0.3, s * 0.08, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = rgba(E.lit('#7a7a90'), 0.35);
  g.beginPath();
  g.ellipse(x - s * 0.2, y - s * 0.05, s * 0.4, s * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  // Bubbling while it is fresh.
  const b = (E.t * 0.7 + hash(seed, 7)) % 1;
  if (k > 0.5) {
    g.strokeStyle = rgba('#3a3640', 0.8 * (1 - b));
    g.lineWidth = Math.max(0.5, s * 0.04);
    g.beginPath();
    g.arc(x + (hash(seed, 8) - 0.5) * s, y - s * 0.05, s * 0.08 * (1 + b), Math.PI, 0);
    g.stroke();
  }
}
export function drawPuddle(E: Env, x: number, y: number, s: number, seed: number, sky: string, rain: number) {
  const g = E.ctx;
  g.fillStyle = rgba(mix(E.lit('#4a5a48'), '#1a1a20', 0.3), 0.6);
  g.beginPath();
  g.ellipse(x, y + s * 0.03, s * 1.05, s * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba(sky, 0.85);
  g.beginPath();
  g.ellipse(x, y, s, s * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba('#ffffff', 0.3);
  g.lineWidth = Math.max(0.5, s * 0.03);
  g.beginPath();
  g.moveTo(x - s * 0.5, y - s * 0.04);
  g.lineTo(x + s * 0.2, y - s * 0.05);
  g.stroke();
  if (rain > 0.1) {
    for (let k = 0; k < 3; k++) {
      const q = (E.t * 1.5 + hash(seed, k)) % 1;
      g.strokeStyle = rgba('#ffffff', 0.4 * (1 - q) * rain);
      g.beginPath();
      g.ellipse(x + (hash(seed, k, 3) - 0.5) * s, y, s * 0.3 * q, s * 0.06 * q, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }
}

/** Another walking house, met on the road: a spidery keep, a windmill on hen's legs, a cottage, a show-tent on stilts. */
export function drawWalkingHouse(E: Env, kind: 'keep' | 'mill' | 'cottage' | 'tent', x: number, y: number, s: number, t: number, haze: number, seed: number, lx: number) {
  if (kind === 'cottage') {
    drawHen(E, x, y, s * 0.7, t, haze);
    return;
  }
  const g = E.ctx;
  const H = (c: string) => E.lit(mix(c, '#b8cee4', haze));
  const ph = t * (kind === 'keep' ? 1.6 : 2.2);
  const ink = H('#2a2228');
  const leg = (hx: number, hy: number, o: number, len: number, insect: boolean) => {
    const sw = Math.sin(ph + o);
    const fx = hx + sw * len * 0.35;
    const lift = Math.max(0, Math.cos(ph + o)) * len * 0.12;
    const kx = insect ? hx + (fx - hx) * 0.5 + (hx < x ? -1 : 1) * len * 0.35 : hx + (fx - hx) * 0.3 - len * 0.18;
    const ky = insect ? hy - len * 0.1 : hy + len * 0.5;
    g.strokeStyle = ink;
    g.lineWidth = Math.max(0.7, s * (insect ? 0.05 : 0.08));
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hx, hy);
    g.lineTo(kx, ky);
    g.lineTo(fx, y - lift);
    g.stroke();
  };
  const bob = Math.abs(Math.sin(ph)) * s * 0.04;
  if (kind === 'keep') {
    // Four spider legs, knees up; a tall stone tower with a slate spire and one lit window.
    const by = y - s * 0.85 - bob;
    for (const [o, dx] of [[0, -0.3], [Math.PI, -0.15], [Math.PI * 0.5, 0.15], [Math.PI * 1.5, 0.3]] as const) leg(x + dx * s, by, o, s * 0.95, true);
    const w = s * 0.34;
    const h = s * 1.1;
    g.fillStyle = H('#8a8478');
    g.fillRect(x - w / 2, by - h, w, h);
    g.fillStyle = H(lx > 0 ? '#5a564e' : '#aaa496');
    g.fillRect(lx > 0 ? x - w / 2 : x, by - h, w / 2, h);
    g.fillStyle = H('#3a4252');
    g.beginPath();
    g.moveTo(x - w * 0.7, by - h);
    g.lineTo(x, by - h - s * 0.75);
    g.lineTo(x + w * 0.7, by - h);
    g.fill();
    g.fillStyle = E.night > 0.3 ? rgba('#ffc870', 0.95) : H('#1e1c24');
    g.fillRect(x - w * 0.12, by - h * 0.7, w * 0.24, h * 0.14);
    g.strokeStyle = ink;
    g.lineWidth = Math.max(0.5, s * 0.02);
    g.strokeRect(x - w / 2, by - h, w, h);
    g.fillStyle = H('#6a4a6a');
    g.fillRect(x - w * 0.55, by - h * 0.45, w * 1.1, s * 0.05);
    return;
  }
  if (kind === 'mill') {
    const by = y - s * 0.7 - bob;
    leg(x - s * 0.08, by, 0, s * 0.7, false);
    leg(x + s * 0.08, by, Math.PI, s * 0.7, false);
    const w0 = s * 0.42;
    const w1 = s * 0.26;
    const h = s * 0.95;
    g.fillStyle = H('#e6dcc6');
    g.beginPath();
    g.moveTo(x - w0 / 2, by);
    g.lineTo(x - w1 / 2, by - h);
    g.lineTo(x + w1 / 2, by - h);
    g.lineTo(x + w0 / 2, by);
    g.fill();
    g.fillStyle = rgba(H('#3a3440'), 0.35);
    g.beginPath();
    g.moveTo(x - lx * w0 / 2, by);
    g.lineTo(x - lx * w1 / 2, by - h);
    g.lineTo(x, by - h);
    g.lineTo(x, by);
    g.fill();
    g.fillStyle = H('#6a4a3a');
    g.beginPath();
    g.ellipse(x, by - h, w1 * 0.7, s * 0.1, 0, Math.PI, 0);
    g.fill();
    const a0 = t * 1.1 + seed;
    g.strokeStyle = H('#5a4434');
    g.fillStyle = H('#f0e8d8');
    g.lineWidth = Math.max(0.6, s * 0.025);
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      const ex = x + Math.cos(a) * s * 0.62;
      const ey = by - h + Math.sin(a) * s * 0.62;
      g.beginPath();
      g.moveTo(x, by - h);
      g.lineTo(ex, ey);
      g.stroke();
      g.save();
      g.translate(x, by - h);
      g.rotate(a);
      g.fillRect(s * 0.14, 0, s * 0.46, s * 0.12);
      g.restore();
    }
    return;
  }
  // The show-tent: striped canvas on four stilts, pennants, a lamp.
  const by = y - s * 0.9 - bob;
  for (const [o, dx] of [[0, -0.3], [Math.PI, -0.1], [Math.PI * 0.5, 0.1], [Math.PI * 1.5, 0.3]] as const) leg(x + dx * s, by, o, s * 0.9, false);
  const w = s * 0.8;
  for (let k = 0; k < 6; k++) {
    g.fillStyle = H(k % 2 ? '#f0e6d2' : '#c8443a');
    g.beginPath();
    g.moveTo(x - w / 2 + (k * w) / 6, by);
    g.lineTo(x, by - s * 0.6);
    g.lineTo(x - w / 2 + ((k + 1) * w) / 6, by);
    g.fill();
  }
  g.fillStyle = H('#c8443a');
  g.fillRect(x - w / 2, by, w, s * 0.1);
  g.strokeStyle = ink;
  g.lineWidth = Math.max(0.5, s * 0.02);
  g.beginPath();
  g.moveTo(x, by - s * 0.6);
  g.lineTo(x, by - s * 0.8);
  g.stroke();
  g.fillStyle = H('#f0c040');
  g.beginPath();
  g.moveTo(x, by - s * 0.8);
  g.lineTo(x + s * 0.18, by - s * 0.75 + Math.sin(t * 5) * s * 0.02);
  g.lineTo(x, by - s * 0.7);
  g.fill();
}
