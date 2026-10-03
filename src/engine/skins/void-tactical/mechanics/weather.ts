/**
 * Weather: the shared wind field and "how stormy is it here?" for one world.
 *
 * Storm fronts add a moving band to the field and an intensity function; anything that
 * cares about weather asks:
 *   - rocks and debris drift with `field.sample(x, y, t)`
 *   - miners cut their beams and run for the docks where `intensity(x, y)` is high
 *   - ships inside a front fade toward ghosts
 *
 * Positions are world units; intensity is 0 (clear) to 1 (the heart of a front).
 */
import { createField, type Field } from '../../../sim/fields';
import type { MechanicApi } from './types';

export type Weather = {
  field: Field;
  /** Register a source of storminess (a front). Returns a remover. */
  addStorm(intensity: (x: number, y: number, t: number) => number): () => void;
  /** 0..1: how deep in weather a point is right now. */
  intensity(x: number, y: number): number;
};

export function useWeather(api: MechanicApi): Weather {
  return api.use('weather', () => {
    const field = createField(api.host.noise);
    const storms = new Set<(x: number, y: number, t: number) => number>();
    return {
      field,
      addStorm(fn) {
        storms.add(fn);
        return () => void storms.delete(fn);
      },
      intensity(x, y) {
        let k = 0;
        for (const fn of storms) k = Math.max(k, fn(x, y, api.t));
        return k;
      },
    };
  });
}
