# Background engine

Procedural, seeded backgrounds you can mount on a page, restyle, and extend. The default skin is a slow sci-fi sector (`void-tactical`); the engine is not limited to that look.

```ts
import { createBackground, voidTacticalSkin, applyPalette } from './src/engine';

applyPalette('void-cyan');
createBackground(document.querySelector('#bg'), {
  skin: voidTacticalSkin,
  config: { seed: 'orion-7', density: 1, detail: 'low' },
});
```

React: `<BackgroundCanvas config={{ seed: 'orion-7', detail: 'low' }} />` — a thin adapter around the same host.

## Run

```bash
pnpm install
pnpm dev
```

Demo at `http://localhost:5174`. `?seed=` is shareable. Controls: seed, palette, detail, density, overlay layers.

## Layout

- `src/engine/core` — `createBackground`, skin interface
- `src/engine/skins/void-tactical` — first skin
- `src/demo` — playground, not the library

Direction: [docs/DIRECTION.md](docs/DIRECTION.md)
