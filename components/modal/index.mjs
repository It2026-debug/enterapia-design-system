import { esc } from "../../scripts/lib/site/util.mjs";
import button from "../button/index.mjs";

export default {
  slug: "modal",
  differences: [
    "La página de documentación muestra el Modal dentro de un marco de 800 × 500; en uso real el fondo cubre toda la pantalla con la clase ds-modal--viewport.",
    "En la documentación el título no es un encabezado y no se declara aria-modal, para no alterar la estructura de la página; el marcado de la sección Código sí los incluye.",
  ],
  a11y: [
    "El diálogo lleva role=\"dialog\" y aria-modal=\"true\"; su nombre accesible es el título (aria-label o, en uso real, aria-labelledby apuntando al <h2>).",
    "Al abrirlo, mueve el foco al diálogo y atrápalo dentro; al cerrarlo, devuélvelo al elemento que lo abrió.",
    "Escape debe cerrarlo. Para uso real, añade la clase ds-modal--viewport al fondo.",
    "Destructive se usa solo cuando la acción confirma algo irreversible, y la etiqueta lo dice.",
  ],
  render({ Type, __preview }, texts = {}) {
    const destructive = Type === "Destructive";
    const cancel = button.render({ Style: "Secondary", Size: "MD", State: "Default" }, { Button: texts.Cancel ?? "Cancelar" });
    const confirm = button.render({ Style: destructive ? "Destructive" : "Primary", Size: "MD", State: "Default" }, { Button: texts.Confirm ?? (destructive ? "Eliminar" : "Guardar") });
    return `<div class="ds-modal ds-modal--contained"><div class="ds-modal__dialog" role="dialog"${__preview ? "" : ' aria-modal="true"'} aria-label="${esc(texts.Title ?? "Título del diálogo")}">${__preview ? `<p class="ds-modal__title">${esc(texts.Title ?? "Título del diálogo")}</p>` : `<h2 class="ds-modal__title">${esc(texts.Title ?? "Título del diálogo")}</h2>`}<p class="ds-modal__body">${esc(texts.Body ?? "Texto de apoyo que explica qué se va a decidir.")}</p><div class="ds-modal__actions">${cancel}${confirm}</div></div></div>`;
  },
};
