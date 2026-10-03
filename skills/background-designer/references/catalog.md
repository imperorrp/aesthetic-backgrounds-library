# Catalog

Everything registered by `import 'space-background-engine'`. Ids are what `skin`, `use`, and `<bg-engine skin>` accept.

## Presets (scenes with tuned defaults)

| Id | Niche | Theme | Stack |
| --- | --- | --- | --- |
| `calm-mesh` | SaaS landing, marketing | light | gradient-base, mesh-gradient ×2, light-follow, vignette, grain |
| `aurora-night` | SaaS, events | dark | gradient-base, starfield, aurora (lighter), moments (meteors), vignette, grain |
| `terminal-rain` | developer portfolio | dark | gradient-base, glyph-rain, scanlines, vignette |
| `deep-field` | space, sci-fi without HUD | dark | gradient-base, starfield, particles-drift, moments (mixed), vignette, grain |
| `flow-lines` | data, science, analytics | dark | gradient-base, grid (dots), flow-field, vignette |
| `fireflies` | nature, wellness, warm | dark | gradient-base, particles-drift ×2, vignette, grain |
| `paper-grid` | editorial, brutalist | light | gradient-base, grid (lines), particles-drift, grain |
| `nebula-drift` | space, music, events | dark | gradient-base, nebula (GPU), starfield, moments (comets), vignette, grain |
| `ink-wash` | editorial, studios, portfolios | light | gradient-base, ink-flow (GPU), grain |
| `void-sector` | space, sci-fi, dense | dark | void-atmosphere, void-stars, void-systems, void-fleets, void-hud |

Preset config defaults (palette, intensity, density, detail, light) apply beneath whatever you pass. Presets set a light warmth to match their mood (aurora-night and deep-field cool, fireflies and paper-grid warm) and leave the angle to the seed. A `light` you pass merges per field, so pinning `angle` keeps the preset's warmth.

Community presets live in `registry/community/*.json` and in `registry/index.json` (`source: "community"`). The authoritative, always-current list is `npx space-background-engine list --json`, which also reports each entry's themes and cost tier (`low` canvas-only, `medium` private surfaces, `gpu` WebGL2). Prefer `low` and `medium` for pages that must run well on phones.

## Skins (whole backgrounds)

| Id | Look | Key options |
| --- | --- | --- |
| `void-tactical` | living sci-fi sector map: fleets in formation between working structures, anomalies, target locks, chatter | `universe` (`void`, `saltwind`, `choir`) or `pack` (a universe pack JSON, e.g. from `universePrompt()`), `hueVariety`, `lineWeight`, `spriteScale`, `shipScale`, `hud`, `paths`, `trails`, `lock`, CSS layer toggles; config `detail`, `density` |
| `sonar` | submarine passive sonar waterfall | `contacts`, `speed`, `grain`, `labels` |
| `atc-radar` | approach radar with phosphor returns, data blocks, clearances | `traffic`, `sweep`, `timeScale`, `weather` |
| `seismograph` | station traces, quakes sweeping the stack, crust section | `stations`, `speed`, `activity`, `section` |
| `abyssal` | deep-sea scanner: bioluminescent animals, marine snow, sonar fan | `life`, `snow`, `scan` |
| `mars-radar` | Martian dust-storm radar over crater contours | `storms`, `sweep`, `contours`, `barbs` |
| `drifting-dust` | drifting node network with pointer links | `connectionRadius`, `maxNodes`, `pointerRadius` |
| `matrix-rain` | glyph rain with fading trails | `fontSize`, `fallSpeed`, `charset`, `fade` |

## Layers (stackable effects)

Base plates
- `gradient-base`: palette background plate with a key glow at the scene light and a fill opposite, tinted by warmth. `tint`, `drift`, `spread`, `opaque`, `secondary` (`harmony` uses `accent2` for the fill, `spread` uses a hue offset), `followLight` (off restores the fixed lower-left and upper-right glows of 0.3).
- `mesh-gradient`: soft overlapping color fields from the accent hue. `blobs`, `spread`, `size`, `speed`, `saturation`.
- `void-atmosphere` (DOM): the sector map's CSS plate. Boolean toggles per CSS layer.

