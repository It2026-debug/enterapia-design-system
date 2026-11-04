import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { CATEGORIES, renderCss } from "../scripts/lib/tokens.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 256 * 1024;
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const RULES = [
  "Include tokens.css and components.css. Use the markup returned by get_component and its ds-* classes instead of writing your own styles.",
  "Use semantic tokens (layer: semantic) in components. Primitive tokens exist only to build the semantic layer.",
  "Reference tokens through their CSS variables, for example var(--color-text-feedback-error). Do not copy hex values.",
  "Do not hardcode light or dark colors: semantic color variables switch with the theme (data-theme on <html>, or the system preference).",
  "Use a text style (text.*) for any text, for example font: var(--text-body-md).",
  "If a needed token does not exist, say so instead of inventing a value.",
  "Tokens with a status or note have open questions awaiting confirmation from design.",
];

export function loadRegistry(dataDir) {
  return JSON.parse(readFileSync(join(dataDir, "registry.json"), "utf8"));
}

const asText = (value) => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const asError = (message) => ({ isError: true, content: [{ type: "text", text: message }] });

const brief = (t) => ({
  name: t.name,
  value: t.value,
  ...(t.modes ? { darkValue: t.modes.dark.value } : {}),
  reference: t.reference,
  cssVar: t.cssVar,
  layer: t.layer,
  category: t.category,
  status: t.status,
});

export function searchTokens(registry, query, limit) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return registry.tokens
    .map((t) => {
      const name = t.name.toLowerCase();
      const rest = [t.value, t.modes?.dark.value, t.cssVar, t.reference, t.note].filter(Boolean).join(" ").toLowerCase();
      if (!terms.every((term) => name.includes(term) || rest.includes(term))) return null;
      return { token: t, score: terms.reduce((sum, term) => sum + (name.includes(term) ? 2 : 1), 0) };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.token.name.localeCompare(b.token.name))
    .slice(0, limit)
    .map(({ token }) => brief(token));
}

const normalize = (value) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const clip = (value, max = 60) => (String(value).length > max ? `${String(value).slice(0, max)}…` : String(value));

/** Returns { component } for a clear match, { ambiguous } when several match, or {} when none do. */
export function findComponent(registry, name) {
  const wanted = normalize(name);
  const components = registry.components ?? [];
  const exact = components.find((c) => normalize(c.slug) === wanted || normalize(c.name) === wanted || normalize(c.title) === wanted);
  if (exact) return { component: exact };
  if (wanted.length < 3) return {};
  const partial = components.filter((c) => normalize(c.title).includes(wanted) || normalize(c.name).includes(wanted) || normalize(c.slug).includes(wanted));
  if (partial.length === 1) return { component: partial[0] };
  return partial.length > 1 ? { ambiguous: partial } : {};
}

const componentBrief = (c) => ({
  slug: c.slug,
  number: c.number,
  name: c.name,
  title: c.title,
  group: c.group,
  category: c.category,
  implemented: c.implemented,
  variantCount: c.variantCount,
  parts: c.parts.map((part) => ({ name: part.name, properties: Object.fromEntries(Object.entries(part.properties).map(([axis, p]) => [axis, p.values])) })),
});

