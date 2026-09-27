# Void-tactical: ideas for the next pass

_Written 2026-09-27 after reading the skin end to end again. These are candidates, not decisions. Nothing here is started. Three lenses: engineering, art direction, and the fiction the sector implies._

The skin's promise is a **living sector map seen through a ship's tactical display**. Everything below is judged against that: does it make the sector feel more alive, more legible as a place, and more like an instrument someone is actually looking through, without getting louder behind page text.

---

## 1. Engineering

### 1.1 Simulation and rendering are still tangled
- `renderFleets` runs the fleet AI, moves fleets, and pushes trail history while drawing. Move the state machine and movement into `world.update()`; the layer only draws. Same for `renderCelestialBodies` (orbit angle mutation) and `renderTacticalOverlays` (lifetime decay and spawning). Then a scene with `void-fleets` disabled still evolves fleets, and the HUD layer never spawns overlays out of order.
- Overlays are spawned by rendering code via `emitOverlay(system, ...)`. Replace with a small typed **event bus on the world** (`dock`, `launch`, `approach`, `spawn`, `anomaly`, `sectorCross`). The HUD subscribes; chatter becomes a projection of real events (see 3.4), and a future audio layer could subscribe too.

### 1.2 Cost hot spots
- Fleet targeting is O(fleets × systems × planets) per frame with `sqrt`; the path projection re-simulates 15 steps per fleet per frame. Use a spatial hash over systems and structures, squared distances, and project the path only every N frames (cache the polyline, advance the head).
- Rendering loops over 25 wrap offsets for fleets, nodes, and anomalies (`-2..2` viewport in both axes). Only offsets whose bounding box intersects the viewport can matter; compute the one or two relevant offsets per entity.
- `rgba()` strings are built per draw. Cache styles per (color, alpha bucket) in the frame; quantize alpha to 1/64.
- Sprite and glow caches are module global and never evicted; add a size cap or key by palette id.

### 1.3 World model
- World coordinates depend on viewport size at generation (`rng() * width`). A resize regenerates stars but not the rest, and a mobile mount is a different sector from a desktop mount with the same seed. Define the sector in **world units** (e.g. 1600 × 1000) with a camera that scales to the viewport; determinism then holds across viewports and the layout stays composed.
- `camera.y` is always 0 and zoom does not exist. A slow vertical drift and a very slow breathing zoom (0.98 to 1.02 over a minute) would add depth for almost nothing.
- Entity ids come from `rng()` (`sys-${floor(rng()*10000)}`), which both consumes randomness and can collide. Use a deterministic counter per kind and reserve rng for layout.
- Fleet `formationOffset` exists but is unused; fleets are single glyphs. Wingmen at offsets (2 to 4 per cruiser) with slight lag would read as formations at no logic cost.

### 1.4 Labels and text
- Labels overlap (screenshots show `FIGHTER FLT-112` over `FREIGHTER FLT-816`). Add a per-frame label placer: try four anchor positions, skip if the box collides with a placed label, prefer entities nearer the pointer or newer events.
- Text measurement is uncached; cache `measureText` per (font, string).
- Fonts: canvas text falls back to monospace unless `fonts: true`. Either ship a small woff2 subset of a display font with the package or design the HUD around `ui-monospace` so the fallback is the design.

### 1.5 Interaction (all opt-in)
- Pointer hover: highlight the nearest system within 60 px (ring pulse, brighten label, show a two-line info card in the HUD corner). No clicks, since the canvas is `pointer-events: none`; hover comes from `host.pointer`.
- Reduced-motion `'reduced'`: today only intensity halves. A tactical display can also legitimately show a **frozen sweep** with slow fades; design a specific reduced mode instead of a generic slowdown.

### 1.6 Tests to add before any of the above
- World unit tests: spawn budgets by viewport class, culling thresholds, fleet state transitions over a scripted timeline, event bus emissions.
- A "same seed, different viewport" golden once world units land.

---

## 2. Art direction

### 2.1 Depth
- Three explicit depth bands with consistent treatment: far (stars, dim, desaturated, slowest), mid (systems and structures, full color), near (fleets, anomalies, brightest, fastest). Today parallax factors imply this, but color and sharpness do not. A cheap "atmospheric perspective" (mix toward `bg` by depth) would sell distance.
- Star systems should not all be the same size class. Introduce star classes with size and color temperature (blue-white giants rare, yellow common, red dwarfs frequent and dim) and let the corona and orbit radii follow.

### 2.2 Orbits and planets
- Orbits are perfect circles face-on. Ellipses with a seeded inclination (0.35 to 1.0 vertical scale) and a subtle rotation read as three-dimensional systems; planets still move on the ellipse.
- Planets are flat discs. A two-stop radial gradient with the lit side facing the star (terminator) is one gradient per planet and turns dots into worlds.
- Rings on a few gas giants; a thin asteroid belt (sparse dots on a wide orbit) on some systems.

### 2.3 Structures
- ASCII sprites are legible now but uniform. Tiered treatment: infrastructure small and cool; megastructures large with a slow accretion ring and a faint occlusion of the star behind them; mysteries with an irregular glow that breathes on a long period.
- At small `spriteScale`, swap the ASCII for a vector glyph set (the `getStructureGlyph` table already exists) so small never means mush.
- Bracket corners should size to the sprite and animate on spawn (corners fly in from 1.4× and settle), so arrivals feel like target acquisition.

