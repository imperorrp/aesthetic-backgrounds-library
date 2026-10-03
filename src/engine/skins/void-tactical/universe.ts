/**
 * Universe packs: everything that makes the sector map belong to one world. Names,
 * factions, ship classes, structures (with their ASCII art and what they do),
 * anomalies, radio chatter, and the faint words in the background.
 *
 * The engine animates; a pack supplies the fiction. Packs are plain JSON, so an AI
 * can write one from a prompt (`universePrompt`) and the result can be pasted in.
 */
import { ASCII_ART } from './renderers/art';

export type ShipClass = 'fighter' | 'scout' | 'freighter' | 'cruiser' | 'carrier' | 'capital';
export type AnomalyStyle = 'wave' | 'rift' | 'singularity' | 'cloud' | 'temporal' | 'burst' | 'psionic' | 'exotic';
export type StructureRole = 'dock' | 'shipyard' | 'mine' | 'gate' | 'relay' | 'defense' | 'giant' | 'wreck' | 'hazard' | 'mystery';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export const SHIP_CLASSES: readonly ShipClass[] = ['fighter', 'scout', 'freighter', 'cruiser', 'carrier', 'capital'];
export const ANOMALY_STYLES: readonly AnomalyStyle[] = ['wave', 'rift', 'singularity', 'cloud', 'temporal', 'burst', 'psionic', 'exotic'];
export const STRUCTURE_ROLES: readonly StructureRole[] = ['dock', 'shipyard', 'mine', 'gate', 'relay', 'defense', 'giant', 'wreck', 'hazard', 'mystery'];
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export type PackFaction = {
  name: string;
  /** Short call-sign prefix for fleet ids, e.g. "FLT" gives "FLT-215". */
  prefix: string;
  color: string;
  /** Classes this faction flies. Defaults to all. */
  classes?: ShipClass[];
  weight?: number;
};

export type PackStructure = {
  /** Stable id; built-in art is used when it matches a built-in kind and `art` is absent. */
  kind: string;
  label: string;
  role: StructureRole;
  color: string;
  rarity: Rarity;
  art: string[];
  /** Status lines shown near this structure. */
  chatter?: string[];
};

export type PackAnomaly = { label: string; style: AnomalyStyle; color?: string };

/** A pre-named fleet, used in order before random ones (data-driven packs). */
export type PackFleet = { name: string; cls: ShipClass; faction?: number };

/** A pre-named star system, used in order as systems stream in. */
export type PackSystem = { name: string; color?: string; size?: number };

export type UniversePack = {
  id: string;
  name: string;
  tagline?: string;
  /** Brand color for the palette (hex) or a built-in palette id. */
  palette?: string;
  /** Key-light warmth, -1 cool to 1 warm. */
  warmth?: number;
  /** Color fleets by ship class (the original look) or by faction. */
  colorBy?: 'class' | 'faction';
  classColors?: Partial<Record<ShipClass, string>>;
  /** Display names for ship classes, e.g. { fighter: 'INTERCEPTOR' }. */
  ships?: Partial<Record<ShipClass, string>>;
  factions: PackFaction[];
  systemPrefix?: string;
  systems?: PackSystem[];
  fleets?: PackFleet[];
  structures: PackStructure[];
  anomalies: PackAnomaly[];
  chatter: { fleet: string[]; structure: string[]; science: string[]; mystery: string[]; system: string[] };
  /** Big faint words drifting in the background. */
  ambient: string[];
  /** Event text templates; `{target}` is replaced by a structure or system name. */
  events?: Partial<Record<'approach' | 'dock' | 'depart' | 'jump' | 'arrive' | 'launch' | 'cargo' | 'survey', string>>;
  /** What happens here: the mechanics this universe runs, with their tuning. */
  mechanics?: { use: string; with?: Record<string, unknown>; enabled?: boolean }[];
  /** How the map itself is drawn. */
  look?: UniverseLook;
};

