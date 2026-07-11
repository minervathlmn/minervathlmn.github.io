// checkers/js/Bot.js

/**
 * AI opponent for the checkers game. Difficulty determines the strategy:
 *  - 'beginner'     -> greedy, one-move-lookahead heuristic
 *  - 'intermediate' -> minimax search, fixed depth
 *  - 'advanced'     -> minimax with alpha-beta pruning, deeper search
 */
class Bot {
  // ==== Config ====

  static PIECE_VALUE = 3;
  static KING_VALUE = 5;
  static WIN_SCORE = 10000;

  /**
   * @param {string} difficulty - 'beginner' | 'intermediate' | 'advanced'.
   */
  constructor(difficulty = 'beginner') {
    this.difficulty = difficulty;
  }

  // ==== Public API ====

  /**
   * Picks a move for the bot to play, using the strategy for its
   * current difficulty.
   * @param {Game} game
   * @returns {Move|null} The chosen move, or null if none are available.
   */
  chooseMove(game) {
    const legalMoves = game.getLegalMoves();
    if (legalMoves.length === 0) return null;

    switch (this.difficulty) {
      case 'advanced':
        return this.searchBest(game, legalMoves, 8, true);
      case 'intermediate':
        return this.searchBest(game, legalMoves, 4, false);
      case 'beginner':
      default:
        return this.chooseGreedy(game, legalMoves);
    }
  }

  // ==== Greedy Strategy (beginner) ====

  /**
   * Picks the move with the best immediate (one-ply) heuristic score,
   * breaking ties randomly.
   * @param {Game} game
   * @param {Move[]} legalMoves
   * @returns {Move}
   */
  chooseGreedy(game, legalMoves) {
    let best = [];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
      const score = this.greedyScore(game, move);
      if (score > bestScore) {
        bestScore = score;
        best = [move];
      } else if (score === bestScore) {
        best.push(move);
      }
    }

