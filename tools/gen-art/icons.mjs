import { svg } from "./util.mjs";

// All UI glyphs: 24x24, opaque #111 strokes/fills (shell CSS re-tints via
// brightness/invert filters, so the base must be opaque).
const S = `fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
const F = `fill="#111"`;

const gear = () => {
  let teeth = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x1 = 12 + Math.cos(a) * 7.2;
    const y1 = 12 + Math.sin(a) * 7.2;
    const x2 = 12 + Math.cos(a) * 10;
    const y2 = 12 + Math.sin(a) * 10;
    teeth += `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>`;
  }
  return `${teeth}<circle cx="12" cy="12" r="6.2" ${S}/><circle cx="12" cy="12" r="2.2" ${F}/>`;
};

export const icons = {
  "shell-journal-mode-on": `<path d="M12 5.2C9.4 3.8 6.3 3.7 4 4.7V18c2.3-1 5.4-.9 8 .5 2.6-1.4 5.7-1.5 8-.5V4.7c-2.3-1-5.4-.9-8 .5Z" ${S}/><path d="M12 5.2v13.3" ${S}/>`,
  "shell-grid-mode-on": [4, 13]
    .flatMap((x) => [4, 13].map((y) => `<rect x="${x}" y="${y}" width="7" height="7" rx="1.6" ${F}/>`))
    .join(""),
  "shell-journal-search": `<circle cx="10.3" cy="10.3" r="6.3" ${S}/><path d="M15 15l5 5" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>`,
  "shell-settings": gear(),

  "shell-control-strip-duplicate": `<rect x="9" y="9" width="11" height="11" rx="2" ${S}/><path d="M4.5 15V6.5a2 2 0 0 1 2-2H15" ${S}/>`,
  "shell-control-strip-share": `<path d="M7.5 9.5H5V21h14V9.5h-2.5" ${S}/><path d="M12 14.5V3M8 6.6 12 2.8l4 3.8" ${S}/>`,
  "shell-control-strip-move": `<path d="M3.5 18.5v-12h5.6l1.8 2H20.5v10Z" ${S}/><path d="M9 13.5h7M13.3 10.8l2.7 2.7-2.7 2.7" ${S}/>`,
  "shell-control-strip-rotate": `<path d="M19.8 13.5A8 8 0 1 1 17.6 7" ${S}/><path d="M18 2.6v4.6h-4.6" ${S}/>`,
  "shell-control-strip-delete": `<path d="M4 7h16M9.3 7V4.8h5.4V7" ${S}/><path d="M6 7l1 14h10l1-14" ${S}/><path d="M10 11v6M14 11v6" ${S}/>`,
  "shell-control-strip-add-journal": `<path d="M12 4.5v15M4.5 12h15" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>`,
  "shell-control-strip-more-menu": [5, 12, 19]
    .map((x) => `<circle cx="${x}" cy="12" r="2" ${F}/>`)
    .join(""),
  "shell-control-strip-multiselect-mode": `<rect x="3" y="3" width="10" height="10" rx="2" ${S}/><path d="M6 8l1.8 1.8L11 6.5" ${S}/><rect x="11" y="11" width="10" height="10" rx="2" ${S}/><path d="M14 16l1.8 1.8 3.2-3.3" ${S}/>`,
  "shell-control-strip-exit-mode": `<circle cx="12" cy="12" r="9" ${S}/><path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" ${S}/>`,
  "shell-control-strip-text-note": `<rect x="4.5" y="3" width="15" height="18" rx="2" ${S}/><path d="M8.5 8h7M8.5 12h7M8.5 16h4" ${S}/>`,

  "canvas-shell-close": `<path d="M5 5l14 14M19 5 5 19" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>`,
  "canvas-shell-undo": `<path d="M5 10h9.2a4.8 4.8 0 1 1 0 9.6H10" ${S}/><path d="M9 5.8 4.6 10 9 14.2" ${S}/>`,
  "canvas-shell-redo": `<path d="M19 10H9.8a4.8 4.8 0 1 0 0 9.6H14" ${S}/><path d="M15 5.8 19.4 10 15 14.2" ${S}/>`,
  "canvas-shell-show-tool-tray": `<path d="M6 13.5 12 7.5l6 6" ${S}/><path d="M5 19h14" ${S}/>`,
  "canvas-shell-rewind-gesture-undo": `<path d="M6.8 8.6a7.2 7.2 0 1 1-1 5.7" ${S}/><path d="M6.6 3.6v5h5" ${S}/><path d="M13 9.4v4l2.8 1.8" ${S}/>`,
  "canvas-shell-transcribe": `<rect x="3" y="4" width="9" height="15" rx="1.5" ${S}/><path d="M5.5 8h4M5.5 11h4M5.5 14h2.5" stroke="#111" stroke-width="1.6" stroke-linecap="round"/><path d="M15.4 18.5 18 11l2.6 7.5M16.3 16.2h3.4" ${S}/>`,

  "canvas-tray-add-palette": `<circle cx="12" cy="12" r="9" ${S}/><path d="M12 7.6v8.8M7.6 12h8.8" ${S}/>`,
  "canvas-tray-delete-palette": `<circle cx="12" cy="12" r="9" ${S}/><path d="M7.6 12h8.8" ${S}/>`,
  "canvas-tray-add-clip": `<path d="M7 3h10v18l-5-4.2L7 21Z" ${S}/>`,
  "canvas-tray-collage-photos": `<path d="M8.5 9V6a2 2 0 0 1 2-2H19a2 2 0 0 1 2 2v8.5" ${S}/><rect x="3" y="9" width="13" height="11" rx="2" ${S}/><circle cx="7" cy="12.6" r="1.1" ${F}/><path d="M4.5 18.2l3.4-3.2 2.4 2.1 2.6-2.6 2.6 3.7" ${S}/>`,

  "journal-customization": `<path d="M5.4 18.6 15.6 8.4l2 2L7.4 20.6l-3.2 1.2Z" ${S}/><path d="M15.6 8.4l1.6-1.6a1.4 1.4 0 0 1 2 0 1.4 1.4 0 0 1 0 2l-1.6 1.6" ${S}/><path d="M7 3.2c2.6.4 4 1.8 4.6 3.4L9 9.2C7.4 8.6 6 7.2 5.6 4.6Z" ${F}/>`,
  "journal-customization-change-cover": `<rect x="5" y="3" width="14" height="18" rx="2" ${S}/><path d="M8.6 3v18" ${S}/>`,
  "journal-customization-change-cover-band": `<rect x="4.5" y="3" width="15" height="18" rx="2" ${S}/><rect x="13.5" y="3" width="3.4" height="18" ${F}/>`,
  "journal-customization-change-page-template": `<rect x="5" y="3" width="14" height="18" rx="1.6" ${S}/><path d="M5 9h14M5 15h14M12 3v18" stroke="#111" stroke-width="1.6"/>`,
};

export function buildIcons(emit) {
  for (const [name, body] of Object.entries(icons))
    emit(`${name}.svg`, svg("0 0 24 24", body));
}
