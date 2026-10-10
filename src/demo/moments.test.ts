import { describe, expect, it } from 'vitest';
import { createMoments, momentLink, sameSize, type ImageStore, type Moment } from './moments';

class MemoryStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

function memoryImages() {
  const map = new Map<string, unknown>();
  const store: ImageStore = {
    put: async (id, pics) => void map.set(id, pics),
    get: async (id) => map.get(id) as never,
    remove: async (id) => void map.delete(id),
  };
  return { map, store };
}

const m = (id: string, over: Partial<Moment> = {}): Moment => ({
  id,
  at: 1,
  world: 'wyrmspire',
  source: 'wyrmspire',
  seed: 'vale-1',
  t: 200,
  href: 'https://example.test/?bg=wyrmspire&seed=vale-1#s=abc',
  w: 1280,
  h: 800,
  kind: 'first',
  name: 'The wyrm is slain',
  seen: false,
  ...over,
});

describe('moments', () => {
  it('keeps moments across loads, with pictures beside them', async () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const img = memoryImages();
    const a = createMoments(storage, img.store);
    await a.add(m('one'), { still: new Blob(['x']) });
    expect(a.unseen).toBe(1);
    const b = createMoments(storage, img.store);
    expect(b.list.map((x) => x.id)).toEqual(['one']);
    expect(await b.images('one')).toBeTruthy();
  });

  it('marks moments seen, and drops their pictures when forgotten', async () => {
    const img = memoryImages();
    const s = createMoments(null, img.store);
    await s.add(m('one'), { still: new Blob(['x']) });
    await s.add(m('two'), { still: new Blob(['y']) });
    s.markSeen();
    expect(s.unseen).toBe(0);
    s.remove('one');
    await Promise.resolve();
    expect(img.map.has('one')).toBe(false);
    expect(s.list.map((x) => x.id)).toEqual(['two']);
  });

  it('keeps at most forty', async () => {
    const s = createMoments(null, memoryImages().store);
    for (let i = 0; i < 45; i++) await s.add(m(`m${i}`));
    expect(s.list).toHaveLength(40);
    expect(s.list[0].id).toBe('m5');
  });

  it('links to a little before the moment, keeping the studio state', () => {
    const link = new URL(momentLink(m('one')));
    expect(link.searchParams.get('t')).toBe('194');
    expect(link.searchParams.get('seed')).toBe('vale-1');
    expect(link.hash).toBe('#s=abc');
    expect(new URL(momentLink(m('one', { t: 2 }))).searchParams.get('t')).toBe('0');
  });

  it('allows a scrollbar of difference in window size', () => {
    expect(sameSize(m('one'), 1265, 800)).toBe(true);
    expect(sameSize(m('one'), 390, 844)).toBe(false);
  });
});
