import { svg, r2 } from "./util.mjs";

// Page templates. Transparent background; grid lines #94a3b8, frames #64748b.
// Each template is drawn from (w, h, u, k): u = stroke unit, k = metric scale.
const GRID = "#94a3b8";
const FRAME = "#64748b";

const L = (x1, y1, x2, y2, sw, stroke = GRID, extra = "") =>
  `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="${stroke}" stroke-width="${r2(sw)}"${extra}/>`;
const R = (x, y, w, h, sw, stroke = FRAME, rx = 0) =>
  `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="${r2(rx)}" fill="none" stroke="${stroke}" stroke-width="${r2(sw)}"/>`;

function gridGraph(w, h, u, k) {
  const s = 32 * k;
  let out = "";
  for (let x = s; x < w; x += s) out += L(x, 0, x, h, 1.1 * u);
  for (let y = s; y < h; y += s) out += L(0, y, w, y, 1.1 * u);
  return out;
}

function gridLine(w, h, u, k) {
  const s = 48 * k;
  let out = "";
  for (let y = 96 * k; y < h - 32 * k; y += s) out += L(48 * k, y, w - 48 * k, y, 1.2 * u);
  return out;
}

function gridDot(w, h, u, k) {
  const s = 32 * k;
  let out = "";
  for (let y = s; y < h; y += s)
    for (let x = s; x < w; x += s)
      out += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(1.6 * u)}" fill="${GRID}"/>`;
  return out;
}

const captionLines = (x, y, w, n, u, k) => {
  let out = "";
  for (let i = 0; i < n; i++) out += L(x, y + i * 26 * k, x + w, y + i * 26 * k, 1.2 * u);
  return out;
};

function storyboard(w, h, u, k, cols, rows) {
  const m = 64 * k;
  const gx = 48 * k;
  const capH = 2 * 26 * k + 24 * k;
  const cw = (w - 2 * m - (cols - 1) * gx) / cols;
  const ch = (h - 2 * m - rows * capH - (rows - 1) * 32 * k) / rows;
  let out = "";
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = m + c * (cw + gx);
      const y = m + r * (ch + capH + 32 * k);
      out += R(x, y, cw, ch, 2.2 * u);
      out += captionLines(x, y + ch + 30 * k, cw, 2, u, k);
    }
  return out;
}

const storyboard1x1 = (w, h, u, k) => {
  const m = 72 * k;
  const fh = h * 0.6;
  return (
    R(m, m, w - 2 * m, fh, 2.4 * u) +
    captionLines(m, m + fh + 44 * k, w - 2 * m, 4, u, k * 1.5)
  );
};

// Comic layouts: arrays of [x, y, w, h] in a 12x12 unit grid.
const COMIC = {
  1: [[0, 0, 12, 12]],
  2: [
    [0, 0, 12, 6],
    [0, 6, 12, 6],
  ],
  3: [
    [0, 0, 12, 7],
    [0, 7, 6, 5],
    [6, 7, 6, 5],
  ],
  4: [
    [0, 0, 6, 6],
    [6, 0, 6, 6],
    [0, 6, 6, 6],
    [6, 6, 6, 6],
  ],
  5: [
    [0, 0, 6, 6],
    [6, 0, 6, 6],
    [0, 6, 4, 6],
    [4, 6, 4, 6],
    [8, 6, 4, 6],
  ],
  6: [
    [0, 0, 6, 4],
    [6, 0, 6, 4],
    [0, 4, 6, 4],
    [6, 4, 6, 4],
    [0, 8, 6, 4],
    [6, 8, 6, 4],
  ],
};

function comic(w, h, u, k, n) {
  const m = 56 * k;
  const g = 28 * k;
  const uw = (w - 2 * m - 11 * 0) / 12;
  const uh = (h - 2 * m) / 12;
  let out = "";
  for (const [cx, cy, cw, ch] of COMIC[n]) {
    const x = m + cx * uw + (cx ? g / 2 : 0);
    const y = m + cy * uh + (cy ? g / 2 : 0);
    const ww = cw * uw - (cx ? g / 2 : 0) - (cx + cw < 12 ? g / 2 : 0);
    const hh = ch * uh - (cy ? g / 2 : 0) - (cy + ch < 12 ? g / 2 : 0);
    out += R(x, y, ww, hh, 3.4 * u);
  }
  return out;
}

function writingLined(w, h, u, k) {
  let out = "";
  for (let y = 140 * k; y < h - 48 * k; y += 56 * k)
    out += L(64 * k, y, w - 64 * k, y, 1.3 * u);
  return out;
}

