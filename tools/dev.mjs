import { createHash } from "node:crypto";
import { existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import "./copy-ocr-assets.mjs";
const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Vite rejects colons in served paths. A stable local alias also avoids PATH
// splitting for this workspace's name; file serving restrictions stay enabled.
const root = project.includes(":")
  ? join(
      tmpdir(),
      "paper-web-" +
        createHash("sha256").update(project).digest("hex").slice(0, 10),
    )
  : project;
if (root !== project && !existsSync(root)) symlinkSync(project, root, "dir");
const child = spawn(
  process.execPath,
  [
    "--preserve-symlinks",
    "--preserve-symlinks-main",
    join(root, "node_modules/vite/bin/vite.js"),
    root,
    "--host",
    "0.0.0.0",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", cwd: root },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
