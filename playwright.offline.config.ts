import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/offline",
  outputDir: "test-results/offline",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1376, height: 1032 },
    serviceWorkers: "allow",
  },
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
});
