// Solmar Bay — procedural textures, drawn once on 2D canvases. No image files,
// no network: every texture is generated in the browser at load.
import { canvasTexture } from './gl.js';
import { RNG } from './util.js';

// Building facade: pale wall, dark window grid, a few lit windows.
// The wall is tinted at draw time by the mesh vertex colour.
export function makeFacadeTexture(gl, seed) {
  const rng = new RNG(seed);
  return canvasTexture(gl, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8ddc8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);
    const cols = 4, rows = 8;
    const cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.chance(0.22);
        ctx.fillStyle = lit ? '#ffd98a' : '#2c3542';
        ctx.fillRect(c * cw + 5, r * ch + 6, cw - 10, ch - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(c * cw + 5, r * ch + 6, cw - 10, 3);
      }
    }
    ctx.fillStyle = '#b7a98d';
    ctx.fillRect(0, h - 10, w, 10);
  });
}

// Asphalt with a dashed centre line and edge lines (one road segment tile).
export function makeRoadTexture(gl) {
  return canvasTexture(gl, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#33363b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#d8c25a';
    ctx.fillRect(w / 2 - 2, 0, 4, 26);
    ctx.fillRect(w / 2 - 2, 64, 4, 26);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(4, 0, 3, h);
    ctx.fillRect(w - 7, 0, 3, h);
  });
}

// Sidewalk / plaza concrete with slab joints.
export function makeGroundTexture(gl) {
  return canvasTexture(gl, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b9b2a4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }
  });
}

// Beach sand.
export function makeSandTexture(gl) {
  return canvasTexture(gl, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e2c98f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,90,40,0.18)';
    for (let i = 0; i < 240; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 40; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 4, 1);
    }
  });
}

// Grass for the central plaza park.
export function makeGrassTexture(gl) {
  return canvasTexture(gl, 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4d7a3a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 300; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 3);
    }
    ctx.fillStyle = 'rgba(140,190,90,0.25)';
    for (let i = 0; i < 120; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}
