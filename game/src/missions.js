// Solmar Bay — story missions and the repeatable time trial.
// Jax Moreno, wheelman of Solmar Bay, is pulled back for one last job by his
// sister Lena, who runs the garage on Coral Row.
import { Car } from './vehicles.js';
import { RNG } from './util.js';
import { randomRoadSpawn } from './city.js';

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', reward: 500,
    brief: [
      'LENA: Jax, you are back. The red coupe on Coral Row is mine — take it.',
      'Steal the coupe, then bring it to my garage. No cops, no scratches. Well — few scratches.',
    ],
    stages: [
      { type: 'enterCar', carRef: 'coupe', text: 'Steal the red coupe' },
      { type: 'reach', place: 'garage', radius: 10, text: 'Drive to Lena\'s Garage', inCar: true },
    ],
  },
  {
    id: 'bayfront-delivery', title: 'Bayfront Delivery', reward: 1200,
    brief: [
      'LENA: A package is waiting at the docks. Hotel job — the Grand Solmar.',
      'Pick it up, deliver it fast. Someone tipped the cops, so keep it moving.',
    ],
    stages: [
      { type: 'reach', place: 'docks', radius: 8, text: 'Pick up the package at the docks' },
      { type: 'deliver', place: 'hotel', radius: 10, seconds: 150, text: 'Deliver to the Grand Solmar Hotel' },
    ],
  },
  {
    id: 'heat-rising', title: 'Heat Rising', reward: 800,
    brief: [
      'LENA: Three stars, Jax. The whole bay is looking for you.',
      'Lose them. Spray & Go on Coral Row can make the car disappear — if you get there.',
    ],
    stages: [
      { type: 'heat', level: 3, text: 'Wanted level 3 — the heat is on' },
      { type: 'escape', place: 'spray', radius: 9, text: 'Reach Spray & Go to clear your wanted level' },
    ],
  },
  {
    id: 'solmar-job', title: 'The Solmar Job', reward: 5000,
    brief: [
      'LENA: The Bay Casino vault. One job and we are done — for real this time.',
      'Get inside, grab the cash, and run for the boat at the marina. Four stars, Jax. Make it count.',
    ],
    stages: [
      { type: 'reach', place: 'casino', radius: 10, text: 'Reach the Bay Casino' },
      { type: 'grab', place: 'casino', radius: 6, seconds: 2, text: 'Grab the vault cash (stay in the marker)' },
      { type: 'escape', place: 'marina', radius: 10, text: 'Escape to the boat at the marina' },
    ],
  },
];

