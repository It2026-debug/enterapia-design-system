import assert from "node:assert/strict";
import { test } from "node:test";
import { dotted, extractTokens } from "../scripts/lib/figtokens.mjs";

const g = (sessionID, localID) => ({ sessionID, localID });
const variableSet = (id, name, modeNames, extra = {}) => ({
  type: "VARIABLE_SET",
  guid: g(1, id),
  name,
  variableSetModes: modeNames.map((modeName, i) => ({ id: g(1, id * 100 + i), name: modeName })),
  ...extra,
});
const entry = (setId, mode, value, dataType = "FLOAT") => ({
  modeID: g(1, setId * 100 + mode),
  variableData: { value, dataType, resolvedDataType: dataType },
});
const variable = (id, setId, name, entries, sortPosition = String(id).padStart(4, "0")) => ({
  type: "VARIABLE",
  guid: g(2, id),
  name,
  sortPosition,
  variableSetID: { guid: g(1, setId) },
  variableDataValues: { entries },
});
const alias = (id) => ({ alias: { guid: g(2, id) } });
const color = (r, gr, b, a = 1) => ({ colorValue: { r, g: gr, b, a } });

const baseNodes = () => [
  variableSet(1, "Primitives", ["Value"]),
  variableSet(2, "Semantic", ["Light", "Dark"]),
  variableSet(3, "Spacing", ["Value"], { isSoftDeleted: true }),
  variable(10, 1, "Color/Neutral/White", [entry(1, 0, color(1, 1, 1), "COLOR")]),
  variable(11, 1, "Color/Neutral/Gray/900", [entry(1, 0, color(0, 9 / 255, 28 / 255), "COLOR")]),
  variable(12, 1, "Color/Alpha/Gray/900/8", [entry(1, 0, color(0, 9 / 255, 28 / 255, 0.08), "COLOR")]),
  variable(13, 1, "Size/16", [entry(1, 0, { floatValue: 16 })]),
  variable(14, 1, "Type/Font Weight/Bold", [entry(1, 0, { floatValue: 700 })]),
  variable(15, 1, "Type/Font Family/Body", [entry(1, 0, { textValue: "Roboto" }, "STRING")]),
  variable(20, 2, "color/background/page", [entry(2, 0, alias(10), "ALIAS"), entry(2, 1, alias(11), "ALIAS")]),
  variable(21, 2, "color/text/on-interactive/default", [entry(2, 0, alias(10), "ALIAS"), entry(2, 1, alias(10), "ALIAS")]),
  variable(22, 2, "color/shadow/raised", [entry(2, 0, alias(12), "ALIAS"), entry(2, 1, alias(12), "ALIAS")]),
  variable(23, 2, "font/size/body/md", [entry(2, 0, alias(13), "ALIAS"), entry(2, 1, alias(13), "ALIAS")]),
  variable(24, 2, "font/line-height/body/md", [entry(2, 0, alias(13), "ALIAS"), entry(2, 1, alias(13), "ALIAS")]),
  variable(25, 2, "font/weight/body", [entry(2, 0, alias(14), "ALIAS"), entry(2, 1, alias(14), "ALIAS")]),
  variable(26, 2, "font/family/body", [entry(2, 0, alias(15), "ALIAS"), entry(2, 1, alias(15), "ALIAS")]),
  variable(90, 3, "space/16", [entry(3, 0, { floatValue: 16 })]),
];

const textStyle = (overrides = {}) => ({
  type: "TEXT",
  styleType: "TEXT",
  name: "body/md",
  sortPosition: "1",
  variableConsumptionMap: {
    entries: [
      { variableField: "FONT_FAMILY", variableData: { value: alias(26) } },
      { variableField: "FONT_STYLE", variableData: { value: { fontStyleValue: { asFloat: { value: alias(25) } } } } },
      { variableField: "FONT_SIZE", variableData: { value: alias(23) } },
      { variableField: "LINE_HEIGHT", variableData: { value: alias(24) } },
    ],
  },
  ...overrides,
});
const effectStyle = (overrides = {}) => ({
  type: "ROUNDED_RECTANGLE",
  styleType: "EFFECT",
  name: "elevation/raised",
  sortPosition: "2",
  effects: [
    { type: "DROP_SHADOW", visible: true, offset: { x: 0, y: 4 }, radius: 16, spread: 0, colorVar: { value: alias(22) }, color: { r: 0, g: 0, b: 0, a: 0.08 } },
  ],
  ...overrides,
});

