# Changelog

## Unreleased

- **Petri dish**, a new instrument: artificial life under a fluorescence microscope.
  - Particle life (`petri/dish.ts`): several strains pull on and push each other by a seeded matrix, with a hard core and a wide personal space, a slow current through the medium, and a little Brownian jostle. Cells form, crawl, chase, and swallow each other; past about seventy cells an organism divides along its long axis.
  - The instrument finds organisms every half second (union-find over a typed-array grid), matches them to the last look, and logs new organisms, divisions, engulfings, dissolutions, colonies, and symbioses of three strains. Specimens get brackets and a readout; organisms get membranes (their hull, eased and smoothed).
  - A technician: nutrient drops, shifts of the medium (a strain adapts), antibiotic disks with a zone of inhibition, and very rarely something enormous. Fluorescent or darkfield. A sound palette and journal sightings. Passes the e2e gates.
- **New entries**: `space-background-engine/skins/fantasy` (Shieldwall, Ages, the War Table) and `space-background-engine/skins/petri`, shells of about 2 KB each; the worlds are lazy chunks.
- **The War Table**, a new skin: one war's campaign on a parchment map.
  - The map, in ink (`table.ts`): parchment with fibres, stains, a crease, and burnt edges; a coast traced by marching squares with contour ripples; hatched hills, woods, dotted roads, castle towns named in an italic hand, a compass rose, a sea serpent and a ship; realms washed in watercolor around their towns.
  - The campaign (`table-sim.ts`, no DOM): towns joined by roads; two or three realms; each month, orders drawn in ink, then painted wooden tokens (stacked by strength, carved with a sword, a horseshoe, or a crown) slide along them. Battles and ambushes, sieges counted in ticks, towns that fall or burn or turn their coat, levies at the seats, sickness, winter quarters with frost, a king taken, a realm that yields, a dragon now and then. The peace is sealed in red wax, and the next campaign is unrolled.
  - The one light-themed world: dark ink on parchment. A sound palette (a quill, wooden pieces, a seal pressed) and journal sightings. Passes the e2e gates.
- **Ages**, a new skin: a thousand years of a continent, from above, at dusk.
  - The land (`ages-sim.ts`, no DOM): an island continent on a hex grid with elevation, moisture, fertility, and rivers run downhill to the sea; painted as smooth relief with pixel woods and peaks.
  - Kingdoms grow from hearths: settlements fed by the land around them (hamlet, village, town, city, capital), settlers walking out to found new towns with roads behind them, and territory as each town's reach.
  - Tension builds along borders into war, with truces after peace. Armies march the roads, meet in the field, and lay siege for years; towns change hands and kingdoms fall.
  - Six eras (the Hearth Years to the Lamp Age): walls, ships carrying trade, wonders raised in capitals. Plague along the roads, fires, hordes that settle when they take a town, civil wars, a dragon from the mountains, and sometimes one crown over all. When the last era ends, a new land.
  - Lights that grow with the people, call-outs, the peoples by the towns they hold, a chronicle; a sound palette and journal sightings. Passes the e2e gates.
