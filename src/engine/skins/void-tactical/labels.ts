import type { LabelDensity, Structure } from './types';

export type StructureRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Mirrors STRUCTURE_TABLE chances in generators.ts. */
const KIND_RARITY: Record<string, StructureRarity> = {
  station: 'common',
  mining_outpost: 'common',
  comm_buoy: 'common',
  shipyard: 'common',
  defense_grid: 'uncommon',
  jumpgate: 'uncommon',
  rogue_planet: 'uncommon',
  derelict_hulk: 'uncommon',
  neutron_star: 'rare',
  void_rift: 'rare',
  black_hole: 'rare',
  dyson_sphere: 'legendary',
  ringworld: 'legendary',
  monolith: 'legendary',
  stellar_lifter: 'legendary',
  matrioshka_brain: 'legendary',
  penrose_sphere: 'legendary',
  quasar: 'rare',
  magnetar: 'rare',
  precursor_relic: 'rare',
  ancient_gate: 'rare',
  psionic_beacon: 'rare',
};

export function structureRarity(kind: Structure['kind'] | string): StructureRarity {
  return KIND_RARITY[kind] ?? 'uncommon';
}

export function shouldShowStructureLabel(density: LabelDensity, kind: Structure['kind'] | string): boolean {
  if (density === 'none') return false;
  const rarity = structureRarity(kind);
  if (density === 'low') return rarity === 'legendary' || rarity === 'rare';
  if (density === 'medium') return rarity !== 'common';
  return true;
}

export function shouldShowSystemLabel(density: LabelDensity): boolean {
  return density !== 'none';
}

export function shouldShowPlanetLabel(density: LabelDensity): boolean {
  return density === 'high';
}

export function shouldShowFleetLabel(density: LabelDensity, showLabelFlag: boolean): boolean {
  if (density === 'none' || density === 'low') return false;
  if (density === 'medium') return showLabelFlag;
  return true;
}

export function shouldShowAnomalyText(density: LabelDensity): boolean {
  return density === 'medium' || density === 'high';
}

export function shouldShowAnomalyScanline(density: LabelDensity): boolean {
  return density === 'high';
}

export function shouldShowTelemetry(density: LabelDensity): boolean {
  return density === 'high';
}

export function shouldGlitchLabels(density: LabelDensity): boolean {
  return density === 'high';
}
