// checkers/js/sketch.js

/**
 * Main p5 sketch (global mode) for the live game screen: board sizing,
 * rendering, move animation, and mouse input. Game rules live in
 * GameLogic.js; this file is purely presentation + input handling.
 */

// ==== Config / State ====

const BASE_CELLSIZE = 77;
let CELLSIZE = BASE_CELLSIZE;
const CHAIN_PAUSE_MS = 150; // brief pause before auto-continuing a single-option jump chain

let game;
let p5Ready = false;

let selectedCell = null;
let legalMovesForSelected = [];

let animation = null;
let pendingAutoMove = null; // scheduled move for an auto-continued jump chain

// ==== Sizing ====

/**
 * Computes the board's pixel size based on viewport/container dimensions,
 * capping it to the board's natural size so cells never render larger
 * than BASE_CELLSIZE.
 * @returns {number} Board side length in pixels.
 */
function computeBoardSize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w <= h) {
    return Math.floor(0.8 * Math.min(w, h));
  }

  const container = document.getElementById('canvas-container');
  const availW = container ? container.clientWidth : w;
  const availH = container ? container.clientHeight : h;
  const fitted = Math.floor(0.9 * Math.min(availW, availH));
  const maxSize = Board.BOARD_WIDTH * BASE_CELLSIZE;

  return Math.min(fitted, maxSize);
}

// ==== p5 Lifecycle ====

function setup() {
  game = new Game();

  const size = computeBoardSize();
  CELLSIZE = size / Board.BOARD_WIDTH;
  const cnv = createCanvas(size, size);
  cnv.parent('canvas-container');
  noStroke();

  p5Ready = true;
  tryStartGame();
}

function windowResized() {
  const size = computeBoardSize();
  CELLSIZE = size / Board.BOARD_WIDTH;
  resizeCanvas(size, size);
}

function draw() {
  background(255);

  if (pendingAutoMove && millis() >= pendingAutoMove.readyAt) {
    const move = pendingAutoMove.move;
    pendingAutoMove = null;
    applyMoveWithAnimation(move);
  }

  drawBoard();
  drawAnimatedPiece();

  if (game.isGameOver()) {
    drawGameOverMessage();
  }
}

// ==== Board Drawing ====

/** Draws the checkerboard squares, hint/selection/destination highlights, and pieces. */
function drawBoard() {
  const board = game.board;
  const isPlayersTurn = selectedMode !== '1p' || game.currentPlayer === 'dark';
  const hintsOn = (autoHints || manualHintActive) && game.gameStarted && isPlayersTurn;
  const movablePieces = hintsOn ? game.getMovablePieces() : new Set();

  for (let y = 0; y < board.getWidth(); y++) {
    for (let x = 0; x < board.getWidth(); x++) {
      const cell = board.getCell(x, y);

      fill((x + y) % 2 === 1 ? ACTIVE_THEME.darkCell : ACTIVE_THEME.lightCell);
      rect(x * CELLSIZE, y * CELLSIZE, CELLSIZE, CELLSIZE);

      if (hintsOn && movablePieces.has(cell) && cell !== selectedCell) {
        fill(ACTIVE_THEME.movable);
        rect(x * CELLSIZE, y * CELLSIZE, CELLSIZE, CELLSIZE);
      }

      if (cell === selectedCell) {
        fill(ACTIVE_THEME.selected);
        rect(x * CELLSIZE, y * CELLSIZE, CELLSIZE, CELLSIZE);
      }

      if (hintsOn && selectedCell !== null) {
        for (const m of legalMovesForSelected) {
          if (m.to === cell) {
            fill(m.isJump() ? ACTIVE_THEME.forceJump : ACTIVE_THEME.destination);
            rect(x * CELLSIZE, y * CELLSIZE, CELLSIZE, CELLSIZE);
            break;
          }
        }
      }

      drawPiece(cell);
    }
  }
}

/**
 * Draws the piece on a cell, unless it's currently mid-animation (that
 * piece is drawn separately by drawAnimatedPiece so it can move
 * smoothly between cells).
 * @param {Cell} cell
 */
function drawPiece(cell) {
  const piece = cell.getPiece();
  if (piece === null) return;

  if (animation && cell.x === animation.toX && cell.y === animation.toY) return;

  const centerX = cell.x * CELLSIZE + CELLSIZE / 2;
  const centerY = cell.y * CELLSIZE + CELLSIZE / 2;

  drawPieceAt(centerX, centerY, piece);
}

/**
 * Draws a single piece disc at exact pixel coordinates.
 * @param {number} centerX
 * @param {number} centerY
 * @param {Piece} piece
 * @param {number} alpha - Opacity 0-255, used to fade out captured pieces.
 */
function drawPieceAt(centerX, centerY, piece, alpha = 255) {
  const fillHex = piece.colour === 'light' ? ACTIVE_THEME.pieceLight : ACTIVE_THEME.pieceDark;
  const strokeHex = piece.colour === 'light' ? ACTIVE_THEME.pieceLightShadow : ACTIVE_THEME.pieceDarkShadow;

  strokeWeight(5);
  fill(...hexToRgb(fillHex), alpha);
  stroke(...hexToRgb(strokeHex), alpha);

  ellipse(centerX, centerY, CELLSIZE * 0.8, CELLSIZE * 0.8);

  if (piece.isKing) {
    strokeWeight(8);
    ellipse(centerX, centerY, CELLSIZE * 0.4, CELLSIZE * 0.4);
  }

  noStroke();
}

// ==== Animation ====

/**
 * Interpolates the moving piece's position along its path, arcing it
 * upward for jumps, and fades out any captured piece. Fires
 * onAnimationComplete() once the animation finishes.
 */
