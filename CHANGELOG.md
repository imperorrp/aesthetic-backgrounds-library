# Changelog

## Unreleased

- **Mechanics.** Universes now play differently, not just look different. A mechanic is a plugin (`registerMechanic`) with its own schema, update, and draw passes (under the map, among the ships, over everything), plus an API to spawn, steer, damage, and release fleets, add and remove structures, and fire effects. Built in:
  - `skirmish`: raiders warp in, strafe, and fight.
  - `events`: armadas, flares, and gate surges.
  - `asteroids`: belts, miners, ore, and claims.
  - `storms`: fronts that ghost ships.
  - `song`, `flocks`, `maw`, `cartography`.
  - `warfront`: territory, a moving front, captures, and bombardment.
  
  Ships now have hull points, so combat leaves wrecks and debris. Packs list their mechanics and a `look` (lanes, grid, traffic). The studio's **What happens here** panel switches them on and off and tunes them.
- **The Long Siege.** A fourth built-in universe, about a war along a front.
- **Faster ships, sharper text.** Ships fly two to three times faster than before. Skins can set `crisp` to render at full device resolution, and the sector map and instruments snap text to device pixels.
- **Instruments, busier.**
  - Approach radar: holds, go-arounds, emergencies, VFR and helicopter traffic, and conflict alerts.
  - Sonar: torpedo attacks with evasive turns and decoys, and active pings with echoes.
  - Seismograph: aftershocks, quarry blasts, volcanic tremor, teleseisms, and shaking.
  - Abyssal: alarm cascades, a hunting dragonfish, shrimp clouds, a vent field, and new animals.
  - Mars: a rover, a helicopter, orbiter relay passes, meteors, a landing, storm watches, and an ops log.
- **Seeds are back in front.** The seed is in the URL (`?bg=&seed=&u=`) and at the top of the studio, with Shuffle and Link.
- **Shorter AI prompt.** Three lines plus the config, with a universe.json download for custom packs.
- **Removed.** The GitHub galaxy.
- **Sector map overhaul.**
  - **Restored look:** structures sit in soft circles in their own color again, and the network lanes pulse at their original strength.
  - **Ships:** vector silhouettes for six classes that fly in formation (V, column, escort) with engine glow.
  - **Paths:** each fleet follows a planned curve, so its trail, the ship, and the drawn course are one continuous line, and the course is always true.
  - **Fleets and structures:** fleets live on the same plane as structures. Freighters dock at stations, mines send convoys, shipyards launch, gates jump fleets elsewhere, and scouts survey anomalies.
  - **Anomalies:** each kind has animated ASCII art and a pulsing ring in its own color.
  - **HUD:** periodic target lock with typed data. Event chatter tied to what is on screen. Label placement that never overlaps. A slow tension curve.
- **Universe packs.** Everything a world needs lives in one JSON file: names, factions, ship classes, structures with art and roles, anomalies, chatter, and background words. Built in: The Void Sector, Saltwind Reach, Choir of Hollow Stars. `universePrompt(subject)` writes a prompt any AI can answer with a pack, and `validateUniverse` accepts what comes back.
- **Instruments.** New skins: `sonar`, `atc-radar`, `seismograph`, `abyssal`, `mars-radar`.
- **Studio.** "Copy prompt for your AI" is the main export. One Shuffle button replaces Randomize, and Fit shade is gone. The universe panel is new. The gallery leads with the featured pieces, with the rest under Basics. Sample text is off by default.
- **README.** Rewritten as a short note about the idea; the technical reference moved to `docs/REFERENCE.md`.

## 0.4.0 — 2026-10-02

Aesthetic depth (ROADMAP M9).

- **One key light per scene.** `config.light` (`{ angle, warmth }`) resolves to `host.light`: angle, unit direction, key position in the frame, and warmth. When the angle is omitted the seed puts the light in an upper corner, never top center. `gradient-base` puts its key glow at the light with a fill opposite (new `secondary` and `followLight` options), `vignette` opens toward it (`lightBias`), and the `nebula` shader lights the cloud faces that point at it. Shader layers receive `u_lightDir`, `u_lightPos`, `u_warmth`, `u_accent2`, and `u_accent3`. Presets set warmth to fit their mood. A caller's `light` merges over preset defaults per field.
- **Quiet zones and automatic legibility.** With `legibility: 'auto'` (default), the host measures `main, article, [data-bg-content]` on mount, resize, scroll, and every 60 frames, plus any `config.quiet` rects. `host.quiet(x, y)` reports nearness with a soft falloff. `starfield`, `particles-drift`, `plexus`, `flow-field`, and `glyph-rain` recede there through a new `quiet` option. Above `intensity` 0.55 a feathered shade is painted behind the boxes, growing to 0.45 at full intensity. Use `'off'` or `{ selector, strength }` to override.
- **Moments.** New `moments` layer: rare seeded meteors, comets, and star flares with long random gaps, placed away from text and aimed by the light. Reduced motion keeps only flares. Added to `aurora-night`, `deep-field`, and `nebula-drift`.
- **Transitions.** `transition(handle, next, { kind, duration })` reveals a new scene in place with `crossfade`, `wipe` from the lit side, or `iris` from the incoming key light. It is driven by the incoming clock, so it is deterministic. It is instant with motion off and becomes a crossfade under reduced motion. React's `<Background>` takes `transition` and `onReady`, and changes its scene without a remount flash.
- **Handle.** `onFrame(listener)` and `composition()` (light, content rects, quiet rects, shade strength).
- **Stricter gate.** Every preset holds a mean contrast of 7:1 behind the text column in the browser gates, with at most 5% of samples under 4.5:1. The lowest preset measures 10.2:1.
- **Blind compare.** `pnpm compare` stages each baseline next to its 0.2.0 render, and `/compare.html` runs a shuffled A/B with a flip view and a reveal at the end.
- **Studio.** Light angle (or seeded) and warmth, legibility mode, transition kind, and a **Show composition** overlay with thirds, the light ray and key, content boxes, and quiet zones.
- `<bg-engine>` gains `light-angle`, `warmth`, and `legibility` attributes. Manifests validate `config.light` and `config.legibility`, and the preset JSON schema documents `light`, `legibility`, and `quiet`.
- **Fix:** shader layers survive WebGL context loss: they pause, then rebuild their program on `webglcontextrestored`.
- **Fix:** `probeContrast` no longer reads NaN for a zero-sized or detached element.
- Screenshot baselines refreshed. Void-tactical renders identically to 0.3.0: its canvas is byte-identical between the two versions. Its committed baseline had gone stale because an earlier change moved its background stars by less than the screenshot tolerance. The new baseline records the current, unchanged render.
- Size budgets raised on purpose: `core` 13 → 16 KB, `index` 62 → 67 KB, adapters 58 → 59 KB gzipped.

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
