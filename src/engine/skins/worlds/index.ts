/**
 * Worlds built on the kit (src/engine/kit) that are not fantasy: each a lazy shell here (id,
 * label, schema) and its world in a chunk of its own. The template (./template) is not
 * registered; `pnpm create-world` copies it.
 */
import { lazySkin } from '../lazy';
import { SILENT_RUNNING_SCHEMA } from './silent-running/schema';
import { FOUNDRY_SCHEMA } from './foundry/schema';
import { BRASSWIND_SCHEMA } from './brasswind/schema';
import { IRONHAZE_SCHEMA } from './ironhaze/schema';
import { SANDSEA_SCHEMA } from './sandsea/schema';
import { WINDTRAP_SCHEMA } from './windtrap/schema';
import { WALKING_CASTLE_SCHEMA } from './walking-castle/schema';
import { WAR_RIG_SCHEMA } from './war-rig/schema';
import { TRACTION_SCHEMA } from './traction/schema';
import { LAST_LOOP_SCHEMA } from './last-loop/schema';
import { BLOCKADE_SCHEMA } from './blockade/schema';
import { TITAN_DOCK_SCHEMA } from './titan-dock/schema';
import { SABER_FRONT_SCHEMA } from './saber-front/schema';

export const silentRunningSkin = lazySkin(
  {
    id: 'silent-running',
    label: 'Silent Running',
    description:
      'A sea at war on a listening station\'s chart: convoys on the lanes, raiders that stalk them unheard, destroyers that ping and hunt, whales, gales, and the wrecks that stay on the seabed.',
    tags: ['world', 'sea', 'sonar', 'war'],
    crisp: true,
    schema: SILENT_RUNNING_SCHEMA,
    defaults: { palette: { from: '#22d3ee' }, intensity: 0.8 },
  },
  () => import('./silent-running'),
);

export const foundrySkin = lazySkin(
  {
    id: 'foundry',
    label: 'Foundry',
    description:
      'A factory that builds itself: miners on the ore fields, furnaces, assemblers and labs, belts full of ore and plates, construction bots, research, and in time a rocket.',
    tags: ['world', 'factory', 'automation'],
    crisp: true,
    schema: FOUNDRY_SCHEMA,
    defaults: { palette: { from: '#f59e0b' }, intensity: 0.8 },
  },
  () => import('./foundry'),
);

export const brasswindSkin = lazySkin(
  {
    id: 'brasswind',
    label: 'Brasswind',
    description:
      'A skyport city of brass and steam: airships at the mooring masts, trams on the viaducts, smoke from the works, sky pirates and the Admiralty\'s corvettes, storms on the masts, races round the spires, and fireworks at night.',
    tags: ['world', 'steampunk', 'airships', 'city'],
    crisp: true,
    schema: BRASSWIND_SCHEMA,
    defaults: { palette: { from: '#c9a227' }, intensity: 0.85 },
  },
  () => import('./brasswind'),
);

export const ironhazeSkin = lazySkin(
  {
    id: 'ironhaze',
    label: 'Ironhaze',
    description:
      'A city of iron and smoke in five planes of fog, like a matte painting: the Great Spire and its clock, zeppelins and ironclad dreadnoughts at every depth, iron walkers striding through the streets, floating citadels on their chains, foundries pouring, trains on the viaduct.',
    tags: ['world', 'steampunk', 'dieselpunk', 'airships', 'city'],
    crisp: true,
    schema: IRONHAZE_SCHEMA,
    defaults: { palette: { from: '#b08a5a' }, intensity: 0.85 },
  },
  () => import('./ironhaze'),
);

export const sandseaSkin = lazySkin(
  {
    id: 'sandsea',
    label: 'Sandsea',
    description:
      'The open sand from a rock ledge: a spice crawler working a dark stain of spice under its carryall and spotters, wormsign running at it across the dunes, the lift that makes it or does not; sandstorms, smugglers by night, the Company\'s patrols, the desert folk crossing without rhythm, and at dawn, riders on a worm.',
    tags: ['world', 'desert', 'worms', 'machines'],
    crisp: true,
    schema: SANDSEA_SCHEMA,
    defaults: { palette: { from: '#d8a860' }, intensity: 0.85 },
  },
  () => import('./sandsea'),
);

export const windtrapSkin = lazySkin(
  {
    id: 'windtrap',
    label: 'Windtrap',
    description:
      'A hold of the desert folk cut into a cliff, in cutaway: the windtrap breathing on the cliff top, dew dripping into the cistern, the water count rising and falling, people at their work in the chambers and tunnels, raiders out at dusk and back by dawn, the water of the dead, smugglers at the gate, storms that seal the doors, and the desert beyond.',
    tags: ['world', 'desert', 'cutaway', 'people'],
    crisp: true,
    schema: WINDTRAP_SCHEMA,
    defaults: { palette: { from: '#c89a5a' }, intensity: 0.85 },
  },
  () => import('./windtrap'),
);

