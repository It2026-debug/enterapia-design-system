import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "switch",
  a11y: [
    "Es un <input type=\"checkbox\" role=\"switch\">: se activa con Espacio y los lectores de pantalla lo anuncian como interruptor.",
    "El estado se comunica con la posición del pulgar y con el color; la etiqueta debe describir el ajuste, no la acción (\"Notificaciones\", no \"Activar\").",
    "Disabled usa el atributo disabled: no recibe foco ni responde.",
  ],
  render({ Checked, State }, texts = {}) {
    const classes = ["ds-switch", State === "Disabled" ? "ds-switch--disabled" : ""].filter(Boolean).join(" ");
    const rootAttrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"' }[State] ?? "";
    const inputAttrs = [];
    if (Checked === "On") inputAttrs.push("checked");
    if (State === "Disabled") inputAttrs.push("disabled");
    return `<label class="${classes}"${rootAttrs}><input class="ds-switch__input" type="checkbox" role="switch"${inputAttrs.length ? " " + inputAttrs.join(" ") : ""}><span class="ds-switch__track" aria-hidden="true"><span class="ds-switch__thumb"></span></span><span class="ds-switch__label">${esc(texts.Label ?? "Etiqueta")}</span></label>`;
  },
};
