# Solmar Bay — Sunset Streets

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/enisaishere-hue/makefun-gta6-r7/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/enisaishere-hue/makefun-gta6-r7/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01),
built from scratch in raw WebGL — no libraries, no network requests, every texture
and sound generated in code.

Jax Moreno came home to Solmar Bay to drive one last job for his sister Lena — and
the whole sun-soaked city is about to find out he is back. Explore a 7×7-block
coastal city on foot and by car, steal cars, outrun the Solmar Bay PD, run story
jobs across the bayfront, and pull off the Bay Casino heist.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## What is in the game

- **Open world**: a procedural coastal city — grid streets, traffic, pedestrians,
  a beach and marina, a central plaza park, named story locations (Lena's Garage,
  Grand Solmar Hotel, Bay Casino, Spray & Go).
- **Driving**: arcade car physics with handbrake drifts, traffic that follows the
  road grid and stops for the car ahead, parked cars to steal.
- **Wanted system**: five stars of heat — pursuit cars that ram you, foot cops
  that chase you down on foot, and a paint shop that makes the heat disappear.
- **Story missions**: four jobs — First Wheels, Bayfront Delivery, Heat Rising,
  The Solmar Job — plus a repeatable checkpoint time trial.
- **Combat**: pistol with muzzle flash and tracers; cars themselves are weapons.
- **HUD**: wanted stars, cash, health, speed, a live minimap, mission objective
  with distance and timer, and a message feed that tells the story.
- **Save**: money, mission progress and best time-trial live in localStorage.
- **Sound**: fully procedural WebAudio — engine hum, sirens, gunshots, pickups.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive |
| Mouse drag | Orbit camera, wheel zooms |
| E | Steal / enter / exit car |
| F or click | Shoot |
| Space | Handbrake |
| Shift | Sprint |
| N | Next job / retry mission |
| T | Time trial |
| P / Esc | Pause |
| M | Mute |

## Tech

- Raw WebGL (one shader: vertex colours + optional texture, sun + fog), ES modules.
- All art is procedural: building facades, roads and sand are drawn on canvases at load.
- All sound is synthesised with WebAudio.
- `main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json` with the vendored make.fun library. It never deletes the
  output folder itself, so running it twice into the same directory is byte-identical.

## License

MIT — see [LICENSE](LICENSE).
