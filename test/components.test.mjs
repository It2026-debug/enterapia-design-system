import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import definitions from "../components/index.mjs";
import { defaultsOf } from "../scripts/lib/site/components-pages.mjs";
import { build } from "../scripts/build.mjs";
import { pathFromVectorNetwork } from "../scripts/lib/figicons.mjs";
import { computeContrast, contrastRatio, pairsFromFigma, parseHex } from "../scripts/lib/site/contrast.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (...p) => JSON.parse(readFileSync(join(root, ...p), "utf8"));
const components = readJson("content", "components.json");

test("every component has code, and every piece of code matches a component", () => {
  const local = readJson("content", "components.local.json").map((c) => c.slug ?? c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  assert.deepEqual([...definitions.keys()].sort(), [...components.map((c) => c.slug), ...local].sort());
});

test("every Figma variant renders non-empty HTML without leaking undefined", () => {
  let count = 0;
  for (const meta of components) {
    const def = definitions.get(meta.slug);
    for (const part of meta.parts) {
      for (const variant of part.variants) {
        const html = def.render({ ...defaultsOf(part), ...variant.props, __part: part.name }, {});
        assert.ok(html.length > 10, `${meta.slug} ${variant.name} rendered nothing`);
        assert.ok(!html.includes("undefined"), `${meta.slug} ${variant.name} leaked undefined`);
        count++;
      }
    }
  }
  assert.equal(count, components.reduce((n, c) => n + c.parts.reduce((m, p) => m + p.variants.length, 0), 0));
});

test("components escape the text they are given", () => {
  const hostile = '<img src=x onerror="alert(1)">';
  const checks = [
    ["button", {}, { Button: hostile }],
    ["badge", {}, { Label: hostile }],
    ["alert", {}, { Title: hostile, Description: hostile }],
    ["input", {}, { Etiqueta: hostile, "Texto de ejemplo": hostile }],
    ["card", {}, { Title: hostile, Description: hostile }],
  ];
  for (const [slug, props, texts] of checks) {
    const meta = components.find((c) => c.slug === slug);
    const html = definitions.get(slug).render({ ...defaultsOf(meta.parts[0]), ...props, __part: meta.parts[0].name }, texts);
    assert.ok(!html.includes("<img"), `${slug} did not escape its text`);
  }
});

test("component CSS uses only design tokens for color and only variables that exist", () => {
  const tokensCss = readFileSync(join(build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) }).outDir, "tokens.css"), "utf8");
  const tokenVars = new Set([...tokensCss.matchAll(/^\s+(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  for (const meta of components) {
    const path = join(root, "components", meta.slug, `${meta.slug}.css`);
    assert.ok(existsSync(path), `${meta.slug} has no CSS file`);
    const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, `${meta.slug}.css hardcodes a hex color`);
    assert.doesNotMatch(css, /\brgba?\(/i, `${meta.slug}.css hardcodes an rgb color`);
    const local = new Set([...css.matchAll(/(--_[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    for (const m of css.matchAll(/var\((--[a-z0-9_-]+)/gi)) {
      assert.ok(tokenVars.has(m[1]) || local.has(m[1]), `${meta.slug}.css uses ${m[1]}, which is not a token`);
    }
  }
});

test("the build bundles every component's CSS and records it in the registry", () => {
  const { registry, outDir } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const css = readFileSync(join(outDir, "components.css"), "utf8");
  assert.ok(css.includes(".ds-button"));
  assert.equal(registry.components.length, components.length);
  for (const component of registry.components) {
    assert.ok(component.implemented, `${component.slug} should be implemented`);
    assert.ok(component.css && component.css.length > 20);
    assert.equal(component.variantCount, component.parts.reduce((n, p) => n + p.examples.length, 0));
  }
});

test("every component page has the preview, the code and a back link to the index", () => {
  const { registry, outDir } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  for (const component of registry.components) {
    const html = readFileSync(join(outDir, "components", `${component.slug}.html`), "utf8");
    assert.ok(html.includes('data-playground'), `${component.slug} has no preview`);
    assert.ok(html.includes('id="code"'), `${component.slug} has no code section`);
    assert.ok(html.includes('href="index.html"'));
  }
});

test("documentation from Figma only references components that exist", () => {
  const known = new Set(components.flatMap((c) => [c.name, ...c.sets, ...c.parts.map((p) => p.name)].map((n) => n.toLowerCase().replace(/[^a-z0-9]/g, ""))));
  const collect = (blocks, out = []) => {
    for (const b of blocks ?? []) {
      if (b.type === "preview") out.push(b.component);
      collect(b.items, out);
      collect(b.previews, out);
    }
    return out;
  };
  for (const file of ["button"]) {
    const doc = readJson("content", "docs", `${file}.json`);
    for (const name of doc.sections.flatMap((s) => collect(s.blocks))) assert.ok(known.has(name.toLowerCase().replace(/[^a-z0-9]/g, "")), `${file} docs reference unknown component ${name}`);
  }
});

test("vector networks become centerline paths, closing loops and keeping curves", () => {
  const build = (vertices, segments) => {
    const buffer = Buffer.alloc(12 + vertices.length * 12 + segments.length * 28 + 16);
    buffer.writeUInt32LE(vertices.length, 0);
    buffer.writeUInt32LE(segments.length, 4);
    buffer.writeUInt32LE(1, 8);
    let o = 12;
    for (const [x, y] of vertices) {
      buffer.writeUInt32LE(1, o);
      buffer.writeFloatLE(x, o + 4);
      buffer.writeFloatLE(y, o + 8);
      o += 12;
    }
    for (const [start, end, t1, t2] of segments) {
      buffer.writeUInt32LE(0, o);
      buffer.writeUInt32LE(start, o + 4);
      buffer.writeFloatLE(t1?.[0] ?? 0, o + 8);
      buffer.writeFloatLE(t1?.[1] ?? 0, o + 12);
      buffer.writeUInt32LE(end, o + 16);
      buffer.writeFloatLE(t2?.[0] ?? 0, o + 20);
      buffer.writeFloatLE(t2?.[1] ?? 0, o + 24);
      o += 28;
    }
    return new Uint8Array(buffer);
  };
  assert.equal(pathFromVectorNetwork(build([[0, 0], [10, 0], [10, 10]], [[0, 1], [1, 2]])), "M0 0L10 0L10 10");
  assert.equal(pathFromVectorNetwork(build([[0, 0], [10, 0], [10, 10]], [[0, 1], [1, 2], [2, 0]])), "M0 0L10 0L10 10L0 0Z");
  assert.equal(pathFromVectorNetwork(build([[0, 0], [0, 0.5], [0, 5], [0, 5.5]], [[0, 1], [2, 3]])), "M0 0L0 0.5M0 5L0 5.5");
  assert.equal(pathFromVectorNetwork(build([[0, 0], [10, 10]], [[0, 1, [5, 0], [-5, 0]]])), "M0 0C5 0 5 10 10 10");
});

test("contrast ratios follow WCAG: black on white is 21:1 and pairs resolve from tokens", () => {
  assert.equal(contrastRatio(parseHex("#000000"), parseHex("#ffffff")).toFixed(2), "21.00");
  assert.equal(contrastRatio(parseHex("#ffffff"), parseHex("#ffffff")).toFixed(2), "1.00");
  const pairs = pairsFromFigma([["text/heading/primary  /  bg:default", "Título", "4.5:1", "19.89:1  ✓", "15.34:1  ✓"]]);
  assert.equal(pairs[0].foreground, "color.text.heading.primary");
  assert.equal(pairs[0].background, "color.background.default");
  const { registry } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const [result] = computeContrast(pairs, new Map(registry.tokens.map((t) => [t.name, t])));
  assert.ok(result.light.pass && result.dark.pass);
  assert.ok(Math.abs(result.light.ratio - 19.89) < 0.02);
});

test("every contrast pair in the Foundations page resolves and passes WCAG AA in both themes", () => {
  const { registry } = build({ outDir: mkdtempSync(join(tmpdir(), "ds-")) });
  const section = readJson("content", "foundations.json").find((s) => s.slug === "contraste-wcag");
  const table = section.blocks.flatMap((b) => b.items ?? [b]).find((b) => b.type === "table");
  const results = computeContrast(pairsFromFigma(table.rows), new Map(registry.tokens.map((t) => [t.name, t])));
  assert.ok(results.length >= 30);
  const problems = results.filter((r) => r.missing || !r.light.pass || !r.dark.pass).map((r) => r.label);
  assert.deepEqual(problems, []);
});

test("components that exist only in code expand their axes into every variant", async () => {
  const { normalizeLocalComponent, byNumber } = await import("../scripts/lib/local-components.mjs");
  const local = normalizeLocalComponent({ number: "8.1", group: 8, category: "Navegación", name: "Tabs", parts: [{ name: "Tabs", axes: { Orientation: ["Horizontal", "Vertical"], State: ["Default", "Active"] } }] });
  assert.equal(local.slug, "tabs");
  assert.equal(local.parts[0].variants.length, 4);
  assert.equal(local.parts[0].variants[0].name, "Orientation=Horizontal, State=Default");
  assert.deepEqual(local.parts[0].variants.at(-1).props, { Orientation: "Vertical", State: "Active" });
  const single = normalizeLocalComponent({ number: "8.2", group: 8, category: "Navegación", name: "Breadcrumb" });
  assert.equal(single.parts[0].variants.length, 1);
  assert.throws(() => normalizeLocalComponent({ name: "Nope" }), /missing "number"/);
  assert.deepEqual([{ number: "10.1" }, { number: "2.1" }, { number: "2.10" }, { number: "2.2" }].sort(byNumber).map((c) => c.number), ["2.1", "2.2", "2.10", "10.1"]);
});
