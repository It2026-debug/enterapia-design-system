# Contributing

## Changing tokens, the component list or the documentation text

These come from Figma. `tokens/primitives.json`, `tokens/semantic.json` and the generated files in `content/` are written by the importer, so do not edit them by hand.

1. Change the variables, styles, components or documentation in Figma.
2. Save a local copy of the file (File, Save local copy) and run `npm run import:fig -- "<file>.fig"`. See the README for details. Never commit the `.fig` file.
3. Run `npm --prefix mcp ci` (first time only), then `npm test` and `npm run build`.
4. Open the built site (`dist/index.html`), switch between the light and dark themes, and check your change visually.
5. Open a pull request. CI runs the tests and the build. A merge to `main` publishes the website.

If a token needs a note for design or for the people using the system, add it to `tokens/meta.json` with an optional `status` (`provisional`, `stale-name` or `review`) and a `note`. Scope text and general notes go in `tokens/about.json`.

## Changing how a component looks or behaves in code

Components are hand-written in `components/<slug>/`:

- `<slug>.css` uses design tokens only. No hex or rgb colors, no variables that are not tokens (a test checks this). Fixed sizes that Figma does not tokenize, such as a 40 px height, are fine.
- `index.mjs` returns the markup for each variant from its properties. Escape every text you put in the markup (use `esc`), and list the accessibility notes for the people using the component.
- Show states with real pseudo-classes and a matching `data-state` attribute, so the documentation can display them without interaction.

Every Figma variant must render (a test checks all of them). After a change, open the component page and compare the variants with Figma.

## Adding a component that is not in Figma

See "Adding a component that is not in Figma" in the README: an entry in `content/components.local.json`, the CSS and markup files, and an optional documentation file.

## What counts as a breaking change

- Renaming or removing a token, a component class or a variant: breaking. Mention it in the pull request.
- Changing a token's value or a component's appearance: not breaking for the API, but visible in products. Call it out in the pull request.
- Adding a token, a component or a variant: not breaking.
