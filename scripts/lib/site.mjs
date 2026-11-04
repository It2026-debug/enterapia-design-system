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

const leaf = (name) => name.split(".").at(-1);

const searchText = (t) =>
  [t.name, t.value, t.cssVar, t.reference, t.note].filter(Boolean).join(" ").toLowerCase();

const badge = (t) =>
  t.status
    ? `<span class="badge" title="${esc(t.note)}">${esc(STATUS_LABEL[t.status] ?? t.status)}</span>`
    : "";

const open = (t, extraClass, body) =>
  `<button type="button" class="token ${extraClass}" data-copy="var(${esc(t.cssVar)})" data-search="${esc(searchText(t))}" aria-label="Copy var(${esc(t.cssVar)}) for ${esc(t.name)}">${body}</button>`;

const label = (t) =>
  `<span class="meta"><span class="tname">${esc(t.name).replace(/\./g, ".<wbr>")}</span><span class="tvalue">${esc(t.value)}</span>${
    t.reference ? `<span class="tref">&rarr; ${esc(t.reference)}</span>` : ""
  }${badge(t)}</span>`;

const group = (title, body, id) =>
  `<section class="group" aria-labelledby="${id}"><h3 id="${id}">${esc(title)}</h3><div class="grid">${body}</div></section>`;

const groupBy = (items, keyFn) => {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
};

const slug = (text) => text.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

function colorSections(tokens) {
  const colors = tokens.filter((t) => t.category === "color");
  const primitives = groupBy(
    colors.filter((t) => t.layer === "primitive"),
    (t) => t.name.split(".").slice(1, -1).join(".") || "other",
  );
  const semantics = groupBy(
    colors.filter((t) => t.layer === "semantic"),
    (t) => t.name.split(".")[1],
  );
  const chip = (t) => `<span class="chip" style="background:var(${esc(t.cssVar)})"></span>`;
  const render = (title, items, prefix) =>
    group(title, items.map((t) => open(t, "swatch", chip(t) + label(t))).join(""), `${prefix}-${slug(title)}`);

  return `
  <section class="category" aria-labelledby="colors"><h2 id="colors">Color</h2>
    <p class="hint">Use semantic tokens in components. Primitives exist to build the semantic layer.</p>
    <h3 class="layer">Semantic</h3>
    ${[...semantics].map(([title, items]) => render(title, items, "sem")).join("")}
    <h3 class="layer">Primitive</h3>
    ${[...primitives].map(([title, items]) => render(title, items, "prim")).join("")}
  </section>`;
}

function scaleSection(tokens, category, title, sample) {
  const items = tokens.filter((t) => t.category === category);
  const body = items.map((t) => open(t, "row", sample(t) + label(t))).join("");
  return `<section class="category" aria-labelledby="${category}"><h2 id="${category}">${esc(title)}</h2><div class="grid">${body}</div></section>`;
}

