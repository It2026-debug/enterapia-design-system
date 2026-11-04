import { renderBlocks } from "./blocks.mjs";
import { esc, pretty } from "./util.mjs";

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export const variantName = (axes, props) => Object.keys(axes).map((axis) => `${axis}=${props[axis]}`).join(", ");
const hasAxes = (part) => Object.keys(part.axes).length > 0;
export const variantKey = (part, props) => (hasAxes(part) ? variantName(part.axes, props) : part.name);

export function defaultsOf(part) {
  return { ...(part.variants[0]?.props ?? {}) };
}

export const variantCount = (meta) => meta.parts.reduce((sum, part) => sum + part.variants.length, 0);

export function makeRenderer(metaList, defs) {
  const lookup = new Map();
  for (const meta of metaList) {
    lookup.set(normalize(meta.name), meta);
    for (const set of meta.sets ?? []) lookup.set(normalize(set), meta);
    for (const part of meta.parts) lookup.set(normalize(part.name), meta);
  }
  const existing = new Map(metaList.map((m) => [m.slug, new Map(m.parts.map((p) => [p.name, new Set(p.variants.map((v) => v.name))]))]));

  const partOf = (meta, name) => meta.parts.find((p) => normalize(p.name) === normalize(name ?? "")) ?? meta.parts[0];
  const render = (meta, props, texts = {}, partName) => {
    const def = defs.get(meta.slug);
    if (!def) return null;
    const part = partOf(meta, partName);
    return def.render({ ...defaultsOf(part), ...props, __part: part.name }, texts);
  };
  const preview = (block) => {
    const meta = lookup.get(normalize(block.component));
    const html = meta ? render(meta, block.props, block.texts, block.component) : null;
    return html ?? `<span class="cap">(${esc(block.component)}: vista previa no disponible)</span>`;
  };
  return { render, preview, exists: (meta, part, props) => existing.get(meta.slug)?.get(part.name)?.has(variantKey(part, props)) ?? false };
}

