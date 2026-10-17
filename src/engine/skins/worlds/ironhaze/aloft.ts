/**
 * What hangs in Ironhaze's sky besides ships: floating islands (rock, chains, a citadel on top,
 * a waterfall off the edge) and air platforms (iron decks held up by rotors or balloons: docks
 * with cranes and berths, gardens, forts, markets), toned for their depth.
 */
import { mulberry } from './planes';
import { hexA, type Env } from './env';
import type { Island, Platform } from './types';

export function drawIsland(E: Env, is: Island, t: number) {
  const c = E.ctx;
  const R = mulberry(is.seed);
  const rock = E.tone('#5a5048', is.f, 0.1);
  const rockDk = E.tone('#2e2924', is.f);
  const stone = E.tone('#8a8276', is.f, 0.3);
  const w = is.w;
  c.save();
  c.translate(is.x, is.y + Math.sin(t * 0.2 + is.seed) * w * 0.01);
  c.strokeStyle = rockDk;
  c.lineWidth = Math.max(0.5, w * 0.004);
  for (let k = 0; k < 4; k++) {
    const cx = (R() - 0.5) * w * 0.7;
    const len = w * (0.6 + R() * 0.8);
    c.beginPath();
    c.moveTo(cx, w * 0.1);
    c.quadraticCurveTo(cx + Math.sin(t * 0.3 + k) * w * 0.03, w * 0.1 + len * 0.5, cx + Math.sin(t * 0.3 + k) * w * 0.06, w * 0.1 + len);
    c.stroke();
  }
  const gr = c.createLinearGradient(0, 0, 0, w * 0.6);
  gr.addColorStop(0, rock);
  gr.addColorStop(1, rockDk);
  c.fillStyle = gr;
  c.beginPath();
  c.moveTo(-w / 2, 0);
  for (let k = 0; k <= 12; k++) {
    const x = -w / 2 + (k / 12) * w;
    const depth = Math.sin((k / 12) * Math.PI) * w * 0.55 * (0.7 + R() * 0.5);
    c.lineTo(x + (R() - 0.5) * w * 0.03, depth);
  }
  c.lineTo(w / 2, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = hexA(stone, 0.35);
  c.lineWidth = Math.max(0.4, w * 0.003);
  for (let k = 1; k < 5; k++) {
    c.beginPath();
    c.moveTo(-w * 0.45 * (1 - k * 0.15), k * w * 0.05);
    c.lineTo(w * 0.45 * (1 - k * 0.15), k * w * 0.05 + (R() - 0.5) * w * 0.02);
    c.stroke();
  }
  c.fillStyle = E.tone('#4a5a3a', is.f, 0.2);
  c.fillRect(-w / 2, -w * 0.012, w, w * 0.02);
  for (let k = 0; k < 6; k++) {
    c.beginPath();
    c.arc(-w * 0.45 + R() * w * 0.9, -w * 0.02, w * (0.02 + R() * 0.025), 0, Math.PI * 2);
    c.fill();
  }
  const n = 4 + Math.floor(R() * 4);
  for (let k = 0; k < n; k++) {
    const bx = -w * 0.4 + R() * w * 0.75;
    const bw = w * (0.05 + R() * 0.08);
    const bh = w * (0.1 + R() * 0.3);
    c.fillStyle = k % 2 ? stone : E.tone('#6a6258', is.f, 0.15);
    c.fillRect(bx, -bh, bw, bh);
    c.fillStyle = rockDk;
    c.fillRect(bx + bw * 0.7, -bh, bw * 0.3, bh);
    c.fillStyle = E.tone('#5a6a62', is.f, 0.2);
    if (R() < 0.6) {
      c.beginPath();
      c.moveTo(bx - bw * 0.1, -bh);
      c.lineTo(bx + bw / 2, -bh - bw * 1.6);
      c.lineTo(bx + bw * 1.1, -bh);
      c.fill();
    } else {
      c.beginPath();
      c.ellipse(bx + bw / 2, -bh, bw * 0.5, bw * 0.45, 0, Math.PI, 0);
      c.fill();
    }
    if (E.night() > 0.2) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = hexA('#ffc070', E.night() * 0.6 * (1 - E.hazeOf(is.f) * 0.5));
      for (let q = 0; q < 3; q++) c.fillRect(bx + bw * 0.2, -bh * (0.3 + q * 0.2), bw * 0.25, bw * 0.2);
      c.restore();
    }
  }
  const fg = c.createLinearGradient(0, 0, 0, w * 0.9);
  fg.addColorStop(0, hexA(E.tone('#e8eef0', is.f, 0.5), 0.8));
  fg.addColorStop(1, hexA(E.tone('#e8eef0', is.f, 0.5), 0));
  c.fillStyle = fg;
  c.fillRect(w * 0.42, 0, w * 0.025, w * 0.9);
  c.restore();
}

