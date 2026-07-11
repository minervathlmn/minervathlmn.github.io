// checkers/js/Move.js

/**
 * Represents a single move from one cell to another, optionally
 * capturing a piece along the way (a jump).
 */
class Move {
  /**
   * @param {Cell} from
   * @param {Cell} to
   * @param {Cell|null} captured - Cell holding the captured piece, if
   * this move is a jump.
   */
  constructor(from, to, captured = null) {
    this.from = from;
    this.to = to;
    this.captured = captured;
  }

  /** @returns {boolean} Whether this move captures a piece. */
  isJump() {
    return this.captured !== null;
  }

  /**
   * @param {*} other
   * @returns {boolean} Whether `other` represents the same move.
   */
  equals(other) {
    return other instanceof Move
      && this.from === other.from
      && this.to === other.to
      && this.captured === other.captured;
  }

  /** @returns {string} Human-readable description, useful for debugging. */
  toString() {
    const kind = this.isJump() ? 'jump' : 'step';
    let s = `Move[${kind} (${this.from.x},${this.from.y}) -> (${this.to.x},${this.to.y})`;
    if (this.isJump()) s += `, captures (${this.captured.x},${this.captured.y})`;
    return s + ']';
  }
}