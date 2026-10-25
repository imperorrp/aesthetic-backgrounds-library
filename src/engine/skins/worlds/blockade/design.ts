/**
 * Blockade's tables: the planets, the stars, the fleets' looks, the names, and what is said on
 * the radio. All original: the classes and the factions are this world's own.
 */
import type { Genome } from '../../../kit';
import type { Cls } from './types';

export type PlanetKind = 'ocean' | 'desert' | 'ice' | 'gas' | 'lava' | 'city';
export type PlanetLook = {
  kind: PlanetKind; label: string;
  /** Surface colours, low to high (sea floor, shallows, lowland, upland, peak), and the clouds. */
  deep: string; shallow: string; low: string; mid: string; high: string; peak: string; cloud: string;
  /** The air at the limb, and its colour at the terminator. */
  atmo: string; dusk: string;
  /** City lights: their colour and how many. */
  city: string; cityK: number;
  /** Sea level (0..1 of the height field), cloud cover (0..1), and glow from below (lava). */
  sea: number; clouds: number; glow: string; glowK: number;
};

const PLANETS: Record<PlanetKind, (g: Genome) => PlanetLook> = {
  ocean: (g) => ({
    kind: 'ocean', label: g.pick(['an ocean world', 'a world of seas', 'a blue world']),
    deep: g.pick(['#08224a', '#0a2a52', '#062038']), shallow: g.pick(['#1b6e98', '#2a7aa0', '#1a8090']),
    low: g.pick(['#3f6a32', '#4a7038', '#56723a']), mid: g.pick(['#7a7048', '#8a7a50', '#6e6a46']), high: '#8a8070', peak: '#e8eef4',
    cloud: '#f4f6fa', atmo: g.pick(['#5aa0ff', '#6ab0ff', '#58a8f0']), dusk: '#ff8a50',
    city: '#ffd890', cityK: g.range(0.5, 0.9), sea: g.range(0.5, 0.58), clouds: g.range(0.45, 0.65), glow: '#000000', glowK: 0,
  }),
  desert: (g) => ({
    kind: 'desert', label: g.pick(['a desert world', 'a dry world', 'a world of dust']),
    deep: '#5a3a24', shallow: '#3a6a70', low: g.pick(['#c8925a', '#d0a066', '#b88050']), mid: g.pick(['#a86a3e', '#b07848', '#9a5e38']), high: '#7a4a30', peak: '#e8d0b0',
    cloud: '#f0dcc0', atmo: g.pick(['#f0b07a', '#e8a070', '#f4c088']), dusk: '#ff6a3a',
    city: '#ffc070', cityK: g.range(0.3, 0.6), sea: g.range(0.18, 0.26), clouds: g.range(0.12, 0.25), glow: '#000000', glowK: 0,
  }),
  ice: (g) => ({
    kind: 'ice', label: g.pick(['an ice world', 'a frozen world', 'a world under ice']),
    deep: '#123a5a', shallow: '#3a7a9a', low: '#b8d0e0', mid: '#d8e6f0', high: '#eef4fa', peak: '#ffffff',
    cloud: '#f4f8ff', atmo: g.pick(['#90c8ff', '#a0d8ff', '#88b8f0']), dusk: '#ff9a7a',
    city: '#a8e0ff', cityK: g.range(0.25, 0.5), sea: g.range(0.28, 0.36), clouds: g.range(0.3, 0.5), glow: '#000000', glowK: 0,
  }),
  gas: (g) => {
    const warm = g.chance(0.6);
    return {
      kind: 'gas', label: g.pick(['a gas giant', 'a banded giant', 'a world of storms']),
      deep: warm ? '#6a3a20' : '#1a3a5a', shallow: warm ? '#b07040' : '#3a6a90', low: warm ? '#e0b888' : '#88b8d0', mid: warm ? '#c88850' : '#5a8ab0', high: warm ? '#f0e0c0' : '#c8e0ec', peak: warm ? '#8a4a28' : '#2a4a70',
      cloud: warm ? '#f8ecd8' : '#e4f2f8', atmo: warm ? '#f0c890' : '#90c8e8', dusk: '#ff7a40',
      city: '#ffd8a0', cityK: g.range(0.04, 0.1), sea: 0, clouds: 0, glow: '#000000', glowK: 0,
    };
  },
  lava: (g) => ({
    kind: 'lava', label: g.pick(['a burning world', 'a world of fire', 'a young world']),
    deep: '#1a0e0c', shallow: '#2a1612', low: '#3a2620', mid: '#4a3428', high: '#5e463a', peak: '#7a6a60',
    cloud: '#5a4a44', atmo: g.pick(['#ff8a50', '#ff7040', '#e88060']), dusk: '#ff4a20',
    city: '#ffe0a0', cityK: g.range(0.15, 0.35), sea: g.range(0.2, 0.27), clouds: g.range(0.2, 0.35), glow: g.pick(['#ff5a1a', '#ff7a20', '#ff4010']), glowK: g.range(0.8, 1.1),
  }),
  city: (g) => ({
    kind: 'city', label: g.pick(['a city world', 'a world that is all one city', 'the capital world']),
    deep: '#1a2230', shallow: '#2a3444', low: g.pick(['#5a5e66', '#62605a', '#56606a']), mid: '#787a80', high: '#9a9a98', peak: '#c8c8c4',
    cloud: '#d8d4cc', atmo: g.pick(['#9ab8ff', '#c0b090', '#a8b8e0']), dusk: '#ff9a60',
    city: g.pick(['#ffd890', '#ffe8c0', '#c8e0ff']), cityK: g.range(1.1, 1.4), sea: g.range(0.12, 0.2), clouds: g.range(0.15, 0.3), glow: '#000000', glowK: 0,
  }),
};
export const PLANET_KINDS: PlanetKind[] = ['ocean', 'desert', 'ice', 'gas', 'lava', 'city'];
export const planetLook = (g: Genome, kind: PlanetKind) => PLANETS[kind](g);

