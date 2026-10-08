import { svg, mulberry32, r2 } from "./util.mjs";

// Journal covers, 420x560. All compositions are generative originals,
// deterministic via seeded PRNG.
const W = 420;
const H = 560;

// Warm paper-adjacent palette shared across groups.
const BASE = [
  "#c96f4a", // terracotta
  "#9caf88", // sage
  "#2e4057", // navy
  "#d4a03c", // mustard
  "#c89b9b", // dusty pink
  "#3b3b3f", // charcoal
  "#efe6d5", // cream
  "#3e7c7b", // teal
];
const INK = [
  "#7c3f28",
  "#5f7250",
  "#17222f",
  "#8a6420",
  "#8a5f5f",
  "#1d1d20",
  "#c9b998",
  "#1f4a49",
];
const PALE = [
  "#e8a985",
  "#c5d4b4",
  "#5a7496",
  "#ecc87e",
  "#e3c4c4",
  "#6e6e75",
  "#f8f3e8",
  "#7fb3b2",
];

const bg = (fill) => `<rect width="${W}" height="${H}" fill="${fill}"/>`;
const spine = `<rect width="26" height="${H}" fill="#000" opacity="0.12"/><rect x="26" width="4" height="${H}" fill="#fff" opacity="0.1"/>`;

function defaultCover(i) {
  return bg(BASE[i]) + spine;
}

function gradientCover(i) {
  const rnd = mulberry32(900 + i);
  const a = BASE[i];
  const b = PALE[(i + 3) % 8];
  const ang = Math.floor(rnd() * 4); // 4 soft directions
  const dirs = [
    [0, 0, 0, 1],
    [0, 0, 1, 1],
    [0, 1, 1, 0],
    [0, 0, 1, 0],
  ][ang];
  return (
    `<defs><linearGradient id="g" x1="${dirs[0]}" y1="${dirs[1]}" x2="${dirs[2]}" y2="${dirs[3]}">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>` +
    `</linearGradient></defs>` +
    bg("url(#g)") +
    spine
  );
}

function geometricCover(i) {
  const rnd = mulberry32(1700 + i);
  const pool = [BASE[(i + 2) % 8], PALE[(i + 5) % 8], INK[(i + 1) % 8], "#f0e7d8"];
  let shapes = "";
  const n = 6 + Math.floor(rnd() * 3);
  for (let k = 0; k < n; k++) {
    const fill = pool[Math.floor(rnd() * pool.length)];
    const x = r2(40 + rnd() * (W - 80));
    const y = r2(40 + rnd() * (H - 80));
    const s = r2(40 + rnd() * 120);
    const kind = Math.floor(rnd() * 3);
    const op = r2(0.55 + rnd() * 0.4);
    if (kind === 0)
      shapes += `<circle cx="${x}" cy="${y}" r="${r2(s / 2)}" fill="${fill}" opacity="${op}"/>`;
    else if (kind === 1)
      shapes += `<polygon points="${x},${r2(y - s / 2)} ${r2(x + s / 2)},${r2(y + s / 2)} ${r2(x - s / 2)},${r2(y + s / 2)}" fill="${fill}" opacity="${op}" transform="rotate(${Math.floor(rnd() * 360)} ${x} ${y})"/>`;
    else
      shapes += `<rect x="${r2(x - s)}" y="${r2(y - 9)}" width="${r2(s * 2)}" height="18" fill="${fill}" opacity="${op}" transform="rotate(${Math.floor(rnd() * 180)} ${x} ${y})"/>`;
  }
  return bg(BASE[i]) + shapes + spine;
}

function patternCover(i) {
  const rnd = mulberry32(2500 + i);
  const fg = PALE[(i + 4) % 8];
  let p = "";
  switch (i % 4) {
    case 0: // dots
      for (let y = 24; y < H; y += 44)
        for (let x = 24 + ((y / 44) % 2) * 22; x < W; x += 44)
          p += `<circle cx="${x}" cy="${y}" r="${r2(5 + rnd() * 3)}" fill="${fg}" opacity="0.8"/>`;
      break;
    case 1: // waves
      for (let y = 30; y < H + 20; y += 46) {
        let d = `M-10 ${y}`;
        for (let x = 0; x <= W + 40; x += 40) d += ` q 20 -16 40 0`;
        p += `<path d="${d}" fill="none" stroke="${fg}" stroke-width="6" opacity="0.8"/>`;
      }
      break;
    case 2: // crosses
      for (let y = 30; y < H; y += 52)
        for (let x = 30 + ((y / 52) % 2) * 26; x < W; x += 52) {
          const a = Math.floor(rnd() * 30 - 15);
          p += `<g transform="rotate(${a} ${x} ${y})" opacity="0.8"><path d="M${x - 9} ${y}h18M${x} ${y - 9}v18" stroke="${fg}" stroke-width="6" stroke-linecap="round"/></g>`;
        }
      break;
    default: // hexagons
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 6; col++) {
          const x = 40 + col * 72 + (row % 2) * 36;
          const y = 36 + row * 62;
          const pts = [];
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k + Math.PI / 6;
            pts.push(`${r2(x + Math.cos(a) * 26)},${r2(y + Math.sin(a) * 26)}`);
          }
          p += `<polygon points="${pts.join(" ")}" fill="none" stroke="${fg}" stroke-width="4" opacity="0.75"/>`;
        }
  }
  return bg(BASE[(i + 1) % 8]) + p + spine;
}

function studentCover(i) {
  const rnd = mulberry32(3300 + i);
  const fg = PALE[(i + 2) % 8];
  const alt = i % 8 === 6 ? INK[6] : "#f0e7d8";
  let p = "";
  const star = (x, y, s, fill, rot) => {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = (Math.PI / 5) * k - Math.PI / 2;
      const rr = k % 2 ? s * 0.42 : s;
      pts.push(`${r2(x + Math.cos(a) * rr)},${r2(y + Math.sin(a) * rr)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${fill}" opacity="0.9" transform="rotate(${rot} ${x} ${y})"/>`;
  };
  const squiggle = (x, y, fill) => {
    let d = `M${x} ${y}`;
    for (let k = 0; k < 4; k++) d += ` q 14 ${k % 2 ? 18 : -18} 28 0`;
    return `<path d="${d}" fill="none" stroke="${fill}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>`;
  };
  const zigzag = (x, y, fill) => {
    let d = `M${x} ${y}`;
    for (let k = 0; k < 4; k++) d += ` l 16 ${k % 2 ? 22 : -22}`;
    return `<path d="${d}" fill="none" stroke="${fill}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  };
  for (let k = 0; k < 14; k++) {
    const x = r2(36 + rnd() * (W - 90));
    const y = r2(36 + rnd() * (H - 90));
    const fill = rnd() < 0.5 ? fg : alt;
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) p += star(x, y, r2(14 + rnd() * 16), fill, Math.floor(rnd() * 360));
    else if (kind === 1) p += squiggle(x, y, fill);
    else p += zigzag(x, y, fill);
  }
  return bg(BASE[(i + 5) % 8]) + p + spine;
}

const GROUPS = {
  geometric: geometricCover,
  gradient: gradientCover,
  patterns: patternCover,
  student: studentCover,
  default: defaultCover,
};

export function buildCovers(emit) {
  for (const [group, make] of Object.entries(GROUPS))
    for (let i = 0; i < 8; i++)
      emit(`covers-${group}-${i + 1}.svg`, svg(`0 0 ${W} ${H}`, make(i)));
}
