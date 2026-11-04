import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

export function option({ State = "Default" }, label = "Opción") {
  const attrs = { Hover: ' data-state="hover"', Selected: ' aria-selected="true"', Disabled: ' aria-disabled="true"' }[State] ?? "";
  const check = State === "Selected" ? icon("Check", "SM") : "";
  return `<div class="ds-select-option" role="option"${attrs}><span class="ds-select-option__label">${esc(label)}</span>${check}</div>`;
}

export default {
  slug: "select-option",
  a11y: [
    "Cada opción lleva role=\"option\" dentro de un contenedor role=\"listbox\" (ver Select Menu).",
    "La opción elegida usa aria-selected=\"true\" y muestra un ícono de check, no solo color.",
    "Una opción deshabilitada usa aria-disabled=\"true\".",
  ],
  wrapPreview: (_part, html) => `<div class="ds-preview-wrap" role="listbox" aria-label="Opciones">${html}</div>`,
  render({ State }, texts = {}) {
    return option({ State }, texts.Label ?? "Opción");
  },
};
