# Aesthetic Background Engine

A lightweight, high-performance engine for dropping premium, generative backgrounds into any web project. 

Creating beautiful, animated canvas backgrounds that play nicely with the DOM is notoriously tedious. This engine abstracts away the boilerplate. It handles the host lifecycle, DOM injection, exact deterministic seeding, high-performance requestAnimationFrame loops, and automatic devicePixelRatio (DPR) scaling without a single runtime dependency.

You provide a **skin** (the visual aesthetic), and the engine handles the rest.

While the default skin (`void-tactical`) happens to be a sci-fi sector, the engine itself is completely theme-agnostic. It is designed to run any generative aesthetic—from calm gradients and cosmic networks to terminal emulators and abstract geometry.

Page content stays fully clickable (`pointer-events: none` on the background stack).

## 30-Second Drop-In

**Via CDN (Web Component):**
The zero-dependency Web Component works in any framework or vanilla HTML file.

```html
<script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
<bg-engine seed="orion-7" detail="low"></bg-engine>
```

**Via Vanilla JS:**

```html
<div id="bg"></div>
<script type="module">
  import { mount } from 'https://unpkg.com/space-background-engine/dist/index.js';
  
  // Injects the background into the specified element
  mount('#bg', { seed: 'orion-7', detail: 'low' });
</script>
```

## Installation & React Usage

```bash
pnpm add space-background-engine
```

**React:**
The React hook wrapper guarantees clean unmounting and handles dynamic config updates instantly.

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

## Configuration Knobs

Control the aesthetic with simple, high-level parameters.

| Option | Default | Description |
| --- | --- | --- |
| `seed` | random | The PRNG seed. The exact same seed guarantees the exact same visual generation across all browsers. |
| `density` | `1` | Multiplier for the population/density of generated entities. |
| `detail` | `'low'` | Detail budget (`none`, `low`, `medium`, `high`). Controls how much visual noise or annotation is allowed. |
| `palette` | `'void-cyan'` | CSS token set injected into the root (`void-cyan`, `amber`, `violet`). |
| `cameraSpeed` | `0.25` | Base panning speed in world units. |
| `skin` | `voidTacticalSkin` | Swap the entire visual aesthetic. The engine runs whatever skin you provide. |
| `options` | `{}` | Generic options object passed to the active skin for custom aesthetic controls. |

*Note: `<bg-engine>` web component attributes mirror these core options: `seed`, `density`, `detail`, `palette`, and `speed`.*

## Architecture Highlights

This engine is built to be a robust, drop-in utility for creative developers.
- **Deterministic PRNG:** `Math.random()` is banished. The engine provides a Mulberry32 seeded generator. Passing `seed="orion-7"` guarantees the exact same visual layout, particle positions, and stars on every reload and every device.
- **High-Performance DOM Interop:** The engine isolates the canvas via a strict `ResizeObserver`, scales the context via `devicePixelRatio` for retina displays, and throttles the `requestAnimationFrame` loop to hit specific target FPS budgets, ensuring your main thread remains snappy.
- **Zero Dependencies:** The engine provides a React component, a Custom Web Component, and a Vanilla JS adapter all without a single external dependency payload.

## Custom Skins & Extensibility

The engine's architecture strictly separates the **Host** (canvas sizing, loop management, config) from the **Skin** (world generation, draw routines). 

You can easily write your own skin to create entirely new aesthetics, taking advantage of the new generic `<SkinOptions>` schema to declare your own custom controls. See the [Direction & Architecture Guide](docs/DIRECTION.md) for details on the `BackgroundSkin` API and how you can leverage generative AI to quickly bootstrap new visual themes.

---

## Local Development

```bash
pnpm install
pnpm dev          # Run the interactive playground (localhost:5174)
pnpm test         # Run the deterministic generation test suite
pnpm build:lib    # Build the package for npm / CDN
```
