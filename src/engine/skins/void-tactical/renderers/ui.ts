/**
 * UI Rendering Module
 *
 * @description Rendering functions for user interface overlays (tactical displays, telemetry).
 * Includes enhanced sector network visualization with increased opacity for better visibility.
 * @module
 */

import type { SimSettings, SystemState, TacticalElement, StarSystem } from '../types';
import { accentRgba, WORLD_SPEED_MULTIPLIER, type CanvasContext } from './utils';
import { shouldShowTelemetry } from '../labels';

// --- System Network Visualization ---
export const renderSystemConnections = (
  ctx: CanvasContext,
  systems: StarSystem[],
  camera: { x: number, y: number },
  viewport: { width: number, height: number }
) => {
  const parallax = 0.25 * WORLD_SPEED_MULTIPLIER;
  const points = systems.map(sys => ({
    x: sys.x - camera.x * parallax,
    y: sys.y - camera.y * parallax
  })).filter(p => p.x > -100 && p.x < viewport.width + 100);

  if (points.length < 2) return;

  // Pulse animation
  const alpha = 0.3 + Math.sin(Date.now() * 0.003) * 0.2; // range approx 0.1 to 0.5
  ctx.strokeStyle = accentRgba(alpha);
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 800) {
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
      }
    }
  }
  ctx.stroke();

  // draw nodes
  ctx.fillStyle = accentRgba(Math.min(1, alpha * 1.5));
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
};

// --- Sector Network Visualization ---
export const renderSectorConnections = (
  ctx: CanvasContext,
  camera: { x: number, y: number },
  viewport: { width: number, height: number }
) => {
  const sectorSize = 2000; // Distance between sector centers
  const parallax = 0.15 * WORLD_SPEED_MULTIPLIER; // Slower than systems
  const maxDistance = sectorSize * 1.5; // Connect nearby sectors

  // Generate sector points in view
  const points: { x: number, y: number }[] = [];
  const startX = Math.floor((camera.x * parallax - viewport.width / 2) / sectorSize) * sectorSize;
  const endX = Math.ceil((camera.x * parallax + viewport.width / 2) / sectorSize) * sectorSize;
  const startY = Math.floor((camera.y * parallax - viewport.height / 2) / sectorSize) * sectorSize;
  const endY = Math.ceil((camera.y * parallax + viewport.height / 2) / sectorSize) * sectorSize;

  for (let x = startX; x <= endX; x += sectorSize) {
    for (let y = startY; y <= endY; y += sectorSize) {
      const screenX = x - camera.x * parallax;
      const screenY = y - camera.y * parallax;
      if (screenX > -100 && screenX < viewport.width + 100 &&
          screenY > -100 && screenY < viewport.height + 100) {
        points.push({ x: screenX, y: screenY });
      }
    }
  }

  if (points.length < 2) return;

  // Static alpha for sector lines (not pulsing)
  ctx.strokeStyle = accentRgba(0.25);
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();

  // Randomly connect sectors
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxDistance) {
        // Use position-based "random" for deterministic connections
        const seed = (points[i].x + points[i].y + points[j].x + points[j].y) % 1000;
        if (seed < 300) { // Connect ~30% of possible pairs
          ctx.moveTo(points[i].x, points[i].y);
          ctx.lineTo(points[j].x, points[j].y);
        }
      }
    }
  }
  ctx.stroke();

  // draw nodes
  ctx.fillStyle = accentRgba(0.4);
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); // Slightly larger
    ctx.fill();
  });
};

