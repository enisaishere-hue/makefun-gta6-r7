// Solmar Bay — tiny raw-WebGL renderer: one shader, vertex colours + optional
// texture, one directional sun + fog. No libraries, no network.
import { Mat4 } from './util.js';

const VS = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor; attribute vec2 aUV;
uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj;
varying vec3 vNormal; varying vec3 vColor; varying vec2 vUV; varying float vDist;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vNormal = mat3(uModel) * aNormal;
  vColor = aColor; vUV = aUV;
  vec4 vp = uView * wp;
  vDist = -vp.z;
  gl_Position = uProj * vp;
}`;

const FS = `
precision mediump float;
varying vec3 vNormal; varying vec3 vColor; varying vec2 vUV; varying float vDist;
uniform vec3 uLightDir; uniform vec3 uFogColor; uniform vec2 uFogRange;
uniform sampler2D uTex; uniform float uUseTex; uniform vec3 uSunColor; uniform float uAmbient;
void main(){
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, normalize(uLightDir)), 0.0);
  vec3 tex = uUseTex > 0.5 ? texture2D(uTex, vUV).rgb : vec3(1.0);
  vec3 col = vColor * tex * (uAmbient + uSunColor * diff);
  float f = smoothstep(uFogRange.x, uFogRange.y, vDist);
  gl_FragColor = vec4(mix(col, uFogColor, f), 1.0);
}`;

export function initGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) throw new Error('WebGL unavailable');
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.98, 0.55, 0.32, 1.0);
  return gl;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

export function createMainProgram(gl) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  return {
    prog,
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNormal: gl.getAttribLocation(prog, 'aNormal'),
    aColor: gl.getAttribLocation(prog, 'aColor'),
    aUV: gl.getAttribLocation(prog, 'aUV'),
    uModel: gl.getUniformLocation(prog, 'uModel'),
    uView: gl.getUniformLocation(prog, 'uView'),
    uProj: gl.getUniformLocation(prog, 'uProj'),
    uLightDir: gl.getUniformLocation(prog, 'uLightDir'),
    uFogColor: gl.getUniformLocation(prog, 'uFogColor'),
    uFogRange: gl.getUniformLocation(prog, 'uFogRange'),
    uTex: gl.getUniformLocation(prog, 'uTex'),
    uUseTex: gl.getUniformLocation(prog, 'uUseTex'),
    uSunColor: gl.getUniformLocation(prog, 'uSunColor'),
    uAmbient: gl.getUniformLocation(prog, 'uAmbient'),
  };
}

// Accumulates triangles, then uploads once. Positions/normals/colours/uvs are
// flat arrays; indices reference vertices.
export class MeshBuilder {
  constructor() {
    this.pos = []; this.norm = []; this.col = []; this.uv = []; this.idx = [];
  }
  vert(x, y, z, nx, ny, nz, r, g, b, u, v) {
    this.pos.push(x, y, z);
    this.norm.push(nx, ny, nz);
    this.col.push(r, g, b);
    this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  // One quad (two triangles), counter-clockwise when seen from its normal side.
  quad(a, b, c, d, n, color, uvRect) {
    const [u0, v0, u1, v1] = uvRect || [0, 0, 1, 1];
    const i0 = this.vert(a[0], a[1], a[2], n[0], n[1], n[2], color[0], color[1], color[2], u0, v0);
    const i1 = this.vert(b[0], b[1], b[2], n[0], n[1], n[2], color[0], color[1], color[2], u1, v0);
    const i2 = this.vert(c[0], c[1], c[2], n[0], n[1], n[2], color[0], color[1], color[2], u1, v1);
    const i3 = this.vert(d[0], d[1], d[2], n[0], n[1], n[2], color[0], color[1], color[2], u0, v1);
    this.idx.push(i0, i1, i2, i0, i2, i3);
  }
  // Axis-aligned box centred at (cx, cy, cz) with size (w, h, d).
  // sideColor tints the walls, topColor the roof; uvScale tiles the wall texture.
  box(cx, cy, cz, w, h, d, sideColor, topColor, uvScale) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    const z0 = cz - d / 2, z1 = cz + d / 2;
    const su = (uvScale && uvScale[0]) || 1;
    const sv = (uvScale && uvScale[1]) || 1;
    const top = topColor || sideColor;
    // +z face
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], sideColor, [0, 0, su, sv]);
    // -z face
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], sideColor, [0, 0, su, sv]);
    // +x face
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], sideColor, [0, 0, su, sv]);
    // -x face
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], sideColor, [0, 0, su, sv]);
    // +y (roof)
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], top, [0, 0, 1, 1]);
    // -y (floor, rarely seen)
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], sideColor, [0, 0, 1, 1]);
  }
  // Vertical cylinder (8 segments) centred at (cx, cy, cz), radius r, height h.
  cylinder(cx, cy, cz, r, h, color) {
    const seg = 8;
    const y0 = cy - h / 2, y1 = cy + h / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const nx0 = Math.cos(a0), nz0 = Math.sin(a0);
      const nx1 = Math.cos(a1), nz1 = Math.sin(a1);
      const p0 = [cx + nx0 * r, y0, cz + nz0 * r];
      const p1 = [cx + nx1 * r, y0, cz + nz1 * r];
      const p2 = [cx + nx1 * r, y1, cz + nz1 * r];
      const p3 = [cx + nx0 * r, y1, cz + nz0 * r];
      const n = [nx0 * 0.5 + nx1 * 0.5, 0, nz0 * 0.5 + nz1 * 0.5];
      const nl = Math.hypot(n[0], n[2]) || 1;
      this.quad(p0, p1, p2, p3, [n[0] / nl, 0, n[2] / nl], color, [0, 0, 1, 1]);
    }
    // top cap
    const c = this.vert(cx, y1, cz, 0, 1, 0, color[0], color[1], color[2], 0.5, 0.5);
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      const i0 = this.vert(cx + Math.cos(a0) * r, y1, cz + Math.sin(a0) * r, 0, 1, 0, color[0], color[1], color[2], 0, 0);
      const i1 = this.vert(cx + Math.cos(a1) * r, y1, cz + Math.sin(a1) * r, 0, 1, 0, color[0], color[1], color[2], 1, 0);
      this.idx.push(c, i0, i1);
    }
  }
  build(gl) {
    if (this.pos.length / 3 > 65535) {
      throw new Error('mesh too big for 16-bit indices: ' + this.pos.length / 3 + ' vertices');
    }
    const mesh = { count: this.idx.length };
    const mk = (data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      return { buf: b, size };
    };
    mesh.pos = mk(this.pos, 3);
    mesh.norm = mk(this.norm, 3);
    mesh.col = mk(this.col, 3);
    mesh.uv = mk(this.uv, 2);
    mesh.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    // 16-bit indices: WebGL1 draws UNSIGNED_SHORT without extensions.
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.idx), gl.STATIC_DRAW);
    return mesh;
  }
}

export function drawMesh(gl, P, mesh, model, texture) {
  gl.useProgram(P.prog);
  gl.uniformMatrix4fv(P.uModel, false, model);
  // uUseTex is a FLOAT uniform in the shader, so it must be set with
  // uniform1f — uniform1i on a float uniform is INVALID_OPERATION in
  // WebGL1 (error 1282) and silently leaves the uniform at 0, which made
  // every textured mesh render as a flat vertex colour. (The sampler
  // uTex below is an int uniform, so uniform1i is correct for it.)
  gl.uniform1f(P.uUseTex, texture ? 1 : 0);
  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(P.uTex, 0);
  }
  const bind = (attr, a) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, a.buf);
    gl.enableVertexAttribArray(attr);
    gl.vertexAttribPointer(attr, a.size, gl.FLOAT, false, 0, 0);
  };
  bind(P.aPos, mesh.pos);
  bind(P.aNormal, mesh.norm);
  bind(P.aColor, mesh.col);
  bind(P.aUV, mesh.uv);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
}

// 2D-canvas texture: drawFn receives (ctx, w, h).
export function canvasTexture(gl, w, h, drawFn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  drawFn(c.getContext('2d'), w, h);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);
  return tex;
}

export { Mat4 };
