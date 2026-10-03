/**
 * Choir of Hollow Stars: every star here was emptied, and something lives inside.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * load on their own (see mechanics/index.ts). The library loads it on demand (see `loadUniverse`), so a site that
 * never shows this universe never downloads it.
 */
import { registerUniverse, type UniversePack } from '../universe';

/** A second worked example: something older and stranger. */
export const CHOIR_PACK: UniversePack = {
  id: 'choir',
  name: 'Choir of Hollow Stars',
  tagline: 'Every star here was emptied, and something lives inside.',
  palette: '#a78bfa',
  warmth: -0.4,
  colorBy: 'faction',
  ships: { fighter: 'WISP', scout: 'LANTERN', freighter: 'CARRIER-SEED', cruiser: 'CANTOR', carrier: 'CRADLE SHIP', capital: 'CATHEDRAL' },
  factions: [
    { name: 'THE CHOIR', prefix: 'CHR', color: '#c4b5fd', classes: ['fighter', 'cruiser', 'capital', 'carrier'], weight: 2 },
    { name: 'CARTOGRAPHERS', prefix: 'CRT', color: '#67e8f9', classes: ['scout', 'freighter'], weight: 2 },
    { name: 'THE QUIET', prefix: 'QT', color: '#f9a8d4', classes: ['scout', 'fighter'], weight: 1 },
  ],
  systemPrefix: 'HOLLOW',
  structures: [
    { kind: 'listening_spire', label: 'LISTENING SPIRE', role: 'relay', color: '#a5f3fc', rarity: 'common',
      art: ['   |   ', '  /|\\  ', ' / | \\ ', '  )|(  ', "  '|'  "],
      chatter: ['LISTENING', 'SIGNAL IS A VOICE', 'NO REPLY SENT', 'DO NOT ANSWER'] },
    { kind: 'tide_pool', label: 'TIDE POOL', role: 'dock', color: '#7dd3fc', rarity: 'common',
      art: ['  .~~~.  ', ' ( ~ ~ ) ', '(~ ~ ~ ~)', ' ( ~ ~ ) ', "  '~~~'  "],
      chatter: ['WARM WATER', 'SHIPS SLEEPING', 'THE POOL REMEMBERS', 'TIDE IN'] },
    { kind: 'cradle', label: 'CRADLE', role: 'shipyard', color: '#c4b5fd', rarity: 'common',
      art: ['  \\ | /  ', ' --(o)-- ', '  /(.)\\  ', ' ( (.) ) ', "  '---'  "],
      chatter: ['A SHIP IS GROWING', 'SHELL HARDENING', 'IT TURNED TOWARD US', 'BIRTH IN 3 CYCLES'] },
    { kind: 'seed_vault', label: 'SEED VAULT', role: 'mine', color: '#86efac', rarity: 'common',
      art: ['  ___  ', ' /o o\\ ', '|o o o|', ' \\o_o/ '],
      chatter: ['SEEDS COUNTED', 'ONE IS MISSING', 'COLD STORAGE HOLDING', 'HARVEST READY'] },
    { kind: 'bone_gate', label: 'BONE GATE', role: 'gate', color: '#e9d5ff', rarity: 'uncommon',
      art: ['  )   (  ', ' ) .-. ( ', ')  | |  (', ' ) \'-\' ( ', '  )   (  '],
      chatter: ['THE GATE IS BREATHING', 'PASSAGE GRANTED', 'IT ASKED A QUESTION', 'COUNT YOUR CREW'] },
    { kind: 'warden_choir', label: 'CHOIR WARD', role: 'defense', color: '#f0abfc', rarity: 'uncommon',
      art: ['  * * *  ', ' *  |  * ', '*  -+-  *', ' *  |  * ', '  * * *  '],
      chatter: ['HOLDING THE NOTE', 'HARMONY UNBROKEN', 'INTRUDER · SILENCED', 'ALL VOICES PRESENT'] },
    { kind: 'calcified_ship', label: 'CALCIFIED SHIP', role: 'wreck', color: '#cbd5e1', rarity: 'uncommon',
      art: ['   __    ', ' _/##\\_  ', '<_#  #_> ', "  \\__/   "],
      chatter: ['TURNED TO STONE', 'CREW STILL ABOARD', 'DO NOT TOUCH', 'IT WAS ONE OF OURS'] },
    { kind: 'the_mouth', label: 'THE MOUTH', role: 'hazard', color: '#818cf8', rarity: 'rare',
      art: ['  .---.  ', ' / ::: \\ ', '| :(o): |', ' \\ ::: / ', "  '---'  "],
      chatter: ['IT IS OPEN', 'STARS GO IN', 'NOTHING COMES OUT', 'KEEP SINGING'] },
    { kind: 'standing_stone', label: 'STANDING STONE', role: 'mystery', color: '#fde68a', rarity: 'rare',
      art: ['  ___  ', ' |   | ', ' | O | ', ' |   | ', ' |___| '],
      chatter: ['OLDER THAN THE STARS', 'IT FACES US', 'CARVINGS CHANGED', 'COUNTING DOWN'] },
    { kind: 'hollow_star', label: 'HOLLOW STAR', role: 'giant', color: '#a78bfa', rarity: 'legendary',
      art: ['   .----.   ', '  / .--. \\  ', ' | /    \\ | ', ' | \\    / | ', "  \\ '--' /  ", "   '----'   "],
      chatter: ['EMPTY INSIDE', 'A CITY IN THE SHELL', 'LIGHT FROM WITHIN', 'THE CHOIR LIVES HERE'] },
  ],
  anomalies: [
    { label: 'A SECOND HEARTBEAT', style: 'psionic' },
    { label: 'HYMN ON ALL CHANNELS', style: 'wave' },
    { label: 'STARS MISSING FROM CHART', style: 'singularity' },
    { label: 'THE SAME HOUR TWICE', style: 'temporal' },
    { label: 'SOMETHING WOKE', style: 'burst' },
    { label: 'A DOOR IN SPACE', style: 'rift' },
    { label: 'MEMORY FOG', style: 'cloud' },
    { label: 'A NAME WE DO NOT KNOW', style: 'exotic' },
    { label: 'SILENCE, SUDDENLY', style: 'wave' },
    { label: 'THE CHART HAS CHANGED', style: 'cloud' },
  ],
  chatter: {
    fleet: ['FOLLOWING THE NOTE', 'LANTERN LIT', 'WE HEARD IT TOO', 'COURSE SET BY SONG', 'CREW COUNT IS WRONG', 'CARRYING SEEDS', 'SOMETHING IS PACING US', 'DO NOT LOOK BACK', 'ONE MORE ABOARD THAN LEFT', 'HULL IS WARM'],
    structure: ['THE SHELL IS WARM', 'VOICES INSIDE', 'DOORS OPEN AT DUSK', 'IT BREATHES IN', 'WE DID NOT BUILD THIS'],
    science: ['NO MASS DETECTED', 'LIGHT BENDS INWARD', 'TEMPERATURE 3K', 'THE STAR IS AN ECHO', 'SPECTRUM: TEETH', 'PARALLAX IS NEGATIVE'],
    mystery: ['IT KNOWS OUR NAMES', 'SINGING FROM THE MOUTH', 'A NEW STAR, EMPTY', 'WE HAVE BEEN HERE BEFORE', 'IT OPENED AN EYE', 'THE DARK HAS A SHAPE'],
    system: ['CHART REDRAWN', 'CHOIR IN SESSION', 'SILENT HOUR', 'A STAR WENT OUT', 'ALL LANTERNS ACCOUNTED'],
  },
  ambient: [
    'WE HEAR YOU',
    'THE CHART HAS CHANGED AGAIN',
    'DO NOT ANSWER THE SPIRE',
    'EVERY STAR HERE IS HOLLOW',
    'THE CHOIR HAS ONE MORE VOICE',
    'IT HAS NO NAME AND IT IS LISTENING',
    'WE WERE NEVER THE FIRST TO SING',
    'DO NOT COUNT THE EYES',
    'THE STARS ARE NOT WHERE WE LEFT THEM',
    'IT WAS ALWAYS SINGING',
  ],
  mechanics: [
    { use: 'song', with: { period: 7, harmonics: 5, cascade: 6 } },
    { use: 'flocks', with: { flocks: 3, size: 46, name: 'WISPS' } },
    { use: 'maw', with: { radius: 230, hunger: 0.7, tendrils: 4 } },
    { use: 'leviathans', with: { every: 70, size: 1, color: '#c4b5fd', glow: '#67e8f9', name: 'LEVIATHAN' } },
    { use: 'cradles', with: { every: 32, growth: 22 } },
    { use: 'echoes', with: { every: 50, radius: 240, lag: 9 } },
    { use: 'cartography', with: { linger: 60, scouts: 3, changes: 0.7 } },
    { use: 'restless', with: { words: 3, alpha: 0.06 } },
    { use: 'dread', with: { starsOut: 0.35 } },
  ],
  look: { lanes: 'curved', grid: 'none', traffic: 0.35, anomalies: 0.7, depth: 0.22, ground: 'mist', groundColor: '#7c6bd6' },
};

registerUniverse(CHOIR_PACK);