### 2.4 Fleets
- Replace the text glyph with tiny vector silhouettes per class (fighter: chevron; cruiser: long hull; freighter: box with pods; scout: dart) with an engine glow dot that intensifies with speed.
- Banked turns: rotate the silhouette toward velocity, with a little lag.
- Trails as fading ribbons (width and alpha taper) rather than uniform dotted lines; predicted path dots are good, keep them.
- Spawn and despawn with a short fade and scale instead of popping.

### 2.5 HUD as instrument
- The screen is a display. One slow full-frame **sweep** (a soft luminance band crossing every 20 to 30 s), a faint reticle at the viewport center that drifts, and corner data blocks (sector coordinates, heading, sim clock) would make it read as a viewport rather than a wallpaper. All gated by `hud`.
- Typography hierarchy: system labels (small caps, tracked), structure labels (upper, smaller), fleet callouts (smallest, dimmer). Today all three are near-identical.
- Chatter placement: anchor to the entity with a short leader line and keep it inside a safe margin; never over the content column when a content rect is known.

### 2.6 Color
- `hueVariety` works, but the authored rainbow (lime, fuchsia, amber, indigo) fights any brand palette above 0.6. Reauthor the structure table in **roles** (infrastructure, industry, defense, transit, celestial, mystery) mapped to palette-derived hues (accent, analogous ±30°, complement for hazard). Variety then comes from the palette, not from hard-coded hex.
- Stars: warm-to-cool by class; never the accent.

### 2.7 Motion budget
- Nothing should cross the frame in under 8 s at `intensity` 1. Fleets currently can. Cap speed per class and let the camera provide the sense of travel.

---

## 3. The fiction (what the sector is)

The display belongs to someone. Deciding who, and what the sector is, unlocks coherent detail instead of random flavor.

### 3.1 A point of view
- The camera is a **ship** (or a station's long-range array). Give it a heading and a velocity in the HUD corner, sector coordinates that tick up as the camera drifts, and a sim clock. Chatter can then reference "our" position ("CONTACT BEARING 041").
- Sensor model: distant contacts appear first as **blips** (a dot and a bearing), resolve into a class glyph inside a range, and only show full labels inside a closer range. Structures beyond sensor range are "?" until scanned. This is fog of war for free and makes arrivals a small story every time.

### 3.2 Places, not points
- **Named sectors** the camera crosses every few minutes (procedural names: Greek letter + catalog number, e.g. `THETA-2175`), with a header stamp in the HUD on crossing and a subtle change in the star density or palette temperature.
- **Factions**: three to five, each with a glyph, a hue role, and a territory (faint Voronoi shading around their systems). Fleets carry faction marks; structures belong to factions; chatter tone changes by faction (military terse, corporate cheerful, salvagers wry).
- **Trade lanes** between systems with traffic density; the packet dashes already flowing on the links become actual freighters at intervals. Jump gates connect in pairs: a fleet entering one vanishes and emerges from its partner a moment later.

### 3.3 Events with consequences
- Convoys (a freighter with two escorts) on a lane; a blockade (fleets orbiting a gate, lane traffic stops); a distress call (anomaly marker, a scout diverts, chatter follows); a comet on a long eccentric orbit with a tail pointing away from the star; a supernova countdown for a rare blue giant (chatter, evacuation traffic, then a flash and a nebula remnant that persists for the mount's lifetime).
- Rare **legendary encounters** with special rendering: a Dyson sphere that partially occults its star; a black hole that lenses the starfield behind it (displace star positions radially near it, cheap and striking); a monolith that silences chatter for ten seconds when it enters view.

### 3.4 Chatter that means something
- Generate overlay text from events instead of random tables: `FLT-815 DOCKING @ SYS 8282`, `THETA-2175: SECTOR ENTRY`, `CONTACT LOST: SCOUT FLT-718`. Keep the ambient tables for texture at low frequency; let the event-driven lines carry the narrative. Cross-reference ids consistently so a reader who watches for a minute sees a story assemble.
- Tone packs: military, scientific, corporate, salvage. Selectable, with a "quiet" pack that only shows telemetry.

### 3.5 Scale cues
- Distances on lanes in light-hours; orbital periods that differ visibly (inner planets fast, outer slow); a scale bar in the HUD corner that changes when the breathing zoom changes. These are small but they are what makes people believe the map.

### 3.6 Calibration knobs this implies
`sensorRange`, `factions` (count), `chatter` (pack), `events` (rate), `pov` (ship / station / none), `depthFade`, `starClasses`. All schema-declared, all defaulting to the calibrated look so nothing changes for existing users until they opt in.

---

## 4. Suggested order if approved

1. Engineering 1.1 (update/render split and event bus) and 1.3 world units. Everything else stands on these; verify with the existing baselines plus new world tests.
2. Art 2.1, 2.2, 2.6 (depth bands, orbits and planets, role-based color). Biggest visual gain per line of code.
3. Fiction 3.1 and 3.4 (point of view and meaningful chatter). Cheap, and it makes the map a story.
4. Art 2.4, 2.5 (fleet silhouettes, HUD instrument) and Fiction 3.2 (sectors, factions, lanes).
5. Fiction 3.3 events and legendary encounters, gated by an `events` knob.
