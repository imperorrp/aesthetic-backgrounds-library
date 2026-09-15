export type PaletteId = 'void-cyan' | 'amber' | 'violet';

export type Palette = {
  id: PaletteId;
  label: string;
  bg: string;
  ink: string;
  inkDim: string;
  accent: string;
  accentRgb: string;
  hazard: string;
  hazardRgb: string;
};

export const PALETTES: Record<PaletteId, Palette> = {
  'void-cyan': {
    id: 'void-cyan',
    label: 'Void cyan',
    bg: '#030308',
    ink: '#e8f4f8',
    inkDim: '#9bb4c0',
    accent: '#06b6d4',
    accentRgb: '6 182 212',
    hazard: '#f87171',
    hazardRgb: '248 113 113',
  },
  amber: {
    id: 'amber',
    label: 'Amber analog',
    bg: '#070604',
    ink: '#f4ecd8',
    inkDim: '#b8a888',
    accent: '#d4a017',
    accentRgb: '212 160 23',
    hazard: '#e11d48',
    hazardRgb: '225 29 72',
  },
  violet: {
    id: 'violet',
    label: 'Violet void',
    bg: '#06040c',
    ink: '#ece8f8',
    inkDim: '#a89cc8',
    accent: '#a78bfa',
    accentRgb: '167 139 250',
    hazard: '#fb7185',
    hazardRgb: '251 113 133',
  },
};

export const PALETTE_OPTIONS: { value: PaletteId; label: string }[] = (
  Object.values(PALETTES).map((p) => ({ value: p.id, label: p.label }))
);

/** Writes palette tokens onto an element (default: :root) so canvas and CSS share one accent. */
export function applyPalette(id: PaletteId, target: HTMLElement = document.documentElement): void {
  const p = PALETTES[id];
  target.style.setProperty('--bg', p.bg);
  target.style.setProperty('--ink', p.ink);
  target.style.setProperty('--ink-dim', p.inkDim);
  target.style.setProperty('--accent', p.accent);
  target.style.setProperty('--accent-rgb', p.accentRgb);
  target.style.setProperty('--accent-blue-rgb', p.accentRgb);
  target.style.setProperty('--hazard', p.hazard);
  target.style.setProperty('--hazard-rgb', p.hazardRgb);
  target.dataset.palette = id;
}
