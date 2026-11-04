import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { test } from "node:test";
import { build } from "../scripts/build.mjs";

const out = () => build({ outDir: mkdtempSync(join(tmpdir(), "ds-")), siteUrl: "https://example.com/ds/" });

test("every internal link, stylesheet and script in the site points to a file that exists", () => {
  const { outDir, pages } = out();
  const broken = [];
  for (const page of pages) {
    const html = readFileSync(join(outDir, page), "utf8");
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(target)) continue;
      const file = normalize(join(dirname(join(outDir, page)), target.split("#")[0].split("?")[0]));
      if (!existsSync(file)) broken.push(`${page} -> ${target}`);
    }
  }
  assert.deepEqual(broken, []);
});

test("fragment links point to an element that exists on the same page", () => {
  const { outDir, pages } = out();
  const broken = [];
  for (const page of pages) {
    const html = readFileSync(join(outDir, page), "utf8");
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!ids.has(m[1])) broken.push(`${page} -> #${m[1]}`);
  }
  assert.deepEqual(broken, []);
});

test("every page has a title, a language, one main landmark and one h1", () => {
  const { outDir, pages } = out();
  for (const page of pages) {
    const html = readFileSync(join(outDir, page), "utf8");
    assert.match(html, /<html lang="es">/, `${page} lacks a language`);
    assert.match(html, /<title>[^<]+<\/title>/, `${page} lacks a title`);
    assert.equal((html.match(/<main\b/g) ?? []).length, 1, `${page} must have exactly one <main>`);
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${page} must have exactly one <h1>`);
  }
});

test("the current page is marked in the sidebar and the canonical URL uses the site URL", () => {
  const { outDir } = out();
  const html = readFileSync(join(outDir, "components", "button.html"), "utf8");
  assert.match(html, /<a href="\.\.\/components\/button\.html" aria-current="page">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/example\.com\/ds\/components\/button\.html">/);
});

test("the sidebar groups components like Figma, in order", () => {
  const { outDir } = out();
  const html = readFileSync(join(outDir, "index.html"), "utf8");
  const order = ["1 · Acción", "2 · Formulario", "3 · Contenedor", "4 · Feedback", "5 · Overlay", "6 · Base", "7 · Datos"].map((g) => html.indexOf(g));
  assert.ok(order.every((n) => n > 0), "a component group is missing");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "component groups are out of order");
});
