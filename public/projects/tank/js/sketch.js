/**
 * p5 entry point for the tank game. Server-authoritative: this file no
 * longer runs any game rules at all — no GameLogic instance, no
 * tank.tick()/rotateLeft() etc. It only reads room.state (via
 * TankNetwork.getState()) each frame and draws it, and sends input
 * intent on key press/release. Colyseus schema objects are live/reactive,
 * so reading state.xxx directly in draw() always sees the latest value —
 * no separate change-listener/snapshot needed.
 */
let hud;
let sprites = {};
let mySessionId = null;
let activeShots = []; // CosmeticProjectile instances currently animating

const FPS = 30; // matches server GameLogic.FPS
const SPRITE_FILES = [
  'basic.png', 'desert.png', 'forest.png', 'hills.png', 'snow.png',
  'fuel.png', 'parachute.png', 'tree1.png', 'tree2.png', 'wind.png', 'wind-1.png',
];

function preload() {
  // No more config.json/level layouts here — terrain, wind, level theming
  // (background/tree image names, terrain colour) all arrive already
  // resolved via synced state. Only sprite assets are still loaded locally.
}

function setup() {
  noLoop(); // draw() stays paused until the network handshake resolves below

  const cnv = createCanvas(Board.WIDTH, Board.HEIGHT);
  cnv.parent('canvas-container');
  cnv.elt.style.width = '';
  cnv.elt.style.height = '';
  frameRate(FPS);
  noStroke();

  for (const file of SPRITE_FILES) {
    sprites[file] = null;
    loadSpriteSafe(`../assets/${file}`, img => { sprites[file] = img; });
  }

  TankNetwork.ready.then(() => {
    mySessionId = TankNetwork.getMySessionId();

    const state = TankNetwork.getState();
    const myTank = state.tanks.get(mySessionId);
    hud = new PlayerHUD(16, 16, myTank, sprites);

    bindNetworkHandlers();
    loop();
  });
}

function bindNetworkHandlers() {
  TankNetwork.onShotFired((payload) => {
    const state = TankNetwork.getState();
    const shooter = state.tanks.get(payload.shooterSessionId);
    const colour = shooter ? [shooter.colourR, shooter.colourG, shooter.colourB] : [0, 0, 0];
    activeShots.push(new CosmeticProjectile(payload, colour));
  });

  TankNetwork.onTankExploded((payload) => {
    activeShots.push(new CosmeticExplosion(payload));
  });

  TankNetwork.onRestart(() => {
    activeShots = []; // clear any stray in-flight shell/explosion visuals
  });
}

function isLevelOver(state) {
  let aliveCount = 0;
  for (const t of state.tanks.values()) if (t.alive) aliveCount++;
  return aliveCount <= 1;
}

function draw() {
  background(255);
  const state = TankNetwork.getState();
  if (!state || !state.started) return;

  drawBackground(state);
  drawTerrain(state);
  drawTrees(state);
  drawTanks(state);
  drawShots(state);
  drawHUD(state);

  if (state.gameEnded) {
    drawGameEnd(state);
  }
}

function drawBackground(state) {
  const img = sprites[state.backgroundImageName];
  if (img) {
    image(img, 0, 0, Board.WIDTH, Board.HEIGHT);
    return;
  }

  const fallback = FALLBACK_BACKGROUND_COLOURS[state.backgroundImageName] ?? FALLBACK_BACKGROUND_COLOURS['basic.png'];
  const c1 = color(fallback[0]);
  const c2 = color(fallback[1]);
  for (let y = 0; y < Board.HEIGHT; y++) {
    stroke(lerpColor(c1, c2, y / Board.HEIGHT));
    line(0, y, Board.WIDTH, y);
  }
  noStroke();
}

function drawTerrain(state) {
  stroke(state.terrainColourR, state.terrainColourG, state.terrainColourB);
  for (let x = 0; x < Board.WIDTH; x++) {
    const y = state.terrainPosition[x];
    line(x, y, x, Board.HEIGHT);
  }
  noStroke();
}

function drawTrees(state) {
  const img = sprites[state.treeImageName];
  for (const x of state.trees) {
    const y = state.terrainPosition[x] - 32;
    if (img) {
      image(img, x - Board.CELLSIZE / 2, y, Board.CELLSIZE, Board.CELLSIZE);
    } else {
      fill(...FALLBACK_TREE_COLOUR);
      triangle(x, y, x - 12, y + 32, x + 12, y + 32);
      noStroke();
    }
  }
}

