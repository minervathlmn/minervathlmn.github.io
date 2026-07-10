/**
 * The AI opponent. Three difficulties:
 *
 *   beginner     - greedy: takes the best-looking capture available this
 *                  turn (biggest piece, prefers kings), otherwise moves
 *                  randomly. No lookahead at all.
 *   intermediate - minimax search, 4 plies deep.
 *   advanced     - minimax with alpha-beta pruning, 8 plies deep.
 *
 * A "ply" here is a single from->to move, not a full human turn - so a
 * multi-jump chain burns multiple plies of the search just like it burns
 * multiple real moves. That keeps the search logic identical whether or
 * not a chain is in progress: chooseMove always just answers "what's the
 * best single Move to make right now given the current chainCell state",
 * which is exactly what Game.getLegalMoves() already restricts itself to.
 *
 * The search simulates moves directly against `game.board` and mutates
 * `game.currentPlayer` / `game.chainCell` temporarily, then restores them -
 * it never touches `game.history`, so it can't interfere with the real
 * undo stack the player uses.
 */
class Bot {
  static PIECE_VALUE = 3;
  static KING_VALUE = 5;
  static WIN_SCORE = 10000;

  constructor(difficulty = 'beginner') {
    this.difficulty = difficulty;
  }

  /**
   * @param game the current Game, so the bot can inspect legal moves
   * @return a Move for the bot to play, or null if there are none
   *         (shouldn't normally happen - the caller should only ask when
   *         it's this player's turn and the game isn't over)
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

  // --- Beginner: greedy, no lookahead ---------------------------------

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

  /** Rates a single move in isolation - no lookahead, just "how good does
   * this look right now": prefer capturing (especially kings), and prefer
   * landing on the back row to crown a piece. */
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

  // --- Intermediate / Advanced: minimax (with optional alpha-beta) ---

  /**
   * Tries every legal move at the root, recursively scores what follows
   * it, and returns whichever move led to the best outcome for the bot.
   * `useAlphaBeta` just toggles pruning - the tree explored (and the move
   * eventually picked) is otherwise the same shape of search either way.
   */
  searchBest(game, legalMoves, depth, useAlphaBeta) {
    const botColour = game.currentPlayer;
    const moves = this.shuffled(legalMoves); // randomize order so ties aren't always won by the first move in the list

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
        if (alpha >= beta) break; // beta cutoff - opponent won't let this branch happen
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
        if (alpha >= beta) break; // alpha cutoff - bot has a better option elsewhere
      }
      return value;
    }
  }

  /** Returns a decisive +/- score if the game has actually ended in this
   * simulated position (so a forced win/loss always outweighs a merely
   * good material score), or null if the search should keep going. */
  terminalScore(game, depth, botColour) {
    if (!game.isGameOver()) return null;
    const winner = game.getWinner();
    // + depth so a faster forced win/slower forced loss is preferred
    // over an equally-certain but longer one.
    return winner === botColour ? Bot.WIN_SCORE + depth : -Bot.WIN_SCORE - depth;
  }

  /** Static material/positional evaluation of the current board, from
   * botColour's perspective (positive = good for the bot). */
  evaluate(game, botColour) {
    const width = game.board.getWidth();
    let score = 0;

    for (const row of game.board.grid) {
      for (const cell of row) {
        const piece = cell.getPiece();
        if (piece === null) continue;

        let value = piece.isKing ? Bot.KING_VALUE : Bot.PIECE_VALUE;

        // Small nudge for non-kings advancing toward their crowning row,
        // and for staying off the board's edges (edge pieces have fewer
        // move options and can't be jumped from one side, but also can't
        // jump either).
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

  // --- Simulation helpers ---------------------------------------------
  // These mirror what Game.applyMove()/undo() do for a single step, but
  // skip the history bookkeeping entirely, since the search needs to
  // apply and unwind thousands of moves that should never be undo-able
  // by the player.

  applySimulated(game, move) {
    const piece = move.from.getPiece();
    const wasKing = piece.isKing;
    const capturedPiece = move.isJump() ? move.captured.getPiece() : null;
    const turnBefore = game.currentPlayer;
    const chainBefore = game.chainCell;

    game.board.movePiece(move);

    if (move.isJump() && game.hasFurtherJump(move.to)) {
      game.chainCell = move.to;
      // same player continues
    } else {
      game.chainCell = null;
      game.switchTurn();
    }

    return { move, piece, wasKing, capturedPiece, turnBefore, chainBefore };
  }

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

  shuffled(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}