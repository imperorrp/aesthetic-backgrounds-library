# Changelog

## 0.3.0 — 2026-10-02

Ecosystem and distribution (ROADMAP M8).

- **Community presets as data.** `validatePresetManifest`, `presetFromManifest`, `registerPresetManifest`, `loadPresetManifest`, and `manifestOf` (from `space-background-engine/manifest`). A preset published as JSON validates against the live layer schemas, with every error reported by path; it then mounts by id. Presets in `registry/community/*.json` appear in the studio and the CLI with no code change. `registry/preset.schema.json` is generated from the layer schemas for editor autocomplete.
- **Registry and CLI.** `registry/index.json` describes every skin, preset, and layer (themes, cost tier, schema, defaults, scene, author). `npx space-background-engine list | info | add | validate`; `add` writes one editable file with the scene inlined, with `--palette`, `--intensity`, and `--tokens` overrides.
- **Framework adapters.** `space-background-engine/vue` (directive and plugin) and `space-background-engine/svelte` (action), with no framework dependency. The built React entry is marked `'use client'` for the Next.js App Router.
- **Tokens.** `exposeTokens` writes the palette on `<html>` for page UI. Tailwind v4 theme (`space-background-engine/tailwind.css`) and v3 preset (`space-background-engine/tailwind-preset`). `paletteToTokens` / `paletteFromTokens` (from `space-background-engine/tokens`) speak W3C DTCG, Style Dictionary, and flat maps.
- **Palette harmonies.** Palettes carry `accent2` and `accent3` from a harmony (`analogous` default, `complementary`, `split`, `triadic`, `mono`), exposed as color tokens, `--bge-accent2`/`--bge-accent3`, and in the studio. `derivePalette` keeps a brand's own `bg` and `ink` when they contrast. Existing fields are computed exactly as before.
- **Releases.** `pnpm schema-diff` classifies registry changes and `--check` fails a release whose version bump is too small. CI checks that community manifests validate and the index is current.
- **CDN.** `examples/importmap.html` shows a pinned, build-free setup.
- Studio permalinks carry a format version; older links still open.

## Unreleased (folded into 0.3.0)

- **Shader layers.** `createShaderLayer` (from `space-background-engine/shader`) runs a GLSL ES 3.00 fragment shader on a private WebGL2 surface, composited like any other layer. Uniforms come from the frame, host, palette, and schema, so shaders stay deterministic and are configured by the same tooling. New `nebula` and `ink-flow` layers and the `nebula-drift` and `ink-wash` presets. Missing WebGL2 skips the layer instead of failing the mount.
- **Adaptive resolution.** The quality governor now lowers the backing-store scale (1 → 0.75 → 0.5) before thinning content, and recovers in reverse. `Layer.rate: 0.5` renders a heavy layer every other frame.
- **Studio.** Preset gallery, undo/redo, seeded "Randomize within schema ranges", "Fit shade" from measured content boxes, and exports for PNG, WebP, WebM loop, and preset JSON with load.
- **Exports include DOM layers.** Layers can implement `snapshot()`; `snapshotScene()` bakes them around the live canvas in DOM order.
- **Fix:** `grain` and `scanlines` rendered beneath an opaque canvas and were invisible in every standard preset. DOM layers now declare `domPlacement`, and finishing textures sit above the canvas.
- **Fix:** studio undo/redo corrupted its stacks because history was mutated inside a React state updater, which React re-invokes.
- GitHub Pages workflow publishes the studio; `pnpm sync-gallery` copies test baselines into the gallery.

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
