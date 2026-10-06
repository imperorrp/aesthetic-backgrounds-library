/**
 * The kingdom's cast (kit/compose): Deephold's (below, hazards, neighbours, wonders, fauna),
 * plus the sky over the range (a dragon, or nothing) and the temper of the clans' politics
 * (rivals who go to war easily, allies who trade, or a mix).
 */
import type { SystemDef } from '../../../kit';
import { DEEP_CAST, type CastCtx } from '../deep-cast';

type D = SystemDef<CastCtx, undefined>;
const stub = (id: string) => () => ({ id });
const def = (id: string, label: string, tags: string[], weight: D['weight']): D => ({ id, label, tags, weight, create: stub(id) });

export const KINGDOM_CAST: D[] = [
  ...DEEP_CAST,
  def('dragon', 'a dragon', ['sky'], (_g, c) => (c.hazards > 0 ? 1.4 : 0)),
  def('clearsky', 'clear skies', ['sky'], 1),
  def('rivals', 'rival clans', ['politics'], 1.4),
  def('allies', 'allied clans', ['politics'], 0.8),
  def('feuds', 'old feuds', ['politics'], 1),
];

export const KINGDOM_RULE = {
  total: [11, 15] as [number, number],
  quota: {
    below: [1, 1] as [number, number],
    hazard: [1, 4] as [number, number],
    neighbor: [0, 2] as [number, number],
    wonder: [1, 3] as [number, number],
    fauna: [1, 3] as [number, number],
    sky: [1, 1] as [number, number],
    politics: [1, 1] as [number, number],
  },
};
