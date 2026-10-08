import * as THREE from "three";
import {
  BAND_GLSL,
  BAND_WIDTH,
  LIGHT,
  LIGHTING_GLSL,
  PAPER_SHADE,
  SHADOW,
} from "./look";
import { buildBookGeometry, pageEdgeTexture } from "./bookGeometry";

/** One entry per `.book-position` on the shelf. */
export interface ShelfBookInput {
  element: HTMLElement;
  cover: string;
  band: string;
}

const VERT = `
attribute float surf;
varying vec2 vUv;
varying float vSurf;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vSurf = surf;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
precision highp float;
uniform sampler2D uCover;
uniform sampler2D uPaper;
uniform vec3 uBand;
uniform vec3 uLight;
uniform float uAmbient;
uniform float uWrap;
uniform float uCoverRoughness;
uniform float uSpineRoughness;
uniform float uPaperShade;
uniform float uBandWidth;
uniform float uOpacity;
uniform float uCoverShade;
varying vec2 vUv;
varying float vSurf;
varying vec3 vNormal;
${LIGHTING_GLSL}
${BAND_GLSL}
void main() {
  vec3 n = normalize(vNormal);
  vec3 base;
  float roughness;
  if (vSurf < 0.5) {
    base = texture2D(uCover, vUv).rgb * uCoverShade;
    // The spine board reads as a band across the left of the cover.
    if (vUv.x < uBandWidth) {
      base = uBand * bandLight(vUv.x / uBandWidth);
      roughness = uSpineRoughness;
    } else {
      roughness = uCoverRoughness;
    }
  } else if (vSurf < 1.5) {
    base = uBand * bandLight(0.3);
    roughness = uSpineRoughness;
  } else {
    // The fore-edge is a stack of sheets, so the lines repeat across its depth.
    base = texture2D(uPaper, vec2(vUv.x, vUv.y * 6.0)).rgb * uPaperShade;
    roughness = 0.9;
  }
  float light = shade(n, uLight, uAmbient, uWrap, roughness);
  // Keep the authored cover tone when facing the camera; only its change in
  // orientation should change the lighting, not an extra colour-space decode.
  if (vSurf < 0.5) light /= shade(vec3(0.0, 0.0, 1.0), uLight, uAmbient, uWrap, roughness);
  gl_FragColor = vec4(base * light, uOpacity);
}`;

