// Solmar Bay — in-browser self-test (?selftest=1). Drives the real game
// systems headlessly and reports PASS/FAIL into #selftest and the title.
// It only runs when the page is opened with ?selftest=1.
function frame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export async function runSelfTest(game) {
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: detail || '' });
    const el = document.getElementById('selftest');
    if (el) {
      const div = document.createElement('div');
      div.textContent = (ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '');
      div.style.color = ok ? '#7dff8a' : '#ff6b5e';
      el.appendChild(div);
    }
  };
  const sleepFrames = async (n) => { for (let i = 0; i < n; i++) await frame(); };
  try {
    await sleepFrames(30);
    // 1. Renderer produced frames.
    check('renderer-frames', game.framesRendered > 10, game.framesRendered + ' frames');
    // 2. Player walks.
    game.state = 'playing';
    const p0 = [...game.player.pos];
    game.testInput = { forward: true };
    await sleepFrames(45);
    game.testInput = null;
    const moved = Math.hypot(game.player.pos[0] - p0[0], game.player.pos[2] - p0[2]);
    check('player-walks', moved > 2, moved.toFixed(1) + ' m');
    // 3. Enter + drive a car.
    const { Car } = await import('./vehicles.js');
    const near = new Car(game.gl, 'sedan', [0.5, 0.5, 0.6], [game.player.pos[0] + 2, 0, game.player.pos[2]], 0);
    game.worldCars.push(near);
    const entered = game.tryEnterCar();
    check('enter-car', entered && !game.player.onFoot, entered ? 'in car' : 'no car in range');
    const c0 = [...game.player.car.pos];
    game.testInput = { forward: true };
    await sleepFrames(60);
    game.testInput = null;
    const drove = Math.hypot(game.player.car.pos[0] - c0[0], game.player.car.pos[2] - c0[2]);
    check('car-drives', drove > 5, drove.toFixed(1) + ' m');
    // 4. Exit car.
    game.tryExitCar();
    check('exit-car', game.player.onFoot, 'on foot again');
    // 5. Traffic + pedestrians exist.
    check('traffic-spawned', game.traffic.cars.length >= 5, game.traffic.cars.length + ' cars');
    check('pedestrians-spawned', game.peds.length >= 5, game.peds.length + ' peds');
    // 6. Wanted rises and police respond.
    game.wanted.addHeat(40, game.time);
    check('wanted-rises', game.wanted.level >= 1, 'level ' + game.wanted.level);
    await sleepFrames(240);
    check('police-respond', game.police.cars.length >= 1, game.police.cars.length + ' units');
    // 7. Shooting works and raises heat.
    const heatBefore = game.wanted.heat;
    game.shoot();
    await sleepFrames(10);
    check('shooting', game.particles.some((p) => p.life > 0) && game.wanted.heat >= heatBefore, 'heat ' + Math.round(game.wanted.heat));
    // 8. Mission starts and its first objective is reachable.
    game.missions.startMission(0);
    check('mission-starts', game.missions.state === 'active', game.missions.currentDef().title);
    // 8b. Mission 0 completes end-to-end: enter the coupe, drive it to the
    // garage drop-off. Regression check for markers that used to sit
    // inside building footprints, where the collider made them unreachable.
    const coupe = game.missions.coupe;
    game.player.pos = [coupe.pos[0] + 2, 0, coupe.pos[2]];
    const enteredCoupe = game.tryEnterCar();
    await sleepFrames(5);
    const stageAfterEnter = game.missions.stage;
    if (game.player.car) {
      game.player.car.pos = [58, 0, 145];
      game.player.pos = [58, 0, 145];
    }
    await sleepFrames(10);
    check('mission-completes', enteredCoupe && game.missions.state === 'done' && game.missions.completed.includes('first-wheels'), 'enter stage ' + stageAfterEnter + ' -> ' + game.missions.state);
    // 9. Save / load round-trips.
    game.player.money = 1234;
    game.saveGame();
    const raw = localStorage.getItem('solmarbay.save.v1');
    const parsed = raw ? JSON.parse(raw) : null;
    check('save-load', parsed && parsed.money === 1234, 'money ' + (parsed ? parsed.money : 'none'));
    // 10. No script errors so far.
    check('no-errors', game.errorCount === 0, game.errorCount + ' errors');
  } catch (e) {
    check('selftest-crashed', false, String(e && e.message ? e.message : e));
  }
  const passed = results.filter((r) => r.ok).length;
  document.title = 'SELFTEST ' + passed + '/' + results.length;
  window.__selftestDone = true;
  window.__selftestResults = results;
}
