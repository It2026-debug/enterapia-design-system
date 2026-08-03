# Enterapia Design System — Tokens

Design tokens extracted from the Enterapia Figma file via the Figma MCP server:

https://www.figma.com/design/cUZysa9bfyJJ5340X23Yf0/Desing-System

## Architecture: primitives → semantic

Tokens are split into two layers, in `tokens/`:

- **`primitives.json`** — raw, context-free values: the brand/neutral color scales,
  the spacing scale, the radius scale, and the type scale (font family, size,
  line-height, weight). These have no meaning on their own; they're just the set of
  values available to build with.
- **`semantic.json`** — purpose-bound aliases layered on top of the primitives, named
  for their *role* (`color.text.error`, `color.surface.background`,
  `effects.cardShadowHover`) rather than their raw value. Components should consume
  semantic tokens, not primitives directly, so re-theming stays a token-only change.

## Source and scope

These values were read live from the Figma file's variables via `get_variable_defs`
(Figma MCP), scoped to the four top-level components currently defined in the file's
"Components" page: **Button, Input, Badge, Card**. The file does not have a separate
Foundations/palette page, so this export reflects the union of every variable those
four components actually reference — not necessarily every variable that exists in
the file's variable collections (e.g. brand-blue steps like `200`, `400`, `800`, `900`
aren't used by any of the four components and so aren't captured here).

An **Avatar** component previously existed in this file but was removed by the design
team; there are no Avatar tokens or references in this export.

## A naming quirk worth knowing

Figma's own variable names lag their current resolved values in a few places — e.g.
`Typography/Font Size/Body/14` currently resolves to `16px`, and `Body/18` resolves to
`20px`. That's not a transcription error here; it's carried over faithfully from the
file. `primitives.json` keeps the original (now slightly misleading) key names
(`body14`, `body18`) so this export stays traceable back to the Figma variable it came
from — the *values* are correct and current.

## Regenerating this export

1. Open the Figma file above in the Figma desktop app.
2. Via the Figma MCP server, call `get_variable_defs` against each top-level component
   frame under the "Components" page (Button, Input, Badge, Card, and any future
   additions).
3. Update `tokens/primitives.json` and `tokens/semantic.json` with any new or changed
   values, following the existing category structure.
