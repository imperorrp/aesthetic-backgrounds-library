/**
 * The Long Siege: a war that has outlived its reasons.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * load on their own (see mechanics/index.ts). The library loads it on demand (see `loadUniverse`), so a site that
 * never shows this universe never downloads it.
 */
import { registerUniverse, type UniversePack } from '../universe';

/** A third worked example: a war that has outlived its reasons. */
export const SIEGE_PACK: UniversePack = {
  id: 'siege',
  name: 'The Long Siege',
  tagline: 'Forty years on the same front. Neither side remembers why.',
  palette: '#cbd5e1',
  warmth: 0.15,
  colorBy: 'faction',
  ships: { fighter: 'INTERCEPTOR', scout: 'PICKET', freighter: 'SUPPLY TENDER', cruiser: 'LINE CRUISER', carrier: 'CARRIER', capital: 'SIEGE MONITOR' },
  factions: [
    { name: 'THE ASCENDANCY', prefix: 'ASC', color: '#f87171', classes: ['fighter', 'cruiser', 'capital'], weight: 2 },
    { name: 'FREE WORLDS COMPACT', prefix: 'FWC', color: '#60a5fa', classes: ['fighter', 'cruiser', 'carrier'], weight: 2 },
    { name: 'NEUTRAL TRADERS', prefix: 'NT', color: '#a3e635', classes: ['freighter', 'scout'], weight: 1 },
  ],
  systemPrefix: 'SECTOR',
  structures: [
    { kind: 'fire_base', label: 'FIRE BASE', role: 'defense', color: '#fca5a5', rarity: 'common',
      art: [' _/^\\_ ', '[=====]', ' |# #| ', ' |___| '],
      chatter: ['GUNS HOT', 'RELOADING', 'TARGETS DESIGNATED', 'SHELLS LOW'] },
    { kind: 'forward_depot', label: 'FORWARD DEPOT', role: 'dock', color: '#e2e8f0', rarity: 'common',
      art: [' .---. ', '[|###|]', '[|###|]', " '---' "],
      chatter: ['DEPOT AT 30%', 'TENDERS QUEUED', 'MEDICAL BAY FULL', 'RATIONS · 9 DAYS'] },
    { kind: 'orbital_foundry', label: 'ORBITAL FOUNDRY', role: 'shipyard', color: '#fdba74', rarity: 'common',
      art: ['_|_|_|_', '|#####|', '|# = #|', '\\_____/'],
      chatter: ['HULL 212 ON THE SLIP', 'WORKING THREE SHIFTS', 'ARMOR PLATE SHORT', 'LAUNCHING AT DAWN'] },
    { kind: 'fuel_refinery', label: 'FUEL REFINERY', role: 'mine', color: '#fde047', rarity: 'common',
      art: ['  ||   ', ' [##]  ', ' [##]= ', ' [##]  '],
      chatter: ['OUTPUT DOWN 40%', 'PIPELINE HIT', 'TANKS FILLING', 'CONVOY DUE'] },
    { kind: 'long_gate', label: 'LONG GATE', role: 'gate', color: '#c4b5fd', rarity: 'uncommon',
      art: ['  .--.  ', ' / /\\ \\ ', '| |  | |', ' \\ \\/ / ', "  '--'  "],
      chatter: ['GATE UNDER GUARD', 'REINFORCEMENTS INBOUND', 'TRANSIT RESTRICTED'] },
    { kind: 'listening_post', label: 'LISTENING POST', role: 'relay', color: '#93c5fd', rarity: 'common',
      art: ['   ^   ', '  /|\\  ', ' /_|_\\ ', '   |   '],
      chatter: ['ENEMY TRAFFIC UP', 'CODES CHANGED', 'JAMMING ON 4', 'SILENT RUNNING'] },
    { kind: 'wreck_field', label: 'WRECK FIELD', role: 'wreck', color: '#94a3b8', rarity: 'uncommon',
      art: [' _ /\\ _ ', '/#\\  /#\\', '  \\_/   '],
      chatter: ['BOTH FLAGS ON THE HULLS', 'SALVAGE FORBIDDEN', 'NO SURVIVORS'] },
    { kind: 'minefield', label: 'MINEFIELD', role: 'hazard', color: '#f97316', rarity: 'rare',
      art: ['* . * .', '. * . *', '* . * .'],
      chatter: ['DO NOT TRANSIT', 'LAID IN YEAR 9', 'STILL LIVE'] },
    { kind: 'fortress_world', label: 'FORTRESS WORLD', role: 'giant', color: '#fca5a5', rarity: 'legendary',
      art: ['  .-##-.  ', ' /|####|\\ ', '|=|####|=|', ' \\|####|/ ', "  '-##-'  "],
      chatter: ['THE WALL HOLDS', 'GARRISON 2 MILLION', 'NEVER FALLEN'] },
    { kind: 'memorial_beacon', label: 'MEMORIAL BEACON', role: 'mystery', color: '#fef3c7', rarity: 'rare',
      art: ['   |   ', '  -+-  ', '   |   ', '  /_\\  '],
      chatter: ['NAMES: 4,112,009', 'BOTH SIDES SALUTE', 'LIGHT KEPT BURNING'] },
  ],
  anomalies: [
    { label: 'ECHO OF A BATTLE', style: 'psionic' },
    { label: 'GHOST FLEET', style: 'exotic' },
    { label: 'JAMMING FIELD', style: 'cloud' },
    { label: 'CHAFF CLOUD', style: 'cloud' },
    { label: 'RADIATION FRONT', style: 'wave' },
    { label: 'DEAD SIGNAL', style: 'temporal' },
    { label: 'REACTOR BREACH', style: 'burst' },
    { label: 'GRAVITY MINE', style: 'singularity' },
  ],
  chatter: {
    fleet: ['WEAPONS FREE', 'MISSILES AWAY', 'SPLASH ONE', 'TAKING FIRE · DECK 4', 'REARMING', 'HOLD THE LINE', 'COVER THE TENDERS', 'BREAKING LEFT', 'ON YOUR WING', 'DAMAGE CONTROL'],
    structure: ['SHELLS LOW', 'DEPOT AT 30%', 'GUNS HOT', 'CASUALTIES COUNTED'],
    science: ['DEBRIS DENSITY RISING', 'FRONT MOVED 2 KM', 'SIGNAL TRAFFIC +40%', 'ORBITAL DECAY · WRECKS'],
    mystery: ['NOBODY ORDERED THIS', 'FLAGS FROM BOTH SIDES', 'A TRUCE NO ONE SIGNED', 'THE OLD ORDERS STILL RUN'],
    system: ['COMMAND NET UP', 'CODES ROTATED', 'CASUALTY LIST UPDATED', 'STANDING ORDERS · HOLD'],
  },
  ambient: [
    'DAY 14,601 OF THE SIEGE',
    'THE LINE HELD AGAIN',
    'NO ONE CROSSES THE GRAVES',
    'TRUCE EXPIRED AT 0400',
    'BOTH SIDES SALUTE THE BEACON',
    'NEW ORDERS · SAME AS THE OLD',
    'THE FRONT MOVED TWO KILOMETERS',
    'REMEMBER THE NAMES',
  ],
  mechanics: [
    { use: 'front', with: { aggression: 1 } },
    { use: 'artillery', with: { rate: 1.2, paint: 3, shells: 6 } },
    { use: 'duels', with: { every: 1.6 } },
    { use: 'truces', with: { every: 3.5, length: 32 } },
    { use: 'mines', with: { layers: true, chain: 0.85 } },
    { use: 'skirmish', with: { rate: 0.25, raiders: 3, weapon: 'missiles', name: 'COMMANDOS', color: '#f87171' } },
    { use: 'events', with: { rate: 0.3, flares: false } },
  ],
  look: { lanes: 'straight', grid: 'crosses', traffic: 0.45, anomalies: 0.6, ground: 'nebula', groundColor: '#64748b' },
};

registerUniverse(SIEGE_PACK);
