#!/usr/bin/env node
/**
 * The bar, in numbers: run a world headless over several seeds and say how it does.
 *
 *   pnpm world:check wyrmspire
 *   pnpm world:check deephold seeds=a,b,c,d minutes=20
 *   pnpm world:check template-pond module=/src/engine/skins/worlds/template/index.ts
 *
 * For each seed, ten simulated minutes (sim-only, no drawing) at 1280 × 800:
 *   first     seconds to the first event                       (warn over 30: a wallpaper starts busy)
 *   per min   events a minute                                  (warn under 3: busy at 1x)
 *   quiet     the longest gap between events, in seconds       (warn over 90: never stagnates)
 *   lines     lines said on the map a minute (medium and high)
 *   kinds     how many kinds of event happened
 * Then, across seeds: how alike their kinds of event are (warn over 0.9: seeds should differ),
 * a replay of the first seed (fail if different), and a phone-sized run (fail if it throws).
 *
 * Exits 1 on a failure. Warnings are taste, not law: read them, then look at the world
 * (pnpm lab <id> t=10,60,300,900). docs/AUTHORING.md has the rest of the bar.
 */
import { createServer } from 'vite';

const args = { skin: undefined, seeds: undefined, minutes: 10, module: undefined, w: 1280, h: 800 };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.includes('=') ? a.split(/=(.*)/) : [a, undefined];
  if (v === undefined) args.skin = k;
  else args[k] = ['minutes', 'w', 'h'].includes(k) ? Number(v) : v;
}
if (!args.skin) {
  console.error('Usage: pnpm world:check <skin-id> [seeds=a,b,c] [minutes=10] [module=/src/...]');
  process.exit(1);
}
const seeds = (args.seeds ?? ['1', '2', '3', '4'].map((n) => `${args.skin}-${n}`).join(',')).split(',');
const seconds = args.minutes * 60;

