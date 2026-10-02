/**
 * `space-background-engine/tokens`: design-token bridge. Export a palette as W3C DTCG
 * tokens (Figma Variables, Tokens Studio, Style Dictionary) and derive a palette from
 * a brand's token file.
 */
export { paletteFromTokens, paletteToTokens } from '../engine/tokens';
export type { DtcgTokens } from '../engine/tokens';
