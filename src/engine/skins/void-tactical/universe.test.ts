// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import '../../../lib';
import { CHOIR_PACK, universePrompt, validateUniverse, VOID_PACK } from './universe';
import { packFromGithub } from './github';
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

  it('round-trips the built-in packs', () => {
    for (const p of [VOID_PACK, CHOIR_PACK]) {
      const { pack, errors } = validateUniverse(JSON.parse(JSON.stringify(p)));
      expect(errors).toEqual([]);
      expect(pack.structures.length).toBe(p.structures.length);
    }
  });

  it('writes a prompt that names the subject and asks for JSON only', () => {
    const prompt = universePrompt('The Expanse');
    expect(prompt).toContain('Universe: The Expanse');
    expect(prompt).toMatch(/Return ONLY one JSON object/);
    expect(prompt).toContain('role is what it does on the map');
  });
});

describe('github galaxy', () => {
  it('maps repos to systems and languages to factions', () => {
    const pack = packFromGithub(
      { login: 'octo', name: 'Octo Cat', bio: 'builds things', public_repos: 3, followers: 9, created_at: '2015-01-01T00:00:00Z' },
      [
        { name: 'alpha', full_name: 'octo/alpha', language: 'Rust', stargazers_count: 40, forks_count: 1, open_issues_count: 0, description: null, fork: false, archived: false, pushed_at: '2026-01-01' },
        { name: 'beta', full_name: 'octo/beta', language: 'TypeScript', stargazers_count: 2, forks_count: 0, open_issues_count: 1, description: null, fork: false, archived: false, pushed_at: '2026-02-01' },
        { name: 'gamma', full_name: 'octo/gamma', language: 'Rust', stargazers_count: 0, forks_count: 0, open_issues_count: 0, description: null, fork: true, archived: false, pushed_at: '2026-03-01' },
      ],
      [
        { type: 'PushEvent', repo: { name: 'octo/alpha' }, payload: { commits: [{ message: 'fix the warp core\n\nlong body' }] } },
        { type: 'IssuesEvent', repo: { name: 'octo/beta' }, payload: { action: 'opened', issue: { number: 7, title: 'Crash on launch' } } },
      ],
    );
    expect(pack.systems?.map((s) => s.name)).toEqual(['ALPHA', 'BETA']);
    expect(pack.factions.map((f) => f.name)).toEqual(['RUST', 'TYPESCRIPT']);
    expect(pack.fleets?.map((f) => f.name)).toEqual(['PUSH ALPHA', 'ISSUE #7']);
    expect(pack.chatter.fleet[0]).toBe('FIX THE WARP CORE');
    expect(pack.anomalies[0].label).toBe('CRASH ON LAUNCH');
    expect(pack.ambient[0]).toBe('@OCTO');
    const checked = validateUniverse(pack);
    expect(checked.errors).toEqual([]);
    // Validation keeps the data-driven parts.
    expect(checked.pack.fleets?.map((f) => f.name)).toEqual(['PUSH ALPHA', 'ISSUE #7']);
    expect(checked.pack.systems?.length).toBe(2);
  });
});

describe('void-tactical with a universe', () => {
  const run = (options: Record<string, unknown>, seed: string) => {
    const wrapper = document.createElement('div');
    const canvas = document.createElement('canvas');
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    const s = createManualScheduler();
    const h = createBackground(canvas, { skin: 'void-tactical', options, scheduler: s, config: { seed, adaptiveQuality: false, motion: 'full' } });
    s.step(240);
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
});
