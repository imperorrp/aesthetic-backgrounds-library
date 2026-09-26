/** Display fonts used by the built-in skins' canvas text. Opt-in: `mount(el, { fonts: true })`. */
export const ENGINE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Orbit&family=Syne+Mono&display=swap';

export function injectEngineFonts(href: string = ENGINE_FONTS_URL): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-bg-engine-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.bgEngineFonts = '1';
  document.head.appendChild(link);
}
