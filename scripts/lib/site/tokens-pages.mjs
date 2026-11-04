import { renderBlocks } from "./blocks.mjs";
import { computeContrast, pairsFromFigma } from "./contrast.mjs";
import { esc, groupBy, slug, titleCase } from "./util.mjs";

const FALLBACK = "system-ui, sans-serif";

const searchText = (t) =>
  [t.name, t.value, t.modes?.dark.value, t.cssVar, t.reference, t.note].filter(Boolean).join(" ").toLowerCase();

const badge = (t) =>
  t.status ? `<span class="badge-note" title="${esc(t.note)}">${esc(t.status)}</span>` : "";

const button = (t, cls, body) =>
  `<button type="button" class="token ${cls}" data-copy="var(${esc(t.cssVar)})" data-search="${esc(searchText(t))}" aria-label="Copiar var(${esc(t.cssVar)}) de ${esc(t.name)}">${body}</button>`;

const valueLine = (label, view) =>
  `<span class="tvalue">${label ? `<b>${label}</b> ` : ""}${esc(view.value)}${view.reference ? ` &larr; ${esc(view.reference)}` : ""}</span>`;

const meta = (t) =>
  `<span class="meta"><span class="tname">${esc(t.name).replace(/\./g, ".<wbr>")}</span>${
    t.modes ? valueLine("Claro", t.modes.light) + valueLine("Oscuro", t.modes.dark) : valueLine("", t)
  }${badge(t)}</span>`;

const group = (title, tokens, render, id, level = 3) =>
  `<div class="group"><h${level} class="gh" id="${id}">${esc(title)}</h${level}><div class="grid">${tokens.map(render).join("")}</div></div>`;

const numeric = (t) => parseFloat(t.value);
const byValue = (a, b) => numeric(a) - numeric(b);

const swatch = (t) => {
  const chip = (hex) => `<span class="chip" style="--c:${esc(hex)}"></span>`;
  const chips = t.modes ? `<span class="chips">${chip(t.modes.light.value)}${chip(t.modes.dark.value)}</span>` : chip(t.value);
  return button(t, "swatch", chips + meta(t));
};

const colorGroups = (tokens, layer, prefix, level) => {
  const colors = tokens.filter((t) => t.category === "color" && t.layer === layer);
  const grouped = groupBy(colors, (t) => (layer === "semantic" ? t.name.split(".")[1] : t.name.split(".").slice(1, -1).join(".") || "otros"));
  return [...grouped].map(([title, list]) => group(titleCase(title), list, swatch, `${prefix}-${slug(title)}`, level)).join("");
};

const row = (sample) => (t) => button(t, "row", sample(t) + meta(t));

const dimension = (tokens, level) => {
  const sample = {
    spacing: (t) => `<span class="bar" style="width:var(${esc(t.cssVar)})"></span>`,
    radius: (t) => `<span class="box" style="border-radius:var(${esc(t.cssVar)})"></span>`,
    "border-width": (t) => `<span class="line" style="border-top-width:var(${esc(t.cssVar)})"></span>`,
    size: () => "",
  };
  const titles = { spacing: "Espaciado", "border-width": "Grosor de borde", radius: "Radio", size: "Tamaño" };
  return Object.keys(sample)
    .map((category) => {
      const list = tokens.filter((t) => t.category === category).sort(byValue);
      return list.length ? group(titles[category], list, row(sample[category]), `dim-${category}`, level) : "";
    })
    .join("");
};

function typography(tokens, level) {
  const familyVar = (t) => {
    const ref = /\{(font\.family\.[^}]+)\}/.exec(t.definition)?.[1];
    return ref ? `--${ref.replace(/\./g, "-")}` : null;
  };
  const kindOf = (t) => {
    if (t.category === "text") return "text";
    return t.name.split(".")[1].replace(/^font-/, "");
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
    const text = kind === "line-height" ? "Dos líneas<br>de texto" : "Aa Muestra";
    return `<span class="sample" style="${styles[kind] ?? ""}">${text}</span>`;
  };
  const titles = { text: "Estilos de texto", family: "Familia", weight: "Peso", size: "Tamaño", "line-height": "Interlineado", "letter-spacing": "Interletraje" };
  const grouped = groupBy(tokens.filter((t) => ["text", "font", "type"].includes(t.category)), kindOf);
  return Object.keys(titles)
    .filter((kind) => grouped.has(kind))
    .map((kind) => group(titles[kind], grouped.get(kind), row(sample), `typo-${kind}`, level))
    .join("");
}

const elevation = (tokens, level) => {
  const list = tokens.filter((t) => t.category === "elevation" || t.category === "focus");
  const sample = (t) => `<span class="shadow" style="box-shadow:var(${esc(t.cssVar)})"></span>`;
  return group("Efectos", list, row(sample), "fx", level);
};

const toolbar = () =>
  `<div class="toolbar"><label for="q" class="hint">Filtrar tokens</label><input id="q" type="search" placeholder="p. ej. error, 16px, #d42515" autocomplete="off"><span id="status" role="status" aria-live="polite"></span></div>`;

