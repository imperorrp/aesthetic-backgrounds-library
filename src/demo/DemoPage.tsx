import { useEffect, useMemo, useState } from 'react';
import {
  BackgroundCanvas,
  CursorTrail,
  DETAIL_OPTIONS,
  PALETTE_OPTIONS,
  applyPalette,
  randomSeedString,
  driftingDustSkin,
  voidTacticalSkin,
  matrixRainSkin,
  type BackgroundConfig,
  type LabelDensity,
  type PaletteId,
} from '../engine';
import { AmbientOverlays, type AmbientLayerFlags } from '../engine/skins/void-tactical/AmbientOverlays';
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
  const [skinId, setSkinId] = useState<'void-tactical' | 'drifting-dust' | 'matrix-rain'>('void-tactical');
  const [intensity, setIntensity] = useState(1);
  const [motion, setMotion] = useState<'auto' | 'full' | 'reduced' | 'off'>('auto');

  const activeSkin = skinId === 'drifting-dust' ? driftingDustSkin : skinId === 'matrix-rain' ? matrixRainSkin : voidTacticalSkin;

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
    () => ({ seed, density, detail, palette, intensity, motion }),
    [seed, density, detail, palette, intensity, motion],
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
      {skinId === 'void-tactical' ? (
        <AmbientOverlays layers={overlayFlags}>
          {layers.simulation && <BackgroundCanvas config={simConfig} skin={activeSkin} />}
        </AmbientOverlays>
      ) : (
        layers.simulation && <BackgroundCanvas config={simConfig} skin={activeSkin} />
      )}

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
            <p className="demo-kicker">Background engine · {activeSkin.id}</p>

            <label className="demo-field">
              <span>Skin</span>
              <select value={skinId} onChange={(e) => setSkinId(e.target.value as any)}>
                <option value="void-tactical">Void Tactical</option>
                <option value="drifting-dust">Drifting Dust</option>
                <option value="matrix-rain">Matrix Rain</option>
              </select>
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
              <span>Detail level</span>
              <select value={detail} onChange={(e) => setDetail(e.target.value as any)}>
                {DETAIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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

            <label className="demo-field">
              <span>Intensity {intensity.toFixed(2)}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={intensity}
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
            </label>

            <label className="demo-field">
              <span>Motion</span>
              <select value={motion} onChange={(e) => setMotion(e.target.value as any)}>
                <option value="auto">Auto (system preference)</option>
                <option value="full">Full</option>
                <option value="reduced">Reduced</option>
                <option value="off">Off (static frame)</option>
              </select>
            </label>

            {skinId === 'void-tactical' && (
              <div className="demo-toggles">
                <p className="demo-kicker" style={{ marginTop: '1rem' }}>
                  Ambient Layers
                </p>
                {LAYER_LABELS.map((item) => (
                  <label key={item.key} className="demo-toggle-field">
                    <input
                      type="checkbox"
                      checked={layers[item.key]}
                      onChange={() => toggle(item.key)}
                    />
                    <div className="demo-toggle-text">
                      <span className="demo-toggle-label">{item.label}</span>
                      <span className="demo-toggle-hint">{item.hint}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
    </div>
  );
}
