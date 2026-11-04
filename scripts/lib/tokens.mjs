const REFERENCE = /\{([^{}]+)\}/g;
const WHOLE_REFERENCE = /^\{([^{}]+)\}$/;

export const MODES = ["light", "dark"];
export const DEFAULT_MODE = "light";
export const CATEGORIES = [
  "color",
  "spacing",
  "border-width",
  "radius",
  "size",
  "font",
  "type",
  "text",
  "elevation",
  "focus",
];

const isGroup = (value) => value !== null && typeof value === "object";

function validateModes(name, modes) {
  const keys = Object.keys(modes ?? {});
  const ok =
    keys.length === MODES.length &&
    MODES.every((mode) => typeof modes[mode] === "string" && modes[mode] !== "");
  if (!ok) {
    throw new Error(`Token "${name}": $modes must define exactly ${MODES.join(" and ")} as non-empty strings.`);
  }
}

export function flatten(tree, prefix = []) {
  const out = [];
  for (const [key, value] of Object.entries(tree)) {
    if (key.includes(".") || key.includes("{") || key.includes("}") || key.startsWith("$")) {
      throw new Error(`Invalid token key "${[...prefix, key].join(".")}": keys cannot contain ".", "{" or "}" or start with "$".`);
    }
    const path = [...prefix, key];
    const name = path.join(".");
    if (!isGroup(value)) {
      out.push({ name, modes: null, raw: String(value) });
    } else if ("$modes" in value) {
      validateModes(name, value.$modes);
      out.push({ name, modes: value.$modes, raw: null });
    } else {
      out.push(...flatten(value, path));
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
  const [category, kind] = name.split(".");
  if (category === "color") return "color";
  if (category === "text") return "typography";
  if (category === "elevation" || category === "focus") return "shadow";
  if (["spacing", "radius", "border-width", "size"].includes(category)) return "dimension";
  if (category === "font" || category === "type") {
    if (kind === "family" || kind === "font-family") return "fontFamily";
    if (kind === "weight" || kind === "font-weight") return "fontWeight";
    return "dimension";
  }
  return "other";
}

const referencesIn = (definition) => [...definition.matchAll(REFERENCE)].map((m) => m[1]);

export function buildRegistry({ primitives, semantic, meta = {}, about, pkg }) {
  const errors = [];
  const tokens = new Map();

  const register = (items, layer) => {
    for (const { name, modes, raw } of items) {
      if (tokens.has(name)) {
        errors.push(`Token "${name}" is defined more than once (second definition in the ${layer} layer).`);
        continue;
      }
      if (layer === "primitive" && modes) {
        errors.push(`Primitive "${name}" cannot define modes; only semantic tokens vary by mode.`);
        continue;
      }
      const category = name.split(".")[0];
      tokens.set(name, {
        name,
        layer,
        category,
        type: inferType(name),
        definitions: modes ?? Object.fromEntries(MODES.map((mode) => [mode, raw])),
        modal: Boolean(modes),
      });
    }
  };

  register(flatten(primitives), "primitive");
  register(flatten(semantic), "semantic");

  for (const token of tokens.values()) {
    if (!CATEGORIES.includes(token.category)) {
      errors.push(`Token "${token.name}" uses unknown category "${token.category}". Known: ${CATEGORIES.join(", ")}.`);
    }
    for (const definition of Object.values(token.definitions)) {
      for (const ref of referencesIn(definition)) {
        const target = tokens.get(ref);
        if (!target) {
          errors.push(`Token "${token.name}" references "${ref}", which does not exist.`);
        } else if (token.layer === "primitive" && target.layer !== "primitive") {
          errors.push(`Primitive "${token.name}" may only reference other primitives but references "${ref}".`);
        }
      }
    }
  }

  const resolved = new Map();
  const resolve = (name, mode, trail = []) => {
    const key = `${mode}:${name}`;
    if (resolved.has(key)) return resolved.get(key);
    const token = tokens.get(name);
    if (!token) return "";
    if (trail.includes(name)) {
      errors.push(`Reference cycle: ${[...trail, name].join(" -> ")}.`);
      return "";
    }
    const value = token.definitions[mode].replace(REFERENCE, (_, ref) => resolve(ref, mode, [...trail, name]));
    resolved.set(key, value);
    return value;
  };
  for (const name of tokens.keys()) for (const mode of MODES) resolve(name, mode);

  const cssVars = new Map();
  for (const name of tokens.keys()) {
    const cssVar = toCssVar(name);
    if (cssVars.has(cssVar)) errors.push(`Tokens "${cssVars.get(cssVar)}" and "${name}" both map to ${cssVar}.`);
    cssVars.set(cssVar, name);
  }

  for (const key of Object.keys(meta)) {
    if (!tokens.has(key)) {
      errors.push(`tokens/meta.json describes "${key}", which is not a token. Was it renamed or removed?`);
    }
  }

  if (errors.length > 0) throw new Error(`Token validation failed:\n- ${errors.join("\n- ")}`);

  const usedBy = new Map();
  for (const token of tokens.values()) {
    const refs = new Set(Object.values(token.definitions).flatMap(referencesIn));
    for (const ref of refs) usedBy.set(ref, [...(usedBy.get(ref) ?? []), token.name]);
  }

  const view = (token, mode) => {
    const definition = token.definitions[mode];
    const whole = WHOLE_REFERENCE.exec(definition);
    return { definition, value: resolved.get(`${mode}:${token.name}`), reference: whole ? whole[1] : null };
  };

  const list = [...tokens.values()].map((token) => {
    const light = view(token, DEFAULT_MODE);
    const differs = MODES.some((mode) => token.definitions[mode] !== token.definitions[DEFAULT_MODE]);
    return {
      name: token.name,
      cssVar: toCssVar(token.name),
      layer: token.layer,
      category: token.category,
      type: token.type,
      ...light,
      modes: token.modal && differs ? Object.fromEntries(MODES.map((mode) => [mode, view(token, mode)])) : null,
      usedBy: usedBy.get(token.name) ?? [],
      status: meta[token.name]?.status ?? null,
      note: meta[token.name]?.note ?? null,
    };
  });

  return {
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    scope: {
      covers: about.covers,
      doesNotCover: about.doesNotCover ?? [],
      notes: about.notes ?? [],
    },
    modes: MODES,
    defaultMode: DEFAULT_MODE,
    counts: {
      total: list.length,
      primitive: list.filter((t) => t.layer === "primitive").length,
      semantic: list.filter((t) => t.layer === "semantic").length,
      withDarkVariant: list.filter((t) => t.modes).length,
    },
    tokens: list,
  };
}

const cssValue = (token, view) => {
  if (!view.definition.includes("{") && token.type === "fontFamily" && /[^\w-]/.test(view.definition)) {
    return `"${view.definition}"`;
  }
  return view.definition.replace(REFERENCE, (_, ref) => `var(${toCssVar(ref)})`);
};

export function renderCss(registry) {
  const declarations = (tokens, mode) =>
    tokens
      .map((token) => `  ${token.cssVar}: ${cssValue(token, mode === "dark" && token.modes ? token.modes.dark : token)};`)
      .join("\n");

  const lines = [
    "/* Generated by scripts/build.mjs from tokens/*.json. Do not edit by hand. */",
    ":root {",
    "  color-scheme: light;",
  ];
  for (const layer of ["primitive", "semantic"]) {
    for (const category of CATEGORIES) {
      const group = registry.tokens.filter((t) => t.layer === layer && t.category === category);
      if (group.length === 0) continue;
      lines.push(`  /* ${layer} / ${category} */`, declarations(group, "light"));
    }
  }
  lines.push("}");

  const dark = registry.tokens.filter((t) => t.modes);
  if (dark.length > 0) {
    const body = declarations(dark, "dark");
    lines.push(
      "",
      "/* Dark theme: set data-theme=\"dark\" on <html>, or let the system preference decide. */",
      ':root[data-theme="dark"] {',
      "  color-scheme: dark;",
      body,
      "}",
      "@media (prefers-color-scheme: dark) {",
      '  :root:not([data-theme="light"]) {',
      "    color-scheme: dark;",
      body.replace(/^/gm, "  "),
      "  }",
      "}",
    );
  }
  lines.push("");
  return lines.join("\n");
}
