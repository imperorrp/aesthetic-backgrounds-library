/**
 * Titan Dock, painted: a frame from a rain-soaked monster film. Night (mostly), teal and sodium,
 * the city's glow under the cloud, wet light on everything, the giants lit by floodlights,
 * reactors and lightning, small things (people, cars, helicopters, ships) to give them their size.
 *
 * Two painters of the same sim, by the `view` option. The scene (here): back to front, the storm
 * sky and the rift; the far sea; the city across the bay in bands of distance, with what is out
 * on the water between them (ships, the bones and wrecks the fights left, monsters, mechs in the
 * surf, helicopters and their searchlights, the fight's fire and blood); the dock (its back, the
 * mechs in their bays and the crews, its cut face); the lift team over the apron; the near sea;
 * the rain; the grade. The map (./map) is the defence command's radar plot of the same coast.
 *
 * Words belong to the film: a title card for the moments that matter, one at a time; the radio as
 * subtitles at the foot of the frame; the dock's name small in a corner. Names, the clock and the
 * kill marks are painted in the world itself (on the dock's walls, the mechs' pauldrons).
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash } from '../../instruments/kit';
import { drawBeam, drawHeli, drawShip } from './craft';
import { createDock } from './dock';
import { clamp01, createEnv, hexA, mix, mk, MOODS } from './look';
import { createMap } from './map';
import { drawMech, handOf, poseOf } from './mech';
import { beastOf, drawMonster } from './monster';
import { BANDS, bandOf, createScene } from './scene';
import { createTitanDock } from './sim';
import type { DockWorld, Fx, Mark, Mech, Monster } from './types';

export type DockPaintOptions = { traffic: number; camera: string; labels: boolean; hud: boolean; view: string };

export const TITLE = (px: number) => `600 ${px}px "Barlow Condensed", "Oswald", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif`;
export const SUBS = (px: number, weight = 500) => `${weight} ${px}px "Helvetica Neue", "Segoe UI", Roboto, Arial, sans-serif`;
/** How much bigger than true the giants are drawn out on the water, so they read at their distance. */
const SEA_K = 1.15;

