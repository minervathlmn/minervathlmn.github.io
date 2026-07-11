// checkers/js/DemoReplay.js

/**
 * Self-contained p5 instance-mode sketch that plays a short looping
 * animation demonstrating a plain move, a mandatory jump, and a king
 * promotion. Runs inside the "Rules" modal as a "watch a demo" tab.
 */

// ==== Config ====

const DEMO_GRID_SIZE = 4;
const DEMO_CELLSIZE = 64;

const PRE_MOVE_DELAY = 500;        // pause before a scene's move starts
const PAUSE_BETWEEN_SCENES = 1500; // pause after a move, before the next scene
const PAUSE_BEFORE_LOOP = 2000;    // pause after the final scene, before looping

// ==== Demo Script Data ====

/**
 * Ordered list of scenes to play. Each scene sets up a small board,
 * then performs a single step (move or jump, optionally promoting).
 */
const DEMO_SCRIPT = [
  {
    label: 'Plain move',
    setup: [{ x: 2, y: 3, colour: 'dark' }],
    step: { from: { x: 2, y: 3 }, to: { x: 1, y: 2 } },
  },
  {
    label: 'Mandatory capture (jump)',
    setup: [
      { x: 0, y: 3, colour: 'dark' },
      { x: 1, y: 2, colour: 'light' },
    ],
    step: { from: { x: 0, y: 3 }, to: { x: 2, y: 1 }, captured: { x: 1, y: 2 } },
  },
  {
    label: 'King promotion',
    setup: [{ x: 1, y: 2, colour: 'light' }],
    step: { from: { x: 1, y: 2 }, to: { x: 2, y: 3 }, promote: true },
  },
];

// ==== Instance Lifecycle ====

let demoP5Instance = null;

/** Creates the p5 instance for the demo canvas, mounted into its container div. */
function createDemoInstance() {
  demoP5Instance = new p5(demoReplaySketch, document.getElementById('demo-canvas-container'));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', createDemoInstance);
} else {
  createDemoInstance();
}

/** Restarts the demo from scene 0 and resumes its draw loop. Called when the demo tab opens. */
function ensureDemoReplayStarted() {
  if (!demoP5Instance) {
    createDemoInstance();
  }
  demoP5Instance.resetToStart();
  demoP5Instance.loop();
}

/** Stops the demo's draw loop. Called when the demo tab is hidden/closed. */
function pauseDemoReplay() {
  if (demoP5Instance) demoP5Instance.noLoop();
}

// ==== Sketch Definition ====

