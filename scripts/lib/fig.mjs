import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import zlib from "node:zlib";
import { unzipSync } from "fflate";

const require = createRequire(import.meta.url);

const isZstd = (chunk) => chunk[0] === 0x28 && chunk[1] === 0xb5 && chunk[2] === 0x2f && chunk[3] === 0xfd;

function decompress(chunk) {
  if (!isZstd(chunk)) return zlib.inflateRawSync(chunk);
  if (typeof zlib.zstdDecompressSync !== "function") {
    throw new Error(`This .fig file uses zstd compression, which needs Node 22.15 or newer (running ${process.version}).`);
  }
  return zlib.zstdDecompressSync(chunk);
}

export function readFigDocument(path) {
  let bytes = readFileSync(path);

  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = unzipSync(new Uint8Array(bytes), { filter: (file) => file.name === "canvas.fig" });
    if (!files["canvas.fig"]) throw new Error(`${path} is a zip archive without canvas.fig. Is it a Figma .fig export?`);
    bytes = Buffer.from(files["canvas.fig"]);
  }

  const magic = bytes.subarray(0, 8).toString("latin1");
  if (magic !== "fig-kiwi") throw new Error(`${path} is not a Figma design file (unexpected header "${magic}"). FigJam files are not supported.`);

  const chunks = [];
  let offset = 12;
  while (offset + 4 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    offset += 4;
    chunks.push(bytes.subarray(offset, offset + length));
    offset += length;
  }
  if (chunks.length < 2) throw new Error(`${path} has an unexpected structure: expected a schema chunk and a data chunk.`);

  const kiwi = require("kiwi-schema");
  const schema = kiwi.compileSchema(kiwi.decodeBinarySchema(new Uint8Array(decompress(chunks[0]))));
  return schema.decodeMessage(new Uint8Array(decompress(chunks[1])));
}
