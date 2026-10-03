/**
 * The studio's main export: a prompt you paste into whatever AI builds your site.
 * It carries the exact configuration and the few rules that keep the result right,
 * so the AI wires up this background instead of inventing a lookalike.
 */
export function aiPrompt(config: Record<string, unknown>, label: string): string {
  const json = JSON.stringify(config, null, 2);
  const attrs: string[] = [];
  if (typeof config.skin === 'string' && config.skin !== 'scene') attrs.push(`skin="${config.skin}"`);
  if (typeof config.seed === 'string') attrs.push(`seed="${config.seed}"`);
  if (typeof config.palette === 'string') attrs.push(`palette="${config.palette}"`);
  if (typeof config.intensity === 'number') attrs.push(`intensity="${config.intensity}"`);
  const elementOk = !config.options || (typeof config.skin === 'string' && config.skin !== 'scene' && !('pack' in (config.options as object)));

  return `Add this animated background to my website: "${label}", from the package \`space-background-engine\` (source: https://github.com/imperorrp/aesthetic-backgrounds-library).

Use exactly this configuration. The seed makes it reproducible, so do not change any values:

\`\`\`json
${json}
\`\`\`

How to add it:
1. Install the package \`space-background-engine\`.
2. Mount it once, behind everything, at the app or layout root:
   - Plain JS: \`import { mount } from 'space-background-engine'; const bg = mount(document.body, CONFIG);\`
   - React / Next.js: \`import { Background } from 'space-background-engine/react';\` and render \`<Background {...CONFIG} />\` once in the root layout.
   - Vue: the \`v-background\` directive from \`space-background-engine/vue\`. Svelte: \`use:background\` from \`space-background-engine/svelte\`.${elementOk ? `
   - No build step: \`<script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>\` then \`<bg-engine ${attrs.join(' ')}></bg-engine>\` as the first child of <body>.` : ''}
   (CONFIG is the JSON above.)
3. It renders fixed, full-screen, and ignores the mouse, so page content must sit above it: give the main wrapper \`position: relative; z-index: 1\`. Do not add an opaque background color to <body> or the wrapper, or it will hide the effect.
4. Keep text readable: put body copy inside <main> or <article>, or add the attribute \`data-bg-content\` to text blocks. The engine measures those boxes and keeps its own callouts away from them. If a headline sits over a busy area, give it a soft text-shadow or a translucent panel; do not dim the whole background.
5. Accessibility: it already respects prefers-reduced-motion. Add a small, unobtrusive pause control that calls \`bg.pause()\` and \`bg.resume()\` (WCAG 2.2.2 asks for one on moving content).
6. Do not recreate it with CSS gradients, an image, or another library, and do not restyle it. This configuration is the design.

When you are done, tell me which file you mounted it in and confirm that the text over it is readable.`;
}
