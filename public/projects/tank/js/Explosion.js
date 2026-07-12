/**
 * Port of Tanks/Explosion.java. One Explosion lives on each tank's
 * Projectile and is reused for every shot - it's idle (parked at -50,-50)
 * until setExplosionFor*() is called.
 *
 * Note: like the original, setExplosionForProjectile() doesn't reset
 * radius, so a radius changed by the "xtra" power-up (60) or a
 * self-destruct (15) can carry over to the next normal explosion until
 * something else sets it again. That's a quirk of the original Java,
 * preserved here for faithful behaviour rather than "fixed".
 */
class Explosion {
  constructor() {
    this.x = -50;
    this.y = -50;
    this.radius = 30;

    this.count = 0;
    this.time = 0;
    this.redSize = 0;
    this.orangeSize = 0;
    this.yellowSize = 0;
  }

  setExplosionForProjectile(projectile) {
    this.x = projectile.x;
    this.y = projectile.y;
    this.radius = 30; // reset to default - previously could stay at 60/15 from a prior shot
  }

  setExplosionForTank(tank, health) {
    this.x = tank.x;
    this.y = tank.y - 2;

    if (health === 0) {
      this.radius = 15; // self-destruct: smaller blast
    }
  }

  // power-up: doubled blast radius
  setExplosionForXtra(projectile) {
    this.x = projectile.x;
    this.y = projectile.y;
    this.radius = 60;
  }

  calcDamage(game, playerTank) {
    for (const id of [...game.remainingTanks]) {
      const tank = game.players.get(id);
      if (!tank) continue;

      const minX = tank.x - 10;
      const maxX = tank.x + 10;
      const minY = tank.y - 6;
      const maxY = tank.y + 2;

      const closestX = Math.max(minX, Math.min(this.x, maxX));
      const closestY = Math.max(minY, Math.min(this.y, maxY));
      const distance = Math.sqrt((closestX - this.x) ** 2 + (closestY - this.y) ** 2);

      if (distance <= this.radius || (this.x > minX && this.x < maxX && this.y > minY && this.y < maxY)) {
        game.damagedTanks.add(tank);

        const damagePercentage = 1 - distance / this.radius;
        const maxDamage = 60;
        const damage = Math.floor(damagePercentage * maxDamage);

        if (tank !== playerTank) {
          if (tank.health - damage <= 0) {
            playerTank.addScore(tank.health);
          } else {
            playerTank.addScore(damage);
          }
        }

        tank.setHealth(-damage);
        if (tank.health < tank.power) {
          tank.setPower(tank.health);
        }
      }
    }
  }

  updateTerrain(game) {
    const fromX = Math.max(0, Math.floor(this.x - this.radius));
    const toX = Math.min(Board.WIDTH, Math.floor(this.x + this.radius));

    for (let i = fromX; i <= toX; i++) {
      const currY = Math.floor(Math.sqrt(this.radius ** 2 - (i - this.x) ** 2) + this.y);
      if (game.terrainPosition[i] <= currY) {
        game.terrainPosition[i] = currY;
      }
    }

    for (const id of game.playerIDs) {
      const tank = game.players.get(id);
      if (tank && tank.x >= fromX && tank.x <= toX) {
        console.log('damaged:', id, 'tank.x=', tank.x, 'range=', fromX, toX);
        game.damagedTanks.add(tank);
      }
    }
  }

  tick() {
    if (this.x !== -50 && this.y !== -50) {
      this.count++;
      if (this.count < 6) {
        this.time = this.count / 6;
        this.redSize = this.radius * this.time;
        this.orangeSize = 0.5 * this.redSize;
        this.yellowSize = 0.2 * this.redSize;
      } else if (this.count === 6) {
        this.x = -50;
        this.y = -50;
        this.count = 0;
      }
    }
  }

  draw() {
    noStroke();

    fill(255, 0, 0);
    ellipse(this.x, this.y, this.redSize * 2, this.redSize * 2);

    fill(255, 165, 0);
    ellipse(this.x, this.y, this.orangeSize * 2, this.orangeSize * 2);

    fill(255, 255, 0);
    ellipse(this.x, this.y, this.yellowSize * 2, this.yellowSize * 2);
  }
}