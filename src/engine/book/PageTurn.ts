import * as THREE from "three";
import { BAND_GLSL } from "../shelf/look";
import type { CoverRequest, MotionHandle, PageTurnRequest } from "./motion";

// Replaces the rigid CSS rotations of the page flip and the cover swing with a
// continuously deforming sheet: the paper bends as a circular arc around the
// spine (constant curvature = an inextensible sheet), with the arc's root angle
// driven by the same keyframe angles and easings as the CSS animations it
// replaces. Layout stays owned by the DOM: the wrappers are measured and the
// camera reproduces the CSS perspective, exactly like ShelfEngine.
//
// One renderer and one context serve every animation; progress is state, not a
// one-shot keyframe, so a turn can be retargeted (reversed) mid-flight.

const DEG = Math.PI / 180;

/** Resting leaf tilt and total travel of the turning sheet (±14° → ∓166°). */
const TURN_REST = -14 * DEG;
const TURN_TRAVEL = -152 * DEG;
/** Pages are stiff cardstock: a slight flex mid-turn, zero at both ends so the
 *  card lands flat. A thin-paper curl here would contradict the board fan. */
const TURN_BEND = 9 * DEG;
/** A hardcover board barely flexes. */
const COVER_BEND = 4 * DEG;
/** Cardstock corner radius; must match --leaf-radius in book.css. */
const LEAF_RADIUS = 18;
/** Visible cardstock thickness while a card turns, matching the CSS leaf edge. */
const LEAF_EDGE = 4;
/** The book-unfold keyframes put their waypoint at 42%. */
const COVER_WAYPOINT = 0.42;

/** Matches cubic-bezier(0.35, 0.08, 0.3, 1) on .turn-leaf. */
const TURN_EASE = cubicBezier(0.35, 0.08, 0.3, 1);
/** Matches cubic-bezier(0.3, 0.05, 0.25, 1) on the cover keyframes. */
const COVER_EASE = cubicBezier(0.3, 0.05, 0.25, 1);

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const sample = (a1: number, a2: number, t: number) =>
    (((1 - 3 * a2 + 3 * a1) * t + (3 * a2 - 6 * a1)) * t + 3 * a1) * t;
  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 24; i++) {
      const cx = sample(x1, x2, t);
      if (Math.abs(cx - x) < 1e-5) break;
      if (cx < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sample(y1, y2, t);
  };
}

const SHEET_VERT = `
uniform vec3 uOrigin;   // CSS px: spine x, sheet top y, z towards the reader
uniform vec2 uSize;     // sheet width (spine to fore-edge) and height, px
uniform float uTheta;   // tangent angle at the spine, CSS rotateY convention
uniform float uKappa;   // curvature (rad/px); the sheet is a circular arc
uniform float uMirror;  // +1 extends right of the spine, -1 left
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = position.xy;
  float s = position.x * uSize.x;
  float x;
  float z;
  if (abs(uKappa) > 1e-6) {
    float phi = uTheta + uKappa * s;
    x = (sin(phi) - sin(uTheta)) / uKappa;
    z = (cos(phi) - cos(uTheta)) / uKappa;
  } else {
    x = s * cos(uTheta);
    z = -s * sin(uTheta);
  }
  vec3 css = vec3(uOrigin.x + uMirror * x, uOrigin.y + position.y * uSize.y, uOrigin.z + z);
  vWorld = vec3(css.x, -css.y, css.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vWorld, 1.0);
}`;

