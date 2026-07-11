// checkers/js/Cell.js

/**
 * A single square on the board. Tracks its board coordinates and
 * whichever Piece (if any) currently occupies it.
 */
class Cell {
  /**
   * @param {number} x - Column index (0-based).
   * @param {number} y - Row index (0-based).
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.piece = null;
  }

  /**
   * Places a piece on this cell, or clears it if null is passed.
   * @param {Piece|null} p
   */
  setPiece(p) {
    this.piece = p;
  }

  /**
   * @returns {Piece|null} The piece currently on this cell, or null if empty.
   */
  getPiece() {
    return this.piece;
  }
}