function playground(meta, part, r, heading) {
  const axes = Object.entries(part.axes);
  const defaults = defaultsOf(part);
  const templates = part.variants
    .map((variant) => {
      const html = r.render(meta, variant.props, {}, part.name);
      if (html === null) return "";
      const key = JSON.stringify(Object.fromEntries(axes.map(([axis]) => [axis, variant.props[axis]])));
      return `<template data-variant="${esc(key)}" data-size="${(variant.size ?? []).join("x")}" data-html="${esc(pretty(html))}">${html}</template>`;
    })
    .join("");
  const defaultHtml = r.render(meta, defaults, {}, part.name) ?? "";
  const controls = axes
    .map(
      ([axis, values]) =>
        `<label>${esc(axis)}<select data-axis="${esc(axis)}">${values.map((v) => `<option${v === defaults[axis] ? " selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`,
    )
    .join("");
  return `<section data-playground aria-label="${esc(heading)}">
${heading ? `<h3>${esc(heading)}</h3>` : ""}
${axes.length ? `<div class="controls">${controls}</div>` : ""}
<div class="stage playground" data-stage>${defaultHtml}</div>
<pre class="code" data-code tabindex="0">${esc(pretty(defaultHtml))}</pre>
${templates}
</section>`;
}

function matrix(meta, part, r) {
  const axes = Object.entries(part.axes);
  const cellFor = (props) => {
    const ok = r.exists(meta, part, props);
    const variant = part.variants.find((v) => variantKey(part, props) === v.name || variantKey(part, props) === variantName(part.axes, v.props));
    const html = ok ? r.render(meta, props, {}, part.name) : null;
    return html ? `<div data-variant-cell data-figma-size="${(variant?.size ?? []).join("x")}">${html}</div>` : `<div class="na">No existe</div>`;
  };
  if (axes.length === 0) return `<div class="stage">${cellFor({})}</div>`;
  if (axes.length === 1) {
    const [axis, values] = axes[0];
    return `<div class="stage">${values.map((v) => `<span class="figure">${cellFor({ [axis]: v })}<span class="cap">${esc(axis)}: ${esc(v)}</span></span>`).join("")}</div>`;
  }
  const grid = (fixed, rowAxis, colAxes) => {
    const [rowName, rowValues] = rowAxis;
    const columns = colAxes.reduce((acc, [name, values]) => acc.flatMap((c) => values.map((v) => [...c, [name, v]])), [[]]);
    const head = columns.map((c) => `<div class="h">${c.map(([, v]) => esc(v)).join(" · ")}</div>`).join("");
    const body = rowValues
      .map((rv) => `<div class="rowlabel">${esc(rv)}</div>${columns.map((c) => cellFor({ ...fixed, [rowName]: rv, ...Object.fromEntries(c) })).join("")}`)
      .join("");
    const colHead = colAxes.map(([n]) => n).join(" · ");
    return `<div class="matrix" style="grid-template-columns: max-content repeat(${columns.length}, max-content)"><div class="h"><small>${esc(rowName)} ↓ · ${esc(colHead)} →</small></div>${head}${body}</div>`;
  };
  if (axes.length === 2) return grid({}, axes[0], [axes[1]]);
  const [firstName, firstValues] = axes[0];
  return firstValues.map((value) => `<h4>${esc(firstName)}: ${esc(value)}</h4>${grid({ [firstName]: value }, axes[1], axes.slice(2))}`).join("");
}

function propertiesTable(part) {
  const defaults = defaultsOf(part);
  const rows = Object.entries(part.axes)
    .map(([axis, values]) => `<tr><td><code>${esc(axis)}</code></td><td>Variante</td><td>${values.map(esc).join(" · ")}</td><td>${esc(defaults[axis])}</td></tr>`)
    .join("");
  if (!rows) return "";
  return `<div class="table-wrap"><table><thead><tr><th scope="col">Propiedad</th><th scope="col">Tipo</th><th scope="col">Opciones</th><th scope="col">Valor por defecto</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function codeSection(meta, def, r) {
  const parts = meta.parts
    .map((part) => ({ part, html: r.render(meta, defaultsOf(part), {}, part.name) }))
    .filter((x) => x.html);
  if (parts.length === 0) return "";
  const notes = (def.a11y ?? []).map((n) => `<li>${esc(n)}</li>`).join("");
  const blocks = parts
    .map(({ part, html }) => `${meta.parts.length > 1 ? `<h3>${esc(part.name)}</h3>` : ""}<pre class="code" tabindex="0">${esc(pretty(html))}</pre>`)
    .join("");
  return `<section aria-labelledby="code"><h2 id="code">Código</h2>
<p>Incluye <code>components.css</code> (que usa solo los tokens de <code>tokens.css</code>) y escribe el marcado así:</p>
${blocks}
${notes ? `<h3>Accesibilidad en código</h3><ul class="plain">${notes}</ul>` : ""}</section>`;
}

function usageLists(doc) {
  if (!doc.do?.length && !doc.dont?.length) return "";
  const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  return `<section aria-labelledby="uso"><h2 id="uso">Uso: hacer y evitar</h2><div class="blocks-row">
<div class="usage do"><h4>✓ Hacer</h4>${list(doc.do)}</div>
<div class="usage dont"><h4>✗ Evitar</h4>${list(doc.dont)}</div></div></section>`;
}

export function componentBody(meta, def, doc, r, extras = {}) {
  const title = meta.title ?? meta.name;
  const structured = doc?.format === "structured";
  const multi = meta.parts.length > 1;
  const intro = structured ? doc.sections[0]?.blocks : null;
  const summary = structured ? intro?.[2]?.text : doc?.summary;
  const header = `<p class="crumbs"><a href="../index.html">Inicio</a> › <a href="index.html">Components</a> › ${esc(meta.category)}</p>
<p class="eyebrow">${esc(meta.number)} · ${esc(meta.category)}</p>
<h1>${esc(title)}</h1>
${summary ? `<p class="lead">${esc(summary)}</p>` : ""}`;

  const missing = def
    ? ""
    : `<div class="notice"><p>Este componente aún no está implementado en código. Aquí se muestra solo su especificación de Figma.</p></div>`;
  const ctx = { preview: r.preview, pageHeading: title };
  const previews = def ? `<section aria-labelledby="preview"><h2 id="preview">Vista previa</h2>${meta.parts.map((part) => playground(meta, part, r, multi ? part.name : "")).join("")}</section>` : "";

  let body = header + missing + (extras.notice ?? "");
  if (structured) {
    body += renderBlocks(intro.slice(3), ctx);
    body += previews;
    body += doc.sections
      .slice(1)
      .map((s) => `<section aria-labelledby="${esc(s.id)}"><h2 id="${esc(s.id)}">${esc(s.number)} · ${esc(s.title)}</h2>${s.intro.map((t) => `<p class="lead">${esc(t)}</p>`).join("")}${renderBlocks(s.blocks, ctx)}</section>`)
      .join("");
  } else {
    const [when, ...others] = doc?.sections ?? [];
    if (when) body += `<div class="callout"><p>${esc(when.title)}</p><p>${esc(when.text)}</p></div>`;
    body += previews;
    body += others.map((s) => `<section><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p></section>`).join("");
    if (def) {
      body += `<section aria-labelledby="matriz"><h2 id="matriz">Todas las variantes</h2><p class="hint">Cada combinación de propiedades que existe en Figma (${variantCount(meta)}).</p>${meta.parts
        .map((part) => `${multi ? `<h3>${esc(part.name)}</h3>` : ""}${matrix(meta, part, r)}`)
        .join("")}</section>`;
    }
    if (doc) body += usageLists(doc);
    const props = meta.parts.map((part) => ({ part, table: propertiesTable(part) })).filter((x) => x.table);
    body += `<section aria-labelledby="props"><h2 id="props">Propiedades</h2>${
      props.length ? props.map(({ part, table }) => `${multi ? `<h3>${esc(part.name)}</h3>` : ""}${table}`).join("") : "<p>Este componente no tiene propiedades de variante en Figma.</p>"
    }</section>`;
  }
  if (def) body += codeSection(meta, def, r);
  return body;
}

export function componentsIndexBody(metaList, docs) {
  const groups = new Map();
  for (const m of metaList) groups.set(m.group, [...(groups.get(m.group) ?? []), m]);
  return `<p class="eyebrow">Components</p><h1>Índice de componentes</h1>
<p class="lead">${metaList.length} componentes, organizados por grupo como en el archivo de Figma. Cada uno incluye su vista previa en código, todas sus variantes y la documentación del equipo de diseño.</p>
${[...groups]
  .map(
    ([group, items]) =>
      `<h2>${group} · ${esc(items[0].category)}</h2><div class="cards">${items
        .map((m) => {
          const n = variantCount(m);
          return `<a href="${esc(m.slug)}.html"><div class="card"><span>${esc(m.number)}</span><strong>${esc(m.title ?? m.name)}</strong><span>${n} variante${n === 1 ? "" : "s"}${docs[m.slug] ? " · con documentación" : ""}</span></div></a>`;
        })
        .join("")}</div>`,
  )
  .join("")}`;
}
