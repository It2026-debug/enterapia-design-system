import { esc } from "../../scripts/lib/site/util.mjs";
import badge from "../badge/index.mjs";
import button from "../button/index.mjs";
import { icon } from "../icon/index.mjs";

const checkbox = (checked) =>
  `<label class="ds-checkbox"><span class="ds-checkbox__row"><input class="ds-checkbox__input" type="checkbox" aria-label="Seleccionar fila"${checked ? " checked" : ""}><span class="ds-checkbox__box" aria-hidden="true">${icon("Check", "SM")}${icon("Minus", "SM")}</span></span></label>`;

const actionButton = () => `<button type="button" class="ds-icon-button" aria-label="Más opciones">${icon("More", "SM")}</button>`;

function row({ Estado, Casilla }, texts) {
  const hasCheck = Casilla === "Sí";
  const attrs = { Hover: ' data-state="hover"', Seleccionada: ' aria-selected="true"' }[Estado] ?? "";
  const status = badge.render({ Variant: "Success" }, { Label: texts.Estado ?? "Activo" });
  return `<div class="ds-table-row${hasCheck ? "" : " ds-table-row--no-check"}" role="row"${attrs}>${
    hasCheck ? `<span class="ds-table-row__check" role="cell">${checkbox(Estado === "Seleccionada")}</span>` : ""
  }<div class="ds-table-cell ds-table-cell--name" role="cell">${esc(texts.Nombre ?? "María Fernández")}</div><div class="ds-table-cell ds-table-cell--price" role="cell">${esc(texts.Precio ?? "$80.000")}</div><div class="ds-table-cell ds-table-cell--status" role="cell">${status}</div><div class="ds-table-cell ds-table-cell--actions" role="cell">${actionButton()}</div></div>`;
}

function header({ Orden, Alineación }, texts) {
  const sort = { Ascendente: "ascending", Descendente: "descending" }[Orden];
  const glyph = { Ascendente: "Chevron Up", Descendente: "Chevron Down" }[Orden];
  return `<div class="ds-table-header${Alineación === "Derecha" ? " ds-table-header--right" : ""}" role="columnheader"${sort ? ` aria-sort="${sort}"` : ""}><span>${esc(texts.Columna ?? "Columna")}</span>${glyph ? icon(glyph, "SM") : ""}</div>`;
}

function cell({ Tipo }, texts) {
  switch (Tipo) {
    case "Número":
      return `<div class="ds-table-cell ds-table-cell--number" role="cell">${esc(texts["8"] ?? "8")}</div>`;
    case "Badge":
      return `<div class="ds-table-cell ds-table-cell--badge" role="cell">${badge.render({ Variant: "Success" }, { Label: "Activo" })}</div>`;
    case "Acciones":
      return `<div class="ds-table-cell ds-table-cell--actions" role="cell">${actionButton()}</div>`;
    default:
      return `<div class="ds-table-cell ds-table-cell--text" role="cell">${esc(texts["Contenido de ejemplo"] ?? "Contenido de ejemplo")}</div>`;
  }
}

export default {
  slug: "tabla",
  a11y: [
    "El diseño usa flex con roles ARIA (table, row, columnheader, cell). Con datos reales puedes usar una <table> nativa y aplicar estas clases a <tr>, <th> y <td> si tu maquetación lo permite.",
    "El encabezado ordenado usa aria-sort=\"ascending\" o \"descending\"; el ícono refuerza el estado, no es la única señal.",
    "La casilla de cada fila necesita un nombre accesible (aria-label o el nombre de la fila).",
    "En Figma este componente usa la fuente Inter con tamaños sueltos; en código usa los estilos de texto del sistema (Roboto).",
  ],
  render(props, texts = {}) {
    switch (props.__part) {
      case "Table Row":
        return row(props, texts);
      case "Table Column Header":
        return header(props, texts);
      case "Table Cell":
        return cell(props, texts);
      case "Table Empty State":
        return `<div class="ds-table-empty">${icon("Circle Info", "MD")}<p>${esc(texts["No hay pacientes para mostrar"] ?? "No hay pacientes para mostrar")}</p></div>`;
      case "Table Pagination": {
        const prev = button.render({ Style: "Ghost", Size: "SM", State: "Default" }, { Button: "Anterior" });
        const next = button.render({ Style: "Ghost", Size: "SM", State: "Default" }, { Button: "Siguiente" });
        return `<nav class="ds-table-pagination" aria-label="Paginación"><p>${esc(texts["Mostrando 1–10 de 34 pacientes"] ?? "Mostrando 1–10 de 34 pacientes")}</p><div class="ds-table-pagination__buttons">${prev}${next}</div></nav>`;
      }
      default:
        throw new Error(`Tabla: parte desconocida "${props.__part}".`);
    }
  },
};
