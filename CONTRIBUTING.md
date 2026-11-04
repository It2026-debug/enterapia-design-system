# Contributing

## Changing tokens

Tokens are defined in Figma. `tokens/primitives.json` and `tokens/semantic.json` are generated from it, so do not edit them by hand.

1. Change the variables or styles in Figma.
2. Save a local copy of the file (File, Save local copy) and run `npm run import:fig -- "<file>.fig"`. See the README for details. Never commit the `.fig` file.
3. Run `npm --prefix mcp ci` (first time only), then `npm test` and `npm run build`.
4. Open the built site (`dist/index.html`), switch between the light and dark themes, and check your change visually.
5. Open a pull request. CI runs the tests and the build. A merge to `main` publishes the website.

If a token needs a note for design or for the people using the system, add it to `tokens/meta.json` with an optional `status` (`provisional`, `stale-name` or `review`) and a `note`. Scope text and general notes go in `tokens/about.json`.

## What counts as a breaking change

- Renaming or removing a token: breaking. Mention it in the pull request.
- Changing a token's value: not breaking for the API, but visible in products. Call it out in the pull request.
- Adding a token: not breaking.

## Components

The Figma file is the source for tokens only. New components are designed outside Figma and added to this repository together with their tokens. Component code is not part of the first release.
