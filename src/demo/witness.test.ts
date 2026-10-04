import { describe, expect, it } from 'vitest';
import { SOUND_PALETTES } from '../engine/audio/palettes';
import { awaySummary, chronicleText, clock, createJournal, SIGHTS, sightFor } from './witness';

/** A Storage with nothing behind it but a map. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const at = (t: number, extra = {}) => ({ source: 'void-tactical', seed: 'orion-7', t, ...extra });

describe('journal', () => {
  it('keeps the first sighting with its seed and moment, and counts the rest', () => {
    let clockMs = 1000;
    const j = createJournal(null, () => clockMs);
    const a = j.witness('cradle', 'supernova', at(312));
    expect(a?.first).toBe(true);
    clockMs = 9000;
    const b = j.witness('cradle', 'supernova', at(900));
    expect(b?.first).toBe(false);
    expect(j.data.sightings.cradle.supernova).toEqual({ n: 2, first: 1000, seed: 'orion-7', t: 312, source: 'void-tactical' });
    expect(j.progress('cradle')).toEqual({ seen: 1, total: SIGHTS.cradle.length });
  });

  it('ignores what a world does not keep, and keys by world', () => {
    const j = createJournal();
    expect(j.witness('cradle', 'dock', at(1))).toBeNull();
    expect(j.witness('nowhere', 'supernova', at(1))).toBeNull();
    // The same event type means different things in different worlds.
    expect(sightFor('sonar', 'echo')?.name).not.toBe(sightFor('choir', 'echo')?.name);
  });

  it('chronicles the uncommon and the first of anything; folds quick repeats', () => {
    const j = createJournal();
    j.witness('cradle', 'ignite', at(10)); // first: chronicled
    j.witness('cradle', 'ignite', at(20)); // common repeat: counted only
    expect(j.data.chronicle).toHaveLength(1);
    j.witness('cradle', 'contact', at(30, { detail: 'FIRST CONTACT · STAR 1 ⇄ STAR 2' }));
    j.witness('cradle', 'contact', at(40));
    expect(j.data.chronicle).toHaveLength(2);
    expect(j.data.chronicle[1]).toMatchObject({ n: 2, detail: 'FIRST CONTACT · STAR 1 ⇄ STAR 2', first: true });
    j.witness('cradle', 'contact', at(400));
    expect(j.data.chronicle).toHaveLength(3);
  });

  it('never mutates a snapshot it has handed out', () => {
    const j = createJournal();
    const before = j.data;
    const frozen = JSON.stringify(before);
    j.witness('void', 'surge', at(5));
    expect(j.data).not.toBe(before);
    expect(JSON.stringify(before)).toBe(frozen);
  });

  it('persists to storage and comes back', async () => {
    const storage = memoryStorage();
    const j = createJournal(storage);
    j.witness('undercity', 'breach', at(77, { source: 'undercity' }));
    j.setPref('announce', false);
    await new Promise((r) => setTimeout(r, 900));
    const again = createJournal(storage);
    expect(again.data.sightings.undercity.breach.n).toBe(1);
    expect(again.data.prefs).toEqual({ away: true, announce: false });
    storage.setItem('bge.journal.v1', '{not json');
    expect(createJournal(storage).data.chronicle).toEqual([]);
  });

  it('every sight is an event its world reports (each has a sound bound to it)', () => {
    for (const [world, sights] of Object.entries(SIGHTS)) {
      const palette = SOUND_PALETTES[world];
      expect(palette, world).toBeTruthy();
      for (const x of sights) expect(palette.cues[x.type], `${world}:${x.type}`).toBeTruthy();
      expect(new Set(sights.map((x) => x.type)).size, world).toBe(sights.length);
    }
  });

  it('writes time, text, and the away summary', () => {
    expect(clock(0)).toBe('0:00');
    expect(clock(222.7)).toBe('3:42');
    expect(clock(3725)).toBe('1:02:05');
    const j = createJournal();
    j.witness('cradle', 'supernova', at(75, { detail: 'STAR 3 · SUPERNOVA', away: true }));
    expect(chronicleText(j.data.chronicle, (id) => (id === 'cradle' ? 'Cradle of Suns' : id))).toBe(
      '[Cradle of Suns · 1:15 · while you were away] A star died in a supernova. — STAR 3 · SUPERNOVA',
    );
    const found = ['ignite', 'ignite', 'ignite', 'supernova', 'life'].map((t) => sightFor('cradle', t)!);
    expect(awaySummary(found)).toBe('Supernova, first light ×3, life.');
    expect(awaySummary([])).toMatch(/quiet/);
  });
});
