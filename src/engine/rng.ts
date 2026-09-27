/**
 * Seeded PRNG for reproducible sector generation.
 * mulberry32 — small, fast, well-distributed for procedural layout.
 */

export type Rng = () => number;

/** 32-bit string hash (cyrb53 truncated). Stable across sessions. */
export function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return (h1 >>> 0);
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: string | number): Rng {
  return mulberry32(hashSeed(seed));
}

/**
 * Independent stream derived from a seed and a label, so one subsystem
 * (e.g. star twinkle) can consume randomness without perturbing another (e.g. spawns).
 */
export function forkRng(seed: string | number, label: string): Rng {
  return createRng(`${seed}::${label}`);
}

export function randomSeedString(): string {
  const adjectives = ['quiet', 'amber', 'void', 'kepler', 'orion', 'silent', 'hollow', 'far'];
  const nouns = ['cartographer', 'rift', 'harbor', 'meridian', 'relay', 'march', 'well', 'garden'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const k = Math.floor(Math.random() * 90 + 10);
  return `${a}-${n}-${k}`;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick() from empty list');
  }
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: Rng, minInclusive: number, maxExclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxExclusive - minInclusive));
}

export function token(rng: Rng, length = 4): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}
