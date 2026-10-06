/**
 * Leylines in ink: the mount.
 *
 * The medium is drawn once (night ink-wash, a star chart, black lacquer, or vellum when the
 * page is light), with the land on it: hill shading from the light, contours, coasts,
 * stipple and hatching by the land's blend. Then, every frame, the orders' lines: each
 * order's trail through its own ramp (glowing on the dark media, inked on vellum), pulses
 * of power running out from the wells along the networks, and the land's faint memory of
 * routes that are gone. Over them, the wells, the orders' sigils where they hold, sparks at
 * the borders, the drawn phenomena, bloom and grain; then title cards for the big moments,
 * and (with `hud`) one line of what this world is.
 */
import type { SkinHost, SkinInstance } from '../../../core/skin';
import { createBloom, createCamera, createCaptions, createGlow, createGrain, inkRamp, makeRamp, runWorld, serifFont, vignette, type Ramp } from '../../../kit';
import { fillCrisp, hexA, mixRgb } from '../../instruments/kit';
import { isoPath } from '../iso';
import { createInkWorld, titleCase, type InkWorld, type Order, type Well } from './sim';

export function mountInk(host: SkinHost, o: { land: string; orders: number; storms: number; rifts: number; scale: number; labels: boolean; hud: boolean }): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: InkWorld = createInkWorld(host.config.seed, W, H, { land: o.land, orders: o.orders, storms: o.storms, rifts: o.rifts, scale: o.scale }, host.noise, host.palette);
  const { cols, rows, cell } = world;
  const N = cols * rows;
  const medium = world.medium;
  const dark = medium !== 'vellum';
  const camera = createCamera(W, H, 1.5);
  const glow = createGlow(0.3);
  const bloom = createBloom();
  const grain = createGrain(host.fork('grain'));
  const captions = createCaptions();
  let told = 0;

  // ---- the medium ---------------------------------------------------------------------------------

  const tones = {
    night: { base: '#0b0d1a', low: '#141a2e', sea: '#060914', line: '#2a3352', hill: [255, 245, 230] },
    starchart: { base: '#07122a', low: '#0c1a3a', sea: '#050d20', line: '#1f3b6e', hill: [200, 220, 255] },
    lacquer: { base: '#0d0706', low: '#1c0f0c', sea: '#080404', line: '#4a2a1a', hill: [255, 210, 160] },
    vellum: { base: '#e8dcc0', low: '#d9c8a2', sea: '#c7b994', line: '#8a6a44', hill: [60, 40, 20] },
  }[medium];
  let bg: HTMLCanvasElement | null = null;
  function paintMedium() {
    bg = document.createElement('canvas');
    bg.width = Math.ceil(W);
    bg.height = Math.ceil(H);
    const g = bg.getContext('2d')!;
    const r = host.fork('medium');
    // The land at grid resolution, shaded from the light.
    const small = document.createElement('canvas');
    small.width = cols;
    small.height = rows;
    const sg = small.getContext('2d')!;
    const img = sg.createImageData(cols, rows);
    const base = mixRgb(tones.base, tones.base, 0);
    const low = mixRgb(tones.low, tones.low, 0);
    const sea = mixRgb(tones.sea, tones.sea, 0);
    const lx = host.light.dx || -0.6;
    const ly = host.light.dy || -0.6;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const h = world.height[i];
      const hx = (world.height[i + (x < cols - 1 ? 1 : 0)] - world.height[i - (x > 0 ? 1 : 0)]) * 4;
      const hy = (world.height[i + (y < rows - 1 ? cols : 0)] - world.height[i - (y > 0 ? cols : 0)]) * 4;
      const shade = Math.max(-1, Math.min(1, -(hx * lx + hy * ly)));
      const isSea = world.wall[i] === 1 && h < 0.3;
      const c = isSea ? sea : [low[0] + (base[0] - low[0]) * Math.max(0, Math.min(1, h + 0.5)), low[1] + (base[1] - low[1]) * Math.max(0, Math.min(1, h + 0.5)), low[2] + (base[2] - low[2]) * Math.max(0, Math.min(1, h + 0.5))];
      const k = isSea ? 0 : shade * (dark ? 10 : 14);
      const n = (r() - 0.5) * (dark ? 6 : 10);
      img.data[i * 4] = c[0] + k * (tones.hill[0] / 255) + n;
      img.data[i * 4 + 1] = c[1] + k * (tones.hill[1] / 255) + n;
      img.data[i * 4 + 2] = c[2] + k * (tones.hill[2] / 255) + n;
      img.data[i * 4 + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, W, H);
    // Contours and coasts.
    g.lineWidth = 0.8;
    for (let lv = -0.4; lv < 1; lv += 0.14) {
      g.strokeStyle = hexA(tones.line, dark ? 0.35 : 0.45);
      g.beginPath();
      isoPath(g, world.height, cols, rows, cell, lv, cell / 2, cell / 2);
      g.stroke();
    }
    const coast = new Float32Array(N);
    for (let i = 0; i < N; i++) coast[i] = world.wall[i] === 1 && world.height[i] < 0.3 ? 1 : 0;
    g.lineWidth = 1.4;
    g.strokeStyle = hexA(dark ? '#5b6b9a' : '#5c4024', 0.7);
    g.beginPath();
    isoPath(g, coast, cols, rows, cell, 0.5, cell / 2, cell / 2);
    g.stroke();
    // The land's texture by its blend: stipple for woods, hatching for ridges, specks of snow,
    // ripples on the sea, dune lines.
    const L = world.land;
    for (let k = 0; k < N * 0.6; k++) {
      const x = r() * W;
      const y = r() * H;
      const i = world.idx(x, y);
      const h = world.height[i];
      if (world.wall[i] === 1 && h < 0.3) {
        if (r() < 0.12) {
          g.strokeStyle = hexA(tones.line, dark ? 0.25 : 0.35);
          g.beginPath();
          g.moveTo(x - 4, y);
          g.quadraticCurveTo(x, y - 2, x + 4, y);
          g.stroke();
        }
        continue;
      }
      const roll = r();
      if (roll < L.forest * 0.5) {
        g.fillStyle = hexA(dark ? '#0a1a10' : '#4a5a30', dark ? 0.55 : 0.4);
        g.fillRect(x, y, 1.6, 1.6);
      } else if (roll < L.forest * 0.5 + L.mountains * 0.3 && h > 0.35) {
        g.strokeStyle = hexA(tones.line, 0.4);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 3, y - 5);
        g.lineTo(x + 6, y);
        g.stroke();
      } else if (roll < L.forest * 0.5 + L.mountains * 0.3 + L.tundra * 0.25) {
        g.fillStyle = hexA('#e2e8f0', dark ? 0.1 : 0.4);
        g.fillRect(x, y, 1, 1);
      } else if (roll < L.forest * 0.5 + L.mountains * 0.3 + L.tundra * 0.25 + L.desert * 0.15) {
        g.strokeStyle = hexA(dark ? '#3a2e1c' : '#a37c48', 0.35);
        g.beginPath();
        g.moveTo(x - 5, y);
        g.quadraticCurveTo(x, y - 3, x + 5, y);
        g.stroke();
      } else if (roll < L.forest * 0.5 + L.mountains * 0.3 + L.tundra * 0.25 + L.desert * 0.15 + L.marsh * 0.2) {
        g.strokeStyle = hexA(tones.line, 0.3);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - 4);
        g.stroke();
      }
    }
    // The medium's own marks.
    if (medium === 'starchart') {
      g.strokeStyle = hexA('#3b5b9a', 0.25);
      g.lineWidth = 0.8;
      for (let k = 1; k < 8; k++) {
        g.beginPath();
        g.ellipse(W / 2, H * 1.6, W * (0.25 + k * 0.18), H * (0.5 + k * 0.22), 0, Math.PI, Math.PI * 2);
        g.stroke();
      }
      for (let k = -6; k <= 6; k++) {
        g.beginPath();
        g.moveTo(W / 2 + k * W * 0.08, H * 1.2);
        g.quadraticCurveTo(W / 2 + k * W * 0.09, H * 0.2, W / 2 + k * W * 0.11, -20);
        g.stroke();
      }
      for (let k = 0; k < 900; k++) {
        const b = r() ** 3;
        g.fillStyle = `rgba(226,232,255,${(0.15 + b * 0.8).toFixed(2)})`;
        g.fillRect(r() * W, r() * H, b > 0.8 ? 2 : 1, b > 0.8 ? 2 : 1);
      }
    } else if (medium === 'night') {
      for (let k = 0; k < 300; k++) {
        g.fillStyle = `rgba(226,232,240,${(0.05 + r() * 0.2).toFixed(2)})`;
        g.fillRect(r() * W, r() * H, 1, 1);
      }
    } else if (medium === 'lacquer') {
      // Gold flecks and a crackle in the lacquer.
      for (let k = 0; k < 500; k++) {
        g.fillStyle = `rgba(212,160,60,${(0.08 + r() * 0.25).toFixed(2)})`;
        g.fillRect(r() * W, r() * H, 1 + r(), 1);
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.6;
      for (let k = 0; k < 60; k++) {
        let x = r() * W;
        let y = r() * H;
        g.beginPath();
        g.moveTo(x, y);
        for (let s = 0; s < 8; s++) {
          x += (r() - 0.5) * 40;
          y += (r() - 0.5) * 40;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    } else {
      // Vellum: foxing, fibres, and a ruled border like an old map's.
      for (let k = 0; k < 40; k++) {
        const x = r() * W;
        const y = r() * H;
        const rr = 10 + r() * 60;
        const gr = g.createRadialGradient(x, y, 0, x, y, rr);
        gr.addColorStop(0, 'rgba(140,100,50,0.12)');
        gr.addColorStop(1, 'rgba(140,100,50,0)');
        g.fillStyle = gr;
        g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      }
      g.strokeStyle = 'rgba(92,64,36,0.6)';
      g.lineWidth = 1.5;
      g.strokeRect(14, 14, W - 28, H - 28);
      g.lineWidth = 0.6;
      g.strokeRect(20, 20, W - 40, H - 40);
    }
  }

  // ---- the ink -------------------------------------------------------------------------------------
  //
  // Two layers. The halo: each order's trail field at grid resolution, dim, through its ramp
  // (where its territory and lines lie, soft). The threads: every mover drawn as a point into
  // a half-resolution buffer that fades a little each frame, so the movers trace the network
  // as fine bright filaments, flowing; power pulsing out from the wells makes the movers it
  // reaches brighter.

  let halo: HTMLCanvasElement | null = null;
  let hg: CanvasRenderingContext2D | null = null;
  let haloImg: ImageData | null = null;
  let threads: HTMLCanvasElement | null = null;
  let tg: CanvasRenderingContext2D | null = null;
  let threadImg: ImageData | null = null;
  let TW = 0;
  let TH = 0;
  const ramps: Ramp[] = world.orders.map((ord) => rampFor(ord));
  function rampFor(ord: Order): Ramp {
    if (ord.hostile) return dark ? makeRamp([[0, '#000000'], [0.4, '#2e1065'], [0.8, '#7e22ce'], [1, '#bef264']]) : makeRamp([[0, '#ffffff'], [0.4, '#c4b5fd'], [0.8, '#3b0764'], [1, '#14051f']]);
    if (dark) return inkRamp(ord.color, '#000000', medium === 'lacquer' ? '#fff7d6' : '#fffaf0');
    return makeRamp([[0, '#ffffff'], [0.3, mixHex(ord.color, '#ffffff', 0.7)], [0.75, ord.color], [1, mixHex(ord.color, '#000000', 0.5)]]);
  }
  // Each order's thread color (bright on the dark media, ink on vellum).
  const threadRgb = () => world.orders.map((ord) => (ord.hostile ? (dark ? [190, 242, 100] : [59, 7, 100]) : dark ? mixRgb(ord.color, '#ffffff', 0.2) : mixRgb(ord.color, '#000000', 0.45)));
  let tRgb = threadRgb();
  const ley = mixRgb(host.palette.accent, '#ffffff', 0.3);
  /** How much each cell keeps (1) or recedes (0) behind page content, refreshed now and then. */
  const keep = new Float32Array(N).fill(1);
  let nextQuiet = 0;
  function quietMask(t: number) {
    if (t < nextQuiet) return;
    nextQuiet = t + 2;
    for (let i = 0; i < N; i++) keep[i] = 1 - 0.88 * host.quiet(sx(((i % cols) + 0.5) * cell), sy((Math.floor(i / cols) + 0.5) * cell));
  }
  function paintInk(t: number) {
    quietMask(t);
    if (!halo) {
      halo = document.createElement('canvas');
      halo.width = cols;
      halo.height = rows;
      hg = halo.getContext('2d')!;
      haloImg = hg.createImageData(cols, rows);
      TW = Math.max(2, Math.ceil(W / 2));
      TH = Math.max(2, Math.ceil(H / 2));
      threads = document.createElement('canvas');
      threads.width = TW;
      threads.height = TH;
      tg = threads.getContext('2d')!;
      threadImg = tg.createImageData(TW, TH);
      const td = threadImg.data;
      for (let i = 0; i < TW * TH; i++) {
        td[i * 4] = td[i * 4 + 1] = td[i * 4 + 2] = dark ? 0 : 255;
        td[i * 4 + 3] = 255;
      }
    }
    // The halo.
    const d = haloImg!.data;
    const slots = world.orders.filter((x) => x.alive);
    for (let i = 0; i < N; i++) {
      let r = dark ? 0 : 255;
      let g = dark ? 0 : 255;
      let b = dark ? 0 : 255;
      for (const ord of slots) {
        const v = world.phys.trails[ord.slot].data[i] * world.norm[ord.slot];
        if (v < 0.03) continue;
        const k = Math.min(200, (v * 150) | 0) * 3;
        const ramp = ramps[ord.slot];
        if (dark) {
          r += ramp[k] * 0.55;
          g += ramp[k + 1] * 0.55;
          b += ramp[k + 2] * 0.55;
        } else {
          r = (r * (255 - (255 - ramp[k]) * 0.6)) / 255;
          g = (g * (255 - (255 - ramp[k + 1]) * 0.6)) / 255;
          b = (b * (255 - (255 - ramp[k + 2]) * 0.6)) / 255;
        }
      }
      const m = world.memory.data[i];
      if (dark) {
        r = (r + (ley[0] * m * 40) / 255) * keep[i];
        g = (g + (ley[1] * m * 40) / 255) * keep[i];
        b = (b + (ley[2] * m * 40) / 255) * keep[i];
      } else {
        r *= 1 - m * 0.12;
        g *= 1 - m * 0.15;
        b *= 1 - m * 0.2;
      }
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
    hg!.putImageData(haloImg!, 0, 0);
    // The threads: fade, then every mover adds its light (or its ink).
    const td = threadImg!.data;
    const fade = dark ? 236 : 240;
    if (dark) for (let i = 0; i < td.length; i += 4) {
      td[i] = (td[i] * fade) >> 8;
      td[i + 1] = (td[i + 1] * fade) >> 8;
      td[i + 2] = (td[i + 2] * fade) >> 8;
    }
    else for (let i = 0; i < td.length; i += 4) {
      td[i] = 255 - (((255 - td[i]) * fade) >> 8);
      td[i + 1] = 255 - (((255 - td[i + 1]) * fade) >> 8);
      td[i + 2] = 255 - (((255 - td[i + 2]) * fade) >> 8);
    }
    const P = world.phys;
    const sc = cell / 2;
    const pulseSpeed = 3.2 * world.mods.light;
    const base = dark ? 0.2 : 0.16;
    for (let i = 0; i < P.n; i++) {
      if (!P.alive[i]) continue;
      const x = (P.x[i] * sc) | 0;
      const y = (P.y[i] * sc) | 0;
      if (x < 0 || y < 0 || x >= TW || y >= TH) continue;
      const ci = (P.y[i] | 0) * cols + (P.x[i] | 0);
      const dist = world.dist[ci];
      const pulse = dist < 1e6 ? Math.max(0, Math.sin(dist * 0.42 - t * pulseSpeed)) ** 10 : 0;
      const k = (base + pulse * 0.9) * world.mods.light * keep[ci];
      const c = tRgb[P.s[i]];
      const o = (y * TW + x) * 4;
      if (dark) {
        td[o] = Math.min(255, td[o] + c[0] * k);
        td[o + 1] = Math.min(255, td[o + 1] + c[1] * k);
        td[o + 2] = Math.min(255, td[o + 2] + c[2] * k);
      } else {
        td[o] = Math.max(0, td[o] - (255 - c[0]) * k);
        td[o + 1] = Math.max(0, td[o + 1] - (255 - c[1]) * k);
        td[o + 2] = Math.max(0, td[o + 2] - (255 - c[2]) * k);
      }
    }
    tg!.putImageData(threadImg!, 0, 0);
  }
  // ---- sigils and wells ------------------------------------------------------------------------------

  function sigil(ord: Order, X: number, Y: number, R: number, t: number, a: number) {
    const s = ord.sigil;
    const col = ord.color;
    ctx.save();
    ctx.translate(X, Y);
    ctx.rotate(t * s.spin);
    ctx.strokeStyle = hexA(dark ? mixHex(col, '#ffffff', 0.35) : mixHex(col, '#000000', 0.35), 0.9 * a);
    ctx.lineWidth = Math.max(1, R * 0.08);
    for (let k = 0; k < s.rings; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, R * (1 - k * 0.28), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s.sides >= 3) {
      ctx.beginPath();
      const n = s.star ? s.sides * 2 : s.sides;
      for (let k = 0; k <= n; k++) {
        const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
        const rr = s.star && k % 2 ? R * 0.35 : R * 0.72;
        if (k) ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        else ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.stroke();
    }
    if (s.spokes) {
      ctx.beginPath();
      for (let k = 0; k < s.spokes; k++) {
        const ang = (k / s.spokes) * Math.PI * 2;
        ctx.moveTo(Math.cos(ang) * R * 0.2, Math.sin(ang) * R * 0.2);
        ctx.lineTo(Math.cos(ang) * R * 1.25, Math.sin(ang) * R * 1.25);
      }
      ctx.stroke();
    }
    if (s.dot) {
      ctx.fillStyle = hexA(dark ? '#ffffff' : mixHex(col, '#000000', 0.5), 0.9 * a);
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(1, R * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function wells(t: number) {
    const z = camera.cam.zoom;
    for (const w of world.wells) {
      const X = sx(w.x);
      const Y = sy(w.y);
      if (X < -40 || Y < -40 || X > W + 40 || Y > H + 40) continue;
      const ord = w.owner >= 0 ? world.orders[w.owner] : null;
      if (keep[world.idx(w.x, w.y)] < 0.5) continue;
      const breathe = 0.6 + 0.4 * Math.sin(t * 1.1 + w.id * 1.7);
      if (dark) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, X, Y, (8 + w.power * 7) * z * world.mods.light, ord && !ord.hostile ? ord.color : `rgb(${ley.join(',')})`, 0.35 * breathe);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillStyle = 'rgba(176,132,48,0.85)';
        ctx.beginPath();
        ctx.arc(X, Y, (2 + w.power) * z, 0, Math.PI * 2);
        ctx.fill();
      }
      if (ord && ord.alive && !ord.hostile) {
        const held = Math.min(1, (world.t - w.since) / 20);
        const great = ord.great >= 0 && isCapital(ord, w);
        if (isCapital(ord, w)) {
          sigil(ord, X, Y, (great ? 22 : 11 + w.power * 2) * z * (0.6 + 0.4 * held), t, 0.5 + 0.5 * held);
          if (great) sigil(ord, X, Y, 38 * z, -t * 0.5, 0.45);
        } else {
          // A held well: a small ring in the order's color.
          ctx.strokeStyle = hexA(dark ? mixHex(ord.color, '#ffffff', 0.3) : mixHex(ord.color, '#000000', 0.35), 0.7 * held);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(X, Y, (3 + w.power * 1.5) * z, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (w.crater) {
        ctx.strokeStyle = dark ? 'rgba(226,232,240,0.35)' : 'rgba(92,64,36,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(X, Y, 7 * z, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  const isCapital = (ord: Order, w: Well) => world.wells.filter((x) => x.owner === ord.slot).sort((a, b) => b.power - a.power)[0] === w;

  // ---- the frame -----------------------------------------------------------------------------------

  const sx = (x: number) => camera.sx(x, W);
  const sy = (y: number) => camera.sy(y, H);
  return runWorld(host, world, {
    dt: 0.05,
    project: (x, y) => [sx(x), sy(y)],
    ambience: () => Math.min(1, 0.3 + world.director.activity),
    after(dt) {
      camera.follow(world.director.shot, dt, { W, H });
    },
    resize(v) {
      W = v.width;
      H = v.height;
    },
    paint(t) {
      if (!bg) paintMedium();
      const z = camera.cam.zoom;
      world.view = { sx, sy, z, t, glow, W, H, medium };
      ctx.imageSmoothingEnabled = true;
      ctx.fillStyle = tones.base;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bg!, sx(0), sy(0), world.W * z, world.H * z);
      for (const s of world.systems) s.paint?.('under', ctx);
      paintInk(t);
      ctx.globalCompositeOperation = dark ? 'lighter' : 'multiply';
      ctx.drawImage(halo!, sx(0), sy(0), world.W * z, world.H * z);
      ctx.drawImage(threads!, sx(0), sy(0), world.W * z, world.H * z);
      ctx.globalCompositeOperation = 'source-over';
      if (dark) bloom.draw(ctx, threads!, sx(0), sy(0), world.W * z, world.H * z, (medium === 'starchart' ? 0.6 : 0.8) * Math.min(1.6, world.mods.light));
      for (const s of world.systems) s.paint?.('over', ctx);
      wells(t);
      // Sparks where orders meet.
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (const sp of world.sparks) {
        const k = 1 - (world.t - sp.t0) / 0.6;
        if (dark) glow(ctx, sx(sp.x), sy(sp.y), 5 * z, '#ffffff', 0.6 * k);
        else {
          ctx.fillStyle = `rgba(40,20,10,${(0.7 * k).toFixed(3)})`;
          ctx.fillRect(sx(sp.x), sy(sp.y), 1.5, 1.5);
        }
      }
      for (const s of world.systems) s.paint?.('glow', ctx);
      ctx.globalCompositeOperation = 'source-over';
      vignette(ctx, W, H, dark ? 0.5 : 0.25, dark ? '2,2,8' : '70,50,25');
      grain(ctx, W, H, t, dark ? 0.06 : 0.1);
      // Words.
      const level = 0.55 + 0.45 * host.intensity;
      for (; told < world.tellings.length; told++) {
        const tl = world.tellings[told];
        if (tl.big && o.labels) captions.say(tl.text, t, tl.color, tl.sub);
        else captions.note(tl.text, t);
      }
      if (told > world.tellings.length) told = world.tellings.length;
      if (world.orders.some((x, i) => x.hostile && tRgb[i][0] !== (dark ? 190 : 59))) tRgb = threadRgb();
      captions.draw(ctx, W, H, t, level, { chronicle: o.hud, y: H * 0.86 });
      if (o.hud) hud(level);
    },
    destroy() {
      bg = null;
    },
  });

  function hud(level: number) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const ink2 = dark ? '#e7e5f4' : '#3a2a18';
    ctx.font = serifFont(13);
    ctx.fillStyle = hexA(ink2, 0.85 * level);
    fillCrisp(ctx, `${world.landName} · THE LINES OF ${world.name}`, 28, 32);
    ctx.font = serifFont(11, true);
    ctx.fillStyle = hexA(ink2, 0.6 * level);
    const status = world.systems.map((s) => s.status?.()).find(Boolean);
    fillCrisp(ctx, status ? titleCase(status) : `In this age: ${world.cast.join(', ')}.`, 28, 48);
    ctx.textAlign = 'right';
    ctx.font = serifFont(11);
    let y = 32;
    for (const ord of world.orders) {
      if (!ord.alive) continue;
      ctx.fillStyle = hexA(dark ? ord.color : mixHex(ord.color, '#000000', 0.3), 0.9 * level);
      fillCrisp(ctx, `${ord.name}${ord.hostile ? '' : ` · ${ord.wells}`}`, W - 46, y);
      if (!ord.hostile) sigil(ord, W - 34, y - 4, 6, 0, 0.9 * level);
      y += 16;
    }
    ctx.restore();
  }
}

function mixHex(a: string, b: string, k: number) {
  const [r, g, bl] = mixRgb(a, b, k);
  return `#${[r, g, bl].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