/** An air platform: an iron deck on rotors or balloons, and what is built on it. */
export function drawPlatform(E: Env, p: Platform, t: number) {
  const c = E.ctx;
  const R = mulberry(p.seed);
  const f = p.f;
  const s = E.u * E.world.m(f);
  const iron = E.tone('#3a3632', f, 0.15);
  const hi = E.tone('#7a7066', f, 0.4);
  const dk = E.tone('#1e1c1a', f);
  const canvas = E.tone('#c8b896', f, 0.3);
  const red = E.tone('#8a2a1c', f, 0.15);
  const w = p.w;
  const by = p.kind === 'dock' ? 0 : Math.sin(t * 0.3 + p.seed) * 3 * s;
  c.save();
  c.translate(p.x, p.y + by);
  const balloons = p.kind === 'garden' || p.kind === 'market';
  if (balloons) {
    // Balloons hold it up, tethered at the corners.
    for (const bx of [-0.32, 0.32]) {
      c.strokeStyle = hexA(dk, 0.7);
      c.lineWidth = Math.max(0.3, 0.6 * s);
      c.beginPath();
      c.moveTo(w * bx - 20 * s, 0);
      c.lineTo(w * bx, -80 * s);
      c.moveTo(w * bx + 20 * s, 0);
      c.lineTo(w * bx, -80 * s);
      c.stroke();
      const gr = c.createLinearGradient(0, -130 * s, 0, -70 * s);
      gr.addColorStop(0, E.tone('#d8c8a8', f, 0.5));
      gr.addColorStop(1, E.tone('#6a5a46', f));
      c.fillStyle = gr;
      c.beginPath();
      c.ellipse(w * bx, -105 * s, 42 * s, 32 * s, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = hexA(dk, 0.3);
      for (let k = -2; k <= 2; k++) {
        c.beginPath();
        c.ellipse(w * bx, -105 * s, Math.abs(k) * 12 * s, 32 * s, 0, 0, Math.PI * 2);
        c.stroke();
      }
    }
  } else {
    // Rotors underneath, in their housings.
    for (const rx of [-0.36, -0.12, 0.12, 0.36]) {
      c.fillStyle = dk;
      c.fillRect(w * rx - 6 * s, 10 * s, 12 * s, 14 * s);
      c.fillStyle = hexA(hi, 0.25 + 0.15 * Math.sin(t * 35 + rx * 10));
      c.beginPath();
      c.ellipse(w * rx, 26 * s, 26 * s, 3 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  // The deck: a thick iron slab on girders, a railing all round.
  c.fillStyle = iron;
  c.beginPath();
  c.moveTo(-w / 2, 0);
  c.lineTo(w / 2, 0);
  c.lineTo(w * 0.44, 12 * s);
  c.lineTo(-w * 0.44, 12 * s);
  c.closePath();
  c.fill();
  c.fillStyle = hi;
  c.fillRect(-w / 2, -1 * s, w, 1.6 * s);
  c.strokeStyle = dk;
  c.lineWidth = Math.max(0.4, 0.8 * s);
  c.beginPath();
  for (let x = -w * 0.44; x < w * 0.44; x += 12 * s) {
    c.moveTo(x, 2 * s);
    c.lineTo(x + 6 * s, 11 * s);
    c.lineTo(x + 12 * s, 2 * s);
  }
  c.stroke();
  c.strokeStyle = hexA(hi, 0.7);
  c.lineWidth = Math.max(0.3, 0.5 * s);
  c.beginPath();
  c.moveTo(-w / 2, -5 * s);
  c.lineTo(w / 2, -5 * s);
  for (let x = -w / 2; x <= w / 2; x += 4 * s) {
    c.moveTo(x, -5 * s);
    c.lineTo(x, -1 * s);
  }
  c.stroke();
  // What is on it.
  if (p.kind === 'dock') {
    for (let k = 0; k < 3; k++) {
      const sx = -w * 0.3 + k * w * 0.22;
      c.fillStyle = k % 2 ? iron : E.tone('#5a4a3a', f, 0.15);
      c.fillRect(sx, -26 * s, w * 0.16, 26 * s);
      c.fillStyle = dk;
      c.beginPath();
      c.moveTo(sx - 2 * s, -26 * s);
      c.lineTo(sx + w * 0.08, -34 * s);
      c.lineTo(sx + w * 0.16 + 2 * s, -26 * s);
      c.fill();
      c.fillRect(sx + w * 0.05, -16 * s, w * 0.06, 16 * s);
    }
    for (const sd of [-1, 1]) {
      // A crane at each end, swinging, and the berth's arm.
      const cx = sd * w * 0.42;
      const a = Math.sin(t * 0.2 + sd) * 0.5;
      c.strokeStyle = dk;
      c.lineWidth = Math.max(0.5, 1 * s);
      c.beginPath();
      c.moveTo(cx, 0);
      c.lineTo(cx, -60 * s);
      c.lineTo(cx + Math.cos(a) * 50 * s * -sd, -60 * s);
      c.moveTo(cx + Math.cos(a) * 40 * s * -sd, -60 * s);
      c.lineTo(cx + Math.cos(a) * 40 * s * -sd, -34 * s);
      c.stroke();
      c.lineWidth = Math.max(0.6, 1.4 * s);
      c.beginPath();
      c.moveTo(sd * w * 0.5, -6 * s);
      c.lineTo(sd * (w / 2 + 26 * s), -30 * s);
      c.stroke();
    }
  } else if (p.kind === 'garden') {
    for (let k = 0; k < 7; k++) {
      const tx = -w * 0.4 + k * w * 0.13 + R() * 8 * s;
      c.fillStyle = dk;
      c.fillRect(tx - 1 * s, -14 * s, 2 * s, 14 * s);
      c.fillStyle = E.tone('#3a4a2e', f, 0.25);
      c.beginPath();
      c.arc(tx, -18 * s, (8 + R() * 6) * s, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = E.tone('#8a8276', f, 0.3);
    c.fillRect(-14 * s, -30 * s, 28 * s, 30 * s);
    c.fillStyle = E.tone('#5a6a62', f, 0.25);
    c.beginPath();
    c.ellipse(0, -30 * s, 18 * s, 16 * s, 0, Math.PI, 0);
    c.fill();
  } else if (p.kind === 'fort') {
    c.fillStyle = iron;
    c.fillRect(-w * 0.4, -30 * s, w * 0.8, 30 * s);
    for (let x = -w * 0.4; x < w * 0.4; x += 8 * s) c.fillRect(x, -36 * s, 5 * s, 6 * s);
    for (const tx of [-0.36, 0.36]) {
      c.fillStyle = iron;
      c.fillRect(w * tx - 10 * s, -54 * s, 20 * s, 54 * s);
      c.fillStyle = dk;
      c.fillRect(w * tx - 2 * s, -46 * s, 4 * s, 8 * s);
    }
    c.strokeStyle = dk;
    c.lineWidth = Math.max(0.6, 2 * s);
    c.beginPath();
    c.moveTo(0, -36 * s);
    c.lineTo(26 * s, -54 * s);
    c.stroke();
    c.fillStyle = red;
    const wave = Math.sin(t * 3 + p.seed) * 2 * s;
    c.fillRect(-1 * s, -70 * s, 1.4 * s, 34 * s);
    c.beginPath();
    c.moveTo(0, -70 * s);
    c.lineTo(18 * s, -66 * s + wave);
    c.lineTo(0, -60 * s);
    c.fill();
  } else {
    for (let k = 0; k < 6; k++) {
      const tx = -w * 0.38 + k * w * 0.15;
      for (let q = 0; q < 4; q++) {
        c.fillStyle = q % 2 ? canvas : red;
        c.beginPath();
        c.moveTo(tx + q * 4 * s, -18 * s);
        c.lineTo(tx + 8 * s, -28 * s);
        c.lineTo(tx + (q + 1) * 4 * s, -18 * s);
        c.fill();
      }
      c.fillStyle = dk;
      c.fillRect(tx, -18 * s, 16 * s, 18 * s);
    }
    c.strokeStyle = hexA(dk, 0.7);
    c.lineWidth = Math.max(0.3, 0.5 * s);
    c.beginPath();
    c.moveTo(-w * 0.45, -32 * s);
    c.quadraticCurveTo(0, -20 * s, w * 0.45, -32 * s);
    c.stroke();
  }
  c.restore();
  // Its lights.
  const night = E.night();
  if (night > 0.1) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const hz = E.hazeOf(f);
    for (let k = 0; k < 7; k++) E.glow(p.x - w * 0.42 + k * w * 0.14, p.y + by - (p.kind === 'market' ? 28 : 6) * s, 10 * s, '#ffc070', night * 0.6 * (1 - hz * 0.5));
    if (!balloons) for (const rx of [-0.36, 0.36]) E.glow(p.x + w * rx, p.y + by + 20 * s, 8 * s, '#ff4030', night * (Math.floor(t * 1.2) % 2 ? 0.8 : 0.3));
    c.restore();
  }
}