export function buildMcpServer(registry) {
  const server = new McpServer({ name: registry.name, version: registry.version });
  const byName = new Map(registry.tokens.map((t) => [t.name, t]));

  server.registerTool(
    "get_design_system_info",
    {
      title: "Design system overview",
      description: "Start here. Returns the version, what the design system currently covers and does not cover, token counts, and the rules to follow when generating UI.",
      annotations: READ_ONLY,
    },
    async () =>
      asText({
        name: registry.name,
        version: registry.version,
        description: registry.description,
        scope: registry.scope,
        counts: { ...registry.counts, components: (registry.components ?? []).length },
        themes: { modes: registry.modes, default: registry.defaultMode, note: "Tokens with a darkValue (or a modes field) differ in dark; the CSS variable switches automatically." },
        categories: CATEGORIES,
        layers: { primitive: "Raw values with no meaning of their own.", semantic: "Role-based aliases that components should use." },
        rules: RULES,
      }),
  );

  server.registerTool(
    "list_tokens",
    {
      title: "List tokens",
      description: "Lists tokens, optionally filtered by layer and category. Returns name, resolved value (light), darkValue when it differs, the token it aliases, and its CSS variable.",
      inputSchema: {
        layer: z.enum(["primitive", "semantic"]).optional().describe("Only tokens in this layer."),
        category: z.enum(CATEGORIES).optional().describe("Only tokens in this category."),
      },
      annotations: READ_ONLY,
    },
    async ({ layer, category }) => {
      const tokens = registry.tokens.filter((t) => (!layer || t.layer === layer) && (!category || t.category === category));
      return asText({ count: tokens.length, tokens: tokens.map(brief) });
    },
  );

  server.registerTool(
    "get_token",
    {
      title: "Get one token",
      description: "Returns everything known about one token by its dotted name, for example color.text.feedback.error, including its light and dark values. For a primitive it also lists the tokens that alias it.",
      inputSchema: { name: z.string().min(1).describe("Dotted token name, for example color.text.feedback.error.") },
      annotations: READ_ONLY,
    },
    async ({ name }) => {
      const token = byName.get(name);
      if (token) return asText(token);
      const similar = searchTokens(registry, clip(name, 120).replace(/[._-]+/g, " "), 5).map((t) => t.name);
      return asError(`No token named "${clip(name)}".${similar.length ? ` Similar tokens: ${similar.join(", ")}.` : " Use search_tokens or list_tokens to find valid names."}`);
    },
  );

  server.registerTool(
    "search_tokens",
    {
      title: "Search tokens",
      description: "Finds tokens whose name, value (light or dark), CSS variable or note contains every word in the query, for example 'error text' or '#d42515'.",
      inputSchema: {
        query: z.string().min(1).describe("One or more words; all must match."),
        limit: z.number().int().min(1).max(100).default(25).describe("Maximum results."),
      },
      annotations: READ_ONLY,
    },
    async ({ query, limit }) => {
      const tokens = searchTokens(registry, query, limit);
      return asText({ count: tokens.length, tokens });
    },
  );

  server.registerTool(
    "get_css",
    {
      title: "Get CSS custom properties",
      description: "Returns the tokens as CSS custom properties: a :root block for light plus dark overrides. Semantic variables alias primitive ones with var(), so include the primitive layer (omit `layer`) unless the page already loads it.",
      inputSchema: { layer: z.enum(["primitive", "semantic"]).optional().describe("Only this layer. Omit for everything.") },
      annotations: READ_ONLY,
    },
    async ({ layer }) => asText(renderCss({ tokens: registry.tokens.filter((t) => !layer || t.layer === layer) })),
  );

  server.registerTool(
    "list_components",
    {
      title: "List components",
      description: "Lists the UI components (as organized in Figma: Acción, Formulario, Contenedor, Feedback, Overlay, Base, Datos) with their properties and variant counts. Optionally filter by a word in the name or by category.",
      inputSchema: {
        query: z.string().optional().describe("Words to look for in the name or title, for example 'button' or 'formulario'."),
        category: z.string().optional().describe("Category name, for example Formulario or Feedback."),
      },
      annotations: READ_ONLY,
    },
    async ({ query, category }) => {
      const wantedQuery = query ? normalize(query) : null;
      const wantedCategory = category ? normalize(category) : null;
      const list = (registry.components ?? []).filter(
        (c) =>
          (!wantedQuery || normalize(`${c.name} ${c.title} ${c.category}`).includes(wantedQuery)) &&
          (!wantedCategory || normalize(c.category) === wantedCategory),
      );
      return asText({ count: list.length, components: list.map(componentBrief) });
    },
  );

  server.registerTool(
    "get_component",
    {
      title: "Get one component",
      description: "Returns a component: the design team's documentation (when to use it, do and don't), its properties and variants, accessibility notes, the HTML markup of a variant, and the CSS. Pass `properties` to get the markup of one specific variant, for example {\"Style\":\"Primary\",\"Size\":\"MD\",\"State\":\"Hover\"}. Set includeAllExamples to receive the markup of every variant.",
      inputSchema: {
        name: z.string().min(1).describe("Component name, title or slug, for example Button, Select or close-button."),
        properties: z.record(z.string(), z.string()).optional().describe("Variant properties, for example {\"State\":\"Disabled\"}. Missing ones use the default."),
        part: z.string().optional().describe("For components made of several pieces (such as Tabla), the piece name, for example 'Table Row'."),
        includeAllExamples: z.boolean().default(false).describe("Return the markup of every variant."),
      },
      annotations: READ_ONLY,
    },
    async ({ name, properties, part: partName, includeAllExamples }) => {
      const { component, ambiguous } = findComponent(registry, name);
      if (ambiguous) return asError(`"${clip(name)}" matches several components: ${ambiguous.map((c) => c.slug).join(", ")}. Use one of those names.`);
      if (!component) {
        const names = (registry.components ?? []).map((c) => c.slug).join(", ");
        return asError(`No component named "${clip(name)}". Available: ${names}.`);
      }
      const part = partName ? component.parts.find((p) => normalize(p.name) === normalize(partName)) : component.parts[0];
      if (!part) return asError(`"${component.name}" has no part named "${clip(partName)}". Parts: ${component.parts.map((p) => p.name).join(", ")}.`);

      let example = null;
      if (component.implemented) {
        const wanted = Object.entries(properties ?? {});
        const base = part.examples[0];
        example = part.examples.find((e) => wanted.length && wanted.every(([k, v]) => e.props[k] === v)) ?? (wanted.length ? null : base);
        if (wanted.length && !example) {
          const merged = { ...base.props, ...properties };
          example = part.examples.find((e) => Object.entries(merged).every(([k, v]) => e.props[k] === v)) ?? null;
        }
        if (wanted.length && !example) {
          return asError(`No variant of "${component.name}" (${part.name}) matches ${JSON.stringify(properties)}. Properties: ${JSON.stringify(Object.fromEntries(Object.entries(part.properties).map(([k, p]) => [k, p.values])))}.`);
        }
      }
      return asText({
        ...componentBrief(component),
        documentation: component.documentation,
        accessibility: component.accessibility,
        selectedPart: part.name,
        properties: part.properties,
        example: example ? { name: example.name, props: example.props, html: example.html } : null,
        ...(includeAllExamples ? { examples: part.examples } : { variantNames: part.examples.map((e) => e.name) }),
        css: component.css,
        usage: component.implemented ? "Include tokens.css and components.css, then use the html markup above." : "Not implemented in code yet; only the Figma specification exists.",
      });
    },
  );

  return server;
}

