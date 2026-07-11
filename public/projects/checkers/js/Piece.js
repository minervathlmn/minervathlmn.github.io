// checkers/js/Piece.js

/**
 * A single checkers piece. Tracks colour and king status, and can
 * generate its own legal moves against a given board grid.
 */
class Piece {
  // Diagonal directions a piece can move in, before considering king status
  static UPWARD_DIRECTIONS = [[-1, -1], [1, -1]];   // used by 'dark' pieces / kings
  static DOWNWARD_DIRECTIONS = [[-1, 1], [1, 1]];   // used by 'light' pieces / kings

  /**
   * @param {string} colour - 'light' or 'dark'.
   */
  constructor(colour) {
    this.colour = colour;
    this.isKing = false;
  }

  // ==== State ====

  /**
   * Promotes the piece to king if it has just reached the far row for
   * its colour.
   * @param {Cell} cell - The cell the piece just moved to.
   * @param {number} boardWidth
   */
  promote(cell, boardWidth) {
    if ((this.colour === 'dark' && cell.y === 0) ||
        (this.colour === 'light' && cell.y === boardWidth - 1)) {
      this.isKing = true;
    }
  }

  // ==== Move Generation ====

  /**
   * Computes all legal moves (steps and jumps) available from a cell.
   * @param {Cell} src - Cell the piece currently occupies.
   * @param {Cell[][]} grid - The board's cell grid.
   * @returns {Move[]}
   */
  getAvailableMoves(src, grid) {
    const moves = [];

    // Dark pieces (and kings) can move upward
    if (this.isKing || this.colour === 'dark') {
      for (const dir of Piece.UPWARD_DIRECTIONS) {
        this.checkDirection(src, dir, grid, moves);
      }
    }
    // Light pieces (and kings) can move downward
    if (this.isKing || this.colour === 'light') {
      for (const dir of Piece.DOWNWARD_DIRECTIONS) {
        this.checkDirection(src, dir, grid, moves);
      }
    }

    return moves;
  }

  /**
   * Checks a single diagonal direction for a valid step or jump, and
   * pushes any move found onto `moves`.
   * @param {Cell} src
   * @param {number[]} dir - [dx, dy] direction to check.
   * @param {Cell[][]} grid
   * @param {Move[]} moves - Accumulator array, mutated in place.
   */
  checkDirection(src, dir, grid, moves) {
    const [dx, dy] = dir;
    const adjX = src.x + dx;
    const adjY = src.y + dy;

    // Simple step onto an empty adjacent cell
    if (this.isValidMove(adjX, adjY, grid)) {
      moves.push(new Move(src, grid[adjY][adjX]));
      return;
    }

    // Otherwise check for a jump over an opposing piece
    const destX = src.x + 2 * dx;
    const destY = src.y + 2 * dy;

    if (this.isValidJump(adjX, adjY, destX, destY, grid)) {
      moves.push(new Move(src, grid[destY][destX], grid[adjY][adjX]));
    }
  }

  // ==== Validation Helpers ====

  /** @returns {boolean} Whether (x, y) falls within the grid's bounds. */
  isInBounds(x, y, grid) {
    return x >= 0 && x < grid.length && y >= 0 && y < grid.length;
  }

  /** @returns {boolean} Whether (x, y) is in bounds and unoccupied. */
  isValidMove(x, y, grid) {
    return this.isInBounds(x, y, grid) && grid[y][x].getPiece() === null;
  }

  /**
   * @returns {boolean} Whether jumping over (adjX, adjY) to land on
   * (destX, destY) is legal: the adjacent cell must hold an opposing
   * piece, and the destination must be a valid empty cell.
   */
  isValidJump(adjX, adjY, destX, destY, grid) {
    return this.isInBounds(adjX, adjY, grid)
      && this.isValidMove(destX, destY, grid)
      && grid[adjY][adjX].getPiece() !== null
      && grid[adjY][adjX].getPiece().colour !== this.colour;
  }
}
