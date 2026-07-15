/**
 * Presentation layer for the tank game's HUD panels. Owns layout,
 * collapse/expand state, and drawing - never game state. Reads live
 * values off the Tank object passed in; never stores its own copy of
 * health/power/etc. Colours live in theme.js's UI_THEME, same as
 * checkers keeps its palette in theme.js rather than duplicating it
 * per-file. Same split as UI-game.js vs GameLogic.js in checkers,
 * just applied to a canvas-only UI instead of a DOM one.
 */
class PlayerHUD {
  static WIDTH = 260;
  static HEIGHT = 140;
  static TAB_WIDTH = 32;
  static TAB_HEIGHT = 28;
  static BAR_WIDTH = 170;
  static BAR_HEIGHT = 14;
  static PADDING = 18;
  static RADIUS = 12;

  static MAX_STAT = 100; // health/power are stored 0-100, same as sketch.js's clamp() calls

  /**
   * @param {number} x top-left x of the panel when expanded
   * @param {number} y top-left y of the panel when expanded
   * @param {TankState} tank synced schema object (read-only plain fields —
   *   no methods, unlike the old live Tank instance this used to receive)
   * @param {Object} sprites shared sprite cache from sketch.js (filename -> p5.Image | null)
   */
  constructor(x, y, tank, sprites) {
    this.x = x;
    this.y = y;
    this.tank = tank;
    this.sprites = sprites;
    this.collapsed = false;
  }

  toggle() {
    this.collapsed = !this.collapsed;
  }

  /**
   * @param {number} mx mouse x in canvas space
   * @param {number} my mouse y in canvas space
   * @returns {boolean} true if the click was consumed by this HUD
   */
  handleClick(mx, my) {
    const hit = this.collapsed ? this._collapsedHitbox() : this._toggleHitbox();
    if (mx >= hit.x && mx <= hit.x + hit.w && my >= hit.y && my <= hit.y + hit.h) {
      this.toggle();
      return true;
    }
    return false;
  }

  draw() {
    push();
    if (this.collapsed) {
      this._drawCollapsed();
    } else {
      this._drawExpanded();
    }
    pop();
  }

  // ---- internal ----

  _toggleHitbox() {
    // arrow tab sits on the right edge of the expanded panel
    return { x: this.x + PlayerHUD.WIDTH - PlayerHUD.TAB_WIDTH, y: this.y, w: PlayerHUD.TAB_WIDTH, h: PlayerHUD.TAB_HEIGHT };
  }

  _collapsedHitbox() {
    return { x: this.x, y: this.y, w: PlayerHUD.TAB_WIDTH, h: PlayerHUD.TAB_HEIGHT };
  }

  _drawShadow(x, y, w, h) {
    // fakes style.css's box-shadow: 0 4px 20px rgba(0,0,0,0.25) since
    // canvas has no native box-shadow
    noStroke();
    fill(0, 0, 0, 40);
    rect(x, y + 4, w, h, PlayerHUD.RADIUS);
  }

  _drawCollapsed() {
    const w = PlayerHUD.TAB_WIDTH;
    const h = PlayerHUD.TAB_HEIGHT;

    this._drawShadow(this.x, this.y, w, h);

    noStroke();
    fill(...UI_THEME.tabBg);
    rect(this.x, this.y, w, h, PlayerHUD.RADIUS);

    fill(...UI_THEME.tabText);
    textFont('IBM Plex Mono');
    textAlign(CENTER, CENTER);
    textSize(15);
    text('>', this.x + w / 2, this.y + h / 2 + 1);
  }

