# Aesthetic Background Engine

A lightweight, zero-dependency engine for dropping premium, generative backgrounds into any web project.

Creating beautiful, animated canvas backgrounds that play nicely with the DOM is notoriously tedious. This engine abstracts away the boilerplate: DOM injection, container-aware sizing, devicePixelRatio scaling, a throttled frame loop with a real clock, reduced-motion and hidden-tab handling, seeded generation, palette tokens, pointer input, a frame-time quality governor, and clean teardown.

You provide a **skin** (the visual aesthetic), and the engine handles the rest.

The default skin (`void-tactical`) is a sci-fi sector map, but the engine is theme-agnostic. It runs any generative aesthetic, from calm gradients and particle networks to glyph rain and abstract geometry.

Page content stays fully clickable (`pointer-events: none` on the whole background stack).

> **Status:** early. The architecture, current gaps, and the plan are in [docs/ROADMAP.md](docs/ROADMAP.md). The API below is stable enough to try, not yet to depend on.

## 30-Second Drop-In

**Via CDN (Web Component):**

```html
<script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
<bg-engine seed="orion-7" detail="low"></bg-engine>
```

Pick a built-in skin, derive a palette from your brand color, and dial the presence down:

```html
<bg-engine skin="matrix-rain" palette="#ff7a1a" intensity="0.6"></bg-engine>
```

**Via Vanilla JS:**

```html
<div id="bg"></div>
<script type="module">
  import { mount } from 'https://unpkg.com/space-background-engine/dist/index.js';

  // Full-page background behind everything
  mount(document.body, { seed: 'orion-7', detail: 'low' });

  // Or inside a positioned container, with a skin picked by id
  mount('#bg', { skin: 'drifting-dust', palette: 'violet', intensity: 0.5 });
</script>
```

`mount()` returns a handle with `canvas`, `root`, `pause()`, `resume()`, `renderOnce()`, and `destroy()`.

## Installation

```bash
pnpm add space-background-engine
```

Import only what you use. `core` has no skins; each skin registers itself when imported:

```ts
import { mount } from 'space-background-engine/core';
import 'space-background-engine/skins/matrix-rain';

mount('#hero', { skin: 'matrix-rain' });
```

The bare package import (`space-background-engine`) is batteries included: the core plus every built-in skin.

**React:**

```tsx
import { Background } from 'space-background-engine/react';

export function App() {
  return (
    <>
      <Background seed="orion-7" detail="low" palette="void-cyan" />
      <main>{/* your site content goes here */}</main>
    </>
  );
}
```

`Background` wraps `mount()`. Any prop change tears the background down and mounts it again with the new settings.

## Configuration Knobs

| Option | Default | Description |
| --- | --- | --- |
| `seed` | random | PRNG seed. The same seed replays the same world, frame for frame. |
| `skin` | `'void-tactical'` | A skin object or the id of a registered skin (`'void-tactical'`, `'drifting-dust'`, `'matrix-rain'`). |
| `options` | `{}` | Skin-specific options. See each skin's exported options type. |
| `palette` | `'void-cyan'` | A built-in id (`void-cyan`, `amber`, `violet`), a full token object, a bare hex color, or `{ from: '#hex', theme: 'dark' \| 'light' }` to derive a palette in OKLCH. |
| `intensity` | `1` | One knob for how much the background asserts itself. Skins scale motion, density, and contrast by it. `0` to `1`. |
| `motion` | `'auto'` | `auto` honors `prefers-reduced-motion`; `full`, `reduced`, or `off` force a mode. `off` renders a single frame. |
| `density` | `1` | Population multiplier for generated entities (clamped 0.25–2). |
| `detail` | `'low'` | Label / HUD budget for the default skin (`none`, `low`, `medium`, `high`). |
| `cameraSpeed` | `0.25` | Base drift speed, in world units per frame at 60 fps. Real speed is time-based. |
| `targetFps` | `60` | Frame cap for the render loop. Lowering it does not slow the animation. |
| `adaptiveQuality` | `true` | Lower `host.quality` when frames run over budget and raise it back when they recover. |
| `zIndex` | `0` | z-index of the background root. |
| `fonts` | `false` | Load the display fonts used by built-in canvas text (Orbit, Syne Mono) from Google Fonts. Off by default so the package makes no network requests. |

`<bg-engine>` attributes: `seed`, `skin`, `palette`, `intensity`, `motion`, `density`, `detail`, `speed`, `fps`, `fonts`, `z-index`.

## What the engine guarantees today

