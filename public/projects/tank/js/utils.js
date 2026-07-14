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
 * Shared by GameLogic.playerOrder() (which mutates state) and
 * sketch.js's peekNextPlayer() (which only needs a preview). Finds the
 * next id in playerIDs, starting at fromIndex, that's still in
 * remainingTanks. Returns { id, index } so callers can decide what (if
 * anything) to mutate with the resolved index.
 */
function findNextAlive(playerIDs, remainingTanks, fromIndex) {
  let idx = fromIndex;
  let guard = 0; // safety net against an all-dead edge case looping forever
  while (guard++ < 1000) {
    const candidate = playerIDs[idx % playerIDs.length];
    if (remainingTanks.includes(candidate)) {
      return { id: candidate, index: idx };
    }
    idx++;
  }
  return { id: playerIDs[fromIndex % playerIDs.length], index: fromIndex };
}

/**
 * Loads an image without blocking p5's setup() - if the asset hasn't
 * been added to /assets yet (or fails to load for any reason), resolves
 * to null so callers can draw a placeholder shape instead of crashing.
 */
function loadSpriteSafe(path, onDone) {
  loadImage(path, img => onDone(img), () => onDone(null));
}
