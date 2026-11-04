const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const STATUS_LABEL = {
  provisional: "provisional name",
  "stale-name": "stale name",
  review: "needs review",
};

const FALLBACK = "system-ui, sans-serif";
const titleCase = (text) => text.replace(/[-.]/g, " ").replace(/^./, (c) => c.toUpperCase());

const searchText = (t) =>
  [t.name, t.value, t.modes?.dark.value, t.cssVar, t.reference, t.note].filter(Boolean).join(" ").toLowerCase();

const badge = (t) =>
  t.status ? `<span class="badge" title="${esc(t.note)}">${esc(STATUS_LABEL[t.status] ?? t.status)}</span>` : "";

const button = (t, cls, body) =>
  `<button type="button" class="token ${cls}" data-copy="var(${esc(t.cssVar)})" data-search="${esc(searchText(t))}" aria-label="Copy var(${esc(t.cssVar)}) for ${esc(t.name)}">${body}</button>`;

const valueLine = (label, view) =>
  `<span class="tvalue">${label ? `<b>${label}</b> ` : ""}${esc(view.value)}${view.reference ? ` &larr; ${esc(view.reference)}` : ""}</span>`;

const meta = (t) =>
  `<span class="meta"><span class="tname">${esc(t.name).replace(/\./g, ".<wbr>")}</span>${
    t.modes ? valueLine("Light", t.modes.light) + valueLine("Dark", t.modes.dark) : valueLine("", t)
  }${badge(t)}</span>`;

const group = (title, tokens, render, id) =>
  `<section class="group" aria-labelledby="${id}"><h3 id="${id}">${esc(title)}</h3><div class="grid">${tokens
    .map(render)
    .join("")}</div></section>`;

const groupBy = (items, keyFn) => {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
};

const slug = (text) => text.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const numeric = (t) => parseFloat(t.value);
const byValue = (a, b) => numeric(a) - numeric(b);

const swatch = (t) => {
  const chip = (hex) => `<span class="chip" style="--c:${esc(hex)}"></span>`;
  const chips = t.modes ? `<span class="chips">${chip(t.modes.light.value)}${chip(t.modes.dark.value)}</span>` : chip(t.value);
  return button(t, "swatch", chips + meta(t));
};

function colorSection(tokens) {
  const colors = tokens.filter((t) => t.category === "color");
  const semantic = groupBy(
    colors.filter((t) => t.layer === "semantic"),
    (t) => t.name.split(".")[1],
  );
  const primitive = groupBy(
    colors.filter((t) => t.layer === "primitive"),
    (t) => t.name.split(".").slice(1, -1).join(".") || "other",
  );
  const render = (prefix) => ([title, list]) => group(titleCase(title), list, swatch, `${prefix}-${slug(title)}`);
  return `<section class="category" aria-labelledby="colors"><h2 id="colors">Color</h2>
    <p class="hint">Use semantic tokens in components. Each shows its light and dark value. Primitives only feed the semantic layer.</p>
    <h3 class="layer">Semantic</h3>${[...semantic].map(render("sem")).join("")}
    <h3 class="layer">Primitive</h3>${[...primitive].map(render("prim")).join("")}</section>`;
}

function dimensionSection(tokens) {
  const sample = {
    spacing: (t) => `<span class="bar" style="width:var(${esc(t.cssVar)})"></span>`,
    radius: (t) => `<span class="box" style="border-radius:var(${esc(t.cssVar)})"></span>`,
    "border-width": (t) => `<span class="line" style="border-top-width:var(${esc(t.cssVar)})"></span>`,
    size: () => "",
  };
  const titles = { spacing: "Spacing", "border-width": "Border width", radius: "Radius", size: "Size" };
  const blocks = Object.keys(sample)
    .map((category) => {
      const list = tokens.filter((t) => t.category === category).sort(byValue);
      return list.length ? group(titles[category], list, (t) => button(t, "row", sample[category](t) + meta(t)), `dim-${category}`) : "";
    })
    .join("");
  return `<section class="category" aria-labelledby="dimensions"><h2 id="dimensions">Spacing, border and radius</h2>${blocks}</section>`;
}

