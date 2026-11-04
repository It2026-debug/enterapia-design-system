const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

export function parseHex(hex) {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: match[2] ? parseInt(match[2], 16) / 255 : 1 };
}

export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Composites a color with transparency over an opaque backdrop. */
export function over(color, backdrop) {
  const a = color.a ?? 1;
  if (a >= 1) return color;
  const mix = (front, back) => Math.round(front * a + back * (1 - a));
  return { r: mix(color.r, backdrop.r), g: mix(color.g, backdrop.g), b: mix(color.b, backdrop.b), a: 1 };
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const PREFIXED = /^(text|border|icon|focus|shadow|background)\//;

function tokenName(path, { background = false } = {}) {
  const trimmed = path.trim();
  if (background) {
    const name = trimmed.replace(/^bg:/, "");
    return `color.background.${name.split("/").join(".")}`;
  }
  const dotted = trimmed.split("/").join(".");
  return PREFIXED.test(trimmed) ? `color.${dotted}` : dotted;
}

function minimumOf(text) {
  const match = /([\d.]+):1/.exec(text);
  return match ? Number(match[1]) : null;
}

/** Turns the Figma contrast table into pairs we can recompute from the tokens. */
export function pairsFromFigma(rows) {
  return rows
    .map(([pair, use, minimum, light, dark]) => {
      const [foreground, background] = pair.split(/\s+\/\s+/);
      if (!foreground || !background) return null;
      return {
        label: pair.replace(/\s+/g, " "),
        use,
        minimum: minimumOf(minimum),
        foreground: tokenName(foreground),
        background: tokenName(background, { background: true }),
        figma: { light, dark },
      };
    })
    .filter(Boolean);
}

export function computeContrast(pairs, tokenByName) {
  return pairs.map((pair) => {
    const fg = tokenByName.get(pair.foreground);
    const bg = tokenByName.get(pair.background);
    const result = { ...pair, missing: !fg || !bg };
    if (result.missing) return result;
    for (const mode of ["light", "dark"]) {
      const frontRaw = parseHex((fg.modes ?? { [mode]: fg })[mode].value);
      const backRaw = parseHex((bg.modes ?? { [mode]: bg })[mode].value);
      // A translucent background is measured over white; a translucent foreground over the background.
      const back = backRaw && over(backRaw, { r: 255, g: 255, b: 255, a: 1 });
      const front = frontRaw && back && over(frontRaw, back);
      const ratio = front && back ? contrastRatio(front, back) : null;
      result[mode] = { ratio, pass: ratio !== null && ratio >= pair.minimum, fg: (fg.modes ?? { [mode]: fg })[mode].value, bg: (bg.modes ?? { [mode]: bg })[mode].value };
    }
    return result;
  });
}