const SHEET_FRAG = `
precision highp float;
uniform sampler2D uFrontTex;
uniform sampler2D uBackTex;
uniform float uHasFront;
uniform float uHasBack;
uniform vec3 uPaper;
uniform vec3 uBand;
uniform float uBandWidth;
uniform vec2 uFrontU;   // texture u at the spine / at the fore-edge
uniform vec2 uBackU;
uniform float uFaceSign;
uniform vec2 uSize;
uniform float uRadius;
uniform float uFold;
uniform float uEdge;    // laminated cardstock rim width (px); 0 = none
varying vec2 vUv;
varying vec3 vWorld;
${BAND_GLSL}
void main() {
  // Rounded fore-edge corners; the box is extended past the spine edge so the
  // spine corners stay square, matching border-radius: 1px R R 1px.
  vec2 local = vUv * uSize;
  vec2 halfSize = vec2((uSize.x + uRadius) * 0.5, uSize.y * 0.5);
  vec2 centred = vec2(local.x - (uSize.x - uRadius) * 0.5, local.y - uSize.y * 0.5);
  vec2 q = abs(centred) - halfSize + uRadius;
  float dist = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float mask = 1.0 - smoothstep(-0.75, 0.75, dist);
  if (mask < 0.004) discard;
  bool front = gl_FrontFacing == (uFaceSign > 0.0);
  vec3 base;
  if (front) {
    vec2 uv = vec2(mix(uFrontU.x, uFrontU.y, vUv.x), vUv.y);
    base = mix(uPaper, texture2D(uFrontTex, uv).rgb, uHasFront);
    if (vUv.x < uBandWidth) base = uBand * bandLight(vUv.x / uBandWidth);
  } else {
    vec2 uv = vec2(mix(uBackU.x, uBackU.y, vUv.x), vUv.y);
    base = mix(uPaper, texture2D(uBackTex, uv).rgb, uHasBack);
  }
  // Cardstock rim, the same three tones as the CSS leaf edge. The spine side
  // sits uRadius inside the SDF, so only the free edges get the rim.
  if (uEdge > 0.0 && dist > -uEdge) {
    float t = (dist + uEdge) / uEdge;
    vec3 rim = t < 0.34 ? vec3(0.902, 0.886, 0.851)
             : t < 0.67 ? vec3(0.831, 0.804, 0.753)
             : vec3(0.706, 0.675, 0.616);
    base = rim;
  }
  // Wrap lighting from the deformed surface, normalised so a sheet facing the
  // reader keeps its authored colours and only the curl changes the tone.
  vec3 normal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  normal *= sign(normal.z + 1e-6);
  vec3 lightDir = normalize(vec3(-0.35, 0.5, 1.0));
  float wrap = 0.35;
  float diffuse = clamp((dot(normal, lightDir) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float flatDiffuse = clamp((lightDir.z + wrap) / (1.0 + wrap), 0.0, 1.0);
  float shade = (0.62 + 0.38 * diffuse) / (0.62 + 0.38 * flatDiffuse);
  // Soft shadow in the fold, deepening with curvature.
  shade *= 1.0 - uFold * (1.0 - smoothstep(0.0, 0.35, vUv.x));
  gl_FragColor = vec4(base * shade, mask);
}`;

const SHADOW_VERT = `
varying vec2 vLocal;
void main() {
  vLocal = uv - 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHADOW_FRAG = `