function demoReplaySketch(p) {

  let grid;
  let sceneIndex = 0;
  let animation = null;

  // Simple phase machine per scene: 'pre-move' -> 'animating' -> 'post-move' -> next scene
  let phase = 'pre-move';
  let phaseReadyAt = 0;

  p.resetToStart = () => startScene(0);

  // ---- p5 Lifecycle ----

  p.setup = () => {
    const size = DEMO_GRID_SIZE * DEMO_CELLSIZE;
    p.createCanvas(size, size);
    startScene(0);
    p.noLoop();
  };

  p.draw = () => {
    p.background(255);
    drawGrid();
    drawAnimatedPiece();

    if (phase === 'pre-move' && p.millis() >= phaseReadyAt) {
      playStep(DEMO_SCRIPT[sceneIndex].step);
    } else if (phase === 'post-move' && p.millis() >= phaseReadyAt) {
      startScene((sceneIndex + 1) % DEMO_SCRIPT.length);
    }
  };

  // ---- Scene Management ----

  /**
   * Builds the mini board for a scene and schedules its move to begin
   * after PRE_MOVE_DELAY.
   * @param {number} index - Index into DEMO_SCRIPT.
   */
  function startScene(index) {
    sceneIndex = index;
    const scene = DEMO_SCRIPT[sceneIndex];

    const label = document.getElementById('demo-scene-label');
    if (label) label.textContent = scene.label;

    grid = [];
    for (let y = 0; y < DEMO_GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < DEMO_GRID_SIZE; x++) row.push(new Cell(x, y));
      grid.push(row);
    }

    for (const piece of scene.setup) {
      grid[piece.y][piece.x].setPiece(new Piece(piece.colour));
    }

    animation = null;
    phase = 'pre-move';
    phaseReadyAt = p.millis() + PRE_MOVE_DELAY;
  }

  /**
   * Executes a scene's scripted step immediately on the grid data (no
   * legality checking - this is a scripted demo, not live gameplay),
   * then kicks off the animation for it.
   * @param {object} step - A step entry from DEMO_SCRIPT.
   */
  function playStep(step) {
    const fromCell = grid[step.from.y][step.from.x];
    const toCell = grid[step.to.y][step.to.x];
    const piece = fromCell.getPiece();
    const isJump = !!step.captured;
    const capturedCell = isJump ? grid[step.captured.y][step.captured.x] : null;
    const capturedPiece = isJump ? capturedCell.getPiece() : null;

    toCell.setPiece(piece);
    fromCell.setPiece(null);
    if (isJump) capturedCell.setPiece(null);
    if (step.promote) piece.isKing = true;

    animation = {
      piece,
      fromX: step.from.x,
      fromY: step.from.y,
      toX: step.to.x,
      toY: step.to.y,
      isJump,
      capturedX: isJump ? step.captured.x : null,
      capturedY: isJump ? step.captured.y : null,
      capturedPiece,
      startTime: p.millis(),
      duration: isJump ? 320 : 220,
    };

    phase = 'animating';
  }

  // ---- Drawing ----

  /** Draws the checkerboard squares and all non-animating pieces. */
  function drawGrid() {
    for (let y = 0; y < DEMO_GRID_SIZE; y++) {
      for (let x = 0; x < DEMO_GRID_SIZE; x++) {
        const cell = grid[y][x];
        p.noStroke();
        p.fill(...hexToRgb((x + y) % 2 === 1 ? ACTIVE_THEME.darkCell : ACTIVE_THEME.lightCell));
        p.rect(x * DEMO_CELLSIZE, y * DEMO_CELLSIZE, DEMO_CELLSIZE, DEMO_CELLSIZE);
        drawPiece(cell);
      }
    }
  }

  /**
   * Draws the piece on a cell, unless it's currently mid-animation
   * (that piece is drawn separately by drawAnimatedPiece so it can
   * move smoothly between cells).
   * @param {Cell} cell
   */
  function drawPiece(cell) {
    const piece = cell.getPiece();
    if (piece === null) return;
    if (animation && cell.x === animation.toX && cell.y === animation.toY) return;

    const cx = cell.x * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
    const cy = cell.y * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
    drawPieceAt(cx, cy, piece);
  }

  /**
   * Draws a single piece disc at exact pixel coordinates.
   * @param {number} cx
   * @param {number} cy
   * @param {Piece} piece
   * @param {number} alpha - Opacity 0-255, used to fade out captured pieces.
   */
  function drawPieceAt(cx, cy, piece, alpha = 255) {
    const fillHex = piece.colour === 'light' ? ACTIVE_THEME.pieceLight : ACTIVE_THEME.pieceDark;
    const shadeHex = piece.colour === 'light' ? ACTIVE_THEME.pieceLightShadow : ACTIVE_THEME.pieceDarkShadow;

    p.strokeWeight(5);
    p.fill(...hexToRgb(fillHex), alpha);
    p.stroke(...hexToRgb(shadeHex), alpha);
    p.ellipse(cx, cy, DEMO_CELLSIZE * 0.8, DEMO_CELLSIZE * 0.8);

    if (piece.isKing) {
      p.ellipse(cx, cy, DEMO_CELLSIZE * 0.4, DEMO_CELLSIZE * 0.4);
    }

    p.noStroke();
  }

  // ---- Animation ----

  /**
   * Interpolates the moving piece's position along its path, arcing it
   * upward for jumps, and fades out any captured piece. Advances the
   * scene's phase once the animation completes.
   */
  function drawAnimatedPiece() {
    if (!animation) return;

    const elapsed = p.millis() - animation.startTime;
    const t = p.constrain(elapsed / animation.duration, 0, 1);
    const eased = easeInOutQuad(t);

    const px = p.lerp(animation.fromX, animation.toX, eased);
    const py = p.lerp(animation.fromY, animation.toY, eased);

    let cx = px * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
    let cy = py * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;

    if (animation.isJump) {
      cy -= Math.sin(t * Math.PI) * DEMO_CELLSIZE * 0.6; // arc upward mid-jump
    }

    drawPieceAt(cx, cy, animation.piece);

    if (animation.isJump && animation.capturedPiece) {
      const alpha = 255 * (1 - eased);
      const ccx = animation.capturedX * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
      const ccy = animation.capturedY * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
      drawPieceAt(ccx, ccy, animation.capturedPiece, alpha);
    }

    if (t >= 1) {
      animation = null;
      phase = 'post-move';

      const isLastScene = sceneIndex === DEMO_SCRIPT.length - 1;
      const pause = isLastScene ? PAUSE_BEFORE_LOOP : PAUSE_BETWEEN_SCENES;

      phaseReadyAt = p.millis() + pause;
    }
  }
}
