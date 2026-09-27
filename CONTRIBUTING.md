# Contributing

Thanks for wanting to make backgrounds better. This project values restraint and reproducibility: a contribution should look deliberate at a glance and render identically from the same seed.

## Setup

```bash
pnpm install
pnpm dev                 # studio at http://localhost:5174
pnpm test                # unit + jsdom + determinism
pnpm test:e2e            # browser gates (installs nothing; run `pnpm exec playwright install chromium` once)
```

## Adding a layer

1. Create `src/engine/layers/<id>.ts` exporting a `Layer` with an `id`, `label`, `description`, `tags`, and a `schema` for every option. Read `skills/background-designer/references/conventions.md` first.
2. Register it in `src/engine/layers/index.ts` (import, add to `standardLayers`, export).
3. Add it to a preset or a scene test in `src/engine/core/scene.test.ts` if it introduces new behavior.
4. Run `pnpm test` and `pnpm test:e2e`. If you changed how an existing preset looks on purpose, refresh its baseline with `pnpm test:e2e:update` and mention it in the PR.

## Adding a skin

```bash
pnpm create-skin <id> --label "Name" --tags "niche,mood"
pnpm skin:check <id> --update     # first run writes the screenshot baseline
```

The scaffold registers the skin in `src/engine/skins/local.ts` and adds it to `e2e/subjects.json`. Prefer a layer unless the effect has its own world model.

## Adding a preset

Add a `PresetDefinition` to `src/engine/presets/index.ts` with `config` defaults (palette, intensity) and a `scene`. Add the id to `e2e/subjects.json`, then `pnpm skin:check <id> --update`. Tune it in the studio with **Sample content column** on; aim for mean contrast of at least 7:1 behind body text.

## Rules the gates enforce

- No `Math.random`, `Date.now`, `performance.now`, or timers inside skins and layers.
- Two renders with one seed produce identical draw calls (unit) and identical pixels (browser).
- Palette ink stays at or above 4.5:1 mean contrast behind a text column at default settings.
- Every entry stays within its gzip budget (`pnpm size`, budgets in `scripts/size-check.mjs`). Raise a budget only on purpose, in its own commit.

## Pull requests

- One concern per PR. Include before/after screenshots for visual changes (the e2e baselines are a good source).
- Keep commit messages descriptive; the roadmap (`docs/ROADMAP.md`) is updated when a milestone item lands.
- Be kind in review. Aesthetic opinions are welcome when they come with a screenshot.