function typographySection(tokens) {
  const items = tokens.filter((t) => t.category === "typography");
  const prim = items.filter((t) => t.layer === "primitive");
  const sem = items.filter((t) => t.layer === "semantic");
  const sample = (t) => {
    const style = {
      fontFamily: `font-family:var(${t.cssVar}),system-ui,sans-serif`,
      fontSize: `font-size:var(${t.cssVar})`,
      fontWeight: `font-weight:var(${t.cssVar})`,
      lineHeight: `line-height:var(${t.cssVar})`,
    };
    const kind = t.name.split(".")[1];
    const css = style[kind] ?? style[leaf(t.name)] ?? "";
    return `<span class="sample" style="${esc(css)}">${kind === "lineHeight" ? "Two lines<br>of sample text" : "Aa Sample"}</span>`;
  };
  const groups = groupBy(prim, (t) => t.name.split(".")[1]);
  const composite = sem.length
    ? `<section class="group" aria-labelledby="typo-sem"><h3 id="typo-sem">Semantic text styles</h3>
        <p class="composite" style="font-family:var(--typography-heading24-font-family),system-ui,sans-serif;font-weight:var(--typography-heading24-font-weight);font-size:var(--typography-heading24-font-size);line-height:var(--typography-heading24-line-height)">heading24: The quick brown fox</p>
        <div class="grid">${sem.map((t) => open(t, "row", label(t))).join("")}</div></section>`
    : "";
  return `<section class="category" aria-labelledby="typography"><h2 id="typography">Typography</h2>
    ${composite}
    ${[...groups].map(([kind, list]) => group(kind, list.map((t) => open(t, "row", sample(t) + label(t))).join(""), `typo-${slug(kind)}`)).join("")}
  </section>`;
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
<title>Enterapia Design System</title>
<meta name="description" content="Design tokens for the Enterapia design system: colors, spacing, radius, typography and effects.">
${siteUrl ? `<link rel="canonical" href="${esc(siteUrl)}">` : ""}
<link rel="stylesheet" href="tokens.css">
<style>
  [hidden] { display: none !important; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--color-surface-background); color: var(--color-text-headers-primary); font-family: var(--typography-font-family-body), system-ui, sans-serif; font-size: var(--typography-font-size-body16); line-height: var(--typography-line-height-body22); }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 var(--spacing-16); }
  header { padding: var(--spacing-32) 0 var(--spacing-16); }
  h1, h2, h3 { font-family: var(--typography-font-family-heading), system-ui, sans-serif; font-weight: var(--typography-font-weight-heading); margin: 0; }
  h1 { font-size: var(--typography-font-size-heading24); line-height: var(--typography-line-height-heading24); }
  h2 { font-size: var(--typography-font-size-heading24); line-height: var(--typography-line-height-heading24); margin: var(--spacing-32) 0 var(--spacing-8); }
  h3 { font-size: var(--typography-font-size-body18); line-height: var(--typography-line-height-body22); margin: var(--spacing-16) 0 var(--spacing-8); text-transform: capitalize; }
  h3.layer { color: var(--color-text-headers-secondary); text-transform: uppercase; font-size: var(--typography-font-size-caption); letter-spacing: .06em; margin-top: var(--spacing-24); }
  a { color: var(--color-text-information); }
  .hint, .lead { color: var(--color-text-headers-secondary); margin: var(--spacing-8) 0; }
  .notice { background: var(--color-semantic-info100); border-radius: var(--radius-8); padding: var(--spacing-12) var(--spacing-16); margin: var(--spacing-16) 0; }
  .notice ul { margin: var(--spacing-8) 0 0; padding-left: var(--spacing-24); }
  .search { display: flex; gap: var(--spacing-12); align-items: center; flex-wrap: wrap; margin: var(--spacing-16) 0; }
  .search input { flex: 1 1 260px; padding: var(--spacing-12); border: 1px solid var(--color-borders-secondary); border-radius: var(--radius-8); font: inherit; background: var(--color-surface-primary); color: inherit; }
  .search input:focus-visible, .token:focus-visible, a:focus-visible { outline: none; box-shadow: var(--effects-input-focus-ring); }
  #status { color: var(--color-text-headers-secondary); font-size: var(--typography-font-size-caption); min-width: 8rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 270px), 1fr)); gap: var(--spacing-12); }
  .token { all: unset; box-sizing: border-box; display: flex; gap: var(--spacing-12); align-items: center; padding: var(--spacing-12); background: var(--color-surface-primary); border: 1px solid var(--color-borders-primary); border-radius: var(--radius-8); cursor: pointer; box-shadow: var(--effects-card-shadow-default); }
  .token:hover { box-shadow: var(--effects-card-shadow-hover); }
  .chip { flex: none; width: 40px; height: 40px; border-radius: var(--radius-8); border: 1px solid var(--color-borders-primary); }
  .meta { display: flex; flex-direction: column; min-width: 0; gap: 2px; }
  .tname { font-weight: var(--typography-font-weight-label); overflow-wrap: break-word; }
  .tvalue, .tref { font-size: var(--typography-font-size-caption); line-height: var(--typography-line-height-caption); color: var(--color-text-headers-secondary); overflow-wrap: anywhere; }
  .badge { align-self: flex-start; font-size: var(--typography-font-size-caption); padding: 0 var(--spacing-8); border-radius: var(--radius-200); background: var(--color-semantic-warning100); border: 1px solid var(--color-icons-warning); color: var(--color-text-headers-secondary); }
  .sample { flex: none; min-width: 72px; }
  .composite { margin: var(--spacing-8) 0 var(--spacing-12); }
  .bar { flex: none; height: 16px; background: var(--color-icons-information); border-radius: 2px; }
  .box { flex: none; width: 48px; height: 48px; background: var(--color-semantic-info100); border: 1px solid var(--color-icons-information); }
  .shadow { flex: none; width: 56px; height: 56px; background: var(--color-surface-primary); border-radius: var(--radius-8); }
  footer { padding: var(--spacing-32) 0; color: var(--color-text-headers-secondary); font-size: var(--typography-font-size-caption); }
