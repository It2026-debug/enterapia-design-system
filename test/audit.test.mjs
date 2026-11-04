import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import definitions from "../components/index.mjs";
import { assertHttpUrl, assertSafeOutDir, build } from "../scripts/build.mjs";
import { assertLooksLikeEnterapia } from "../scripts/lib/import-checks.mjs";
import { computeContrast, contrastRatio, over, parseHex } from "../scripts/lib/site/contrast.mjs";
import { pretty } from "../scripts/lib/site/util.mjs";
import { buildRegistry } from "../scripts/lib/tokens.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fresh = () => mkdtempSync(join(tmpdir(), "ds-audit-"));
const generated = (options = {}) => build({ outDir: fresh(), ...options });
const read = (outDir, page) => readFileSync(join(outDir, page), "utf8");
const pkg = { name: "t", version: "0", description: "t" };
const about = { covers: "x" };

// --- Build safety -------------------------------------------------------------------------

test("the build refuses to empty folders that are not clearly its own output", () => {
  assert.throws(() => assertSafeOutDir(root), /contains or is this repository/);
  assert.throws(() => assertSafeOutDir(dirname(root)), /contains or is this repository/);
  assert.throws(() => assertSafeOutDir(homedir()), /contains or is this repository/);
  assert.throws(() => assertSafeOutDir("/"), /contains or is this repository/);
  const foreign = fresh();
  writeFileSync(join(foreign, "mis-notas.txt"), "no me borres");
  assert.throws(() => assertSafeOutDir(foreign), /not empty and was not created by this build/);
  assert.equal(readFileSync(join(foreign, "mis-notas.txt"), "utf8"), "no me borres");
});

test("the build accepts an empty folder and its own previous output", () => {
  const out = fresh();
  assert.doesNotThrow(() => assertSafeOutDir(out));
  build({ outDir: out });
  assert.doesNotThrow(() => build({ outDir: out }), "a second build into the same folder must work");
  const nested = join(fresh(), "a", "b");
  mkdirSync(nested, { recursive: true });
  assert.doesNotThrow(() => assertSafeOutDir(nested));
});

test("site and MCP URLs must be http or https", () => {
  assert.doesNotThrow(() => assertHttpUrl("mcpUrl", "https://example.com/mcp"));
  assert.doesNotThrow(() => assertHttpUrl("mcpUrl", ""));
  assert.throws(() => assertHttpUrl("mcpUrl", "javascript:alert(1)"), /must be an http or https URL/);
  assert.throws(() => assertHttpUrl("siteUrl", "ftp://example.com"), /must be an http or https URL/);
  assert.throws(() => assertHttpUrl("siteUrl", "no es una url"), /not a valid URL/);
  assert.throws(() => generated({ mcpUrl: "javascript:alert(1)" }), /http or https/);
});

// --- Importer safety ----------------------------------------------------------------------

test("the importer refuses a file that is not the Enterapia design file", () => {
  const ok = { stats: { primitives: 94, semantic: 126 }, foundations: [{}], components: [{}] };
  assert.doesNotThrow(() => assertLooksLikeEnterapia(ok));
  assert.throws(() => assertLooksLikeEnterapia({ ...ok, stats: { primitives: 0, semantic: 0 } }), /Nothing was written/);
  assert.throws(() => assertLooksLikeEnterapia({ ...ok, components: [] }), /no components/);
  assert.throws(() => assertLooksLikeEnterapia({ ...ok, foundations: [] }), /no sections on the "Foundations" page/);
});

// --- Token logic --------------------------------------------------------------------------

test("an alias of a token that has a dark variant also has one", () => {
  const registry = buildRegistry({
    primitives: { color: { white: "#ffffff", black: "#000000" } },
    semantic: { color: { page: { $modes: { light: "{color.white}", dark: "{color.black}" } }, alias: "{color.page}", plain: "{color.white}" } },
    about,
    pkg,
  });
  const alias = registry.tokens.find((t) => t.name === "color.alias");
  assert.equal(alias.value, "#ffffff");
  assert.equal(alias.modes.dark.value, "#000000");
  assert.equal(registry.tokens.find((t) => t.name === "color.plain").modes, null);
  assert.equal(registry.counts.withDarkVariant, 2);
});

test("contrast accounts for transparency", () => {
  const white = parseHex("#ffffff");
  assert.equal(parseHex("#00091c80").a.toFixed(2), "0.50");
  assert.equal(contrastRatio(over(parseHex("#00091c80"), white), white).toFixed(2), "3.76");
  assert.equal(over(parseHex("#00091c"), white).r, 0, "an opaque color is unchanged");
  const tokens = new Map([
    ["color.fg", { name: "color.fg", value: "#00091c80" }],
    ["color.bg", { name: "color.bg", value: "#ffffff" }],
  ]);
  const [result] = computeContrast([{ foreground: "color.fg", background: "color.bg", minimum: 4.5 }], tokens);
  assert.equal(result.light.ratio.toFixed(2), "3.76");
  assert.equal(result.light.pass, false);
});

