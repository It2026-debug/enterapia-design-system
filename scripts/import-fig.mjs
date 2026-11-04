import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFigDocument } from "./lib/fig.mjs";
import { extractDocs } from "./lib/figdocs.mjs";
import { extractCharts } from "./lib/figcharts.mjs";
import { assertLooksLikeEnterapia } from "./lib/import-checks.mjs";
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
  // Extract everything first: nothing is written unless the whole file reads correctly.
  const { primitives, semantic, skipped, stats } = extractTokens(figma);
  const { foundations, components, docs, cover, indexNote, warnings } = extractDocs(figma);
  const icons = extractIcons(figma);
  const charts = extractCharts(figma);
  assertLooksLikeEnterapia({ stats, foundations, components });

  const write = (path, data) => writeFileSync(join(root, path), JSON.stringify(data, null, 2) + "\n");
  mkdirSync(join(root, "content", "docs"), { recursive: true });
  write("tokens/primitives.json", primitives);
  write("tokens/semantic.json", semantic);
  for (const component of components) rmSync(join(root, "content", "docs", `${component.slug}.json`), { force: true });
  write("content/foundations.json", foundations);
  write("content/cover.json", { ...cover, indexNote });
  write("content/icons.json", icons);
  write("content/charts.json", charts);
  write("content/components.json", components);
  for (const [slug, doc] of Object.entries(docs)) write(`content/docs/${slug}.json`, doc);

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
  for (const warning of warnings) console.log(`Warning: ${warning}`);
  console.log("Wrote tokens/ and content/. Run npm test and npm run build next.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
