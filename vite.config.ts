import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlinePlugin } from "./tools/offline-plugin.ts";

const buildId = new Date()
  .toISOString()
  .slice(0, 16)
  .replace("T", " ")
  .replace(/-/g, "/");

export default defineConfig({
  base: process.env.BASE_PATH || "/",
  plugins: [
    react(),
    {
      name: "paper-build-stamp",
      transformIndexHtml: (html) =>
        html.replace(
          "</head>",
          `  <meta name="paper-build" content="${buildId}"/>\n</head>`,
        ),
    },
    offlinePlugin(),
  ],
  resolve: { preserveSymlinks: true },
  server: { port: 5173, host: "0.0.0.0" },
  build: { target: "es2022" },
});