function typographySection(tokens) {
  const familyVar = (t) => {
    const ref = /\{(font\.family\.[^}]+)\}/.exec(t.definition)?.[1];
    return ref ? `--${ref.replace(/\./g, "-")}` : null;
  };
  const kindOf = (t) => {
    if (t.category === "text") return "text";
    const raw = t.name.split(".")[1];
    return raw.replace(/^font-/, "");
  };
  const sample = (t) => {
    const kind = kindOf(t);
    const v = `var(${esc(t.cssVar)})`;
    const styles = {
      text: `font:${v};font-family:var(${esc(familyVar(t) ?? "--font-family-body")}),${FALLBACK}`,
      family: `font-family:${v},${FALLBACK}`,
      weight: `font-weight:${v}`,
      size: `font-size:${v}`,
      "line-height": `line-height:${v}`,
      "letter-spacing": `letter-spacing:${v}`,
    };
    const text = kind === "line-height" ? "Two lines<br>of sample text" : "Aa Sample";
    return `<span class="sample" style="${styles[kind] ?? ""}">${text}</span>`;
  };
  const titles = { text: "Text styles", family: "Font family", weight: "Font weight", size: "Font size", "line-height": "Line height", "letter-spacing": "Letter spacing" };
  const typo = tokens.filter((t) => ["text", "font", "type"].includes(t.category));
  const grouped = groupBy(typo, kindOf);
  const blocks = Object.keys(titles)
    .filter((kind) => grouped.has(kind))
    .map((kind) => group(titles[kind], grouped.get(kind), (t) => button(t, "row", sample(t) + meta(t)), `typo-${kind}`))
    .join("");
  return `<section class="category" aria-labelledby="typography"><h2 id="typography">Typography</h2>${blocks}</section>`;
}

function elevationSection(tokens) {
  const list = tokens.filter((t) => t.category === "elevation" || t.category === "focus");
  if (list.length === 0) return "";
  const sample = (t) => `<span class="shadow" style="box-shadow:var(${esc(t.cssVar)})"></span>`;
  return `<section class="category" aria-labelledby="effects"><h2 id="effects">Elevation and focus</h2>${group("Effects", list, (t) => button(t, "row", sample(t) + meta(t)), "fx")}</section>`;
}