function writingChecklist(w, h, u, k) {
  let out = "";
  const box = 26 * k;
  for (let y = 140 * k; y < h - 48 * k; y += 68 * k) {
    out += R(64 * k, y - box, box, box, 1.6 * u, GRID, 5 * k);
    out += L(64 * k + box + 28 * k, y, w - 64 * k, y, 1.3 * u);
  }
  return out;
}

function writingNotecard(w, h, u, k) {
  const cw = w * 0.74;
  const ch = h * 0.52;
  const x = (w - cw) / 2;
  const y = (h - ch) / 2;
  let out = R(x, y, cw, ch, 2.2 * u, FRAME, 14 * k);
  out += L(x + 32 * k, y + 72 * k, x + cw - 32 * k, y + 72 * k, 2 * u, FRAME);
  for (let yy = y + 128 * k; yy < y + ch - 32 * k; yy += 52 * k)
    out += L(x + 32 * k, yy, x + cw - 32 * k, yy, 1.2 * u);
  return out;
}

function writingPenmanship(w, h, u, k) {
  let out = "";
  const rowH = 88 * k;
  const gap = 64 * k;
  for (let y = 140 * k; y + rowH < h - 48 * k; y += rowH + gap) {
    out += L(64 * k, y, w - 64 * k, y, 1.3 * u);
    out += L(64 * k, y + rowH / 2, w - 64 * k, y + rowH / 2, 1.1 * u, GRID, ` stroke-dasharray="${r2(10 * k)} ${r2(8 * k)}"`);
    out += L(64 * k, y + rowH, w - 64 * k, y + rowH, 1.8 * u, FRAME);
  }
  return out;
}

function isometric(w, h, u, k) {
  const m = Math.tan(Math.PI / 6);
  const s = 56 * k;
  let out = "";
  for (let y0 = -w * m; y0 < h + w * m; y0 += s) {
    out += L(0, y0, w, y0 + w * m, 1.1 * u);
    out += L(0, y0, w, y0 - w * m, 1.1 * u);
  }
  return out;
}

function oblique(w, h, u, k) {
  const s = 64 * k;
  let out = "";
  for (let x = s; x < w; x += s) out += L(x, 0, x, h, 1 * u);
  for (let y = s; y < h; y += s) out += L(0, y, w, y, 1 * u);
  for (let y0 = s; y0 < h + w; y0 += s * 2) out += L(0, y0, Math.min(y0, w), Math.max(0, y0 - w), 1.1 * u, FRAME);
  return out;
}

function fan(cx, cy, w, h, u, count) {
  const len = Math.hypot(w, h) * 1.2;
  let out = "";
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    out += L(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len, 1 * u);
  }
  return out;
}

function onePoint(w, h, u, k) {
  return fan(w / 2, h / 2, w, h, u, 24) + L(0, h / 2, w, h / 2, 2 * u, FRAME);
}

function twoPoints(w, h, u, k) {
  const y = h * 0.46;
  let out = L(0, y, w, y, 2 * u, FRAME);
  const len = Math.hypot(w, h) * 1.3;
  for (const [cx, dir] of [
    [w * 0.02, 1],
    [w * 0.98, -1],
  ])
    for (let i = -6; i <= 6; i++) {
      const a = (i * Math.PI) / 14;
      out += L(cx, y, cx + dir * Math.cos(a) * len, y + Math.sin(a) * len, 1 * u);
    }
  return out;
}

function plannerWeek(w, h, u, k) {
  const m = 56 * k;
  const head = 110 * k;
  let out = R(m, m, w - 2 * m, h - 2 * m, 2.2 * u);
  out += L(m, m + head, w - m, m + head, 2 * u, FRAME);
  const cw = (w - 2 * m) / 7;
  for (let i = 1; i < 7; i++) out += L(m + i * cw, m, m + i * cw, h - m, 1.2 * u);
  for (let i = 0; i < 7; i++)
    out += L(m + i * cw + cw * 0.22, m + head * 0.62, m + (i + 1) * cw - cw * 0.22, m + head * 0.62, 2 * u, FRAME);
  return out;
}

function plannerMonth(w, h, u, k) {
  const m = 56 * k;
  const head = 84 * k;
  let out = R(m, m, w - 2 * m, h - 2 * m, 2.2 * u);
  out += L(m, m + head, w - m, m + head, 2 * u, FRAME);
  const cw = (w - 2 * m) / 7;
  const rh = (h - 2 * m - head) / 5;
  for (let i = 1; i < 7; i++) out += L(m + i * cw, m, m + i * cw, h - m, 1.2 * u);
  for (let i = 1; i < 5; i++)
    out += L(m, m + head + i * rh, w - m, m + head + i * rh, 1.2 * u);
  return out;
}

