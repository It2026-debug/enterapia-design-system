import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const icons = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "content", "icons.json"), "utf8"));
const slug = (name) => name.toLowerCase().replace(/\s+/g, "-");

/** Inline SVG for an icon. Color follows currentColor; the default is color/icon/primary. */
export function icon(name, size = "MD", { extraClass = "" } = {}) {
  const shape = icons[name]?.[size];
  if (!shape) throw new Error(`Unknown icon "${name}" at size ${size}.`);
  return `<svg class="ds-icon ds-icon--${size.toLowerCase()} ds-icon--${slug(name)}${extraClass ? " " + extraClass : ""}" width="${shape.size}" height="${shape.size}" viewBox="0 0 ${shape.size} ${shape.size}" aria-hidden="true" focusable="false"><path transform="translate(${shape.offset[0]} ${shape.offset[1]})" d="${shape.d}" fill="none" stroke="currentColor" stroke-width="${shape.strokeWidth}" stroke-linecap="${shape.cap}" stroke-linejoin="${shape.join}"/></svg>`;
}

export default {
  slug: "icon",
  a11y: [
    "Los íconos son decorativos por defecto: aria-hidden=\"true\" y focusable=\"false\".",
    "Si un ícono es el único contenido de un control, el control necesita un nombre accesible (aria-label o texto oculto).",
    "El color sigue currentColor; el valor por defecto es el token color/icon/primary.",
  ],
  render({ Name, Size }) {
    return icon(Name, Size);
  },
};
