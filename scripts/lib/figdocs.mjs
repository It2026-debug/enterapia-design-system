const gid = (guid) => (guid ? `${guid.sessionID}:${guid.localID}` : null);
const byPosition = (a, b) => ((a.parentIndex?.position ?? "") < (b.parentIndex?.position ?? "") ? -1 : 1);

export const slugify = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function parseVariantName(name) {
  if (!name.includes("=")) return {};
  return Object.fromEntries(
    name.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key.trim(), rest.join("=").trim()];
    }),
  );
}

function index(doc) {
  const nodes = doc.nodeChanges.filter((n) => n.phase !== "REMOVED" && !n.isSoftDeleted);
  const by = new Map(nodes.map((n) => [gid(n.guid), n]));
  const kids = new Map();
  for (const n of nodes) {
    const parent = gid(n.parentIndex?.guid);
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(n);
  }
  for (const list of kids.values()) list.sort(byPosition);
  const children = (n) => kids.get(gid(n.guid)) ?? [];
  const page = (name) => nodes.find((n) => n.type === "CANVAS" && n.name === name);
  return { nodes, by, children, page };
}

const text = (n) => (n.textData?.characters ?? "").replace(/\s+$/g, "").replace(/^\s+/g, "");

function componentRef(instance, { by, children }) {
  const master = by.get(gid(instance.symbolData?.symbolID));
  if (!master) return null;
  const parent = by.get(gid(master.parentIndex?.guid));
  const component = parent?.isStateGroup ? parent.name : master.name;
  const texts = {};
  const textNodes = [];
  const walk = (n) => {
    if (n.type === "TEXT") textNodes.push(n);
    for (const c of children(n)) walk(c);
  };
  walk(master);
  for (const assignment of instance.componentPropAssignments ?? []) {
    const characters = assignment.value?.textValue?.characters;
    if (characters === undefined) continue;
    const target = textNodes.find((t) => (t.componentPropRefs ?? []).some((ref) => gid(ref.defID) === gid(assignment.defID)));
    if (target) texts[target.name] = characters.replace(/\n/g, " ");
  }
  const flags = {};
  for (const assignment of instance.componentPropAssignments ?? []) {
    if (typeof assignment.value?.boolValue === "boolean") flags[gid(assignment.defID)] = assignment.value.boolValue;
  }
  return { component, props: parseVariantName(master.name), master: master.name, texts, flags };
}