export type UniverseLook = {
  /** Links between systems: straight data lanes, curved song lines, or none. */
  lanes?: 'straight' | 'curved' | 'none';
  /** Background grid: crosshair marks, survey claim squares, or none. */
  grid?: 'crosses' | 'claims' | 'none';
  /** Ordinary traffic (fleets coming and going), 0 to 2. */
  traffic?: number;
  /** How many anomalies, 0 to 2. */
  anomalies?: number;
};

export const ANOMALY_STYLE_COLORS: Record<AnomalyStyle, string> = {
  wave: '#67e8f9',
  rift: '#e879f9',
  singularity: '#a78bfa',
  cloud: '#5eead4',
  temporal: '#fbbf24',
  burst: '#f87171',
  psionic: '#f472b6',
  exotic: '#bef264',
};

export const DEFAULT_EVENTS: Required<NonNullable<UniversePack['events']>> = {
  approach: 'APPROACHING {target}',
  dock: 'DOCKED @ {target}',
  depart: 'DEPARTING {target}',
  jump: 'JUMP · {target}',
  arrive: 'ARRIVAL VIA {target}',
  launch: 'LAUNCHED FROM {target}',
  cargo: 'CARGO RUN → {target}',
  survey: 'SURVEYING {target}',
};

const art = (kind: keyof typeof ASCII_ART) => ASCII_ART[kind];