    return best[Math.floor(Math.random() * best.length)];
  }

  /**
   * Heuristic score for a single move: rewards captures (more for
   * capturing a king) and rewards moves that promote to king.
   * @param {Game} game
   * @param {Move} move
   * @returns {number}
   */
  greedyScore(game, move) {
    let score = 0;

    if (move.isJump()) {
      const captured = move.captured.getPiece();
      score += captured.isKing ? 2 : 1;
    }

    const piece = move.from.getPiece();
    if (!piece.isKing) {
      const width = game.board.getWidth();
      const promotes = (piece.colour === 'dark' && move.to.y === 0)
        || (piece.colour === 'light' && move.to.y === width - 1);
      if (promotes) score += 0.5;
    }

    return score;
  }

  // ==== Minimax / Alpha-Beta Search (intermediate, advanced) ====

  /**
   * Evaluates every legal move `depth` plies deep (via minimax or
   * alpha-beta) and returns the best one, breaking ties randomly.
   * @param {Game} game
   * @param {Move[]} legalMoves
   * @param {number} depth - Search depth in plies.
   * @param {boolean} useAlphaBeta - Whether to prune with alpha-beta.
   * @returns {Move}
   */
  searchBest(game, legalMoves, depth, useAlphaBeta) {
    const botColour = game.currentPlayer;
    const moves = this.shuffled(legalMoves);

    let bestMoves = [];
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const move of moves) {
      const undoInfo = this.applySimulated(game, move);
      const nextMaximizing = (game.currentPlayer === botColour);

      const score = useAlphaBeta
        ? this.alphaBeta(game, depth - 1, alpha, beta, nextMaximizing, botColour)
        : this.minimax(game, depth - 1, nextMaximizing, botColour);

      this.undoSimulated(game, undoInfo);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
      if (useAlphaBeta) alpha = Math.max(alpha, bestScore);
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  /**
   * Plain minimax search (no pruning).
   * @param {Game} game
   * @param {number} depth - Remaining plies to search.
   * @param {boolean} maximizing - Whether the current ply favours the bot.
   * @param {string} botColour
   * @returns {number} Score of the position from the bot's perspective.
   */
  minimax(game, depth, maximizing, botColour) {
    const terminal = this.terminalScore(game, depth, botColour);
    if (terminal !== null) return terminal;
    if (depth === 0) return this.evaluate(game, botColour);

    const moves = game.getLegalMoves();
    let best = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      const undoInfo = this.applySimulated(game, move);
      const nextMaximizing = (game.currentPlayer === botColour);

      const value = this.minimax(game, depth - 1, nextMaximizing, botColour);

      this.undoSimulated(game, undoInfo);

      best = maximizing ? Math.max(best, value) : Math.min(best, value);
    }

    return best;
  }

  /**
   * Minimax search with alpha-beta pruning, allowing greater depth for
   * the same search budget.
   * @param {Game} game
   * @param {number} depth - Remaining plies to search.
   * @param {number} alpha - Best score the maximizer can guarantee so far.
   * @param {number} beta - Best score the minimizer can guarantee so far.
   * @param {boolean} maximizing
   * @param {string} botColour
   * @returns {number} Score of the position from the bot's perspective.
   */
  alphaBeta(game, depth, alpha, beta, maximizing, botColour) {
    const terminal = this.terminalScore(game, depth, botColour);
    if (terminal !== null) return terminal;
    if (depth === 0) return this.evaluate(game, botColour);

    const moves = game.getLegalMoves();

    if (maximizing) {
      let value = -Infinity;
      for (const move of moves) {
        const undoInfo = this.applySimulated(game, move);
        const nextMaximizing = (game.currentPlayer === botColour);

        value = Math.max(value, this.alphaBeta(game, depth - 1, alpha, beta, nextMaximizing, botColour));

        this.undoSimulated(game, undoInfo);

        alpha = Math.max(alpha, value);
        if (alpha >= beta) break; // beta cut-off: minimizer won't allow this branch
      }
      return value;
    } else {
      let value = Infinity;
      for (const move of moves) {
        const undoInfo = this.applySimulated(game, move);
        const nextMaximizing = (game.currentPlayer === botColour);

        value = Math.min(value, this.alphaBeta(game, depth - 1, alpha, beta, nextMaximizing, botColour));

        this.undoSimulated(game, undoInfo);

        beta = Math.min(beta, value);
        if (alpha >= beta) break; // alpha cut-off: maximizer won't allow this branch
      }
      return value;
    }
  }

  // ==== Search Helpers ====

  /**
   * Checks whether the game has ended at this node, returning a large
   * win/loss score (biased by remaining depth, so faster wins are
   * preferred) or null if the game is still in progress.
   * @param {Game} game
   * @param {number} depth
   * @param {string} botColour
   * @returns {number|null}
   */
  terminalScore(game, depth, botColour) {
    if (!game.isGameOver()) return null;
    const winner = game.getWinner();
    return winner === botColour ? Bot.WIN_SCORE + depth : -Bot.WIN_SCORE - depth;
  }

  /**
   * Static evaluation of a board position from the bot's perspective:
   * rewards material (extra for kings), slight bonus for advancing
   * regular pieces toward promotion, and a slight bonus for
   * centre-board control.
   * @param {Game} game
   * @param {string} botColour
   * @returns {number}
   */
  evaluate(game, botColour) {
    const width = game.board.getWidth();
    let score = 0;

    for (const row of game.board.grid) {
      for (const cell of row) {
        const piece = cell.getPiece();
        if (piece === null) continue;

        let value = piece.isKing ? Bot.KING_VALUE : Bot.PIECE_VALUE;

        if (!piece.isKing) {
          const advanced = piece.colour === 'dark' ? (width - 1 - cell.y) : cell.y;
          value += advanced * 0.1;
        }
        const centreDistance = Math.abs(cell.x - (width - 1) / 2);
        value += (width / 2 - centreDistance) * 0.05;

        score += (piece.colour === botColour) ? value : -value;
      }
    }

    return score;
  }

  // ==== Simulation (apply/undo for search) ====

  /**
   * Applies a move directly to the live game state for search purposes,
   * capturing everything needed to reverse it afterward.
   * @param {Game} game
   * @param {Move} move
   * @returns {object} Undo info, to be passed to undoSimulated().
   */
  applySimulated(game, move) {
    const piece = move.from.getPiece();
    const wasKing = piece.isKing;
    const capturedPiece = move.isJump() ? move.captured.getPiece() : null;
    const turnBefore = game.currentPlayer;
    const chainBefore = game.chainCell;

    game.board.movePiece(move);

    if (move.isJump() && game.hasFurtherJump(move.to)) {
      game.chainCell = move.to;
    } else {
      game.chainCell = null;
      game.switchTurn();
    }

    return { move, piece, wasKing, capturedPiece, turnBefore, chainBefore };
  }

  /**
   * Reverses a move previously applied by applySimulated(), restoring
   * the exact prior game state.
   * @param {Game} game
   * @param {object} info - Undo info returned by applySimulated().
   */
  undoSimulated(game, info) {
    const { move, piece, wasKing, capturedPiece, turnBefore, chainBefore } = info;

    move.from.setPiece(piece);
    move.to.setPiece(null);
    piece.isKing = wasKing;

    if (move.isJump() && capturedPiece) {
      move.captured.setPiece(capturedPiece);
    }

    game.currentPlayer = turnBefore;
    game.chainCell = chainBefore;
  }

  // ==== Utilities ====

  /**
   * @param {Array} arr
   * @returns {Array} A shuffled shallow copy of `arr` (Fisher-Yates).
   */
  shuffled(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
