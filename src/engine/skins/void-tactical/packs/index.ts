/**
 * Every built-in universe, loaded eagerly. For the studio, tests, and the headless
 * runner, which want them all at once. Library users get them on demand instead
 * (`loadUniverse`), so importing this module is a choice to pay for all of them.
 */
export { SALTWIND_PACK } from './saltwind';
export { CHOIR_PACK } from './choir';
export { SIEGE_PACK } from './siege';