/** The original sector map, with its words rewritten to read as one world. */
export const VOID_PACK: UniversePack = {
  id: 'void',
  name: 'The Void Sector',
  tagline: 'A quiet frontier at the edge of charted space.',
  colorBy: 'class',
  classColors: {
    fighter: '#06b6d4',
    scout: '#f59e0b',
    freighter: '#10b981',
    cruiser: '#3b82f6',
    carrier: '#818cf8',
    capital: '#e2e8f0',
  },
  ships: { capital: 'DREADNOUGHT' },
  factions: [{ name: 'SECTOR COMMAND', prefix: 'FLT', color: '#06b6d4' }],
  systemPrefix: 'SYS',
  structures: [
    { kind: 'station', label: 'STATION', role: 'dock', color: '#38bdf8', rarity: 'common', art: art('station'),
      chatter: ['HABITAT RING 98% OCCUPIED', 'LIFE SUPPORT NOMINAL', 'TRADE DOCK BUSY', 'SHUTTLE INBOUND · T-5', 'QUIET HOURS IN EFFECT', 'GRAVITY 1.0G · HOLDING'] },
    { kind: 'mining_outpost', label: 'MINING OUTPOST', role: 'mine', color: '#fbbf24', rarity: 'common', art: art('mining_outpost'),
      chatter: ['DRILL 3 AT 87%', '500T ORE PROCESSED', 'RICH VEIN · SECOND SHAFT', 'BLASTING AT 1400', 'HOLD 75% · AWAITING HAULER', 'DUST FILTERS CYCLING'] },
    { kind: 'comm_buoy', label: 'COMM BUOY', role: 'relay', color: '#a3e635', rarity: 'common', art: art('comm_buoy'),
      chatter: ['RELAY ACTIVE · SECTOR 7', 'KEYS ROTATED', 'PACKET RECEIVED', 'LATENCY 4MS', 'BEACON BROADCASTING', 'QUEUE EMPTY'] },
    { kind: 'shipyard', label: 'SHIPYARD', role: 'shipyard', color: '#60a5fa', rarity: 'common', art: art('shipyard'),
      chatter: ['FRIGATE ON THE SLIP', 'WELDING DRONES OUT', 'HULL ASSEMBLY 45%', 'DRYDOCK OCCUPIED', 'LAUNCH WINDOW OPEN', 'PAINT CREW · BAY 4'] },
    { kind: 'defense_grid', label: 'DEFENSE GRID', role: 'defense', color: '#f87171', rarity: 'uncommon', art: art('defense_grid'),
      chatter: ['TARGETING IDLE', 'PERIMETER CLEAR', 'CAPACITORS FULL', 'IFF ON AUTO', 'INTERCEPTORS STANDING BY', 'POINT DEFENSE CALIBRATED'] },
    { kind: 'jumpgate', label: 'JUMPGATE', role: 'gate', color: '#818cf8', rarity: 'uncommon', art: art('jumpgate'),
      chatter: ['THROAT STABLE', 'NEXT EXIT · SECTOR 9', 'TRANSIT QUEUE 2', 'ANCHORS LOCKED', 'ARRIVAL VECTOR CLEAR', 'STRESS 2% · WITHIN TOLERANCE'] },
    { kind: 'rogue_planet', label: 'ROGUE PLANET', role: 'hazard', color: '#94a3b8', rarity: 'uncommon', art: art('rogue_planet'),
      chatter: ['SURFACE -200C', 'NO STAR TO CALL HOME', 'CORE HEAT FADING', 'ICE SHEETS ADVANCING', 'SILENCE ON ALL BANDS'] },
    { kind: 'derelict_hulk', label: 'DERELICT HULK', role: 'wreck', color: '#94a3b8', rarity: 'uncommon', art: art('derelict_hulk'),
      chatter: ['NO LIFE SIGNS', 'GHOST SIGNAL LOOPING', 'AIRLOCK JAMMED', 'LOGS CORRUPTED', 'SALVAGE RIGHTS CONTESTED', 'INTEGRITY 15%'] },
    { kind: 'neutron_star', label: 'NEUTRON STAR', role: 'hazard', color: '#22d3ee', rarity: 'rare', art: art('neutron_star'),
      chatter: ['SPIN 500HZ', 'RADIATION LETHAL', 'PULSAR BEAM · KEEP CLEAR', 'X-RAY BURST IMMINENT', 'CLOCKS RUNNING SLOW'] },
    { kind: 'void_rift', label: 'VOID RIFT', role: 'mystery', color: '#d946ef', rarity: 'rare', art: art('void_rift'),
      chatter: ['THE TEAR IS HOLDING', 'NULL ZONE GROWING', 'A COLOR WITH NO NAME', 'WHISPERS ON CHANNEL 0', 'CONTAINMENT FAILING', 'DESTINATION UNKNOWN'] },
    { kind: 'black_hole', label: 'BLACK HOLE', role: 'hazard', color: '#7c3aed', rarity: 'rare', art: art('black_hole'),
      chatter: ['HORIZON IN VIEW', 'LIGHT DOES NOT RETURN', 'LENSING ACTIVE', 'ACCRETION DISK HOT', 'TIDAL STRESS EXTREME'] },
    { kind: 'dyson_sphere', label: 'DYSON SPHERE', role: 'giant', color: '#f59e0b', rarity: 'legendary', art: art('dyson_sphere'),
      chatter: ['STAR FULLY ENCLOSED', 'OUTPUT 100%', 'MAINTENANCE SWARM ACTIVE', 'POPULATION · TRILLIONS', 'NIGHT SIDE NEVER ENDS'] },
    { kind: 'ringworld', label: 'RINGWORLD', role: 'giant', color: '#10b981', rarity: 'legendary', art: art('ringworld'),
      chatter: ['SHADOW SQUARES ALIGNED', 'SPIN GRAVITY 1.0G', 'RIM WALLS HOLDING', 'OCEANS TEEMING', '3M EARTHS OF SURFACE'] },
    { kind: 'monolith', label: 'MONOLITH', role: 'mystery', color: '#e2e8f0', rarity: 'legendary', art: art('monolith'),
      chatter: ['ORIGIN UNKNOWN', 'RATIO 1:4:9', 'SIGNAL REPEATING', 'SURFACE PERFECTLY SMOOTH', 'IT IS WAITING'] },
    { kind: 'stellar_lifter', label: 'STELLAR LIFTER', role: 'giant', color: '#ef4444', rarity: 'legendary', art: art('stellar_lifter'),
      chatter: ['SIPHON ACTIVE', 'STAR MASS FALLING', 'MAGNETIC FUNNEL STABLE', 'TANKS FILLING', 'HEAT SHIELDS 90%'] },
    { kind: 'matrioshka_brain', label: 'MATRIOSHKA BRAIN', role: 'giant', color: '#6366f1', rarity: 'legendary', art: art('matrioshka_brain'),
      chatter: ['SIMULATIONS RUNNING', 'SHELLS NESTED · 7', 'THOUGHT AT LIGHT SPEED', 'BILLIONS DREAMING', 'QUESTION RECEIVED'] },
  ],
  anomalies: [
    { label: 'DIMENSIONAL TEAR', style: 'rift' },
    { label: 'GRAVITATIONAL WAVE SURGE', style: 'wave' },
    { label: 'UNKNOWN ENERGY SIGNATURE', style: 'exotic' },
    { label: 'TEMPORAL DISTORTION', style: 'temporal' },
    { label: 'REALITY BREACH', style: 'rift' },
    { label: 'VOID ENTITY MANIFESTING', style: 'psionic' },
    { label: 'QUANTUM FLUCTUATION', style: 'cloud' },
    { label: 'SUBSPACE RUPTURE', style: 'rift' },
    { label: 'ENTROPY CRITICAL', style: 'burst' },
    { label: 'NON-EUCLIDEAN GEOMETRY', style: 'exotic' },
    { label: 'PSIONIC SCREAM', style: 'psionic' },
    { label: 'DATA CORRUPTION', style: 'cloud' },
    { label: 'TIMELINE DIVERGENCE', style: 'temporal' },
    { label: 'CAUSALITY VIOLATION', style: 'temporal' },
    { label: 'ZERO POINT SPIKE', style: 'burst' },
    { label: 'WARP SIGNATURE', style: 'wave' },
    { label: 'SPACE WARPING', style: 'wave' },
    { label: 'EXOTIC MATTER', style: 'exotic' },
    { label: 'HYPERSPACE ECHO', style: 'wave' },
    { label: 'PROBABILITY STORM', style: 'cloud' },
    { label: 'DARK ENERGY SPIKE', style: 'burst' },
    { label: 'CHRONITON PARTICLES', style: 'temporal' },
    { label: 'PHASE VARIANCE', style: 'cloud' },
    { label: 'ANTIMATTER RESONANCE', style: 'burst' },
    { label: 'VOID WHISPERS', style: 'psionic' },
    { label: 'SPACE-TIME FRACTURE', style: 'rift' },
    { label: 'TACHYON BURST', style: 'burst' },
    { label: 'PARALLEL BLEED', style: 'exotic' },
    { label: 'COSMIC STRING', style: 'rift' },
    { label: 'SINGULARITY FORMING', style: 'singularity' },
    { label: 'GRAVITY WELL COLLAPSE', style: 'singularity' },
  ],
  chatter: {
    fleet: ['WEAPONS COLD', 'SHIELDS HARMONIC', 'FTL SPOOLING', 'CLAMPS ENGAGED', 'REFUELING', 'CARGO · ALLOYS', 'PATROL GAMMA-9', 'INTERCEPT PLOTTED', 'RUNNING DARK', 'HULL 100%', 'REQUESTING LANE 4', 'ESCORT IN POSITION'],
    structure: ['DOCKING BAY OPEN', 'REFINERY ACTIVE', 'CARGO TRANSFER 45%', 'MAINTENANCE DUE', 'REACTOR STABLE', 'AIRLOCK CYCLING', 'VISITOR PERMIT GRANTED'],
    science: ['ORBITAL DECAY NEGLIGIBLE', 'RADIATION SPIKE', 'GRAVITY WELL DEEP', 'SPECTRUM · AU/FE', 'TECTONIC SHIFT', 'ATMOSPHERE N2/O2', 'TIME DILATION 0.04%', 'BIOSPHERE PRE-INDUSTRIAL'],
    mystery: ['DISTRESS CALL · NO ORIGIN', 'RUINS SCAN POSITIVE', 'CRYPTIC TRANSMISSION', 'BIOSIGNS ANOMALOUS', 'RELIC WARMING UP', 'DERELICT FOUND', 'SOMETHING ANSWERED', 'THEY ARE WATCHING'],
    system: ['UPLINK ESTABLISHED', 'ENCRYPTION ROTATED', 'DATA STREAM STABLE', 'HANDSHAKE COMPLETE', 'PING 12MS', 'CHART UPDATED'],
  },
  ambient: [
    'PICKET 4 HOLDING · NO CONTACT',
    'BEACON KESTREL HAS GONE DARK',
    'LANE 9 OPEN · TOLL WAIVED',
    'LAST TRANSMISSION 00:41:07 AGO',
    'SALVAGE RIGHTS CONTESTED',
    'QUIET WATCH · ALL STATIONS',
    'CARGO MANIFEST DOES NOT MATCH',
    'DRIFT CORRECTION +0.003°',
    'GRAVE ORBIT · DO NOT HAIL',
    'RELIEF CONVOY SIX HOURS OUT',
    'SECTOR 7-GAMMA-9 · QUARANTINE LIFTED',
    'SOMETHING ANSWERED ON CHANNEL 0',
  ],
  mechanics: [
    { use: 'skirmish', with: { rate: 0.6, raiders: 4, weapon: 'tracers', name: 'RAIDERS' } },
    { use: 'events', with: { rate: 0.6 } },
  ],
  look: { lanes: 'straight', grid: 'crosses', traffic: 1 },
};

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
    { use: 'asteroids', with: { density: 1.1, miners: 3, richness: 0.5 } },
    { use: 'skirmish', with: { rate: 1.1, raiders: 3, weapon: 'tracers', name: 'CLAIM JUMPERS', color: '#f43f5e' } },
    { use: 'storms', with: { rate: 0.6, color: '#c08457', name: 'DUST FRONT' } },
  ],
  look: { lanes: 'none', grid: 'claims', traffic: 0.7, anomalies: 0.6 },
};

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
    fleet: ['FOLLOWING THE NOTE', 'LANTERN LIT', 'WE HEARD IT TOO', 'COURSE SET BY SONG', 'HOLDING FORMATION', 'CARRYING SEEDS', 'MAPPING THE HOLLOW', 'DO NOT LOOK BACK'],
    structure: ['THE SHELL IS WARM', 'VOICES INSIDE', 'DOORS OPEN AT DUSK', 'TIDE OUT'],
    science: ['NO MASS DETECTED', 'LIGHT BENDS INWARD', 'TEMPERATURE 3K', 'THE STAR IS AN ECHO'],
    mystery: ['IT KNOWS OUR NAMES', 'SINGING FROM THE MOUTH', 'A NEW STAR, EMPTY', 'WE HAVE BEEN HERE BEFORE'],
    system: ['CHART REDRAWN', 'CHOIR IN SESSION', 'SILENT HOUR', 'ALL LANTERNS ACCOUNTED'],
  },
  ambient: [
    'WE HEAR YOU',
    'THE CHART HAS CHANGED AGAIN',
    'DO NOT ANSWER THE SPIRE',
    'EVERY STAR HERE IS HOLLOW',
    'THE CHOIR HAS ONE MORE VOICE',
    'LANTERNS OUT AFTER DUSK',
    'COUNT THE CREW AT EVERY GATE',
    'IT WAS ALWAYS SINGING',
  ],
  mechanics: [
    { use: 'song', with: { period: 7, harmonics: 5 } },
    { use: 'flocks', with: { flocks: 3, size: 46, name: 'WISPS' } },
    { use: 'maw', with: { radius: 230, hunger: 0.7 } },
    { use: 'cartography', with: { linger: 60, scouts: 3, changes: 0.9 } },
  ],
  look: { lanes: 'curved', grid: 'none', traffic: 0.35, anomalies: 0.7 },
};

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
    { use: 'warfront', with: { battles: 1.8, mobility: 0.55, bombard: true } },
    { use: 'skirmish', with: { rate: 0.4, raiders: 3, weapon: 'missiles', name: 'COMMANDOS', color: '#f87171' } },
    { use: 'events', with: { rate: 0.4, flares: false } },
  ],
  look: { lanes: 'straight', grid: 'crosses', traffic: 0.45, anomalies: 0.6 },
};

