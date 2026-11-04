import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "../scripts/build.mjs";
import { buildRegistry, renderCss, toCssVar } from "../scripts/lib/tokens.mjs";

const pkg = { name: "t", version: "0.0.0", description: "t" };
const about = { covers: "test", doesNotCover: [], notes: [] };
const make = (primitives, semantic = {}, meta = {}) => buildRegistry({ primitives, semantic, meta, about, pkg });
const built = (options = {}) => build({ outDir: mkdtempSync(join(tmpdir(), "ds-")), ...options });
const modes = (light, dark) => ({ $modes: { light, dark } });

test("the committed tokens build, and semantic colors are aliases rather than raw hex values", () => {
  const { registry } = built();
  const raw = registry.tokens.filter(
    (t) => t.layer === "semantic" && t.category === "color" && t.reference === null && /^#/.test(t.definition),
  );
  assert.deepEqual(raw.map((t) => t.name), []);
  assert.ok(registry.counts.withDarkVariant > 0, "the dark theme must be present");
});

test("every token that has a dark variant resolves to a value in both modes", () => {
  const { registry } = built();
  for (const token of registry.tokens.filter((t) => t.modes)) {
    assert.ok(token.modes.light.value && token.modes.dark.value, `${token.name} is missing a resolved mode value`);
    assert.notEqual(token.modes.light.definition, token.modes.dark.definition, `${token.name} should only have modes when they differ`);
  }
});

test("modes are resolved through aliases", () => {
  const registry = make(
    { color: { white: "#ffffff", black: "#000000" } },
    { color: { page: modes("{color.white}", "{color.black}") } },
  );
  const page = registry.tokens.find((t) => t.name === "color.page");
  assert.equal(page.value, "#ffffff");
  assert.equal(page.modes.dark.value, "#000000");
  assert.equal(page.modes.dark.reference, "color.black");
});

test("CSS declares light in :root and only the differing tokens under dark", () => {
  const registry = make(
    { color: { white: "#ffffff", black: "#000000" } },
    { color: { page: modes("{color.white}", "{color.black}"), same: "{color.white}" } },
  );
  const css = renderCss(registry);
  assert.match(css, /:root \{\n  color-scheme: light;[\s\S]*--color-page: var\(--color-white\);/);
  const dark = css.slice(css.indexOf(':root[data-theme="dark"]'));
  assert.match(dark, /--color-page: var\(--color-black\);/);
  assert.doesNotMatch(dark, /--color-same/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)[\s\S]*:root:not\(\[data-theme="light"\]\)/);
});

test("a registry without dark variants emits no dark block", () => {
  assert.doesNotMatch(renderCss(make({ color: { a: "#000" } })), /dark/);
});

test("a value can embed references and they resolve per mode", () => {
  const registry = make(
    { color: { shade: "#111111" } },
    { elevation: { raised: "0px 4px 16px 0px {color.shade}" } },
  );
  const raised = registry.tokens.find((t) => t.name === "elevation.raised");
  assert.equal(raised.value, "0px 4px 16px 0px #111111");
  assert.equal(raised.reference, null);
  assert.match(renderCss(registry), /--elevation-raised: 0px 4px 16px 0px var\(--color-shade\);/);
  assert.deepEqual(registry.tokens.find((t) => t.name === "color.shade").usedBy, ["elevation.raised"]);
});

test("usedBy lists the direct consumers of a token across modes", () => {
  const registry = make(
    { color: { a: "#000", b: "#fff" } },
    { color: { x: "{color.a}", y: modes("{color.a}", "{color.b}") } },
  );
  assert.deepEqual(registry.tokens.find((t) => t.name === "color.a").usedBy, ["color.x", "color.y"]);
  assert.deepEqual(registry.tokens.find((t) => t.name === "color.b").usedBy, ["color.y"]);
});

test("a reference to a token that does not exist fails the build", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { x: "{color.nope}" } }), /does not exist/);
});

test("a missing reference in only the dark mode is still caught", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { x: modes("{color.a}", "{color.nope}") } }), /does not exist/);
});

test("reference cycles are reported", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { x: "{color.y}", y: "{color.x}" } }), /cycle/i);
});

test("a primitive may alias another primitive but not a semantic token", () => {
  const ok = make({ color: { green: "#0f0", success: "{color.green}" } });
  assert.equal(ok.tokens.find((t) => t.name === "color.success").value, "#0f0");
  assert.throws(
    () => make({ color: { a: "{color.s}" } }, { color: { s: "#000" } }),
    /may only reference other primitives/,
  );
});

test("primitives cannot define modes", () => {
  assert.throws(() => make({ color: { a: modes("#000", "#fff") } }), /cannot define modes/);
});

test("$modes must define exactly light and dark", () => {
  assert.throws(() => make({}, { color: { a: { $modes: { light: "#000" } } } }), /\$modes must define/);
  assert.throws(() => make({}, { color: { a: { $modes: { light: "#000", dark: "#fff", sepia: "#ccc" } } } }), /\$modes must define/);
});

test("a token defined in both layers is rejected", () => {
  assert.throws(() => make({ color: { a: "#000" } }, { color: { a: "#111" } }), /more than once/);
});

test("two tokens that map to the same CSS variable are rejected", () => {
  assert.throws(() => make({ color: { onButton: "#000", "on-button": "#111" } }), /both map to/);
});

test("meta.json entries must point at real tokens", () => {
  assert.throws(() => make({ color: { a: "#000" } }, {}, { "color.gone": { note: "x" } }), /not a token/);
});

test("unknown categories are rejected", () => {
  assert.throws(() => make({ shadow: { a: "1px" } }), /unknown category/);
});

test("CSS variable names are kebab-cased", () => {
  assert.equal(toCssVar("color.text.onDisabledButton"), "--color-text-on-disabled-button");
  assert.equal(toCssVar("font.line-height.heading.2xs"), "--font-line-height-heading-2xs");
});

test("the generated site only uses CSS variables that tokens.css defines", () => {
  const { outDir } = built();
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  const css = readFileSync(join(outDir, "tokens.css"), "utf8");
  const defined = new Set([...css.matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  defined.add("--c");
  const undefinedVars = [...new Set([...html.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((v) => !defined.has(v));
  assert.deepEqual(undefinedVars, []);
});

test("the generated site lists every token and is HTML-escaped", () => {
  const { registry, outDir } = built({ mcpUrl: "https://example.com/mcp?a=1&b=2" });
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  for (const token of registry.tokens) assert.ok(html.includes(token.cssVar), `${token.name} is not rendered`);
  assert.ok(html.includes("a=1&amp;b=2"), "MCP URL must be escaped");
  assert.ok(!html.includes("undefined"), "no undefined leaked into the page");
});

test("llms.txt documents the rules, the dark values and every semantic token", () => {
  const { registry, outDir } = built();
  const text = readFileSync(join(outDir, "llms.txt"), "utf8");
  assert.match(text, /Use semantic tokens/);
  assert.match(text, /dark: #/);
  for (const token of registry.tokens.filter((t) => t.layer === "semantic")) {
    assert.ok(text.includes(token.name), `${token.name} missing from llms.txt`);
  }
});
