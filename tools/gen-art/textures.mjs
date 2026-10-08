import { PNG } from "pngjs";
import { mulberry32 } from "./util.mjs";

// Brush textures for InkEngine shaders (deterministic):
// - SketchStamp: sampled via .a (mode 2 stamp) -> radial falloff + grain in alpha.
// - SketchNoise: sampled via .r/.b with REPEAT wrap -> tileable RGB value noise.
// - WatercolorFill: sampled via .a (mode 3 fill) -> low-frequency blotch alpha.
// - WatercolorEdge: sampled via .a (mode 3 edge) -> mid-frequency high-contrast alpha.

const smooth = (t) => t * t * (3 - 2 * t);

// Tileable value-noise lattice of `cells` x `cells`, sampled at (x, y) in pixels.
function lattice(cells, seed) {
  const rnd = mulberry32(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  return (fx, fy) => {
    const x0 = Math.floor(fx) % cells;
    const y0 = Math.floor(fy) % cells;
    const x1 = (x0 + 1) % cells;
    const y1 = (y0 + 1) % cells;
    const tx = smooth(fx - Math.floor(fx));
    const ty = smooth(fy - Math.floor(fy));
    const a = g[y0 * cells + x0];
    const b = g[y0 * cells + x1];
    const c = g[y1 * cells + x0];
    const d = g[y1 * cells + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

// Multi-octave tileable value noise in [0,1]; octaves = [[cells, weight], ...].
function fbm(size, seed, octaves) {
  const fns = octaves.map(([cells], i) => lattice(cells, seed + i * 7919));
  const total = octaves.reduce((s, [, w]) => s + w, 0);
  return (x, y) => {
    let v = 0;
    for (let i = 0; i < octaves.length; i++) {
      const [cells, w] = octaves[i];
      v += fns[i]((x / size) * cells, (y / size) * cells) * w;
    }
    return v / total;
  };
}

function png(size, fill) {
  const img = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b, a] = fill(x, y);
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  return PNG.sync.write(img);
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

export const textures = {
  "SketchStamp.png"() {
    const size = 256;
    const grain = fbm(size, 11, [
      [24, 1],
      [48, 0.8],
      [96, 0.6],
    ]);
    const rnd = mulberry32(99);
    const speck = new Float32Array(size * size);
    for (let i = 0; i < speck.length; i++) speck[i] = rnd();
    return png(size, (x, y) => {
      const dx = (x - 127.5) / 127.5;
      const dy = (y - 127.5) / 127.5;
      const d = Math.hypot(dx, dy);
      const fall = Math.max(0, 1 - smooth(Math.min(1, d))) ** 1.4;
      const g = 0.3 + 0.55 * grain(x, y) + 0.3 * speck[y * size + x];
      return [255, 255, 255, clamp255(fall * Math.min(1, g))];
    });
  },
  "SketchNoise.png"() {
    const size = 512;
    const oct = [
      [8, 1],
      [16, 0.7],
      [32, 0.5],
      [64, 0.35],
    ];
    const r = fbm(size, 211, oct);
    const g = fbm(size, 977, oct);
    const b = fbm(size, 1543, oct);
    return png(size, (x, y) => [
      clamp255(r(x, y)),
      clamp255(g(x, y)),
      clamp255(b(x, y)),
      255,
    ]);
  },
  "WatercolorFill.png"() {
    const size = 1024;
    const blotch = fbm(size, 4441, [
      [3, 1],
      [6, 0.65],
      [12, 0.4],
      [24, 0.2],
    ]);
    return png(size, (x, y) => {
      const v = blotch(x, y);
      const a = 0.35 + 0.65 * smooth(Math.min(1, Math.max(0, (v - 0.25) / 0.5)));
      return [255, 255, 255, clamp255(a)];
    });
  },
  "WatercolorEdge.png"() {
    const size = 1024;
    const gran = fbm(size, 8171, [
      [16, 1],
      [32, 0.75],
      [64, 0.5],
    ]);
    return png(size, (x, y) => {
      const v = gran(x, y);
      // steep contrast curve around the midpoint for edge granulation
      const t = Math.min(1, Math.max(0, (v - 0.42) / 0.16));
      const a = smooth(t);
      return [255, 255, 255, clamp255(a)];
    });
  },
};
