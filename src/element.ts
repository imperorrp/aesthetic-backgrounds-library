import { mount, type MountHandle, type MountOptions } from './engine/core/mount';
import type { LabelDensity, MotionPreference } from './engine/config';
// Importing these registers the built-in skins, layers, and presets so `skin="calm-mesh"` resolves.
import { builtInSkins } from './engine/skins';
import { presets } from './engine/presets';

/**
 * Drop-in custom element.
 *
 * @example
 * <script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
 * <bg-engine seed="orion-7" detail="low"></bg-engine>
 * <bg-engine skin="matrix-rain" palette="#ff7a1a" intensity="0.6" motion="auto" fonts></bg-engine>
 */
class BgEngineElement extends HTMLElement {
  static get observedAttributes() {
    return ['seed', 'density', 'detail', 'palette', 'speed', 'skin', 'fonts', 'z-index', 'intensity', 'motion', 'fps'];
  }

  /** Skins bundled with the element build; any of their ids works in the `skin` attribute. */
  static readonly skins = builtInSkins;
  /** Presets bundled with the element build (scenes registered as skins). */
  static readonly presets = presets;

  #handle: MountHandle | null = null;

  connectedCallback(): void {
    this.style.display = this.style.display || 'block';
    this.style.pointerEvents = 'none';
    this.style.zIndex = this.style.zIndex || this.getAttribute('z-index') || '0';
    if (this.parentElement === document.body || this.parentElement === document.documentElement) {
      this.style.position = this.style.position || 'fixed';
      this.style.inset = this.style.inset || '0';
      this.style.width = this.style.width || '100%';
      this.style.height = this.style.height || '100%';
      this.style.minHeight = this.style.minHeight || '100vh';
    } else {
      this.style.position = this.style.position || 'absolute';
      this.style.inset = this.style.inset || '0';
      this.style.width = this.style.width || '100%';
      this.style.height = this.style.height || '100%';
    }
    this.#start();
  }

  disconnectedCallback(): void {
    this.#handle?.destroy();
    this.#handle = null;
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#handle?.destroy();
    this.#start();
  }

  /** The live mount handle (canvas, root, pause/resume, destroy). Null before connection. */
  get handle(): MountHandle | null {
    return this.#handle;
  }

  #number(name: string): number | undefined {
    const raw = this.getAttribute(name);
    if (raw === null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }

  #start(): void {
    const options: MountOptions = {
      seed: this.getAttribute('seed') ?? undefined,
      skin: this.getAttribute('skin') ?? undefined,
      detail: (this.getAttribute('detail') as LabelDensity | null) ?? undefined,
      // Built-in id or a hex brand color; resolvePalette handles both.
      palette: this.getAttribute('palette') ?? undefined,
      density: this.#number('density'),
      cameraSpeed: this.#number('speed'),
      intensity: this.#number('intensity'),
      targetFps: this.#number('fps'),
      motion: (this.getAttribute('motion') as MotionPreference | null) ?? undefined,
      fonts: this.hasAttribute('fonts'),
    };
    this.#handle = mount(this, options);
  }
}

if (!customElements.get('bg-engine')) {
  customElements.define('bg-engine', BgEngineElement);
}

export { BgEngineElement };
