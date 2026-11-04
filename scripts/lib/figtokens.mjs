const PRIMITIVE_COLLECTION = "Primitives";
const SEMANTIC_COLLECTION = "Semantic";
const MODE_KEYS = { Light: "light", Dark: "dark" };

const gid = (guid) => `${guid.sessionID}:${guid.localID}`;
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function dotted(figmaName) {
  return figmaName
    .split("/")
    .map((segment) => segment.trim().toLowerCase().replace(/\s+/g, "-"))
    .join(".");
}

const isWeight = (name) => name.startsWith("type.font-weight.") || name.startsWith("font.weight.");

const hex = ({ r, g, b, a }) => {
  const byte = (x) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}${a < 0.9995 ? byte(a) : ""}`;
};

function setLeaf(tree, name, leaf) {
  const segments = name.split(".");
  let node = tree;
  for (const [index, segment] of segments.entries()) {
    const last = index === segments.length - 1;
    const existing = node[segment];
    if (last) {
      if (existing !== undefined) throw new Error(`Token "${name}" collides with an existing token or group.`);
      node[segment] = leaf;
    } else {
      if (existing === undefined) node[segment] = {};
      else if (typeof existing !== "object" || "$modes" in existing) {
        throw new Error(`Token "${name}" needs "${segments.slice(0, index + 1).join(".")}" to be a group, but it is already a token.`);
      }
      node = node[segment];
    }
  }
}

export function extractTokens(doc) {
  const nodes = doc.nodeChanges.filter((n) => n.phase !== "REMOVED" && !n.isSoftDeleted);
  const sets = new Map(
    nodes
      .filter((n) => n.type === "VARIABLE_SET")
      .map((n) => [gid(n.guid), { name: n.name, modes: new Map(n.variableSetModes.map((m) => [gid(m.id), m.name])) }]),
  );
  const variables = nodes
    .filter((n) => n.type === "VARIABLE" && sets.has(gid(n.variableSetID.guid)))
    .sort((a, b) => compare(a.sortPosition, b.sortPosition));
  const byGuid = new Map(variables.map((v) => [gid(v.guid), v]));

  const nameOf = (guid, context) => {
    const target = byGuid.get(gid(guid));
    if (!target) throw new Error(`${context} points at a variable that is not in the file (${gid(guid)}).`);
    return dotted(target.name);
  };

  const valueOf = (name, data) => {
    const value = data.value ?? {};
    if (value.alias) return `{${nameOf(value.alias.guid, `Variable "${name}"`)}}`;
    if (value.colorValue) return hex(value.colorValue);
    if (value.floatValue !== undefined) return isWeight(name) ? String(value.floatValue) : `${value.floatValue}px`;
    if (value.textValue !== undefined) return value.textValue;
    throw new Error(`Variable "${name}" has an unsupported value type (${data.resolvedDataType}).`);
  };

  const primitives = {};
  const semantic = {};
  const skipped = { collections: [], styles: [] };
  const stats = { primitives: 0, semantic: 0, withDarkVariant: 0, textStyles: 0, effectStyles: 0 };
  const skippedCount = new Map();

  for (const variable of variables) {
    const set = sets.get(gid(variable.variableSetID.guid));
    const name = dotted(variable.name);
    const entries = variable.variableDataValues.entries;

    if (set.name === PRIMITIVE_COLLECTION) {
      if (entries.length !== 1) throw new Error(`Primitive "${name}" has ${entries.length} modes; expected 1.`);
      setLeaf(primitives, name, valueOf(name, entries[0].variableData));
      stats.primitives++;
    } else if (set.name === SEMANTIC_COLLECTION) {
      const byMode = {};
      for (const entry of entries) {
        const modeName = set.modes.get(gid(entry.modeID));
        const key = MODE_KEYS[modeName];
        if (!key) throw new Error(`Semantic variable "${name}" uses mode "${modeName}"; only Light and Dark are supported.`);
        byMode[key] = valueOf(name, entry.variableData);
      }
      if (!byMode.light || !byMode.dark) throw new Error(`Semantic variable "${name}" must define both Light and Dark.`);
      const same = byMode.light === byMode.dark;
      setLeaf(semantic, name, same ? byMode.light : { $modes: { light: byMode.light, dark: byMode.dark } });
      stats.semantic++;
      if (!same) stats.withDarkVariant++;
    } else {
      skippedCount.set(set.name, (skippedCount.get(set.name) ?? 0) + 1);
    }
  }
  for (const [name, count] of skippedCount) skipped.collections.push({ name, variables: count });

  const styles = nodes.filter((n) => n.styleType).sort((a, b) => compare(a.sortPosition, b.sortPosition));

  for (const style of styles) {
    const name = dotted(style.name);
    if (style.styleType === "TEXT") {
      const bound = new Map(
        (style.variableConsumptionMap?.entries ?? []).map((e) => {
          const value = e.variableData.value;
          const alias = value.alias ?? value.fontStyleValue?.asFloat?.value?.alias;
          return [e.variableField, alias ? nameOf(alias.guid, `Text style "${style.name}"`) : null];
        }),
      );
      const missing = ["FONT_FAMILY", "FONT_STYLE", "FONT_SIZE", "LINE_HEIGHT"].filter((field) => !bound.get(field));
      if (missing.length > 0) {
        throw new Error(`Text style "${style.name}" is not bound to variables for: ${missing.join(", ")}. Every text style must use font/* variables.`);
      }
      setLeaf(semantic, `text.${name}`, `{${bound.get("FONT_STYLE")}} {${bound.get("FONT_SIZE")}}/{${bound.get("LINE_HEIGHT")}} {${bound.get("FONT_FAMILY")}}`);
      stats.textStyles++;
    } else if (style.styleType === "EFFECT") {
      const shadows = (style.effects ?? []).filter((e) => e.visible !== false);
      const unsupported = shadows.filter((e) => e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW");
      if (shadows.length === 0 || unsupported.length > 0) {
        skipped.styles.push(`${style.name} (effect type ${unsupported[0]?.type ?? "none"} is not supported)`);
        continue;
      }
      const css = shadows.map((e) => {
        const color = e.colorVar?.value?.alias
          ? `{${nameOf(e.colorVar.value.alias.guid, `Effect style "${style.name}"`)}}`
          : `rgba(${Math.round(e.color.r * 255)}, ${Math.round(e.color.g * 255)}, ${Math.round(e.color.b * 255)}, ${Math.round(e.color.a * 100) / 100})`;
        return `${e.type === "INNER_SHADOW" ? "inset " : ""}${e.offset.x}px ${e.offset.y}px ${e.radius}px ${e.spread ?? 0}px ${color}`;
      });
      setLeaf(semantic, name, css.join(", "));
      stats.effectStyles++;
    } else {
      skipped.styles.push(`${style.name} (${style.styleType.toLowerCase()} style)`);
    }
  }

  return { primitives, semantic, skipped, stats };
}
