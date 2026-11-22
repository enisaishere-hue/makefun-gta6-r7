// Solmar Bay — people: pedestrians strolling the sidewalks (and fleeing
// trouble) plus the player on foot. Low-poly box people with swinging legs.
import { MeshBuilder } from './gl.js';
import { RNG, clamp, angleLerp } from './util.js';
import { resolveCircle } from './city.js';

const SHIRTS = [
  [0.85, 0.3, 0.3], [0.3, 0.55, 0.85], [0.9, 0.8, 0.3], [0.4, 0.75, 0.4],
  [0.85, 0.5, 0.75], [0.95, 0.95, 0.9], [0.25, 0.7, 0.7], [0.9, 0.55, 0.2],
];
const SKINS = [[0.85, 0.65, 0.5], [0.65, 0.45, 0.32], [0.95, 0.8, 0.65], [0.5, 0.35, 0.25]];

// Torso+head+arms in one mesh; legs are two small meshes swung by rotation.
export function buildPersonMeshes(gl, shirt, pants, skin) {
  const t = new MeshBuilder();
  // Torso.
  t.box(0, 1.08, 0, 0.52, 0.62, 0.3, shirt, shirt, [1, 1]);
  // Head + hair.
  t.box(0, 1.58, 0, 0.34, 0.34, 0.32, skin, skin, [1, 1]);
  t.box(0, 1.74, -0.02, 0.36, 0.12, 0.34, [0.15, 0.12, 0.1], [0.15, 0.12, 0.1], [1, 1]);
  // Arms.
  t.box(-0.34, 1.08, 0, 0.14, 0.55, 0.16, shirt, shirt, [1, 1]);
  t.box(0.34, 1.08, 0, 0.14, 0.55, 0.16, shirt, shirt, [1, 1]);
  const torso = t.build(gl);
  const legMesh = (x) => {
    const l = new MeshBuilder();
    l.box(x, -0.28, 0, 0.18, 0.56, 0.2, pants, pants, [1, 1]);
    return l.build(gl);
  };
  return { torso, legL: legMesh(-0.13), legR: legMesh(0.13) };
}

export class Ped {
  constructor(gl, city, rng) {
    this.city = city;
    this.shirt = rng.pick(SHIRTS);
    this.pants = rng.pick([[0.2, 0.22, 0.3], [0.45, 0.35, 0.25], [0.6, 0.6, 0.62]]);
    this.skin = rng.pick(SKINS);
    this.meshes = buildPersonMeshes(gl, this.shirt, this.pants, this.skin);
    const p = rng.pick(city.sidewalkPoints);
    this.pos = [p[0] + rng.range(-2, 2), 0, p[1] + rng.range(-2, 2)];
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.1, 1.9);
    this.walkPhase = rng.range(0, Math.PI * 2);
    this.target = this.pickTarget(rng);
    this.state = 'walk'; // walk | flee | down
    this.fleeTimer = 0;
    this.health = 100;
    this.dead = false;
  }
  pickTarget(rng) {
    return rng.pick(this.city.sidewalkPoints);
  }
  scare(fromPos) {
    if (this.state === 'down') return;
    this.state = 'flee';
    this.fleeTimer = 3;
    const dx = this.pos[0] - fromPos[0], dz = this.pos[2] - fromPos[2];
    const d = Math.hypot(dx, dz) || 1;
    this.fleeDir = [dx / d, dz / d];
  }
  update(dt, rng, threats) {
    if (this.state === 'down') return;
    for (const t of threats) {
      const d = Math.hypot(this.pos[0] - t[0], this.pos[2] - t[2]);
      if (d < 12 && this.state !== 'flee') this.scare(t);
    }
    let targetHeading = this.heading;
    let speed = this.speed;
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      targetHeading = Math.atan2(this.fleeDir[0], this.fleeDir[1]);
      speed = 4.2;
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      const dx = this.target[0] - this.pos[0], dz = this.target[1] - this.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        this.target = this.pickTarget(rng);
      } else {
        targetHeading = Math.atan2(dx, dz);
      }
    }
    this.heading = angleLerp(this.heading, targetHeading, Math.min(1, dt * 6));
    this.pos[0] += Math.sin(this.heading) * speed * dt;
    this.pos[2] += Math.cos(this.heading) * speed * dt;
    this.walkPhase += speed * dt * 3.2;
    resolveCircle(this.city, this.pos, 0.45);
  }
}

export class Player {
  constructor(gl) {
    this.meshes = buildPersonMeshes(gl, [0.1, 0.55, 0.6], [0.16, 0.18, 0.24], [0.85, 0.65, 0.5]);
    this.pos = [29, 0, 120];
    this.heading = Math.PI;
    this.speed = 0;
    this.walkPhase = 0;
    this.health = 100;
    this.onFoot = true;
    this.car = null;
    this.fireCooldown = 0;
    this.busted = 0; // 0..1 progress while a cop holds you
    this.money = 0;
  }
  updateOnFoot(input, camYaw, dt, city) {
    const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const sprint = input.sprint ? 1.7 : 1;
    const maxSpd = 4.2 * sprint;
    const mx = Math.sin(camYaw) * fwd + Math.cos(camYaw) * strafe;
    const mz = Math.cos(camYaw) * fwd - Math.sin(camYaw) * strafe;
    const ml = Math.hypot(mx, mz) || 1;
    const tx = (mx / ml) * maxSpd * (fwd || strafe ? 1 : 0);
    const tz = (mz / ml) * maxSpd * (fwd || strafe ? 1 : 0);
    this.speed = Math.hypot(tx, tz);
    if (this.speed > 0.1) {
      this.heading = angleLerp(this.heading, Math.atan2(tx, tz), Math.min(1, dt * 10));
      this.walkPhase += this.speed * dt * 2.6;
    }
    this.pos[0] += tx * dt;
    this.pos[2] += tz * dt;
    resolveCircle(city, this.pos, 0.5);
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this.busted > 0) this.busted = Math.max(0, this.busted - dt * 0.25);
  }
}
