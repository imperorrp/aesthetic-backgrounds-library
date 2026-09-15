# Direction

A **procedural background engine**: seeded generation, a director for how much of the scene speaks, stacked layers, and **skins** you can swap.

The first skin (`void-tactical`) happens to be sci-fi — a live 2D sector extracted from a landing page. That look is not the product. The product is: mount a background on any page, edit it, extend it, or write another skin in the same artistic language (layered atmosphere, sparse annotation, slow camera) or a different one.

Local notes that must never ship: `docs/PRIVATE.md` (gitignored).

---

## Shape

```
Host (vanilla createBackground, or a React adapter)
  → Skin (world + tick + draw + optional CSS overlays)
    → Director (density, detail, seed)
    → Layers (on/off)
```

**Core (generic)**

- `createBackground(el, { seed, density, detail, skin })` — no React
- `BackgroundSkin` — `{ id, mount }` returns `{ resize, frame, destroy }`
- Seeded RNG, palettes as CSS tokens, a detail budget (`none|low|medium|high`)

**Skin (specific)**

- `void-tactical` — streaming camera, starfield, systems, structures, fleets, CSS overlay stack
- Future skins: quiet photographic, terminal, print, something that isn’t space at all

**Host**

- React `BackgroundCanvas` is a thin wrapper around `createBackground`
- A site should be able to call the vanilla API from a script tag later

---

## Public knobs (core)

| Knob | Role |
| --- | --- |
| `seed` | Reproducible field (`?seed=` in the demo) |
| `density` | How populated the world is |
| `detail` | How much annotation is allowed to speak |
| `palette` | Token set (`--accent`, `--hazard`) |
| `cameraSpeed` / `targetFps` | Motion and budget |
| layers | Overlay flags the skin exposes |
| `skin` | Which background is running |

Skin-specific tables (structure kinds, fleet classes, telemetry copy) stay *inside* the skin.

---

## How to extend

1. **Toggle layers** on an existing skin (demo HUD).
2. **Restyle** via palette tokens — canvas and CSS overlays share `--accent`.
3. **Fork a skin** — copy `skins/void-tactical`, change generators/draw, register it.
4. **New skin from scratch** — implement `BackgroundSkin`. The host loop does not care if you draw a sector, a city, or fog.
5. **Headless** — call generators with an `Rng`; no canvas required (snapshot tests already do this for stars).

The intended OSS story: people drop this on a site, then later replace the skin or add one without rewriting the mount.

---

## Sequence

1. Extraction + seed + detail budget + shared palette — done.
2. **Generic host + skin interface** — in progress (`createBackground`, `voidTacticalSkin`).
3. Move void-tactical files fully under `skins/` so core stays theme-agnostic.
4. Document writing a second, smaller skin (even a quiet gradient + dust) to prove the interface.
5. Vanilla package entry (no React in the core publish).
6. Then skin-quality work (parallax, docking timers, new looks) — not more one-off HUD chrome on the default skin.

---

## File map

```
src/engine/core/          host loop, skin types
src/engine/skins/void-tactical/   first skin
src/engine/BackgroundCanvas.tsx   React adapter
src/engine/{rng,config,palette}.ts
src/engine/generators.ts  (void-tactical world, to be moved)
src/engine/renderers/     (void-tactical draw, to be moved)
src/demo/                 host UI
docs/DIRECTION.md
```
