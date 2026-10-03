/**
 * Instruments from fictional worlds: the void-tactical idea (a background that is a
 * working display from inside a world) applied to other kinds of screens.
 */
import type { BackgroundSkin } from '../../core/skin';
import { sonarSkin } from './sonar';
import { atcRadarSkin } from './atc';
import { seismicSkin } from './seismic';
import { abyssalSkin } from './abyssal';
import { marsRadarSkin } from './mars';

export const instrumentSkins: readonly BackgroundSkin[] = [sonarSkin, atcRadarSkin, seismicSkin, abyssalSkin, marsRadarSkin];
export { sonarSkin, atcRadarSkin, seismicSkin, abyssalSkin, marsRadarSkin };
