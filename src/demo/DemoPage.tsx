import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Background, type MountHandle, type TransitionKind } from '../react-entry';
import {
  COLOR_TOKENS,
  DETAIL_OPTIONS,
  PALETTE_OPTIONS,
  builtInSkins,
  getLayer,
  getSkin,
  HARMONIES,
  listLayers,
  loadPresetManifest,
  paletteFromTokens,
  paletteToTokens,
  presets,
  probeContrast,
  randomSeedString,
  registerPresetManifest,
  resolvePalette,
  schemaDefaults,
  validatePresetManifest,
  type Harmony,
  type PresetSkin,
  type ContrastReport,
  type FieldSchema,
  type LabelDensity,
  type MotionPreference,
  type PaletteId,
  type PaletteSpec,
  type Scene,
  type SceneLayer,
  type Schema,
  voidSectorPreset,
} from '../engine';
import { History, download, exportImage, exportVideo, videoExt, type ExportOptions } from './studio-tools';
import { getUniverse, listUniverses, universePrompt, validateUniverse, type UniversePack } from '../engine/skins/void-tactical/universe';
// The studio shows every universe, so it loads them all up front.
import '../engine/skins/void-tactical/packs';
import '../engine/skins/void-tactical/mechanics/all';
import { listMechanics, type MechanicRef } from '../engine/skins/void-tactical/mechanics';
import { instrumentSkins } from '../engine/skins/instruments';
import { aiPrompt, compactConfig } from './ai-prompt';
import { Icon } from './icons';
import { HappeningNow, JournalTab, MomentViewer, WelcomeBack, keepMoment, useJournal, useJournalData, useMomentList, useMoments, useWitness, type Away, type FeedItem } from './journal-ui';
import type { Moment } from './moments';
import { SIGHTS, clock, type Sighting } from './witness';
import { offlineWallpaperHtml, wallpaperEngineProject, zip } from './wallpaper-files';
import { wallpaperQuery, type WallpaperSettings } from '../wallpaper/codec';
import './DemoPage.css';

/** `?debug` in the URL shows the debug panel: skip ahead, counts, the event log. */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/** Skins that report events and have a sound palette under their own id. */
const SOUND_SKINS = new Set(['undercity', 'shieldwall', 'ages', 'war-table', 'wyrmspire', 'deephold', 'leylines', 'silent-running', 'petri', 'sonar', 'atc-radar', 'seismograph', 'abyssal', 'mars-radar']);

/**
 * A world you can pick from a card: a sector map universe, Undercity, a fantasy world (or
 * one of its views), or an instrument. `options` are set on top of the skin's defaults.
 */
type WorldCard = { key: string; source: string; universe?: string; options?: Record<string, unknown>; name: string; tagline?: string; thumb: string };

const WORLD_CARDS: WorldCard[] = [
  ...listUniverses().map((u) => ({ key: `vt-${u.id}`, source: 'void-tactical', universe: u.id, name: u.name, tagline: u.tagline, thumb: u.id === 'void' ? 'void-tactical' : `void-tactical-${u.id}` })),
  { key: 'undercity', source: 'undercity', name: getSkin('undercity')?.label ?? 'Undercity', tagline: getSkin('undercity')?.description, thumb: 'undercity' },
  { key: 'shieldwall', source: 'shieldwall', name: 'Shieldwall', tagline: getSkin('shieldwall')?.description, thumb: 'shieldwall' },
  { key: 'shieldwall-above', source: 'shieldwall', options: { view: 'above' }, name: 'Shieldwall, from above', tagline: 'The same wars as a map at dusk: woods, a village, the ford, and the armies in blocks.', thumb: 'shieldwall-view-above' },
  { key: 'shieldwall-siege', source: 'shieldwall', options: { battles: 'siege' }, name: 'Shieldwall, a siege', tagline: 'Towers and a ram at a walled town; ladders, breaches, the gate, and the defenders holding each gap.', thumb: 'shieldwall-battles-siege' },
  { key: 'ages', source: 'ages', name: 'Ages', tagline: getSkin('ages')?.description, thumb: 'ages' },
  { key: 'war-table', source: 'war-table', name: 'War table', tagline: getSkin('war-table')?.description, thumb: 'war-table' },
  { key: 'wyrmspire', source: 'wyrmspire', name: 'Wyrmspire', tagline: getSkin('wyrmspire')?.description, thumb: 'wyrmspire' },
  { key: 'deephold', source: 'deephold', name: 'Deephold', tagline: getSkin('deephold')?.description, thumb: 'deephold' },
  { key: 'leylines', source: 'leylines', name: 'Leylines', tagline: getSkin('leylines')?.description, thumb: 'leylines' },
  { key: 'silent-running', source: 'silent-running', name: 'Silent Running', tagline: getSkin('silent-running')?.description, thumb: 'silent-running' },
];
const INSTRUMENT_CARDS: WorldCard[] = [
  ...instrumentSkins.map((s) => ({ key: s.id, source: s.id, name: s.label ?? s.id, tagline: s.description, thumb: s.id })),
  { key: 'petri', source: 'petri', name: 'Petri dish', tagline: getSkin('petri')?.description, thumb: 'petri' },
  { key: 'petri-lenia', source: 'petri', options: { medium: 'lenia' }, name: 'Petri, a Lenia culture', tagline: 'Orbium, the glider, in a continuous culture: they glide, meet, break apart, overgrow, and are diluted.', thumb: 'petri-medium-lenia' },
];
const ALL_CARDS = [...WORLD_CARDS, ...INSTRUMENT_CARDS];

/** A journal world id (a universe, Undercity, an instrument) as its card. */
const cardForWorld = (world: string) => ALL_CARDS.find((c) => (c.universe ?? c.source) === world);
const worldName = (world: string) => cardForWorld(world)?.name ?? world;

type Tab = 'world' | 'look' | 'journal' | 'share';
const TABS: [Tab, string][] = [
  ['world', 'World'],
  ['look', 'Look'],
  ['journal', 'Journal'],
  ['share', 'Share'],
];
const SPEEDS = [1, 4, 16] as const;

/** Phone frame: 390 × 844 CSS pixels (a common modern phone), rendered at 3x. */
const PHONE = { width: 390, height: 844, pixelRatio: 3 };

const SHORTCUTS: [string, string][] = [
  ['S', 'New seed'],
  ['Space', 'Pause or play'],
  ['← →', 'Previous or next world'],
  ['1 2 3', 'Speed ×1, ×4, ×16'],
  ['M', 'Sound on or off'],
  ['J', 'Journal'],
  ['K', 'Keep this moment (a picture and a clip)'],
  ['Click', 'Nudge the world (Wyrmspire, Deephold, Leylines)'],
  ['G', 'Gallery'],
  ['H', 'Hide or show the studio'],
  ['Ctrl Z', 'Undo (Shift for redo)'],
  ['?', 'This list'],
  ['A', 'About Vivarium'],
];

const REPO = 'https://github.com/imperorrp/aesthetic-backgrounds-library';
const ABOUT_SEEN = 'vivarium.about-seen';

type PaletteMode = PaletteId | 'custom';

/** Bump when the hash format changes; older links still decode with defaults filled in. */
const STATE_VERSION = 2;

type Studio = {
  /** Preset id, skin id, or `scene` for a blank custom scene. */
  source: string;
  scene: Scene | null;
  skinOptions: Record<string, unknown>;
  seed: string;
  paletteMode: PaletteMode;
  customHex: string;
  theme: 'dark' | 'light';
  harmony: Harmony;
  intensity: number;
  motion: MotionPreference;
  density: number;
  detail: LabelDensity;
  /** null = seeded by the engine. */
  lightAngle: number | null;
  warmth: number;
  legibility: 'auto' | 'off';
};

const BLENDS: GlobalCompositeOperation[] = ['source-over', 'lighter', 'screen', 'multiply', 'overlay', 'soft-light'];

/**
 * Community presets are plain JSON in registry/community. Dropping a valid file
 * there makes it appear here with no code change; invalid files are reported and
 * skipped (CI rejects them before they land).
 */
const communityFiles = import.meta.glob('../../registry/community/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const communityPresets: PresetSkin[] = Object.entries(communityFiles).flatMap(([path, json]) => {
  const result = validatePresetManifest(json);
  if (!result.ok) {
    console.warn(`[studio] skipped ${path}:\n  ${result.errors.join('\n  ')}`);
    return [];
  }
  return [registerPresetManifest(json)];
});

/** Curated presets, the void-sector preset that lives with its skin, then community presets. */
const allPresets: PresetSkin[] = [voidSectorPreset, ...presets, ...communityPresets];
const presetIds = new Set(allPresets.map((p) => p.id));
const isSceneSource = (source: string) => source === 'scene' || presetIds.has(source);

/**
 * Studio state for a source. Seed, motion, density, and detail carry over from the
 * previous state; palette and intensity come from the source's own defaults so a
 * light preset never bleeds into a dark skin.
 */
