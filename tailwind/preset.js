/**
 * Tailwind CSS v3 preset: background palette tokens as theme colors, with
 * opacity modifiers (`bg-bge-accent/20`) via the RGB-triplet variables.
 *
 *   // tailwind.config.js
 *   import bge from 'space-background-engine/tailwind-preset';
 *   export default { presets: [bge], content: [...] };
 *
 * Mount with `exposeTokens: true` so the variables are defined on <html>.
 */
const rgb = (name) => `rgb(var(--bge-${name}-rgb) / <alpha-value>)`;

export default {
  theme: {
    extend: {
      colors: {
        bge: {
          bg: 'var(--bge-bg)',
          ink: rgb('ink'),
          'ink-dim': 'var(--bge-ink-dim)',
          accent: rgb('accent'),
          accent2: rgb('accent2'),
          accent3: rgb('accent3'),
          hazard: rgb('hazard'),
        },
      },
    },
  },
};
