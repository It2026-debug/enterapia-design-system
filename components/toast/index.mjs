import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";

const GLYPH = { Success: "Circle Check", Error: "Circle Close", Warning: "Circle Alert", Info: "Circle Info" };

export default {
  slug: "toast",
  a11y: [
    "Un Toast aparece sin que la persona lo pida: usa role=\"status\" (o role=\"alert\" si es urgente) para que se anuncie.",
    "No lo hagas desaparecer solo demasiado rápido: da tiempo suficiente para leerlo, o mantenlo hasta que se cierre.",
    "El tipo no se comunica solo con color: el ícono y el mensaje explican el estado.",
  ],
  render({ Type }, texts = {}) {
    return `<div class="ds-toast ds-toast--${Type.toLowerCase()}"><span class="ds-toast__icon">${icon(GLYPH[Type], "SM")}</span><p class="ds-toast__message">${esc(texts.Message ?? "Mensaje breve de una sola línea.")}</p><button type="button" class="ds-close-button ds-toast__close" aria-label="Cerrar">${icon("Close", "SM")}</button></div>`;
  },
};
