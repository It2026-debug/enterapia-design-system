import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIGS, checkPages, formatReport, launchBrowser, serve } from "../scripts/lib/a11y.mjs";

// These tests prove the accessibility check can fail. They need Google Chrome (GitHub's runners have it).
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const configs = CONFIGS.filter((c) => c.name === "claro" || c.name === "celular");
let browser;
let server;
let dir;
let reason;

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "ds-a11y-test-"));
  const page = (body, head = "<title>Prueba</title>", lang = ' lang="es"') => `<!doctype html><html${lang}><head><meta charset="utf-8">${head}</head><body><main>${body}</main></body></html>`;
  writeFileSync(join(dir, "good.html"), page("<h1>Hola</h1><p>Texto legible.</p>"));
  writeFileSync(join(dir, "bad.html"), page('<img src="x.png"><button></button><p style="color:#cccccc;background:#ffffff">Bajo contraste</p>', "", ""));
  writeFileSync(join(dir, "wide.html"), page('<h1>Ancho</h1><div style="width:2000px;height:10px;background:#000"></div>'));
  mkdirSync(join(dir, "sub"));
  writeFileSync(join(dir, "sub", "index.html"), page("<h1>Subcarpeta</h1>"));
  server = await serve(dir);
  try {
    browser = await launchBrowser();
  } catch (error) {
    reason = error.message.split("\n")[0];
  }
});

after(async () => {
  await browser?.close();
  await server?.close();
});

const run = (t, pages) => {
  if (!browser) return t.skip(reason);
  return checkPages({ baseUrl: server.url, pages, browser, configs });
};

test("an accessible page passes in every configuration", async (t) => {
  const report = await run(t, ["good.html"]);
  if (!report) return;
  assert.deepEqual(report.violations, []);
  assert.deepEqual(report.overflow, []);
  assert.equal(report.checked, configs.length);
});

test("a page with a missing language, title, image text, button name and contrast is rejected", async (t) => {
  const report = await run(t, ["bad.html"]);
  if (!report) return;
  const rules = new Set(report.violations.map((v) => v.id));
  for (const id of ["html-has-lang", "document-title", "image-alt", "button-name", "color-contrast"]) assert.ok(rules.has(id), `${id} was not detected`);
  assert.match(formatReport(report), /✖ image-alt \(critical\)/);
  assert.match(formatReport(report), /violaciones y 0 desbordamientos/);
});

test("a page that scrolls sideways on a phone is reported", async (t) => {
  const report = await run(t, ["wide.html"]);
  if (!report) return;
  assert.ok(report.overflow.some((o) => o.config === "celular" && o.pixels > 1000), "the overflow was not detected");
  assert.match(formatReport(report), /desbordamiento horizontal \[celular\]/);
});

test("the server only serves files inside the folder and maps folders to index.html", async () => {
  const outside = await fetch(`${server.url}/..%2f..%2fetc%2fpasswd`);
  assert.equal(outside.status, 404);
  const traversal = await fetch(`${server.url}/%2e%2e/package.json`);
  assert.equal(traversal.status, 404);
  const folder = await fetch(`${server.url}/sub/`);
  assert.equal(folder.status, 200);
  assert.match(await folder.text(), /Subcarpeta/);
  assert.equal((await fetch(`${server.url}/good.html`)).headers.get("content-type"), "text/html; charset=utf-8");
});

test("CI runs the accessibility check as its own job, with Chrome and no browser download", () => {
  const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(ci, /accessibility:\s+runs-on: ubuntu-latest\s+timeout-minutes: \d+/);
  assert.match(ci, /run: npm run a11y/);
  assert.doesNotMatch(ci, /playwright install/, "the runners already have Chrome");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.a11y, "node scripts/a11y.mjs");
});

test("the accessibility check covers light, dark, the system preference and a phone", () => {
  assert.deepEqual(CONFIGS.map((c) => c.name), ["claro", "oscuro", "sistema oscuro", "celular"]);
  assert.equal(CONFIGS.find((c) => c.name === "celular").width, 390);
});
