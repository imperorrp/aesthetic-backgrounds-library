/**
 * The journal in the studio: listening to the live world (sightings, the chronicle,
 * "happening now", moments), catching up after you have been away, and the Journal tab.
 *
 * Nothing pops up while a world plays. The worlds tell their own story on the canvas; the
 * studio keeps the record quietly (a "new" mark on the Journal tab) and speaks only once,
 * when you come back after a while.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MountHandle } from '../react-entry';
import { encodeGif } from './gif';
import { burst, createMoments, idbImages, momentLink, sameSize, still, type Moment, type Moments } from './moments';
import { awayTally, chronicleText, clock, createJournal, RARITY_ORDER, SIGHTS, sightFor, type Journal, type JournalData, type Rarity, type Sight, type Sighting } from './witness';

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null; // storage blocked
  }
};

let shared: Journal | null = null;
/** One journal for the page, kept in localStorage. */
export function useJournal(): Journal {
  shared ??= createJournal(storage());
  return shared;
}

export function useJournalData(journal: Journal): JournalData {
  return useSyncExternalStore(journal.subscribe, () => journal.data);
}

let sharedMoments: Moments | null = null;
/** One shelf of moments for the page. */
export function useMoments(): Moments {
  sharedMoments ??= createMoments(storage(), idbImages());
  return sharedMoments;
}

export function useMomentList(moments: Moments): readonly Moment[] {
  return useSyncExternalStore(moments.subscribe, () => moments.list);
}

/** An object URL for a moment's still or clip, loaded from IndexedDB, revoked when done. */
export function useMomentImage(moments: Moments, id: string | undefined, which: 'still' | 'clip' = 'still'): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(null);
    if (!id) return;
    let made: string | null = null;
    let live = true;
    void moments.images(id).then((pics) => {
      const blob = pics?.[which];
      if (!live || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [moments, id, which]);
  return url;
}

export type FeedItem = { key: number; t: number; text: string; rarity?: Rarity; detail?: string };
export type Away = { key: number; world: string; seconds: number; tally: { sight: Sight; n: number }[]; picture: string | null };

type Say = { text: string; priority: string; at: number; used?: boolean };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let capturing = false;

/**
 * Keep a moment of what is on screen: a still now, then (with `clip`) two seconds of it as a GIF.
 * Only one clip records at a time; a second moment during one gets a still only.
 */
export async function keepMoment(
  handle: MountHandle,
  moments: Moments,
  meta: Pick<Moment, 'world' | 'source' | 'seed' | 't' | 'kind' | 'name' | 'type' | 'line' | 'rarity' | 'detail'>,
  o: { clip?: boolean; seen?: boolean; gone?: () => boolean } = {},
): Promise<Moment | null> {
  const href = new URL(window.location.href);
  href.searchParams.delete('t');
  const pic = await still(handle.canvas);
  if (!pic) return null;
  const m: Moment = { ...meta, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), href: href.toString(), w: window.innerWidth, h: window.innerHeight, seen: !!o.seen };
  let clip: Blob | undefined;
  if (o.clip && !capturing) {
    capturing = true;
    try {
      const frames = await burst(handle.canvas, { cancelled: o.gone });
      if (frames.length >= 4) {
        await wait(0);
        clip = new Blob([encodeGif(frames, 150) as BlobPart], { type: 'image/gif' });
      }
    } catch {
      /* no clip, still a picture */
    } finally {
      capturing = false;
    }
  }
  await moments.add({ ...m, clip: !!clip }, { still: pic, clip });
  return m;
}

/**
 * Listen to the mounted world: count sightings, write the chronicle, feed "happening
 * now", and keep a moment of each first sighting. When the tab comes back after a while,
 * simulate the time it missed (up to five minutes) and say what happened.
 */
