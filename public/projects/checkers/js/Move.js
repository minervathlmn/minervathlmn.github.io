/**
 * A single, fully-described move: where a piece starts, where it ends up,
 * and - if it's a jump - which cell gets captured along the way.
 *
 * Piece.getAvailableMoves only produces destination cells, so this restores
 * the distinction between a plain step and a jump, which Game needs for the
 * mandatory-jump and multi-jump-chain rules.
 */
class Move {
  /**
   * @param from     the cell the piece starts on
   * @param to       the cell the piece ends up on
   * @param captured the cell holding the piece being jumped over, or
   *                 null if this is a plain step (not a jump)
   */
  constructor(from, to, captured = null) {
    this.from = from;
    this.to = to;
    this.captured = captured;
  }

  isJump() {
    return this.captured !== null;
  }

  /**
   * Two moves are equal if they reference the same from/to/captured cells.
   * This relies on each board position being one unique Cell object (see
   * Board), so it's a simple reference comparison - not a deep one.
   */
  equals(other) {
    return other instanceof Move
      && this.from === other.from
      && this.to === other.to
      && this.captured === other.captured;
  }

  toString() {
    const kind = this.isJump() ? 'jump' : 'step';
    let s = `Move[${kind} (${this.from.x},${this.from.y}) -> (${this.to.x},${this.to.y})`;
    if (this.isJump()) s += `, captures (${this.captured.x},${this.captured.y})`;
    return s + ']';
  }
}
