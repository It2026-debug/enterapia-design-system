import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "radio",
  a11y: [
    "Usa <input type=\"radio\"> reales dentro de un <label>. Los de un mismo grupo comparten el atributo name y se mueven con las flechas.",
    "Agrupa las opciones en un <fieldset> con <legend> que explique la pregunta.",
    "En Error añade aria-invalid=\"true\" y deja el mensaje dentro del <label> para que se anuncie.",
    "Disabled usa el atributo disabled: no recibe foco ni se envía con el formulario.",
  ],
  render({ Checked, State }, texts = {}) {
    const classes = ["ds-radio", State === "Error" ? "ds-radio--error" : "", State === "Disabled" ? "ds-radio--disabled" : ""].filter(Boolean).join(" ");
    const rootAttrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"' }[State] ?? "";
    const inputAttrs = [];
    if (Checked === "Checked") inputAttrs.push("checked");
    if (State === "Disabled") inputAttrs.push("disabled");
    if (State === "Error") inputAttrs.push('aria-invalid="true"');
    const message = State === "Error" ? `<span class="ds-radio__message">${esc(texts["Error message"] ?? "Elige una opción para continuar")}</span>` : "";
    return `<label class="${classes}"${rootAttrs}><span class="ds-radio__row"><input class="ds-radio__input" type="radio" name="opcion"${inputAttrs.length ? " " + inputAttrs.join(" ") : ""}><span class="ds-radio__ring" aria-hidden="true"></span><span class="ds-radio__label">${esc(texts.Label ?? "Etiqueta")}</span></span>${message}</label>`;
  },
};
