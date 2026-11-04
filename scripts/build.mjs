import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import defaultDefinitions from "../components/index.mjs";
import { componentsForRegistry } from "./lib/components-data.mjs";
import { byNumber, normalizeLocalComponent } from "./lib/local-components.mjs";
import { renderLlmsTxt } from "./lib/site/llms.mjs";
import { renderSiteFiles } from "./lib/site/index.mjs";
import { buildRegistry, renderCss } from "./lib/tokens.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), "utf8"));
const readJsonIf = (fallback, ...parts) => (existsSync(join(root, ...parts)) ? readJson(...parts) : fallback);

function loadContent() {
  const docs = {};
  const docsDir = join(root, "content", "docs");
  if (existsSync(docsDir)) {
    for (const file of readdirSync(docsDir).filter((f) => f.endsWith(".json"))) docs[file.replace(/\.json$/, "")] = readJson("content", "docs", file);
  }
  return {
    foundations: readJsonIf([], "content", "foundations.json"),
    components: [...readJsonIf([], "content", "components.json"), ...readJsonIf([], "content", "components.local.json").map(normalizeLocalComponent)].sort(byNumber),
    cover: readJsonIf({ title: "", description: "", question: "", items: [] }, "content", "cover.json"),
    docs,
  };
}

export function build({ outDir = join(root, "dist"), siteUrl = "", mcpUrl = "", definitions = defaultDefinitions } = {}) {
  const registry = buildRegistry({
    primitives: readJson("tokens", "primitives.json"),
    semantic: readJson("tokens", "semantic.json"),
    meta: readJson("tokens", "meta.json"),
    about: readJson("tokens", "about.json"),
    pkg: readJson("package.json"),
  });
  const content = loadContent();
  registry.components = componentsForRegistry({ content, defs: definitions, root });

  const componentCss = content.components
    .map((meta) => join(root, "components", meta.slug, `${meta.slug}.css`))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8").trim())
    .join("\n\n");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "registry.json"), JSON.stringify(registry, null, 2) + "\n");
  writeFileSync(join(outDir, "tokens.css"), renderCss(registry));
  writeFileSync(join(outDir, "components.css"), `/* Generated from the CSS files under components/. Uses only the tokens in tokens.css. */\n${componentCss}\n`);
  writeFileSync(join(outDir, "llms.txt"), renderLlmsTxt(registry, { siteUrl, mcpUrl }));
  writeFileSync(join(outDir, ".nojekyll"), "");

  for (const file of ["site.css", "site.js", "fonts.css"]) cpSync(join(root, "site", file), join(outDir, file));
  cpSync(join(root, "site", "fonts"), join(outDir, "fonts"), { recursive: true });

  const pages = renderSiteFiles({ registry, content, defs: definitions, options: { siteUrl, mcpUrl } });
  for (const [path, html] of pages) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    writeFileSync(join(outDir, path), html);
  }
  return { registry, outDir, pages: [...pages.keys()] };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { registry, outDir, pages } = build({
      siteUrl: process.env.SITE_URL ?? "",
      mcpUrl: process.env.MCP_URL ?? "",
    });
    const implemented = registry.components.filter((c) => c.implemented).length;
    console.log(`Built ${registry.counts.total} tokens (${registry.counts.semantic} semantic, ${registry.counts.primitive} primitive), ${implemented}/${registry.components.length} components implemented, ${pages.length} pages into ${outDir}`);
  } catch (error) {
    console.error(error.stack ?? error.message);
    process.exit(1);
  }
}
