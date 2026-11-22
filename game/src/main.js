// Solmar Bay — Sunset Streets. Entry point: game loop, state machine,
// camera, crime, shooting, save/load, menus. Raw WebGL, no libraries.
import { initGL } from './gl.js';
import { generateCity, buildStaticMeshes, resolveCircle } from './city.js';
import { Car, Traffic, updatePlayerCar } from './vehicles.js';
import { Ped, Player } from './people.js';
import { Wanted, Police } from './police.js';
import { MissionController } from './missions.js';
import { AudioSys } from './audio.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { applyShot } from './shots.js';
import { runSelfTest } from './selftest.js';
import { RNG, clamp, angleLerp } from './util.js';

const SAVE_KEY = 'solmarbay.save.v1';

export class Game {
  constructor(canvas, seed) {
    this.canvas = canvas;
    this.gl = initGL(canvas);
    this.rng = new RNG(seed);
    this.city = generateCity(seed);
    this.cityMeshes = buildStaticMeshes(this.gl, this.city);
    this.renderer = new Renderer(this.gl, canvas, this.cityMeshes);
    this.player = new Player(this.gl);
    this.wanted = new Wanted();
    this.police = new Police(this.gl, this.city);
    this.traffic = new Traffic(this.gl, this.city, new RNG(seed + 7));
    this.missions = new MissionController(this);
    this.audio = new AudioSys();
    this.hud = new HUD();
    this.input = new Input(canvas);
    this.peds = [];
    this.worldCars = [];
    this.particles = [];
    this.state = 'menu';
    this.time = 0;
    this.framesRendered = 0;
    this.errorCount = 0;
    this.timeOfDay = 'sunset';
    this.hideBeacon = false; // screenshot presets hide the 3D beacon pillar when it would stand in front of the subject
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 11;
    this.lastDrag = -10;
    this.lastDamage = -100;
    this.testInput = null;
    this.save = this.loadSave();
    this.player.money = this.save.money || 0;
    this.missions.index = this.save.missionIndex || 0;
    this.missions.completed = this.save.completed || [];
    this.spawnWorld();
    this.bindMenu();
  }
  spawnWorld() {
    // Parked cars around the city.
    const rng = new RNG(5150);
    for (let i = 0; i < 10; i++) {
      const s = this.pickParkSpot(rng);
      if (!s) continue;
      const kind = rng.pick(['sedan', 'sedan', 'coupe', 'truck']);
      const color = rng.pick([[0.75, 0.15, 0.15], [0.15, 0.35, 0.75], [0.85, 0.85, 0.85], [0.25, 0.25, 0.28], [0.75, 0.55, 0.15]]);
      const car = new Car(this.gl, kind, color, s.pos, s.heading);
      this.worldCars.push(car);
    }
    // Traffic + pedestrians.
    this.traffic.spawnNear(this.player.pos, 10);
    for (let i = 0; i < 14; i++) this.peds.push(new Ped(this.gl, this.city, this.rng));
  }
  pickParkSpot(rng) {
    const ROAD_LINES = [-174, -116, -58, 0, 58, 116, 174];
    for (let tries = 0; tries < 20; tries++) {
      const road = rng.pick(ROAD_LINES);
      const along = rng.range(-160, 160);
      const side = rng.chance(0.5) ? 1 : -1;
      const p = rng.chance(0.5)
        ? [along, 0, road + side * 6.2]
        : [road + side * 6.2, 0, along];
      if (Math.hypot(p[0] - this.player.pos[0], p[2] - this.player.pos[2]) < 20) continue;
      return { pos: p, heading: rng.chance(0.5) ? 0 : Math.PI / 2 };
    }
    return null;
  }
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fresh start */ }
    return { money: 0, missionIndex: 0, completed: [], bestTrial: 0 };
  }
  saveGame() {
    this.save.money = Math.floor(this.player.money);
    this.save.missionIndex = this.missions.index;
    this.save.completed = this.missions.completed;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* no storage */ }
  }
  playerPos() {
    return this.player.onFoot ? this.player.pos : this.player.car.pos;
  }
  playerHeading() {
    return this.player.onFoot ? this.player.heading : this.player.car.heading;
  }
  allCars() {
    return [...this.worldCars, ...this.traffic.cars, ...this.police.cars];
  }
  missionTarget() {
    if (this.missions.state === 'active') return this.missions.objectivePos();
    if (this.missions.trial) {
      const t = this.missions.trial.points[this.missions.trial.at];
      return t ? [t[0], 0, t[1]] : null;
    }
    return null;
  }
  setState(s) {
    this.state = s;
    const show = (id, on) => {
      const el = document.getElementById(id);
      if (el) el.style.display = on ? 'flex' : 'none';
    };
    show('menu', s === 'menu');
    show('pause', s === 'paused');
    show('end', s === 'busted' || s === 'wasted');
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = s === 'playing' ? 'block' : 'none';
    if (s === 'busted' || s === 'wasted') {
      const title = document.getElementById('end-title');
      const sub = document.getElementById('end-sub');
      if (title) title.textContent = s === 'busted' ? 'BUSTED' : 'WASTED';
      if (sub) {
        sub.textContent = s === 'busted'
          ? 'The Solmar Bay PD caught up with Jax. The heat dies down — but the city remembers.'
          : 'Jax went down hard. The bay keeps turning without him — for now.';
      }
      this.audio.crash();
      this.saveGame();
    }
  }
  hideOverlays() {
    for (const id of ['menu', 'pause', 'end']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'block';
  }
  bindMenu() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { this.audio.ensure(); this.audio.click(); fn(); });
    };
    on('btn-new', () => {
      this.save = { money: 0, missionIndex: 0, completed: [], bestTrial: 0 };
      this.player.money = 0;
      this.missions.index = 0;
      this.missions.completed = [];
      this.missions.state = 'idle';
      this.wanted.heat = 0; this.wanted.level = 0;
      this.setState('playing');
      this.hud.say('Welcome to Solmar Bay, Jax. Press N to start the first job.', 'story');
    });
    on('btn-continue', () => {
      this.setState('playing');
      this.hud.say('Back on the streets. Press N for the next job.', 'story');
    });
    on('btn-resume', () => this.setState('playing'));
    on('btn-restart-mission', () => {
      this.missions.retry();
      this.setState('playing');
    });
    on('btn-quit', () => { this.saveGame(); this.setState('menu'); });
    on('btn-retry', () => this.respawn());
    on('btn-menu', () => { this.saveGame(); this.setState('menu'); });
    const cont = document.getElementById('btn-continue');
    if (cont && !this.save.money && this.save.missionIndex === 0) cont.style.display = 'none';
  }
  respawn() {
    // Back on Coral Row by the garage — on the street, never inside the
    // garage building's own footprint.
    this.player.pos = [58, 0, 145];
    this.player.heading = 0;
    this.player.health = 100;
    this.player.busted = 0;
    this.player.onFoot = true;
    this.player.car = null;
    this.wanted.heat = 0; this.wanted.level = 0;
    this.police.clear();
    this.setState('playing');
  }
  nearestCar(maxDist) {
    const pp = this.player.pos;
    let best = null, bd = maxDist;
    for (const car of [...this.worldCars, ...this.traffic.cars, ...this.police.cars]) {
      if (car.dead) continue;
      if (car.isPlayer) continue;
      if (car.kind !== undefined && Math.abs(car.speed) > 3) continue;
      const d = Math.hypot(car.pos[0] - pp[0], car.pos[2] - pp[2]);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }
  tryEnterCar() {
    if (!this.player.onFoot) return false;
    const car = this.nearestCar(3.4);
    if (!car) return false;
    // Stealing a moving traffic car pulls it out of traffic; a police car
    // is a much hotter steal.
    if (this.traffic.cars.includes(car)) {
      this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      this.worldCars.push(car);
    }
    if (this.police.cars.includes(car)) {
      this.police.cars = this.police.cars.filter((c) => c !== car);
      this.worldCars.push(car);
      this.wanted.addHeat(25, this.time);
    }
    car.isPlayer = true;
    car.speed = 0;
    this.player.car = car;
    this.player.onFoot = false;
    this.player.pos = [car.pos[0], 0, car.pos[2]];
    if (car !== this.missions.coupe) {
      this.wanted.addHeat(12, this.time);
      this.hud.say('Car stolen — the heat is on.', 'story');
    }
    this.audio.click();
    return true;
  }
  tryExitCar() {
    if (this.player.onFoot || !this.player.car) return;
    const car = this.player.car;
    const side = [Math.cos(car.heading), 0, -Math.sin(car.heading)];
    this.player.pos = [car.pos[0] + side[0] * 2.2, 0, car.pos[2] + side[2] * 2.2];
    resolveCircle(this.city, this.player.pos, 0.5);
    this.player.heading = car.heading;
    car.isPlayer = false;
    this.player.car = null;
    this.player.onFoot = true;
  }
  shoot() {
    const p = this.player;
    if (!p.onFoot || p.fireCooldown > 0) return;
    p.fireCooldown = 0.35;
    this.audio.gunshot();
    this.wanted.addHeat(8, this.time);
    const fwd = [Math.sin(this.camYaw), 0, Math.cos(this.camYaw)];
    const origin = [p.pos[0] + fwd[0], 1.5, p.pos[2] + fwd[2]];
    // Muzzle flash.
    this.addParticles(origin, 'spark', 4, 6);
    let best = null, bd = 30;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.pos[0] - p.pos[0], dz = ped.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      const dot = (dx * fwd[0] + dz * fwd[2]) / (d || 1);
      if (d < bd && dot > 0.5) { bd = d; best = { kind: 'ped', obj: ped }; }
    }
    for (const cop of this.police.cops) {
      const dx = cop.pos[0] - p.pos[0], dz = cop.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      const dot = (dx * fwd[0] + dz * fwd[2]) / (d || 1);
      if (d < bd && dot > 0.5) { bd = d; best = { kind: 'cop', obj: cop }; }
    }
    if (best) {
      const target = best.kind === 'ped' ? best.obj.pos : best.obj.pos;
      this.addParticles([target[0], 1.2, target[2]], 'blood', 8, 5);
      if (best.kind === 'ped') {
        best.obj.state = 'down';
        this.wanted.addHeat(10, this.time);
      } else {
        this.police.cops = this.police.cops.filter((c) => c !== best.obj);
        this.wanted.addHeat(15, this.time);
        this.hud.say('You shot a cop. That was a choice.', 'story');
      }
      for (const ped of this.peds) {
        if (Math.hypot(ped.pos[0] - p.pos[0], ped.pos[2] - p.pos[2]) < 20) ped.scare(p.pos);
      }
    }
  }
  addParticles(pos, kind, n, spread) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        pos: [pos[0] + (Math.random() - 0.5), pos[1] + Math.random() * 0.5, pos[2] + (Math.random() - 0.5)],
        vel: [(Math.random() - 0.5) * spread, Math.random() * 2 + 1, (Math.random() - 0.5) * spread],
        life: 0.7 + Math.random() * 0.5, maxLife: 1.2, size: 0.35 + Math.random() * 0.3, kind,
      });
    }
  }
  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.pos[0] += pt.vel[0] * dt;
      pt.pos[1] += pt.vel[1] * dt;
      pt.pos[2] += pt.vel[2] * dt;
      pt.vel[1] -= 3 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 240) this.particles.splice(0, this.particles.length - 240);
  }
  update(dt) {
    this.time += dt;
    const inp = this.input;
    // Camera orbit from mouse drag / wheel (always live).
    if (inp.orbitDX || inp.orbitDY) this.lastDrag = this.time;
    this.camYaw -= inp.orbitDX * 0.005;
    this.camPitch = clamp(this.camPitch + inp.orbitDY * 0.003, 0.08, 1.05);
    this.camDist = clamp(this.camDist + inp.wheel * 0.01, 5, 18);
    if (this.state === 'menu') {
      // Slow orbit over the plaza as a living backdrop.
      this.camYaw += dt * 0.045;
      this.camPitch = 0.5;
      this.camDist = 70;
      const ref = this.city.places.plaza;
      this.traffic.update(dt, [ref[0], 0, ref[1]], this.allCars());
      for (const ped of this.peds) ped.update(dt, this.rng, []);
      this.updateParticles(dt);
      inp.endFrame();
      return;
    }
    if (this.state !== 'playing') { inp.endFrame(); return; }
    const p = this.player;
    // Edge-triggered keys.
    if (inp.wasPressed('KeyE')) { if (p.onFoot) this.tryEnterCar(); else this.tryExitCar(); }
    if (inp.wasPressed('KeyF') || inp.consumeClick()) this.shoot();
    if (inp.wasPressed('KeyN')) {
      if (this.missions.state === 'failed') this.missions.retry();
      else if (this.missions.state !== 'active' && this.missions.index < 4) this.missions.startMission(this.missions.index);
    }
    if (inp.wasPressed('KeyT') && !this.missions.trial) this.missions.startTrial();
    if (inp.wasPressed('KeyP') || inp.wasPressed('Escape')) { this.saveGame(); this.setState('paused'); }
    if (inp.wasPressed('KeyM')) this.audio.setMuted(!this.audio.muted);
    // Movement input (test harness can drive it too).
    const move = this.testInput || inp;
    if (p.onFoot) {
      const camYaw = this.camYaw;
      p.updateOnFoot(move, camYaw, dt, this.city);
      // Context hint: near a car?
      const car = this.nearestCar(3.4);
      this.hud.setHint(car ? 'Press E to steal the car' : '');
    } else if (p.car) {
      const before = p.car.speed;
      updatePlayerCar(p.car, move, dt, this.city, this.allCars());
      const drop = before - p.car.speed;
      if (drop > 12 && this.time - this.lastDamage > 0.8) {
        const dmg = (drop - 12) * 1.1;
        p.health -= dmg;
        this.lastDamage = this.time;
        this.hud.damageFlash();
        this.audio.crash();
        this.addParticles(p.car.pos, 'smoke', 10, 4);
        if (p.health <= 0) { this.setState('wasted'); return; }
      }
      p.pos = [p.car.pos[0], 0, p.car.pos[2]];
      this.hud.setHint('');
      // Running someone over is a crime.
      for (const ped of this.peds) {
        if (ped.state === 'down') continue;
        const d = Math.hypot(ped.pos[0] - p.car.pos[0], ped.pos[2] - p.car.pos[2]);
        if (d < 1.9 && Math.abs(p.car.speed) > 6) {
          ped.state = 'down';
          this.addParticles(ped.pos, 'blood', 8, 5);
          this.wanted.addHeat(10, this.time);
          this.audio.crash();
          this.hud.say('You ran someone over!', 'story');
        }
      }
    }
    // Health regen after 8 calm seconds.
    if (this.time - this.lastDamage > 8 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
    // World life.
    const pp = this.playerPos();
    this.traffic.update(dt, pp, this.allCars());
    const threats = [];
    if (!p.onFoot && p.car && Math.abs(p.car.speed) > 8) threats.push(p.car.pos);
    for (const ped of this.peds) ped.update(dt, this.rng, threats);
    const siren = this.police.update(dt, this);
    this.missions.update(dt);
    this.missions.updateTrial(dt);
    this.updateParticles(dt);
    // Audio follows the action.
    const driving = !p.onFoot && p.car;
    this.audio.update(dt, !!driving, driving ? Math.abs(p.car.speed) / 38 : 0, siren.siren);
    // Camera follows the player; it eases toward the heading of travel
    // unless the player dragged the mouse recently.
    const target = this.playerPos();
    const heading = this.playerHeading();
    if (this.time - this.lastDrag > 2) {
      this.camYaw = angleLerp(this.camYaw, heading, Math.min(1, dt * 1.4));
    }
    this.camTarget = target;
    this.hud.update(this, dt);
    inp.endFrame();
  }
  camera() {
    const target = this.state === 'menu'
      ? [this.city.places.plaza[0], 0, this.city.places.plaza[1]]
      : (this.camTarget || this.playerPos());
    const dist = this.camDist;
    const h = this.camPitch;
    const eye = [
      target[0] - Math.sin(this.camYaw) * Math.cos(h) * dist,
      target[1] + 2 + Math.sin(h) * dist,
      target[2] - Math.cos(this.camYaw) * Math.cos(h) * dist,
    ];
    return { eye, center: [target[0], target[1] + 1.6, target[2]] };
  }
  start() {
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.renderer.render(this, this.camera());
      this.framesRendered++;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

// ---- boot ----
const canvas = document.getElementById('game');
window.addEventListener('error', (e) => {
  const g = window.__game;
  if (g) g.errorCount++;
  const el = document.getElementById('errors');
  if (el) el.textContent += '\n' + (e.message || 'error');
});
const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261122', 10);
const game = new Game(canvas, seed);
window.__game = game;
const shot = params.get('shot');
if (shot) {
  applyShot(game, shot);
} else if (params.get('selftest') === '1') {
  game.hideOverlays();
  game.setState('playing');
  runSelfTest(game);
}
game.start();