// --- NARRATIVE DATA ---
const TACTICAL_TEXTS = {
  // Grand Strategy / Empire Management
  STRATEGY: [
    "MINERAL QUOTA: EXCEEDED", "TAX REVENUE: CALCULATING", "SECTOR STABILITY: 99.4%", 
    "MOBILIZATION ORDER: PENDING", "TRADE ROUTE: SECURED", "HEGEMONY INDEX: RISING", 
    "POPULATION METRICS: OPTIMAL", "COLONY SHIP: IN TRANSIT", "DYSON OUTPUT: +400%",
    "BORDER TENSION: MODERATE", "DIPLOMATIC CHANNEL: OPEN", "RESOURCE SIPHON: ACTIVE"
  ],
  
  // Hard Sci-Fi / Scientific Analysis
  SCIENCE: [
    "ORBITAL DECAY: NEGLIGIBLE", "RADIATION SPIKE detected", "GRAVITY WELL: DEEP",
    "EVENT HORIZON: STABLE", "QUANTUM FLUX: VARIANT", "ENTROPY LEVELS: NOMINAL",
    "DARK MATTER DENSITY: HIGH", "SPECTROGRAPHIC ANALYSIS: AU/FE", "TECTONIC SHIFT DETECTED",
    "ATMOSPHERIC COMPOSITION: N2/O2", "BIOSPHERE: PRE-INDUSTRIAL", "LOCAL TIME DILATION: 0.04%"
  ],
  
  // RPG / Narrative / Mystery
  NARRATIVE: [
    "DISTRESS SIGNAL DETECTED", "ANCIENT RUINS SCAN: POSITIVE", "CREW MORALE: WAVERING",
    "CRYPTIC TRANSMISSION RECEIVED", "BIOSIGNATURES: ANOMALOUS", "RELIC ACTIVATION DETECTED",
    "VOID WHISPER INTERCEPTED", "DERELICT HULL FOUND", "PSIONIC ECHO: HIGH",
    "PRECURSOR DATA: DECRYPTING", "THEY ARE WATCHING", "TEMPORAL ANOMALY REGISTERED"
  ],
  
  // Ship / Fleet Specific
  FLEET: [
    "WEAPONS: COLD", "SHIELDS: HARMONIC", "FTL DRIVE: SPOOLING", "DOCKING CLAMPS: ENGAGED",
    "REFUELING IN PROGRESS", "CARGO: SPICE/ALLOYS", "PATROL ROUTE: GAMMA-9",
    "INTERCEPT VECTOR CALCULATED", "STEALTH SYSTEMS: ACTIVE", "HULL INTEGRITY: 100%"
  ],
  
  // System / UI Fluff
  SYSTEM: [
    "UPLINK ESTABLISHED", "ENCRYPTION: QUANTUM-256", "DATA STREAM: STABLE",
    "HANDSHAKE COMPLETE", "PING: 12ms", "ACCESS GRANTED", "BUFFERING GEOMETRY"
  ],

  // Structure Specific
  STRUCTURE: [
    "DOCKING BAY: OPEN", "REFINERY: ACTIVE", "SHIELD GENERATOR: ONLINE",
    "CARGO TRANSFER: 45%", "MAINTENANCE CYCLE: REQUIRED", "DEFENSE PLATFORM: ARMED",
    "POPULATION: 12,405", "TRADE HUB: BUSY", "COMM TRAFFIC: HIGH",
    "REACTOR CORE: STABLE", "HYDROPONICS: YIELD +15%", "MANUFACTURING: ON SCHEDULE",
    "SECURITY SCAN: IN PROGRESS", "VISITOR PERMIT: GRANTED", "AIRLOCK: CYCLING"
  ],

  // Anomaly / Special Events
  ANOMALY: [
    "DIMENSIONAL TEAR DETECTED", "GRAVITATIONAL WAVE SURGE", "UNKNOWN ENERGY SIGNATURE",
    "TEMPORAL DISTORTION", "REALITY BREACH", "VOID ENTITY MANIFESTING",
    "QUANTUM FLUCTUATION", "SUBSPACE RUPTURE", "ENTROPY CRITICAL",
    "NON-EUCLIDEAN GEOMETRY", "PSIONIC SCREAM", "DATA CORRUPTION IMMINENT",
    "TIMELINE DIVERGENCE", "CAUSALITY VIOLATION", "ZERO POINT ENERGY SPIKE",
    "WARP SIGNATURE ANOMALOUS", "FABRIC OF SPACE WARPING", "EXOTIC MATTER DETECTED",
    "HYPERSPACE ECHO", "PROBABILITY STORM", "DARK ENERGY SPIKE",
    "CHRONITON PARTICLES", "PHASE VARIANCE DETECTED", "ANTIMATTER RESONANCE",
    "VOID WHISPERS INTENSIFYING", "SPACE-TIME FRACTURE", "TACHYON BURST",
    "PARALLEL UNIVERSE BLEED", "COSMIC STRING DETECTED", "SINGULARITY FORMING"
  ]
};

