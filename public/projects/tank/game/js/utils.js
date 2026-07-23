function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Shades a bot's tank colour into a visibly distinct variant of the same
// hue, so a bot on the same letter/colour as a human in another room never
// reads as identical on-screen. Same HSB desaturate-and-lift idea as
// PlayerHUD's _mutedColour, but tuned harder (bigger saturation cut, no
// brightness lift) since this paints the tank body directly against
// varied terrain, not a HUD bar — it needs to stay readable as "not the
// human's colour" at a glance, not just softened.
function botShade([r, g, b]) {
  const base = color(r, g, b);
  const h = hue(base);
  const s = saturation(base);
  const br = brightness(base);

  colorMode(HSB, 360, 100, 100);
  const shaded = color(h, s * 0.7, constrain(br * 0.4, 0, 100));
  colorMode(RGB, 255);
  // return shaded;
  return [red(shaded), green(shaded), blue(shaded)]; // plain array, not a p5 Color
}
