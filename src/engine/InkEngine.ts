import type { BrushSize, Tool } from "../lib/model";
import { canvas, loadImage } from "../lib/images";

const vertex = `#version 300 es
precision highp float;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}`;
// WebGL adaptation of the mask/compositor approach found in the supplied FTCanvas
// shaders. Calibration constants below are web profiles, not recovered native values.
const fragment = `#version 300 es
precision highp float;
uniform sampler2D previousInk; uniform sampler2D previousMask; uniform sampler2D baseInk;
uniform sampler2D stampTex; uniform sampler2D noiseTex; uniform sampler2D edgeTex;
uniform vec2 resolution; uniform vec2 point; uniform vec2 direction;
uniform vec4 color; uniform float radius; uniform float strength; uniform float angle; uniform int mode;
layout(location=0) out vec4 ink; layout(location=1) out vec4 mask;
vec4 over(vec4 s,vec4 d){return s+d*(1.0-s.a);}
void main(){
 vec2 uv=gl_FragCoord.xy/resolution; vec4 old=texture(previousInk,uv);
 if(mode==-1){ink=old;mask=vec4(0);return;}
 vec2 p=vec2(gl_FragCoord.x,resolution.y-gl_FragCoord.y);vec2 q=(p-point)/radius;
 float a=(1.0-smoothstep(.84,1.0,length(q)));vec4 m=texture(previousMask,uv);vec4 base=texture(baseInk,uv);
 if(mode==5){
   float soft=exp(-dot(q,q)*3.5)*step(length(q),1.0)*strength;
   soft*=.75+.5*texture(noiseTex,p/256.0).r;
   vec2 d=direction/resolution*vec2(-1.,1.);vec2 px=2.0/resolution;
   vec4 b=texture(previousInk,clamp(uv+d,vec2(0),vec2(1)))*.4;
   b+=(texture(previousInk,clamp(uv+d+vec2(px.x,0),vec2(0),vec2(1)))+texture(previousInk,clamp(uv+d-vec2(px.x,0),vec2(0),vec2(1)))+texture(previousInk,clamp(uv+d+vec2(0,px.y),vec2(0),vec2(1)))+texture(previousInk,clamp(uv+d-vec2(0,px.y),vec2(0),vec2(1))))*.15;
   ink=mix(old,b,soft);mask=m;return;
 }
 float coverage;
 if(mode==2){
   vec2 coord=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q*.5+.5;
   float stamp=texture(stampTex,clamp(coord,vec2(0),vec2(1))).a*a;
   vec4 noise=texture(noiseTex,p/512.0);
   float grain=clamp(noise.r*1.6+noise.b*.65+.1,0.,1.);
   coverage=1.-(1.-m.r)*(1.-stamp*grain*strength);
 }else if(mode==3){
   vec2 coord=q*.5+.5;
   float fill=texture(stampTex,clamp(coord,vec2(0),vec2(1))).a;
   vec2 rot=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q*.5+.5;
   float edge=texture(edgeTex,clamp(rot,vec2(0),vec2(1))).a;
   float wet=clamp(base.a,0.,1.);
   float aw=1.-smoothstep(.8,1.+.12*wet,length(q));
   float wash=aw*(.3+.38*fill+.28*edge)*strength*(1.+.3*wet);
   coverage=1.-(1.-m.r)*(1.-wash);
 }else{coverage=max(m.r,a*strength);}
 mask=vec4(coverage,0.,0.,coverage);
 if(mode==1){ink=base*(1.-coverage);return;}
 float opacity=coverage*color.a;
 if(mode==3){
   float rim=coverage*(1.-coverage)*4.0;
   float gran=texture(noiseTex,p/330.0).g;
   opacity=pow(coverage,.75)*color.a*(1.+.28*rim)*(.9+.2*gran*min(1.,coverage*1.6));
 }
 vec4 s=vec4(color.rgb*opacity,opacity);
 if(mode==4){
   vec3 mul=s.rgb*base.rgb+s.rgb*(1.-base.a)+base.rgb*(1.-s.a);
   ink=vec4(mix(mul,over(s,base).rgb,.15),s.a+base.a-s.a*base.a);
 }else{ink=over(s,base);}
}`;
type Target = { fbo: WebGLFramebuffer; ink: WebGLTexture; mask: WebGLTexture };
export interface Sample {
  x: number;
  y: number;
  pressure: number;
  tilt: number;
  time: number;
}
export class InkEngine {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private a: Target;
  private b: Target;
  private base: WebGLTexture;
  private baseFbo: WebGLFramebuffer;
  private textures = new Map<string, WebGLTexture>();
  private uniforms = new Map<string, WebGLUniformLocation>();
  private last: Sample | null = null;
  private previousRadius = 2;
  private speed = 0;
  private strokeDist = 0;
  private flow = 1;
  private alphaGain = 1;
  private colorBuf = new Float32Array(4);
  private tool: Tool = "draw";
  private size: BrushSize = "md";
  private color = [0, 0, 0, 1];
  private angle = 0;
  private destroyed = false;
  private loadRevision = 0;
  constructor(width: number, height: number) {
    this.canvas = canvas(width, height);
    const gl = this.canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
    });
    if (!gl)
      throw new Error(
        "This browser cannot start the drawing engine. Open Tinta in a recent Safari, Chrome, or Firefox.",
      );
    this.gl = gl;
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s) || "Shader compilation failed");
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex),
      fs = compile(gl.FRAGMENT_SHADER, fragment);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw new Error(
        gl.getProgramInfoLog(this.program) || "Could not start drawing.",
      );
    gl.useProgram(this.program);
    for (const name of [
      "previousInk",
      "previousMask",
      "baseInk",
      "stampTex",
      "noiseTex",
      "edgeTex",
      "resolution",
      "point",
      "direction",
      "color",
      "radius",
      "strength",
      "angle",
      "mode",
    ])
      this.uniforms.set(name, gl.getUniformLocation(this.program, name)!);
    [
      "previousInk",
      "previousMask",
      "baseInk",
      "stampTex",
      "noiseTex",
      "edgeTex",
    ].forEach((n, i) => gl.uniform1i(this.u(n), i));
    this.a = this.target();
    this.b = this.target();
    this.base = this.texture(width, height);
    this.baseFbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseFbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.base,
      0,
    );
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, width, height);
    gl.uniform2f(this.u("resolution"), width, height);
    const white = this.texture(1, 1);
    gl.bindTexture(gl.TEXTURE_2D, white);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    this.textures.set("white", white);
    this.clear();
  }
  private u(n: string) {
    return this.uniforms.get(n)!;
  }
  private texture(w: number, h: number) {
    const g = this.gl,
      t = g.createTexture()!;
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(
      g.TEXTURE_2D,
      0,
      g.RGBA8,
      w,
      h,
      0,
      g.RGBA,
      g.UNSIGNED_BYTE,
      null,
    );
    return t;
  }
  private target(): Target {
    const g = this.gl;
    const t = {
      fbo: g.createFramebuffer()!,
      ink: this.texture(this.canvas.width, this.canvas.height),
      mask: this.texture(this.canvas.width, this.canvas.height),
    };
    g.bindFramebuffer(g.FRAMEBUFFER, t.fbo);
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT0,
      g.TEXTURE_2D,
      t.ink,
      0,
    );
    g.framebufferTexture2D(
      g.FRAMEBUFFER,
      g.COLOR_ATTACHMENT1,
      g.TEXTURE_2D,
      t.mask,
      0,
    );
    g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]);
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE)
      throw new Error("Drawing buffer is unavailable.");
    return t;
  }
  async prepare() {
    for (const n of [
      "SketchStamp",
      "SketchNoise",
      "WatercolorFill",
      "WatercolorEdge",
    ]) {
      const im = await loadImage(
        import.meta.env.BASE_URL + "assets/textures/" + n + ".png",
      );
      if (this.destroyed) return;
      const g = this.gl,
        t = this.texture(im.width, im.height);
      g.bindTexture(g.TEXTURE_2D, t);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, im);
      if (n === "SketchNoise") {
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
      }
      this.textures.set(n, t);
    }
  }
  clear() {
    const g = this.gl;
    g.disable(g.SCISSOR_TEST);
    for (const t of [this.a, this.b]) {
      g.bindFramebuffer(g.FRAMEBUFFER, t.fbo);
      g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
    }
    this.present();
  }
  async load(src: string) {
    const revision = ++this.loadRevision;
    if (!src) {
      this.clear();
      return;
    }
    const im = await loadImage(src);
    if (this.destroyed || revision !== this.loadRevision) return;
    const c = canvas(this.canvas.width, this.canvas.height);
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    this.loadCanvas(c);
  }
  loadCanvas(c: HTMLCanvasElement) {
    this.loadRevision++;
    const g = this.gl;
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    for (const t of [this.a, this.b]) {
      g.bindTexture(g.TEXTURE_2D, t.ink);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, c);
    }
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.present();
  }
  begin(tool: Tool, size: BrushSize, hex: string, sample: Sample) {
    this.tool = tool;
    this.size = size;
    this.color = [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
      tool === "color"
        ? 0.48
        : tool === "sketch"
          ? 0.88
          : tool === "marker"
            ? 0.68
            : 1,
    ];
    this.angle = (sample.x * 0.03 + sample.y * 0.07) % 6.28;
    const g = this.gl,
      w = this.canvas.width,
      h = this.canvas.height;
    g.disable(g.SCISSOR_TEST);
    g.bindFramebuffer(g.READ_FRAMEBUFFER, this.a.fbo);
    g.readBuffer(g.COLOR_ATTACHMENT0);
    g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.baseFbo);
    g.drawBuffers([g.COLOR_ATTACHMENT0]);
    g.blitFramebuffer(0, 0, w, h, 0, 0, w, h, g.COLOR_BUFFER_BIT, g.NEAREST);
    for (const t of [this.a, this.b]) {
      g.bindFramebuffer(g.FRAMEBUFFER, t.fbo);
      g.drawBuffers([g.NONE, g.COLOR_ATTACHMENT1]);
      g.clearColor(0, 0, 0, 0);
      g.clear(g.COLOR_BUFFER_BIT);
    }
    this.last = sample;
    this.speed = 0;
    this.strokeDist = 0;
    this.previousRadius = this.dynamics(sample);
    this.dab(sample, this.previousRadius, 0, 0);
  }
  private dynamics(s: Sample) {
    const multiplier = { sm: 0.55, md: 1, lg: 1.8 }[this.size];
    const base: Partial<Record<Tool, number>> = {
      draw: 4,
      write: 2.3,
      erase: 18,
      blend: 25,
      sketch: 3.8,
      marker: 16,
      color: 30,
    };
    const p = s.pressure || 0.5;
    const v = this.speed;
    let r = (base[this.tool] || 4) * multiplier;
    this.flow = 1;
    this.alphaGain = 1;
    switch (this.tool) {
      case "draw":
        r *= Math.max(0.3, 1.2 - v * 0.12) * (0.5 + p);
        break;
      case "sketch":
        r *= (0.5 + p + s.tilt / 28) * Math.max(0.55, 1.12 - v * 0.09);
        this.flow = Math.max(0.5, 1.08 - v * 0.08);
        break;
      case "write":
        r *= (0.75 + 0.5 * p) * Math.max(0.62, 1.06 - v * 0.055);
        break;
      case "marker": {
        const startTaper = Math.min(1, 0.7 + this.strokeDist / (r * 5));
        const tip = Math.min(1, 0.82 + v * 0.3);
        r *= (0.9 + 0.2 * p) * startTaper * tip;
        this.alphaGain = 1 + 0.15 * Math.exp(-v * 1.2);
        break;
      }
      case "color":
        r *= (0.85 + 0.3 * p) * (1 + Math.min(0.3, v * 0.05));
        this.flow = (0.7 + 0.9 * Math.exp(-v * 0.6)) * (0.6 + 0.8 * p);
        break;
      case "erase":
        r *= (0.8 + 0.4 * p) * (1 + Math.min(0.5, v * 0.06));
        break;
      case "blend":
        r *= 1 + Math.min(0.45, v * 0.05);
        break;
    }
    return Math.max(0.7, r);
  }
  append(s: Sample) {
    if (!this.last) return;
    const last = this.last;
    const dx = s.x - last.x,
      dy = s.y - last.y;
    const d = Math.hypot(dx, dy),
      dt = Math.max(1, s.time - last.time);
    this.speed += (d / dt - this.speed) * Math.min(1, dt / 45);
    this.strokeDist += d;
    const radius = this.dynamics(s);
    const steps = Math.max(
      1,
      Math.ceil(d / Math.max(1, Math.min(radius, this.previousRadius) * 0.28)),
    );
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.dab(
        { ...s, x: last.x + dx * t, y: last.y + dy * t },
        this.previousRadius + (radius - this.previousRadius) * t,
        dx / steps,
        dy / steps,
      );
    }
    this.last = s;
    this.previousRadius = radius;
  }
  private bindTexture(unit: number, tex: WebGLTexture) {
    const g = this.gl;
    g.activeTexture(g.TEXTURE0 + unit);
    g.bindTexture(g.TEXTURE_2D, tex);
  }
  private dab(s: Sample, r: number, dx: number, dy: number) {
    const g = this.gl,
      w = this.canvas.width,
      h = this.canvas.height;
    const pad = this.tool === "color" ? r * 0.15 + 3 : 3;
    const x = Math.max(0, Math.floor(s.x - r - pad)),
      y = Math.max(0, Math.floor(h - s.y - r - pad));
    const right = Math.min(w, Math.ceil(s.x + r + pad)),
      top = Math.min(h, Math.ceil(h - s.y + r + pad));
    if (right <= x || top <= y) return;
    g.useProgram(this.program);
    g.bindFramebuffer(g.FRAMEBUFFER, this.b.fbo);
    g.drawBuffers([g.COLOR_ATTACHMENT0, g.COLOR_ATTACHMENT1]);
    g.enable(g.SCISSOR_TEST);
    g.scissor(x, y, right - x, top - y);
    this.bindTexture(0, this.a.ink);
    this.bindTexture(1, this.a.mask);
    this.bindTexture(2, this.base);
    this.bindTexture(
      3,
      this.textures.get(
        this.tool === "sketch" ? "SketchStamp" : "WatercolorFill",
      ) || this.textures.get("white")!,
    );
    this.bindTexture(
      4,
      this.textures.get("SketchNoise") || this.textures.get("white")!,
    );
    this.bindTexture(
      5,
      this.textures.get("WatercolorEdge") || this.textures.get("white")!,
    );
    g.uniform1i(
      this.u("mode"),
      this.tool === "erase"
        ? 1
        : this.tool === "sketch"
          ? 2
          : this.tool === "color"
            ? 3
            : this.tool === "marker"
              ? 4
              : this.tool === "blend"
                ? 5
                : 0,
    );
    g.uniform2f(this.u("point"), s.x, s.y);
    g.uniform2f(this.u("direction"), dx * 0.7, dy * 0.7);
    this.colorBuf[0] = this.color[0];
    this.colorBuf[1] = this.color[1];
    this.colorBuf[2] = this.color[2];
    this.colorBuf[3] = Math.min(1, this.color[3] * this.alphaGain);
    g.uniform4fv(this.u("color"), this.colorBuf);
    g.uniform1f(this.u("radius"), r);
    g.uniform1f(
      this.u("strength"),
      (this.tool === "color"
        ? 0.13
        : this.tool === "sketch"
          ? 0.38
          : this.tool === "blend"
            ? 0.65
            : 1) * this.flow,
    );
    g.uniform1f(this.u("angle"), this.angle);
    g.drawArrays(g.TRIANGLES, 0, 3);
    g.bindFramebuffer(g.READ_FRAMEBUFFER, this.b.fbo);
    g.bindFramebuffer(g.DRAW_FRAMEBUFFER, this.a.fbo);
    for (let i = 0; i < 2; i++) {
      g.readBuffer(g.COLOR_ATTACHMENT0 + i);
      g.drawBuffers(
        i === 0 ? [g.COLOR_ATTACHMENT0] : [g.NONE, g.COLOR_ATTACHMENT1],
      );
      g.blitFramebuffer(
        x,
        y,
        right,
        top,
        x,
        y,
        right,
        top,
        g.COLOR_BUFFER_BIT,
        g.NEAREST,
      );
    }
    g.disable(g.SCISSOR_TEST);
  }
  present() {
    const g = this.gl;
    g.useProgram(this.program);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    g.drawBuffers([g.BACK]);
    g.disable(g.SCISSOR_TEST);
    g.uniform1i(this.u("mode"), -1);
    this.bindTexture(0, this.a.ink);
    this.bindTexture(1, this.a.mask);
    this.bindTexture(2, this.base);
    for (let i = 3; i < 6; i++)
      this.bindTexture(i, this.textures.get("white")!);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  end() {
    this.last = null;
    this.present();
    return this.canvas.toDataURL("image/png");
  }
  cancel() {
    const g = this.gl,
      w = this.canvas.width,
      h = this.canvas.height;
    g.disable(g.SCISSOR_TEST);
    g.bindFramebuffer(g.READ_FRAMEBUFFER, this.baseFbo);
    g.readBuffer(g.COLOR_ATTACHMENT0);
    for (const t of [this.a, this.b]) {
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, t.fbo);
      g.drawBuffers([g.COLOR_ATTACHMENT0]);
      g.blitFramebuffer(0, 0, w, h, 0, 0, w, h, g.COLOR_BUFFER_BIT, g.NEAREST);
    }
    this.last = null;
    this.present();
  }
  destroy() {
    this.destroyed = true;
    const g = this.gl;
    for (const t of [this.a, this.b]) {
      g.deleteFramebuffer(t.fbo);
      g.deleteTexture(t.ink);
      g.deleteTexture(t.mask);
    }
    for (const t of this.textures.values()) g.deleteTexture(t);
    g.deleteTexture(this.base);
    g.deleteFramebuffer(this.baseFbo);
    g.deleteProgram(this.program);
    g.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
