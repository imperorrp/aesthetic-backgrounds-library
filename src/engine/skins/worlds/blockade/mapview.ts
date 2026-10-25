/**
 * Blockade as the flagship's orbital plot: the same sim, seen from above the planet's pole on a
 * holo-table. The planet in the middle (its day side, the terminator, the cities on its night
 * side, the shadow it throws), the orbits ringed round it with a bearing scale, and the line
 * all the way round: capital ships as wedges, frigates as diamonds, wings as darts with their
 * wakes, shuttles on dashed courses down to the surface, merchants held at the picket, a runner
 * with its predicted track and a lock on it, lines of fire, wrecks marked where they fell, the
 * station with its build, and the campaign's gauges in the corners.
 *
 * Mapping: a world point's bearing round the planet's centre becomes its bearing on the plot
 * (spread to nearly the whole circle: the line seen in the scene is the line all round); its
 * height above the limb and its depth become its orbit's radius.
 */
import { fitText } from '../../../kit';
import { fillCrisp, hash } from '../../instruments/kit';
import { CLS_WORD, STATS } from './design';
import type { ShipArt } from './ships';
import { rgbOf, css } from './ships';
import { mkCanvas, type Glows } from './sky';
import { DISPLAY, hexToRgba, lighten, MONO, storesWord } from './text';
import type { BlockWorld, Ship } from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

