// checkers/js/theme.js

/**
 * Colour palette definitions for the checkers board.
 * Each theme controls cell colours, piece colours/shadows, piece display
 * names, and the highlight colours used for movable / selected /
 * destination / forced-jump cells.
 */

// ==== Theme Definitions ====

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
    movable: '#8a9a5b',     // green  - piece has a legal move
    selected: '#e3b23c',    // yellow - currently selected piece
    destination: '#b087a0', // purple - available destination cell
    forceJump: '#c1440e',   // orange - mandatory capture destination
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
    movable: '#a3c98d',
    selected: '#f0e6a3',
    destination: '#d2beeb',
    forceJump: '#e8a3a3',
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
    movable: '#2ecc71',
    selected: '#ffdd00',
    destination: '#9b59b6',
    forceJump: '#ff6a00',
  },
};

// ==== Theme Metadata ====

/** Order in which themes are cycled through (e.g. via a settings toggle). */
const THEME_ORDER = ['accented', 'pastel', 'contrast'];

/** Human-readable labels for each theme, shown in the UI. */
const THEME_DISPLAY_NAMES = {
  accented: 'Default',
  pastel: 'Pastel',
  contrast: 'Contrast',
};

// ==== Active Theme State ====

/** The currently active theme object. Defaults to 'accented'. */
let ACTIVE_THEME = THEMES.accented;
