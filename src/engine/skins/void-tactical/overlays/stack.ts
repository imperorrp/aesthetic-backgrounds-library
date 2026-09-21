import overlayCss from '../overlays.css?inline';
import { DEFAULT_OVERLAYS, OVERLAY_CLASS, type OverlayFlags, type OverlayId } from './flags';

let styleInjected = false;

export function injectEngineStyles(): void {
  if (styleInjected || typeof document === 'undefined') return;
  if (document.getElementById('bg-engine-styles')) {
    styleInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'bg-engine-styles';
  style.textContent = overlayCss;
  document.head.appendChild(style);
  styleInjected = true;
}

export function injectEngineFonts(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-bg-engine-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Orbit&family=Syne+Mono&display=swap';
  link.dataset.bgEngineFonts = '1';
  document.head.appendChild(link);
}

export type OverlayStackHandle = {
  root: HTMLDivElement;
  destroy(): void;
};

export function createOverlayStack(
  parent: HTMLElement,
  layers: OverlayFlags = {},
): OverlayStackHandle {
  injectEngineStyles();
  const flags = { ...DEFAULT_OVERLAYS, ...layers };
  const root = document.createElement('div');
  root.className = 'ambient-stack bg-engine-root';
  root.setAttribute('aria-hidden', 'true');

  (Object.keys(OVERLAY_CLASS) as Exclude<OverlayId, 'mouseGlow'>[]).forEach((id) => {
    if (!flags[id]) return;
    const el = document.createElement('div');
    el.className = OVERLAY_CLASS[id];
    root.appendChild(el);
  });

  let glowCleanup: (() => void) | undefined;
  if (flags.mouseGlow) {
    glowCleanup = attachMouseGlow(root);
  }

  parent.appendChild(root);
  return {
    root,
    destroy() {
      glowCleanup?.();
      root.remove();
    },
  };
}

function attachMouseGlow(root: HTMLElement): () => void {
  const glow = document.createElement('div');
  glow.className = 'mouse-glow-layer';
  glow.style.opacity = '0';
  root.appendChild(glow);

  let timeoutId: ReturnType<typeof setTimeout>;
  const onMove = (e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    glow.style.setProperty('--mouse-x', `${x}%`);
    glow.style.setProperty('--mouse-y', `${y}%`);
    glow.style.opacity = '1';
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      glow.style.opacity = '0';
    }, 1000);
  };
  document.addEventListener('mousemove', onMove);
  return () => {
    document.removeEventListener('mousemove', onMove);
    clearTimeout(timeoutId);
    glow.remove();
  };
}
