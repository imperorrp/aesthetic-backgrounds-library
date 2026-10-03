import type { LabelDensity } from './types';
import type { Rarity } from './universe';

export type StructureRarity = Rarity;

/** Rare things are named first; common ones only at high detail. */
export function shouldShowStructureLabel(density: LabelDensity, rarity: Rarity): boolean {
  if (density === 'none') return false;
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
  return showLabelFlag;
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