export function extractDocs(doc) {
  const ctx = index(doc);
  const warnings = [];
  const { by, children, page } = ctx;

  const textBlock = (n) => {
    const value = text(n);
    if (!value) return null;
    const style = n.styleIdForText?.guid ? by.get(gid(n.styleIdForText.guid))?.name : null;
    return { type: "text", text: value, size: n.fontSize ?? null, bold: /bold|semibold|medium/i.test(n.fontName?.style ?? "") || undefined, style: style ?? undefined };
  };

  const textsIn = (n) => {
    const out = [];
    const walk = (x) => {
      if (x.visible === false) return;
      if (x.type === "TEXT") {
        const v = text(x);
        if (v) out.push(v);
      }
      for (const c of children(x)) walk(c);
    };
    walk(n);
    return out;
  };

  function blocksOf(n) {
    if (n.visible === false) return [];
    if (n.type === "TEXT") {
      const block = textBlock(n);
      return block ? [block] : [];
    }
    if (n.type === "INSTANCE") {
      const ref = componentRef(n, ctx);
      return ref ? [{ type: "preview", ...ref }] : [];
    }
    if (!["FRAME", "SECTION", "GROUP", "SYMBOL"].includes(n.type)) return [];

    if (/^Tabla/.test(n.name)) {
      const rows = children(n).map((row) => children(row).map((cell) => textsIn(cell).join(" ")));
      if (rows.length > 1) return [{ type: "table", header: rows[0], rows: rows.slice(1) }];
    }
    if (n.name === "Hacer" || n.name === "Evitar") {
      const items = children(n).flatMap(blocksOf);
      return [
        {
          type: "usage",
          kind: n.name === "Hacer" ? "do" : "dont",
          previews: items.flatMap((b) => (b.type === "group" ? b.items.filter((i) => i.type === "preview") : b.type === "preview" ? [b] : [])),
          text: items.filter((b) => b.type === "text" && !/^[✓✗]/.test(b.text)).map((b) => b.text).join(" "),
        },
      ];
    }
    if (n.name === "Par") {
      return [{ type: "pair", items: children(n).flatMap(blocksOf) }];
    }

    const items = children(n).flatMap(blocksOf);
    if (items.length === 0) return [];
    if (items.length === 1) return items;
    return [{ type: "group", name: n.name, direction: n.stackMode === "HORIZONTAL" ? "row" : "column", items }];
  }

  const sectionOf = (frame) => {
    const header = children(frame).find((c) => c.name === "Encabezado de bloque" || c.name === "Encabezado");
    const headerTexts = header ? textsIn(header) : [];
    const rest = children(frame).filter((c) => c !== header).flatMap(blocksOf);
    const heading = headerTexts[0] ?? frame.name;
    const match = /^(\d+)\s*[·.]?\s*(.*)$/.exec(heading);
    return {
      id: slugify(frame.name),
      number: match ? match[1] : null,
      title: match ? match[2] : heading,
      intro: headerTexts.slice(1),
      blocks: rest,
    };
  };

  const bullets = (frame) =>
    children(frame)
      .filter((c) => c.type === "TEXT")
      .map(text)
      .filter((t) => t.startsWith("•"))
      .map((t) => t.replace(/^•\s*/, ""));

  const documentOf = (frame) => {
    const top = children(frame);
    const structured = top.length > 0 && top.every((c) => /^\d{2}\s/.test(c.name));
    if (structured) {
      return { source: frame.name, format: "structured", sections: top.map(sectionOf) };
    }
    const texts = top.filter((c) => c.type === "TEXT").map(text);
    const usage = (name) => top.find((c) => c.type === "FRAME" && c.name.includes(name));
    if (texts.length !== 6 || !usage("Hacer") || !usage("Evitar")) {
      warnings.push(`"${frame.name}" does not match the known documentation layouts (${texts.length} text blocks, expected 6, plus Hacer and Evitar frames). Its text may be misplaced.`);
    }
    return {
      source: frame.name,
      format: "simple",
      title: texts[0] ?? frame.name,
      summary: texts[1] ?? "",
      sections: [
        { title: texts[2], text: texts[3] },
        { title: texts[4], text: texts[5] },
      ].filter((section) => section.title && section.text),
      do: usage("Hacer") ? bullets(usage("Hacer")) : [],
      dont: usage("Evitar") ? bullets(usage("Evitar")) : [],
    };
  };

  // Foundations
  const foundationsPage = page("Foundations");
  const foundations = children(foundationsPage)
    .filter((n) => n.type === "SECTION")
    .map((section) => {
      const frame = children(section)[0];
      const texts = textsIn(frame);
      const figmaName = section.name;
      const match = /^(\d+)\.\s*(.*)$/.exec(figmaName);
      return {
        number: match ? Number(match[1]) : null,
        title: match ? match[2] : figmaName,
        slug: slugify(match ? match[2] : figmaName),
        figmaName,
        heading: texts[0] ?? figmaName,
        intro: texts[1] ?? "",
        blocks: /Arquitectura|Contraste/.test(figmaName) ? blocksOf(frame) : [],
      };
    });

  // Components page: sections "1.1 Acción — Button"
  const componentsPage = page("Components");
  const sectionNodes = children(componentsPage).filter((n) => n.type === "SECTION");
  const components = [];
  for (const section of sectionNodes) {
    const match = /^(\d+)\.(\d+)\s+(.+?)\s+—\s+(.+)$/.exec(section.name);
    if (!match) continue;
    const [, major, minor, category, name] = match;
    const sets = [];
    const symbols = [];
    const walk = (n) => {
      if (n.isStateGroup) sets.push(n);
      if (n.type === "SYMBOL") symbols.push(n);
      for (const c of children(n)) walk(c);
    };
    walk(section);
    const parts = [];
    for (const symbol of symbols) {
      const parent = by.get(gid(symbol.parentIndex?.guid));
      const partName = parent?.isStateGroup ? parent.name : symbol.name;
      let part = parts.find((p) => p.name === partName);
      if (!part) {
        part = { name: partName, axes: {}, variants: [] };
        parts.push(part);
      }
      const props = parseVariantName(symbol.name);
      part.variants.push({ name: symbol.name, size: symbol.size ? [Math.round(symbol.size.x * 100) / 100, Math.round(symbol.size.y * 100) / 100] : null, props });
      for (const [key, value] of Object.entries(props)) {
        const values = (part.axes[key] ??= []);
        if (!values.includes(value)) values.push(value);
      }
    }
    components.push({
      number: `${major}.${minor}`,
      group: Number(major),
      category,
      name,
      slug: slugify(name),
      figmaSection: section.name,
      sets: sets.map((s) => s.name),
      parts,
    });
  }
  components.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

  // Documentation pages preserved in "99 Archivo"
  const archive = page("99 Archivo");
  const docFrames = archive ? children(archive) : [];
  const docs = {};
  for (const component of components) {
    const candidates = docFrames
      .filter((f) => new RegExp(`^${component.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+—\\s+Document`).test(f.name))
      .sort((a, b) => Number(/Documentación/.test(b.name)) - Number(/Documentación/.test(a.name)));
    const frame = candidates[0];
    if (!frame) continue;
    docs[component.slug] = documentOf(frame);
  }

  const allTexts = (n) => {
    const out = [];
    const walk = (x) => {
      if (x.visible === false) return;
      if (x.type === "TEXT" && text(x)) out.push(text(x));
      for (const c of children(x)) walk(c);
    };
    walk(n);
    return out;
  };

  // Component index: "1.1 · Acción", "Botón (Button)", "Documentado", ...
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const indexSection = sectionNodes.find((n) => n.name.startsWith("0."));
  const indexTexts = indexSection ? allTexts(indexSection) : [];
  const indexNote = indexTexts.find((t) => /documentad/i.test(t) && /pendiente/i.test(t)) ?? "";
  for (let i = 0; i < indexTexts.length - 1; i++) {
    if (!/^\d+\.\d+\s·\s/.test(indexTexts[i])) continue;
    const title = indexTexts[i + 1];
    const inner = /\(([^)]+)\)\s*$/.exec(title)?.[1];
    const component = components.find((c) => normalize(c.name) === normalize(inner ?? title));
    if (component && !component.title) component.title = title;
  }

  const coverTexts = page("Cover") ? allTexts(page("Cover")) : [];
  const cover = {
    title: coverTexts[0] ?? "",
    description: coverTexts[1] ?? "",
    question: coverTexts[2] ?? "",
    items: [],
  };
  for (let i = 3; i + 1 < coverTexts.length; i += 2) cover.items.push({ title: coverTexts[i], text: coverTexts[i + 1] });

  return { foundations, components, docs, cover, indexNote, warnings };
}
