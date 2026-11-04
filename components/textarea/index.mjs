import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "textarea",
  a11y: [
    "Envuelve la etiqueta y el campo en un <label>: la etiqueta queda asociada sin necesitar ids.",
    "En Error usa aria-invalid=\"true\"; el mensaje va dentro del mismo <label>, así se anuncia junto con el campo.",
    "Disabled usa el atributo disabled: no recibe foco ni se envía con el formulario.",
  ],
  render({ State }, texts = {}) {
    const classes = ["ds-textarea", State === "Error" ? "ds-textarea--error" : "", State === "Disabled" ? "ds-textarea--disabled" : ""].filter(Boolean).join(" ");
    const attrs = [];
    if (State === "Focus") attrs.push('data-state="focus"');
    if (State === "Error") attrs.push('aria-invalid="true"');
    if (State === "Disabled") attrs.push("disabled");
    const message = State === "Error" ? `<span class="ds-textarea__message">${esc(texts["Error message"] ?? "Explica qué pasó y cómo resolverlo")}</span>` : "";
    return `<label class="${classes}"><span class="ds-textarea__label">${esc(texts.Label ?? "Etiqueta")}</span><textarea class="ds-textarea__field" placeholder="${esc(texts["Placeholder text"] ?? "Texto de ejemplo")}"${attrs.length ? " " + attrs.join(" ") : ""}></textarea>${message}</label>`;
  },
};
