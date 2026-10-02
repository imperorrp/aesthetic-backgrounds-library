---
name: background-designer
description: Design, compose, or author a generative web background with space-background-engine. Use when someone wants a site background, hero backdrop, or ambient canvas effect, wants to tune an existing one, or wants a new skin or layer written to the engine's conventions.
---

# Background designer

You are building a background with **space-background-engine**, not from scratch. The engine already owns the plumbing (sizing, DPR, clock, reduced motion, hidden-tab pause, palette tokens, pointer, determinism) and ships layers, skins, and presets. Your job is taste plus configuration, and only then code.

Work in this order and stop at the first level that satisfies the brief:

1. **Pick a preset** and adjust `palette`, `intensity`, `seed`.
2. **Compose a scene** from existing layers (JSON, no code).
3. **Write a layer** when one effect is missing.
4. **Write a skin** only for a self-contained world with its own logic.

## 1. Intake

Ask only what you cannot infer from the repo or the page. Keep it to one message. See `references/questionnaire.md` for the full list; the essentials:

- What kind of site and page (SaaS landing, developer portfolio, docs, dashboard, event, editorial, game)?
- Three mood words, and any reference sites or images.
- Brand color(s) or the CSS variables that hold them. Light theme, dark, or both?
- Where the text sits (centered column, left column, full-bleed hero), and how much of the page the background is behind.
- Motion tolerance: calm, ambient, or lively. Any pointer interaction wanted?
- Performance target: desktop only, mobile too, low-end devices.

If the person cannot answer, default to: dark theme, calm, no pointer interaction, centered column, mobile included.

## 2. Decide

Map the answers with `references/catalog.md`:

| Brief | Start from |
| --- | --- |
| SaaS or marketing, light | `calm-mesh` |
| SaaS or event, dark | `aurora-night` |
| Developer, terminal, retro | `terminal-rain` |
| Space, sci-fi, dense HUD | `void-tactical` skin, or `void-sector` to reorder its layers |
| Space, quiet | `deep-field` |
| Data, science, analytics | `flow-lines` |
| Nature, wellness, warm | `fireflies` |
| Editorial, brutalist, light | `paper-grid` |

Then adjust in this priority: `palette` (a hex derives a whole palette; add `theme: 'light'` for light pages), `intensity` (0.3 to 0.5 behind dense text, 0.7 to 1 for a hero), `seed` (browse a few; pick the one whose composition suits the layout), `light` (see below), and only then layer options.

**Light and composition.** Every scene has one key light. The seed puts it in an upper corner. Pin it with `light: { angle }` so it sits on the side away from the headline: a left-aligned hero wants the light upper right (about 315), and a right-aligned one wants upper left (about 225). `warmth` follows the brand's temperature: about 0.3 to 0.6 for warm brands (orange, amber, rose), -0.2 to -0.4 for cool ones (cyan, blue, teal), 0 when unsure. Leave `legibility: 'auto'` on. It finds `main`, `article`, and `[data-bg-content]` boxes and makes motion recede behind them. Mark a hero's text block with `data-bg-content` if it sits outside those elements.

**Moments.** For pages people stay on (portfolios, docs, dashboards, landing pages read in full), add `{ use: 'moments' }` near the top of a space or night scene. `kinds: 'meteors'` suits night skies, `'comets'` slow nebulae, `'flares'` sparse star fields. Keep `rate` at 1.5 or below. A moment rewards a long look, so it must never feel scheduled.

**Changing scenes.** If the page has sections with different moods, use `transition(handle, next, { kind: 'iris' })` (or `<Background transition>` in React) instead of remounting. Use `iris` for dramatic changes, `crossfade` for subtle ones, and `wipe` when the page scrolls horizontally.

## 3. Deliver

Produce a single `mount()` call, or a `<bg-engine>` tag for no-build sites:

```ts
import { mount } from 'space-background-engine';
mount(document.body, { skin: 'aurora-night', palette: '#22d3ee', intensity: 0.6, seed: 'harbor-11' });
```

```html
<script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
<bg-engine skin="calm-mesh" palette="#4f6df5" intensity="0.7"></bg-engine>
```

For a composed scene, pass `skin: 'scene'` with `options.layers` (see catalog). For React use `Background` from `space-background-engine/react` with the same props; Vue has `v-background` (`/vue`), Svelte has `use:background` (`/svelte`). Import `space-background-engine/core` plus the specific `/skins/*`, `/layers`, or `/presets` entry when bundle size matters.

Prefer putting the background in the repo: `npx space-background-engine add <id> --palette '#hex'` writes one editable file with the scene inlined, and `--tokens path/to/tokens.json` derives the palette from the project's design tokens when they exist. If the page should follow the background's colors, pass `exposeTokens: true` and use the `--bge-*` variables (or the Tailwind preset).

To hand the result to someone else as data, export a preset manifest (studio **JSON**, or `manifestOf()`); validate it with `npx space-background-engine validate <file>`.

Always state: which preset or layers, why the palette and intensity, and that the same seed replays identically.

## 4. Verify

- In the repo: `pnpm dev`, pick the source in the studio, turn on **Sample content column**, and read the legibility readout. Every built-in preset holds a mean contrast of at least 7:1 with under 5% of pixels below 4.5:1, so hold your scene to the same bar.
- Turn on **Show composition** to check that the light, the thirds, and the quiet zones fall where you meant them to.
- If the effect sits behind dense text, raise the layer's `quiet` option first. Then try `{ use: 'content-shade' }` near the top of the stack. Dimming the whole scene is the last resort.
- For a new skin or layer: `pnpm skin:check <id>` runs typecheck, determinism, screenshot, contrast, and pixel-identical replay. Look at the reference PNG it prints. Iterate on the picture, not the numbers.

## 5. Authoring a layer or skin

Scaffold with `pnpm create-skin <id>` and edit the template. Follow `references/conventions.md`; the gates enforce most of it. In short: randomness from `host.rng`/`host.fork`, time from `FrameInfo`, colors from `host.palette` or schema color tokens, motion scaled by `dt` and `host.intensity`, detail scaled by `host.quality`, a `schema` for every option, cleanup in `destroy()`. Prefer a **layer** (one effect, stackable) over a skin unless the effect has its own world model.

## Taste notes

- Restraint reads as expensive. One hue family plus one accent. Let the palette do the work; do not add colors by hand.
- Depth comes from three bands moving at different speeds, not from more objects.
- Motion should be slow and continuous. Nothing should complete a visible cycle in under about eight seconds.
- Grain hides gradient banding and makes flat color feel physical. Keep it under 0.1 opacity.
- A vignette anchors the composition and protects the edges where UI lives.
- Light from one direction is what makes a stack read as one image. Do not add a second glow from the opposite corner; the fill light already exists.
- Behind text, the background is a texture, not a subject. If you can describe an object in it, dim it.
- Test on the real page at real size, with the real text. Empty frames lie.