export function useWitness(o: {
  handle: MountHandle | null;
  journal: Journal;
  moments: Moments;
  world: string | null;
  source: string;
  seed: string;
  speed: number;
  onFeed: (item: FeedItem) => void;
  onAway: (away: Away) => void;
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
    let gone = false;

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
      const { journal, moments, world, source, seed, speed, onFeed } = latest.current;
      for (const q of queue.splice(0)) {
        if (!world) continue;
        const detail = lineFor(q.at, q.text);
        const t = clockRef.current;
        const got = journal.witness(world, q.type, { source, seed, t, detail });
        if (!got) continue;
        onFeed({ key: ++n, t, text: got.sight.name, rarity: got.sight.rarity, detail });
        // Commons come thick and fast in a world's first minute; only the rarer firsts get a picture.
        if (got.first && got.sight.rarity !== 'common' && journal.data.prefs.moments) {
          const { sight } = got;
          // A beat later, so the event is on screen (less at speed, or it is over).
          void wait(Math.max(120, 700 / Math.max(1, speed))).then(() => {
            if (gone) return;
            void keepMoment(handle, moments, { world, source, seed, t, kind: 'first', type: sight.type, name: sight.name, line: sight.line, rarity: sight.rarity, detail }, { clip: true, gone: () => gone });
          });
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
    const catchUp = async (seconds: number) => {
      const { journal, world, source, seed, onAway } = latest.current;
      let before = handle.inspect();
      if (!before || !world) return; // only worlds that keep a log can be caught up
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
          const sight = sightFor(world, e.type ?? '');
          if (!sight) continue;
          // The line the map said with it, for the chronicle.
          const near = fresh.slice(Math.max(0, i - 3), i + 1).reverse().find((x) => x.type === 'say' && (x.kind === 'high' || x.kind === 'medium') && Math.abs(x.t - e.t) < 0.05);
          journal.witness(world, sight.type, { source, seed, t: chunkStart + Math.max(0, Math.min(step, e.t - (fresh[0]?.t ?? e.t))), detail: near?.text, away: true });
          found.push(sight);
        }
        await wait(0);
      }
      if (gone) return;
      // The world as it is now, once a frame or two has drawn it.
      await wait(120);
      const pic = gone ? null : await still(handle.canvas, 720);
      if (!gone) onAway({ key: Date.now(), world, seconds, tally: awayTally(found), picture: pic ? URL.createObjectURL(pic) : null });
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

/** Back after a while: what the world did without you, and how it looks now. */
export function WelcomeBack({ away, worldName, onClose, onOpenJournal }: { away: Away; worldName: (id: string) => string; onClose: () => void; onOpenJournal: () => void }) {
  useEffect(() => () => {
    if (away.picture) URL.revokeObjectURL(away.picture);
  }, [away.picture]);
  const shown = away.tally.slice(0, 6);
  const more = away.tally.length - shown.length;
  return (
    <div className="demo-shortcuts" role="dialog" aria-modal="true" aria-label="While you were away" onClick={onClose}>
      <div className="demo-shortcuts-card demo-about-card demo-away-card" onClick={(e) => e.stopPropagation()}>
        {away.picture && <img className="demo-away-picture" src={away.picture} alt={`${worldName(away.world)} now`} />}
        <h3 className="demo-about-title">While you were away</h3>
        <p className="demo-about-tag">
          {clock(away.seconds)} went by in {worldName(away.world)}.
        </p>
        {shown.length ? (
          <ul className="demo-away-list">
            {shown.map(({ sight, n }) => (
              <li key={sight.type} className={`is-${sight.rarity}`}>
                <span className="demo-rarity-dot" title={sight.rarity} />
                <span>
                  <b>{sight.name}</b>
                  {n > 1 && <small> ×{n}</small>}
                  <em>{sight.line}</em>
                </span>
              </li>
            ))}
            {more > 0 && <li className="demo-away-more">and {more} more kinds of thing, in the journal.</li>}
          </ul>
        ) : (
          <p>Nothing much. It was quiet.</p>
        )}
        <div className="demo-about-actions">
          <button type="button" className="demo-btn" onClick={onClose}>
            Back to it
          </button>
          <button type="button" className="demo-btn" onClick={onOpenJournal}>
            Open the journal
          </button>
        </div>
      </div>
    </div>
  );
}

/** One moment, large: the picture or the clip, where and when, and the honest way back. */
export function MomentViewer({ moment, moments, worldName, onClose }: { moment: Moment; moments: Moments; worldName: (id: string) => string; onClose: () => void }) {
  const [showClip, setShowClip] = useState(!!moment.clip);
  const [copied, setCopied] = useState(false);
  const pic = useMomentImage(moments, moment.id, 'still');
  const clip = useMomentImage(moments, moment.clip ? moment.id : undefined, 'clip');
  const link = momentLink(moment);
  const same = sameSize(moment, window.innerWidth, window.innerHeight);
  const stem = `${moment.world}-${moment.seed}-${Math.round(moment.t)}s`.replace(/[^\w.-]+/g, '-').toLowerCase();
  const save = (url: string | null, ext: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stem}.${ext}`;
    a.click();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };
  const shown = showClip && clip ? clip : pic;
  return (
    <div className="demo-shortcuts" role="dialog" aria-modal="true" aria-label={moment.name} onClick={onClose}>
      <div className={`demo-shortcuts-card demo-moment-card${moment.rarity ? ` is-${moment.rarity}` : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="demo-moment-frame" style={{ aspectRatio: `${moment.w} / ${moment.h}` }}>
          {shown ? <img src={shown} alt={moment.name} /> : <span className="demo-hint">The picture is not in this browser any more.</span>}
          {moment.clip && clip && (
            <span className="demo-segmented demo-moment-toggle" role="group" aria-label="Picture or clip">
              <button type="button" aria-pressed={!showClip} onClick={() => setShowClip(false)}>
                Still
              </button>
              <button type="button" aria-pressed={showClip} onClick={() => setShowClip(true)}>
                Clip
              </button>
            </span>
          )}
        </div>
        <div className="demo-moment-text">
          <div className="demo-section-head">
            <h3 className="demo-h">{moment.name}</h3>
            {moment.rarity && <span className="demo-sighting-meta">{moment.rarity}</span>}
          </div>
          <p className="demo-chronicle-head">
            {worldName(moment.world)} · seed <code>{moment.seed}</code> · {clock(moment.t)} in · {new Date(moment.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </p>
          {moment.line && <p>{moment.line}</p>}
          {moment.detail && <code className="demo-moment-detail">{moment.detail}</code>}
          <p className="demo-hint">
            Opening it replays the seed from the start to {clock(Math.max(0, moment.t - 6))}, just before. A replay comes close to the picture, not frame for frame.
            {!same && ` This world was made for a ${moment.w} × ${moment.h} window; at your size it comes out a little different.`}
          </p>
          <div className="demo-btn-row">
            <a className="demo-btn demo-btn-primary" href={link}>
              Open this moment
            </a>
            <button type="button" className="demo-btn" onClick={copy}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="demo-btn-row">
            <button type="button" className="demo-btn" onClick={() => save(pic, 'jpg')} disabled={!pic}>
              Picture (.jpg)
            </button>
            {moment.clip && (
              <button type="button" className="demo-btn" onClick={() => save(clip, 'gif')} disabled={!clip}>
                Clip (.gif)
              </button>
            )}
            <span className="demo-spacer" />
            <button
              type="button"
              className="demo-link demo-danger"
              onClick={() => {
                moments.remove(moment.id);
                onClose();
              }}
            >
              Forget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MomentThumb({ moment, moments, isNew, worldName, onOpen }: { moment: Moment; moments: Moments; isNew: boolean; worldName: (id: string) => string; onOpen: (m: Moment) => void }) {
  const pic = useMomentImage(moments, moment.id);
  return (
    <li className={moment.rarity ? `is-${moment.rarity}` : 'is-kept'}>
      <button type="button" onClick={() => onOpen(moment)} title={moment.line ?? moment.name}>
        {pic ? <img src={pic} alt="" /> : <span className="demo-moment-empty" />}
        {isNew && <span className="demo-new">new</span>}
        <span className="demo-moment-name">{moment.name}</span>
        <span className="demo-moment-meta">
          {worldName(moment.world)} · {clock(moment.t)}
        </span>
      </button>
    </li>
  );
}

/**
 * This seed's history as a ribbon: every chronicled event along the world's time, coloured
 * by rarity, moments as rings above. Hover to read; a ring opens its moment.
 */
function Ribbon({ entries, moments, now, onOpen }: { entries: JournalData['chronicle']; moments: readonly Moment[]; now: number; onOpen: (m: Moment) => void }) {
  const end = Math.max(60, now, ...entries.map((e) => e.t), ...moments.map((m) => m.t));
  const at = (t: number) => `${Math.min(100, (t / end) * 100)}%`;
  return (
    <div className="demo-ribbon">
      <div className="demo-ribbon-track">
        {entries.map((e) => (
          <span key={`${e.at}-${e.type}-${e.t}`} className={`demo-ribbon-tick is-${e.rarity}${e.away ? ' is-away' : ''}`} style={{ left: at(e.t) }} title={`${clock(e.t)} · ${e.line}${e.n > 1 ? ` ×${e.n}` : ''}${e.away ? ' (while you were away)' : ''}`} />
        ))}
        {moments.map((m) => (
          <button key={m.id} type="button" className={`demo-ribbon-moment is-${m.rarity ?? 'kept'}`} style={{ left: at(m.t) }} onClick={() => onOpen(m)} title={`${clock(m.t)} · ${m.name}: open the moment`} aria-label={`Moment: ${m.name} at ${clock(m.t)}`} />
        ))}
        <span className="demo-ribbon-now" style={{ left: at(now) }} />
      </div>
      <div className="demo-ribbon-axis">
        <span>0:00</span>
        <span>{clock(end)}</span>
      </div>
    </div>
  );
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function JournalTab({
  journal,
  data,
  moments,
  world,
  source,
  seed,
  clockRef,
  worldName,
  onOpenMoment,
  onReplay,
  onGoWorld,
}: {
  journal: Journal;
  data: JournalData;
  moments: Moments;
  world: string | null;
  source: string;
  seed: string;
  clockRef: { current: number };
  worldName: (id: string) => string;
  onOpenMoment: (m: Moment) => void;
  onReplay: (world: string, s: Sighting) => void;
  onGoWorld: (world: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(clockRef.current);
  const shelf = useMomentList(moments);
  useEffect(() => {
    const id = window.setInterval(() => setNow(clockRef.current), 1000);
    return () => window.clearInterval(id);
  }, [clockRef]);
  // What was new when the tab opened stays marked while you look; it is not new next time.
  const fresh = useRef(new Set<string>()).current;
  for (const m of shelf) if (!m.seen) fresh.add(m.id);
  useEffect(() => moments.markSeen(), [moments, shelf]);

  const sights = world ? SIGHTS[world] ?? [] : [];
  const book = (world && data.sightings[world]) || {};
  const progress = world ? journal.progress(world) : { seen: 0, total: 0 };
  const ordered = [...sights].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
  const chronicle = data.chronicle.slice(-80).reverse();
  const here = (x: { world: string; source: string; seed: string }) => x.world === world && x.source === source && x.seed === seed;
  const runEntries = data.chronicle.filter(here);
  const runMoments = shelf.filter(here);
  const recent = [...shelf].reverse().slice(0, 12);
  const firstMoment = (type: string) => shelf.find((m) => m.world === world && m.kind === 'first' && m.type === type);
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
      {world && (
        <section className="demo-section">
          <div className="demo-section-head">
            <h3 className="demo-h">This seed&apos;s history</h3>
            <span className="demo-count">{runEntries.length ? `${runEntries.length} events` : 'nothing yet'}</span>
          </div>
          <Ribbon entries={runEntries} moments={runMoments} now={now} onOpen={onOpenMoment} />
        </section>
      )}

      <section className="demo-section">
        <div className="demo-section-head">
          <h3 className="demo-h">Moments</h3>
          {shelf.length > 0 && <span className="demo-count">{shelf.length} kept</span>}
        </div>
        {recent.length ? (
          <ul className="demo-moments">
            {recent.map((m) => (
              <MomentThumb key={m.id} moment={m} moments={moments} isNew={fresh.has(m.id) || !m.seen} worldName={worldName} onOpen={onOpenMoment} />
            ))}
          </ul>
        ) : (
          <p className="demo-hint">The first time something uncommon happens in a world, the journal keeps a picture and a two-second clip of it. Press K to keep one yourself.</p>
        )}
      </section>

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
                const m = got && firstMoment(x.type);
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
                        {m ? (
                          <button type="button" className="demo-link" onClick={() => onOpenMoment(m)} title="The picture and clip from the first time">
                            Moment
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="demo-link"
                            onClick={() => onReplay(world, got)}
                            title={`First seen ${fmtDate(got.first)}, ${clock(got.t)} into seed ${got.seed}. Replays that seed to just before. A replay comes close, not always to the same thing.`}
                          >
                            Replay
                          </button>
                        )}
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
          <input type="checkbox" checked={data.prefs.moments} onChange={(e) => journal.setPref('moments', e.target.checked)} />
          <span>
            Keep moments
            <small>A picture and a short clip of each first sighting, kept in this browser.</small>
          </span>
        </label>
        <button
          type="button"
          className="demo-link demo-danger"
          onClick={() => {
            if (window.confirm('Forget every sighting, the whole chronicle, and every moment?')) {
              journal.reset();
              moments.clear();
            }
          }}
        >
          Forget everything
        </button>
      </section>
    </>
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
