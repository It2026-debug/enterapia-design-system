import { option } from "../select-option/index.mjs";

export function menu(labels = ["Opción 1", "Opción 2", "Opción 3", "Opción 4"], { selected = null } = {}) {
  const rows = labels.map((label) => option({ State: label === selected ? "Selected" : "Default" }, label)).join("");
  return `<div class="ds-select-menu" role="listbox" aria-label="Opciones"><div class="ds-select-menu__options">${rows}</div></div>`;
}

export default {
  slug: "select-menu",
  a11y: [
    "El menú es role=\"listbox\" y cada fila role=\"option\".",
    "Con un <select> nativo, el navegador dibuja su propia lista. Este menú es para una implementación personalizada, que debe manejar flechas, Enter, Escape y el foco.",
  ],
  render(_props, texts = {}) {
    const labels = [1, 2, 3, 4].map((n) => texts[`Opción ${n}`] ?? `Opción ${n}`);
    return menu(labels);
  },
};
