import { svg } from "./util.mjs";

// All UI glyphs: 24x24, opaque #111 strokes/fills (shell CSS re-tints via
// brightness/invert filters, so the base must be opaque).
// Friendly-chunky pass: 2.4 strokes, rounded corners (arc joins instead of
// hard angles), slightly plumper shapes pulled toward the viewBox center.
const S = `fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
const F = `fill="#111"`;

const gear = () => {
  let teeth = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = 12 + Math.cos(a) * 7;
    const y1 = 12 + Math.sin(a) * 7;
    const x2 = 12 + Math.cos(a) * 9.8;
    const y2 = 12 + Math.sin(a) * 9.8;
    teeth += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#111" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `${teeth}<circle cx="12" cy="12" r="6" ${S}/><circle cx="12" cy="12" r="2.4" ${F}/>`;
};

// Shared rounded tray (import/share): soft bottom corners instead of a hard box.
const tray = `<path d="M7.5 9.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7.5a2 2 0 0 0-2-2h-.5" ${S}/>`;

export const icons = {
  "shell-journal-mode-on": `<path d="M12 5.4C9.5 3.9 6.4 3.8 4.2 4.8v13c2.2-.9 5.3-.8 7.8.6 2.5-1.4 5.6-1.5 7.8-.6v-13c-2.2-1-5.3-.9-7.8.6Z" ${S}/><path d="M12 5.4v13" ${S}/>`,
  "shell-grid-mode-on": [4, 13]
    .flatMap((x) => [4, 13].map((y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="2.4" ${F}/>`))
    .join(""),
  "shell-journal-search": `<circle cx="10.5" cy="10.5" r="6.2" ${S}/><path d="M15.3 15.3l4.4 4.4" stroke="#111" stroke-width="2.8" stroke-linecap="round"/>`,
  "shell-settings": gear(),
  "shell-import-journal": `${tray}<path d="M12 3.2v10.8M8.2 10.4l3.8 3.6 3.8-3.6" ${S}/>`,

  "shell-control-strip-duplicate": `<rect x="8.6" y="8.6" width="11.4" height="11.4" rx="3" ${S}/><path d="M4.4 15.2V6.6a2.2 2.2 0 0 1 2.2-2.2h8.6" ${S}/>`,
  "shell-control-strip-share": `${tray}<path d="M12 14.2V3M8.2 6.6 12 3l3.8 3.6" ${S}/>`,
  "shell-control-strip-move": `<path d="M5.4 6.5h3.5l1.8 2h8a1.9 1.9 0 0 1 1.9 1.9v6.2a1.9 1.9 0 0 1-1.9 1.9H5.4a1.9 1.9 0 0 1-1.9-1.9V8.4a1.9 1.9 0 0 1 1.9-1.9Z" ${S}/><path d="M9.2 13.5h6.4M13 10.9l2.8 2.6-2.8 2.6" ${S}/>`,
  "shell-control-strip-rotate": `<path d="M19.6 13.4A7.8 7.8 0 1 1 17.5 7.2" ${S}/><path d="M17.9 3v4.4h-4.4" ${S}/>`,
  "shell-control-strip-delete": `<path d="M4.5 7h15M9.5 7V5.2a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3V7" ${S}/><path d="M6.2 7l.8 11.9A2.2 2.2 0 0 0 9.2 21h5.6a2.2 2.2 0 0 0 2.2-2.1L17.8 7" ${S}/><path d="M10 11v6M14 11v6" ${S}/>`,
  "shell-control-strip-add-journal": `<path d="M12 5v14M5 12h14" stroke="#111" stroke-width="2.8" stroke-linecap="round"/>`,
  "shell-control-strip-more-menu": [5, 12, 19]
    .map((x) => `<circle cx="${x}" cy="12" r="2.2" ${F}/>`)
    .join(""),
  "shell-control-strip-multiselect-mode": `<rect x="3" y="3" width="10" height="10" rx="3" ${S}/><path d="M6 8l1.8 1.8L11 6.5" ${S}/><rect x="11" y="11" width="10" height="10" rx="3" ${S}/><path d="M14 16l1.8 1.8 3.2-3.3" ${S}/>`,
  "shell-control-strip-exit-mode": `<circle cx="12" cy="12" r="8.8" ${S}/><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4" ${S}/>`,
  "shell-control-strip-text-note": `<rect x="4.5" y="3" width="15" height="18" rx="3" ${S}/><path d="M8.5 8h7M8.5 12h7M8.5 16h4" ${S}/>`,

  "canvas-shell-close": `<path d="M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" stroke="#111" stroke-width="2.8" stroke-linecap="round"/>`,
  "canvas-shell-undo": `<path d="M5.2 10h8.8a4.9 4.9 0 1 1 0 9.8H10" ${S}/><path d="M9.2 5.9 4.8 10l4.4 4.1" ${S}/>`,
  "canvas-shell-redo": `<path d="M18.8 10H10a4.9 4.9 0 1 0 0 9.8h3.8" ${S}/><path d="M14.8 5.9 19.2 10l-4.4 4.1" ${S}/>`,
  "canvas-shell-show-tool-tray": `<path d="M6.2 13.4 12 7.6l5.8 5.8" ${S}/><path d="M5.2 19h13.6" ${S}/>`,
  "canvas-shell-rewind-gesture-undo": `<path d="M6.9 8.7a7.1 7.1 0 1 1-1 5.6" ${S}/><path d="M6.7 3.8v4.9h4.9" ${S}/><path d="M13 9.5v3.9l2.7 1.8" ${S}/>`,
  "canvas-shell-transcribe": `<rect x="3" y="4" width="9.4" height="15.4" rx="2.4" ${S}/><path d="M5.8 8.2h3.8M5.8 11.2h3.8M5.8 14.2h2.4" stroke="#111" stroke-width="1.8" stroke-linecap="round"/><path d="M15.5 18.4 18 11.2l2.5 7.2M16.4 16.2h3.2" ${S}/>`,

  "canvas-tray-add-palette": `<circle cx="12" cy="12" r="8.8" ${S}/><path d="M12 7.8v8.4M7.8 12h8.4" ${S}/>`,
  "canvas-tray-delete-palette": `<circle cx="12" cy="12" r="8.8" ${S}/><path d="M7.8 12h8.4" ${S}/>`,
  "canvas-tray-add-clip": `<path d="M8.9 3h6.2A1.9 1.9 0 0 1 17 4.9V21l-5-4.1L7 21V4.9A1.9 1.9 0 0 1 8.9 3Z" ${S}/>`,
  "canvas-tray-collage-photos": `<path d="M8.5 9V6.2A2.2 2.2 0 0 1 10.7 4h8.1A2.2 2.2 0 0 1 21 6.2v8.3" ${S}/><rect x="3" y="9" width="13" height="11" rx="2.6" ${S}/><circle cx="7" cy="12.6" r="1.2" ${F}/><path d="M4.8 17.9l3.1-2.9 2.4 2.1 2.6-2.6 2.4 3.4" ${S}/>`,

  "journal-customization": `<path d="M5.6 18.4 15.6 8.4l2 2-10 10-3.2 1.2Z" ${S}/><path d="M15.6 8.4l1.5-1.5a1.5 1.5 0 0 1 2.1 0 1.5 1.5 0 0 1 0 2.1l-1.5 1.5" ${S}/><path d="M7 3.4c2.5.4 3.9 1.7 4.5 3.3L9 9.1C7.5 8.5 6.2 7.1 5.8 4.6Z" ${F}/>`,
  "journal-customization-change-cover": `<rect x="5" y="3" width="14" height="18" rx="3" ${S}/><path d="M8.8 3.4v17.2" ${S}/>`,
  "journal-customization-change-cover-band": `<rect x="4.5" y="3" width="15" height="18" rx="3" ${S}/><rect x="13.5" y="3" width="3.4" height="18" rx="1.5" ${F}/>`,
  "journal-customization-change-page-template": `<rect x="5" y="3" width="14" height="18" rx="2.6" ${S}/><path d="M5 9h14M5 15h14M12 3v18" stroke="#111" stroke-width="1.7"/>`,
};

export function buildIcons(emit) {
  for (const [name, body] of Object.entries(icons))
    emit(`${name}.svg`, svg("0 0 24 24", body));
}
