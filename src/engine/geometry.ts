export interface Point {
  x: number;
  y: number;
}
export function bounds(points: Point[]) {
  return {
    x: Math.min(...points.map((p) => p.x)),
    y: Math.min(...points.map((p) => p.y)),
    width:
      Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
    height:
      Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
  };
}
export function polygon(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  close = true,
) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}
export function recognize(
  points: Point[],
): "line" | "ellipse" | "rectangle" | "triangle" | null {
  const first = points[0],
    last = points.at(-1)!;
  const b = bounds(points);
  const length = points.reduce(
    (sum, p, i) =>
      i ? sum + Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) : 0,
    0,
  );
  if (length > Math.max(24, 2 * (b.width + b.height)) * 2.5) return null;
  if (
    Math.hypot(last.x - first.x, last.y - first.y) >
    Math.hypot(b.width, b.height) * 0.28
  )
    return "line";
  const cornerPoints = points.filter(
    (p) =>
      Math.min(p.x - b.x, b.x + b.width - p.x) < b.width * 0.12 &&
      Math.min(p.y - b.y, b.y + b.height - p.y) < b.height * 0.12,
  );
  if (cornerPoints.length / points.length > 0.14) return "rectangle";
  const top = points.filter((p) => p.y < b.y + b.height * 0.15);
  const spread = top.length
    ? Math.max(...top.map((p) => p.x)) - Math.min(...top.map((p) => p.x))
    : 0;
  return spread < b.width * 0.27 ? "triangle" : "ellipse";
}
export function floodMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
  tolerance = 32,
): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(w * h * 4);
  if (sx < 0 || sx >= w || sy < 0 || sy >= h) return mask;
  const idx = (sy * w + sx) * 4;
  const target = Array.from(data.slice(idx, idx + 4));
  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let start = 0,
    end = 1;
  queue[0] = sy * w + sx;
  visited[queue[0]] = 1;
  while (start < end) {
    const p = queue[start++],
      i = p * 4;
    if (
      Math.max(...target.map((c, j) => Math.abs(c - data[i + j]))) > tolerance
    )
      continue;
    mask[i] = mask[i + 1] = mask[i + 2] = mask[i + 3] = 255;
    const x = p % w,
      y = Math.floor(p / w);
    for (const n of [
      x > 0 ? p - 1 : -1,
      x < w - 1 ? p + 1 : -1,
      y > 0 ? p - w : -1,
      y < h - 1 ? p + w : -1,
    ])
      if (n >= 0 && !visited[n]) {
        visited[n] = 1;
        queue[end++] = n;
      }
  }
  return mask;
}