function drawAnimatedPiece() {
  if (!animation) return;

  const elapsed = millis() - animation.startTime;
  const t = constrain(elapsed / animation.duration, 0, 1);
  const eased = easeInOutQuad(t);

  const px = lerp(animation.fromX, animation.toX, eased);
  const py = lerp(animation.fromY, animation.toY, eased);

  let centerX = px * CELLSIZE + CELLSIZE / 2;
  let centerY = py * CELLSIZE + CELLSIZE / 2;

  if (animation.isJump) {
    centerY -= Math.sin(t * Math.PI) * CELLSIZE * 0.6; // arc upward mid-jump
  }

  drawPieceAt(centerX, centerY, animation.piece);

  if (animation.isJump && animation.capturedPiece) {
    const alpha = 255 * (1 - eased);
    const cx = animation.capturedX * CELLSIZE + CELLSIZE / 2;
    const cy = animation.capturedY * CELLSIZE + CELLSIZE / 2;
    drawPieceAt(cx, cy, animation.capturedPiece, alpha);
  }

  if (t >= 1) {
    const finished = animation;
    animation = null;
    onAnimationComplete(finished);
  }
}

/**
 * Handles bookkeeping once a move's animation finishes: scoring/turn
 * updates for a completed turn, or continuing/auto-resolving a
 * multi-jump chain.
 * @param {object} finished - The animation object that just completed.
 */
function onAnimationComplete(finished) {
  if (!finished.continuesChain) {
    incrementMoveCount(finished.piece.colour);
    updateTurnIndicator();
    checkForGameOverScore();
    maybeTriggerBotMove();
    return;
  }

  // Bot continues its own jump chain automatically
  if (selectedMode === '1p' && game.currentPlayer === 'light') {
    setTimeout(() => playBotMove(new Bot(selectedDifficulty)), CHAIN_PAUSE_MS);
    return;
  }

  const chainMoves = game.getLegalMoves();

  if (chainMoves.length === 1) {
    // Only one way to continue the chain - play it automatically
    pendingAutoMove = { move: chainMoves[0], readyAt: millis() + CHAIN_PAUSE_MS };
  } else if (chainMoves.length > 1) {
    // Multiple options - let the player choose the next jump
    selectedCell = game.chainCell;
    legalMovesForSelected = chainMoves;
  }
}

/** Draws the semi-transparent game-over overlay with the result message. */
function drawGameOverMessage() {
  const winner = game.getWinner();
  let label;

  if (winner === null) {
    label = "It's a draw!";
  } else if (winner === 'light') {
    label = `${ACTIVE_THEME.pieceLightName} wins!`;
  } else {
    label = `${ACTIVE_THEME.pieceDarkName} wins!`;
  }

  updateRestartButtonLabel();

  fill(0, 180);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text(label, width / 2, height / 2);
}

/** Relabels the restart button ("Start Over" pre-game, "Play Again" once the game has ended). */
function updateRestartButtonLabel() {
  const restartBtn = document.getElementById('restart-btn');
  restartBtn.textContent = game.isGameOver() ? 'Play Again' : 'Start Over';
}

// ==== Input Handling ====

function mousePressed() {
  if (isSettingsModalOpen()) return;
  if (!game.gameStarted || game.isGameOver()) return;
  if (animation || pendingAutoMove) return;
  if (selectedMode === '1p' && game.currentPlayer !== 'dark') return;
  if (mouseX < 0 || mouseX >= width || mouseY < 0 || mouseY >= height) return;

  const col = Math.floor(mouseX / CELLSIZE);
  const row = Math.floor(mouseY / CELLSIZE);

  if (col < 0 || col >= game.board.getWidth() || row < 0 || row >= game.board.getWidth()) {
    return;
  }

  const clicked = game.board.getCell(col, row);

  if (selectedCell === null) {
    trySelect(clicked);
  } else {
    tryMove(clicked);
  }
}

/**
 * Selects `clicked` if it holds a piece belonging to the current
 * player, and loads that piece's legal moves for highlighting.
 * @param {Cell} clicked
 */
function trySelect(clicked) {
  const piece = clicked.getPiece();
  if (piece === null || piece.colour !== game.currentPlayer) return;

  selectedCell = clicked;
  legalMovesForSelected = game.getLegalMoves().filter(m => m.from === selectedCell);
}

/**
 * Attempts to move the selected piece to `clicked`, if that's one of
 * its legal destinations, then clears the selection either way.
 * @param {Cell} clicked
 */
function tryMove(clicked) {
  const attempted = legalMovesForSelected.find(m => m.to === clicked);

  if (attempted) {
    applyMoveWithAnimation(attempted);
  }

  clearSelection();
}

/**
 * Applies a move to the game state and kicks off its visual animation.
 * @param {Move} move
 */
function applyMoveWithAnimation(move) {
  const piece = move.from.getPiece();
  const capturedPiece = move.isJump() ? move.captured.getPiece() : null;

  game.applyMove(move);

  if (move.isJump()) {
    recordCapture(piece.colour);
  }

  animation = {
    piece,
    fromX: move.from.x,
    fromY: move.from.y,
    toX: move.to.x,
    toY: move.to.y,
    isJump: move.isJump(),
    capturedX: move.isJump() ? move.captured.x : null,
    capturedY: move.isJump() ? move.captured.y : null,
    capturedPiece,
    startTime: millis(),
    duration: move.isJump() ? 320 : 220,
    continuesChain: game.chainCell !== null,
  };
}

/** Clears the current piece selection and its highlighted legal moves. */
function clearSelection() {
  selectedCell = null;
  legalMovesForSelected = [];
}
