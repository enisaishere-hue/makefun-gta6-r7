// Solmar Bay — cars: low-poly box-built vehicles, arcade driving physics,
// traffic that follows the road grid. No libraries.
import { MeshBuilder } from './gl.js';
import { RNG, clamp, angleDiff } from './util.js';
import { resolveCircle, ROAD_LINES, randomRoadSpawn } from './city.js';

export const CAR_COLORS = {
  sedan: [[0.75, 0.15, 0.15], [0.15, 0.35, 0.75], [0.85, 0.85, 0.85], [0.25, 0.25, 0.28], [0.75, 0.55, 0.15]],
  coupe: [[0.85, 0.1, 0.12], [0.95, 0.75, 0.2], [0.1, 0.6, 0.65]],
  truck: [[0.6, 0.6, 0.62], [0.4, 0.55, 0.3], [0.7, 0.4, 0.2]],
  taxi: [[0.95, 0.8, 0.1]],
  police: [[0.92, 0.92, 0.92]],
};

function buildCarMesh(gl, kind, color) {
  const b = new MeshBuilder();
  const dark = [0.08, 0.09, 0.12];
  const glass = [0.15, 0.22, 0.30];
  const tyre = [0.05, 0.05, 0.06];
  const isTruck = kind === 'truck';
  const bodyH = isTruck ? 1.1 : 0.62;
  const bodyY = isTruck ? 0.95 : 0.55;
  const len = isTruck ? 5.4 : 4.4;
  // Body + cabin + wheels + lights.
  b.box(0, bodyY, 0, 2.0, bodyH, len, color, color, [1, 1]);
  if (isTruck) {
    b.box(0, 1.9, -0.9, 1.9, 0.9, 2.2, color, color, [1, 1]);
    b.box(0, 1.05, 1.6, 1.9, 1.0, 1.6, [0.55, 0.55, 0.58], [0.55, 0.55, 0.58], [1, 1]);
  } else {
    b.box(0, bodyY + 0.5, -0.3, 1.7, 0.55, 2.3, glass, glass, [1, 1]);
  }
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    b.box(wx, 0.35, wz, 0.28, 0.7, 0.85, tyre, tyre, [1, 1]);
  }
  // Headlights (front = -z in car space) and taillights.
  const hl = [1.0, 0.95, 0.7];
  const tl = [0.9, 0.08, 0.08];
  b.box(-0.65, 0.62, -len / 2 - 0.02, 0.45, 0.18, 0.06, hl, hl, [1, 1]);
  b.box(0.65, 0.62, -len / 2 - 0.02, 0.45, 0.18, 0.06, hl, hl, [1, 1]);
  b.box(-0.65, 0.62, len / 2 + 0.02, 0.45, 0.18, 0.06, tl, tl, [1, 1]);
  b.box(0.65, 0.62, len / 2 + 0.02, 0.45, 0.18, 0.06, tl, tl, [1, 1]);
  if (kind === 'police') {
    b.box(0, 0.62, 0, 2.02, 0.3, 1.1, dark, dark, [1, 1]); // black band
    b.box(-0.4, 1.42, -0.3, 0.5, 0.22, 0.4, [0.95, 0.1, 0.1], [0.95, 0.1, 0.1], [1, 1]);
    b.box(0.4, 1.42, -0.3, 0.5, 0.22, 0.4, [0.1, 0.3, 1.0], [0.1, 0.3, 1.0], [1, 1]);
  }
  if (kind === 'taxi') {
    b.box(0, 1.42, -0.3, 0.7, 0.25, 0.4, [0.95, 0.8, 0.1], [0.95, 0.8, 0.1], [1, 1]);
  }
  return b.build(gl);
}

export class Car {
  constructor(gl, kind, color, pos, heading) {
    this.kind = kind;
    this.color = color;
    this.pos = [pos[0], 0, pos[2]];
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.mesh = buildCarMesh(gl, kind, color);
    this.isPlayer = false;
    this.isPolice = kind === 'police';
    this.route = null; // traffic: {axis, dir, road}
    this.targetSpeed = 0;
    this.stopped = 0;
    this.smashed = 0; // seconds of smoke after a hard hit
    this.dead = false;
  }
  forward() {
    return [Math.sin(this.heading), 0, Math.cos(this.heading)];
  }
}

