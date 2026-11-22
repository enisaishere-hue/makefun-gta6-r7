// Solmar Bay — wanted level + police: pursuit cars, foot cops, busts, and
// the Spray & Go paint shop that clears your heat.
import { Car } from './vehicles.js';
import { buildPersonMeshes } from './people.js';
import { RNG, clamp, angleLerp } from './util.js';
import { resolveCircle, randomRoadSpawn } from './city.js';

export class Wanted {
  constructor() {
    this.heat = 0;
    this.level = 0;
    this.lastCrime = -100;
  }
  addHeat(n, now) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.lastCrime = now;
    this.level = this.heat < 15 ? 0 : this.heat < 35 ? 1 : this.heat < 55 ? 2 : this.heat < 75 ? 3 : this.heat < 90 ? 4 : 5;
  }
  decay(dt, now, calm) {
    if (now - this.lastCrime > 12 && calm) {
      this.heat = Math.max(0, this.heat - dt * 1.6);
      this.level = this.heat < 15 ? 0 : this.heat < 35 ? 1 : this.heat < 55 ? 2 : this.heat < 75 ? 3 : this.heat < 90 ? 4 : 5;
    }
  }
}

export class Police {
  constructor(gl, city) {
    this.gl = gl; this.city = city;
    this.rng = new RNG(4242);
    this.cars = [];
    this.cops = [];
    this.spawnTimer = 0;
  }
  clear() {
    this.cars = [];
    this.cops = [];
  }
  update(dt, game) {
    const wanted = game.wanted;
    const playerPos = game.playerPos();
    const now = game.time;
    // Spawn pursuit cars.
    this.spawnTimer -= dt;
    const maxCars = Math.min(4, wanted.level);
    if (wanted.level > 0 && this.cars.length < maxCars && this.spawnTimer <= 0) {
      const s = randomRoadSpawn(this.rng, playerPos, 200);
      const car = new Car(this.gl, 'police', [0.92, 0.92, 0.92], s.pos, s.heading);
      car.isPolice = true;
      car.targetSpeed = 30 + wanted.level * 1.5;
      this.cars.push(car);
      this.spawnTimer = 2.5;
    }
    // Chase: steer at the player, ram to slow them down.
    for (const car of this.cars) {
      const dx = playerPos[0] - car.pos[0], dz = playerPos[2] - car.pos[2];
      const d = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      car.heading = angleLerp(car.heading, wantHeading, Math.min(1, dt * 2.2));
      const target = d > 6 ? car.targetSpeed : 12;
      car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
      const f = car.forward();
      car.pos[0] += f[0] * car.speed * dt;
      car.pos[2] += f[2] * car.speed * dt;
      resolveCircle(this.city, car.pos, 1.6);
      if (d > 280) car.dead = true;
      if (car.smashed > 0) car.smashed -= dt;
    }
    this.cars = this.cars.filter((c) => !c.dead);
    // Foot cops when the player is on foot and wanted.
    const onFoot = game.player.onFoot;
    const maxCops = onFoot ? Math.min(3, wanted.level) : 0;
    if (wanted.level > 0 && onFoot && this.cops.length < maxCops && this.spawnTimer <= -1) {
      const a = this.rng.range(0, Math.PI * 2);
      const pos = [playerPos[0] + Math.sin(a) * 38, 0, playerPos[2] + Math.cos(a) * 38];
      resolveCircle(this.city, pos, 0.5);
      const cop = {
        pos, heading: 0, walkPhase: 0,
        meshes: buildPersonMeshes(this.gl, [0.1, 0.15, 0.45], [0.1, 0.12, 0.2], [0.85, 0.65, 0.5]),
      };
      this.cops.push(cop);
      this.spawnTimer = 1;
    }
    let nearestCop = Infinity;
    for (const cop of this.cops) {
      const dx = playerPos[0] - cop.pos[0], dz = playerPos[2] - cop.pos[2];
      const d = Math.hypot(dx, dz);
      nearestCop = Math.min(nearestCop, d);
      const wantHeading = Math.atan2(dx, dz);
      cop.heading = angleLerp(cop.heading, wantHeading, Math.min(1, dt * 5));
      const spd = d > 2 ? 5.4 : 0;
      cop.pos[0] += Math.sin(cop.heading) * spd * dt;
      cop.pos[2] += Math.cos(cop.heading) * spd * dt;
      cop.walkPhase += spd * dt * 3;
      resolveCircle(this.city, cop.pos, 0.5);
      // A cop that catches a slow player starts the bust.
      if (d < 2.4 && game.player.speed < 1.5 && game.player.onFoot) {
        game.player.busted += dt / 2.5;
        if (game.player.busted >= 1) game.setState('busted');
      }
      if (d > 120) cop.dead = true;
    }
    this.cops = this.cops.filter((c) => !c.dead);
    // Heat decays when calm: no police near, no recent crime.
    const calm = this.cars.length === 0 && this.cops.length === 0;
    wanted.decay(dt, now, calm);
    if (wanted.level === 0) {
      this.cars = [];
      this.cops = [];
    }
    return { siren: this.cars.length > 0 || this.cops.length > 0, nearestCop };
  }
}