// ---- registry ------------------------------------------------------------------------------

const registry = new Map<string, UniversePack>();
export function registerUniverse(pack: UniversePack): UniversePack {
  registry.set(pack.id, pack);
  return pack;
}
export const getUniverse = (id: string): UniversePack | undefined => registry.get(id);
export const listUniverses = (): UniversePack[] => [...registry.values()];
[VOID_PACK, SALTWIND_PACK, CHOIR_PACK, SIEGE_PACK].forEach(registerUniverse);

// ---- validation --------------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const clean = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, max) : '';
const lines = (v: unknown, max: number, len: number): string[] =>
  Array.isArray(v) ? v.map((x) => clean(x, len)).filter(Boolean).slice(0, max) : [];
const color = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim() : fallback);
const oneOf = <T extends string>(v: unknown, values: readonly T[], fallback: T): T =>
  typeof v === 'string' && (values as readonly string[]).includes(v.toLowerCase()) ? (v.toLowerCase() as T) : fallback;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 32) || 'thing';

/** ASCII art rows: printable ASCII and a few box glyphs only, at most 7 rows by 14 columns. */
function cleanArt(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const rows = v
    .filter((r): r is string => typeof r === 'string')
    .map((r) => r.replace(/[^\x20-\x7e·°∿~]/g, ' ').slice(0, 14).replace(/\s+$/, ''))
    .slice(0, 7);
  while (rows.length && !rows[0].trim()) rows.shift();
  while (rows.length && !rows[rows.length - 1].trim()) rows.pop();
  return rows;
}

