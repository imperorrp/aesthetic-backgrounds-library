/**
 * Ironhaze's cast: what can happen in a city, drawn per seed (see RULE).
 *
 * War: battles in the sky (two fleets, broadsides, fighters dogfighting, ships burning and going
 * down), air raids by night (bombers caught in the searchlights, flak, bombs and fires in the
 * streets), sieges (enemy walkers shelling the city, the roof guns answering), the armada
 * passing, raiders. Wonders: the iron walkers marching, the walking fortress, a floating citadel,
 * the sky-carrier, a launch at the skydock. Spectacle: the parade, sky lanterns. Calamity: a fire
 * in the city, and the fire tender that puts it out. Unrest: the rising. Weather: storms,
 * pea-soupers. Omen: the great moon.
 *
 * The view drifts: everything here is placed in it (w.vx(f, frac): a fraction of the way across
 * the view at depth f), and what holds a place (a battle line, a siege) keeps up with it.
 */
import type { Rng } from '../../../rng';
import type { CastRule, SystemDef } from '../../../kit';
import type { Ctx, HazeWorld, ShipKind, WalkerKind } from './types';

const FLEETS = ['THE IMPERIAL HOME FLEET', 'THE NORTHERN LEAGUE', 'THE REPUBLIC\'S FIRST SQUADRON', 'THE GRAND ARMADA', 'THE IRON SQUADRON', 'THE EASTERN COALITION', 'THE BLACK FLEET'];
const FRONTS = ['FOR THE FRONT', 'FOR THE EASTERN MARCHES', 'FOR THE NORTH SEA', 'FOR THE COLONIES', 'TO WAR'];
const DISTRICTS = ['THE FOUNDRY QUARTER', 'OLD TOWN', 'THE DOCKS', 'ST. MARROW\'S', 'THE RIVETS', 'LAMPLIGHTER LANE', 'THE STACKS', 'THE ASHES', 'COGGESHALL', 'THE TANNERIES'];
const ENEMY: [string, string, string][] = [['#3a3836', '#161514', '#5a1a14'], ['#33363a', '#141618', '#3a1a10']];

export function titled(s: string) {
  return s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}
function pickOf<T>(r: Rng, a: readonly T[]): T {
  return a[Math.floor(r() * a.length)];
}
const night = (d: number) => d < 0.19 || d > 0.84;
/** Where x (at depth f) is across the view: 0 its left edge, 1 its right. */
const across = (w: HazeWorld, x: number, f: number) => (x - w.scroll * f) / w.GW;

