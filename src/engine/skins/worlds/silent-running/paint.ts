/**
 * Silent Running, painted: the chart under the station's lamp. Back to front: the sea in depth
 * bands and the land (one cached picture), the graticule, the lanes and ports, slicks and wrecks,
 * ice and the storm, rings (pings, charges, songs, buoys), whales, ships by kind, torpedoes, the
 * station's sweep, call-outs, then the HUD. Submarines are faint shapes until they are heard;
 * heard, they are drawn hard, with a ring.
 */
import type { SkinHost, SkinInstance, Viewport } from '../../../core/skin';
import { createFraming, fitText, runWorld, type CameraMode } from '../../../kit';
import { fillCrisp, hash, hexA, typed } from '../../instruments/kit';
import { createSea, type SeaWorld, type Ship } from './sim';

export type SeaPaintOptions = { traffic: number; camera: string; labels: boolean; hud: boolean };

const MONO = (px: number) => `${px}px "Syne Mono", ui-monospace, "Cascadia Mono", monospace`;
const SERIF = (px: number, italic = false) => `${italic ? 'italic ' : ''}${px}px ui-serif, Georgia, "Times New Roman", serif`;

export function mountSea(host: SkinHost, o: SeaPaintOptions): SkinInstance {
  const { ctx } = host;
  let W = host.viewport.width;
  let H = host.viewport.height;
  const world: SeaWorld = createSea(host.config.seed, W, H, { traffic: o.traffic, camera: o.camera });
  const framing = createFraming((o.camera === 'still' || o.camera === 'director' ? o.camera : 'drift') as CameraMode, world, { push: 1.35 });
  const cam = framing.cam;
  const SX = (x: number) => (x - cam.x) * cam.zoom + W / 2;
  const SY = (y: number) => (y - cam.y) * cam.zoom + H / 2;
  const sweepColor = host.palette.accent;

  // ---- the chart: depth bands, land, contours (painted once, at half the world's resolution) ----
  let chart: HTMLCanvasElement | null = null;
  function paintChart() {
    const k = 2;
    const cw = Math.ceil(world.GW / k);
    const ch = Math.ceil(world.GH / k);
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const g = c.getContext('2d')!;
    const img = g.createImageData(cw, ch);
    const band = (h: number): [number, number, number] => {
      if (h > 0.12) {
        const hill = Math.min(1, (h - 0.12) / 0.5);
        return [40 + hill * 22, 44 + hill * 20, 36 + hill * 12];
      }
      const d = Math.max(0, Math.min(1, (0.12 - h) / 0.7));
      const q = Math.floor(d * 5) / 5;
      return [10 + (1 - q) * 22, 30 + (1 - q) * 44, 46 + (1 - q) * 44];
    };
    const H0 = new Float32Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) H0[y * cw + x] = world.heightAt(x * k, y * k);
    for (let y = 0; y < ch; y++)
      for (let x = 0; x < cw; x++) {
        const h = H0[y * cw + x];
        let [rr, gg, bb] = band(h);
        // Contour lines where the band changes, and the coast drawn darker.
        const right = H0[y * cw + Math.min(cw - 1, x + 1)];
        const down = H0[Math.min(ch - 1, y + 1) * cw + x];
        const step = (v: number) => (v > 0.12 ? 9 : Math.floor(Math.max(0, Math.min(1, (0.12 - v) / 0.7)) * 5));
        if (step(h) !== step(right) || step(h) !== step(down)) {
          const coast = (h > 0.12) !== (right > 0.12) || (h > 0.12) !== (down > 0.12);
          if (coast) [rr, gg, bb] = [150, 160, 140];
          else [rr, gg, bb] = [rr + 18, gg + 26, bb + 30];
        }
        const i = (y * cw + x) * 4;
        img.data[i] = rr;
        img.data[i + 1] = gg;
        img.data[i + 2] = bb;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    chart = c;
  }

  // ---- ships ------------------------------------------------------------------------------------
  function hull(s: Ship, t: number) {
    const Z = cam.zoom;
    const x = SX(s.x);
    const y = SY(s.y);
    const len = (s.kind === 'tanker' ? 22 : s.kind === 'destroyer' ? 20 : s.kind === 'sub' ? 19 : s.kind === 'fisher' ? 9 : 16) * 1.6 * world.u * Z;
    const beam = len * (s.kind === 'destroyer' ? 0.18 : s.kind === 'sub' ? 0.2 : 0.28);
    const sinking = !s.alive ? Math.min(1, (world.t - s.sunkAt) / 6) : 0;
    const submerged = s.kind === 'sub' ? s.depth : 0;
    const heard = s.kind === 'sub' && s.heard > world.t;
    let alpha = 1 - sinking;
    if (s.kind === 'sub') alpha *= heard ? 1 : 0.16 + (1 - submerged) * 0.45;
    if (alpha <= 0.01) return;
    // The wake, for anything on the surface and moving.
    if (s.alive && s.kind !== 'sub') {
      ctx.strokeStyle = `rgba(220,235,245,${(0.22 * alpha).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(x - Math.cos(s.heading) * len * 0.5, y - Math.sin(s.heading) * len * 0.5);
        ctx.lineTo(x - Math.cos(s.heading + side * 0.25) * len * 1.9, y - Math.sin(s.heading + side * 0.25) * len * 1.9);
      }
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(s.heading + sinking * 0.8);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.kind === 'tanker' ? '#b45309' : s.kind === 'merchant' ? '#d6c7a1' : s.kind === 'destroyer' ? '#cbd5e1' : s.kind === 'fisher' ? '#a16207' : '#1e293b';
    ctx.beginPath();
    if (s.kind === 'sub') {
      ctx.ellipse(0, 0, len / 2, beam / 2, 0, 0, Math.PI * 2);
    } else {
      ctx.moveTo(len / 2, 0);
      ctx.lineTo(len * 0.2, -beam / 2);
      ctx.lineTo(-len / 2, -beam / 2);
      ctx.lineTo(-len / 2, beam / 2);
      ctx.lineTo(len * 0.2, beam / 2);
      ctx.closePath();
    }
    ctx.fill();
    if (s.kind === 'sub') {
      ctx.strokeStyle = heard ? '#f87171' : 'rgba(148,163,184,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = heard ? '#f87171' : '#334155';
      ctx.fillRect(-len * 0.05, -beam * 0.3, len * 0.18, beam * 0.6);
    } else if (s.kind !== 'fisher') {
      // Deck and bridge.
      ctx.fillStyle = s.kind === 'destroyer' ? '#64748b' : '#78350f';
      ctx.fillRect(-len * 0.25, -beam * 0.25, len * 0.22, beam * 0.5);
    }
    ctx.restore();
    if (heard && s.alive) {
      ctx.strokeStyle = `rgba(248,113,113,${(0.5 + 0.3 * Math.sin(t * 5)).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, len * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = MONO(10);
      ctx.fillStyle = 'rgba(248,113,113,0.9)';
      fillCrisp(ctx, s.name, x + len, y - len * 0.6);
    }
    // A periscope's feather when a boat is near the surface.
    if (s.kind === 'sub' && s.alive && submerged < 0.45) {
      ctx.strokeStyle = 'rgba(226,232,240,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(s.heading) * 10 * Z, y - Math.sin(s.heading) * 10 * Z);
      ctx.stroke();
    }
  }

  function rings(t: number) {
    for (const q of world.rings) {
      const age = t - q.t0;
      if (age < 0) continue;
      const x = SX(q.x);
      const y = SY(q.y);
      const Z = cam.zoom;
      if (q.kind === 'ping') {
        const rr = (age / 3) * 300 * world.u * Z;
        ctx.strokeStyle = `rgba(103,232,249,${Math.max(0, 0.45 * (1 - age / 3)).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
      } else if (q.kind === 'charge') {
        ctx.strokeStyle = `rgba(241,245,249,${Math.max(0, 0.8 * (1 - age / 1.6)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, (q.r + age * 22) * Z, 0, Math.PI * 2);
        ctx.stroke();
      } else if (q.kind === 'song') {
        ctx.strokeStyle = `rgba(134,239,172,${Math.max(0, 0.4 * (1 - age / 4)).toFixed(3)})`;
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(x, y, (q.r + age * 18 + k * 9) * Z, -0.9, 0.9);
          ctx.stroke();
        }
      } else if (q.kind === 'buoy') {
        ctx.strokeStyle = `rgba(253,230,138,${Math.max(0, 0.6 * (1 - age / 3)).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, (age / 3) * 240 * world.u * Z, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(251,146,60,${Math.max(0, 0.7 * (1 - age / 1.2)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, (q.r * 0.5 + age * 30) * Z, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function paint(t: number) {
    const Z = cam.zoom;
    ctx.fillStyle = '#06121c';
    ctx.fillRect(0, 0, W, H);
    if (!chart) paintChart();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(chart!, SX(0), SY(0), world.GW * Z, world.GH * Z);
    // The graticule.
    ctx.strokeStyle = 'rgba(148,180,200,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const G = 160 * world.u;
    for (let x = G; x < world.GW; x += G) {
      ctx.moveTo(SX(x), SY(0));
      ctx.lineTo(SX(x), SY(world.GH));
    }
    for (let y = G; y < world.GH; y += G) {
      ctx.moveTo(SX(0), SY(y));
      ctx.lineTo(SX(world.GW), SY(y));
    }
    ctx.stroke();
    // Lanes.
    ctx.strokeStyle = 'rgba(253,230,138,0.13)';
    ctx.setLineDash([6, 8]);
    for (const l of world.lanes) {
      ctx.beginPath();
      l.forEach(([x, y], i) => (i ? ctx.lineTo(SX(x), SY(y)) : ctx.moveTo(SX(x), SY(y))));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Slicks and wrecks.
    for (const s of world.slicks) {
      const a = Math.max(0, 0.35 * (1 - (t - s.t0) / 120));
      ctx.fillStyle = `rgba(2,6,10,${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(SX(s.x) + (t - s.t0) * 0.3, SY(s.y), (14 + (t - s.t0) * 0.25) * Z, (7 + (t - s.t0) * 0.12) * Z, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = MONO(9);
    for (const w of world.wrecks) {
      const x = SX(w.x);
      const y = SY(w.y);
      ctx.strokeStyle = 'rgba(203,213,225,0.45)';
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 4);
      ctx.lineTo(x + 4, y + 4);
      ctx.moveTo(x + 4, y - 4);
      ctx.lineTo(x - 4, y + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(203,213,225,0.4)';
      fillCrisp(ctx, w.name, x + 6, y + 3);
    }
    // Ice and the storm.
    for (const f of world.ice) {
      ctx.fillStyle = 'rgba(226,232,240,0.7)';
      ctx.beginPath();
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = f.r * (0.7 + hash(Math.round(f.r), k) * 0.5) * Z;
        (k ? ctx.lineTo : ctx.moveTo).call(ctx, SX(f.x) + Math.cos(a) * rr, SY(f.y) + Math.sin(a) * rr * 0.8);
      }
      ctx.fill();
    }
    const st = world.storm;
    if (st) {
      const g = ctx.createRadialGradient(SX(st.x), SY(st.y), 0, SX(st.x), SY(st.y), st.r * Z);
      g.addColorStop(0, 'rgba(15,23,42,0.55)');
      g.addColorStop(1, 'rgba(15,23,42,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(203,213,225,0.18)';
      ctx.beginPath();
      for (let k = 0; k < 90; k++) {
        const a = hash(k, 1) * Math.PI * 2;
        const d = Math.sqrt(hash(k, 2)) * st.r * Z;
        const x = SX(st.x) + Math.cos(a) * d;
        const y = SY(st.y) + Math.sin(a) * d + ((t * 160 + k * 37) % 30) - 15;
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 7);
      }
      ctx.stroke();
    }
    rings(t);
    // Whales: a long back, and the flukes.
    for (const w of world.whales) {
      const big = w.n < 0;
      const x = SX(w.x);
      const y = SY(w.y);
      const len = (big ? 120 : 26) * world.u * Z;
      const dir = Math.sign(w.vx) || 1;
      for (let k = 0; k < (big ? 1 : w.n); k++) {
        const ox = x + (big ? 0 : (hash(k, 9) - 0.5) * 40 * Z);
        const oy = y + (big ? 0 : (hash(k, 8) - 0.5) * 26 * Z) + Math.sin(t * 0.8 + k) * 1.5;
        ctx.fillStyle = big ? 'rgba(15,23,42,0.6)' : 'rgba(30,41,59,0.9)';
        ctx.beginPath();
        ctx.ellipse(ox, oy, len / 2, len * (big ? 0.16 : 0.2), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(ox - dir * len * 0.5, oy);
        ctx.lineTo(ox - dir * len * 0.75, oy - len * 0.18);
        ctx.lineTo(ox - dir * len * 0.75, oy + len * 0.18);
        ctx.fill();
      }
    }
    // Ports.
    ctx.font = SERIF(12);
    for (const p of world.ports) {
      const x = SX(p.x);
      const y = SY(p.y);
      ctx.strokeStyle = '#e7dcc4';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y - 3, 2.5, 0, Math.PI * 2);
      ctx.moveTo(x, y - 0.5);
      ctx.lineTo(x, y + 7);
      ctx.moveTo(x - 4, y + 4);
      ctx.quadraticCurveTo(x, y + 9, x + 4, y + 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(231,220,196,0.85)';
      // The name beside the anchor, on the side with room, kept inside the frame.
      const tw = ctx.measureText(p.name).width;
      const lx = p.x > world.GW / 2 ? x - 9 - tw : x + 9;
      fillCrisp(ctx, p.name, Math.max(6, Math.min(W - 6 - tw, lx)), y + (lx < 6 || lx + tw > W - 6 ? 18 : 4));
    }
    for (const s of [...world.ships].sort((a, b) => (a.kind === 'sub' ? -1 : 0) - (b.kind === 'sub' ? -1 : 0))) hull(s, t);
    // Torpedoes: a bright head and a line of bubbles.
    for (const tp of world.torpedoes) {
      const x = SX(tp.x);
      const y = SY(tp.y);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      ctx.fillStyle = 'rgba(226,232,240,0.5)';
      for (let k = 1; k <= 6; k++) ctx.fillRect(x - Math.cos(tp.heading) * k * 6 * Z, y - Math.sin(tp.heading) * k * 6 * Z, 1.5, 1.5);
    }
    // Buoys: a blinking light.
    for (const b of world.buoys) {
      ctx.fillStyle = Math.floor(t * 2) % 2 ? '#fde68a' : 'rgba(253,230,138,0.3)';
      ctx.fillRect(SX(b.x) - 2, SY(b.y) - 2, 4, 4);
    }
    // The station and its sweep.
    const [stx, sty] = [SX(world.station[0]), SY(world.station[1])];
    const reach = Math.hypot(Math.max(stx, W - stx), Math.max(sty, H - sty));
    ctx.save();
    ctx.translate(stx, sty);
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = hexA(sweepColor, 0.05 * (1 - k / 10));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, reach, world.sweep - (k + 1) * 0.06, world.sweep - k * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = hexA(sweepColor, 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(world.sweep) * reach, Math.sin(world.sweep) * reach);
    ctx.stroke();
    ctx.strokeStyle = hexA(sweepColor, 0.08);
    for (const rr of [140, 280, 420]) {
      ctx.beginPath();
      ctx.arc(0, 0, rr * world.u * Z, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = hexA(sweepColor, 0.9);
    ctx.fillRect(-2.5, -2.5, 5, 5);
    ctx.restore();
    labels(t);
    hud(t);
  }

  function labels(t: number) {
    if (!o.labels) return;
    ctx.font = MONO(12);
    ctx.textAlign = 'center';
    const placed: [number, number, number][] = [];
    for (const l of [...world.labels].reverse()) {
      const age = t - l.t0;
      const text = fitText(ctx, typed(l.text, age, 45, t), W - 40);
      const w = ctx.measureText(text).width;
      const x = Math.max(w / 2 + 12, Math.min(W - w / 2 - 12, SX(l.x)));
      let y = Math.max(64, Math.min(H - 70, SY(l.y)));
      for (let k = 0; k < 4 && placed.some(([px, py, pw]) => Math.abs(px - x) < (pw + w) / 2 + 6 && Math.abs(py - y) < 16); k++) y -= 16;
      placed.push([x, y, w]);
      ctx.fillStyle = 'rgba(2,8,14,0.55)';
      ctx.fillRect(x - w / 2 - 4, y - 11, w + 8, 15);
      ctx.fillStyle = hexA(l.color, Math.min(1, age * 3, (6 - age) / 1.5));
      fillCrisp(ctx, text, x, y);
    }
    ctx.textAlign = 'left';
  }

  function hud(t: number) {
    if (!o.hud) return;
    const level = 0.55 + 0.45 * host.intensity;
    const c = world.counts();
    const heard = world.ships.filter((s) => s.alive && s.kind === 'sub' && s.heard > world.t).length;
    ctx.font = MONO(13);
    ctx.fillStyle = hexA('#e2e8f0', 0.9 * level);
    fillCrisp(ctx, fitText(ctx, `SILENT RUNNING · ${world.name}${world.storm ? ' · GALE' : ''}`, W - 32), 16, 26);
    ctx.font = MONO(11);
    ctx.fillStyle = hexA('#94a3b8', 0.85 * level);
    fillCrisp(ctx, fitText(ctx, `${c.merchants} MERCHANT${c.merchants === 1 ? '' : 'S'} AT SEA · ${c.destroyers} DESTROYER${c.destroyers === 1 ? '' : 'S'} · ${heard ? `${heard} CONTACT${heard > 1 ? 'S' : ''}` : 'NO CONTACTS'} · ${c.wrecks} WRECKS`, W - 32), 16, 43);
    ctx.font = SERIF(12, true);
    const lines = world.chronicle.slice(-3);
    lines.forEach((l, i) => {
      const age = t - l.t;
      ctx.fillStyle = hexA('#e2e8f0', Math.min(1, age * 2) * (i === lines.length - 1 ? 0.9 : 0.55) * level);
      fillCrisp(ctx, fitText(ctx, typed(l.text, age, 50, t), W - 32), 16, H - 16 - (lines.length - 1 - i) * 17);
    });
  }

  return runWorld(host, world, {
    dt: 1 / 30,
    project: (x, y) => [SX(x), SY(y)],
    unproject: (x, y) => [(x - W / 2) / cam.zoom + cam.x, (y - H / 2) / cam.zoom + cam.y],
    after: (dt) => framing.update(dt, world.t, world.director, W, H),
    paint: (t) => paint(t),
    ambience: () => (world.torpedoes.length || world.ships.some((s) => s.alive && s.kind === 'destroyer' && s.state === 'hunt') ? 0.9 : 0.4),
    resize(v: Viewport) {
      W = v.width;
      H = v.height;
    },
    destroy() {
      chart = null;
    },
  });
}
