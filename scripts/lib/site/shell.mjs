import { esc, groupBy, rootOf } from "./util.mjs";

export function buildNav({ foundations, components }) {
  const groups = [...groupBy(components, (c) => c.group)].map(([group, items]) => ({ group, category: items[0].category, items }));
  return { foundations, groups };
}

const link = (href, label, current, extra = "") =>
  `<a href="${esc(href)}"${current ? ' aria-current="page"' : ""}${extra}>${label}</a>`;

function sidebar(nav, path, root, { mcpUrl }) {
  const at = (target) => path === target;
  const foundations = nav.foundations
    .map((f) => link(`${root}foundations/${f.slug}.html`, `<span class="num">${f.number}.</span>${esc(f.title)}`, at(`foundations/${f.slug}.html`)))
    .join("");
  const components = nav.groups
    .map(
      (g) =>
        `<div class="group-title">${g.group} · ${esc(g.category)}</div>${g.items
          .map((c) => link(`${root}components/${c.slug}.html`, `<span class="num">${esc(c.number)}</span>${esc(c.name)}`, at(`components/${c.slug}.html`)))
          .join("")}`,
    )
    .join("");
  const reference = [
    link(`${root}tokens.html`, "Catálogo de tokens", at("tokens.html")),
    link(`${root}registry.json`, "registry.json", false),
    link(`${root}tokens.css`, "tokens.css", false),
    link(`${root}components.css`, "components.css", false),
    link(`${root}llms.txt`, "llms.txt", false),
    mcpUrl ? link(mcpUrl, "Servidor MCP", false) : "",
  ].join("");
  return `<nav class="sidebar" id="sidebar" aria-label="Navegación principal">
${link(`${root}index.html`, "Inicio", at("index.html"))}
<details open><summary>Foundations</summary><div>${foundations}</div></details>
<details open><summary>Components</summary><div>${link(`${root}components/index.html`, '<span class="num">0.</span>Índice de componentes', at("components/index.html"))}${components}</div></details>
<hr>
<details open><summary>Referencia</summary><div>${reference}</div></details>
</nav>`;
}

export function shell({ path, title, description, body, nav, options }) {
  const root = rootOf(path);
  const pageTitle = title === "Enterapia Design System" ? title : `${title} · Enterapia Design System`;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}">
${options.siteUrl ? `<link rel="canonical" href="${esc(options.siteUrl.replace(/\/$/, "") + "/" + (path === "index.html" ? "" : path))}">` : ""}
<link rel="stylesheet" href="${root}fonts.css">
<link rel="stylesheet" href="${root}tokens.css">
<link rel="stylesheet" href="${root}components.css">
<link rel="stylesheet" href="${root}site.css">
<script>try{var t=localStorage.getItem('ds-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
</head>
<body>
<a class="skip" href="#main">Saltar al contenido</a>
<header class="topbar">
  <button type="button" class="btn-plain" id="menu" aria-controls="sidebar" aria-expanded="false">Menú</button>
  <a class="brand" href="${root}index.html">Enterapia <small>Sistema de Diseño</small></a>
  <span class="grow"></span>
  <button type="button" class="btn-plain" id="theme"></button>
</header>
<div class="layout">
${sidebar(nav, path, root, options)}
<main id="main"><div class="content">
${body}
</div>
<footer class="site">Versión ${esc(options.version)}. Generado a partir de <code>tokens/</code> y <code>content/</code>; no lo edites a mano. <span id="toast-copy" role="status" aria-live="polite"></span></footer>
</main>
</div>
<script src="${root}site.js"></script>
</body>
</html>
`;
}
