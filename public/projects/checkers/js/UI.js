/**
 * Everything DOM-related: the landing screen, mode/difficulty select, the
 * sidebar, and the rules modal. Talks to `game` (declared in sketch.js) but
 * contains no rules logic of its own - it just decides what's visible and
 * forwards button clicks to Game.
 */
let appState = 'landing';       // 'landing' | 'modeSelect' | 'game'
let selectedMode = null;        // '1p' | '2p'
let selectedDifficulty = null;  // 'beginner' | 'intermediate'
let autoHints = false;          // difficulty-driven: on for 1P Beginner
// let manualHintActive = false;   // toggled by the sidebar's Hint button
let manualHintActive = false;   // toggled by the sidebar's Hint button; seeded per-mode in applyModeDefaults()
let moveCount = { dark: 0, light: 0 }; // moves made this game per side - resets each new game, shown under each score like captures
let score = {
  dark: parseInt(sessionStorage.getItem('checkers-score-dark'), 10) || 0,
  light: parseInt(sessionStorage.getItem('checkers-score-light'), 10) || 0,
}; // tracks games WON per side - persists across Start Over/new games and page refreshes (sessionStorage), only the Reset Score button zeroes it
let captures = { dark: 0, light: 0 }; // pieces captured this game per side - resets each new game, like moveCount (not reversed on Undo, same as moveCount)
let gameOverScored = false;     // true once the current game's winner has already been credited a point (guards against double-counting if that win gets undone)

// --- Settings (Appearance + Theme) ----------------------------------------
// Persisted across sessions via localStorage so a player's choice sticks
// even after closing the browser.
let darkModeOn = localStorage.getItem('checkers-dark-mode') === 'true';
let themeIndex = Math.max(0, THEME_ORDER.indexOf(localStorage.getItem('checkers-theme')));
ACTIVE_THEME = THEMES[THEME_ORDER[themeIndex]];

// --- Settings (Undo/Hint/Score/Moves) --------------------------------------
// Persisted via sessionStorage instead - these only need to survive a
// refresh within the current tab, not carry over to the next visit.
let undoSettingEnabled = sessionStorage.getItem('checkers-undo-enabled') !== 'false'; // default on
let hintSettingEnabled = sessionStorage.getItem('checkers-hint-enabled') !== 'false'; // default on
let keepScoreEnabled = sessionStorage.getItem('checkers-keep-score') === 'true'; // default off
let showCapturesEnabled = sessionStorage.getItem('checkers-show-captures') === 'true'; // default off
let showMovesEnabled = sessionStorage.getItem('checkers-show-moves') === 'true'; // default off

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function initUI() {
  bindLandingScreen();
  bindModeSelectScreen();
  bindSidebar();
  bindScoreboard();
  bindRulesModal();
  bindSettingsModal();
}

// Guard against DOMContentLoaded having already fired by the time this
// script runs (e.g. if an earlier script was slow to load).
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// --- Landing screen -----------------------------------------------------

function bindLandingScreen() {
  document.getElementById('play-btn').addEventListener('click', () => {
    appState = 'modeSelect';
    showScreen('mode-select-screen');
  });

  document.getElementById('rules-btn').addEventListener('click', openRulesModal);
}

// --- Mode / difficulty select --------------------------------------------

function bindModeSelectScreen() {
  document.getElementById('one-player-btn').addEventListener('click', () => {
    selectedMode = '1p';
    document.getElementById('difficulty-select').classList.remove('hidden');
  });

  document.getElementById('two-player-btn').addEventListener('click', () => {
    selectedMode = '2p';
    selectedDifficulty = null;
    startGame();
  });

  document.querySelectorAll('#difficulty-select [data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDifficulty = btn.dataset.difficulty;
      startGame();
    });
  });

  document.getElementById('mode-back-btn').addEventListener('click', () => {
    selectedMode = null;
    selectedDifficulty = null;
    document.getElementById('difficulty-select').classList.add('hidden');
    appState = 'landing';
    showScreen('landing-screen');
  });
}

