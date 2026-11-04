import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "tooltip",
  a11y: [
    "Conecta el Tooltip con su elemento mediante aria-describedby; el Tooltip lleva role=\"tooltip\".",
    "Debe mostrarse también con el foco de teclado, no solo con hover, y poder cerrarse con Escape.",
    "No pongas información imprescindible solo en un Tooltip: en móvil no hay hover.",
  ],
  render(_props, texts = {}) {
    return `<span class="ds-tooltip" role="tooltip"><span class="ds-tooltip__bubble">${esc(texts.Text ?? "Texto de ayuda")}</span><span class="ds-tooltip__pointer" aria-hidden="true"></span></span>`;
  },
};
