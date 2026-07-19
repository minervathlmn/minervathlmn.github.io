class CosmeticProjectile {
  constructor({ startX, startY, angle, power, doubleBlastRadius }, colour) {
    this.x = startX;
    this.y = startY;
    this.colour = colour;
    this.doubleBlastRadius = doubleBlastRadius;

    const init = power * 0.08 + 1;
    this.velX = init * cos(radians(angle));
    this.velY = -init * sin(radians(angle));

    // flying   : shell is moving, physics tick running
    // exploding: shell has hit terrain, blast animation is playing
    // finished : nothing left to animate, safe to remove from activeShots
    this.status = 'flying';   // 'flying' | 'exploding' | 'done'

    this.explosion = new Explosion();
  }

  tick(dt, terrainPosition, wind) {
    if (this.status === 'done') return;

    if (this.status === 'exploding') {
      this.explosion.tick();
      if (!this.explosion.active) {
        this.status = 'done';
      }
      return;
    }

    const terrainX = clamp(Math.floor(this.x), 0, terrainPosition.length - 1);

    // hit terrain
    if (this.y >= terrainPosition[terrainX]) {
      this.status = 'exploding';
      this.explosion.start(this.x, this.y, this.doubleBlastRadius ? 60 : 30);
    
    // left the screen — no explosion
    } else if (this.x <= 5 || this.y <= 5 || this.x >= Board.WIDTH - 5 || this.y >= Board.HEIGHT - 5) {
      this.status = 'done';
    
    // flying — affected by wind
    } else { 
      const windTargetVelX = wind * Constants.WIND_SCALE;
      this.velX += (Constants.DRAG_COEFF * (windTargetVelX - this.velX)) / Constants.FPS;
      this.x += this.velX;
      this.y -= this.velY;
      this.velY -= Constants.GRAVITY / Constants.FPS;
    }
  }

  draw() {
    if (this.status === 'done') return;

    if (this.status === 'flying') {
      noStroke();
      fill(this.colour[0], this.colour[1], this.colour[2]);
      ellipse(this.x, this.y, 8, 8);
    } else {
      this.explosion.draw();
    }
  }
}


class CosmeticExplosion {
  constructor({ x, y, radius }) {
    this.explosion = new Explosion();
    this.explosion.start(x, y, radius);
    this.status = 'exploding';  // 'exploding' | 'done' — no 'flying' state, starts mid-blast
  }

  tick() {
    if (this.status === 'done') return;

    this.explosion.tick();
    if (!this.explosion.active) {
      this.status = 'done';
    }
  }

  draw() {
    if (this.status === 'done') return;
    this.explosion.draw();
  }
}