function startGame() {
  autoHints = selectedMode === '1p' && selectedDifficulty === 'beginner';
  // manualHintActive = false; // don't let a leftover manual toggle carry into a new game
  applyModeDefaults();

  moveCount = { dark: 0, light: 0 };
  captures = { dark: 0, light: 0 };
  gameOverScored = false;
  game.start();
  clearSelection();
  appState = 'game';
  showScreen('game-screen');
  updateSidebarForMode();
  updateTurnIndicator();
  updateMoveCountUI();
}

// Seeds the Settings toggles (Undo/Hint) and the Hint button's initial
// on/off state to sensible defaults for the mode/difficulty just chosen.
// These are only *defaults* - the player is still free to flip them in
// Settings afterward, same as any other game.
//
//   Beginner:      Undo ON,  Hint ON  (hint already active)
//   Intermediate:  Undo ON,  Hint ON  (hint not active - manual click)
//   Advanced / 2P: Undo OFF, Hint OFF (hint not active)
//
// Scoreboard items (Keep Score / Show Captures / Show Moves) get seeded the
// same way, per mode/difficulty:
//   Beginner:      Score OFF, Captures OFF, Moves OFF
//   Intermediate:  Score OFF, Captures ON,  Moves ON
//   Advanced / 2P: Score ON,  Captures ON,  Moves ON
function applyModeDefaults() {
  const isBeginner = selectedMode === '1p' && selectedDifficulty === 'beginner';
  const isIntermediate = selectedMode === '1p' && selectedDifficulty === 'intermediate';

  undoSettingEnabled = isBeginner || isIntermediate;
  hintSettingEnabled = isBeginner || isIntermediate;
  manualHintActive = isBeginner;

  sessionStorage.setItem('checkers-undo-enabled', undoSettingEnabled);
  sessionStorage.setItem('checkers-hint-enabled', hintSettingEnabled);

  setKeepScore(!isBeginner && !isIntermediate);
  setShowCaptures(!isBeginner);
  setShowMoves(!isBeginner);

  updateSettingsUI();
}

// Shows/hides the Undo and Hint buttons based on the player's Settings
// preferences. Call this any time a game starts or a relevant setting
// changes. The Settings toggle is purely a show/hide switch now - it
// doesn't get overridden by mode, since applyModeDefaults() already sets
// sensible defaults per mode when a game starts.
function updateSidebarForMode() {
  const undoBtn = document.getElementById('undo-btn');
  const hintBtn = document.getElementById('hint-btn');

  undoBtn.classList.toggle('hidden', !undoSettingEnabled);
  hintBtn.classList.toggle('hidden', !hintSettingEnabled);
  hintBtn.classList.toggle('active', manualHintActive);

  // const moveCountEl = document.getElementById('sidebar-move-count');

  // // The scoreboard already shows the move count when Keep Score is on, so
  // // the plain counter steps aside to avoid showing the number twice.
  // if (moveCountEl) moveCountEl.classList.toggle('hidden', !showMovesEnabled || keepScoreEnabled);

  updateScoreboardUI();
}

// Called any time a full move (or an Undo click) happens, and once on
// game start, so the scoreboard's move count never has to be looked up
// on the fly - it just reads element text that's always up to date.
function incrementMoveCount(colour) {
  moveCount[colour] = moveCount[colour || 0] + 1;
  updateMoveCountUI();
}

function updateMoveCountUI() {
  // const el = document.getElementById('sidebar-move-count');
  // if (el) el.textContent = `Moves: ${moveCount}`;
  updateScoreboardUI();
}

