import '../test/load-all';
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from './rng';
import { generateSystem, generateSingleSystem, generateSingleStructure } from './skins/void-tactical/generators';
import { resolveBackgroundConfig } from './config';
import { voidTacticalSkin } from './skins/void-tactical/runtime';

describe('seeded generation', () => {
  it('hashes the same seed to the same 32-bit value', () => {
    expect(hashSeed('kepler-22')).toBe(hashSeed('kepler-22'));
    expect(hashSeed('kepler-22')).not.toBe(hashSeed('kepler-23'));
  });

  it('same seed yields identical starfields', () => {
    const a = generateSystem(1280, 720, { starCount: 80, rng: createRng('orion-7'), populate: false });
    const b = generateSystem(1280, 720, { starCount: 80, rng: createRng('orion-7'), populate: false });
    expect(a.stars).toEqual(b.stars);
    expect(a.constellations).toEqual(b.constellations);
  });

  it('different seeds diverge', () => {
    const a = generateSystem(1280, 720, { starCount: 80, rng: createRng('orion-7'), populate: false });
    const b = generateSystem(1280, 720, { starCount: 80, rng: createRng('orion-8'), populate: false });
    expect(a.stars).not.toEqual(b.stars);
  });

  it('system and structure generators are deterministic under a seed', () => {
    const rngA = createRng('harbor-11');
    const rngB = createRng('harbor-11');
    expect(generateSingleSystem(100, 200, rngA)).toEqual(generateSingleSystem(100, 200, rngB));
    expect(generateSingleStructure(50, 50, [], rngA)).toEqual(generateSingleStructure(50, 50, [], rngB));
  });

  it('detail aliases labelDensity and the default skin is named', () => {
    expect(resolveBackgroundConfig({ labelDensity: 'high' }).detail).toBe('high');
    expect(resolveBackgroundConfig({ detail: 'none' }).detail).toBe('none');
    expect(voidTacticalSkin.id).toBe('void-tactical');
  });
});