const server = await createServer({
  configFile: false,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
let failed = false;
const warns = [];
const fail = (msg) => {
  failed = true;
  console.log(`FAIL  ${msg}`);
};
try {
  const { runHeadless, prepareSkins } = await server.ssrLoadModule('/src/dev/headless.ts');
  const { registerSkin, getSkin } = await server.ssrLoadModule('/src/engine/core/registry.ts');
  if (args.module) {
    const m = await server.ssrLoadModule(args.module);
    for (const v of Object.values(m)) if (v && typeof v === 'object' && typeof v.mount === 'function' && typeof v.id === 'string' && !getSkin(v.id)) registerSkin(v);
  }
  await prepareSkins();
  if (!getSkin(args.skin)) {
    console.error(`No skin "${args.skin}". Registered worlds work by id; a draft needs module=/src/.../index.ts.`);
    process.exit(1);
  }

  const isEvent = (e) => e.type && e.type !== 'say' && e.type !== 'ambience';
  const rows = [];
  for (const seed of seeds) {
    const r = runHeadless({ skin: args.skin, seed, seconds, width: args.w, height: args.h, sampleEvery: 30 });
    if (r.threw) fail(`${seed}: threw: ${r.threw.split('\n')[0]}`);
    if (r.problems.length) fail(`${seed}: ${r.problems.length} problems: ${r.problems.slice(0, 3).join('; ')}`);
    const ev = r.log.filter(isEvent);
    const times = [0, ...ev.map((e) => e.t), r.seconds];
    const quiet = Math.max(...times.slice(1).map((t, i) => t - times[i]));
    const lines = r.log.filter((e) => e.type === 'say' && (e.kind === 'high' || e.kind === 'medium')).length;
    rows.push({ seed, first: ev[0]?.t ?? Infinity, perMin: ev.length / args.minutes, quiet, lines: lines / args.minutes, kinds: new Set(ev.map((e) => e.type)), ms: r.msPerFrame });
  }

  const pad = (s, n) => String(s).padStart(n);
  console.log(`\n${args.skin} · ${seeds.length} seeds · ${args.minutes} min each · ${args.w} × ${args.h}\n`);
  console.log(`${'seed'.padEnd(18)}${pad('first', 7)}${pad('per min', 9)}${pad('quiet', 7)}${pad('lines', 7)}${pad('kinds', 7)}${pad('ms/step', 9)}`);
  for (const x of rows) {
    console.log(`${x.seed.padEnd(18)}${pad(x.first === Infinity ? '—' : x.first.toFixed(0), 7)}${pad(x.perMin.toFixed(1), 9)}${pad(x.quiet.toFixed(0), 7)}${pad(x.lines.toFixed(1), 7)}${pad(x.kinds.size, 7)}${pad(x.ms.toFixed(2), 9)}`);
    if (x.first === Infinity) fail(`${x.seed}: nothing happened in ${args.minutes} minutes`);
    else if (x.first > 30) warns.push(`${x.seed}: the first event comes at ${x.first.toFixed(0)} s (a wallpaper should start busy)`);
    if (x.perMin < 3) warns.push(`${x.seed}: ${x.perMin.toFixed(1)} events a minute (busy at 1x wants more)`);
    if (x.quiet > 90) warns.push(`${x.seed}: a quiet stretch of ${x.quiet.toFixed(0)} s (it should never stagnate)`);
    if (x.ms > 2) warns.push(`${x.seed}: ${x.ms.toFixed(2)} ms a sim step before drawing (heavy for a background)`);
  }

  // Seeds should differ in what happens, not only where.
  const jac = (a, b) => {
    const inter = [...a].filter((k) => b.has(k)).length;
    const union = new Set([...a, ...b]).size;
    return union ? inter / union : 1;
  };
  const pairs = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) pairs.push(jac(rows[i].kinds, rows[j].kinds));
  const alike = pairs.length ? pairs.reduce((s, v) => s + v, 0) / pairs.length : 0;
  const all = new Set(rows.flatMap((x) => [...x.kinds]));
  const everywhere = [...all].filter((k) => rows.every((x) => x.kinds.has(k)));
  console.log(`\nAcross seeds: ${all.size} kinds of event, ${everywhere.length} in every seed; alike ${alike.toFixed(2)} (0 = nothing shared, 1 = the same)`);
  if (rows.length > 1 && alike > 0.9) warns.push(`seeds are alike (${alike.toFixed(2)}): draw more of the cast per seed (kit/compose)`);

  // A replay must be the same world.
  const a = runHeadless({ skin: args.skin, seed: seeds[0], seconds: 120, width: args.w, height: args.h });
  const b = runHeadless({ skin: args.skin, seed: seeds[0], seconds: 120, width: args.w, height: args.h });
  const same = a.log.length === b.log.length && a.log.every((e, i) => e.t === b.log[i].t && e.text === b.log[i].text);
  console.log(`Replay of ${seeds[0]}: ${same ? 'the same' : 'DIFFERENT'}`);
  if (!same) fail(`${seeds[0]}: two runs of the same seed differ (randomness or time from outside the sim)`);

  // A phone gets a whole world, not a broken one.
  const phone = runHeadless({ skin: args.skin, seed: seeds[0], seconds: 120, width: 390, height: 844 });
  const phoneEvents = phone.log.filter(isEvent).length;
  console.log(`Phone (390 × 844): ${phone.threw ? 'THREW' : `${phoneEvents} events in 2 min`}`);
  if (phone.threw) fail(`phone: threw: ${phone.threw.split('\n')[0]}`);

  if (warns.length) {
    console.log('');
    for (const w of warns) console.log(`warn  ${w}`);
  }
  console.log(failed ? '\nFailed.' : warns.length ? '\nPassed, with warnings. Now look at it: pnpm lab ' + args.skin + ' t=10,60,300,900' : '\nPassed. Now look at it: pnpm lab ' + args.skin + ' t=10,60,300,900');
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