function contrastTable(foundation, tokens) {
  const table = foundation.blocks.flatMap((b) => (b.type === "group" ? b.items : [b])).find((b) => b.type === "table");
  if (!table) return "<p>No hay datos de contraste en el archivo.</p>";
  const byName = new Map(tokens.map((t) => [t.name, t]));
  const results = computeContrast(pairsFromFigma(table.rows), byName);
  const cell = (r, minimum) => {
    if (!r) return "<td>—</td>";
    const ok = r.pass;
    const sample =
      minimum >= 4.5
        ? `<span aria-hidden="true" style="display:inline-block;padding:0 var(--spacing-sm);border-radius:var(--radius-sm);border:1px solid var(--color-border-default);color:${esc(r.fg)};background:${esc(r.bg)}">Aa</span>`
        : `<span aria-hidden="true" style="display:inline-block;width:28px;height:14px;vertical-align:middle;border-radius:var(--radius-sm);border:1px solid var(--color-border-default);background:${esc(r.bg)};box-shadow:inset 0 0 0 4px ${esc(r.bg)}, inset 0 0 0 9px ${esc(r.fg)}"></span>`;
    return `<td class="${ok ? "pass" : "fail"}">${sample} ${r.ratio.toFixed(2)}:1 ${ok ? "✓" : "✗"}</td>`;
  };
  const failing = results.filter((r) => r.missing || !r.light.pass || !r.dark.pass);
  const total = results.length;
  const rows = results
    .map((r) =>
      r.missing
        ? `<tr><td>${esc(r.label)}</td><td colspan="4" class="fail">Falta un token: ${esc(r.foreground)} o ${esc(r.background)}</td></tr>`
        : `<tr><td><code>${esc(r.label)}</code></td><td>${esc(r.use)}</td><td>${r.minimum}:1</td>${cell(r.light, r.minimum)}${cell(r.dark, r.minimum)}</tr>`,
    )
    .join("");
  return `<p class="hint">${total - failing.length} de ${total} combinaciones cumplen WCAG 2.1 AA con los valores actuales de los tokens. Las razones se calculan al generar el sitio.</p>
<div class="table-wrap"><table><thead><tr><th scope="col">Par (texto / fondo)</th><th scope="col">Uso</th><th scope="col">Mínimo</th><th scope="col">Claro</th><th scope="col">Oscuro</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function foundationBody(entry, { registry, tokens }) {
  const only = (layer, ...categories) => tokens.filter((t) => t.layer === layer && categories.includes(t.category));
  switch (entry.slug) {
    case "primitivas-color":
      return toolbar() + `<section class="category">${colorGroups(tokens, "primitive", "prim", 2)}</section>`;
    case "primitivas-tamano":
      return (
        toolbar() +
        `<section class="category">${group("Escala de tamaño", only("primitive", "size").sort(byValue), row(() => ""), "prim-size", 2)}${typography(only("primitive", "type"), 2)}</section>`
      );
    case "semantica-color":
      return toolbar() + `<section class="category">${colorGroups(tokens, "semantic", "sem", 2)}</section>`;
    case "semantica-espaciado-borde-y-radio":
      return toolbar() + `<section class="category">${dimension(only("semantic", "spacing", "border-width", "radius", "size"), 2)}</section>`;
    case "semantica-tipografia":
      return toolbar() + `<section class="category">${typography(only("semantic", "text", "font"), 2)}</section>`;
    case "elevacion-y-foco":
      return toolbar() + `<section class="category">${elevation(tokens, 2)}</section>`;
    case "contraste-wcag":
      return contrastTable(entry, tokens);
    case "arquitectura-y-nomenclatura": {
      const variables = tokens.filter((t) => t.layer === "semantic" && !["text", "elevation", "focus"].includes(t.category));
      const counts = `<div class="notice"><p><strong>Cifras de esta versión.</strong> ${registry.counts.primitive} primitivas, ${variables.length} variables semánticas (${registry.counts.withDarkVariant} con valor distinto en oscuro), ${tokens.filter((t) => t.category === "text").length} estilos de texto y ${tokens.filter((t) => t.category === "elevation" || t.category === "focus").length} de elevación y foco. Los números de la descripción de Figma corresponden al momento en que se escribió.</p></div>`;
      return renderBlocks(entry.blocks, { preview: () => "", pageHeading: entry.heading }) + counts;
    }
    default:
      return "";
  }
}

export function catalogBody({ tokens }) {
  return `${toolbar()}
<section class="category"><h2>Color</h2>${colorGroups(tokens, "semantic", "sem")}${colorGroups(tokens, "primitive", "prim")}</section>
<section class="category"><h2>Espaciado, borde y radio</h2>${dimension(tokens)}</section>
<section class="category"><h2>Tipografía</h2>${typography(tokens)}</section>
<section class="category"><h2>Elevación y foco</h2>${elevation(tokens)}</section>`;
}
