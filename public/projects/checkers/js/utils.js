// checkers/js/utils.js

/**
 * Small collection of stateless helper functions shared across the game.
 */

// ==== Colour Helpers ====

/**
 * Converts a hex colour string to an [r, g, b] array.
 * @param {string} hex - Hex colour string, e.g. '#ff0000'.
 * @returns {number[]} RGB triplet, each channel in the range 0-255.
 */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ==== Animation Easing ====

/**
 * Quadratic ease-in-out curve, used to animate jump arcs smoothly
 * (slow start, fast middle, slow end).
 * @param {number} t - Progress through the animation, from 0 to 1.
 * @returns {number} Eased progress, from 0 to 1.
 */
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
