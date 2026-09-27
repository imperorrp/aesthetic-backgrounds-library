import { useEffect, useMemo, useState } from 'react';
import { Background } from '../react-entry';
import {
  COLOR_TOKENS,
  DETAIL_OPTIONS,
  PALETTE_OPTIONS,
  builtInSkins,
  getLayer,
  getSkin,
  listLayers,
  presets,
  randomSeedString,
  schemaDefaults,
  type FieldSchema,
  type LabelDensity,
  type MotionPreference,
  type PaletteId,
  type PaletteSpec,
  type Scene,
  type SceneLayer,
  type Schema,
} from '../engine';
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

const presetIds = new Set(presets.map((p) => p.id));
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
  const applyDefaults = (d: { palette?: PaletteSpec; intensity?: number } | undefined) => {
    if (!d) return;
    if (typeof d.palette === 'string') {
      base.paletteMode = d.palette as PaletteId;
    } else if (d.palette && typeof d.palette === 'object' && 'from' in d.palette) {
      base.paletteMode = 'custom';
      base.customHex = d.palette.from;
      base.theme = d.palette.theme ?? 'dark';
    }
    if (typeof d.intensity === 'number') base.intensity = d.intensity;
  };
  const preset = presets.find((p) => p.id === source);
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

  useEffect(() => {
    const url = new URL(window.location.href);
    url.hash = `s=${encodeState(studio)}`;
    window.history.replaceState(null, '', url.toString());
  }, [studio]);

  const update = (patch: Partial<Studio>) => setStudio((s) => ({ ...s, ...patch }));
  const setScene = (fn: (scene: Scene) => Scene) =>
    setStudio((s) => (s.scene ? { ...s, scene: fn(s.scene) } : s));

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

  const exportPng = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.bg-engine-root canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${studio.source}-${studio.seed}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
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
      />

      <header className="demo-hud">
        <button type="button" className="demo-hud-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          {panelOpen ? 'Hide studio' : 'Show studio'}
        </button>

        {panelOpen && (
          <div className="demo-panel">
            <p className="demo-kicker">Background engine · {studio.source}</p>

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
                  {presets.map((p) => (
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
                  <input type="range" min={0.4} max={1.6} step={0.1} value={studio.density} onChange={(e) => update({ density: Number(e.target.value) })} />
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
                <button type="button" onClick={exportPng} title="Canvas layers only; DOM layers such as grain are not included">PNG</button>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(window.location.href).catch(() => undefined)}
                >
                  Copy link
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
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