export type UniverseValidation = { pack: UniversePack; errors: string[]; warnings: string[] };

/**
 * Turn untrusted JSON (for example, what an AI returned) into a usable pack. Never
 * throws: problems become `errors` (the pack is unusable) or `warnings` (a default
 * was substituted).
 */
export function validateUniverse(raw: unknown): UniverseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let input = raw;
  if (typeof input === 'string') {
    const text = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try {
      input = JSON.parse(text);
    } catch {
      return { pack: VOID_PACK, errors: ['Not valid JSON. Paste only the JSON object the AI returned.'], warnings };
    }
  }
  if (!input || typeof input !== 'object') return { pack: VOID_PACK, errors: ['Expected a JSON object.'], warnings };
  const r = input as Record<string, any>;

  const name = clean(r.name, 40) || 'UNNAMED UNIVERSE';
  const factions: PackFaction[] = (Array.isArray(r.factions) ? r.factions : []).slice(0, 5).map((f: any, i: number) => ({
    name: clean(f?.name, 28) || `FACTION ${i + 1}`,
    prefix: clean(f?.prefix, 4).replace(/[^A-Z0-9]/g, '') || `F${i + 1}`,
    color: color(f?.color, ['#22d3ee', '#f59e0b', '#a78bfa', '#4ade80', '#f87171'][i]),
    classes: Array.isArray(f?.classes) ? f.classes.map((c: unknown) => oneOf(c, SHIP_CLASSES, 'fighter')) : undefined,
    weight: typeof f?.weight === 'number' && f.weight > 0 ? Math.min(10, f.weight) : 1,
  }));
  if (!factions.length) {
    warnings.push('No factions; using one default faction.');
    factions.push({ name: 'UNKNOWN', prefix: 'UNK', color: '#22d3ee' });
  }

  const seen = new Set<string>();
  const structures: PackStructure[] = (Array.isArray(r.structures) ? r.structures : []).slice(0, 24).flatMap((s: any) => {
    const label = clean(s?.label ?? s?.name, 24);
    if (!label) return [];
    let kind = slug(typeof s?.kind === 'string' ? s.kind : label);
    while (seen.has(kind)) kind += '_';
    seen.add(kind);
    const builtIn = (ASCII_ART as Record<string, string[]>)[kind];
    const artRows = cleanArt(s?.art);
    return [{
      kind,
      label,
      role: oneOf(s?.role, STRUCTURE_ROLES, 'dock'),
      color: color(s?.color, '#94a3b8'),
      rarity: oneOf(s?.rarity, RARITIES, 'common'),
      art: artRows.length ? artRows : builtIn ?? ['  ___  ', ' |   | ', ' | o | ', ' |___| '],
      chatter: lines(s?.chatter, 10, 30),
    }];
  });
  if (!structures.length) errors.push('No structures. A universe needs at least a dock, a shipyard, a mine, and a gate.');
  for (const role of ['dock', 'shipyard', 'mine'] as const) {
    if (structures.length && !structures.some((s) => s.role === role)) warnings.push(`No "${role}" structure; ships will have fewer places to go.`);
  }

  const anomalies: PackAnomaly[] = (Array.isArray(r.anomalies) ? r.anomalies : []).slice(0, 40).flatMap((a: any) => {
    const label = clean(typeof a === 'string' ? a : a?.label, 28);
    if (!label) return [];
    const style = oneOf(typeof a === 'string' ? undefined : a?.style, ANOMALY_STYLES, ANOMALY_STYLES[label.length % ANOMALY_STYLES.length]);
    return [{ label, style, color: typeof a === 'object' && a?.color ? color(a.color, ANOMALY_STYLE_COLORS[style]) : undefined }];
  });
  if (!anomalies.length) warnings.push('No anomalies; the map will have none.');

  const c = r.chatter && typeof r.chatter === 'object' ? r.chatter : {};
  const chatter = {
    fleet: lines(c.fleet, 24, 30),
    structure: lines(c.structure, 24, 30),
    science: lines(c.science, 24, 30),
    mystery: lines(c.mystery, 24, 30),
    system: lines(c.system, 24, 30),
  };
  for (const [k, v] of Object.entries(chatter)) if (!v.length) warnings.push(`No "${k}" chatter.`);

  const ambient = lines(r.ambient, 16, 38);
  if (!ambient.length) warnings.push('No ambient lines; the background words will be blank.');

  const ships: UniversePack['ships'] = {};
  if (r.ships && typeof r.ships === 'object') {
    for (const k of SHIP_CLASSES) {
      const v = clean(r.ships[k], 16);
      if (v) ships[k] = v;
    }
  }

  const pack: UniversePack = {
    id: slug(typeof r.id === 'string' ? r.id : name).replace(/_/g, '-'),
    name,
    tagline: typeof r.tagline === 'string' ? r.tagline.slice(0, 90) : undefined,
    palette: typeof r.palette === 'string' && (HEX.test(r.palette.trim()) || /^[a-z-]+$/.test(r.palette)) ? r.palette.trim() : undefined,
    warmth: typeof r.warmth === 'number' ? Math.max(-1, Math.min(1, r.warmth)) : undefined,
    colorBy: r.colorBy === 'class' ? 'class' : 'faction',
    classColors: r.classColors && typeof r.classColors === 'object'
      ? Object.fromEntries(SHIP_CLASSES.flatMap((k) => (typeof r.classColors[k] === 'string' && HEX.test(r.classColors[k]) ? [[k, r.classColors[k]]] : [])))
      : undefined,
    ships,
    factions,
    systemPrefix: clean(r.systemPrefix, 8) || 'SYS',
    systems: Array.isArray(r.systems)
      ? r.systems.slice(0, 60).flatMap((s: any) => {
          const n = clean(typeof s === 'string' ? s : s?.name, 18);
          return n ? [{ name: n, color: s?.color ? color(s.color, '#ffd700') : undefined, size: typeof s?.size === 'number' ? s.size : undefined }] : [];
        })
      : undefined,
    fleets: Array.isArray(r.fleets)
      ? r.fleets.slice(0, 60).flatMap((f: any) => {
          const n = clean(f?.name, 22);
          if (!n) return [];
          const faction = typeof f?.faction === 'number' && f.faction >= 0 && f.faction < factions.length ? Math.floor(f.faction) : undefined;
          return [{ name: n, cls: oneOf(f?.cls, SHIP_CLASSES, 'fighter'), faction }];
        })
      : undefined,
    structures: structures.length ? structures : VOID_PACK.structures,
    anomalies,
    chatter,
    ambient,
    events: r.events && typeof r.events === 'object'
      ? Object.fromEntries(Object.entries(r.events).flatMap(([k, v]) => (k in DEFAULT_EVENTS && typeof v === 'string' ? [[k, clean(v, 30)]] : [])))
      : undefined,
    // Mechanic ids are checked against the registry when the world starts; unknown ones are skipped.
    mechanics: Array.isArray(r.mechanics)
      ? r.mechanics.slice(0, 12).flatMap((m: any) => {
          const use = typeof m === 'string' ? m : m?.use;
          if (typeof use !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(use)) return [];
          return [{ use, with: m?.with && typeof m.with === 'object' ? m.with : undefined, enabled: m?.enabled === false ? false : undefined }];
        })
      : undefined,
    look: r.look && typeof r.look === 'object'
      ? {
          lanes: oneOf(r.look.lanes, ['straight', 'curved', 'none'] as const, 'straight'),
          grid: oneOf(r.look.grid, ['crosses', 'claims', 'none'] as const, 'crosses'),
          traffic: typeof r.look.traffic === 'number' ? Math.max(0, Math.min(2, r.look.traffic)) : undefined,
          anomalies: typeof r.look.anomalies === 'number' ? Math.max(0, Math.min(2, r.look.anomalies)) : undefined,
        }
      : undefined,
  };
  return { pack, errors, warnings };
}

