/**
 * Last Loop as a chart: the same system, seen from straight above, drawn as the traveller would draw
 * it in the back of the ship's log. Dark navy paper with a printed grid of rings and bearings; the
 * loop clock as the chart's own rim, the minutes lettered round it and the elapsed loop washed in the
 * sun's colour; the sun a watercolour blot with inked rays; each orbit an inked circle, each world a
 * wash of its colour with its night side shaded and its name hand-lettered; the comet's long ellipse
 * dashed; the ship's road this loop dotted in orange, and its course now with an arrowhead; the
 * probe's bearings from past loops ruled out to the rim, each with its loop; the supernova a wash of
 * blue across the whole sheet.
 *
 * The chart reads the world and draws; it never decides anything. Text is the same few lines as the
 * scene's (./words): the title and the ship's log, the loop clock's time, the subtitles.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createGrain, runWorld } from '../../../kit';
import { fillCrisp, hash, hexA } from '../../instruments/kit';
import { clamp01, mixRGB, rgbA, toRGB, type RGB } from './craft';
import { drawSubtitle, drawTitle, letter, SERIF } from './words';
import type { Body, LoopWorld } from './types';

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const INK = '#efe2c4';
const WASH: Record<string, RGB[]> = {
  home: [[96, 160, 88], [196, 128, 64], [70, 140, 110]],
  twinA: [[226, 168, 96], [232, 176, 156], [226, 196, 120]],
  twinB: [[214, 140, 104], [206, 140, 150], [200, 160, 100]],
  crumble: [[140, 124, 168], [116, 130, 150], [150, 124, 104]],
  ocean: [[60, 160, 150], [80, 160, 100], [70, 120, 200]],
  thorn: [[80, 96, 70], [100, 80, 110], [120, 80, 60]],
  moon: [[168, 162, 154]],
  cinder: [[216, 96, 58]],
  shy: [[176, 160, 230]],
  comet: [[210, 236, 255]],
  station: [[196, 204, 214]],
};

export type ChartOptions = { labels: boolean; hud: boolean };

export function mountChart(host: SkinHost, world: LoopWorld, o: ChartOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const { bodies, cx, cy, sinE, Rmax } = world;
  const lr = host.fork('last-loop-chart');
  const grain = createGrain(lr);
  let phone = W < 600;
  // Where the chart sits: the middle of the screen, a little down to leave the title room.
  let MX = W / 2;
  let MY = H / 2;
  let ms = 1;
  const layout = () => {
    phone = W < 600;
    MX = W / 2;
    MY = H / 2 + (phone ? 30 : 14);
    ms = Math.min(W * 0.46, H * (phone ? 0.36 : 0.42)) / (Rmax * 1.12);
  };
  layout();
  /** The plane of the orbits to the chart; and the scene's picture to the plane. */
  const mx = (X: number) => MX + X * ms;
  const my = (Z: number) => MY + Z * ms;
  const fromScene = (x: number, y: number): [number, number] => [x - cx, (y - cy) / sinE];
  const rOf = (b: Body) => Math.max(b.kind === 'comet' || b.kind === 'station' ? 3 : 3.5, Math.min(phone ? 14 : 20, b.r * ms * 0.55));

  // ---- the paper: baked for a size ----------------------------------------------------------------------
  let paper: HTMLCanvasElement | null = null;
  let paperKey = '';
  const wob = Math.floor(lr() * 1e6);
  function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, amp = 0.004) {
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU;
      const rr = r * (1 + amp * Math.sin(a * 3 + seed) + amp * 0.5 * Math.sin(a * 7 + seed * 2));
      if (i) g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  function bakePaper(dpr: number) {
    const key = `${W}x${H}@${dpr}`;
    if (paper && key === paperKey) return;
    paperKey = key;
    paper = document.createElement('canvas');
    paper.width = Math.max(1, Math.round(W * dpr));
    paper.height = Math.max(1, Math.round(H * dpr));
    const g = paper.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createRadialGradient(MX, MY, 0, MX, MY, Math.hypot(W, H) * 0.6);
    bg.addColorStop(0, '#1b2740');
    bg.addColorStop(0.6, '#121b30');
    bg.addColorStop(1, '#0a1020');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // Stains and the tooth of the paper.
    for (let i = 0; i < 40; i++) {
      const x = lr() * W;
      const y = lr() * H;
      const r = (0.05 + lr() * 0.2) * Math.min(W, H);
      const sg = g.createRadialGradient(x, y, 0, x, y, r);
      const warm = lr() < 0.5;
      sg.addColorStop(0, warm ? 'rgba(80,70,60,0.06)' : 'rgba(10,14,26,0.12)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = 'rgba(220,210,190,0.035)';
    g.lineWidth = 0.6;
    g.beginPath();
    for (let i = 0; i < 1400; i++) {
      const x = lr() * W;
      const y = lr() * H;
      const a = lr() * TAU;
      const l = 2 + lr() * 7;
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
    // The printed grid: rings and bearings, faint.
    const Rc = Rmax * 1.08 * ms;
    g.strokeStyle = hexA(INK, 0.07);
    g.lineWidth = 0.8;
    g.setLineDash([1.5, 5]);
    for (let i = 1; i <= 10; i++) {
      g.beginPath();
      g.arc(MX, MY, (Rc * i) / 10.5, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);
    g.beginPath();
    for (let d = 0; d < 360; d += 15) {
      const a = (d * Math.PI) / 180;
      g.moveTo(MX + Math.cos(a) * Rc * 0.12, MY + Math.sin(a) * Rc * 0.12);
      g.lineTo(MX + Math.cos(a) * Rc * 0.97, MY + Math.sin(a) * Rc * 0.97);
    }
    g.stroke();
    // The rim: a double ring, with the loop's minutes round it.
    g.strokeStyle = hexA(INK, 0.55);
    g.lineWidth = 1.4;
    ring(g, MX, MY, Rc, wob);
    g.stroke();
    g.lineWidth = 0.8;
    ring(g, MX, MY, Rc + 12, wob + 3);
    g.stroke();
    const mins = Math.round(world.loopLen / 60);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < mins * 4; i++) {
      const a = -Math.PI / 2 + (i / (mins * 4)) * TAU;
      const l = i % 4 === 0 ? 8 : 3;
      g.moveTo(MX + Math.cos(a) * Rc, MY + Math.sin(a) * Rc);
      g.lineTo(MX + Math.cos(a) * (Rc + l), MY + Math.sin(a) * (Rc + l));
    }
    g.stroke();
    g.font = SERIF(phone ? 9 : 10, true);
    g.fillStyle = hexA(INK, 0.6);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < mins; i += phone ? 4 : 2) {
      const a = -Math.PI / 2 + (i / mins) * TAU;
      g.fillText(String(i), MX + Math.cos(a) * (Rc + 24), MY + Math.sin(a) * (Rc + 24));
    }
    // A compass rose's star at the top of the rim.
    g.fillStyle = hexA(INK, 0.5);
    g.beginPath();
    g.moveTo(MX, MY - Rc - 40);
    g.lineTo(MX + 4, MY - Rc - 30);
    g.lineTo(MX, MY - Rc - 33);
    g.lineTo(MX - 4, MY - Rc - 30);
    g.fill();
    // The rubble belt: stippled.
    if (world.belt[0] > 0) {
      g.fillStyle = hexA(INK, 0.28);
      for (let i = 0; i < 700; i++) {
        const a = lr() * TAU;
        const r = (world.belt[0] + (lr() + lr() - 1) * world.belt[1]) * ms;
        g.fillRect(MX + Math.cos(a) * r, MY + Math.sin(a) * r, 0.9, 0.9);
      }
    }
  }

  // ---- a frame ------------------------------------------------------------------------------------
  function paint(t: number) {
    const dpr = ctx.getTransform().a || 1;
    bakePaper(dpr);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paper!, 0, 0);
    ctx.restore();
    const S = world.sun;
    const Rc = Rmax * 1.08 * ms;
    const level = 0.6 + 0.4 * host.intensity;
    const sunC = toRGB(S.color);
    // The loop so far, washed round the rim in the sun's colour.
    const q = world.tau / world.loopLen;
    ctx.strokeStyle = rgbA(world.phase === 'nova' || world.phase === 'dark' ? [190, 220, 255] : sunC, 0.55);
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(MX, MY, Rc + 6, -Math.PI / 2, -Math.PI / 2 + q * TAU);
    ctx.stroke();
    // The hand of the clock: a brass pointer at now.
    const ha = -Math.PI / 2 + q * TAU;
    ctx.fillStyle = '#e0b060';
    ctx.beginPath();
    ctx.moveTo(MX + Math.cos(ha) * (Rc - 8), MY + Math.sin(ha) * (Rc - 8));
    ctx.lineTo(MX + Math.cos(ha + 0.03) * (Rc + 16), MY + Math.sin(ha + 0.03) * (Rc + 16));
    ctx.lineTo(MX + Math.cos(ha - 0.03) * (Rc + 16), MY + Math.sin(ha - 0.03) * (Rc + 16));
    ctx.fill();
    ctx.font = SERIF(phone ? 11 : 13, false, '600');
    ctx.textAlign = 'center';
    ctx.fillStyle = hexA('#f6ead2', 0.9 * level);
    fillCrisp(ctx, world.phase === 'nova' || world.phase === 'dark' ? '—:—' : `${Math.floor(world.tau / 60)}:${String(Math.floor(world.tau % 60)).padStart(2, '0')}`, MX + Math.cos(ha) * (Rc + 40), MY + Math.sin(ha) * (Rc + 40) + 4);

    // Orbits, inked.
    ctx.strokeStyle = hexA(INK, 0.4);
    ctx.lineWidth = 1;
    for (const b of bodies) {
      if (b.parent !== -1 || b.kind === 'twinB' || b.kind === 'comet' || b.kind === 'shy' || b.kind === 'station') continue;
      ctx.beginPath();
      ctx.arc(MX, MY, b.a * ms, 0, TAU);
      ctx.stroke();
    }
    // The comet's long ellipse, dashed.
    const C = bodies[world.comet];
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(190,225,255,0.4)';
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const E = (i / 90) * TAU;
      const px = C.a * (Math.cos(E) - world.cometE);
      const pz = C.a * Math.sqrt(1 - world.cometE ** 2) * Math.sin(E);
      const X = px * Math.cos(world.cometW) - pz * Math.sin(world.cometW);
      const Z = px * Math.sin(world.cometW) + pz * Math.cos(world.cometW);
      if (i) ctx.lineTo(mx(X), my(Z));
      else ctx.moveTo(mx(X), my(Z));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // The probe's bearings, loop after loop, ruled out to the rim.
    world.probeLog.forEach((p, i) => {
      const latest = i === world.probeLog.length - 1 && p.loop === world.loop;
      const x0 = mx(p.X);
      const y0 = my(p.Z);
      // Out from where it was fired to the rim.
      const dxs = Math.cos(p.bearing);
      const dys = Math.sin(p.bearing) / sinE;
      const l = Math.hypot(dxs, dys);
      const ux = dxs / l;
      const uy = dys / l;
      const bx = x0 - MX;
      const by = y0 - MY;
      const bdu = bx * ux + by * uy;
      const tt = -bdu + Math.sqrt(Math.max(0, bdu * bdu - (bx * bx + by * by - Rc * Rc)));
      ctx.strokeStyle = latest ? 'rgba(190,230,255,0.75)' : `rgba(170,210,240,${(0.15 + 0.25 * (i / world.probeLog.length)).toFixed(3)})`;
      ctx.lineWidth = latest ? 1.4 : 1;
      ctx.setLineDash(latest ? [] : [6, 4]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + ux * tt, y0 + uy * tt);
      ctx.stroke();
      ctx.setLineDash([]);
      if (o.labels && !phone) {
        ctx.font = SERIF(9, true);
        ctx.fillStyle = hexA('#bfe0f4', latest ? 0.85 : 0.5);
        ctx.textAlign = 'center';
        fillCrisp(ctx, `loop ${p.loop}`, x0 + ux * (tt - 14), y0 + uy * (tt - 14));
      }
    });

    // The sun: a watercolour blot, with inked rays.
    if (S.r > 0.5 && world.phase !== 'dark') {
      const sr = Math.max(4, S.r * ms * 0.8);
      const g = ctx.createRadialGradient(MX, MY, 0, MX, MY, sr * 2.2);
      g.addColorStop(0, rgbA(mixRGB(sunC, [255, 250, 230], 0.5), 0.95));
      g.addColorStop(0.42, rgbA(sunC, 0.85));
      g.addColorStop(0.48, rgbA(sunC, 0.3));
      g.addColorStop(1, rgbA(sunC, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(MX, MY, sr * 2.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgbA(mixRGB(sunC, [255, 240, 210], 0.3), 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + t * 0.02;
        const l = sr * (i % 2 ? 1.45 : 1.75);
        ctx.moveTo(MX + Math.cos(a) * sr * 1.12, MY + Math.sin(a) * sr * 1.12);
        ctx.quadraticCurveTo(MX + Math.cos(a + 0.08) * sr * 1.35, MY + Math.sin(a + 0.08) * sr * 1.35, MX + Math.cos(a) * l, MY + Math.sin(a) * l);
      }
      ctx.stroke();
      ctx.strokeStyle = hexA(INK, 0.6);
      ctx.lineWidth = 1;
      ring(ctx, MX, MY, sr, wob + 7, 0.02);
      ctx.stroke();
    }

    // The ship's road this loop, dotted, and its course now.
    const s = world.ship;
    const [sX, sZ] = fromScene(s.x, s.y);
    if (world.route.length && s.state !== 'gone') {
      ctx.strokeStyle = 'rgba(240,160,80,0.55)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([1.5, 4]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      const road = world.route.slice(-6);
      road.forEach((p, i) => (i ? ctx.lineTo(mx(p.X), my(p.Z)) : ctx.moveTo(mx(p.X), my(p.Z))));
      ctx.lineTo(mx(sX), my(sZ));
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of road) {
        ctx.fillStyle = 'rgba(240,160,80,0.7)';
        ctx.beginPath();
        ctx.arc(mx(p.X), my(p.Z), 1.8, 0, TAU);
        ctx.fill();
      }
    }

    // The worlds.
    const placed: [number, number, number][] = [];
    const notes = noteFor();
    for (const b of bodies) {
      if (b.gone) continue;
      const x = mx(b.X);
      const y = my(b.Z);
      const r = rOf(b);
      const pal = WASH[b.kind] ?? [[200, 200, 200]];
      const c = pal[b.variant % pal.length];
      if (b.kind === 'comet') {
        // A small ice star with its tail inked away from the sun.
        const away = Math.atan2(y - MY, x - MX);
        const len = (14 + 40 * Math.pow(clamp01(1 - Math.hypot(b.X, b.Z) / Rmax), 2)) * (phone ? 0.7 : 1);
        ctx.strokeStyle = world.cometCracked >= 0 ? 'rgba(210,170,255,0.8)' : 'rgba(200,230,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = -1; i <= 1; i++) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(away + i * 0.08) * len, y + Math.sin(away + i * 0.08) * len);
        }
        ctx.stroke();
      }
      if (b.kind === 'station') {
        ctx.strokeStyle = hexA(INK, 0.85);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x - 3, y - 3, 6, 6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(world.aim) * 10, y + (Math.sin(world.aim) / sinE) * 10 * 0.6);
        ctx.stroke();
        continue;
      }
      // The wash, with the night side (away from the sun) shaded.
      const sa = Math.atan2(MY - y, MX - x);
      const wg = ctx.createRadialGradient(x + Math.cos(sa) * r * 0.4, y + Math.sin(sa) * r * 0.4, r * 0.1, x, y, r * 1.05);
      wg.addColorStop(0, rgbA(mixRGB(c, [255, 245, 225], 0.25), 0.95));
      wg.addColorStop(0.6, rgbA(c, 0.9));
      wg.addColorStop(1, rgbA([c[0] * 0.35, c[1] * 0.35, c[2] * 0.45], 0.95));
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexA(INK, b.kind === 'shy' ? 0.5 : 0.75);
      ctx.lineWidth = 1;
      if (b.kind === 'shy') ctx.setLineDash([2, 3]);
      ring(ctx, x, y, r, b.id * 13 + wob, 0.04);
      ctx.stroke();
      ctx.setLineDash([]);
      // A sigil for each world.
      sigil(b, x, y, r);
      if (b.kind === 'ocean' && world.ringed) {
        ctx.strokeStyle = hexA(INK, 0.45);
        ctx.beginPath();
        ctx.arc(x, y, r * 1.7, 0, TAU);
        ctx.stroke();
      }
      // Campfires burning.
      for (const camp of world.camps) {
        if (camp.body !== b.id || !camp.playing) continue;
        const fa = -Math.PI / 2 + camp.id * 0.9;
        const fx = x + Math.cos(fa) * (r + 5);
        const fy = y + Math.sin(fa) * (r + 5);
        const fl = 0.8 + 0.2 * Math.sin(t * 9 + camp.id);
        ctx.fillStyle = hexA(camp.fire, 0.95);
        ctx.beginPath();
        ctx.moveTo(fx - 2.4, fy + 2);
        ctx.quadraticCurveTo(fx - 2, fy - 3 * fl, fx, fy - 5 * fl);
        ctx.quadraticCurveTo(fx + 2, fy - 3 * fl, fx + 2.4, fy + 2);
        ctx.fill();
      }
      // The name, hand-lettered, and a note on the main worlds.
      if (!o.labels || b.kind === 'cinder' || (phone && (b.kind === 'moon' || b.kind === 'shy'))) continue;
      const small = b.kind === 'moon' || b.kind === 'shy';
      const px = phone ? (small ? 10 : 12) : small ? 11 : 14;
      ctx.font = SERIF(px, true);
      const name = b.name.charAt(0).toUpperCase() + b.name.slice(1);
      const w = ctx.measureText(name).width;
      let ly = y + r + px + 2;
      for (let n = 0; n < 3 && placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 6 && Math.abs(qy - ly) < px + 4); n++) ly += px + 4;
      if (placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + w) / 2 + 6 && Math.abs(qy - ly) < px + 4)) continue;
      placed.push([x, ly, w]);
      letter(ctx, name, x, ly, px, '#f6ead2', 0.92 * level);
      const note = notes[b.id];
      if (note && !phone) {
        ctx.font = SERIF(10, true);
        const nw = ctx.measureText(note).width;
        if (!placed.some(([qx, qy, qw]) => Math.abs(qx - x) < (qw + nw) / 2 + 6 && Math.abs(qy - (ly + 13)) < 12)) {
          placed.push([x, ly + 13, nw]);
          letter(ctx, note, x, ly + 13, 10, '#cdbf9f', 0.8 * level);
        }
      }
      // What the log knows of it: an orange dot an entry.
      const known = world.log.filter((e) => e.body === b.id).length;
      for (let i = 0; i < Math.min(5, known); i++) {
        ctx.fillStyle = 'rgba(240,168,96,0.85)';
        ctx.beginPath();
        ctx.arc(x + r + 5 + i * 5, y - r * 0.6, 1.6, 0, TAU);
        ctx.fill();
      }
    }
    // The sand running between the twins.
    const A = bodies[world.twinA];
    const B = bodies[world.twinB];
    if (!A.gone && !B.gone && world.sand > 0) {
      ctx.strokeStyle = 'rgba(232,180,110,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 2]);
      ctx.lineDashOffset = -t * 8;
      ctx.beginPath();
      ctx.moveTo(mx(A.X), my(A.Z));
      ctx.lineTo(mx(B.X), my(B.Z));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // The white hole, if there is one.
    if (world.whiteHole) {
      const [wa, wr] = world.whiteHole;
      const x = mx(Math.cos(wa) * wr);
      const y = my(Math.sin(wa) * wr);
      ctx.strokeStyle = 'rgba(240,245,255,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * 9 + t * 0.4;
        const rr = 1 + (i / 30) * 7;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.stroke();
      if (o.labels && !phone) letter(ctx, 'the white hole', x, y + 20, 11, '#e6ecf6', 0.8 * level);
    }
    // The ship itself, a little orange arrow, and its course to where it is going.
    if (s.state !== 'gone' && s.state !== 'docked') {
      const tgt = s.to >= 0 ? bodies[s.to] : null;
      if (tgt && (s.state === 'cruise' || s.state === 'launch')) {
        const tx = mx(tgt.X);
        const ty = my(tgt.Z);
        const a = Math.atan2(ty - my(sZ), tx - mx(sX));
        const tr = rOf(tgt) + 5;
        const ex = tx - Math.cos(a) * tr;
        const ey = ty - Math.sin(a) * tr;
        ctx.strokeStyle = 'rgba(250,180,100,0.75)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(mx(sX), my(sZ));
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(250,180,100,0.9)';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - Math.cos(a - 0.4) * 7, ey - Math.sin(a - 0.4) * 7);
        ctx.lineTo(ex - Math.cos(a + 0.4) * 7, ey - Math.sin(a + 0.4) * 7);
        ctx.fill();
      }
      const ha2 = Math.atan2(Math.sin(s.ang) / sinE, Math.cos(s.ang));
      const x = mx(sX);
      const y = my(sZ);
      ctx.fillStyle = '#ffb060';
      ctx.strokeStyle = '#2a1608';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ha2) * 7, y + Math.sin(ha2) * 7);
      ctx.lineTo(x + Math.cos(ha2 + 2.5) * 5, y + Math.sin(ha2 + 2.5) * 5);
      ctx.lineTo(x + Math.cos(ha2 + Math.PI) * 2, y + Math.sin(ha2 + Math.PI) * 2);
      ctx.lineTo(x + Math.cos(ha2 - 2.5) * 5, y + Math.sin(ha2 - 2.5) * 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Things in flight: the probe, meteors.
    for (const p of world.probes) {
      const [X, Z] = fromScene(p.x, p.y);
      ctx.fillStyle = '#e8f8ff';
      ctx.beginPath();
      ctx.arc(mx(X), my(Z), 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.lineWidth = 1;
    for (const m of world.meteors) {
      const [X, Z] = fromScene(m.x, m.y);
      const [X0, Z0] = fromScene(m.sx, m.sy);
      const a = Math.atan2(Z - Z0, X - X0);
      ctx.strokeStyle = m.kind === 'lava' ? 'rgba(255,150,80,0.9)' : 'rgba(220,235,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(mx(X), my(Z));
      ctx.lineTo(mx(X) - Math.cos(a) * 8, my(Z) - Math.sin(a) * 8);
      ctx.stroke();
    }
    focus(t);

    // The end: the shockwave washing over the sheet, the dark, and the sheet coming back.
    if (world.sun.shock > 0 && (world.phase === 'nova' || world.phase === 'dark')) {
      const r = world.sun.shock * ms;
      const g = ctx.createRadialGradient(MX, MY, 0, MX, MY, r);
      g.addColorStop(0, 'rgba(120,170,240,0.35)');
      g.addColorStop(0.9, 'rgba(170,210,255,0.45)');
      g.addColorStop(1, 'rgba(230,245,255,0.8)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(MX, MY, r, 0, TAU);
      ctx.fill();
    }
    if (world.phase === 'nova' && S.nova > 0.01) {
      ctx.fillStyle = `rgba(230,242,255,${(0.85 * S.nova).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'nova' || world.phase === 'dark') {
      const n = world.t - world.phaseT;
      const k = world.phase === 'dark' ? 0.75 + 0.2 * smooth(0, 2, n) : 0.75 * smooth(8, 16, n);
      ctx.fillStyle = `rgba(4,6,14,${k.toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (world.phase === 'wake' && world.tau < 3) {
      ctx.fillStyle = `rgba(4,6,14,${(0.9 * (1 - smooth(0, 3, world.tau))).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    grain(ctx, W, H, t, 0.04);
    const opts = { W, H, level, phone, hud: o.hud, labels: o.labels };
    drawTitle(ctx, world, t, opts, 0);
    drawSubtitle(ctx, world, t, opts);
  }

  /** A short note under the main worlds: what the loop has done to them. */
  function noteFor(): Record<number, string> {
    const left = world.shards.filter((q) => !q.fallen).length;
    const out: Record<number, string> = {};
    out[world.twinA] = `sand ${Math.round(world.sand * 100)}%`;
    out[world.twinB] = `sand ${Math.round((1 - world.sand) * 100)}%`;
    out[world.crumble] = `${left} of ${world.shards.length} shards`;
    out[world.ocean] = world.islands.some((i) => i.state !== 'sea') ? 'an island aloft' : `${world.tornadoes.length} storms`;
    out[world.home] = world.ship.state === 'docked' ? 'the ship on its tower' : 'home';
    out[world.station] = 'probe cannon';
    return out;
  }
  function sigil(b: Body, x: number, y: number, r: number) {
    if (r < 6) return;
    ctx.strokeStyle = 'rgba(20,16,12,0.55)';
    ctx.fillStyle = 'rgba(20,16,12,0.55)';
    ctx.lineWidth = 1;
    const s = r * 0.5;
    ctx.beginPath();
    if (b.kind === 'home') {
      // A little pine.
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.6, y + s * 0.4);
      ctx.lineTo(x - s * 0.6, y + s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(x - 0.6, y + s * 0.4, 1.2, s * 0.4);
    } else if (b.kind === 'twinA' || b.kind === 'twinB') {
      // An hourglass.
      ctx.moveTo(x - s * 0.5, y - s * 0.7);
      ctx.lineTo(x + s * 0.5, y - s * 0.7);
      ctx.lineTo(x - s * 0.5, y + s * 0.7);
      ctx.lineTo(x + s * 0.5, y + s * 0.7);
      ctx.closePath();
      ctx.stroke();
    } else if (b.kind === 'crumble') {
      // A cracked ring round a black dot.
      ctx.arc(x, y, s * 0.35, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.8, y - s * 0.3);
      ctx.lineTo(x - s * 0.3, y);
      ctx.lineTo(x - s * 0.7, y + s * 0.5);
      ctx.moveTo(x + s * 0.8, y + s * 0.2);
      ctx.lineTo(x + s * 0.4, y - s * 0.1);
      ctx.stroke();
    } else if (b.kind === 'ocean') {
      // A swirl.
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * 7;
        const rr = s * 0.1 + (i / 24) * s * 0.8;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.stroke();
    } else if (b.kind === 'thorn') {
      // Thorns.
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        ctx.moveTo(x + Math.cos(a) * s * 0.2, y + Math.sin(a) * s * 0.2);
        ctx.lineTo(x + Math.cos(a + 0.3) * s * 0.9, y + Math.sin(a + 0.3) * s * 0.9);
      }
      ctx.stroke();
    } else if (b.kind === 'shy') {
      ctx.font = SERIF(Math.max(8, r * 1.2), true);
      ctx.textAlign = 'center';
      fillCrisp(ctx, '?', x, y + r * 0.4);
    }
  }
  /** A ring round what the subtitle is about. */
  function focus(t: number) {
    const s = world.sub;
    if (!s || !o.labels || s.body < 0) return;
    const b = bodies[s.body];
    if (!b || b.gone) return;
    const age = t - s.t0;
    const a = Math.min(1, age * 2.5, (s.dur - age) / 0.8);
    if (a <= 0) return;
    ctx.save();
    ctx.strokeStyle = `rgba(250,190,110,${(0.8 * a).toFixed(3)})`;
    ctx.lineWidth = 1.3;
    ctx.setLineDash([3, 4]);
    ctx.lineDashOffset = -t * 6;
    ctx.beginPath();
    ctx.arc(mx(b.X), my(b.Z), rOf(b) + 8 + (1 - Math.min(1, age * 2)) * 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  void hash;

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => {
      const [X, Z] = fromScene(x, y);
      return [mx(X), my(Z)];
    },
    unproject: (x, y) => {
      const X = (x - MX) / ms;
      const Z = (y - MY) / ms;
      return [cx + X, cy + Z * sinE];
    },
    after: () => {
      world.view = { x: world.GW / 2, y: world.GH / 2, zoom: 1, fit: 1 };
    },
    paint: (t) => paint(t),
    ambience: () => (world.phase === 'nova' ? 1 : world.phase === 'dark' ? 0.1 : 0.4 + world.sun.age * 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
      layout();
    },
  });
}
