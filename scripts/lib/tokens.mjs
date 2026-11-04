const REFERENCE = /^\{([^{}]+)\}$/;

export const CATEGORIES = ["color", "spacing", "radius", "typography", "effects"];

export function flatten(tree, prefix = []) {
  const out = [];
  for (const [key, value] of Object.entries(tree)) {
    if (key.includes(".") || key.includes("{") || key.includes("}")) {
      throw new Error(`Invalid token key "${[...prefix, key].join(".")}": keys cannot contain ".", "{" or "}".`);
    }
    const path = [...prefix, key];
    if (value !== null && typeof value === "object") {
      out.push(...flatten(value, path));
    } else {
      out.push({ name: path.join("."), raw: String(value) });
    }
  }
  return out;
}

export function toCssVar(name) {
  const parts = name
    .split(".")
    .map((segment) => segment.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase());
  return `--${parts.join("-")}`;
}

export function inferType(name) {
  const [category] = name.split(".");
  if (category === "color") return "color";
  if (category === "spacing" || category === "radius") return "dimension";
  if (category === "effects") return "shadow";
  if (category === "typography") {
    if (name.includes(".fontFamily")) return "fontFamily";
    if (name.includes(".fontWeight")) return "fontWeight";
    if (name.includes(".fontSize") || name.includes(".lineHeight")) return "dimension";
  }
  return "other";
}

export function buildRegistry({ primitives, semantic, meta = {}, pkg }) {
  const errors = [];
  const tokens = new Map();

  const register = (items, layer) => {
    for (const { name, raw } of items) {
      if (tokens.has(name)) {
        errors.push(`Token "${name}" is defined more than once (second definition in the ${layer} layer).`);
        continue;
      }
      const match = REFERENCE.exec(raw);
      tokens.set(name, {
        name,
        layer,
        category: name.split(".")[0],
        type: inferType(name),
        raw,
        reference: match ? match[1] : null,
      });
    }
  };

  register(flatten(primitives), "primitive");
  register(flatten(semantic), "semantic");

  for (const token of tokens.values()) {
    if (!CATEGORIES.includes(token.category)) {
      errors.push(`Token "${token.name}" uses unknown category "${token.category}". Known: ${CATEGORIES.join(", ")}.`);
    }
    if (token.reference === null) continue;
    const target = tokens.get(token.reference);
    if (!target) {
      errors.push(`Token "${token.name}" references "${token.reference}", which does not exist.`);
    } else if (token.layer === "primitive") {
      errors.push(`Primitive "${token.name}" must be a literal value but references "${token.reference}".`);
    }
  }

  const resolved = new Map();
  const resolve = (name, trail = []) => {
    if (resolved.has(name)) return resolved.get(name);
    const token = tokens.get(name);
    if (trail.includes(name)) {
      errors.push(`Reference cycle: ${[...trail, name].join(" -> ")}.`);
      return null;
    }
    if (!token) return null;
    const value = token.reference === null ? token.raw : resolve(token.reference, [...trail, name]);
    resolved.set(name, value);
    return value;
  };
  for (const name of tokens.keys()) resolve(name);

  const cssVars = new Map();
  for (const name of tokens.keys()) {
    const cssVar = toCssVar(name);
    if (cssVars.has(cssVar)) {
      errors.push(`Tokens "${cssVars.get(cssVar)}" and "${name}" both map to ${cssVar}.`);
    }
    cssVars.set(cssVar, name);
  }

  for (const key of Object.keys(meta)) {
    if (!tokens.has(key)) {
      errors.push(`tokens/meta.json describes "${key}", which is not a token. Was it renamed or removed?`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Token validation failed:\n- ${errors.join("\n- ")}`);
  }

  const usedBy = new Map();
  for (const token of tokens.values()) {
    if (token.reference !== null) {
      usedBy.set(token.reference, [...(usedBy.get(token.reference) ?? []), token.name]);
    }
  }

  const list = [...tokens.values()].map((token) => ({
    name: token.name,
    cssVar: toCssVar(token.name),
    layer: token.layer,
    category: token.category,
    type: token.type,
    value: resolved.get(token.name),
    reference: token.reference,
    usedBy: usedBy.get(token.name) ?? [],
    status: meta[token.name]?.status ?? null,
    note: meta[token.name]?.note ?? null,
  }));

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    scope: {
      covers: "Tokens used by the Button, Input, Badge and Card components in the Figma file.",
      doesNotCover: [
        "Component code, variants and usage guidelines (planned for a later release).",
        "Dark theme (the Figma file defines light values only).",
        "Figma variables that none of the four components reference.",
      ],
    },
    counts: {
      total: list.length,
      primitive: list.filter((t) => t.layer === "primitive").length,
      semantic: list.filter((t) => t.layer === "semantic").length,
    },
    tokens: list,
  };
}

const cssValue = (token) => {
  if (token.reference !== null) return `var(${toCssVar(token.reference)})`;
  if (token.type === "fontFamily" && /[^\w-]/.test(token.value)) return `"${token.value}"`;
  return token.value;
};

export function renderCss(registry) {
  const lines = [
    "/* Generated by scripts/build.mjs from tokens/*.json. Do not edit by hand. */",
    ":root {",
  ];
  for (const layer of ["primitive", "semantic"]) {
    for (const category of CATEGORIES) {
      const group = registry.tokens.filter((t) => t.layer === layer && t.category === category);
      if (group.length === 0) continue;
      lines.push(`  /* ${layer} / ${category} */`);
      for (const token of group) lines.push(`  ${token.cssVar}: ${cssValue(token)};`);
    }
  }
  lines.push("}", "");
  return lines.join("\n");
}
