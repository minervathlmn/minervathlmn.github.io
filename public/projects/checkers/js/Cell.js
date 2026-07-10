/**
 * A single cell on the checkers board, identified by its (x, y) coordinates.
 * May or may not currently hold a Piece.
 *
 * This link is one-directional: a Cell knows its piece, but a piece has no
 * idea which Cell it's on. That means a piece's location has exactly one
 * source of truth - wherever it sits in Board's grid - instead of being
 * duplicated on the piece itself and needing to be kept in sync.
 */
class Cell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.piece = null;
  }

  /**
   * Assigns a piece to this cell, or clears it if `p` is null. This does
   * NOT remove `p` from wherever it previously sat - callers (see
   * Board.movePiece) are responsible for clearing the old cell themselves.
   */
  setPiece(p) {
    this.piece = p;
  }

  getPiece() {
    return this.piece;
  }
}
