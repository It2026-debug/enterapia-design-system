# Contributing

## Changing tokens

1. Create a branch from `main`.
2. Edit the files in `tokens/`:
   - Add raw values to `primitives.json`.
   - Express roles in `semantic.json` as references to primitives (`"{color.red.700}"`). Do not paste hex values there.
   - If a name or value needs design confirmation, add an entry to `meta.json` with a `status` (`provisional`, `stale-name` or `review`) and a `note`.
3. Run `npm --prefix mcp ci` (first time only), then `npm test` and `npm run build`.
4. Open the built site (`dist/index.html`) and check your change visually.
5. Open a pull request. CI runs the tests and the build. A merge to `main` publishes the website.

## What counts as a breaking change

- Renaming or removing a token: breaking. Keep the old name working or announce the removal in the pull request.
- Changing a token's value: not breaking for the API, but visible in products. Call it out in the pull request.
- Adding a token: not breaking.

## Components

The Figma file is the source for tokens only. New components are designed outside Figma and added to this repository together with their tokens. Component code is not part of the first release.
