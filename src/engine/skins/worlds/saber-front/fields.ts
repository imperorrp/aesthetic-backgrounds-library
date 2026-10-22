/**
 * The battlefields of the Clone Wars: where a seed's battle is fought, who fights it, and how its
 * light falls. DOM-free: the sim reads the names, the cast and the weather, the painter the light.
 *
 * Eight battles, each with two hours and its own people: the First Battle of Geonosis (the arena and
 * the spire fields at sunset, the core ships lifting off), Christophsis (the crystal city by night),
 * Felucia (the fungus plains), Umbara (the dark jungle lit by tracer fire), Kamino (Tipoca City's
 * platforms in the storm), Ryloth (the canyon below Lessu), Kashyyyk (the beach under the wroshyr
 * trees, with the Wookiees), and the boarding of the Invisible Hand over Coruscant (in her hangar).
 *
 * Each has a `style`, which says how the painter builds it (a dry plain, crystal towers, a jungle,
 * a sea platform, a canyon, a beach, a hangar), and its own Jedi, legions and Separatist leaders.
 */
export type FieldKind = 'geonosis' | 'christophsis' | 'felucia' | 'umbara' | 'kamino' | 'ryloth' | 'kashyyyk' | 'coruscant';
export type FieldStyle = 'arena' | 'crystal' | 'jungle' | 'platform' | 'canyon' | 'beach' | 'hangar';

export type FieldLight = {
  name: string;
  /** The sky, top to horizon. */
  top: string; mid: string; low: string;
  /** The key light's colour, where its disc hangs (x, y as fractions of the sky; null for none), and how strong its rim is. */
  sun: string; sunAt: [number, number] | null; sunR: number; rim: number;
  /** Which way the light comes across the field (-1 from the left, +1 from the right) and how high. */
  lx: number; ly: number;
  /** 0 by day, 1 by night: how much the lights of the battle carry. */
  night: number;
  /** The ground near and far, the haze at the horizon, the ink of the shadows. */
  ground: string; far: string; haze: string; ink: string;
  /** A second ground colour for the field's texture (sand ripples, deck plates, moss). */
  ground2: string;
  /** The field's own light: windows, crystal glow, bioluminescence, beacons. */
  accent: string;
  /** How quickly things fade into the haze with distance (1 ordinary). */
  hazeK: number;
};

/** What a battle has: which machines and peoples can be on its field. */
export type FieldCast = {
  walkers: boolean; artillery: boolean; tanks: boolean; geonosians: boolean; wookiees: boolean; twileks: boolean;
  magnaguards: boolean; tridents: boolean; crabs: boolean; coreships: boolean; speeders: boolean; spha: boolean;
};

export type FieldDef = {
  kind: FieldKind; style: FieldStyle;
  /** The battle's name, how it is said in a line, and the places on its field. */
  battle: string; label: string; places: string[];
  hours: FieldLight[];
  /** The horizon, as a fraction of the world's height. */
  horizon: [number, number];
  /** The weather it has: rain, blowing dust, ground fog, illumination flares at night. */
  rain: number; dust: number; fog: number; flares: boolean; lightning: boolean;
  /** Jungle flora: how much of it is giant fungi (the rest trees). */
  fungi: number;
  /** The Jedi who fought there, the legions, the Separatist leaders. */
  jedi: string[]; legions: string[]; leaders: string[];
  /** The capital ships over it. */
  ships: { ga: string[]; cf: string[] };
  cast: FieldCast;
};

const ALL: FieldCast = { walkers: true, artillery: true, tanks: true, geonosians: false, wookiees: false, twileks: false, magnaguards: false, tridents: false, crabs: false, coreships: false, speeders: true, spha: false };

