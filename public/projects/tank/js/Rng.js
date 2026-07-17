/**
 * Deterministic PRNG (mulberry32). All clients seed GameLogic with the
 * same number (sent once by the server at game start), so wind/turn
 * "randomness" comes out identical on every screen instead of each
 * client rolling its own Math.random() and drifting apart immediately.
 */
function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}