export function renderSite(registry, { siteUrl = "", mcpUrl = "" } = {}) {
  const { tokens } = registry;
  const links = [
    `<a href="registry.json">registry.json</a>`,
    `<a href="tokens.css">tokens.css</a>`,
    `<a href="llms.txt">llms.txt</a>`,
    mcpUrl ? `<a href="${esc(mcpUrl)}">MCP endpoint</a>` : "",
  ]
    .filter(Boolean)
    .join(" &middot; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Enterapia Design System</title>
<meta name="description" content="Design tokens for the Enterapia design system: color (light and dark), spacing, radius, typography, elevation and focus.">
${siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}">` : ""}
<link rel="stylesheet" href="tokens.css">
<script>try{var t=localStorage.getItem('ds-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style>
  [hidden] { display: none !important; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--color-background-page); color: var(--color-text-body-primary); font-family: var(--font-family-body), ${FALLBACK}; font-size: var(--font-size-body-md); line-height: var(--font-line-height-body-md); }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 var(--spacing-lg); }
  header { padding: var(--spacing-2xl) 0 var(--spacing-lg); }
  h1, h2, h3 { font-family: var(--font-family-heading), ${FALLBACK}; font-weight: var(--font-weight-heading); color: var(--color-text-heading-primary); margin: 0; }
  h1 { font-size: var(--font-size-heading-sm); line-height: var(--font-line-height-heading-sm); }
  h2 { font-size: var(--font-size-heading-sm); line-height: var(--font-line-height-heading-sm); margin: var(--spacing-2xl) 0 var(--spacing-sm); }
  h3 { font-size: var(--font-size-body-lg); line-height: var(--font-line-height-body-lg); margin: var(--spacing-lg) 0 var(--spacing-sm); }
  h3.layer { color: var(--color-text-heading-secondary); text-transform: uppercase; font-size: var(--font-size-caption-md); letter-spacing: .06em; margin-top: var(--spacing-xl); }
  a { color: var(--color-text-link-default); }
  a:hover { color: var(--color-text-link-hover); }
  .hint, .lead { color: var(--color-text-body-secondary); margin: var(--spacing-sm) 0; }
  .notice { background: var(--color-background-feedback-info); color: var(--color-text-feedback-info); border-radius: var(--radius-md); padding: var(--spacing-md) var(--spacing-lg); margin: var(--spacing-lg) 0; }
  .notice ul { margin: var(--spacing-sm) 0 0; padding-left: var(--spacing-xl); }
  .toolbar { display: flex; gap: var(--spacing-md); align-items: center; flex-wrap: wrap; margin: var(--spacing-lg) 0; }
  .toolbar input { flex: 1 1 260px; padding: var(--spacing-md); border: var(--border-width-thin) solid var(--color-border-input); border-radius: var(--radius-md); font: inherit; background: var(--color-background-default); color: inherit; }
  .toolbar input::placeholder { color: var(--color-text-placeholder); }
  .toolbar button { padding: var(--spacing-md) var(--spacing-lg); border: var(--border-width-thin) solid var(--color-border-interactive-default); border-radius: var(--radius-md); background: transparent; color: var(--color-text-interactive-default); font: inherit; font-weight: var(--font-weight-label); cursor: pointer; }
  .toolbar button:hover { background: var(--color-background-interactive-ghost-hover); }
  .toolbar input:focus-visible, .toolbar button:focus-visible, .token:focus-visible, a:focus-visible { outline: none; box-shadow: var(--focus-ring); }
  #status { color: var(--color-text-body-secondary); font-size: var(--font-size-caption-md); min-width: 8rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr)); gap: var(--spacing-md); }
  .token { all: unset; box-sizing: border-box; display: flex; gap: var(--spacing-md); align-items: center; padding: var(--spacing-md); background: var(--color-background-default); border: var(--border-width-thin) solid var(--color-border-default); border-radius: var(--radius-md); cursor: pointer; box-shadow: var(--elevation-raised); }
  .token:hover { box-shadow: var(--elevation-raised-hover); }
  .chips { display: flex; flex: none; gap: 2px; }
  .chip { flex: none; width: 36px; height: 40px; border-radius: var(--radius-sm); border: var(--border-width-thin) solid var(--color-border-default); background: linear-gradient(var(--c), var(--c)), repeating-conic-gradient(#d5d9e4 0 25%, #ffffff 0 50%) 0 0 / 12px 12px; }
  .meta { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
  .tname { font-weight: var(--font-weight-label); color: var(--color-text-heading-primary); overflow-wrap: break-word; }
  .tvalue { font-size: var(--font-size-caption-md); line-height: var(--font-line-height-caption-md); color: var(--color-text-body-secondary); overflow-wrap: anywhere; }
  .badge { align-self: flex-start; font-size: var(--font-size-caption-md); padding: 0 var(--spacing-sm); border-radius: var(--radius-full); background: var(--color-background-feedback-warning); border: var(--border-width-thin) solid var(--color-border-feedback-warning); color: var(--color-text-feedback-warning); }
  .sample { flex: none; min-width: 72px; color: var(--color-text-heading-primary); }
  .bar { flex: none; height: var(--spacing-lg); max-width: 96px; background: var(--color-icon-interactive-default); border-radius: var(--radius-sm); }
  .box { flex: none; width: 48px; height: 48px; background: var(--color-background-feedback-info); border: var(--border-width-thin) solid var(--color-border-feedback-info); }
  .line { flex: none; width: 48px; border-top: 1px solid var(--color-icon-interactive-default); }
  .shadow { flex: none; width: 56px; height: 56px; background: var(--color-background-default); border-radius: var(--radius-md); }
  footer { padding: var(--spacing-2xl) 0; color: var(--color-text-body-secondary); font-size: var(--font-size-caption-md); }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Enterapia Design System</h1>
  <p class="lead">Design tokens, version ${esc(registry.version)}. ${registry.counts.total} tokens (${registry.counts.semantic} semantic, ${registry.counts.primitive} primitive), ${registry.counts.withDarkVariant} with a dark variant. Select a token to copy its CSS variable.</p>
  <p>${links}</p>
  <div class="notice"><strong>Scope.</strong> ${esc(registry.scope.covers)}
    <ul>${[...registry.scope.doesNotCover.map((l) => `Not included: ${l}`), ...registry.scope.notes].map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div>
  <div class="toolbar"><label for="q" class="lead">Filter tokens</label><input id="q" type="search" placeholder="e.g. error, 16px, #d42515" autocomplete="off"><button type="button" id="theme"></button><span id="status" role="status" aria-live="polite"></span></div>
</header>
<main>
${colorSection(tokens)}
${dimensionSection(tokens)}
${typographySection(tokens)}
${elevationSection(tokens)}
</main>
<footer>Generated from <code>tokens/*.json</code>. Do not edit this page by hand.</footer>
</div>
<script>
(function () {
  var root = document.documentElement;
  var q = document.getElementById('q');
  var status = document.getElementById('status');
  var themeButton = document.getElementById('theme');
  var items = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
  function apply() {
    var terms = q.value.toLowerCase().split(/\\s+/).filter(Boolean);
    var shown = 0;
    items.forEach(function (el) {
      var ok = terms.every(function (t) { return el.getAttribute('data-search').indexOf(t) !== -1; });
      el.hidden = !ok;
      if (ok) shown++;
    });
    document.querySelectorAll('section').forEach(function (s) {
      s.hidden = !s.querySelector('[data-search]:not([hidden])');
    });
    status.textContent = terms.length ? shown + ' of ' + items.length + ' tokens' : '';
  }
  q.addEventListener('input', apply);
  function current() { var t = root.getAttribute('data-theme'); return t === 'light' || t === 'dark' ? t : 'system'; }
  function label() { themeButton.textContent = 'Theme: ' + current(); }
  themeButton.addEventListener('click', function () {
    var next = { system: 'light', light: 'dark', dark: 'system' }[current()];
    if (next === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', next);
    try { if (next === 'system') localStorage.removeItem('ds-theme'); else localStorage.setItem('ds-theme', next); } catch (e) {}
    label();
  });
  label();
  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-copy]');
    if (!el) return;
    var text = el.getAttribute('data-copy');
    try {
      navigator.clipboard.writeText(text).then(
        function () { status.textContent = 'Copied ' + text; },
        function () { status.textContent = 'Copy failed. Select it manually: ' + text; }
      );
    } catch (e) { status.textContent = 'Copy not available. Use: ' + text; }
  });
})();
</script>
</body>
</html>
`;
}

export function renderLlmsTxt(registry, { siteUrl = "", mcpUrl = "" } = {}) {
  const base = siteUrl ? siteUrl.replace(/\/$/, "") + "/" : "";
  const line = (t) => {
    const dark = t.modes ? ` | dark: ${t.modes.dark.value}${t.modes.dark.reference ? ` (alias of ${t.modes.dark.reference})` : ""}` : "";
    return `- ${t.name}: ${t.value}${t.reference ? ` (alias of ${t.reference})` : ""}${dark} | var(${t.cssVar})${t.note ? ` | NOTE: ${t.note}` : ""}`;
  };
  const section = (layer) =>
    registry.tokens
      .filter((t) => t.layer === layer)
      .map(line)
      .join("\n");

  return `# Enterapia Design System

> Design tokens (color in light and dark, spacing, radius, typography, elevation, focus) for Enterapia products. Version ${registry.version}.

## Current scope

- ${registry.scope.covers}
${registry.scope.doesNotCover.map((l) => `- Not available yet: ${l}`).join("\n")}
${registry.scope.notes.map((l) => `- ${l}`).join("\n")}

## Machine-readable sources

- Registry (all tokens, JSON): ${base}registry.json
- CSS custom properties (light, with dark overrides): ${base}tokens.css
- Human-readable site: ${base || "./"}
${mcpUrl ? `- MCP server (read-only, Streamable HTTP): ${mcpUrl}` : "- MCP server: not configured for this build."}

## Rules when generating UI

- Use semantic tokens in components. Primitive tokens exist only to build the semantic layer.
- Reference tokens through their CSS variables, for example var(--color-text-feedback-error). Do not copy hex values.
- Do not hardcode light or dark colors: semantic color variables switch with the theme.
- Use a text style (text.*) for any text, for example font: var(--text-body-md).
- If a needed token does not exist, say so instead of inventing a value.

## Semantic tokens

${section("semantic")}

## Primitive tokens

${section("primitive")}
`;
}
