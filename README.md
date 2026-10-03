# Aesthetic Background Engine

A fun little thing I made to test one idea: what if a website's background wasn't decoration, but a working display from somewhere else?

**[Open the studio →](https://aesthetic-backgrounds-library.vercel.app)**

![The sector map](e2e/__screenshots__/chromium/void-tactical.png)

## The sector map

A living tactical chart of a stretch of space:
- **Fleets.** They fly in formation between structures that actually do things. Freighter convoys run ore from mines to stations, shipyards launch new ships, and fleets jump out through one gate and arrive at another.
- **Courses.** Each fleet's planned course is drawn ahead of it and its real trail behind, as one continuous line.
- **Anomalies.** They pulse in their own colors, and scouts go out to survey them.
- **Chatter.** Radio lines type themselves out next to whatever they're about.
- **Target lock.** Every half minute, brackets close on a contact while its data types out.
- **Pacing.** A slow tension curve gives the sector quiet stretches and busy ones.

The same seed always plays the same story.

## Make it your universe

The map can belong to any world. A *universe pack* is a small JSON file holding the names, factions, ship classes, structures and their ASCII art, anomalies, radio chatter, and the faint words drifting in the background. You don't write it yourself:

1. In the studio, open **Universe → Make your own** and type a book, a film, a game, your tabletop setting, or a few lines about a world.
2. Click **Copy the prompt** and paste it into any AI.
3. Paste back what it writes, and the map becomes that world.

Two hand-written packs come with it. **Saltwind Reach** is a poor mining frontier at the end of an old road. **Choir of Hollow Stars** is a region where every star has been emptied and something sings inside.

| | |
| --- | --- |
| ![Saltwind Reach](e2e/__screenshots__/chromium/void-tactical-saltwind.png) | ![Choir of Hollow Stars](e2e/__screenshots__/chromium/void-tactical-choir.png) |

## Your GitHub, as a galaxy

Type a GitHub username in the studio and the map becomes your account:
- repositories are star systems
- languages are factions in their GitHub colors
- your recent pushes, pull requests, branches, and releases are fleets flying between them
- open issues are anomalies
- your commit messages are the radio chatter

It uses public data only.

## Instruments from other worlds

The same idea applied to other screens.

| | |
| --- | --- |
| ![Sonar](e2e/__screenshots__/chromium/sonar.png) **Sonar.** A submarine's passive waterfall. Contacts drift across bearings, a whale sings on and off, the stern arc is deaf, and the operator marks a contact while the firing solution types out. | ![Approach radar](e2e/__screenshots__/chromium/atc-radar.png) **Approach radar.** The sweep paints aircraft onto fading phosphor, so each leaves a trail of returns. Arrivals fly the approach and land, departures climb out, and the clearances type themselves. |
| ![Seismograph](e2e/__screenshots__/chromium/seismograph.png) **Seismograph.** Station pens tremble with microseism until a quake's waves sweep down the stack, arriving later the farther each station is. Big ones clip the pens flat. | ![Abyssal scanner](e2e/__screenshots__/chromium/abyssal.png) **Abyssal scanner.** Marine snow, pulsing medusae, a siphonophore's chain of lights, an anglerfish lure. A sonar fan names whatever it passes, and once in a while something very large crosses the edge of the light. |
| ![Martian weather radar](e2e/__screenshots__/chromium/mars-radar.png) **Martian weather radar.** Dust storm cells drift over the contours of Jezero and its neighbors, refreshed only where the sweep passes. Wind barbs, dust devils leaving tracks, typed storm advisories. | |

## Put one on your site

Open the [studio](https://aesthetic-backgrounds-library.vercel.app), pick one, and click **Copy prompt for your AI**. Paste it into Claude, ChatGPT, Cursor, or v0. The prompt carries the exact configuration and the few rules that keep it right.

To do it by hand instead:

```ts
import { mount } from 'space-background-engine';

mount(document.body, { skin: 'void-tactical', seed: 'orion-7', options: { universe: 'saltwind' } });
```

Everything is seeded and deterministic. It respects reduced motion, pauses when the tab is hidden, and is dark enough behind a text column to keep body copy readable.

## Running it

```bash
pnpm install
pnpm dev
```

The studio opens at `localhost:5174`. How it all works, the API, and the smaller "basics" backgrounds are in [docs/REFERENCE.md](docs/REFERENCE.md).
