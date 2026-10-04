/**
 * The journal in the studio: listening to the live world (sightings, the chronicle,
 * "happening now"), catching up after you have been away, and the Journal tab itself.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MountHandle } from '../react-entry';
import { awaySummary, chronicleText, clock, createJournal, RARITY_ORDER, SIGHTS, sightFor, type Journal, type JournalData, type Rarity, type Sight, type Sighting } from './witness';

let shared: Journal | null = null;
/** One journal for the page, kept in localStorage. */
export function useJournal(): Journal {
  if (!shared) {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* storage blocked */
    }
    shared = createJournal(storage);
  }
  return shared;
}

export function useJournalData(journal: Journal): JournalData {
  return useSyncExternalStore(journal.subscribe, () => journal.data);
}

export type FeedItem = { key: number; t: number; text: string; rarity?: Rarity; detail?: string };
export type Toast = { key: number; kind: 'first' | 'away'; title: string; body: string; rarity?: Rarity };

type Say = { text: string; priority: string; at: number; used?: boolean };

/**
 * Listen to the mounted world: count sightings, write the chronicle, feed "happening
 * now", and announce firsts. When the tab comes back after a while, simulate the time
 * it missed (up to five minutes) and say what happened.
 */
export function useWitness(o: {
  handle: MountHandle | null;
  journal: Journal;
  world: string | null;
  source: string;
  seed: string;
  speed: number;
  onFeed: (item: FeedItem) => void;
  onToast: (toast: Toast) => void;
}) {
  const latest = useRef(o);
  latest.current = o;
  const clockRef = useRef(0);

  useEffect(() => {
    const handle = o.handle;
    if (!handle) return;
    clockRef.current = 0;
    let n = 0;
    const says: Say[] = [];
    let lastSayFeed = -Infinity;
    const queue: { type: string; text?: string; at: number }[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * The map's own line for an event: the first unclaimed line said in the same frame.
     * Mechanics say their line and then emit, so in-order pairing matches them up.
     */
    const lineFor = (at: number, own?: string) => {
      if (own) return own;
      const s = says.find((x) => !x.used && Math.abs(x.at - at) < 60);
      if (s) s.used = true;
      return s?.text;
    };

    const flush = () => {
      flushTimer = null;
      const { journal, world, source, seed, onFeed, onToast } = latest.current;
      for (const q of queue.splice(0)) {
        if (!world) continue;
        const detail = lineFor(q.at, q.text);
        const got = journal.witness(world, q.type, { source, seed, t: clockRef.current, detail });
        if (!got) continue;
        onFeed({ key: ++n, t: clockRef.current, text: got.sight.name, rarity: got.sight.rarity, detail });
        // Commons come thick and fast in a world's first minute; they go to the journal quietly.
        if (got.first && got.sight.rarity !== 'common' && journal.data.prefs.announce) {
          onToast({ key: Date.now() + n, kind: 'first', title: `First sighting · ${got.sight.name}`, body: got.sight.line, rarity: got.sight.rarity });
        }
      }
    };

    const offFrame = handle.onFrame((info) => {
      clockRef.current = info.t;
    });
    const offEvent = handle.onEvent((e) => {
      if (e.type === 'ambience') return;
      const at = performance.now();
      if (e.type === 'say') {
        if (!e.text || (e.priority !== 'high' && e.priority !== 'medium')) return;
        says.push({ text: e.text, priority: e.priority, at });
        if (says.length > 8) says.shift();
        // Notable lines go to the feed too, a few at a time.
        if (e.priority === 'high' && at - lastSayFeed > 2500) {
          lastSayFeed = at;
          latest.current.onFeed({ key: ++n, t: clockRef.current, text: e.text });
        }
        return;
      }
      const world = latest.current.world;
      if (!world || !sightFor(world, e.type)) return;
      queue.push({ type: e.type, text: e.text, at });
      // Lines said in the same frame arrive after; read them once the frame is done.
      flushTimer ??= setTimeout(flush, 0);
    });

    // Away and back: simulate what was missed, then tell it. In 20-second chunks, so the
    // page stays responsive and nothing falls out of the log's ring between reads.
    let hiddenAt = 0;
    let gone = false;
    const catchUp = async (seconds: number) => {
      const { journal, world, source, seed, onToast } = latest.current;
      let before = handle.inspect();
      if (!before) return; // only worlds that keep a log can be caught up
      const found: Sight[] = [];
      // The frame clock picks up skipped time by itself; this only dates the entries.
      const base = clockRef.current;
      for (let done = 0; done < seconds && !gone; ) {
        const step = Math.min(20, seconds - done);
        handle.fastForward(step);
        const chunkStart = base + done;
        done += step;
        const after = handle.inspect();
        if (!after) break;
        const fresh = after.log.slice(after.log.length - Math.min(after.seq - before.seq, after.log.length));
        before = after;
        for (const [i, e] of fresh.entries()) {
          const sight = world ? sightFor(world, e.type ?? '') : undefined;
          if (!sight || !world) continue;
          // The line the map said with it, for the chronicle.
          const near = fresh.slice(Math.max(0, i - 3), i + 1).reverse().find((x) => x.type === 'say' && (x.kind === 'high' || x.kind === 'medium') && Math.abs(x.t - e.t) < 0.05);
          journal.witness(world, sight.type, { source, seed, t: chunkStart + Math.max(0, Math.min(step, e.t - (fresh[0]?.t ?? e.t))), detail: near?.text, away: true });
          found.push(sight);
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      if (!gone) onToast({ key: Date.now(), kind: 'away', title: `While you were away · ${clock(seconds)}`, body: awaySummary(found) });
    };
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      const away = (Date.now() - hiddenAt) / 1000;
      const { journal, speed } = latest.current;
      if (!hiddenAt || away < 20 || !journal.data.prefs.away) return;
      hiddenAt = 0;
      void catchUp(Math.round(Math.min(300, away * speed)));
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      gone = true;
      offFrame();
      offEvent();
      if (flushTimer) clearTimeout(flushTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [o.handle]);

  return clockRef;
}

/** Toasts that leave on their own. */
export function ToastStack({ toasts, onDismiss, onOpenJournal }: { toasts: Toast[]; onDismiss: (key: number) => void; onOpenJournal: () => void }) {
  useEffect(() => {
    const timers = toasts.map((t) => window.setTimeout(() => onDismiss(t.key), t.kind === 'away' ? 12000 : 6500));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, onDismiss]);
  if (!toasts.length) return null;
  return (
    <div className="demo-toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.key} className={`demo-toast is-${t.kind}${t.rarity ? ` is-${t.rarity}` : ''}`}>
          <span className="demo-toast-head">
            <strong>{t.title}</strong>
            {t.rarity && <em>{t.rarity}</em>}
          </span>
          <span>{t.body}</span>
          <span className="demo-toast-actions">
            <button type="button" onClick={onOpenJournal}>Open journal</button>
            <button type="button" onClick={() => onDismiss(t.key)} aria-label="Dismiss">
              ✕
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}

export function HappeningNow({ items, quietText }: { items: FeedItem[]; quietText: string }) {
  return (
    <section className="demo-section">
      <h3 className="demo-h">Happening now</h3>
      {items.length ? (
        <ol className="demo-feed">
          {items.map((i) => (
            <li key={i.key} className={i.rarity ? `is-${i.rarity}` : 'is-line'}>
              <span className="demo-feed-t">{clock(i.t)}</span>
              <span className="demo-feed-text">
                {i.rarity ? <b>{i.text}</b> : <code>{i.text}</code>}
                {i.rarity && i.detail && <code>{i.detail}</code>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="demo-hint">{quietText}</p>
      )}
    </section>
  );
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function JournalTab({
  journal,
  data,
  world,
  worldName,
  onRevisit,
  onGoWorld,
}: {
  journal: Journal;
  data: JournalData;
  world: string | null;
  worldName: (id: string) => string;
  onRevisit: (world: string, s: Sighting) => void;
  onGoWorld: (world: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const sights = world ? SIGHTS[world] ?? [] : [];
  const book = (world && data.sightings[world]) || {};
  const progress = world ? journal.progress(world) : { seen: 0, total: 0 };
  const ordered = [...sights].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  const chronicle = data.chronicle.slice(-80).reverse();
  const copyChronicle = async () => {
    try {
      await navigator.clipboard.writeText(chronicleText(data.chronicle, worldName));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <section className="demo-section">
        {world ? (
          <>
            <div className="demo-section-head">
              <h3 className="demo-h">Sightings in {worldName(world)}</h3>
              <span className="demo-count">{progress.seen === progress.total ? `All ${progress.total} seen` : `${progress.seen} of ${progress.total}`}</span>
            </div>
            <div className={`demo-progress${progress.seen === progress.total ? ' is-complete' : ''}`} aria-hidden="true">
              <span style={{ width: `${(progress.seen / Math.max(1, progress.total)) * 100}%` }} />
            </div>
            <ul className="demo-sightings">
              {ordered.map((x) => {
                const got = book[x.type];
                return (
                  <li key={x.type} className={`is-${x.rarity}${got ? ' is-seen' : ''}`}>
                    <span className="demo-rarity-dot" title={x.rarity} />
                    {got ? (
                      <>
                        <span className="demo-sighting-name" title={x.line}>
                          {x.name}
                          {got.n > 1 && <small> ×{got.n}</small>}
                        </span>
                        <span className="demo-sighting-meta">{x.rarity}</span>
                        <button type="button" className="demo-link" onClick={() => onRevisit(world, got)} title={`First seen ${fmtDate(got.first)}, ${clock(got.t)} into seed ${got.seed}. Opens that seed and skips ahead.`}>
                          Revisit
                        </button>
                      </>
                    ) : (
                      <>
                        {/* The everyday ones are named; the rare ones keep their secret until seen. */}
                        <span className="demo-sighting-name is-locked">{x.rarity === 'rare' || x.rarity === 'legendary' ? `Something ${x.rarity}` : x.name}</span>
                        <span className="demo-sighting-meta">{x.rarity}</span>
                        <span />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="demo-hint">This background keeps no journal. The worlds and the instruments do.</p>
        )}
      </section>

      <section className="demo-section">
        <h3 className="demo-h">Every world</h3>
        <ul className="demo-worlds-progress">
          {Object.keys(SIGHTS).map((id) => {
            const p = journal.progress(id);
            return (
              <li key={id} className={id === world ? 'is-current' : ''}>
                <button type="button" onClick={() => onGoWorld(id)}>
                  <span>{worldName(id)}</span>
                  <span className="demo-mini-progress" aria-hidden="true">
                    <span style={{ width: `${(p.seen / Math.max(1, p.total)) * 100}%` }} />
                  </span>
                  <span className="demo-count">
                    {p.seen}/{p.total}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="demo-section">
        <div className="demo-section-head">
          <h3 className="demo-h">Chronicle</h3>
          <span className="demo-inline-actions">
            <button type="button" className="demo-link" onClick={copyChronicle} disabled={!data.chronicle.length}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="demo-link" onClick={() => journal.clearChronicle()} disabled={!data.chronicle.length}>
              Clear
            </button>
          </span>
        </div>
        {chronicle.length ? (
          <ol className="demo-chronicle">
            {chronicle.map((e) => (
              <li key={`${e.at}-${e.type}-${e.t}`} className={`is-${e.rarity}`}>
                <span className="demo-chronicle-head">
                  {clock(e.t)}
                  {e.world !== world && ` · ${worldName(e.world)}`}
                  {e.away && ' · while you were away'}
                  {e.first && <em> · first</em>}
                </span>
                <span>
                  {e.line}
                  {e.n > 1 && <small> ×{e.n}</small>}
                </span>
                {e.detail && <code>{e.detail}</code>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="demo-hint">History starts when something worth writing down happens. Leave a world running.</p>
        )}
      </section>

      <section className="demo-section">
        <label className="demo-check">
          <input type="checkbox" checked={data.prefs.away} onChange={(e) => journal.setPref('away', e.target.checked)} />
          <span>
            Keep the world going while I&apos;m away
            <small>When you come back, it catches up (up to five minutes) and tells you what happened.</small>
          </span>
        </label>
        <label className="demo-check">
          <input type="checkbox" checked={data.prefs.announce} onChange={(e) => journal.setPref('announce', e.target.checked)} />
          <span>Announce first sightings</span>
        </label>
        <button
          type="button"
          className="demo-link demo-danger"
          onClick={() => {
            if (window.confirm('Forget every sighting and the whole chronicle?')) journal.reset();
          }}
        >
          Forget everything
        </button>
      </section>
    </>
  );
}
