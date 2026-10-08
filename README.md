# Tinta — Sketch & Journal

A free, open-source drawing and journaling app for the web. Draw, paint, and
collect your ideas in beautiful journals — on any device, no account needed.

**Live app:** https://hasyaapp.github.io/tinta/

## Features

- **Seven brushes** — fountain pen, pencil, marker, felt pen, watercolor,
  blend, and eraser — rendered by a WebGL2 ink engine with pressure support
  for stylus input.
- **Smart tools** — diagram shape snapping, lasso cut with reusable clips,
  flood fill, photo collage, and 26 page templates (grids, storyboards,
  comics, planners, perspective guides, device mockups).
- **Journals** — a 3D bookshelf, page-turn animations, customizable covers
  and band colors, PIN-locked journals, search, butterfly and grid page
  views, multi-select page management.
- **Rewind** — two-finger undo gesture and a rewind dial that scrubs through
  the full drawing history of a page.
- **Color mixer** — stir-to-mix color well, palettes, eyedropper,
  drag-and-drop color.
- **Convert to text** — offline handwriting OCR (Tesseract, runs locally).
- **Export** — PNG per page, PDF per journal, full-library JSON backup and
  restore.
- **Offline-first PWA** — installable, fully functional without a network.
  All data stays in your browser (IndexedDB); nothing is uploaded anywhere.

## Development

```sh
npm install
node tools/gen-art.mjs   # generate icons, covers, templates, brush textures
npm run dev
```

- `npm run build` — production build (set `BASE_PATH` for subpath hosting)
- `npm test` — unit tests (Vitest)
- `npm run test:e2e` / `test:webkit` — Playwright end-to-end suites
- `npm run test:offline` — offline/PWA cache test against a production build

All artwork (icons, covers, templates, brush textures, app icon) is generated
procedurally by `tools/gen-art.mjs` and is original to this project. Fonts are
Inter and Fraunces via Fontsource (OFL).

## Privacy

Tinta has no backend, no analytics, no accounts. Journals live in your
browser's local storage. Use **Export backup** to move your library between
devices.

## License

[MIT](LICENSE)