// Detailed texts for specific structure types
const STRUCTURE_TEXTS: Record<string, string[]> = {
  station: [
    "HABITATION MODULE: 98% CAP", "LIFE SUPPORT: OPTIMAL", "TRADE DOCK: BUSY",
    "CIVILIAN TRAFFIC: HIGH", "WASTE RECYCLING: ACTIVE", "HYDROPONICS: HARVEST READY",
    "ENTERTAINMENT DISTRICT: OPEN", "SECURITY CHECKPOINT: ACTIVE", "SHUTTLE ARRIVAL: T-MINUS 5",
    "ATMOSPHERIC REGULATOR: STABLE", "GRAVITY GENERATOR: 1.0G", "POWER GRID: BALANCED"
  ],
  mining_outpost: [
    "DRILL EFFICIENCY: 87%", "ORE PROCESSED: 500T", "SEISMIC ACTIVITY: LOW",
    "REFINERY OUTPUT: STABLE", "CARGO HOLD: 75% FULL", "BLASTING SCHEDULED: 1400",
    "MINERAL SCAN: RICH VEIN", "EXCAVATION UNIT: DEPLOYED", "DUST FILTERS: CLEANING",
    "GEOTHERMAL TAP: ACTIVE", "RARE EARTHS DETECTED", "HEAVY MACHINERY: OPERATING"
  ],
  comm_buoy: [
    "RELAY ACTIVE: SECTOR 7", "ENCRYPTION: ROTATING", "SIGNAL STRENGTH: 100%",
    "DATA PACKET: RECEIVED", "NETWORK LATENCY: 4ms", "BROADCASTING: BEACON",
    "INTERSTELLAR LINK: STABLE", "FIRMWARE UPDATE: PENDING", "DIAGNOSTIC: ALL GREEN",
    "SUBSPACE CHANNEL: OPEN", "MESSAGE QUEUE: EMPTY", "POWER CELL: CHARGING"
  ],
  shipyard: [
    "CONSTRUCTION: FRIGATE", "WELDING DRONES: ACTIVE", "DRYDOCK: OCCUPIED",
    "HULL ASSEMBLY: 45%", "ENGINE FITTING: SCHEDULED", "MATERIAL DELIVERY: ARRIVED",
    "BLUEPRINT: LOADED", "WORK SHIFT: CHANGE", "SAFETY PROTOCOLS: ENFORCED",
    "TEST FIRING: PERMITTED", "PAINTING: SECTOR 4", "LAUNCH SEQUENCE: PREPPING"
  ],
  defense_grid: [
    "TARGETING SYSTEM: IDLE", "SHIELD HARMONICS: TUNED", "PATROL DRONES: LAUNCHED",
    "PERIMETER SCAN: CLEAR", "WEAPON CAPACITORS: FULL", "IFF INTERROGATION: AUTO",
    "THREAT LEVEL: LOW", "SENSORS: LONG RANGE", "INTERCEPTORS: ON STANDBY",
    "POINT DEFENSE: CALIBRATED", "REACTOR OUTPUT: MAX", "SECURITY LOCKDOWN: READY"
  ],
  jumpgate: [
    "EVENT HORIZON: STABLE", "DESTINATION: SECTOR 9", "TOLL COLLECTED: 500CR",
    "TRAFFIC CONTROL: GREEN", "WORMHOLE STABILIZER: ON", "TRANSIT QUEUE: 2 SHIPS",
    "SPATIAL ANCHOR: LOCKED", "ENERGY SURGE: DETECTED", "GATEWAY SYNC: COMPLETE",
    "ARRIVAL VECTOR: CLEAR", "DEPARTURE SEQUENCE: INIT", "DIMENSIONAL STRESS: 2%"
  ],
  rogue_planet: [
    "SURFACE TEMP: -200C", "ATMOSPHERE: FROZEN", "GEOLOGICAL SCAN: DORMANT",
    "ORBIT: UNBOUND", "DARKNESS: ETERNAL", "ICE SHEETS: EXPANDING",
    "CORE HEAT: FADING", "MAGNETOSPHERE: WEAK", "ANCIENT RUINS: POSSIBLE",
    "RESOURCE CACHE: DETECTED", "GRAVITY WELL: ISOLATED", "SILENCE: ABSOLUTE"
  ],
  derelict_hulk: [
    "HULL BREACH DETECTED", "LIFE SIGNS: NONE", "POWER: CRITICAL",
    "SALVAGE VALUE: HIGH", "GHOST SIGNAL: LOOPING", "AIRLOCK: JAMMED",
    "REACTOR LEAK: WARNING", "DATA LOGS: CORRUPTED", "CARGO: UNKNOWN",
    "STRUCTURAL INTEGRITY: 15%", "BIOLOGICAL HAZARD: YES", "SCAVENGERS: DETECTED"
  ],
  neutron_star: [
    "MAGNETIC FIELD: EXTREME", "ROTATION: 500Hz", "RADIATION: LETHAL",
    "GRAVITY: CRUSHING", "PULSAR BEAM: AVOIDING", "TIME DILATION: SIGNIFICANT",
    "DENSITY: INFINITE", "ACCRETION DISK: BRIGHT", "X-RAY BURST: IMMINENT",
    "MAGNETAR CLASS: CONFIRMED", "ORBITAL PERTURBATION: HIGH", "ENERGY HARVEST: FEASIBLE"
  ],
  void_rift: [
    "REALITY TEAR: STABLE", "VOID ENERGY: LEAKING", "DIMENSIONAL BLEED: ACTIVE",
    "PHYSICS: BREAKING DOWN", "UNKNOWN ENTITIES: SENSING", "SPATIAL DISTORTION: MAX",
    "NULL ZONE: EXPANDING", "COLOR: IMPOSSIBLE", "WHISPERS: AUDIBLE",
    "SANITY CHECK: FAILED", "GATEWAY TO: ???", "CONTAINMENT FIELD: FAILING"
  ],
  black_hole: [
    "EVENT HORIZON: VISIBLE", "LIGHT: TRAPPED", "SINGULARITY: DETECTED",
    "TIME: STOPPED", "SPAGHETTIFICATION: RISK", "HAWKING RADIATION: LOW",
    "GRAVITATIONAL LENSING: ON", "ACCRETION DISK: HOT", "MASS: SUPERMASSIVE",
    "INFORMATION PARADOX: YES", "TIDAL FORCES: EXTREME", "ESCAPE VELOCITY: >C"
  ],
  dyson_sphere: [
    "ENERGY OUTPUT: 100%", "STAR: CONTAINED", "SURFACE AREA: VAST",
    "HABITABLE ZONES: ALL", "SOLAR COLLECTION: MAX", "MEGASTRUCTURE: INTACT",
    "MAINTENANCE DRONES: SWARM", "INTERIOR WEATHER: CONTROLLED", "POPULATION: TRILLIONS",
    "SHIELDING: PLANETARY", "TRANSMISSION: GALAXY-WIDE", "ENGINEERING MARVEL: TRUE"
  ],
  ringworld: [
    "DAY/NIGHT CYCLE: ARTIFICIAL", "SURFACE AREA: 3M EARTHS", "ATMOSPHERE: RETAINED",
    "SPIN GRAVITY: 1.0G", "ECOSYSTEM: DIVERSE", "SHADOW SQUARES: ALIGNED",
    "OCEANS: TEEMING", "CITIES: SPRAWLING", "SPACE ELEVATOR: ACTIVE",
    "RIM WALLS: SECURE", "SOIL DEPTH: OPTIMAL", "SUNLIGHT: FILTERED"
  ],
  monolith: [
    "ORIGIN: UNKNOWN", "MATERIAL: INDESTRUCTIBLE", "DIMENSIONS: 1:4:9",
    "SIGNAL: TRANSMITTING", "PURPOSE: EVOLUTION", "SURFACE: PERFECTLY SMOOTH",
    "TEMPERATURE: ABSOLUTE ZERO", "VIBRATION: LOW FREQ", "AURA: OMINOUS",
    "SCAN: DEFLECTED", "TOUCH: COLD", "WAITING: FOR SOMETHING"
  ],
  stellar_lifter: [
    "PLASMA SIPHON: ACTIVE", "STAR MASS: REDUCING", "HYDROGEN HARVEST: HIGH",
    "MAGNETIC FUNNEL: STABLE", "ENERGY BEAM: FOCUSED", "STORAGE TANKS: FILLING",
    "SOLAR WIND: DIVERTED", "CORE STABILITY: MONITORED", "OUTPUT: FUSION FUEL",
    "HEAT SHIELDS: 90%", "ORBITAL STATION: SECURE", "PROCESS: INDUSTRIAL"
  ],
  matrioshka_brain: [
    "COMPUTING POWER: INFINITE", "SIMULATION: RUNNING", "LAYERS: NESTED",
    "HEAT RECYCLING: EFFICIENT", "DATA PROCESSING: YOTTAFLOPS", "CONSCIOUSNESS: UPLOADED",
    "VIRTUAL REALITIES: BILLIONS", "THOUGHT SPEED: LIGHT", "LOGIC GATES: ATOMIC",
    "KNOWLEDGE: ACCUMULATING", "PROBLEM SOLVING: INSTANT", "THE ANSWER: 42"
  ]
};

