/**
 * The walk on a travel map: the same sim, drawn as a traveller's map painted in ink and watercolour.
 *
 * The road winds across the paper; along it, each region of the route is painted as it would be on
 * an old map (patchwork fields and hedges, heather stipple and stone walls, a lake with its ripples,
 * the sea and a harbour town of steep roofs, inked peaks with their snow, rows of flowers, a market
 * town with its spire), lettered by hand. The far towns stand back from the road. Live on top: the
 * road walked so far in red ink and the castle, a little drawing that walks; the war (bombers with
 * dotted courses, tracer, towns burning and then hatched black as ruins, a wreck), storms and rain,
 * the tar men's blots, people on the road. A cartouche, the hour on a medallion, a compass rose,
 * and the diary in a corner. At night the paper is lit by a lamp.
 *
 * Space: screen pixels. A route distance Xc is at x = cx + (Xc − X)·k (k pixels per unit); the road
 * winds about a line across the middle. Content is painted to a canvas wider than the screen and
 * repainted when the castle has walked far enough along it.
 */
import { fitText } from '../../../kit';
import { fillCrisp } from '../../instruments/kit';
import { clamp01, fbm1, hash, midS, n1, PLANES, type Region } from './land';
import { goldenOf, mk, rgba, sunPos, timeWords, type Env } from './sky';
import type { CastleWorld } from './types';

const SERIF = (px: number, italic = true, weight = '') => `${italic ? 'italic ' : ''}${weight ? `${weight} ` : ''}${px}px "Cormorant Garamond", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`;
const INK = '#3a2a1e';
const RED = '#9a3424';
const WASH: Record<Region, string> = { meadow: '#9cc06a', moor: '#b8a070', lake: '#8cb07a', coast: '#a8c07a', mountain: '#a8a898', flowers: '#b4c870', town: '#a8c070' };

