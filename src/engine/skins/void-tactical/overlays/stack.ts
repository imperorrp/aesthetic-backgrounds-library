import overlayCss from '../overlays.css?inline';
import { DEFAULT_OVERLAYS, OVERLAY_CLASS, type OverlayFlags, type OverlayId } from './flags';

export { injectEngineFonts } from '../../../core/fonts';

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

export type OverlayStackHandle = {
  root: HTMLDivElement;
  destroy(): void;
};

export type OverlayStackOptions = {
  /** `fixed` (default) covers the viewport; `absolute` fills a positioned parent such as the engine root. */
  position?: 'fixed' | 'absolute';
  /** Lines for the two big faint word layers (the universe pack's `ambient`). */
  words?: string[];
};

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** The far word layer: four lines scattered over a wide tactical grid. */
function wordsLayer1(words: string[]): string {
  const at = [[100, 100], [800, 200], [300, 800], [1200, 600]];
  const text = at.map(([x, y], i) => (words[i] ? `<text x='${x}' y='${y}' class='t'>${xml(words[i])}</text>` : '')).join('');
  const grid = [200, 400, 600, 800].map((y) => `<line x1='0' y1='${y}' x2='1600' y2='${y}' class='g'/>`).join('')
    + [200, 400, 600, 800, 1000, 1200, 1400].map((x) => `<line x1='${x}' y1='0' x2='${x}' y2='1200' class='g'/>`).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 1200'><defs><style>.s{fill:#06b6d4;opacity:0.3}.l{stroke:#06b6d4;stroke-width:0.6;opacity:0.15}.t{font-family:monospace;font-size:12px;fill:#34a853;opacity:0.25;letter-spacing:1px}.g{stroke:#06b6d4;stroke-width:1.2;opacity:0.1}</style></defs><circle cx='120' cy='140' r='3' class='s'/><circle cx='232' cy='190' r='2' class='s'/><circle cx='420' cy='260' r='1.5' class='s'/><line x1='120' y1='140' x2='232' y2='190' class='l'/><line x1='232' y1='190' x2='420' y2='260' class='l'/><circle cx='900' cy='700' r='3.5' class='s'/><circle cx='1080' cy='610' r='2.5' class='s'/><line x1='900' y1='700' x2='1080' y2='610' class='l'/>${text}${grid}</svg>`;
}

/** The near word layer: eight lines with sensor marks between them. */
function wordsLayer2(words: string[]): string {
  const at = [[80, 80], [600, 120], [160, 200], [470, 300], [80, 400], [600, 500], [300, 600], [80, 700]];
  const text = at.map(([x, y], i) => (words[i] ? `<text x='${x}' y='${y}' class='t'>${xml(words[i])}</text>` : '')).join('');
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 800'><defs><style>.t{font-family:monospace;font-size:14px;fill:#34a853;opacity:0.3;letter-spacing:1px}.h{fill:none;stroke:#06b6d4;stroke-width:0.8;opacity:0.15}.r{fill:#ff4500;opacity:0.2}.b{fill:#00bfff;opacity:0.15}</style></defs>${text}<circle cx='400' cy='330' r='8' class='h'/><circle cx='200' cy='150' r='18' class='r'/><circle cx='200' cy='150' r='28' fill='none' stroke='#ff4500' stroke-width='0.8' opacity='0.1'/><circle cx='800' cy='650' r='15' class='r'/><circle cx='600' cy='400' r='12' class='b'/><circle cx='600' cy='400' r='20' fill='none' stroke='#00bfff' stroke-width='0.4' opacity='0.12'/><circle cx='150' cy='550' r='10' class='b'/></svg>`;
}

export function createOverlayStack(
  parent: HTMLElement,
  layers: OverlayFlags = {},
  { position = 'fixed', words }: OverlayStackOptions = {},
): OverlayStackHandle {
  injectEngineStyles();
  const flags = { ...DEFAULT_OVERLAYS, ...layers };
  const root = document.createElement('div');
  root.className = 'ambient-stack';
  root.setAttribute('aria-hidden', 'true');
  root.style.position = position;

  (Object.keys(OVERLAY_CLASS) as Exclude<OverlayId, 'mouseGlow'>[]).forEach((id) => {
    if (!flags[id]) return;
    const el = document.createElement('div');
    el.className = OVERLAY_CLASS[id];
    if (words?.length && id === 'ascii1') el.style.backgroundImage = svgUrl(wordsLayer1(words.slice(0, 4)));
    if (words?.length && id === 'ascii2') el.style.backgroundImage = svgUrl(wordsLayer2(words.slice(4, 12).length ? words.slice(4, 12) : words));
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
