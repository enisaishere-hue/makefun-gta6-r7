// Solmar Bay — keyboard + mouse input. WASD/arrows move, mouse drag orbits
// the camera, wheel zooms, E interacts, F shoots, Space handbrake.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.orbitDX = 0;
    this.orbitDY = 0;
    this.wheel = 0;
    this.clicks = 0;
    this.dragging = false;
    this.lastX = 0; this.lastY = 0;
    this.downX = 0; this.downY = 0;
    this.moved = 0;
    const GAME_KEYS = new Set([
      'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'KeyE', 'KeyF', 'KeyR', 'KeyP', 'KeyM', 'KeyN', 'KeyT', 'Enter', 'Escape',
      'ShiftLeft', 'ShiftRight',
    ]);
    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.pressed.clear(); });
    canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.downX = e.clientX; this.downY = e.clientY;
      this.moved = 0;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      this.moved += Math.abs(dx) + Math.abs(dy);
      this.orbitDX += dx;
      this.orbitDY += dy;
    });
    window.addEventListener('mouseup', () => {
      if (this.dragging && this.moved < 6) this.clicks++;
      this.dragging = false;
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += e.deltaY; }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code); }
  wasPressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }
  consumeClick() {
    if (this.clicks > 0) { this.clicks--; return true; }
    return false;
  }
  get forward() { return this.down('KeyW') || this.down('ArrowUp'); }
  get back() { return this.down('KeyS') || this.down('ArrowDown'); }
  get left() { return this.down('KeyA') || this.down('ArrowLeft'); }
  get right() { return this.down('KeyD') || this.down('ArrowRight'); }
  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
  get handbrake() { return this.down('Space'); }
  endFrame() {
    this.pressed.clear();
    this.orbitDX = 0;
    this.orbitDY = 0;
    this.wheel = 0;
  }
}
