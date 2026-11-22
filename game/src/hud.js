// Solmar Bay — HUD: wanted stars, cash, health, speed, objective, timer,
// message feed, damage flash, and the 2D minimap.
import { BOUNDS, ROAD_LINES } from './city.js';

export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      stars: $('stars'), cash: $('cash'), healthFill: $('health-fill'),
      speedo: $('speedo'), objective: $('obj-text'), objDist: $('obj-dist'),
      timer: $('timer'), feed: $('feed'), minimap: $('minimap'),
      dmg: $('dmg'), hint: $('hint'), crosshair: $('crosshair'),
    };
    this.mapCtx = this.el.minimap ? this.el.minimap.getContext('2d') : null;
  }
  say(text, kind) {
    const feed = this.el.feed;
    if (!feed) return;
    const div = document.createElement('div');
    div.className = 'msg ' + (kind || 'story');
    div.textContent = text;
    feed.appendChild(div);
    while (feed.children.length > 6) feed.removeChild(feed.firstChild);
    setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 9000);
  }
  damageFlash() {
    if (this.el.dmg) {
      this.el.dmg.style.opacity = '0.55';
      setTimeout(() => { if (this.el.dmg) this.el.dmg.style.opacity = '0'; }, 120);
    }
  }
  setHint(text) {
    if (this.el.hint) this.el.hint.textContent = text || '';
  }
  update(game, dt) {
    const p = game.player;
    if (this.el.stars) {
      let stars = '';
      for (let i = 0; i < 5; i++) stars += i < game.wanted.level ? '★' : '☆';
      this.el.stars.textContent = stars;
      this.el.stars.className = game.wanted.level >= 3 ? 'hot' : '';
    }
    if (this.el.cash) this.el.cash.textContent = '$' + Math.floor(p.money).toLocaleString('en-US');
    if (this.el.healthFill) this.el.healthFill.style.width = Math.max(0, p.health) + '%';
    if (this.el.speedo) {
      this.el.speedo.textContent = p.onFoot
        ? 'ON FOOT — Pistol [F]'
        : Math.round(Math.abs(p.car ? p.car.speed : 0) * 3.6) + ' km/h';
    }
    const mc = game.missions;
    if (this.el.objective) {
      let text = '';
      if (mc.state === 'active' && mc.currentStage()) {
        text = mc.currentDef().title + ': ' + mc.currentStage().text;
      } else if (mc.state === 'done' && mc.index < 4) {
        text = 'Next job ready — press N to start: ' + (mc.currentDef() ? mc.currentDef().title : '');
      } else if (mc.state === 'failed') {
        text = 'Mission failed — press N to retry';
      } else if (mc.trial) {
        text = `Time trial: checkpoint ${mc.trial.at + 1}/5`;
      } else {
        text = 'Free roam — press N for the next job, T for a time trial';
      }
      this.el.objective.textContent = text;
    }
    if (this.el.objDist) {
      const pos = mc.objectivePos ? mc.objectivePos() : null;
      const trialTarget = mc.trial ? mc.trial.points[mc.trial.at] : null;
      const target = pos || trialTarget;
      if (target) {
        const pp = game.playerPos();
        const d = Math.hypot(pp[0] - target[0], pp[2] - (target[2] || 0));
        this.el.objDist.textContent = Math.round(d) + ' m';
      } else {
        this.el.objDist.textContent = '';
      }
    }
    if (this.el.timer) {
      const t = mc.state === 'active' && mc.timer > 0 ? mc.timer : (mc.trial ? Math.max(0, 120 - mc.trial.time) : 0);
      this.el.timer.textContent = t > 0 ? Math.ceil(t) + 's' : '';
    }
    if (this.el.crosshair) this.el.crosshair.style.display = p.onFoot ? 'block' : 'none';
    this.drawMinimap(game);
  }
  drawMinimap(game) {
    const ctx = this.mapCtx;
    if (!ctx) return;
    const W = 180, H = 180;
    const mx = (x) => ((x - BOUNDS.x0) / (BOUNDS.x1 - BOUNDS.x0)) * W;
    const my = (z) => ((BOUNDS.z1 - z) / (BOUNDS.z1 - BOUNDS.z0)) * H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(0, 0, W, H);
    // Water (south edge).
    ctx.fillStyle = '#2b6a8a';
    ctx.fillRect(0, my(235), W, H - my(235));
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 4;
    for (const l of ROAD_LINES) {
      ctx.beginPath(); ctx.moveTo(mx(-190), my(l)); ctx.lineTo(mx(190), my(l)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx(l), my(-190)); ctx.lineTo(mx(l), my(181)); ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#8a8f98';
    for (const b of game.city.buildings) {
      ctx.fillRect(mx(b.x - b.w / 2), my(b.z + b.d / 2), (b.w / 420) * W, (b.d / 435) * H);
    }
    // Plaza.
    ctx.fillStyle = '#3f6b2f';
    const [px, pz] = game.city.places.plaza;
    ctx.fillRect(mx(px - 22), my(pz + 22), 20, 20);
    const dot = (x, z, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx(x), my(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // Mission marker (pulsing yellow diamond).
    const mc = game.missions;
    const pos = mc.objectivePos ? mc.objectivePos() : null;
    const trialTarget = mc.trial ? mc.trial.points[mc.trial.at] : null;
    const target = pos || trialTarget;
    if (target) {
      const pulse = 5 + Math.sin(game.time * 5) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(mx(target[0]), my(target[2]) - pulse);
      ctx.lineTo(mx(target[0]) + pulse, my(target[2]));
      ctx.lineTo(mx(target[0]), my(target[2]) + pulse);
      ctx.lineTo(mx(target[0]) - pulse, my(target[2]));
      ctx.closePath(); ctx.fill();
    }
    // Traffic (grey) + police (red).
    for (const c of game.traffic.cars) dot(c.pos[0], c.pos[2], '#9aa0a8', 2);
    for (const c of game.police.cars) dot(c.pos[0], c.pos[2], '#ff3b30', 3);
    for (const c of game.worldCars) {
      if (c !== game.player.car) dot(c.pos[0], c.pos[2], '#c8ccd2', 2);
    }
    // Player arrow.
    const pp = game.playerPos();
    const h = game.playerHeading();
    ctx.save();
    ctx.translate(mx(pp[0]), my(pp[2]));
    ctx.rotate(h);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}
