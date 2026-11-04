import { esc } from "../../scripts/lib/site/util.mjs";
import { icon } from "../icon/index.mjs";
import { menu } from "../select-menu/index.mjs";

export default {
  slug: "select",
  a11y: [
    "El campo es un <select> nativo dentro de un <label>: teclado, lectores de pantalla y móvil funcionan sin código extra.",
    "En Error usa aria-invalid=\"true\"; el mensaje va dentro del mismo <label>.",
    "Open muestra el menú visual de Select Menu. Con <select> nativo el navegador dibuja su lista; el menú visual es para implementaciones personalizadas.",
    "El texto de Placeholder es una opción vacía y deshabilitada: no reemplaza a la etiqueta.",
  ],
  render({ State, Value }, texts = {}) {
    const selected = Value === "Selected";
    const classes = ["ds-select", State === "Error" ? "ds-select--error" : "", State === "Disabled" ? "ds-select--disabled" : ""].filter(Boolean).join(" ");
    const attrs = [];
    if (State === "Focus") attrs.push('data-state="focus"');
    if (State === "Open") attrs.push('data-state="open"', 'aria-expanded="true"');
    if (State === "Error") attrs.push('aria-invalid="true"');
    if (State === "Disabled") attrs.push("disabled");
    const value = texts["Value text"] ?? "Opción 2";
    const placeholder = texts["Placeholder text"] ?? "Selecciona una opción";
    const options = selected
      ? `<option>Opción 1</option><option selected>${esc(value)}</option><option>Opción 3</option><option>Opción 4</option>`
      : `<option value="" selected disabled hidden>${esc(placeholder)}</option><option>Opción 1</option><option>Opción 2</option><option>Opción 3</option><option>Opción 4</option>`;
    const message = State === "Error" ? `<span class="ds-select__message">${esc(texts["Error message"] ?? "Selecciona una opción antes de continuar")}</span>` : "";
    const open = State === "Open";
    const group = `<label class="ds-select__group"><span class="ds-select__label">${esc(texts.Label ?? "Etiqueta")}</span><span class="ds-select__control"><select class="ds-select__field${selected ? "" : " ds-select__field--placeholder"}"${attrs.length ? " " + attrs.join(" ") : ""}>${options}</select><span class="ds-select__chevron">${icon(open ? "Chevron Up" : "Chevron Down", "SM")}</span></span>${message}</label>`;
    return `<div class="${classes}">${group}${open ? menu(["Opción 1", "Opción 2", "Opción 3", "Opción 4"]) : ""}</div>`;
  },
};
