import { useEffect, useMemo, useState } from 'react';
import {
  AmbientOverlays,
  BackgroundCanvas,
  CursorTrail,
  DETAIL_OPTIONS,
  PALETTE_OPTIONS,
  applyPalette,
  randomSeedString,
  type AmbientLayerFlags,
  type BackgroundConfig,
  type LabelDensity,
  type PaletteId,
} from '../engine';
import './DemoPage.css';

type LayerKey = keyof AmbientLayerFlags | 'simulation' | 'cursor';

const LAYER_LABELS: { key: LayerKey; label: string; hint: string }[] = [
  { key: 'simulation', label: 'Scene', hint: 'Active skin draw loop' },
  { key: 'gradient', label: 'Space gradient', hint: 'Deep radial void' },
  { key: 'mesh', label: 'Mesh constellations', hint: 'Drifting SVG star lines' },
  { key: 'asciiGrid', label: 'Tactical grid', hint: 'Accent sector lattice' },
  { key: 'ascii1', label: 'ASCII map 1', hint: 'Optional nav wallpaper' },
  { key: 'ascii2', label: 'ASCII map 2', hint: 'Optional telemetry wallpaper' },
  { key: 'clouds', label: 'Dust clouds', hint: 'Blurred nebula masks' },
  { key: 'noise', label: 'Noise grain', hint: 'feTurbulence overlay' },
  { key: 'mouseGlow', label: 'Mouse glow', hint: 'Radial spotlight' },
  { key: 'cursor', label: 'Cursor trail', hint: 'Eased follow dots' },
];

const DEFAULT_LAYERS: Record<LayerKey, boolean> = {
  simulation: true,
  gradient: true,
  mesh: true,
  asciiGrid: true,
  ascii1: false,
  ascii2: false,
  clouds: true,
  noise: true,
  starfield: false,
  mouseGlow: true,
  cursor: true,
};

function readSeedFromUrl(): string {
  if (typeof window === 'undefined') return randomSeedString();
  const fromUrl = new URLSearchParams(window.location.search).get('seed');
  return fromUrl && fromUrl.trim() ? fromUrl.trim() : randomSeedString();
}

function writeSeedToUrl(seed: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  window.history.replaceState(null, '', url.toString());
}

export default function DemoPage() {
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [seed, setSeed] = useState(readSeedFromUrl);
  const [seedDraft, setSeedDraft] = useState(seed);

  useEffect(() => {
    writeSeedToUrl(seed);
  }, [seed]);
  const [detail, setDetail] = useState<LabelDensity>('low');
  const [density, setDensity] = useState(1);
  const [palette, setPalette] = useState<PaletteId>('void-cyan');

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  const overlayFlags = useMemo<AmbientLayerFlags>(
    () => ({
      gradient: layers.gradient,
      mesh: layers.mesh,
      asciiGrid: layers.asciiGrid,
      ascii1: layers.ascii1,
      ascii2: layers.ascii2,
      clouds: layers.clouds,
      noise: layers.noise,
      mouseGlow: layers.mouseGlow,
    }),
    [layers],
  );

  const simConfig = useMemo<BackgroundConfig>(
    () => ({ seed, density, detail, palette }),
    [seed, density, detail, palette],
  );

  const applySeed = (next: string) => {
    const value = next.trim() || randomSeedString();
    setSeed(value);
    setSeedDraft(value);
    writeSeedToUrl(value);
  };

  const toggle = (key: LayerKey) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="demo-root">
      <AmbientOverlays layers={overlayFlags}>
        {layers.simulation && <BackgroundCanvas config={simConfig} />}
      </AmbientOverlays>

      {layers.cursor && <CursorTrail />}

      <header className="demo-hud">
        <button
          type="button"
          className="demo-hud-toggle"
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
        >
          {panelOpen ? 'Hide controls' : 'Show controls'}
        </button>

        {panelOpen && (
          <div className="demo-panel">
            <p className="demo-kicker">Background engine · void-tactical</p>

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
                  aria-label="Sector seed"
                />
                <button type="button" onClick={() => applySeed(seedDraft)}>
                  Apply
                </button>
                <button type="button" onClick={() => applySeed(randomSeedString())}>
                  Random
                </button>
              </span>
            </label>

            <label className="demo-field">
              <span>Palette</span>
              <select
                value={palette}
                onChange={(e) => setPalette(e.target.value as PaletteId)}
              >
                {PALETTE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="demo-field">
              <span>Detail</span>
              <select
                value={detail}
                onChange={(e) => setDetail(e.target.value as LabelDensity)}
              >
                {DETAIL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="demo-field">
              <span>Density {density.toFixed(2)}</span>
              <input
                type="range"
                min={0.4}
                max={1.6}
                step={0.1}
                value={density}
                onChange={(e) => setDensity(Number(e.target.value))}
              />
            </label>

            <ul className="demo-layer-list">
              {LAYER_LABELS.map((item) => (
                <li key={item.key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={layers[item.key]}
                      onChange={() => toggle(item.key)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <em>{item.hint}</em>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </div>
  );
}
