# Reference

- [Installation](#installation)
- [Presets](#presets)
- [Frameworks](#frameworks)
- [Copy a background into your project](#copy-a-background-into-your-project)
- [Community presets](#community-presets)
- [Palette tokens on your page](#palette-tokens-on-your-page)
- [Configuration](#configuration)
- [What the engine guarantees](#what-the-engine-guarantees)
- [Scenes and layers](#scenes-and-layers)
- [Light, quiet zones, moments, transitions](#light-quiet-zones-moments-transitions)
- [Events and sound](#events-and-sound)
- [Using it with an AI agent](#using-it-with-an-ai-agent)
- [Making a world](#making-a-world)
- [Writing your own skin](#writing-your-own-skin)
- [Local development](#local-development)

Everything about the API, the configuration, and how to extend it. How the internals fit together is in [docs/ARCHITECTURE.md](ARCHITECTURE.md).

> **Status:** early. The API below is stable enough to try, but not yet stable enough to depend on. Plans and open items are in [docs/ROADMAP.md](ROADMAP.md).

## Installation

```bash
pnpm add space-background-engine
```

The bare import (`space-background-engine`) is batteries included: the core, every built-in skin, the standard layer library, and the curated presets. For a smaller bundle, import only what you use. `core` has no skins, and each skin registers itself when it is imported:

```ts
import { mount } from 'space-background-engine/core';
import 'space-background-engine/skins/matrix-rain';

mount('#hero', { skin: 'matrix-rain' });
```

| Entry | What it adds |
| --- | --- |
| `space-background-engine` | The core, every skin, the layers and presets, and the shader, manifest, and token tools. |
| `/core` | The host: mount, sizing, clock, palettes, registries. |
| `/skins/void-tactical` | The sector map, its universes (loaded on demand), and the mechanics API. |
| `/skins/undercity` | Undercity's shell. The city itself loads on first mount. |
| `/skins/fantasy` | Shieldwall, Ages, the War Table, Wyrmspire, Deephold, and Leylines: shells; each world loads on first mount. |
| `/skins/petri` | The Petri dish's shell; the dish loads on first mount. |
| (none yet) | The kit worlds (Silent Running, Foundry, and the eleven after them) have no entry of their own. They come with the bare import, and each loads on first mount. |
| `/skins/drifting-dust`, `/skins/matrix-rain` | The small skins. |
| `/layers`, `/presets` | The layer library and the curated presets. |
| `/shader` | `createShaderLayer` for GPU layers. |
| `/manifest`, `/tokens` | Preset manifests (JSON) and design-token import and export. |
| `/audio` | Generated sound bound to events. |
| `/react`, `/vue`, `/svelte`, `/element` | Framework adapters and the `<bg-engine>` element. |

## Presets

Presets are the fastest path to a good result. Each is a tuned scene with its own palette and intensity defaults, registered like a skin:

```ts
import { mount } from 'space-background-engine/core';
import 'space-background-engine/presets';

mount(document.body, { skin: 'calm-mesh' });                       // light SaaS plate
mount('#hero', { skin: 'aurora-night', palette: '#22d3ee' });     // override the palette
```

| Preset | Niche | Theme |
| --- | --- | --- |
| `calm-mesh` | SaaS landing, marketing | light |
| `aurora-night` | SaaS, events | dark |
| `terminal-rain` | developer portfolios | dark |
| `deep-field` | space, sci-fi (no HUD) | dark |
| `flow-lines` | data, science, analytics | dark |
| `fireflies` | nature, wellness, quiet portfolios | dark |
| `nebula-drift` | space, music, events | dark |
| `ink-wash` | editorial, studios, portfolios | light |
| `paper-grid` | editorial, brutalist | light |
| `void-sector` | space, sci-fi, dense | dark |

## Frameworks

**React:**

```tsx
import { Background } from 'space-background-engine/react';

export function App() {
  return (
    <>
      <Background skin="void-tactical" seed="orion-7" options={{ universe: 'siege' }} />
      <main>{/* your site content goes here */}</main>
    </>
  );
}
```

`Background` wraps `mount()`. Any prop change tears the background down and mounts it again with the new settings. The built React entry is marked `'use client'`, so it works as-is in the Next.js App Router.

**Vue, Svelte, Astro, no build step.** Each adapter is a thin layer over `mount()`, with no framework dependency of its own:

```ts
// Vue 3: a directive
import { BackgroundPlugin } from 'space-background-engine/vue';
app.use(BackgroundPlugin);           // <section v-background="{ skin: 'calm-mesh' }" />

// Svelte: an action
import { background } from 'space-background-engine/svelte';   // <div use:background={{ skin: 'deep-field' }} />
```

Astro and plain HTML use the `<bg-engine>` element. Without a bundler, an import map pins a version from a CDN. See [examples/importmap.html](../examples/importmap.html).

## Copy a background into your project

The CLI reads the registry and writes one editable file. The scene then lives in your repo, where you and your agent can change it, while the engine stays a dependency:

```bash
npx space-background-engine list --kind preset
npx space-background-engine info aurora-night
npx space-background-engine add aurora-night --palette '#ff7a1a' --intensity 0.6
npx space-background-engine add calm-mesh --tokens ./design/tokens.json
```

`add` writes `src/backgrounds/<id>.ts` with the manifest inlined and a `mountBackground()` function. `--tokens` derives the palette from a brand token file.

## Community presets

A preset is data: a scene plus config defaults. Anyone can publish one as JSON without shipping code, because every layer validates its options against a schema before anything mounts.

```ts
import { mount } from 'space-background-engine';
import { loadPresetManifest } from 'space-background-engine/manifest';

const preset = await loadPresetManifest('https://example.com/ember-nocturne.json');
mount(document.body, { skin: preset });
```

`validatePresetManifest()` reports every problem with a path (`scene.layers[1].with.style: "hexagons" is not one of dots, lines, cross`). Point `"$schema"` at `registry/preset.schema.json`, and editors autocomplete layer ids and every option with its range. To list a preset in the gallery, add its JSON to [registry/community](../registry/community) in a pull request. CI validates it, and it appears in the studio with no code change. In the studio, `?preset=<url>` loads and selects any manifest.

## Palette tokens on your page

Pass `exposeTokens: true`, and the background's palette is written as `--bge-*` variables on `<html>`, so your own UI can follow it. With Tailwind:

```css
/* Tailwind v4 */
@import "tailwindcss";
@import "space-background-engine/tailwind.css";   /* bg-bge-bg, text-bge-ink, border-bge-accent, ... */
```

```js
// Tailwind v3
import bge from 'space-background-engine/tailwind-preset';
export default { presets: [bge] };                  // supports opacity: bg-bge-accent/20
```

To share the palette with design tools, use `space-background-engine/tokens`. `paletteToTokens()` exports W3C DTCG tokens that Figma Variables importers and Tokens Studio read, and `paletteFromTokens()` derives a palette from an existing token file. Both are buttons in the studio.

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `seed` | random | PRNG seed. The same seed replays the same world, frame for frame. |
| `skin` | `'void-tactical'` | A skin object or a registered id. Skins: `void-tactical`, `undercity`, `shieldwall`, `ages`, `war-table`, `wyrmspire`, `deephold`, `leylines`, `silent-running`, `foundry`, `brasswind`, `ironhaze`, `sandsea`, `windtrap`, `walking-castle`, `war-rig`, `traction`, `last-loop`, `blockade`, `titan-dock`, `saber-front`, `sonar`, `atc-radar`, `seismograph`, `abyssal`, `mars-radar`, `petri`, `drifting-dust`, `matrix-rain`, and every preset id. |
| `options` | `{}` | Skin-specific options; see each skin's section below. |
| `palette` | `'void-cyan'` | One of: <ul><li>a built-in id (`void-cyan`, `amber`, `violet`)</li><li>a full token object</li><li>a bare hex color</li><li>`{ from: '#hex', theme: 'dark' \| 'light', harmony }`, which derives a palette in OKLCH. `harmony` (`analogous`, `complementary`, `split`, `triadic`, `mono`) sets the secondary hues `accent2` and `accent3`.</li></ul> |
| `exposeTokens` | `false` | Also write the palette as `--bge-*` variables on `<html>` (or a given element) for your own UI. |
| `intensity` | `1` | How much the background asserts itself, `0` to `1`. Skins scale motion, density, and contrast by it. |
| `motion` | `'auto'` | `auto` honors `prefers-reduced-motion`. `full`, `reduced`, or `off` force a mode, and `off` renders a single frame. |
| `density` | `1` | Population multiplier for generated entities (clamped 0.25–2). |
| `light` | seeded | `{ angle, warmth }`: one key light that every layer reads. Omit `angle` and the seed picks an upper corner. `warmth` runs from cool (`-1`) to warm (`1`). |
| `legibility` | `'auto'` | Measures the page's content boxes (`main, article, [data-bg-content]`) and makes the background recede behind them, adding a feathered shade above `intensity` 0.55. Use `'off'`, or `{ selector, strength }` for a fixed shade. |
| `quiet` | `[]` | Extra quiet zones as viewport fractions `{ x, y, width, height }`, for content the selector cannot see. |
| `detail` | `'low'` | Label and HUD budget for the sector map (`none`, `low`, `medium`, `high`). |
| `cameraSpeed` | `0.25` | Base drift speed, in world units per frame at 60 fps. Real speed is time-based. |
| `interactive` | `false` | Wheel zoom and drag pan on empty parts of the page, for skins with a camera. |
| `nudges` | `false` | A click on an empty part of the page nudges the world there (the worlds in [Touching a world](STUDIO.md#touching-a-world)): a ring shows where, and the world answers. Also `handle.nudge(x, y)`. |
| `targetFps` | `60` | Frame cap for the render loop. Lowering it does not slow the animation. |
| `pixelRatio` | device | Backing pixels per CSS pixel, fixed. By default the device's, capped at 1.5 (2 for text-heavy skins) and lowered by the quality governor. Set it for exports and wallpapers: `3` renders a phone-sized viewport at a phone's own resolution. |
| `adaptiveQuality` | `true` | Lowers `host.quality` when frames run over budget, and raises it back when they recover. |
| `zIndex` | `0` | z-index of the background root. |
| `fonts` | `false` | Loads the display fonts used by built-in canvas text (Orbit, Syne Mono) from Google Fonts. Off by default, so the package makes no network requests. |

`<bg-engine>` attributes: `seed`, `skin`, `palette`, `intensity`, `motion`, `density`, `detail`, `speed`, `fps`, `fonts`, `z-index`, `light-angle`, `warmth`, `legibility` (`auto` or `off`).

## What the engine guarantees

- **Deterministic replay.** `Math.random`, `Date.now`, and timers are banned from skins. The host hands each frame seeded random streams and a clock. Two instances with the same seed issue identical draw calls, which the test suite checks for every built-in skin, and the browser gates check for pixel-identical PNGs.
- **Time-based motion.** Skins receive `dt` in seconds (clamped after stalls), so animation speed doesn't depend on frame rate or on `targetFps`.
- **Motion policy.** `prefers-reduced-motion` is honored by default: skins see `motion: 'reduced'` and a halved `intensity`. `off` renders one static frame and stops the loop.
- **Pauses when unseen.** The loop stops while the tab is hidden or the canvas is scrolled offscreen, and resumes without a time jump.
- **Container-aware sizing.** The canvas fills whatever it is mounted in and follows it through a `ResizeObserver`, with a window fallback. The backing store is scaled by `devicePixelRatio`, capped at 1.5x.
- **Scoped styling.** Palette tokens are written as `--bge-*` custom properties on the engine root only, never on your `:root`.
- **DOM isolation and clean teardown.** Everything lives in a `.bg-engine-root` with `pointer-events: none`. `destroy()` removes the DOM, disconnects observers and listeners, cancels the loop, and is safe to call twice.
- **Text stays readable.** By default the host finds your content boxes, and motion layers thin out behind them. Busy scenes also get a feathered shade. Every built-in skin and preset holds a mean 7:1 contrast behind a text column in the browser gates.
- **Zero dependencies, small by default.** The host is about 16 KB gzipped. Universes beyond the first, mechanics, the Undercity city, and sound all load only when used. Budgets are enforced in CI.

## Scenes and layers

Under the presets sits a composable model:
- A **layer** is one effect, with a declared option schema.
- A **scene** is JSON: an ordered stack of layer references, bottom to top, each with options, opacity, and a blend mode.

The `scene` skin runs any scene. A background can be authored, tuned in the studio, and pasted into `mount()` with no code:

```ts
import { mount } from 'space-background-engine/core';
import 'space-background-engine/layers';

mount(document.body, {
  skin: 'scene',
  palette: { from: '#ff7a1a' },
  intensity: 0.7,
  options: {
    layers: [
      { use: 'gradient-base', with: { tint: 0.3 } },
      { use: 'starfield', with: { density: 0.8, bands: 3 } },
      { use: 'aurora', with: { bands: 2 }, blend: 'lighter', opacity: 0.8 },
      { use: 'vignette' },
      { use: 'grain', with: { opacity: 0.08 } },
    ],
  },
});
```

Standard layers:
- **Bases and fields:** `gradient-base`, `mesh-gradient`, `aurora`, `starfield`, `grid`
- **Motion:** `particles-drift`, `plexus`, `flow-field`, `glyph-rain`
- **Light and finish:** `light-follow`, `vignette`, `grain`, `scanlines`
- **Legibility:** `content-shade`, a feathered shade behind your text column, so any scene passes a contrast check
- **Events:** `moments`, rare seeded events (see below)

Any whole skin can also be used as a layer (`fromSkin`), and the sector map registers itself that way. Every layer:
- reads its colors from the palette, or from tokens like `accent` and `inkDim`
- scales itself by `intensity` and `quality`
- draws deterministically from the seeded streams

Options are validated against each layer's schema: numbers are clamped, unknown enum values fall back to defaults, and nothing throws on a typo in a JSON preset. The same schema drives the studio's controls, and it is what an agent fills in when it builds a scene for you.

**Shader layers.** Layers can render on the GPU. `createShaderLayer` takes a GLSL ES 3.00 fragment shader and gives it a private WebGL2 surface, composited like any other layer. Uniforms come from:
- the frame: `u_time`, `u_dt`
- the host: `u_resolution`, `u_pointer`, `u_intensity`, `u_quality`, `u_seed`
- the palette: `u_bg`, `u_accent`, `u_accent2`, `u_accent3`, `u_ink`, `u_hazard`
- the scene light: `u_lightDir`, `u_lightPos`, `u_warmth`
- your schema: every numeric, boolean, and color field, as `u_<name>`

A prelude provides `hash21`, `vnoise`, and `fbm`.

```ts
import { createShaderLayer } from 'space-background-engine/shader';
import { registerLayer } from 'space-background-engine/core';

registerLayer(createShaderLayer({
  id: 'haze', label: 'Haze', schema: { scale: { type: 'number', min: 1, max: 6, default: 3 } },
  fragment: `void main() {
    float n = fbm(v_uv * u_scale + u_time * 0.05, 4);
    float a = smoothstep(0.0, 0.8, n) * 0.4 * u_intensity;
    fragColor = vec4(u_accent * a, a);
  }`,
}));
```

Because every input is a uniform, shader layers stay deterministic: the same seed renders identical pixels. The built-in shader layers are `nebula` and `ink-flow`. Where WebGL2 is unavailable, the layer logs once and is skipped, and the rest of the scene renders normally. If the GPU drops the context, the layer pauses and rebuilds its program when the context is restored. Heavy layers can set `rate: 0.5` to render every other frame.

To publish your own preset, wrap a scene:

```ts
import { registerPreset } from 'space-background-engine/core';

registerPreset({
  id: 'ember-field',
  label: 'Ember field',
  tags: ['dark', 'warm'],
  config: { palette: { from: '#f97316' }, intensity: 0.8 },
  scene: { layers: [{ use: 'gradient-base' }, { use: 'particles-drift', with: { glow: 0.9 } }] },
});
```

## Light, quiet zones, moments, transitions

Layers in a scene agree with each other because the host gives them a shared composition.

- **One key light.** `host.light` holds an angle, a unit direction, an in-frame key position, and a warmth. By default the seed places the light in an upper corner, never top center. Set `light: { angle: 225, warmth: 0.4 }` to pin it. Layers use it like this:
  - `gradient-base` puts its main glow at the key and a fill light opposite.
  - `vignette` opens toward the light.
  - The `nebula` shader lights the side of each cloud that faces the key.
  - `moments` aims comet tails and flare spikes by it.
  - Shader layers receive `u_lightDir`, `u_lightPos`, and `u_warmth`.
- **Quiet zones.** With `legibility: 'auto'`, the host measures your content boxes on mount, resize, and scroll. `host.quiet(x, y)` returns 0 to 1 near those boxes, with a soft falloff. Particles, stars, plexus links, glyph-rain heads, and flow lines recede there (each layer's `quiet` option sets how much), so text sits on calm ground instead of under a shade box. At high `intensity`, a feathered shade is added too.
- **Moments.** The `moments` layer stages rare, seeded events: a meteor every minute or so, a slow comet, a star that flares. Gaps are random and long, and events avoid your text. The same seed stages the same events at the same seconds. Under reduced motion, only flares remain.
- **Transitions.** `transition(handle, nextOptions, { kind, duration })` mounts the next scene in place and reveals it with one of:
  - `crossfade`
  - `wipe`, from the lit side
  - `iris`, opening from the new scene's key light

  It is driven by the incoming scene's own clock, so it replays deterministically. It is instant with motion off, and a crossfade under reduced motion. In React, pass `transition` to `<Background>`.

```ts
import { mount, transition } from 'space-background-engine';

let bg = mount(document.body, { skin: 'deep-field', light: { warmth: -0.2 } });
// later, when the page changes section:
bg = transition(bg, { skin: 'aurora-night' }, { kind: 'iris', duration: 1.4 }).handle;
```

`handle.composition()` reports the light, the measured content rects, the quiet zones, and the current shade strength, and `handle.onFrame(fn)` subscribes to frames. The studio's **Show composition** overlay draws all of it over the live background.

## Events and sound

`handle.onEvent(fn)` reports what happens in a background as it happens. Each `SkinEvent` carries:
- `type`: `explosion`, `raid`, `capture`, `song`, `bombard`, `breach`, `supernova`, ...
- `weight`: 0 to 1, how much it matters
- `pan`: -1 to 1, where across the screen it happened
- `near`: 1 when it is on screen and up front

The sector map, Undercity, the fantasy worlds, the kit worlds, the Petri dish, and the five instruments report what happens: torpedoes, quakes, emergencies, storms, and more. Skins also send `ambience` (0 to 1: the sector's tension, how hard it is raining), which sound uses for its beds. Events are silent during `fastForward` and cost nothing while nobody listens. At a time scale above 1, every step reports, since that is live time running faster.

Sound is a separate, opt-in entry. Every sound is synthesized, so there are no assets to load:

```ts
import { mount } from 'space-background-engine';
import { createSoundscape } from 'space-background-engine/audio';

const bg = mount(document.body, { skin: 'void-tactical', options: { universe: 'siege' } });
const sound = createSoundscape({ palette: 'siege', volume: 0.5 });
sound.attach(bg);
button.onclick = () => sound.start(); // browsers allow audio only after a click or key press
```

A **sound palette** maps event types to cues (boom, ping, bell, sweep, whoosh, thump, choir, crackle). It also sets a drone and a noise bed underneath: rain in Undercity, wind on Saltwind, the hull's hum in the Last Fleet, the deep in Sonar. The built-in palettes:
- worlds: `void`, `saltwind`, `choir`, `siege`, `hive`, `lastfleet`, `cradle`, `undercity`, `shieldwall`, `ages`, `war-table`, `wyrmspire`, `deephold`, `leylines`, `silent-running`, `foundry`
- instruments: `sonar`, `atc-radar`, `seismograph`, `abyssal`, `mars-radar`, `petri`

The eleven newest worlds (Brasswind to Saber Front) have no palette of their own yet, so they fall back to `void`.

`registerSoundPalette()` adds your own.

Under the hood, everything runs through a mastering chain: rumble cut, soft saturation, glue compression, and a limiter. It plays in a generated stereo room with early reflections and a damped tail, and echoes go through a ping-pong delay.
- **Distance.** A cue's loudness follows the event's weight and nearness, and far events are darker and deeper in the room.
- **Space for big hits.** Big hits briefly duck the bed.
- **Timing.** Notes land on a quiet pulse, so a busy map sounds composed rather than random.
- **Restraint.** A per-cue rate limit keeps a busy map from turning to noise, and the soundscape suspends while the tab is hidden.

`pnpm sound-check` renders every palette offline and reports its levels.

## Using it with an AI agent

The repository ships a skill, `skills/background-designer/SKILL.md`, that turns a conversation into a background. It contains:
- an intake questionnaire
- a decision procedure: preset, then scene, then layer, then skin
- the conventions the gates enforce
- a catalog of everything registered
- taste notes

Claude Code picks it up from `.claude/skills/`. For other tools, paste the skill file and its `references/` into the agent's context. Every option is declared in a schema and every render is deterministic. So an agent can propose a `mount()` call, you can paste it, and the result is exactly what it described.

## Making a world

A *world* is a seeded simulation with a painter, built on the kit (`src/engine/kit`): the kind of thing Foundry, Titan Dock, and the other worlds in `src/engine/skins/worlds` are. [docs/AUTHORING.md](AUTHORING.md) has the kit for making one: the bar a world must clear (the wallpaper test), a brief to fill in, and the house rules.

```bash
pnpm create-world tidepool --label "Tide pool"   # copies the template world (the Pond) and registers it
pnpm world:check tidepool                        # busy, never quiet, varied by seed, replays, runs on a phone
pnpm lab tidepool t=10,60,300,900                # look at it
```

`world:check` runs the world headless over four seeds for ten simulated minutes each and reports how soon the first event comes, events a minute, the longest quiet, how alike the seeds are, a replay, and a phone-sized run. A draft that is not registered yet works with `module=/src/.../index.ts`, in `world:check` and in the lab.

## Writing your own skin

```bash
pnpm create-skin ember-drift --label "Ember drift" --tags "warm,calm"
pnpm skin:check ember-drift --update
```

The scaffold writes a skin that already follows the conventions (seeded randomness, `dt`-based motion, palette colors, a schema, cleanup). It also registers the skin and adds it to the browser gates. `skin:check` runs:
- the typecheck
- unit determinism
- the screenshot
- contrast behind a text column
- pixel-identical replay

It prints the path of the reference render, so you iterate on the picture. `example-motes` in the repo is the scaffold's unedited output. See [CONTRIBUTING.md](../CONTRIBUTING.md).

The engine separates the **host** (sizing, loop, clock, config, palette, inputs) from the **skin** (world generation and drawing). A skin is a small object:

```ts
import type { BackgroundSkin } from 'space-background-engine/core';
import { rgba } from 'space-background-engine/core';

export const ripples: BackgroundSkin<{ rings?: number }> = {
  id: 'ripples',
  mount({ ctx, rng, palette, options, viewport, pointer }) {
    const rings = options?.rings ?? 6;
    const seeds = Array.from({ length: rings }, () => ({ x: rng(), y: rng(), phase: rng() * 4 }));
    return {
      resize() {},
      frame({ t }) {
        const { width, height } = viewport;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = rgba(palette.accentRgb, 0.25);
        for (const s of seeds) {
          const r = ((t + s.phase) % 4) * 60;
          ctx.beginPath();
          ctx.arc(s.x * width, s.y * height, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        if (pointer.active) {
          ctx.beginPath();
          ctx.arc(pointer.x, pointer.y, 40 + Math.sin(t * 3) * 6, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
      destroy() {},
    };
  },
};
```

What the host gives a skin (`SkinHost`):

| Field | Purpose |
| --- | --- |
| `canvas`, `ctx` | The 2D context, already DPR-scaled. |
| `rng`, `fork(label)`, `noise` | A seeded random stream, independent sub-streams, and seeded 2D simplex noise with fbm. |
| `config`, `options`, `palette` | The resolved config, the skin's options, and the palette tokens as values (never read CSS variables). |
| `viewport` | Live `width`, `height`, `dpr`, `isMobile`, `isTouch`. |
| `pointer` | Live position, velocity, `active`, `down`, and seconds `idle`. |
| `motion`, `intensity`, `quality` | Live policy and budgets to scale your effect by. |
| `light` | The scene key light: `angle`, unit `dx`/`dy`, key position `x`/`y` (0 to 1), `warmth`. |
| `quiet(x, y)` | 0 to 1: how close a CSS-pixel point is to page content. Recede there. |
| `events` | Where to report what happens (`emit`), for `handle.onEvent` and sound. Check `active` first. |

Each frame receives `{ t, dt, frame, timestamp }`, with times in seconds. A skin can also offer:
- `advance(info)`: a sim-only step, used for fast-forward
- `inspect()`: counts and an event log, for the lab and the headless runner

Rules that keep skins portable:
- no `Math.random`, `Date.now`, `performance.now`, or timers
- move by `dt`
- read colors from `host.palette`
- release everything in `destroy()`

Then either pass the object (`mount(el, { skin: ripples })`), or register it once and use the id everywhere, including `<bg-engine skin="ripples">`:

```ts
import { registerSkin } from 'space-background-engine/core';
registerSkin(ripples);
```

Skins can also add GPU-friendly DOM layers behind the canvas (gradients, SVG textures, grain) by implementing the optional `layers(root, context)` hook. The sector map uses it for its atmosphere stack.

To test a skin, drive the loop by hand with `createManualScheduler()`. A test can then step 240 frames and compare draw-call hashes for two seeds. See `src/engine/skins/determinism.test.ts`.

## Local development

```bash
pnpm install
pnpm dev          # the studio (localhost:5174)
pnpm test         # unit, DOM, determinism, and headless sim tests (vitest)
pnpm test:e2e     # real-browser gates (Playwright): screenshots, contrast, pixel-identical replay
pnpm typecheck    # tsc -b across the app and tooling configs
pnpm build:lib    # library bundle + generated type declarations
pnpm size         # gzip budget per entry (run after build:lib)
```

**The fast loop.** Testing an idea doesn't have to mean watching a browser:
- `pnpm sim siege 300 all`: steps a world in node with no drawing, then prints counts over time, the event log, and any problems (NaN positions, empty fleets, failed mechanics). Minutes of simulation take seconds.
- `pnpm lab u=siege seek="FALLS TO" after=0.5,3,8`: jumps to the first matching log line and saves a contact sheet of the moments after it.
- `pnpm lab undercity t=5,30,60 crop=500,200,520,340 dsf=2`: zooms in on a region at retina density.
- `pnpm media`: regenerates every image in this README from fixed seeds.
- `pnpm sound-check`: renders every sound palette offline and reports its loudness, so levels are measured, not guessed.
- `pnpm thumbs`: small JPEGs of the screenshot baselines for the studio's world cards and gallery (run after `pnpm test:e2e:update`).
- In the studio, **1 2 3** run time at ×1, ×4, ×16 and **Space** pauses. `?debug` adds skip-ahead buttons, live counts, and the event log; `?t=300` opens a world five minutes in.

**Browser gates.** `pnpm test:e2e` renders every built-in skin, universe, and preset through `/check.html`. That harness mounts with a manual clock at a fixed seed and steps a fixed number of frames, so each render is reproducible. For each subject it asserts three things:
- The render matches its stored screenshot in `e2e/__screenshots__`.
- The palette ink reaches a mean WCAG contrast of 7:1 over the canvas behind a 40rem text column, with at most 5% of sampled pixels below AA.
- Two independent browser contexts produce byte-identical PNGs for the same seed.

After an intentional visual change, refresh the baselines with `pnpm test:e2e:update`.

**The studio** at `/` is where you choose and tune. The top bar holds the seed, pause, speed, sound, and undo; below it are four tabs:
- **World**: the worlds and instruments as cards, calmer presets, the universe's mechanics as chips (borrow more from other worlds), make your own universe with an AI, and what is happening right now.
- **Look**: palette (or derive one from a brand color), intensity, density, detail, motion, the key light, legibility with a live contrast readout, composition guides (thirds, light ray, content boxes, quiet zones), and a scene's layer stack.
- **Journal**: sightings, the chronicle, and catching up after you have been away.
- **Share**: the prompt for your AI, the link, the `mount()` code, JSON, images, a video loop rendered on a fixed clock, and the wallpapers.

Press **?** for every shortcut, **A** for the About card, and **H** to hide the studio. The URL holds the whole state, so a link reproduces the exact background.

**Deploying.** `pnpm build` (or `pnpm build:site` for a relative base) writes the site to `dist`: the studio, the wallpaper page, and the gallery. The dev tool pages in `public/` (`lab.html`, `check.html`, `quick.html`, `skins.html`, `element.html`, `sprites-preview.html`) import straight from `/src`, so they run only under `pnpm dev` and are left out of the build.

The wallpaper page is `/wallpaper.html`. `vite build` also writes `wallpaper-runtime.js` next to the site: the engine and every world as one script, which the studio inlines into offline wallpaper files (in dev, the server builds it on first request).

**Blind compare.** `pnpm compare` stages every current baseline next to its render from an earlier release. `/compare.html` then shows each pair with the sides shuffled, plus a flip view, and reveals which version you preferred only at the end. An aesthetic change is accepted only when the maintainer prefers the new render without knowing which one it is.
