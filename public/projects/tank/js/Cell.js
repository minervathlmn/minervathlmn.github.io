/**
 * Port of Tanks/Cell.java. Represents one character of a level's ASCII
 * layout - terrain, tree, empty space, or a player's starting position.
 * Board.js uses this while parsing a layout into the terrain heightmap
 * and the list of tank starting positions.
 */
class Cell {
  static Type = {
    TERRAIN: 'terrain',
    HUMAN_PLAYER: 'human_player',
    TREE: 'tree',
    SPACE: 'empty',
  };

  // char -> Cell.Type, populated as new characters are seen (mirrors the
  // static HashMap<Character, Cell.Type> in the Java version).
  static typeRegister = new Map();

  constructor(c) {
    if (c === 'X') {
      Cell.typeRegister.set(c, Cell.Type.TERRAIN);
    } else if (c === 'T') {
      Cell.typeRegister.set(c, Cell.Type.TREE);
    } else if (c >= 'A' && c <= 'Z') {
      Cell.typeRegister.set(c, Cell.Type.HUMAN_PLAYER);
    } else if (c >= '0' && c <= '9') {
      Cell.typeRegister.set(c, Cell.Type.HUMAN_PLAYER);
    }

    this.id = c;
    this.type = Cell.typeRegister.get(c) ?? Cell.Type.SPACE;
    this.tank = null;
  }

  setHumanPlayer(tank) {
    this.type = Cell.Type.HUMAN_PLAYER;
    this.tank = tank;
  }
}