export function createMapPainter(world: CastleWorld, E: Env, o: { W: () => number; H: () => number; hud: boolean }) {
  const { land, u } = world;
  const c = world.castle;
  const S = land.seed;
  let paper: HTMLCanvasElement | null = null;
  let paperKey = '';
  let content: HTMLCanvasElement | null = null;
  let X0 = 0;
  let cW = 0;
  let cH = 0;
  const geom = () => {
    const W = o.W();
    const H = o.H();
    const phone = W < H;
    const span = (phone ? 5 : 8.5) * 3800 * u;
    const k = W / span;
    const cx = W * (phone ? 0.42 : 0.4);
    const midY = H * (phone ? 0.52 : 0.55);
    const amp = H * (phone ? 0.1 : 0.14);
    const s = Math.min(W, H * 1.5) / 1000;
    return { W, H, phone, k, cx, midY, amp, s };
  };
  /** The road's line on the paper at route distance Xc (before the scroll). */
  const roadY = (Xc: number, gm: ReturnType<typeof geom>) => gm.midY + Math.sin(Xc / (5200 * u)) * gm.amp + (fbm1(Xc / (2600 * u), S + 90) - 0.5) * gm.amp * 0.9;
  const R = (a: number, b = 0) => hash(a, b, S + 400);

  // ---- the paper ---------------------------------------------------------------------------------
  function paintPaper(W: number, H: number) {
    paper = mk(W, H);
    const g = paper.getContext('2d')!;
    const base = g.createLinearGradient(0, 0, W, H);
    base.addColorStop(0, '#efe3c8');
    base.addColorStop(0.5, '#e9dbbd');
    base.addColorStop(1, '#e2d1ae');
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // Blooms of old watercolour and age.
    for (let i = 0; i < 30; i++) {
      const x = R(i, 1) * W;
      const y = R(i, 2) * H;
      const rad = 50 + R(i, 3) * 200;
      const st = g.createRadialGradient(x, y, 0, x, y, rad);
      st.addColorStop(0, `rgba(160,120,70,${(0.02 + R(i, 4) * 0.04).toFixed(3)})`);
      st.addColorStop(0.8, `rgba(160,120,70,${(0.01 + R(i, 4) * 0.02).toFixed(3)})`);
      st.addColorStop(1, 'rgba(160,120,70,0)');
      g.fillStyle = st;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // The tooth of the paper.
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const p = i / 4;
      const v = (hash(p % W, Math.floor(p / W), S) - 0.5) * 10;
      img.data[i] += v;
      img.data[i + 1] += v;
      img.data[i + 2] += v * 0.8;
    }
    g.putImageData(img, 0, 0);
    // A fold across and one down; a darkened, deckled edge.
    for (const [x0, y0, x1, y1] of [[0, H * 0.5, W, H * 0.49], [W * 0.5, 0, W * 0.505, H]]) {
      g.strokeStyle = 'rgba(110,80,40,0.09)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = 'rgba(255,250,235,0.2)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0 + 1.5, y0 + 1.5);
      g.lineTo(x1 + 1.5, y1 + 1.5);
      g.stroke();
    }
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    v.addColorStop(0, 'rgba(90,55,25,0)');
    v.addColorStop(0.7, 'rgba(90,55,25,0.14)');
    v.addColorStop(1, 'rgba(60,35,15,0.5)');
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
    // A ruled double border, as on an old map.
    const m = Math.max(10, Math.min(W, H) * 0.025);
    g.strokeStyle = rgba(INK, 0.55);
    g.lineWidth = 1.4;
    g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.lineWidth = 0.6;
    g.strokeRect(m + 4, m + 4, W - m * 2 - 8, H - m * 2 - 8);
    paperKey = `${W}x${H}`;
  }

  // ---- the map, in ink and wash -------------------------------------------------------------------------
  const wash = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, col: string, a: number) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    gr.addColorStop(0, rgba(col, a));
    gr.addColorStop(0.7, rgba(col, a * 0.7));
    gr.addColorStop(0.92, rgba(col, a * 0.95));
    gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr;
    g.save();
    g.translate(x, y);
    g.scale(1, ry / Math.max(rx, ry));
    g.translate(-x, -y);
    g.beginPath();
    g.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  const ink = (g: CanvasRenderingContext2D, w: number, a = 0.85) => {
    g.strokeStyle = rgba(INK, a);
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
  };
  function tree(g: CanvasRenderingContext2D, x: number, y: number, s: number, pine = false) {
    if (pine) {
      g.fillStyle = rgba('#5a7a5a', 0.55);
      g.beginPath();
      g.moveTo(x - s * 0.5, y);
      g.lineTo(x, y - s * 1.5);
      g.lineTo(x + s * 0.5, y);
      g.fill();
      ink(g, Math.max(0.6, s * 0.12));
      g.beginPath();
      g.moveTo(x - s * 0.5, y);
      g.lineTo(x, y - s * 1.5);
      g.lineTo(x + s * 0.5, y);
      g.moveTo(x, y);
      g.lineTo(x, y + s * 0.3);
      g.stroke();
      return;
    }
    g.fillStyle = rgba('#6a9a4a', 0.5);
    g.beginPath();
    g.arc(x, y - s * 0.6, s * 0.55, 0, Math.PI * 2);
    g.fill();
    ink(g, Math.max(0.6, s * 0.12));
    g.beginPath();
    g.arc(x, y - s * 0.6, s * 0.55, Math.PI * 0.85, Math.PI * 2.15);
    g.moveTo(x, y - s * 0.1);
    g.lineTo(x, y + s * 0.3);
    g.stroke();
  }
  function hut(g: CanvasRenderingContext2D, x: number, y: number, s: number, steep = 1, roof = '#b8604a') {
    g.fillStyle = rgba('#f4ead4', 0.9);
    g.fillRect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 0.6);
    g.fillStyle = rgba(roof, 0.7);
    g.beginPath();
    g.moveTo(x - s * 0.5, y - s * 0.6);
    g.lineTo(x, y - s * (0.6 + 0.5 * steep));
    g.lineTo(x + s * 0.5, y - s * 0.6);
    g.fill();
    ink(g, Math.max(0.6, s * 0.09));
    g.beginPath();
    g.moveTo(x - s * 0.4, y);
    g.lineTo(x - s * 0.4, y - s * 0.6);
    g.lineTo(x - s * 0.5, y - s * 0.6);
    g.lineTo(x, y - s * (0.6 + 0.5 * steep));
    g.lineTo(x + s * 0.5, y - s * 0.6);
    g.lineTo(x + s * 0.4, y - s * 0.6);
    g.lineTo(x + s * 0.4, y);
    g.closePath();
    g.stroke();
  }
  function peak(g: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number) {
    const h = s * (1 + R(seed, 1) * 0.6);
    const lean = (R(seed, 2) - 0.5) * s * 0.4;
    // The shaded face hatched, the snow left bare.
    g.fillStyle = rgba('#8a90a0', 0.35);
    g.beginPath();
    g.moveTo(x + lean, y - h);
    g.lineTo(x + s * 0.8, y);
    g.lineTo(x + lean * 0.5, y);
    g.fill();
    ink(g, Math.max(0.5, s * 0.06), 0.55);
    g.beginPath();
    for (let q = 0.15; q < 1; q += 0.13) {
      const yy = y - h * (1 - q);
      g.moveTo(x + lean + (s * 0.8 - lean) * q * 0.9, yy);
      g.lineTo(x + lean * (1 - q * 0.5) + s * 0.04, yy + h * 0.06);
    }
    g.stroke();
    ink(g, Math.max(0.7, s * 0.08));
    g.beginPath();
    g.moveTo(x - s * 0.8, y);
    g.lineTo(x + lean, y - h);
    g.lineTo(x + s * 0.8, y);
    g.stroke();
    g.beginPath();
    g.moveTo(x + lean - s * 0.22, y - h * 0.72);
    g.lineTo(x + lean - s * 0.08, y - h * 0.62);
    g.lineTo(x + lean + s * 0.05, y - h * 0.74);
    g.lineTo(x + lean + s * 0.2, y - h * 0.66);
    g.stroke();
  }
  function town(g: CanvasRenderingContext2D, x: number, y: number, s: number, seed: number, steep: number, n: number) {
    for (let q = 0; q < n; q++) {
      const hx = x + (R(seed, q) - 0.5) * s * 4;
      const hy = y + (R(seed, q + 40) - 0.5) * s * 1.6;
      hut(g, hx, hy, s * (0.7 + R(seed, q + 80) * 0.4), steep, ['#b8604a', '#7a6a7a', '#a87a50'][q % 3]);
    }
    ink(g, Math.max(0.8, s * 0.1));
    g.beginPath();
    g.moveTo(x, y - s * 0.2);
    g.lineTo(x, y - s * 1.6);
    g.moveTo(x - s * 0.25, y - s * 1.2);
    g.lineTo(x, y - s * 2.3);
    g.lineTo(x + s * 0.25, y - s * 1.2);
    g.stroke();
  }
  function paintContent(gm: ReturnType<typeof geom>) {
    const M = 260;
    cW = Math.ceil(gm.W + M * 2);
    cH = gm.H;
    content = mk(cW, cH);
    X0 = world.X;
    const g = content.getContext('2d')!;
    const xa = X0 - (gm.cx + M) / gm.k;
    const xb = X0 + (gm.W - gm.cx + M) / gm.k;
    const mx = (Xc: number) => gm.cx + M + (Xc - X0) * gm.k;
    const s = gm.s;
    // Washes first: each region's colour laid along the road in a soft band, the sea on its far side.
    const step = 3;
    for (let px = 0; px < cW; px += step) {
      const Xc = X0 + (px - gm.cx - M) / gm.k;
      const rg = land.regionAt(Xc);
      const y = roadY(Xc, gm);
      const band = gm.H * 0.3;
      const col = (r: Region) => (r === 'coast' ? WASH.coast : WASH[r]);
      const wob = (n1(Xc / (900 * u), S + 91) - 0.5) * band * 0.5;
      for (const [r, w] of [[rg.a, 1 - rg.k], [rg.b, rg.k]] as const) {
        if (w < 0.02) continue;
        const gr = g.createLinearGradient(0, y - band + wob, 0, y + band + wob);
        gr.addColorStop(0, rgba(col(r), 0));
        gr.addColorStop(0.3, rgba(col(r), 0.2 * w));
        gr.addColorStop(0.55, rgba(col(r), 0.28 * w));
        gr.addColorStop(1, rgba(col(r), 0));
        g.fillStyle = gr;
        g.fillRect(px, y - band + wob, step + 0.6, band * 2);
        if (r === 'coast') {
          // The sea: from the far edge of the paper down to the shore beyond the road.
          const shore = y - (34 + n1(Xc / (500 * u), S + 92) * 30) * s;
          const sg2 = g.createLinearGradient(0, 0, 0, shore);
          sg2.addColorStop(0, rgba('#5a8ab8', 0.12 * w));
          sg2.addColorStop(0.85, rgba('#5a8ab8', 0.3 * w));
          sg2.addColorStop(1, rgba('#5a8ab8', 0.45 * w));
          g.fillStyle = sg2;
          g.fillRect(px, 0, step + 0.6, shore);
        }
      }
    }
    // Blots of deeper wash, as a brush leaves them.
    for (let i = 0; i < cW / 30; i++) {
      const px = R(i, 50) * cW;
      const Xc = X0 + (px - gm.cx - M) / gm.k;
      const rg = land.regionAt(Xc);
      const y = roadY(Xc, gm) + (R(i, 51) - 0.5) * gm.H * 0.42;
      wash(g, px, y, (20 + R(i, 52) * 40) * s, (12 + R(i, 53) * 20) * s, WASH[rg.a], 0.1);
    }
    // Each segment's own drawing.
    for (const sg of land.route) {
      if (sg.x1 < xa || sg.x0 > xb) continue;
      const a = Math.max(sg.x0, xa);
      const b = Math.min(sg.x1, xb);
      const mid = (sg.x0 + sg.x1) / 2;
      const n = Math.ceil(((b - a) * gm.k) / (3.2 * s));
      for (let q = 0; q < n; q++) {
        const Xc = a + ((b - a) * (q + R(sg.seed, q) * 0.9)) / n;
        const x = mx(Xc);
        const ry = roadY(Xc, gm);
        const side = R(sg.seed, q + 1000) < 0.5 ? -1 : 1;
        const off = (12 + Math.pow(R(sg.seed, q + 2000), 0.8) * 130) * s;
        const y = ry + side * off;
        const pr = R(sg.seed, q + 3000);
        switch (sg.region) {
          case 'meadow':
          case 'town':
            if (pr < 0.22) tree(g, x, y, 6 * s);
            else if (pr < 0.3) {
              // A field: a little patch, washed and outlined, ploughed lines across it.
              const fw = (10 + R(q, 21) * 12) * s;
              const fh = (6 + R(q, 22) * 6) * s;
              const sk = (R(q, 23) - 0.5) * 0.6;
              g.save();
              g.translate(x, y);
              g.transform(1, sk * 0.3, sk, 1, 0, 0);
              g.fillStyle = rgba(['#c8c060', '#a8c068', '#d8b868', '#90b060'][q % 4], 0.35);
              g.fillRect(-fw / 2, -fh / 2, fw, fh);
              ink(g, 0.6 * s, 0.5);
              g.strokeRect(-fw / 2, -fh / 2, fw, fh);
              g.beginPath();
              for (let d = 1; d < 4; d++) {
                g.moveTo(-fw / 2, -fh / 2 + (fh * d) / 4);
                g.lineTo(fw / 2, -fh / 2 + (fh * d) / 4);
              }
              ink(g, 0.4 * s, 0.25);
              g.stroke();
              g.restore();
            } else if (pr < 0.36) {
              ink(g, 0.7 * s, 0.5);
              g.setLineDash([2 * s, 2.5 * s]);
              g.beginPath();
              g.moveTo(x - 12 * s, y);
              g.quadraticCurveTo(x, y - 6 * s, x + 14 * s, y + 3 * s);
              g.stroke();
              g.setLineDash([]);
            } else if (pr < 0.38) hut(g, x, y, 7 * s);
            break;
          case 'moor':
            if (pr < 0.4) {
              g.fillStyle = rgba('#7a4a6a', 0.5);
              for (let d = 0; d < 5; d++) g.fillRect(x + (R(q, d) - 0.5) * 10 * s, y + (R(q, d + 9) - 0.5) * 6 * s, 1.2 * s, 1.2 * s);
            } else if (pr < 0.47) {
              ink(g, 0.8 * s, 0.6);
              g.beginPath();
              for (let d = 0; d < 4; d++) {
                g.moveTo(x - 14 * s + d * 8 * s, y + d * 1.5 * s);
                g.lineTo(x - 9 * s + d * 8 * s, y + d * 1.5 * s - 1 * s);
              }
              g.stroke();
            } else if (pr < 0.5) {
              ink(g, 0.9 * s);
              g.beginPath();
              g.moveTo(x - 6 * s, y);
              g.lineTo(x - 3 * s, y - 5 * s);
              g.lineTo(x + 2 * s, y - 6 * s);
              g.lineTo(x + 6 * s, y);
              g.stroke();
            }
            break;
          case 'mountain':
            if (pr < 0.55) peak(g, x, y - (side < 0 ? 20 : 0) * s, 14 * s * (0.7 + R(sg.seed, q + 5000) * 0.7), sg.seed + q);
            else if (pr < 0.75) tree(g, x, y, 5 * s, true);
            break;
          case 'lake':
            if (pr < 0.45) tree(g, x, y + (side > 0 ? 30 : 0) * s, 5 * s, true);
            break;
          case 'coast':
            if (side < 0 && pr < 0.5) {
              ink(g, 0.7 * s, 0.45);
              g.beginPath();
              const wy = ry - (30 + R(q, 3) * 90) * s;
              g.moveTo(x - 6 * s, wy);
              g.quadraticCurveTo(x - 3 * s, wy - 3 * s, x, wy);
              g.quadraticCurveTo(x + 3 * s, wy - 3 * s, x + 6 * s, wy);
              g.stroke();
            } else if (pr < 0.6) tree(g, x, ry + 26 * s + R(q, 4) * 30 * s, 5 * s);
            break;
          case 'flowers': {
            const cols = ['#e0b030', '#f0f0f0', '#d878a0', '#9a78c8', '#d84838'];
            g.fillStyle = rgba(cols[q % cols.length], 0.75);
            for (let d = 0; d < 6; d++) {
              g.beginPath();
              g.arc(x + d * 2.4 * s - 6 * s, y + Math.sin(d) * 1.2 * s, 1.2 * s, 0, Math.PI * 2);
              g.fill();
            }
            break;
          }
        }
      }
      // The lake itself, the harbour town, the market town, the pass.
      const x = mx(Math.max(a, Math.min(b, mid)));
      const ry = roadY(mid, gm);
      if (sg.region === 'lake' && mid > xa && mid < xb) {
        const lx = mx(mid);
        const ly = ry - 42 * s;
        const rx = Math.min(140 * s, (sg.x1 - sg.x0) * gm.k * 0.32);
        g.fillStyle = rgba('#4a88c0', 0.55);
        g.beginPath();
        g.ellipse(lx, ly, rx, 26 * s, 0, 0, Math.PI * 2);
        g.fill();
        ink(g, 1.2 * s);
        g.beginPath();
        for (let q = 0; q <= 40; q++) {
          const a2 = (q / 40) * Math.PI * 2;
          const rr = 1 + (n1(q * 0.7, sg.seed) - 0.5) * 0.12;
          g.lineTo(lx + Math.cos(a2) * rx * rr, ly + Math.sin(a2) * 26 * s * rr);
        }
        g.closePath();
        g.stroke();
        ink(g, 0.6 * s, 0.4);
        for (let q = 0; q < 4; q++) {
          g.beginPath();
          g.ellipse(lx, ly, rx * (0.82 - q * 0.18), 26 * s * (0.8 - q * 0.18), 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
      if (sg.region === 'coast' && mid > xa && mid < xb) {
        town(g, mx(mid), ry - 18 * s, 6 * s, sg.seed, 1.8, 9);
        // The harbour wall and a lighthouse.
        ink(g, 1.2 * s);
        g.beginPath();
        g.arc(mx(mid), ry - 30 * s, 26 * s, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
        const lhx = mx(mid + (sg.x1 - sg.x0) * 0.3);
        g.fillStyle = rgba('#f4ead4', 0.9);
        g.fillRect(lhx - 2 * s, ry - 46 * s, 4 * s, 12 * s);
        g.fillStyle = rgba(RED, 0.8);
        g.fillRect(lhx - 2 * s, ry - 42 * s, 4 * s, 2.5 * s);
        ink(g, 0.8 * s);
        g.strokeRect(lhx - 2 * s, ry - 46 * s, 4 * s, 12 * s);
      }
      if (sg.region === 'town' && mid > xa && mid < xb) {
        const tx = mx(mid);
        const ty = ry + 26 * s;
        ink(g, 1.1 * s);
        g.beginPath();
        g.ellipse(tx, ty, 34 * s, 16 * s, 0, 0, Math.PI * 2);
        g.stroke();
        town(g, tx, ty + 4 * s, 6 * s, sg.seed, 1.4, 10);
      }
      // The region's name, lettered along the road.
      if (mid > xa && mid < xb) {
        const nx = mx(mid);
        const up = R(sg.seed, 1) < 0.5;
        const ny = ry + (up ? -108 : 116) * s * (gm.phone ? 0.8 : 1);
        const name = titleOf(sg.name);
        const fs = Math.round(Math.max(12, 17 * s));
        g.font = SERIF(fs, true, '500');
        g.textAlign = 'center';
        g.fillStyle = rgba(INK, 0.85);
        const ang = Math.atan2(roadY(mid + 400 * u, gm) - roadY(mid - 400 * u, gm), 800 * u * gm.k) * 0.5;
        g.save();
        g.translate(nx, ny);
        g.rotate(ang);
        const parts = fitText(g, name, (sg.x1 - sg.x0) * gm.k * 0.95);
        g.fillText(parts, 0, 0);
        g.restore();
        void x;
      }
    }
    // The road itself: a double line of ink, with milestones.
    ink(g, 2.2 * s, 0.55);
    g.beginPath();
    for (let px = 0; px <= cW; px += 4) {
      const Xc = X0 + (px - gm.cx - M) / gm.k;
      if (px === 0) g.moveTo(px, roadY(Xc, gm));
      else g.lineTo(px, roadY(Xc, gm));
    }
    g.stroke();
    g.strokeStyle = rgba('#e9dbbd', 0.9);
    g.lineWidth = 0.9 * s;
    g.stroke();
    const mile = 2400 * u;
    for (let Xc = Math.ceil(xa / mile) * mile; Xc < xb; Xc += mile) {
      ink(g, 1 * s, 0.7);
      g.beginPath();
      g.arc(mx(Xc), roadY(Xc, gm) + 6 * s, 1.2 * s, 0, Math.PI * 2);
      g.stroke();
    }
    // The far towns, back from the road on the far side.
    const sf = PLANES.far.s;
    for (const tw of land.farTownsIn(xa * sf, xb * sf)) {
      const Xc = tw.L / sf;
      const x = mx(Xc);
      const y = roadY(Xc, gm) - (110 + R(tw.seed, 1) * 40) * s * (gm.phone ? 0.8 : 1);
      ink(g, 0.9 * s, 0.7);
      g.beginPath();
      g.arc(x, y + 2 * s, 14 * s * tw.size, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      town(g, x, y, 4.5 * s * tw.size, tw.seed, 1.2, 6);
      g.font = SERIF(Math.round(Math.max(10, 11 * s)), true);
      g.textAlign = 'center';
      g.fillStyle = rgba(INK, 0.7);
      g.fillText(titleOf(tw.name), x, y + 16 * s);
    }
  }
  const titleOf = (n: string) => n.toLowerCase().replace(/(^|\s|')([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\b(Of|The|At|On|Below|Over|Above)\b(?!$)/g, (q) => q.toLowerCase()).replace(/^./, (q) => q.toUpperCase()).replace(/'S\b/g, '\'s');

  // ---- live: the walk, the war, the weather ---------------------------------------------------------------
  function castleIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
    const ph = c.phase * Math.PI * 2;
    const d = c.dir;
    ink(g, 1.3 * s);
    // Two legs walking.
    for (const o2 of [0, Math.PI]) {
      const fx = x + Math.sin(ph + o2) * 5 * s * d;
      const lift = Math.max(0, Math.cos(ph + o2)) * 2.5 * s;
      g.beginPath();
      g.moveTo(x, y - 11 * s);
      g.lineTo(x + 3 * s * d, y - 6 * s - lift * 0.4);
      g.lineTo(fx, y - lift);
      g.lineTo(fx + 3 * s * d, y - lift);
      g.stroke();
    }
    // The heap: a round hull, turrets, a chimney, the eye.
    g.fillStyle = rgba('#8a6a50', 0.8);
    g.beginPath();
    g.ellipse(x, y - 15 * s, 13 * s, 6 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = rgba('#d8c8a8', 0.9);
    for (const [tx, tw, th] of [[-7, 4, 9], [-1, 5, 13], [5, 4, 7]] as const) {
      g.fillRect(x + tx * s * d - (tw * s) / 2, y - 20 * s - th * s, tw * s, th * s);
      g.strokeRect(x + tx * s * d - (tw * s) / 2, y - 20 * s - th * s, tw * s, th * s);
      g.fillStyle = rgba(RED, 0.8);
      g.beginPath();
      g.moveTo(x + tx * s * d - tw * s * 0.7, y - 20 * s - th * s);
      g.lineTo(x + tx * s * d, y - 24 * s - th * s);
      g.lineTo(x + tx * s * d + tw * s * 0.7, y - 20 * s - th * s);
      g.fill();
      g.stroke();
      g.fillStyle = rgba('#d8c8a8', 0.9);
    }
    g.fillStyle = rgba('#f0c060', 0.9);
    g.beginPath();
    g.arc(x + 10 * s * d, y - 16 * s, 2 * s, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Its smoke, in little curls.
    ink(g, 0.8 * s, 0.5);
    for (let q = 0; q < 3; q++) {
      const t = (E.t * 0.4 + q / 3) % 1;
      g.beginPath();
      g.arc(x - 1 * s * d + Math.sign(world.wind || 1) * t * 12 * s, y - 36 * s - t * 14 * s, (1.5 + t * 3) * s, 0, Math.PI * 1.6);
      g.stroke();
    }
  }
  function batIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, col: string) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, 5 * s, 2 * s, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 1.2 * s;
    g.beginPath();
    g.moveTo(x - 9 * s, y - 3 * s - flap * 3 * s);
    g.quadraticCurveTo(x - 4 * s, y - 1 * s, x, y - 1 * s);
    g.quadraticCurveTo(x + 4 * s, y - 1 * s, x + 9 * s, y - 3 * s - flap * 3 * s);
    g.stroke();
  }
  function live(g: CanvasRenderingContext2D, gm: ReturnType<typeof geom>) {
    const s = gm.s;
    const mx = (Xc: number) => gm.cx + (Xc - world.X) * gm.k;
    const X = world.X;
    const cy = roadY(X, gm);
    // The road walked, in red ink, from the edge of the map to the castle.
    g.strokeStyle = rgba(RED, 0.75);
    g.lineWidth = 2 * s;
    g.setLineDash([]);
    g.beginPath();
    for (let px = -10; px <= gm.cx; px += 4) {
      const Xc = X + (px - gm.cx) / gm.k;
      if (px === -10) g.moveTo(px, roadY(Xc, gm));
      else g.lineTo(px, roadY(Xc, gm));
    }
    g.stroke();
    // The way ahead, in pencil dots.
    g.strokeStyle = rgba(INK, 0.35);
    g.lineWidth = 1.2 * s;
    g.setLineDash([2 * s, 4 * s]);
    g.beginPath();
    for (let px = gm.cx; px <= gm.W + 10; px += 4) {
      const Xc = X + (px - gm.cx) / gm.k;
      if (px === gm.cx) g.moveTo(px, roadY(Xc, gm));
      else g.lineTo(px, roadY(Xc, gm));
    }
    g.stroke();
    g.setLineDash([]);
    // Marks of what has happened: towns burning and burnt, wrecks, struck trees, tar.
    const sf = PLANES.far.s;
    for (const b of [...world.burning, ...world.ruins]) {
      const Xc = b.L / sf;
      const x = mx(Xc);
      const y = roadY(Xc, gm) - (110 + R(hash(Math.round(b.L)), 1) * 0) * s;
      const ty = land.farTownsIn(b.L - 1, b.L + 1)[0];
      const yy = ty ? roadY(ty.L / sf, gm) - (110 + R(ty.seed, 1) * 40) * s * (gm.phone ? 0.8 : 1) : y;
      const burning = world.burning.includes(b) && E.t >= b.t0;
      if (burning) {
        for (let q = 0; q < 5; q++) {
          const fl = 0.6 + 0.4 * Math.sin(E.t * 6 + q * 2);
          g.fillStyle = rgba(q % 2 ? '#e06a2a' : '#f0a040', 0.8);
          g.beginPath();
          const fx = x + (q - 2) * 4 * s;
          g.moveTo(fx - 2.5 * s, yy);
          g.quadraticCurveTo(fx - 1 * s, yy - 6 * s * fl, fx, yy - 10 * s * fl);
          g.quadraticCurveTo(fx + 1 * s, yy - 6 * s * fl, fx + 2.5 * s, yy);
          g.fill();
        }
      } else {
        // Hatched black, a ruin.
        ink(g, 0.9 * s, 0.8);
        g.beginPath();
        for (let q = -3; q <= 3; q++) {
          g.moveTo(x + q * 3 * s - 4 * s, yy + 4 * s);
          g.lineTo(x + q * 3 * s + 4 * s, yy - 8 * s);
        }
        g.stroke();
      }
      // Smoke curling up from it.
      ink(g, 0.8 * s, 0.4);
      for (let q = 0; q < 4; q++) {
        const t = (E.t * 0.08 + q / 4) % 1;
        g.beginPath();
        g.arc(x + Math.sign(world.wind || 1) * t * 30 * s, yy - 14 * s - t * 40 * s, (2 + t * 6) * s, 0, Math.PI * 1.5);
        g.stroke();
      }
    }
    for (const m of world.wrecks) {
      const Xc = m.L / midS(2);
      const x = mx(Xc);
      const y = roadY(Xc, gm) - 50 * s;
      ink(g, 1.1 * s);
      g.beginPath();
      g.moveTo(x - 5 * s, y - 5 * s);
      g.lineTo(x + 5 * s, y + 5 * s);
      g.moveTo(x + 5 * s, y - 5 * s);
      g.lineTo(x - 5 * s, y + 5 * s);
      g.stroke();
    }
    for (const m of world.struck) {
      const Xc = m.L / midS(4);
      const x = mx(Xc);
      const y = roadY(Xc, gm) - 30 * s;
      ink(g, 1 * s);
      g.beginPath();
      g.moveTo(x, y + 4 * s);
      g.lineTo(x, y - 6 * s);
      g.moveTo(x, y - 3 * s);
      g.lineTo(x - 4 * s, y - 7 * s);
      g.moveTo(x, y - 4 * s);
      g.lineTo(x + 3 * s, y - 8 * s);
      g.stroke();
    }
    for (const m of world.stains) {
      const x = mx(m.L);
      g.fillStyle = rgba('#1a1214', 0.6);
      g.beginPath();
      g.ellipse(x, roadY(m.L, gm) + 8 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    // People on the road, walking away from the war.
    for (const w of world.walkers) {
      const Xc = X + c.dir * (w.x - world.GW / 2);
      const x = mx(Xc);
      g.fillStyle = rgba(INK, 0.8);
      g.beginPath();
      g.arc(x, roadY(Xc, gm) - 3 * s, 1.4 * s, 0, Math.PI * 2);
      g.fill();
    }
    // The tar men, blots behind it on the road.
    for (const tm of world.tar) {
      const Xc = X + c.dir * (tm.x - c.x);
      const x = mx(Xc);
      const y = roadY(Xc, gm) + (tm.dz / world.GH) * 60 * s;
      g.fillStyle = rgba('#140e10', 0.85);
      g.beginPath();
      g.ellipse(x, y - 2 * s, 2.8 * s, 3.6 * s + Math.sin(E.t * 6 + tm.seed) * 0.6 * s, 0, 0, Math.PI * 2);
      g.fill();
    }
    // The weather over the castle.
    if (world.storm > 0.05 || world.rain > 0.05) {
      const k = Math.max(world.storm, world.rain);
      g.fillStyle = rgba('#7a8090', 0.3 * k);
      ink(g, 1 * s, 0.7 * k);
      for (const [ox, oy, r] of [[-14, 0, 9], [0, -5, 12], [14, 0, 9]] as const) {
        g.beginPath();
        g.arc(gm.cx + ox * s, cy - 64 * s + oy * s, r * s, Math.PI, 0);
        g.fill();
        g.stroke();
      }
      ink(g, 0.8 * s, 0.6 * world.rain);
      g.beginPath();
      for (let q = 0; q < 9; q++) {
        const off = ((E.t * 30 + q * 7) % 20) * s;
        g.moveTo(gm.cx - 20 * s + q * 5 * s, cy - 58 * s + off);
        g.lineTo(gm.cx - 22 * s + q * 5 * s, cy - 52 * s + off);
      }
      g.stroke();
      if (world.bolt) {
        g.strokeStyle = rgba('#e0a020', 0.9);
        g.lineWidth = 1.6 * s;
        g.beginPath();
        g.moveTo(gm.cx + 4 * s, cy - 56 * s);
        g.lineTo(gm.cx - 2 * s, cy - 44 * s);
        g.lineTo(gm.cx + 3 * s, cy - 44 * s);
        g.lineTo(gm.cx - 3 * s, cy - 30 * s);
        g.stroke();
      }
    }
    if (world.rainbow > 0.02) {
      const cols = ['#d84a3a', '#e8a030', '#e8d040', '#5ab04a', '#4a80d0', '#7a50b0'];
      for (const [i, col] of cols.entries()) {
        g.strokeStyle = rgba(col, 0.5 * world.rainbow);
        g.lineWidth = 1.6 * s;
        g.beginPath();
        g.arc(gm.cx, cy - 20 * s, (60 - i * 2.2) * s, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
    }
    // The castle.
    castleIcon(g, gm.cx, cy, s * (gm.phone ? 1.6 : 2));
    // The air war: each ship where it is, relative to the castle, with a dotted course.
    for (const sh of world.ships) {
      const Xc = X + (c.dir * (sh.x - world.GW / 2)) / Math.max(0.05, sh.s);
      const x = mx(Xc);
      if (x < -40 || x > gm.W + 40) continue;
      const far = 1 - Math.min(1, sh.s / 0.7);
      const y = roadY(Xc, gm) - (40 + far * 80) * s - (sh.state === 'fall' ? -Math.min(40, (E.t - sh.t0) * 10) * s : 0);
      const col = sh.side ? '#3a5a8a' : '#4a2a2a';
      const v = (sh.vx * c.dir) / Math.max(0.05, sh.s);
      g.strokeStyle = rgba(col, 0.4);
      g.lineWidth = 0.8 * s;
      g.setLineDash([1.5 * s, 3 * s]);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - Math.sign(v || 1) * 50 * s, y + 4 * s);
      g.stroke();
      g.setLineDash([]);
      batIcon(g, x, y, s * (sh.kind === 'bomber' ? 1.2 : 0.6), Math.sin(sh.beat), rgba(col, 0.85));
      if (sh.state === 'fall') {
        ink(g, 0.8 * s, 0.6);
        g.beginPath();
        g.arc(x, y - 6 * s, 3 * s, 0, Math.PI * 1.4);
        g.stroke();
      }
    }
    for (const f of world.fx) {
      if (f.kind !== 'tracer') continue;
      const Xc = X + (c.dir * (f.x - world.GW / 2)) / Math.max(0.05, f.s);
      const x = mx(Xc);
      const y = roadY(Xc, gm) - (40 + (1 - Math.min(1, f.s / 0.7)) * 80) * s;
      g.strokeStyle = rgba(RED, 0.8);
      g.lineWidth = 1 * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.sign(f.vx) * 5 * s, y);
      g.stroke();
    }
    // The other walking house, on the far hills.
    if (world.hen) {
      const L = world.hen.L + (E.t - world.hen.t0) * 6 * u;
      const Xc = L / sf;
      const x = mx(Xc);
      const y = roadY(Xc, gm) - 140 * s;
      ink(g, 1 * s);
      hut(g, x, y - 6 * s, 7 * s, 1.2, '#c8a050');
      g.beginPath();
      g.moveTo(x - 2 * s, y - 6 * s);
      g.lineTo(x - 3 * s + Math.sin(E.t * 3) * 2 * s, y);
      g.moveTo(x + 2 * s, y - 6 * s);
      g.lineTo(x + 3 * s - Math.sin(E.t * 3) * 2 * s, y);
      g.stroke();
    }
  }

  // ---- the furniture: cartouche, the hour, a compass, the diary --------------------------------------------
  function furniture(g: CanvasRenderingContext2D, gm: ReturnType<typeof geom>) {
    const { W, H, phone } = gm;
    const m = Math.max(10, Math.min(W, H) * 0.025) + 14;
    // The cartouche, top left: whose walk, and where.
    const ts = Math.round(Math.max(18, Math.min(30, W * 0.022)));
    g.font = SERIF(ts, true, '600');
    const title = `The Walk of ${c.name.replace(/^The /, 'the ')}`;
    const tw = g.measureText(title).width;
    g.font = SERIF(Math.round(ts * 0.55), true);
    const sub = `across ${world.homeland}, in the ${world.season === 'late' ? 'late summer' : world.season}`;
    const sw = g.measureText(sub).width;
    const bw = Math.min(W - m * 2, Math.max(tw, sw) + ts * 1.6);
    const bh = ts * 2.3;
    const bx = phone ? (W - bw) / 2 : m;
    const by = m;
    g.fillStyle = rgba('#f4ead2', 0.92);
    g.fillRect(bx, by, bw, bh);
    ink(g, 1.4);
    g.strokeRect(bx, by, bw, bh);
    ink(g, 0.6);
    g.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);
    g.textAlign = 'center';
    g.font = SERIF(ts, true, '600');
    g.fillStyle = rgba(INK, 0.95);
    fillCrisp(g, fitText(g, title, bw - ts), bx + bw / 2, by + ts * 1.15);
    g.font = SERIF(Math.round(ts * 0.55), true);
    g.fillStyle = rgba(INK, 0.8);
    fillCrisp(g, fitText(g, sub, bw - ts), bx + bw / 2, by + ts * 1.85);
    // The hour, top right: a medallion with the sun or the moon, and the time in words.
    const r = Math.max(18, Math.min(30, W * 0.02));
    const hx = W - m - r - 4;
    const hy = phone ? by + bh + r + 14 : m + r + 2;
    const day = world.day;
    const sun = sunPos(day, 100, 100, 1);
    const night = E.night;
    g.fillStyle = rgba(night > 0.5 ? '#3a4a6a' : goldenOf(day) > 0.3 ? '#e8a060' : '#9ac0e0', 0.75);
    g.beginPath();
    g.arc(hx, hy, r, 0, Math.PI * 2);
    g.fill();
    ink(g, 1.4);
    g.stroke();
    const a = Math.PI + clamp01(sun.k) * Math.PI;
    g.fillStyle = night > 0.5 ? '#f4f0e0' : '#f8d040';
    g.beginPath();
    g.arc(hx + Math.cos(a) * r * 0.55, hy + Math.sin(a) * r * 0.55 + r * 0.2, r * 0.22, 0, Math.PI * 2);
    g.fill();
    ink(g, 0.8);
    g.stroke();
    ink(g, 0.8);
    g.beginPath();
    g.moveTo(hx - r * 0.85, hy + r * 0.25);
    g.lineTo(hx + r * 0.85, hy + r * 0.25);
    g.stroke();
    g.font = SERIF(Math.round(Math.max(11, r * 0.5)), true);
    g.textAlign = 'right';
    g.fillStyle = rgba(INK, 0.9);
    const tw2 = timeWords(day).toLowerCase().replace(/^./, (q) => q.toUpperCase());
    fillCrisp(g, fitText(g, tw2, W * 0.4), hx + r, hy + r + Math.max(13, r * 0.6));
    g.font = SERIF(Math.round(Math.max(10, r * 0.42)), true);
    fillCrisp(g, `day ${world.days + 1} · ${Math.round(c.miles)} ${Math.round(c.miles) === 1 ? 'mile' : 'miles'} walked`, hx + r, hy + r + Math.max(13, r * 0.6) + Math.max(12, r * 0.5));
    // A compass rose, bottom right.
    const cr = Math.max(16, Math.min(34, W * 0.022));
    const ccx = W - m - cr - 6;
    const ccy = H - m - cr - 6;
    ink(g, 0.8, 0.7);
    g.beginPath();
    g.arc(ccx, ccy, cr * 0.75, 0, Math.PI * 2);
    g.stroke();
    for (let q = 0; q < 8; q++) {
      const aa = (q / 8) * Math.PI * 2 - Math.PI / 2;
      const len = q % 2 ? cr * 0.55 : cr;
      g.fillStyle = q % 2 ? rgba(INK, 0.4) : q === 0 ? rgba(RED, 0.8) : rgba(INK, 0.7);
      g.beginPath();
      g.moveTo(ccx, ccy);
      g.lineTo(ccx + Math.cos(aa - 0.18) * len * 0.3, ccy + Math.sin(aa - 0.18) * len * 0.3);
      g.lineTo(ccx + Math.cos(aa) * len, ccy + Math.sin(aa) * len);
      g.lineTo(ccx + Math.cos(aa + 0.18) * len * 0.3, ccy + Math.sin(aa + 0.18) * len * 0.3);
      g.closePath();
      g.fill();
    }
    g.font = SERIF(Math.round(cr * 0.45), false, '600');
    g.textAlign = 'center';
    g.fillStyle = rgba(INK, 0.8);
    fillCrisp(g, 'N', ccx, ccy - cr - 3);
    // The diary, bottom left: the last few things written down, in ink.
    if (!o.hud) return;
    const lines = world.chronicle.slice(phone ? -2 : -3);
    const fs = Math.round(Math.max(13, Math.min(18, W * 0.0125)));
    const maxW = phone ? W - m * 2 - 8 : Math.min(W * 0.46, 620);
    g.textAlign = 'left';
    g.font = SERIF(fs, true);
    const bottom = H - m - (phone ? cr * 2 + 14 : 8);
    lines.forEach((l, i) => {
      const age = E.t - l.t;
      const al = Math.min(1, age * 0.8) * (i === lines.length - 1 ? 0.95 : 0.7);
      g.fillStyle = rgba(INK, al);
      const text = fitText(g, `Day ${l.day}. ${l.text}`, maxW);
      fillCrisp(g, text, m + 4, bottom - (lines.length - 1 - i) * fs * 1.45);
    });
  }

  function paint(t: number) {
    void t;
    const gm = geom();
    const ctx = E.ctx;
    if (!paper || paperKey !== `${gm.W}x${gm.H}`) {
      paintPaper(gm.W, gm.H);
      content = null;
    }
    if (!content || Math.abs(world.X - X0) * gm.k > 200 || cH !== gm.H) paintContent(gm);
    ctx.drawImage(paper!, 0, 0, gm.W, gm.H);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(content!, -260 - (world.X - X0) * gm.k, 0);
    ctx.restore();
    live(ctx, gm);
    furniture(ctx, gm);
    // At night, the map is read by lamplight.
    const n = E.night;
    if (n > 0.05) {
      const lx = gm.cx;
      const ly = gm.H * 0.5;
      const lg = ctx.createRadialGradient(lx, ly, Math.min(gm.W, gm.H) * 0.15, lx, ly, Math.hypot(gm.W, gm.H) * 0.65);
      lg.addColorStop(0, `rgba(255,190,110,${(0.06 * n).toFixed(3)})`);
      lg.addColorStop(0.5, `rgba(60,36,30,${(0.25 * n).toFixed(3)})`);
      lg.addColorStop(1, `rgba(20,12,16,${(0.62 * n).toFixed(3)})`);
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, gm.W, gm.H);
    }
  }
  /** Where a world point is on the map now (for sound's pan). */
  function project(x: number, y: number): [number, number] {
    const gm = geom();
    const Xc = world.X + c.dir * (x - world.GW / 2);
    return [gm.cx + (Xc - world.X) * gm.k, y < land.HY ? gm.H * 0.3 : roadY(Xc, gm)];
  }
  /** The world point a touch on the map stands for: the castle if near its drawing, else the grass by it. */
  function unproject(x: number, y: number): [number, number] {
    const gm = geom();
    const cy = roadY(world.X, gm);
    if (Math.hypot(x - gm.cx, y - (cy - 20 * gm.s)) < 40 * gm.s) return [c.x, c.y - 100 * c.cs];
    return [c.x + (x - gm.cx) * 0.2, land.GY + world.GH * 0.05];
  }
  /** Where the subtitles go on the map: above the diary. */
  function subY() {
    const gm = geom();
    const m = Math.max(10, Math.min(gm.W, gm.H) * 0.025) + 14;
    const fs = Math.round(Math.max(13, Math.min(18, gm.W * 0.0125)));
    return gm.H - m - (gm.phone ? 60 : 8) - fs * 1.45 * 3 - 30;
  }
  return { paint, project, unproject, subY };
}