const SECURITY = { "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
  "access-control-max-age": "86400",
};

const sendJson = (res, status, body, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json", ...CORS, ...SECURITY, ...headers });
  res.end(JSON.stringify(body));
};

const rpcError = (code, message) => ({ jsonrpc: "2.0", error: { code, message }, id: null });

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body is not valid JSON."), { status: 400 });
  }
}

export function createApp({ dataDir }) {
  const registry = loadRegistry(dataDir);

  return createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, { ...CORS, ...SECURITY });
        return res.end();
      }
      const readOnly = req.method === "GET" || req.method === "HEAD";
      if (path === "/health" && readOnly) {
        return sendJson(res, 200, { status: "ok", name: registry.name, version: registry.version, tokens: registry.counts.total, components: (registry.components ?? []).length }, { "cache-control": "no-store" });
      }
      if (path === "/" && readOnly) {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8", ...CORS, ...SECURITY });
        return res.end(`${registry.name} v${registry.version}\nRead-only MCP server (Streamable HTTP). Endpoint: POST /mcp\nHealth: GET /health\n`);
      }
      if (path === "/mcp") {
        if (req.method !== "POST") {
          return sendJson(res, 405, rpcError(-32000, "Method not allowed. This server is stateless: use POST."), { allow: "POST, OPTIONS" });
        }
        const body = await readBody(req);
        const server = buildMcpServer(registry);
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.on("close", () => {
          transport.close();
          server.close();
        });
        await server.connect(transport);
        return await transport.handleRequest(req, res, body);
      }
      return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      const status = error.status ?? 500;
      if (status === 500) console.error("MCP request failed:", error.message);
      if (!res.headersSent) sendJson(res, status, rpcError(status === 500 ? -32603 : -32600, status === 500 ? "Internal server error." : error.message));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataDir = resolve(process.env.DATA_DIR ?? join(here, "..", "dist"));
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp({ dataDir });
  app.listen(port, "0.0.0.0", () => console.log(`MCP server listening on :${port} (data: ${dataDir})`));
  process.on("SIGTERM", () => app.close(() => process.exit(0)));
}
