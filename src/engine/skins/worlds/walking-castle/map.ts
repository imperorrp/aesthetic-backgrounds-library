/**
 * The walk on a travel map (to be painted): placeholder.
 */
import type { Env } from './sky';
import type { CastleWorld } from './types';

export function createMapPainter(world: CastleWorld, E: Env, o: { W: () => number; H: () => number; hud: boolean }) {
  return {
    paint(t: number) {
      void t;
      void world;
      void o;
      E.ctx.fillStyle = '#e8dcc0';
      E.ctx.fillRect(0, 0, o.W(), o.H());
    },
    project: (x: number, y: number): [number, number] => [x, y],
  };
}
