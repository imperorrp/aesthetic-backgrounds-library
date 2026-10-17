/**
 * Ironhaze's people: little figures against the light, walking the bridges and walkways, the
 * viaduct's footway, the catwalks under the decks, the air platforms, and the place we watch from.
 *
 * Six of them: a gentleman in a top hat with his cane, a lady in a bell of a dress (sometimes with
 * a parasol), a worker in a cap with a sack, a soldier with his rifle, a child, an automaton with
 * a lamp for an eye. In a rising some carry red flags; in a parade the soldiers march.
 */
import { hexA, type Env } from './env';
import type { Person } from './types';

export function drawPerson(E: Env, p: Person, x: number, y: number, S: number, f: number, walking: boolean, near: boolean) {
  const c = E.ctx;
  const col = E.tone(near ? '#1e1a16' : '#1a1612', f, near ? 0.05 : 0);
  const rim = E.tone('#8a7a62', f, 0.5);
  const kind = p.flag === 2 ? 3 : p.kind;
  const sc = kind === 4 ? 0.66 : 1;
  const h = S * sc;
  const ph = walking ? (p.u * 900 + p.seed) / Math.max(1, S * 0.35) : 0;
  const sw = walking ? Math.sin(ph) * 0.38 : 0;
  c.save();
  c.translate(x, y);
  c.scale(p.dir, 1);
  c.fillStyle = col;
  c.strokeStyle = col;
  c.lineCap = 'round';
  // Legs.
  const hip = -h * 0.46;
  c.lineWidth = Math.max(0.6, h * 0.075);
  if (kind !== 1) {
    c.beginPath();
    c.moveTo(0, hip);
    c.lineTo(Math.sin(sw) * h * 0.46, -Math.cos(sw) * h * 0.46 + h * 0.46 + hip);
    c.moveTo(0, hip);
    c.lineTo(Math.sin(-sw) * h * 0.46, -Math.cos(sw) * h * 0.46 + h * 0.46 + hip);
    c.stroke();
  }
  // The body by kind.
  if (kind === 0) {
    c.beginPath();
    c.moveTo(-h * 0.09, -h * 0.8);
    c.lineTo(h * 0.09, -h * 0.8);
    c.lineTo(h * 0.13, -h * 0.34);
    c.lineTo(-h * 0.16, -h * 0.3);
    c.fill();
    c.fillRect(-h * 0.07, -h * 1.12, h * 0.14, h * 0.16);
    c.fillRect(-h * 0.12, -h * 0.97, h * 0.24, h * 0.025);
    c.lineWidth = Math.max(0.4, h * 0.025);
    c.beginPath();
    c.moveTo(h * 0.12, -h * 0.55);
    c.lineTo(h * 0.2 + Math.sin(sw) * h * 0.05, 0);
    c.stroke();
  } else if (kind === 1) {
    c.beginPath();
    c.moveTo(-h * 0.06, -h * 0.78);
    c.lineTo(h * 0.06, -h * 0.78);
    c.lineTo(h * 0.07, -h * 0.5);
    c.quadraticCurveTo(h * 0.24, -h * 0.2, h * 0.22 + sw * h * 0.04, 0);
    c.lineTo(-h * 0.22 + sw * h * 0.04, 0);
    c.quadraticCurveTo(-h * 0.24, -h * 0.2, -h * 0.07, -h * 0.5);
    c.fill();
    c.beginPath();
    c.ellipse(0, -h * 0.94, h * 0.16, h * 0.035, 0, 0, Math.PI * 2);
    c.fill();
    if (p.seed % 3 === 0) {
      c.lineWidth = Math.max(0.3, h * 0.02);
      c.beginPath();
      c.moveTo(h * 0.08, -h * 0.6);
      c.lineTo(h * 0.14, -h * 1.12);
      c.stroke();
      c.beginPath();
      c.arc(h * 0.14, -h * 1.06, h * 0.2, Math.PI * 1.1, Math.PI * 1.9);
      c.fill();
    }
  } else if (kind === 2) {
    c.beginPath();
    c.roundRect(-h * 0.11, -h * 0.8, h * 0.22, h * 0.36, h * 0.04);
    c.fill();
    c.fillRect(-h * 0.08, -h * 0.98, h * 0.18, h * 0.04);
    c.beginPath();
    c.ellipse(-h * 0.06, -h * 0.82, h * 0.12, h * 0.08, -0.4, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 3) {
    c.beginPath();
    c.moveTo(-h * 0.1, -h * 0.82);
    c.lineTo(h * 0.1, -h * 0.82);
    c.lineTo(h * 0.14, -h * 0.3);
    c.lineTo(-h * 0.14, -h * 0.3);
    c.fill();
    c.beginPath();
    c.ellipse(0, -h * 0.96, h * 0.1, h * 0.06, 0, Math.PI, 0);
    c.fill();
    c.fillRect(-h * 0.005, -h * 1.06, h * 0.012, h * 0.06);
    c.lineWidth = Math.max(0.4, h * 0.025);
    c.beginPath();
    c.moveTo(-h * 0.05, -h * 0.5);
    c.lineTo(h * 0.04, -h * 1.15);
    c.stroke();
    c.fillStyle = E.tone('#8a1c14', f, 0.1);
    c.fillRect(-h * 0.1, -h * 0.68, h * 0.06, h * 0.06);
    c.fillStyle = col;
  } else if (kind === 4) {
    c.beginPath();
    c.roundRect(-h * 0.1, -h * 0.8, h * 0.2, h * 0.36, h * 0.05);
    c.fill();
    c.fillRect(-h * 0.08, -h * 0.98, h * 0.18, h * 0.04);
  } else {
    c.fillRect(-h * 0.12, -h * 0.82, h * 0.24, h * 0.38);
    c.fillRect(-h * 0.02, -h * 0.86, h * 0.04, h * 0.04);
  }
  // The head.
  if (kind !== 5) {
    c.beginPath();
    c.arc(0, -h * 0.88, h * 0.075, 0, Math.PI * 2);
    c.fill();
  } else {
    c.beginPath();
    c.arc(0, -h * 0.92, h * 0.09, 0, Math.PI * 2);
    c.fill();
  }
  // A red flag on a pole.
  if (p.flag === 1) {
    c.lineWidth = Math.max(0.4, h * 0.025);
    c.beginPath();
    c.moveTo(h * 0.1, -h * 0.5);
    c.lineTo(h * 0.12, -h * 1.6);
    c.stroke();
    const wave = Math.sin(E.world.t * 5 + p.seed) * h * 0.06;
    c.fillStyle = E.tone('#b91c1c', f, 0.25);
    c.beginPath();
    c.moveTo(h * 0.12, -h * 1.6);
    c.quadraticCurveTo(h * 0.35, -h * 1.55 + wave, h * 0.55, -h * 1.5 + wave);
    c.lineTo(h * 0.55, -h * 1.22 + wave);
    c.quadraticCurveTo(h * 0.35, -h * 1.28 - wave, h * 0.12, -h * 1.3);
    c.fill();
  }
  if (near) {
    // Light on the edge toward the city.
    c.strokeStyle = hexA(rim, 0.45);
    c.lineWidth = Math.max(0.5, h * 0.015);
    c.beginPath();
    c.moveTo(h * 0.08, -h * 0.8);
    c.lineTo(h * 0.12, -h * 0.34);
    c.stroke();
  }
  c.restore();
  if (kind === 5 && E.night() > 0.1) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    E.glow(x + p.dir * h * 0.03, y - h * 0.92, h * 0.08, '#ffb060', 0.8 * E.night());
    c.restore();
  }
}
