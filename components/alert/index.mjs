import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

const GLYPH = { Success: "Circle Check", Error: "Circle Close", Warning: "Circle Alert", Info: "Circle Info" };

export default {
  slug: "alert",
  a11y: [
    "Si el mensaje aparece de forma dinámica, añade role=\"alert\" (urgente) o role=\"status\" (informativo) para que lo anuncien los lectores de pantalla.",
    "El tipo no se comunica solo con color: el título y el ícono explican el estado.",
    "El botón de cierre es un <button> con aria-label.",
  ],
  render({ Type }, texts = {}) {
    return `<div class="ds-alert ds-alert--${Type.toLowerCase()}"><span class="ds-alert__icon">${icon(GLYPH[Type], "SM")}</span><div class="ds-alert__content"><p class="ds-alert__title">${esc(texts.Title ?? "Título de la alerta")}</p><p class="ds-alert__description">${esc(texts.Description ?? "Descripción con los detalles que la persona necesita para decidir qué hacer.")}</p></div><button type="button" class="ds-close-button ds-alert__close" aria-label="Cerrar">${icon("Close", "SM")}</button></div>`;
  },
};