export type StarLook = { name: string; color: string; glare: string; label: string };
export const STARS: StarLook[] = [
  { name: 'yellow', color: '#fff3dc', glare: '#ffd89a', label: 'A YELLOW SUN' },
  { name: 'white', color: '#f2f6ff', glare: '#c8dcff', label: 'A WHITE SUN' },
  { name: 'orange', color: '#ffe0b8', glare: '#ffb070', label: 'AN ORANGE SUN' },
  { name: 'red', color: '#ffd0b8', glare: '#ff8a60', label: 'A RED SUN' },
  { name: 'blue', color: '#e4eeff', glare: '#9ab8ff', label: 'A BLUE SUN' },
];

/** A fleet's look: its hull colours, its trim, its engines, its windows, its guns, and the shape of its hulls. */
export type HullStyle = 'wedge' | 'spine' | 'slab' | 'curved';
export type FleetLook = {
  name: string; short: string; prefix: string;
  hull: string; hull2: string; trim: string; engine: string; window: string; bolt: string; style: HullStyle;
  /** Running lights: port, starboard, the strobe. */
  port: string; star: string; strobe: string;
};
export const FLEETS: FleetLook[] = [
  { name: 'THE ASCENDANT ADMIRALTY', short: 'THE ADMIRALTY', prefix: 'AAS', hull: '#b8bcc0', hull2: '#8a9096', trim: '#b8322a', engine: '#8ab8ff', window: '#e8f0ff', bolt: '#7aff8a', style: 'wedge', port: '#ff3a2a', star: '#3aff6a', strobe: '#ffffff' },
  { name: 'THE IRON CONCORD', short: 'THE CONCORD', prefix: 'ICS', hull: '#6a6e74', hull2: '#4a4e56', trim: '#d8a030', engine: '#ff9a4a', window: '#ffd890', bolt: '#ff5a3a', style: 'spine', port: '#ff4a2a', star: '#4aff7a', strobe: '#fff0d0' },
  { name: 'THE SOLAR MAGISTRACY', short: 'THE MAGISTRACY', prefix: 'SMV', hull: '#d8d0c0', hull2: '#a89c88', trim: '#3a5aa8', engine: '#ffe0a0', window: '#fff0c8', bolt: '#ffd040', style: 'curved', port: '#ff6a3a', star: '#6affa0', strobe: '#ffffff' },
  { name: 'THE HOLLOW CROWN', short: 'THE CROWN', prefix: 'HCS', hull: '#3a3a42', hull2: '#26262e', trim: '#c02838', engine: '#ff4a6a', window: '#ff9a8a', bolt: '#ff2a4a', style: 'wedge', port: '#ff2a2a', star: '#2aff5a', strobe: '#ffd0d0' },
  { name: 'THE VEDRAN HEGEMONY', short: 'THE HEGEMONY', prefix: 'VHS', hull: '#8a9488', hull2: '#626c62', trim: '#e0d070', engine: '#b0ff9a', window: '#e0ffd0', bolt: '#c0ff4a', style: 'slab', port: '#ff5a3a', star: '#5aff8a', strobe: '#f0fff0' },
  { name: 'THE COMPANY OF THE PALE STAR', short: 'THE COMPANY', prefix: 'PSC', hull: '#a8b4c4', hull2: '#7884a0', trim: '#e8e8f0', engine: '#c09aff', window: '#e0d8ff', bolt: '#d08aff', style: 'spine', port: '#ff4a6a', star: '#4affb0', strobe: '#ffffff' },
];
/** The planet's own: a home fleet, built of what they have. */
export const HOMES: Omit<FleetLook, 'name' | 'short'>[] = [
  { prefix: 'HF', hull: '#9a8a74', hull2: '#6e604e', trim: '#3a9ac8', engine: '#7ae0ff', window: '#ffe8b0', bolt: '#4ac8ff', style: 'curved', port: '#ff5a3a', star: '#5aff7a', strobe: '#ffffff' },
  { prefix: 'FC', hull: '#7a8a96', hull2: '#56626c', trim: '#e88a2a', engine: '#ffb85a', window: '#ffe0a0', bolt: '#ffa040', style: 'slab', port: '#ff4a2a', star: '#4aff6a', strobe: '#fff8e0' },
  { prefix: 'ML', hull: '#8a7a80', hull2: '#5e5258', trim: '#8ad04a', engine: '#9affd8', window: '#e8fff0', bolt: '#5affc0', style: 'curved', port: '#ff6a4a', star: '#6aff8a', strobe: '#ffffff' },
];