// Shows whose turn it is in 2P mode, or the active difficulty in 1P mode
// (vs. an AI, the opponent's "turn" isn't meaningful to show the player -
// the difficulty is more useful context). Call this any time the turn
// changes or a game starts/resets.
function updateTurnIndicator() {
  const el = document.getElementById('turn-indicator');
  if (!el) return;

  if (selectedMode === '1p') {
    const DIFFICULTY_LABELS = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
    el.textContent = `Level: ${DIFFICULTY_LABELS[selectedDifficulty] ?? selectedDifficulty}`;
  } else {
    el.textContent = game.currentPlayer === 'dark' ? `${ACTIVE_THEME.pieceDarkName}'s Turn` : `${ACTIVE_THEME.pieceLightName}'s Turn`;
  }
}

// --- Sidebar (visible once a game is underway) ---------------------------

function bindSidebar() {
  document.getElementById('sidebar-home-btn').addEventListener('click', () => {
    document.getElementById('difficulty-select').classList.add('hidden');
    appState = 'landing';
    showScreen('landing-screen');
  });

  document.getElementById('sidebar-rules-btn').addEventListener('click', openRulesModal);

  document.getElementById('undo-btn').addEventListener('click', () => {
    if (!undoSettingEnabled) return;
    // if (selectedMode === '1p' && selectedDifficulty === 'advanced') return; // no undo on Advanced

    animation = null;
    pendingAutoMove = null;

    if (!game.canUndo()) return;

    // If the game had just ended (and we already credited the winner a
    // point), undoing takes back the winning move itself - so take back
    // the point too, rather than leaving a phantom win on the scoreboard.
    if (gameOverScored) {
      const winner = game.getWinner();
      score[winner] = Math.max(0, score[winner] - 1);
      gameOverScored = false;
      saveScore();
    }

    // In 1P, Undo should always land back on the player's turn - never
    // partway through, waiting on a bot move that's already been undone.
    // If the most recently completed move group belonged to the bot,
    // undo it, then also undo the player's move that preceded it.
    const lastMover = game.history[game.history.length - 1].turnBefore;
    game.undo();

    if (selectedMode === '1p' && lastMover === 'light' && game.canUndo()) {
      game.undo();
    }

    // One click = one move "spent", even when it reverted both the
    // bot's and the player's turn together above. Attributed to whichever
    // side's move actually got undone (lastMover) - in the 1P double-undo
    // case that's still the bot's move, since the player's own move
    // underneath it wasn't "spent" by this click, just restored.
    incrementMoveCount(lastMover);

    clearSelection();
    updateTurnIndicator();
  });

  document.getElementById('hint-btn').addEventListener('click', () => {
    if (autoHints) return; // locked on for Beginner - can't be toggled off

    manualHintActive = !manualHintActive;
    document.getElementById('hint-btn').classList.toggle('active', manualHintActive);
  });

  document.getElementById('restart-btn').addEventListener('click', () => {
    game.restart();
    clearSelection();
    moveCount = { dark: 0, light: 0 };
    captures = { dark: 0, light: 0 };
    gameOverScored = false;
    updateTurnIndicator();
    updateMoveCountUI();
    updateRestartButtonLabel(); // NEW - flips button back to "Start Over"
  });

  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
}

// --- Scoreboard (visible once a game is underway, when Keep Score is on) --

function bindScoreboard() {
  document.getElementById('scoreboard-reset-btn').addEventListener('click', () => {
    score = { dark: 0, light: 0 };
    saveScore();
    updateScoreboardUI();
  });
}

// Persisted via sessionStorage - the win tally should survive a page
// refresh within the tab (unlike moveCount/captures, which are per-game
// and start fresh every time on purpose).
function saveScore() {
  sessionStorage.setItem('checkers-score-dark', score.dark);
  sessionStorage.setItem('checkers-score-light', score.light);
}

// "You"/"Bot" only makes sense against an AI; in 2P both sides are human,
// so fall back to the current theme's piece names (matches how the turn
// indicator labels sides in 2P).
function scoreboardLabels() {
  if (selectedMode === '1p') return { dark: 'You', light: 'Bot' };
  return { dark: ACTIVE_THEME.pieceDarkName, light: ACTIVE_THEME.pieceLightName };
}