  _drawExpanded() {
    const x = this.x;
    const y = this.y;
    const w = PlayerHUD.WIDTH;
    const h = PlayerHUD.HEIGHT;
    const p = PlayerHUD.PADDING;

    this._drawShadow(x, y, w, h);

    stroke(...UI_THEME.panelBorder);
    strokeWeight(2);
    fill(...UI_THEME.panelBg, 140);
    rect(x, y, w, h, PlayerHUD.RADIUS);

    // collapse arrow tab, top-right corner of the panel
    noStroke();
    fill(...UI_THEME.tabBg);
    const tab = this._toggleHitbox();
    rect(tab.x, tab.y, tab.w, tab.h, 0, PlayerHUD.RADIUS, 0, 10);
    fill(...UI_THEME.tabText);
    textFont('IBM Plex Mono');
    textAlign(CENTER, CENTER);
    textSize(15);
    text('<', tab.x + tab.w / 2, tab.y + tab.h / 2 + 1);

    // player id
    noStroke();
    fill(...UI_THEME.heading);
    textFont('Space Grotesk');
    textAlign(LEFT, TOP);
    textSize(19);
    text(`Player ${this.tank.letter}`, x + p, y + p);

    // health bar - filled with the tank's own colour, muted for legibility
    const barX = x + p;
    let rowY = y + p + 34;
    this._drawLabel('Health', barX, rowY);
    this._drawBar(barX + 62, rowY, this.tank.health / PlayerHUD.MAX_STAT, this._mutedColour([this.tank.colourR, this.tank.colourG, this.tank.colourB]));

    // power bar
    rowY += 26;
    this._drawLabel('Power', barX, rowY);
    this._drawBar(barX + 62, rowY, this.tank.power / PlayerHUD.MAX_STAT, color(...UI_THEME.powerFill));

    // fuel + parachute on one row, icons instead of text labels
    rowY += 30;
    const iconSize = 18;
    this._drawIconValue('fuel.png', Math.round(this.tank.fuel), barX, rowY, iconSize);
    this._drawIconValue('parachute.png', Math.round(this.tank.parachute), barX + 90, rowY, iconSize);
  }

  _drawIconValue(spriteName, value, x, y, size) {
    const img = this.sprites?.[spriteName];
    if (img) {
      image(img, x, y, size, size);
    } else {
      // placeholder while the sprite is still loading, same fallback
      // shapes sketch.js used before the icons existed
      noStroke();
      fill(spriteName === 'fuel.png' ? color(210, 160, 60) : color(220));
      spriteName === 'fuel.png'
        ? rect(x, y, size, size, 2)
        : ellipse(x + size / 2, y + size / 2, size, size);
    }

    noStroke();
    fill(...UI_THEME.label);
    textFont('IBM Plex Mono');
    textSize(13);
    textAlign(LEFT, CENTER);
    text(value, x + size + 6, y + size / 2 + 1);
  }

  // Softens a pure RGB colour (e.g. tank.colour = [255,0,0]) into the
  // muted shade used for HUD bars, without altering the tank's actual
  // in-game colour. Keeps the hue, dials back saturation, lifts the
  // floor on brightness so dark hues (blue, magenta) don't go murky.
  _mutedColour([r, g, b]) {
    const base = color(r, g, b);
    const h = hue(base);
    const s = saturation(base);
    const br = brightness(base);

    colorMode(HSB, 360, 100, 100);
    const muted = color(h, s * 0.72, constrain(br * 0.85 + 15, 0, 100));
    colorMode(RGB, 255);
    return muted;
  }

  _drawLabel(label, x, y) {
    noStroke();
    fill(...UI_THEME.label);
    textFont('IBM Plex Mono');
    textAlign(LEFT, TOP);
    textSize(13);
    text(label, x, y + 1);
  }

  _drawBar(x, y, fraction, fillColour) {
    const w = PlayerHUD.BAR_WIDTH;
    const h = PlayerHUD.BAR_HEIGHT;
    const clamped = constrain(fraction, 0, 1);

    noStroke();
    fill(...UI_THEME.barTrack);
    rect(x, y, w, h, 3);

    fill(fillColour);
    rect(x, y, w * clamped, h, 3);

    noFill();
    stroke(...UI_THEME.panelBorder);
    strokeWeight(1);
    rect(x, y, w, h, 3);
  }
}
