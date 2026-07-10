/**
 * The p5 entry point. Owns nothing about game rules - only the canvas,
 * the renderer, and which cell is currently selected (a UI concern, not
 * a rules concern). Every actual decision ("is this move legal", "whose
 * turn is it") is delegated to Game.
 */
const BASE_CELLSIZE = 77; // desktop/default cell size, used as an upper cap
let CELLSIZE = BASE_CELLSIZE;
const CHAIN_PAUSE_MS = 150; // brief pause before an auto-continued jump

let game;
let p5Ready = false; // NEW

// UI-only selection state - lives here, not in Game, since Game
// shouldn't need to know or care what a human currently has clicked.
let selectedCell = null;
let legalMovesForSelected = [];

// UI-only animation state for the piece currently sliding/jumping between
// cells. Game/Board have already applied the move by the time this exists -
// it's purely a visual interpolation layered on top of the real state.
let animation = null;

// A forced single-option chain jump waiting out its pause before
// auto-playing. { move, readyAt }
let pendingAutoMove = null;

/**
 * Decides how big the board should be.
 * - Narrow/portrait screens (width <= height, e.g. phones/tablets in
 *   portrait): 90% of whichever of width/height is smaller, so the board
 *   always fits on screen with a little breathing room.
 * - Wide/landscape screens: fit within whatever space #canvas-container
 *   actually has available (it already accounts for the sidebar), capped
 *   at the original desktop size so it never grows huge on big monitors.
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

function setup() {
  game = new Game();

  const size = computeBoardSize();
  CELLSIZE = size / Board.BOARD_WIDTH;
  const cnv = createCanvas(size, size);
  cnv.parent('canvas-container');
  noStroke();

  p5Ready = true;      // NEW
  tryStartGame();       // NEW
}

/** p5 special function - called automatically whenever the browser
 * window resizes. Recomputes the board size/CELLSIZE and resizes the
 * canvas to match; draw() keeps looping so the board redraws at the
 * new scale on the very next frame. */
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

function drawBoard() {
  const board = game.board;
  // In 1P, hints are a player aid - never show them while it's the bot's
  // turn to move (the player is always 'dark', see maybeTriggerBotMove).
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

function drawPiece(cell) {
  const piece = cell.getPiece();
  if (piece === null) return;

  // The piece currently animating into this cell is drawn separately by
  // drawAnimatedPiece(), mid-flight - skip it here so it doesn't also
  // appear "already arrived" underneath the animation.
  if (animation && cell.x === animation.toX && cell.y === animation.toY) return;

  const centerX = cell.x * CELLSIZE + CELLSIZE / 2;
  const centerY = cell.y * CELLSIZE + CELLSIZE / 2;

  drawPieceAt(centerX, centerY, piece);
}

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

/** Draws the piece currently mid-move: a straight slide for a plain step,
 * or a slide with an upward arc for a jump, plus the captured piece
 * fading out at its cell for the duration of the jump. */
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
    // Arc upward and back down over the course of the jump.
    centerY -= Math.sin(t * Math.PI) * CELLSIZE * 0.6;
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
 * Called once a move's slide/jump animation finishes. If that move left
 * the game mid multi-jump-chain, decides what happens next:
 *  - exactly one forced continuation -> auto-play it after a brief pause
 *  - more than one option -> auto-select the chained piece so the player
 *    only has to click a destination, not re-click the piece
 * Otherwise (chain over, or it was never a chain), hands off to the bot
 * hook in case it's now the bot's turn.
 */
function onAnimationComplete(finished) {
  if (!finished.continuesChain) {
    incrementMoveCount(finished.piece.colour);
    updateTurnIndicator();
    checkForGameOverScore();
    maybeTriggerBotMove();
    return;
  }

  // The chain-continuing piece belongs to the bot - let it pick the next
  // jump itself rather than falling into the human click-to-continue path
  // below, which would otherwise sit there forever waiting for a click
  // nobody is going to make.
  if (selectedMode === '1p' && game.currentPlayer === 'light') {
    setTimeout(() => playBotMove(new Bot(selectedDifficulty)), CHAIN_PAUSE_MS);
    return;
  }

  const chainMoves = game.getLegalMoves(); // already filtered to game.chainCell's jumps

  if (chainMoves.length === 1) {
    pendingAutoMove = { move: chainMoves[0], readyAt: millis() + CHAIN_PAUSE_MS };
  } else if (chainMoves.length > 1) {
    selectedCell = game.chainCell;
    legalMovesForSelected = chainMoves;
  }
}

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

  updateRestartButtonLabel(); // NEW

  fill(0, 180);
  rect(0, 0, width, height);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(32);
  text(label, width / 2, height / 2);
}

function updateRestartButtonLabel() {
  const restartBtn = document.getElementById('restart-btn');
  restartBtn.textContent = game.isGameOver() ? 'Play Again' : 'Start Over';
}

function mousePressed() {
  if (isSettingsModalOpen()) return; // paused - don't let clicks reach the board
  if (!game.gameStarted || game.isGameOver()) return;
  if (animation || pendingAutoMove) return; // ignore clicks mid-move
  if (selectedMode === '1p' && game.currentPlayer !== 'dark') return; // it's the bot's turn
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
 * First click: select a cell only if it holds a piece belonging to
 * whoever's turn it currently is, and remember that piece's legal moves.
 */
function trySelect(clicked) {
  const piece = clicked.getPiece();
  if (piece === null || piece.colour !== game.currentPlayer) return;

  selectedCell = clicked;
  legalMovesForSelected = game.getLegalMoves().filter(m => m.from === selectedCell);
}

/**
 * Second click: attempt to move the selected piece to the clicked cell.
 * Clears selection afterward whether the move succeeded or not - if this
 * was a multi-jump chain with exactly one forced continuation, it'll
 * auto-play from onAnimationComplete(); if there's a genuine branch, the
 * chained piece gets auto-selected there so the player only needs to
 * click a destination next.
 */
function tryMove(clicked) {
  const attempted = legalMovesForSelected.find(m => m.to === clicked);

  if (attempted) {
    applyMoveWithAnimation(attempted);
  }

  clearSelection();
}

/**
 * Applies a move to Game and kicks off its slide/jump animation. Grabs
 * the piece (and, for a jump, the captured piece) before applying the
 * move, since Board.movePiece clears those cells immediately - the
 * references are needed afterward purely to animate the transition.
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

function clearSelection() {
  selectedCell = null;
  legalMovesForSelected = [];
}
