import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

export default {
  slug: "checkbox",
  a11y: [
    "Usa un <input type=\"checkbox\"> real dentro de un <label>: teclado (Espacio), lectores de pantalla y formularios funcionan sin código.",
    "Indeterminate no se puede declarar en HTML: se activa por JavaScript con input.indeterminate = true.",
    "En Error añade aria-invalid=\"true\" y deja el mensaje dentro del <label> para que se anuncie.",
    "Disabled usa el atributo disabled: no recibe foco ni se envía con el formulario.",
  ],
  render({ Checked, State }, texts = {}) {
    const classes = ["ds-checkbox", State === "Error" ? "ds-checkbox--error" : "", State === "Disabled" ? "ds-checkbox--disabled" : ""].filter(Boolean).join(" ");
    const rootAttrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"' }[State] ?? "";
    const inputAttrs = [];
    if (Checked === "Checked") inputAttrs.push("checked");
    if (Checked === "Indeterminate") inputAttrs.push("data-indeterminate");
    if (State === "Disabled") inputAttrs.push("disabled");
    if (State === "Error") inputAttrs.push('aria-invalid="true"');
    const message = State === "Error" ? `<span class="ds-checkbox__message">${esc(texts["Error message"] ?? "Debes aceptar para continuar")}</span>` : "";
    const check = icon("Check", "SM");
    const minus = icon("Minus", "SM");
    return `<label class="${classes}"${rootAttrs}><span class="ds-checkbox__row"><input class="ds-checkbox__input" type="checkbox"${inputAttrs.length ? " " + inputAttrs.join(" ") : ""}><span class="ds-checkbox__box" aria-hidden="true">${check}${minus}</span><span class="ds-checkbox__label">${esc(texts.Label ?? "Etiqueta")}</span></span>${message}</label>`;
  },
};
