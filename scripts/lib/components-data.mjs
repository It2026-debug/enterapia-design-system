import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultsOf, variantCount } from "./site/components-pages.mjs";

function flattenDoc(doc) {
  if (!doc) return null;
  if (doc.format === "simple") {
    return { summary: doc.summary, sections: doc.sections, do: doc.do, dont: doc.dont };
  }
  const intro = doc.sections[0]?.blocks ?? [];
  const callout = intro.find((b) => b.type === "group" && b.name === "Cuándo usarlo");
  const usage = [];
  const collect = (b) => {
    if (b.type === "usage") usage.push(b);
    for (const item of b.items ?? []) collect(item);
  };
  doc.sections.forEach((s) => s.blocks.forEach(collect));
  return {
    summary: intro[2]?.text ?? "",
    sections: callout ? [{ title: callout.items[0].text, text: callout.items.slice(1).map((i) => i.text).join(" ") }] : [],
    do: usage.filter((u) => u.kind === "do").map((u) => u.text),
    dont: usage.filter((u) => u.kind === "dont").map((u) => u.text),
  };
}

export function componentsForRegistry({ content, defs, root }) {
  return content.components.map((meta) => {
    const def = defs.get(meta.slug);
    const cssPath = join(root, "components", meta.slug, `${meta.slug}.css`);
    const parts = meta.parts.map((part) => ({
      name: part.name,
      properties: Object.fromEntries(Object.entries(part.axes).map(([axis, values]) => [axis, { values, default: defaultsOf(part)[axis] }])),
      variantCount: part.variants.length,
      examples: def
        ? part.variants.map((v) => ({ name: v.name, props: v.props, html: def.render({ ...defaultsOf(part), ...v.props, __part: part.name }) }))
        : [],
    }));
    return {
      slug: meta.slug,
      number: meta.number,
      group: meta.group,
      category: meta.category,
      name: meta.name,
      title: meta.title ?? meta.name,
      implemented: Boolean(def),
      variantCount: variantCount(meta),
      parts,
      documentation: flattenDoc(content.docs[meta.slug]),
      accessibility: def?.a11y ?? [],
      css: def && existsSync(cssPath) ? readFileSync(cssPath, "utf8") : null,
      defaultExample: def ? def.render({ ...defaultsOf(meta.parts[0]), __part: meta.parts[0].name }) : null,
    };
  });
}
