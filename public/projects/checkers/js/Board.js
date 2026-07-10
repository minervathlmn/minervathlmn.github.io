/**
 * Owns the 8x8 grid of Cells and the pieces sitting on them. Board knows
 * nothing about whose turn it is or who's winning - that's Game's job.
 * Board only answers "what does the grid look like" and "make this move
 * happen."
 */
class Board {
  static BOARD_WIDTH = 8;

  constructor() {
    this.buildEmptyGrid();
  }

  buildEmptyGrid() {
    this.grid = [];
    for (let y = 0; y < Board.BOARD_WIDTH; y++) {
      const row = [];
      for (let x = 0; x < Board.BOARD_WIDTH; x++) {
        row.push(new Cell(x, y));
      }
      this.grid.push(row);
    }
  }

  /** Empties the board back to bare cells, no pieces - the state shown
   * behind the landing/mode-select screens before a game has started. */
  clear() {
    this.buildEmptyGrid();
  }

  /** Resets the board to the standard checkers starting position. */
  reset() {
    this.buildEmptyGrid();
    for (let y = 0; y < Board.BOARD_WIDTH; y++) {
      for (let x = 0; x < Board.BOARD_WIDTH; x++) {
        if ((x + y) % 2 === 1) {
          if (y < 3) this.grid[y][x].setPiece(new Piece('light'));
          else if (y >= 5) this.grid[y][x].setPiece(new Piece('dark'));
        }
      }
    }
  }

  getCell(x, y) {
    return this.grid[y][x];
  }

  getWidth() {
    return Board.BOARD_WIDTH;
  }

  getCellsWithPiece(colour) {
    const cells = [];
    for (const row of this.grid) {
      for (const cell of row) {
        const piece = cell.getPiece();
        if (piece !== null && piece.colour === colour) cells.push(cell);
      }
    }
    return cells;
  }

  countPieces(colour) {
    return this.getCellsWithPiece(colour).length;
  }

  getAvailableMoves(from) {
    const piece = from.getPiece();
    if (piece === null) return [];
    return piece.getAvailableMoves(from, this.grid);
  }

  /**
   * Executes a move: relocates the piece, removes whatever it captured
   * (if it was a jump), and promotes it if it reached the far row.
   * Assumes `move` has already been validated as legal - Board doesn't
   * re-check legality, that's Game's job.
   */
  movePiece(move) {
    const { from, to } = move;
    const piece = from.getPiece();

    to.setPiece(piece);
    from.setPiece(null);

    if (move.isJump()) {
      move.captured.setPiece(null);
    }

    piece.promote(to, Board.BOARD_WIDTH);
  }
}