// --- Documentation site: structure and accessibility --------------------------------------

test("no page skips a heading level", () => {
  const { outDir, pages } = generated();
  const skips = [];
  for (const page of pages) {
    const levels = [...read(outDir, page).matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips.push(`${page}: h${levels[i - 1]} -> h${levels[i]}`);
  }
  assert.deepEqual(skips, []);
});

test("previews never put their own headings, dialogs or radio groups into the page", () => {
  const { outDir } = generated();
  const card = read(outDir, "components/card.html");
  assert.equal((card.match(/<h3 class="ds-card__title"/g) ?? []).length, 0, "Card previews must not add h3 headings to the outline");
  assert.match(card, /<p class="ds-card__title"/);
  const modal = read(outDir, "components/modal.html");
  assert.doesNotMatch(modal, /aria-modal="true"/, "a static preview must not hide the rest of the page from screen readers");
  assert.equal((modal.match(/<h2 class="ds-modal__title"/g) ?? []).length, 0);
  const radio = read(outDir, "components/radio.html");
  assert.doesNotMatch(radio, /<input[^>]*type="radio"[^>]*name=/, "previews must be independent radios");
  assert.match(radio, /name=&quot;opcion&quot;/, "the code section still shows the name attribute");
});

test("the code shown for a component keeps the real markup, including its headings", () => {
  const { registry } = generated();
  const card = registry.components.find((c) => c.slug === "card");
  assert.match(card.defaultExample, /<h3 class="ds-card__title">/);
  const modal = registry.components.find((c) => c.slug === "modal");
  assert.match(modal.defaultExample, /aria-modal="true"/);
  const radio = registry.components.find((c) => c.slug === "radio");
  assert.match(radio.defaultExample, /name="opcion"/);
});

test("pieces that need a parent role are previewed inside one", () => {
  const { outDir } = generated();
  assert.match(read(outDir, "components/tabla.html"), /role="table" aria-label="Ejemplo de tabla"/);
  assert.match(read(outDir, "components/select-option.html"), /role="listbox" aria-label="Opciones"/);
  assert.equal(typeof definitions.get("tabla").wrapPreview, "function");
  assert.doesNotMatch(read(outDir, "components/tabla.html"), /<pre[^>]*>[^<]*ds-preview-wrap/, "the wrapper is not part of the code shown");
});

test("the HTML is well formed: no div inside span, ids start with a letter, no empty labels", () => {
  const { outDir, pages } = generated();
  const problems = [];
  for (const page of pages) {
    const html = read(outDir, page);
    if (/<span class="figure"><div/.test(html)) problems.push(`${page}: div inside span`);
    if (/aria-label=""/.test(html)) problems.push(`${page}: empty aria-label`);
    for (const m of html.matchAll(/\sid="([^"]*)"/g)) if (!/^[A-Za-z]/.test(m[1])) problems.push(`${page}: id "${m[1]}"`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicated.length) problems.push(`${page}: duplicated ids ${[...new Set(duplicated)].join(", ")}`);
  }
  assert.deepEqual(problems, []);
});

test("every page works for keyboard and screen readers before any script runs", () => {
  const { outDir, pages } = generated();
  for (const page of pages) {
    const html = read(outDir, page);
    assert.match(html, /<button type="button" class="btn-plain" id="theme">Tema: sistema<\/button>/, `${page}: the theme button needs text without script`);
    assert.match(html, /<main id="main" tabindex="-1">/, `${page}: the skip link needs a focusable target`);
    assert.match(html, /<link rel="icon"/, `${page}: without an icon every page triggers a 404 for /favicon.ico`);
  }
});

test("the script keeps the mobile menu out of the tab order, closes it with Escape and marks scrolling regions", () => {
  const css = readFileSync(join(root, "site", "site.css"), "utf8");
  assert.match(css, /transform: translateX\(-100%\); visibility: hidden/);
  assert.match(css, /body\.nav-open \.sidebar \{ transform: none; visibility: visible/);
  const js = readFileSync(join(root, "site", "site.js"), "utf8");
  assert.match(js, /event\.key === 'Escape'/);
  assert.match(js, /setAttribute\('tabindex', '0'\)/);
  assert.match(js, /input\.indeterminate = true/);
});

test("informational text keeps AA contrast: the 'No existe' cells do not use the disabled color", () => {
  const css = readFileSync(join(root, "site", "site.css"), "utf8");
  assert.match(css, /\.matrix \.na \{ color: var\(--color-text-body-secondary\)/);
  assert.doesNotMatch(css, /\.na \{[^}]*text-disabled/);
});

test("single-variant pieces do not repeat themselves in an 'all variants' matrix", () => {
  const { outDir } = generated();
  assert.doesNotMatch(read(outDir, "components/tooltip.html"), /id="matriz"/);
  assert.equal((read(outDir, "components/tabla.html").match(/aria-label="Paginación"/g) ?? []).length, 2, "the pagination nav appears in the preview and in the code only once each");
  assert.match(read(outDir, "components/tabla.html"), /id="matriz"/, "Tabla has pieces with several variants");
});

test("components list their differences from Figma next to the preview", () => {
  const { outDir } = generated();
  const button = read(outDir, "components/button.html");
  assert.match(button, /Diferencias con Figma/);
  assert.match(button, /Figma no define un estado Focus/);
  assert.match(read(outDir, "components/tabla.html"), /usa la fuente Inter/);
});

test("forced-colors support is bundled and uses system colors only", () => {
  const { outDir } = generated();
  const css = read(outDir, "components.css");
  assert.match(css, /@media \(forced-colors: active\)/);
  const source = readFileSync(join(root, "components", "forced-colors.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|\brgba?\(/i);
  assert.match(source, /ButtonText/);
});

// --- Snippet formatting -------------------------------------------------------------------

test("the formatted code keeps text inside its element on one line", () => {
  assert.equal(pretty('<p class="t">Hola</p>'), '<p class="t">Hola</p>');
  const nested = pretty('<div class="a"><p class="b">Título</p><p class="c">Texto largo</p></div>');
  assert.equal(nested, ['<div class="a">', '  <p class="b">Título</p>', '  <p class="c">Texto largo</p>', "</div>"].join("\n"));
  assert.equal(pretty('<div><span>a</span> <span>b</span></div>').split("\n").length, 3);
});

// --- Repository and infrastructure --------------------------------------------------------

test("workflows use least privilege and time limits, and Node versions agree", () => {
  const ci = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
  const pages = readFileSync(join(root, ".github", "workflows", "pages.yml"), "utf8");
  assert.match(ci, /permissions:\s+contents: read/);
  assert.match(ci, /timeout-minutes:/);
  assert.match(pages, /timeout-minutes:/);
  for (const text of [ci, pages]) assert.doesNotMatch(text, /actions\/(checkout|setup-node)@v4/, "the v4 actions run on a deprecated Node version");
  const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const mcpPkg = JSON.parse(readFileSync(join(root, "mcp", "package.json"), "utf8"));
  assert.equal(rootPkg.engines.node, ">=22", "node --test with globs needs 21+, the importer needs 22.15+");
  assert.equal(mcpPkg.engines.node, ">=22");
  assert.match(readFileSync(join(root, "Dockerfile"), "utf8"), /FROM node:22/);
});

test("the Dockerfile installs dependencies before copying the source and has a health check", () => {
  const docker = readFileSync(join(root, "Dockerfile"), "utf8");
  assert.ok(docker.indexOf("npm --prefix mcp ci") < docker.indexOf("COPY . ."), "dependency layer must come first");
  assert.match(docker, /HEALTHCHECK/);
  assert.match(docker, /USER node/);
});

test("token buttons keep their visible text in their accessible name (WCAG 2.5.3)", () => {
  const { outDir } = generated();
  const catalog = read(outDir, "tokens.html");
  const buttons = [...catalog.matchAll(/<button type="button" class="token[^>]*>/g)].map((m) => m[0]);
  assert.ok(buttons.length > 200);
  assert.ok(buttons.every((b) => !b.includes("aria-label=")), "an aria-label would replace the visible text in the name");
  assert.match(catalog, /<span class="sr-only">\. Copiar var\(--color-background-page\)<\/span>/);
  assert.match(readFileSync(join(root, "site", "site.css"), "utf8"), /\.sr-only \{ position: absolute;/);
});

test("every workflow job installs the dependencies before it runs npm scripts", () => {
  for (const file of ["ci.yml", "pages.yml"]) {
    const text = readFileSync(join(root, ".github", "workflows", file), "utf8");
    const jobsBlock = text.slice(text.indexOf("\njobs:"));
    const jobs = jobsBlock.split(/\n  (?=[a-z][a-z-]*:\n)/).slice(1);
    assert.ok(jobs.length > 0, `${file} has no jobs`);
    for (const job of jobs) {
      const name = job.split(":")[0];
      const steps = [...job.matchAll(/- run: (.+)/g)].map((m) => m[1].trim());
      const firstScript = steps.findIndex((s) => /^npm (test|run )/.test(s));
      if (firstScript === -1) continue;
      assert.ok(steps.slice(0, firstScript).includes("npm ci"), `${file} job "${name}" runs "${steps[firstScript]}" without a root "npm ci" first`);
    }
  }
});
