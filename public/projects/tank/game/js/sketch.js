/**
 * p5 entry point for the tank game.
 * Server-authoritative: this file no longer runs any game rules at all.
 * It only reads room.state (via TankNetwork.getState()) each frame and draws it,
 * and sends input intent on key press/release. Colyseus schema objects are live/reactive,
 * so reading state.xxx directly in draw() always sees the latest value —
 * no separate change-listener/snapshot needed.
 */

let hud;                // PlayerHUD instance for the local player; created once TankNetwork.ready resolves
let sprites = {};       // filename -> p5.Image | null, populated async by loadSpriteSafe() in setup()
let mySessionId = null; // this client's Colyseus session id, used to pick "my" tank out of state.tanks
let activeShots = [];   // CosmeticProjectile / CosmeticExplosion instances currently animating (see drawShots())
const SPRITE_FILES = [
  'basic.png', 'desert.png', 'forest.png', 'hills.png', 'snow.png',
  'fuel.png', 'parachute.png', 'tree1.png', 'tree2.png', 'wind.png', 'wind-1.png',
];

function preload() {
  // No config.json/level layouts loaded here — terrain, wind, and level
  // theming (background/tree image names, terrain colour) all arrive
  // already-resolved via synced state. Only sprite assets load locally.
}

function setup() {
  noLoop();
  // p5 calls setup() then immediately starts calling draw() every frame, unless halted.
  // noLoop() pauses that loop right away, because draw() reads TankNetwork.getState(),
  // and that state doesn't exist until the network connection finishes. Without this,
  // draw() would run against undefined state for however long the handshake takes.

  const cnv = createCanvas(Board.WIDTH, Board.HEIGHT);
  // Creates the actual <canvas> element p5 draws into, sized from the synced Constants (via Board.WIDTH/HEIGHT)

  cnv.parent('canvas-container');
  // Moves the canvas into a specific div in game/index.html, rather than p5's default of just appending it to <body>.

  cnv.class('game-canvas');
  cnv.elt.style.width = '';
  cnv.elt.style.height = '';
  // See dedicated section below — this undoes inline sizing p5 sets by default.

  frameRate(Constants.FPS);
  // Caps p5's draw() loop to match the server's simulation rate (30),
  // so client-side cosmetic physics (CosmeticProjectile.tick()) ticks
  // at the same rate the server's real Projectile.tick() does — keeps
  // the fake trajectory's shape consistent with the real one.

  noStroke();
  // Default drawing state: shapes drawn with no outline unless a function
  // explicitly calls stroke() first. Just a starting default, not permanent.

  for (const file of SPRITE_FILES) {
    sprites[file] = null;
    loadSpriteSafe(`../assets/${file}`, img => { sprites[file] = img; });
  }
  // Kicks off loading every sprite asynchronously. Each starts as null in
  // the sprites map so any draw() call that runs before an image finishes
  // loading can safely check `if (img)` and fall back to a shape (see
  // drawBackground()/drawTrees() fallback branches) instead of crashing.

  TankNetwork.ready.then(() => {
    mySessionId = TankNetwork.getMySessionId();
    // Now that we're connected, find out which tank in state.tanks is ours.

    const state = TankNetwork.getState();
    const myTank = state.tanks.get(mySessionId);
    hud = new PlayerHUD(16, 16, myTank, sprites);
    // Build the HUD once we actually have a tank to show info for.

    bindNetworkHandlers();
    // Wire up listeners for events during play (shots fired, tanks exploding, restarts) — see next section.

    loop();
    // Now that state exists and everything's wired up, start draw() running every frame.
  });
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

function loadSpriteSafe(path, onDone) {
  loadImage(path, img => onDone(img), () => onDone(null));
}
