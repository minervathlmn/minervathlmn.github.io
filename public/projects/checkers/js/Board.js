// checkers/js/Board.js

/**
 * Represents the 8x8 checkers board as a grid of Cells, and provides
 * queries and mutations for reading and moving pieces on it.
 */
class Board {
  static BOARD_WIDTH = 8;

  constructor() {
    this.buildEmptyGrid();
  }

  // ==== Setup ====

  /** Rebuilds the grid as a fresh 8x8 set of empty Cells. */
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

  /** Empties the board without placing any pieces. */
  clear() {
    this.buildEmptyGrid();
  }

  /** Resets the board to the standard checkers starting position. */
  reset() {
    this.buildEmptyGrid();
    for (let y = 0; y < Board.BOARD_WIDTH; y++) {
      for (let x = 0; x < Board.BOARD_WIDTH; x++) {
        // Pieces only ever sit on dark squares
        if ((x + y) % 2 === 1) {
          if (y < 3) this.grid[y][x].setPiece(new Piece('light'));
          else if (y >= 5) this.grid[y][x].setPiece(new Piece('dark'));
        }
      }
    }
  }

  // ==== Queries ====

  /**
   * @param {number} x
   * @param {number} y
   * @returns {Cell}
   */
  getCell(x, y) {
    return this.grid[y][x];
  }

  /** @returns {number} Board width/height (the board is always square). */
  getWidth() {
    return Board.BOARD_WIDTH;
  }

  /**
   * @param {string} colour - 'light' or 'dark'.
   * @returns {Cell[]} All cells currently holding a piece of that colour.
   */
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

  /**
   * @param {string} colour - 'light' or 'dark'.
   * @returns {number} Number of pieces of that colour still on the board.
   */
  countPieces(colour) {
    return this.getCellsWithPiece(colour).length;
  }

  /**
   * @param {Cell} from
   * @returns {Move[]} Legal moves for the piece on `from`, or [] if the
   * cell is empty.
   */
  getAvailableMoves(from) {
    const piece = from.getPiece();
    if (piece === null) return [];
    return piece.getAvailableMoves(from, this.grid);
  }

  // ==== Mutation ====

  /**
   * Applies a move to the board: relocates the piece, removes any
   * captured piece, and checks for promotion.
   * @param {Move} move
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