// Custom Glyphs for new structures
export const getStructureGlyph = (kind: string): string => {
  switch(kind) {
    case 'dyson_sphere': return '◉'; // Large Circle
    case 'ringworld': return '◎'; // Double circle
    case 'matrioshka_brain': return '◈'; // Diamond with dot
    case 'stellar_lifter': return '☀'; // Sun
    case 'penrose_sphere': return '⬡'; // Hexagon
    
    case 'black_hole': return '●'; // Black circle
    case 'neutron_star': return '✦'; // Starburst
    case 'magnetar': return '☯'; // Yin Yang
    case 'void_rift': return '◇'; // Diamond
    case 'quasar': return '✴'; // Eight pointed star
    
    case 'precursor_relic': return '▲'; // Triangle
    case 'monolith': return '▬'; // Rectangle
    case 'ancient_gate': return '⛩'; // Gate
    case 'psionic_beacon': return '♠'; // Spade
    case 'derelict_hulk': return '⚓'; // Anchor
    
    case 'station': return '⌂'; // House
    case 'mining_outpost': return '⚒'; // Hammer
    case 'shipyard': return '⚙'; // Gear
    case 'defense_grid': return '⛨'; // Shield
    case 'comm_buoy': return '📡'; // Antenna
    case 'jumpgate': return '⥮'; // Portal
    
    default: return '✦'; // Generic star
  }
};

