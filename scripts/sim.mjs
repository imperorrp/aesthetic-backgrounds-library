#!/usr/bin/env node
/**
 * Headless sim runner: step a skin sim-only in node and print what happened.
 *
 *   pnpm sim                         void-tactical, 60 s, seed orion-7
 *   pnpm sim choir 120               a universe id and a duration
 *   pnpm sim u=siege s=90 seed=x all show every log line, not just events
 *   pnpm sim skin=void-sector s=30   any registered skin or preset with no DOM at mount
 *
 * Exits 1 when the run threw or the skin reported problems (NaN positions, empty
 * fleets, runaway counts, failed mechanics), so it doubles as a fast smoke test.
 * TypeScript is loaded through Vite's SSR loader: no build step, ~1 s to start.
 */
import { createServer } from 'vite';

const UNIVERSES = new Set(['void', 'saltwind', 'choir', 'siege', 'hive', 'cradle', 'lastfleet']);
const args = { skin: 'void-tactical', u: undefined, s: 60, seed: 'orion-7', all: false, w: 1280, h: 800 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.includes('=') ? a.split(/=(.*)/) : [a, undefined];
  if (v === undefined) {
    if (/^\d+(\.\d+)?$/.test(k)) args.s = Number(k);
    else if (k === 'all') args.all = true;
    else if (UNIVERSES.has(k)) args.u = k;
    else args.skin = k;
  } else args[k] = ['s', 'w', 'h'].includes(k) ? Number(v) : v;
}

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let code = 0;
try {
  const { runHeadless } = await server.ssrLoadModule('/src/dev/headless.ts');
  const options = args.u ? { universe: args.u } : undefined;
  const report = runHeadless({ skin: args.skin, seed: args.seed, options, seconds: args.s, width: args.w, height: args.h });
  const label = `${args.skin}${args.u ? ` u=${args.u}` : ''} seed=${args.seed}`;
  console.log(`sim ${label} · ${report.seconds.toFixed(0)} s · ${report.frames} frames · ${report.msPerFrame.toFixed(3)} ms/frame`);

  // Counts: a compact table over time.
  if (report.samples.length) {
    const keys = [...new Set(report.samples.flatMap((s) => Object.keys(s.counts)))];
    const every = Math.max(1, Math.ceil(report.samples.length / 8));
    const rows = report.samples.filter((_, i) => i % every === 0 || i === report.samples.length - 1);
    console.log(`\n${'t'.padStart(6)}  ${keys.map((k) => k.replace('fleets.', 'f.').padStart(10)).join('')}`);
    for (const r of rows) console.log(`${r.t.toFixed(0).padStart(6)}  ${keys.map((k) => String(r.counts[k] ?? 0).padStart(10)).join('')}`);
  }

  // Typed events (bus), as counts.
  const types = {};
  for (const e of report.log) if (e.type && e.type !== 'say') types[e.type] = (types[e.type] ?? 0) + 1;
  const typeLine = Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ');
  if (typeLine) console.log(`\nevents: ${typeLine}`);

  // Narrative: what was said on the map (high and medium priority) unless `all`.
  const said = report.log.filter((e) => !e.type || e.type === 'say');
  const lines = said.filter((e) => args.all || e.kind !== 'low');
  console.log(`\n${lines.length} ${args.all ? 'lines' : 'lines of note'} (${said.length} said in total)`);
  const cap = args.all ? lines.length : 60;
  for (const e of lines.slice(0, cap)) console.log(`${e.t.toFixed(1).padStart(7)}  ${e.text}`);
  if (lines.length > cap) console.log(`   … ${lines.length - cap} more (add \`all\`)`);

  if (report.threw) {
    console.log(`\nTHREW:\n${report.threw}`);
    code = 1;
  }
  if (report.problems.length) {
    console.log(`\nPROBLEMS (${report.problems.length}):`);
    for (const p of report.problems.slice(0, 20)) console.log(`  - ${p}`);
    code = 1;
  } else if (!report.threw) console.log('\nno problems');
} finally {
  await server.close();
}
process.exit(code);
