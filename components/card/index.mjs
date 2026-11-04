import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "card",
  a11y: [
    "La tarjeta es un contenedor estático. Si toda la tarjeta es interactiva, haz que el título sea un enlace o un botón, o usa un <a> como contenedor.",
    "Una tarjeta interactiva debe poder recibir foco con teclado; su anillo de foco usa el token focus/ring.",
    "El título usa <h3>: ajusta el nivel de encabezado al contexto de la página.",
  ],
  render({ State, Shadow }, texts = {}) {
    const classes = ["ds-card", Shadow === "With Shadow" ? "ds-card--shadow" : ""].filter(Boolean).join(" ");
    const attrs = { Hover: ' data-state="hover"', Focus: ' data-state="focus"' }[State] ?? "";
    return `<article class="${classes}"${attrs}><h3 class="ds-card__title">${esc(texts.Title ?? "Card title")}</h3><p class="ds-card__description">${esc(texts.Description ?? "Supporting card description text goes here, wrapping to a second line if needed.")}</p></article>`;
  },
};