function studioFor(source: string, prev?: Partial<Studio>): Studio {
  const base: Studio = {
    source,
    scene: null,
    skinOptions: {},
    seed: prev?.seed ?? randomSeedString(),
    paletteMode: 'void-cyan',
    customHex: '#4f6df5',
    theme: 'dark',
    harmony: 'analogous',
    intensity: 1,
    motion: prev?.motion ?? 'auto',
    density: prev?.density ?? 1,
    detail: prev?.detail ?? 'low',
    lightAngle: null,
    warmth: 0,
    legibility: prev?.legibility ?? 'auto',
  };
  const applyDefaults = (d: { palette?: PaletteSpec; intensity?: number; density?: number; detail?: LabelDensity; light?: { angle?: number; warmth?: number } } | undefined) => {
    if (!d) return;
    if (typeof d.palette === 'string') {
      base.paletteMode = d.palette as PaletteId;
    } else if (d.palette && typeof d.palette === 'object' && 'from' in d.palette) {
      base.paletteMode = 'custom';
      base.customHex = d.palette.from;
      base.theme = d.palette.theme ?? 'dark';
      base.harmony = d.palette.harmony ?? 'analogous';
    }
    if (typeof d.intensity === 'number') base.intensity = d.intensity;
    if (typeof d.density === 'number') base.density = d.density;
    if (d.detail) base.detail = d.detail;
    if (d.light?.angle !== undefined) base.lightAngle = d.light.angle;
    if (d.light?.warmth !== undefined) base.warmth = d.light.warmth;
  };
  const preset = allPresets.find((p) => p.id === source);
  if (preset) {
    base.scene = JSON.parse(JSON.stringify(preset.scene)) as Scene;
    applyDefaults(preset.defaults);
    return base;
  }
  if (source === 'scene') {
    base.scene = { layers: [{ use: 'gradient-base' }, { use: 'vignette' }] };
    return base;
  }
  const skin = getSkin(source);
  base.skinOptions = skin?.schema ? schemaDefaults(skin.schema) : {};
  applyDefaults(skin?.defaults);
  return base;
}

function encodeState(s: Studio): string {
  const json = JSON.stringify({ v: STATE_VERSION, ...s });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(hash: string): Studio | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const { v: _version, ...parsed } = JSON.parse(json) as Studio & { v?: number };
    if (!parsed || typeof parsed.source !== 'string') return null;
    // Links from older versions lack newer fields; the source's defaults fill them.
    return { ...studioFor(parsed.source), ...parsed };
  } catch {
    return null;
  }
}

function paletteOf(s: Studio): PaletteSpec {
  return s.paletteMode === 'custom' ? { from: s.customHex, theme: s.theme, harmony: s.harmony } : s.paletteMode;
}

