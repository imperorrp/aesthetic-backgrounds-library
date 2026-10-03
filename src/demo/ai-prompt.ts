/**
 * The studio's main export: a short prompt for whatever AI builds your site. It
 * carries only the configuration; the repository documents the rest.
 */
export function aiPrompt(config: Record<string, unknown>, hasPackFile = false): string {
  const cfg = JSON.stringify(config);
  return [
    'Add this animated background to my site using the npm package `space-background-engine` (docs: https://github.com/imperorrp/aesthetic-backgrounds-library).',
    hasPackFile ? "`import universe from './universe.json'` (the file I'm attaching), then:" : '',
    `mount(document.body, ${cfg})`,
    'Mount it once at the app root, behind all content (content gets position: relative; z-index: 1). Keep these exact values; do not restyle or replace it.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Drop everything that equals its default so the configuration stays short. */
export function compactConfig(config: Record<string, unknown>, defaults: Record<string, unknown>, optionDefaults: Record<string, unknown> = {}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (v === undefined || v === null) continue;
    if (k === 'options' && v && typeof v === 'object' && !Array.isArray(v) && !('layers' in v)) {
      const opts = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([ok, ov]) => ov !== undefined && JSON.stringify(ov) !== JSON.stringify(optionDefaults[ok])));
      if (Object.keys(opts).length) out.options = opts;
      continue;
    }
    if (k in defaults && JSON.stringify(defaults[k]) === JSON.stringify(v)) continue;
    out[k] = v;
  }
  return out;
}
