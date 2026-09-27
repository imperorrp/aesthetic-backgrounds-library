# Changelog

## 0.2.0 — 2026-09-27

First release built on the layer and scene model.

- Host contract v2: injectable clock with `dt`-based motion, reduced-motion policy, hidden-tab and offscreen pause (`pauseWhenHidden`), `intensity`, frame-time `quality` governor, `host.palette` values with scoped `--bge-*` variables, palette derivation from a brand color in OKLCH (dark and light), `host.pointer`, `host.noise`, `host.fork`.
- Layers and scenes: `Layer` with option schemas and shared or private surfaces, `Scene` JSON run by the `scene` skin, `createPreset`/`registerPreset`, `fromSkin`. Fourteen standard layers and eight presets across SaaS, terminal, space, data, nature, and editorial niches, two light-theme.
- Void-tactical art pass: palette-coherent colors (`hueVariety`), crisp ASCII sprites with tactical brackets, flowing network links, radar sweeps, wrap-safe fleet paths, calibration knobs (`lineWeight`, `spriteScale`, `hud`, `paths`, `trails`), and decomposition into five layers over a shared world (`void-sector`).
- Studio: preset and skin picker, schema-generated controls, layer stack editor, brand-color palette derivation, permalinks, `mount()` snippet, PNG export, sample content column with a live legibility readout.
- Quality gates: determinism per skin and preset (unit), Playwright screenshots, contrast behind a text column, pixel-identical replay; gzip budgets per entry; GitHub Actions.
- Authoring kit: `pnpm create-skin`, `pnpm skin:check`, the `background-designer` skill with questionnaire, conventions, and catalog.
- Packaging: `core`, `skins/*`, `layers`, `presets` subpath exports; generated type declarations.

Breaking from 0.1: palette variables moved from `:root` (`--accent`, `--bg`, ...) to `--bge-*` on the engine root; `SkinInstance.frame` receives `FrameInfo` instead of a timestamp; `mount()` requires a registered skin (import the package or a `skins/*` entry).

## 0.1.0

Initial extraction of the void-tactical background into a host/skin engine with vanilla, React, and web-component entry points.