export default function DemoPage() {
  const [studio, setStudio] = useState<Studio>(() => {
    if (typeof window === 'undefined') return studioFor('void-tactical');
    // Readable links (?bg=…&seed=…&u=…) work on their own; the hash, when present,
    // restores every other setting.
    const q = new URLSearchParams(window.location.search);
    const bg = q.get('bg');
    const fromHash = decodeState(window.location.hash);
    const base = fromHash ?? studioFor(bg && (getSkin(bg) || presetIds.has(bg)) ? bg : 'void-tactical');
    const seed = q.get('seed');
    if (seed) base.seed = seed;
    const u = q.get('u');
    if (u && base.source === 'void-tactical' && !fromHash) {
      const pack = listUniverses().find((p) => p.id === u);
      if (pack) {
        base.skinOptions = { ...base.skinOptions, universe: u };
        if (pack.palette) Object.assign(base, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
        if (typeof pack.warmth === 'number') base.warmth = pack.warmth;
      }
    }
    return base;
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [seedDraft, setSeedDraft] = useState(studio.seed);
  const [copied, setCopied] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [report, setReport] = useState<ContrastReport | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const historyRef = useRef(new History<Studio>());
  const history = historyRef.current;
  const [handle, setHandle] = useState<MountHandle | null>(null);
  const [showComposition, setShowComposition] = useState(false);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>('iris');
  const [soundOn, setSoundOn] = useState(false);
  const [soundVolume, setSoundVolume] = useState(0.6);
  // Skins with a sound palette of their own use it; the sector map uses its universe's.
  const soundUniverse = SOUND_SKINS.has(studio.source) ? studio.source : typeof studio.skinOptions.universe === 'string' ? studio.skinOptions.universe : 'void';
  useSoundscape(handle, soundOn, soundVolume, soundUniverse);

  const [tab, setTab] = useState<Tab>('world');
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo(0, 0);
  }, [tab]);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  // The About card opens by itself on a first visit, once.
  const [aboutOpen, setAboutOpen] = useState(() => {
    try {
      return !localStorage.getItem(ABOUT_SEEN);
    } catch {
      return false;
    }
  });
  const closeAbout = useCallback(() => {
    setAboutOpen(false);
    try {
      localStorage.setItem(ABOUT_SEEN, '1');
    } catch {
      // Private mode: it opens again next time, which is fine.
    }
  }, []);
  useEffect(() => {
    if (!handle) return;
    if (paused) handle.pause();
    else handle.resume();
  }, [handle, paused]);
  useEffect(() => {
    handle?.setTimeScale(speed);
  }, [handle, speed]);

  // ---- the journal: sightings, the chronicle, what is happening now ----------------------
  const journal = useJournal();
  const journalData = useJournalData(journal);
  const activeUniverse = typeof studio.skinOptions.universe === 'string' ? studio.skinOptions.universe : 'void';
  /** The journal's id for what is on screen; null for backgrounds that keep none (presets, custom packs). */
  const world = studio.source === 'void-tactical' ? (studio.skinOptions.pack ? null : activeUniverse) : SIGHTS[studio.source] ? studio.source : null;
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const moments = useMoments();
  const momentList = useMomentList(moments);
  const unseenMoments = momentList.filter((m) => !m.seen).length;
  const [away, setAway] = useState<Away | null>(null);
  const [viewing, setViewing] = useState<Moment | null>(null);
  const [keptNote, setKeptNote] = useState<string | null>(null);
  const pushFeed = useCallback((item: FeedItem) => setFeed((f) => [item, ...f].slice(0, 6)), []);
  const clockRef = useWitness({ handle, journal, moments, world, source: studio.source, seed: studio.seed, speed, onFeed: pushFeed, onAway: setAway });
  /** K: keep what is on screen now. */
  const keepNow = () => {
    if (!handle) return;
    const t = clockRef.current;
    setKeptNote('Keeping this moment…');
    void keepMoment(handle, moments, { world: world ?? studio.source, source: studio.source, seed: studio.seed, t, kind: 'kept', name: `${title} at ${clock(t)}` }, { clip: true, seen: true }).then((m) => {
      setKeptNote(m ? 'Kept. It is in the journal.' : 'This background cannot be pictured.');
      window.setTimeout(() => setKeptNote(null), 1800);
    });
  };
  useEffect(() => {
    setFeed([]);
  }, [handle]);

  // A remount key, so "revisit" can restart the same world and seed from the beginning.
  const [mountNonce, setMountNonce] = useState(0);
  /** Seconds to skip once the next mount is ready (revisits and `?t=` links). */
  const pendingSkip = useRef<number>(Math.max(0, Number(new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('t')) || 0));
  const [skipNote, setSkipNote] = useState<string | null>(null);
  useEffect(() => {
    const skip = Math.min(1800, pendingSkip.current);
    if (!handle || skip < 2) return;
    setSkipNote(`Skipping ahead to ${clock(skip)}…`);
    // Let the note paint before the sim runs flat out.
    const id = window.setTimeout(() => {
      pendingSkip.current = 0;
      handle.fastForward(skip);
      setSkipNote(null);
    }, 60);
    return () => window.clearTimeout(id);
  }, [handle]);
  const renderedSource = useRef(studio.source);
  const sourceChanged = renderedSource.current !== studio.source;
  useEffect(() => {
    renderedSource.current = studio.source;
  });

  // Live legibility readout: sample the canvas behind the sample column once a second.
  useEffect(() => {
    if (!showContent) {
      setReport(null);
      return;
    }
    const tick = () => {
      const canvas = document.querySelector<HTMLCanvasElement>('.bg-engine-root canvas');
      const column = document.getElementById('demo-content');
      if (!canvas || !column || !canvas.width) return;
      const r = column.getBoundingClientRect();
      const dpr = canvas.width / Math.max(1, canvas.clientWidth);
      try {
        setReport(
          probeContrast(canvas, { x: r.left * dpr, y: r.top * dpr, width: r.width * dpr, height: r.height * dpr }, resolvePalette(paletteOf(studio)).ink, {
            stride: 4,
          }),
        );
      } catch {
        /* canvas not ready */
      }
    };
    // First sample after the new mount has drawn a few frames, then once a second.
    const first = window.setTimeout(tick, 500);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [showContent, studio]);

  // The URL always says what you are looking at: ?bg=void-tactical&seed=orion-harbor-23.
  // Anything changed beyond the defaults rides along in the hash.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('bg', studio.source);
    url.searchParams.set('seed', studio.seed);
    const universe = typeof studio.skinOptions.universe === 'string' ? studio.skinOptions.universe : undefined;
    if (universe && universe !== 'void') url.searchParams.set('u', universe);
    const plain = studioFor(studio.source, studio);
    if (universe) {
      plain.skinOptions = { ...plain.skinOptions, universe };
      const pack = listUniverses().find((p) => p.id === universe);
      if (pack?.palette) Object.assign(plain, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
      if (typeof pack?.warmth === 'number') plain.warmth = pack.warmth;
    }
    const strip = (s: Studio) => JSON.stringify({ ...s, seed: '', source: '' });
    url.hash = strip(plain) === strip(studio) ? '' : `s=${encodeState(studio)}`;
    window.history.replaceState(null, '', url.toString());
  }, [studio]);

  // History is mutated here, never inside a state updater: React re-invokes updaters
  // (StrictMode runs them twice in development), which would corrupt the stacks.
  const studioRef = useRef(studio);
  studioRef.current = studio;

  const commit = (next: (s: Studio) => Studio) => {
    const current = studioRef.current;
    const out = next(current);
    if (out === current) return;
    history.push(current);
    studioRef.current = out;
    setStudio(out);
  };
  const update = (patch: Partial<Studio>) => commit((s) => ({ ...s, ...patch }));
  const setScene = (fn: (scene: Scene) => Scene) => commit((s) => (s.scene ? { ...s, scene: fn(s.scene) } : s));

  const undo = () => {
    const out = history.undo(studioRef.current);
    if (!out) return;
    studioRef.current = out;
    setStudio(out);
    setSeedDraft(out.seed);
  };
  const redo = () => {
    const out = history.redo(studioRef.current);
    if (!out) return;
    studioRef.current = out;
    setStudio(out);
    setSeedDraft(out.seed);
  };

  // Shortcuts read the latest handlers through a ref (assigned once they exist, below).
  const keys = useRef<Record<string, () => void>>({});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable);
      if (typing) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
        }
        return;
      }
      if (e.altKey) return;
      const name = e.key === ' ' ? 'space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const run = keys.current[name];
      if (!run) return;
      // Space on a focused button should press the button, not pause.
      if (name === 'space' && e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sceneMode = isSceneSource(studio.source);
  const skin = sceneMode ? null : getSkin(studio.source);
  const palette = paletteOf(studio);

  const exportConfig = useMemo(() => {
    const cfg: Record<string, unknown> = {
      skin: sceneMode ? 'scene' : studio.source,
      seed: studio.seed,
      palette,
      intensity: studio.intensity,
    };
    if (studio.motion !== 'auto') cfg.motion = studio.motion;
    if (studio.lightAngle !== null || studio.warmth !== 0) cfg.light = { ...(studio.lightAngle !== null ? { angle: studio.lightAngle } : {}), ...(studio.warmth ? { warmth: studio.warmth } : {}) };
    if (studio.legibility === 'off') cfg.legibility = 'off';
    if (sceneMode) cfg.options = studio.scene;
    else {
      if (Object.keys(studio.skinOptions).length) cfg.options = studio.skinOptions;
      cfg.density = studio.density;
      if (studio.source === 'void-tactical') cfg.detail = studio.detail;
    }
    return cfg;
  }, [studio, sceneMode, palette]);

  const snippet = `import { mount } from 'space-background-engine';\n\nmount(document.body, ${JSON.stringify(exportConfig, null, 2)});`;
  const sourceLabel = (() => {
    const base = allPresets.find((p) => p.id === studio.source)?.label ?? getSkin(studio.source)?.label ?? studio.source;
    const pack = studio.skinOptions.pack as UniversePack | undefined;
    const uni = pack?.name ?? listUniverses().find((u) => u.id === studio.skinOptions.universe)?.name;
    return studio.source === 'void-tactical' && uni ? `${base} · ${uni}` : base;
  })();

  /** The prompt for an AI: the shortest configuration that reproduces this exactly. */
  const promptText = () => {
    const sk = getSkin(studio.source);
    const preset = allPresets.find((p) => p.id === studio.source);
    const pack = studio.skinOptions.pack as UniversePack | undefined;
    let cfg: Record<string, unknown>;
    if (preset && JSON.stringify(preset.scene) === JSON.stringify(studio.scene)) {
      cfg = { ...exportConfig, skin: preset.id, options: undefined };
    } else if (pack) {
      cfg = { ...exportConfig, options: { ...(exportConfig.options as Record<string, unknown>), pack: '__PACK__' } };
    } else {
      cfg = exportConfig;
    }
    const defaults: Record<string, unknown> = {
      palette: (preset?.defaults ?? sk?.defaults)?.palette ?? 'void-cyan',
      intensity: (preset?.defaults ?? sk?.defaults)?.intensity ?? 1,
      density: (sk?.defaults as { density?: number } | undefined)?.density ?? 1,
      detail: (sk?.defaults as { detail?: string } | undefined)?.detail ?? 'low',
    };
    const optionDefaults = sk?.schema ? schemaDefaults(sk.schema) : {};
    return aiPrompt(compactConfig(cfg, defaults, optionDefaults), !!pack).replace('"__PACK__"', 'universe');
  };

  const saveUniverse = () => {
    const pack = studio.skinOptions.pack as UniversePack | undefined;
    if (pack) download(new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }), 'universe.json');
  };

  /** Copy text and flash which button did it. */
  const copy = async (what: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  const exportArgs = (): ExportOptions => ({
    skin: sceneMode ? 'scene' : studio.source,
    scene: sceneMode ? studio.scene : null,
    seed: studio.seed,
    palette,
    intensity: studio.intensity,
    density: sceneMode ? undefined : studio.density,
    detail: sceneMode ? undefined : studio.detail,
    options: sceneMode ? undefined : studio.skinOptions,
    light: studio.lightAngle !== null ? { angle: studio.lightAngle, warmth: studio.warmth } : { warmth: studio.warmth },
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const [busy, setBusy] = useState<string | null>(null);

  const saveImage = async (type: 'image/png' | 'image/webp') => {
    setBusy(type === 'image/png' ? 'PNG…' : 'WebP…');
    try {
      const blob = await exportImage(exportArgs(), 240, type);
      download(blob, `${studio.source}-${studio.seed}.${type === 'image/png' ? 'png' : 'webp'}`);
    } finally {
      setBusy(null);
    }
  };

  const saveVideo = async () => {
    setBusy('Recording 0%');
    try {
      const blob = await exportVideo(exportArgs(), {
        seconds: 8,
        fps: 30,
        onProgress: (p) => setBusy(`Recording ${Math.round(p * 100)}%`),
      });
      download(blob, `${studio.source}-${studio.seed}.${videoExt(blob.type)}`);
    } catch (err) {
      setBusy(null);
      alert(err instanceof Error ? err.message : 'Recording failed');
      return;
    } finally {
      setBusy(null);
    }
  };

  // `?preset=<url>` loads a third-party manifest, registers it, and selects it.
  const [remoteNote, setRemoteNote] = useState<string | null>(null);
  useEffect(() => {
    const url = new URLSearchParams(window.location.search).get('preset');
    if (!url) return;
    loadPresetManifest(url)
      .then((skin) => {
        if (!presetIds.has(skin.id)) {
          allPresets.push(skin);
          presetIds.add(skin.id);
        }
        const next = studioFor(skin.id, studioRef.current);
        commit(() => next);
        setSeedDraft(next.seed);
        setRemoteNote(`Loaded "${skin.label}" from ${new URL(url, window.location.href).host}`);
      })
      .catch((err) => setRemoteNote(err instanceof Error ? err.message : 'Could not load that preset'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** DTCG tokens for Figma Variables, Tokens Studio, or Style Dictionary. */
  const saveTokens = () => {
    const tokens = paletteToTokens(resolvePalette(palette));
    download(new Blob([JSON.stringify(tokens, null, 2)], { type: 'application/json' }), `palette-${studio.paletteMode === 'custom' ? studio.customHex.slice(1) : studio.paletteMode}.tokens.json`);
  };

  /** Read a brand token file and derive the palette from it. */
  const loadTokens = async (file: File) => {
    try {
      const spec = paletteFromTokens(JSON.parse(await file.text()));
      if (typeof spec === 'object' && 'from' in spec) {
        update({ paletteMode: 'custom', customHex: spec.from, theme: spec.theme ?? 'dark' });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That file has no usable brand color.');
    }
  };

  const saveJson = () => {
    download(new Blob([JSON.stringify(exportConfig, null, 2)], { type: 'application/json' }), `${studio.source}-${studio.seed}.json`);
  };

  const loadJson = async (file: File) => {
    try {
      const cfg = JSON.parse(await file.text()) as Record<string, unknown>;
      const src = typeof cfg.skin === 'string' ? cfg.skin : 'scene';
      const next = studioFor(presetIds.has(src) || getSkin(src) ? src : 'scene', studio);
      if (cfg.options && typeof cfg.options === 'object' && 'layers' in (cfg.options as object)) next.scene = cfg.options as Scene;
      else if (cfg.options) next.skinOptions = cfg.options as Record<string, unknown>;
      if (typeof cfg.seed === 'string') next.seed = cfg.seed;
      if (typeof cfg.intensity === 'number') next.intensity = cfg.intensity;
      if (typeof cfg.palette === 'string') next.paletteMode = cfg.palette as PaletteMode;
      else if (cfg.palette && typeof cfg.palette === 'object' && 'from' in (cfg.palette as object)) {
        const p = cfg.palette as { from: string; theme?: 'dark' | 'light' };
        next.paletteMode = 'custom';
        next.customHex = p.from;
        next.theme = p.theme ?? 'dark';
      }
      commit(() => next);
      setSeedDraft(next.seed);
    } catch {
      alert('That file is not a background preset.');
    }
  };

  // ---- universes (void-tactical) -------------------------------------------------------
  const [subject, setSubject] = useState('');
  const [pasted, setPasted] = useState('');
  const [packNote, setPackNote] = useState<{ ok: boolean; text: string } | null>(null);
  const activePack = studio.skinOptions.pack as UniversePack | undefined;

  const applyPack = (pack: UniversePack, note: string) => {
    const { pack: _old, ...rest } = studio.skinOptions;
    const patch: Partial<Studio> = { skinOptions: { ...rest, universe: undefined, pack } };
    if (pack.palette && /^#[0-9a-f]{3,6}$/i.test(pack.palette)) Object.assign(patch, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
    if (typeof pack.warmth === 'number') patch.warmth = pack.warmth;
    update(patch);
    setPackNote({ ok: true, text: note });
  };
  const applyPasted = () => {
    const { pack, errors, warnings } = validateUniverse(pasted);
    if (errors.length) {
      setPackNote({ ok: false, text: errors.join(' ') });
      return;
    }
    applyPack(pack, warnings.length ? `Loaded "${pack.name}". ${warnings.length} gap${warnings.length > 1 ? 's' : ''} filled: ${warnings.slice(0, 2).join(' ')}` : `Loaded "${pack.name}".`);
  };
  const applySeed = (next: string) => {
    const value = next.trim() || randomSeedString();
    setSeedDraft(value);
    update({ seed: value });
  };

  /** Switch to a source (and universe, for the sector map; or options, for a view), keeping the seed unless given one. */
  const goTo = (source: string, universe?: string, seed?: string, options?: Record<string, unknown>) => {
    const next = studioFor(source, studioRef.current);
    if (universe) {
      const pack = listUniverses().find((u) => u.id === universe);
      next.skinOptions = { ...next.skinOptions, universe };
      if (pack?.palette) Object.assign(next, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
      if (typeof pack?.warmth === 'number') next.warmth = pack.warmth;
    }
    if (options) next.skinOptions = { ...next.skinOptions, ...options };
    if (seed) next.seed = seed;
    commit(() => next);
    setSeedDraft(next.seed);
    setPackNote(null);
  };
  const goToCard = (c: WorldCard, seed?: string) => goTo(c.source, c.universe, seed, c.options);

  /** The card for what is on screen: the one whose options all match, the most specific first. */
  const currentCard =
    studio.source === 'void-tactical'
      ? activePack
        ? null
        : `vt-${activeUniverse}`
      : ALL_CARDS.filter((c) => c.source === studio.source && Object.entries(c.options ?? {}).every(([k, v]) => studio.skinOptions[k] === v)).sort(
          (a, b) => Object.keys(b.options ?? {}).length - Object.keys(a.options ?? {}).length,
        )[0]?.key ?? studio.source;
  const cycleWorld = (dir: 1 | -1) => {
    const i = ALL_CARDS.findIndex((c) => c.key === currentCard);
    goToCard(ALL_CARDS[(i + dir + ALL_CARDS.length) % ALL_CARDS.length]);
  };

  /** A sighting with no picture: replay its world and seed from the start, to just before it. */
  const replay = (w: string, s: Sighting) => {
    const card = cardForWorld(w);
    if (!card) return;
    pendingSkip.current = Math.max(0, s.t - 6);
    setMountNonce((n) => n + 1);
    goToCard(card, s.seed);
  };

  keys.current = {
    s: () => applySeed(randomSeedString()),
    space: () => setPaused((p) => !p),
    ArrowRight: () => cycleWorld(1),
    ArrowLeft: () => cycleWorld(-1),
    '1': () => setSpeed(1),
    '2': () => setSpeed(4),
    '3': () => setSpeed(16),
    m: () => setSoundOn((on) => !on),
    h: () => setPanelOpen((o) => !o),
    j: () => {
      setPanelOpen(true);
      setTab('journal');
    },
    g: () => setGalleryOpen((o) => !o),
    '?': () => setShortcutsOpen((o) => !o),
    k: () => keepNow(),
    a: () => setAboutOpen((o) => !o),
    '/': () => setShortcutsOpen((o) => !o),
    Escape: () => {
      setGalleryOpen(false);
      setShortcutsOpen(false);
      closeAbout();
      setAway(null);
      setViewing(null);
    },
  };

  // ---- wallpapers ----------------------------------------------------------------------------
  /** The mount() config with options at their defaults left out (the link stays short). */
  const wallpaperSettings = (): WallpaperSettings => {
    const sk = sceneMode ? null : getSkin(studio.source);
    return { config: sk?.schema ? compactConfig(exportConfig, {}, schemaDefaults(sk.schema)) : exportConfig, fps: 30 };
  };
  const wallpaperUrl = (extra = '') => new URL(`wallpaper.html?${wallpaperQuery(wallpaperSettings())}${extra}`, document.baseURI).href;
  const fileStem = `${studio.source === 'void-tactical' ? activePack?.name ?? activeUniverse : studio.source}-${studio.seed}`.replace(/[^\w.-]+/g, '-').toLowerCase();

  /** The engine as one script, for files that run with no server. */
  const fetchRuntime = async () => {
    const r = await fetch(new URL('wallpaper-runtime.js', document.baseURI));
    if (!r.ok) throw new Error('The wallpaper runtime is missing from this build. Run `pnpm build`, or use the link instead.');
    return r.text();
  };

  const saveOfflineWallpaper = async () => {
    setBusy('Packing the wallpaper…');
    try {
      const html = offlineWallpaperHtml(wallpaperSettings(), await fetchRuntime(), sourceLabel);
      download(new Blob([html], { type: 'text/html' }), `${fileStem}.html`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not build the file');
    } finally {
      setBusy(null);
    }
  };

  const saveWallpaperEngine = async () => {
    setBusy('Packing for Wallpaper Engine…');
    try {
      const [runtime, preview] = await Promise.all([fetchRuntime(), exportImage({ ...exportArgs(), width: 640, height: 360 }, 240, 'image/jpeg')]);
      const html = offlineWallpaperHtml(wallpaperSettings(), runtime, sourceLabel);
      const bytes = zip([
        { name: 'index.html', data: html },
        { name: 'project.json', data: wallpaperEngineProject(sourceLabel, `A living background. Seed ${studio.seed}. Made with Vivarium.`) },
        { name: 'preview.jpg', data: new Uint8Array(await preview.arrayBuffer()) },
      ]);
      download(new Blob([bytes], { type: 'application/zip' }), `${fileStem}-wallpaper-engine.zip`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not build the package');
    } finally {
      setBusy(null);
    }
  };

  /** A still at the screen's own resolution. */
  const saveDesktopStill = async () => {
    setBusy('Rendering…');
    try {
      const pr = Math.min(3, window.devicePixelRatio || 1);
      const w = window.screen?.width || window.innerWidth;
      const h = window.screen?.height || window.innerHeight;
      download(await exportImage({ ...exportArgs(), width: w, height: h, pixelRatio: pr }), `${fileStem}-${Math.round(w * pr)}x${Math.round(h * pr)}.png`);
    } finally {
      setBusy(null);
    }
  };

  const savePhoneStill = async () => {
    setBusy('Rendering for your phone…');
    try {
      download(await exportImage({ ...exportArgs(), ...PHONE }), `${fileStem}-phone.png`);
    } finally {
      setBusy(null);
    }
  };

  /** A portrait loop for live-wallpaper apps. 2.5x keeps the encoder within what phones play. */
  const savePhoneVideo = async () => {
    setBusy('Recording 0%');
    try {
      const blob = await exportVideo({ ...exportArgs(), width: 392, height: 848, pixelRatio: 2.5 }, { seconds: 10, fps: 30, onProgress: (p) => setBusy(`Recording ${Math.round(p * 100)}%`) });
      download(blob, `${fileStem}-phone.${videoExt(blob.type)}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Recording failed');
    } finally {
      setBusy(null);
    }
  };

  /** A universe goes by its own name; everything else by its label. */
  const title = studio.source === 'void-tactical' ? activePack?.name ?? worldName(activeUniverse) : sourceLabel;
  const description =
    activePack?.tagline ??
    (studio.source === 'void-tactical' ? listUniverses().find((u) => u.id === activeUniverse)?.tagline : undefined) ??
    allPresets.find((p) => p.id === studio.source)?.description ??
    getSkin(studio.source)?.description;
  const universeMechanics = (activePack ?? getUniverse(activeUniverse))?.mechanics ?? [];
  const mechanicRefs = Array.isArray(studio.skinOptions.mechanics) ? (studio.skinOptions.mechanics as MechanicRef[]) : universeMechanics;
  const onCardSource = ALL_CARDS.some((c) => c.source === studio.source);
  const openJournal = () => {
    setPanelOpen(true);
    setTab('journal');
  };

  const worldCard = (c: WorldCard) => {
    const w = c.universe ?? c.source;
    const p = journal.progress(w);
    const active = c.key === currentCard;
    return (
      <button key={c.key} type="button" className={`demo-world${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => goToCard(c)} title={c.tagline}>
        <img src={`thumbs/${c.thumb}.jpg`} alt="" loading="lazy" />
        <span className="demo-world-name">{c.name}</span>
        {p.seen > 0 && (
          <span className="demo-world-seen" title={`${p.seen} of ${p.total} sightings`}>
            {p.seen}/{p.total}
          </span>
        )}
      </button>
    );
  };

  return (
    // The root itself is the empty backdrop: a click there (not on the panel) nudges the world.
    <div className="demo-root" data-bg-backdrop="">
      <Background
        key={mountNonce}
        skin={sceneMode ? 'scene' : studio.source}
        options={sceneMode ? studio.scene ?? { layers: [] } : studio.skinOptions}
        seed={studio.seed}
        palette={palette}
        intensity={studio.intensity}
        motion={studio.motion}
        density={studio.density}
        detail={studio.detail}
        light={studio.lightAngle !== null ? { angle: studio.lightAngle, warmth: studio.warmth } : { warmth: studio.warmth }}
        legibility={studio.legibility}
        adaptiveQuality
        nudges
        pauseWhenHidden={false}
        // Switching source dissolves into the new scene; option tweaks remount instantly.
        transition={sourceChanged ? { duration: 0.9, kind: transitionKind } : undefined}
        onReady={setHandle}
      />

      {showComposition && handle && <CompositionOverlay handle={handle} />}
      {DEBUG && handle && <DebugPanel handle={handle} />}

      {showContent && (
        <main id="demo-content" className="demo-content" style={{ color: resolvePalette(palette).ink }}>
          <h1>Vivarium</h1>
          <p>
            Small worlds that run behind a web page. Each background is a simulation with its own rules, not a loop. Fleets trade and
            fight, cities lose power block by block, dwarves dig, mages raise towers, and a wyrm wakes above its valley.
          </p>
          <p>
            This column stands in for your page&apos;s text. The studio samples the background behind it and reports how legible text in
            the palette ink would be, so a scene is tuned against real content, not an empty frame.
          </p>
        </main>
      )}

      {galleryOpen && (
        <Gallery
          onPick={(id, universe, options) => {
            goTo(id, universe, undefined, options);
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
          onAbout={() => setAboutOpen(true)}
          onShortcuts={() => setShortcutsOpen(true)}
        />
      )}

      {(skipNote || keptNote) && <div className="demo-skip">{skipNote ?? keptNote}</div>}
      {away && !aboutOpen && (
        <WelcomeBack
          away={away}
          worldName={worldName}
          onClose={() => setAway(null)}
          onOpenJournal={() => {
            setAway(null);
            openJournal();
          }}
        />
      )}
      {viewing && <MomentViewer key={viewing.id} moment={viewing} moments={moments} worldName={worldName} onClose={() => setViewing(null)} />}
      {shortcutsOpen && <ShortcutsCard onClose={() => setShortcutsOpen(false)} />}
      {aboutOpen && <AboutCard onClose={closeAbout} />}

      {panelOpen ? (
        <aside className="demo-panel" aria-label="Studio">
          <header className="demo-top">
            <div className="demo-title-row">
              <div className="demo-title">
                <h2>{title}</h2>
                {description && <p>{description}</p>}
              </div>
              <button type="button" className="demo-icon-btn" onClick={() => setPanelOpen(false)} title="Hide the studio (H)" aria-label="Hide the studio">
                <Icon name="close" />
              </button>
            </div>

            <div className="demo-seed-row">
              <label className="demo-seed">
                <span>Seed</span>
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySeed(seedDraft);
                  }}
                  onBlur={() => seedDraft !== studio.seed && applySeed(seedDraft)}
                  spellCheck={false}
                  aria-label="Seed. The same seed always plays the same world."
                  title="The same seed always plays the same world"
                />
              </label>
              <button type="button" className="demo-icon-btn" onClick={() => applySeed(randomSeedString())} title="New seed: same settings, another world (S)" aria-label="New seed">
                <Icon name="shuffle" />
              </button>
              <button type="button" className="demo-icon-btn" onClick={() => copy('link', window.location.href)} title="Copy a link to exactly this" aria-label="Copy link">
                {copied === 'link' ? <span className="demo-tick">✓</span> : <Icon name="link" />}
              </button>
            </div>

            <div className="demo-transport">
              <button type="button" className="demo-icon-btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)} title={paused ? 'Play (Space)' : 'Pause (Space)'} aria-label={paused ? 'Play' : 'Pause'}>
                <Icon name={paused ? 'play' : 'pause'} />
              </button>
              <span className="demo-segmented" role="group" aria-label="Speed">
                {SPEEDS.map((k, i) => (
                  <button key={k} type="button" aria-pressed={speed === k} onClick={() => setSpeed(k)} title={`Time ×${k} (${i + 1})`}>
                    ×{k}
                  </button>
                ))}
              </span>
              <span className="demo-sound">
                <button
                  type="button"
                  className="demo-icon-btn"
                  aria-pressed={soundOn}
                  onClick={() => setSoundOn((on) => !on)}
                  title="Sound (M): generated live, bound to what happens. Each world sounds different."
                  aria-label={soundOn ? 'Sound off' : 'Sound on'}
                >
                  <Icon name={soundOn ? 'soundOn' : 'soundOff'} />
                </button>
                {soundOn && <input type="range" min={0} max={1} step={0.05} value={soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} aria-label="Volume" title={`Volume ${Math.round(soundVolume * 100)}%`} />}
              </span>
              <span className="demo-spacer" />
              <button type="button" className="demo-icon-btn" onClick={undo} disabled={!history.canUndo} title="Undo (Ctrl Z)" aria-label="Undo">
                <Icon name="undo" />
              </button>
              <button type="button" className="demo-icon-btn" onClick={redo} disabled={!history.canRedo} title="Redo (Ctrl Shift Z)" aria-label="Redo">
                <Icon name="redo" />
              </button>
            </div>

            <nav className="demo-tabs" role="tablist" aria-label="Studio sections">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                  {id === 'journal' && world && (
                    <small>
                      {journal.progress(world).seen}/{journal.progress(world).total}
                    </small>
                  )}
                  {id === 'journal' && tab !== 'journal' && unseenMoments > 0 && (
                    <span className="demo-new" title={`${unseenMoments} new moment${unseenMoments > 1 ? 's' : ''} in the journal`}>
                      new
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </header>

          <div className="demo-body" role="tabpanel" ref={bodyRef}>
            {tab === 'world' && (
              <>
                <section className="demo-section">
                  <h3 className="demo-h">Worlds</h3>
                  <div className="demo-worlds">{WORLD_CARDS.map(worldCard)}</div>
                </section>
                <section className="demo-section">
                  <h3 className="demo-h">Instruments</h3>
                  <div className="demo-worlds is-small">{INSTRUMENT_CARDS.map(worldCard)}</div>
                </section>
                <section className="demo-section">
                  <label className="demo-field">
                    <span>Something calmer</span>
                    <select value={onCardSource ? '' : studio.source === 'void-tactical' ? '' : studio.source} onChange={(e) => e.target.value && goTo(e.target.value)}>
                      <option value="" disabled>
                        Presets and simple backgrounds…
                      </option>
                      <optgroup label="Presets">
                        {allPresets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Simple">
                        {builtInSkins
                          .filter((s) => !ALL_CARDS.some((c) => c.source === s.id))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label ?? s.id}
                            </option>
                          ))}
                        <option value="scene">Blank scene (build your own)</option>
                      </optgroup>
                    </select>
                  </label>
                  {remoteNote && <p className="demo-hint">{remoteNote}</p>}
                </section>

                {studio.source === 'void-tactical' && (
                  <section className="demo-section">
                    <h3 className="demo-h">What happens here</h3>
                    <MechanicChips
                      refs={mechanicRefs}
                      native={universeMechanics.map((m) => m.use)}
                      custom={Array.isArray(studio.skinOptions.mechanics)}
                      onChange={(mechanics) => update({ skinOptions: { ...studio.skinOptions, mechanics } })}
                      onReset={() => {
                        const { mechanics: _m, ...rest } = studio.skinOptions;
                        update({ skinOptions: rest });
                      }}
                    />
                    <details className="demo-details">
                      <summary>Make your own universe from any book, film, or game</summary>
                      <label className="demo-field">
                        <span>1. Name it or describe it</span>
                        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="The Expanse · Dune · my TTRPG's frontier" spellCheck={false} />
                      </label>
                      <button type="button" className="demo-btn" onClick={() => copy('universe', universePrompt(subject, listMechanics().map((m) => ({ id: m.id, description: m.description, params: Object.keys(m.schema) }))))}>
                        {copied === 'universe' ? 'Copied. Paste it into your AI.' : '2. Copy the prompt for your AI'}
                      </button>
                      <label className="demo-field">
                        <span>3. Paste what it gives back</span>
                        <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} spellCheck={false} placeholder="{ &quot;name&quot;: … }" />
                      </label>
                      <button type="button" className="demo-btn" onClick={applyPasted} disabled={!pasted.trim()}>
                        4. Bring it to life
                      </button>
                    </details>
                    {packNote && <p className={`demo-hint ${packNote.ok ? 'demo-ok' : 'demo-warn'}`}>{packNote.text}</p>}
                    {activePack && (
                      <button type="button" className="demo-btn" onClick={saveUniverse} title="The pack as a file, for your site or your AI">
                        Download universe.json
                      </button>
                    )}
                  </section>
                )}

                {(world || activePack) && <HappeningNow items={feed} quietText="Nothing yet. Give it a minute, or try ×16." />}
              </>
            )}

            {tab === 'look' && (
              <>
                <section className="demo-section">
                  <h3 className="demo-h">Color</h3>
                  <label className="demo-field">
                    <span>Palette</span>
                    <select value={studio.paletteMode} onChange={(e) => update({ paletteMode: e.target.value as PaletteMode })}>
                      {PALETTE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                      <option value="custom">From a brand color</option>
                    </select>
                  </label>
                  {studio.paletteMode === 'custom' && (
                    <div className="demo-row">
                      <label className="demo-field demo-grow">
                        <span>Brand color</span>
                        <span className="demo-text-row">
                          <input type="color" value={studio.customHex} onChange={(e) => update({ customHex: e.target.value })} aria-label="Brand color" />
                          <input value={studio.customHex} onChange={(e) => update({ customHex: e.target.value })} spellCheck={false} aria-label="Brand color hex" />
                        </span>
                      </label>
                      <label className="demo-field">
                        <span>Theme</span>
                        <select value={studio.theme} onChange={(e) => update({ theme: e.target.value as 'dark' | 'light' })}>
                          <option value="dark">Dark</option>
                          <option value="light">Light</option>
                        </select>
                      </label>
                      <label className="demo-field">
                        <span>Harmony</span>
                        <select value={studio.harmony} onChange={(e) => update({ harmony: e.target.value as Harmony })}>
                          {HARMONIES.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  <PaletteSwatches spec={palette} />
                  <div className="demo-btn-row">
                    <label className="demo-btn demo-file-button" title="Derive the palette from a brand token file (DTCG, Style Dictionary, Tokens Studio)">
                      Import tokens
                      <input
                        type="file"
                        accept="application/json,.json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) loadTokens(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button type="button" className="demo-btn" onClick={saveTokens} title="This palette as design tokens (W3C DTCG)">
                      Export tokens
                    </button>
                  </div>
                </section>

                <section className="demo-section">
                  <h3 className="demo-h">Presence</h3>
                  <Slider label="Intensity" value={studio.intensity} text={studio.intensity.toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => update({ intensity: v })} />
                  {!sceneMode && <Slider label="Density" value={studio.density} text={studio.density.toFixed(2)} min={0.25} max={2} step={0.05} onChange={(v) => update({ density: v })} />}
                  {studio.source === 'void-tactical' && (
                    <label className="demo-field">
                      <span>Detail</span>
                      <select value={studio.detail} onChange={(e) => update({ detail: e.target.value as LabelDensity })}>
                        {DETAIL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="demo-field">
                    <span>Motion</span>
                    <select value={studio.motion} onChange={(e) => update({ motion: e.target.value as MotionPreference })}>
                      <option value="auto">Follow the system setting</option>
                      <option value="full">Full</option>
                      <option value="reduced">Reduced</option>
                      <option value="off">Off (a still frame)</option>
                    </select>
                  </label>
                  <label className="demo-field">
                    <span>Transition between backgrounds</span>
                    <select value={transitionKind} onChange={(e) => setTransitionKind(e.target.value as TransitionKind)}>
                      <option value="iris">Iris from the key light</option>
                      <option value="wipe">Wipe from the lit side</option>
                      <option value="crossfade">Crossfade</option>
                    </select>
                  </label>
                </section>

                <section className="demo-section">
                  <h3 className="demo-h">Light</h3>
                  <label className="demo-check" title="Let the seed choose the light angle (upper left or upper right)">
                    <input type="checkbox" checked={studio.lightAngle === null} onChange={(e) => update({ lightAngle: e.target.checked ? null : handle?.composition().light.angle ?? 225 })} />
                    <span>Let the seed choose the angle</span>
                  </label>
                  {studio.lightAngle !== null && <Slider label="Angle" value={studio.lightAngle} text={`${Math.round(studio.lightAngle)}°`} min={0} max={359} step={1} onChange={(v) => update({ lightAngle: v })} />}
                  <Slider label="Warmth" value={studio.warmth} text={`${studio.warmth > 0 ? '+' : ''}${studio.warmth.toFixed(2)}`} min={-1} max={1} step={0.05} onChange={(v) => update({ warmth: v })} />
                </section>

                <section className="demo-section">
                  <h3 className="demo-h">Behind your content</h3>
                  <label className="demo-field" title="Auto finds page content, makes layers recede there, and shades behind it above intensity 0.55">
                    <span>Legibility</span>
                    <select value={studio.legibility} onChange={(e) => update({ legibility: e.target.value as 'auto' | 'off' })}>
                      <option value="auto">Auto: recede and shade behind text</option>
                      <option value="off">Off</option>
                    </select>
                  </label>
                  <label className="demo-check">
                    <input type="checkbox" checked={showContent} onChange={(e) => setShowContent(e.target.checked)} />
                    <span>Show sample text</span>
                  </label>
                  {report && (
                    <div className={`demo-readout${report.meanContrast >= 4.5 && report.failingShare <= 0.12 ? ' is-ok' : ' is-warn'}`}>
                      <span>Legibility behind the text</span>
                      <strong>{report.meanContrast.toFixed(1)}:1 on average</strong>
                      <span>
                        {Math.round(report.failingShare * 100)}% of pixels below 4.5:1, the worst {report.worstContrast.toFixed(1)}:1
                      </span>
                    </div>
                  )}
                  <label className="demo-check">
                    <input type="checkbox" checked={showComposition} onChange={(e) => setShowComposition(e.target.checked)} />
                    <span>Show composition guides (thirds, light, content, quiet zones)</span>
                  </label>
                </section>

                {!sceneMode && skin?.schema && Object.keys(skin.schema).some((k) => k !== 'universe') && (
                  <details className="demo-details demo-section">
                    <summary>Fine tuning</summary>
                    <SchemaControls
                      schema={Object.fromEntries(Object.entries(skin.schema).filter(([k]) => k !== 'universe'))}
                      values={studio.skinOptions}
                      onChange={(key, value) => update({ skinOptions: { ...studio.skinOptions, [key]: value } })}
                    />
                  </details>
                )}

                {sceneMode && studio.scene && <LayerStack scene={studio.scene} onChange={setScene} />}
              </>
            )}

            {tab === 'journal' && (
              <JournalTab
                journal={journal}
                data={journalData}
                moments={moments}
                world={world}
                source={studio.source}
                seed={studio.seed}
                clockRef={clockRef}
                worldName={worldName}
                onOpenMoment={setViewing}
                onReplay={replay}
                onGoWorld={(w) => {
                  const c = cardForWorld(w);
                  if (c) goToCard(c);
                }}
              />
            )}

            {tab === 'share' && (
              <>
                <section className="demo-section">
                  <button type="button" className="demo-primary" onClick={() => copy('prompt', promptText())}>
                    {copied === 'prompt' ? 'Copied. Paste it into your AI.' : 'Copy prompt for your AI'}
                  </button>
                  <p className="demo-hint">Three lines for whatever AI edits your site: Claude, ChatGPT, Cursor, v0.{activePack ? ' Attach universe.json too (World tab).' : ''}</p>
                  <div className="demo-btn-row">
                    <button type="button" className="demo-btn" onClick={() => copy('link', window.location.href)}>
                      {copied === 'link' ? 'Copied' : 'Copy link'}
                    </button>
                    <button type="button" className="demo-btn" onClick={() => copy('code', snippet)}>
                      {copied === 'code' ? 'Copied' : 'Copy code'}
                    </button>
                  </div>
                  <details className="demo-details">
                    <summary>Code and files</summary>
                    <textarea readOnly value={snippet} rows={8} spellCheck={false} aria-label="mount() snippet" />
                    <div className="demo-btn-row">
                      <button type="button" className="demo-btn" onClick={saveJson} title="Download this configuration as JSON">
                        JSON
                      </button>
                      <label className="demo-btn demo-file-button" title="Load a configuration JSON">
                        Load JSON
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) loadJson(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button type="button" className="demo-btn" onClick={() => saveImage('image/png')} disabled={!!busy} title="This window's size">
                        PNG
                      </button>
                      <button type="button" className="demo-btn" onClick={() => saveImage('image/webp')} disabled={!!busy}>
                        WebP
                      </button>
                    </div>
                  </details>
                </section>

                <section className="demo-section">
                  <h3 className="demo-h">Desktop wallpaper</h3>
                  <p className="demo-hint">Alive on your desktop, at 30 fps, paused when it is covered.</p>
                  <div className="demo-btn-row">
                    <button type="button" className="demo-btn" onClick={() => copy('wallpaper', wallpaperUrl())}>
                      {copied === 'wallpaper' ? 'Copied' : 'Copy wallpaper link'}
                    </button>
                    <a className="demo-btn" href={wallpaperUrl('&hint=1')} target="_blank" rel="noopener noreferrer">
                      Open full screen
                    </a>
                  </div>
                  <div className="demo-btn-row">
                    <button type="button" className="demo-btn" onClick={saveOfflineWallpaper} disabled={!!busy} title="One file with the whole engine inside. Runs with no internet, forever.">
                      Offline file (.html)
                    </button>
                    <button type="button" className="demo-btn" onClick={saveWallpaperEngine} disabled={!!busy}>
                      Wallpaper Engine (.zip)
                    </button>
                  </div>
                  <ul className="demo-howto">
                    <li>
                      <b>Windows.</b>{' '}
                      <a href="https://www.rocksdanister.com/lively/" target="_blank" rel="noopener noreferrer">
                        Lively Wallpaper
                      </a>{' '}
                      (free): add a wallpaper and paste the link. Wallpaper Engine: unzip into <code>projects\myprojects</code>.
                    </li>
                    <li>
                      <b>macOS.</b>{' '}
                      <a href="https://sindresorhus.com/plash" target="_blank" rel="noopener noreferrer">
                        Plash
                      </a>{' '}
                      (free): add a website and paste the link.
                    </li>
                    <li>
                      <b>Linux.</b> KDE Plasma&apos;s web wallpaper plugins take the link or the offline file.
                    </li>
                    <li>
                      <a href={`${REPO}/blob/main/docs/WALLPAPERS.md`} target="_blank" rel="noopener noreferrer">
                        Step by step, for each app
                      </a>
                      , with settings that save battery.
                    </li>
                  </ul>
                  <div className="demo-btn-row">
                    <button type="button" className="demo-btn" onClick={saveDesktopStill} disabled={!!busy} title="At your screen's full resolution">
                      Still at screen size
                    </button>
                    <button type="button" className="demo-btn" onClick={saveVideo} disabled={!!busy} title="8 seconds at 30 fps">
                      Video loop
                    </button>
                  </div>
                </section>

                <section className="demo-section">
                  <h3 className="demo-h">Phone wallpaper</h3>
                  <div className="demo-btn-row">
                    <button type="button" className="demo-btn" onClick={savePhoneStill} disabled={!!busy}>
                      Still, 1170 × 2532
                    </button>
                    <button type="button" className="demo-btn" onClick={savePhoneVideo} disabled={!!busy}>
                      Live, 10 s video
                    </button>
                  </div>
                  <p className="demo-hint">
                    The still fits any modern phone. The video works with Android&apos;s video wallpaper apps; on an iPhone, turn it into a Live Photo first. Or open the wallpaper link on
                    your phone and add it to your home screen: it opens full screen, alive.
                  </p>
                </section>
                {busy && <p className="demo-busy">{busy}</p>}
              </>
            )}
          </div>

          <footer className="demo-foot">
            <button type="button" className="demo-link" onClick={() => setAboutOpen(true)}>
              <Icon name="info" /> About
            </button>
            <button type="button" className="demo-link" onClick={() => setShortcutsOpen(true)}>
              <Icon name="keys" /> Shortcuts
            </button>
            <button type="button" className="demo-link" onClick={() => setGalleryOpen(true)}>
              <Icon name="grid" /> Gallery
            </button>
            {world && (
              <button type="button" className="demo-link" onClick={openJournal}>
                {journal.progress(world).seen} of {journal.progress(world).total} seen here
              </button>
            )}
          </footer>
        </aside>
      ) : (
        <>
          <button type="button" className="demo-pill" onClick={() => setPanelOpen(true)} title="Show the studio (H)">
            <Icon name="panel" />
            <span>{title}</span>
            {paused && <em>paused</em>}
            {speed > 1 && <em>×{speed}</em>}
          </button>
          {unseenMoments > 0 && (
            <button type="button" className="demo-pill demo-pill-new" onClick={openJournal} title="New moments in the journal (J)">
              {unseenMoments} new in the journal
            </button>
          )}
          <div className="demo-fab">
            <button type="button" className="demo-icon-btn" onClick={() => setAboutOpen(true)} title="About Vivarium (A)" aria-label="About Vivarium">
              <Icon name="info" />
            </button>
            <button type="button" className="demo-icon-btn" onClick={() => setShortcutsOpen(true)} title="Controls (?)" aria-label="Controls">
              <Icon name="keys" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** What this is, for people who never read the README. */
function AboutCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="demo-shortcuts" role="dialog" aria-modal="true" aria-label="About Vivarium" onClick={onClose}>
      <div className="demo-shortcuts-card demo-about-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="demo-about-title">Vivarium</h3>
        <p className="demo-about-tag">Small worlds that run behind a web page.</p>
        <p>
          These are animated backgrounds for websites, but they are not loops. Each one is a small simulation with its own rules,
          and the rules make things happen: trade and raids, sieges and harvests, a city going dark, a wyrm waking.
        </p>
        <p>
          Read it as living algorithmic art, or as an idle game with no player. The same seed always plays the same story, so a
          link is an exact world. Leave one open and look back later.
        </p>
        <p>
          It is also an experiment. Most of the code was written with frontier AI coding agents, one world at a time, to see what
          the models can build and where they still fail.
        </p>
        <ul className="demo-about-how">
          <li>
            <b>Look around.</b> Arrows change the world, <kbd>S</kbd> rolls a new seed, <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd> set the speed, <kbd>M</kbd> turns on sound.
          </li>
          <li>
            <b>Touch it.</b> In Wyrmspire, Deephold and Leylines a click nudges the world: throw a stone at the spire, ring a
            hold&apos;s bell, gather a storm.
          </li>
          <li>
            <b>Take one with you.</b> The studio exports the code for your site, a still, a video, or an offline wallpaper.
          </li>
        </ul>
        <div className="demo-about-actions">
          <button type="button" className="demo-btn" onClick={onClose}>
            Enter
          </button>
          <a className="demo-btn" href={REPO} target="_blank" rel="noreferrer">
            Source and docs
          </a>
        </div>
      </div>
    </div>
  );
}

function ShortcutsCard({ onClose }: { onClose: () => void }) {
  return (
    <div className="demo-shortcuts" role="dialog" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="demo-shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="demo-h">Controls</h3>
        <p className="demo-hint">Keys work anywhere on the page. The studio panel (H) has the same controls as buttons.</p>
        <dl>
          {SHORTCUTS.map(([k, v]) => (
            <div key={k}>
              <dt>
                {k.split(' ').map((part) => (
                  <kbd key={part}>{part}</kbd>
                ))}
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button type="button" className="demo-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function Slider({ label, value, text, min, max, step, onChange, title }: { label: string; value: number; text?: string; min: number; max: number; step: number; onChange: (v: number) => void; title?: string }) {
  return (
    <label className="demo-field demo-slider" title={title}>
      <span className="demo-field-head">
        <span>{label}</span>
        <output>{text ?? value}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/**
 * Preset gallery. Images are thumbnails of the e2e screenshot baselines (`pnpm thumbs`),
 * so a card shows the exact pixels the tests protect.
 */
type GalleryEntry = { key: string; image: string; source: string; universe?: string; label: string; description?: string; tags: string[]; community?: boolean };

function Gallery({ onPick, onClose, onAbout, onShortcuts }: { onPick: (source: string, universe?: string, options?: Record<string, unknown>) => void; onClose: () => void; onAbout: () => void; onShortcuts: () => void }) {
  const [available, setAvailable] = useState<string[] | null>(null);
  useEffect(() => {
    fetch('thumbs/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: string[]) => setAvailable(list))
      .catch(() => setAvailable([]));
  }, []);
  const featured: (GalleryEntry & { card: WorldCard })[] = ALL_CARDS.map((c) => ({
    key: c.key,
    image: c.thumb,
    source: c.source,
    universe: c.universe,
    label: c.name,
    description: c.tagline,
    tags: c.universe ? ['sector map'] : (getSkin(c.source)?.tags ?? []).filter((t) => t !== 'instrument' && t !== 'dark').slice(0, 3),
    card: c,
  }));
  const basics: GalleryEntry[] = allPresets.map((p) => ({
    key: p.id,
    image: p.id,
    source: p.id,
    label: p.label ?? p.id,
    description: p.description,
    tags: (p.tags ?? []).filter((t) => t !== 'community'),
    community: (p.tags ?? []).includes('community'),
  }));
  const card = (e: GalleryEntry & { card?: WorldCard }) => (
    <button type="button" key={e.key} className="demo-card" onClick={() => onPick(e.source, e.universe, e.card?.options)}>
      {available?.includes(e.image) ? <img src={`thumbs/${e.image}.jpg`} alt="" loading="lazy" /> : <span className="demo-card-placeholder">No preview yet</span>}
      <strong>
        {e.label}
        {e.community && <span className="demo-badge">community</span>}
      </strong>
      <em>{e.description}</em>
      <span className="demo-card-tags">{e.tags.join(' · ')}</span>
    </button>
  );
  return (
    <div className="demo-gallery" role="dialog" aria-label="Gallery">
      <div className="demo-gallery-head">
        <div>
          <h3 className="demo-h">Worlds and instruments</h3>
          <p className="demo-gallery-lede">Each one is a small simulation, not a loop. Pick one to open it; press G to come back here.</p>
        </div>
        <div className="demo-gallery-actions">
          <button type="button" className="demo-btn" onClick={onAbout}>
            <Icon name="info" /> About
          </button>
          <button type="button" className="demo-btn" onClick={onShortcuts}>
            <Icon name="keys" /> Controls
          </button>
          <button type="button" className="demo-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="demo-gallery-grid">{featured.map(card)}</div>
      <h3 className="demo-h demo-gallery-sub">Presets and simple backgrounds</h3>
      <div className="demo-gallery-grid demo-gallery-basics">{basics.map(card)}</div>
    </div>
  );
}

/**
 * What the engine knows about layout: rule-of-thirds guides, the scene light and its
 * key position, measured page content (where layers recede and the shade sits), and
 * explicit quiet zones. Read from the live handle a few times a second.
 */
function CompositionOverlay({ handle }: { handle: MountHandle }) {
  const [state, setState] = useState(() => handle.composition());
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const tick = () => {
      setState(handle.composition());
      const r = handle.canvas.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [handle]);
  const { w, h } = size;
  const { light, content, quiet, shade } = state;
  const lx = light.x * w;
  const ly = light.y * h;
  return (
    <svg className="demo-composition" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      {[1, 2].map((i) => (
        <g key={i}>
          <line x1={(w * i) / 3} y1={0} x2={(w * i) / 3} y2={h} />
          <line x1={0} y1={(h * i) / 3} x2={w} y2={(h * i) / 3} />
        </g>
      ))}
      <line className="light-ray" x1={w / 2} y1={h / 2} x2={lx} y2={ly} />
      <circle className="light-key" cx={lx} cy={ly} r={9} />
      <text x={lx + 14} y={ly + 4}>
        key light {Math.round(light.angle)}° · warmth {light.warmth.toFixed(2)}
      </text>
      {content.map((r, i) => (
        <g key={`c${i}`}>
          <rect className="content" x={r.x} y={r.y} width={r.width} height={r.height} />
          <text x={r.x + 6} y={r.y - 6}>content · shade {shade.toFixed(2)}</text>
        </g>
      ))}
      {quiet.map((r, i) => (
        <rect key={`q${i}`} className="quiet" x={r.x} y={r.y} width={r.width} height={r.height} />
      ))}
    </svg>
  );
}

/** The resolved palette at a glance: plate, ink, accent, harmony hues, hazard. */
function PaletteSwatches({ spec }: { spec: PaletteSpec }) {
  const p = resolvePalette(spec);
  const swatches: [string, string][] = [
    ['bg', p.bg],
    ['ink', p.ink],
    ['accent', p.accent],
    ['accent2', p.accent2],
    ['accent3', p.accent3],
    ['hazard', p.hazard],
  ];
  return (
    <div className="demo-swatches" aria-label="Resolved palette">
      {swatches.map(([name, hex]) => (
        <span key={name} title={`${name} ${hex}`} style={{ background: hex }} />
      ))}
    </div>
  );
}

function LayerStack({ scene, onChange }: { scene: Scene; onChange: (fn: (scene: Scene) => Scene) => void }) {
  const [adding, setAdding] = useState(listLayers()[0]?.id ?? 'gradient-base');
  const [open, setOpen] = useState<number | null>(null);

  const patch = (index: number, changes: Partial<SceneLayer>) =>
    onChange((s) => ({ layers: s.layers.map((l, i) => (i === index ? { ...l, ...changes } : l)) }));
  const move = (index: number, dir: -1 | 1) =>
    onChange((s) => {
      const next = [...s.layers];
      const j = index + dir;
      if (j < 0 || j >= next.length) return s;
      [next[index], next[j]] = [next[j], next[index]];
      return { layers: next };
    });
  const remove = (index: number) => onChange((s) => ({ layers: s.layers.filter((_, i) => i !== index) }));
  const add = () => onChange((s) => ({ layers: [...s.layers, { use: adding }] }));

  return (
    <section className="demo-section">
      <h3 className="demo-h">Layers, bottom to top</h3>
      {scene.layers.map((ref, i) => {
        const layer = getLayer(ref.use);
        const values = { ...(layer ? schemaDefaults(layer.schema) : {}), ...(ref.with ?? {}) };
        const enabled = ref.enabled !== false;
        return (
          <div className={`demo-layer${enabled ? '' : ' is-off'}`} key={`${ref.use}-${i}`}>
            <div className="demo-layer-head">
              <input type="checkbox" checked={enabled} onChange={() => patch(i, { enabled: !enabled })} aria-label={`Enable ${ref.use}`} />
              <button type="button" className="demo-layer-name" onClick={() => setOpen(open === i ? null : i)}>
                {layer?.label ?? ref.use}
                {layer?.surface === 'own' && <small> · own surface</small>}
              </button>
              <span className="demo-layer-actions">
                <button type="button" onClick={() => move(i, -1)} aria-label="Move down in stack">▲</button>
                <button type="button" onClick={() => move(i, 1)} aria-label="Move up in stack">▼</button>
                <button type="button" onClick={() => remove(i)} aria-label="Remove layer">✕</button>
              </span>
            </div>
            {open === i && layer && (
              <div className="demo-layer-body">
                <Slider label="Opacity" value={ref.opacity ?? 1} text={(ref.opacity ?? 1).toFixed(2)} min={0} max={1} step={0.05} onChange={(v) => patch(i, { opacity: v })} />
                {layer.canvas && (
                  <label className="demo-field">
                    <span>Blend</span>
                    <select value={ref.blend ?? 'source-over'} onChange={(e) => patch(i, { blend: e.target.value as GlobalCompositeOperation })}>
                      {BLENDS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </label>
                )}
                <SchemaControls schema={layer.schema} values={values} onChange={(key, value) => patch(i, { with: { ...(ref.with ?? {}), [key]: value } })} />
                {layer.description && <em className="demo-hint">{layer.description}</em>}
              </div>
            )}
          </div>
        );
      })}
      <div className="demo-text-row demo-add-row">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Layer to add">
          {listLayers().map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <button type="button" className="demo-btn" onClick={add}>
          Add layer
        </button>
      </div>
    </section>
  );
}

/**
 * The studio's sound: loads the audio module the first time it is switched on, follows
 * the current mount (each remount is a new handle), and the universe's palette.
 */
function useSoundscape(handle: MountHandle | null, on: boolean, volume: number, universe: string) {
  const sound = useRef<import('../engine/audio').Soundscape | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!on || sound.current) return;
    let cancelled = false;
    void import('../engine/audio').then(({ createSoundscape }) => {
      if (cancelled) return;
      sound.current = createSoundscape({ palette: universe, volume });
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // Created once; palette and volume follow through the effects below.
  }, [on]);
  useEffect(() => {
    const s = sound.current;
    if (!s) return;
    if (on) void s.start();
    else s.stop();
  }, [on, ready]);
  useEffect(() => (handle && sound.current ? sound.current.attach(handle) : undefined), [handle, ready]);
  useEffect(() => {
    sound.current?.setPalette(universe);
  }, [universe, ready]);
  useEffect(() => {
    sound.current?.setVolume(volume);
  }, [volume, ready]);
  useEffect(() => () => sound.current?.destroy(), []);
}

/** Developer panel (`?debug`): skip ahead, and watch counts and the event log. Speed lives in the studio's top bar. */
function DebugPanel({ handle }: { handle: MountHandle }) {
  const [snap, setSnap] = useState<ReturnType<MountHandle['inspect']>>(undefined);
  useEffect(() => {
    const id = window.setInterval(() => setSnap(handle.inspect()), 400);
    return () => window.clearInterval(id);
  }, [handle]);
  const events = (snap?.log ?? []).filter((e) => e.kind !== 'low').slice(-8);
  return (
    <aside className="demo-debug" aria-label="Debug">
      <div className="demo-text-row">
        <button type="button" onClick={() => handle.fastForward(30)}>+30 s</button>
        <button type="button" onClick={() => handle.fastForward(300)}>+5 min</button>
        <span>t {snap?.t.toFixed(0) ?? '–'} s</span>
      </div>
      {snap && (
        <p className="demo-debug-counts">
          {Object.entries(snap.counts).map(([k, v]) => `${k} ${v}`).join(' · ')}
        </p>
      )}
      <ol>
        {events.map((e, i) => (
          <li key={`${e.t}-${i}`}>
            <span>{e.t.toFixed(1)}</span> {e.text}
          </li>
        ))}
      </ol>
      {!!snap?.problems?.length && <p className="demo-warn">{snap.problems.slice(0, 3).join(' · ')}</p>}
    </aside>
  );
}

/**
 * The universe's mechanics as chips: its own first, then any borrowed from other worlds.
 * Editing makes a copy of the universe's list; reset drops it.
 */
function MechanicChips({ refs, native, custom, onChange, onReset }: { refs: MechanicRef[]; native: string[]; custom: boolean; onChange: (next: MechanicRef[]) => void; onReset: () => void }) {
  const [borrowing, setBorrowing] = useState(false);
  const all = listMechanics();
  const live = (id: string) => refs.find((r) => r.use === id && r.enabled !== false);
  const toggle = (id: string) => {
    const existing = refs.find((r) => r.use === id);
    onChange(existing ? refs.map((r) => (r.use === id ? { ...r, enabled: r.enabled === false } : r)) : [...refs, { use: id }]);
  };
  const tune = (id: string, key: string, value: unknown) => onChange(refs.map((r) => (r.use === id ? { ...r, with: { ...(r.with ?? {}), [key]: value } } : r)));
  const own = all.filter((m) => native.includes(m.id));
  const others = all.filter((m) => !native.includes(m.id));
  const borrowed = others.filter((m) => live(m.id));
  const tunable = all.filter((m) => live(m.id) && Object.keys(m.schema).length > 0);
  const chip = (m: (typeof all)[number]) => (
    <button key={m.id} type="button" className={`demo-chip${live(m.id) ? ' is-on' : ''}`} aria-pressed={!!live(m.id)} onClick={() => toggle(m.id)} title={m.description}>
      {m.label}
    </button>
  );
  return (
    <div className="demo-mechanics">
      <div className="demo-chips">
        {own.map(chip)}
        {borrowed.map(chip)}
      </div>
      <div className="demo-inline-actions">
        <button type="button" className="demo-link" onClick={() => setBorrowing((b) => !b)} aria-expanded={borrowing}>
          {borrowing ? 'Done borrowing' : `+ Borrow from other worlds (${others.length - borrowed.length})`}
        </button>
        {custom && (
          <button type="button" className="demo-link" onClick={onReset}>
            Back to this universe&apos;s own
          </button>
        )}
      </div>
      {borrowing && <div className="demo-chips is-borrow">{others.filter((m) => !live(m.id)).map(chip)}</div>}
      {tunable.length > 0 && (
        <details className="demo-details">
          <summary>Tune what happens</summary>
          {tunable.map((m) => (
            <div key={m.id} className="demo-tune">
              <h4 title={m.description}>{m.label}</h4>
              <SchemaControls schema={m.schema} values={{ ...schemaDefaults(m.schema), ...(live(m.id)?.with ?? {}) }} onChange={(key, value) => tune(m.id, key, value)} />
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

function SchemaControls({
  schema,
  values,
  onChange,
}: {
  schema: Schema;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <>
      {Object.entries(schema).map(([key, field]) => (
        <FieldControl key={key} name={key} field={field} value={values[key]} onChange={(v) => onChange(key, v)} />
      ))}
    </>
  );
}

function FieldControl({ name, field, value, onChange }: { name: string; field: FieldSchema; value: unknown; onChange: (v: unknown) => void }) {
  const label = field.label ?? name;
  switch (field.type) {
    case 'number': {
      const v = typeof value === 'number' ? value : field.default;
      const step = field.step ?? (field.max - field.min) / 100;
      return <Slider label={label} value={v} text={Number.isInteger(step) ? String(v) : v.toFixed(2)} min={field.min} max={field.max} step={step} onChange={onChange} title={field.description} />;
    }
    case 'boolean':
      return (
        <label className="demo-check" title={field.description}>
          <input type="checkbox" checked={typeof value === 'boolean' ? value : field.default} onChange={(e) => onChange(e.target.checked)} />
          <span>{label}</span>
        </label>
      );
    case 'enum':
      return (
        <label className="demo-field" title={field.description}>
          <span>{label}</span>
          <select value={typeof value === 'string' ? value : field.default} onChange={(e) => onChange(e.target.value)}>
            {field.values.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>
      );
    case 'color': {
      const v = typeof value === 'string' ? value : field.default;
      const isToken = COLOR_TOKENS.includes(v);
      return (
        <label className="demo-field" title={field.description}>
          <span>{label}</span>
          <span className="demo-text-row">
            <select value={isToken ? v : 'hex'} onChange={(e) => onChange(e.target.value === 'hex' ? '#ffffff' : e.target.value)}>
              {COLOR_TOKENS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="hex">custom hex</option>
            </select>
            {!isToken && <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff'} onChange={(e) => onChange(e.target.value)} aria-label={`${label} hex`} />}
          </span>
        </label>
      );
    }
    case 'string':
      return (
        <label className="demo-field" title={field.description}>
          <span>{label}</span>
          <input value={typeof value === 'string' ? value : field.default} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
        </label>
      );
  }
}
