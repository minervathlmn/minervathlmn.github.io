/**
 * Board/piece colour palette. Only the "accented" theme is implemented,
 * matching the portfolio's beige/maroon/green design system. A "normal"
 * theme (black/white board, blue/red pieces) is a planned follow-up -
 * add it here as THEMES.normal and switch ACTIVE_THEME to wire up a
 * toggle later.
 */
const THEMES = {
  accented: {
    darkCell: '#a97c62',
    lightCell: '#ecdfc8',
    pieceLight: '#f4efe1',
    pieceLightShadow: '#ecdfc8',
    pieceLightName: 'Beige',
    pieceDark: '#5c2b2b',
    pieceDarkShadow: '#3d1c1c',
    pieceDarkName: 'Maroon',
    movable: '#8a9a5b',   // green - has a legal move
    selected: '#e3b23c',   // yellow - currently selected piece
    destination: '#b087a0', // purple - available destination
    forceJump: '#c1440e',  // orange - mandatory capture destination
  },
  pastel: {
    darkCell: '#b58863',
    lightCell: '#f0d9b5',
    pieceLight: '#ffffff',
    pieceLightShadow: '#c9c9c9',
    pieceLightName: 'White',
    pieceDark: '#4d4d4d',
    pieceDarkShadow: '#1a1a1a',
    pieceDarkName: 'Black',
    movable: '#a3c98d',   // green - has a legal move
    selected: '#f0e6a3',   // yellow - currently selected piece
    destination: '#d2beeb', // purple - available destination
    forceJump: '#e8a3a3',  // orange - mandatory capture destination
  },
  contrast: {
    darkCell: '#000000',
    lightCell: '#ffffff',
    pieceLight: '#3aa8d8',
    pieceLightShadow: '#2b86ac',
    pieceLightName: 'Blue',
    pieceDark: '#f83157',
    pieceDarkShadow: '#c22447',
    pieceDarkName: 'Red',
    movable: '#2ecc71',   // green - has a legal move
    selected: '#ffdd00',   // yellow - currently selected piece
    destination: '#9b59b6', // purple - available destination
    forceJump: '#ff6a00',  // orange - mandatory capture destination
  },
};

// Cycle order + display labels for the Settings panel's theme selector.
const THEME_ORDER = ['accented', 'pastel', 'contrast'];
const THEME_DISPLAY_NAMES = {
  accented: 'Default',
  pastel: 'Pastel',
  contrast: 'Contrast',
};

let ACTIVE_THEME = THEMES.accented;