export function mountTitanDock(host: SkinHost, o: DockPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: DockWorld = createTitanDock(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const { GW, GH, u } = world;
  const map = o.view === 'map';
  const framing = createFraming((map ? 'still' : o.camera === 'still' || o.camera === 'director' || o.camera === 'follow' ? o.camera : 'drift') as CameraMode, world, { push: 1.35, closer: 1.8, maxZoom: 2.6 });
  const cam = framing.cam;
  const fx = (x: number) => (world.flip ? GW - x : x);
  const SX = (x: number) => (fx(x) - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const E = createEnv(ctx, u, world.mood);
  const lr = host.fork('dock-look');
  const lookSeed = Math.floor(lr() * 1e6);
  let scene: ReturnType<typeof createScene> | null = null;
  let dock: ReturnType<typeof createDock> | null = null;
  const plot = map ? createMap(ctx, world, lookSeed) : null;
  let grain: HTMLCanvasElement | null = null;
  /** The director's shots are canonical; the camera works in the mirrored picture. */
  const directorView = { get shot() {
    const s = world.director.shot;
    return { ...s, x: fx(s.x) };
  } } as unknown as DockWorld['director'];

  // ---- out on the water ----------------------------------------------------------------------------
  const seaFeet = (x: number, d: number, alt: number) => {
    void x;
    return world.yOf(d) - alt * world.mOf(d);
  };
  function drawSeaMech(m: Mech, t: number) {
    const mm = world.mOf(m.d) * SEA_K;
    const s = m.H * mm;
    const y = seaFeet(m.x, m.d, m.alt);
    const wl = world.yOf(m.d);
    const p = poseOf(m, t);
    const inWater = m.alt < 0;
    // The reactor's light on the water under it, and on the rain.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (inWater) {
      ctx.translate(m.x, wl + 4 * u * mm);
      ctx.scale(1, 0.18);
      E.glow(0, 0, s * 0.5, m.colors.core, 0.35 * p.lights);
    }
    ctx.restore();
    drawMech(E, m, m.x, y, s, m.dir, p, { d: m.d, inside: false, from: 1, t, water: inWater ? wl + 2 * u * mm : null, tilt: m.tilt });
    if (inWater) foam(m.x, wl, s * 0.34, mm, t, m.seed);
    // A ship held as a club, in its hands.
    if (m.act?.kind === 'club') {
      const ship = world.ships.find((q) => q.state === 'held');
      if (ship) {
        const [hx, hy] = handOf(p, m.build);
        const lift = 0;
        const sx = m.x + hx * s * m.dir;
        const sy = y + (hy + lift) * s;
        drawShip(E, ship, sx, sy, mm * 0.75, m.d, t, { angle: (p.near[0] - 1.6) * m.dir });
      }
    }
    // Searchlights on its shoulders, into the rain.
    if (inWater && E.L.night + E.storm * 0.3 > 0.35 && m.state === 'fight') {
      const foe = world.monsters.find((q) => q.state === 'fight');
      const tx = foe ? foe.x : m.x + m.dir * s;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawBeam(E, m.x - m.dir * 0.2 * s, y - 0.84 * s, tx, wl - s * 0.3, s * 0.18, 0.35);
      ctx.restore();
    }
  }
  function foam(x: number, y: number, r: number, mm: number, t: number, seed: number) {
    ctx.strokeStyle = hexA(mix('#e8f0f4', E.L.ink, E.L.night * 0.4), 0.7);
    ctx.lineWidth = Math.max(0.8, 2 * u * mm);
    for (let k = 0; k < 3; k++) {
      const rr = r * (0.7 + k * 0.25 + 0.05 * Math.sin(t * 2 + k + seed));
      ctx.beginPath();
      ctx.ellipse(x, y + k * 2 * u * mm, rr, rr * 0.12, 0, 0.1, Math.PI - 0.1);
      ctx.stroke();
    }
    ctx.fillStyle = hexA(mix('#e8f0f4', E.L.ink, E.L.night * 0.4), 0.35);
    for (let k = 0; k < 10; k++) {
      const a = hash(seed, k) * Math.PI;
      ctx.fillRect(x + Math.cos(a) * r * 1.1, y + Math.sin(a) * r * 0.1 - 2 * u * mm, 6 * u * mm, 1.5 * u * mm);
    }
  }
  function drawSeaMonster(q: Monster, t: number) {
    const mm = world.mOf(q.d) * SEA_K;
    const s = q.H * mm;
    const wl = world.yOf(q.d);
    const y = seaFeet(q.x, q.d, q.alt);
    const b = beastOf(q, t);
    const fly = q.flying * s * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(q.x, wl + 3 * u * mm);
    ctx.scale(1, 0.16);
    E.glow(0, 0, s * 0.55, q.colors.glow, q.state === 'carcass' ? 0.25 * q.left : 0.25);
    ctx.restore();
    drawMonster(E, q, q.x, y - fly, s, q.dir, b, { d: q.d, from: 1, t, water: wl + 2 * u * mm, tilt: q.tilt, left: q.left });
    if (q.state !== 'carcass') foam(q.x, wl, s * 0.4, mm, t, q.seed);
  }
  function drawMark(k: Mark, t: number) {
    const m = world.mOf(k.d) * SEA_K;
    const x = k.x;
    const y = world.yOf(k.d);
    const s = 300 * u * m * k.size;
    if (k.kind === 'bones') {
      // The carcass picked clean: ribs standing out of the water, tapering and curved; the long skull
      // on its side; weed and gulls on them; the rift's light still in the eye, faintly.
      const bone = E.tone('#bfb59a', k.d, 0.25);
      const shade = mix(bone, E.L.ink, 0.5);
      for (let i = 0; i < 6; i++) {
        const rx = x - s * 0.45 + i * s * 0.15;
        const h = s * (0.32 + 0.22 * Math.sin(((i + 0.5) / 6) * Math.PI)) * (0.8 + hash(k.seed, i) * 0.3);
        const lean = s * (0.1 + hash(k.seed, i, 2) * 0.06);
        const w0 = Math.max(1.5, 0.035 * s);
        ctx.fillStyle = i % 2 ? bone : mix(bone, shade, 0.35);
        ctx.beginPath();
        ctx.moveTo(rx - w0, y + 2);
        ctx.quadraticCurveTo(rx - w0 * 0.6 + lean * 0.3, y - h * 0.9, rx + lean, y - h);
        ctx.quadraticCurveTo(rx + w0 * 0.4 + lean * 0.3, y - h * 0.8, rx + w0, y + 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = hexA(E.tone('#2a3a2a', k.d), 0.7);
        ctx.fillRect(rx - w0, y - h * 0.12, w0 * 2, h * 0.12);
      }
      // The skull, half sunk, its long jaw, the socket.
      const sx = x + s * 0.58;
      ctx.fillStyle = bone;
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.18, y + 2);
      ctx.quadraticCurveTo(sx - s * 0.16, y - s * 0.2, sx + s * 0.02, y - s * 0.18);
      ctx.quadraticCurveTo(sx + s * 0.22, y - s * 0.12, sx + s * 0.34, y - s * 0.02);
      ctx.lineTo(sx + s * 0.3, y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.ellipse(sx - s * 0.04, y - s * 0.11, s * 0.04, s * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 6; i++) ctx.fillRect(sx + s * (0.05 + i * 0.045), y - s * 0.03, Math.max(1, s * 0.012), s * 0.035);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(sx - s * 0.04, y - s * 0.11, s * 0.06, k.colors.trim, 0.35 + 0.2 * Math.sin(t + k.seed));
      ctx.restore();
    } else {
      // A mech's wreck: the shoulder and an arm above the water, rust and a warning buoy.
      const steel = E.tone(mix(k.colors.main, '#6a3a20', 0.45), k.d, 0.1);
      const dark = E.tone('#1a1c1e', k.d);
      ctx.fillStyle = steel;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + 2);
      ctx.lineTo(x - s * 0.3, y - s * 0.2);
      ctx.lineTo(x - s * 0.05, y - s * 0.28);
      ctx.lineTo(x + s * 0.15, y - s * 0.18);
      ctx.lineTo(x + s * 0.2, y + 2);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.fillRect(x - s * 0.2, y - s * 0.16, s * 0.12, s * 0.04);
      ctx.save();
      ctx.translate(x + s * 0.3, y);
      ctx.rotate(-0.5);
      ctx.fillStyle = steel;
      ctx.fillRect(-s * 0.05, -s * 0.45, s * 0.1, s * 0.45);
      ctx.fillStyle = dark;
      ctx.fillRect(-s * 0.07, -s * 0.52, s * 0.14, s * 0.08);
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(x - s * 0.45, y - 8 * u * m, 6 * u * m, '#ff3020', Math.sin(t * 2 + k.seed) > 0.5 ? 0.9 : 0.1);
      ctx.restore();
    }
    foam(x, y, s * 0.45, m, t, k.seed);
  }
  function drawFx(f: Fx, t: number) {
    const age = world.t - f.t0;
    if (age < 0) return;
    const k = clamp01(age / f.dur);
    const m = f.d < 0 ? 1 : world.mOf(f.d);
    if (f.kind === 'spark') {
      ctx.strokeStyle = hexA(f.color, 1 - k);
      ctx.lineWidth = Math.max(0.6, 1.2 * u * m);
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x - f.vx * 0.03, f.y - f.vy * 0.03);
      ctx.stroke();
    } else if (f.kind === 'splash' || f.kind === 'spray' || f.kind === 'dust' || f.kind === 'smoke' || f.kind === 'steam') {
      const col = f.kind === 'dust' ? E.tone('#8a8478', Math.max(0, f.d), 0.2) : f.kind === 'smoke' ? E.tone(f.color, Math.max(0, f.d)) : mix('#e8f0f4', E.L.ink, E.L.night * 0.35);
      const r = f.r * (1 + k * (f.kind === 'smoke' || f.kind === 'dust' ? 2.5 : 1.2));
      ctx.globalAlpha = (f.kind === 'smoke' ? 0.5 : 0.55) * (1 - k) * Math.min(1, age * 5);
      ctx.drawImage(E.soft(col), f.x - r, f.y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    } else if (f.kind === 'blood') {
      if (f.dur > 10) {
        // A pool of the blue blood, spreading and fading on the water.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(f.x, f.y);
        ctx.scale(1, 0.18);
        E.glow(0, 0, f.r * (0.6 + k), f.color, 0.45 * (1 - k));
        ctx.restore();
      } else {
        ctx.fillStyle = hexA(f.color, 0.9 * (1 - k));
        ctx.fillRect(f.x - f.r / 2, f.y - f.r / 2, f.r, f.r);
      }
    } else if (f.kind === 'plasma' || f.kind === 'acid' || f.kind === 'tracer') {
      if (f.tx === undefined || f.ty === undefined) {
        ctx.fillStyle = hexA(f.color, 0.8 * (1 - k));
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      const hx = f.x + (f.tx - f.x) * k;
      const hy = f.y + (f.ty - f.y) * k - (f.kind === 'acid' ? Math.sin(k * Math.PI) * 40 * u * m : 0);
      const tail = f.kind === 'plasma' ? 0.25 : 0.12;
      const k0 = Math.max(0, k - tail);
      const sx = f.x + (f.tx - f.x) * k0;
      const sy = f.y + (f.ty - f.y) * k0;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = hexA(f.color, 0.9);
      ctx.lineWidth = f.r;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      if (f.kind === 'plasma') {
        E.glow(hx, hy, f.r * 5, f.color, 0.9);
        E.glow(hx, hy, f.r * 1.5, '#ffffff', 1);
      }
      ctx.restore();
    } else if (f.kind === 'flash' || f.kind === 'fire') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(f.x, f.y, f.r * (1 + k), f.color, (1 - k) * 0.95);
      ctx.restore();
    } else if (f.kind === 'flare') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      E.glow(f.x, f.y, 40 * u * m, f.color, 0.7 * (1 - k * 0.5));
      E.glow(f.x, f.y, 6 * u * m, '#ffffff', 1 - k * 0.5);
      ctx.restore();
    } else if (f.kind === 'firework') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const rr = f.r * Math.sqrt(k);
        E.glow(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr + k * k * 30 * u, 3 * u, f.color, 1 - k);
      }
      ctx.restore();
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = hexA('#e8f0f4', 0.5 * (1 - k));
      ctx.lineWidth = Math.max(0.8, 2 * u * m);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r * (0.4 + k), f.r * (0.4 + k) * 0.12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    void t;
  }

  // ---- the frame ------------------------------------------------------------------------------------
  let baked = false;
  function paint(t: number) {
    E.set(t, world.day, world.storm, world.flash, world.fog);
    if (plot) {
      plot.paint(t, W, H);
      return;
    }
    scene ??= createScene(E, world, lookSeed);
    dock ??= createDock(E, world);
    scene.city(!baked);
    baked = true;
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    if (world.flip) {
      ctx.translate(GW, 0);
      ctx.scale(-1, 1);
    }
    ctx.imageSmoothingEnabled = true;
    scene.sky(t);
    scene.sea(t, false, world.doorX - 40 * u);
    // What is out on the water, by band.
    type It = { d: number; draw: () => void };
    const items: It[] = [];
    const out = (m: Mech) => m.state === 'fight' || m.state === 'victory' || m.state === 'sinking' || m.state === 'pickup' || m.state === 'drop' || ((m.state === 'carried' || m.state === 'home') && m.d > 0.06);
    for (const s of world.ships) if (s.state !== 'held') items.push({ d: s.d, draw: () => drawShip(E, s, s.x, world.yOf(s.d) + 2 * u * world.mOf(s.d), world.mOf(s.d), s.d, t) });
    for (const k of world.marks) items.push({ d: k.d + 0.001, draw: () => drawMark(k, t) });
    for (const q of world.monsters) items.push({ d: q.d, draw: () => drawSeaMonster(q, t) });
    for (const m of world.mechs) if (out(m)) items.push({ d: m.d - 0.0005, draw: () => drawSeaMech(m, t) });
    for (const h of world.helis) if (h.d > 0.06) items.push({ d: h.d - 0.001, draw: () => drawHeliAt(h, t) });
    for (const f of world.fx) if (f.d >= 0.04) items.push({ d: f.d - 0.002, draw: () => drawFx(f, t) });
    const by: It[][] = BANDS.slice(0, -1).map(() => []);
    // Nearer than the dock's foot (a phone's fight comes in close): drawn after the dock and the near water.
    const front = items.filter((it) => it.d < -0.005);
    for (const it of items) if (it.d >= -0.005) by[bandOf(it.d)].push(it);
    for (let k = BANDS.length - 2; k >= 0; k--) {
      scene.drawBand(k, t);
      for (const it of by[k].sort((a, b) => b.d - a.d)) it.draw();
    }
    // The dock.
    dock.drawBack(t);
    for (const m of world.mechs.filter((x) => dock!.isIn(x)).sort((a, b) => a.x - b.x)) {
      const p = poseOf(m, t);
      drawMech(E, m, m.x, world.standY, m.H, m.dir, p, { d: 0, inside: m.x < world.doorX, from: 1, t });
    }
    dock.drawCrew(t);
    for (const f of world.fx) if (f.d < 0.04) drawFx(f, t);
    dock.drawFront(t);
    for (const h of world.helis) if (h.d <= 0.06) drawHeliAt(h, t);
    for (const m of world.mechs) if ((m.state === 'carried' || m.state === 'home') && m.d <= 0.06) drawSeaMech(m, t);
    scene.sea(t, true, -40);
    surf(t);
    for (const it of front.sort((a, b) => b.d - a.d)) it.draw();
    rain(t);
    if (world.flash > 0.05) {
      ctx.fillStyle = hexA('#dfe8ff', 0.16 * world.flash);
      ctx.fillRect(-40, -40, GW + 80, GH + 80);
    }
    ctx.restore();
    grade(t);
    words(t);
  }
  function drawHeliAt(h: DockWorld['helis'][number], t: number) {
    const m = world.mOf(h.d);
    const x = h.x;
    const y = seaFeet(h.x, h.d, h.alt);
    // Cables down to the mech it carries.
    if (h.role === 'deck' && h.cable > 0) {
      const mech = world.mechs.find((q) => q.state === 'hook' || q.state === 'carried' || q.state === 'pickup' || q.state === 'home');
      if (mech) {
        const mm = mech.d <= 0 && (mech.state === 'hook') ? 1 : world.mOf(mech.d) * SEA_K;
        const my = mech.state === 'hook' ? world.standY - mech.H * 0.88 : seaFeet(mech.x, mech.d, mech.alt) - mech.H * mm * 0.88;
        const mx = mech.x + (h.slot % 2 ? 0.12 : -0.16) * mech.H * mm;
        ctx.strokeStyle = hexA('#1a1a1a', 0.9);
        ctx.lineWidth = Math.max(0.6, 1.4 * u * m);
        ctx.beginPath();
        ctx.moveTo(x, y + 10 * u * m);
        ctx.lineTo(x + (mx - x) * h.cable, y + 10 * u * m + (my - y - 10 * u * m) * h.cable);
        ctx.stroke();
      }
    }
    if (h.role === 'patrol' && E.L.night + E.storm * 0.4 + world.fog * 0.5 > 0.35) {
      const foe = world.monsters.find((q) => q.state !== 'carcass' && q.state !== 'dying');
      const tx = foe ? foe.x + Math.sin(t * 0.7) * 40 * u : x + h.dir * 120 * u * m + Math.sin(t * 0.5 + h.seed) * 60 * u * m;
      const td = foe ? foe.d : h.d;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawBeam(E, x + h.dir * 20 * u * m, y + 6 * u * m, tx, world.yOf(td), 40 * u * world.mOf(td), 0.55);
      ctx.restore();
    }
    drawHeli(E, h, x, y, m * (h.role === 'deck' ? 1.05 : 0.9), h.d, t);
  }

  /** The swell breaking white against the foot of the sea wall and the apron, now here, now there. */
  function surf(t: number) {
    const n = 7;
    const foot = world.NY;
    const span = world.apronX + world.dx;
    const col = mix('#e8f0f4', E.L.ink, E.L.night * 0.45);
    for (let k = 0; k < n; k++) {
      const per = 5 + hash(k, 1, lookSeed) * 4;
      const ph = ((t + hash(k, 2, lookSeed) * per) % per) / per;
      if (ph > 0.45) continue;
      const cyc = Math.floor((t + hash(k, 2, lookSeed) * per) / per);
      const x = 20 * u + hash(k, cyc, lookSeed) * (span - 40 * u);
      const h = (40 + 60 * world.swell) * u * Math.sin((ph / 0.45) * Math.PI);
      for (let j = 0; j < 5; j++) {
        const r = (16 + j * 7) * u;
        const jx = x + (j - 2) * 14 * u;
        ctx.globalAlpha = 0.5 * (1 - ph / 0.45) * (1 - j * 0.12);
        ctx.drawImage(E.soft(col), jx - r, foot - h * (0.6 + 0.4 * Math.sin(j)) - r, r * 2, r * 2);
      }
    }
    ctx.globalAlpha = 1;
    // A line of foam along the wall's foot.
    ctx.strokeStyle = hexA(col, 0.5);
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    for (let x = -20; x <= span; x += 12 * u) {
      const y = foot + 2 * u + Math.sin(x * 0.05 + t * 2) * 2 * u;
      if (x === -20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // ---- rain, and the grade ---------------------------------------------------------------------------
  function rain(t: number) {
    const n = Math.floor(260 * world.rain * (GW * GH) / (1600 * 1000));
    const lean = world.wind * 0.35 + 0.15;
    ctx.save();
    // Not inside the hangar.
    ctx.beginPath();
    ctx.rect(-40, -40, GW + 80, GH + 80);
    ctx.rect(world.x0, world.ceilY, world.doorX - world.x0, world.floorY - world.ceilY);
    ctx.clip('evenodd');
    for (const [layer, len, a, wdt] of [[0, 18, 0.22, 0.8], [1, 34, 0.32, 1.3]] as const) {
      ctx.strokeStyle = hexA(mix('#c8d8e4', E.L.key, 0.3), a * (0.6 + E.L.night * 0.4));
      ctx.lineWidth = wdt * u;
      ctx.beginPath();
      const cnt = layer ? n * 0.35 : n;
      for (let k = 0; k < cnt; k++) {
        const sp = (layer ? 1300 : 900) * u;
        const x = (hash(k, layer, 9) * (GW + 400 * u) + t * sp * lean) % (GW + 400 * u) - 200 * u;
        const y = (hash(k, layer, 7) * (GH + 100 * u) + t * sp) % (GH + 100 * u) - 50 * u;
        ctx.moveTo(x, y);
        ctx.lineTo(x - lean * len * u, y - len * u);
      }
      ctx.stroke();
    }
    // Splashes on the roof deck and the apron.
    ctx.fillStyle = hexA('#dfe8f0', 0.45);
    for (let k = 0; k < 40 * world.rain; k++) {
      const ph = (t * 3 + hash(k, 3)) % 1;
      const on = ph < 0.15;
      if (!on) continue;
      const roof = k % 2 === 0;
      const x = roof ? world.x0 + hash(k, 4, Math.floor(t * 3)) * (world.doorX - world.x0) : world.doorX + hash(k, 5, Math.floor(t * 3)) * (world.apronX - world.doorX);
      const y = (roof ? world.roofY : world.floorY) - hash(k, 6, Math.floor(t * 3)) * world.dy;
      ctx.fillRect(x - 2 * u, y - 1 * u, 4 * u, 1.2 * u);
    }
    ctx.restore();
  }
  function grade(t: number) {
    if (!grain) {
      grain = mk(128, 128);
      const g = grain.getContext('2d')!;
      const img = g.createImageData(128, 128);
      for (let i = 0; i < 128 * 128; i++) {
        const v = 128 + (lr() - 0.5) * 255;
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
        img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
    }
    const pat = ctx.createPattern(grain, 'repeat');
    if (pat) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.07;
      const step = Math.floor(t * 12);
      ctx.translate((step * 37) % 128, (step * 53) % 128);
      ctx.fillStyle = pat;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    vg.addColorStop(0, 'rgba(2,6,10,0)');
    vg.addColorStop(1, `rgba(2,6,10,${(0.45 + E.L.night * 0.15).toFixed(3)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // ---- words ------------------------------------------------------------------------------------------
  function band(x: number, y: number, w: number, h: number, a: number) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(2,4,8,0)');
    g.addColorStop(0.12, `rgba(2,4,8,${a.toFixed(3)})`);
    g.addColorStop(0.88, `rgba(2,4,8,${a.toFixed(3)})`);
    g.addColorStop(1, 'rgba(2,4,8,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  /** A radio line in a subtitle's case: sentences, with the names of mechs, monsters and the dock kept as names. */
  const titled = (n: string) => n.toLowerCase().replace(/(^|\s|-)\S/g, (ch) => ch.toUpperCase());
  function sentence(text: string): string {
    let out = text.toLowerCase().replace(/(^|[.!?] )([a-z])/g, (_, p1: string, p2: string) => p1 + p2.toUpperCase()).replace(/\bi\b/g, 'I').replace(/\bi'/g, "I'");
    const names = [world.name, ...world.mechs.map((m) => m.name), ...world.monsters.map((q) => q.name), ...world.mechs.flatMap((m) => m.pilots)];
    for (const n of names) out = out.split(n.toLowerCase()).join(titled(n));
    return out;
  }
  /** Lines of at most `max` px, broken at spaces. */
  function wrap(text: string, max: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const wd of words) {
      const next = cur ? `${cur} ${wd}` : wd;
      if (ctx.measureText(next).width > max && cur) {
        lines.push(cur);
        cur = wd;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 2).map((l, i, a) => (i === 1 && a.length < lines.length ? fitText(ctx, `${l} ${lines.slice(2).join(' ')}`, max) : l));
  }
  function words(t: number) {
    void t;
    const level = 0.6 + 0.4 * host.intensity;
    const small = W < 600;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // The dock's name is painted on the dock itself; the corner only carries it for the first moments, or on a phone where the paint is small.
    if (o.hud && (small || world.t < 14)) {
      ctx.textAlign = 'left';
      ctx.font = TITLE(small ? 13 : 15);
      ctx.fillStyle = hexA('#e8eef2', 0.75 * level * (small ? 1 : clamp01((14 - world.t) / 3)));
      ctx.letterSpacing = '2px';
      fillCrisp(ctx, fitText(ctx, `TITAN DOCK · ${world.name}`, W - 32), 16, 26);
      ctx.letterSpacing = '0px';
    }
    if (!o.labels) {
      ctx.restore();
      return;
    }
    // The title card: one at a time, big, in the sky above the action.
    const cap = world.captions.find((q) => world.t >= q.t0 && world.t < q.t0 + q.dur);
    if (cap) {
      const age = world.t - cap.t0;
      const a = Math.min(1, age * 2.5, (cap.dur - age) / 0.8) * level;
      const px = Math.round(small ? 24 : Math.min(40, Math.max(28, W / 38)));
      ctx.textAlign = 'center';
      ctx.font = TITLE(px);
      ctx.letterSpacing = `${Math.round(px * 0.12)}px`;
      // Shrink to fit the width rather than cut a name short.
      const fit = Math.min(1, (W - 48) / Math.max(1, ctx.measureText(cap.text).width + cap.text.length * px * 0.12));
      if (fit < 1) {
        ctx.font = TITLE(Math.floor(px * fit));
        ctx.letterSpacing = `${Math.round(px * fit * 0.12)}px`;
      }
      const text = fitText(ctx, cap.text, W - 40);
      const tw = ctx.measureText(text).width;
      const y = Math.round(H * (small ? 0.12 : 0.11)) + px;
      band(W / 2 - tw / 2 - 60, y - px - 10, tw + 120, px + (cap.sub ? 40 : 22), 0.6 * a);
      ctx.fillStyle = hexA(cap.color, a);
      fillCrisp(ctx, text, W / 2, y);
      if (cap.sub) {
        ctx.font = SUBS(small ? 11 : 13, 600);
        ctx.letterSpacing = '3px';
        ctx.fillStyle = hexA('#d8e0e6', 0.85 * a * clamp01(age * 2 - 0.4));
        fillCrisp(ctx, fitText(ctx, cap.sub, W - 40), W / 2, y + (small ? 18 : 22));
      }
      ctx.letterSpacing = '0px';
    }
    // The radio, as subtitles.
    const sub = world.subs.find((q) => world.t >= q.t0 && world.t < q.t0 + q.dur);
    if (sub) {
      const age = world.t - sub.t0;
      const a = Math.min(1, age * 4, (sub.dur - age) / 0.4) * level;
      const px = small ? 15 : Math.round(Math.min(21, Math.max(17, W / 70)));
      ctx.textAlign = 'center';
      ctx.font = SUBS(px, 500);
      const lines = wrap(sentence(sub.text), Math.min(W - 48, 760));
      const lh = px * 1.3;
      const yb = H - (small ? 34 : 42);
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      ctx.fillStyle = `rgba(0,0,0,${(0.62 * a).toFixed(3)})`;
      ctx.fillRect(W / 2 - widest / 2 - 12, yb - lh * lines.length - px * 0.2 - 18, widest + 24, lh * lines.length + px * 0.5 + 18);
      ctx.font = SUBS(small ? 10 : 11, 700);
      ctx.letterSpacing = '2px';
      ctx.fillStyle = hexA(MOODS[world.mood].glow, 0.95 * a);
      fillCrisp(ctx, fitText(ctx, sub.who, W - 48), W / 2, yb - lh * lines.length - 4);
      ctx.letterSpacing = '0px';
      ctx.font = SUBS(px, 500);
      ctx.fillStyle = hexA('#ffffff', 0.97 * a);
      lines.forEach((l, i) => fillCrisp(ctx, l, W / 2, yb - lh * (lines.length - 1 - i)));
    }
    ctx.restore();
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => (plot ? plot.project(x, y, W, H) : [SX(x), SY(y)]),
    setCamera: (view) => {
      if (map) return false;
      framing.setView(view);
      return true;
    },
    unproject: (x, y) => (plot ? plot.unproject(x, y, W, H) : [fx((x - W / 2) / cam.zoom + cam.x), (y - H / 2) / cam.zoom + cam.y]),
    after: (dt) => {
      framing.update(dt, world.t, directorView, W, H);
      world.view = { x: cam.x, y: cam.y, zoom: cam.zoom, fit: framing.fit(W, H) };
    },
    paint: (t) => paint(t),
    ambience: () => (world.phase === 'fight' ? 0.95 : world.alarm > 0.1 ? 0.8 : 0.45),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
  });
}
