import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "badge",
  a11y: [
    "El color nunca es la única señal: la etiqueta de texto debe decir el estado.",
    "Es un elemento estático (<span>), no recibe foco; el punto es decorativo (aria-hidden).",
    "Todas las combinaciones de texto y fondo cumplen contraste WCAG 2.1 AA en claro y oscuro.",
  ],
  render({ Variant }, texts = {}) {
    return `<span class="ds-badge ds-badge--${Variant.toLowerCase()}"><span class="ds-badge__dot" aria-hidden="true"></span><span class="ds-badge__label">${esc(texts.Label ?? "Etiqueta")}</span></span>`;
  },
};