// Called any time score, captures, moveCount, or any of the Keep Score /
// Show Captures / Show Moves settings might have changed, so the
// scoreboard never has to be looked up on the fly. Each setting controls
// its own piece independently:
//   Keep Score     -> the big win numbers + Reset Score link
//   Show Captures  -> the small "N captured" line under each side
//   Show Moves     -> the small "N moved" line under each side
// The BLACK/WHITE label text itself only shows if Keep Score or Show
// Captures is on (Show Moves alone doesn't warrant labeling sides) - but
// the column row still shows whenever any of the three is on, since
// Show Moves needs the column to hang its per-side number on.
// The whole box shows if any of the three settings is on.
function updateScoreboardUI() {
  const wrap = document.getElementById('sidebar-scoreboard-wrap');
  if (!wrap) return;

  const anyOn = keepScoreEnabled || showCapturesEnabled || showMovesEnabled;
  wrap.classList.toggle('hidden', !anyOn);
  if (!anyOn) return;

  const showLabels = keepScoreEnabled || showCapturesEnabled || showMovesEnabled;

  const labels = scoreboardLabels();
  document.getElementById('scoreboard-you-label').classList.toggle('hidden', !showLabels);
  document.getElementById('scoreboard-bot-label').classList.toggle('hidden', !showLabels);
  document.getElementById('scoreboard-you-label').textContent = labels.dark;
  document.getElementById('scoreboard-bot-label').textContent = labels.light;

  document.getElementById('scoreboard-you-score').classList.toggle('hidden', !keepScoreEnabled);
  document.getElementById('scoreboard-bot-score').classList.toggle('hidden', !keepScoreEnabled);
  document.getElementById('scoreboard-you-score').textContent = score.dark;
  document.getElementById('scoreboard-bot-score').textContent = score.light;

  document.getElementById('scoreboard-you-captures').classList.toggle('hidden', !showCapturesEnabled);
  document.getElementById('scoreboard-bot-captures').classList.toggle('hidden', !showCapturesEnabled);
  document.getElementById('scoreboard-you-captures').textContent = `${captures.dark} captured`;
  document.getElementById('scoreboard-bot-captures').textContent = `${captures.light} captured`;

  document.getElementById('scoreboard-you-moves').classList.toggle('hidden', !showMovesEnabled);
  document.getElementById('scoreboard-bot-moves').classList.toggle('hidden', !showMovesEnabled);
  document.getElementById('scoreboard-you-moves').textContent = `${moveCount.dark} moved`;
  document.getElementById('scoreboard-bot-moves').textContent = `${moveCount.light} moved`;

  // Only needed to separate the columns from the Reset Score link below -
  // no point showing it when there's nothing to reset.
  document.getElementById('scoreboard-divider').classList.toggle('hidden', !keepScoreEnabled);

  // Resetting only zeroes the win tally, so only show the link when
  // there's a tally on screen to reset.
  document.getElementById('scoreboard-reset-btn').classList.toggle('hidden', !keepScoreEnabled);
}

// Called once per jump (including each step of a multi-jump chain), right
// after Game applies it - a per-game tally, not reversed on Undo, same as
// moveCount ("one click = one move spent" applies here too).
function recordCapture(colour) {
  captures[colour] = (captures[colour] || 0) + 1;
  updateScoreboardUI();
}

// Called after every completed (non-chained) move - credits the winner a
// point the moment the game actually ends. gameOverScored guards against
// crediting the same win twice (draw() re-checks isGameOver() every frame
// purely for the "X wins!" overlay, which isn't a signal to re-score).
function checkForGameOverScore() {
  if (gameOverScored || !game.isGameOver()) return;

  const winner = game.getWinner();
  score[winner] = (score[winner] || 0) + 1;
  gameOverScored = true;
  saveScore();
  updateScoreboardUI();
}

