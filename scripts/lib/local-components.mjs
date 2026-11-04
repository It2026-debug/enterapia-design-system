import { slugify } from "./figdocs.mjs";

const cartesian = (axes) =>
  Object.entries(axes).reduce((all, [name, values]) => all.flatMap((combo) => values.map((value) => ({ ...combo, [name]: value }))), [{}]);

const variantName = (props) => Object.entries(props).map(([k, v]) => `${k}=${v}`).join(", ");

/**
 * Components that exist only in code (not in Figma) are listed in content/components.local.json.
 * Each part may give its `axes`; the variants are then every combination of them.
 */
export function normalizeLocalComponent(entry) {
  for (const key of ["number", "group", "category", "name"]) {
    if (entry[key] === undefined) throw new Error(`content/components.local.json: a component is missing "${key}".`);
  }
  const parts = (entry.parts ?? [{ name: entry.name, axes: {} }]).map((part) => {
    const axes = part.axes ?? {};
    const variants =
      part.variants ??
      cartesian(axes).map((props) => ({ name: Object.keys(axes).length ? variantName(props) : part.name, size: null, props }));
    return { name: part.name, axes, variants };
  });
  return { ...entry, slug: entry.slug ?? slugify(entry.name), sets: [], figmaSection: null, source: "code", parts };
}

export const byNumber = (a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
