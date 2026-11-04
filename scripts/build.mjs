import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRegistry, renderCss } from "./lib/tokens.mjs";
import { renderLlmsTxt, renderSite } from "./lib/site.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), "utf8"));

export function build({ outDir = join(root, "dist"), siteUrl = "", mcpUrl = "" } = {}) {
  const registry = buildRegistry({
    primitives: readJson("tokens", "primitives.json"),
    semantic: readJson("tokens", "semantic.json"),
    meta: readJson("tokens", "meta.json"),
    pkg: readJson("package.json"),
  });

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "registry.json"), JSON.stringify(registry, null, 2) + "\n");
  writeFileSync(join(outDir, "tokens.css"), renderCss(registry));
  writeFileSync(join(outDir, "index.html"), renderSite(registry, { siteUrl, mcpUrl }));
  writeFileSync(join(outDir, "llms.txt"), renderLlmsTxt(registry, { siteUrl, mcpUrl }));
  writeFileSync(join(outDir, ".nojekyll"), "");
  return { registry, outDir };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { registry, outDir } = build({
      siteUrl: process.env.SITE_URL ?? "",
      mcpUrl: process.env.MCP_URL ?? "",
    });
    console.log(`Built ${registry.counts.total} tokens (${registry.counts.semantic} semantic, ${registry.counts.primitive} primitive) into ${outDir}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
