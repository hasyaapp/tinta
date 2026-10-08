export const svg = (viewBox, body, extra = "") => {
  const [, , w, h] = viewBox.split(/\s+/);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${w}" height="${h}"${extra}>${body}</svg>\n`;
};

// Deterministic PRNG (mulberry32).
export const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const r2 = (n) => Math.round(n * 100) / 100;
