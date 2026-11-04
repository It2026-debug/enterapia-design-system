import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "input",
  a11y: [
    "Envuelve la etiqueta y el campo en un <label>: la etiqueta queda asociada sin necesitar ids. Si el campo no es obvio por contexto, muestra siempre una etiqueta.",
    "En Error usa aria-invalid=\"true\"; el mensaje va dentro del mismo <label>, así se anuncia junto con el campo.",
    "Disabled usa el atributo disabled: no recibe foco ni se envía con el formulario.",
    "El placeholder no reemplaza a la etiqueta: desaparece al escribir.",
  ],
  render({ State, Label }, texts = {}) {
    const classes = ["ds-input", State === "Error" ? "ds-input--error" : "", State === "Disabled" ? "ds-input--disabled" : ""].filter(Boolean).join(" ");
    const attrs = [];
    if (State === "Focus") attrs.push('data-state="focus"');
    if (State === "Error") attrs.push('aria-invalid="true"');
    if (State === "Disabled") attrs.push("disabled");
    const label = Label === "With Label" ? `<span class="ds-input__label">${esc(texts["Etiqueta"] ?? "Etiqueta")}</span>` : "";
    const message = State === "Error" ? `<span class="ds-input__message">${esc(texts["Explica qué pasó y cómo resolverlo"] ?? "Explica qué pasó y cómo resolverlo")}</span>` : "";
    return `<label class="${classes}">${label}<input class="ds-input__field" type="text" placeholder="${esc(texts["Texto de ejemplo"] ?? "Texto de ejemplo")}"${attrs.length ? " " + attrs.join(" ") : ""}>${message}</label>`;
  },
};
