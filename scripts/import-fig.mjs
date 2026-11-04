import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFigDocument } from "./lib/fig.mjs";
import { extractDocs } from "./lib/figdocs.mjs";
import { extractCharts } from "./lib/figcharts.mjs";
import { extractIcons } from "./lib/figicons.mjs";
import { extractTokens } from "./lib/figtokens.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];

if (!file) {
  console.error('Usage: node scripts/import-fig.mjs "<path to .fig file>"');
  process.exit(1);
}

try {
  const figma = readFigDocument(file);
  const { primitives, semantic, skipped, stats } = extractTokens(figma);
  writeFileSync(join(root, "tokens", "primitives.json"), JSON.stringify(primitives, null, 2) + "\n");
  writeFileSync(join(root, "tokens", "semantic.json"), JSON.stringify(semantic, null, 2) + "\n");

  const { foundations, components, docs, cover, indexNote } = extractDocs(figma);
  const write = (path, data) => writeFileSync(join(root, "content", path), JSON.stringify(data, null, 2) + "\n");
  mkdirSync(join(root, "content", "docs"), { recursive: true });
  for (const component of components) rmSync(join(root, "content", "docs", `${component.slug}.json`), { force: true });
  write("foundations.json", foundations);
  const icons = extractIcons(figma);
  write("icons.json", icons);
  const charts = extractCharts(figma);
  write("charts.json", charts);
  write("cover.json", { ...cover, indexNote });
  write("components.json", components);
  for (const [slug, doc] of Object.entries(docs)) write(join("docs", `${slug}.json`), doc);

  console.log(`Primitives:        ${stats.primitives}`);
  console.log(`Semantic variables: ${stats.semantic} (${stats.withDarkVariant} with a different dark value)`);
  console.log(`Text styles:       ${stats.textStyles}`);
  console.log(`Effect styles:     ${stats.effectStyles}`);
  console.log(`Foundations pages: ${foundations.length}`);
  console.log(`Icons:             ${Object.keys(icons).length}`);
  console.log(`Components:        ${components.length} (${Object.keys(docs).length} with documentation)`);
  const undocumented = components.filter((c) => !docs[c.slug]).map((c) => c.name);
  if (undocumented.length) console.log(`  without documentation in the file: ${undocumented.join(", ")}`);
  for (const { name, variables } of skipped.collections) console.log(`Skipped collection "${name}" (${variables} variables): not part of the documented token architecture.`);
  for (const style of skipped.styles) console.log(`Skipped style: ${style}`);
  console.log("Wrote tokens/ and content/. Run npm test and npm run build next.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