// Arcade car physics for the player's car.
export function updatePlayerCar(car, input, dt, city, others) {
  const accel = input.forward ? 16 : 0;
  const brake = input.back ? 26 : 0;
  if (input.forward) car.speed += accel * dt;
  if (input.back) {
    if (car.speed > 0.5) car.speed -= brake * dt;
    else car.speed -= 8 * dt; // reverse
  }
  if (!input.forward && !input.back) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 10 * dt);
  if (input.handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
  const maxF = 38, maxR = -10;
  car.speed = clamp(car.speed, maxR, maxF);
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const steerRate = input.handbrake ? 1.9 : 1.35;
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const spd = Math.abs(car.speed);
  const turn = car.steer * steerRate * (spd / 14) * (car.speed >= 0 ? 1 : -1);
  car.heading += turn * dt * Math.min(1, spd / 6 + 0.25);
  const f = car.forward();
  car.pos[0] += f[0] * car.speed * dt;
  car.pos[2] += f[2] * car.speed * dt;
  resolveCircle(city, car.pos, 1.6);
  // Car-car bumps.
  for (const o of others) {
    if (o === car || o.dead) continue;
    const dx = car.pos[0] - o.pos[0], dz = car.pos[2] - o.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      const nx = dx / d, nz = dz / d;
      car.pos[0] += nx * push; car.pos[2] += nz * push;
      o.pos[0] -= nx * push; o.pos[2] -= nz * push;
      if (Math.abs(car.speed) > 12) { car.smashed = 1.2; o.smashed = 1.2; }
      car.speed *= 0.82;
    }
  }
  if (car.smashed > 0) car.smashed -= dt;
}

// Traffic: cars cruise the road grid, turning at intersections, stopping
// for the car ahead.
export class Traffic {
  constructor(gl, city, rng) {
    this.gl = gl; this.city = city; this.rng = rng;
    this.cars = [];
  }
  spawnNear(pos, n) {
    for (let i = 0; i < n; i++) {
      const s = randomRoadSpawn(this.rng, pos, 220);
      const kind = this.rng.pick(['sedan', 'sedan', 'sedan', 'coupe', 'truck', 'taxi']);
      const color = this.rng.pick(CAR_COLORS[kind]);
      const car = new Car(this.gl, kind, color, s.pos, s.heading);
      car.targetSpeed = this.rng.range(8, 12);
      car.route = this.routeFrom(s.pos, s.heading);
      this.cars.push(car);
    }
  }
  routeFrom(pos, heading) {
    const sx = Math.abs(Math.sin(heading)) > 0.7;
    if (sx) {
      return { axis: 'x', dir: Math.sin(heading) > 0 ? 1 : -1, road: pos[2] };
    }
    return { axis: 'z', dir: Math.cos(heading) > 0 ? 1 : -1, road: pos[0] };
  }
  update(dt, playerPos, allCars) {
    for (const car of this.cars) {
      if (car.dead) continue;
      // Stop for the car ahead.
      let blocked = false;
      const f = car.forward();
      for (const o of allCars) {
        if (o === car || o.dead) continue;
        const dx = o.pos[0] - car.pos[0], dz = o.pos[2] - car.pos[2];
        const along = dx * f[0] + dz * f[2];
        const side = Math.abs(dx * f[2] - dz * f[0]);
        if (along > 0 && along < 9 && side < 2.2) { blocked = true; break; }
      }
      const want = blocked ? 0 : car.targetSpeed;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
      car.pos[0] += f[0] * car.speed * dt;
      car.pos[2] += f[2] * car.speed * dt;
      // At an intersection, maybe turn.
      const r = car.route;
      const along = r.axis === 'x' ? car.pos[0] : car.pos[2];
      const nextLine = this.nextRoadLine(along, r.dir);
      if (Math.abs(along - nextLine) < 1.2) {
        if (this.rng.chance(0.3)) {
          // Turn onto the crossing road.
          const cross = nextLine;
          const newDir = this.rng.chance(0.5) ? 1 : -1;
          const lane = newDir > 0 ? 3.5 : -3.5;
          if (r.axis === 'x') {
            car.route = { axis: 'z', dir: newDir, road: cross + lane };
            car.pos[0] = cross + lane;
            car.heading = newDir > 0 ? 0 : Math.PI;
          } else {
            car.route = { axis: 'x', dir: newDir, road: cross + lane };
            car.pos[2] = cross + lane;
            car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        } else {
          // Carry on; nudge onto the lane.
          if (r.axis === 'x') car.pos[2] += (r.road - car.pos[2]) * Math.min(1, dt * 2);
          else car.pos[0] += (r.road - car.pos[0]) * Math.min(1, dt * 2);
        }
      }
      // Keep inside the city; recycle far cars near the player.
      const d = Math.hypot(car.pos[0] - playerPos[0], car.pos[2] - playerPos[2]);
      if (d > 260) {
        const s = randomRoadSpawn(this.rng, playerPos, 220);
        car.pos = [s.pos[0], 0, s.pos[2]];
        car.heading = s.heading;
        car.route = this.routeFrom(s.pos, s.heading);
        car.speed = car.targetSpeed;
      }
      if (car.smashed > 0) car.smashed -= dt;
    }
  }
  nextRoadLine(along, dir) {
    if (dir > 0) {
      for (const l of ROAD_LINES) if (l > along + 2) return l;
      return ROAD_LINES[ROAD_LINES.length - 1];
    }
    for (let i = ROAD_LINES.length - 1; i >= 0; i--) {
      if (ROAD_LINES[i] < along - 2) return ROAD_LINES[i];
    }
    return ROAD_LINES[0];
  }
}
