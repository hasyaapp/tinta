import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";

// Same-origin worker, embedded WASM and language data; no CDN at runtime.
const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["tesseract.js/LICENSE.md", "LICENSE-tesseract.js"],
  ["tesseract.js-core/LICENSE", "LICENSE-tesseract.js-core"],
  [
    "@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
    "eng.traineddata.gz",
  ],
  ...["", "-simd", "-relaxedsimd"].map((feature) => [
    `tesseract.js-core/tesseract-core${feature}-lstm.wasm.js`,
    `core/tesseract-core${feature}-lstm.wasm.js`,
  ]),
];
const manifest = files.map(([source, name]) => {
  const input = `node_modules/${source}`,
    output = `public/ocr/${name}`;
  mkdirSync(dirname(output), { recursive: true });
  copyFileSync(input, output);
  const bytes = readFileSync(output);
  return {
    source,
    file: name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});
writeFileSync(
  "public/ocr/manifest.json",
  JSON.stringify(
    {
      tesseract: "7.0.0",
      core: "7.0.0",
      english_data: "1.0.0",
      language_source: "https://github.com/naptha/tessdata",
      language_license: "Apache-2.0",
      files: manifest,
    },
    null,
    2,
  ) + "\n",
);