export const PLANET_NAMES = ['VESPERINE', 'TELMARCH', 'OSSERY', 'VALCOURT', 'NEW HAVILAND', 'KESHET', 'MARROWGATE', 'IOLANTHE', 'SERAPHINE', 'DOURNE', 'CASSIVEL', 'HALVARD', 'SAINT ODILE', 'OLD TALAVER', 'MIRRENHOLD', 'ARDENNE'];
export const SYSTEMS = ['THE TAMSIN REACH', 'THE SALT MARCHES', 'THE OUTER HELIX', 'THE CORDELIA DRIFT', 'THE NINEFOLD', 'THE GREY VERGE', 'THE LANTERN STARS', 'THE WIDOW\'S ARM'];
export const FLEET_NAMES = ['SEVERANCE', 'MAGISTRATE', 'COLD MERIDIAN', 'UNYIELDING', 'IRON PSALM', 'HIGH WARDEN', 'NOCTURNE', 'GALLOWGLASS', 'SOVEREIGN DUTY', 'CANTICLE', 'OBDURATE', 'LONG REACH', 'THRESHOLD', 'VERDICT', 'TEMPERANCE', 'ARBITER OF HOURS', 'GREY LITANY', 'STEADFAST', 'PALADIN OF SALT', 'QUIETUS', 'RECKONING', 'STERN MERCY', 'ADAMANT', 'VIGIL'];
export const ESCORT_NAMES = ['SPINDLE', 'WASP', 'NETTLE', 'CINDER', 'MAGPIE', 'TALON', 'LURCHER', 'BRIAR', 'FLINT', 'HOB', 'SKEIN', 'GORSE', 'RAPIER', 'THISTLE', 'BODKIN', 'SHRIKE', 'TINDER', 'GADFLY'];
export const RUNNER_NAMES = ['LUCKY MARIGOLD', 'THE WIDOW\'S DOWRY', 'NOBODY\'S DAUGHTER', 'SILVERFISH', 'RED ANNIE', 'THE PATIENT THIEF', 'MOTH', 'SOFT LANDING', 'THE LONG ODDS', 'QUICKSILVER JANE', 'SPARROWHAWK', 'BAD PENNY', 'THE LAST WALTZ'];
export const MERCHANT_NAMES = ['HEAVY CLAUDIA', 'PROVIDENCE OF TUL', 'SEVEN SISTERS', 'MERIDIAN BULK 4', 'THE GRAIN QUEEN', 'ASTER LINE 12', 'OLD SORROW', 'BOUNTIFUL', 'SLOW TORTOISE', 'HEARTWOOD', 'CARAVEL OF ENN', 'THE MILLER\'S BOY'];
export const HOME_NAMES = ['HEARTH', 'LANTERN', 'THE MOTHER\'S ANSWER', 'GOODNIGHT', 'RAMPART', 'NIGHT HERON', 'ORISON', 'TALLOW', 'FIRST LIGHT', 'HOMEWARD', 'THE OLD OAK', 'KINDLING'];
export const WINGS = ['LANTERN', 'SPUR', 'GLAIVE', 'ASH', 'NEEDLE', 'CORVID', 'HALBERD', 'EMBER', 'VANE', 'SABLE'];
export const STATION_NAMES = ['ANCHORAGE', 'HIGHPORT', 'DRYDOCK SEVEN', 'THE CITADEL OF THE LINE', 'GATEHOUSE', 'THE IRON CLOISTER', 'BASTION ORBITAL'];
export const MOON_NAMES = ['THE PALE ONE', 'SORREL', 'IONE', 'CAUL', 'LITTLE BELL', 'HOB\'S LANTERN', 'THE CINDER', 'MAB'];
export const KLASS: Partial<Record<Cls, string[]>> = {
  dreadnought: ['CITADEL', 'MONOLITH', 'JUDICATOR', 'SOVEREIGN'],
  cruiser: ['TRIBUNE', 'LANCET', 'PALISADE', 'CENSOR'],
  carrier: ['MATRON', 'ARK', 'HIVE', 'DOVECOTE'],
  frigate: ['WARDEN', 'PICKET', 'HALBERD', 'PROCTOR'],
  tender: ['DRAYHORSE', 'CRADLE', 'OXBOW'],
  corvette: ['SKIFF', 'HARRIER', 'DART'],
  freighter: ['BULK HAULER', 'CONTAINER SHIP', 'GRAIN BARGE', 'ORE CARRIER'],
  flagship: ['EMPYREAN', 'THRONE'],
  platform: ['DEFENCE PLATFORM', 'GUN PLATFORM'],
};
export const CLS_WORD: Record<Cls, string> = {
  dreadnought: 'DREADNOUGHT', cruiser: 'BATTLECRUISER', carrier: 'CARRIER', frigate: 'FRIGATE', tender: 'TENDER', corvette: 'CORVETTE',
  freighter: 'FREIGHTER', shuttle: 'SHUTTLE', fighter: 'FIGHTER', flagship: 'FLAGSHIP', platform: 'PLATFORM',
};
/** Length at scale 1 (world px, before u), hit points, top speed. */
export const STATS: Record<Cls, { len: number; hp: number; speed: number }> = {
  dreadnought: { len: 1000, hp: 60, speed: 22 },
  cruiser: { len: 780, hp: 40, speed: 30 },
  carrier: { len: 720, hp: 34, speed: 26 },
  frigate: { len: 300, hp: 12, speed: 70 },
  tender: { len: 280, hp: 8, speed: 46 },
  corvette: { len: 170, hp: 6, speed: 150 },
  freighter: { len: 300, hp: 8, speed: 40 },
  shuttle: { len: 46, hp: 2, speed: 90 },
  fighter: { len: 26, hp: 1, speed: 230 },
  flagship: { len: 1700, hp: 120, speed: 16 },
  platform: { len: 150, hp: 8, speed: 10 },
};

