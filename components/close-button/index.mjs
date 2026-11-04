import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

export default {
  slug: "close-button",
  a11y: [
    "Es un <button>: necesita un nombre accesible, por eso lleva aria-label (por defecto \"Cerrar\").",
    "Disabled usa el atributo disabled: no recibe foco ni responde.",
    "El foco visible usa el borde color/border/focus y el anillo focus/ring.",
  ],
  render({ State }, texts = {}) {
    const attrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"', Disabled: " disabled" }[State] ?? "";
    return `<button type="button" class="ds-close-button" aria-label="${esc(texts["aria-label"] ?? "Cerrar")}"${attrs}>${icon("Close", "SM")}</button>`;
  },
};
