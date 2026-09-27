# Direction & Architecture

The Aesthetic Background Engine is a tool for dropping premium, generative, interactive backgrounds into any web project. 

The original aesthetic—a sci-fi sector extracted from a landing page (`void-tactical`)—is just the default "skin". **The true product is the engine itself:** a highly generalizable framework that handles all the tedious boilerplate of canvas backgrounds (resizing, DPR scaling, requestAnimationFrame loops, detail budgets, seeded PRNG) so developers can focus purely on aesthetics.

Local notes that must never ship: `docs/PRIVATE.md` (gitignored).

---

## The Vision: A Community of Aesthetics

Creating a custom canvas background is often too much work for a standard web project. This engine changes that by providing a robust host environment. 

The goal is to build an open-source ecosystem where anyone can write and share cool aesthetics (skins). Whether you want a calm drifting gradient, a brutalist ASCII terminal, a particle network, or abstract generative art, the engine handles the mounting, while the skin just handles the drawing.

---

## Architecture: Host vs. Skin

The architecture cleanly separates the plumbing from the art.

```mermaid
graph TD
    subgraph Host [Core Engine]
        A[mount / BackgroundCanvas] --> B[Create Canvas]
        A --> C[ResizeObserver & DPR Scaling]
        A --> D[requestAnimationFrame Loop]
        A --> E[Seed & Palette Resolvers]
    end

    subgraph Skin [Aesthetic Plugin]
        F[SkinHost Interface]
        G[World Generator]
        H[Render Loop]
    end

    B --> F
    C --> F
    E --> F
    D --> H
    F --> G
    G --> H
```

**The Host (`core`)**
- Manages the `canvas` element, DOM injection, and container-aware sizing (`ResizeObserver` with a window fallback).
- Runs the `requestAnimationFrame` loop, throttled to a `targetFps`.
- Provides the skin with a deterministic PRNG (`rng`), canvas context (`ctx`), resolved palette tokens (`palette`), and the parsed configuration (budget, seed).
- Resolves skins by object or by registered string id (`registerSkin`), so JSON configs and the `<bg-engine>` element can pick skins.

**Layers and Scenes (`layers/*`, `presets/*`)**
- A `Layer` is one effect with a declared option `schema`, an optional DOM part, and a canvas part that draws on the shared scene canvas or on a private surface (for fades and masks).
- A `Scene` is JSON: an ordered stack of `{ use, with, opacity, blend }`. The `scene` skin runs it; `registerPreset` wraps a scene as a named skin with its own palette/intensity defaults.
- Layers read colors from the palette (or tokens such as `accent`), scale by `intensity` and `quality`, and draw only from seeded streams, so scenes replay deterministically.

**The Skin (`skins/*`)**
- Implements the simple `BackgroundSkin` interface.
- Owns its internal state, entities, and drawing logic.
- Can accept arbitrary `options` extending the generic `<SkinOptions>` type for custom aesthetic knobs.
- May implement the optional `layers(root, context)` hook to add DOM layers (CSS gradients, SVG textures, grain) behind its canvas. Otherwise it knows nothing about React, Web Components, or the DOM.

---

## Conceptual Primitives

To truly understand the engine's generalizability, it is built on a few core mechanisms:

1. **Deterministic replay**: The engine replaces `Math.random()` with a Mulberry32 seeded generator and hands skins a clock instead of the wall clock. If two users pass `seed="orion"`, they see the exact same constellation, network, or particle field *and the same animation*, regardless of browser or frame rate.
2. **DOM Isolation**: The engine creates an absolute/fixed positioned `<div class="bg-engine-root">` with `pointer-events: none`. The background renders behind your content without interfering with clicks, scrolls, or layout.
3. **Hardware Acceleration**: Heavy ambient effects (SVG turbulence, radial gradients, CSS grids) are offloaded to DOM layers. A skin injects them through its optional `layers(root, context)` hook and `mount()` places them underneath the canvas, relying on GPU-composited CSS rather than the Canvas 2D context.
4. **Generic Configuration**: The engine defines global budgets (`density`, `detail`, `cameraSpeed`); every skin can define its own schema via the `<T>` generic (e.g., `options: { maxNodes: 100 }`), flowing down from the React wrapper, the Vanilla mount function, or the element. `detail` and the overlay budgets are still HUD-flavored leftovers from the default skin and are slated to move into it.
5. **Palette as values**: Skins receive resolved palette tokens on `host.palette` rather than reading CSS variables. The host writes the same tokens as `--bge-*` custom properties on the engine root (never on `:root`) for CSS layers, plus a `--bge-hue-shift` so cyan-authored SVG layers re-tint to any palette, including ones derived from a brand color with `palette: { from: '#hex' }`.
6. **Budgets, not opinions, in the core**: `intensity` (user knob), `motion` (reduced-motion policy), and `quality` (frame-time governor) are live numbers on the host. Skins scale density, contrast, and speed by them; the core never decides what a skin looks like.

