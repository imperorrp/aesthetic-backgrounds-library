/**
 * Hive Bloom: something is growing over the colonies, and it is beautiful.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * (bloom, spores, purge in mechanics/hive.ts) load on their own.
 */
import { registerUniverse, type UniversePack } from '../universe';

export const HIVE_PACK: UniversePack = {
  id: 'hive',
  name: 'Hive Bloom',
  tagline: 'Something is growing over the colonies, and it is beautiful.',
  palette: '#a3e635',
  warmth: -0.1,
  colorBy: 'faction',
  ships: { fighter: 'TORCH', scout: 'SAMPLER', freighter: 'EVAC TRANSPORT', cruiser: 'PURGE CRUISER', carrier: 'ARK TENDER', capital: 'SCOURGE' },
  factions: [
    { name: 'PURGE COMMAND', prefix: 'PRG', color: '#fb923c', classes: ['fighter', 'cruiser', 'capital'], weight: 1 },
    { name: 'COLONIAL AUTHORITY', prefix: 'COL', color: '#e2e8f0', classes: ['freighter', 'scout', 'fighter'], weight: 2 },
    { name: 'EVAC FLOTILLA', prefix: 'EVC', color: '#93c5fd', classes: ['freighter', 'carrier'], weight: 1 },
  ],
  systemPrefix: 'COLONY',
  structures: [
    { kind: 'colony_dome', label: 'COLONY DOME', role: 'dock', color: '#e2e8f0', rarity: 'common',
      art: ['  .---.  ', ' / o o \\ ', '|  o o  |', "'-------'"],
      chatter: ['AIRLOCKS SEALED', 'CREEP AT THE PERIMETER', '400 STILL ABOARD', 'FILTERS CLOGGED', 'DO NOT OPEN THE GARDEN'] },
    { kind: 'hydroponics', label: 'HYDROPONICS', role: 'mine', color: '#4ade80', rarity: 'common',
      art: ['|v|v|v|', '|v|v|v|', "'-----'"],
      chatter: ['YIELD UP 300%', 'THE PLANTS ARE TOO GREEN', 'ROOTS IN THE DUCTS', 'HARVEST SUSPENDED'] },
    { kind: 'quarantine_pylon', label: 'QUARANTINE PYLON', role: 'defense', color: '#facc15', rarity: 'common',
      art: ['  |  ', ' [#] ', ' [#] ', '/___\\'],
      chatter: ['FIELD HOLDING', 'BIOHAZARD LEVEL 4', 'PERIMETER BREACHED · GRID 7', 'STERILIZING'] },
    { kind: 'burn_station', label: 'BURN STATION', role: 'shipyard', color: '#fb923c', rarity: 'uncommon',
      art: [' _/^\\_ ', '|#####|', '|=#=#=|', "'-----'"],
      chatter: ['FUEL GEL LOADED', 'TORCHES ON THE PAD', 'NOZZLES CLEARED', 'LAUNCHING PURGE WING'] },
    { kind: 'research_lab', label: 'RESEARCH LAB', role: 'relay', color: '#67e8f9', rarity: 'uncommon',
      art: ['[o----o]', '|  ~~  |', '[______]'],
      chatter: ['NEW MORPH CATALOGUED', 'SAMPLE 41 IS MOVING', 'IT LEARNS THE WALLS', 'SEND MORE CONTAINERS'] },
    { kind: 'hive_node', label: 'HIVE NODE', role: 'mystery', color: '#e879f9', rarity: 'rare',
      art: ['  .@.  ', ' (@@@) ', '~(@@@)~', "  '@'  "],
      chatter: ['PULSING · 40 BPM', 'IT SMELLS LIKE RAIN', 'THE GARDEN IS SINGING', 'WARMER THAN IT SHOULD BE'] },
    { kind: 'wreck', label: 'BURNED HULK', role: 'wreck', color: '#94a3b8', rarity: 'uncommon',
      art: [' _ /\\ _ ', '/#\\  /#\\', '  \\_/   '],
      chatter: ['SCORCHED · NO BIOSIGNS', 'THE CREEP AVOIDS IT', 'SALVAGE FORBIDDEN'] },
  ],
  anomalies: [
    { label: 'SPORE CLOUD', style: 'cloud', color: '#e879f9' },
    { label: 'BIOSIGN SURGE', style: 'psionic' },
    { label: 'MUTAGEN BLOOM', style: 'exotic' },
    { label: 'NEURAL CHORUS', style: 'psionic' },
    { label: 'PHEROMONE TRAIL', style: 'wave', color: '#a3e635' },
  ],
  chatter: {
    fleet: ['TORCHES LIT', 'FUEL GEL 80%', 'BURN PATTERN DELTA', 'HULL BIOFILM · SCRUBBING', 'SEALS HOLDING', 'NO SURVIVORS IN GRID 4', 'EVAC MANIFEST 400', 'DO NOT LAND'],
    structure: ['AIRLOCKS SEALED', 'CREEP AT THE PERIMETER', 'FILTERS CLOGGED', 'QUARANTINE HOLDING'],
    science: ['GROWTH RATE +12%/H', 'NEW MORPH CATALOGUED', 'SPORE COUNT RISING', 'IT IS LEARNING THE WALLS'],
    mystery: ['IT SMELLS LIKE RAIN', 'THE GARDEN IS SINGING', 'THEY LOOK HAPPY IN THERE', 'DO NOT TOUCH THE FLOWERS'],
    system: ['QUARANTINE BROADCAST', 'PURGE CORRIDOR OPEN', 'BIOHAZARD LEVEL 4', 'EVAC WINDOW 12 MIN'],
  },
  ambient: ['IT IS BEAUTIFUL', 'BURN IT ALL', 'THE COLONY WAS HERE', 'DO NOT BREATHE', 'QUARANTINE ZONE', 'IT GROWS TOWARD LIGHT', 'NOTHING LEAVES', 'SPORE SEASON'],
  mechanics: [
    { use: 'bloom', with: { rate: 1, nodes: 2 } },
    { use: 'spores', with: { every: 22, size: 40 } },
    { use: 'purge', with: { rate: 1.2, scourge: true } },
    { use: 'events', with: { rate: 0.25, flares: false } },
  ],
  look: { lanes: 'curved', grid: 'none', traffic: 0.5, anomalies: 0.5, depth: 0.3, ground: 'mist', groundColor: '#3f6212' },
};

registerUniverse(HIVE_PACK);
