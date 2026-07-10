/**
 * A tiny, self-contained scripted animation for the Rules modal, showing
 * a plain move, a mandatory capture, and a king promotion in one loop.
 *
 * This is intentionally NOT the real Game engine - it's a hand-choreographed
 * sequence on a small 4x4 grid, built from the same Cell/Piece/Move classes
 * so pieces render identically to the real board, but nothing here is
 * validated against actual checkers rules (there's no need to be; every
 * step is scripted to already be legal).
 *
 * Runs as its own p5 instance (instance mode) so it can coexist with the
 * main board's sketch.js, which owns the single global-mode p5 instance.
 *
 * The instance is created once, eagerly, as soon as this script runs -
 * NOT lazily on first click. sketch.js's global-mode draw loop is already
 * running continuously in the background from page load onward, and
 * constructing a second p5 instance while that loop is live/mid-frame is
 * what caused the first-open-only rendering glitch. Creating this
 * instance up front, before either loop has really gotten going, avoids
 * that race. It's immediately noLoop()'d in setup() so it doesn't
 * actually draw anything until the demo view is opened.
 */
const DEMO_GRID_SIZE = 4;
const DEMO_CELLSIZE = 64;
// const DEMO_PAUSE_BETWEEN_SCENES = 900;  // pause after a piece finishes sliding/jumping

const PRE_MOVE_DELAY = 500;       // pause before a scene's first move, so the "before" position is readable
const PAUSE_BETWEEN_SCENES = 1500; // pause after a scene's last move, before the next scene starts
const PAUSE_BEFORE_LOOP = 2000;    // pause after the final scene's last move, before looping back to scene 0

// Each scene sets up a fresh mini-board, shows its label, then plays
// through `steps` in order (currently one step each, but the structure
// supports more if a scene ever needs to choreograph multiple moves).
// // Each scene sets up a fresh mini-board, then plays one scripted step.
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

let demoP5Instance = null;

/** Creates the demo's p5 instance immediately (see header comment for why
 * this happens eagerly rather than on first click). Runs once the DOM is
 * ready, since the canvas needs #demo-canvas-container to exist. */
function createDemoInstance() {
  demoP5Instance = new p5(demoReplaySketch, document.getElementById('demo-canvas-container'));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', createDemoInstance);
} else {
  createDemoInstance();
}

/** Called every time the demo view is opened. Resets the script back to
 * scene 0 (rather than resuming wherever it happened to be) so it always
 * plays the same clean loop from the top, and restarts the draw loop. */
function ensureDemoReplayStarted() {
  if (!demoP5Instance) {
    // Extremely unlikely fallback in case this is somehow called before
    // DOMContentLoaded has fired.
    createDemoInstance();
  }
  demoP5Instance.resetToStart();
  demoP5Instance.loop();
}

function pauseDemoReplay() {
  if (demoP5Instance) demoP5Instance.noLoop();
}

function demoReplaySketch(p) {
//   const PRE_MOVE_DELAY = 500; // pause before the step starts, so the "before" position is readable

  let grid;
  let sceneIndex = 0;
  let animation = null; // mirrors sketch.js's animation shape, p-prefixed

  // Exposed so ensureDemoReplayStarted() can jump back to scene 0 every
  // time the demo view is opened, instead of resuming mid-loop from
  // wherever it happened to be paused.
  p.resetToStart = () => startScene(0);

  // Single source of truth for what the demo is currently doing, so
  // scene transitions can never fire more than once per scene. Replaces
  // the previous setTimeout-based approach, which raced against this
  // same check running every frame in p.draw().
  let phase = 'pre-move'; // 'pre-move' | 'animating' | 'post-move'
  let phaseReadyAt = 0;

  p.setup = () => {
    const size = DEMO_GRID_SIZE * DEMO_CELLSIZE;
    p.createCanvas(size, size);
    startScene(0);
    // Sit idle until the demo view is actually opened - see the header
    // comment for why this instance exists from page load onward but
    // shouldn't be drawing yet.
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

  function startScene(index) {
    sceneIndex = index;
    const scene = DEMO_SCRIPT[sceneIndex];

    const label = document.getElementById('demo-scene-label');
    if (label) label.textContent = scene.label;

    // A fresh grid of empty cells - the previous scene's pieces are
    // discarded here, not carried over or reset in place.
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

  function playStep(step) {
    const fromCell = grid[step.from.y][step.from.x];
    const toCell = grid[step.to.y][step.to.x];
    const piece = fromCell.getPiece();
    const isJump = !!step.captured;
    const capturedCell = isJump ? grid[step.captured.y][step.captured.x] : null;
    const capturedPiece = isJump ? capturedCell.getPiece() : null;

    // Apply the logical move immediately (mirrors Board.movePiece); the
    // animation object below is purely the visual interpolation on top.
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

  function drawPiece(cell) {
    const piece = cell.getPiece();
    if (piece === null) return;
    if (animation && cell.x === animation.toX && cell.y === animation.toY) return;

    const cx = cell.x * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
    const cy = cell.y * DEMO_CELLSIZE + DEMO_CELLSIZE / 2;
    drawPieceAt(cx, cy, piece);
  }

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
      cy -= Math.sin(t * Math.PI) * DEMO_CELLSIZE * 0.6;
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

      const scene = DEMO_SCRIPT[sceneIndex];
      const isLastScene = sceneIndex === DEMO_SCRIPT.length - 1;

      let pause;
      if (isLastScene) {
        pause = PAUSE_BEFORE_LOOP;
      } else {
        pause = PAUSE_BETWEEN_SCENES;
      }

      phaseReadyAt = p.millis() + pause;
    }
  }
}