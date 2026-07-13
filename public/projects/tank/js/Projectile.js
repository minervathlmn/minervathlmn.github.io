/**
 * Port of Tanks/Projectile.java. One Projectile lives on each Tank and
 * is reused for every shot; it's parked at (-50,-50) - off screen -
 * whenever it isn't currently in flight.
 */
class Projectile {
  constructor() {
    this.explosion = new Explosion();

    this.x = -50;
    this.y = -50;

    this.power = 0;
    this.angle = 0;

    this.init = 0;
    this.velX = 0;
    this.velY = 0;

    this.normal = true; // false while the "xtra" power-up is active
    this.colour = [0, 0, 0];
  }

  setColour(rgb) {
    this.colour = rgb;
  }

  // power-up: doubles the next explosion's radius, costs 20 score
  xtra(tank) {
    const cost = 20;
    if (tank.score >= cost) {
      tank.addScore(-cost);
      this.normal = false;
    }
  }

  setFire(game, tank) {
    if (tank.turret[0] > 0 && tank.turret[0] < Board.WIDTH) {
      this.x = tank.turret[0];
      this.y = tank.turret[1];

      this.angle = 270 + tank.turretAngle;
      this.power = tank.power;

      this.init = this.power * 0.08 + 1; // initial speed, range ~1-9 px/frame equiv
      // scaled to px/sec (×FPS) so tick() can use real dt instead of frame counts
      this.velX = this.init * GameLogic.FPS * cos(radians(this.angle));
      this.velY = -this.init * GameLogic.FPS * sin(radians(this.angle));
    }
  }
  
  tick(game, tank, dt) {
    if (this.x === -50 && this.y === -50) {
      this.velX = 0;
      this.velY = 0;
      return;
    }

    const terrainX = clamp(Math.floor(this.x), 0, game.terrainPosition.length - 1);

    if (this.y >= game.terrainPosition[terrainX]) {
      // hit terrain
      this.velX = 0;
      this.velY = 0;

      if (!this.normal) {
        this.explosion.setExplosionForXtra(this);
      } else {
        this.explosion.setExplosionForProjectile(this);
      }

      this.explosion.calcDamage(game, tank);
      this.explosion.updateTerrain(game);

      this.x = -50;
      this.y = -50;
      this.normal = true;
    } else if (this.x <= 5 || this.y <= 5 || this.x >= Board.WIDTH - 5 || this.y >= Board.HEIGHT - 5) {
      // out of screen
      this.x = -50;
      this.y = -50;
    } else {
      this.x += (this.velX + game.wind * 0.03) * dt; // wind: w*0.03 px/sec
      this.y -= this.velY * dt;
      this.velY -= 3.6 * dt; // gravity: 3.6 px/sec^2
    }
  }

  draw() {
    noStroke();
    fill(this.colour[0], this.colour[1], this.colour[2]);
    ellipse(this.x, this.y, 8, 8);
  }
}
