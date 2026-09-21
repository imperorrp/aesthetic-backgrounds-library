# Background engine

Procedural, seeded backgrounds for any site. The default skin (`void-tactical`) is a slow sci-fi sector; the engine is a host + skins, not a single look.

Styles and fonts are injected by `mount()` / `<bg-engine>`. Page content stays clickable (`pointer-events: none` on the stack).

## 30-second drop-in

Custom element (CDN, after publish):

```html
<script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
<bg-engine seed="orion-7" detail="low"></bg-engine>
```

Or one function:

```html
<div id="bg"></div>
<script type="module">
  import { mount } from 'https://unpkg.com/space-background-engine/dist/index.js';
  mount('#bg', { seed: 'orion-7', detail: 'low' });
</script>
```

Locally, with this repo running (`pnpm dev`):

- [http://127.0.0.1:5174/quick.html](http://127.0.0.1:5174/quick.html) — `mount()`
- [http://127.0.0.1:5174/element.html](http://127.0.0.1:5174/element.html) — `<bg-engine>`

## npm

```bash
pnpm add space-background-engine
```

```ts
import { mount } from 'space-background-engine';

mount(document.body, {
  seed: 'orion-7',
  density: 1,
  detail: 'low',      // none | low | medium | high
  palette: 'void-cyan', // void-cyan | amber | violet
});
```

React:

```tsx
import { Background } from 'space-background-engine/react';

export function App() {
  return (
    <>
      <Background seed="orion-7" detail="low" />
      <main>{/* your site */}</main>
    </>
  );
}
```

## Options

| Option | Default | |
| --- | --- | --- |
| `seed` | random name | Same seed → same field |
| `density` | `1` | Population |
| `detail` | `'low'` | How much annotation speaks |
| `palette` | `'void-cyan'` | CSS tokens |
| `cameraSpeed` | `0.25` | Pan |
| `layers` | sensible defaults | Overlay flags (`mesh`, `clouds`, `ascii1`, …) |
| `skin` | `voidTacticalSkin` | Swap the whole look |

`<bg-engine>` attributes: `seed`, `density`, `detail`, `palette`, `speed`.

## Develop this repo

```bash
pnpm install
pnpm dev          # playground
pnpm test
pnpm build:lib    # dist/ for npm / CDN
```

Direction: [docs/DIRECTION.md](docs/DIRECTION.md)
