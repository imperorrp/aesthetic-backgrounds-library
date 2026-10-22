/**
 * The battlefields: where a seed's battle is fought, and how its light falls. DOM-free: the sim
 * reads the names and the weather, the painter reads the light.
 *
 * Five kinds of field, each with two hours: the arena plains under spires (a red sunset, or the
 * violet dusk after it), a city of crystal towers (deep night, or the teal before dawn), a jungle at
 * night (moonlit, or a murky green dusk), a platform on an ocean world in a storm (grey day, or a
 * black night), and a canyon with a walled city (gold morning, or a red afternoon).
 */
export type FieldKind = 'arena' | 'crystal' | 'jungle' | 'platform' | 'canyon';

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

export type FieldDef = {
  kind: FieldKind; label: string; places: string[]; hours: FieldLight[];
  /** The horizon, as a fraction of the world's height. */
  horizon: [number, number];
  /** The weather it has: rain, blowing dust, ground fog, illumination flares at night. */
  rain: number; dust: number; fog: number; flares: boolean; lightning: boolean;
};

export const FIELDS: Record<FieldKind, FieldDef> = {
  arena: {
    kind: 'arena', label: 'the arena plains', horizon: [0.46, 0.52], rain: 0, dust: 0.35, fog: 0, flares: false, lightning: false,
    places: ['THE ARENA PLAINS OF KESSARA', 'THE SPIRE FIELDS OF ODRANTH', 'THE RED BASIN OF TOLLUM', 'THE PILLARS OF VASH-ANNUR', 'THE FURNACE PLAIN OF IREK'],
    hours: [
      {
        name: 'a red sunset', top: '#3a2a4e', mid: '#c4583a', low: '#ffb060', sun: '#ffc070', sunAt: [0.72, 0.8], sunR: 46, rim: 1, lx: 1, ly: 0.18, night: 0.15,
        ground: '#a8603a', ground2: '#c88450', far: '#c87a50', haze: '#e89a68', ink: '#2a1418', accent: '#ffb070', hazeK: 1,
      },
      {
        name: 'the violet dusk', top: '#1c1834', mid: '#5a3456', low: '#d06a4a', sun: '#ff8a50', sunAt: [0.24, 0.96], sunR: 54, rim: 0.7, lx: -1, ly: 0.1, night: 0.5,
        ground: '#6a3c36', ground2: '#8a5040', far: '#7a4a4a', haze: '#a05a54', ink: '#160c14', accent: '#ff9a60', hazeK: 1,
      },
    ],
  },
  crystal: {
    kind: 'crystal', label: 'the crystal city', horizon: [0.5, 0.56], rain: 0, dust: 0, fog: 0.25, flares: true, lightning: false,
    places: ['THE GLASS CITY OF VELLUN', 'THE CRYSTAL TOWERS OF ISSARAN', 'THE PRISM QUARTER OF AUREL', 'THE SHARD CITY OF NEMORA'],
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
  jungle: {
    kind: 'jungle', label: 'the night jungle', horizon: [0.44, 0.5], rain: 0.3, dust: 0, fog: 0.6, flares: true, lightning: false,
    places: ['THE NIGHT JUNGLE OF MORRAH', 'THE FEN-WOODS OF TAKKAR', 'THE FUNGUS FORESTS OF ULLO', 'THE DROWNED WOODS OF SESKA'],
    hours: [
      {
        name: 'a moonlit night', top: '#020806', mid: '#0a1c18', low: '#1c3a30', sun: '#c8e8d0', sunAt: [0.78, 0.2], sunR: 26, rim: 0.4, lx: 1, ly: 0.55, night: 1,
        ground: '#1a2c1c', ground2: '#26402a', far: '#142a22', haze: '#1e3a30', ink: '#020604', accent: '#7aff9a', hazeK: 1.15,
      },
      {
        name: 'a murky dusk', top: '#0e1410', mid: '#2a3a26', low: '#6a7040', sun: '#d8c070', sunAt: [0.3, 0.82], sunR: 34, rim: 0.5, lx: -1, ly: 0.15, night: 0.7,
        ground: '#2a3420', ground2: '#3a4a2a', far: '#2a3626', haze: '#4a5636', ink: '#060804', accent: '#c8ff70', hazeK: 1.15,
      },
    ],
  },
  platform: {
    kind: 'platform', label: 'the storm platforms', horizon: [0.5, 0.55], rain: 1, dust: 0, fog: 0.2, flares: false, lightning: true,
    places: ['THE TIDE STATION OF ORRUN', 'THE STORM PLATFORMS OF HALLIS DEEP', 'THE SEA-CITY OF VEREN', 'THE STILT CITY OF MARROW SOUND'],
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
  canyon: {
    kind: 'canyon', label: 'the walled canyon', horizon: [0.44, 0.5], rain: 0, dust: 0.25, fog: 0.1, flares: false, lightning: false,
    places: ['THE WALLED CITY OF ZAREKH', 'THE CANYON OF THE ASH RIVER', 'THE GATES OF KHEMMA', 'THE CLIFF CITY OF TALOSSA'],
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
};

/** The legions of the Grand Army: a name, the colour of their markings, and a word for it. */
export const LEGIONS: { name: string; color: string; word: string }[] = [
  { name: 'THE 417TH LEGION', color: '#3a78e0', word: 'BLUE' },
  { name: 'THE 88TH STORM CORPS', color: '#e88a2a', word: 'AMBER' },
  { name: 'THE 230TH ASSAULT BATTALION', color: '#e8c838', word: 'GOLD' },
  { name: 'THE 61ST MOUNTAIN CORPS', color: '#4aa858', word: 'GREEN' },
  { name: 'THE 9TH SHOCK LEGION', color: '#d83a34', word: 'RED' },
  { name: 'THE 304TH RANGERS', color: '#8a5ad8', word: 'VIOLET' },
  { name: 'THE 55TH SIEGE BATTALION', color: '#3ab8b8', word: 'TEAL' },
];

/** The colours of a bolt by side, and of the knights' blades. */
export const BOLT = { ga: '#58b8ff', cf: '#ff4a38' } as const;
export const BLADES = ['#5aa8ff', '#5cff86', '#ffe04a', '#b884ff', '#5aa8ff', '#5cff86'];
