# Authoring conventions

These keep a skin or layer portable, deterministic, palette-aware, and cheap. The test gates (`pnpm skin:check <id>`) enforce the ones marked with a check.

## Determinism
- ✓ Randomness only from `host.rng` (world generation) or `host.fork('label')` (independent streams). Never `Math.random`.
- ✓ Time only from `FrameInfo` (`t` seconds since mount, `dt` seconds since last frame, `frame` index). Never `Date.now`, `performance.now`, `setTimeout`, `setInterval`, or `requestAnimationFrame` inside a skin or layer. Schedule with sim time: store `until = t + delay` and compare.
- Generate in normalized coordinates (0..1) when you can, so a resize rescales instead of regenerating.

## Motion
- Express speeds per second and multiply by `dt`, or write them "per frame at 60 fps" and multiply by `dt * 60`. Never assume a frame is 16 ms.
- Scale speed and spawn rates by `host.intensity`. Under `host.motion === 'reduced'` the host already halves intensity; under `'off'` the host renders one frame and stops, so your first frame must look complete.
- Nothing should complete a visible cycle in under about eight seconds. Slow is premium.

## Color
- ✓ Read colors from `host.palette` (`bg`, `ink`, `inkDim`, `accent`, `hazard`, plus `*Rgb` triplets) or from a schema `color` field resolved with `resolveColor()`. Never hardcode hex in draw code.
- Derive variety in OKLCH (`hexToOklch`, `oklchToHex`, `mixOklch`) so it holds up under any brand palette, including light themes (`palette.theme`).
- Keep the brightest thing you draw below the ink. Text on the page must win.

## Options
- Declare every option in a `schema` (`number` with `min`/`max`, `boolean`, `enum`, `color`, `string`) and resolve with `resolveOptions(schema, host.options)`. Bad input falls back to defaults; never throw on options.
- Give each field a `label`, and a `description` when the effect is not obvious. The studio and agents read them.

## Performance
- No allocations in the hot loop: preallocate arrays, reuse objects, cache sprites (`glowSprite`, offscreen canvases) instead of `shadowBlur` per frame.
- Cull what is offscreen. Batch strokes into one path where the color is shared.
- Honor `host.quality` (0..1): draw fewer particles or skip the costliest pass when it drops. Never change composition drastically, just density.
- Prefer a private surface (`surface: 'own'` on a layer) only when you need to fade or mask your own previous frame; it costs a full-canvas composite per frame.

## Lifecycle
- ✓ `destroy()` removes every DOM node and listener you added. The host owns the canvas, the loop, and the observers.
- `resize(viewport)` is guaranteed once before the first frame; `host.viewport` is live afterward.

## Layer or skin?
- A **layer** draws one effect on the shared scene canvas and knows nothing about other layers. Prefer it. Give it tags (`calm`, `motion`, `base`, `finish`, `light-ok`, niche names) so the catalog and agents can find it.
- A **skin** owns a whole world with internal relationships (void-tactical's fleets steering toward structures). If you need that, build the world in one module and expose it both as a skin and as layers over a shared world, as void-tactical does.

## Ship it
- `pnpm skin:check <id>` must pass. Look at the PNG it writes and compare against the brief, not just the numbers.
- Add a one-paragraph `description`, sensible `defaults` (palette, intensity), and keep the scaffold's comment block trimmed to what is true.
