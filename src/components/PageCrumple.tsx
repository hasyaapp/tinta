import { useEffect, useRef } from "react";

// A depth-tested 3D sheet, with perspective and lighting from its deformed
// surface normals. Motion is an approximation until native timing is measured.
// Rendering failures complete the already-confirmed deletion exactly once.
const VERT = `#version 300 es
in vec2 a_pos;
uniform float u_time;
uniform float u_aspect;
uniform int u_mode;
out vec2 v_uv;
out vec3 v_world;
void main() {
  v_uv = a_pos;
  float t = clamp(u_time, 0.0, 1.0);
  vec2 plane = a_pos * 2.0 - 1.0;
  vec3 p = vec3(plane.x * u_aspect, plane.y, 0.0);
  if (u_mode == 1) {
    // A travelling cylindrical fold rolls the near edge towards the far corner.
    vec2 axis = normalize(vec2(1.0, -0.65));
    vec2 tangent = vec2(-axis.y, axis.x);
    float along = dot(p.xy, axis);
    float across = dot(p.xy, tangent);
    float edge = (1.0 - t * 2.25) * (u_aspect + 1.0);
    float distance = max(0.0, along - edge);
    float radius = 0.32;
    float angle = min(distance / radius, 3.05);
    float folded = min(along, edge) + radius * sin(angle);
    p.xy = axis * folded + tangent * across;
    p.z = radius * (1.0 - cos(angle));
    p.xy += vec2(-0.45, 1.6) * t * t;
    p.xy *= 1.0 - 0.35 * t;
    p.z -= 0.6 * t * t;
  } else {
    float folds = smoothstep(0.0, 0.55, t);
    float collapse = smoothstep(0.25, 1.0, t);
    vec2 grid = plane * vec2(5.4, 4.2);
    float ridge = sin(grid.x + 0.45 * sin(grid.y * 1.7))
                * sin(grid.y + 0.35 * sin(grid.x * 1.9));
    p.z = folds * (0.19 * ridge + 0.16 * cos(grid.x - grid.y));
    p.x += folds * 0.045 * sin(grid.y * 2.1);
    p.y += folds * 0.05 * sin(grid.x * 2.3);
    p.xy *= 1.0 - 0.82 * collapse;
    p.z *= 1.0 - 0.45 * collapse;
    float rotation = collapse * 0.32;
    p.xy = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) * p.xy;
    p.y -= 0.1 * collapse;
  }
  v_world = p;
  // Camera at z=4. A flat t=0 sheet maps exactly to the canvas boundaries.
  float w = 4.0 - p.z;
  gl_Position = vec4(4.0 * p.x / u_aspect, 4.0 * p.y, 2.0 - p.z, w);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec3 v_world;
uniform sampler2D u_tex;
uniform float u_time;
out vec4 outColor;
void main() {
  vec4 c = texture(u_tex, clamp(v_uv, 0.0, 1.0));
  vec3 normal = normalize(cross(dFdx(v_world), dFdy(v_world)));
  if (!gl_FrontFacing) normal = -normal;
  vec3 light = normalize(vec3(-0.35, 0.5, 1.0));
  float lighting = 0.5 + 0.5 * max(0.0, dot(normal, light));
  float shade = mix(1.0, lighting, smoothstep(0.0, 0.12, u_time));
  vec3 paper = gl_FrontFacing ? c.rgb : mix(c.rgb, vec3(0.97, 0.96, 0.94), 0.86);
  outColor = vec4(paper * shade, c.a * (1.0 - smoothstep(0.82, 1.0, u_time)));
}`;

const DURATION = 540;
const PEEL_DURATION = 640;

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
}