- **Deterministic replay.** `Math.random`, `Date.now`, and timers are banned from skins; the host hands each frame seeded random streams and a clock. Two instances with the same seed issue identical draw calls, which the test suite checks for every built-in skin.
- **Time-based motion.** Skins receive `dt` in seconds (clamped after stalls), so animation speed is independent of frame rate and of `targetFps`.
- **Motion policy.** `prefers-reduced-motion` is honored by default: skins see `motion: 'reduced'` and a halved `intensity`; `off` renders one static frame and stops the loop.
- **Pauses when unseen.** The loop stops while the tab is hidden or the canvas is scrolled offscreen, and resumes without a time jump.
- **Container-aware sizing.** The canvas fills whatever it is mounted in and follows it through a `ResizeObserver`, with a window fallback. Backing store is scaled by `devicePixelRatio`, capped at 1.5x.
- **Scoped styling.** Palette tokens are written as `--bge-*` custom properties on the engine root only, never on your `:root`.
- **DOM isolation and clean teardown.** Everything lives in a `.bg-engine-root` with `pointer-events: none`; `destroy()` removes the DOM, disconnects observers and listeners, cancels the loop, and is safe to call twice.
- **Zero dependencies, small by default.** The host is about 8 KB gzipped; each small skin adds about 4 KB. Budgets are enforced in CI.

## Custom Skins

The engine separates the **Host** (sizing, loop, clock, config, palette, inputs) from the **Skin** (world generation and drawing). A skin is a small object:

```ts
import type { BackgroundSkin } from 'space-background-engine/core';
import { rgba } from 'space-background-engine/core';

export const ripples: BackgroundSkin<{ rings?: number }> = {
  id: 'ripples',
  mount({ ctx, rng, palette, options, viewport, pointer }) {
    const rings = options?.rings ?? 6;
    const seeds = Array.from({ length: rings }, () => ({ x: rng(), y: rng(), phase: rng() * 4 }));
    return {
      resize() {},
      frame({ t }) {
        const { width, height } = viewport;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = rgba(palette.accentRgb, 0.25);
        for (const s of seeds) {
          const r = ((t + s.phase) % 4) * 60;
          ctx.beginPath();
          ctx.arc(s.x * width, s.y * height, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (pointer.active) {
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, 40 + Math.sin(t * 3) * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
      destroy() {},
    };
  },
};
```

What the host gives a skin (`SkinHost`):

| Field | Purpose |
| --- | --- |
| `canvas`, `ctx` | The 2D context, already DPR-scaled. |
| `rng`, `fork(label)`, `noise` | Seeded random stream, independent sub-streams, seeded 2D simplex + fbm. |
| `config`, `options`, `palette` | Resolved config, skin options, palette tokens as values (never read CSS variables). |
| `viewport` | Live `width`, `height`, `dpr`, `isMobile`, `isTouch`. |
| `pointer` | Live position, velocity, `active`, `down`, seconds `idle`. |
| `motion`, `intensity`, `quality` | Live policy and budgets to scale your effect by. |

Each frame receives `{ t, dt, frame, timestamp }` in seconds. Rules that keep skins portable: no `Math.random`, `Date.now`, `performance.now`, or timers; move by `dt`; read colors from `host.palette`; release everything in `destroy()`.

Then either pass the object (`mount(el, { skin: ripples })`) or register it once and use the id everywhere, including `<bg-engine skin="ripples">`:

```ts
import { registerSkin } from 'space-background-engine/core';
registerSkin(ripples);
```

Skins can also add GPU-friendly DOM layers behind the canvas (gradients, SVG textures, grain) by implementing the optional `layers(root, context)` hook. The default skin uses it for its atmosphere stack.

Testing a skin: `createManualScheduler()` drives the loop by hand, so a test can step 240 frames and compare draw-call hashes for two seeds. See `src/engine/skins/determinism.test.ts`.

See the [Direction & Architecture Guide](docs/DIRECTION.md) for the contract and [docs/ROADMAP.md](docs/ROADMAP.md) for where the contract is heading.

---

## Local Development

```bash
pnpm install
pnpm dev          # Interactive playground (localhost:5174)
pnpm test         # Unit, DOM, and determinism tests (vitest, jsdom)
pnpm typecheck    # tsc across app and tooling configs
pnpm build:lib    # Library bundle + generated type declarations
pnpm size         # Gzip budget per entry closure (run after build:lib)
```

Smoke pages served by the dev server: `/quick.html` (`mount(document.body)`), `/element.html` (`<bg-engine>`), `/skins.html` (container mounts with skin ids and palettes).
