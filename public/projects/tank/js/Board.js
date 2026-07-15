/**
 * Server-authoritative model: terrain/trees are now fully synced from
 * room.state, so Board no longer parses layouts or holds terrain state
 * client-side. Only the canvas-size constants survive — still used
 * throughout sketch.js/CosmeticProjectile.js for drawing and bounds.
 */
class Board {
  static CELLSIZE = 32;
  static WIDTH = 864;
  static HEIGHT = 640;
}
