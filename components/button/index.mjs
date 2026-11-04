import { esc } from "../../scripts/lib/site/util.mjs";

export default {
  slug: "button",
  differences: [
    "Figma no define un estado Focus para Button; el código añade un anillo de foco con :focus-visible y el token focus/ring.",
    "La sección \"Foco visible\" de la documentación de abajo describe el diseño de Figma, que no incluye ese indicador.",
  ],
  a11y: [
    "Es un elemento <button>: recibe foco con Tab y se activa con Enter o Espacio.",
    "Disabled usa el atributo disabled: no recibe foco ni responde.",
    "Loading usa aria-busy=\"true\"; comunica la acción en curso a lectores de pantalla y no debe volver a enviarse.",
    "Figma no define un estado Focus; el código añade un anillo con el token focus/ring con :focus-visible.",
  ],
  render({ Style, Size, State }, texts = {}) {
    const classes = ["ds-button", `ds-button--${Style.toLowerCase()}`, `ds-button--${Size.toLowerCase()}`].join(" ");
    const attrs = [];
    if (State === "Hover") attrs.push('data-state="hover"');
    if (State === "Active") attrs.push('data-state="active"');
    if (State === "Disabled") attrs.push("disabled");
    if (State === "Loading") attrs.push('aria-busy="true"');
    const spinner = State === "Loading" ? '<span class="ds-button__spinner" aria-hidden="true"></span>' : "";
    return `<button type="button" class="${classes}"${attrs.length ? " " + attrs.join(" ") : ""}>${spinner}<span class="ds-button__label">${esc(texts.Button ?? "Button")}</span></button>`;
  },
};