</style>
</head>
<body>
<div class="wrap">
<header>
  <h1>Enterapia Design System</h1>
  <p class="lead">Design tokens, version ${esc(registry.version)}. ${registry.counts.total} tokens (${registry.counts.semantic} semantic, ${registry.counts.primitive} primitive). Select a token to copy its CSS variable.</p>
  <p>${links}</p>
  <div class="notice"><strong>Current scope.</strong> ${esc(registry.scope.covers)}
    <ul>${registry.scope.doesNotCover.map((line) => `<li>${esc(line)}</li>`).join("")}</ul></div>
  <div class="search"><label for="q" class="lead">Filter tokens</label><input id="q" type="search" placeholder="e.g. error, 16px, #d42515" autocomplete="off"><span id="status" role="status" aria-live="polite"></span></div>
</header>
<main>
${colorSections(tokens)}
${scaleSection(tokens, "spacing", "Spacing", (t) => `<span class="bar" style="width:var(${esc(t.cssVar)})"></span>`)}
${scaleSection(tokens, "radius", "Radius", (t) => `<span class="box" style="border-radius:var(${esc(t.cssVar)})"></span>`)}
${typographySection(tokens)}
${scaleSection(tokens, "effects", "Effects", (t) => `<span class="shadow" style="box-shadow:var(${esc(t.cssVar)})"></span>`)}
</main>
<footer>Generated from <code>tokens/*.json</code>. Do not edit this page by hand.</footer>
</div>
<script>
(function () {
  var q = document.getElementById('q');
  var status = document.getElementById('status');
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
  const line = (t) => `- ${t.name}: ${t.value}${t.reference ? ` (alias of ${t.reference})` : ""} | var(${t.cssVar})${t.note ? ` | NOTE: ${t.note}` : ""}`;
  const section = (layer) =>
    registry.tokens
      .filter((t) => t.layer === layer)
      .map(line)
      .join("\n");

  return `# Enterapia Design System

> Design tokens (colors, spacing, radius, typography, effects) for Enterapia products. Version ${registry.version}.

## Current scope

- ${registry.scope.covers}
${registry.scope.doesNotCover.map((l) => `- Not available yet: ${l}`).join("\n")}

## Machine-readable sources

- Registry (all tokens, JSON): ${base}registry.json
- CSS custom properties: ${base}tokens.css
- Human-readable site: ${base || "./"}
${mcpUrl ? `- MCP server (read-only, Streamable HTTP): ${mcpUrl}` : "- MCP server: not configured for this build."}

## Rules when generating UI

- Use semantic tokens in components. Primitive tokens exist only to build the semantic layer.
- Reference tokens through their CSS variables, for example var(--color-text-error). Do not copy hex values.
- If a needed token does not exist, say so instead of inventing a value.
- Tokens marked NOTE have naming or duplication issues awaiting confirmation from design.

## Semantic tokens

${section("semantic")}

## Primitive tokens

${section("primitive")}
`;
}