export const LIBRARY: SystemDef<Ctx, any>[] = [
  // ---- war ----------------------------------------------------------------------------------------
  {
    id: 'battle',
    label: 'battles in the sky',
    weight: 5,
    tags: ['war'],
    create: (c) => {
      let on: { until: number; names: [string, string]; hold: Map<number, number>; pending: { at: number; id: number }[] } | null = null;
      return {
        id: 'battle',
        step(dt) {
          const w = c.world;
          const u = w.u;
          if (!on) {
            if (w.t < 110 || w.storm > 0.5 || !w.director.want('battle', 0.95, 420)) return;
            const a = pickOf(c.r, FLEETS);
            let b = pickOf(c.r, FLEETS);
            while (b === a) b = pickOf(c.r, FLEETS);
            on = { until: w.t + 100, names: [a, b], hold: new Map(), pending: [] };
            for (const team of [0, 1] as const) {
              const dir: 1 | -1 = team === 0 ? 1 : -1;
              const kinds: ShipKind[] = ['dreadnought', pickOf(c.r, ['gunship', 'twin', 'galleon'] as ShipKind[]), pickOf(c.r, ['dreadnought', 'twin', 'gunship'] as ShipKind[])];
              kinds.forEach((kind, k) => {
                const f = 0.5 + k * 0.14 + c.r() * 0.04;
                const s = c.spawn(kind, f, { dir, team, state: 'battle', fleet: true, ...(team ? { colors: pickOf(c.r, ENEMY), flag: '#111111' } : {}) });
                s.x = team === 0 ? w.vx(f, 0) - s.len * (1 + k * 0.6) : w.vx(f, 1) + s.len * (1 + k * 0.6);
                s.y = w.GH * (0.14 + k * 0.08 + c.r() * 0.05);
                on!.hold.set(s.id, team === 0 ? 0.2 + k * 0.08 + c.r() * 0.05 : 0.8 - k * 0.08 - c.r() * 0.05);
              });
              for (let k = 0; k < 4; k++) {
                const f = 0.55 + c.r() * 0.35;
                w.fighters.push({ id: Math.floor(c.r() * 1e9), f, x: team ? w.vx(f, 1) + 60 + k * 40 : w.vx(f, 0) - 60 - k * 40, y: w.GH * (0.12 + c.r() * 0.25), vx: dir * 90 * u * w.m(f), vy: 0, team, phase: c.r() * 6, alive: true, gun: -9, t0: w.t });
              }
            }
            c.say(`BATTLE OVER ${w.name}: ${a} ENGAGES ${b}`, w.vx(1, 0.5), w.GH * 0.12, 1, '#fca5a5');
            c.emit('battle', w.vx(1, 0.5), w.GH * 0.25, 1);
            c.chronicle(`${titled(a)} and ${titled(b)} fought over the city.`);
            c.look('battle', w.vx(0.7, 0.5), w.GH * 0.3, 0.7, 1.3, 24, 8);
            return;
          }
          const fleet = w.ships.filter((s) => s.alive && s.state === 'battle');
          for (const s of fleet) {
            const hx = w.vx(s.f, on.hold.get(s.id) ?? 0.5);
            const v = Math.max(s.speed * 1.5, w.drift * s.f * 1.4) * dt;
            s.x += Math.max(-v, Math.min(v, hx - s.x));
            s.dir = s.team === 0 ? 1 : -1;
            const foes = fleet.filter((e) => e.team !== s.team);
            if (foes.length && Math.abs(hx - s.x) < s.len && c.r() < dt * 0.7) {
              const e = foes[Math.floor(c.r() * foes.length)];
              const mx = s.x + s.dir * s.len * 0.3;
              // A broadside: flashes down the length of her, and a bank of smoke.
              for (let q = 0; q < 3; q++) {
                w.fx.push({ kind: 'muzzle', f: s.f, x: mx - s.dir * q * s.len * 0.18, y: s.y - s.len * 0.03, vx: 0, vy: 0, t0: w.t + q * 0.12, dur: 0.35, r: s.len * 0.06, color: '#fde68a', seed: 0 });
                w.fx.push({ kind: 'smoke', f: s.f, x: mx - s.dir * q * s.len * 0.18, y: s.y - s.len * 0.03, vx: s.dir * 14, vy: -4, t0: w.t + q * 0.12, dur: 7, r: s.len * 0.045, color: '#9a928a', seed: 0 });
              }
              const hit = c.r() < 0.5;
              const tx = e.x + (c.r() - 0.5) * e.len * (hit ? 0.5 : 1.6);
              const ty = e.y + (c.r() - 0.5) * e.len * (hit ? 0.1 : 0.5);
              const sp = 1000 * u;
              c.shoot(mx, s.y, tx, ty, (s.f + e.f) / 2, sp, '#ffd27a', hit ? 0 : 1, 1.2);
              if (hit) on.pending.push({ at: w.t + Math.hypot(tx - mx, ty - s.y) / sp, id: e.id });
              c.emit('broadside', mx, s.y, 0.35);
              s.gun = w.t;
            }
          }
          for (const p of on.pending.filter((q) => q.at <= w.t)) {
            const e = w.ships.find((s) => s.id === p.id && s.alive);
            if (!e) continue;
            c.blast(e.x + (c.r() - 0.5) * e.len * 0.4, e.y, e.f, 1.6);
            e.hp--;
            if (e.hp <= 0 && e.state === 'battle') {
              e.state = 'burning';
              e.t0 = w.t;
              c.say(`THE ${e.name} IS HIT, AND BURNING`, e.x, e.y - e.len * 0.3, e.f, '#fdba74');
              c.look('burning', e.x, e.y, e.f, 1.6, 12, 7);
            }
          }
          on.pending = on.pending.filter((q) => q.at > w.t);
          for (const [li, gx, gy] of w.guns) {
            const f = w.layers[li].f;
            const foes = fleet.filter((s) => s.team === 1);
            if (!foes.length || !w.inView(gx, f, 0) || c.r() > dt * 0.6) continue;
            const e = foes[Math.floor(c.r() * foes.length)];
            c.shoot(gx, gy, e.x + (c.r() - 0.5) * e.len, e.y + (c.r() - 0.5) * e.len * 0.4, (f + e.f) / 2, 800 * u, '#ffd27a', 1, 1);
          }
          for (const fi of w.fighters) {
            if (!fi.alive) continue;
            const foes = w.fighters.filter((q) => q.alive && q.team !== fi.team);
            const sp = 95 * u * w.m(fi.f);
            let want = Math.atan2(fi.vy, fi.vx);
            const tgt = foes.sort((a, b) => Math.hypot(a.x - fi.x, a.y - fi.y) - Math.hypot(b.x - fi.x, b.y - fi.y))[0];
            if (tgt) want = Math.atan2(tgt.y - fi.y, tgt.x - fi.x);
            else if (w.t < on.until) want = Math.atan2(w.GH * 0.25 - fi.y, w.vx(fi.f, 0.5) - fi.x);
            const cur = Math.atan2(fi.vy, fi.vx);
            let d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            const a = cur + Math.max(-1.8 * dt, Math.min(1.8 * dt, d)) + Math.sin(fi.phase * 1.3) * 0.4 * dt;
            fi.vx = Math.cos(a) * sp;
            fi.vy = Math.sin(a) * sp;
            if (fi.y > w.GH * 0.55) fi.vy -= 40 * dt;
            if (tgt && Math.abs(d) < 0.3 && Math.hypot(tgt.x - fi.x, tgt.y - fi.y) < 260 * u && c.r() < dt * 3 && w.t - fi.gun > 0.4) {
              fi.gun = w.t;
              c.shoot(fi.x, fi.y, tgt.x + (c.r() - 0.5) * 20 * u, tgt.y + (c.r() - 0.5) * 20 * u, fi.f, 1400 * u, '#ffe9a8');
              c.emit('guns', fi.x, fi.y, 0.1);
              if (c.r() < 0.14) {
                tgt.alive = false;
                c.blast(tgt.x, tgt.y, tgt.f, 0.8);
                for (let k = 0; k < 6; k++) w.fx.push({ kind: 'smoke', f: tgt.f, x: tgt.x, y: tgt.y + k * 8 * u, vx: tgt.vx * 0.2, vy: 30 * u, t0: w.t + k * 0.15, dur: 5, r: 4 * u, color: '#1c1917', seed: 0 });
              }
            }
          }
          const alive = [0, 1].map((t) => fleet.filter((s) => s.team === t).length);
          if (w.t > on.until || alive[0] === 0 || alive[1] === 0) {
            const win = alive[0] >= alive[1] ? 0 : 1;
            for (const s of fleet) {
              s.state = 'cruise';
              s.fleet = false;
              s.t0 = w.t;
              s.dir = s.team === win ? s.dir : ((s.dir * -1) as 1 | -1);
            }
            for (const fi of w.fighters) fi.vy -= 30 * u;
            c.say(`${on.names[win]} HOLDS THE SKY OVER ${w.name}`, w.vx(1, 0.5), w.GH * 0.12, 1, '#fde2b8');
            c.chronicle(`${titled(on.names[win])} held the sky; the other fleet turned for home.`);
            on = null;
          }
        },
      };
    },
  },
  {
    id: 'blitz',
    label: 'air raids by night',
    weight: 5,
    tags: ['war'],
    create: (c) => {
      let raid: { ids: number[]; t0: number; caught: number; said: boolean } | null = null;
      return {
        id: 'blitz',
        step(dt) {
          const w = c.world;
          const u = w.u;
          if (!raid) {
            if (!night(w.day) || w.t < 90 || !w.director.want('blitz', 0.9, 480)) return;
            const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
            const ids: number[] = [];
            const n = 3 + Math.floor(c.r() * 2);
            for (let k = 0; k < n; k++) {
              const f = 0.45 + c.r() * 0.25;
              const s = c.spawn('zeppelin', f, { dir, team: 1, fleet: true, colors: pickOf(c.r, ENEMY), search: 0 });
              s.speed *= 0.7;
              s.x = c.entry(f, dir, s.speed, s.len * (1 + k * 0.8));
              s.y = w.GH * (0.12 + c.r() * 0.16);
              ids.push(s.id);
            }
            raid = { ids, t0: w.t, caught: -1, said: false };
            c.say(`AIR RAID! ZEPPELINS OVER ${w.name}; THE SIRENS WAIL`, w.vx(1, 0.5), w.GH * 0.12, 1, '#fca5a5');
            c.emit('siren', w.vx(1, 0.5), w.GH * 0.5, 1);
            c.chronicle('Enemy zeppelins came over by night, and the city went dark under the searchlights.');
            c.look('blitz', w.vx(0.6, 0.5), w.GH * 0.25, 0.6, 1.3, 20, 7);
            return;
          }
          const bombers = w.ships.filter((s) => raid!.ids.includes(s.id) && s.alive);
          const over = bombers.filter((s) => w.inView(s.x, s.f, 0));
          if (w.t - raid.t0 > 6 && raid.caught < 0 && over.length) raid.caught = over[0].id;
          const held = w.ships.find((s) => s.id === raid!.caught && s.alive);
          w.search = held ? { x: held.x, y: held.y, f: held.f } : null;
          if (held && !raid.said) {
            raid.said = true;
            c.say(`THE SEARCHLIGHTS HAVE THE ${held.name}`, held.x, held.y - held.len * 0.4, held.f, '#e0f2fe');
          }
          for (const [li, gx, gy] of w.guns) {
            const f = w.layers[li].f;
            if (!over.length || !w.inView(gx, f, 0) || c.r() > dt * 1.4) continue;
            const e = held && c.r() < 0.6 ? held : over[Math.floor(c.r() * over.length)];
            c.shoot(gx, gy, e.x + (c.r() - 0.5) * e.len * 1.2, e.y + (c.r() - 0.5) * e.len * 0.5, (f + e.f) / 2, 700 * u, '#ffd27a', 1, 1.2);
            w.fx.push({ kind: 'muzzle', f, x: gx, y: gy - 4 * u, vx: 0, vy: 0, t0: w.t, dur: 0.2, r: 8 * u * w.m(f), color: '#fde68a', seed: 0 });
          }
          for (const s of over) {
            if (s.state !== 'cruise' || c.r() > dt * 0.5) continue;
            w.fx.push({ kind: 'bomb', f: s.f, x: s.x, y: s.y + s.len * 0.12, vx: s.dir * s.speed * 0.4, vy: 10 * u, t0: w.t, dur: 20, r: 2 * u, color: '#111111', seed: 1 });
          }
          if (held && held.state === 'cruise' && w.t - raid.t0 > 14 && c.r() < dt * 0.08) {
            held.state = 'burning';
            held.t0 = w.t;
            c.say(`THE ${held.name} IS HIT BY FLAK, AND BURNS`, held.x, held.y - held.len * 0.3, held.f, '#fdba74');
            c.emit('fire', held.x, held.y, 0.9);
            c.look('burning', held.x, held.y, held.f, 1.6, 12, 8);
            raid.caught = -1;
            raid.said = false;
          }
          if (!bombers.length || (w.t - raid.t0 > 30 && !over.length)) {
            w.search = null;
            c.say('THE ALL-CLEAR SOUNDS', w.vx(1, 0.5), w.GH * 0.14, 1, '#e7e5e4');
            raid = null;
          }
        },
      };
    },
  },
  {
    id: 'siege',
    label: 'sieges',
    weight: 4,
    tags: ['war'],
    params: (g) => ({ kind: g.weighted<'biped' | 'quad' | 'crawler' | 'hexapod'>({ biped: 4, quad: 3, crawler: 2, hexapod: 1 }) }),
    create: (c, p: { kind: WalkerKind }) => {
      let on: { ids: number[]; hold: Map<number, number>; until: number; pending: { at: number; id: number }[] } | null = null;
      return {
        id: 'siege',
        step(dt) {
          const w = c.world;
          const u = w.u;
          if (!on) {
            if (w.t < 150 || w.walkers.some((x) => x.team === 1) || !w.director.want('siege', 0.9, 520)) return;
            const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
            const n = 2 + Math.floor(c.r() * 2);
            on = { ids: [], hold: new Map(), until: w.t + 130, pending: [] };
            for (let k = 0; k < n; k++) {
              const wk = c.walker(p.kind, 0.6 + c.r() * 0.1, { dir, team: 1 });
              wk.x = dir > 0 ? w.vx(wk.f, 0) - wk.h * (0.6 + k * 1.4) : w.vx(wk.f, 1) + wk.h * (0.6 + k * 1.4);
              on.ids.push(wk.id);
              on.hold.set(wk.id, dir > 0 ? 0.22 + k * 0.14 : 0.78 - k * 0.14);
            }
            c.say(`THE ENEMY'S WALKERS ARE AT THE GATES OF ${w.name}`, w.vx(0.65, 0.5), w.GH * 0.4, 0.65, '#fca5a5');
            c.emit('siege', w.vx(0.65, 0.5), w.GH * 0.6, 1);
            c.chronicle('The enemy\'s walkers came up to the city and shelled it, and the roof guns answered.');
            c.look('siege', w.vx(0.65, dir > 0 ? 0.3 : 0.7), w.GH * 0.55, 0.65, 1.5, 20, 7);
            return;
          }
          const mine = w.walkers.filter((x) => on!.ids.includes(x.id) && (x.state === 'walk' || x.state === 'fire'));
          for (const wk of mine) {
            const hx = w.vx(wk.f, on.hold.get(wk.id) ?? 0.5);
            // Walking in to its place: hurried along if the drift would leave it behind.
            if (wk.state === 'walk' && w.t < on.until && Math.abs(wk.x - hx) > wk.speed * 2) wk.x += Math.sign(hx - wk.x) * Math.max(0, w.drift * wk.f * 1.3 - wk.speed) * dt;
            if (wk.state === 'walk' && w.t < on.until && Math.abs(wk.x - hx) < wk.speed * 2) {
              wk.state = 'fire';
              wk.t0 = w.t;
            }
            // Holding its ground in a drifting view: it walks on, slowly, to keep its place.
            if (wk.state === 'fire') {
              const dx = hx - wk.x;
              if (Math.abs(dx) > wk.h * 0.3) {
                wk.x += Math.sign(dx) * Math.max(wk.speed * 0.6, w.drift * wk.f * 1.3) * dt;
                wk.phase += dt * 0.8;
              }
            }
            if (wk.state === 'fire' && c.r() < dt * 0.45) {
              const L = w.layers[1 + Math.floor(c.r() * 2)];
              const near = L.buildings.filter((b) => Math.abs(across(w, b.x, L.f) - across(w, wk.x, wk.f)) < 0.35 && w.inView(b.x, L.f, 0));
              const b = near[Math.floor(c.r() * near.length)];
              if (b) {
                const gy = w.groundAt(wk.f);
                const gx = wk.x + wk.dir * wk.h * 0.6;
                const ty = b.base - b.h * (0.3 + c.r() * 0.6);
                const tx = b.x + b.w * c.r();
                // The shell is drawn at the shooter's depth, aimed where the target shows.
                const sx = w.vx(wk.f, across(w, tx, L.f));
                c.shoot(gx, gy - wk.h * 0.62, sx, ty, wk.f, 1100 * u, '#ffe0a0', 0, 2);
                w.fx.push({ kind: 'muzzle', f: wk.f, x: gx, y: gy - wk.h * 0.62, vx: 0, vy: 0, t0: w.t, dur: 0.3, r: wk.h * 0.1, color: '#fde68a', seed: 0 });
                w.fx.push({ kind: 'smoke', f: wk.f, x: gx, y: gy - wk.h * 0.62, vx: wk.dir * 20, vy: -4, t0: w.t, dur: 6, r: wk.h * 0.06, color: '#8a8278', seed: 0 });
                wk.gun = w.t;
                c.emit('cannon', gx, gy, 0.5);
                const delay = Math.hypot(sx - gx, ty - gy) / (1100 * u);
                c.after(delay, () => {
                  c.blast(tx, ty, L.f, 2);
                  if (c.r() < 0.3) c.ignite(L.i, b.x + b.w / 2, ty, b.w * 0.5, 40 + c.r() * 30);
                });
              }
            }
          }
          for (const [li, gx, gy] of w.guns) {
            const f = w.layers[li].f;
            if (!mine.length || !w.inView(gx, f, 0) || c.r() > dt * 0.7) continue;
            const wk = mine[Math.floor(c.r() * mine.length)];
            const ty = w.groundAt(wk.f) - wk.h * (0.5 + c.r() * 0.4);
            const sp = 900 * u;
            const tx = w.vx(f, across(w, wk.x, wk.f)) + (c.r() - 0.5) * wk.h * 0.5;
            c.shoot(gx, gy, tx, ty, f, sp, '#ffd27a', 0, 1.2);
            w.fx.push({ kind: 'muzzle', f, x: gx, y: gy - 4 * u, vx: 0, vy: 0, t0: w.t, dur: 0.2, r: 8 * u * w.m(f), color: '#fde68a', seed: 0 });
            const hit = c.r() < 0.4;
            const at = w.t + Math.hypot(tx - gx, ty - gy) / sp;
            if (hit) on.pending.push({ at, id: wk.id });
            c.after(at - w.t, () => c.blast(wk.x + (c.r() - 0.5) * wk.h * 0.4, ty, wk.f, hit ? 1.6 : 1));
          }
          for (const q of on.pending.filter((x) => x.at <= w.t)) {
            const wk = w.walkers.find((x) => x.id === q.id && (x.state === 'walk' || x.state === 'fire'));
            if (!wk) continue;
            wk.hp--;
            if (wk.hp <= 0) {
              wk.state = 'fall';
              wk.t0 = w.t;
              c.say('A WALKER IS HIT, AND FALLS IN THE STREET', wk.x, w.groundAt(wk.f) - wk.h * 1.2, wk.f, '#fdba74');
              c.emit('fall', wk.x, w.groundAt(wk.f), 1);
              c.look('fall', wk.x, w.groundAt(wk.f) - wk.h * 0.5, wk.f, 1.7, 10, 8);
            }
          }
          on.pending = on.pending.filter((x) => x.at > w.t);
          if (w.t > on.until || !mine.length) {
            for (const wk of mine) {
              wk.state = 'walk';
              wk.dir = (wk.dir * -1) as 1 | -1;
            }
            c.say(mine.length ? 'THE ENEMY\'S WALKERS TURN BACK' : 'THE SIEGE IS BROKEN', w.vx(0.65, 0.5), w.GH * 0.4, 0.65, '#fde2b8');
            on = null;
          }
        },
      };
    },
  },
  {
    id: 'armada',
    label: 'the armada',
    weight: 3,
    tags: ['war'],
    create: (c) => ({
      id: 'armada',
      step() {
        const w = c.world;
        if (w.t < 70 || w.ships.some((s) => s.alive && s.fleet) || !w.director.want('armada', 0.85, 330)) return;
        const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
        const n = 3 + Math.floor(c.r() * 3);
        const fleet = pickOf(c.r, FLEETS);
        for (let k = 0; k < n; k++) {
          const f = Math.min(0.92, 0.42 + k * 0.11 + c.r() * 0.04);
          const s = c.spawn(k === 0 && c.r() < 0.4 ? 'twin' : 'dreadnought', f, { dir, fleet: true });
          s.x = c.entry(f, dir, s.speed * 0.9, s.len + k * 160 * w.u * w.m(f));
          s.y = w.GH * (0.14 + c.r() * 0.18) + (1 - f) * w.GH * 0.12;
          s.speed *= 0.9;
        }
        for (let k = 0; k < 4; k++) {
          const f = 0.5 + c.r() * 0.4;
          const s = c.spawn('scout', f, { dir, fleet: true });
          s.x = c.entry(f, dir, s.speed, s.len + c.r() * 400 * w.u);
          s.y = w.GH * (0.1 + c.r() * 0.3);
        }
        c.say(`${fleet} SAILS ${pickOf(c.r, FRONTS)}: ${n} DREADNOUGHTS OVER ${w.name}`, w.vx(1, 0.5), w.GH * 0.14, 1, '#fde2b8');
        c.emit('armada', w.vx(1, 0.5), w.GH * 0.2, 0.9);
        c.chronicle(`${titled(fleet)} sailed over the city, ${n} dreadnoughts in line.`);
        c.look('armada', w.vx(0.75, dir > 0 ? 0.25 : 0.75), w.GH * 0.3, 0.75, 1.4, 18, 7);
      },
    }),
  },
  {
    id: 'raiders',
    label: 'raiders',
    weight: 3,
    tags: ['war'],
    create: (c) => {
      let raid = -1;
      return {
        id: 'raiders',
        step(dt) {
          const w = c.world;
          const raider = w.ships.find((s) => s.id === raid && s.alive);
          if (raider) {
            const prey = w.ships.find((s) => s.id === raider.target && s.alive);
            if (!prey || prey.state === 'falling') {
              raider.state = 'cruise';
              raider.dir = across(w, raider.x, raider.f) < 0.5 ? -1 : 1;
              raid = -1;
              return;
            }
            const tx = prey.x - prey.dir * prey.len * 0.9;
            const ty = prey.y - prey.len * 0.25;
            raider.x += Math.sign(tx - raider.x) * Math.min(Math.abs(tx - raider.x), raider.speed * 1.6 * dt);
            raider.y += (ty - raider.y) * Math.min(1, dt * 0.5);
            raider.dir = prey.x > raider.x ? 1 : -1;
            if (Math.abs(tx - raider.x) < prey.len && c.r() < dt * 1.4) {
              w.fx.push({ kind: 'muzzle', f: raider.f, x: raider.x + raider.dir * raider.len * 0.4, y: raider.y, vx: 0, vy: 0, t0: w.t, dur: 0.25, r: 10 * w.u * raider.f, color: '#fde68a', seed: 0 });
              c.shoot(raider.x + raider.dir * raider.len * 0.4, raider.y, prey.x + (c.r() - 0.5) * prey.len * 0.5, prey.y, raider.f, 1200 * w.u, '#ffe9a8');
              c.emit('gun', raider.x, raider.y, 0.3);
              if (prey.state !== 'burning' && c.r() < 0.18) {
                prey.state = 'burning';
                prey.t0 = w.t;
                c.say(`THE ${prey.name} IS BURNING`, prey.x, prey.y - prey.len * 0.3, prey.f, '#fdba74');
                c.emit('fire', prey.x, prey.y, 0.8);
                c.look('burning', prey.x, prey.y + 60 * w.u, prey.f, 1.7, 16, 7);
              }
            }
            return;
          }
          if (w.t < 110 || !w.director.want('raiders', 0.75, 360)) return;
          const prey = w.ships.filter((s) => s.alive && s.state === 'cruise' && (s.kind === 'zeppelin' || s.kind === 'liner' || s.kind === 'hauler') && s.f > 0.6 && across(w, s.x, s.f) > 0.2 && across(w, s.x, s.f) < 0.8)[0];
          if (!prey) return;
          const from: 1 | -1 = prey.dir > 0 ? -1 : 1;
          const s = c.spawn('gunship', prey.f, { dir: (from * -1) as 1 | -1, state: 'attack', target: prey.id, colors: pickOf(c.r, ENEMY), flag: '#111111', name: 'RAIDER', team: 1 });
          s.x = from > 0 ? w.vx(prey.f, 1) + s.len : w.vx(prey.f, 0) - s.len;
          s.y = prey.y - prey.len * 0.4;
          raid = s.id;
          c.say(`RAIDERS! A GUNSHIP COMES OUT OF THE SMOKE AT THE ${prey.name}`, prey.x, prey.y - prey.len * 0.5, prey.f, '#fca5a5');
          c.emit('raid', prey.x, prey.y, 0.7);
          c.chronicle(`Raiders came out of the smoke at the ${titled(prey.name)}.`);
        },
      };
    },
  },
  // ---- wonders ------------------------------------------------------------------------------------
  {
    id: 'walkers',
    label: 'the iron walkers',
    weight: 5,
    tags: ['wonder'],
    params: (g) => ({ kinds: [g.weighted<Exclude<WalkerKind, 'colossus'>>({ biped: 4, quad: 3, tripod: 2, strider: 2, hexapod: 2, crawler: 1 }), g.weighted<Exclude<WalkerKind, 'colossus'>>({ biped: 3, quad: 2, tripod: 2, strider: 2, hexapod: 2, crawler: 2 })] }),
    create: (c, p: { kinds: WalkerKind[] }) => ({
      id: 'walkers',
      step() {
        const w = c.world;
        if (w.walkers.some((x) => x.team === 0 && !x.ambient && x.state === 'walk') || w.t < 40 || !w.director.want('walkers', 0.8, 380)) return;
        const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
        const kind = pickOf(c.r, p.kinds);
        const n = 2 + Math.floor(c.r() * 2);
        for (let k = 0; k < n; k++) {
          const wk = c.walker(k === n - 1 && c.r() < 0.5 ? pickOf(c.r, p.kinds) : kind, 0.58 + c.r() * 0.13, { dir });
          wk.x = c.entry(wk.f, dir, wk.speed, wk.h * (0.6 + k * 1.3));
        }
        const name = kind === 'tripod' ? 'TRIPODS' : kind === 'quad' ? 'LAND-CRAWLERS' : kind === 'strider' ? 'STRIDERS' : kind === 'hexapod' ? 'IRON BEETLES' : kind === 'crawler' ? 'LAND-SHIPS' : 'IRON WALKERS';
        c.say(`THE ${name} MARCH THROUGH THE LOWER CITY IN THE FOG`, w.vx(0.65, 0.5), w.GH * 0.42, 0.65, '#e7d3b0');
        c.emit('walkers', w.vx(0.65, 0.5), w.GH * 0.6, 0.8);
        c.chronicle(`The ${name.toLowerCase()} marched through the lower city, ${n} of them, and the streets shook.`);
        c.look('walkers', w.vx(0.65, dir > 0 ? 0.3 : 0.7), w.GH * 0.55, 0.65, 1.5, 20, 6);
      },
    }),
  },
  {
    id: 'colossus',
    label: 'the walking fortress',
    weight: 3,
    tags: ['wonder'],
    create: (c) => ({
      id: 'colossus',
      step(dt) {
        const w = c.world;
        const cz = w.walkers.find((x) => x.kind === 'colossus' && x.state === 'walk');
        if (cz) {
          if (w.inView(cz.x, cz.f, 0) && c.r() < dt * 0.15) {
            for (let k = 0; k < 4; k++) w.fx.push({ kind: 'muzzle', f: cz.f, x: cz.x + (k - 1.5) * cz.h * 0.16, y: w.groundAt(cz.f) - cz.h * 0.78, vx: 0, vy: 0, t0: w.t + k * 0.15, dur: 0.3, r: cz.h * 0.05, color: '#fde68a', seed: 0 });
            c.emit('cannon', cz.x, w.groundAt(cz.f) - cz.h * 0.8, 0.5);
          }
          return;
        }
        if (w.t < 200 || !w.director.want('colossus', 0.95, 900)) return;
        // It comes from ahead, walking against the drift, so it is long in passing.
        const wk = c.walker('colossus', 0.44 + c.r() * 0.06, { dir: -1 });
        c.say('THE WALKING FORTRESS COMES: A CITADEL ON LEGS, ITS BATTERIES SMOKING', w.vx(wk.f, 0.5), w.GH * 0.25, wk.f, '#fde2b8');
        c.emit('colossus', w.vx(wk.f, 0.5), w.GH * 0.5, 1);
        c.chronicle('The walking fortress came by the city, slow as a season, and every window shook.');
        c.look('colossus', w.vx(wk.f, 0.7), w.groundAt(wk.f) - wk.h * 0.5, wk.f, 1.2, 24, 7);
      },
    }),
  },
  {
    id: 'citadel',
    label: 'a floating citadel',
    weight: 3,
    tags: ['wonder'],
    create: (c) => ({
      id: 'citadel',
      step() {
        const w = c.world;
        if (w.t < 150 || w.islands.some((i) => i.moving) || !w.director.want('citadel', 0.8, 700)) return;
        const f = 0.3 + c.r() * 0.12;
        const iw = (380 + c.r() * 160) * w.u * w.m(f);
        w.islands.push({ id: 900 + Math.floor(c.r() * 99), f, x: w.vx(f, 1) + iw, y: w.GH * (0.16 + c.r() * 0.08), w: iw, seed: Math.floor(c.r() * 1e6), vx: -8 * w.u * w.m(f), hold: 90, moving: true });
        c.say('A FLOATING CITADEL DRIFTS IN ON ITS CHAINS', w.vx(1, 0.5), w.GH * 0.12, f, '#e0e7ff');
        c.emit('citadel', w.vx(1, 0.5), w.GH * 0.2, 0.8);
        c.chronicle('A floating citadel drifted over the city, trailing its chains, and hung there a while.');
      },
    }),
  },
  {
    id: 'carrier',
    label: 'the sky-carrier',
    weight: 3,
    tags: ['wonder'],
    create: (c) => ({
      id: 'carrier',
      step(dt) {
        const w = c.world;
        const cr = w.ships.find((s) => s.alive && s.kind === 'carrier');
        if (cr) {
          if (w.inView(cr.x, cr.f, 0) && c.r() < dt * 0.12) {
            const s = c.spawn('scout', Math.min(1, cr.f + 0.05), { dir: cr.dir });
            s.x = cr.x;
            s.y = cr.y - cr.len * 0.08;
            s.speed *= 1.3;
            c.emit('launch', cr.x, cr.y, 0.2);
          }
          return;
        }
        if (w.t < 200 || !w.director.want('carrier', 0.85, 800)) return;
        const f = 0.48 + c.r() * 0.1;
        const s = c.spawn('carrier', f);
        s.y = w.GH * (0.16 + c.r() * 0.08);
        c.say(`THE ${s.name}, THE SKY-CARRIER, PASSES OVER ${w.name}`, w.vx(1, 0.5), w.GH * 0.1, f, '#fde2b8');
        c.emit('carrier', w.vx(1, 0.5), w.GH * 0.2, 1);
        c.chronicle(`The ${titled(s.name)}, the sky-carrier, passed over, and the whole city went dark under it.`);
        c.look('carrier', w.vx(f, 0.5), s.y, f, 1.3, 20, 7);
      },
    }),
  },
  {
    id: 'launch',
    label: 'launches at the skydock',
    weight: 3,
    tags: ['wonder'],
    create: (c) => {
      let at = -1;
      let id = -1;
      return {
        id: 'launch',
        step(dt) {
          const w = c.world;
          if (id >= 0) {
            const s = w.ships.find((x) => x.id === id && x.alive);
            if (!s) {
              id = -1;
              return;
            }
            if (w.t - at < 30 && c.r() < dt * 3) {
              const x = s.x + (c.r() - 0.5) * s.len;
              const y = s.y - s.len * (0.3 + c.r() * 0.3);
              const col = pickOf(c.r, ['#fca5a5', '#fde68a', '#93c5fd', '#ffffff']);
              for (let k = 0; k < 18; k++) {
                const a = (k / 18) * Math.PI * 2;
                w.fx.push({ kind: 'firework', f: s.f, x, y, vx: Math.cos(a) * 50 * w.u, vy: Math.sin(a) * 50 * w.u, t0: w.t, dur: 1.6, r: 1.5, color: col, seed: k });
              }
            }
            if (w.t - at > 32 && s.state === 'moored') s.t0 = -999;
            if (s.state !== 'moored') id = -1;
            return;
          }
          if (w.t < 160) return;
          // A skydock berth, free, and far enough into the view to stay a while.
          const mm = w.masts.find((m) => m.side !== 0 && m.platform < 0 && m.ship < 0 && across(w, m.x, m.f) > 0.35 && across(w, m.x, m.f) < 0.9);
          if (!mm || !w.director.want('launch', 0.85, 700)) return;
          const s = c.spawn('liner', mm.f, { name: `NEW ${pickOf(c.r, ['EMPRESS', 'QUEEN', 'MAJESTIC', 'TITANIA', 'IMPERIUM'])}` });
          s.dir = mm.side < 0 ? 1 : -1;
          s.x = mm.x - s.dir * (s.len * 0.5 + 4 * w.u * w.m(s.f));
          s.y = mm.y + s.len * 0.09;
          s.state = 'moored';
          s.mast = mm.id;
          s.t0 = w.t;
          mm.ship = s.id;
          at = w.t;
          id = s.id;
          c.say(`AT THE SKYDOCK, THE ${s.name} IS LAUNCHED, AND THE WHOLE CITY CHEERS`, mm.x, mm.y - s.len * 0.4, mm.f, '#fde68a');
          c.emit('launch', mm.x, mm.y, 0.9);
          c.chronicle(`The ${titled(s.name)} was launched from the skydock.`);
          c.look('launch', mm.x, mm.y, mm.f, 1.6, 16, 7);
        },
      };
    },
  },
  // ---- spectacle, calamity, unrest --------------------------------------------------------------------
  {
    id: 'parade',
    label: 'parades',
    weight: 4,
    tags: ['spectacle'],
    create: (c) => {
      let until = -1;
      return {
        id: 'parade',
        step(dt) {
          const w = c.world;
          w.bunting += ((w.t < until ? 1 : 0) - w.bunting) * Math.min(1, dt * 0.3);
          if (w.t < until) {
            if (c.r() < dt * 6) {
              const vp = [...w.paths.values()].filter((p) => (p.kind === 'via' || p.kind === 'bridge') && w.inView((p.x0 + p.x1) / 2, p.f, 0));
              const p = vp[Math.floor(c.r() * vp.length)];
              if (p) {
                const x = Math.max(p.x0, Math.min(p.x1, w.vx(p.f, c.r())));
                w.fx.push({ kind: 'confetti', f: p.f, x, y: p.y - 30 * w.u * w.m(p.f), vx: (c.r() - 0.5) * 20, vy: -10, t0: w.t, dur: 5, r: 1.4, color: pickOf(c.r, ['#b91c1c', '#e7e5e4', '#1e3a8a', '#d4a03a']), seed: Math.floor(c.r() * 99) });
              }
            }
            return;
          }
          if (night(w.day) || w.t < 60 || w.storm > 0.2 || !w.director.want('parade', 0.7, 600)) return;
          until = w.t + 70;
          c.crowd(40, ['via', 'bridge', 'walk', 'deck', 'frame'], 0);
          c.crowd(18, ['via'], 2);
          const dir: 1 | -1 = c.r() < 0.5 ? 1 : -1;
          for (let k = 0; k < 3; k++) {
            const s = c.spawn('zeppelin', 0.82, { dir, fleet: true, flag: '#b91c1c' });
            s.x = c.entry(0.82, dir, s.speed, s.len * (1 + k * 1.2));
            s.y = w.GH * (0.2 + k * 0.025);
          }
          for (let k = 0; k < 2; k++) {
            const wk = c.walker('biped', 0.62, { dir });
            wk.x = c.entry(0.62, dir, wk.speed, wk.h * (1 + k * 1.4));
          }
          c.say(`THE VICTORY PARADE: BANDS ON THE VIADUCT, FLAGS ON EVERY TOWER OF ${w.name}`, w.vx(1, 0.5), w.GH * 0.14, 1, '#fde68a');
          c.emit('parade', w.vx(1, 0.5), w.GH * 0.5, 0.7);
          c.chronicle('The city held its victory parade, and the zeppelins flew over in line.');
        },
      };
    },
  },
  {
    id: 'lanterns',
    label: 'sky lanterns',
    weight: 3,
    tags: ['spectacle'],
    create: (c) => ({
      id: 'lanterns',
      step(dt) {
        const w = c.world;
        if (night(w.day) && w.lanterns < w.t && w.storm < 0.2 && w.director.want('lanterns', 0.5, 600)) {
          w.lanterns = w.t + 45;
          c.say(`THE NIGHT OF ${pickOf(c.r, ['LANTERNS', 'THE FALLEN', 'ST. ISOLDE', 'THE ARMISTICE', 'THE FIRST FLIGHT'])}: THE CITY SENDS UP ITS LIGHTS`, w.vx(1, 0.5), w.GH * 0.14, 1, '#fde68a');
          c.emit('lanterns', w.vx(1, 0.5), w.GH * 0.5, 0.5);
          c.chronicle('The city sent up its lanterns, thousands of them, into the smoke.');
        }
        if (w.lanterns > w.t && c.r() < dt * 9) {
          const f = 0.35 + c.r() * 0.65;
          w.fx.push({ kind: 'lantern', f, x: w.vx(f, c.r() * 1.2), y: w.groundAt(f) - c.r() * 60 * w.u, vx: w.wind * 0.4 + (c.r() - 0.5) * 6, vy: -(10 + c.r() * 8) * w.u * w.m(f), t0: w.t, dur: 40, r: 3 * w.u * w.m(f), color: '#ffb347', seed: Math.floor(c.r() * 99) });
        }
      },
    }),
  },
  {
    id: 'fire',
    label: 'fires and the fire tenders',
    weight: 4,
    tags: ['calamity'],
    create: (c) => {
      let job: { fire: ReturnType<Ctx['ignite']>; tender: number; spraying: boolean; district: string } | null = null;
      return {
        id: 'fire',
        step(dt) {
          const w = c.world;
          const u = w.u;
          if (job) {
            const fr = job.fire;
            const td = w.ships.find((s) => s.id === job!.tender && s.alive);
            if (td && w.t < fr.until) {
              const tx = fr.x;
              const ty = fr.y - 90 * u * w.m(td.f);
              if (!job.spraying) {
                td.state = 'spray';
                td.dir = tx > td.x ? 1 : -1;
                td.x += Math.max(-td.speed * dt, Math.min(td.speed * dt, tx - td.x));
                td.y += (ty - td.y) * Math.min(1, dt * 0.6);
                if (Math.abs(tx - td.x) < td.len * 0.3) {
                  job.spraying = true;
                  fr.until = Math.min(fr.until, w.t + 22);
                  c.say('THE FIRE TENDER COMES IN LOW, AND OPENS ITS TANKS', td.x, td.y - td.len * 0.3, td.f, '#bfdbfe');
                  c.emit('spray', td.x, td.y, 0.5);
                }
              } else {
                td.x += (tx - td.x) * Math.min(1, dt * 0.5);
                td.y += (ty - td.y) * Math.min(1, dt * 0.5);
                for (let k = 0; k < 3; k++) if (c.r() < dt * 30) w.fx.push({ kind: 'water', f: td.f, x: td.x + (c.r() - 0.5) * td.len * 0.3, y: td.y + td.len * 0.1, vx: (c.r() - 0.5) * 20, vy: 30 * u, t0: w.t, dur: 1.6, r: 1.6, color: '#dbeafe', seed: 0 });
              }
            }
            if (w.t >= fr.until || !w.inView(fr.x, fr.f, 0.3)) {
              if (td) {
                td.state = 'cruise';
                td.t0 = w.t;
              }
              if (w.inView(fr.x, fr.f, 0)) {
                c.say(`THE FIRE IN ${job.district} IS OUT`, fr.x, fr.y - 40 * u, fr.f, '#e7e5e4');
                c.chronicle(`A fire took hold in ${titled(job.district)}, until the fire tender came.`);
              }
              job = null;
            }
            return;
          }
          if (w.t < 120 || !w.director.want('fire', 0.7, 420)) return;
          const L = w.layers[2 + Math.floor(c.r() * 2)];
          const cands = L.buildings.filter((b) => b.kind !== 'spire' && b.h > w.GH * 0.08 && across(w, b.x, L.f) > 0.45 && across(w, b.x, L.f) < 0.85);
          const b = cands[Math.floor(c.r() * cands.length)];
          if (!b) return;
          const fire = c.ignite(L.i, b.x + b.w / 2, b.base - b.h * (0.5 + c.r() * 0.4), b.w * 0.7, 80);
          const district = pickOf(c.r, DISTRICTS);
          const td = c.spawn('tender', L.f, { dir: c.r() < 0.5 ? 1 : -1 });
          td.y = fire.y - 120 * u * L.m;
          job = { fire, tender: td.id, spraying: false, district };
          c.say(`FIRE IN ${district}!`, fire.x, fire.y - 50 * u * L.m, L.f, '#fdba74');
          c.emit('fire', fire.x, fire.y, 0.8);
          c.look('fire', fire.x, fire.y, L.f, 1.6, 14, 6);
        },
      };
    },
  },
  {
    id: 'rising',
    label: 'risings',
    weight: 3,
    tags: ['unrest'],
    create: (c) => {
      let until = -1;
      return {
        id: 'rising',
        step(dt) {
          const w = c.world;
          w.unrest += ((w.t < until ? 1 : 0) - w.unrest) * Math.min(1, dt * 0.2);
          if (w.t < until) {
            if (c.r() < dt * 1.5) {
              const ps = [...w.paths.values()].filter((p) => (p.kind === 'via' || p.kind === 'bridge' || p.kind === 'under' || p.kind === 'walk') && w.inView((p.x0 + p.x1) / 2, p.f, 0));
              const p = ps[Math.floor(c.r() * ps.length)];
              if (p) w.fx.push({ kind: 'muzzle', f: p.f, x: Math.max(p.x0, Math.min(p.x1, w.vx(p.f, c.r()))), y: p.y - 8 * w.u * w.m(p.f), vx: 0, vy: 0, t0: w.t, dur: 0.15, r: 4 * w.u * w.m(p.f), color: '#fde68a', seed: 0 });
            }
            if (c.r() < dt * 0.05) {
              const L = w.layers[3];
              c.ignite(3, w.vx(L.f, 0.6 + c.r() * 0.5), L.base - 12 * w.u * L.m, 30 * w.u * L.m, 50);
            }
            if (w.t > until - 1 && w.t - dt <= until - 1) {
              const end = c.r() < 0.5 ? `THE RISING IS PUT DOWN; ${w.name} IS QUIET AGAIN` : 'THE CITY BELONGS TO THE COMMUNE, FOR NOW';
              c.say(end, w.vx(1, 0.5), w.GH * 0.14, 1, '#fca5a5');
              c.chronicle(end.charAt(0) + end.slice(1).toLowerCase() + '.');
            }
            return;
          }
          if (w.t < 180 || !w.director.want('rising', 0.8, 700)) return;
          until = w.t + 80;
          c.crowd(36, ['via', 'bridge', 'walk', 'under', 'frame', 'deck'], 1);
          const L = w.layers[3];
          for (let k = 0; k < 3; k++) c.ignite(3, w.vx(L.f, 0.2 + c.r() * 0.7), L.base - 12 * w.u * L.m, 30 * w.u * L.m, 70);
          c.say(`THE WORKERS RISE: RED FLAGS ON THE BRIDGES OF ${w.name}`, w.vx(1, 0.5), w.GH * 0.14, 1, '#fca5a5');
          c.emit('rising', w.vx(1, 0.5), w.GH * 0.5, 0.9);
          c.chronicle('The workers rose; there were barricades in the streets and red flags on every bridge.');
        },
      };
    },
  },
  // ---- weather and omens ---------------------------------------------------------------------------------
  {
    id: 'storms',
    label: 'storms',
    weight: 4,
    tags: ['weather'],
    create: (c) => {
      let until = -1;
      return {
        id: 'storms',
        step(dt) {
          const w = c.world;
          if (w.t > 80 && w.storm < 0.05 && w.fog < 0.1 && w.director.want('storm', 0.5, 280)) {
            until = w.t + 60 + c.r() * 40;
            c.say('A STORM BREAKS OVER THE ROOFTOPS', w.vx(1, 0.5), w.GH * 0.14, 1, '#cbd5e1');
            c.emit('storm', w.vx(1, 0.5), w.GH * 0.2, 0.5);
          }
          w.storm += ((w.t < until ? 1 : 0) - w.storm) * Math.min(1, dt * 0.15);
          if (w.storm > 0.6 && c.r() < dt * 0.3) {
            const ck = w.clock && w.inView(w.clock.x, w.clock.f, 0) ? w.clock : null;
            const f = ck ? ck.f : 0.4;
            const tx = ck ? ck.x : w.vx(f, c.r());
            const ty = ck ? ck.top : w.GH * 0.3;
            const pts: [number, number][] = [];
            let x = tx + (c.r() - 0.5) * 300 * w.u;
            for (let y = -20; y < ty; y += 20 + c.r() * 30) {
              pts.push([x, y]);
              x += (tx - x) * 0.25 + (c.r() - 0.5) * 40 * w.u;
            }
            pts.push([tx, ty]);
            w.bolts.push({ pts, t0: w.t, f });
            c.emit('lightning', tx, ty, 0.6);
            if (c.r() < 0.3) c.say(ck ? 'LIGHTNING STRIKES THE GREAT SPIRE' : 'LIGHTNING OVER THE CITY', tx, ty - 20 * w.u, f, '#e0f2fe');
          }
        },
      };
    },
  },
  {
    id: 'fog',
    label: 'pea-soupers',
    weight: 3,
    tags: ['weather'],
    create: (c) => {
      let until = -1;
      return {
        id: 'fog',
        step(dt) {
          const w = c.world;
          if (w.t > 100 && w.fog < 0.05 && w.storm < 0.1 && w.director.want('fog', 0.4, 300)) {
            until = w.t + 70 + c.r() * 40;
            c.say('A PEA-SOUPER ROLLS IN, AND THE CITY VANISHES INTO THE FOG', w.vx(1, 0.5), w.GH * 0.3, 1, '#e7e5e4');
            c.emit('fog', w.vx(1, 0.5), w.GH * 0.4, 0.4);
            c.chronicle('A pea-souper came down, and for an hour nobody could see the end of their street.');
          }
          w.fog += ((w.t < until ? 1 : 0) - w.fog) * Math.min(1, dt * 0.08);
          if (w.fog > 0.5 && c.r() < dt * 0.08) c.emit('foghorn', w.vx(1, c.r()), w.GH * 0.7, 0.3);
        },
      };
    },
  },
  {
    id: 'moon',
    label: 'the great moon',
    weight: 2,
    tags: ['omen'],
    create: (c) => {
      let n0 = -1;
      return {
        id: 'moon',
        step(dt) {
          const w = c.world;
          const dark = w.day < 0.2 || w.day > 0.8;
          const n = Math.floor(w.t / 240 + 0.5);
          if (dark && n0 !== n && w.t > 200 && c.r() < 0.5 && w.director.want('moon', 0.7, 900)) {
            n0 = n;
            c.say('THE GREAT MOON RISES OVER THE SPIRES', w.vx(0.1, 0.5), w.GH * 0.1, 0.1, '#e0e7ff');
            c.emit('moon', w.vx(1, 0.5), w.GH * 0.3, 0.8);
            c.chronicle('The great moon rose over the spires, so big the whole city could have walked onto it.');
          }
          w.moon += ((dark && n0 === n ? 1 : 0) - w.moon) * Math.min(1, dt * 0.05);
        },
      };
    },
  },
];

export const RULE: CastRule = {
  total: [5, 7],
  quota: { war: [1, 2], weather: [0, 1], wonder: [1, 2], spectacle: [0, 2], calamity: [0, 1], unrest: [0, 1], omen: [0, 1] },
};
