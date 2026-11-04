import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "../scripts/build.mjs";
import { buildRegistry, flatten, renderCss, toCssVar } from "../scripts/lib/tokens.mjs";

const readJson = (relative) => JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));
const pkg = { name: "t", version: "0.0.0", description: "t" };
const make = (primitives, semantic, meta = {}) => buildRegistry({ primitives, semantic, meta, pkg });

test("every token from the original export keeps exactly the same resolved value", () => {
  const { registry } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const byName = new Map(registry.tokens.map((t) => [t.name, t]));
  const originals = [
    ...flatten(readJson("./fixtures/primitives.v1.json")),
    ...flatten(readJson("./fixtures/semantic.v1.json")),
  ];
  assert.equal(originals.length, 31 + 34, "fixture token count");
  for (const { name, raw } of originals) {
    assert.ok(byName.has(name), `${name} is missing from the registry`);
    assert.equal(byName.get(name).value, raw, `${name} changed value`);
  }
});

test("semantic color tokens are aliases of primitives, not raw hex values", () => {
  const { registry } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const rawColors = registry.tokens.filter(
    (t) => t.layer === "semantic" && t.category === "color" && t.reference === null,
  );
  assert.deepEqual(rawColors.map((t) => t.name), []);
});

test("CSS keeps aliases so re-theming a primitive updates the semantic token", () => {
  const { registry } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const css = renderCss(registry);
  assert.match(css, /--color-text-error: var\(--color-red-700\);/);
  assert.match(css, /--color-red-700: #d42515;/);
});

test("usedBy lists the direct consumers of a primitive", () => {
  const registry = make({ color: { a: "#000" } }, { color: { x: "{color.a}", y: "{color.a}" } });
  assert.deepEqual(registry.tokens.find((t) => t.name === "color.a").usedBy, ["color.x", "color.y"]);
});

test("a reference to a token that does not exist fails the build", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { x: "{color.nope}" } }), /does not exist/);
});

test("reference cycles are reported", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { x: "{color.y}", y: "{color.x}" } }), /cycle/i);
});

test("primitives must be literal values", () => {
  assert.throws(() => make({ color: { a: "{color.b}", b: "#000" } }, {}), /must be a literal/);
});

test("a token defined in both layers is rejected", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { a: "#111" } }), /more than once/);
});

test("two tokens that map to the same CSS variable are rejected", () => {
  assert.throws(() => make({ color: { onButton: "#000", "on-button": "#111" } }, {}), /both map to/);
});

test("meta.json entries must point at real tokens", () => {
  assert.throws(() => make({ color: { a: "#000" } }, {}, { "color.gone": { note: "x" } }), /not a token/);
});

test("unknown categories are rejected", () => {
  assert.throws(() => make({ shadow: { a: "1px" } }, {}), /unknown category/);
});

test("CSS variable names are kebab-cased", () => {
  assert.equal(toCssVar("color.text.onDisabledButton"), "--color-text-on-disabled-button");
  assert.equal(toCssVar("typography.fontSize.body14"), "--typography-font-size-body14");
});

test("the generated site lists every token and is HTML-escaped", () => {
  const { registry, outDir } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")), mcpUrl: "https://example.com/mcp?a=1&b=2" });
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  for (const token of registry.tokens) {
    assert.ok(html.includes(token.cssVar), `${token.name} is not rendered`);
  }
  assert.ok(html.includes("a=1&amp;b=2"), "MCP URL must be escaped");
  assert.ok(!html.includes("undefined"), "no undefined leaked into the page");
});

test("llms.txt documents the rules and every semantic token", () => {
  const { registry, outDir } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const text = readFileSync(join(outDir, "llms.txt"), "utf8");
  assert.match(text, /Use semantic tokens/);
  for (const token of registry.tokens.filter((t) => t.layer === "semantic")) {
    assert.ok(text.includes(token.name), `${token.name} missing from llms.txt`);
  }
});
