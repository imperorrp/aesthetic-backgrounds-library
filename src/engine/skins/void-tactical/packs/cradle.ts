/**
 * Cradle of Suns: a cosmic time-lapse, from gas to stars to the first voices.
 *
 * A lazily loaded universe pack: importing this module registers the pack. Its mechanics
 * (nebula, stars, life, epochs in mechanics/cradle.ts) load on their own. Space starts
 * empty (`scenery: 0`): everything on the map is made by the mechanics.
 */
import { registerUniverse, type UniversePack } from '../universe';

export const CRADLE_PACK: UniversePack = {
  id: 'cradle',
  name: 'Cradle of Suns',
  tagline: 'Watch a billion years an hour: gas, stars, worlds, and the first voices.',
  palette: '#c4b5fd',
  warmth: 0.1,
  colorBy: 'faction',
  factions: [{ name: 'THE FIRST', prefix: 'FST', color: '#fde68a' }],
  systemPrefix: 'STAR',
  structures: [],
  anomalies: [
    { label: 'GAMMA RAY BURST', style: 'burst' },
    { label: 'DARK MATTER HALO', style: 'singularity' },
    { label: 'COSMIC STRING', style: 'rift' },
  ],
  chatter: {
    fleet: ['FIRST ORBIT', 'SIGNAL SENT', 'HELLO?'],
    structure: ['…'],
    science: ['METALLICITY RISING', 'HYDROGEN COOLING', 'REIONIZATION', 'CARBON FROM DEAD STARS'],
    mystery: ['IS ANYONE THERE', 'WE ARE MADE OF THIS', 'EVERYTHING WAS ONCE GAS', 'IT TOOK SO LONG'],
    system: ['AGE OF THE UNIVERSE UPDATED', 'COSMIC MICROWAVE BACKGROUND · 2.7K'],
  },
  ambient: ['LET THERE BE LIGHT', 'STARDUST', 'A BILLION YEARS A MINUTE', 'THE FIRST VOICES', 'EVERYTHING WAS ONCE GAS', 'WE ARE HOW THE UNIVERSE KNOWS ITSELF', 'THE LONG DARK', 'IS ANYONE THERE'],
  mechanics: [
    { use: 'nebula', with: { amount: 1 } },
    { use: 'stars', with: { births: 2.5, supernovae: true } },
    { use: 'life', with: { pace: 1, silence: 0.15 } },
    { use: 'epochs', with: { rate: 0.011 } },
  ],
  look: { lanes: 'none', grid: 'none', traffic: 0, anomalies: 0.2, depth: 0, scenery: 0, drift: 0.35, ground: 'nebula', groundColor: '#4c1d95' },
};

registerUniverse(CRADLE_PACK);
