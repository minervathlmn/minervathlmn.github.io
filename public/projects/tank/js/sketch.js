/**
 * p5 entry point for the tank game. Owns the canvas and render loop.
 * All rules/state live in GameLogic. Input is now network-gated: only
 * the active player's key presses do anything, and even then they only
 * SEND a message — the actual Tank mutation happens uniformly for every
 * client inside bindNetworkHandlers(), once the server relays it back.
 * This keeps all four screens running identical code on identical input.
 */
let game;
let hud;
let configData;
let levelLayouts = {};
let sprites = {};
let myLetter = null; // this client's tank id ('A'/'B'/'C'/'D'), fixed for the whole game

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
  noLoop(); // draw() stays paused until the network handshake resolves below

  const cnv = createCanvas(Board.WIDTH, Board.HEIGHT);
  cnv.parent('canvas-container');
  frameRate(GameLogic.FPS);
  noStroke();

  for (const file of SPRITE_FILES) {
    sprites[file] = null;
    loadSpriteSafe(`../assets/${file}`, img => { sprites[file] = img; });
  }

  TankNetwork.ready.then(() => {
    game = new GameLogic(configData, levelLayouts, sprites, TankNetwork.getSeed());

    const myIndex = TankNetwork.getMyLetterIndex();
    myLetter = game.playerIDs[myIndex] ?? game.playerIDs[0];

    hud = new PlayerHUD(16, 16, game.players.get(myLetter), sprites);

    bindNetworkHandlers();
    loop();
  });
}

// Applies input relayed from the server to whichever tank currently
// holds the turn. Runs identically on every client, including the one
// that originally sent the action.
function bindNetworkHandlers() {
  TankNetwork.onAction((type) => {
    const tank = game.players.get(game.currentPlayer);
    if (!tank) return;

    switch (type) {
      case "rotateLeft": tank.rotateLeft(); break;
      case "rotateRight": tank.rotateRight(); break;
      case "moveLeft": tank.moveLeft(); break;
      case "moveRight": tank.moveRight(); break;
      case "morePower": tank.morePower(); break;
      case "lessPower": tank.lessPower(); break;
      case "stopAdjustment": tank.stopAdjustment(); break;
      case "repair": tank.repair(); break;
      case "addFuel": tank.addFuel(); break;
      case "addParachute": tank.addParachute(); break;
      case "xtra": tank.projectile.xtra(tank); break;
      case "fire":
        tank.stopAdjustment();
        tank.projectile.setFire(game, tank);
        game.playerOrder();
        break;
    }
  });

  TankNetwork.onRestart(() => {
    game.restartGame();
  });
}

// Read-only preview of what GameLogic.playerOrder() would resolve
// `currentPlayer` to next, WITHOUT mutating game state. Used so the
// firing client can tell the server who's up next (skipping anyone
// eliminated) without every client double-running the turn-advance math.
function peekNextPlayer(game) {
  let idx = game.playerIndex;
  let guard = 0;
  while (guard++ < 1000) {
    const candidate = game.playerIDs[idx % game.playerIDs.length];
    if (game.remainingTanks.includes(candidate)) return candidate;
    idx++;
  }
  return game.currentPlayer;
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
  const dt = deltaTime / 1000; // seconds since last frame (p5 global, real wall-clock)

  for (const id of [...game.remainingTanks]) {
    const tank = game.players.get(id);
    if (!tank) continue;

    if (game.damagedTanks.has(tank)) {
      tank.fall();
    } else {
      tank.updatePosition(game);
    }

    tank.tick(game, dt);
    tank.draw();

    tank.projectile.tick(game, tank);
    tank.projectile.draw();

    tank.projectile.explosion.tick();
    tank.projectile.explosion.draw();
  }
}

// function drawTanks() {
//   for (const id of [...game.remainingTanks]) {
//     const tank = game.players.get(id);
//     if (!tank) continue;

//     if (game.damagedTanks.has(tank)) {
//       tank.fall();
//     } else {
//       tank.updatePosition(game);
//     }

//     tank.tick(game);
//     tank.draw();

//     tank.projectile.tick(game, tank);
//     tank.projectile.draw();

//     tank.projectile.explosion.tick();
//     tank.projectile.explosion.draw();
//   }
// }

function drawHUD() {
  const turnRowY = 22;
  const windRowY = turnRowY + 32;

  textSize(16);
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  const turnLabel = TankNetwork.isMyTurn()
    ? `Your turn (Player ${game.currentPlayer})`
    : `Player ${game.currentPlayer}'s turn`;
  text(turnLabel, Board.WIDTH - 30, turnRowY);

  // Always show MY tank's panel, tinted with my colour — not whoever's
  // turn it currently is.
  hud.tank = game.players.get(myLetter);
  hud.draw();

  if (game.wind !== 0) {
    const windImg = game.wind < 0 ? sprites['wind-1.png'] : sprites['wind.png'];
    if (windImg) {
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
    TankNetwork.sendRestart();
  }
}

function keyPressed() {
  if (!game || game.isLevelOver() || !TankNetwork.isMyTurn()) return;

  const tank = game.players.get(game.currentPlayer);
  if (!tank || tank.isFalling()) return;

  if (keyCode === UP_ARROW) TankNetwork.sendAction("rotateLeft");
  else if (keyCode === DOWN_ARROW) TankNetwork.sendAction("rotateRight");

  if (keyCode === LEFT_ARROW) TankNetwork.sendAction("moveLeft");
  else if (keyCode === RIGHT_ARROW) TankNetwork.sendAction("moveRight");

  if (key === 'w' || key === 'W') TankNetwork.sendAction("morePower");
  else if (key === 's' || key === 'S') TankNetwork.sendAction("lessPower");

  return false;
}

function keyReleased() {
  if (!game) return;

  if (game.isLevelOver()) {
    if (key === 'r' || key === 'R') TankNetwork.sendRestart();
    return;
  }

  if (!TankNetwork.isMyTurn()) return;

  const tank = game.players.get(game.currentPlayer);
  if (!tank || tank.isFalling()) return;

  const movementKeys = [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW];
  if (movementKeys.includes(keyCode) || 'wWsS'.includes(key)) {
    TankNetwork.sendAction("stopAdjustment");
  }

  if (keyCode === 32) { // space: fire and pass turn
    const nextLetter = peekNextPlayer(game);
    TankNetwork.sendAction("fire", { nextLetter });
  }

  if (key === 'r' || key === 'R') TankNetwork.sendAction("repair");
  if (key === 'f' || key === 'F') TankNetwork.sendAction("addFuel");
  if (key === 'p' || key === 'P') TankNetwork.sendAction("addParachute");
  if (key === 'x' || key === 'X') TankNetwork.sendAction("xtra");

  return false;
}