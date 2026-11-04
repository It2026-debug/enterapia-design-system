# Enterapia Design System

Design tokens for Enterapia products, published three ways from a single source:

- **Website**: a browsable catalog of every token (GitHub Pages).
- **MCP server**: a read-only remote [Model Context Protocol](https://modelcontextprotocol.io) server so AI tools can look up tokens instead of guessing (Railway).
- **Files**: `registry.json`, `tokens.css` and `llms.txt`, served next to the website.

Tokens are extracted from the Enterapia Figma file:
https://www.figma.com/design/cUZysa9bfyJJ5340X23Yf0/Desing-System

## Current scope

The first release covers **tokens only**, for the four components defined in the Figma file: Button, Input, Badge and Card. Not available yet:

- Component code, variants and usage guidelines.
- A dark theme (the Figma file defines light values only).
- Figma variables that none of the four components reference (for example brand blue steps `200`, `400`, `800` and `900`).

An Avatar component existed in the Figma file and was removed by the design team. There are no Avatar tokens.

## How it fits together

```
tokens/primitives.json ─┐
tokens/semantic.json   ─┼─► scripts/build.mjs ─► dist/registry.json ─┬─► website + llms.txt (GitHub Pages)
tokens/meta.json       ─┘   (validates + resolves aliases)           └─► mcp/server.mjs     (Railway)
```

- **`tokens/primitives.json`**: raw values (color scales, spacing, radius, type scale). Literal values only.
- **`tokens/semantic.json`**: role-based tokens (`color.text.error`) written as references to primitives, for example `"{color.red.700}"`. Components should use these, so re-theming is a change to primitives only. Effects (shadows) are composite values and stay literal.
- **`tokens/meta.json`**: notes and status flags for tokens whose name or value needs design confirmation. Shown on the website and returned by the MCP server.

The build fails if a reference points at a token that does not exist, if references form a cycle, if a primitive is not a literal, or if two tokens would produce the same CSS variable.

## Commands

```bash
npm --prefix mcp ci   # once, installs the MCP server dependencies
npm test              # token, site and MCP server tests
npm run build         # writes dist/: index.html, registry.json, tokens.css, llms.txt
npm start             # serves the MCP endpoint at http://localhost:3000/mcp (run build first)
```

## MCP server

Read-only, stateless, Streamable HTTP. Endpoint: `POST /mcp`. Health check: `GET /health`.

| Tool | Purpose |
| --- | --- |
| `get_design_system_info` | Version, scope, token counts and the rules for generating UI. Start here. |
| `list_tokens` | List tokens, filtered by layer and category. |
| `get_token` | One token by name, including what it aliases and what aliases it. |
| `search_tokens` | Find tokens by words in the name, value, CSS variable or note. |
| `get_css` | The tokens as a CSS `:root` block. |

To connect a client, point it at the deployed `/mcp` URL (for example in Claude: Settings, Connectors, add a custom connector).

## Deploying

- **Website**: `.github/workflows/pages.yml` builds and deploys on every merge to `main`. One-time setup in the repository settings: Pages, Source = GitHub Actions. Set the repository variable `MCP_URL` to the public MCP URL so the site links to it.
- **MCP server**: the root `Dockerfile` builds the registry into the image and starts the server, so a deploy always serves the tokens from the commit it was built from. Create a Railway service from this repository and let it use the Dockerfile. Railway provides `PORT`.

## Known issues with the Figma data

Figma's own variable names lag their current values in a few places. `Typography/Font Size/Body/14` resolves to 16px (the same as `body16`) and `Body/18` resolves to 20px. The names are kept so every token stays traceable to its Figma variable, and they are flagged in `tokens/meta.json`. The values are correct and current.

Several primitive names (`red`, `green`, `amber`, the extra grays and `neutral.white`) were chosen when promoting raw hex values that previously lived only in the semantic layer. They are marked `provisional` until checked against the Figma variable collection.

## Updating tokens from Figma

Figma is the source for **tokens only**. New components are designed and built outside Figma.

1. In the Figma desktop app, use the Figma MCP server's `get_variable_defs` on the frames you want to export.
2. Update `tokens/primitives.json`, `tokens/semantic.json` and `tokens/meta.json`. Keep semantic values as references to primitives.
3. Run `npm test` and `npm run build`, then open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md).
