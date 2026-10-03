/**
 * Great events: rare, large things that make a long look worth it. An armada warps in
 * and crosses the sector; a star flares and washes its system in light; a gate surges
 * and throws out a burst of traffic.
 */
import { registerMechanic } from './types';
import { allStructures } from '../fleets';

registerMechanic({
  id: 'events',
  label: 'Great events',
  description: 'Every minute or two: an armada warps in, a star flares, or a gate surges.',
  schema: {
    rate: { type: 'number', min: 0.1, max: 3, default: 0.7, label: 'Events per minute' },
    armada: { type: 'boolean', default: true, label: 'Armadas' },
    flares: { type: 'boolean', default: true, label: 'Stellar flares' },
    surges: { type: 'boolean', default: true, label: 'Gate surges' },
  },
  create(api, p) {
    const rate = Number(p.rate) || 0.7;
    let next = api.t + 12 + api.rng() * 12;
    const flares: { x: number; y: number; t: number; color: string; name: string }[] = [];

    const armada = () => {
      const v = api.view();
      const fromLeft = api.rng() < 0.5;
      const y = api.height * (0.25 + api.rng() * 0.5);
      const x = fromLeft ? v.left + 80 : v.right - 80;
      const dir = fromLeft ? 0 : Math.PI;
      const f = api.spawnFleet({ x, y, vx: Math.cos(dir) * 20, vy: 0 }, { cls: 'capital', warpIn: true });
      api.say(`ARMADA · ${f.callsign} · ON STATION`, x, y, f.ships[0].color, { priority: 'high', followId: f.id, duration: 5000 });
      api.emit({ type: 'armada', x, y, weight: 1, color: f.ships[0].color, follow: api.follow(f) });
      // A second wave a moment later, behind it.
      const g = api.spawnFleet({ x: x - Math.cos(dir) * 60, y: y + 50, vx: Math.cos(dir) * 20, vy: 0 }, { cls: 'carrier', warpIn: true });
      g.maxVisits = 1;
      f.maxVisits = 1;
    };

    const flare = () => {
      const sys = api.world.systems.filter((s) => !s.z && api.onScreen(s.x, s.y, 80));
      if (!sys.length) return false;
      const s = sys[Math.floor(api.rng() * sys.length)];
      flares.push({ x: s.x, y: s.y, t: api.t, color: s.starColor, name: s.name });
      api.fx.flash(s.x, s.y, '#fff7d6', 120, 1.6);
      api.fx.ring(s.x, s.y, s.starColor, 520, 4, 10, 2);
      api.fx.ring(s.x, s.y, '#ffffff', 300, 2.5, 6, 1);
      api.say(`STELLAR FLARE · ${s.name}`, s.x, s.y + 30, s.starColor, { priority: 'high', duration: 5000 });
      api.emit({ type: 'flare', x: s.x, y: s.y, weight: 0.75, color: s.starColor });
      return true;
    };

    const surge = () => {
      const gates = allStructures(api.world).filter((s) => !s.z && s.role === 'gate' && api.onScreen(s.x, s.y, 60));
      if (!gates.length) return false;
      const g = gates[Math.floor(api.rng() * gates.length)];
      g.flashAt = api.t;
      api.fx.ring(g.x, g.y, g.color ?? '#818cf8', 160, 1.6, 8, 2);
      api.say(`${g.label} · SURGE · TRAFFIC INBOUND`, g.x, g.y + 26, g.color ?? '#818cf8', { priority: 'high' });
      api.emit({ type: 'surge', x: g.x, y: g.y, weight: 0.7, color: g.color });
      for (let i = 0; i < 3; i++) {
        const ang = api.rng() * Math.PI * 2;
        api.spawnFleet({ x: g.x + Math.cos(ang) * 24, y: g.y + Math.sin(ang) * 24, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40 }, { warpIn: true });
      }
      return true;
    };

    return {
      update() {
        if (api.t < next) return;
        next = api.t + (60 / rate) * (0.6 + api.rng() * 0.8);
        const options = [p.armada !== false && armada, p.flares !== false && flare, p.surges !== false && surge].filter(Boolean) as (() => unknown)[];
        if (!options.length) return;
        const pick = options[Math.floor(api.rng() * options.length)];
        if (pick() === false) options.find((o) => o !== pick)?.();
      },
      draw(ctx, pass, frame) {
        if (pass !== 'under') return;
        // A flaring star lights its whole neighborhood for a while.
        for (let i = flares.length - 1; i >= 0; i--) {
          const f = flares[i];
          const age = frame.time - f.t;
          if (age > 9) {
            flares.splice(i, 1);
            continue;
          }
          const k = age < 0.6 ? age / 0.6 : Math.max(0, 1 - (age - 0.6) / 8.4);
          const x = api.screenX(f.x);
          const g = ctx.createRadialGradient(x, f.y, 0, x, f.y, 420);
          g.addColorStop(0, `rgba(255,240,200,${0.22 * k})`);
          g.addColorStop(1, 'rgba(255,240,200,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - 420, f.y - 420, 840, 840);
        }
      },
    };
  },
});
