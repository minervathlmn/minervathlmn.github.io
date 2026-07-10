/**
 * A single checkers piece: a colour ('light' or 'dark') and whether it has been
 * crowned. Knows how to compute its own available moves given the board
 * grid, but has no idea whose turn it is or whether a move is mandatory -
 * that's Game's job.
 */
class Piece {
  static UPWARD_DIRECTIONS = [[-1, -1], [1, -1]];   // up-left, up-right
  static DOWNWARD_DIRECTIONS = [[-1, 1], [1, 1]];   // down-left, down-right

  constructor(colour) {
    this.colour = colour; // 'light' or 'dark'
    this.isKing = false;
  }

  promote(cell, boardWidth) {
    if ((this.colour === 'dark' && cell.y === 0) ||
        (this.colour === 'light' && cell.y === boardWidth - 1)) {
      this.isKing = true;
    }
  }

  // --- Movement logic -------------------------------------------------

  getAvailableMoves(src, grid) {
    const moves = [];

    if (this.isKing || this.colour === 'dark') {
      for (const dir of Piece.UPWARD_DIRECTIONS) {
        this.checkDirection(src, dir, grid, moves);
      }
    }
    if (this.isKing || this.colour === 'light') {
      for (const dir of Piece.DOWNWARD_DIRECTIONS) {
        this.checkDirection(src, dir, grid, moves);
      }
    }

    return moves;
  }

  checkDirection(src, dir, grid, moves) {
    const [dx, dy] = dir;
    const adjX = src.x + dx;
    const adjY = src.y + dy;

    if (this.isValidMove(adjX, adjY, grid)) {
      moves.push(new Move(src, grid[adjY][adjX]));
      return;
    }

    const destX = src.x + 2 * dx;
    const destY = src.y + 2 * dy;

    if (this.isValidJump(adjX, adjY, destX, destY, grid)) {
      moves.push(new Move(src, grid[destY][destX], grid[adjY][adjX]));
    }
  }

  isInBounds(x, y, grid) {
    return x >= 0 && x < grid.length && y >= 0 && y < grid.length;
  }

  isValidMove(x, y, grid) {
    return this.isInBounds(x, y, grid) && grid[y][x].getPiece() === null;
  }

  isValidJump(adjX, adjY, destX, destY, grid) {
    return this.isInBounds(adjX, adjY, grid)
      && this.isValidMove(destX, destY, grid)
      && grid[adjY][adjX].getPiece() !== null
      && grid[adjY][adjX].getPiece().colour !== this.colour;
  }
}
