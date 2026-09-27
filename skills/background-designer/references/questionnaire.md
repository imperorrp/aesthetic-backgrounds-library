# Intake questionnaire

Ask in one message, grouped. Skip anything already answered by the repository (framework, existing CSS variables, light/dark tokens, where the hero lives).

## Context
1. What is the site or product, and which page or region gets the background? Whole page, hero only, a card, a login screen, a dashboard shell, a presentation or stream overlay?
2. Who is the audience, and what should they feel in the first second? Give three mood words (for example: calm, precise, warm; or dense, technical, alive).
3. Reference points: two sites, films, games, or images whose backgrounds you like. What specifically about them?

## Brand
4. Brand colors as hex, or the CSS variables that hold them. Which one is the accent?
5. Light theme, dark theme, or both? If both, which is primary?
6. Typeface and typical body text size and color on this page.

## Layout
7. Where does the text sit relative to the background: centered column, left column, right column, full-bleed with overlaid headline, or content in cards?
8. How much of the viewport does the background cover, and does it scroll with the page or stay fixed?
9. Are there UI elements near the edges (nav, sidebars, floating buttons) that must stay legible?

## Motion and interaction
10. Motion tolerance: still, calm (barely noticeable), ambient (noticeable, never distracting), or lively (part of the show)?
11. Should the pointer do anything (a light that follows, nodes that link to it), or nothing?
12. Any accessibility requirements beyond honoring `prefers-reduced-motion` (the engine does that by default)?

## Constraints
13. Devices: desktop only, mobile too, or low-end devices as well? Battery concerns?
14. Bundle size ceiling, if any. Framework (vanilla, React, Vue, Svelte, static HTML)?
15. Must it be deterministic per visitor (same seed every load), random each load, or seeded from something like a user id or date?

## Defaults when unanswered
Dark theme, calm motion, no pointer interaction, centered text column, mobile included, random seed at load, `intensity` 0.5.