export function createMapPainter(world: BlockWorld, art: ShipArt, glows: Glows, seed: number) {
  void art;
  const { GW, GH, planet } = world;
  const { cx, cy, R } = planet;
  const phiMax = Math.atan2(GW * 0.55, cy - GH * 0.3);
  const topAlt = Math.max(0.05, cy / R - 1);
  let base: HTMLCanvasElement | null = null;
  let baseKey = '';
  const wakes = new Map<number, [number, number][]>();
  let wakeT = 0;
  const INK = '#9fd8ff';
  const fleetC = lighten(world.fleet.trim === '#e8e8f0' ? '#9ab8ff' : world.fleet.engine);
  const homeC = lighten(world.planetLook.atmo);
  const colorOf = (s: { side: Ship['side']; tag?: string }) => (s.tag === 'defect' ? '#f0a050' : s.side === 'fleet' ? fleetC : s.side === 'home' ? homeC : s.side === 'merchant' ? '#e8c070' : '#ff9a4a');

  let mapScale = 1;
  const geo = (W: number, H: number) => {
    const phone = W < 620;
    const Rp = Math.min(W, H) * (phone ? 0.2 : 0.17);
    mapScale = Math.max(0.75, Math.min(1.3, Math.min(W, H) / 700));
    return { Px: W / 2, Py: H * (phone ? 0.47 : 0.53), Rp, phone };
  };
  /** World point (and depth) to the plot. */
  function plot(x: number, y: number, z: number, W: number, H: number): [number, number, number] {
    const { Px, Py, Rp } = geo(W, H);
    const fw = Math.atan2(x - cx, cy - y);
    const rr = Math.hypot(x - cx, y - cy) / R - 1;
    const altN = rr / topAlt;
    const zc = z <= 1 ? z : Math.max(0, 1 - (z - 1) * 2.2);
    const rho = Rp * (1.06 + clamp(altN, -0.04, 1.4) * 0.95 + zc * 0.42);
    const ph = -Math.PI / 2 + clamp(fw / phiMax, -1.15, 1.15) * 2.6;
    return [Px + Math.cos(ph) * rho, Py + Math.sin(ph) * rho, ph];
  }
  /** The tangent direction on the plot for a ship heading `dir` in the scene. */
  const tangent = (ph: number, dir: number) => ph + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);

  /** The plate: the table's glass, its grid, the orbits and the bearing ring (baked per size). */
  function bakeBase(W: number, H: number) {
    const { Px, Py, Rp } = geo(W, H);
    const c = mkCanvas(W, H);
    const g = c.getContext('2d')!;
    const bg = g.createRadialGradient(Px, Py, 0, Px, Py, Math.hypot(W, H) * 0.6);
    bg.addColorStop(0, '#0b1a28');
    bg.addColorStop(0.5, '#06101c');
    bg.addColorStop(1, '#02060c');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    // A fine grid of dots, like the table's glass.
    g.fillStyle = 'rgba(120,190,255,0.08)';
    const step = 22;
    for (let y = (Py % step) - step; y < H; y += step) for (let x = (Px % step) - step; x < W; x += step) g.fillRect(x, y, 1, 1);
    g.strokeStyle = 'rgba(120,190,255,0.05)';
    g.lineWidth = 1;
    for (let k = -4; k <= 4; k++) {
      g.beginPath();
      g.moveTo(Px + k * step * 5, 0);
      g.lineTo(Px + k * step * 5, H);
      g.moveTo(0, Py + k * step * 5);
      g.lineTo(W, Py + k * step * 5);
      g.stroke();
    }
    // Orbits.
    const rings: [number, string][] = [[1.06, 'LOW ORBIT'], [1.55, 'THE LINE'], [2.0, 'HIGH ORBIT']];
    rings.forEach(([k, name], i) => {
      g.strokeStyle = `rgba(140,200,255,${i === 1 ? 0.22 : 0.12})`;
      g.setLineDash(i === 1 ? [6, 5] : [2, 6]);
      g.beginPath();
      g.arc(Px, Py, Rp * k, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(140,200,255,0.4)';
      g.font = MONO(9);
      g.textAlign = 'left';
      fillCrisp(g, name, Px + Rp * k * Math.cos(-0.18) + 4, Py + Rp * k * Math.sin(-0.18));
    });
    // The bearing ring, ticked every five degrees.
    const RR = Rp * 2.42;
    g.strokeStyle = 'rgba(140,200,255,0.28)';
    g.beginPath();
    g.arc(Px, Py, RR, 0, TAU);
    g.stroke();
    g.font = MONO(9);
    g.textAlign = 'center';
    for (let d = 0; d < 360; d += 5) {
      const a = (d / 360) * TAU - Math.PI / 2;
      const len = d % 30 === 0 ? 9 : d % 10 === 0 ? 5 : 2.5;
      g.strokeStyle = `rgba(140,200,255,${d % 30 === 0 ? 0.55 : 0.3})`;
      g.beginPath();
      g.moveTo(Px + Math.cos(a) * RR, Py + Math.sin(a) * RR);
      g.lineTo(Px + Math.cos(a) * (RR + len), Py + Math.sin(a) * (RR + len));
      g.stroke();
      if (d % 30 === 0) {
        g.fillStyle = 'rgba(160,210,255,0.55)';
        fillCrisp(g, String(d).padStart(3, '0'), Px + Math.cos(a) * (RR + 18), Py + Math.sin(a) * (RR + 18) + 3);
      }
    }
    return c;
  }

  // The planet's night lights, fixed to its surface (they turn with it).
  const lights = Array.from({ length: Math.round(260 * world.planetLook.cityK) + 20 }, (_, i) => {
    const r = Math.sqrt(hash(seed, i, 1)) * 0.96;
    const a = hash(seed, i, 2) * TAU;
    const clump = hash(seed, Math.floor(a * 6), Math.floor(r * 5)) < 0.55 ? 1 : 0.2;
    return { r, a, b: hash(seed, i, 3) * clump };
  });

  function drawPlanet(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const { Px, Py, Rp } = geo(W, H);
    const t = world.t;
    // The sun's bearing on the plot: noon (hour 0.25) is toward the bottom, where the scene's camera stands.
    const sunA = Math.PI / 2 + (world.hour - 0.25) * TAU;
    const atmo = world.planetLook.atmo;
    // The shadow the planet throws, a long dark band away from the sun.
    ctx.save();
    const sx = Math.cos(sunA + Math.PI);
    const sy = Math.sin(sunA + Math.PI);
    const L = Rp * 3.2;
    const gsh = ctx.createLinearGradient(Px, Py, Px + sx * L, Py + sy * L);
    gsh.addColorStop(0, 'rgba(0,0,0,0.55)');
    gsh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gsh;
    ctx.beginPath();
    ctx.moveTo(Px - sy * Rp, Py + sx * Rp);
    ctx.lineTo(Px - sy * Rp + sx * L, Py + sx * Rp + sy * L);
    ctx.lineTo(Px + sy * Rp + sx * L, Py - sx * Rp + sy * L);
    ctx.lineTo(Px + sy * Rp, Py - sx * Rp);
    ctx.fill();
    // The air.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(glows.soft(atmo), Px - Rp * 1.35, Py - Rp * 1.35, Rp * 2.7, Rp * 2.7);
    ctx.restore();
    // The disc: the surface's colour, lit from the sun's side.
    const lx = Math.cos(sunA);
    const ly = Math.sin(sunA);
    const body = ctx.createRadialGradient(Px + lx * Rp * 0.45, Py + ly * Rp * 0.45, Rp * 0.1, Px, Py, Rp * 1.05);
    const low = rgbOf(world.planetLook.kind === 'gas' ? world.planetLook.low : world.planetLook.kind === 'ocean' ? world.planetLook.shallow : world.planetLook.mid);
    body.addColorStop(0, css(low.map((v) => v * 0.95) as [number, number, number]));
    body.addColorStop(0.55, css(low.map((v) => v * 0.45) as [number, number, number]));
    body.addColorStop(1, '#03070c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(Px, Py, Rp, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(Px, Py, Rp, 0, TAU);
    ctx.clip();
    // Bands or continents, sketched: arcs that turn with the planet.
    const spin = planet.omega * t;
    ctx.strokeStyle = hexToRgba(world.planetLook.kind === 'gas' ? world.planetLook.high : world.planetLook.low, 0.18);
    ctx.lineWidth = 1;
    for (let k = 1; k < 7; k++) {
      ctx.beginPath();
      ctx.arc(Px, Py, (Rp * k) / 7, spin + k, spin + k + 2.2 + hash(seed, k) * 2);
      ctx.stroke();
    }
    // The night half, and its cities.
    const night = ctx.createLinearGradient(Px + lx * Rp * 0.2, Py + ly * Rp * 0.2, Px - lx * Rp, Py - ly * Rp);
    night.addColorStop(0, 'rgba(1,3,8,0)');
    night.addColorStop(0.18, 'rgba(1,3,8,0.75)');
    night.addColorStop(1, 'rgba(1,3,8,0.92)');
    ctx.fillStyle = night;
    ctx.fillRect(Px - Rp, Py - Rp, Rp * 2, Rp * 2);
    ctx.globalCompositeOperation = 'lighter';
    const city = world.planetLook.city;
    for (const l of lights) {
      const a = l.a + spin;
      const x = Px + Math.cos(a) * l.r * Rp;
      const y = Py + Math.sin(a) * l.r * Rp;
      const dark = -((x - Px) * lx + (y - Py) * ly) / Rp;
      if (dark < 0.08) continue;
      ctx.fillStyle = hexToRgba(city, Math.min(1, dark * 2.5) * l.b * 0.9);
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    // Fires where the planet was struck.
    for (const sc of world.scars) {
      const p = world.surf(sc.lat, sc.lon);
      const [x, y] = plot(p[0], p[1], 1.45, W, H);
      const r = (3 + sc.heat * 5) * (0.8 + 0.2 * Math.sin(t * 6 + sc.lat * 100));
      ctx.globalAlpha = sc.heat;
      ctx.drawImage(glows.glow('#ff6a2a'), x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // The rim, and the graticule.
    ctx.strokeStyle = hexToRgba(lighten(atmo), 0.75);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(Px, Py, Rp, sunA - Math.PI / 2, sunA + Math.PI / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,200,255,0.35)';
    ctx.beginPath();
    ctx.arc(Px, Py, Rp, sunA + Math.PI / 2, sunA + Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,200,255,0.12)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(Px, Py, (Rp * k) / 3, 0, TAU);
      ctx.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const a = spin + (k / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Px + Math.cos(a) * Rp, Py + Math.sin(a) * Rp);
      ctx.lineTo(Px - Math.cos(a) * Rp, Py - Math.sin(a) * Rp);
      ctx.stroke();
    }
    // Aurora round the night rim.
    if (world.aurora > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 40; k++) {
        const a = sunA + Math.PI * 0.55 + (k / 40) * Math.PI * 0.9;
        const n = 0.5 + 0.5 * Math.sin(k * 1.7 + t * 0.8);
        ctx.strokeStyle = `rgba(90,255,160,${world.aurora * 0.35 * n})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(Px, Py, Rp * (1.03 + n * 0.04), a, a + 0.08);
        ctx.stroke();
      }
      ctx.restore();
    }
    // The sun's bearing: a marker on the outer ring.
    const RR = Rp * 2.42;
    const mx = Px + Math.cos(sunA) * (RR + 34);
    const my = Py + Math.sin(sunA) * (RR + 34);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.8 * (1 + world.flare);
    ctx.drawImage(glows.glow(world.star.glare), mx - 22, my - 22, 44, 44);
    ctx.restore();
    ctx.fillStyle = world.star.color;
    ctx.beginPath();
    ctx.arc(mx, my, 3.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,190,0.35)';
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(Px + Math.cos(sunA) * Rp * 1.1, Py + Math.sin(sunA) * Rp * 1.1);
    ctx.lineTo(Px + Math.cos(sunA) * RR, Py + Math.sin(sunA) * RR);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function shipGlyph(ctx: CanvasRenderingContext2D, s: Ship, x: number, y: number, ang: number, col: string) {
    const big = s.cls === 'dreadnought' || s.cls === 'cruiser' || s.cls === 'carrier' || s.cls === 'flagship';
    const L = (s.cls === 'flagship' ? 34 : big ? 16 + STATS[s.cls].len / 80 : s.cls === 'frigate' ? 11 : s.cls === 'freighter' || s.cls === 'tender' ? 10 : s.cls === 'corvette' ? 10 : s.cls === 'platform' ? 7 : 6) * mapScale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = hexToRgba(col, s.dark ? 0.35 : 0.95);
    ctx.fillStyle = hexToRgba(col, s.dark ? 0.06 : 0.18);
    ctx.lineWidth = big ? 1.4 : 1.1;
    ctx.beginPath();
    if (big) {
      ctx.moveTo(L * 0.55, 0);
      ctx.lineTo(-L * 0.45, -L * (s.cls === 'carrier' ? 0.22 : 0.17));
      ctx.lineTo(-L * 0.38, 0);
      ctx.lineTo(-L * 0.45, L * (s.cls === 'carrier' ? 0.22 : 0.17));
      ctx.closePath();
    } else if (s.cls === 'frigate' || s.cls === 'corvette') {
      ctx.moveTo(L * 0.6, 0);
      ctx.lineTo(0, -L * 0.3);
      ctx.lineTo(-L * 0.5, 0);
      ctx.lineTo(0, L * 0.3);
      ctx.closePath();
    } else if (s.cls === 'freighter' || s.cls === 'tender') {
      ctx.rect(-L * 0.5, -L * 0.22, L, L * 0.44);
    } else if (s.cls === 'platform') {
      ctx.arc(0, 0, L * 0.6, 0, TAU);
    } else {
      ctx.moveTo(L * 0.6, 0);
      ctx.lineTo(-L * 0.4, -L * 0.35);
      ctx.lineTo(-L * 0.2, 0);
      ctx.lineTo(-L * 0.4, L * 0.35);
      ctx.closePath();
    }
    ctx.fill();
    ctx.stroke();
    if (!s.dark && s.thrust > 0.3 && s.cls !== 'platform') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = s.thrust * 0.8;
      ctx.drawImage(glows.glow(col), -L * 0.5 - 6, -3, 8, 6);
    }
    ctx.restore();
  }

  function lock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, t: number, lines: string[]) {
    const c = r * 0.5;
    ctx.strokeStyle = hexToRgba(col, 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.moveTo(x + sx * r, y + sy * r - sy * c);
      ctx.lineTo(x + sx * r, y + sy * r);
      ctx.lineTo(x + sx * r - sx * c, y + sy * r);
    }
    ctx.stroke();
    ctx.font = MONO(10);
    ctx.textAlign = 'left';
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
    const bx = x + r + 14;
    const by = y - r - 6;
    ctx.fillStyle = 'rgba(2,8,16,0.7)';
    ctx.fillRect(bx, by - 11, w, lines.length * 13 + 6);
    ctx.strokeStyle = hexToRgba(col, 0.5);
    ctx.beginPath();
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(bx, by - 4);
    ctx.stroke();
    lines.forEach((l, i) => {
      ctx.fillStyle = hexToRgba(i ? '#d8e8ff' : col, i ? 0.85 : 1);
      fillCrisp(ctx, l, bx + 6, by + i * 13);
    });
    void t;
  }

  function gauge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, v: number, col: string, right: boolean) {
    const cells = 10;
    const filled = Math.round(v * cells);
    const bar = '■'.repeat(filled) + '□'.repeat(cells - filled);
    ctx.font = MONO(10);
    ctx.textAlign = right ? 'right' : 'left';
    ctx.fillStyle = hexToRgba(col, 0.9);
    fillCrisp(ctx, `${label} ${bar}`, x, y);
  }

  return {
    project(x: number, y: number, W: number, H: number): [number, number] {
      const p = plot(x, y, 0.5, W, H);
      return [p[0], p[1]];
    },
    unproject(px: number, py: number, W: number, H: number): [number, number] {
      const { Px, Py, Rp } = geo(W, H);
      const ph = Math.atan2(py - Py, px - Px);
      let a = ph + Math.PI / 2;
      if (a > Math.PI) a -= TAU;
      const fw = (a / 2.6) * phiMax;
      const rho = Math.hypot(px - Px, py - Py) / Rp;
      if (rho < 1) return [cx + Math.sin(fw) * R * (1 - 0.02 - (1 - rho) * 0.1), cy - Math.cos(fw) * R * (1 - 0.02 - (1 - rho) * 0.1)];
      const altN = Math.max(0.02, (rho - 1.06 - 0.21) / 0.95);
      const rr = altN * topAlt;
      return [cx + Math.sin(fw) * R * (1 + rr), cy - Math.cos(fw) * R * (1 + rr)];
    },
    draw(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, _cam: { zoom: number; x: number; y: number }) {
      const key = `${W}x${H}`;
      if (!base || baseKey !== key) {
        base = bakeBase(W, H);
        baseKey = key;
      }
      const { Px, Py, Rp, phone } = geo(W, H);
      ctx.drawImage(base, 0, 0);
      drawPlanet(ctx, W, H);
      // The moons on their far orbits; the rings.
      if (world.rings) {
        ctx.lineWidth = 1;
        for (let k = 0; k < 9; k++) {
          ctx.strokeStyle = hexToRgba(world.rings.tint, 0.05 + 0.08 * hash(seed, k, 40));
          ctx.beginPath();
          ctx.arc(Px, Py, Rp * (1.2 + k * 0.025), 0, TAU);
          ctx.stroke();
        }
      }
      world.moons.forEach((mo, i) => {
        const orbit = Rp * (2.2 + i * 0.14);
        const a = (mo.x / GW) * TAU * 0.5 + i * 2 + t * 0.002;
        ctx.strokeStyle = 'rgba(140,200,255,0.08)';
        ctx.beginPath();
        ctx.arc(Px, Py, orbit, 0, TAU);
        ctx.stroke();
        const mx = Px + Math.cos(a) * orbit;
        const my = Py + Math.sin(a) * orbit;
        ctx.fillStyle = mo.tint;
        ctx.beginPath();
        ctx.arc(mx, my, Math.max(3, mo.r * 0.15), 0, TAU);
        ctx.fill();
        if (!phone) {
          ctx.font = MONO(9);
          ctx.textAlign = 'left';
          ctx.fillStyle = 'rgba(180,200,230,0.6)';
          fillCrisp(ctx, mo.name, mx + 7, my + 3);
        }
      });
      // The station, with its build.
      const st = world.station;
      {
        const [x, y] = plot(st.x, st.y, st.z, W, H);
        const r = st.kind === 'wheel' ? 9 : 6;
        ctx.strokeStyle = hexToRgba(fleetC, 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        if (st.kind === 'wheel') ctx.arc(x, y, r, 0, TAU);
        else ctx.arc(Px, Py, Math.hypot(x - Px, y - Py), -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9);
        ctx.stroke();
        const k = clamp(st.built / st.plan, 0, 1);
        ctx.strokeStyle = hexToRgba('#fde68a', 0.9);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + k * TAU);
        ctx.stroke();
        ctx.font = MONO(9.5);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(220,232,250,0.8)';
        fillCrisp(ctx, `${st.name} · ${st.built}/${st.plan}`, x + r + 9, y + 3);
      }
      // Wakes.
      if (t - wakeT > 0.25) {
        wakeT = t;
        const live = new Set<number>();
        for (const s of world.ships) {
          if (s.name === 'MARKER') continue;
          live.add(s.id);
          const p = plot(s.x, s.y, s.z, W, H);
          let w = wakes.get(s.id);
          if (!w) wakes.set(s.id, (w = []));
          w.push([p[0], p[1]]);
          if (w.length > 22) w.shift();
        }
        for (const id of wakes.keys()) if (!live.has(id)) wakes.delete(id);
      }
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (const s of world.ships) {
        const w = wakes.get(s.id);
        if (!w || w.length < 3) continue;
        const col = colorOf(s);
        for (let i = 1; i < w.length; i++) {
          ctx.strokeStyle = hexToRgba(col, 0.06 + 0.4 * (i / w.length));
          ctx.beginPath();
          ctx.moveTo(w[i - 1][0], w[i - 1][1]);
          ctx.lineTo(w[i][0], w[i][1]);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      // Courses: shuttles and runners to the surface, dashed and marching.
      ctx.lineDashOffset = -t * 10;
      for (const s of world.ships) {
        if (s.state !== 'descend' && s.state !== 'dash') continue;
        const p = world.surf(s.lat, s.lon);
        const a = plot(s.x, s.y, s.z, W, H);
        const b = plot(p[0], p[1], 1.45, W, H);
        ctx.strokeStyle = hexToRgba(colorOf(s), s.side === 'runner' ? 0.7 : 0.3);
        ctx.setLineDash(s.side === 'runner' ? [5, 4] : [2, 5]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        if (s.side === 'runner') {
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(b[0] - 4, b[1] - 4);
          ctx.lineTo(b[0] + 4, b[1] + 4);
          ctx.moveTo(b[0] + 4, b[1] - 4);
          ctx.lineTo(b[0] - 4, b[1] + 4);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      // Debris, and the wrecks marked where they drift.
      ctx.fillStyle = 'rgba(200,190,170,0.55)';
      for (const d of world.debris) {
        const [x, y] = plot(d.x, d.y, d.z, W, H);
        ctx.fillRect(x, y, 1.2, 1.2);
      }
      ctx.font = MONO(9);
      ctx.textAlign = 'left';
      for (const w of world.wrecks) {
        const [x, y] = plot(w.x, w.y, w.z, W, H);
        ctx.strokeStyle = w.fall ? 'rgba(255,160,80,0.9)' : 'rgba(200,200,210,0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4);
        ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4);
        ctx.lineTo(x - 4, y + 4);
        ctx.stroke();
        if (!phone) {
          ctx.fillStyle = 'rgba(190,196,210,0.6)';
          fillCrisp(ctx, `WRECK · ${w.name}`, x + 7, y + 3);
        }
      }
      // Lines of fire.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const b of world.bolts) {
        const k = clamp((t - b.t0) / b.dur, 0, 1);
        const a = plot(b.x0, b.y0, b.z0, W, H);
        const c = isNaN(b.lat) ? plot(b.x1, b.y1, b.z1, W, H) : (() => {
          const p = world.surf(b.lat, b.lon);
          return plot(p[0], p[1], 1.45, W, H);
        })();
        const beam = b.kind === 'beam' || b.kind === 'ion';
        ctx.strokeStyle = hexToRgba(b.color, beam ? 0.8 * (1 - k) : 0.85);
        ctx.lineWidth = beam ? 2 : b.kind === 'heavy' ? 1.6 : 1;
        ctx.beginPath();
        if (beam) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(c[0], c[1]);
        } else {
          const hx = a[0] + (c[0] - a[0]) * k;
          const hy = a[1] + (c[1] - a[1]) * k;
          const tk = Math.max(0, k - 0.25);
          ctx.moveTo(a[0] + (c[0] - a[0]) * tk, a[1] + (c[1] - a[1]) * tk);
          ctx.lineTo(hx, hy);
        }
        ctx.stroke();
      }
      // Explosions and flashes.
      for (const f of world.fx) {
        if (f.kind !== 'flash' && f.kind !== 'ring' && f.kind !== 'jump') continue;
        const k = (t - f.t0) / f.dur;
        const [x, y] = plot(f.x, f.y, f.z, W, H);
        if (f.kind === 'ring') {
          ctx.strokeStyle = hexToRgba(f.color, 0.7 * (1 - k));
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, 4 + k * 26, 0, TAU);
          ctx.stroke();
        } else {
          const r = 6 + 18 * (1 - k);
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.drawImage(glows.glow(f.color), x - r, y - r, r * 2, r * 2);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
      // Contacts gathering under the night side: pips that come and go.
      if (world.war.stage === 'contacts') {
        const sunA = Math.PI / 2 + (world.hour - 0.25) * TAU;
        ctx.font = MONO(10);
        ctx.textAlign = 'center';
        for (let k = 0; k < 7; k++) {
          const a = sunA + Math.PI + (hash(seed, k, 11) - 0.5) * 1.6;
          const rr = Rp * (0.75 + hash(seed, k, 12) * 0.25);
          const on = Math.sin(t * 2 + k * 1.3) > 0;
          if (!on) continue;
          ctx.fillStyle = 'rgba(255,200,120,0.85)';
          fillCrisp(ctx, '?', Px + Math.cos(a) * rr, Py + Math.sin(a) * rr + 3);
        }
      }
      // Ships, and the names of the capital ships.
      const placed: [number, number, number][] = [];
      const ordered = [...world.ships].filter((s) => s.name !== 'MARKER').sort((a, b) => b.z - a.z);
      for (const s of ordered) {
        const p = plot(s.x, s.y, s.z, W, H);
        const ang = s.state === 'descend' || s.state === 'dash' || s.state === 'ascend' ? Math.atan2(Py - p[1], Px - p[0]) * (s.state === 'ascend' ? -1 : 1) : tangent(p[2], s.dir);
        shipGlyph(ctx, s, p[0], p[1], ang, colorOf(s));
      }
      ctx.font = MONO(9.5);
      ctx.textAlign = 'left';
      for (const s of ordered) {
        const cap = s.cls === 'dreadnought' || s.cls === 'cruiser' || s.cls === 'carrier' || s.cls === 'flagship';
        if (!cap && !(s === world.ships.find((q) => q.side === 'runner' && q.name !== 'MARKER'))) continue;
        if (phone && !cap) continue;
        const p = plot(s.x, s.y, s.z, W, H);
        const label = phone ? s.name : `${s.name} · ${CLS_WORD[s.cls]}`;
        const w = ctx.measureText(label).width;
        const out = p[0] > Px ? 1 : -1;
        let lx = out > 0 ? p[0] + 12 : p[0] - 12 - w;
        let ly = p[1] + 3;
        let ok = false;
        for (const dy of [0, -12, 12, -24, 24]) {
          const yy = ly + dy;
          if (!placed.some(([qx, qy, qw]) => Math.abs(qy - yy) < 11 && lx < qx + qw + 6 && lx + w + 6 > qx)) {
            ly = yy;
            ok = true;
            break;
          }
        }
        if (!ok || lx < 4 || lx + w > W - 4) continue;
        placed.push([lx, ly, w]);
        ctx.fillStyle = hexToRgba(colorOf(s), s.dark ? 0.45 : 0.85);
        fillCrisp(ctx, label, lx, ly);
        void lx;
        lx = 0;
      }
      // A lock on whatever matters most: a runner, a defector, a dying ship.
      const hot = world.ships.find((s) => (s.side === 'runner' && s.name !== 'MARKER') || s.state === 'dying');
      if (hot) {
        const p = plot(hot.x, hot.y, hot.z, W, H);
        const eta = hot.state === 'dash' ? Math.max(0, hot.dur - (t - hot.t0)) : 0;
        const lines = [`TRK ${hot.side === 'runner' ? (hot.tag === 'defect' ? 'DEFECTOR' : 'RUNNER') : 'CRITICAL'}`, hot.name, hot.state === 'dash' ? `ETA AIR ${Math.floor(eta / 60)}:${String(Math.floor(eta % 60)).padStart(2, '0')}` : hot.job];
        lock(ctx, p[0], p[1], 11, hot.state === 'dying' ? '#ff6a6a' : '#ffb060', t, phone ? lines.slice(0, 2) : lines);
      }
      // The planet's name across its face.
      ctx.textAlign = 'center';
      (ctx as unknown as { letterSpacing: string }).letterSpacing = '4px';
      ctx.font = DISPLAY(phone ? 11 : 13);
      ctx.fillStyle = 'rgba(220,236,255,0.75)';
      fillCrisp(ctx, world.name, Px, Py + 4);
      (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';
      // The campaign, in the lower corners: the line's resolve, the planet's stores and anger.
      const y0 = H - (phone ? 92 : 78);
      const left = 18;
      const right = W - 18;
      const caps = world.ships.filter((s) => s.side === 'fleet' && (s.cls === 'dreadnought' || s.cls === 'cruiser' || s.cls === 'carrier') && s.state !== 'dead').length;
      ctx.fillStyle = 'rgba(2,8,16,0.6)';
      if (!phone) {
        ctx.fillRect(left - 8, y0 - 16, 290, 50);
        ctx.fillRect(right - 282, y0 - 16, 290, 50);
        ctx.font = DISPLAY(10.5);
        ctx.textAlign = 'left';
        ctx.fillStyle = hexToRgba(fleetC, 0.95);
        fillCrisp(ctx, fitText(ctx, `▲ ${world.fleet.short} · ${caps} CAPITAL SHIPS ON STATION`, 280), left, y0);
        gauge(ctx, left, y0 + 15, 'RESOLVE', world.war.resolve, fleetC, false);
        ctx.font = DISPLAY(10.5);
        ctx.textAlign = 'right';
        ctx.fillStyle = hexToRgba(homeC, 0.95);
        fillCrisp(ctx, fitText(ctx, `${world.name} · ${storesWord(world.war.stores)} ▼`, 280), right, y0);
        gauge(ctx, right, y0 + 15, 'STORES', world.war.stores, homeC, true);
        gauge(ctx, right, y0 + 28, 'ANGER ', world.war.anger, '#ff9a7a', true);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(170,190,220,0.7)';
        ctx.font = MONO(9.5);
        fillCrisp(ctx, `THROUGH ${world.tally.through} · STOPPED ${world.tally.caught + world.tally.killed} · LOST ${world.tally.lost}`, left, y0 + 28);
      }
      // The table's edge: a vignette, and a slow scan sweeping round.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sweep = (t * 0.35) % TAU;
      const sg = ctx.createConicGradient?.(sweep - 0.5, Px, Py);
      if (sg) {
        sg.addColorStop(0, 'rgba(120,200,255,0)');
        sg.addColorStop(0.035, 'rgba(120,200,255,0.05)');
        sg.addColorStop(0.04, 'rgba(120,200,255,0)');
        sg.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(Px, Py, Rp * 2.42, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      void INK;
    },
  };
}
