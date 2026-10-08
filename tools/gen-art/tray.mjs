import { svg } from "./util.mjs";

// Vertical tool illustrations, tip pointing UP (the tray clips the bottom).
// viewBox 0 0 64 176; flat, original silhouettes.
const CX = 32;
const ACCENT = "#ed5340";

const poly = (pts, fill) =>
  `<polygon points="${pts.map(([x, y]) => `${x},${y}`).join(" ")}" fill="${fill}"/>`;
const rect = (x, y, w, h, fill, rx = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;

// Symmetric taper around CX: from width w1 at y1 to width w2 at y2.
const taper = (y1, w1, y2, w2, fill) =>
  poly(
    [
      [CX - w1 / 2, y1],
      [CX + w1 / 2, y1],
      [CX + w2 / 2, y2],
      [CX - w2 / 2, y2],
    ],
    fill,
  );

// tip widths per size for the eight sized tools
const TIP = { sm: 0, md: 1, lg: 2 };

const sized = {
  erase(i) {
    const w = [26, 34, 42][i];
    const x = CX - w / 2;
    return {
      body:
        rect(x, 22, w, 154, "#f4f2ea", 7) +
        rect(x, 74, w, 102, "#8e959d", 7) +
        rect(x, 74, w, 10, "#767d85") +
        `<line x1="${x + 5}" y1="30" x2="${x + 5}" y2="66" stroke="#dcd8c9" stroke-width="3" stroke-linecap="round"/>`,
      bandY: 122,
      bandX: x,
      bandW: w,
    };
  },
  blend(i) {
    const tip = [4, 8, 12][i];
    return {
      body:
        rect(CX - 11, 50, 22, 126, "#d9c39c", 5) +
        taper(50, 22, 16, tip, "#cbb189") +
        taper(22, tip + 4, 14, tip, "#b89a72") +
        rect(CX - 11, 96, 22, 6, "#c4ab83"),
      bandY: 120,
      bandX: CX - 11,
      bandW: 22,
    };
  },
  draw(i) {
    const nib = [2.5, 5.5, 8.5][i];
    return {
      body:
        rect(CX - 9, 52, 18, 124, "#2c313a", 6) +
        taper(52, 18, 28, 11, "#3a414c") +
        taper(28, 11, 8, nib, "#d8a33c") +
        `<line x1="${CX}" y1="14" x2="${CX}" y2="26" stroke="#9c6f1e" stroke-width="1.6"/>` +
        rect(CX - 9, 64, 18, 5, "#454d59"),
      bandY: 118,
      bandX: CX - 9,
      bandW: 18,
    };
  },
  sketch(i) {
    const tip = [3, 6, 9][i];
    return {
      body:
        rect(CX - 9, 58, 18, 118, "#e8a33d", 3) +
        rect(CX - 3, 58, 6, 118, "#f2b85c") +
        taper(58, 18, 28, tip + 2, "#ecd3a8") +
        taper(28, tip + 2, 10, tip * 0.4, "#4b4b4b"),
      bandY: 118,
      bandX: CX - 9,
      bandW: 18,
    };
  },
  marker(i) {
    const tw = [8, 12, 16][i];
    return {
      body:
        rect(CX - 15, 60, 30, 116, "#4e5a68", 9) +
        taper(60, 30, 38, 18, "#414c58") +
        rect(CX - 9, 30, 18, 10, "#39424c", 3) +
        poly(
          [
            [CX - tw / 2, 16],
            [CX + tw / 2, 23],
            [CX + tw / 2, 32],
            [CX - tw / 2, 32],
          ],
          "#2d343c",
        ),
      bandY: 122,
      bandX: CX - 15,
      bandW: 30,
    };
  },
  write(i) {
    const tip = [2, 4, 6][i];
    return {
      body:
        rect(CX - 6, 48, 12, 128, "#3b4453", 5) +
        taper(48, 12, 22, tip + 2, "#4a5465") +
        taper(22, tip + 2, 10, tip, "#22272e") +
        rect(CX - 6, 58, 12, 4, "#4e586a"),
      bandY: 116,
      bandX: CX - 6,
      bandW: 12,
    };
  },
  color(i) {
    const tip = [2, 5, 8][i];
    return {
      body:
        rect(CX - 7, 86, 14, 90, "#c98f56", 5) +
        rect(CX - 7.5, 60, 15, 28, "#c3cad2", 2) +
        rect(CX - 7.5, 70, 15, 3, "#9aa3ad") +
        poly(
          [
            [CX - 8, 62],
            [CX + 8, 62],
            [CX + tip / 2, 24],
            [CX + tip / 2 - 1, 16],
            [CX - tip / 2 - 1, 24],
          ],
          "#43322b",
        ) +
        `<line x1="${CX - 2}" y1="56" x2="${CX - 3.5}" y2="30" stroke="#5f4a3f" stroke-width="1.6"/>`,
      bandY: 124,
      bandX: CX - 7,
      bandW: 14,
    };
  },
  diagram(i) {
    const tip = [2.5, 4.5, 6.5][i];
    const ticks = [66, 78, 90, 102]
      .map(
        (y, k) =>
          `<line x1="${CX - 8}" y1="${y}" x2="${CX - 8 + (k % 2 ? 6 : 9)}" y2="${y}" stroke="#aebdd0" stroke-width="1.8"/>`,
      )
      .join("");
    return {
      body:
        rect(CX - 8, 48, 16, 128, "#32455c", 5) +
        taper(48, 16, 36, tip + 3, "#3d5370") +
        rect(CX - tip / 2, 12, tip, 24, "#8f99a4") +
        ticks,
      bandY: 118,
      bandX: CX - 8,
      bandW: 16,
    };
  },
};

const unsized = {
  cut() {
    const blade = (s) =>
      poly(
        [
          [CX, 96],
          [CX + s * 13, 20],
          [CX + s * 20, 26],
          [CX + s * 4, 100],
        ],
        s < 0 ? "#aeb6bf" : "#c4ccd4",
      );
    const ring = (x) =>
      `<ellipse cx="${x}" cy="130" rx="9" ry="17" fill="none" stroke="#4e5a68" stroke-width="6"/>`;
    return {
      body:
        blade(-1) +
        blade(1) +
        ring(21) +
        ring(43) +
        `<circle cx="${CX}" cy="97" r="4.5" fill="#5b636d"/>`,
      bandY: 108,
      bandX: 14,
      bandW: 36,
    };
  },
  fill() {
    return {
      body:
        poly(
          [
            [10, 46],
            [54, 46],
            [47, 128],
            [17, 128],
          ],
          "#6b7686",
        ) +
        `<path d="M8 50 A24 20 0 0 1 56 50" fill="none" stroke="#4e5a68" stroke-width="4"/>` +
        `<ellipse cx="32" cy="46" rx="22" ry="7.5" fill="#525c6a"/>` +
        `<ellipse cx="32" cy="46" rx="17" ry="5.5" fill="#3e8ed0"/>` +
        `<path d="M52 52c3 7 1 12-2 12s-5-5-2-12Z" fill="#3e8ed0"/>`,
      bandY: 86,
      bandX: 14,
      bandW: 36,
    };
  },
  collage() {
    const photo = (rot, x, y, w, h, img, detail) =>
      `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">` +
      rect(x, y, w, h, "#f7f4ec", 2) +
      rect(x + 4, y + 4, w - 8, h - 14, img) +
      detail +
      `</g>`;
    return {
      body:
        photo(
          -7,
          8,
          16,
          40,
          48,
          "#88b8d8",
          poly(
            [
              [14, 48],
              [26, 32],
              [38, 48],
            ],
            "#5e8aa8",
          ),
        ) +
        photo(
          6,
          16,
          62,
          42,
          52,
          "#e0b16a",
          `<circle cx="30" cy="78" r="6" fill="#f3d9a8"/>`,
        ),
      bandY: 122,
      bandX: 16,
      bandW: 40,
    };
  },
  "canvas-roll"() {
    return {
      body:
        rect(18, 32, 28, 140, "#efe8d8") +
        rect(18, 32, 4, 140, "#ddd2ba") +
        rect(42, 32, 4, 140, "#ddd2ba") +
        `<ellipse cx="32" cy="32" rx="14" ry="7" fill="#d9cfb8"/>` +
        `<ellipse cx="32" cy="32" rx="7" ry="3.5" fill="none" stroke="#b7ab8e" stroke-width="2"/>` +
        `<circle cx="32" cy="32" r="1.6" fill="#b7ab8e"/>`,
      bandY: 118,
      bandX: 18,
      bandW: 28,
    };
  },
};

function render({ body, bandX, bandW, bandY }, selected) {
  const band = selected
    ? rect(bandX, bandY, bandW, 11, ACCENT) +
      rect(bandX, bandY + 11, bandW, 2.5, "#b93c2d")
    : "";
  const inner = body + band;
  return svg(
    "0 0 64 176",
    selected ? inner : `<g opacity="0.85">${inner}</g>`,
  );
}

export function buildTray(emit) {
  for (const [tool, make] of Object.entries(sized))
    for (const [size, i] of Object.entries(TIP))
      for (const sel of [true, false])
        emit(
          `canvas-tray-${tool}-${sel ? "selected" : "unselected"}-${size}.svg`,
          render(make(i), sel),
        );
  for (const [tool, make] of Object.entries(unsized))
    for (const sel of [true, false])
      emit(
        `canvas-tray-${tool}-${sel ? "selected" : "unselected"}.svg`,
        render(make(), sel),
      );
}
