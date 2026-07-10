/**
 * The referee. Owns the Board and whose turn it is, and decides what's
 * actually legal right now - including mandatory captures and multi-jump
 * chains. UI code talks to Game; Game is the only thing that talks to Board.
 */
const MOVES_WITHOUT_ACTION_LIMIT = 40; // consecutive turns with no capture/promotion before it's a draw

class Game {
  constructor() {
    this.board = new Board();
    this.currentPlayer = 'dark';
    this.chainCell = null;
    this.gameStarted = false;
    this.history = []; // stack of applied moves, for undo()
    this.moveGroup = 0; // increments each time a new (non-chained) move sequence starts
    this.movesSinceAction = 0; // consecutive turns (not elementary moves) with no capture/promotion
    this.actionThisTurn = false; // did the in-progress turn/chain include a capture or promotion?
  }

  /** Populates the board with the standard starting position and marks
   * the game as underway. Called once the player has picked 1P/2P (and
   * difficulty, if applicable) from the mode-select screen. */
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

  /** Resets the board to the starting position without touching mode or
   * difficulty - this is what the sidebar's "Start Over" button calls. */
  restart() {
    this.board.reset();
    this.currentPlayer = 'dark';
    this.chainCell = null;
    this.history = [];
    this.moveGroup = 0; // increments each time a new (non-chained) move sequence starts
    this.movesSinceAction = 0;
    this.actionThisTurn = false;
  }

  /**
   * All legal moves for the current player right now. If a jump is
   * available anywhere for this player, only jumps are returned
   * (mandatory capture rule). If a multi-jump chain is in progress,
   * only moves for the chained piece are returned.
   */
  getLegalMoves() {
    let moves = [];

    if (this.chainCell !== null) {
      for (const m of this.board.getAvailableMoves(this.chainCell)) {
        if (m.isJump()) moves.push(m);
      }
      return moves;
    }

    for (const cell of this.board.getCellsWithPiece(this.currentPlayer)) {
      moves = moves.concat(this.board.getAvailableMoves(cell));
    }

    const anyJump = moves.some(m => m.isJump());
    if (anyJump) moves = moves.filter(m => m.isJump());

    return moves;
  }

  /** Cells containing a piece of the current player that has at least
   * one legal move right now (already respects mandatory-capture
   * filtering and mid-chain restriction, since it's derived from
   * getLegalMoves()). */
  getMovablePieces() {
    const cells = new Set();
    for (const m of this.getLegalMoves()) cells.add(m.from);
    return cells;
  }

  /**
   * Applies a move that has already been checked against getLegalMoves().
   * Handles multi-jump chaining, turn switching, and records enough to
   * undo this single step later.
   *
   * @return true if the move was applied
   */
  applyMove(move) {
    const legal = this.getLegalMoves();
    if (!legal.some(m => m.equals(move))) return false;

    const piece = move.from.getPiece();
    const wasKing = piece.isKing;
    const capturedPiece = move.isJump() ? move.captured.getPiece() : null;
    const turnBefore = this.currentPlayer;
    const chainBefore = this.chainCell;

    // A fresh (non-chained) move starts a new undo group; a move that
    // continues an in-progress multi-jump chain stays in the same group,
    // so the whole chain undoes as one unit.
    if (chainBefore === null) this.moveGroup++;

    // Snapshot draw-rule state at the start of a turn only, so undo can
    // restore it in one shot when the whole group is popped.
    const movesSinceActionBefore = this.movesSinceAction;
    const actionThisTurnBefore = this.actionThisTurn;

    this.board.movePiece(move);

    const isPromotion = !wasKing && piece.isKing;
    if (move.isJump() || isPromotion) this.actionThisTurn = true;

    this.history.push({
      move, piece, wasKing, capturedPiece, turnBefore, chainBefore, group: this.moveGroup,
      movesSinceActionBefore, actionThisTurnBefore
    });

    if (move.isJump() && this.hasFurtherJump(move.to)) {
      this.chainCell = move.to;
      return true; // same player's turn continues
    }

    // Turn (and any chain) is finalized - commit the draw counter.
    this.movesSinceAction = this.actionThisTurn ? 0 : this.movesSinceAction + 1;
    this.actionThisTurn = false;

    this.chainCell = null;
    this.switchTurn();
    return true;
  }

  /** Reverses the entire most recent move sequence - a single step, or a
   * full multi-jump chain if the last move was part of one - restoring
   * the board back to how it looked right before that sequence began. */
  undo() {
    if (this.history.length === 0) return false;

    const targetGroup = this.history[this.history.length - 1].group;
    let groupStart; // will end up holding the group's first (earliest-pushed) entry

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
      groupStart = last; // popping newest-to-oldest, so the last one wins
    }

    // groupStart is the move that began this turn/chain - its "before"
    // snapshot is exactly the draw-rule state to roll back to.
    this.movesSinceAction = groupStart.movesSinceActionBefore;
    this.actionThisTurn = groupStart.actionThisTurnBefore;

    return true;
  }

  canUndo() {
    return this.history.length > 0;
  }

  hasFurtherJump(from) {
    return this.board.getAvailableMoves(from).some(m => m.isJump());
  }

  switchTurn() {
    this.currentPlayer = (this.currentPlayer === 'light') ? 'dark' : 'light';
  }

  hasNoLegalMoves(colour) {
    for (const cell of this.board.getCellsWithPiece(colour)) {
      if (this.board.getAvailableMoves(cell).length > 0) return false;
    }
    return true;
  }

  isDraw() {
    return this.movesSinceAction >= MOVES_WITHOUT_ACTION_LIMIT;
  }

  isGameOver() {
    if (!this.gameStarted) return false;
    return this.board.countPieces('light') === 0
      || this.board.countPieces('dark') === 0
      || this.hasNoLegalMoves(this.currentPlayer)
      || this.isDraw();
  }

  getWinner() {
    if (this.board.countPieces('light') === 0) return 'dark';
    if (this.board.countPieces('dark') === 0) return 'light';
    if (this.isDraw()) return null; // no winner - Bot.js/UI should treat this as a draw, not a loss
    return (this.currentPlayer === 'light') ? 'dark' : 'light'; // currentPlayer is stuck -> other side wins
  }
}
