/**
 * Design-token bridge. Export a palette in the W3C Design Tokens Community Group
 * format (what Figma Variables importers and Tokens Studio read), and derive a
 * palette from a brand's existing token file instead of retyping hex values.
 */
import { contrastRatio, parseHex, relativeLuminance } from './color';
import type { Palette, PaletteSpec, PaletteTheme } from './palette';

type DtcgColor = { $type: 'color'; $value: string; $description?: string };
export type DtcgTokens = Record<string, unknown>;

/** Palette as DTCG tokens under a group name (default `bge`). */
export function paletteToTokens(p: Palette, group = 'bge'): DtcgTokens {
  const c = (value: string, description: string): DtcgColor => ({ $type: 'color', $value: value, $description: description });
  const tokens: Record<string, DtcgColor> = {
    bg: c(p.bg, 'Background plate'),
    ink: c(p.ink, 'Primary text on the background'),
    'ink-dim': c(p.inkDim, 'Secondary text'),
    accent: c(p.accent, 'Accent and highlights'),
    hazard: c(p.hazard, 'Alerts and warnings'),
  };
  if (p.accent2) tokens['accent-2'] = c(p.accent2, 'Second harmony hue');
  if (p.accent3) tokens['accent-3'] = c(p.accent3, 'Third harmony hue');
  return { [group]: { $description: `${p.label} (${p.theme})`, ...tokens } };
}

/** Flatten nested token groups into `path -> value` for any token-ish JSON. */
function flatten(node: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (!node || typeof node !== 'object') return out;
  const obj = node as Record<string, unknown>;
  const direct = obj.$value ?? obj.value;
  if (typeof direct === 'string') {
    out[prefix] = direct;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$')) continue;
    if (typeof v === 'string' && parseHex(v)) out[prefix ? `${prefix}.${k}` : k] = v;
    else flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const FIRST_MATCH = (flat: Record<string, string>, patterns: RegExp[]): string | undefined => {
  const entries = Object.entries(flat).filter(([, v]) => parseHex(v));
  for (const re of patterns) {
    const hit = entries.find(([k]) => re.test(k.toLowerCase()));
    if (hit) return hit[1];
  }
  return undefined;
};

/**
 * Read a token file (DTCG, Style Dictionary, Tokens Studio, or a flat map) and
 * return a palette spec. Finds the brand/primary/accent color by common names;
 * when background and text colors are present it keeps them and infers the theme.
 */
export function paletteFromTokens(json: unknown): PaletteSpec {
  const flat = flatten(json);
  const accent = FIRST_MATCH(flat, [/(^|\.)(bge\.)?accent$/, /brand(\.|-)?(primary|500|base|default)?$/, /primary(\.|-)?(500|base|default)?$/, /accent/, /brand/, /primary/]);
  if (!accent) throw new Error('paletteFromTokens: no accent, brand, or primary color found');
  const bg = FIRST_MATCH(flat, [/(^|\.)(bge\.)?bg$/, /background(\.|-)?(default|base|primary)?$/, /surface(\.|-)?(default|base)?$/, /(^|\.)bg/]);
  const ink = FIRST_MATCH(flat, [/(^|\.)(bge\.)?ink$/, /(text|foreground|fg)(\.|-)?(default|primary|base)?$/, /on-?background/]);

  let theme: PaletteTheme = 'dark';
  if (bg) theme = relativeLuminance(parseHex(bg)!) > 0.4 ? 'light' : 'dark';

  if (bg && ink && contrastRatio(parseHex(bg)!, parseHex(ink)!) >= 4.5) {
    // Enough to keep the brand's own surface and text; derive the rest from the accent.
    return { from: accent, theme, bg, ink };
  }
  return { from: accent, theme };
}
