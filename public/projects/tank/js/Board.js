/**
 * Owns the terrain heightmap and level-layout parsing. Ported from the
 * board-building parts of Tanks/App.java (generateLevel + smoothing) -
 * everything that isn't turn order, players, or scoring lives here.
 */
class Board {
  static CELLSIZE = 32;
  static WIDTH = 864;
  static HEIGHT = 640;
  static GRID_WIDTH = Math.floor(Board.WIDTH / Board.CELLSIZE) + 1; // 28
  static GRID_HEIGHT = 20;

  constructor() {
    this.cells = [];
    // one height value per pixel column; sized to GRID_WIDTH * CELLSIZE
    // so the smoothing pass never reads out of bounds at the right edge
    this.terrainPosition = new Array(Board.WIDTH + Board.CELLSIZE).fill(Board.HEIGHT);
    this.trees = []; // pixel x-positions
    this.playerStarts = []; // [{ id, x, y }]
  }

  /**
   * Parses raw ASCII layout lines into a padded grid, builds the initial
   * terrain heightmap from 'X' columns, smooths it twice, then collects
   * tree and player-start positions. Mirrors App.generateLevel() exactly,
   * including its in-place (cascading) smoothing pass.
   */
  loadLayout(rawLines) {
    const lines = (rawLines ?? []).map(l => l.replace(/\r$/, ''));

    const padded = lines.map(line =>
      line.length < Board.GRID_WIDTH ? line + ' '.repeat(Board.GRID_WIDTH - line.length) : line
    );
    while (padded.length < Board.GRID_HEIGHT) {
      padded.push(' '.repeat(Board.GRID_WIDTH));
    }

    this.cells = [];
    this.terrainPosition = new Array(Board.WIDTH + Board.CELLSIZE).fill(Board.HEIGHT);

    for (let row = 0; row < Board.GRID_HEIGHT; row++) {
      const cellRow = [];
      const line = padded[row] ?? '';

      for (let col = 0; col < Board.GRID_WIDTH; col++) {
        const c = line[col] ?? ' ';
        const cell = new Cell(c);
        cellRow.push(cell);

        if (cell.type === Cell.Type.TERRAIN) {
          for (let j = 0; j < Board.CELLSIZE; j++) {
            const px = col * Board.CELLSIZE + j;
            if (px < this.terrainPosition.length) {
              this.terrainPosition[px] = row * Board.CELLSIZE;
            }
          }
        }
      }
      this.cells.push(cellRow);
    }

    // terrain smoothing (2x), matching App.generateLevel()
    this.smoothing();
    this.smoothing();

    this.trees = [];
    this.playerStarts = [];

    for (let row = 0; row < this.cells.length; row++) {
      for (let col = 0; col < this.cells[row].length; col++) {
        const cell = this.cells[row][col];

        if (cell.type === Cell.Type.TREE) {
          this.trees.push(col * Board.CELLSIZE);
        } else if (cell.type === Cell.Type.HUMAN_PLAYER) {
          const x = col * Board.CELLSIZE;
          const y = this.terrainPosition[x];
          this.playerStarts.push({ id: cell.id, x, y });
        }
      }
    }
  }

  /**
   * Box-blurs terrainPosition in place. Note this intentionally mutates
   * the array as it goes (not off a copy) - later columns in the same
   * pass read already-smoothed values from earlier columns, exactly like
   * App.smoothing(). That cascading effect is part of the original
   * terrain's character, so it's preserved here rather than "fixed".
   */
  smoothing() {
    for (let x = 0; x < this.terrainPosition.length - Board.CELLSIZE; x++) {
      let sum = 0;
      for (let c = 0; c < Board.CELLSIZE; c++) {
        sum += this.terrainPosition[x + c];
      }
      this.terrainPosition[x] = Math.floor(sum / Board.CELLSIZE);
    }
  }
}