/**
 * Tests that mount the sector map (or Undercity, or a fantasy world) want every universe,
 * mechanic, and lazy skin available synchronously (the library loads them on demand).
 * Import this first.
 */
import '../engine/skins/void-tactical/packs';
import '../engine/skins/void-tactical/mechanics/all';
import '../engine/skins/undercity/city';
import { getSkin, listSkins } from '../engine/core/registry';
import '../engine/skins';

await Promise.all(listSkins().map((id) => getSkin(id)?.prepare?.()));
