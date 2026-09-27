# Roadmap & State of the Engine

_Written 2026-09-26 against commit `dee5107`. Companion to [DIRECTION.md](DIRECTION.md), which holds the vision and architecture; this file holds the audit, the gaps, and the sequenced plan._

---

## TL;DR

- **The thesis is right, the scaffolding is not there yet.** The host/skin split is real and the three skins prove the interface compiles, but the package does not yet deliver on the README's "30-second drop-in".
- **The primary drop-in path is broken.** `mount()` and `<bg-engine>` render the background inside a 300x150 box in the top-left corner, with no gradient/noise layers and no fonts. Only the React demo looks like the intended product. See [Audit](#audit-what-the-code-does-vs-what-the-docs-say).
- **Determinism is half-true.** World *generation* is seeded; *animation* uses `Math.random`, `Date.now`, `performance.now` and a `setTimeout` inside the render loop, so two tabs with the same seed diverge within seconds and animation speed depends on frame rate.
- **The aesthetic bar is not encoded anywhere.** Nothing in the engine stops a skin from being loud, palette-incoherent, or fighting page content. The default skin currently is all three in places. Taste has to become primitives and conventions, not intent.
- **The differentiator vs. one-shotting a background with a frontier model is plumbing, taste guardrails, composition, and an authoring loop.** None of those four exist yet beyond the plumbing's first half. The plan below builds them in order: repair, host contract v2, layers + primitives, aesthetic bar, open-source + AI authoring kit.

---

## Where the project is

**What exists and works**

| Piece | Status |
| --- | --- |
| Seeded PRNG (`mulberry32` + `cyrb53` hash), helpers `pick/randRange/randInt/token` | Solid, tested |
| `BackgroundSkin` contract: `id`, `mount(host) → {resize, frame, destroy}` | Minimal and clear |
| Host loop: DPR scaling (capped 1.5), rAF throttle to `targetFps`, resize via `window.resize` | Works for a full-viewport canvas |
| Three skins: `void-tactical` (~2,500 LOC), `drifting-dust` (143), `matrix-rain` (123) | Compile, run in the demo |
| Per-skin generic `options<T>` | Proven by the two small skins |
| Palette tokens (3 palettes) applied as CSS variables | Works for void-tactical's CSS layers |
| Packaging: ESM lib build with `index`, `element`, `react` entries; zero runtime deps | Builds; 18.7 KB gzip shared chunk |
| Playground with seed permalink, skin/palette/detail/density controls, overlay toggles | Works |
| Tests: 5 vitest cases on hashing and generator determinism | Pass |

**Bundle today** (`pnpm build:lib`)

| File | gzip |
| --- | --- |
| `index.js` | 2.1 KB |
| `element.js` | 0.9 KB |
| `react.js` | 0.5 KB |
| shared chunk (`mount-*.js`, all three skins + void-tactical renderers) | 18.5 KB |

Every entry pulls the shared chunk, so a consumer of `matrix-rain` still downloads all of void-tactical. `core/createBackground.ts` imports `voidTacticalSkin` as its default, which is what forces this coupling.

---

## Audit: what the code does vs. what the docs say

Verified in the browser on 2026-09-26 (Chromium, 1024x768, DPR 1.5) and by reading the source.

### Blocking for a public 0.1

| # | Claim / expectation | Reality | Where |
| --- | --- | --- | --- |
| 1 | README "30-Second Drop-In" via `mount()` or `<bg-engine>` gives a full-page background | Canvas is 300x150 at top-left, `position: static`. `mount()` creates the canvas with no styles and never injects the stylesheet; `createBackground` sizes from `canvas.clientWidth`, which is the intrinsic default | `core/mount.ts:59-62`, `core/createBackground.ts:41-44`, `overlays/stack.ts:6` (never called) |
| 2 | `mount()` doc comment: "Injects styles, palette, overlay stack" | Injects palette only. No overlay stack, so drop-in users get a bare transparent canvas with no gradient, clouds, grid, or grain | `core/mount.ts:18-19` |
| 3 | Canvas text uses the "Orbit" display font | `injectEngineFonts()` exists but is never called; drop-in users get fallback monospace | `overlays/stack.ts:19` |
| 4 | `<bg-engine>` mirrors core options | No `skin` attribute; CDN users can only ever get void-tactical | `element.ts:14` |
| 5 | `palette` restyles every skin | `drifting-dust` and `matrix-rain` read `--bg-accent`, which nothing sets (palette writes `--accent-rgb`, space-separated; they parse commas). Both fall back to hardcoded colors. `matrix-rain` also paints an opaque `#000` background, ignoring `--bg` | `skins/drifting-dust/index.ts:66`, `skins/matrix-rain/index.ts:48,63` |
| 6 | TypeScript consumers get accurate types | `types/*.d.ts` are hand-written and drifted: `SkinHost` lacks `options`, `MountOptions` declares `layers`/`fonts` that `mount()` ignores, the two newer skins are not declared | `types/index.d.ts:55-60,83-88,94` |
| 7 | `pnpm build` is green | Fails: unused `timestamp` in matrix-rain (TS6133). `prepublishOnly` skips typecheck so this would ship | `skins/matrix-rain/index.ts:60`, `package.json` |

### Correctness and honesty of the README

| # | Claim | Reality |
| --- | --- | --- |
| 8 | "strict `ResizeObserver`" | `window.addEventListener('resize')`. Container-mounted backgrounds do not react to container resizes |
| 9 | "same seed guarantees the exact same visual layout, particle positions" | Layout yes. Animation no: ~40 uses of `Math.random`/`Date.now`/`performance.now` across void-tactical renderers, plus a `setTimeout` inside the fleet state machine that fires after `destroy()` and mutates dead state (`renderers/entities.ts:267`) |
| 10 | "throttles rAF to hit specific target FPS budgets" | True, but void-tactical and matrix-rain move per *frame*, not per *second*, so lowering `targetFps` slows the animation. Overlay lifetimes assume 16 ms frames (`renderers/ui.ts:349`) |
| 11 | React wrapper "handles dynamic config updates instantly" | It tears down and remounts on any change. `Background` in `react-entry.tsx` also omits `skin` and `options` from its key, so changing skins does nothing |
| 12 | "theme-agnostic core" | `ResolvedBackgroundConfig` carries `overlaySpawnRate`/`maxOverlays`, and `detail` is documented as an "Annotation / HUD budget". These are HUD concepts. The core module also imports the default skin |
| 13 | Palette is a clean token system | `applyPalette` writes `--bg`, `--ink`, `--accent` onto `:root`. Those names will collide with host sites' own variables. The SVG data-URI layers hardcode `#06b6d4` and are re-tinted with `hue-rotate` filters per palette (`overlays.css:235-253`) |

### Smaller items

- `engine/index.ts` still exports `ParticleHero`, `useParticleCanvas`, `CursorTrail`: React-only leftovers from the landing page that are not skins. `CursorTrail` appends to `document.body` at `z-index: 9999`, which is foreground UI, not background.
- `BackgroundCanvas` remounts whenever the parent passes a new `config` object identity (`BackgroundCanvas.tsx:37`).
- `createBackground()` on a plain container relies on the caller having positioned the parent; only `mount()` does that.
- No `prefers-reduced-motion` policy in the host; only void-tactical checks it, and only to stop the camera.
- No pause when the tab is hidden or the element is offscreen (`useParticleCanvas` has an `IntersectionObserver`, the core does not).
- DIRECTION.md roadmap: step 5 (matrix rain) is done but unmarked; step 4 describes an "interactive Simplex Network" that does not match `drifting-dust` (not interactive, no noise). Step 6 "Publishing" is listed next, but items 1-7 above should gate it.
- Identity is spread across four names: npm `space-background-engine`, README "Aesthetic Background Engine", GitHub `aesthetic-backgrounds-library`, element `<bg-engine>`, CSS `.space-sim-canvas`.

---

## Aesthetic assessment (the part that actually matters)

The stated outcome is *very high quality, corely aesthetic* backgrounds. Judged against that, from the React demo at seed `orion-7`, default settings:

**void-tactical.** The CSS base is good: deep radial void, blurred nebula ellipses, faint grid with radial mask, grain. It reads as premium on its own. The canvas layer on top undoes much of it:

- System-to-system connection lines are 2 px wide at up to 0.5 alpha in pure accent, pulsing (`renderers/ui.ts:29-32`). They are the brightest thing on screen and would compete with any page text.
- Fleet "future path" projections are dashed 2 px lines projected 15 steps ahead *with world wrap*, so a fleet near an edge draws a dashed line across the entire viewport (`renderers/entities.ts:391-580`, wrap at `567-571`). In the screenshot these appear as two orange vertical dashed lines through the middle of the frame. They look like a bug, not a design.
- Structure colors are a hardcoded rainbow (`generators.ts:38-62`: sky, amber, lime, red, indigo, fuchsia, emerald...). They ignore the palette entirely, so switching to `amber` or `violet` re-tints the CSS layers but the canvas stays cyan/orange/purple/green. Nothing in the frame agrees on a hue.
- ASCII sprites are rendered at 6 px font, then scaled to 28 px tall (`renderers/utils.ts:29-31`). At that size a 12-column ASCII station is an illegible smudge inside a colored disc halo. The art exists but cannot be seen.
- Labels are frequent and bold white at 10-11 px. Fine for a HUD, loud for a background.
- Net impression: a game debug overlay running on top of a nice ambient plate. The plate is the product; the overlay is the prototype.

**drifting-dust.** Competent plexus network, but generic (every particles.js site since 2015), monochrome fallback color because the palette hookup is broken, uniform node sizes, no depth cue beyond parallax, hard 1 px lines with linear alpha falloff. It proves the interface. It is not a reason to install the package.

**matrix-rain.** Recognizable, works, but opaque black fill means it cannot layer over anything, the head/trail trick draws the head twice, and it re-rolls a random glyph for the previous row every frame so trails flicker rather than persist. Also generic.

**The structural problem**: quality currently depends entirely on the skin author's taste, frame by frame. The engine has no opinion about contrast, palette coherence, motion budget, or legibility behind content. A "premium" result should be the *default outcome* of using the primitives correctly, and a bad result should require effort. That is what sections below are about.

---

## Why this should beat one-shotting a background

A frontier model can one-shot a decent canvas background today. To justify installing a package and reading a doc instead, the engine must be better at the things one-shots reliably get wrong:

1. **Integration plumbing that is actually finished.** DPR, container resize, SSR safety, cleanup of every timer and listener, `pointer-events`, z-index, reduced motion, hidden-tab pause, mobile budgets. One-shots get 80% of this; the remaining 20% surfaces in production. This is the engine's job and it is roughly half done.
2. **Design-token integration.** One-shots hardcode colors. The engine should accept a brand color or the host's CSS variables and derive a coherent palette (OKLCH ramps: bg, surface, ink, ink-dim, accent, accent-2, hazard), expose it to skins as *values*, and scope any CSS variables it writes under a prefix.
3. **Taste guardrails.** A contrast ceiling behind content, a motion budget, a single global `intensity` knob, a legibility mode that dims behind a content rectangle, calm defaults. These are opinions a one-shot will not volunteer.
4. **Performance governance.** Adaptive quality when frame time exceeds budget, mobile detection, offscreen pause, battery-aware defaults.
5. **Determinism and testability.** Seeds already exist; add an injectable time source so a frame sequence is reproducible, then golden-image tests and shareable permalinks follow for free.
6. **Composition.** Real backgrounds are stacks: base gradient + grain + one or two motion layers + vignette + optional light-follow. Skins today are monoliths; layers should be the unit, and skins/presets should be compositions.
7. **An authoring loop, not a prompt.** A skin template, a `create-skin` scaffold, a schema that auto-generates playground controls, and a check command (typecheck + determinism + screenshot + frame budget + contrast) that a human or an agent can iterate against. Plus a `SKILL.md` that turns "I want something like X for my Y site" into either a preset config or a new skin that follows the conventions.

Items 1 and 5 are engineering. Items 2, 3, 6 are what make outputs *aesthetic by default*. Item 7 is what makes the project worth using from inside Claude Code, Cursor, or any agent, instead of asking the model cold.

---

## Proposed architecture v2

Everything below is additive to the current contract; existing skins keep working through an adapter until they are ported.

### Host contract v2

```ts
type FrameInfo = {
  t: number;        // seconds since mount, from an injectable clock (deterministic in tests)
  dt: number;       // seconds since last frame, clamped (e.g. max 1/20)
  frame: number;    // frame index
};

type SkinHost<T> = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rng: Rng;                          // seeded, as today
  fork(label: string): Rng;          // sub-streams so one subsystem does not perturb another
  noise: Noise2D;                    // simplex/value + fbm, seeded from the same seed
  viewport: { width; height; dpr; isMobile; isTouch };
  palette: ResolvedPalette;          // values, not CSS lookups: bg, surface, ink, inkDim, accent, accent2, hazard, each as hex + rgb + oklch
  theme: 'dark' | 'light';
  motion: 'full' | 'reduced' | 'off';// from prefers-reduced-motion + config override
  pointer: { x; y; vx; vy; active; down } | null;   // normalized to canvas, null when never seen
  scroll: { y; progress };           // for scroll-driven params
  quality: number;                   // 0..1, adjusted by the governor when frames run long
  intensity: number;                 // 0..1, user knob: density × contrast × motion
  config: ResolvedBackgroundConfig;  // seed, density, speed, targetFps, legibilityRect?
  options: T;                        // validated against the skin's schema
  layers: DomLayerApi;               // addCss(className|styleObject), addSvg(...), remove(); rendered behind the canvas
};

type SkinInstance = {
  resize(viewport): void;
  frame(info: FrameInfo): void;
  destroy(): void;
  pause?(): void; resume?(): void;
};
```

Host responsibilities added: `ResizeObserver` on the container; `visibilitychange` and `IntersectionObserver` pause; clock injection; reduced-motion policy (default: `reduced` → set `motion` and halve `intensity`, `off` → render one static frame); a frame-time governor that lowers `quality` and raises it back; scoped CSS variables (`--bge-*`) on the engine root, not `:root`; kill-switch for the default-skin import so `core` has no skin dependency.

Rules for skins (enforced by lint/tests where possible): no `Math.random`, `Date.now`, `performance.now`, `setTimeout`, or `setInterval` inside a skin; motion is `dt`-based; colors come from `host.palette`; nothing allocates per frame in hot loops; `destroy()` leaves no listeners.

### Layers and scenes

The monolithic skin stays supported, but the unit of authoring becomes the **layer**:

```ts
type Layer<T> = {
  id: string;
  kind: 'canvas' | 'css' | 'svg';
  schema: OptionsSchema<T>;
  defaults: T;
  setup(host: LayerHost<T>): LayerInstance;   // LayerHost = SkinHost minus canvas ownership, plus blend/opacity
};

type Scene = {
  id: string;
  layers: Array<{ use: string; with?: object; opacity?: number; blend?: GlobalCompositeOperation }>;
  palette?: PaletteSpec;
  intensity?: number;
};
```

One shared canvas draws canvas layers in order; CSS/SVG layers become DOM siblings behind it. `void-tactical` then decomposes into `gradient-base`, `nebula-clouds`, `grain`, `sector-grid`, `starfield`, `star-systems`, `fleets`, `hud-text`, and each becomes reusable and individually toggleable. A **preset** is a saved `Scene`; presets are what non-authors pick.

### Standard layer library (first dozen)

Base plates: `gradient-radial`, `gradient-mesh` (animated, OKLCH-interpolated), `aurora-bands`, `vignette`, `grain` (feTurbulence CSS or canvas noise), `scanlines`.
Motion: `starfield-parallax`, `particles-drift`, `particles-flowfield` (curl noise), `plexus-network` (drifting-dust, done properly), `orbs-metaball`, `glyph-rain` (matrix-rain generalized to any charset and font), `grid-dots`/`grid-hex`/`grid-iso` with perspective option, `ribbons-wave`, `fireflies`, `light-follow` (pointer glow, canvas-based so it composites with blends).

Each ships with a schema, a preview image, a mood tag set, and a default that looks good at `intensity: 0.5` behind white body text.

### Primitives library (pure, tree-shakeable)

- `rng`: existing + `fork`, `gaussian`, `weightedPick`, `shuffle`, `jitter`.
- `noise`: simplex 2D/3D, value noise, fbm, curl.
- `color`: hex/rgb/oklch conversions, `mix`, `alpha`, `ramp(brand) → palette`, contrast ratio, luminance.
- `motion`: easings, `spring`, `lerpExp(dt)`, `wrap`, `parallax`, `cull(rect, margin)`.
- `space`: spatial hash grid, wrapped-distance, Poisson-disc sampling (for non-clumpy placement, which the current `rng()*width` placement lacks).
- `draw`: sprite cache, text measure cache, glow (cheap shadow alternative), dashed path helper, batched circles.
- `text`: word banks and token generators (the void-tactical narrative tables, generalized).

### Schema and auto-UI

Every skin and layer declares its options once:

```ts
schema: {
  fontSize: { type: 'number', min: 8, max: 32, step: 1, default: 16, label: 'Glyph size' },
  charset:  { type: 'enum', values: ['katakana', 'hex', 'binary', 'custom'], default: 'katakana' },
  tint:     { type: 'color', default: 'accent' },
}
```

Used for: validation with helpful errors, playground controls (no more hand-written per-skin UI), generated docs tables, `<bg-engine>` attribute parsing, and as the structured target an agent fills in from the questionnaire.

### Palette and theme

`palette` accepts an id, a full token object, or `{ from: '#brand', theme: 'dark' | 'light' }` and derives the rest in OKLCH. Skins read `host.palette` values. The host writes `--bge-*` variables on the engine root only. Light mode becomes possible (most "premium" SaaS sites are light), which no current skin supports.

### Packaging and registry

- Subpath exports: `space-background-engine/skins/void-tactical`, `/layers/grain`, `/presets/calm-mesh`, so consumers pay for what they use.
- A tiny string-id registry (`registerSkin`, `skins.get(id)`) so `<bg-engine skin="glyph-rain">` works; the element lazy-imports by id from a CDN "full" build.
- Generated `.d.ts` via `vite-plugin-dts` or `tsc --emitDeclarationOnly`; delete the hand-written `types/`.
- `prepublishOnly` = typecheck + tests + build + size check.

### Quality gates (CI)

Typecheck; unit tests (host lifecycle: mount/destroy leaves no listeners or rAF; resize propagates; reduced-motion policy); determinism test (render N frames with a fixed clock in jsdom + `canvas`, hash pixels, compare per seed); Playwright visual regression per skin × seed × palette; frame budget test at 1080p headless; bundle-size budget per entry; contrast probe (sample luminance of the composite inside a content rectangle and fail above a threshold at default intensity).

---

## Authoring kit (the "instead of one-shotting" story)

### `pnpm create-skin <id>` scaffold

Generates `src/engine/skins/<id>/{index.ts, schema.ts, README.md, <id>.test.ts}` from a template that already: uses `host.rng`/`host.noise`, moves by `dt`, reads `host.palette`, respects `host.motion` and `host.quality`, culls, declares a schema, cleans up in `destroy`, and registers itself in the playground and the registry. The test asserts determinism and no forbidden globals.

### `pnpm skin:check <id>`

Runs typecheck, the forbidden-globals lint, the determinism test, renders three seeds × two palettes × two viewports to PNG in `.artifacts/`, reports p95 frame time, and prints the contrast probe result. This is the loop an agent iterates against.

### `skills/background-designer/SKILL.md`

Ship a skill (Claude Code format, plus a mirrored `.cursor/rules` file and a plain `PROMPT.md`) in the repo and in the npm package under `/skills`. Structure:

1. **Intake questionnaire** (ask only what is not inferable from the repo):
   - Site kind and niche (portfolio, SaaS landing, docs, dashboard, event, game, editorial).
   - Three mood words; two reference sites or images if any.
   - Brand color(s) or the CSS variables that hold them; light, dark, or both.
   - Where content sits (full-bleed hero, centered column, sidebar) so legibility masks can be set.
   - Motion tolerance (calm / ambient / lively) and interactivity (none / pointer light / pointer repulsion).
   - Performance target (desktop only, mobile too, low-end) and whether the background is above the fold on every page.
2. **Decision procedure**: pick a preset → tune options → compose layers → write a new layer/skin, in that order of preference. Each step names the exact commands and files.
3. **Conventions checklist** the output must satisfy (the rules above), with the reasons.
4. **Templates**: layer, skin, preset, schema.
5. **Verification**: run `skin:check`, look at the PNGs, compare against the mood words, adjust `intensity`/density/contrast first, geometry second.
6. **Taste notes**: a short design-principles page (restraint, one hue family, slow continuous motion, no hard high-contrast edges behind text, depth via three parallax bands, grain hides banding, vignette anchors, etc.). This is the part a cold model does not have.

Also publish a machine-readable `skin-manifest.json` per skin (id, tags, moods, niches, preview, default intensity, supports light/dark, cost tier) so agents and the gallery can select by need.

---

## Niches and preset packs

Present the project through use cases, each a pack of two or three presets with tuned defaults and a screenshot:

| Niche | Presets | Notes |
| --- | --- | --- |
| Developer portfolio / terminal | `glyph-rain`, `ascii-grid-sector`, `code-ticker` | Dark only; low intensity behind code blocks |
| SaaS landing (calm premium) | `calm-mesh`, `aurora-soft`, `orbs-blur` | Light and dark; this is the mainstream demand and the flagship for "premium at a glance" |
| Sci-fi / gaming / space | `void-tactical` (after art pass), `star-chart`, `warp-field` | Where the current codebase is strongest in content |
| Editorial / brutalist | `halftone-drift`, `dot-grid-perspective`, `type-fragments` | Monochrome, high texture, near-zero motion |
| Nature / calm | `fireflies`, `snowfall`, `fog-drift`, `sun-rays` | Ambient pages, wellness, portfolios |
| Data / science | `flow-field`, `plexus-network`, `contour-lines` | Restrained palette, precise |
| Retro | `synthwave-horizon`, `crt-scanlines`, `pixel-starfield` | Playful, higher intensity acceptable |
| Auth / dashboard chrome | `legibility-first` variants of any preset at `intensity ≤ 0.3` with a content mask | Where most real installs will actually go |
| Screensaver / OBS / presentation | Any preset at `intensity 1`, no legibility mask, `targetFps 60` | The "show off" mode |

Deliberately not on the list: seventeen half-finished skins. The engine needs one flagship per niche group that is unarguably good, and a primitive library that makes the rest cheap for the community.

---

## Milestones

Each milestone has acceptance criteria so it can be closed rather than drift.

### M0 — Repair (days) — **done 2026-09-26**

Audit items 1–7 above are fixed: canvas fills its container via inline styles plus a `ResizeObserver`; skins expose an optional `layers()` hook that `mount()` uses for the overlay stack; fonts are opt-in (`fonts: true`); a string-id skin registry backs `<bg-engine skin>` and `mount({ skin: 'id' })`; skins read `host.palette` values; declarations are generated by `tsc -p tsconfig.lib.json`; `prepublishOnly` typechecks; 15 jsdom tests cover the DOM contract. Still global: palette CSS variables on `:root` (M1).

- `mount()` and `<bg-engine>` fill their container; stylesheet and overlay stack injected for skins that ask; fonts opt-in or dropped.
- `drifting-dust`/`matrix-rain` read the real palette; `matrix-rain` no longer paints an opaque background.
- `pnpm build` green; typecheck in `prepublishOnly`; declarations generated from source.
- React `Background` keys on `skin` and `options`; `<bg-engine skin>` attribute via a registry.
- README claims match behavior (ResizeObserver, determinism scope, "instant" updates). DIRECTION.md roadmap statuses corrected.
- Acceptance: `public/quick.html` and `public/element.html` are visually identical to the demo at the same seed.

### M1 — Host contract v2 (1–2 weeks) — **done 2026-09-26**

Shipped: `FrameInfo` + injectable `Scheduler` (`createManualScheduler` for tests); `dt`-based motion in all skins; `ResizeObserver`; hidden-tab and offscreen pause; `motion` policy (`auto`/`full`/`reduced`/`off`); `intensity`; frame-time `quality` governor; `host.palette` values plus scoped `--bge-*` variables and `--bge-hue-shift`; `palette: { from }` OKLCH derivation with light/dark themes; `host.pointer`, `host.noise`, `host.fork`; void-tactical purged of `Math.random`/`Date.now`/`setTimeout` (docking uses sim time); core no longer imports any skin; `core` and `skins/*` subpath exports; determinism test per built-in skin (identical draw-call hashes over 240 frames, no `Math.random`/`Date.now` calls); host lifecycle tests; `scripts/size-check.mjs` entry-closure budgets; GitHub Actions CI. 55 tests. Not done: `detail`/overlay budgets still live in core config (moves with the M2 layer split).

- `FrameInfo` with injectable clock; `dt`-based motion in all skins; `targetFps` no longer changes speed.
- `ResizeObserver`, visibility/offscreen pause, reduced-motion policy, frame-time governor, `intensity`.
- `host.palette` values + scoped `--bge-*` variables; `palette: { from }` derivation.
- `host.pointer`, `host.noise`, `rng.fork`.
- void-tactical purged of `Math.random`/`Date.now`/`setTimeout`; two tabs with one seed stay in lockstep for 60 s (test).
- Core no longer imports any skin; subpath exports per skin; size budget CI.
- Acceptance: host lifecycle tests, determinism test, bundle budget all green in CI.

### M2 — Layers, primitives, presets (2–4 weeks) — **first slice done 2026-09-26**

Shipped: `Layer` (shared or private surface, optional DOM part, schema) and `Scene` JSON with opacity/blend per layer; `scene` skin and `createPreset`/`registerPreset`; `fromSkin` adapter (void-tactical registers as a layer); option schemas with validation, defaults, and palette color tokens; 13 standard layers (`gradient-base`, `mesh-gradient`, `aurora`, `starfield`, `particles-drift`, `plexus`, `flow-field`, `glyph-rain`, `grid`, `light-follow`, `vignette`, `grain`, `scanlines`); 7 presets across SaaS, terminal, space, data, nature, editorial with two light-theme presets; skin `defaults` so a preset carries its palette/intensity; `/layers` and `/presets` subpath exports; playground rewritten as a scene studio (schema-generated controls, layer stack editor, brand-color palette derivation, permalink in the URL hash, `mount()` snippet, PNG of the canvas). Determinism tests cover every preset. 91 tests.

Still open in M2: decompose void-tactical's canvas into separate layers (stars, systems, fleets, HUD) rather than one adapter layer; move `detail`/overlay budgets out of core config into that skin; per-layer preview images for a gallery; PNG export that includes DOM layers (needs an SVG/foreignObject snapshot or drawing grain on canvas); a couple more layers (`orbs`, `ribbons`, `halftone`).

- `Layer`/`Scene` model; void-tactical decomposed into layers; monolithic skins still supported.
- First dozen layers and the primitives library listed above, each with schema + preview.
- Playground: controls generated from schema, layer stack editor, permalinks encode the whole scene, PNG export.
- Six presets across at least four niches, including one light-mode preset.
- Acceptance: a new preset can be authored in the playground and pasted into `mount()` as JSON with no code.

### M3 — The aesthetic bar (parallel, ongoing) — **art pass done 2026-09-26**

Fixed first: a host bug from M1 mounted skins before the first size pass, so void-tactical generated its world into a 1x1 viewport and looked empty; the host now sizes before `mount()` and guarantees one `resize()` before the first frame. The studio also carried a light preset palette into dark skins; skins now declare `defaults` and the studio resets to them.

Art pass on void-tactical, compared side by side with the original commit at the same seed: all authored colors flow through a memoized OKLCH mapper toward the palette family (`hueVariety` knob); ASCII sprites render crisp at their display size with soft cached halos and tactical bracket corners instead of flat discs; system links are a faint lane with flowing packet dashes and ring nodes; hex radars gained a radar sweep; fleet predicted paths are fading waypoint dots (or dashed) that break at wraps, so no line ever crosses the viewport; trails break at wraps too; anomalies use the palette hazard color; HUD elements (grid, sector links, labels, telemetry, overlays) scale with one `hud` knob; `lineWeight`, `spriteScale`, `paths`, `trails` knobs; the CSS plate is palette-relative via `color-mix`. The quality governor no longer touches entity budgets (only stars, gently) and its budget is 75% of the frame, so a slow machine never guts the scene. New `content-shade` layer (feathered legibility mask) and a `probeContrast()` utility with tests. Calm-mesh gained a second multiply mesh pass for depth. 94 tests.

Real-pixel gate (2026-09-27): Playwright suite (`pnpm test:e2e`) over every skin and preset via `public/check.html` (manual clock, fixed seed, 240 frames, `pauseWhenHidden: false`): visual regression baselines in `e2e/__screenshots__`, contrast of palette ink behind a text column (mean ≥ 4.5:1, ≤ 12% failing pixels; all ten pass at defaults), and byte-identical PNGs across two browser contexts for one seed. Runs as a separate CI job with the report uploaded as an artifact. Found on the way: the device preset's viewport silently overrode the configured one, which is why the first determinism run "failed"; viewports are now pinned in the project.

Studio readout (2026-09-27): a sample 40rem text column in the palette ink with a live legibility readout (mean contrast, worst sample, failing share) sampled once a second.

Void-tactical decomposition (2026-09-27): the simulation moved to `skins/void-tactical/world.ts` (`createVoidWorld`, `sharedVoidWorld`); the monolithic skin and five new layers (`void-atmosphere`, `void-stars`, `void-systems`, `void-fleets`, `void-hud`) run the same world, shared per mount through the resolved-config key so fleets keep steering toward drawn structures. The `void-sector` preset is the skin rebuilt from its layers. Rng consumption order was preserved: the skin's pre-refactor screenshot baseline still matches byte for byte. The HUD overlay budget (`overlaySpawnRate`/`maxOverlays`) left core config and lives in the skin; `detail` stays in config as a generic annotation budget.

Still open: layer preview images; PNG export with DOM layers; `orbs`/`ribbons`/`halftone` layers.

- Art pass on void-tactical: palette-derived structure colors, connection lines to ≤ 1 px and ≤ 0.25 alpha, fleet path projection clipped (no wrap lines), sprites at legible size or replaced with vector glyphs, label budget tied to `intensity`.
- `calm-mesh` as the flagship "premium at a glance" preset, tuned in both themes.
- Design principles page; contrast probe in `skin:check`; legibility mask option.
- Acceptance: default install behind a paragraph of 16 px white text passes the contrast probe; a screenshot of each preset passes a "would I ship this on a real landing page" review.

### M4 — Open-source and authoring kit (1–2 weeks, after M2) — **done 2026-09-27**

Shipped: `pnpm create-skin <id>` (template following the conventions, registers in `skins/local.ts`, adds to `e2e/subjects.json`; `example-motes` is its unedited output), `pnpm skin:check <id> [--update]` (typecheck, unit determinism, screenshot, contrast, replay, prints the reference PNG), `skills/background-designer/` (SKILL.md, questionnaire, conventions, catalog) mirrored for Claude Code under `.claude/skills/`, CONTRIBUTING.md, issue templates for preset requests and submissions, CHANGELOG.md with 0.2.0 notes, README hero and gallery drawn from the test baselines, version 0.2.0. Publishing to npm and the GitHub Pages showcase are the maintainer's call. Open decision remains the name (npm `space-background-engine` vs GitHub `aesthetic-backgrounds-library`).

- One name everywhere; README rewritten around use cases with a hero GIF and gallery; CONTRIBUTING; skin authoring guide; CHANGELOG via changesets; GitHub Actions CI; issue templates for "preset request" and "skin submission".
- `create-skin` scaffold, `skin:check`, `SKILL.md` + mirrors, `skin-manifest.json`, showcase site on GitHub Pages with per-preset permalinks.
- Publish 0.2.0.

---

## Proposed next milestones (M5–M9, not yet approved)

Written 2026-09-27 after M0–M4 closed. Ordered by what unlocks the most; each has an acceptance line so it can be closed rather than drift. Nothing here is started.

### M5 — Showcase and studio depth

The product is judged by the studio and the gallery before anyone reads the API.

- Showcase site on GitHub Pages: gallery from the e2e baselines, per-preset pages with permalinks, "remix in studio" button, embeddable share cards.
- Studio: layer thumbnails (rendered from a manual-clock mini mount), undo/redo, keyboard nudging of sliders, A/B toggle between two scene states, "randomize within taste" (perturb options inside schema ranges by a seed).
- Export: PNG/WebP that includes DOM layers (canvas equivalents for `grain` and `scanlines` behind an `exportMode`), MP4/WebM loop via `MediaRecorder` at a fixed clock, JSON preset file download/upload.
- Content awareness: measure the page's main content boxes automatically and propose `content-shade` geometry; readout per box.
- Acceptance: a stranger can go from the gallery to a pasted `mount()` call in under two minutes, and export a 10 s loop of any preset.

### M6 — Rendering tiers

Canvas 2D is the floor; some looks need the GPU.

- `Layer.kind: 'webgl'`: a shader layer contract (fragment shader + uniforms from schema, palette, time, pointer) compositing onto the scene through a private surface. First shaders: volumetric nebula, fluid ink, refraction/glass over the stack, bloom pass.
- OffscreenCanvas + worker rendering for heavy scenes, with the main thread only compositing; falls back silently.
- Adaptive resolution: the governor may lower backing DPR before thinning content; per-layer LOD hints in schema (`quality` tiers).
- Frame scheduler: heavy layers may run at half rate and interpolate; budget shared across multiple mounts on one page.
- Acceptance: void-sector holds 60 fps at 1440p on an integrated GPU laptop with the governor at 1.0; a shader layer is authored with the same schema tooling as a canvas layer.

### M7 — Inputs and reactivity

Backgrounds that respond feel alive; the host already owns pointer and intensity.

- Scroll binding: scene keyframes by scroll progress (intensity, palette, layer opacity, camera) with easing; per-section scenes that crossfade as sections enter.
- Theme sync: follow `prefers-color-scheme` and a host `data-theme` attribute, swapping palette with a crossfade rather than a remount.
- Audio input (Web Audio analyser) as `host.audio` with bands and beat; layers opt in.
- Device motion parallax on mobile (gyroscope), respecting motion policy.
- App state binding: `handle.set({ intensity, palette })` without remount, and a tiny store adapter for React/Vue/Svelte.
- Acceptance: a long landing page with three sections runs three scenes with crossfades and no remount jank; a theme toggle swaps palettes in place.

### M8 — Ecosystem and distribution

Make it easy to publish, find, and trust other people's work.

- Preset registry: `skin-manifest.json` per preset/skin (id, tags, moods, niches, preview, defaults, cost tier, light/dark), a community index built by CI from submissions, gallery reads it.
- Framework wrappers: Vue, Svelte, Astro island, Next.js client component, all thin over `mount()`; a Tailwind plugin that exposes `--bge-*` tokens as utilities.
- CDN "full" and "core" builds with import maps documented; versioned preset permalinks.
- Design-tool bridge: export the palette to Figma tokens; import brand tokens from a `tokens.json`.
- Publish cadence with changesets; semver policy for schema changes (adding fields is minor, changing defaults is minor with baseline refresh, removing is major).
- Acceptance: a third party publishes a preset package that appears in the gallery via manifest alone, with no code change in this repo.

### M9 — Aesthetic depth

Taste as system, not as one-off tuning.

- Palette harmonies: duotone, analogous, triadic, split-complement derived from one brand color; per-layer role tokens (`plate`, `mid`, `highlight`, `alert`) instead of raw `accent` everywhere.
- Global lighting: a shared light direction and warmth that base plates, glows, and sprites read from, so layers agree on where light comes from.
- Composition grammar: anchor points and negative space rules the presets follow (rule of thirds for focal systems, quiet zones behind content), encoded as preset metadata the studio can visualize.
- Scene transitions: crossfade, wipe, and morph (option interpolation) between scenes at a fixed clock; deterministic.
- "Moments": rare, seeded events with a long return period (a comet, a supernova flare, a fleet convoy) so a background rewards long looks without ever being busy.
- Content-aware auto-shade on by default at `intensity` above a threshold behind measured text boxes.
- Acceptance: every preset passes a stricter gate (mean contrast at or above 7:1 behind text) and a blind side-by-side against its 0.2.0 baseline is preferred by the maintainer.

### Beyond

Void-tactical's own evolution (factions, lanes, events, sensor model) has its own ideas document: [VOID_TACTICAL_IDEAS.md](VOID_TACTICAL_IDEAS.md). It is a candidate M10 once M9's lighting and moments land, since it builds on both.

---

## Doc fixes to make now

- README: replace the ResizeObserver claim; scope the determinism claim to generation until M1 lands; remove "instantly" from the React wrapper claim; add the `skin` attribute once it exists; document the DPR cap; mention font loading behavior.
- DIRECTION.md: mark step 5 done; fix step 4's description; add M0 items as gates before "Publishing"; add "Layers and scenes" to the architecture diagram; note that `detail`/overlay budgets are void-tactical concerns slated to move.
- Remove or relocate `ParticleHero`, `useParticleCanvas`, `CursorTrail` from the engine index (demo-only or delete).

---

## Open decisions

1. **Name.** One of: `space-background-engine` (current npm), `aesthetic-backgrounds-library` (current GitHub), or something short and neutral. Element tag should match. Candidates as of 2026-09-27 (npm availability not yet verified): **Wallflower** (a background that is quietly beautiful and stays out of the way), **Scrim** (the lit translucent backdrop in theatre), **Cyclorama** (the painted sky behind a stage), **Skybox** (the game term for the environment behind everything), **Farfield**, **Nightglass**, **Slowlight**, **Afterglow**, **Firmament**, **Undertow**, **Penumbra**. Element tag would follow the name (`<wallflower-bg>`, `<scrim-bg>`).
2. **Fonts.** Ship no web fonts and use system stacks (privacy, zero requests), or opt-in Google Fonts injection. Recommendation: system stacks by default; a `fonts` option for skins that need a display face.
3. **Light mode as first-class.** Most premium landing pages are light. Recommendation: yes, via palette derivation in M1, with `calm-mesh` as the first light preset.
4. **WebGL now or later.** Later. Canvas 2D covers every niche above at acceptable frame budgets once culling and batching are consistent; WebGL is a `Layer.kind`, not a rewrite.
5. **Where the aesthetic opinions live.** In the engine as defaults and probes (recommended), or only in docs. If only in docs, the one-shot comparison is lost.