export const LINES = {
  station: ['LINE HOLDING. NOTHING ON THE SCOPE', 'ALL STATIONS, MAINTAIN INTERVAL', 'SECTOR FOUR IS CLEAR', 'PICKET REPORTS NO MOVEMENT', 'SHIFT CHANGE ON THE GUN DECKS', 'REACTOR AT NINETY, HOLDING', 'KEEP THOSE LANES CLEAR', 'TRAFFIC CONTROL, ACKNOWLEDGE', 'NOTHING GETS THROUGH. NOTHING.', 'STATION KEEPING, ALL GREEN'],
  patrol: ['TURNING AT THE MARKER', 'PATROL LEG COMPLETE', 'EYES ON THE NIGHT SIDE', 'SWEEPING THE LOW LANES', 'COMING ABOUT', 'CONTACT. NO, JUST ICE'],
  fighter: ['FORM ON ME', 'TIGHTEN IT UP, TWO', 'FUEL AT HALF', 'LOOKS QUIET DOWN THERE', 'ON THE DECK IN FIVE', 'BREAKING LEFT', 'I HAVE THE LEAD'],
  shuttle: ['CLEARED FOR DESCENT', 'HEAT SHIELD NOMINAL', 'GOING INTO THE SOUP', 'WHEELS UP FROM THE SURFACE', 'DOCKING IN NINETY SECONDS', 'TOUCHDOWN IN FOUR MINUTES', 'IT\'S BUMPY DOWN HERE'],
  merchant: ['WE ARE CARRYING GRAIN, NOTHING ELSE', 'MANIFEST TRANSMITTED', 'HOW LONG MUST WE WAIT?', 'WE HAVE FAMILIES ABOARD', 'OUR PAPERS ARE IN ORDER', 'THREE DAYS AT THE LINE NOW'],
  inspect: ['HOLD POSITION. PREPARE TO BE SCANNED', 'SCANNING. DO NOT MANEUVER', 'YOU ARE CLEARED TO PROCEED', 'TURN BACK. THIS PORT IS CLOSED', 'PREPARE TO BE BOARDED', 'TRANSMIT YOUR MANIFEST'],
  runner: ['PUNCH IT', 'ALL POWER TO THE ENGINES', 'THEY\'VE SEEN US', 'HOLD TOGETHER, OLD GIRL', 'GET US INTO THE CLOUDS', 'DON\'T LOOK BACK', 'JUST A LITTLE FURTHER'],
  chase: ['RUNNER! RUNNER!', 'ALL INTERCEPTORS, VECTOR ON THE RUNNER', 'HEAVE TO OR BE FIRED UPON', 'WEAPONS FREE ON THE RUNNER', 'SHE\'S FAST. SHE\'S VERY FAST', 'CUT HER OFF FROM THE AIR'],
  battle: ['CONTACTS RISING FROM THE NIGHT SIDE', 'ALL SHIPS, BATTLE STATIONS', 'SHIELDS TO THE BOW', 'WE\'RE HIT, WE\'RE HIT', 'FIRE AS SHE BEARS', 'BREAK, BREAK!', 'SPLASH ONE', 'DAMAGE CONTROL TO DECK NINE', 'THEY\'RE GOING FOR THE CARRIER'],
  home: ['BREAK THEIR LINE!', 'GO FOR THE CARRIER', 'FOR HOME!', 'STAY WITH ME', 'ONE MORE PASS', 'THEY CAN\'T COVER EVERYTHING'],
  jump: ['JUMP SIGNATURE, GRID NINE', 'RELIEF HAS ARRIVED', 'TAKE YOUR PLACE IN THE LINE', 'GOOD TO SEE YOU', 'DROPPING OUT OF THE LANE NOW'],
  flare: ['FLARE WARNING. ALL HANDS BELOW', 'SENSORS ARE WHITE', 'SHIELDS TO FULL', 'LOOK AT THE SKY DOWN THERE', 'COMMS ARE DOWN. SAY AGAIN?'],
  bombard: ['FIRE MISSION AUTHORIZED', 'TARGETS ON THE NIGHT SIDE', 'GOD FORGIVE US', 'SPLASH. SPLASH.', 'ADJUST FIRE, TWO MILES EAST'],
  tender: ['SEGMENT ON THE HOOK', 'DOCKING WITH THE FRAME', 'WELDERS STANDING BY', 'ANOTHER ONE FOR THE PILE'],
  disabled: ['WE\'VE LOST POWER', 'SHE\'S DEAD IN SPACE', 'EMERGENCY LIGHTS ONLY', 'ALL DECKS, REPORT'],
};