export const walkingCastleSkin = lazySkin(
  {
    id: 'walking-castle',
    label: 'Walking Castle',
    description:
      'A ramshackle wizard\'s castle on iron hen\'s legs, walking across painted country: meadows and moors, mountain lakes, a seaside town of steep roofs; wind in the grass, sheep and big clouds; a door that opens on other places, a fire spirit in the hearth, war airships over a distant town, tar men in pursuit, storms and rainbows, and a big moon at night.',
    tags: ['world', 'fantasy', 'pastoral', 'castle'],
    crisp: true,
    schema: WALKING_CASTLE_SCHEMA,
    defaults: { palette: { from: '#7fb04a' }, intensity: 0.85 },
  },
  () => import('./walking-castle'),
);

export const warRigSkin = lazySkin(
  {
    id: 'war-rig',
    label: 'War Rig',
    description:
      'A tanker truck runs across the orange wasteland with a war party on its tail: spiked hot rods, ram trucks and buggies jockeying in the dust, boarders swung onto the tank on sway poles, explosive lances, a music truck with a wall of speakers and a flame-throwing guitar, cars flipping and burning and left behind; toxic storms, canyon ambushes, a bog by night, rival clans, and a lull at dawn.',
    tags: ['world', 'desert', 'chase', 'vehicles', 'war'],
    crisp: true,
    schema: WAR_RIG_SCHEMA,
    defaults: { palette: { from: '#e07a2c' }, intensity: 0.85 },
  },
  () => import('./war-rig'),
);
export const tractionSkin = lazySkin(
  {
    id: 'traction',
    label: 'Traction',
    description:
      'Predator cities on tracks hunting across a churned-up plain: a colossal city of stacked tiers grinding through the mud, its jaws open for the small towns that flee it, airships and trader balloons overhead, raids by the anti-traction Accord, rival cities, weather fronts, searchlights by night, a sky harbour, and relics of the ancient world coming up out of the mud.',
    tags: ['world', 'steampunk', 'cities', 'machines'],
    crisp: true,
    schema: TRACTION_SCHEMA,
    defaults: { palette: { from: '#b07a48' }, intensity: 0.85 },
  },
  () => import('./traction'),
);
export const lastLoopSkin = lazySkin(
  {
    id: 'last-loop',
    label: 'Last Loop',
    description:
      'A tiny handmade solar system in its last twenty-two minutes: a wooden ship flying between a wooded homeworld, the hourglass twins pouring sand, a crumbling world with a black hole at its heart, a stormy ocean giant and a planet of thorns; campfires and music, the probe cannon, a moon that moves when unseen, and at the end the supernova, the dark, and waking by the fire again.',
    tags: ['world', 'space', 'time loop', 'planets'],
    crisp: true,
    schema: LAST_LOOP_SCHEMA,
    defaults: { palette: { from: '#f0a860' }, intensity: 0.85 },
  },
  () => import('./last-loop'),
);
export const blockadeSkin = lazySkin(
  {
    id: 'blockade',
    label: 'Blockade',
    description:
      'A fleet holds a planet under blockade, seen from high orbit: wedge cruisers and dreadnoughts on station over the lit limb, wings on patrol, shuttles burning down into the air, merchants held at the picket, runners making their dash, sorties and broadsides, wrecks that fall and burn, and a station growing in its frame. Or the flagship\'s orbital plot of it all.',
    tags: ['world', 'space', 'fleet', 'war'],
    crisp: true,
    schema: BLOCKADE_SCHEMA,
    defaults: { palette: { from: '#8ab8ff' }, intensity: 0.85 },
  },
  () => import('./blockade'),
);
export const titanDockSkin = lazySkin(
  {
    id: 'titan-dock',
    label: 'Titan Dock',
    description:
      'A giant-robot defence base on a stormy coast, in cutaway: mechs refitted in their bays by crews and cranes, the breach clock ticking; then the alarm, the doors, a mech carried out on helicopter cables and dropped into the surf to fight what came out of the rift, in the harbour of the city across the bay.',
    tags: ['world', 'mechs', 'monsters', 'sea', 'cutaway'],
    crisp: true,
    schema: TITAN_DOCK_SCHEMA,
    defaults: { palette: { from: '#f0a030' }, intensity: 0.85 },
  },
  () => import('./titan-dock'),
);
export const saberFrontSkin = lazySkin(
  {
    id: 'saber-front',
    label: 'Saber Front',
    description:
      'The ground battles of the Clone Wars seen from a ridge, from Geonosis to Kashyyyk and aboard the Invisible Hand: clone troopers and battle droids trading bolts from cover, AT-TEs and spider droids, saber tanks and AATs, gunships dropping squads, Jedi leading charges, dogfights and Venators overhead.',
    tags: ['world', 'war', 'sci-fi', 'battle', 'star-wars'],
    crisp: true,
    schema: SABER_FRONT_SCHEMA,
    defaults: { palette: { from: '#58b8ff' }, intensity: 0.85 },
  },
  () => import('./saber-front'),
);
export const worldSkins = [silentRunningSkin, foundrySkin, brasswindSkin, ironhazeSkin, sandseaSkin, windtrapSkin, walkingCastleSkin, warRigSkin, tractionSkin, lastLoopSkin, blockadeSkin, titanDockSkin, saberFrontSkin] as const;
