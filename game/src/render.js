// Solmar Bay — the renderer: one shader, static city meshes, cars, people,
// particles and the mission beacon, all in raw WebGL.
import { Mat4 } from './util.js';
import { createMainProgram, drawMesh, MeshBuilder } from './gl.js';

export class Renderer {
  constructor(gl, canvas, cityMeshes) {
    this.gl = gl;
    this.canvas = canvas;
    this.P = createMainProgram(gl);
    this.cityMeshes = cityMeshes;
    // Unit box mesh for particles / markers.
    const b = new MeshBuilder();
    b.box(0, 0, 0, 1, 1, 1, [1, 1, 1], [1, 1, 1], [1, 1]);
    this.unitBox = b.build(gl);
    this.proj = Mat4.identity();
    this.view = Mat4.identity();
  }
  resize() {
    const w = this.canvas.clientWidth || 1280;
    const h = this.canvas.clientHeight || 720;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.proj = Mat4.perspective(1.05, this.canvas.width / this.canvas.height, 0.5, 900);
  }
  setSky(game) {
    const gl = this.gl;
    const dusk = game.timeOfDay === 'dusk';
    const sky = dusk ? [0.45, 0.25, 0.55] : [0.98, 0.55, 0.32];
    gl.clearColor(sky[0], sky[1], sky[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const P = this.P;
    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.uProj, false, this.proj);
    gl.uniformMatrix4fv(P.uView, false, this.view);
    gl.uniform3f(P.uLightDir, -0.45, 0.72, 0.35);
    gl.uniform3f(P.uFogColor, sky[0], sky[1], sky[2]);
    gl.uniform2f(P.uFogRange, 130, 480);
    gl.uniform3f(P.uSunColor, dusk ? 0.75 : 1.0, dusk ? 0.5 : 0.72, dusk ? 0.6 : 0.42);
    gl.uniform1f(P.uAmbient, dusk ? 0.5 : 0.42);
  }
  drawStatic() {
    const gl = this.gl, P = this.P;
    const I = Mat4.identity();
    const cm = this.cityMeshes;
    drawMesh(gl, P, cm.groundMesh.mesh, I, cm.groundMesh.texture);
    drawMesh(gl, P, cm.sandMesh.mesh, I, cm.sandMesh.texture);
    drawMesh(gl, P, cm.waterMesh.mesh, I, null);
    drawMesh(gl, P, cm.roadMesh.mesh, I, cm.roadMesh.texture);
    drawMesh(gl, P, cm.buildingMesh.mesh, I, cm.buildingMesh.texture);
    drawMesh(gl, P, cm.propMesh.mesh, I, null);
  }
  drawCar(car) {
    const m = Mat4.compose(car.pos, car.heading + Math.PI, 0, 0, null);
    drawMesh(this.gl, this.P, car.mesh, m, null);
  }
  drawPerson(meshes, pos, heading, walkPhase, moving) {
    const gl = this.gl, P = this.P;
    const base = Mat4.compose(pos, heading, 0, 0, null);
    drawMesh(gl, P, meshes.torso, base, null);
    const swing = moving ? Math.sin(walkPhase) * 0.55 : 0;
    const hipY = 0.78;
    for (const [mesh, s] of [[meshes.legL, swing], [meshes.legR, -swing]]) {
      let m = Mat4.multiply(base, Mat4.translate(0, hipY, 0));
      m = Mat4.multiply(m, Mat4.rotateX(s));
      m = Mat4.multiply(m, Mat4.translate(0, -hipY, 0));
      drawMesh(gl, P, mesh, m, null);
    }
  }
  drawParticles(particles) {
    const gl = this.gl, P = this.P;
    for (const pt of particles) {
      if (pt.life <= 0) continue;
      const s = pt.size * (0.5 + pt.life / pt.maxLife);
      const m = Mat4.compose(pt.pos, 0, 0, 0, [s, s, s]);
      // Tint via a fresh uniform is not available; bake colour into a tiny
      // mesh per colour bucket instead — here we reuse the unit box with a
      // colour matrix trick: draw with the particle colour by swapping the
      // mesh is overkill, so particles use a fixed smoke/spark palette via
      // the unit box's white vertices and a per-draw colour stored on the
      // particle as an RGB scale applied through the model matrix is not
      // possible; instead the fragment colour comes from vertex colour, so
      // we keep three prebuilt tinted unit boxes.
      drawMesh(gl, P, this.particleMesh(pt), m, null);
    }
  }
  particleMesh(pt) {
    const key = pt.kind;
    if (!this._pMeshes) this._pMeshes = {};
    if (!this._pMeshes[key]) {
      const col = key === 'smoke' ? [0.55, 0.55, 0.58] : key === 'spark' ? [1.0, 0.8, 0.25] : key === 'blood' ? [0.7, 0.08, 0.08] : [1.0, 0.95, 0.6];
      const b = new MeshBuilder();
      b.box(0, 0, 0, 1, 1, 1, col, col, [1, 1]);
      this._pMeshes[key] = b.build(this.gl);
    }
    return this._pMeshes[key];
  }
  drawBeacon(pos, time) {
    if (!pos) return;
    const gl = this.gl, P = this.P;
    const pulse = 0.75 + Math.sin(time * 4) * 0.25;
    // Light pillar.
    const pillar = Mat4.compose([pos[0], 22, pos[2]], 0, 0, 0, [2.2 * pulse, 44, 2.2 * pulse]);
    drawMesh(gl, P, this.beaconMesh('pillar'), pillar, null);
    // Floating diamond.
    const y = 5 + Math.sin(time * 2) * 0.7;
    let d = Mat4.compose([pos[0], y, pos[2]], time * 1.5, 0, 0, [1.6, 1.6, 1.6]);
    drawMesh(gl, P, this.beaconMesh('diamond'), d, null);
  }
  beaconMesh(kind) {
    if (!this._bMeshes) this._bMeshes = {};
    if (!this._bMeshes[kind]) {
      const col = [1.0, 0.82, 0.15];
      const b = new MeshBuilder();
      if (kind === 'pillar') b.box(0, 0, 0, 1, 1, 1, col, col, [1, 1]);
      else {
        // Diamond: two pyramids via boxes rotated 45 degrees is close
        // enough at this scale; use a small bright box.
        b.box(0, 0, 0, 1, 1, 1, [1.0, 0.9, 0.3], [1.0, 0.9, 0.3], [1, 1]);
      }
      this._bMeshes[kind] = b.build(this.gl);
    }
    return this._bMeshes[kind];
  }
  render(game, camera) {
    this.resize();
    this.view = Mat4.lookAt(camera.eye, camera.center, [0, 1, 0]);
    this.setSky(game);
    this.drawStatic();
    for (const car of game.allCars()) this.drawCar(car);
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      this.drawPerson(ped.meshes, ped.pos, ped.heading, ped.walkPhase, true);
    }
    for (const cop of game.police.cops) {
      this.drawPerson(cop.meshes, cop.pos, cop.heading, cop.walkPhase, true);
    }
    const pl = game.player;
    if (pl.onFoot) {
      this.drawPerson(pl.meshes, pl.pos, pl.heading, pl.walkPhase, pl.speed > 0.3);
    }
    this.drawParticles(game.particles);
    const target = game.missionTarget();
    // The beacon pillar is a gameplay aid; screenshot presets can hide it
    // when it would stand directly in front of the subject.
    if (target && !game.hideBeacon) this.drawBeacon(target, game.time);
  }
}
