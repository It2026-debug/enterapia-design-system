import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, parse, resolve, sep } from "node:path";
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

const OUTPUT_MARKER = ".ds-build";

/** The build empties its output folder, so refuse anything that is not clearly a build folder. */
export function assertSafeOutDir(outDir) {
  const target = resolve(outDir);
  const dangerous = target === parse(target).root || target === homedir() || target === root || root.startsWith(target + sep);
  if (dangerous) throw new Error(`Refusing to use "${target}" as the build output: it contains or is this repository.`);
  const isDefault = target === join(root, "dist");
  if (!isDefault && existsSync(target) && readdirSync(target).length > 0 && !existsSync(join(target, OUTPUT_MARKER))) {
    throw new Error(`Refusing to empty "${target}": it is not empty and was not created by this build.`);
  }
  return target;
}

export function assertHttpUrl(name, value) {
  if (value === "" || value === undefined) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL: "${value}".`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`${name} must be an http or https URL, got "${url.protocol}".`);
}

export function build({ outDir = join(root, "dist"), siteUrl = "", mcpUrl = "", definitions = defaultDefinitions } = {}) {
  const output = assertSafeOutDir(outDir);
  assertHttpUrl("siteUrl", siteUrl);
  assertHttpUrl("mcpUrl", mcpUrl);
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
    .concat(existsSync(join(root, "components", "forced-colors.css")) ? [readFileSync(join(root, "components", "forced-colors.css"), "utf8").trim()] : [])
    .join("\n\n");

  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, OUTPUT_MARKER), "Created by scripts/build.mjs. This folder is emptied on every build.\n");
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
