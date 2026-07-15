/**
 * Purely visual replay of a shot the server already resolved. The server
 * computes the real landing point + damage instantly and doesn't sync a
 * shot's flight moment-by-moment (Explosion's timing/animation fields
 * were dropped entirely server-side) — so on "shotFired", each client
 * re-runs the same simple trajectory formula locally (same gravity/wind
 * as server Projectile.tick()) purely so something animates on screen.
 * It reads the already-synced terrain array to know where to "land".
 */
class CosmeticProjectile {
  static TURRET_TICK_FPS = 30; // matches server GameLogic.FPS

  constructor({ startX, startY, angle, power, wasXtra }, colour) {
    this.x = startX;
    this.y = startY;
    this.colour = colour;
    this.wasXtra = wasXtra;

    const init = power * 0.08 + 1;
    this.velX = init * cos(radians(angle));
    this.velY = -init * sin(radians(angle));

    this.landed = false;
    this.done = false;
    this.explosion = new Explosion(); // reuse existing client Explosion class for the blast animation
  }

  tick(dt, terrainPosition, wind) {
    if (this.done) return;

    if (this.landed) {
      this.explosion.tick();
      if (this.explosion.x === -50 && this.explosion.y === -50) {
        this.done = true;
      }
      return;
    }

    const terrainX = clamp(Math.floor(this.x), 0, terrainPosition.length - 1);

    if (this.y >= terrainPosition[terrainX]) {
      this.landed = true;
      this.explosion.x = this.x;
      this.explosion.y = this.y;
      this.explosion.radius = this.wasXtra ? 60 : 30;
    } else if (this.x <= 5 || this.y <= 5 || this.x >= Board.WIDTH - 5 || this.y >= Board.HEIGHT - 5) {
      this.done = true; // left the screen — no explosion
    } else {
      this.x += this.velX + (wind * 0.03) / CosmeticProjectile.TURRET_TICK_FPS;
      this.y -= this.velY;
      this.velY -= 3.6 / CosmeticProjectile.TURRET_TICK_FPS;
    }
  }

  draw() {
    if (this.done) return;

    if (!this.landed) {
      noStroke();
      fill(this.colour[0], this.colour[1], this.colour[2]);
      ellipse(this.x, this.y, 8, 8);
    } else {
      this.explosion.draw();
    }
  }
}

/**
 * Standalone blast animation for a tank death (from health depletion,
 * falling off the map, or a disconnect-triggered elimination) — no shell
 * travels for these, so there's no trajectory to replay, just the blast
 * itself. Server sends the exact x/y/radius its own Explosion object
 * already used (via the "tankExploded" broadcast), so this doesn't need
 * to guess anything. Same tick()/draw()/done shape as CosmeticProjectile
 * so sketch.js's activeShots array can hold either interchangeably.
 */
class CosmeticExplosion {
  constructor({ x, y, radius }) {
    this.explosion = new Explosion();
    this.explosion.x = x;
    this.explosion.y = y;
    this.explosion.radius = radius;
    this.done = false;
  }

  tick() {
    if (this.done) return;
    this.explosion.tick();
    if (this.explosion.x === -50 && this.explosion.y === -50) {
      this.done = true;
    }
  }

  draw() {
    if (this.done) return;
    this.explosion.draw();
  }
}
