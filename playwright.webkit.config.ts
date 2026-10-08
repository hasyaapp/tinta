import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig(base, {
  outputDir: "test-results/webkit",
  reporter: [["list"]],
  use: { ...base.use, browserName: "webkit", deviceScaleFactor: 2 },
});