GPU (WebGL2; skipped with a console warning where unavailable)
- `nebula`: domain-warped noise clouds in two palette hues with dust lanes. `density`, `scale`, `speed`, `warp`, `dust`, `color`, `color2`.
- `ink-flow`: marbled ink filaments. `scale`, `speed`, `sharpness`, `strength`, `color`. Reads as dark ink on light palettes.

Motion
- `aurora`: luminous ribbons on noise. `bands`, `height`, `speed`, `spread`, `ripple`, `position`. Blend `lighter` on dark.
- `starfield`: parallax stars in depth bands. `density`, `bands`, `twinkle`, `drift`, `size`, `tint`.
- `particles-drift`: glowing points on a noise flow. `count`, `size`, `speed`, `glow`, `pulse`, `turbulence`, `color`.
- `plexus`: nodes linking when near, pointer links. `count`, `radius`, `speed`, `pointerRadius`, `lineAlpha`, `color`.
- `flow-field` (own surface): streamlines with trails. `lines`, `scale`, `speed`, `trail`, `width`, `evolve`, `color`.
- `glyph-rain` (own surface): falling glyphs. `fontSize`, `speed`, `density`, `fade`, `charset`, `head`, `trail`.
- `void-stars`, `void-systems`, `void-fleets`, `void-hud`: the sector map's parts over one shared world.
- `moments`: rare seeded events (meteors, comets with tails away from the light, flaring stars), placed away from page text. `rate` (events per minute, default 1.2), `kinds` (`mixed`, `meteors`, `comets`, `flares`), `size`, `color`, `quiet`.

`starfield`, `particles-drift`, `plexus`, `flow-field`, and `glyph-rain` also take `quiet` (0 to 1, default 0.65): how strongly they recede behind measured page content. `1` empties the area behind text; `0` ignores it.

Structure and finish
- `grid` (own surface): dot, line, or cross grid with radial fade. `style`, `spacing`, `alpha`, `fade`, `drift`, `color`.
- `light-follow`: pointer glow that fades when idle. `radius`, `strength`, `lag`, `color`.
- `vignette`: edge falloff toward a color, opening toward the light. `strength`, `size`, `color`, `lightBias`.
- `content-shade`: feathered shade behind the text area. `x`, `y`, `width`, `height`, `strength`, `feather`, `color`.
- `grain` (DOM, above the canvas): SVG turbulence grain. `opacity`, `scale`, `blend`.
- `scanlines` (DOM, above the canvas): CRT lines. `spacing`, `opacity`, `color`.

DOM layers declare `domPlacement`: plates sit below the canvas, finishing textures above it. Both kinds can provide a `snapshot()` so exported images match the page.

Color fields accept a palette token (`accent`, `ink`, `inkDim`, `bg`, `hazard`) or a hex.

## Scene shape

```ts
mount(el, {
  skin: 'scene',
  palette: { from: '#ff7a1a', theme: 'dark' },
  intensity: 0.6,
  options: {
    layers: [
      { use: 'gradient-base', with: { tint: 0.3 } },
      { use: 'starfield', with: { density: 0.8 } },
      { use: 'aurora', with: { bands: 2 }, blend: 'lighter', opacity: 0.8 },
      { use: 'content-shade', with: { strength: 0.45 } },
      { use: 'vignette' },
      { use: 'grain', with: { opacity: 0.08 } },
    ],
  },
});
```

Bottom to top. `opacity` 0..1, `blend` is a canvas composite operation, `enabled: false` keeps a layer in the JSON but off.

## Config knobs (all skins and presets)

`seed`, `palette` (id, hex, `{ from, theme, harmony }`, or tokens), `intensity` 0..1, `motion` (`auto` | `full` | `reduced` | `off`), `density`, `detail`, `cameraSpeed`, `targetFps`, `adaptiveQuality`, `pauseWhenHidden`, `zIndex`, `fonts`, `exposeTokens`.

Composition: `light: { angle, warmth }` (angle in degrees with 270 straight up, seeded to an upper corner when omitted; warmth -1..1), `legibility` (`'auto'` default, `'off'`, or `{ selector, strength }`), `quiet` (extra quiet zones as viewport fractions).

Switching scenes: `transition(handle, nextOptions, { kind: 'iris' | 'wipe' | 'crossfade', duration })` returns `{ handle, done }`. React: `<Background transition={{ kind: 'iris' }} />`.