- **Shieldwall**, a new skin: pitched battles in pixel sprites, side-on or from above.
  - Sprites drawn by code (`fantasy/sprites.ts`): spearmen, archers, riders on horses, wolves, elk, or bone horses, mages, lords, trebuchets, dragons, and crows. Each frame is painted at art resolution, snapped to whole pixels, outlined, and mirrored, in an atlas per people.
  - Four peoples, with their own looks, magic, and mix of troops: a kingdom (wards and sunfire), a horde (fire), a fey host (lightning), and a hollow legion (raising the fallen).
  - A battle's story (`battle-sim.ts`, no DOM): muster, a standoff (the lords may duel), volleys and trebuchets, the lines advancing in ragged blocks, charges on the flanks, rallies, morale, routs, a victory, and crows. A war is the best of five; then a new war between new peoples. A wild dragon may come down on both armies, burn the ranks, and be shot down (about a third of the time).
  - `view: 'side'`: a field under a weather sky (dusk, night, storm, snow, fog, dawn) with mountains, a keep, camps, smoke from burning places, sometimes a ford. `view: 'above'`: the same war as a map at dusk, with woods, a village, its fields and mill, a river and bridge, cloud shadows, and the camps' fires.
  - Call-outs and a chronicle in a serif; a sound palette (horns, drums, arrows, steel, thunder, a dragon's roar); journal sightings from a volley to a slain dragon. Both views pass the e2e gates.
- **Lazy skins.** `lazySkin(meta, load)` makes a skin whose world is a separate chunk, with `skin.prepare()` to load it ahead (`BackgroundSkin.prepare` is new, and Undercity has it too). The check and lab pages and the headless runner prepare lazy skins before the clock starts.
- **The studio, redesigned.** One long scroll of about 120 controls became a top bar and four tabs.
  - The top bar: the world's name and tagline, the seed (shuffle, copy link), pause, speed ×1/×4/×16, sound and volume, undo and redo.
  - **World**: the worlds and instruments as cards with thumbnails (and how many of each one's sightings you have seen), calmer presets in one menu, the universe's mechanics as chips with **Borrow from other worlds**, the make-your-own-universe flow, and **Happening now**.
  - **Look**, **Journal**, and **Share** hold the rest. Sentence case and the system UI face throughout; the world's name in the display face. On small screens the panel is a bottom sheet.
  - Hidden, the studio is a pill with the world's name. Keys: **S** seed, **Space** pause, **← →** worlds, **1 2 3** speed, **M** sound, **J** journal, **G** gallery, **H** hide, **?** all of them.
  - `?t=300` opens a world five minutes in. The debug panel (`?debug`) keeps skip-ahead, counts, and the log; speed moved to the top bar.
- **The journal.** The studio remembers what you have seen (localStorage).
  - Sightings: each world and instrument has its own list, from common to legendary, with rarity measured in simulated time. Each first sighting keeps its seed and moment, and **Revisit** replays that seed, skipped to just before. Unseen rare ones stay hidden. Uncommon and rarer firsts are announced.
  - The chronicle: uncommon and rarer events as lines of history, paired with the map's own log line, quick repeats folded. Copy it out as text.
  - While you were away: back after twenty seconds or more, the world simulates what it missed (up to five minutes, in chunks that keep the page responsive) and sums it up.
- **Wallpapers.**
  - `/wallpaper.html`: one background, full screen, 30 fps, paused when covered. It reads the `mount()` config from `?c=` (base64url JSON) with `fps`, `pr`, `skip`, and `i`, and remembers the last one, so a home-screen shortcut opens the same world. A web manifest makes it full screen on phones. Works with Lively Wallpaper, Plash, and KDE's web wallpapers.
  - Offline: one HTML file with the whole engine inlined (about 450 KB). `vite build` writes `wallpaper-runtime.js` for it; the dev server builds it on first request. A Wallpaper Engine package wraps the same file with `project.json` and a preview (a small zip writer, no dependencies).
  - Stills at the screen's full resolution, and phone stills at 1170 × 2532 rendered at 3x so small text stays sharp. A 10 second portrait video for video wallpaper apps.
- **Events at speed.** Steps run by a time scale above 1 now report events (only `fastForward` stays silent). At ×16 the journal sees everything and the sound gets busier, within each cue's rate limit.
- **`pixelRatio`**, a new config option: fixed backing pixels per CSS pixel, past the device cap. Exports and wallpapers use it.
- **Video export, fixed.** Frames went to the recorder far faster than real time, so recordings came out sped up or empty. They are now paced to the video's own clock. MP4 is recorded where the browser can, WebM otherwise.
- **Thumbnails.** `pnpm thumbs` writes small JPEGs of the screenshot baselines to `public/thumbs` (about 10 KB each, committed). The gallery and the world cards use them, so the deployed studio has images without running the e2e suite.
- **Sound, v2.**
  - A mastering chain: rumble cut, soft saturation, glue compression, and a limiter.
  - A generated stereo room with pre-delay, early reflections, and a tail that loses its highs first.
  - A ping-pong echo, in place of repeated tones.
  - Distance shaping: far events are darker and deeper in the room.
  - Pink and brown noise. Booms get a crack and a sub drop, bells a detuned twin, and choirs real vowel formants with vibrato.
  - Drones spread across the stereo field and breathe. Noise beds (rain, wind, hull hum, the deep) open with `ambience` events: the sector's tension, Undercity's rain.
  - Big hits duck the bed, and notes land on a quiet pulse.
  - The five instruments report their moments (torpedoes, active pings, quakes, emergencies, meteors, giants in the dark) and have palettes of their own.
  - `pnpm sound-check` renders every palette offline and reports levels. All beds and cues are calibrated with it.
- **README, whole again.** The technical reference is back in the README, below a new intro, a hero montage, and "Things happen" strips of events frame by frame. `docs/REFERENCE.md` now points there. `pnpm media` regenerates every README image from fixed seeds (the lab page gained a view mode that it screenshots).
- **Undercity**, a new skin: a 2.5D cyberpunk city at night in the rain.
  - Three streamed parallax layers of procedurally generated buildings. Each is rasterized once into a cached canvas: windows that keep office hours, a near megastructure cut open into terraces, markets, stairs, and shopfronts, and roofs with masts, dishes, tanks, and corp crowns.
  - Live on top: neon sign sprites that flicker, rotating holo ads, aircraft lights, haze between the layers, searchlights, cables, and a wet street that reflects the neon.
  - Life: flying cars in three lanes of light (cabs, haulers, police), maglev trains, crowds with neon umbrellas, steam vents, rain with splashes, and lightning with delayed thunder.
  - The net (`sim/signals.ts`): runners jack in, trace to a corp fortress, fight its ICE, and breach it (glitch, hijacked ads, a district outage that cascades and recovers) or flatline (police with searchlights). A terminal HUD keeps the log.
  - A tiny shell is registered with the built-ins, and the city loads on first mount. New entry `space-background-engine/skins/undercity`, plus `prepareUndercity()`. A sound palette is included.
  - Budgets: `index.js` 119 KB and the adapters 110 KB (+1 each), for skin events and the Undercity shell.
- **Three new universes**, each loaded on demand (about 7 KB gzip apiece):
  - **Hive Bloom.** `bloom`: creep is a cellular automaton on a fine hex grid. It spreads from hive nodes along veins of rich ground toward colonies, drawn as a fused organic mass with veins, pustules, and tendrils. Covered structures turn to biomass glyph by glyph, and colonies evacuate. `spores`: flocks burst from nodes, swirl on the flow (boids), seed new creep, and clog intakes. `purge`: flame-cone fleets burn creep to ash, dense creep fights back, and a scourge burns out a node.
  - **The Last Fleet.** `ark`: a generation ark of twelve linked hulls on a flexible spine that keeps pace with the map, with lit windows, farm domes, a reactor, and engine plumes. The fleet counts souls, births, losses, fuel, and days. `flotilla`: hundreds of civilian ships as cheap particles; stragglers fall behind, and tugs go back for them. `pursuit`: contacts at the trailing edge, with escorts breaking to engage. `skimming`: gas giants drift past, and skimmers dive for fuel.
  - **Cradle of Suns.** `nebula`: hundreds of gas particles on curl noise, pulled into collapsing clouds and pushed by stellar wind. `stars`: ignition with jets and wind bubbles, disks clumping into planets, supernovae returning gas. `life`: life, cities on the night side, first ships, colonies, first contact, and sometimes silence. `epochs`: the age in Gyr and the era's name.
  - A sound palette for each.
- **Universe looks.** `look.scenery` (0 leaves space empty for mechanics to fill) and `look.drift` (how fast the map travels). A universe with no traffic no longer seeds starting fleets.
- **Sound.** New opt-in entry `space-background-engine/audio` (4.9 KB gzip): generated sound bound to what happens.
  - `createSoundscape({ palette, volume })`, then `attach(handle)` and `start()` (from a click or key press).
  - Synthesized cues only, no assets: boom, ping, bell, sweep, whoosh, thump, choir, and crackle, with a drone, generated reverb, and stereo position from where things happen on screen.
  - A palette per universe: the sector map's cold radio blips, Saltwind's industrial hum and dust, the Choir's low dissonant voices, and the Siege's distant guns, horns, and truce bell. Add your own with `registerSoundPalette`.
  - The studio has a **Sound** toggle and a volume slider.
- **Events on the handle.** `handle.onEvent(fn)` streams `SkinEvent`s (type, weight, screen pan, nearness). Skins report through `host.events`; the sector map forwards its whole bus. Events are silent while fast-forwarding.
- **The Long Siege, at war.** The front now runs along the map: one side holds the top, the other the bottom, and the camera travels the line between them.
  - `front`: territory held hex by hex (`sim/cells.ts`), anchored to the world. Ground that changed hands glows warmer, and the old owner's color lingers.
  - Each side earns reserve from its ground and supply, and spends it on probes, on reinforcing failing cells, and, once it has saved enough, on an offensive with a stated reason. A starving enemy is an invitation.
  - Supply convoys run from depots to the line, and the enemy sends interdictors after them. A cut supply line starves the line until it gives way. A starving side sends a relief convoy with escorts.
  - Edges held long enough become walls, drawn in ASCII in the builder's color. Fire bases shoot enemy ships in range.
  - Fortress worlds sit under hex-lattice shields that ripple from each impact, strain, and fail.
  - `artillery`: a spotter paints the target with a dotted designator line and a closing reticle, then the volley arcs in. Kill the spotter and the volley never comes.
  - `duels`: two siege monitors trade beam broadsides across the line. Their shields ripple and fail, armor plates break away, and sometimes one breaks up.
  - `truces`: the guns stop. White-marked medical ships cross no-man's-land, and the memorial beacon counts the names.
  - `mines`: fields along the line and around old hazards. Minelayers sow new ones, and one blast can set off the next in a chain.
  - `warfront` remains available for packs that use it.
- **The Choir of Hollow Stars, as cosmic horror.**
  - Resonance cascades: a song that reaches another hollow star makes it answer, and the chorus chains across the map.
  - Leviathans: vast segmented creatures with photophores, feelers, and pilot wisps. They migrate through, and ships scatter.
  - Echoes ("the same hour, twice"): a circle of the map replays its last seconds as split-color ghost film.
  - The Mouth lives: it reaches for ships with tendrils, grows as it feeds, and exhales wisps or a newborn star.
  - Cradles beat like hearts and hatch ships that grow to full size as they fly.
  - Restless words: huge faint lines whose letters drift into anagrams and back. Whispers surface near the pointer.
  - Dread: an eye opens in the dark and watches the pointer, stars go out one by one, the light is eaten, and the signal tears.
- **Creature layer and memory.** `sim/bodies.ts` (spines that follow a steering head) and `sim/history.ts` (a ring of past positions for replays).
- **A living economy.** New `economy` mechanic on a shared ledger (`sim/economy.ts`).
  - Mines, docks, and habitats make goods; docks, shipyards, defenses, and relays use them.
  - When a place runs short, a convoy flies the goods there in glowing pods. Shipyards build only from stock they hold.
  - Structures show small manifests; ore stacks up at depots; a price ticker runs in the corner.
  - Packs define their own goods and roles (`economy`), and AI-written packs may too.
- **Police, gates, relays.**
  - `police`: defense platforms scramble interceptors at raids.
  - `gates`: gates pair up with a visible throat; ships queue in holding loops, are scanned for the toll, and are sometimes turned away.
  - `relays`: messages travel the network as light (`sim/signals.ts`), and distress calls ripple outward.
- **Saltwind Reach, rebuilt.**
  - Belts orbit across the map, and stray rocks collide and shatter.
  - Two miners on one rock start a claim dispute: a standoff, warning shots, then one backs off or they fight.
  - Miners haul ore home in their pods.
  - `wardens`: toll buoys stop and scan ships, and smugglers bolt with cutters in pursuit.
  - Dust fronts push wind through a shared field (`sim/fields.ts`): beams cut out, miners run for the docks, and loose rock drifts.
  - Bore blowouts and shift changes.
- **Ground.** `look.ground` adds drifting terrain under the map: dust for Saltwind, mist for the Choir, smoky nebula for the Siege.
- **Smaller.** Universes and mechanics load on demand. The sector map's static bundle is 55.6 KB gzip, down from 57.2 KB, despite everything above.
  - New APIs: `loadUniverse`, `registerUniverseLoader`, `registerMechanicLoader`, `loadMechanics`, `prepareVoidTactical`.
  - Fixed: the library build had been tree-shaking away every mechanic's registration. Plugin modules are now in `sideEffects`, and `pnpm size` checks the build contains them.
- **A camera with a director.** The sector map now has a real camera (`engine/sim/view.ts`): world points project through pan, zoom, and depth.
  - The director (`sim/director.ts`) watches a new event bus (`sim/bus.ts`), and now and then leans in on raids, armadas, captures, and flares. It tracks moving subjects and lets go.
  - New `camera` option: `steady`, `director` (default), or `cinematic`. Also new: `lean` (toward the pointer) and `scroll` (page scroll carries the map forward).
  - New host config `interactive`: wheel zoom and drag pan on empty page areas.
- **Depth.** Systems and structures sit on far planes as well as the main one (`look.depth`). Fleets sink into the distance as they fly to far stations.
- **Mechanic API.** New on the API: `camera`, `bus`/`emit`/`follow`, and `use(key, create)` for shared services, with `onUpdate` and `onDraw` hooks.
  - Two new passes: `ground` and `hud`.
  - Mechanic passes now run inside the camera transform, so mechanics draw in map space.
- **Fast checks.**
  - `pnpm sim` runs a universe sim-only in node and prints its story and any problems.
  - `pnpm lab` renders a contact sheet of chosen moments, or seeks to an event.
  - Studio `?debug` adds time scale, skip-ahead, counts, and the event log.
  - Host API: `fastForward`, `setTimeScale`, `inspect`, and `SkinInstance.advance` (sim-only stepping).
  - Long universe tests now run headless in node, so the unit suite takes half as long.
- **Docs.** `docs/ARCHITECTURE.md` explains the layers, the frame, space and depth, events, and how to extend.
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
