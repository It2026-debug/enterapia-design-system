import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

export default {
  slug: "icon-button",
  a11y: [
    "Es un <button> sin texto visible: necesita aria-label que describa la acción (por defecto \"Más opciones\").",
    "Disabled usa el atributo disabled: no recibe foco ni responde.",
    "El foco visible usa el borde color/border/focus y el anillo focus/ring.",
  ],
  render({ State }, texts = {}) {
    const attrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"', Disabled: " disabled" }[State] ?? "";
    return `<button type="button" class="ds-icon-button" aria-label="${esc(texts["aria-label"] ?? "Más opciones")}"${attrs}>${icon("More", "SM")}</button>`;
  },
};