// --- Bot hook -------------------------------------------------------

const BOT_MOVE_DELAY_MS = 300; // brief "thinking" pause before the bot moves

// Called once a human/non-chained sequence has fully finished, to see if
// it's now the bot's turn to start a fresh move.
function maybeTriggerBotMove() {
  if (selectedMode !== '1p') return;
  if (game.currentPlayer !== 'light') return;
  if (game.isGameOver()) return;

  setTimeout(() => playBotMove(new Bot(selectedDifficulty)), BOT_MOVE_DELAY_MS);
}

// Asks the bot for one move and animates it. Re-checks (rather than trusting
// the caller) that it's genuinely still the bot's turn right now: this
// function is always reached via a setTimeout, and state can change during
// that delay - most notably, the player clicking Undo. Without this guard,
// a stale timer firing after an Undo would ask the bot to move on the
// player's own turn.
function playBotMove(bot) {
  if (selectedMode !== '1p') return;
  if (game.currentPlayer !== 'light') return;
  if (game.isGameOver()) return;

  const move = bot.chooseMove(game);
  if (move) applyMoveWithAnimation(move);
}

// --- Rules modal ----------------------------------------------------------

function bindRulesModal() {
  document.getElementById('close-rules-btn').addEventListener('click', closeRulesModal);

  // Click anywhere on the overlay (outside the modal-content box) closes it.
  document.getElementById('rules-modal').addEventListener('click', (e) => {
    if (e.target.id === 'rules-modal') {
      closeRulesModal();
    }
  });

  document.getElementById('watch-demo-btn').addEventListener('click', () => {
    document.getElementById('rules-view').classList.add('hidden');
    document.getElementById('demo-view').classList.remove('hidden');
    ensureDemoReplayStarted();
  });

  document.getElementById('read-rules-btn').addEventListener('click', () => {
    pauseDemoReplay();
    document.getElementById('demo-view').classList.add('hidden');
    document.getElementById('rules-view').classList.remove('hidden');
  });
}

function openRulesModal() {
  document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rules-modal').classList.add('hidden');

  pauseDemoReplay();
  // Reset back to the rules view for next time, so the modal doesn't
  // reopen mid-demo with no context.
  document.getElementById('demo-view').classList.add('hidden');
  document.getElementById('rules-view').classList.remove('hidden');
}

// --- Settings modal (Appearance + Theme) ---------------------------------

function bindSettingsModal() {
  document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);

  // Click anywhere on the overlay (outside the modal-content box) closes it.
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') {
      closeSettingsModal();
    }
  });

  document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
  document.getElementById('theme-prev-btn').addEventListener('click', () => cycleTheme(-1));
  document.getElementById('theme-next-btn').addEventListener('click', () => cycleTheme(1));
  document.getElementById('undo-enabled-toggle').addEventListener('click', toggleUndoSetting);
  document.getElementById('hint-enabled-toggle').addEventListener('click', toggleHintSetting);

  document.querySelectorAll('.yesno-toggle[data-setting="keep-score"] .yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => setKeepScore(btn.dataset.value === 'true'));
  });
  document.querySelectorAll('.yesno-toggle[data-setting="show-captures"] .yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => setShowCaptures(btn.dataset.value === 'true'));
  });
  document.querySelectorAll('.yesno-toggle[data-setting="show-moves"] .yesno-btn').forEach(btn => {
    btn.addEventListener('click', () => setShowMoves(btn.dataset.value === 'true'));
  });

  // Reflect whatever was loaded from storage as soon as the page is
  // ready, so the toggle/label are correct the first time this modal opens.
  updateSettingsUI();
}

function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

