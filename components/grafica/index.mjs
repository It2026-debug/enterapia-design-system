import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "../../scripts/lib/site/util.mjs";

const charts = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "charts.json"), "utf8"));
const cssVar = (token) => `var(--${token.replace(/\./g, "-")})`;
const fill = (token) => `background:${cssVar(token)}`;
const point = (cx, cy, radius, angle) => `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`;

function arcPath({ size, offset, start, end, inner }) {
  const outer = size / 2;
  const hole = outer * inner;
  const cx = offset[0] + outer;
  const cy = offset[1] + outer;
  const large = end - start > Math.PI ? 1 : 0;
  return `M${point(cx, cy, outer, start)}A${outer} ${outer} 0 ${large} 1 ${point(cx, cy, outer, end)}L${point(cx, cy, hole, end)}A${hole} ${hole} 0 ${large} 0 ${point(cx, cy, hole, start)}Z`;
}

function plot(type, chart) {
  if (type === "Barras") {
    return `<div class="ds-chart__area ds-chart__area--bars" role="img" aria-label="${esc(chart.title)}">${chart.bars
      .map((bar) => `<span class="ds-chart__bar" style="width:${bar.width}px;height:${bar.height}px;${fill(bar.color)}"></span>`)
      .join("")}</div>`;
  }
  const [w, h] = chart.area;
  if (type === "Líneas") {
    const lines = chart.lines
      .map((line) => `<path transform="translate(${line.offset[0]} ${line.offset[1]})" d="${line.d}" fill="none" style="stroke:${cssVar(line.color)}" stroke-width="${line.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join("");
    return `<div class="ds-chart__area" role="img" aria-label="${esc(chart.title)}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMin meet" aria-hidden="true" focusable="false">${lines}</svg></div>`;
  }
  const arcs = chart.arcs.map((arc) => `<path d="${arcPath(arc)}" style="fill:${cssVar(arc.color)}"/>`).join("");
  return `<div class="ds-chart__area" role="img" aria-label="${esc(chart.title)}"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${arcs}</svg></div>`;
}

export default {
  slug: "grafica",
  a11y: [
    "La gráfica es una imagen para lectores de pantalla (role=\"img\" con aria-label): ofrece los mismos datos en una tabla o en texto cercano.",
    "La leyenda no depende solo del color: cada serie tiene su nombre.",
    "Los colores de las series son tokens color/chart/*, con valores distintos para claro y oscuro.",
    "Estas variantes son ilustraciones con datos de ejemplo. En Figma usan la fuente Inter; en código usan los estilos de texto del sistema (Roboto).",
  ],
  render({ Tipo }, texts = {}) {
    const chart = charts[Tipo];
    if (!chart) throw new Error(`Gráfica: tipo desconocido "${Tipo}".`);
    const legend = chart.legend.map((item) => `<li><span class="ds-chart__dot" style="${fill(item.color)}"></span>${esc(item.label)}</li>`).join("");
    return `<figure class="ds-chart" style="margin:0"><figcaption class="ds-chart__title">${esc(texts.title ?? chart.title)}</figcaption>${plot(Tipo, chart)}<ul class="ds-chart__legend">${legend}</ul></figure>`;
  },
};
