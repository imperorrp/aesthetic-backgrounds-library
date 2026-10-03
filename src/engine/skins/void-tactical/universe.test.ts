// @vitest-environment jsdom
import '../../../test/load-all';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import '../../../lib';
import { registerMechanic } from './mechanics';
import { getUniverse, listUniverses, universePrompt, validateUniverse, VOID_PACK } from './universe';
import { CHOIR_PACK, SALTWIND_PACK, SIEGE_PACK } from './packs';
import { createBackground } from '../../core/createBackground';
import { createManualScheduler } from '../../core/scheduler';
import { installCanvasStub, recorderFor } from '../../../test/canvas-stub';

beforeAll(() => installCanvasStub());

describe('universe packs', () => {
  it('accepts what an AI returns, fenced or not, and fills gaps with warnings', () => {
    const raw = '```json\n' + JSON.stringify({
      name: 'Test Reach',
      factions: [{ name: 'Guild', prefix: 'gld', color: '#ff0000', classes: ['freighter'] }],
      structures: [
        { label: 'big dock', role: 'dock', color: '#00ff00', rarity: 'common', art: ['[==]', '[==]'] },
        { label: 'weird thing', role: 'nonsense', color: 'not-a-color', rarity: 'mythic', art: [] },
      ],
      anomalies: ['A HUM', { label: 'A TEAR', style: 'rift' }],
      chatter: { fleet: ['ok'] },
      ambient: ['far words'],
    }) + '\n```';
    const { pack, errors, warnings } = validateUniverse(raw);
    expect(errors).toEqual([]);
    expect(pack.name).toBe('TEST REACH');
    expect(pack.factions[0].prefix).toBe('GLD');
    expect(pack.structures[1].role).toBe('dock');
    expect(pack.structures[1].color).toBe('#94a3b8');
    expect(pack.structures[1].art.length).toBeGreaterThan(0);
    expect(pack.anomalies.map((a) => a.label)).toEqual(['A HUM', 'A TEAR']);
    expect(warnings.some((w) => w.includes('shipyard'))).toBe(true);
  });

  it('rejects input it cannot use', () => {
    expect(validateUniverse('not json').errors.length).toBe(1);
    expect(validateUniverse({ name: 'x' }).errors.join(' ')).toMatch(/No structures/);
  });

  it('lists lazily loaded universes with the same name, tagline, and colors as the packs themselves', () => {
    for (const meta of listUniverses()) {
      const pack = getUniverse(meta.id)!;
      expect(pack, meta.id).toBeDefined();
      expect({ name: pack.name, tagline: pack.tagline, palette: pack.palette, warmth: pack.warmth }).toEqual({ name: meta.name, tagline: meta.tagline, palette: meta.palette, warmth: meta.warmth });
    }
  });

  it('round-trips the built-in packs', () => {
    for (const p of [VOID_PACK, SALTWIND_PACK, CHOIR_PACK, SIEGE_PACK]) {
      const { pack, errors } = validateUniverse(JSON.parse(JSON.stringify(p)));
      expect(errors).toEqual([]);
      expect(pack.structures.length).toBe(p.structures.length);
      expect(pack.mechanics?.map((m) => m.use)).toEqual(p.mechanics?.map((m) => m.use));
      expect(pack.look).toEqual(p.look);
    }
  });

  it('writes a short prompt that names the subject, asks for JSON only, and offers the mechanics', () => {
    const prompt = universePrompt('The Expanse', [{ id: 'storms', description: 'Fronts roll across the map.', params: ['rate', 'color'] }]);
    expect(prompt).toContain('star map of: The Expanse');
    expect(prompt).toMatch(/Return only JSON/);
    expect(prompt).toContain('storms: Fronts roll across the map. (params: rate, color)');
    expect(prompt.length).toBeLessThan(2000);
  });
});

describe('void-tactical with a universe', () => {
  const run = (options: Record<string, unknown>, seed: string, frames = 240) => {
    const wrapper = document.createElement('div');
    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const s = createManualScheduler();
    const h = createBackground(canvas, { skin: 'void-tactical', options, scheduler: s, config: { seed, adaptiveQuality: false, motion: 'full' } });
    s.step(frames);
    const rec = recorderFor(canvas);
    h.destroy();
    wrapper.remove();
    return rec.hash;
  };

  it('replays identically per seed and differs between universes', () => {
    const a = run({ universe: 'saltwind' }, 'u-1');
    expect(run({ universe: 'saltwind' }, 'u-1')).toBe(a);
    expect(run({ universe: 'choir' }, 'u-1')).not.toBe(a);
    const inline = run({ pack: CHOIR_PACK }, 'u-1');
    expect(run({ pack: CHOIR_PACK }, 'u-1')).toBe(inline);
  }, 30_000);

  it('lets options.mechanics replace the pack list, including mechanics registered from outside', () => {
    const calls = { created: 0, updates: 0, draws: 0 };
    registerMechanic({
      id: 'test-probe',
      label: 'Probe',
      description: 'Counts its calls.',
      schema: { rate: { type: 'number', min: 0, max: 1, default: 0.5 } },
      create(_api, p) {
        calls.created++;
        expect(p.rate).toBe(0.5);
        return { update: () => void calls.updates++, draw: () => void calls.draws++ };
      },
    });
    const base = run({ universe: 'saltwind' }, 'm-1');
    expect(run({ universe: 'saltwind', mechanics: [{ use: 'test-probe' }] }, 'm-1')).not.toBe(base);
    expect(calls.created).toBe(1);
    expect(calls.updates).toBeGreaterThan(100);
    expect(calls.draws).toBeGreaterThan(100);
    // Switched off is the same as absent.
    expect(run({ universe: 'saltwind', mechanics: [{ use: 'storms', enabled: false }] }, 'm-1')).toBe(run({ universe: 'saltwind', mechanics: [] }, 'm-1'));
  }, 60_000);

  it('switches off a mechanic that throws and keeps the scene running', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerMechanic({
      id: 'test-broken',
      label: 'Broken',
      description: 'Throws on its tenth update.',
      schema: {},
      create() {
        let n = 0;
        return {
          update() {
            if (++n === 10) throw new Error('boom');
          },
        };
      },
    });
    expect(() => run({ universe: 'void', mechanics: [{ use: 'test-broken' }, { use: 'skirmish' }] }, 'm-2')).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  }, 30_000);
});
