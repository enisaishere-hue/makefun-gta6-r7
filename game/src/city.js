// Solmar Bay — the city itself: a 7x7 road grid, procedural buildings, beach
// and water on the south edge, named story locations, collision, traffic lanes.
import { MeshBuilder } from './gl.js';
import { RNG, clamp } from './util.js';
import {
  makeFacadeTexture, makeRoadTexture, makeGroundTexture, makeSandTexture, makeGrassTexture,
} from './textures.js';

export const PITCH = 58;          // road centre to road centre
export const STREET = 14;         // street width
export const BLOCK = PITCH - STREET; // 44
export const GRID = 7;            // 7 roads each way
export const ROAD_LINES = [-174, -116, -58, 0, 58, 116, 174];
export const BOUNDS = { x0: -205, x1: 205, z0: -195, z1: 232 };
export const BEACH_Z = 181;       // sand starts here
export const WATER_Z = 235;       // water starts here

// Block centres: bx, bz in -3..2 -> centre = bx*58 + 29.
function blockCenter(bx, bz) { return [bx * PITCH + PITCH / 2, bz * PITCH + PITCH / 2]; }

const PALETTE = [
  [0.96, 0.78, 0.62], [0.85, 0.62, 0.52], [0.72, 0.80, 0.86], [0.93, 0.88, 0.72],
  [0.80, 0.68, 0.78], [0.62, 0.74, 0.68], [0.90, 0.70, 0.55], [0.68, 0.66, 0.80],
];

export function generateCity(seed) {
  const rng = new RNG(seed);
  const city = {
    buildings: [], colliders: [], props: [], places: {}, sidewalkPoints: [],
  };
  // Named story locations (block coords).
  const named = {
    garage: { block: [0, 2], h: 10, color: [0.95, 0.55, 0.35], label: "Lena's Garage" },
    hotel: { block: [-2, -2], h: 46, color: [0.85, 0.80, 0.65], label: 'Grand Solmar Hotel' },
    casino: { block: [2, -2], h: 26, color: [0.75, 0.55, 0.85], label: 'Bay Casino' },
    spray: { block: [-2, 2], h: 9, color: [0.55, 0.80, 0.75], label: 'Spray & Go' },
  };
  const plazaBlock = [1, 1]; // central park block (centre 87, 87)
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const [cx, cz] = blockCenter(bx, bz);
      if (bx === plazaBlock[0] && bz === plazaBlock[1]) continue; // park
      const entry = Object.entries(named).find(([, v]) => v.block[0] === bx && v.block[1] === bz);
      if (entry) {
        const [key, v] = entry;
        const w = key === 'hotel' || key === 'casino' ? 30 : 26;
        const d = key === 'hotel' || key === 'casino' ? 30 : 20;
        city.buildings.push({ x: cx, z: cz, w, d, h: v.h, color: v.color, named: key });
        city.colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
        city.places[key] = [cx, cz];
        continue;
      }
      // Ordinary block: 1-2 buildings.
      const n = rng.chance(0.55) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = rng.range(16, 26), d = rng.range(16, 26);
        const ox = n === 1 ? 0 : (i === 0 ? -9 : 9);
        const oz = n === 1 ? 0 : (i === 0 ? -9 : 9);
        const h = rng.range(8, 40);
        const color = rng.pick(PALETTE);
        const x = cx + ox, z = cz + oz;
        city.buildings.push({ x, z, w, d, h, color });
        city.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      }
    }
  }
  // Beach spots.
  city.places.docks = [-168, 208];
  city.places.marina = [158, 208];
  city.places.plaza = blockCenter(plazaBlock[0], plazaBlock[1]);
  city.places.beach = [0, 212];
  // Street-side drop-off points for the named buildings: a mission marker
  // must sit on a road the player can actually reach, never on the
  // building's own centre — the building collider pushes the player out
  // to its edge, so a centre marker with a 10 m radius could never trigger.
  city.places.dropoff = {
    garage: [58, 145],   // Coral Row, east of Lena's Garage
    hotel: [-58, -87],   // east of the Grand Solmar Hotel
    casino: [116, -87],  // west of the Bay Casino
    spray: [-58, 145],   // east of Spray & Go
  };
  // Sidewalk waypoints: ring points around every block.
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const [cx, cz] = blockCenter(bx, bz);
      const half = BLOCK / 2 + 4;
      for (const [dx, dz] of [[-half, 0], [half, 0], [0, -half], [0, half], [-half, -half], [half, half]]) {
        city.sidewalkPoints.push([cx + dx, cz + dz]);
      }
    }
  }
  // Props: lamps along roads, palms on the beach + plaza, traffic lights at corners.
  for (const line of ROAD_LINES) {
    for (let t = -174; t <= 174; t += 58) {
      if (rng.chance(0.8)) city.props.push({ type: 'lamp', x: line + 6.5, z: t });
      if (rng.chance(0.5)) city.props.push({ type: 'lamp', x: t, z: line - 6.5 });
    }
  }
  for (let x = -190; x <= 190; x += 24) {
    city.props.push({ type: 'palm', x: x + rng.range(-4, 4), z: BEACH_Z + 12 + rng.range(0, 14) });
  }
  const [px, pz] = city.places.plaza;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    city.props.push({ type: 'palm', x: px + Math.cos(a) * 16, z: pz + Math.sin(a) * 16 });
  }
  for (const [ix, iz] of [[-58, -58], [58, 58], [0, -116], [-116, 58]]) {
    city.props.push({ type: 'light', x: ix + 7.5, z: iz + 7.5 });
  }
  return city;
}

