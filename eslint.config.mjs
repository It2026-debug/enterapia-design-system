import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: { ...globals.node } },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
      "no-useless-escape": "error",
      "no-regex-spaces": "error",
    },
  },
  {
    // Functions passed to page.evaluate() run in the browser.
    files: ["scripts/lib/a11y.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["site/site.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "script", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
      eqeqeq: ["error", "always"],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  { ignores: ["dist/**", "node_modules/**", "mcp/node_modules/**"] },
];