export const FIELDS: Record<FieldKind, FieldDef> = {
  geonosis: {
    kind: 'geonosis', style: 'arena', battle: 'THE FIRST BATTLE OF GEONOSIS', label: 'Geonosis', horizon: [0.46, 0.52], rain: 0, dust: 0.35, fog: 0, flares: false, lightning: false, fungi: 0,
    places: ['THE PETRANAKI ARENA', 'THE SPIRE FIELDS', 'THE DROID FOUNDRIES', 'THE CORE SHIP LANDING FIELD'],
    jedi: ['MACE WINDU', 'YODA', 'KI-ADI-MUNDI', 'PLO KOON', 'LUMINARA UNDULI', 'KIT FISTO', 'OBI-WAN KENOBI'],
    legions: ['212th', '501st', '41st', '21st', '104th'], leaders: ['POGGLE THE LESSER', 'COUNT DOOKU', 'NUTE GUNRAY'],
    ships: { ga: ['THE TRANQUILITY', 'THE MAJESTIC'], cf: ['THE LUCREHULK CORE SHIP', 'THE TRADE FEDERATION CORE SHIP'] },
    cast: { ...ALL, geonosians: true, coreships: true, spha: true },
    hours: [
      {
        name: 'the red sunset', top: '#3a2a4e', mid: '#c4583a', low: '#ffb060', sun: '#ffc070', sunAt: [0.72, 0.8], sunR: 46, rim: 1, lx: 1, ly: 0.18, night: 0.15,
        ground: '#a8603a', ground2: '#c88450', far: '#c87a50', haze: '#e89a68', ink: '#2a1418', accent: '#ffb070', hazeK: 1,
      },
      {
        name: 'the dust of the afternoon', top: '#6a4a3a', mid: '#c87a4a', low: '#f0b070', sun: '#ffe0a0', sunAt: [0.3, 0.55], sunR: 34, rim: 0.85, lx: -1, ly: 0.3, night: 0,
        ground: '#b8703c', ground2: '#d4925a', far: '#c8885a', haze: '#e8a874', ink: '#2e1810', accent: '#ffc080', hazeK: 1.1,
      },
    ],
  },
  christophsis: {
    kind: 'christophsis', style: 'crystal', battle: 'THE BATTLE OF CHRISTOPHSIS', label: 'Christophsis', horizon: [0.5, 0.56], rain: 0, dust: 0, fog: 0.25, flares: true, lightning: false, fungi: 0,
    places: ['THE CRYSTAL CITY', 'THE SEPARATIST BUNKER', 'THE CITY SQUARE'],
    jedi: ['ANAKIN SKYWALKER', 'OBI-WAN KENOBI', 'AHSOKA TANO'], legions: ['501st', '212th'], leaders: ['GENERAL WHORM LOATHSOM', 'ADMIRAL TRENCH', 'ASAJJ VENTRESS'],
    ships: { ga: ['THE TWILIGHT\'S SHIELD', 'THE RESOLUTE', 'THE NEGOTIATOR'], cf: ['THE INVINCIBLE', 'THE INVISIBLE HAND'] },
    cast: { ...ALL, speeders: true },
    hours: [
      {
        name: 'deep night', top: '#04061a', mid: '#0e1440', low: '#2a2a6a', sun: '#a8c0ff', sunAt: [0.2, 0.22], sunR: 20, rim: 0.45, lx: -1, ly: 0.5, night: 1,
        ground: '#1e2448', ground2: '#2c3468', far: '#1a2050', haze: '#262c64', ink: '#04040e', accent: '#8ab8ff', hazeK: 0.9,
      },
      {
        name: 'the hour before dawn', top: '#081428', mid: '#14385a', low: '#3a8a9a', sun: '#c0f0ff', sunAt: null, sunR: 0, rim: 0.55, lx: 1, ly: 0.2, night: 0.8,
        ground: '#1c3450', ground2: '#28506a', far: '#1e3c58', haze: '#2e6878', ink: '#040a12', accent: '#7affe8', hazeK: 0.9,
      },
    ],
  },
  felucia: {
    kind: 'felucia', style: 'jungle', battle: 'THE BATTLE OF FELUCIA', label: 'Felucia', horizon: [0.44, 0.5], rain: 0.15, dust: 0, fog: 0.45, flares: false, lightning: false, fungi: 0.8,
    places: ['THE FUNGUS PLAINS', 'THE NIRIAN FARMS', 'THE SARLACC POOLS'],
    jedi: ['AAYLA SECURA', 'ANAKIN SKYWALKER', 'AHSOKA TANO', 'OBI-WAN KENOBI'], legions: ['327th', '501st'], leaders: ['SHU MAI', 'GENERAL GRIEVOUS', 'TA-175'],
    ships: { ga: ['THE RESOLUTE', 'THE VIGILANCE'], cf: ['THE MUNIFICENT FRIGATE', 'THE PROVIDENCE'] },
    cast: { ...ALL, crabs: true },
    hours: [
      {
        name: 'a hazy day', top: '#5a7a68', mid: '#a8b880', low: '#e8d890', sun: '#fff0b0', sunAt: [0.28, 0.4], sunR: 30, rim: 0.65, lx: -1, ly: 0.4, night: 0,
        ground: '#5a7a34', ground2: '#8aa040', far: '#7a8a48', haze: '#b8c088', ink: '#142010', accent: '#ff9ad0', hazeK: 1.2,
      },
      {
        name: 'a sickly dusk', top: '#2a2a40', mid: '#6a5a6a', low: '#d8907a', sun: '#ffb090', sunAt: [0.7, 0.85], sunR: 38, rim: 0.7, lx: 1, ly: 0.15, night: 0.45,
        ground: '#3a5a2a', ground2: '#5a7a34', far: '#4a5a3a', haze: '#8a7a6a', ink: '#0c100a', accent: '#ffb0e0', hazeK: 1.15,
      },
    ],
  },
  umbara: {
    kind: 'umbara', style: 'jungle', battle: 'THE BATTLE OF UMBARA', label: 'Umbara', horizon: [0.44, 0.5], rain: 0.3, dust: 0, fog: 0.6, flares: true, lightning: false, fungi: 0.25,
    places: ['THE UMBARAN WILDS', 'THE AIRBASE', 'THE ROAD TO THE CAPITAL'],
    jedi: ['ANAKIN SKYWALKER', 'PONG KRELL'], legions: ['501st'], leaders: ['THE UMBARAN MILITIA', 'GENERAL TAMBOR\'S DROIDS'],
    ships: { ga: ['THE RESOLUTE', 'THE INTEGRITY'], cf: ['THE UMBARAN BLOCKADE', 'THE RECUSANT'] },
    cast: { ...ALL, crabs: true },
    hours: [
      {
        name: 'the long night', top: '#020406', mid: '#0a1018', low: '#1a2430', sun: '#c8d8f0', sunAt: null, sunR: 0, rim: 0.35, lx: 1, ly: 0.55, night: 1,
        ground: '#141c1c', ground2: '#1e2a28', far: '#121a1e', haze: '#18222a', ink: '#020404', accent: '#7ad8ff', hazeK: 1.15,
      },
      {
        name: 'the glow of the fighting', top: '#06040c', mid: '#140c1e', low: '#2a1a34', sun: '#e0c8ff', sunAt: null, sunR: 0, rim: 0.4, lx: -1, ly: 0.5, night: 1,
        ground: '#16141c', ground2: '#221e2a', far: '#14121a', haze: '#1e1a28', ink: '#020204', accent: '#c88aff', hazeK: 1.1,
      },
    ],
  },
  kamino: {
    kind: 'kamino', style: 'platform', battle: 'THE BATTLE OF KAMINO', label: 'Kamino', horizon: [0.5, 0.55], rain: 1, dust: 0, fog: 0.2, flares: false, lightning: true, fungi: 0,
    places: ['TIPOCA CITY', 'THE LANDING PLATFORMS', 'THE CLONE BARRACKS'],
    jedi: ['OBI-WAN KENOBI', 'SHAAK TI', 'ANAKIN SKYWALKER'], legions: ['501st', '212th'], leaders: ['ASAJJ VENTRESS', 'GENERAL GRIEVOUS', 'ADMIRAL TRENCH'],
    ships: { ga: ['THE NEGOTIATOR', 'THE RESOLUTE'], cf: ['THE INVISIBLE HAND', 'THE MUNIFICENT FRIGATE'] },
    cast: { ...ALL, tridents: true, tanks: false, speeders: false },
    hours: [
      {
        name: 'a grey storm', top: '#3a4450', mid: '#5c6a74', low: '#8a9aa0', sun: '#d8e8f0', sunAt: null, sunR: 0, rim: 0.35, lx: -1, ly: 0.6, night: 0.25,
        ground: '#5a646c', ground2: '#707c84', far: '#56626a', haze: '#7e8c94', ink: '#141a20', accent: '#ffd070', hazeK: 1.25,
      },
      {
        name: 'a black storm', top: '#06080e', mid: '#121a24', low: '#26323e', sun: '#a8c8e8', sunAt: null, sunR: 0, rim: 0.3, lx: 1, ly: 0.6, night: 0.95,
        ground: '#222a32', ground2: '#2e3842', far: '#1e2630', haze: '#2a3642', ink: '#04060a', accent: '#ffc860', hazeK: 1.2,
      },
    ],
  },
  ryloth: {
    kind: 'ryloth', style: 'canyon', battle: 'THE BATTLE OF RYLOTH', label: 'Ryloth', horizon: [0.44, 0.5], rain: 0, dust: 0.25, fog: 0.1, flares: false, lightning: false, fungi: 0,
    places: ['THE GATES OF LESSU', 'THE NABAT VALLEY', 'THE PLAINS BELOW LESSU'],
    jedi: ['MACE WINDU', 'OBI-WAN KENOBI', 'ANAKIN SKYWALKER'], legions: ['212th', '501st', '187th'], leaders: ['EMIR WAT TAMBOR', 'TX-20', 'GENERAL GRIEVOUS'],
    ships: { ga: ['THE DEFENDER', 'THE RESOLUTE'], cf: ['THE BLOCKADE FRIGATE', 'THE RECUSANT'] },
    cast: { ...ALL, twileks: true },
    hours: [
      {
        name: 'a gold morning', top: '#4a78a8', mid: '#a8b4b0', low: '#f0d8a0', sun: '#fff0c8', sunAt: [0.22, 0.6], sunR: 34, rim: 0.85, lx: -1, ly: 0.35, night: 0,
        ground: '#a87a52', ground2: '#c49868', far: '#b08a68', haze: '#dcc4a0', ink: '#2a1c16', accent: '#ffd080', hazeK: 0.95,
      },
      {
        name: 'a red afternoon', top: '#5a5a84', mid: '#c08068', low: '#f0a070', sun: '#ffd0a0', sunAt: [0.8, 0.5], sunR: 38, rim: 0.9, lx: 1, ly: 0.28, night: 0.05,
        ground: '#9a5a3c', ground2: '#b8744c', far: '#a86a50', haze: '#d89070', ink: '#26120e', accent: '#ffb070', hazeK: 1,
      },
    ],
  },
  kashyyyk: {
    kind: 'kashyyyk', style: 'beach', battle: 'THE BATTLE OF KASHYYYK', label: 'Kashyyyk', horizon: [0.46, 0.52], rain: 0.1, dust: 0, fog: 0.3, flares: false, lightning: false, fungi: 0,
    places: ['THE BEACH AT KACHIRHO', 'THE WAWAATT LAGOON', 'THE WROSHYR SHORE'],
    jedi: ['YODA', 'LUMINARA UNDULI', 'QUINLAN VOS'], legions: ['41st'], leaders: ['GENERAL GRIEVOUS', 'TX-21', 'KALANI'],
    ships: { ga: ['THE VIGILANCE', 'THE TRANQUILITY'], cf: ['THE MUNIFICENT FRIGATE', 'THE RECUSANT'] },
    cast: { ...ALL, wookiees: true, crabs: true },
    hours: [
      {
        name: 'a misty morning', top: '#5a7488', mid: '#9aa8a0', low: '#d8d8b8', sun: '#fff4d0', sunAt: [0.7, 0.55], sunR: 32, rim: 0.7, lx: 1, ly: 0.35, night: 0,
        ground: '#a89a72', ground2: '#c8b88a', far: '#8a9078', haze: '#c0c8b8', ink: '#1a1e16', accent: '#ffd890', hazeK: 1.15,
      },
      {
        name: 'a stormy evening', top: '#2a3040', mid: '#5a5a5a', low: '#c08a60', sun: '#ffb070', sunAt: [0.25, 0.85], sunR: 40, rim: 0.75, lx: -1, ly: 0.15, night: 0.4,
        ground: '#7a6a4a', ground2: '#9a8a62', far: '#6a6a58', haze: '#8a8478', ink: '#12120e', accent: '#ffb860', hazeK: 1.1,
      },
    ],
  },
  coruscant: {
    kind: 'coruscant', style: 'hangar', battle: 'THE BATTLE OF CORUSCANT', label: 'Coruscant', horizon: [0.5, 0.54], rain: 0, dust: 0, fog: 0.1, flares: false, lightning: false, fungi: 0,
    places: ['THE HANGAR OF THE INVISIBLE HAND', 'THE INVISIBLE HAND\'S HANGAR BAY'],
    jedi: ['ANAKIN SKYWALKER', 'OBI-WAN KENOBI'], legions: ['501st', '212th'], leaders: ['GENERAL GRIEVOUS', 'COUNT DOOKU'],
    ships: { ga: ['THE GUARLARA', 'THE RESOLUTE', 'THE INTEGRITY'], cf: ['THE INVISIBLE HAND', 'THE LUCID VOICE'] },
    cast: { walkers: false, artillery: false, tanks: false, geonosians: false, wookiees: false, twileks: false, magnaguards: true, tridents: false, crabs: false, coreships: false, speeders: false, spha: false },
    hours: [
      {
        name: 'the hangar\'s light', top: '#02030a', mid: '#060a1c', low: '#2a3048', sun: '#e0e8ff', sunAt: null, sunR: 0, rim: 0.45, lx: -1, ly: 0.7, night: 0.7,
        ground: '#3a3e46', ground2: '#4a4e56', far: '#2a2e36', haze: '#2e3240', ink: '#06070a', accent: '#ffb860', hazeK: 0.7,
      },
      {
        name: 'red alert', top: '#04020a', mid: '#0a0614', low: '#3a1a28', sun: '#ffd0c0', sunAt: null, sunR: 0, rim: 0.5, lx: 1, ly: 0.7, night: 0.8,
        ground: '#3e3436', ground2: '#4e4244', far: '#2e2628', haze: '#3a2830', ink: '#080406', accent: '#ff5040', hazeK: 0.7,
      },
    ],
  },
};

