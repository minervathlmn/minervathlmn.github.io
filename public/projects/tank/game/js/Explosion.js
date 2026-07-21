class Explosion {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.radius = 30;

    this.active = false;
    this.count = 0;
    this.time = 0;

    this.redSize = 0;
    this.orangeSize = 0;
    this.yellowSize = 0;
  }

  start(x, y, radius) {
    this.x = x;
    this.y = y;
    this.radius = radius;

    this.active = true;
    this.count = 0;
  }

  tick() {
    if (!this.active) return;

    this.count++;
    if (this.count < Constants.ANIMATION_TICKS) {
      this.time = this.count / Constants.ANIMATION_TICKS;
      this.redSize = this.radius * this.time;
      this.orangeSize = 0.5 * this.redSize;
      this.yellowSize = 0.2 * this.redSize;
    } else if (this.count === Constants.ANIMATION_TICKS) {
      this.active = false;
    }
  }

  draw() {
    if (!this.active) return;

    noStroke();

    fill(255, 0, 0);
    ellipse(this.x, this.y, this.redSize * 2, this.redSize * 2);

    fill(255, 165, 0);
    ellipse(this.x, this.y, this.orangeSize * 2, this.orangeSize * 2);

    fill(255, 255, 0);
    ellipse(this.x, this.y, this.yellowSize * 2, this.yellowSize * 2);
  }
}