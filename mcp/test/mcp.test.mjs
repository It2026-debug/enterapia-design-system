import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { build } from "../../scripts/build.mjs";
import { createApp } from "../server.mjs";

let app;
let base;
let client;
let registry;

const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content[0].text;
  return { isError: Boolean(result.isError), text, json: result.isError ? null : safeParse(text) };
};
const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

before(async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "ds-mcp-"));
  registry = build({ outDir: dataDir }).registry;
  app = createApp({ dataDir });
  await new Promise((done) => app.listen(0, "127.0.0.1", done));
  base = `http://127.0.0.1:${app.address().port}`;
  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
});

after(async () => {
  await client.close();
  await new Promise((done) => app.close(done));
});

test("exposes exactly the five read-only tools", async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["get_css", "get_design_system_info", "get_token", "list_tokens", "search_tokens"]);
  for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
});

test("overview states the scope and the usage rules", async () => {
  const { json } = await call("get_design_system_info");
  assert.equal(json.counts.total, registry.counts.total);
  assert.deepEqual(json.themes.modes, ["light", "dark"]);
  assert.ok(json.scope.doesNotCover.length > 0);
  assert.ok(json.rules.some((rule) => /semantic tokens/i.test(rule)));
  assert.ok(json.rules.some((rule) => /text style/i.test(rule)));
});

test("get_token resolves a semantic token in both themes and points to its primitive", async () => {
  const { json } = await call("get_token", { name: "color.text.feedback.error" });
  assert.equal(json.value, "#d42515");
  assert.equal(json.reference, "color.semantic.error.700");
  assert.equal(json.cssVar, "--color-text-feedback-error");
  assert.equal(json.modes.dark.value, "#fff1f0");
  assert.equal(json.modes.dark.reference, "color.semantic.error.100");
});

test("get_token returns composite tokens with their resolved value and definition", async () => {
  const text = (await call("get_token", { name: "text.heading.sm" })).json;
  assert.equal(text.value, "700 24px/32px Roboto");
  assert.match(text.definition, /\{font\.size\.heading\.sm\}/);
  const shadow = (await call("get_token", { name: "elevation.raised" })).json;
  assert.equal(shadow.value, "0px 4px 16px 0px #00091c14");
});

test("get_token on a primitive lists the tokens that alias it", async () => {
  const { json } = await call("get_token", { name: "color.semantic.error.700" });
  assert.ok(json.usedBy.includes("color.text.feedback.error"));
});

test("get_token on an unknown name is an error with suggestions", async () => {
  const result = await call("get_token", { name: "color.text.eror" });
  assert.equal(result.isError, true);
  assert.match(result.text, /No token named/);
  const close = await call("get_token", { name: "text.error" });
  assert.equal(close.isError, true);
  assert.match(close.text, /color\.text\.feedback\.error/);
});

test("list_tokens filters by layer and category", async () => {
  const { json } = await call("list_tokens", { layer: "semantic", category: "elevation" });
  assert.equal(json.count, 2);
  assert.ok(json.tokens.every((t) => t.layer === "semantic" && t.category === "elevation"));
  const colors = (await call("list_tokens", { layer: "semantic", category: "color" })).json;
  const error = colors.tokens.find((t) => t.name === "color.text.feedback.error");
  assert.equal(error.darkValue, "#fff1f0");
});

test("search_tokens finds tokens by name and by value", async () => {
  const byName = await call("search_tokens", { query: "error" });
  assert.ok(byName.json.tokens.some((t) => t.name === "color.text.feedback.error"));
  const byValue = await call("search_tokens", { query: "#d42515" });
  assert.ok(byValue.json.tokens.some((t) => t.name === "color.semantic.error.700"));
  const byDarkValue = await call("search_tokens", { query: "#fff1f0 text" });
  assert.ok(byDarkValue.json.tokens.some((t) => t.name === "color.text.feedback.error"));
  const none = await call("search_tokens", { query: "zzzz-no-match" });
  assert.equal(none.json.count, 0);
});

test("get_css returns light values with dark overrides and can be limited to one layer", async () => {
  const all = await call("get_css");
  assert.match(all.text, /:root \{/);
  assert.match(all.text, /--color-text-feedback-error: var\(--color-semantic-error-700\);/);
  const dark = all.text.slice(all.text.indexOf(':root[data-theme="dark"]'));
  assert.match(dark, /--color-text-feedback-error: var\(--color-semantic-error-100\);/);
  const primitives = await call("get_css", { layer: "primitive" });
  assert.match(primitives.text, /--color-semantic-error-700: #d42515;/);
  assert.doesNotMatch(primitives.text, /--color-text-feedback-error/);
  assert.doesNotMatch(primitives.text, /data-theme="dark"/);
});

test("health endpoint answers and allows cross-origin reads", async () => {
  const response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal((await response.json()).status, "ok");
});

test("GET /mcp is rejected because the server is stateless", async () => {
  const response = await fetch(`${base}/mcp`);
  assert.equal(response.status, 405);
});

test("malformed JSON gets a 400 instead of crashing the server", async () => {
  const response = await fetch(`${base}/mcp`, { method: "POST", headers: { "content-type": "application/json" }, body: "{not json" });
  assert.equal(response.status, 400);
  const after = await fetch(`${base}/health`);
  assert.equal(after.status, 200);
});

test("oversized bodies are refused", async () => {
  const response = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pad: "x".repeat(300 * 1024) }),
  });
  assert.equal(response.status, 413);
});

test("unknown paths return 404", async () => {
  const response = await fetch(`${base}/nope`);
  assert.equal(response.status, 404);
});
