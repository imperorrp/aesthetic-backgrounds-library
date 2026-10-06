/**
 * Deephold's cast: what a mountain holds, drawn per seed (kit/compose).
 *
 *   below     exactly one: a sleeper (of many kinds), a lich in the old halls, an elder
 *             engine, a hive queen, or nothing at all but stone
 *   hazard    one to four of: floods, magma, weak rock, firedamp, a spore plague
 *   neighbor  up to two of: goblins at the gate, a goblin warren below, deep gnomes who trade
 *   wonder    up to two of: a crystal geode, a mithril lode, a sunken shrine, the old halls,
 *             a black lake
 *   fauna     one to three kinds of life in the caverns: spiders, crawlers, trolls, bats,
 *             glow-worms, mushroom folk
 *
 * The sim reads the cast (`has(id)`) where it builds the mountain and runs its year. These
 * definitions only say how likely each is, what can't go together, and what each needs.
 */
import type { SystemDef } from '../../kit';
import type { Mountain } from './deep-sim';

export type CastCtx = { mountain: Mountain; hazards: number; below: string };
type D = SystemDef<CastCtx, undefined>;
const stub = (id: string) => () => ({ id });
const def = (id: string, label: string, tags: string[], weight: D['weight'], extra: Partial<D> = {}): D => ({ id, label, tags, weight, create: stub(id), ...extra });
const forced = (id: string, w: number) => (_g: unknown, c: CastCtx) => (c.below === 'any' ? w : c.below === id ? 1000 : 0);
const by = (m: Partial<Record<Mountain, number>>, base: number) => (_g: unknown, c: CastCtx) => base * (m[c.mountain] ?? 1);

export const DEEP_CAST: D[] = [
  def('sleeper', 'something asleep', ['below'], forced('sleeper', 3)),
  def('lich', 'a lich in the old halls', ['below'], forced('lich', 1.4), { excludes: [] }),
  def('engine', 'an elder engine', ['below'], forced('engine', 1.2)),
  def('hive', 'a hive', ['below'], forced('hive', 1.4)),
  def('nothing', 'only stone', ['below'], forced('nothing', 1.6)),

  def('floods', 'aquifers', ['hazard'], (_g, c) => (c.hazards > 0 ? by({ drowned: 3, frost: 0.5 }, 1.6)(_g, c) : 0)),
  def('magma', 'magma', ['hazard'], (_g, c) => (c.hazards > 0 ? by({ ember: 3, frost: 0.4 }, 1)(_g, c) : 0)),
  def('weakrock', 'weak rock', ['hazard'], (_g, c) => (c.hazards > 0 ? by({ frost: 1.6, drowned: 1.4 }, 1.2)(_g, c) : 0)),
  def('firedamp', 'firedamp', ['hazard'], (_g, c) => (c.hazards > 0 ? by({ iron: 2.5 }, 0.8)(_g, c) : 0)),
  def('plague', 'a spore plague', ['hazard'], (_g, c) => (c.hazards > 0 ? by({ drowned: 1.5, crystal: 1.2 }, 0.8)(_g, c) : 0)),

  def('goblins', 'goblins at the gate', ['neighbor'], (_g, c) => (c.hazards > 0 ? 2 : 0)),
  def('warren', 'a goblin warren', ['neighbor'], (_g, c) => (c.hazards > 0 ? 1 : 0)),
  def('deepfolk', 'deep gnomes', ['neighbor'], 1.1),

  def('geode', 'a crystal geode', ['wonder'], by({ crystal: 3 }, 0.9)),
  def('lode', 'a mithril lode', ['wonder'], 0.8),
  def('shrine', 'a sunken shrine', ['wonder'], 0.9),
  def('ruins', 'the old halls', ['wonder'], 1.6),
  def('lake', 'a black lake', ['wonder'], by({ drowned: 4, frost: 1.2 }, 0.6)),

  def('spiders', 'spiders', ['fauna'], by({ crystal: 2.5 }, 1.2)),
  def('crawlers', 'crawlers', ['fauna'], 1.2),
  def('trolls', 'trolls', ['fauna'], by({ frost: 2, iron: 1.4 }, 0.8)),
  def('bats', 'bats', ['fauna'], 1.2),
  def('glowworms', 'glow-worms', ['fauna'], by({ drowned: 2, crystal: 1.5 }, 1)),
  def('mushroomfolk', 'mushroom folk', ['fauna'], 0.7),
];

/** The lich lives in the old halls: if it is drawn, they are there. */
export const CAST_RULE = { total: [8, 12] as [number, number], quota: { below: [1, 1] as [number, number], hazard: [1, 4] as [number, number], neighbor: [0, 2] as [number, number], wonder: [0, 2] as [number, number], fauna: [1, 3] as [number, number] } };
