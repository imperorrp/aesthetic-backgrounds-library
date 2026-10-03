/**
 * Restless words: huge, faint lines of text hang behind the map (the pack's ambient
 * words). Now and then the letters of one wander out of place and settle into an anagram,
 * hold there long enough to be noticed, and drift back as if nothing happened.
 *
 * Whispers: while the pointer is on the page, a short line now and then surfaces near
 * it and sinks away again ("IT SEES YOU"). They only answer a real visitor, so tests and
 * screenshots never see them.
 */
import { hexRgba } from '../renderers/utils';
import { registerMechanic } from './types';

type Letter = { ch: string; home: number; from: number; to: number };
type Phrase = { text: string; x: number; y: number; size: number; letters: Letter[]; state: 'still' | 'drifting' | 'wrong' | 'returning'; since: number };

const WHISPERS = ['IT SEES YOU', 'DO NOT LOOK BACK', 'WE REMEMBER YOU', 'YOU WERE HERE BEFORE', 'STAY', 'IT IS LISTENING', 'COUNT YOUR CREW', 'THE DOOR IS OPEN'];

registerMechanic({
  id: 'restless',
  label: 'Restless words',
  description: 'Huge faint words behind the map whose letters drift into anagrams and back; whispers surface near the pointer.',
  schema: {
    words: { type: 'number', min: 1, max: 6, default: 3, step: 1, label: 'Lines on screen' },
    alpha: { type: 'number', min: 0.02, max: 0.2, default: 0.06, label: 'Strength' },
    whispers: { type: 'boolean', default: true, label: 'Whispers near the pointer' },
  },
  create(api, p) {
    const lines = api.pack.ambient.length ? api.pack.ambient : ['WE ARE STILL HERE'];
    const phrases: Phrase[] = [];
    let used = 0;
    let nextShift = api.t + 6 + api.rng() * 6;
    let whisper: { text: string; x: number; y: number; at: number } | null = null;
    let nextWhisper = api.t + 8;

    const make = (x: number): Phrase => {
      const text = lines[used++ % lines.length];
      return {
        text,
        x,
        y: api.height * (0.15 + api.rng() * 0.7),
        size: 30 + api.rng() * 22,
        letters: [...text].map((ch, i) => ({ ch, home: i, from: i, to: i })),
        state: 'still',
        since: api.t,
      };
    };
    for (let i = 0; i < (Number(p.words) || 3); i++) phrases.push(make(api.view().left + api.width * (0.1 + i * 0.35)));

    /** Shuffle the non-space slots: the letters keep their places in words, but not their order. */
    const anagram = (ph: Phrase) => {
      const slots = ph.letters.filter((l) => l.ch !== ' ').map((l) => l.home);
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(api.rng() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
      let k = 0;
      for (const l of ph.letters) {
        l.from = l.home;
        l.to = l.ch === ' ' ? l.home : slots[k++];
      }
    };

    return {
      update() {
        const v = api.view();
        // Lines that scroll off are replaced ahead.
        for (let i = 0; i < phrases.length; i++) {
          const ph = phrases[i];
          if (ph.x + ph.text.length * ph.size * 0.62 < v.left - 100) phrases[i] = make(v.right + 80 + api.rng() * 300);
        }
        // One line at a time goes wrong.
        if (api.t >= nextShift && phrases.every((ph) => ph.state === 'still')) {
          const vis = phrases.filter((ph) => ph.x > v.left && ph.x < v.right - 200);
          const ph = vis[Math.floor(api.rng() * vis.length)];
          if (ph) {
            anagram(ph);
            ph.state = 'drifting';
            ph.since = api.t;
            api.emit({ type: 'anagram', x: ph.x, y: ph.y, weight: 0.2 });
          }
          nextShift = api.t + 10 + api.rng() * 12;
        }
        for (const ph of phrases) {
          const age = api.t - ph.since;
          if (ph.state === 'drifting' && age > 3) [ph.state, ph.since] = ['wrong', api.t];
          else if (ph.state === 'wrong' && age > 4.5) {
            for (const l of ph.letters) [l.from, l.to] = [l.to, l.home];
            [ph.state, ph.since] = ['returning', api.t];
          } else if (ph.state === 'returning' && age > 3) {
            for (const l of ph.letters) l.from = l.to = l.home;
            [ph.state, ph.since] = ['still', api.t];
          }
        }
        // Whispers answer a real visitor only.
        const pt = api.host.pointer;
        if (p.whispers !== false && pt.active && pt.idle < 3 && api.t >= nextWhisper && !whisper) {
          const left = api.view().left;
          whisper = {
            text: WHISPERS[Math.floor(api.rng() * WHISPERS.length)],
            x: api.camera.wx(pt.x) - left + 18,
            y: api.camera.wy(pt.y) - 14,
            at: api.t,
          };
          nextWhisper = api.t + 9 + api.rng() * 9;
        }
        if (whisper && api.t - whisper.at > 4.5) whisper = null;
      },
      draw(ctx, pass, frame) {
        if (pass === 'ground') {
          const a = Number(p.alpha) || 0.06;
          ctx.save();
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          for (const ph of phrases) {
            ctx.font = `${Math.round(ph.size)}px "Syne Mono", ui-monospace, monospace`;
            const cw = ph.size * 0.62;
            const x0 = api.screenX(ph.x);
            const age = frame.time - ph.since;
            const k = ph.state === 'drifting' || ph.state === 'returning' ? Math.min(1, age / 3) : ph.state === 'wrong' ? 1 : 0;
            const e = k * k * (3 - 2 * k);
            const wrong = ph.state !== 'still';
            for (const l of ph.letters) {
              if (l.ch === ' ') continue;
              const slot = l.from + (l.to - l.from) * e;
              // Letters arc as they move, as if lifted and set down.
              const lift = Math.sin(e * Math.PI) * (l.to === l.from ? 0 : ph.size * 0.5);
              ctx.fillStyle = hexRgba(wrong ? '#f0abfc' : api.host.palette.ink, a * (wrong ? 1.4 : 1));
              ctx.fillText(l.ch, Math.round(x0 + slot * cw), Math.round(ph.y - lift));
            }
          }
          ctx.restore();
        } else if (pass === 'over' && whisper) {
          const age = frame.time - whisper.at;
          const fade = Math.min(1, age / 0.8) * Math.min(1, (4.5 - age) / 1.5);
          ctx.save();
          ctx.font = '10px "Syne Mono", ui-monospace, monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const jitter = Math.sin(frame.time * 31) * 0.6;
          ctx.fillStyle = hexRgba('#f0abfc', 0.55 * fade);
          ctx.fillText(whisper.text, whisper.x + jitter, whisper.y);
          ctx.fillStyle = hexRgba('#67e8f9', 0.25 * fade);
          ctx.fillText(whisper.text, whisper.x - 1.5 + jitter, whisper.y + 0.5);
          ctx.restore();
        }
      },
    };
  },
});
