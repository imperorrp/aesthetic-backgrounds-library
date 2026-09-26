# Aesthetic Background Engine

A lightweight, zero-dependency engine for dropping premium, generative backgrounds into any web project.

Creating beautiful, animated canvas backgrounds that play nicely with the DOM is notoriously tedious. This engine abstracts away the boilerplate: DOM injection, container-aware sizing, devicePixelRatio scaling, a throttled `requestAnimationFrame` loop, seeded generation, palette tokens, and clean teardown.

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

Pick a different built-in skin with an attribute:

```html
<bg-engine skin="matrix-rain" palette="amber"></bg-engine>
```

**Via Vanilla JS:**

```html
<div id="bg"></div>
<script type="module">
  import { mount } from 'https://unpkg.com/space-background-engine/dist/index.js';

  // Full-page background behind everything
  mount(document.body, { seed: 'orion-7', detail: 'low' });

  // Or inside a positioned container, with a skin picked by id
  mount('#bg', { skin: 'drifting-dust', palette: 'violet' });
</script>
```

`mount()` returns a handle with `canvas`, `root`, and `destroy()`.

## Installation & React Usage

```bash
pnpm add space-background-engine
```

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
| `seed` | random | PRNG seed. The same seed generates the same world layout on every device. |
| `skin` | `'void-tactical'` | A skin object or the id of a registered skin (`'void-tactical'`, `'drifting-dust'`, `'matrix-rain'`). |
| `options` | `{}` | Skin-specific options. See each skin's exported options type. |
| `palette` | `'void-cyan'` | Color tokens shared by the canvas and CSS layers (`void-cyan`, `amber`, `violet`). |
| `density` | `1` | Population multiplier for generated entities (clamped 0.25–2). |
| `detail` | `'low'` | Label / HUD budget for the default skin (`none`, `low`, `medium`, `high`). |
| `cameraSpeed` | `0.25` | Base drift speed. |
| `targetFps` | `60` | Frame cap for the render loop. |
| `zIndex` | `0` | z-index of the background root. |
| `fonts` | `false` | Load the display fonts used by built-in canvas text (Orbit, Syne Mono) from Google Fonts. Off by default so the package makes no network requests. |

`<bg-engine>` attributes: `seed`, `skin`, `density`, `detail`, `palette`, `speed`, `fonts`, `z-index`.

## What the engine guarantees today

- **Seeded generation.** `Math.random` is replaced by a Mulberry32 generator seeded from your string. World *layout* (stars, systems, structures, node fields) is identical for the same seed. Frame-to-frame *animation* in the default skin is not yet deterministic; that is tracked in the roadmap.
- **Container-aware sizing.** The canvas fills whatever it is mounted in and follows it through a `ResizeObserver`, with a window fallback. Backing store is scaled by `devicePixelRatio`, capped at 1.5x.
- **DOM isolation.** Everything lives in a `.bg-engine-root` with `pointer-events: none`, fixed for page mounts and absolute inside containers.
- **Clean teardown.** `destroy()` removes the DOM, disconnects observers, cancels the loop, and is safe to call twice.
- **Zero dependencies.** Vanilla, React, and Web Component entry points with no runtime payload beyond the engine.

## Custom Skins

The engine separates the **Host** (sizing, loop, config, palette) from the **Skin** (world generation and drawing). A skin is a small object:

```ts
import type { BackgroundSkin } from 'space-background-engine';

export const ripples: BackgroundSkin<{ rings?: number }> = {
  id: 'ripples',
  mount({ ctx, rng, palette, options }) {
    const rings = options?.rings ?? 6;
    const seeds = Array.from({ length: rings }, () => ({ x: rng(), y: rng(), phase: rng() * Math.PI * 2 }));
    let width = 0, height = 0;
    return {
      resize(v) { width = v.width; height = v.height; },
      frame(t) {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = `rgba(${palette.accentRgb.split(' ').join(', ')}, 0.25)`;
        for (const s of seeds) {
          const r = ((t / 1000 + s.phase) % 4) * 60;
          ctx.beginPath(); ctx.arc(s.x * width, s.y * height, r, 0, Math.PI * 2); ctx.stroke();
        }
      },
      destroy() {},
    };
  },
};
```

Then either pass the object (`mount(el, { skin: ripples })`) or register it once and use the id everywhere, including `<bg-engine skin="ripples">`:

```ts
import { registerSkin } from 'space-background-engine';
registerSkin(ripples);
```

Skins can also add GPU-friendly DOM layers behind the canvas (gradients, SVG textures, grain) by implementing the optional `layers(root, context)` hook. The default skin uses it for its atmosphere stack.

Conventions that keep skins portable: use `host.rng` instead of `Math.random`, read colors from `host.palette`, treat `frame(timestamp)` deltas as time rather than assuming 60 fps, and clean up in `destroy()`. See the [Direction & Architecture Guide](docs/DIRECTION.md) for the contract and [docs/ROADMAP.md](docs/ROADMAP.md) for where the contract is heading.

---

## Local Development

```bash
pnpm install
pnpm dev          # Interactive playground (localhost:5174)
pnpm test         # Unit + DOM tests (vitest, jsdom)
pnpm typecheck    # tsc across app and tooling configs
pnpm build:lib    # Library bundle + generated type declarations
```

Smoke pages served by the dev server: `/quick.html` (`mount(document.body)`), `/element.html` (`<bg-engine>`), `/skins.html` (container mounts with skin ids).
