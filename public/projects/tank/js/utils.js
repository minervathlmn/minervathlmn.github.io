/**
 * Server-authoritative model trimmed this down:
 * - parseColourString()/randomColour() -> gone; tank colours arrive
 *   already-resolved as colourR/G/B on the synced TankState
 * - findNextAlive() -> gone; turn order is entirely server-decided now,
 *   nothing client-side ever needs to compute "who's next"
 * - clamp() and loadSpriteSafe() are still used (CosmeticProjectile's
 *   terrain bounds check, and sketch.js's sprite preloading) and stay.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadSpriteSafe(path, onDone) {
  loadImage(path, img => onDone(img), () => onDone(null));
}
