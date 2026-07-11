// checkers/js/GameLogic.js

/** Number of moves without a capture or promotion before the game is a draw. */
const MOVES_WITHOUT_ACTION_LIMIT = 40;

/**
 * Owns the full game state for a single checkers match: the board,
 * whose turn it is, move history (for undo), and draw/win detection.
 */
class Game {
  constructor() {
    this.board = new Board();
    this.currentPlayer = 'dark';
    this.chainCell = null;       // non-null while mid multi-jump, holds the jumping piece's cell
    this.gameStarted = false;
    this.history = [];           // stack of applied moves, for undo
    this.moveGroup = 0;          // groups a multi-jump chain into a single undoable unit
    this.movesSinceAction = 0;   // moves since the last capture/promotion, for the draw rule
    this.actionThisTurn = false; // whether the current turn has captured or promoted
  }

  // ==== Lifecycle ====

  /** Resets the board to the starting position and marks the game as started. */
  start() {
    this.board.reset();
    this.currentPlayer = 'dark';
    this.chainCell = null;
    this.gameStarted = true;
    this.history = [];
    this.moveGroup = 0;
    this.movesSinceAction = 0;
    this.actionThisTurn = false;
  }

  /** Resets the board and state without changing `gameStarted`. */
  restart() {
    this.board.reset();
    this.currentPlayer = 'dark';
    this.chainCell = null;
    this.history = [];
    this.moveGroup = 0;
    this.movesSinceAction = 0;
    this.actionThisTurn = false;
  }

  // ==== Move Queries ====

  /**
   * Computes all legal moves for the current player, enforcing the
   * checkers rules that captures are mandatory and that a piece mid
   * multi-jump must continue jumping with that same piece.
   * @returns {Move[]}
   */
  getLegalMoves() {
    let moves = [];

    // Mid multi-jump: only further jumps from the same piece are legal
    if (this.chainCell !== null) {
      for (const m of this.board.getAvailableMoves(this.chainCell)) {
        if (m.isJump()) moves.push(m);
      }
      return moves;
    }

    for (const cell of this.board.getCellsWithPiece(this.currentPlayer)) {
      moves = moves.concat(this.board.getAvailableMoves(cell));
    }

    // Capturing is mandatory: if any jump exists, only jumps are legal
    const anyJump = moves.some(m => m.isJump());
    if (anyJump) moves = moves.filter(m => m.isJump());

    return moves;
  }

  /** @returns {Set<Cell>} Cells holding a piece that has at least one legal move. */
  getMovablePieces() {
    const cells = new Set();
    for (const m of this.getLegalMoves()) cells.add(m.from);
    return cells;
  }

  // ==== Move Application ====

  /**
   * Applies a move if it's legal, updating the board, turn, chain-jump
   * state, draw counter, and history.
   * @param {Move} move
   * @returns {boolean} Whether the move was legal and applied.
   */
  applyMove(move) {
    const legal = this.getLegalMoves();
    if (!legal.some(m => m.equals(move))) return false;

    const piece = move.from.getPiece();
    const wasKing = piece.isKing;
    const capturedPiece = move.isJump() ? move.captured.getPiece() : null;
    const turnBefore = this.currentPlayer;
    const chainBefore = this.chainCell;

    // A new move group starts each turn, but continues through a jump chain
    if (chainBefore === null) this.moveGroup++;

    const movesSinceActionBefore = this.movesSinceAction;
    const actionThisTurnBefore = this.actionThisTurn;

    this.board.movePiece(move);

    const isPromotion = !wasKing && piece.isKing;
    if (move.isJump() || isPromotion) this.actionThisTurn = true;

    this.history.push({
      move, piece, wasKing, capturedPiece, turnBefore, chainBefore, group: this.moveGroup,
      movesSinceActionBefore, actionThisTurnBefore
    });

    // Chain continues: same player must keep jumping with the same piece
    if (move.isJump() && this.hasFurtherJump(move.to)) {
      this.chainCell = move.to;
      return true;
    }

    this.movesSinceAction = this.actionThisTurn ? 0 : this.movesSinceAction + 1;
    this.actionThisTurn = false;

    this.chainCell = null;
    this.switchTurn();
    return true;
  }

  /**
   * Reverts the most recent move group (a full turn, including any
   * multi-jump chain) as a single atomic undo step.
   * @returns {boolean} Whether there was anything to undo.
   */
  undo() {
    if (this.history.length === 0) return false;

    const targetGroup = this.history[this.history.length - 1].group;
    let groupStart;

    while (this.history.length > 0 && this.history[this.history.length - 1].group === targetGroup) {
      const last = this.history.pop();
      const { move, piece, wasKing, capturedPiece, turnBefore, chainBefore } = last;

      move.from.setPiece(piece);
      move.to.setPiece(null);
      piece.isKing = wasKing;

      if (move.isJump() && capturedPiece) {
        move.captured.setPiece(capturedPiece);
      }

      this.currentPlayer = turnBefore;
      this.chainCell = chainBefore;
      groupStart = last;
    }

    this.movesSinceAction = groupStart.movesSinceActionBefore;
    this.actionThisTurn = groupStart.actionThisTurnBefore;

    return true;
  }

  /** @returns {boolean} Whether there's a move group available to undo. */
  canUndo() {
    return this.history.length > 0;
  }

  // ==== Turn / State Helpers ====

  /** @returns {boolean} Whether the piece on `from` has another jump available. */
  hasFurtherJump(from) {
    return this.board.getAvailableMoves(from).some(m => m.isJump());
  }

  /** Flips the current player between 'light' and 'dark'. */
  switchTurn() {
    this.currentPlayer = (this.currentPlayer === 'light') ? 'dark' : 'light';
  }

  /** @returns {boolean} Whether `colour` has no legal moves anywhere on the board. */
  hasNoLegalMoves(colour) {
    for (const cell of this.board.getCellsWithPiece(colour)) {
      if (this.board.getAvailableMoves(cell).length > 0) return false;
    }
    return true;
  }

  /** @returns {boolean} Whether the draw rule (40 moves without a capture/promotion) has been hit. */
  isDraw() {
    return this.movesSinceAction >= MOVES_WITHOUT_ACTION_LIMIT;
  }

  /** @returns {boolean} Whether the game has ended (win, no-moves loss, or draw). */
  isGameOver() {
    if (!this.gameStarted) return false;
    return this.board.countPieces('light') === 0
      || this.board.countPieces('dark') === 0
      || this.hasNoLegalMoves(this.currentPlayer)
      || this.isDraw();
  }

  /** @returns {string|null} The winning colour, or null for a draw. */
  getWinner() {
    if (this.board.countPieces('light') === 0) return 'dark';
    if (this.board.countPieces('dark') === 0) return 'light';
    if (this.isDraw()) return null;
    return (this.currentPlayer === 'light') ? 'dark' : 'light';
  }
}
