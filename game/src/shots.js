// Solmar Bay — screenshot presets (?shot=chase|street|mission|steal).
// Each one stages a real moment of the game — the same code a player runs,
// just placed mid-action so the screenshots show several systems at once:
// the city, the HUD with its minimap, traffic, police and a mission.
import { Car } from './vehicles.js';

function putPlayerInCar(game, kind, color, pos, heading, speed) {
  const car = new Car(game.gl, kind, color, pos, heading);
  car.isPlayer = true;
  car.speed = speed;
  game.worldCars.push(car);
  game.player.car = car;
  game.player.onFoot = false;
  game.player.pos = [pos[0], 0, pos[2]];
  return car;
}

function spawnPoliceBehind(game, playerPos, heading, n, gap) {
  for (let i = 0; i < n; i++) {
    const back = (i + 1) * gap;
    const bx = playerPos[0] - Math.sin(heading) * back + (i % 2 ? 3.5 : -3.5);
    const bz = playerPos[2] - Math.cos(heading) * back;
    const car = new Car(game.gl, 'police', [0.92, 0.92, 0.92], [bx, 0, bz], heading);
    car.isPolice = true;
    car.speed = 26;
    car.targetSpeed = 32;
    game.police.cars.push(car);
  }
}

export function applyShot(game, name) {
  game.state = 'playing';
  game.hideOverlays();
  game.audio.ensure();
  const g = game;
  if (name === 'chase') {
    // Mid-chase on the bayfront avenue: wanted 3, two units behind, the
    // escape objective live on the HUD.
    g.timeOfDay = 'sunset';
    g.missions.startMission(2); // Heat Rising (adds the 3-star heat itself)
    g.missions.stage = 1; // escape stage
    const car = putPlayerInCar(g, 'coupe', [0.95, 0.75, 0.2], [0, 0, 60], Math.PI, 30);
    car.speed = 30;
    // Units 24 m back so the chase camera (11 m behind the player) sees
    // them in pursuit instead of one filling the frame.
    spawnPoliceBehind(g, [0, 0, 60], Math.PI, 2, 24);
    // And one unit coming the other way in the opposite lane, so the
    // police are visible ahead in the frame too.
    const oncoming = new Car(g.gl, 'police', [0.92, 0.92, 0.92], [3.5, 0, -30], 0);
    oncoming.isPolice = true;
    oncoming.speed = 26;
    oncoming.targetSpeed = 30;
    g.police.cars.push(oncoming);
    g.camYaw = Math.PI;
    g.camPitch = 0.32;
    g.camDist = 11;
    g.hud.say('Objective: reach Spray & Go to clear your wanted level', 'mission');
  } else if (name === 'street') {
    // On foot in the plaza district: traffic, pedestrians, the red coupe
    // waiting to be stolen, wanted 1.
    g.timeOfDay = 'sunset';
    g.missions.startMission(0);
    // The beacon pillar stands on the coupe itself and would block the
    // view of it from this angle — hide the 3D pillar for this shot (the
    // HUD objective and minimap still mark it).
    g.hideBeacon = true;
    // Stand on Coral Row (road x=58) looking south down the street at the
    // red coupe parked ahead by the beach end, garage behind the camera.
    g.player.pos = [58, 0, 165];
    g.player.heading = 0;
    g.wanted.addHeat(20, g.time);
    g.camYaw = 0;
    g.camPitch = 0.3;
    g.camDist = 8;
    g.hud.setHint('Press E to steal the car');
  } else if (name === 'mission') {
    // Bayfront Delivery mid-run: package aboard, timer ticking, the hotel
    // beacon ahead across town.
    g.timeOfDay = 'sunset';
    g.missions.startMission(1);
    g.missions.stage = 1;
    g.missions.stageTimer = 18; // 132s left on the 150s clock
    const car = putPlayerInCar(g, 'sedan', [0.15, 0.35, 0.75], [-140, 0, 170], Math.PI / 2, 22);
    car.speed = 22;
    g.camYaw = Math.PI / 2;
    g.camPitch = 0.32;
    g.camDist = 12;
    g.hud.say('Deliver to the Grand Solmar Hotel — 132s left', 'mission');
  } else if (name === 'steal') {
    // Dusk: Jax beside the red coupe on Coral Row, one unit rolling in
    // down the street behind, prompt on screen.
    g.timeOfDay = 'dusk';
    g.missions.startMission(0);
    // Same as the street shot: the beacon pillar would stand on the coupe
    // itself and split the car in two — hide it here.
    g.hideBeacon = true;
    // The coupe parks on road x=58 at z=178; stand on the road's west edge
    // beside it, facing it. (Never inside the garage building's footprint
    // — the camera would end up inside the wall.)
    g.player.pos = [54.5, 0, 176];
    g.player.heading = 1.05;
    g.wanted.addHeat(20, g.time);
    // One police unit on the same road, 28 m north, rolling in.
    const cop = new Car(g.gl, 'police', [0.92, 0.92, 0.92], [58, 0, 148], 0);
    cop.isPolice = true;
    cop.speed = 20;
    cop.targetSpeed = 26;
    g.police.cars.push(cop);
    g.camYaw = 1.05;
    g.camPitch = 0.35;
    g.camDist = 6;
    g.hud.setHint('Press E to steal the car');
  }
}
