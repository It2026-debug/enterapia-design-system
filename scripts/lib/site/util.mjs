export const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const slug = (text) => String(text).replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "");

export const titleCase = (text) => text.replace(/[-.]/g, " ").replace(/^./, (c) => c.toUpperCase());

export const rootOf = (path) => "../".repeat(path.split("/").length - 1);

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

export function pretty(html) {
  const inline = new Set(["span", "a", "b", "strong", "em", "i", "label", "code", "small", "svg", "path", "circle", "rect", "line", "polyline", "g", "text"]);
  const void_ = new Set(["input", "img", "br", "hr", "meta", "link"]);
  let depth = 0;
  const out = [];
  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];
  let line = "";
  const flush = () => {
    if (line.trim()) out.push("  ".repeat(Math.max(depth, 0)) + line.trim());
    line = "";
  };
  for (const token of tokens) {
    if (!token.startsWith("<")) {
      line += token;
      continue;
    }
    const closing = token.startsWith("</");
    const name = /^<\/?([a-zA-Z0-9-]+)/.exec(token)?.[1]?.toLowerCase();
    const selfClosing = token.endsWith("/>") || void_.has(name);
    if (inline.has(name)) {
      line += token;
      continue;
    }
    if (closing) {
      flush();
      depth -= 1;
      line = token;
      flush();
    } else {
      flush();
      line = token;
      flush();
      if (!selfClosing) depth += 1;
    }
  }
  flush();
  return out.join("\n");
}