function plannerTimeline(w, h, u, k) {
  const x = w / 2;
  let out = L(x, 64 * k, x, h - 64 * k, 2.2 * u, FRAME);
  for (let y = 120 * k; y < h - 72 * k; y += 96 * k) {
    out += `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(5 * k + u)}" fill="none" stroke="${FRAME}" stroke-width="${r2(1.6 * u)}"/>`;
    out += L(x + 24 * k, y, w - 72 * k, y, 1.1 * u);
    out += L(72 * k, y, x - 24 * k, y, 1.1 * u);
  }
  return out;
}

function devicePhone(w, h, u, k) {
  const ph = Math.min(h * 0.72, w * 1.4);
  const pw = ph * 0.48;
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  return (
    R(x, y, pw, ph, 2.4 * u, FRAME, 40 * k) +
    L(x + pw * 0.36, y + 26 * k, x + pw * 0.64, y + 26 * k, 2.4 * u, FRAME) +
    L(x + pw * 0.38, y + ph - 20 * k, x + pw * 0.62, y + ph - 20 * k, 2.4 * u, FRAME)
  );
}

function deviceTablet(w, h, u, k) {
  const pw = w * 0.66;
  const ph = h * 0.76;
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  return (
    R(x, y, pw, ph, 2.4 * u, FRAME, 28 * k) +
    `<circle cx="${r2(w / 2)}" cy="${r2(y + 22 * k)}" r="${r2(4 * k + u)}" fill="${FRAME}"/>`
  );
}

function deviceWindow(w, h, u, k) {
  const pw = w * 0.84;
  const ph = h * 0.68;
  const x = (w - pw) / 2;
  const y = (h - ph) / 2;
  const bar = 54 * k;
  let dots = "";
  for (let i = 0; i < 3; i++)
    dots += `<circle cx="${r2(x + 28 * k + i * 26 * k)}" cy="${r2(y + bar / 2)}" r="${r2(5 * k + u * 0.6)}" fill="none" stroke="${FRAME}" stroke-width="${r2(1.4 * u)}"/>`;
  return (
    R(x, y, pw, ph, 2.4 * u, FRAME, 14 * k) +
    L(x, y + bar, x + pw, y + bar, 2 * u, FRAME) +
    dots +
    R(x + 110 * k, y + bar * 0.28, pw - 150 * k, bar * 0.44, 1.4 * u, GRID, 8 * k)
  );
}

export const TEMPLATES = {
  "grid-graph": gridGraph,
  "grid-line": gridLine,
  "grid-dot": gridDot,
  "storyboard-1x1": storyboard1x1,
  "storyboard-2x2": (w, h, u, k) => storyboard(w, h, u, k, 2, 2),
  "storyboard-3x2": (w, h, u, k) => (w > h ? storyboard(w, h, u, k, 3, 2) : storyboard(w, h, u, k, 2, 3)),
  "comic-1-panel": (w, h, u, k) => comic(w, h, u, k, 1),
  "comic-2-panels": (w, h, u, k) => comic(w, h, u, k, 2),
  "comic-3-panels": (w, h, u, k) => comic(w, h, u, k, 3),
  "comic-4-panels": (w, h, u, k) => comic(w, h, u, k, 4),
  "comic-5-panels": (w, h, u, k) => comic(w, h, u, k, 5),
  "comic-6-panels": (w, h, u, k) => comic(w, h, u, k, 6),
  "writing-lined": writingLined,
  "writing-checklist": writingChecklist,
  "writing-notecard": writingNotecard,
  "writing-penmanship": writingPenmanship,
  "perspective-isometric": isometric,
  "perspective-oblique": oblique,
  "perspective-1-point": onePoint,
  "perspective-2-points": twoPoints,
  "planner-week": plannerWeek,
  "planner-month": plannerMonth,
  "planner-timeline": plannerTimeline,
  "device-phone": devicePhone,
  "device-tablet": deviceTablet,
  "device-window": deviceWindow,
};

const VARIANTS = {
  portrait: { w: 1032, h: 1376, u: 2, k: 1 },
  landscape: { w: 1376, h: 1032, u: 2, k: 1 },
  thumbnails: { w: 210, h: 280, u: 1, k: 210 / 1032 },
};

export function buildTemplates(emit) {
  for (const [variant, { w, h, u, k }] of Object.entries(VARIANTS))
    for (const [name, draw] of Object.entries(TEMPLATES))
      emit(
        `journal-templates-${variant}-${name}.svg`,
        svg(`0 0 ${w} ${h}`, draw(w, h, u, k)),
      );
}
