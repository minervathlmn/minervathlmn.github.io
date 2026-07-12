/**
 * UI colours for the canvas-drawn HUD (health/fuel/power/wind/turn
 * indicator), matching the portfolio's beige/maroon design system used
 * in checkers' theme.js.
 */
const UI_THEME = {
  hudText: [61, 28, 28],       // #3d1c1c
  panelBg: [244, 239, 225],    // #f4efe1
  panelBorder: [92, 43, 43],   // #5c2b2b
  
  // PlayerHUD panel-specific colours
  tabBg: [92, 43, 43],         // #5c2b2b
  tabText: [244, 239, 225],    // #f4efe1
  heading: [61, 28, 28],       // #3d1c1c
  label: [92, 43, 43],         // #5c2b2b
  barTrack: [236, 223, 200],   // #ecdfc8
  powerFill: [90, 90, 90],     // muted grey, not near-black
};

/**
 * Fallback gradient colours used when a background image hasn't been
 * added to /assets yet, keyed by the same filenames referenced in
 * config.json. Once the real PNGs are dropped in, sketch.js prefers
 * them automatically and these are never used.
 */
const FALLBACK_BACKGROUND_COLOURS = {
  'basic.png': ['#bcd9ea', '#eaf6ff'],
  'desert.png': ['#f2d6a2', '#fbe9c7'],
  'forest.png': ['#a9c8a0', '#dcefd2'],
  'hills.png': ['#a7c7e7', '#dcefff'],
  'snow.png': ['#dfeeff', '#ffffff'],
};

const FALLBACK_TREE_COLOUR = [46, 92, 51];
