import { esc } from "./util.mjs";

const isBullet = (b) => b.type === "text" && /^•/.test(b.text);
const bulletText = (b) => b.text.replace(/^•\s*/, "");

const looksLikeHeading = (b) => b.type === "text" && b.text.length <= 34 && !/[.:]$/.test(b.text) && !/^\d+$/.test(b.text);

const previewsIn = (items) => items.filter((i) => i.type === "preview");

function cell(text) {
  const cls = /✓/.test(text) && !/✗/.test(text) ? "pass" : /✗/.test(text) && !/✓/.test(text) ? "fail" : "";
  return `<td${cls ? ` class="${cls}"` : ""}>${esc(text)}</td>`;
}

function table(b) {
  const code = b.header[0] === "Token";
  return `<div class="table-wrap"><table><thead><tr>${b.header.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows
    .map((row) => `<tr>${row.map((c, i) => (code && i === 0 ? `<td><code>${esc(c)}</code></td>` : cell(c))).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function matrix(group, ctx) {
  const [header, ...rows] = group.items;
  const columns = header.items.length;
  const head = header.items
    .map((col) => {
      const [label, ...rest] = col.items.filter((i) => i.type === "text");
      return `<div class="h">${esc(label?.text)}${rest.length ? `<small>${esc(rest.map((r) => r.text).join(" "))}</small>` : ""}</div>`;
    })
    .join("");
  const body = rows
    .map((row) => {
      const [label, ...cells] = row.items;
      return `<div class="rowlabel">${esc(label.text)}</div>${cells
        .map((c) => (c.type === "preview" ? `<div>${ctx.preview(c)}</div>` : `<div class="na">${esc(c.text ?? "")}</div>`))
        .join("")}`;
    })
    .join("");
  return `<div class="matrix" style="grid-template-columns: max-content repeat(${columns}, max-content)"><div></div>${head}${body}</div>`;
}

function group(g, ctx, level) {
  const name = g.name ?? "";
  if (name === "Matriz de estados") return matrix(g, ctx);
  if (/^Encabezado/.test(name)) {
    const [first, ...rest] = g.items;
    if (first?.type === "text" && first.text === ctx.pageHeading) return "";
    const heading = first?.type === "text" ? `<h2>${esc(first.text)}</h2>` : "";
    return `${heading}${rest.filter((i) => i.type === "text").map((i) => `<p class="lead">${esc(i.text)}</p>`).join("")}`;
  }
  if (name === "Resumen") {
    return `<div class="chips-row">${g.items.filter((i) => i.type === "text").map((i) => `<span class="chip-tag">${esc(i.text)}</span>`).join("")}</div>`;
  }
  if (name === "Cuándo usarlo" || name === "Pendiente") {
    const [label, ...rest] = g.items;
    return `<div class="callout"><p>${esc(label.text)}</p>${rest.map((i) => `<p>${esc(i.text)}</p>`).join("")}</div>`;
  }
  if (/^Lienzo/.test(name)) {
    const previews = previewsIn(g.items);
    const captions = g.items.filter((i) => i.type === "text" && !/^\d+$/.test(i.text));
    return `<div class="stage subtle">${previews
      .map((p, i) => `<div class="figure">${ctx.preview(p)}<span class="cap">${esc(captions[i]?.text ?? "")}</span></div>`)
      .join("")}</div>`;
  }

  const hasPreview = g.items.some((i) => i.type === "preview");
  if (hasPreview && g.direction === "column") {
    const previews = previewsIn(g.items).map((p) => ctx.preview(p)).join("");
    const rest = g.items.filter((i) => i.type !== "preview");
    return `<div class="card"><div class="stage subtle" style="margin-bottom: var(--spacing-md)">${previews}</div>${items(rest, ctx, level + 1, { strongFirst: true })}</div>`;
  }
  const cls = g.direction === "row" ? "blocks-row" : "blocks-col";
  const card = /^(1|2|3) ·/.test(g.items[0]?.text ?? "") && g.direction === "column";
  return `<div class="${cls}${card ? " card" : ""}">${items(g.items, ctx, level + 1, { strongFirst: card || /^Parte|^Texto|^Columna/.test(name) })}</div>`;
}

function single(b, ctx, level, next) {
  switch (b.type) {
    case "text":
      if (level === 0 && looksLikeHeading(b) && next && next.type !== "text") return `<h3>${esc(b.text)}</h3>`;
      if (level === 0 && looksLikeHeading(b) && next?.type === "text" && next.text.length > 60) return `<h3>${esc(b.text)}</h3>`;
      return `<p>${esc(b.text)}</p>`;
    case "preview":
      return `<div class="figure">${ctx.preview(b)}</div>`;
    case "table":
      return table(b);
    case "usage":
      return `<div class="usage ${b.kind}"><h3>${b.kind === "do" ? "✓ Hacer" : "✗ Evitar"}</h3>${
        b.previews.length ? `<div class="stage subtle">${b.previews.map((p) => ctx.preview(p)).join("")}</div>` : ""
      }<p>${esc(b.text)}</p></div>`;
    case "pair":
      return `<div class="blocks-row">${b.items.map((i) => single(i, ctx, level + 1)).join("")}</div>`;
    case "group":
      return group(b, ctx, level);
    default:
      return "";
  }
}

function items(list, ctx, level, { strongFirst = false } = {}) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (isBullet(b)) {
      const bullets = [];
      while (i < list.length && isBullet(list[i])) bullets.push(bulletText(list[i++]));
      i -= 1;
      out.push(`<ul class="plain">${bullets.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`);
      continue;
    }
    if (strongFirst && i === 0 && b.type === "text") {
      out.push(`<p><strong>${esc(b.text)}</strong></p>`);
      continue;
    }
    out.push(single(b, ctx, level, list[i + 1]));
  }
  return out.join("");
}

export function renderBlocks(blocks, ctx) {
  return items(blocks, ctx, 0);
}
