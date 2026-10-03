import { useEffect, useMemo, useRef, useState } from 'react';
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
import { History, download, exportImage, exportVideo, type ExportOptions } from './studio-tools';
import { listUniverses, universePrompt, validateUniverse, type UniversePack } from '../engine/skins/void-tactical/universe';
import { listMechanics, type MechanicRef } from '../engine/skins/void-tactical/mechanics';
import { instrumentSkins } from '../engine/skins/instruments';
import { aiPrompt, compactConfig } from './ai-prompt';
import './DemoPage.css';

/** The ones with a point of view; everything else is under "Basics". */
const FEATURED_SKINS = ['void-tactical', ...instrumentSkins.map((s) => s.id)];

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /input|textarea|select/i.test(e.target.tagName);
      if (typing || !(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
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
      download(blob, `${studio.source}-${studio.seed}.webm`);
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
  const chooseUniverse = (id: string) => {
    const pack = listUniverses().find((u) => u.id === id);
    const { pack: _old, ...rest } = studio.skinOptions;
    const patch: Partial<Studio> = { skinOptions: { ...rest, universe: id } };
    if (pack?.palette) Object.assign(patch, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
    else Object.assign(patch, { paletteMode: 'void-cyan' });
    patch.warmth = pack?.warmth ?? 0;
    update(patch);
    setPackNote(null);
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

  return (
    <div className="demo-root">
      <Background
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
        pauseWhenHidden={false}
        // Switching source dissolves into the new scene; option tweaks remount instantly.
        transition={sourceChanged ? { duration: 0.9, kind: transitionKind } : undefined}
        onReady={setHandle}
      />

      {showComposition && handle && <CompositionOverlay handle={handle} />}

      {showContent && (
        <main id="demo-content" className="demo-content" style={{ color: resolvePalette(palette).ink }}>
          <h1>Your headline sits here</h1>
          <p>
            This column stands in for real page content. The readout in the studio samples the background behind it and reports
            how legible body text in the palette ink would be, so a scene is tuned against text, not an empty frame.
          </p>
          <p>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute
            irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
          </p>
        </main>
      )}

      {galleryOpen && (
        <Gallery
          onPick={(id, universe) => {
            const next = studioFor(id, studio);
            if (universe) {
              const pack = listUniverses().find((u) => u.id === universe);
              next.skinOptions = { ...next.skinOptions, universe };
              if (pack?.palette) Object.assign(next, { paletteMode: 'custom', customHex: pack.palette, theme: 'dark' });
              if (typeof pack?.warmth === 'number') next.warmth = pack.warmth;
            }
            commit(() => next);
            setSeedDraft(next.seed);
            setPackNote(null);
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      <header className="demo-hud">
        <span className="demo-hud-row">
          <button type="button" className="demo-hud-toggle" onClick={() => setGalleryOpen(true)}>
            Gallery
          </button>
          <button type="button" className="demo-hud-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
            {panelOpen ? 'Hide studio' : 'Show studio'}
          </button>
        </span>

        {panelOpen && (
          <div className="demo-panel">
            <p className="demo-kicker">{sourceLabel}</p>

            <div className="demo-export demo-export-top">
              <button type="button" className="demo-primary" onClick={() => copy('prompt', promptText())}>
                {copied === 'prompt' ? 'Copied. Paste it into your AI.' : 'Copy prompt for your AI'}
              </button>
              <p className="demo-hint">Three lines. Paste into whatever AI edits your site.{activePack ? ' Attach universe.json too (below).' : ''}</p>
            </div>

            <label className="demo-field demo-seed">
              <span>Seed · the same seed always plays the same world</span>
              <span className="demo-text-row">
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySeed(seedDraft);
                  }}
                  onBlur={() => seedDraft !== studio.seed && applySeed(seedDraft)}
                  spellCheck={false}
                  aria-label="Seed"
                />
                <button type="button" onClick={() => applySeed(randomSeedString())} title="A new seed: same settings, a different world">Shuffle</button>
                <button type="button" onClick={() => copy('link', window.location.href)} title="Copy a link to exactly this">{copied === 'link' ? 'Copied' : 'Link'}</button>
              </span>
            </label>

            <div className="demo-text-row demo-toolbar">
              <button type="button" onClick={undo} disabled={!history.canUndo} title="Ctrl/Cmd+Z">Undo</button>
              <button type="button" onClick={redo} disabled={!history.canRedo} title="Ctrl/Cmd+Shift+Z">Redo</button>
            </div>

            <label className="demo-field">
              <span>Background</span>
              <select
                value={studio.source}
                onChange={(e) => {
                  const next = studioFor(e.target.value, studio);
                  setStudio(next);
                  setSeedDraft(next.seed);
                  setPackNote(null);
                }}
              >
                <optgroup label="Featured">
                  {FEATURED_SKINS.map((id) => (
                    <option key={id} value={id}>
                      {getSkin(id)?.label ?? id}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Basics">
                  {allPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  {builtInSkins.filter((s) => !FEATURED_SKINS.includes(s.id)).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label ?? s.id}
                    </option>
                  ))}
                  <option value="scene">Blank scene</option>
                </optgroup>
              </select>
              {(getSkin(studio.source)?.description) && <em className="demo-hint">{getSkin(studio.source)?.description}</em>}
            </label>

            {studio.source === 'void-tactical' && (
              <div className="demo-universe">
                <p className="demo-kicker demo-kicker-gap">Universe</p>
                <label className="demo-field">
                  <span>Whose map is this</span>
                  <select
                    value={activePack ? '__pack' : String(studio.skinOptions.universe ?? 'void')}
                    onChange={(e) => {
                      if (e.target.value !== '__pack') chooseUniverse(e.target.value);
                    }}
                  >
                    {listUniverses().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                    {activePack && <option value="__pack">{activePack.name}</option>}
                  </select>
                  {(activePack?.tagline || listUniverses().find((u) => u.id === (studio.skinOptions.universe ?? 'void'))?.tagline) && (
                    <em className="demo-hint">{activePack?.tagline ?? listUniverses().find((u) => u.id === (studio.skinOptions.universe ?? 'void'))?.tagline}</em>
                  )}
                </label>

                <MechanicsPanel
                  refs={
                    Array.isArray(studio.skinOptions.mechanics)
                      ? (studio.skinOptions.mechanics as MechanicRef[])
                      : (activePack ?? listUniverses().find((u) => u.id === (studio.skinOptions.universe ?? 'void')))?.mechanics ?? []
                  }
                  custom={Array.isArray(studio.skinOptions.mechanics)}
                  onChange={(mechanics) => update({ skinOptions: { ...studio.skinOptions, mechanics } })}
                  onReset={() => {
                    const { mechanics: _m, ...rest } = studio.skinOptions;
                    update({ skinOptions: rest });
                  }}
                />

                <details className="demo-details">
                  <summary>Make your own from any book, film, game, or world</summary>
                  <label className="demo-field">
                    <span>1. Name it or describe it</span>
                    <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="The Expanse · Dune · my TTRPG's frontier · a lonely lighthouse planet" spellCheck={false} />
                  </label>
                  <button type="button" onClick={() => copy('universe', universePrompt(subject, listMechanics().map((m) => ({ id: m.id, description: m.description, params: Object.keys(m.schema) }))))}>
                    {copied === 'universe' ? 'Copied. Paste it into your AI.' : '2. Copy the prompt for your AI'}
                  </button>
                  <label className="demo-field">
                    <span>3. Paste what it gives back</span>
                    <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} spellCheck={false} placeholder="{ &quot;name&quot;: … }" />
                  </label>
                  <button type="button" onClick={applyPasted} disabled={!pasted.trim()}>4. Bring it to life</button>
                </details>

                {packNote && <p className={`demo-hint ${packNote.ok ? 'demo-ok' : 'demo-warn'}`}>{packNote.text}</p>}
                {activePack && (
                  <button type="button" onClick={saveUniverse} title="The pack as a file, for your site or your AI">
                    Download universe.json
                  </button>
                )}
              </div>
            )}

            <label className="demo-field">
              <span>Palette</span>
              <select value={studio.paletteMode} onChange={(e) => update({ paletteMode: e.target.value as PaletteMode })}>
                {PALETTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
                <option value="custom">Derive from brand color</option>
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
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <PaletteSwatches spec={palette} />
            <div className="demo-text-row demo-tokens">
              <label className="demo-file-button" title="Derive the palette from a brand token file (DTCG, Style Dictionary, Tokens Studio)">
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
              <button type="button" onClick={saveTokens} title="Export this palette as design tokens (W3C DTCG format)">Export tokens</button>
            </div>
            {remoteNote && <p className="demo-hint">{remoteNote}</p>}

            <label className="demo-toggle-field">
              <input type="checkbox" checked={showContent} onChange={(e) => setShowContent(e.target.checked)} />
              <span className="demo-toggle-label">Show sample text</span>
            </label>
            {report && (
              <div className={`demo-readout${report.meanContrast >= 4.5 && report.failingShare <= 0.12 ? ' is-ok' : ' is-warn'}`}>
                <span>Legibility behind text</span>
                <strong>{report.meanContrast.toFixed(1)}:1 mean</strong>
                <span>{Math.round(report.failingShare * 100)}% of pixels below 4.5:1 · worst {report.worstContrast.toFixed(1)}:1</span>
              </div>
            )}

            <label className="demo-field">
              <span>Intensity {studio.intensity.toFixed(2)}</span>
              <input type="range" min={0} max={1} step={0.05} value={studio.intensity} onChange={(e) => update({ intensity: Number(e.target.value) })} />
            </label>

            <label className="demo-field">
              <span>Motion</span>
              <select value={studio.motion} onChange={(e) => update({ motion: e.target.value as MotionPreference })}>
                <option value="auto">Auto (system preference)</option>
                <option value="full">Full</option>
                <option value="reduced">Reduced</option>
                <option value="off">Off (static frame)</option>
              </select>
            </label>

            <p className="demo-kicker demo-kicker-gap">Light and composition</p>
            <label className="demo-toggle-field" title="Let the seed choose the light angle (upper left or upper right)">
              <input type="checkbox" checked={studio.lightAngle === null} onChange={(e) => update({ lightAngle: e.target.checked ? null : handle?.composition().light.angle ?? 225 })} />
              <span className="demo-toggle-label">Seeded light angle</span>
            </label>
            {studio.lightAngle !== null && (
              <label className="demo-field">
                <span>Light angle {Math.round(studio.lightAngle)}°</span>
                <input type="range" min={0} max={359} step={1} value={studio.lightAngle} onChange={(e) => update({ lightAngle: Number(e.target.value) })} />
              </label>
            )}
            <label className="demo-field">
              <span>Warmth {studio.warmth > 0 ? '+' : ''}{studio.warmth.toFixed(2)}</span>
              <input type="range" min={-1} max={1} step={0.05} value={studio.warmth} onChange={(e) => update({ warmth: Number(e.target.value) })} />
            </label>
            <label className="demo-field" title="Auto finds page content, makes layers recede there, and shades behind it above intensity 0.55">
              <span>Legibility</span>
              <select value={studio.legibility} onChange={(e) => update({ legibility: e.target.value as 'auto' | 'off' })}>
                <option value="auto">Auto (recede and shade behind content)</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="demo-field">
              <span>Transition between sources</span>
              <select value={transitionKind} onChange={(e) => setTransitionKind(e.target.value as TransitionKind)}>
                <option value="iris">Iris from the key light</option>
                <option value="wipe">Wipe from the lit side</option>
                <option value="crossfade">Crossfade</option>
              </select>
            </label>
            <label className="demo-toggle-field">
              <input type="checkbox" checked={showComposition} onChange={(e) => setShowComposition(e.target.checked)} />
              <span className="demo-toggle-label">Show composition (thirds, light, content, quiet zones)</span>
            </label>

            {!sceneMode && (
              <>
                <label className="demo-field">
                  <span>Density {studio.density.toFixed(2)}</span>
                  <input type="range" min={0.25} max={2} step={0.05} value={studio.density} onChange={(e) => update({ density: Number(e.target.value) })} />
                </label>
                {studio.source === 'void-tactical' && (
                  <label className="demo-field">
                    <span>Detail level</span>
                    <select value={studio.detail} onChange={(e) => update({ detail: e.target.value as LabelDensity })}>
                      {DETAIL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {skin?.schema && Object.keys(skin.schema).length > 0 && (
                  <div className="demo-toggles">
                    <p className="demo-kicker demo-kicker-gap">Fine tuning</p>
                    <SchemaControls
                      schema={Object.fromEntries(Object.entries(skin.schema).filter(([k]) => k !== 'universe'))}
                      values={studio.skinOptions}
                      onChange={(key, value) => update({ skinOptions: { ...studio.skinOptions, [key]: value } })}
                    />
                  </div>
                )}
              </>
            )}

            {sceneMode && studio.scene && (
              <LayerStack scene={studio.scene} onChange={setScene} />
            )}

            <div className="demo-export">
              <p className="demo-kicker demo-kicker-gap">Take it with you</p>
              <div className="demo-text-row">
                <button type="button" className="demo-primary" onClick={() => copy('prompt', promptText())}>
                  {copied === 'prompt' ? 'Copied' : 'Copy prompt for your AI'}
                </button>
                <button type="button" onClick={() => copy('link', window.location.href)}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
              </div>
              <div className="demo-text-row">
                <button type="button" onClick={() => saveImage('image/png')} disabled={!!busy} title="Still image, wallpaper size">
                  Wallpaper (PNG)
                </button>
                <button type="button" onClick={saveVideo} disabled={!!busy} title="8 second loop at 30 fps">
                  Video loop
                </button>
              </div>
              {busy && <p className="demo-hint demo-busy">{busy}</p>}
              <details className="demo-details">
                <summary>Code</summary>
                <textarea readOnly value={snippet} rows={8} spellCheck={false} aria-label="mount() snippet" />
                <div className="demo-text-row">
                  <button type="button" onClick={() => copy('code', snippet)}>{copied === 'code' ? 'Copied' : 'Copy code'}</button>
                  <button type="button" onClick={saveJson} title="Download this configuration as JSON">JSON</button>
                  <label className="demo-file-button" title="Load a configuration JSON">
                    Load
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
                  <button type="button" onClick={() => saveImage('image/webp')} disabled={!!busy}>WebP</button>
                </div>
              </details>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

/**
 * Preset gallery. Images are the e2e screenshot baselines copied to public/gallery
 * by `pnpm sync-gallery`, so a card shows the exact pixels the tests protect.
 */
type GalleryEntry = { key: string; image: string; source: string; universe?: string; label: string; description?: string; tags: string[]; community?: boolean };

function Gallery({ onPick, onClose }: { onPick: (source: string, universe?: string) => void; onClose: () => void }) {
  const [available, setAvailable] = useState<string[] | null>(null);
  useEffect(() => {
    fetch('/gallery/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: string[]) => setAvailable(list))
      .catch(() => setAvailable([]));
  }, []);
  const vt = getSkin('void-tactical');
  const featured: GalleryEntry[] = [
    ...listUniverses().map((u) => ({
      key: `vt-${u.id}`,
      image: u.id === 'void' ? 'void-tactical' : `void-tactical-${u.id}`,
      source: 'void-tactical',
      universe: u.id,
      label: u.id === 'void' ? vt?.label ?? 'Void tactical' : `${u.name}`,
      description: u.tagline ?? vt?.description,
      tags: ['sector map', u.id === 'void' ? 'the original' : 'universe'],
    })),
    ...instrumentSkins.map((s) => ({ key: s.id, image: s.id, source: s.id, label: s.label ?? s.id, description: s.description, tags: (s.tags ?? []).filter((t) => t !== 'instrument' && t !== 'dark') })),
  ];
  const basics: GalleryEntry[] = allPresets.map((p) => ({
    key: p.id,
    image: p.id,
    source: p.id,
    label: p.label ?? p.id,
    description: p.description,
    tags: (p.tags ?? []).filter((t) => t !== 'community'),
    community: (p.tags ?? []).includes('community'),
  }));
  const card = (e: GalleryEntry) => (
    <button type="button" key={e.key} className="demo-card" onClick={() => onPick(e.source, e.universe)}>
      {available?.includes(e.image) ? <img src={`/gallery/${e.image}.png`} alt="" loading="lazy" /> : <span className="demo-card-placeholder">no preview yet</span>}
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
        <p className="demo-kicker">Featured</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div className="demo-gallery-grid">{featured.map(card)}</div>
      <p className="demo-kicker demo-kicker-gap">Basics</p>
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
    <div className="demo-toggles">
      <p className="demo-kicker demo-kicker-gap">Layers (bottom to top)</p>
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
                <label className="demo-field">
                  <span>Opacity {(ref.opacity ?? 1).toFixed(2)}</span>
                  <input type="range" min={0} max={1} step={0.05} value={ref.opacity ?? 1} onChange={(e) => patch(i, { opacity: Number(e.target.value) })} />
                </label>
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
        <button type="button" onClick={add}>Add layer</button>
      </div>
    </div>
  );
}

/** The universe's mechanics as switches, each with its own tuning. Editing makes a copy; reset drops it. */
function MechanicsPanel({ refs, custom, onChange, onReset }: { refs: MechanicRef[]; custom: boolean; onChange: (next: MechanicRef[]) => void; onReset: () => void }) {
  const live = (id: string) => refs.find((r) => r.use === id && r.enabled !== false);
  const toggle = (id: string) => {
    const existing = refs.find((r) => r.use === id);
    onChange(existing ? refs.map((r) => (r.use === id ? { ...r, enabled: r.enabled === false } : r)) : [...refs, { use: id }]);
  };
  const tune = (id: string, key: string, value: unknown) => onChange(refs.map((r) => (r.use === id ? { ...r, with: { ...(r.with ?? {}), [key]: value } } : r)));
  return (
    <div className="demo-mechanics">
      <p className="demo-kicker demo-kicker-gap">What happens here</p>
      {listMechanics().map((m) => {
        const ref = live(m.id);
        return (
          <div key={m.id}>
            <label className="demo-toggle-field" title={m.description}>
              <input type="checkbox" checked={!!ref} onChange={() => toggle(m.id)} />
              <span className="demo-toggle-label">{m.label}</span>
            </label>
            {ref && Object.keys(m.schema).length > 0 && (
              <details className="demo-details">
                <summary>Tune {m.label.toLowerCase()}</summary>
                <em className="demo-hint">{m.description}</em>
                <SchemaControls schema={m.schema} values={{ ...schemaDefaults(m.schema), ...(ref.with ?? {}) }} onChange={(key, value) => tune(m.id, key, value)} />
              </details>
            )}
          </div>
        );
      })}
      {custom && (
        <button type="button" onClick={onReset}>
          Back to this universe&apos;s own
        </button>
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
      return (
        <label className="demo-field" title={field.description}>
          <span>{label} {Number.isInteger(step) ? v : v.toFixed(2)}</span>
          <input type="range" min={field.min} max={field.max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
        </label>
      );
    }
    case 'boolean':
      return (
        <label className="demo-toggle-field" title={field.description}>
          <input type="checkbox" checked={typeof value === 'boolean' ? value : field.default} onChange={(e) => onChange(e.target.checked)} />
          <span className="demo-toggle-label">{label}</span>
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
