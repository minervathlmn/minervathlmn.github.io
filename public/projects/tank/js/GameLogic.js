/**
 * Owns everything App.java kept as game *state and rules*: players,
 * turn order, wind, level progression, and scoring. Rendering and input
 * handling live in sketch.js instead, the same split checkers uses
 * between GameLogic.js and sketch.js.
 *
 * MULTIPLAYER NOTE: `seed` drives a deterministic RNG (see Rng.js) so
 * every client's "random" wind comes out identical. Without this, each
 * client would roll its own Math.random() and desync on turn 1.
 */
class GameLogic {
  static FPS = 30;
  static INITIAL_PARACHUTES = 1;

  constructor(config, levelLayouts, sprites, seed) {
    this.config = config;
    this.levelLayouts = levelLayouts; // { 'level1.txt': [lines], ... }
    this.sprites = sprites; // shared sprite cache from sketch.js (may still be loading)

    // Falls back to Date.now() only for local/offline hot-seat testing
    // (no server involved). In multiplayer, sketch.js always passes the
    // server-issued seed here.
    this.rng = createRng(seed ?? Date.now());

    this.currentLevel = 1; // 1-indexed, matches App.java
    this.board = new Board();

    this.players = new Map(); // id -> Tank
    this.damagedTanks = new Set();
    this.remainingTanks = []; // ids still alive this level

    this.playerIDs = [];
    this.playerScores = [];
    this.playerParachutes = [];

    this.playerIndex = 0;
    this.currentPlayer = null;
    this.nextPlayer = null;

    this.wind = 0;

    this.backgroundImageName = 'basic.png';
    this.terrainColour = [120, 171, 0];
    this.treeImageName = 'tree1.png';

    this.gameEnded = false;

    this.generateLevel();
  }

  // convenience passthroughs so Tank/Projectile/Explosion can treat
  // `game` uniformly, same as they treated `app` in Java
  get terrainPosition() { return this.board.terrainPosition; }
  get trees() { return this.board.trees; }

  generateLevel() {
    this.players.clear();
    this.damagedTanks.clear();

    const levelConfig = this.config.levels[this.currentLevel - 1];
    const layoutLines = this.levelLayouts[levelConfig.layout] ?? [];

    this.board.loadLayout(layoutLines);

    this.backgroundImageName = levelConfig.background ?? 'basic.png';
    this.treeImageName = levelConfig.trees ?? 'tree1.png';

    const colourParts = (levelConfig['foreground-colour'] ?? '0,0,0').split(',').map(Number);
    this.terrainColour = colourParts.length === 3 ? colourParts : [0, 0, 0];

    // NOTE: tanks are created *before* this.playerIDs/playerScores below
    // are reassigned, so Tank's constructor still sees last level's
    // arrays and can carry scores/parachutes forward - mirrors the same
    // (load-bearing) ordering quirk in App.generateLevel().
    for (const start of this.board.playerStarts) {
      const tank = new Tank(start.id, start.x, start.y, this);

      const playerColourStr = this.config.player_colours?.[start.id] ?? 'random';
      tank.setColour(playerColourStr);

      this.players.set(start.id, tank);
    }

    this.wind = Math.floor(this.rng() * 71) - 35; // -35..35

    // JS Map iterates in insertion order (board-scan order), but Java's
    // HashMap<Character,Tank> happened to iterate single-letter keys
    // alphabetically regardless of scan order - sort here to match, with
    // letters (A-Z) ordered before digits (0-9) rather than default
    // string sort (which would put digits first).
    this.playerIDs = Array.from(this.players.keys()).sort((a, b) => {
      const aIsDigit = a >= '0' && a <= '9';
      const bIsDigit = b >= '0' && b <= '9';
      if (aIsDigit !== bIsDigit) return aIsDigit ? 1 : -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    this.playerScores = new Array(this.playerIDs.length).fill(0);
    this.playerParachutes = new Array(this.playerIDs.length).fill(GameLogic.INITIAL_PARACHUTES);
    this.remainingTanks = [...this.playerIDs];

    this.playerIndex = 0;
    this.playerOrder();
  }

  playerOrder() {
    const { id, index } = findNextAlive(this.playerIDs, this.remainingTanks, this.playerIndex);
    this.currentPlayer = id;
    this.playerIndex = index;
    this.nextPlayer = this.playerIDs[(this.playerIndex + 1) % this.playerIDs.length];

    this.wind += Math.floor(this.rng() * 11) - 5; // -5..5 drift
    this.playerIndex++;
  }

  levelSwitch() {
    this.currentLevel++;
    this.playerIndex = 0;
    this.generateLevel();
  }

  // descending bubble sort of playerIDs/playerScores by score, matching
  // App.getWinner()'s exact algorithm
  getWinner() {
    for (let i = 0; i < this.playerScores.length - 1; i++) {
      for (let j = 0; j < this.playerScores.length - i - 1; j++) {
        if (this.playerScores[j] < this.playerScores[j + 1]) {
          [this.playerScores[j], this.playerScores[j + 1]] = [this.playerScores[j + 1], this.playerScores[j]];
          [this.playerIDs[j], this.playerIDs[j + 1]] = [this.playerIDs[j + 1], this.playerIDs[j]];
        }
      }
    }
  }

  restartGame() {
    this.currentLevel = 1;
    this.gameEnded = false;
    this.generateLevel(); // fresh scores/parachutes fall out of this naturally
  }

  isLevelOver() {
    return this.remainingTanks.length <= 1;
  }

  isGameOver() {
    return this.isLevelOver() && this.currentLevel === this.config.levels.length;
  }
}