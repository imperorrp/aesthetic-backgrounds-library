# Making a world

A world in Vivarium is a small simulation that runs behind a page: a seeded sim that decides everything, and a painter that only draws it. This page is the kit for making one, by hand or with an AI coding agent: a brief to fill in, a template to copy, the bar a world must clear, and the checks that measure it.

The short loop:

```bash
pnpm create-world tidepool --label "Tide pool"   # copy the template world (the Pond) and register it
pnpm world:check tidepool                        # the bar in numbers
pnpm lab tidepool t=10,60,300,900                # look at it, at four moments
pnpm lab tidepool t=10,60,300,900 w=390 h=844    # and on a phone
```

## The bar

The wallpaper test. A world passes when someone would leave it running behind their desktop for a day.

1. **Busy at 1x.** Something moves everywhere, all the time, and something *happens* every few seconds. No speed-up needed to see it live.
2. **A literal, readable fantasy.** A valley with a wyrm, a mountain of dwarves, a pond with frogs. You can tell what everything is at a glance: the things are drawn as themselves and named in plain lines ("THE HERON TAKES PIP"). No abstract particles standing in for a story.
3. **It never stagnates.** Growth, loss, and regrowth. Nothing runs out for good; the world after an hour is different from the world after a minute, and still going.
4. **Seeds differ in what happens, not only where.** Each seed draws its own cast of systems (`compose`): one pond has a heron and rain, the next a lotus and frogspawn. Architecture varies too: shapes, layouts, colours.
5. **The whole scene, on any screen.** The world is made in the screen's shape, a little larger (`WORLD_SCALE`), and the camera shows all of it (`createFraming`), drifting in only for the biggest moments. A phone gets a smaller, complete world, not one cut off at the sides.
6. **Crisp text that fits.** HUD and call-outs through `fillCrisp`, shortened with `fitText`; side columns step aside on a narrow screen.
7. **No bloom.** Glow is a cached sprite or a soft fill, never a post-process haze over everything.
8. **It answers a touch.** A click on the world (`nudge`) does something there, in the world's own words.
9. **The same seed is the same world.** Randomness only from the seeded rng and genome, time only from `step`. A replay matches line for line.

`pnpm world:check` measures 1, 3, 4, 5 (that it runs on a phone) and 9. The rest you check by looking.

## The brief

Write this before any code. It is short on purpose: an agent (or you, in a month) should be able to build the world from it alone. Paste it at the top of `sim.ts` as the file comment when you are done.

```md
# <Name>: <one sentence: the fantasy, literally>

On screen, at a glance: <the five or six things you always see, named>
The camera: <where we stand; what the whole scene is>

Always happening (the floor):
- <the everyday motion: who walks where, what grows, what flows>

The cast (each seed draws some; tag them):
- <system> [threat] <what it does, how often, what it leaves behind>
- <system> [weather] ...
- <system> [wonder] ...
- <system> [life] ...
Quotas: <total, and per tag, e.g. 0–1 threat>

Events, common to legendary (each one a line said on the map):
- common: <...> (every minute or two)
- uncommon: <...> (a few times an hour)
- rare: <...> (once in a long afternoon)
- legendary: <...> (most seeds never)

What keeps it going: <how losses are replaced; the cycle that never ends>
What changes with the seed: <shape, colours, cast, names, temperament>
A touch: <what a click does, near what>
Phone: <what a smaller world keeps, and what it drops>
```

## The template

`src/engine/skins/worlds/template/` is the Pond: a complete small world that clears the bar, built only from the kit. `pnpm create-world` copies it; replace the pond with your world one piece at a time and keep the checks green.

- **`sim.ts`**: the world. `createPond(seed, W, H, opts)` builds it from a genome (`createGenome`), draws a cast from a library of systems (`compose`), paces the big moments with a director (`createDirector`, `want`, `look`), and returns an object with `step(dt)`, `nudge(x, y)` and `counts()`. Every event goes through `emit` (sound, the journal, the director); every line through `say`.
- **`paint.ts`**: the painter. `runWorld(host, world, {...})` does the plumbing (fixed step, headless, fast-forward, events to sound with pan, `inspect` for the lab and tests); the painter reads the world and draws it, back to front, then call-outs and the HUD.
- **`index.ts`**: the skin: its id, label, schema (options the studio shows), and defaults.
- **`template.sim.test.ts`**: the bar as tests: it runs and keeps happening, seeds differ, a phone works, a touch is answered, a seed replays.

## House rules

- **Randomness**: only `forkRng(seed, label)` and the genome. A subsystem gets its own fork (`g.fork('cast')`), so adding one does not change every other draw.
- **Time**: only the `dt` passed to `step`. No `Date.now`, `performance.now`, or timers in a sim.
- **Space**: world pixels, `GW × GH`. The painter maps them to the screen (`SX`, `SY`); `unproject` maps back for nudges.
- **Colour**: from the host palette (`host.palette`, `g.hues(accent, n)`), so a world sits with the page it is on.
- **Pacing**: big things ask the director (`world.director.want('heron', salience, cooldown)`) instead of firing on timers; it keeps peaks apart and quiet stretches short.
- **Size**: scale distances by the world's size (`u` in the template), so a phone gets a smaller world, not a crowded one.
- **Counts**: `counts()` returns the numbers the headless runner samples (and the tests read).

## Into the studio

When it passes, hook it up:

1. **Sightings**: add the world's events to `SIGHTS` in `src/demo/witness.ts`, with rarity from a long run (`pnpm sim <id> 1200`: common is dozens, rare a handful).
2. **A card**: add it to `WORLD_CARDS` in `src/demo/DemoPage.tsx`, then `pnpm thumbs` for its thumbnail.
3. **Sound**: a palette in `src/engine/audio/palettes.ts` (copy a world's), and its id in `SOUND_SKINS`.
4. **Gates**: add the id to `e2e/subjects.json` for screenshot and replay checks (`pnpm skin:check <id> --update` writes the baseline).

## With an AI agent

Give the agent this page, the filled-in brief, and these instructions:

> Build the world in the brief in `src/engine/skins/worlds/<id>/`, starting from the copy of the template there. Keep the house rules. After each step, run `pnpm world:check <id>` and `node node_modules/vitest/vitest.mjs run src/engine/skins/worlds/<id>`, and render `pnpm lab <id> t=10,60,300,900` and look at the picture. Do not stop at "it runs": stop when it passes the bar, at desktop and phone sizes.

The checks catch what numbers can catch. The picture catches the rest: is it readable, is it busy, does it look like the thing it is? Look at every render.