/** Resolve the pack for a mount: an inline pack object wins over a registered id. */
export function resolveUniverse(options: { universe?: unknown; pack?: unknown } | undefined): UniversePack {
  const inline = options?.pack;
  if (inline && typeof inline === 'object') {
    const { pack, errors } = validateUniverse(inline);
    if (!errors.length) return pack;
  }
  if (typeof options?.universe === 'string') return getUniverse(options.universe) ?? VOID_PACK;
  return VOID_PACK;
}

// ---- the prompt ------------------------------------------------------------------------------

/** A mechanic as the prompt describes it. */
export type PromptMechanic = { id: string; description: string; params: string[] };

/**
 * A prompt to paste into any capable AI. It returns a universe pack for `subject`
 * (a book, a film, a game, a TTRPG setting, or a few lines about your own world).
 * Pass the registered mechanics so the AI can choose what happens there.
 */
export function universePrompt(subject: string, mechanics: PromptMechanic[] = []): string {
  const what = subject.trim() || 'an original setting of your choice';
  const menu = mechanics.map((m) => `  ${m.id}: ${m.description} (params: ${m.params.join(', ')})`).join('\n');
  return `Write a universe pack (JSON) for a living tactical star map of: ${what}.
Write it as the instrument its inhabitants would use: their names, factions, places, terse radio talk. Specific, never generic. Not space-faring? Translate (kingdoms → factions, cities → docks).

Return only JSON:
- id, name, tagline, palette (hex), warmth (-1 cold..1 warm)
- ships: display names for fighter, scout, freighter, cruiser, carrier, capital
- factions: 2-4 {name, prefix (2-4 letters), color (hex, bright), classes}
- systemPrefix (≤8 chars)
- structures: 10-14 {label, role, color, rarity, art, chatter (4-6 lines)}. role: dock|shipyard|mine|gate|relay|defense|giant|wreck|hazard|mystery (include dock, shipyard, mine, gate). art: 3-6 rows of plain ASCII, ≤12 chars, bold silhouette.
- anomalies: 10-16 {label, style: wave|rift|singularity|cloud|temporal|burst|psionic|exotic}
- chatter: {fleet, structure, science, mystery, system}, 8-12 lines each, ≤30 chars
- ambient: 8-12 haunting fragments, ≤34 chars
- mechanics: 2-4 of what HAPPENS here, as {use, with:{params}}. This is what makes the world feel different, so choose for the story:
${menu || '  (see the studio for the list)'}
- look: {lanes: straight|curved|none, grid: crosses|claims|none, traffic 0-2, anomalies 0-2}
All text uppercase.`;
}