// Push a circle (pos [x,y,z], radius r) out of building AABBs + world bounds.
export function resolveCircle(city, pos, r) {
  for (const c of city.colliders) {
    const nx = clamp(pos[0], c.x0, c.x1);
    const nz = clamp(pos[2], c.z0, c.z1);
    const dx = pos[0] - nx, dz = pos[2] - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos[0] = nx + (dx / d) * r;
        pos[2] = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = pos[0] - c.x0, pr = c.x1 - pos[0], pt = pos[2] - c.z0, pb = c.z1 - pos[2];
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos[0] = c.x0 - r;
        else if (m === pr) pos[0] = c.x1 + r;
        else if (m === pt) pos[2] = c.z0 - r;
        else pos[2] = c.z1 + r;
      }
    }
  }
  pos[0] = clamp(pos[0], BOUNDS.x0, BOUNDS.x1);
  pos[2] = clamp(pos[2], BOUNDS.z0, BOUNDS.z1);
  return pos;
}

export function nearestRoadCoord(v) {
  let best = ROAD_LINES[0], bd = Infinity;
  for (const l of ROAD_LINES) {
    const d = Math.abs(v - l);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

// A random point on a road lane, with a heading along the road.
export function randomRoadSpawn(rng, near, radius) {
  for (let tries = 0; tries < 20; tries++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = rng.pick(ROAD_LINES);
    const along = rng.range(-174, 174);
    const dir = rng.chance(0.5) ? 1 : -1;
    const lane = dir > 0 ? 3.5 : -3.5;
    const p = axis === 'x' ? [along, 0, road + lane] : [road + lane, 0, along];
    const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    if (near && Math.hypot(p[0] - near[0], p[2] - near[2]) > radius) continue;
    if (near && Math.hypot(p[0] - near[0], p[2] - near[2]) < 25) continue;
    return { pos: p, heading };
  }
  return { pos: [0, 0, 3.5], heading: Math.PI / 2 };
}

export function buildStaticMeshes(gl, city) {
  const facade = makeFacadeTexture(gl, 1337);
  const roadTex = makeRoadTexture(gl);
  const groundTex = makeGroundTexture(gl);
  const sandTex = makeSandTexture(gl);
  const grassTex = makeGrassTexture(gl);

  // Ground + sidewalks (one textured mesh).
  const g = new MeshBuilder();
  const groundCol = [1, 1, 1];
  g.quad([-230, 0, -200], [230, 0, -200], [230, 0, BEACH_Z], [-230, 0, BEACH_Z], [0, 1, 0], groundCol, [0, 0, 36, 30]);
  // Plaza grass.
  const [px, pz] = city.places.plaza;
  const ph = BLOCK / 2 + 5;
  g.quad([px - ph, 0.03, pz - ph], [px + ph, 0.03, pz - ph], [px + ph, 0.03, pz + ph], [px - ph, 0.03, pz + ph], [0, 1, 0], [1, 1, 1], [0, 0, 4, 4]);
  const groundMesh = { mesh: g.build(gl), texture: groundTex };

  // Sand beach.
  const s = new MeshBuilder();
  s.quad([-230, 0.02, BEACH_Z], [230, 0.02, BEACH_Z], [230, 0.02, WATER_Z], [-230, 0.02, WATER_Z], [0, 1, 0], [1, 1, 1], [0, 0, 20, 4]);
  const sandMesh = { mesh: s.build(gl), texture: sandTex };

  // Water (flat colour, no texture).
  const w = new MeshBuilder();
  w.quad([-320, 0.01, WATER_Z], [320, 0.01, WATER_Z], [320, 0.01, 420], [-320, 0.01, 420], [0, 1, 0], [0.16, 0.45, 0.62], [0, 0, 1, 1]);
  const waterMesh = { mesh: w.build(gl), texture: null };

  // Roads.
  const r = new MeshBuilder();
  const roadCol = [1, 1, 1];
  for (const line of ROAD_LINES) {
    // along X
    r.quad([-190, 0.04, line - STREET / 2], [190, 0.04, line - STREET / 2], [190, 0.04, line + STREET / 2], [-190, 0.04, line + STREET / 2], [0, 1, 0], roadCol, [0, 0, 24, 1]);
    // along Z
    r.quad([line - STREET / 2, 0.04, -190], [line + STREET / 2, 0.04, -190], [line + STREET / 2, 0.04, BEACH_Z], [line - STREET / 2, 0.04, BEACH_Z], [0, 1, 0], roadCol, [0, 0, 1, 24]);
  }
  const roadMesh = { mesh: r.build(gl), texture: roadTex };

  // Buildings (one mesh, facade texture, vertex-colour tint).
  const b = new MeshBuilder();
  for (const bd of city.buildings) {
    const roof = [bd.color[0] * 0.45, bd.color[1] * 0.45, bd.color[2] * 0.45];
    const uvS = Math.max(1, Math.round(bd.w / 9));
    const uvT = Math.max(1, Math.round(bd.h / 9));
    b.box(bd.x, bd.h / 2, bd.z, bd.w, bd.h, bd.d, bd.color, roof, [uvS, uvT]);
    // Rooftop box (AC unit) for variety.
    if (bd.h > 18) b.box(bd.x + bd.w / 5, bd.h + 1, bd.z, 4, 2, 4, [0.55, 0.55, 0.58], [0.55, 0.55, 0.58], [1, 1]);
  }
  const buildingMesh = { mesh: b.build(gl), texture: facade };

  // Props: lamps, palms, traffic lights (vertex colours only).
  const p = new MeshBuilder();
  const lampPole = [0.25, 0.25, 0.28];
  const lampHead = [1.0, 0.85, 0.55];
  const trunk = [0.45, 0.32, 0.20];
  const leaf = [0.25, 0.55, 0.22];
  const leaf2 = [0.35, 0.62, 0.25];
  for (const pr of city.props) {
    if (pr.type === 'lamp') {
      p.cylinder(pr.x, 3, pr.z, 0.14, 6, lampPole);
      p.box(pr.x + 0.9, 5.9, pr.z, 2.0, 0.16, 0.16, lampPole, lampPole, [1, 1]);
      p.box(pr.x + 1.8, 5.8, pr.z, 0.7, 0.25, 0.4, lampHead, lampHead, [1, 1]);
    } else if (pr.type === 'palm') {
      p.cylinder(pr.x, 3.5, pr.z, 0.28, 7, trunk);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const dx = Math.cos(a), dz = Math.sin(a);
        const y = 7.2;
        p.quad(
          [pr.x, y, pr.z], [pr.x + dx * 3.4, y - 1.6, pr.z + dz * 3.4],
          [pr.x + dx * 3.0, y - 1.2, pr.z + dz * 3.0], [pr.x + dx * 0.4, y + 0.4, pr.z + dz * 0.4],
          [0, 1, 0], i % 2 ? leaf : leaf2, [0, 0, 1, 1],
        );
      }
    } else if (pr.type === 'light') {
      p.cylinder(pr.x, 2.5, pr.z, 0.16, 5, [0.2, 0.2, 0.2]);
      p.box(pr.x, 5.2, pr.z, 0.5, 1.4, 0.5, [0.15, 0.15, 0.15], [0.15, 0.15, 0.15], [1, 1]);
      p.box(pr.x, 5.55, pr.z + 0.28, 0.3, 0.3, 0.06, [1.0, 0.15, 0.1], [1.0, 0.15, 0.1], [1, 1]);
      p.box(pr.x, 5.2, pr.z + 0.28, 0.3, 0.3, 0.06, [1.0, 0.8, 0.1], [1.0, 0.8, 0.1], [1, 1]);
      p.box(pr.x, 4.85, pr.z + 0.28, 0.3, 0.3, 0.06, [0.15, 0.9, 0.25], [0.15, 0.9, 0.25], [1, 1]);
    }
  }
  const propMesh = { mesh: p.build(gl), texture: null };
  return { groundMesh, sandMesh, waterMesh, roadMesh, buildingMesh, propMesh, grassTex };
}
