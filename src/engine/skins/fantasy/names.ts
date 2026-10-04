/**
 * The peoples of the fantasy worlds, how they look (sprite kits), how they fight, what
 * they call themselves, and a name generator for their places.
 */
import type { Rng } from '../../rng';
import type { DragonColors, Kit } from './sprites';

export type People = 'kingdom' | 'horde' | 'fey' | 'hollow';

export type Faction = {
  people: People;
  name: string;
  /** Banner color and its shade. */
  color: string;
  dark: string;
  kit: Kit;
  /** What their mages do: 'ward' (holy shields), 'fire', 'storm', 'raise' (the dead). */
  magic: 'ward' | 'fire' | 'storm' | 'raise';
  /** Unit mix: share of archers and of riders, number of mages. */
  archers: number;
  riders: number;
  mages: number;
  /** The war cry in a label. */
  cry: string;
};

const SKINS = ['#e8b48a', '#c98e62', '#8d5a3b', '#f1c9a5', '#a8714a'];

const NAMES: Record<People, string[]> = {
  kingdom: ['THE AZURE CROWN', 'HOUSE VALLOR', 'THE SILVER MARCH', 'THE KINGDOM OF ESTRAND', 'THE LION THRONE', 'HOUSE DARROW'],
  horde: ['THE ASH HOST', 'THE RED MAW CLANS', 'THE IRON TUSK', 'THE BURNT SKY HORDE', 'THE WOLFSWORN'],
  fey: ['THE ELDERWOOD', 'THE COURT OF THORNS', 'THE GREEN SILENCE', 'THE MOONLIT HOST', 'THE ASHEN GROVE'],
  hollow: ['THE HOLLOW LEGION', "THE PALE KING'S DEAD", 'THE BARROW HOST', 'THE GRAVEBORN', 'THE QUIET ARMY'],
};

const COLORS: Record<People, [string, string][]> = {
  kingdom: [
    ['#2563eb', '#1e3a8a'],
    ['#dc2626', '#7f1d1d'],
    ['#ca8a04', '#713f12'],
    ['#f8fafc', '#94a3b8'],
  ],
  horde: [
    ['#b91c1c', '#450a0a'],
    ['#ea580c', '#7c2d12'],
    ['#78350f', '#451a03'],
  ],
  fey: [
    ['#16a34a', '#14532d'],
    ['#0d9488', '#134e4a'],
    ['#a3e635', '#3f6212'],
  ],
  hollow: [
    ['#64748b', '#1e293b'],
    ['#4d7c0f', '#1a2e05'],
    ['#6b21a8', '#2e1065'],
  ],
};

export function makeFaction(people: People, r: Rng, avoid?: string): Faction {
  const pick = <T>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const options = COLORS[people].filter(([c]) => c !== avoid);
  const [color, dark] = pick(options.length ? options : COLORS[people]);
  const name = pick(NAMES[people]);
  const base = { cloth: color, cloth2: dark, wood: '#7c5a3a', leather: '#5b4030', skin: SKINS };
  switch (people) {
    case 'kingdom':
      return {
        people, name, color, dark, magic: 'ward', archers: 0.25, riders: 0.18, mages: 2, cry: 'FOR THE CROWN',
        kit: { ...base, metal: '#cbd5e1', metalDark: '#64748b', mount: pick(['#7c4a2a', '#e7e5e4', '#3f2a1d']), mountDark: '#2a1a10', magic: '#fde68a', helm: pick(['kettle', 'great'] as const), shield: 'kite', rider: 'horse', undead: false },
      };
    case 'horde':
      return {
        people, name, color, dark, magic: 'fire', archers: 0.15, riders: 0.24, mages: 2, cry: 'BLOOD AND ASH',
        kit: { ...base, metal: '#a8a29e', metalDark: '#57534e', leather: '#4a3222', mount: '#78716c', mountDark: '#44403c', magic: '#f97316', helm: 'horned', shield: 'round', rider: 'wolf', undead: false, skin: ['#9a6b4a', '#6d8a52', '#7f6a52'] },
      };
    case 'fey':
      return {
        people, name, color, dark, magic: 'storm', archers: 0.4, riders: 0.14, mages: 3, cry: 'THE WOOD REMEMBERS',
        kit: { ...base, metal: '#d9f99d', metalDark: '#4d7c0f', wood: '#a3a36b', mount: '#a16207', mountDark: '#5b3a0b', magic: '#7dd3fc', helm: 'hood', shield: 'none', rider: 'elk', undead: false, skin: ['#f3e3cf', '#e6cfb4', '#d8b99a'] },
      };
    case 'hollow':
      return {
        people, name, color, dark, magic: 'raise', archers: 0.2, riders: 0.16, mages: 2, cry: 'REST IS FOR THE LIVING',
        kit: { ...base, metal: '#8a7f6c', metalDark: '#4b443a', mount: '#d6d3c4', mountDark: '#57534e', magic: '#4ade80', helm: 'skull', shield: 'round', rider: 'bone', undead: true },
      };
  }
}

