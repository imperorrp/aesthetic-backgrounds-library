import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const cli = resolve(__dirname, '../bin/bg-engine.mjs');
const run = (args: string[], cwd?: string) => execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
const work = mkdtempSync(join(tmpdir(), 'bg-engine-cli-'));
afterAll(() => rmSync(work, { recursive: true, force: true }));

describe('bg-engine CLI', () => {
  it('lists the registry as JSON, including community presets', () => {
    const rows = JSON.parse(run(['list', '--kind', 'preset', '--json'])) as { id: string; source: string; cost: string }[];
    expect(rows.find((r) => r.id === 'calm-mesh')).toMatchObject({ source: 'builtin' });
    expect(rows.find((r) => r.id === 'ember-nocturne')).toMatchObject({ source: 'community' });
    expect(rows.every((r) => ['low', 'medium', 'gpu'].includes(r.cost))).toBe(true);
  });

  it('prints options for a layer', () => {
    const text = run(['info', 'starfield']);
    expect(text).toMatch(/Starfield \(layer, starfield\)/);
    expect(text).toMatch(/density\s+1\s+0\.\.2/);
  });

  it('adds a preset as one editable file with the scene inlined', () => {
    run(['add', 'aurora-night', '--dir', 'bg', '--palette', 'ff7a1a', '--intensity', '0.5'], work);
    const src = readFileSync(join(work, 'bg/aurora-night.ts'), 'utf8');
    expect(src).toMatch(/registerPresetManifest\(manifest\)/);
    expect(src).toMatch(/export function mountBackground/);
    expect(src).toMatch(/"use": "aurora"/);
    expect(src).toMatch(/"from": "#ff7a1a"/);
    expect(src).toMatch(/"intensity": 0\.5/);
  });

  it('adds a skin with every option at its default', () => {
    run(['add', 'void-tactical', '--dir', 'bg', '--js'], work);
    const src = readFileSync(join(work, 'bg/void-tactical.js'), 'utf8');
    expect(src).toMatch(/"skin": "void-tactical"/);
    expect(src).toMatch(/"hueVariety": 0\.94/);
    expect(src).not.toMatch(/: MountOptions/);
  });

  it('refuses to overwrite without --force and suggests near misses', () => {
    const again = spawnSync(process.execPath, [cli, 'add', 'aurora-night', '--dir', 'bg'], { cwd: work, encoding: 'utf8' });
    expect(again.status).toBe(1);
    expect(again.stderr).toMatch(/exists\. Pass --force/);
    const typo = spawnSync(process.execPath, [cli, 'info', 'aurra-night'], { encoding: 'utf8' });
    expect(typo.status).toBe(1);
    expect(typo.stderr).toMatch(/Did you mean: aurora-night/);
  });
});
