import { mount, type MountHandle, type MountOptions } from './engine/core/mount';
import type { LabelDensity } from './engine/types';
import type { PaletteId } from './engine/palette';

/**
 * Drop-in custom element.
 *
 * @example
 * <script type="module" src="https://unpkg.com/space-background-engine/dist/element.js"></script>
 * <bg-engine seed="orion-7" detail="low"></bg-engine>
 */
class BgEngineElement extends HTMLElement {
  static get observedAttributes() {
    return ['seed', 'density', 'detail', 'palette', 'speed'];
  }

  #handle: MountHandle | null = null;

  connectedCallback(): void {
    this.style.display = this.style.display || 'block';
    this.style.pointerEvents = 'none';
    this.style.zIndex = this.style.zIndex || '0';
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

  #start(): void {
    const densityAttr = this.getAttribute('density');
    const speedAttr = this.getAttribute('speed');
    const options: MountOptions = {
      seed: this.getAttribute('seed') ?? undefined,
      detail: (this.getAttribute('detail') as LabelDensity | null) ?? undefined,
      palette: (this.getAttribute('palette') as PaletteId | null) ?? undefined,
      density: densityAttr ? Number(densityAttr) : undefined,
      cameraSpeed: speedAttr ? Number(speedAttr) : undefined,
      fonts: this.getAttribute('fonts') !== 'false',
    };
    this.#handle = mount(this, options);
  }
}

if (!customElements.get('bg-engine')) {
  customElements.define('bg-engine', BgEngineElement);
}

export { BgEngineElement };
