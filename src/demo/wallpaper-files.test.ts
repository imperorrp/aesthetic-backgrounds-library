import { describe, expect, it } from 'vitest';
import { crc32, offlineWallpaperHtml, zip } from './wallpaper-files';
import { decodeConfig, encodeConfig, readWallpaperQuery, wallpaperQuery } from '../wallpaper/codec';

const text = (s: string) => new TextEncoder().encode(s);

describe('wallpaper files', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(text('123456789')).toString(16)).toBe('cbf43926');
  });

  it('writes a zip whose directory points at every file', () => {
    const bytes = zip([
      { name: 'index.html', data: '<p>hi</p>' },
      { name: 'project.json', data: '{}' },
    ]);
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const dirAt = view.getUint32(end + 16, true);
    expect(view.getUint32(dirAt, true)).toBe(0x02014b50);
    // The first entry's data sits after its 30-byte header and name.
    expect(new TextDecoder().decode(bytes.slice(30 + 10, 30 + 10 + 9))).toBe('<p>hi</p>');
    expect(view.getUint32(14, true)).toBe(crc32(text('<p>hi</p>')));
  });

  it('inlines settings and runtime without letting either close the script early', () => {
    const html = offlineWallpaperHtml({ config: { skin: 'void-tactical', seed: '</script><b>' } }, 'var a="</script>";', 'A <world>');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).toContain('<title>A &lt;world></title>');
    expect(html).toContain('\\u003c/script>');
  });

  it('round-trips a config through the link', () => {
    const config = { skin: 'void-tactical', seed: 'orion · 7', options: { universe: 'cradle' } };
    expect(decodeConfig(encodeConfig(config))).toEqual(config);
    const read = readWallpaperQuery(`?${wallpaperQuery({ config, fps: 30, skip: 60 })}`);
    expect(read).toEqual({ config, fps: 30, pr: undefined, skip: 60, interactive: false });
    expect(readWallpaperQuery('', `#${wallpaperQuery({ config })}`)?.config).toEqual(config);
    expect(readWallpaperQuery('?c=nope')).toBeNull();
  });
});