---

## Custom Skins & Generative AI

The `BackgroundSkin` interface is intentionally minimal:

```ts
export type SkinHost<T = Record<string, unknown>> = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  rng: Rng;                       // seeded
  fork(label: string): Rng;       // independent seeded sub-streams
  noise: Noise2D;                 // seeded simplex + fbm
  config: ResolvedBackgroundConfig;
  palette: Palette;               // values, not CSS lookups
  options?: T;
  readonly viewport: { width; height; dpr; isMobile; isTouch };  // live
  readonly pointer: { x; y; nx; ny; vx; vy; active; down; idle }; // live
  readonly motion: 'full' | 'reduced' | 'off';                    // live
  readonly intensity: number;                                     // live, 0..1
  readonly quality: number;                                       // live, 0..1 governor output
};

export type FrameInfo = { t: number; dt: number; frame: number; timestamp: number }; // seconds

export type BackgroundSkin<T = Record<string, unknown>> = {
  id: string;
  mount(host: SkinHost<T>): { resize(v): void; frame(info: FrameInfo): void; destroy(): void };
  /** Optional DOM layers behind the canvas. Return a cleanup. */
  layers?(root: HTMLElement, context: { config; palette; options?: T }): () => void;
};
```

The host owns the clock (`Scheduler`, injectable; `createManualScheduler()` for tests), sizing, motion policy, hidden/offscreen pausing, pointer tracking, and the quality governor. Skins must not touch `Math.random`, `Date.now`, `performance.now`, or timers; the determinism test suite enforces this for every built-in skin.

This simplicity makes the engine incredibly powerful when combined with **Generative AI**. Because the contract is so strict and isolated, LLMs are excellent at writing new skins from scratch in a single shot.

### Example LLM Prompt for Creating a New Skin

> "Write a new skin for an aesthetic background engine. The engine provides a `SkinHost` object which contains `{ canvas, ctx, rng, config, options }`. I need you to implement the `BackgroundSkin` interface which requires an `id` and a `mount(host)` function. `mount` must return an object with `resize(viewport)`, `frame(timestamp)`, and `destroy()` methods.
> 
> The aesthetic I want is: [DESCRIBE YOUR AESTHETIC HERE, e.g., a retro-futuristic synthwave grid].
> 
> Use the provided `rng()` (which returns a number between 0 and 1) instead of `Math.random()` to ensure deterministic generation. Read colors from `host.palette` (`accent`, `accentRgb`, `ink`, `bg`) instead of hardcoding them. Treat the difference between successive `frame(timestamp)` values as elapsed time rather than assuming 60 fps. Only return the TypeScript code for the skin."

A fuller authoring kit (scaffold, check command, questionnaire-driven skill) is planned; see [ROADMAP.md](ROADMAP.md).

---

## Sequence & Roadmap

1. **Extraction & Abstraction**: Pull the original `void-tactical` code out of the legacy codebase, establish the `BackgroundSkin` interface, and build the generic host. *(Done)*
2. **Packaging**: Create zero-dependency publishable targets for Vanilla, React, and Web Components. *(Done)*
3. **Skin Isolation**: Move any remaining `void-tactical` specific files (like `AmbientOverlays` and CSS) fully inside the `skins/void-tactical/` directory so the core engine remains strictly theme-agnostic. *(Done)*
4. **Validation Skins**: Write secondary skins (`drifting-dust`, a particle network) with custom generic options schemas to prove the interface. *(Done)*
5. **Ecosystem & Matrix Rain**: Build a classic text-rendering skin (`matrix-rain`) to prove font/grid capabilities. *(Done)*
6. **Repair the drop-in path (ROADMAP M0)**: Container-aware sizing, injected layer stack for `mount()` and `<bg-engine>`, skin registry with string ids, palette values on the host, generated type declarations, honest README. *(Done 2026-09-26)*
7. **Host contract v2 (ROADMAP M1)**: Injectable clock and `dt`-based motion, reduced-motion policy, visibility pause, scoped palette variables, pointer/noise inputs, core decoupled from the default skin, per-skin subpath exports, determinism tests, size budgets in CI. *(Done 2026-09-26)*
8. **Layers, primitives, presets (ROADMAP M2)**: Composable `Layer`/`Scene` model, option schemas, a standard library of 14 layers, 7 presets across niches (two light-theme), and a scene studio playground. Void-tactical decomposed into five layers over a shared world, with the `void-sector` preset rebuilt from them. *(Done 2026-09-27.)*
8b. **The aesthetic bar (ROADMAP M3)**: palette coherence, art pass on void-tactical with calibration knobs, legibility mask layer and contrast probe, flagship preset tuning. *(Art pass done 2026-09-26; real-pixel contrast gate pending.)*
9. **Publishing and the authoring kit (ROADMAP M4)**: Refine the documentation, ship the scaffold and skill, and publish to encourage the community to build and share skins.
