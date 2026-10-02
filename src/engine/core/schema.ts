/**
 * Option schemas: one declaration per skin or layer that drives validation with
 * defaults, playground controls, element attributes, generated docs, and gives
 * agents a structured target to fill in.
 */
import { parseHex, toTriplet } from '../color';
import type { Palette } from '../palette';

type Common = { label?: string; description?: string };

export type FieldSchema =
  | (Common & { type: 'number'; min: number; max: number; step?: number; default: number })
  | (Common & { type: 'boolean'; default: boolean })
  | (Common & { type: 'enum'; values: readonly string[]; default: string })
  /** A hex color or a palette token: `accent`, `ink`, `inkDim`, `bg`, `hazard`. */
  | (Common & { type: 'color'; default: string })
  | (Common & { type: 'string'; default: string });

export type Schema = Record<string, FieldSchema>;

/** Infer the resolved options object type from a schema literal. */
export type OptionsOf<S extends Schema> = {
  [K in keyof S]: S[K] extends { type: 'number' }
    ? number
    : S[K] extends { type: 'boolean' }
      ? boolean
      : S[K] extends { type: 'enum'; values: readonly (infer V)[] }
        ? V
        : string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function schemaDefaults<S extends Schema>(schema: S): OptionsOf<S> {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) out[key] = field.default;
  return out as OptionsOf<S>;
}

/**
 * Fill defaults, clamp numbers to their range, reject unknown enum values.
 * Never throws: bad input degrades to the default so a typo in a JSON preset
 * cannot take a page down.
 */
export function resolveOptions<S extends Schema>(schema: S, input: unknown): OptionsOf<S> {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(schema)) {
    const raw = src[key];
    switch (field.type) {
      case 'number': {
        const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw);
        out[key] = Number.isFinite(n) && raw !== undefined && raw !== null && raw !== '' ? clamp(n, field.min, field.max) : field.default;
        break;
      }
      case 'boolean':
        out[key] = typeof raw === 'boolean' ? raw : raw === 'true' ? true : raw === 'false' ? false : field.default;
        break;
      case 'enum':
        out[key] = typeof raw === 'string' && field.values.includes(raw) ? raw : field.default;
        break;
      case 'color':
        out[key] = typeof raw === 'string' && raw.trim() ? raw.trim() : field.default;
        break;
      case 'string':
        out[key] = typeof raw === 'string' ? raw : field.default;
        break;
    }
  }
  return out as OptionsOf<S>;
}

export type ResolvedColor = { hex: string; rgb: string };

const TOKENS: Record<string, (p: Palette) => ResolvedColor> = {
  accent: (p) => ({ hex: p.accent, rgb: p.accentRgb }),
  ink: (p) => ({ hex: p.ink, rgb: p.inkRgb }),
  inkDim: (p) => ({ hex: p.inkDim, rgb: toTriplet(parseHex(p.inkDim)!) }),
  bg: (p) => ({ hex: p.bg, rgb: toTriplet(parseHex(p.bg)!) }),
  hazard: (p) => ({ hex: p.hazard, rgb: p.hazardRgb }),
  accent2: (p) => ({ hex: p.accent2, rgb: p.accent2Rgb }),
  accent3: (p) => ({ hex: p.accent3, rgb: p.accent3Rgb }),
};

/** Resolve a `color` field value (palette token or hex) against the active palette. */
export function resolveColor(value: string, palette: Palette): ResolvedColor {
  const token = TOKENS[value];
  if (token) return token(palette);
  const rgb = parseHex(value);
  if (rgb) return { hex: value.startsWith('#') ? value : `#${value}`, rgb: toTriplet(rgb) };
  return TOKENS.accent(palette);
}

export const COLOR_TOKENS = Object.keys(TOKENS);