precision highp float;
uniform vec2 uSize;
uniform vec2 uHalf;
uniform float uBlur;
uniform float uOpacity;
varying vec2 vLocal;
void main() {
  vec2 p = vLocal * uSize;
  vec2 q = abs(p) - uHalf + 10.0;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 10.0;
  float alpha = (1.0 - smoothstep(-uBlur, uBlur, d)) * uOpacity;
  gl_FragColor = vec4(0.137, 0.165, 0.294, alpha);
}`;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One deformable sheet: a tessellated plane whose arc is set by uniforms. */
class Sheet {
  readonly mesh: THREE.Mesh;
  readonly u: Record<string, THREE.IUniform>;
  private readonly material: THREE.ShaderMaterial;
  private frontTex: THREE.Texture | null = null;
  private backTex: THREE.Texture | null = null;

  constructor(geometry: THREE.BufferGeometry, renderOrder: number) {
    this.u = {
      uOrigin: { value: new THREE.Vector3() },
      uSize: { value: new THREE.Vector2(1, 1) },
      uTheta: { value: 0 },
      uKappa: { value: 0 },
      uMirror: { value: 1 },
      uFrontTex: { value: null },
      uBackTex: { value: null },
      uHasFront: { value: 0 },
      uHasBack: { value: 0 },
      uPaper: { value: new THREE.Color("#efedea") },
      uBand: { value: new THREE.Color("#888888") },
      uBandWidth: { value: 0 },
      uFrontU: { value: new THREE.Vector2(0, 1) },
      uBackU: { value: new THREE.Vector2(0, 1) },
      uFaceSign: { value: -1 },
      uRadius: { value: LEAF_RADIUS },
      uFold: { value: 0 },
      uEdge: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: SHEET_VERT,
      fragmentShader: SHEET_FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: this.u,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    // Vertices are placed in CSS pixel space by the shader itself.
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
  }

  place(x: number, y: number, z: number, w: number, h: number) {
    (this.u.uOrigin.value as THREE.Vector3).set(x, y, z);
    (this.u.uSize.value as THREE.Vector2).set(w, h);
  }

  bend(theta: number, kappa: number, fold: number) {
    this.u.uTheta.value = theta;
    this.u.uKappa.value = kappa;
    this.u.uFold.value = fold;
  }

  setFront(texture: THREE.Texture | null) {
    this.frontTex?.dispose();
    this.frontTex = texture;
    this.u.uFrontTex.value = texture;
    this.u.uHasFront.value = texture ? 1 : 0;
  }

  setBack(texture: THREE.Texture | null) {
    this.backTex?.dispose();
    this.backTex = texture;
    this.u.uBackTex.value = texture;
    this.u.uHasBack.value = texture ? 1 : 0;
  }

  reset() {
    this.mesh.visible = false;
    this.setFront(null);
    this.setBack(null);
  }

  dispose() {
    this.reset();
    this.material.dispose();
  }
}

interface ActiveAnim {
  progress: number;
  target: number;
  duration: number;
  settled: boolean;
  apply: () => void;
  onSettle: ((at: 0 | 1) => void) | null;
  cleanup: () => void;
}

export class BookMotionEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
  private geometry: THREE.BufferGeometry;
  private turnSheet: Sheet;
  private coverFront: Sheet;
  private coverBack: Sheet;
  private coverBlock: Sheet;
  private shadow: THREE.Mesh;
  private shadowMaterial: THREE.ShaderMaterial;
  private shadowMatrix = new THREE.Matrix4();
  private loader = new THREE.TextureLoader();
  private anims: ActiveAnim[] = [];
  private frame = 0;
  private last = 0;
  private size = "";
  private disposed = false;

  static isSupported() {
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      return !!gl;
    } catch {
      return false;
    }
  }

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setClearAlpha(0);
    this.geometry = new THREE.PlaneGeometry(1, 1, 96, 1);
    this.geometry.translate(0.5, 0.5, 0);
    this.turnSheet = new Sheet(this.geometry, 2);
    this.coverFront = new Sheet(this.geometry, 2);
    this.coverBack = new Sheet(this.geometry, 1);
    this.coverBlock = new Sheet(this.geometry, 0);
    this.shadowMaterial = new THREE.ShaderMaterial({
      vertexShader: SHADOW_VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: new THREE.Vector2(1, 1) },
        uHalf: { value: new THREE.Vector2(1, 1) },
        uBlur: { value: 26 },
        uOpacity: { value: 0 },
      },
    });
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      this.shadowMaterial,
    );
    this.shadow.matrixAutoUpdate = false;
    this.shadow.frustumCulled = false;
    this.shadow.renderOrder = -1;
    this.shadow.visible = false;
    this.scene.add(
      this.shadow,
      this.coverBlock.mesh,
      this.coverBack.mesh,
      this.coverFront.mesh,
      this.turnSheet.mesh,
    );
  }

  /** A sheet turning about the gutter of the open spread. */
  playPageTurn(request: PageTurnRequest): MotionHandle {
    this.activate();
    this.aimCamera(request.scene);
    const rect = request.scene.getBoundingClientRect();
    const half = rect.width / 2;
    const gutterX = rect.left + half;
    const mirror = request.direction === 1 ? 1 : -1;
    const sheet = this.turnSheet;
    sheet.u.uMirror.value = mirror;
    sheet.u.uFaceSign.value = -mirror;
    sheet.u.uRadius.value = LEAF_RADIUS;
    sheet.u.uEdge.value = LEAF_EDGE;
    sheet.u.uBandWidth.value = 0;
    (sheet.u.uPaper.value as THREE.Color).set("#f8f7f2");
    // Forward shows the right half of the outgoing page and lands on the left
    // half of the incoming one; backward mirrors both.
    (sheet.u.uFrontU.value as THREE.Vector2).set(0.5, mirror === 1 ? 1 : 0);
    (sheet.u.uBackU.value as THREE.Vector2).set(0.5, mirror === 1 ? 0 : 1);
    sheet.setFront(null);
    sheet.setBack(null);
    sheet.mesh.visible = true;
    this.shadow.visible = true;

    let alive = true;
    void request.front.then((art) => {
      if (alive && art && !this.disposed) {
        sheet.setFront(this.canvasTexture(art));
        this.render();
      }
    });
    void request.back.then((art) => {
      if (alive && art && !this.disposed) {
        sheet.setBack(this.canvasTexture(art));
        this.render();
      }
    });

    const anim: ActiveAnim = {
      progress: 0,
      target: 1,
      duration: request.duration,
      settled: false,
      onSettle: request.onSettle,
      apply: () => {
        const eased = TURN_EASE(anim.progress);
        const theta = TURN_REST + TURN_TRAVEL * eased;
        const arc = TURN_BEND * Math.sin(Math.PI * eased);
        sheet.place(gutterX, rect.top, 0, half, rect.height);
        sheet.bend(theta, arc / half, Math.min(0.4, arc * 0.5));
        // The cast shadow follows the sheet's horizontal reach over the pages.
        const kappa = arc / half;
        const reach =
          Math.abs(kappa) > 1e-6
            ? (Math.sin(theta + arc) - Math.sin(theta)) / kappa
            : half * Math.cos(theta);
        const tip = gutterX + mirror * reach;
        this.placeShadow(
          Math.min(gutterX, tip),
          Math.max(gutterX, tip),
          rect.top,
          rect.height,
          0.26 * Math.sin(Math.PI * eased),
        );
      },
      cleanup: () => {
        alive = false;
        sheet.reset();
        this.shadow.visible = false;
      },
    };
    return this.begin(anim);
  }

  /** The hardback cover swing: closed shelf box to the open right-hand leaf. */
  playCover(request: CoverRequest): MotionHandle {
    this.activate();
    this.aimCamera(request.wrapper);
    const closed = boxOf(request.closedProbe);
    const open = boxOf(request.openProbe);
    // --book-radius is a constant derived from the closed cover width.
    const bookRadius = closed.w * 0.08;

    const front = this.coverFront;
    front.u.uMirror.value = 1;
    front.u.uFaceSign.value = -1;
    front.u.uRadius.value = bookRadius;
    front.u.uBandWidth.value = 0.12;
    (front.u.uBand.value as THREE.Color).setStyle(
      request.band,
      THREE.LinearSRGBColorSpace,
    );
    (front.u.uPaper.value as THREE.Color).set("#efedea");
    (front.u.uFrontU.value as THREE.Vector2).set(0, 1);
    (front.u.uBackU.value as THREE.Vector2).set(0.5, 0);
    front.setFront(null);
    front.setBack(null);

    const back = this.coverBack;
    back.u.uMirror.value = 1;
    back.u.uFaceSign.value = -1;
    back.u.uRadius.value = LEAF_RADIUS;
    back.u.uBandWidth.value = 0;
    (back.u.uPaper.value as THREE.Color).set("#efedea");
    (back.u.uFrontU.value as THREE.Vector2).set(0.5, 1);
    back.setFront(null);
    back.setBack(null);

    const block = this.coverBlock;
    block.u.uMirror.value = 1;
    block.u.uFaceSign.value = -1;
    block.u.uRadius.value = LEAF_RADIUS;
    block.u.uBandWidth.value = 0;
    (block.u.uPaper.value as THREE.Color).setStyle(
      request.band,
      THREE.LinearSRGBColorSpace,
    );
    block.setFront(null);
    block.setBack(null);

    front.mesh.visible = true;
    back.mesh.visible = true;
    block.mesh.visible = true;

    let alive = true;
    this.loader.load(request.cover, (texture) => {
      if (!alive || this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      front.setFront(texture);
      this.render();
    });
    void request.page?.then((art) => {
      if (!alive || !art || this.disposed) return;
      // Lining shows the left half, the inside leaf the right half of the
      // same page; two textures keep ownership (disposal) per sheet.
      front.setBack(this.canvasTexture(art));
      back.setFront(this.canvasTexture(art));
      this.render();
    });

    const box: Box = { x: 0, y: 0, w: 1, h: 1 };
    const anim: ActiveAnim = {
      progress: request.kind === "open" ? 0 : 1,
      target: request.kind === "open" ? 1 : 0,
      duration: request.duration,
      settled: false,
      onSettle: () => request.onSettle(),
      apply: () => {
        // Two keyframe segments (0 → 42% → 100%), each with the CSS easing,
        // mirroring book-unfold/board-unfold/back-unfold exactly.
        const p = anim.progress;
        let frontDeg: number;
        let backDeg: number;
        if (p < COVER_WAYPOINT) {
          const f = COVER_EASE(p / COVER_WAYPOINT);
          box.x = closed.x + (open.x - closed.x) * f;
          box.y = closed.y + (open.y - closed.y) * f;
          box.w = closed.w + (open.w - closed.w) * f;
          box.h = closed.h + (open.h - closed.h) * f;
          frontDeg = -86 * f;
          backDeg = -80 * f;
        } else {
          const f = COVER_EASE((p - COVER_WAYPOINT) / (1 - COVER_WAYPOINT));
          box.x = open.x;
          box.y = open.y;
          box.w = open.w;
          box.h = open.h;
          frontDeg = -86 - 80 * f;
          backDeg = -80 + 66 * f;
        }
        const arc = COVER_BEND * Math.sin(Math.PI * p);
        const backRad = backDeg * DEG;
        front.place(box.x, box.y, 1.5, box.w, box.h);
        front.bend(frontDeg * DEG, arc / box.w, Math.min(0.3, arc * 0.5));
        back.place(box.x, box.y, 0, box.w, box.h);
        back.bend(backRad, 0, 0);
        // The page block sits translateZ(-2) behind the back board and rotates
        // with it; its inset (-2px -5px -4px 0) widens the paper stack.
        block.place(
          box.x - 2 * Math.sin(backRad),
          box.y - 2,
          -2 * Math.cos(backRad),
          box.w + 5,
          box.h + 6,
        );
        block.bend(backRad, 0, 0);
      },
      cleanup: () => {
        alive = false;
        front.reset();
        back.reset();
        block.reset();
      },
    };
    return this.begin(anim);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    // Settle pending callbacks so the UI never waits on a dead context.
    for (const anim of this.anims.splice(0)) {
      const target = anim.target as 0 | 1;
      anim.cleanup();
      anim.onSettle?.(target);
    }
    delete this.canvas.dataset.active;
    this.turnSheet.dispose();
    this.coverFront.dispose();
    this.coverBack.dispose();
    this.coverBlock.dispose();
    this.shadow.geometry.dispose();
    this.shadowMaterial.dispose();
    this.geometry.dispose();
    this.renderer.dispose();
  }

  private begin(anim: ActiveAnim): MotionHandle {
    this.anims.push(anim);
    // First frame synchronously: callers start us in useLayoutEffect, so the
    // sheet is already painted when the browser presents the commit.
    anim.apply();
    this.render();
    this.run();
    return {
      setTarget: (target) => {
        if (this.disposed || anim.target === target) return;
        anim.target = target;
        anim.settled = anim.progress === target;
        this.run();
      },
      release: () => {
        const at = this.anims.indexOf(anim);
        if (at < 0) return;
        this.anims.splice(at, 1);
        anim.cleanup();
        if (!this.anims.length && !this.disposed) {
          if (this.frame) cancelAnimationFrame(this.frame);
          this.frame = 0;
          this.last = 0;
          this.renderer.clear();
          delete this.canvas.dataset.active;
        }
      },
    };
  }

  private tick = (now: number) => {
    this.frame = 0;
    if (this.disposed) return;
    const dt = Math.min(64, this.last ? now - this.last : 16.7);
    this.last = now;
    let moving = false;
    for (const anim of this.anims) {
      if (anim.settled) continue;
      const dir = anim.target >= anim.progress ? 1 : -1;
      anim.progress += (dir * dt) / anim.duration;
      if (
        (dir > 0 && anim.progress >= anim.target) ||
        (dir < 0 && anim.progress <= anim.target)
      ) {
        anim.progress = anim.target;
        anim.settled = true;
      }
      anim.apply();
      if (anim.settled) anim.onSettle?.(anim.target as 0 | 1);
      else moving = true;
    }
    this.render();
    // A settled animation keeps its last frame on screen until it is released.
    if (moving) this.frame = requestAnimationFrame(this.tick);
    else this.last = 0;
  };

  private run() {
    if (!this.frame && !this.disposed) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  private render() {
    if (!this.disposed) this.renderer.render(this.scene, this.camera);
  }

  /** The canvas is display:none while idle, so it must be activated before it
   *  can be measured. */
  private activate() {
    this.canvas.dataset.active = "true";
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size = `${w}:${h}:${ratio}`;
    if (size !== this.size) {
      this.size = size;
      this.renderer.setPixelRatio(ratio);
      this.renderer.setSize(w, h, false);
    }
  }

  /** Reproduces the container's CSS perspective, as ShelfEngine does: world
   *  space is the viewport in CSS pixels with y up. */
  private aimCamera(container: HTMLElement) {
    const cs = getComputedStyle(container);
    const perspective = parseFloat(cs.perspective) || 1200;
    const rect = container.getBoundingClientRect();
    const parts = cs.perspectiveOrigin.split(" ").map(parseFloat);
    const ox = rect.left + (parts[0] || rect.width / 2);
    const oy = rect.top + (parts[1] || rect.height / 2);
    const vw = this.canvas.clientWidth || window.innerWidth;
    const vh = this.canvas.clientHeight || window.innerHeight;
    this.camera.fov = (2 * Math.atan(vh / (2 * perspective)) * 180) / Math.PI;
    this.camera.aspect = vw / vh;
    this.camera.position.set(ox, -oy, perspective);
    this.camera.setViewOffset(vw, vh, ox - vw / 2, -(oy - vh / 2), vw, vh);
    this.camera.updateProjectionMatrix();
  }

  private placeShadow(
    x0: number,
    x1: number,
    top: number,
    height: number,
    opacity: number,
  ) {
    const blur = 26;
    const w = Math.max(0, x1 - x0);
    const h = height * 0.96;
    const u = this.shadowMaterial.uniforms;
    (u.uSize.value as THREE.Vector2).set(w + blur * 2, h + blur * 2);
    (u.uHalf.value as THREE.Vector2).set(w / 2, h / 2);
    u.uBlur.value = blur;
    u.uOpacity.value = opacity;
    this.shadowMatrix.makeScale(w + blur * 2, h + blur * 2, 1);
    this.shadowMatrix.setPosition((x0 + x1) / 2, -(top + height / 2), 0.4);
    this.shadow.matrix.copy(this.shadowMatrix);
    this.shadow.matrixWorldNeedsUpdate = true;
  }

  private canvasTexture(source: HTMLCanvasElement) {
    const texture = new THREE.CanvasTexture(source);
    texture.flipY = false;
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    return texture;
  }
}

function boxOf(probe: HTMLElement): Box {
  const rect = probe.getBoundingClientRect();
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}
