# Direction & Architecture

The Aesthetic Background Engine is a tool for dropping premium, generative, interactive backgrounds into any web project. 

The original aesthetic—a sci-fi sector extracted from a landing page (`void-tactical`)—is just the default "skin". **The true product is the engine itself:** a highly generalizable framework that handles all the tedious boilerplate of canvas backgrounds (resizing, DPR scaling, requestAnimationFrame loops, detail budgets, seeded PRNG) so developers can focus purely on aesthetics.

Local notes that must never ship: `docs/PRIVATE.md` (gitignored).

---

## The Vision: A Community of Aesthetics

Creating a custom canvas background is often too much work for a standard web project. This engine changes that by providing a robust host environment. 

The goal is to build an open-source ecosystem where anyone can write and share cool aesthetics (skins). Whether you want a calm drifting gradient, a brutalist ASCII terminal, a particle network, or abstract generative art, the engine handles the mounting, while the skin just handles the drawing.

---

## Architecture: Host vs. Skin

The architecture cleanly separates the plumbing from the art.

```
Host (createBackground, React adapter, or Web Component)
  → Skin (mount -> resize & frame)
    → World Generator (using deterministic PRNG)
    → Renderer
```

**The Host (`core`)**
- Manages the `canvas` element, DOM injection, and resize observers.
- Runs the `requestAnimationFrame` loop, throttled to a `targetFps`.
- Provides the skin with a deterministic PRNG (`rng`), canvas context (`ctx`), and the parsed configuration (budget, seed).
- Handles CSS layers (noise, gradients, meshes) via the overlay stack.

**The Skin (`skins/*`)**
- Implements the simple `BackgroundSkin` interface.
- Owns its internal state, entities, and drawing logic.
- Knows nothing about React, Web Components, or the DOM.

---

## Custom Skins & Generative AI

The `BackgroundSkin` interface is intentionally minimal:

```ts
export type BackgroundSkin = {
  id: string;
  mount(host: SkinHost): SkinInstance;
};

export type SkinInstance = {
  resize(viewport: Viewport): void;
  frame(timestamp: number): void;
  destroy(): void;
};
```

This simplicity makes the engine incredibly powerful when combined with **Generative AI**. Because the contract is so strict and isolated, LLMs are excellent at writing new skins from scratch in a single shot.

### Example LLM Prompt for Creating a New Skin

If you want to use an AI (like Claude, ChatGPT, or Gemini) to generate a new aesthetic for your site, try this prompt template:

> "Write a new skin for an aesthetic background engine. The engine provides a `SkinHost` object which contains `{ canvas, ctx, rng, config }`. I need you to implement the `BackgroundSkin` interface which requires an `id` and a `mount(host)` function. `mount` must return an object with `resize(viewport)`, `frame(timestamp)`, and `destroy()` methods.
> 
> The aesthetic I want is: [DESCRIBE YOUR AESTHETIC HERE, e.g., a retro-futuristic synthwave grid moving towards the camera with neon sun].
> 
> Use the provided `rng()` (which returns a number between 0 and 1) instead of `Math.random()` to ensure deterministic generation. Only return the TypeScript code for the skin."

---

## Sequence & Roadmap

1. **Extraction & Abstraction**: Pull the original `void-tactical` code out of the legacy codebase, establish the `BackgroundSkin` interface, and build the generic host. *(Done)*
2. **Packaging**: Create zero-dependency publishable targets for Vanilla, React, and Web Components. *(Done)*
3. **Skin Isolation**: Move any remaining `void-tactical` specific files (like `generators.ts` and `renderers/`) fully inside the `skins/void-tactical/` directory so the core engine remains strictly theme-agnostic. *(In Progress)*
4. **Validation Skin**: Document and write a second, smaller skin (e.g., a quiet gradient with drifting dust particles) to definitively prove the interface.
5. **Ecosystem**: Refine the documentation and publish to encourage the open-source community to build and share their own aesthetic skins.
