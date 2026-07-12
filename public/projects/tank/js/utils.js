/**
 * Parses the "r,g,b" strings used in config.json (player_colours,
 * foreground-colour). Returns null for "random" (or anything malformed)
 * so callers can fall back to randomColour().
 */
function parseColourString(str) {
  if (!str || str === 'random') return null;

  const parts = str.split(',').map(Number);
  if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
    return parts;
  }
  return null;
}

function randomColour() {
  return [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
  ];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Loads an image without blocking p5's setup() - if the asset hasn't
 * been added to /assets yet (or fails to load for any reason), resolves
 * to null so callers can draw a placeholder shape instead of crashing.
 */
function loadSpriteSafe(path, onDone) {
  loadImage(path, img => onDone(img), () => onDone(null));
}
