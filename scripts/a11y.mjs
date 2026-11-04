import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkPages, CONFIGS, formatReport, launchBrowser, serve } from "./lib/a11y.mjs";
import { build } from "./build.mjs";

const outDir = mkdtempSync(join(tmpdir(), "ds-a11y-"));
let browser;
let server;
let failed = true;

try {
  const { pages } = build({ outDir });
  server = await serve(outDir);
  browser = await launchBrowser();
  console.log(`Revisando ${pages.length} páginas en ${CONFIGS.length} configuraciones (${CONFIGS.map((c) => c.name).join(", ")})…`);
  const started = Date.now();
  const report = await checkPages({ baseUrl: server.url, pages, browser });
  console.log(formatReport(report));
  console.log(`(${Math.round((Date.now() - started) / 1000)} s)`);
  failed = report.violations.length > 0 || report.overflow.length > 0;
} catch (error) {
  console.error(error.stack ?? error.message);
} finally {
  await browser?.close();
  await server?.close();
  rmSync(outDir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
