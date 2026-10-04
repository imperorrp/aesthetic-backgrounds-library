/**
 * Wallpaper files the studio hands out: a single offline HTML file (the whole engine
 * inline, so it runs from disk, forever) and a Wallpaper Engine package around it.
 * The zip writer is the smallest one that works: stored entries, no compression.
 */
import type { WallpaperSettings } from '../wallpaper/codec';

const enc = new TextEncoder();

/** One self-contained page: settings first, then the runtime that reads them. */
export function offlineWallpaperHtml(settings: WallpaperSettings, runtime: string, title: string): string {
  // Nothing inside a <script> may close it early.
  const safeJson = JSON.stringify(settings).replace(/</g, '\\u003c');
  const safeRuntime = runtime.replace(/<\/script/gi, '<\\/script');
  const safeTitle = title.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${safeTitle}</title>
<style>html,body{margin:0;height:100%;overflow:hidden;background:#030308}</style>
</head>
<body>
<script>window.__BGE_WALLPAPER__ = ${safeJson};</script>
<script>${safeRuntime}</script>
</body>
</html>
`;
}

/** Wallpaper Engine's project file for a web wallpaper. */
export function wallpaperEngineProject(title: string, description: string): string {
  return JSON.stringify({ title, description, file: 'index.html', preview: 'preview.jpg', type: 'web', tags: ['Sci-Fi'], contentrating: 'Everyone', visibility: 'private' }, null, 2);
}

// ---- zip ---------------------------------------------------------------------------------

let crcTable: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array | string };

/** A zip archive of stored (uncompressed) files. Dates are fixed so the same input makes the same bytes. */
export function zip(entries: ZipEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // 1 January 2026, 00:00 in DOS time.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true); // version made by
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, dosTime, true);
    dir.setUint16(14, dosDate, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