export default function PageCrumple({
  src,
  mode = "crumple",
  onDone,
}: {
  src: string;
  mode?: "crumple" | "peel";
  onDone: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const duration = mode === "peel" ? PEEL_DURATION : DURATION;
  useEffect(() => {
    let frame = 0;
    let stopped = false;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    const release: (() => void)[] = [];
    const cleanup = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      clearTimeout(loadTimeout);
      for (const dispose of release.splice(0).reverse()) dispose();
    };
    const finish = () => {
      if (stopped) return;
      cleanup();
      done.current();
    };
    const element = canvas.current;
    try {
      const gl = element?.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: true,
      });
      if (!element || !gl || gl.isContextLost()) {
        finish();
        return cleanup;
      }
      const lost = (event: Event) => {
        event.preventDefault();
        finish();
      };
      element.addEventListener("webglcontextlost", lost);
      release.push(() => element.removeEventListener("webglcontextlost", lost));
      const vert = compile(gl, gl.VERTEX_SHADER, VERT);
      if (vert) release.push(() => gl.deleteShader(vert));
      const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (frag) release.push(() => gl.deleteShader(frag));
      const program = gl.createProgram();
      if (program) release.push(() => gl.deleteProgram(program));
      if (!vert || !frag || !program)
        throw new Error("Animation shader unavailable");
      gl.attachShader(program, vert);
      gl.attachShader(program, frag);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error("Animation shader link failed");
      gl.useProgram(program);

      const N = 64;
      const positions: number[] = [];
      for (let y = 0; y <= N; y++)
        for (let x = 0; x <= N; x++) positions.push(x / N, y / N);
      const indices: number[] = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const a = y * (N + 1) + x;
          indices.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
        }
      const vao = gl.createVertexArray();
      if (vao) release.push(() => gl.deleteVertexArray(vao));
      const buffer = gl.createBuffer();
      if (buffer) release.push(() => gl.deleteBuffer(buffer));
      const indexBuffer = gl.createBuffer();
      if (indexBuffer) release.push(() => gl.deleteBuffer(indexBuffer));
      const texture = gl.createTexture();
      if (texture) release.push(() => gl.deleteTexture(texture));
      if (!vao || !buffer || !indexBuffer || !texture)
        throw new Error("Animation allocation failed");
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(positions),
        gl.STATIC_DRAW,
      );
      const location = gl.getAttribLocation(program, "a_pos");
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(indices),
        gl.STATIC_DRAW,
      );
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      element.width = Math.max(1, Math.round(element.clientWidth * scale));
      element.height = Math.max(1, Math.round(element.clientHeight * scale));
      gl.viewport(0, 0, element.width, element.height);
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.uniform1f(
        gl.getUniformLocation(program, "u_aspect"),
        element.width / element.height,
      );
      const time = gl.getUniformLocation(program, "u_time");
      gl.uniform1i(gl.getUniformLocation(program, "u_tex"), 0);
      gl.uniform1i(
        gl.getUniformLocation(program, "u_mode"),
        mode === "peel" ? 1 : 0,
      );
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );
      let start: number | undefined;
      const draw = (now: number) => {
        if (stopped) return;
        if (gl.isContextLost()) {
          finish();
          return;
        }
        start ??= now;
        const t = Math.min(1, (now - start) / duration);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(time, t);
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        if (t >= 1) finish();
        else frame = requestAnimationFrame(draw);
      };
      const image = new Image();
      release.push(() => {
        image.onload = null;
        image.onerror = null;
        image.src = "";
      });
      image.onload = () => {
        if (stopped) return;
        try {
          clearTimeout(loadTimeout);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          // HTML images use a top-left origin; the mesh UVs use bottom-left.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image,
          );
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          frame = requestAnimationFrame(draw);
        } catch {
          finish();
        }
      };
      image.onerror = finish;
      loadTimeout = setTimeout(finish, 2000);
      image.src = src;
    } catch {
      finish();
    }
    return cleanup;
  }, [src, mode, duration]);
  return (
    <canvas
      ref={canvas}
      className={"page-crumple " + mode}
      width={720}
      height={540}
    />
  );
}
