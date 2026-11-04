import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFigDocument } from "./lib/fig.mjs";
import { extractTokens } from "./lib/figtokens.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];

if (!file) {
  console.error('Usage: node scripts/import-fig.mjs "<path to .fig file>"');
  process.exit(1);
}

try {
  const { primitives, semantic, skipped, stats } = extractTokens(readFigDocument(file));
  writeFileSync(join(root, "tokens", "primitives.json"), JSON.stringify(primitives, null, 2) + "\n");
  writeFileSync(join(root, "tokens", "semantic.json"), JSON.stringify(semantic, null, 2) + "\n");

  console.log(`Primitives:        ${stats.primitives}`);
  console.log(`Semantic variables: ${stats.semantic} (${stats.withDarkVariant} with a different dark value)`);
  console.log(`Text styles:       ${stats.textStyles}`);
  console.log(`Effect styles:     ${stats.effectStyles}`);
  for (const { name, variables } of skipped.collections) console.log(`Skipped collection "${name}" (${variables} variables): not part of the documented token architecture.`);
  for (const style of skipped.styles) console.log(`Skipped style: ${style}`);
  console.log("Wrote tokens/primitives.json and tokens/semantic.json. Run npm test and npm run build next.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