const SHADOW_VERT = `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHADOW_FRAG = `
precision highp float;
uniform vec2 uHalf;
uniform float uRadius;
uniform float uBlur;
uniform float uOpacity;
uniform vec3 uColor;
varying vec2 vLocal;
float roundedBox(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}
void main() {
  float d = roundedBox(vLocal, uHalf, uRadius);
  float alpha = 1.0 - smoothstep(-uBlur, uBlur, d);
  gl_FragColor = vec4(uColor, alpha * uOpacity);
}`;

/** Builds a renderer matrix from a CSS transform. The transform stays in the
 *  browser's convention (x right, y down, z towards the reader) because it is
 *  composed between CSS-space translations; the single flip into the renderer's
 *  y-up world happens once, at the end of `modelMatrix`. */
function cssToRenderer(m: DOMMatrix, out: THREE.Matrix4) {
  out.set(
    m.m11,
    m.m21,
    m.m31,
    m.m41,
    m.m12,
    m.m22,
    m.m32,
    m.m42,
    m.m13,
    m.m23,
    m.m33,
    m.m43,
    m.m14,
    m.m24,
    m.m34,
    m.m44,
  );
  return out;
}

/** Reads the CSS box, transform and transform-origin off a shelf book, then
 *  builds the model matrix that puts the geometry exactly where the browser
 *  would have drawn the element. Layout stays authoritative: the renderer only
 *  paints. World space is the viewport with y up; the camera carries the
 *  perspective origin so this matrix stays a plain CSS placement. */
function modelMatrix(element: HTMLElement, out: THREE.Matrix4) {
  const cs = getComputedStyle(element);
  const left = parseFloat(cs.left) || 0;
  const top = parseFloat(cs.top) || 0;
  const origin = cs.transformOrigin.split(" ").map(parseFloat);
  const [ox, oy] = [origin[0] || 0, origin[1] || 0];
  const m = new DOMMatrix(cs.transform === "none" ? "" : cs.transform);

  const placed = new THREE.Matrix4()
    .makeTranslation(left + ox, top + oy, 0)
    .multiply(cssToRenderer(m, new THREE.Matrix4()))
    .multiply(new THREE.Matrix4().makeTranslation(-ox, -oy, 0));

  const flip = new THREE.Matrix4().makeScale(1, -1, 1);
  return out.copy(flip).multiply(placed);
}

interface BookEntry {
  element: HTMLElement;
  band: string;
  cover: string;
  group: THREE.Group;
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  material: THREE.ShaderMaterial;
  shadowMaterial: THREE.ShaderMaterial;
  texture: THREE.Texture | null;
  width: number;
  height: number;
  lifted: boolean;
  removed: boolean;
  request: number;
}

export class ShelfEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private paper: THREE.CanvasTexture;
  private books: BookEntry[] = [];
  private loader = new THREE.TextureLoader();
  private disposed = false;
  private size = "";

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
    // The shelf is a stylised render, not a colour-managed one: colours and
    // textures are used exactly as authored, so a sampled cover matches the
    // asset and a band matches the journal's colour.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    this.renderer.setClearAlpha(0);
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 20000);
    this.paper = pageEdgeTexture();
  }

  /** Rebuilds the scene from the current shelf. Cheap enough to call on every
   *  selection change; geometry is only rebuilt when the cover size changes. */
  sync(books: ShelfBookInput[]) {
    if (this.disposed) return;
    const shelf = books[0]?.element.parentElement;
    if (!shelf) return;
    const shelfStyle = getComputedStyle(shelf);
    const perspective = parseFloat(shelfStyle.perspective) || 1600;
    const shelfRect = shelf.getBoundingClientRect();
    const originParts = shelfStyle.perspectiveOrigin.split(" ").map(parseFloat);
    const perspectiveOrigin = new THREE.Vector2(
      shelfRect.left + (originParts[0] || shelfRect.width / 2),
      shelfRect.top + (originParts[1] || shelfRect.height / 2),
    );

    // Camera that reproduces the browser's perspective. CSS divides by (d - z)
    // and puts the vanishing point at the perspective origin, which is rarely
    // the screen centre, so the camera travels to that origin and the projection
    // is shifted with a view offset.
    const viewport = new THREE.Vector2(
      this.canvas.clientWidth || window.innerWidth,
      this.canvas.clientHeight || window.innerHeight,
    );
    this.camera.fov =
      (2 * Math.atan(viewport.y / (2 * perspective)) * 180) / Math.PI;
    this.camera.aspect = viewport.x / viewport.y;
    this.camera.position.set(
      perspectiveOrigin.x,
      -perspectiveOrigin.y,
      perspective,
    );
    this.camera.setViewOffset(
      viewport.x,
      viewport.y,
      0,
      -(perspectiveOrigin.y - viewport.y / 2),
      viewport.x,
      viewport.y,
    );
    this.camera.updateProjectionMatrix();

    const seen = new Set<HTMLElement>();
    for (const book of books) {
      seen.add(book.element);
      const cs = getComputedStyle(book.element);
      const width = parseFloat(cs.width) || 0;
      const height = parseFloat(cs.height) || 0;
      const lifted = book.element.classList.contains("selected");
      let entry = this.books.find((b) => b.element === book.element);
      if (!entry) {
        entry = this.createEntry(book);
        this.books.push(entry);
      }
      if (
        entry.width !== width ||
        entry.height !== height ||
        entry.lifted !== lifted
      ) {
        entry.width = width;
        entry.height = height;
        entry.lifted = lifted;
        entry.mesh.geometry.dispose();
        entry.mesh.geometry = buildBookGeometry({ width, height, lifted });
      }
      if (entry.cover !== book.cover) {
        entry.cover = book.cover;
        this.loadCover(entry);
      }
      if (entry.band !== book.band) {
        entry.band = book.band;
        entry.material.uniforms.uBand.value.setStyle(
          book.band,
          THREE.LinearSRGBColorSpace,
        );
      }
      modelMatrix(book.element, entry.mesh.matrix);
      entry.mesh.matrixAutoUpdate = false;
      entry.mesh.matrixWorldNeedsUpdate = true;
      entry.group.visible =
        !!entry.texture &&
        cs.visibility !== "hidden" &&
        parseFloat(cs.opacity) > 0;
      entry.material.uniforms.uOpacity.value = parseFloat(cs.opacity);
      entry.material.uniforms.uCoverShade.value = lifted ? 0.98 : 0.9;
      this.placeShadow(entry, width, height);
    }

    for (const entry of this.books.filter((b) => !seen.has(b.element))) {
      this.disposeEntry(entry);
    }
    this.books = this.books.filter((b) => seen.has(b.element));
    this.render();
  }

  private createEntry(book: ShelfBookInput): BookEntry {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        uCover: { value: null },
        uPaper: { value: this.paper },
        uBand: {
          value: new THREE.Color().setStyle(
            book.band,
            THREE.LinearSRGBColorSpace,
          ),
        },
        uOpacity: { value: 1 },
        uCoverShade: { value: 1 },
        uLight: {
          value: new THREE.Vector3(...LIGHT.direction).normalize(),
        },
        uAmbient: { value: LIGHT.ambient },
        uWrap: { value: LIGHT.wrap },
        uCoverRoughness: { value: LIGHT.coverRoughness },
        uSpineRoughness: { value: LIGHT.spineRoughness },
        uPaperShade: { value: PAPER_SHADE },
        uBandWidth: { value: BAND_WIDTH },
      },
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    // The world matrices are written straight from the CSS transform, so three
    // must not recompute them from position/quaternion/scale.
    mesh.matrixAutoUpdate = false;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        vertexShader: SHADOW_VERT,
        fragmentShader: SHADOW_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uHalf: { value: new THREE.Vector2(1, 1) },
          uRadius: { value: 28 },
          uBlur: { value: SHADOW.resting.blur },
          uOpacity: { value: SHADOW.resting.opacity },
          uColor: {
            value: new THREE.Color().setStyle(
              "#303969",
              THREE.LinearSRGBColorSpace,
            ),
          },
        },
      }),
    );
    const shadowMaterial = shadow.material as THREE.ShaderMaterial;
    shadow.matrixAutoUpdate = false;
    // The shadow is transparent, so it would otherwise sort after the opaque
    // board and paint over it.
    shadow.renderOrder = -1;
    const group = new THREE.Group();
    group.visible = false;
    group.add(shadow, mesh);
    this.scene.add(group);
    const entry: BookEntry = {
      element: book.element,
      band: book.band,
      cover: book.cover,
      group,
      mesh,
      shadow,
      material,
      shadowMaterial,
      texture: null,
      width: 0,
      height: 0,
      lifted: false,
      removed: false,
      request: 0,
    };
    this.loadCover(entry);
    return entry;
  }

  private loadCover(entry: BookEntry) {
    delete entry.element.dataset.shelfPainted;
    entry.texture?.dispose();
    entry.texture = null;
    entry.group.visible = false;
    const request = ++entry.request;
    if (!entry.cover) return;
    const url = entry.cover;
    this.loader.load(
      url,
      (texture) => {
        if (this.disposed || entry.removed || entry.request !== request) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.NoColorSpace;
        // The cover maps v=0 to the top of the board, so three's default vertical
        // flip has to be off or the artwork comes out upside down.
        texture.flipY = false;
        entry.texture?.dispose();
        entry.texture = texture;
        entry.material.uniforms.uCover.value = texture;
        const cs = getComputedStyle(entry.element);
        entry.group.visible =
          cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0;
        entry.element.dataset.shelfPainted = "true";
        this.render();
      },
      undefined,
      () => {
        /* The CSS cover remains visible if its WebGL texture fails. */
      },
    );
  }

  /** The cast shadow is an analytic soft silhouette rather than a shadow map:
   *  the reference ramp is a wide, even blur that this tunes directly. */
  private placeShadow(entry: BookEntry, width: number, height: number) {
    const scale = width / 350;
    const profile = entry.lifted ? SHADOW.lifted : SHADOW.resting;
    const [dx, dy] = profile.offset.map((v) => v * scale);
    const half = new THREE.Vector2(width * 0.47, height / 2 - 3 * scale);
    const planeWidth = half.x * 2 + 140,
      planeHeight = half.y * 2 + 140;
    const geometry = entry.shadow.geometry as THREE.PlaneGeometry;
    if (
      geometry.parameters.width !== planeWidth ||
      geometry.parameters.height !== planeHeight
    ) {
      geometry.dispose();
      entry.shadow.geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
    }
    entry.shadowMaterial.uniforms.uHalf.value.copy(half);
    entry.shadowMaterial.uniforms.uBlur.value = profile.blur * scale;
    entry.shadowMaterial.uniforms.uRadius.value = 4 * scale;
    entry.shadowMaterial.uniforms.uOpacity.value =
      profile.opacity * parseFloat(getComputedStyle(entry.element).opacity);
    // The plane is centred on its own origin, so it has to be moved to the
    // board's centre and then offset. Local space is y-down, so +dy is downwards
    // once the model flip has been applied.
    entry.shadow.matrix
      .copy(entry.mesh.matrix)
      .multiply(
        new THREE.Matrix4().makeTranslation(
          width / 2 + dx,
          height / 2 + dy,
          -1,
        ),
      );
    entry.shadow.matrixWorldNeedsUpdate = true;
  }

  render() {
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /** Where the renderer actually paints a book, in CSS pixels. Used to check the
   *  canvas against the DOM rectangle it is supposed to sit on. */
  projectedRect(element: HTMLElement) {
    const entry = this.books.find((b) => b.element === element);
    if (!entry) return null;
    const { width, height } = entry;
    const corners: [number, number][] = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ];
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of corners) {
      const p = new THREE.Vector3(x, y, 0)
        .applyMatrix4(entry.mesh.matrix)
        .project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * this.canvas.clientWidth;
      const sy = (0.5 - p.y * 0.5) * this.canvas.clientHeight;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    }
    return {
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(maxX - minX),
      h: Math.round(maxY - minY),
      debug: {
        world: new THREE.Vector3(0, 0, 0)
          .applyMatrix4(entry.mesh.matrix)
          .toArray()
          .map((v) => Math.round(v * 10) / 10),
        camera: this.camera.position.toArray(),
        matrix: entry.mesh.matrix
          .toArray()
          .map((v) => Math.round(v * 100) / 100),
      },
    };
  }

  setSize(width: number, height: number) {
    if (this.disposed) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size = `${width}:${height}:${ratio}`;
    if (size === this.size) return;
    this.size = size;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.disposed = true;
    for (const entry of this.books) this.disposeEntry(entry);
    this.books = [];
    this.paper.dispose();
    this.renderer.dispose();
  }

  private disposeEntry(entry: BookEntry) {
    entry.removed = true;
    delete entry.element.dataset.shelfPainted;
    this.scene.remove(entry.group);
    entry.mesh.geometry.dispose();
    entry.material.dispose();
    entry.shadow.geometry.dispose();
    entry.shadowMaterial.dispose();
    entry.texture?.dispose();
  }
}
