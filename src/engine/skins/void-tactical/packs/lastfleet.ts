/**
 * The Last Fleet: everyone left alive, moving together, never stopping.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * (ark, flotilla, pursuit, skimming in mechanics/lastfleet.ts) load on their own.
 */
import { registerUniverse, type UniversePack } from '../universe';

export const LASTFLEET_PACK: UniversePack = {
  id: 'lastfleet',
  name: 'The Last Fleet',
  tagline: 'Everyone left alive, moving together, never stopping.',
  palette: '#93c5fd',
  warmth: 0.2,
  colorBy: 'faction',
  ships: { fighter: 'VIPER', scout: 'RAPTOR', freighter: 'TENDER', cruiser: 'ESCORT', carrier: 'CARRIER', capital: 'BATTLESTAR' },
  factions: [
    { name: 'THE FLEET', prefix: 'FLT', color: '#93c5fd', classes: ['freighter', 'scout'], weight: 3 },
    { name: 'ESCORT GROUP', prefix: 'ESC', color: '#e2e8f0', classes: ['fighter', 'cruiser', 'carrier'], weight: 1 },
    { name: 'THE PURSUERS', prefix: 'PUR', color: '#f87171', classes: ['fighter', 'cruiser'], weight: 0 },
  ],
  systemPrefix: 'WAYPOINT',
  structures: [
    { kind: 'nav_beacon', label: 'NAV BEACON', role: 'relay', color: '#93c5fd', rarity: 'common',
      art: ['  |  ', ' -o- ', '  |  '],
      chatter: ['COURSE HOLDS', 'NEXT JUMP · 6 HOURS', 'BEACON LEFT FOR WHOEVER FOLLOWS'] },
    { kind: 'ice_rock', label: 'ICE ROCK', role: 'mine', color: '#bae6fd', rarity: 'common',
      art: [' .--. ', '( ** )', " '--' "],
      chatter: ['WATER · 90 DAYS', 'CUTTERS ON THE ICE', 'HAULING TO THE ARK'] },
    { kind: 'derelict', label: 'DERELICT', role: 'wreck', color: '#94a3b8', rarity: 'uncommon',
      art: [' _ /\\ _ ', '/#\\  /#\\', '  \\_/   '],
      chatter: ['ONE OF OURS', 'NO ONE ANSWERS', 'STRIPPED FOR PARTS'] },
    { kind: 'old_colony', label: 'OLD COLONY', role: 'giant', color: '#fde68a', rarity: 'rare',
      art: ['  .-""-.  ', ' / o  o \\ ', '|  ____  |', " '------' "],
      chatter: ['DARK FOR A CENTURY', 'WE CANNOT STAY', 'LEAVE FLOWERS'] },
  ],
  anomalies: [
    { label: 'JUMP ECHO', style: 'wave' },
    { label: 'GRAVITY SHEAR', style: 'singularity' },
    { label: 'SENSOR GHOST', style: 'temporal' },
    { label: 'RADIATION BELT', style: 'cloud' },
  ],
  chatter: {
    fleet: ['HOLDING STATION', 'ALL HANDS ACCOUNTED', 'WATER RATIONING', 'COURSE LAID IN', 'SPOOLING', 'NEED PARTS', 'CHILDREN ASLEEP', 'KEEP CLOSE'],
    structure: ['COURSE HOLDS', 'WATER · 90 DAYS', 'NO ONE ANSWERS'],
    science: ['NEXT JUMP PLOTTED', 'FUEL MARGIN THIN', 'SIGNAL BEHIND US', 'STARS UNCHARTED'],
    mystery: ['THEY ARE STILL BEHIND US', 'WE WERE A BILLION ONCE', 'THE LIGHTS AT HOME WENT OUT', 'SOMEONE HAS TO REMEMBER'],
    system: ['FLEET STATUS · GREEN', 'CENSUS UPDATED', 'COURSE CORRECTION +0.4°', 'ALL SHIPS REPORT'],
  },
  ambient: ['DAY 2,116', 'KEEP MOVING', 'WE WERE A BILLION ONCE', 'NO ONE IS LEFT BEHIND', 'THEY ARE STILL BEHIND US', 'COUNT THE SOULS', 'HOME IS THE FLEET', 'ONE MORE JUMP'],
  mechanics: [
    { use: 'skimming', with: { every: 2 } },
    { use: 'ark', with: { counters: true, chatter: 1 } },
    { use: 'flotilla', with: { ships: 220, stragglers: 1 } },
    { use: 'pursuit', with: { every: 1.6 } },
  ],
  look: { lanes: 'none', grid: 'none', traffic: 0.25, anomalies: 0.3, depth: 0.55, scenery: 0.4, ground: 'none' },
};

registerUniverse(LASTFLEET_PACK);
