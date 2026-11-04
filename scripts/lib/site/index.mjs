import { componentBody, componentsIndexBody, makeRenderer } from "./components-pages.mjs";
import { buildNav, shell } from "./shell.mjs";
import { catalogBody, foundationBody } from "./tokens-pages.mjs";
import { esc } from "./util.mjs";

const card = (href, title, text) => `<a href="${esc(href)}"><div class="card"><strong>${esc(title)}</strong><span>${esc(text)}</span></div></a>`;

function homeBody({ content, registry, options }) {
  const { cover } = content;
  const first = content.foundations[0];
  return `<p class="eyebrow">Versión ${esc(registry.version)}</p>
<h1>${esc(cover.title || "Enterapia — Sistema de Diseño")}</h1>
<p class="lead">${esc(cover.description)}</p>
<h2>${esc(cover.question || "¿Qué vas a encontrar aquí?")}</h2>
<div class="cards">
${card(`foundations/${first.slug}.html`, "Foundations", cover.items.find((i) => i.title === "Foundations")?.text ?? "Colores, tipografía, espaciados y bordes.")}
${card("components/index.html", "Components", `${content.components.length} componentes con su vista previa en código, variantes y documentación.`)}
${card("tokens.html", "Catálogo de tokens", `${registry.counts.total} tokens con filtro. Cada uno copia su variable CSS.`)}
</div>
<h2>Para personas y para IA</h2>
<p>Todo el sistema está disponible como datos: <a href="registry.json">registry.json</a>, <a href="tokens.css">tokens.css</a>, <a href="components.css">components.css</a> y <a href="llms.txt">llms.txt</a>.${
    options.mcpUrl ? ` También hay un <a href="${esc(options.mcpUrl)}">servidor MCP</a> de solo lectura.` : ""
  }</p>`;
}

export function renderSiteFiles({ registry, content, defs, options }) {
  const files = new Map();
  const nav = buildNav({ foundations: content.foundations, components: content.components });
  const tokens = registry.tokens;
  const page = (path, title, description, body) => files.set(path, shell({ path, title, description, body, nav, options: { ...options, version: registry.version } }));

  page("index.html", "Enterapia Design System", "Sistema de diseño de Enterapia: tokens, componentes y documentación.", homeBody({ content, registry, options }));

  for (const f of content.foundations) {
    const header = `<p class="crumbs"><a href="../index.html">Inicio</a> › Foundations</p><p class="eyebrow">Foundations · ${f.number}</p><h1>${esc(f.heading)}</h1><p class="lead">${esc(f.intro)}</p>`;
    page(`foundations/${f.slug}.html`, f.heading, f.intro, header + foundationBody(f, { registry, content, tokens }));
  }

  page("tokens.html", "Catálogo de tokens", "Todos los tokens del sistema con filtro.", `<p class="eyebrow">Referencia</p><h1>Catálogo de tokens</h1><p class="lead">Todos los tokens del sistema. Selecciona uno para copiar su variable CSS.</p>${catalogBody({ tokens })}`);

  const r = makeRenderer(content.components, defs);
  page("components/index.html", "Índice de componentes", "Componentes del sistema de diseño.", componentsIndexBody(content.components, content.docs));
  for (const meta of content.components) {
    page(`components/${meta.slug}.html`, meta.title ?? meta.name, `${meta.title ?? meta.name}: variantes, uso y código.`, componentBody(meta, defs.get(meta.slug), content.docs[meta.slug], r));
  }
  return files;
}
