import { pathFromVectorNetwork } from "./figicons.mjs";

const gid = (guid) => (guid ? `${guid.sessionID}:${guid.localID}` : null);
const round = (v) => Math.round(v * 1000) / 1000;
const dotted = (name) => name.split("/").map((s) => s.trim().toLowerCase().replace(/\s+/g, "-")).join(".");

/** Reads the illustrative charts (bars, lines, donut) from the Chart component set. */
export function extractCharts(doc) {
  const nodes = doc.nodeChanges.filter((n) => n.phase !== "REMOVED" && !n.isSoftDeleted);
  const by = new Map(nodes.map((n) => [gid(n.guid), n]));
  const kids = new Map();
  for (const n of nodes) {
    const parent = gid(n.parentIndex?.guid);
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(n);
  }
  for (const list of kids.values()) list.sort((a, b) => ((a.parentIndex?.position ?? "") < (b.parentIndex?.position ?? "") ? -1 : 1));
  const children = (n) => kids.get(gid(n.guid)) ?? [];

  const colorOf = (node, field = "fillPaints") => {
    const alias = node[field]?.[0]?.colorVar?.value?.alias;
    return alias ? dotted(by.get(gid(alias.guid))?.name ?? "") : null;
  };
  const textOf = (n) => n.textData?.characters ?? "";

  const set = nodes.find((n) => n.isStateGroup && n.name === "Chart");
  if (!set) return {};
  const charts = {};
  for (const symbol of children(set).filter((n) => n.type === "SYMBOL")) {
    const type = /Tipo=(.+)$/.exec(symbol.name)?.[1];
    if (!type) continue;
    const parts = children(symbol);
    const title = parts.find((n) => n.type === "TEXT");
    const area = parts.find((n) => n.name === "Área");
    const legend = parts.find((n) => n.name === "Leyenda");
    const chart = {
      size: [symbol.size.x, symbol.size.y],
      title: title ? textOf(title) : "",
      area: area ? [area.size.x, area.size.y] : [0, 0],
      areaGap: area?.stackSpacing ?? 0,
      legend: children(legend ?? { guid: null }).map((item) => ({
        label: textOf(children(item).find((n) => n.type === "TEXT") ?? {}),
        color: colorOf(children(item).find((n) => n.type === "ELLIPSE") ?? {}),
      })),
    };
    const items = area ? children(area) : [];
    if (type === "Barras") {
      chart.bars = items.map((bar) => ({ width: bar.size.x, height: bar.size.y, radius: bar.cornerRadius ?? 0, color: colorOf(bar) }));
    } else if (type === "Líneas") {
      chart.lines = items
        .filter((n) => n.type === "VECTOR")
        .map((line) => ({
          d: pathFromVectorNetwork(doc.blobs[line.vectorData.vectorNetworkBlob].bytes),
          offset: [round(line.transform?.m02 ?? 0), round(line.transform?.m12 ?? 0)],
          strokeWidth: line.strokeWeight,
          color: colorOf(line, "strokePaints"),
        }));
    } else if (type === "Dona") {
      chart.arcs = items
        .filter((n) => n.type === "ELLIPSE")
        .map((arc) => ({
          size: arc.size.x,
          offset: [round(arc.transform?.m02 ?? 0), round(arc.transform?.m12 ?? 0)],
          start: round(arc.arcData?.startingAngle ?? 0),
          end: round(arc.arcData?.endingAngle ?? Math.PI * 2),
          inner: round(arc.arcData?.innerRadius ?? 0),
          color: colorOf(arc),
        }));
    }
    charts[type] = chart;
  }
  return charts;
}
