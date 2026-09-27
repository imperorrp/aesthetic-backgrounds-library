import { useEffect, useMemo, useRef, useState } from 'react';
import { Background } from '../react-entry';
import {
  COLOR_TOKENS,
  DETAIL_OPTIONS,
  PALETTE_OPTIONS,
  builtInSkins,
  createRng,
  getLayer,
  getSkin,
  listLayers,
  presets,
  probeContrast,
  randomSeedString,
  resolvePalette,
  schemaDefaults,
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
import {
  History,
  contentShadeFor,
  download,
  exportImage,
  exportVideo,
  jitterOptions,
  jitterScene,
  type ExportOptions,
} from './studio-tools';
import './DemoPage.css';

type PaletteMode = PaletteId | 'custom';

type Studio = {
  /** Preset id, skin id, or `scene` for a blank custom scene. */
  source: string;
  scene: Scene | null;
  skinOptions: Record<string, unknown>;
  seed: string;
  paletteMode: PaletteMode;
  customHex: string;
  theme: 'dark' | 'light';
  intensity: number;
  motion: MotionPreference;
  density: number;
  detail: LabelDensity;
};

const BLENDS: GlobalCompositeOperation[] = ['source-over', 'lighter', 'screen', 'multiply', 'overlay', 'soft-light'];

/** Curated presets plus the void-sector preset, which lives with the void-tactical skin. */
const allPresets = [voidSectorPreset, ...presets];
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
    intensity: 1,
    motion: prev?.motion ?? 'auto',
    density: prev?.density ?? 1,
    detail: prev?.detail ?? 'low',
  };
  const applyDefaults = (d: { palette?: PaletteSpec; intensity?: number; density?: number; detail?: LabelDensity } | undefined) => {
    if (!d) return;
    if (typeof d.palette === 'string') {
      base.paletteMode = d.palette as PaletteId;
    } else if (d.palette && typeof d.palette === 'object' && 'from' in d.palette) {
      base.paletteMode = 'custom';
      base.customHex = d.palette.from;
      base.theme = d.palette.theme ?? 'dark';
    }
    if (typeof d.intensity === 'number') base.intensity = d.intensity;
    if (typeof d.density === 'number') base.density = d.density;
    if (d.detail) base.detail = d.detail;
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
  const json = JSON.stringify(s);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(hash: string): Studio | null {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json) as Studio;
    if (!parsed || typeof parsed.source !== 'string') return null;
    return { ...studioFor(parsed.source), ...parsed };
  } catch {
    return null;
  }
}

function paletteOf(s: Studio): PaletteSpec {
  return s.paletteMode === 'custom' ? { from: s.customHex, theme: s.theme } : s.paletteMode;
}

