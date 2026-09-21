# Aesthetic Background Engine

A lightweight, zero-dependency engine for mounting premium, generative backgrounds onto any website or web application. 

Creating beautiful, animated canvas backgrounds that play nicely with the DOM (handling resize, DPI scaling, and performance budgets) is notoriously tedious. This engine abstracts away the boilerplate. You provide a **skin** (the visual aesthetic), and the engine handles the host lifecycle, DOM overlay injection, deterministic seeding, and the render loop.

While the default skin (`void-tactical`) happens to be a sci-fi sector, the engine itself is completely theme-agnostic. It is designed to run any generative aesthetic—from calm gradients and cosmic dust to terminal emulators and abstract geometry.

Styles and fonts are injected automatically. Page content stays fully clickable (`pointer-events: none` on the background stack).

## 30-Second Drop-In

**Via CDN (Web Component):**

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

## Installation & Framework Usage

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

**Vanilla TypeScript:**

```ts
import { mount } from 'space-background-engine';

mount(document.body, {
  seed: 'orion-7',
  density: 1,
  detail: 'low',        // 'none' | 'low' | 'medium' | 'high'
  palette: 'void-cyan', // 'void-cyan' | 'amber' | 'violet'
});
```

## Configuration Knobs

Control the aesthetic with simple, high-level parameters.

| Option | Default | Description |
| --- | --- | --- |
| `seed` | random | The PRNG seed. The same seed always generates the exact same visual field. |
| `density` | `1` | Multiplier for the population/density of generated entities. |
| `detail` | `'low'` | Detail budget (`none`, `low`, `medium`, `high`). Controls how much visual noise or annotation is allowed. |
| `palette` | `'void-cyan'` | CSS token set injected into the root (`void-cyan`, `amber`, `violet`). |
| `cameraSpeed` | `0.25` | Base panning speed in world units. |
| `layers` | sensible defaults | Toggles for specific CSS/DOM overlays (e.g., `noise`, `clouds`, `asciiGrid`). |
| `skin` | `voidTacticalSkin` | Swap the entire visual aesthetic. The engine runs whatever skin you provide. |

*Note: `<bg-engine>` web component attributes mirror these options: `seed`, `density`, `detail`, `palette`, and `speed`.*

## Custom Skins & Extensibility

The engine's architecture strictly separates the **Host** (canvas sizing, loop management, config) from the **Skin** (world generation, draw routines). 

You can easily write your own skin to create entirely new aesthetics. See the [Direction & Architecture Guide](docs/DIRECTION.md) for details on the `BackgroundSkin` API and how you can leverage generative AI to quickly bootstrap new visual themes.

---

## Local Development

```bash
pnpm install
pnpm dev          # Run the interactive playground (localhost:5174)
pnpm test         # Run the deterministic generation test suite
pnpm build:lib    # Build the package for npm / CDN
```