export class MissionController {
  constructor(game) {
    this.game = game;
    this.index = 0;          // current mission
    this.stage = 0;
    this.state = 'idle';     // idle | active | done | failed
    this.timer = 0;
    this.stageTimer = 0;
    this.coupe = null;
    this.trial = null;       // time trial state
    this.completed = [];
  }
  currentDef() { return MISSIONS[this.index] || null; }
  currentStage() {
    const def = this.currentDef();
    return def ? def.stages[this.stage] : null;
  }
  startMission(i) {
    const def = MISSIONS[i];
    if (!def) { this.state = 'idle'; return; }
    this.index = i;
    this.stage = 0;
    this.state = 'active';
    this.stageTimer = 0;
    const g = this.game;
    g.hud.say(def.title, 'mission');
    def.brief.forEach((line) => g.hud.say(line, 'story'));
    if (def.id === 'first-wheels') this.spawnCoupe();
    if (def.id === 'heat-rising') g.wanted.addHeat(70, g.time);
    if (def.id === 'solmar-job') g.wanted.addHeat(0, g.time);
  }
  spawnCoupe() {
    const g = this.game;
    // Parked on Coral Row (road x=58) down by the beach end, a short drive
    // north to Lena's Garage — on the street, not inside the garage
    // building's own footprint.
    const coupe = new Car(g.gl, 'coupe', [0.85, 0.1, 0.12], [58, 0, 178], 0);
    coupe.targetSpeed = 0;
    g.worldCars.push(coupe);
    this.coupe = coupe;
  }
  objectivePos() {
    const st = this.currentStage();
    if (!st) return null;
    if (st.place) {
      // Named buildings resolve to their street-side drop-off point.
      const drop = this.game.city.places.dropoff && this.game.city.places.dropoff[st.place];
      const p = drop || this.game.city.places[st.place];
      return p ? [p[0], 0, p[1]] : null;
    }
    if (st.carRef === 'coupe' && this.coupe) return this.coupe.pos;
    return null;
  }
  update(dt) {
    if (this.state !== 'active') return;
    const g = this.game;
    const st = this.currentStage();
    if (!st) return;
    const pp = g.playerPos();
    this.stageTimer += dt;
    if (st.type === 'enterCar') {
      if (!g.player.onFoot && g.player.car === this.coupe) this.advance();
    } else if (st.type === 'reach' || st.type === 'deliver' || st.type === 'escape') {
      const pos = this.objectivePos();
      if (pos) {
        const d = Math.hypot(pp[0] - pos[0], pp[2] - pos[2]);
        if (st.type === 'deliver' || st.type === 'reach') {
          if (d < st.radius && (!st.inCar || !g.player.onFoot)) this.advance();
        }
        if (st.type === 'escape' && d < st.radius) {
          if (st.place === 'spray') {
            if (g.wanted.level > 0 && g.player.money >= 0) {
              g.player.money = Math.max(0, g.player.money - 100);
              g.wanted.heat = 0; g.wanted.level = 0;
              g.police.clear();
              g.hud.say('Spray & Go: new paint, no heat. That will be $100.', 'story');
            }
          }
          this.advance();
        }
      }
      if (st.seconds) {
        this.timer = st.seconds - this.stageTimer;
        if (this.timer <= 0) return this.fail('Too slow — the job fell through.');
      }
    } else if (st.type === 'grab') {
      const pos = this.objectivePos();
      if (pos) {
        const d = Math.hypot(pp[0] - pos[0], pp[2] - pos[2]);
        if (d < st.radius && g.player.onFoot) {
          this.timer = st.seconds - this.stageTimer;
          if (this.stageTimer >= st.seconds) {
            g.player.money += 5000;
            g.hud.say('Vault cash secured: +$5,000. Now RUN.', 'story');
            this.advance();
          }
        } else {
          this.stageTimer = Math.max(0, this.stageTimer - dt * 2);
          this.timer = st.seconds - this.stageTimer;
        }
      }
    } else if (st.type === 'heat') {
      if (g.wanted.level >= st.level) this.advance();
    }
  }
  advance() {
    const g = this.game;
    this.stage++;
    this.stageTimer = 0;
    this.timer = 0;
    const def = this.currentDef();
    g.audio.sting();
    if (this.stage >= def.stages.length) {
      g.player.money += def.reward;
      g.hud.say(`Mission complete: ${def.title} — +$${def.reward}`, 'mission');
      g.audio.pickup();
      this.completed.push(def.id);
      g.saveGame();
      this.state = 'done';
      this.index++;
      if (this.index < MISSIONS.length) {
        g.hud.say('Next job is ready. Drive to the yellow marker — or press N to start it.', 'story');
      } else {
        g.hud.say('Solmar Bay is yours, Jax. Free roam — the city never sleeps.', 'story');
      }
    } else {
      const st = this.currentStage();
      g.hud.say(`Objective: ${st.text}`, 'mission');
    }
  }
  fail(reason) {
    const g = this.game;
    g.hud.say(`Mission failed: ${reason}`, 'story');
    this.state = 'failed';
    this.stageTimer = 0;
    this.timer = 0;
  }
  retry() {
    if (this.state === 'failed' || this.state === 'done') this.startMission(this.index);
  }
  // --- Time trial (repeatable side activity, T to start in free roam) ---
  startTrial() {
    const g = this.game;
    const rng = new RNG(99);
    // Checkpoints always sit on a road (never inside a building, where
    // the 9 m trigger could not be reached from the street).
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const spawn = randomRoadSpawn(rng, null, 0);
      pts.push([spawn.pos[0], spawn.pos[2]]);
    }
    this.trial = { points: pts, at: 0, time: 0, par: 75 };
    g.hud.say('Time trial: hit all 5 checkpoints before the clock runs out!', 'mission');
  }
  updateTrial(dt) {
    if (!this.trial) return;
    const g = this.game;
    const t = this.trial;
    t.time += dt;
    const pp = g.playerPos();
    const target = t.points[t.at];
    if (target && Math.hypot(pp[0] - target[0], pp[2] - target[2]) < 9) {
      t.at++;
      g.audio.pickup();
      g.hud.say(`Checkpoint ${t.at}/5`, 'mission');
      if (t.at >= t.points.length) {
        const won = t.time <= t.par;
        if (won) {
          g.player.money += 300;
          g.hud.say(`Time trial done in ${t.time.toFixed(1)}s — under par! +$300`, 'mission');
          if (!g.save.bestTrial || t.time < g.save.bestTrial) {
            g.save.bestTrial = t.time;
            g.saveGame();
          }
        } else {
          g.hud.say(`Time trial done in ${t.time.toFixed(1)}s — over par (${t.par}s). Try again with T.`, 'mission');
        }
        this.trial = null;
      }
    }
    if (t.time > 120) {
      g.hud.say('Time trial: out of time.', 'mission');
      this.trial = null;
    }
  }
}