const extract = (...extra) => extractTokens({ nodeChanges: [...baseNodes(), ...extra] });

test("Figma names become lowercase dotted token names", () => {
  assert.equal(dotted("Color/Brand/Blue/50"), "color.brand.blue.50");
  assert.equal(dotted("Type/Font Family/Heading"), "type.font-family.heading");
  assert.equal(dotted("font/line-height/heading/2xs"), "font.line-height.heading.2xs");
});

test("primitives keep literal values, convert units and keep references between primitives", () => {
  const { primitives } = extract(variable(16, 1, "Color/Semantic/Success/500", [entry(1, 0, alias(11), "ALIAS")]));
  assert.equal(primitives.color.neutral.white, "#ffffff");
  assert.equal(primitives.color.neutral.gray["900"], "#00091c");
  assert.equal(primitives.color.alpha.gray["900"]["8"], "#00091c14");
  assert.equal(primitives.size["16"], "16px");
  assert.equal(primitives.type["font-weight"].bold, "700");
  assert.equal(primitives.type["font-family"].body, "Roboto");
  assert.equal(primitives.color.semantic.success["500"], "{color.neutral.gray.900}");
});

test("semantic tokens that differ by mode use $modes, and identical ones collapse to a string", () => {
  const { semantic, stats } = extract();
  assert.deepEqual(semantic.color.background.page, { $modes: { light: "{color.neutral.white}", dark: "{color.neutral.gray.900}" } });
  assert.equal(semantic.color.text["on-interactive"].default, "{color.neutral.white}");
  assert.equal(stats.withDarkVariant, 1);
});

test("variables that belong to a deleted collection are ignored", () => {
  const { primitives, semantic } = extract();
  assert.equal(JSON.stringify({ primitives, semantic }).includes("space"), false);
});

test("text styles become font shorthands built from the variables they use", () => {
  const { semantic, stats } = extract(textStyle());
  assert.equal(semantic.text.body.md, "{font.weight.body} {font.size.body.md}/{font.line-height.body.md} {font.family.body}");
  assert.equal(stats.textStyles, 1);
});

test("effect styles become shadows whose color is a reference", () => {
  const { semantic } = extract(effectStyle());
  assert.equal(semantic.elevation.raised, "0px 4px 16px 0px {color.shadow.raised}");
});

test("a text style that is not bound to variables is an error", () => {
  const unbound = textStyle({ variableConsumptionMap: { entries: [] } });
  assert.throws(() => extract(unbound), /not bound to variables/);
});

test("unsupported styles are reported instead of silently dropped", () => {
  const { skipped } = extract(
    effectStyle({ name: "blur/soft", effects: [{ type: "LAYER_BLUR", visible: true }] }),
    { type: "FRAME", styleType: "GRID", name: "desktop", sortPosition: "3" },
  );
  assert.equal(skipped.styles.length, 2);
});

test("an alias to a variable that does not exist is an error", () => {
  const broken = variable(30, 2, "color/text/body/primary", [entry(2, 0, alias(999), "ALIAS"), entry(2, 1, alias(999), "ALIAS")]);
  assert.throws(() => extract(broken), /not in the file/);
});

test("a semantic variable must define both Light and Dark", () => {
  const lightOnly = variable(31, 2, "color/text/body/secondary", [entry(2, 0, alias(10), "ALIAS")]);
  assert.throws(() => extract(lightOnly), /both Light and Dark/);
});

test("a name that is both a token and a group is an error", () => {
  const clash = variable(32, 2, "color/background/page/extra", [entry(2, 0, alias(10), "ALIAS"), entry(2, 1, alias(11), "ALIAS")]);
  assert.throws(() => extract(clash), /needs "color.background.page" to be a group/);
});

test("collections other than Primitives and Semantic are reported", () => {
  const { skipped } = extractTokens({
    nodeChanges: [
      ...baseNodes(),
      variableSet(4, "Experiments", ["Value"]),
      variable(40, 4, "x/1", [entry(4, 0, { floatValue: 1 })]),
    ],
  });
  assert.deepEqual(skipped.collections, [{ name: "Experiments", variables: 1 }]);
});
