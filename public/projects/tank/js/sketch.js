/**
 * p5 entry point for the tank game. Mirrors checkers' sketch.js role:
 * owns the canvas, input handling, and the render loop. All rules/state
 * live in GameLogic - this file only decides how to draw the current
 * state and which GameLogic/Tank method a keypress should trigger.
 */
let game;
let hud;
let configData;
let levelLayouts = {};
let sprites = {}; // filename -> p5.Image | null, filled in asynchronously

const SPRITE_FILES = [
  'basic.png', 'desert.png', 'forest.png', 'hills.png', 'snow.png',
  'fuel.png', 'parachute.png', 'tree1.png', 'tree2.png', 'wind.png', 'wind-1.png',
];
const LEVEL_FILES = ['level1.txt', 'level2.txt', 'level3.txt'];

function preload() {
  configData = loadJSON('../levels/config.json');
  for (const file of LEVEL_FILES) {
    levelLayouts[file] = loadStrings(`../levels/${file}`);
  }
}

function setup() {
  const cnv = createCanvas(Board.WIDTH, Board.HEIGHT);
  cnv.parent('canvas-container');
  frameRate(GameLogic.FPS);
  noStroke();

  // load sprites without blocking the game from starting - draw() falls
  // back to placeholder shapes for any sprite that's still null
  for (const file of SPRITE_FILES) {
    sprites[file] = null;
    loadSpriteSafe(`../assets/${file}`, img => { sprites[file] = img; });
  }

  game = new GameLogic(configData, levelLayouts, sprites);
  hud = new PlayerHUD(16, 16, game.players.get(game.currentPlayer), sprites);
}

function draw() {
  background(255);
  if (!game) return;

  drawBackground();
  drawTerrain();
  drawTrees();
  drawTanks();
  drawHUD();

  if (game.isGameOver()) {
    drawGameEnd();
  }
}

function drawBackground() {
  const img = sprites[game.backgroundImageName];
  if (img) {
    image(img, 0, 0, Board.WIDTH, Board.HEIGHT);
    return;
  }

  const fallback = FALLBACK_BACKGROUND_COLOURS[game.backgroundImageName] ?? FALLBACK_BACKGROUND_COLOURS['basic.png'];
  const c1 = color(fallback[0]);
  const c2 = color(fallback[1]);
  for (let y = 0; y < Board.HEIGHT; y++) {
    stroke(lerpColor(c1, c2, y / Board.HEIGHT));
    line(0, y, Board.WIDTH, y);
  }
  noStroke();
}

function drawTerrain() {
  const [r, g, b] = game.terrainColour;
  stroke(r, g, b);
  for (let x = 0; x < Board.WIDTH; x++) {
    const y = game.terrainPosition[x];
    line(x, y, x, Board.HEIGHT);
  }
  noStroke();
}

function drawTrees() {
  const img = sprites[game.treeImageName];
  for (const x of game.trees) {
    const y = game.terrainPosition[x] - 32;
    if (img) {
      image(img, x - Board.CELLSIZE / 2, y, Board.CELLSIZE, Board.CELLSIZE);
    } else {
      fill(...FALLBACK_TREE_COLOUR);
      triangle(x, y, x - 12, y + 32, x + 12, y + 32);
      noStroke();
    }
  }
}

function drawTanks() {
  for (const id of [...game.remainingTanks]) {
    const tank = game.players.get(id);
    if (!tank) continue;

    if (game.damagedTanks.has(tank)) {
      tank.fall(); // explosion destroyed the ground under it -> falls
    } else {
      tank.updatePosition(game);
    }

    tank.tick(game);
    tank.draw();

    tank.projectile.tick(game, tank);
    tank.projectile.draw();

    tank.projectile.explosion.tick();
    tank.projectile.explosion.draw();
  }
}

function drawHUD() {
  const tank = game.players.get(game.currentPlayer);
  if (!tank) return;

  const turnRowY = 22;
  // wind row sits below the turn label instead of sharing its y - they
  // used to both draw at y=22 and overlap into an unreadable mess
  const windRowY = turnRowY + 32;

  textSize(16);
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  text(`Player ${game.currentPlayer}'s turn`, Board.WIDTH - 30, turnRowY);

  hud.tank = tank; // keep it pointed at whoever's turn it is
  hud.draw();

  /* wind */
  if (game.wind !== 0) {
    const windImg = game.wind < 0 ? sprites['wind-1.png'] : sprites['wind.png'];
    if (windImg) {
      // keeps the same 14px offset above its number that the original had
      image(windImg, Board.WIDTH - 115, windRowY - 14, Board.CELLSIZE * 1.5, Board.CELLSIZE * 1.5);
    }
  }
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  text(Math.round(game.wind), Board.WIDTH - 30, windRowY);
  textAlign(LEFT, TOP);
}

function drawGameEnd() {
  fill(0, 150);
  rect(0, 0, Board.WIDTH, Board.HEIGHT);

  const first = game.players.get(game.playerIDs[0]);
  const second = game.players.get(game.playerIDs[1]);

  textAlign(CENTER, TOP);
  textSize(24);
  if (first && second && first.score > second.score) {
    fill(first.colour[0], first.colour[1], first.colour[2]);
    text(`Player ${game.playerIDs[0]} wins!`, Board.WIDTH / 2, 100);
  } else {
    fill(255);
    text("It's a tie!", Board.WIDTH / 2, 100);
  }

  const { bx, by, bw, bh } = restartButtonBounds();
  const hovered = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;

  stroke(0);
  strokeWeight(2);
  fill(hovered ? 220 : 255);
  rect(bx, by, bw, bh);

  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(15);
  text('Start Over', bx + bw / 2, by + bh / 2);
}

function restartButtonBounds() {
  const bw = 100, bh = 35;
  return { bx: Board.WIDTH / 2 - bw / 2, by: Board.HEIGHT - bh * 3, bw, bh };
}

function mousePressed() {
  if (hud.handleClick(mouseX, mouseY)) return;
  if (!game || !game.isGameOver()) return;

  const { bx, by, bw, bh } = restartButtonBounds();
  if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
    game.restartGame();
  }
}

function keyPressed() {
  if (!game || game.isLevelOver()) return;

  const tank = game.players.get(game.currentPlayer);
  if (!tank || tank.isFalling()) return;

  if (keyCode === UP_ARROW) tank.rotateLeft();
  else if (keyCode === DOWN_ARROW) tank.rotateRight();

  if (keyCode === LEFT_ARROW) tank.moveLeft();
  else if (keyCode === RIGHT_ARROW) tank.moveRight();

  if (key === 'w' || key === 'W') tank.morePower();
  else if (key === 's' || key === 'S') tank.lessPower();

  return false; // stop arrow keys from scrolling the page
}

function keyReleased() {
  if (!game) return;

  if (game.isLevelOver()) {
    if (key === 'r' || key === 'R') game.restartGame();
    return;
  }

  const tank = game.players.get(game.currentPlayer);
  if (!tank || tank.isFalling()) return;

  const movementKeys = [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW];
  if (movementKeys.includes(keyCode) || 'wWsS'.includes(key)) {
    tank.stopAdjustment();
  }

  if (keyCode === 32) { // space: fire and pass turn
    tank.stopAdjustment();
    tank.projectile.setFire(game, tank);
    game.playerOrder();
  }

  // power-ups
  if (key === 'r' || key === 'R') tank.repair();
  if (key === 'f' || key === 'F') tank.addFuel();
  if (key === 'p' || key === 'P') tank.addParachute();
  if (key === 'x' || key === 'X') tank.projectile.xtra(tank);

  return false;
}