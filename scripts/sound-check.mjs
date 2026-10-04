#!/usr/bin/env node
/**
 * Sound check: render every sound palette offline in a real browser and report how loud
 * things are, so levels can be balanced without guessing.
 *
 *   pnpm sound-check              every palette
 *   pnpm sound-check siege choir  only these
 *
 * For each palette it renders the bed (drone + noise) alone for six seconds, then every
 * cue alone at full weight, and prints:
 *   bed   RMS of the bed, dBFS              (target: about -40 to -26: under everything)
 *   peak  the loudest sample of a cue, dBFS (flag above -1: the limiter is working hard)
 *   loud  the loudest 50 ms of a cue, dBFS  (flag below -45: too quiet to notice)
 * Exits 1 when anything is flagged.
 */
import { chromium } from '@playwright/test';

const only = process.argv.slice(2);
const reachable = async (url) => {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(800) })).ok;
  } catch {
    return false;
  }
};
let base = process.env.LAB_URL;
let server;
if (!base) {
  for (const port of [5180, 5173, 5199]) {
    if (await reachable(`http://localhost:${port}/lab.html`)) {
      base = `http://localhost:${port}`;
      break;
    }
  }
}
if (!base) {
  const { createServer } = await import('vite');
  server = await createServer({ logLevel: 'error', server: { port: 5183, strictPort: false } });
  await server.listen();
  base = server.resolvedUrls.local[0].replace(/\/$/, '');
}

const browser = await chromium.launch();
let code = 0;
try {
  const page = await browser.newPage();
  await page.goto(`${base}/lab.html?view=1&skin=drifting-dust`);
  const report = await page.evaluate(async (only) => {
    const { createSoundscape, SOUND_PALETTES } = await import('/src/engine/audio/index.ts');
    const RATE = 44100;
    const db = (x) => (x > 0 ? 20 * Math.log10(x) : -120);
    const measure = (buf, from, to) => {
      let peak = 0;
      let sum = 0;
      let n = 0;
      let loud = 0;
      const win = Math.floor(RATE * 0.05);
      let wsum = 0;
      let wn = 0;
      for (let i = Math.floor(from * RATE); i < Math.min(buf.length, Math.floor(to * RATE)); i++) {
        let s = 0;
        for (let ch = 0; ch < buf.numberOfChannels; ch++) s += buf.getChannelData(ch)[i] ** 2;
        s /= buf.numberOfChannels;
        peak = Math.max(peak, Math.sqrt(s));
        sum += s;
        n++;
        wsum += s;
        if (++wn === win) {
          loud = Math.max(loud, Math.sqrt(wsum / wn));
          wsum = 0;
          wn = 0;
        }
      }
      return { peak: db(peak), rms: db(Math.sqrt(sum / Math.max(1, n))), loud: db(loud) };
    };
    const out = [];
    for (const [id, pal] of Object.entries(SOUND_PALETTES)) {
      if (only.length && !only.includes(id)) continue;
      const bedCtx = new OfflineAudioContext(2, RATE * 6, RATE);
      const bed = createSoundscape({ palette: pal, volume: 0.6, context: bedCtx });
      await bed.start();
      const bedRms = measure(await bedCtx.startRendering(), 3, 6).rms;
      const cues = [];
      for (const type of Object.keys(pal.cues)) {
        const c = new OfflineAudioContext(2, RATE * 9, RATE);
        const s = createSoundscape({ palette: { ...pal, drone: null, bed: undefined }, volume: 0.6, context: c });
        await s.start();
        c.suspend(1.5).then(() => {
          s.play({ type, weight: 1, pan: 0, near: 1, priority: 'high', size: 1 });
          c.resume();
        });
        const m = measure(await c.startRendering(), 1.5, 9);
        cues.push({ type, ...m });
      }
      out.push({ id, bed: bedRms, cues });
    }
    return out;
  }, only);

  for (const p of report) {
    const bedFlag = p.bed > -26 ? '  BED LOUD' : p.bed < -50 ? '  BED SILENT' : '';
    if (bedFlag) code = 1;
    console.log(`\n${p.id.padEnd(12)} bed ${p.bed.toFixed(1).padStart(6)} dB${bedFlag}`);
    for (const c of p.cues) {
      const flag = c.peak > -1 ? '  LOUD' : c.loud < -45 ? '  QUIET' : '';
      if (flag) code = 1;
      console.log(`  ${c.type.padEnd(14)} peak ${c.peak.toFixed(1).padStart(6)}  loud ${c.loud.toFixed(1).padStart(6)}${flag}`);
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
process.exit(code);
