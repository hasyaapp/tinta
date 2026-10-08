import * as THREE from "three";
import {
  BOOK_THICKNESS,
  COVER_RADIUS,
  PAPER,
  SPINE_INSET,
  SPINE_ROUND_SEGMENTS,
} from "./look";

/** Local space matches the canvas element: x right, y down from the top-left of
 *  the cover box, z towards the reader with the front board at z = 0. The model
 *  matrix flips y into the renderer's space. */
export interface BookDims {
  width: number;
  height: number;
  lifted?: boolean;
}

export const SURFACE_COVER = 0;
export const SURFACE_SPINE = 1;
export const SURFACE_PAPER = 2;

type Point = [number, number];

/** Rounded rectangle: tight corners on the spine side, generous ones at the
 *  fore-edge, walked clockwise on screen. */
function outline(width: number, height: number, seg = 6): Point[] {
  const r = Math.min(COVER_RADIUS, width / 2, height / 2);
  const rl = SPINE_INSET;
  const pts: Point[] = [];
  const arc = (
    cx: number,
    cy: number,
    from: number,
    to: number,
    radius: number,
  ) => {
    for (let i = 0; i <= seg; i++) {
      const a = from + (to - from) * (i / seg);
      pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  };
  pts.push([rl, 0]);
  pts.push([width - r, 0]);
  arc(width - r, r, -Math.PI / 2, 0, r);
  pts.push([width, height - r]);
  arc(width - r, height - r, 0, Math.PI / 2, r);
  pts.push([rl, height]);
  arc(rl, height - rl, Math.PI / 2, Math.PI, rl);
  pts.push([0, rl]);
  arc(rl, rl, Math.PI, Math.PI * 1.5, rl);
  return pts;
}

export function buildBookGeometry({ width, height, lifted = false }: BookDims) {
  const scale = width / 350;
  // At rest the page block extends below the board. Lifted towards the camera,
  // that fore-edge is occluded by the cover, as in the supplied Home frames.
  const t = (lifted ? 1 : BOOK_THICKNESS) * scale;
  const backY = (y: number) => y * (1 + (lifted ? 0 : 10 * scale) / height);
  const points = outline(width, height);
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const surf: number[] = [];
  const index: number[] = [];

  const push = (
    p: [number, number, number],
    n: [number, number, number],
    tex: [number, number],
    surface: number,
  ) => {
    position.push(p[0], p[1], p[2]);
    normal.push(n[0], n[1], n[2]);
    uv.push(tex[0], tex[1]);
    surf.push(surface);
    return surf.length - 1;
  };

  // Front board: a fan over the convex outline.
  const front = points.map((p) =>
    push(
      [p[0], p[1], 0],
      [0, 0, 1],
      [p[0] / width, p[1] / height],
      SURFACE_COVER,
    ),
  );
  for (let i = 1; i < front.length - 1; i++)
    index.push(front[0], front[i], front[i + 1]);
  // Back board: same outline, pushed behind the pages.
  const back = points.map((p) =>
    push(
      [p[0], backY(p[1]), -t],
      [0, 0, -1],
      [p[0] / width, p[1] / height],
      SURFACE_PAPER,
    ),
  );
  for (let i = 1; i < back.length - 1; i++)
    index.push(back[0], back[i + 1], back[i]);

  // Side wall. The left edge wraps around the pages as a half round, the rest is
  // the cut paper stack.
  let run = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const leftEdge = a[0] === 0 && b[0] === 0;

    if (leftEdge) {
      // Semicircle in the x/z plane from the front corner round to the back one.
      const radius = t / 2;
      const top = Math.min(a[1], b[1]);
      const bottom = Math.max(a[1], b[1]);
      let previous: [number, number, number] | null = null;
      for (let k = 0; k <= SPINE_ROUND_SEGMENTS; k++) {
        const angle = (Math.PI * k) / SPINE_ROUND_SEGMENTS;
        const x = -Math.min(2 * scale, radius) * Math.sin(angle);
        const z = -radius * (1 - Math.cos(angle));
        const current: [number, number, number] = [x, 0, z];
        if (previous) {
          const t0 = top,
            t1 = bottom;
          const quad = [
            push(
              [previous[0], t0, previous[2]],
              [0, 0, 0],
              [0, 0],
              SURFACE_SPINE,
            ),
            push(
              [current[0], t0, current[2]],
              [0, 0, 0],
              [0, 1],
              SURFACE_SPINE,
            ),
            push(
              [current[0], t1, current[2]],
              [0, 0, 0],
              [0, 1],
              SURFACE_SPINE,
            ),
            push(
              [previous[0], t1, previous[2]],
              [0, 0, 0],
              [0, 0],
              SURFACE_SPINE,
            ),
          ];
          computeFlatNormal(position, normal, quad);
          index.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
        }
        // Record the profile so normal smoothing is unnecessary: the wall is
        // faceted like a board, which is what the reference shows.
        previous = current;
      }
      continue;
    }

    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const v0 = run / Math.max(len, 1e-6);
    run += len;
    const v1 = run / Math.max(len, 1e-6);
    const quad = [
      push([a[0], a[1], 0], [0, 0, 0], [v0, 0], SURFACE_PAPER),
      push([b[0], b[1], 0], [0, 0, 0], [v1, 0], SURFACE_PAPER),
      push([b[0], backY(b[1]), -t], [0, 0, 0], [v1, 1], SURFACE_PAPER),
      push([a[0], backY(a[1]), -t], [0, 0, 0], [v0, 1], SURFACE_PAPER),
    ];
    computeFlatNormal(position, normal, quad);
    index.push(quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(position, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute("surf", new THREE.Float32BufferAttribute(surf, 1));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Faceted shading is intentional; each wall piece gets its own normal. */
function computeFlatNormal(
  position: number[],
  normal: number[],
  quad: number[],
) {
  const at = (i: number) => position.slice(i * 3, i * 3 + 3);
  const [p0, p1, p2] = [at(quad[0]), at(quad[1]), at(quad[2])];
  const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const v = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  let n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  n = [n[0] / len, n[1] / len, n[2] / len];
  for (const vertex of quad) {
    normal[vertex * 3] = n[0];
    normal[vertex * 3 + 1] = n[1];
    normal[vertex * 3 + 2] = n[2];
  }
}

/** Fine page lines for the fore-edge. Generated rather than shipped as an asset:
 *  the reference page stack is a flat stack of lines, not artwork. */
export function pageEdgeTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, PAPER.light);
  gradient.addColorStop(1, PAPER.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, size);
  ctx.fillStyle = "rgba(60,63,58,0.42)";
  for (let y = 0; y < size; y += 2) ctx.fillRect(0, y, 2, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}