// `game` (sketch.js/p5) has its own internal input handling that we don't
// control the wiring of (mousePressed() is p5's global-mode callback,
// triggered by however p5 itself listens for input under the hood). Rather
// than fighting that at the DOM level, sketch.js's mousePressed() checks
// this directly and bails out before touching the board at all while the
// modal is open - the actual "pause" lives at the one real entry point for
// board interaction, not somewhere upstream of it.
function isSettingsModalOpen() {
  return !document.getElementById('settings-modal').classList.contains('hidden');
}

function toggleDarkMode() {
  darkModeOn = !darkModeOn;
  localStorage.setItem('checkers-dark-mode', darkModeOn);
  applyDarkModeClass();
  updateSettingsUI();
}

// Applies/removes the .dark-mode class that the scoped CSS overrides key
// off of (see #game-screen.dark-mode rules in style.css). Safe to call
// even before the game screen exists in the DOM.
function applyDarkModeClass() {
  document.getElementById('game-screen').classList.toggle('dark-mode', darkModeOn);
}

function toggleUndoSetting() {
  undoSettingEnabled = !undoSettingEnabled;
  sessionStorage.setItem('checkers-undo-enabled', undoSettingEnabled);
  updateSettingsUI();

  // Take effect on the sidebar immediately if a game is already underway.
  if (appState === 'game') {
    updateSidebarForMode();
  }
}

function toggleHintSetting() {
  hintSettingEnabled = !hintSettingEnabled;
  sessionStorage.setItem('checkers-hint-enabled', hintSettingEnabled);
  if (!hintSettingEnabled) manualHintActive = false; // don't leave a stale "active" hint state behind
  updateSettingsUI();

  if (appState === 'game') {
    updateSidebarForMode();
  }
}

function setKeepScore(value) {
  keepScoreEnabled = value;
  sessionStorage.setItem('checkers-keep-score', keepScoreEnabled);
  updateSettingsUI();
}

function setShowCaptures(value) {
  showCapturesEnabled = value;
  sessionStorage.setItem('checkers-show-captures', showCapturesEnabled);
  updateSettingsUI();
}

function setShowMoves(value) {
  showMovesEnabled = value;
  sessionStorage.setItem('checkers-show-moves', showMovesEnabled);
  updateSettingsUI();

  if (appState === 'game') {
    updateSidebarForMode();
  }
}

// direction: -1 for previous, +1 for next. Loops around both ends.
function cycleTheme(direction) {
  themeIndex = (themeIndex + direction + THEME_ORDER.length) % THEME_ORDER.length;
  const themeKey = THEME_ORDER[themeIndex];
  ACTIVE_THEME = THEMES[themeKey];
  localStorage.setItem('checkers-theme', themeKey);
  updateSettingsUI();

  // Piece names (and therefore the turn indicator text) differ per theme
  // (e.g. "Maroon" vs "Black" vs "Red"), so refresh it if a game is live.
  if (appState === 'game') {
    updateTurnIndicator();
  }
}

function updateSettingsUI() {
  const toggle = document.getElementById('dark-mode-toggle');
  toggle.setAttribute('aria-checked', darkModeOn);

  const themeKey = THEME_ORDER[themeIndex];
  document.getElementById('theme-name-label').textContent = THEME_DISPLAY_NAMES[themeKey];

  document.getElementById('undo-enabled-toggle').setAttribute('aria-checked', undoSettingEnabled);
  document.getElementById('hint-enabled-toggle').setAttribute('aria-checked', hintSettingEnabled);

  document.querySelectorAll('.yesno-toggle[data-setting="keep-score"] .yesno-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.value === 'true') === keepScoreEnabled);
  });
  document.querySelectorAll('.yesno-toggle[data-setting="show-captures"] .yesno-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.value === 'true') === showCapturesEnabled);
  });
  document.querySelectorAll('.yesno-toggle[data-setting="show-moves"] .yesno-btn').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.value === 'true') === showMovesEnabled);
  });

  updateMoveCountUI();
}
