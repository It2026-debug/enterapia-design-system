const gid = (guid) => (guid ? `${guid.sessionID}:${guid.localID}` : null);
const round = (v) => Math.round(v * 1000) / 1000;

/**
 * Decodes a Figma vector network into an SVG path made of the stroke centerlines.
 * Layout: u32 vertexCount, u32 segmentCount, u32 regionCount, then vertices
 * (u32 style, f32 x, f32 y) and segments (u32 style, u32 start, f32 tx, f32 ty,
 * u32 end, f32 tx, f32 ty). Tangents are offsets from their vertex.
 */
export function pathFromVectorNetwork(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vertexCount = view.getUint32(0, true);
  const segmentCount = view.getUint32(4, true);
  let offset = 12;
  const vertices = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push([view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)]);
    offset += 12;
  }
  const segments = [];
  for (let i = 0; i < segmentCount; i++) {
    segments.push({
      start: view.getUint32(offset + 4, true),
      startTangent: [view.getFloat32(offset + 8, true), view.getFloat32(offset + 12, true)],
      end: view.getUint32(offset + 16, true),
      endTangent: [view.getFloat32(offset + 20, true), view.getFloat32(offset + 24, true)],
    });
    offset += 28;
  }

  const point = (index) => `${round(vertices[index][0])} ${round(vertices[index][1])}`;
  const parts = [];
  let chainStart = null;
  let current = null;
  const closeIfLoop = () => {
    if (chainStart !== null && current === chainStart && parts.at(-1) !== "Z") parts.push("Z");
  };
  for (const segment of segments) {
    if (segment.start !== current) {
      closeIfLoop();
      parts.push(`M${point(segment.start)}`);
      chainStart = segment.start;
    }
    const straight = segment.startTangent.every((v) => v === 0) && segment.endTangent.every((v) => v === 0);
    if (straight) {
      parts.push(`L${point(segment.end)}`);
    } else {
      const c1 = [vertices[segment.start][0] + segment.startTangent[0], vertices[segment.start][1] + segment.startTangent[1]];
      const c2 = [vertices[segment.end][0] + segment.endTangent[0], vertices[segment.end][1] + segment.endTangent[1]];
      parts.push(`C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${point(segment.end)}`);
    }
    current = segment.end;
  }
  closeIfLoop();
  return parts.join("");
}

/** Reads the Icon component set: a centerline path and stroke settings per icon name and size. */
export function extractIcons(doc) {
  const nodes = doc.nodeChanges.filter((n) => n.phase !== "REMOVED" && !n.isSoftDeleted);
  const kids = new Map();
  for (const n of nodes) {
    const parent = gid(n.parentIndex?.guid);
    if (!kids.has(parent)) kids.set(parent, []);
    kids.get(parent).push(n);
  }
  const set = nodes.find((n) => n.isStateGroup && n.name === "Icon");
  if (!set) return {};
  const icons = {};
  for (const symbol of (kids.get(gid(set.guid)) ?? []).filter((n) => n.type === "SYMBOL")) {
    const match = /^Name=(.+),\s*Size=(.+)$/.exec(symbol.name);
    if (!match) continue;
    const [, name, size] = match;
    const vector = (kids.get(gid(symbol.guid)) ?? []).find((n) => n.type === "VECTOR");
    const bytes = vector && doc.blobs[vector.vectorData?.vectorNetworkBlob]?.bytes;
    if (!bytes) throw new Error(`Icon "${symbol.name}" has no vector network.`);
    (icons[name] ??= {})[size] = {
      size: round(symbol.size.x),
      offset: [round(vector.transform?.m02 ?? 0), round(vector.transform?.m12 ?? 0)],
      strokeWidth: vector.strokeWeight ?? 2,
      cap: (vector.strokeCap ?? "ROUND").toLowerCase() === "none" ? "butt" : (vector.strokeCap ?? "ROUND").toLowerCase(),
      join: (vector.strokeJoin ?? "ROUND").toLowerCase(),
      d: pathFromVectorNetwork(bytes),
    };
  }
  return icons;
}