export const DRAGONS: DragonColors[] = [
  { body: '#9f1d1d', dark: '#4c0d0d', belly: '#f59e0b', wing: '#7f1d1d', eye: '#fde047' },
  { body: '#1f5f3a', dark: '#0d2a1a', belly: '#bef264', wing: '#14532d', eye: '#fde047' },
  { body: '#27272a', dark: '#09090b', belly: '#f97316', wing: '#3f3f46', eye: '#f97316' },
  { body: '#e2e8f0', dark: '#64748b', belly: '#bae6fd', wing: '#94a3b8', eye: '#38bdf8' },
];

const PRE = ['ASH', 'THORN', 'RAVEN', 'GREY', 'WOLF', 'OAK', 'STONE', 'FROST', 'GOLD', 'MIRE', 'HOLLOW', 'KINGS', 'BLACK', 'WHITE', 'RED', 'ELDER', 'DUN', 'BRYN', 'CAER', 'KEL', 'SALT', 'IRON', 'HART', 'WIND', 'HAWK', 'MOOR', 'ROWAN', 'SWAN'];
const SUF = ['FORD', 'MERE', 'VALE', 'HOLD', 'WICK', 'BARROW', 'HAVEN', 'MOOR', 'FELL', 'STEAD', 'MARCH', 'GATE', 'BRIDGE', 'WATCH', 'CRAG', 'HOLM', 'BY', 'TON', 'WOOD', 'REACH', 'DALE', 'MOUTH', 'WELL'];

/** A place name: GREYFORD, ASHMERE, KINGSBARROW. */
export function placeName(r: Rng): string {
  const a = PRE[Math.floor(r() * PRE.length)];
  let b = SUF[Math.floor(r() * SUF.length)];
  if (a.endsWith(b.slice(0, 1)) && b.length > 2) b = SUF[(SUF.indexOf(b) + 3) % SUF.length];
  return a + b;
}

/** A title-cased version, for prose: Greyford. */
export const titled = (s: string) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

const HEROES = ['SER ALDRIC', 'BRANNA THE RED', 'OSWIN HALFHAND', 'MAEVE OF THE VALE', 'GORRASH', 'THE GREY KNIGHT', 'ILLARIEN', 'THE LANTERN QUEEN', 'KESS IRONSIDE', 'VARGA', 'SER COLM', 'THE NAMELESS'];
export const heroName = (r: Rng) => HEROES[Math.floor(r() * HEROES.length)];

const DRAGON_NAMES = ['VERMITHRAX', 'ASHWING', 'THE GREAT WORM', 'SKARN', 'MOTHER OF CINDERS', 'NIGHTSCALE', 'THE PALE WYRM'];
export const dragonName = (r: Rng) => DRAGON_NAMES[Math.floor(r() * DRAGON_NAMES.length)];