// Inlines what client Tank.draw()/deployParachute() used to do — the
// server's Tank no longer draws itself (it's a plain simulation object),
// so this reads the synced TankState fields directly.
function drawTankVisual(t) {
  const TURRET_LENGTH = 15;
  const rad = radians(t.turretAngle);
  const turretX = t.x + Math.floor(TURRET_LENGTH * sin(rad));
  const turretY = t.y - 6 - Math.floor(TURRET_LENGTH * cos(rad));

  strokeWeight(5);
  stroke(0);
  line(t.x, t.y - 6, turretX, turretY);

  stroke(t.colourR, t.colourG, t.colourB);
  line(t.x - 4, t.y - 4, t.x + 4, t.y - 4);
  line(t.x - 8, t.y, t.x + 8, t.y);
  noStroke();

  // parachute deploy inferred from synced falling+parachute fields,
  // instead of Tank calling deployParachute() itself during tick()
  if (t.falling && t.parachute > 0) {
    const img = sprites['parachute.png'];
    if (img) {
      image(img, t.x - 32, t.y - 66, Board.CELLSIZE * 2, Board.CELLSIZE * 2);
    } else {
      fill(255);
      triangle(t.x - 20, t.y - 40, t.x + 20, t.y - 40, t.x, t.y - 10);
      noStroke();
    }
  }
}

function drawTanks(state) {
  for (const tankState of state.tanks.values()) {
    if (!tankState.alive) continue;
    drawTankVisual(tankState);
  }
}

function drawShots(state) {
  const dt = deltaTime / 1000;
  activeShots = activeShots.filter(shot => {
    shot.tick(dt, state.terrainPosition, state.wind);
    shot.draw();
    return !shot.done;
  });
}

function drawHUD(state) {
  const turnRowY = 22;
  const windRowY = turnRowY + 32;

  const myTank = state.tanks.get(mySessionId);
  const turnTank = state.tanks.get(state.currentTurnSessionId);

  textSize(16);
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  const turnLabel = TankNetwork.isMyTurn()
    ? 'Your turn'
    : `${turnTank?.colourName || 'Player'}'s turn`;
  text(turnLabel, Board.WIDTH - 30, turnRowY);

  hud.tank = myTank;
  hud.draw();

  if (state.wind !== 0) {
    const windImg = state.wind < 0 ? sprites['wind-1.png'] : sprites['wind.png'];
    if (windImg) {
      image(windImg, Board.WIDTH - 115, windRowY - 14, Board.CELLSIZE * 1.5, Board.CELLSIZE * 1.5);
    }
  }
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  text(Math.round(state.wind), Board.WIDTH - 30, windRowY);
  textAlign(LEFT, TOP);
}

function drawGameEnd(state) {
  fill(0, 150);
  rect(0, 0, Board.WIDTH, Board.HEIGHT);

  const tanks = [...state.tanks.values()].sort((a, b) => b.score - a.score);
  const first = tanks[0];
  const second = tanks[1];

  textAlign(CENTER, TOP);
  textSize(24);
  if (first && second && first.score > second.score) {
    fill(first.colourR, first.colourG, first.colourB);
    text(`${first.nickname || `Player ${first.letter}`} wins!`, Board.WIDTH / 2, 100);
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

  const state = TankNetwork.getState();
  if (!state || !state.gameEnded) return;

  const { bx, by, bw, bh } = restartButtonBounds();
  if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
    TankNetwork.sendRestart();
  }
}

function keyPressed() {
  const state = TankNetwork.getState();
  if (!state || isLevelOver(state) || !TankNetwork.isMyTurn()) return;

  const myTank = state.tanks.get(mySessionId);
  if (!myTank || myTank.falling) return;

  if (keyCode === UP_ARROW) TankNetwork.sendAction("rotateLeft");
  else if (keyCode === DOWN_ARROW) TankNetwork.sendAction("rotateRight");

  if (keyCode === LEFT_ARROW) TankNetwork.sendAction("moveLeft");
  else if (keyCode === RIGHT_ARROW) TankNetwork.sendAction("moveRight");

  if (key === 'w' || key === 'W') TankNetwork.sendAction("morePower");
  else if (key === 's' || key === 'S') TankNetwork.sendAction("lessPower");

  return false;
}

function keyReleased() {
  const state = TankNetwork.getState();
  if (!state) return;

  if (isLevelOver(state)) {
    if (key === 'r' || key === 'R') TankNetwork.sendRestart();
    return;
  }

  if (!TankNetwork.isMyTurn()) return;

  const myTank = state.tanks.get(mySessionId);
  if (!myTank || myTank.falling) return;

  const movementKeys = [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW];
  if (movementKeys.includes(keyCode) || 'wWsS'.includes(key)) {
    TankNetwork.sendAction("stopAdjustment");
  }

  if (keyCode === 32) { // space: fire and pass turn
    TankNetwork.sendAction("fire");
  }

  if (key === 'r' || key === 'R') TankNetwork.sendAction("repair");
  if (key === 'f' || key === 'F') TankNetwork.sendAction("addFuel");
  if (key === 'p' || key === 'P') TankNetwork.sendAction("addParachute");
  if (key === 'x' || key === 'X') TankNetwork.sendAction("xtra");

  return false;
}
