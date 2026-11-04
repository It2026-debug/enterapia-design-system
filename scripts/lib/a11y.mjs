import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** The same rules used in the audit: WCAG 2.0 to 2.2 A and AA, plus axe best practices. */
export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Light, dark and a phone, plus the operating system asking for dark without a saved choice. */
export const CONFIGS = [
  { name: "claro", theme: "light", width: 1280, height: 900 },
  { name: "oscuro", theme: "dark", width: 1280, height: 900 },
  { name: "sistema oscuro", theme: "system", colorScheme: "dark", width: 1280, height: 900 },
  { name: "celular", theme: "system", width: 390, height: 844 },
];

/** Serves a folder over http on a free port. Only files inside the folder can be read. */
export async function serve(dir) {
  const root = normalize(dir);
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (path.endsWith("/")) path += "index.html";
      const file = normalize(join(root, path));
      if (file !== root && !file.startsWith(root + sep)) throw new Error("outside");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve) => server.close(resolve)) };
}

/** Opens the Chrome installed on the machine (GitHub's runners include it), so no browser is downloaded. */
export async function launchBrowser() {
  const attempts = [{ channel: "chrome" }, ...(process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [])];
  let lastError;
  for (const options of attempts) {
    try {
      return await chromium.launch({ headless: true, ...options });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Could not start Google Chrome. Install it, or set CHROME_PATH to a Chrome or Chromium binary.\n${lastError?.message ?? ""}`);
}

async function inPool(items, size, task) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length > 0) await task(queue.shift());
  });
  await Promise.all(workers);
}

/**
 * Loads every page in every configuration and runs axe-core on it.
 * Returns the violations and the pages that overflow sideways.
 */
export async function checkPages({ baseUrl, pages, browser, configs = CONFIGS, concurrency = 4 }) {
  const violations = [];
  const overflow = [];
  let checked = 0;
  for (const config of configs) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, colorScheme: config.colorScheme ?? "light" });
    await context.addInitScript((theme) => {
      try {
        if (theme === "light" || theme === "dark") localStorage.setItem("ds-theme", theme);
      } catch {
        // storage can be blocked; the page then follows the system preference
      }
    }, config.theme);
    await inPool(pages, concurrency, async (path) => {
      const page = await context.newPage();
      try {
        await page.goto(`${baseUrl}/${path}`, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(100);
        const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (extra > 1) overflow.push({ page: path, config: config.name, pixels: extra });
        const result = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        for (const v of result.violations) {
          violations.push({
            page: path,
            config: config.name,
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => ({ target: n.target.join(" "), message: (n.any[0] ?? n.all[0] ?? n.none[0])?.message ?? "" })),
          });
        }
        checked++;
      } finally {
        await page.close();
      }
    });
    await context.close();
  }
  return { violations, overflow, checked };
}

export function formatReport({ violations, overflow, checked }) {
  const lines = [];
  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.id)) byRule.set(v.id, { ...v, occurrences: [] });
    byRule.get(v.id).occurrences.push(v);
  }
  for (const rule of byRule.values()) {
    const nodes = rule.occurrences.reduce((n, o) => n + o.nodes.length, 0);
    lines.push(`✖ ${rule.id} (${rule.impact}): ${rule.help} — ${nodes} elementos en ${new Set(rule.occurrences.map((o) => o.page)).size} páginas`);
    for (const o of rule.occurrences.slice(0, 3)) lines.push(`    [${o.config}] ${o.page}  ${o.nodes[0]?.target.slice(0, 90) ?? ""}  ${o.nodes[0]?.message.slice(0, 100) ?? ""}`);
  }
  for (const o of overflow) lines.push(`✖ desbordamiento horizontal [${o.config}] ${o.page}: ${o.pixels}px`);
  lines.push(violations.length === 0 && overflow.length === 0 ? `✔ ${checked} comprobaciones sin violaciones de accesibilidad` : `${violations.length} violaciones y ${overflow.length} desbordamientos en ${checked} comprobaciones`);
  return lines.join("\n");
}
