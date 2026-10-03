/**
 * Saltwind Reach: a hard, poor mining frontier at the end of an old road.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * load on their own (see mechanics/index.ts). The library loads it on demand (see `loadUniverse`), so a site that
 * never shows this universe never downloads it.
 */
import { registerUniverse, type UniversePack } from '../universe';

/** A worked example of a hand-written pack: a hard, poor mining frontier. */
export const SALTWIND_PACK: UniversePack = {
  id: 'saltwind',
  name: 'Saltwind Reach',
  tagline: 'Ore, dust, and debt at the end of the old road.',
  palette: '#f59e0b',
  warmth: 0.5,
  colorBy: 'faction',
  ships: { fighter: 'CUTTER', scout: 'PROSPECTOR', freighter: 'ORE HAULER', cruiser: 'WARDEN', carrier: 'TENDER', capital: 'COMPANY BARGE' },
  factions: [
    { name: 'REACH MINING COMBINE', prefix: 'RMC', color: '#f59e0b', classes: ['freighter', 'carrier', 'capital', 'scout'], weight: 3 },
    { name: 'FREE HAULERS', prefix: 'FH', color: '#2dd4bf', classes: ['freighter', 'scout', 'fighter'], weight: 2 },
    { name: 'WARDENS', prefix: 'WRD', color: '#f87171', classes: ['fighter', 'cruiser'], weight: 1 },
  ],
  systemPrefix: 'DEPOT',
  structures: [
    { kind: 'deep_bore', label: 'DEEP BORE', role: 'mine', color: '#fbbf24', rarity: 'common',
      art: ['  _|_  ', ' |###| ', ' |#v#| ', '  \\|/  ', '   V   '],
      chatter: ['SHAFT 6 AT 4.1KM', 'BIT REPLACED · AGAIN', 'ORE GRADE FALLING', 'PUMPS HOLDING', 'NIGHT SHIFT ON'] },
    { kind: 'haulers_rest', label: "HAULER'S REST", role: 'dock', color: '#fcd34d', rarity: 'common',
      art: ['  .===.  ', ' |[] []| ', '=|  +  |=', ' |[] []| ', "  '==='  "],
      chatter: ['BERTHS 2 OF 9 FREE', 'WATER RATIONED', 'FUEL ON CREDIT ONLY', 'NO WEAPONS PAST THE LOCK'] },
    { kind: 'slag_foundry', label: 'SLAG FOUNDRY', role: 'shipyard', color: '#fb923c', rarity: 'common',
      art: [' _|_|_|_ ', '|#######|', '|# [=] #|', "|_______|", ' /     \\ '],
      chatter: ['HULL PLATES POURING', 'CRANE 2 DOWN', 'TENDER ON THE SLIP', 'FURNACE AT 1900C'] },
    { kind: 'toll_buoy', label: 'TOLL BUOY', role: 'relay', color: '#a3e635', rarity: 'common',
      art: ['   o   ', '  /|\\  ', ' /_$_\\ ', '   |   ', "   '   "],
      chatter: ['TOLL 40 CREDITS', 'PAYMENT RECEIVED', 'UNPAID · FLAGGED', 'ROAD OPEN'] },
    { kind: 'warden_picket', label: 'WARDEN PICKET', role: 'defense', color: '#f87171', rarity: 'uncommon',
      art: ['  /^\\  ', ' |=X=| ', '<|===|>', ' |=X=| ', '  \\_/  '],
      chatter: ['PAPERS, PLEASE', 'SCANNING HOLDS', 'CONTRABAND FOUND · BAY 2', 'PICKET HOLDING'] },
    { kind: 'old_road_gate', label: 'OLD ROAD GATE', role: 'gate', color: '#c084fc', rarity: 'uncommon',
      art: ['  .--.  ', ' /    \\ ', '| (  ) |', ' \\    / ', "  '--'  "],
      chatter: ['GATE COLD FOR 9 DAYS', 'ONE SHIP PER HOUR', 'THROAT FLICKERING', 'OLD ROAD STILL OPEN'] },
    { kind: 'cold_hulk', label: 'COLD HULK', role: 'wreck', color: '#94a3b8', rarity: 'uncommon',
      art: ['  ____  ', ' /#  #\\ ', '|# xx #|', "'-#__#-'"],
      chatter: ['STRIPPED TO THE FRAME', 'CLAIM MARKER · FH', 'NO SALVAGE LEFT', 'CREW NEVER FOUND'] },
    { kind: 'cinder_well', label: 'CINDER WELL', role: 'hazard', color: '#ef4444', rarity: 'rare',
      art: [' \\ | / ', '-- @ --', ' / | \\ '],
      chatter: ['FLARE SEASON', 'HULL TEMP RISING', 'KEEP 2 AU CLEAR', 'DUST IGNITING'] },
    { kind: 'singing_rock', label: 'SINGING ROCK', role: 'mystery', color: '#e9d5ff', rarity: 'rare',
      art: ['  ___  ', ' / ~ \\ ', '| ~ ~ |', " \\_~_/ "],
      chatter: ['IT HUMS AT 7HZ', 'SURVEYORS WONT LAND', 'NOT ON ANY CHART', 'THE SONG CHANGED'] },
    { kind: 'the_furnace', label: 'THE FURNACE', role: 'giant', color: '#f97316', rarity: 'legendary',
      art: ['  .-##-.  ', ' /######\\ ', '|##(@@)##|', ' \\######/ ', "  '-##-'  "],
      chatter: ['A STAR, HARNESSED', 'COMBINE PROPERTY', 'OUTPUT SOLD FORWARD', 'WORKERS: 41,000'] },
  ],
  anomalies: [
    { label: 'DUST FRONT', style: 'cloud', color: '#fcd34d' },
    { label: 'MAGNETIC SHEAR', style: 'wave' },
    { label: 'ECHO FROM THE BORE', style: 'psionic' },
    { label: 'PRESSURE BLOOM', style: 'burst' },
    { label: 'CLOCK SKEW · 3 SEC', style: 'temporal' },
    { label: 'GRAVITY KNOT', style: 'singularity' },
    { label: 'ORE THAT MOVES', style: 'exotic' },
    { label: 'FAULT IN THE ROAD', style: 'rift' },
    { label: 'STATIC SQUALL', style: 'cloud' },
    { label: 'FLARE INCOMING', style: 'burst' },
  ],
  chatter: {
    fleet: ['HOLD 92% · RETURNING', 'RUNNING ON FUMES', 'WARDENS ON OUR TAIL', 'PAID THE TOLL', 'CARGO · NICKEL', 'ONE ENGINE OUT', 'CONVOY · KEEP CLOSE', 'BOUND FOR THE REST'],
    structure: ['BERTHS FULL', 'PAYDAY TOMORROW', 'NIGHT SHIFT ON', 'AIR SCRUBBERS SLOW'],
    science: ['DUST DENSITY RISING', 'ORE GRADE 4.2%', 'FLARE INDEX HIGH', 'BELT DRIFTING'],
    mystery: ['LIGHTS ON THE DEAD BELT', 'A SHIP WITH NO REGISTRY', 'SONG ON THE ORE RADIO', 'THE ROCK IS WARM'],
    system: ['COMBINE NET UP', 'CREDIT CHECK PASSED', 'CHART 6 MONTHS OLD', 'NO SIGNAL PAST DEPOT 4'],
  },
  ambient: [
    'NO WATER PAST THE SECOND BELT',
    'COMBINE PAYS ON THE FIRST',
    'WARDENS CHECK EVERY HOLD',
    'THE OLD ROAD IS STILL OPEN',
    'DEBT TRANSFERS TO NEXT OF KIN',
    'SHAFT 6 · 41 DAYS WITHOUT LOSS',
    'DUST SEASON · KEEP SEALED',
    'FREE HAULERS DRINK AT THE REST',
  ],
  mechanics: [
    { use: 'economy', with: { convoys: 4, load: 30 } },
    { use: 'asteroids', with: { density: 1.1, miners: 3, richness: 0.5, strays: 1.2, disputes: 0.4 } },
    { use: 'wardens', with: { buoys: 2, contraband: 0.22, color: '#38bdf8', name: 'WARDEN BUOY' } },
    { use: 'skirmish', with: { rate: 0.8, raiders: 3, weapon: 'tracers', name: 'CLAIM JUMPERS', color: '#f43f5e' } },
    { use: 'storms', with: { rate: 0.6, color: '#c08457', name: 'DUST FRONT' } },
    { use: 'events', with: { rate: 0.8, armada: false, flares: false, surges: false, blowouts: true, shifts: true } },
    { use: 'relays', with: { chatter: 0.35, links: false } },
  ],
  economy: {
    goods: [
      { id: 'ore', label: 'ORE', color: '#f2b45a' },
      { id: 'water', label: 'WATER', color: '#67e8f9' },
      { id: 'rations', label: 'RATIONS', color: '#86efac' },
      { id: 'alloy', label: 'ALLOY', color: '#fb923c' },
    ],
    roles: {
      mine: { cap: 180, makes: { ore: 1.6 } },
      dock: { cap: 200, makes: { water: 0.5, rations: 0.35 }, uses: { ore: 0.25 } },
      giant: { cap: 220, makes: { alloy: 0.45 }, uses: { ore: 0.6 } },
      shipyard: { cap: 160, uses: { alloy: 0.3, ore: 0.2 } },
      defense: { cap: 80, uses: { rations: 0.2, water: 0.15 } },
      relay: { cap: 40, uses: { water: 0.05 } },
    },
  },
  look: { lanes: 'none', grid: 'claims', traffic: 0.7, anomalies: 0.6, ground: 'dust', groundColor: '#c08457' },
};

registerUniverse(SALTWIND_PACK);