export default function DemoPage() {
  const [studio, setStudio] = useState<Studio>(() => {
    if (typeof window === 'undefined') return studioFor('calm-mesh');
    return decodeState(window.location.hash) ?? studioFor('calm-mesh');
  });
  const [panelOpen, setPanelOpen] = useState(true);
  const [seedDraft, setSeedDraft] = useState(studio.seed);
  const [copied, setCopied] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [report, setReport] = useState<ContrastReport | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const historyRef = useRef(new History<Studio>());
  const history = historyRef.current;

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

  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = `s=${encodeState(studio)}`;
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
    if (sceneMode) cfg.options = studio.scene;
    else {
      if (Object.keys(studio.skinOptions).length) cfg.options = studio.skinOptions;
      cfg.density = studio.density;
      if (studio.source === 'void-tactical') cfg.detail = studio.detail;
    }
    return cfg;
  }, [studio, sceneMode, palette]);

  const snippet = `import { mount } from 'space-background-engine';\n\nmount(document.body, ${JSON.stringify(exportConfig, null, 2)});`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; the textarea is selectable */
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

  /** Perturb every option inside its schema range; the stack and palette stay. */
  const randomize = () => {
    const key = randomSeedString();
    commit((s) => {
      if (s.scene) return { ...s, scene: jitterScene(s.scene, key, 0.3) };
      const sk = getSkin(s.source);
      if (!sk?.schema) return s;
      const rng = createRng(key);
      return { ...s, skinOptions: jitterOptions(sk.schema, { ...schemaDefaults(sk.schema), ...s.skinOptions }, rng, 0.3) };
    });
  };

  /** Add or refit a content-shade layer to the measured content column. */
  const fitShade = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.bg-engine-root canvas');
    if (!canvas || !studio.scene) return;
    const ref = contentShadeFor(canvas, 0.45);
    if (!ref) return;
    setScene((scene) => {
      const i = scene.layers.findIndex((l) => l.use === 'content-shade');
      if (i >= 0) return { layers: scene.layers.map((l, j) => (j === i ? { ...l, with: ref.with } : l)) };
      const at = Math.max(0, scene.layers.findIndex((l) => l.use === 'grain' || l.use === 'scanlines'));
      const layers = [...scene.layers];
      layers.splice(at > 0 ? at : layers.length, 0, ref);
      return { layers };
    });
  };

  const applySeed = (next: string) => {
    const value = next.trim() || randomSeedString();
    setSeedDraft(value);
    update({ seed: value });
  };

  return (
    <div className="demo-root">
      <Background
        key={`${studio.source}-${sceneMode}`}
        skin={sceneMode ? 'scene' : studio.source}
        options={sceneMode ? studio.scene ?? { layers: [] } : studio.skinOptions}
        seed={studio.seed}
        palette={palette}
        intensity={studio.intensity}
        motion={studio.motion}
        density={studio.density}
        detail={studio.detail}
        adaptiveQuality
        pauseWhenHidden={false}
      />

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
          onPick={(id) => {
            const next = studioFor(id, studio);
            commit(() => next);
            setSeedDraft(next.seed);
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
            <p className="demo-kicker">Background engine · {studio.source}</p>

            <div className="demo-text-row demo-toolbar">
              <button type="button" onClick={undo} disabled={!history.canUndo} title="Ctrl/Cmd+Z">Undo</button>
              <button type="button" onClick={redo} disabled={!history.canRedo} title="Ctrl/Cmd+Shift+Z">Redo</button>
              <button type="button" onClick={randomize} title="Perturb every option inside its schema range">Randomize</button>
              {sceneMode && <button type="button" onClick={fitShade} title="Fit a content-shade layer to the page's content column">Fit shade</button>}
            </div>

            <label className="demo-field">
              <span>Source</span>
              <select
                value={studio.source}
                onChange={(e) => {
                  const next = studioFor(e.target.value, studio);
                  setStudio(next);
                  setSeedDraft(next.seed);
                }}
              >
                <optgroup label="Presets (scenes)">
                  {allPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="scene">Blank scene</option>
                </optgroup>
                <optgroup label="Skins">
                  {builtInSkins.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label ?? s.id}
                    </option>
                  ))}
                </optgroup>
              </select>
              {(getSkin(studio.source)?.description) && <em className="demo-hint">{getSkin(studio.source)?.description}</em>}
            </label>

            <label className="demo-field">
              <span>Seed</span>
              <span className="demo-text-row">
                <input
                  value={seedDraft}
                  onChange={(e) => setSeedDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applySeed(seedDraft);
                  }}
                  spellCheck={false}
                  aria-label="Seed"
                />
                <button type="button" onClick={() => applySeed(seedDraft)}>Apply</button>
                <button type="button" onClick={() => applySeed(randomSeedString())}>Random</button>
              </span>
            </label>

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
              </div>
            )}

            <label className="demo-toggle-field">
              <input type="checkbox" checked={showContent} onChange={(e) => setShowContent(e.target.checked)} />
              <span className="demo-toggle-label">Sample content column</span>
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
                    <p className="demo-kicker demo-kicker-gap">Skin options</p>
                    <SchemaControls
                      schema={skin.schema}
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
              <p className="demo-kicker demo-kicker-gap">Export</p>
              <textarea readOnly value={snippet} rows={8} spellCheck={false} aria-label="mount() snippet" />
              <div className="demo-text-row">
                <button type="button" onClick={copySnippet}>{copied ? 'Copied' : 'Copy snippet'}</button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => undefined)}
                >
                  Copy link
                </button>
                <button type="button" onClick={saveJson} title="Download this configuration as JSON">JSON</button>
                <label className="demo-file-button" title="Load a preset JSON">
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
              </div>
              <div className="demo-text-row">
                <button type="button" onClick={() => saveImage('image/png')} disabled={!!busy} title="Still image including DOM layers such as grain">
                  PNG
                </button>
                <button type="button" onClick={() => saveImage('image/webp')} disabled={!!busy}>WebP</button>
                <button type="button" onClick={saveVideo} disabled={!!busy} title="8 second loop at 30 fps, rendered on a fixed clock">
                  WebM loop
                </button>
              </div>
              {busy && <p className="demo-hint demo-busy">{busy}</p>}
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
function Gallery({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [available, setAvailable] = useState<string[] | null>(null);
  useEffect(() => {
    fetch('/gallery/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: string[]) => setAvailable(list))
      .catch(() => setAvailable([]));
  }, []);
  const entries = allPresets.map((p) => ({ id: p.id, label: p.label ?? p.id, description: p.description, tags: p.tags ?? [] }));
  return (
    <div className="demo-gallery" role="dialog" aria-label="Preset gallery">
      <div className="demo-gallery-head">
        <p className="demo-kicker">Presets</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div className="demo-gallery-grid">
        {entries.map((e) => (
          <button type="button" key={e.id} className="demo-card" onClick={() => onPick(e.id)}>
            {available?.includes(e.id) ? (
              <img src={`/gallery/${e.id}.png`} alt="" loading="lazy" />
            ) : (
              <span className="demo-card-placeholder">no preview yet</span>
            )}
            <strong>{e.label}</strong>
            <em>{e.description}</em>
            <span className="demo-card-tags">{e.tags.join(' · ')}</span>
          </button>
        ))}
      </div>
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
