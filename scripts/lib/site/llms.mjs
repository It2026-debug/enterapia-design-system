export function renderLlmsTxt(registry, { siteUrl = "", mcpUrl = "" } = {}) {
  const base = siteUrl ? siteUrl.replace(/\/$/, "") + "/" : "";
  const line = (t) => {
    const dark = t.modes ? ` | dark: ${t.modes.dark.value}${t.modes.dark.reference ? ` (alias of ${t.modes.dark.reference})` : ""}` : "";
    return `- ${t.name}: ${t.value}${t.reference ? ` (alias of ${t.reference})` : ""}${dark} | var(${t.cssVar})${t.note ? ` | NOTE: ${t.note}` : ""}`;
  };
  const section = (layer) =>
    registry.tokens
      .filter((t) => t.layer === layer)
      .map(line)
      .join("\n");
  const components = (registry.components ?? [])
    .map((c) => {
      const props = c.parts
        .flatMap((part) => Object.entries(part.properties).map(([name, p]) => `${c.parts.length > 1 ? part.name + " " : ""}${name}: ${p.values.join(" | ")} (default ${p.default})`))
        .join("; ");
      return `- ${c.name} (${c.title}), group ${c.group} ${c.category}${c.implemented ? "" : ", NOT implemented in code yet"}${props ? `. Properties: ${props}` : ""}. Page: ${base}components/${c.slug}.html`;
    })
    .join("\n");

  return `# Enterapia Design System

> Design tokens (color in light and dark, spacing, radius, typography, elevation, focus) and UI components for Enterapia products. Version ${registry.version}.

## Current scope

- ${registry.scope.covers}
${registry.scope.doesNotCover.map((l) => `- Not available yet: ${l}`).join("\n")}
${registry.scope.notes.map((l) => `- ${l}`).join("\n")}

## Machine-readable sources

- Registry (all tokens and components, JSON): ${base}registry.json
- Design tokens as CSS custom properties (light, with dark overrides): ${base}tokens.css
- Component styles (use only the tokens): ${base}components.css
- Human-readable site: ${base || "./"}
${mcpUrl ? `- MCP server (read-only, Streamable HTTP): ${mcpUrl}` : "- MCP server: not configured for this build."}

## Rules when generating UI

- Include tokens.css and components.css, and use the component markup shown on each component page.
- Use semantic tokens in your own styles. Primitive tokens exist only to build the semantic layer.
- Reference tokens through their CSS variables, for example var(--color-text-feedback-error). Do not copy hex values.
- Do not hardcode light or dark colors: semantic color variables switch with the theme.
- Use a text style (text.*) for any text, for example font: var(--text-body-md).
- If a needed token or component does not exist, say so instead of inventing one.

## Components

${components}

## Semantic tokens

${section("semantic")}

## Primitive tokens

${section("primitive")}
`;
}