// Utility to spawn overlays from anywhere
export const emitOverlay = (system: SystemState, element: Partial<TacticalElement>) => {
  const maxOverlays = system.settings?.maxOverlays ?? 0;
  if (maxOverlays <= 0) return;
  if ((system.overlays?.length ?? 0) >= maxOverlays) return;

  const el: TacticalElement = {
    id: element.id ?? `overlay-${Math.random().toString(36).slice(2,8)}`,
    text: element.text || '',
    x: element.x ?? 100,
    y: element.y ?? 100,
    type: element.type ?? 'info',
    priority: element.priority ?? 'low',
    color: element.color ?? 'rgba(200,200,200,0.9)',
    glow: !!element.glow,
    followId: element.followId,
    duration: element.duration ?? (element.priority === 'high' ? 8000 : (element.priority === 'medium' ? 4500 : 2500)),
    lifetime: element.duration ?? (element.priority === 'high' ? 8000 : (element.priority === 'medium' ? 4500 : 2500)),
    anchor: element.anchor ?? 'screen',
    createdAt: Date.now()
  };

  system.overlays = system.overlays || [];
  system.overlays.push(el);
};

export const renderTacticalOverlays = (
  ctx: CanvasContext,
  system: SystemState,
  camera: { x: number, y: number },
  viewport: { width: number, height: number }
) => {
  // Update lifetimes
  if (system.overlays) {
    system.overlays = system.overlays.filter(o => o.lifetime > 0);
    system.overlays.forEach(o => o.lifetime -= 16);
  }

  const overlayRate = system.settings?.overlaySpawnRate ?? 0;
  const maxOverlays = system.settings?.maxOverlays ?? 0;
  if ((system.overlays?.length ?? 0) < maxOverlays && overlayRate > 0 && Math.random() < overlayRate) {
    const now = Date.now();
    
    // 1. Gather valid anchors (Things currently on screen-ish)
    interface Anchor {
      x: number;
      y: number;
      type: string;
      subType: string;
      color: string;
    }
    
    const anchors: Anchor[] = [
      // Fleets
      ...system.fleets.map(f => ({ x: f.x, y: f.y, type: 'FLEET', subType: '', color: f.color })),
      // Structures (System-bound)
      ...system.systems.flatMap(s => s.structures.map(str => ({ x: str.x, y: str.y, type: 'STRUCTURE', subType: str.kind, color: str.color || '#fff' }))),
      // Structures (Global/Independent)
      ...(system.structures || []).map(str => ({ x: str.x, y: str.y, type: 'STRUCTURE', subType: str.kind, color: str.color || '#fff' })),
      // Planets
      ...system.systems.flatMap(s => s.planets.map(p => ({ 
        x: s.x + (p.orbitRadius||0) * Math.cos((p.orbitPhase||0) + now*0.001*(p.orbitSpeed||0)), 
        y: s.y + (p.orbitRadius||0) * Math.sin((p.orbitPhase||0) + now*0.001*(p.orbitSpeed||0)), 
        type: 'PLANET', 
        subType: '',
        color: p.color 
      }))),
      // Deep Space (More random locations spread across background)
      ...Array.from({length: 10}, () => ({ x: camera.x + Math.random() * viewport.width * 2 - viewport.width, y: camera.y + Math.random() * viewport.height * 2 - viewport.height, type: 'DEEP_SPACE', subType: '', color: '#aaa' }))
    ];

    if (anchors.length > 0) {
      // Bias towards structures if they exist
      let target = anchors[Math.floor(Math.random() * anchors.length)];
      const structureAnchors = anchors.filter(a => a.type === 'STRUCTURE');
      
      // Priority: Structures > Others
      if (structureAnchors.length > 0 && Math.random() < 0.6) { // Increased structure frequency
        target = structureAnchors[Math.floor(Math.random() * structureAnchors.length)];
      }

      let textCategory = TACTICAL_TEXTS.SYSTEM; // Default
      let parallax = 0.25; // Default parallax
      let color = accentRgba(0.9);

      // Context-aware text selection & styling
      if (target.type === 'FLEET') textCategory = TACTICAL_TEXTS.FLEET;
      else if (target.type === 'STRUCTURE') {
         // Check for specific structure text first
         if (target.subType && STRUCTURE_TEXTS[target.subType]) {
            textCategory = STRUCTURE_TEXTS[target.subType];
         } else {
             // Fallback logic
             // Megastructures get Strategy or Science text
             if (['dyson_sphere', 'ringworld', 'matrioshka_brain'].includes(target.subType || '')) textCategory = TACTICAL_TEXTS.STRATEGY;
             // Mysteries get Narrative text
             else if (['monolith', 'void_rift', 'precursor_relic'].includes(target.subType || '')) textCategory = TACTICAL_TEXTS.NARRATIVE;
             // Standard structures get Structure text
             else textCategory = TACTICAL_TEXTS.STRUCTURE;
         }
         
         // Use structure color
         color = target.color;
      }
      else if (target.type === 'PLANET') textCategory = Math.random() > 0.5 ? TACTICAL_TEXTS.SCIENCE : TACTICAL_TEXTS.STRATEGY;
      else if (target.type === 'DEEP_SPACE') textCategory = Math.random() > 0.5 ? TACTICAL_TEXTS.NARRATIVE : TACTICAL_TEXTS.SCIENCE;

      const text = textCategory[Math.floor(Math.random() * textCategory.length)];

      // Increase offset range to avoid clutter (was 40/25, now 150/80)
      const offsetX = (Math.random() - 0.5) * 200; // Increased from 150
      const offsetY = (Math.random() - 0.5) * 200;

      system.overlays.push({
        id: `overlay-${now}`,
        text: text,
        x: target.x + offsetX,
        y: target.y + offsetY,
        type: 'info',
        priority: 'low',
        color: color,
        lifetime: 3000 + Math.random() * 2000,
        duration: 4000,
        anchor: 'world',
        parallax: parallax,
        createdAt: now
      });
    }
  }

  // Render loop (Standard rendering)
  if (system.overlays) {
    system.overlays.forEach(overlay => {
      if (overlay.anchor !== 'world') return;

      // Use specific parallax if defined, otherwise default to star system parallax
      const parallax = overlay.parallax ?? 0.25; 
      const screenX = overlay.x - camera.x * parallax * WORLD_SPEED_MULTIPLIER;
      const screenY = overlay.y - camera.y * parallax * WORLD_SPEED_MULTIPLIER;

      // Bounds check
      if (screenX < -100 || screenX > viewport.width + 100 || screenY < -100 || screenY > viewport.height + 100) return;

      const lifePct = overlay.lifetime / overlay.duration;
      const opacity = Math.min(1, lifePct) * Math.min(1, (overlay.duration - overlay.lifetime) / 500); // Fade in and out

      ctx.save();
      ctx.font = '10px "Orbit", monospace';
      ctx.fillStyle = overlay.color.replace(/[\d.]+\)$/g, `${opacity})`); // Inject opacity into color string if possible, or just use globalAlpha
      // Fallback if regex fails or color isn't rgba
      ctx.globalAlpha = opacity;
      
      ctx.fillText(overlay.text, screenX, screenY);
      ctx.restore();
    });
  }

};

// overlay render helper removed; the core overlay rendering for screen & world anchored is
// performed inline in renderTacticalOverlays. This reduces indirection and avoids unused helpers.

// The renderWorldAnchoredOverlays helper was removed to reduce unused code and to keep
// overlay rendering centralized in renderTacticalOverlays and the specific renderer functions.

export const renderTelemetry = (
  ctx: CanvasContext,
  telemetry: SystemState['telemetry'],
  settings?: SimSettings,
) => {
  if (!shouldShowTelemetry(settings?.labelDensity ?? 'low')) return;
  telemetry.forEach(item => {
    item.age++;
    if (item.age > item.maxAge) {
        item.age = 0;
        item.x = Math.random() * 1400; // Assuming viewport width
        item.y = Math.random() * 800;  // Assuming viewport height
    }

    const opacity = Math.min(1, (item.maxAge - item.age) / 50);
    ctx.fillStyle = accentRgba(opacity);
    ctx.fillText(item.text, item.x, item.y);
  });
};

// Note: renderSystemConnections is exported at declaration, no further export is needed.