/** The legions of the Grand Army of the Republic: the colour of their markings, their clone commander, their Jedi, and men of theirs. */
export const LEGIONS: Record<string, { name: string; color: string; word: string; commander: string; jedi: string[]; men: string[]; squads: string[] }> = {
  '501st': { name: 'THE 501ST LEGION', color: '#3a78e0', word: 'BLUE', commander: 'CAPTAIN REX', jedi: ['ANAKIN SKYWALKER', 'AHSOKA TANO'], men: ['FIVES', 'ECHO', 'JESSE', 'HARDCASE', 'KIX', 'TUP', 'DOGMA', 'APPO', 'DENAL', 'HEVY'], squads: ['TORRENT COMPANY', 'DOMINO SQUAD', 'BRAVO SQUAD', 'GHOST SQUAD', 'TWILIGHT SQUAD'] },
  '212th': { name: 'THE 212TH ATTACK BATTALION', color: '#e88a2a', word: 'ORANGE', commander: 'COMMANDER CODY', jedi: ['OBI-WAN KENOBI'], men: ['WAXER', 'BOIL', 'CRYS', 'TRAPPER', 'GEARSHIFT', 'LONGSHOT'], squads: ['GHOST COMPANY', 'GREEN COMPANY', 'BLUE COMPANY', 'RED SQUAD'] },
  '327th': { name: 'THE 327TH STAR CORPS', color: '#e8c838', word: 'GOLD', commander: 'COMMANDER BLY', jedi: ['AAYLA SECURA'], men: ['DEVISS', 'GREEZ', 'SHADOW', 'GOLDEN'], squads: ['GOLD COMPANY', 'STAR SQUAD', 'SUN SQUAD'] },
  '104th': { name: 'THE 104TH BATTALION', color: '#8a96a4', word: 'GREY', commander: 'COMMANDER WOLFFE', jedi: ['PLO KOON'], men: ['BOOST', 'SINKER', 'COMET', 'WARTHOG'], squads: ['WOLFPACK', 'HOWL SQUAD', 'FANG SQUAD'] },
  '41st': { name: 'THE 41ST ELITE CORPS', color: '#4aa858', word: 'GREEN', commander: 'COMMANDER GREE', jedi: ['LUMINARA UNDULI', 'YODA'], men: ['FLASH', 'CONTRAIL', 'MOSS', 'BRANCH'], squads: ['SCOUT COMPANY', 'GREEN SQUAD', 'FOREST SQUAD'] },
  '21st': { name: 'THE 21ST NOVA CORPS', color: '#7a8ab8', word: 'STEEL', commander: 'COMMANDER BACARA', jedi: ['KI-ADI-MUNDI'], men: ['JET', 'VAUGHN', 'NOVA'], squads: ['GALACTIC MARINES', 'NOVA SQUAD'] },
  '187th': { name: 'THE 187TH LEGION', color: '#8a5ad8', word: 'VIOLET', commander: 'COMMANDER PONDS', jedi: ['MACE WINDU'], men: ['STONE', 'BLAZE', 'WHIPLASH'], squads: ['VIOLET COMPANY', 'PURPLE SQUAD'] },
};

/** The blade a Jedi carries. */
export const SABERS: Record<string, string> = {
  'ANAKIN SKYWALKER': '#5aa8ff', 'OBI-WAN KENOBI': '#5aa8ff', 'AHSOKA TANO': '#5cff86', 'MACE WINDU': '#b884ff', YODA: '#5cff86',
  'KI-ADI-MUNDI': '#5aa8ff', 'PLO KOON': '#ffd84a', 'LUMINARA UNDULI': '#5cff86', 'KIT FISTO': '#5cff86', 'AAYLA SECURA': '#5aa8ff',
  'SHAAK TI': '#5aa8ff', 'QUINLAN VOS': '#5cff86', 'PONG KRELL': '#5aa8ff',
};
/** Ahsoka and Krell fight with two blades. */
export const TWIN = new Set(['AHSOKA TANO', 'PONG KRELL']);

/** The colours of a bolt by side. */
export const BOLT = { ga: '#58b8ff', cf: '#ff4a38' } as const;
