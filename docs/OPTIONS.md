# Each world's options

Pass these as `options` to `mount()` (or as the `options` attribute on the element). The options every skin shares (seed, palette, intensity, and the rest) are in [REFERENCE.md › Configuration](REFERENCE.md#configuration).

- [The sector map's options](#the-sector-maps-options)
- [Undercity's options](#undercitys-options)
- [Shieldwall's options](#shieldwalls-options)
- [Ages' options](#ages-options)
- [The Petri dish's options](#the-petri-dishs-options)
- [The War Table's options](#the-war-tables-options)
- [Wyrmspire's options](#wyrmspires-options)
- [Deephold's options](#deepholds-options)
- [Leylines' options](#leylines-options)
- [Silent Running's options](#silent-runnings-options)
- [Foundry's options](#foundrys-options)
- [The later worlds' options](#the-later-worlds-options)

## The sector map's options

`skin: 'void-tactical'`. Every authored color is pulled into the active palette family, so it works with `palette: '#ff7a1a'` as well as with the built-ins.

| Option | Default | Effect |
| --- | --- | --- |
| `universe` | `'void'` | `void`, `saltwind`, `choir`, `siege`, `hive`, `lastfleet`, `cradle`, or your own (`registerUniverse`). Universes beyond the first load on demand. |
| `pack` | none | An inline universe pack, for example one an AI wrote with `universePrompt()`. Wins over `universe`. |
| `mechanics` | the universe's | `[{ use, with, enabled }]` replaces the universe's mechanics list. |
| `camera` | `'director'` | `steady` (fixed framing), `director` (now and then it leans in on something happening), or `cinematic` (it chases the action). |
| `lean` | `true` | The camera drifts a few percent toward the pointer. |
| `scroll` | `false` | Scrolling down the page carries the map forward through the sector. |
| `hueVariety` | `0.94` | `0` pulls every entity into the palette family, and `1` keeps the original rainbow. |
| `lineWeight` | `1.4` | Multiplier on all strokes. |
| `spriteScale` | `0.8` | Size of the ASCII structure art. |
| `shipScale` | `1` | Size of the ships. |
| `hud` | `0.6` | Opacity of labels, telemetry, and chatter. |
| `paths` | `'dashed'` | Planned courses: `dashed`, `dots`, or `off`. |
| `trails` | `0.9` | Fleet trail opacity. |
| `lock` | `true` | Target lock: brackets close on a contact every half minute. |
| `gradient`, `mesh`, `asciiGrid`, `ascii1`, `ascii2`, `clouds`, `noise`, `mouseGlow`, `starfield` | all on except `starfield` | Toggles for each CSS atmosphere layer. |

The skin's own config defaults are `intensity: 0.45`, `density: 1.5`, `detail: 'high'`, and `palette: 'void-cyan'`: a dense, fully annotated sector, held back to 45% presence so page content leads. Pass any of them to `mount()` to override.

A universe pack is JSON. Its fields are:
- names, factions, ships, structures and their ASCII art, anomalies, and chatter
- its mechanics
- a `look`:
  - `lanes`, `grid`, `traffic`, and `anomalies`
  - `depth`, the share of scenery on far planes
  - `scenery` (`0` leaves space empty for the mechanics to fill)
  - `drift`, how fast the map travels
  - `ground`, the terrain under the map
- an `economy`

`universePrompt(subject)` writes the prompt that asks an AI for one, and `validateUniverse()` fixes up what comes back.

The same simulation is also available as **layers** that share one world per mount: `void-atmosphere` (the CSS plate), `void-stars`, `void-systems`, `void-fleets`, and `void-hud`. The `void-sector` preset is the skin rebuilt from them. So in a scene you can drop the HUD, dim the fleets to half opacity, or slide `grain` and a `content-shade` between the systems and your text, and the fleets still steer toward the structures the systems layer draws:

```ts
mount(document.body, {
  skin: 'scene',
  intensity: 0.45,
  density: 1.5,
  detail: 'high',
  options: {
    layers: [
      { use: 'void-atmosphere' },
      { use: 'void-stars' },
      { use: 'void-systems', with: { spriteScale: 1.2 } },
      { use: 'void-fleets', with: { paths: 'off' }, opacity: 0.6 },
      { use: 'content-shade', with: { strength: 0.5 } },
    ],
  },
});
```

## Undercity's options

`skin: 'undercity'`. The city is a lazy chunk (about 14 KB gzipped) that loads the first time it mounts. Call `prepareUndercity()` to load it ahead of time.

| Option | Default | Effect |
| --- | --- | --- |
| `speed` | `1` | How fast the city drifts past (`0` holds still). |
| `rain` | `0.8` | Rain, from none to a downpour (`0` to `1.5`). Heavy rain brings lightning. |
| `traffic` | `1` | Air traffic in the lanes between the layers. |
| `crowd` | `1` | Pedestrians on the street. |
| `net` | `1.2` | Netruns per minute. |
| `overlay` | `true` | Show the net's wireframe and packets. |
| `hud` | `true` | The terminal readout: district, rain, net load, and the run log. |

## Shieldwall's options

`skin: 'shieldwall'`. The battles are a lazy chunk (about 28 KB gzipped) that loads the first time one mounts; `getSkin('shieldwall').prepare()` loads it ahead.

| Option | Default | Effect |
| --- | --- | --- |
| `view` | `'side'` | `side`: the field under a sky. `above`: the field as a map at dusk. |
| `battles` | `'any'` | `any` (about three in ten are sieges), only `field` battles, or only `siege`s. |
| `troops` | `1` | Army size (`0.3` to `2`), about 150 a side at `1`. Scaled by `density` too. |
| `magic` | `1` | How often mages cast (`0` for none). |
| `dragons` | `1` | How likely a dragon is in a battle: about one in four at `1`. |
| `weather` | `'any'` | `any` (the seed picks per battle), `clear`, `rain`, `snow`, `fog`, or `night`. |
| `camera` | `'follow'` | `follow` the fighting, or hold `still` over the middle of the field. |
| `labels` | `true` | Call-outs on the field: charges, volleys, a lord falling. |
| `hud` | `true` | The field's name, the war's score, and its chronicle. |

## Ages' options

`skin: 'ages'`. A lazy chunk, like Shieldwall's.

| Option | Default | Effect |
| --- | --- | --- |
| `speed` | `1` | The pace of history: 2.5 years a second at `1`. |
| `kingdoms` | `5` | Peoples at the start (2 to 8). |
| `wars` | `1` | How quickly borders turn to war (`0` for none). |
| `disasters` | `1` | How often plague, fire, hordes, and civil wars come. |
| `dragons` | `1` | How likely a dragon is when trouble comes. |
| `labels` | `true` | Call-outs on the map. |
| `hud` | `true` | The year and era, the peoples by the towns they hold, and the chronicle. |

## The Petri dish's options

`skin: 'petri'`. A lazy chunk (about 18 KB gzipped, both media).

| Option | Default | Effect |
| --- | --- | --- |
| `medium` | `'particles'` | `particles` (strains of particle life) or `lenia` (a Lenia culture of Orbium). |
| `stain` | `'fluorescent'` | `fluorescent` (a dye per strain), `darkfield` (silver on black), or `phase` (phase contrast: dark bodies, bright halos). |
| `species` | `6` | How many strains (3 to 7). |
| `life` | `1` | How many particles, relative to the dish's size. |
| `predators` | `true` | One strain hunts the others (its numbers boom and crash). |
| `drops` | `1` | The technician: how often nutrient drops, antibiotic disks, inoculations, and contaminations come (`0` for never). |
| `tracking` | `true` | Brackets and a readout (with a Latin name) on a few specimens. |
| `notebook` | `true` | The lab notebook and the population chart. |
| `hud` | `true` | The instrument readout (with the focus), the strains' dyes, the scale bar, and the log. |

## The War Table's options

`skin: 'war-table'`. A lazy chunk, like the other fantasy worlds. Its default palette is light (dark ink), for pages with dark text.

| Option | Default | Effect |
| --- | --- | --- |
| `realms` | `2` | Realms at war: `2` or `3`. |
| `pace` | `1` | The pace of the campaign: a month every 3.2 seconds at `1`. |
| `dragons` | `1` | How likely a dragon is in a month. |
| `candle` | `true` | Candlelight from one side. |
| `notes` | `true` | Notes in the margin: battles, sieges, falls, the peace. |
| `fog` | `true` | The fog of war: the map as one realm's council knows it, the rest in pencil. `false` shows everything in ink. |

## Wyrmspire's options

`skin: 'wyrmspire'`. A lazy chunk, like the other fantasy worlds (both styles ship in it).

| Option | Default | Effect |
| --- | --- | --- |
| `style` | `'vale'` | `vale` (the living valley) or `classic` (the first version). |
| `camera` | `'drift'` | `drift`: the whole world on screen, easing in slowly for the biggest moments only. `still`: the whole world, never moving. `follow`: the same world, closer, the camera going where the action is (in the studio, the magnifier button or **V** switches between this and the whole scene, live). `director`: the old wider world, followed shot by shot. |
| `valley` | `'any'` | The land: `alpine`, `fjord`, `canyon`, `fen`, `ashland`, or `any` (one per seed). Its houses, water, weather, and breed of wyrm. |
| `wrath` | `1` | How restless the wyrm grows (`0` for never: a quiet valley, though thieves may still wake it). |
| `knights` | `1` | How many ride out (`0` for none: the villages are on their own). |
| `villages` | `3` | Villages besides the town (about; the seed varies it): `2` to `4`. |
| `time` | `'cycle'` | `cycle` (dawn, day, dusk, night), or always `dusk` or `night`. |
| `labels` | `true` | Call-outs: raids, hunts, new buildings, tournaments, quests, policies, festivals. |
| `hud` | `true` | The valley, the wyrm's state and hoard, the lord's policy, the settlements and their roofs, the chronicle. |

## Deephold's options

`skin: 'deephold'`. A lazy chunk (about 88 KB gzipped, both styles), like the other fantasy worlds.

| Option | Default | Effect |
| --- | --- | --- |
| `style` | `'kingdom'` | `kingdom` (a range of rival holds) or `classic` (the single hold). |
| `camera` | `'drift'` | `drift`: the whole world on screen, easing in slowly for the biggest moments only. `still`: the whole world, never moving. `follow`: the same world, closer, the camera going where the action is (in the studio, the magnifier button or **V** switches between this and the whole scene, live). `director`: the old wider world, followed shot by shot. |
| `holds` | `'any'` | How many holds in the range: `2`, `3`, `4`, or `any` (drawn per seed). |
| `mountain` | `'any'` | `iron`, `crystal`, `frost`, `ember`, `drowned`, or `any` (one per seed): its rock, ores, hazards, and what sleeps below. |
| `depth` | `1` | Classic only: how greedily they dig (`0.3` to `2`). |
| `hazards` | `1` | How hard the mountain is: hazards and hostile neighbors in the cast (`0` for none). |
| `below` | `'any'` | What lies below: `sleeper`, `lich`, `engine`, `hive`, `nothing`, or `any` (drawn per seed). |
| `scale` | `1` | How big the range and the clans (`0.5` to `2`). |
| `labels` | `true` | Call-outs: strikes, rooms, highways, wars, the dragon, floods, cave-ins, the deep. |
| `hud` | `true` | The holds, their kings and wars, what the mountains hold, the artifacts, the chronicle. |

## Leylines' options

`skin: 'leylines'`. A lazy chunk, like the other fantasy worlds.

| Option | Default | Effect |
| --- | --- | --- |
| `style` | `'realm'` | `realm` (towers, mages and spells on a drawn land), `ink` (growing lines), or `classic` (the first version). |
| `camera` | `'drift'` | `drift`: the whole world on screen, easing in slowly for the biggest moments only. `still`: the whole world, never moving. `follow`: the same world, closer, the camera going where the action is (in the studio, the magnifier button or **V** switches between this and the whole scene, live). `director`: the old wider world, followed shot by shot. |
| `land` | `'any'` | `isles`, `steppe`, `forest`, `desert`, `tundra`, `marsh`, `mountains`, or `any` (a blend drawn per seed). |
| `scale` | `1` | How big the land and how much is going on (`0.5` to `2`). |
| `orders` | `4` | Orders of mages at the start (about; the seed varies it): `2` to `6`. |
| `storms` | `1` | Weather in the cast (`0` for none). |
| `rifts` | `1` | Calamities in the cast (`0` for none). |
| `labels` | `true` | Title cards for the big moments. |
| `hud` | `true` | The land, the orders (school, archmage, towers, mages, wars), the cast, artifacts, a short chronicle. |

## Silent Running's options

`skin: 'silent-running'`. A lazy chunk, built on the world kit.

| Option | Default | Effect |
| --- | --- | --- |
| `camera` | `'drift'` | `drift`: the whole chart, easing in slowly for the biggest moments only. `still`: never moving. `follow`: closer, going from ship to ship and to each moment (**V** in the studio). `director`: every shot the director asks for, at that shot's own zoom. |
| `traffic` | `1` | How busy the lanes are (`0.4` to `2`): how often convoys sail, and how big they are. |
| `labels` | `true` | Call-outs for contacts, torpedoes, sinkings, and the rest. |
| `hud` | `true` | The sea, ships at sea, contacts, wrecks, and a short chronicle. |

## Foundry's options

`skin: 'foundry'`. A lazy chunk, built on the world kit.

| Option | Default | Effect |
| --- | --- | --- |
| `camera` | `'drift'` | `drift`: the whole factory, easing in slowly for the biggest moments only. `still`: never moving. `follow`: closer, going from machine to machine and to each moment, near enough to read the belts (**V** in the studio). `director`: every shot the director asks for, at that shot's own zoom. |
| `pace` | `1` | How fast it works and grows (`0.5` to `3`). |
| `labels` | `true` | Call-outs for research, new mines, biters, launches, and the rest. |
| `hud` | `true` | The planet, machines, items on the belts, power, research, stock, the cast, and a short chronicle. |

## The later worlds' options

Brasswind, Ironhaze, Sandsea, Windtrap, Walking Castle, War Rig, Traction, Last Loop, Blockade, Titan Dock, and Saber Front are lazy chunks built on the world kit, like Silent Running and Foundry. Every one of them has these three:

| Option | Default | Effect |
| --- | --- | --- |
| `camera` | `'drift'` | `drift`: the whole scene, easing in slowly for the biggest moments only. `still`: the whole scene, never moving. `follow`: closer, going where the director looks (**V** in the studio switches between this and the whole scene, live). `director`: every shot the director asks for, at that shot's own zoom, moving faster. |
| `labels` | `true` | The world's own text on the scene: call-outs, the radio, subtitles (by world below). |
| `hud` | `true` | The title and the corner text (by world below). |

And these by world. `view` is `'scene'` (the default) or `'map'`, the top-down view described in each world's section. Number options are given as default, then range.

| World | Own options | `labels` shows | `hud` shows |
| --- | --- | --- | --- |
| Brasswind (`brasswind`) | `traffic` (`1`, `0.4` to `2.5`): how busy the sky is. | Call-outs. | The brass plaque: the city, the season and year, ships aloft and at the masts, the cast, and the chronicle. |
| Ironhaze (`ironhaze`) | `speed` (`1`, `0` to `3`): how fast the city drifts past. `traffic` (`1`, `0.4` to `2.5`): how busy the sky is. | Call-outs, and name tags on the near ships and walkers. | The city, the season and hour, ships aloft and moored, the cast, and the chronicle. |
| Sandsea (`sandsea`) | `traffic` (`1`, `0.4` to `2.5`): how busy the sand is. | Call-outs, the radio, and name tags on the machines. | The region, the hour and the weather, the spice brought in and the crawlers lost, and the log. |
| Windtrap (`windtrap`) | `people` (`1`, `0.5` to `2`): how many live in the hold, and so how big the cistern is. | Call-outs over the chambers. | The hold, the hour, the water count, the souls, and the log. |
| Walking Castle (`walking-castle`) | `view`. `pace` (`1`, `0.5` to `2`): how fast the castle walks. | What is said, as subtitles. | Title cards; on the map, the diary. |
| War Rig (`war-rig`) | `view`. `traffic` (`1`, `0.4` to `2.5`): how big the war party is. | Title cards and shouted lines. | The rig's plate: its name, an hour dial, the odometer, the fuel or water gauge, and a tally of the cars put over. |
| Traction (`traction`) | `view`. `traffic` (`1`, `0.4` to `2.5`): how busy the plain is. | The rangefinder lock on the prey, intertitles, and the radio. | The city's plaque (its region, the hour, what it has eaten) and the navigator's log. |
| Last Loop (`last-loop`) | `view`. `loop` (`22`, `4` to `30`): minutes from waking to the supernova. `traffic` (`1`, `0.4` to `2.5`): how busy the system is. | Subtitles, and the name of what they are about. | The title, the ship's log, and the loop clock. |
| Blockade (`blockade`) | `view`. `traffic` (`1`, `0.4` to `2.5`): how busy the lanes are. | Event cards and the radio. | The title, the day and the planet's stores, the fleet's alert, and the log (on wide screens). |
| Titan Dock (`titan-dock`) | `view`. `traffic` (`1`, `0.4` to `2.5`): how many crews are on the dock floor. | Title cards and the radio. | The dock's name, in the corner. The breach clock is painted on the dock's wall either way. The map view is always `still` and shows its own console regardless of `labels` and `hud`. |
| Saber Front (`saber-front`) | `view`. `field` (`'seed'`): `seed` draws the battle, or pick `geonosis`, `christophsis`, `felucia`, `umbara`, `kamino`, `ryloth`, `kashyyyk`, or `coruscant`. `traffic` (`1`, `0.4` to `2.5`): how big the battle is. | The radio as subtitles, and the biggest moments as titles. | The place, the engagement and its phase, and the tug of war between the lines; on the map, the clock and the chronicle. |
