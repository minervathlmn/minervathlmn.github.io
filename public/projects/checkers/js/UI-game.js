// checkers/js/UI-game.js

/**
 * DOM/UI layer for the live game screen: mode setup, sidebar controls,
 * scoreboard, rules & settings modals, dark mode/theme, and the bot's
 * move scheduling. All p5-facing state (board, animation) lives in
 * sketch.js; this file owns everything outside the canvas.
 */

// ==== State ====

let selectedMode = null;
let selectedDifficulty = null;
let autoHints = false;
let manualHintActive = false;
let moveCount = { dark: 0, light: 0 };
let score = { dark: 0, light: 0 };
let captures = { dark: 0, light: 0 };
let gameOverScored = false; // guards against double-counting a win once the game ends

// Persisted across visits (localStorage)
let darkModeOn = localStorage.getItem('checkers-dark-mode') === 'true';
let themeIndex = Math.max(0, THEME_ORDER.indexOf(localStorage.getItem('checkers-theme')));
ACTIVE_THEME = THEMES[THEME_ORDER[themeIndex]];

// Persisted per-tab only (sessionStorage) - reset defaults are applied per mode/difficulty
let undoSettingEnabled = sessionStorage.getItem('checkers-undo-enabled') !== 'false';
let hintSettingEnabled = sessionStorage.getItem('checkers-hint-enabled') !== 'false';
let keepScoreEnabled = sessionStorage.getItem('checkers-keep-score') === 'true';
let showCapturesEnabled = sessionStorage.getItem('checkers-show-captures') === 'true';
let showMovesEnabled = sessionStorage.getItem('checkers-show-moves') === 'true';

let domReady = false;

// ==== Init ====

/** Reads mode/difficulty from the URL, wires up all UI event listeners, and attempts to start the game. */
function initUI() {
  const params = new URLSearchParams(location.search);
  selectedMode = params.get('mode');
  selectedDifficulty = params.get('difficulty');

  applyDarkModeClass();

  bindSidebar();
  bindScoreboard();
  bindRulesModal();
  bindSettingsModal();

  domReady = true;
  tryStartGame();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// ==== Game Start ====

/**
 * Starts the game once both the DOM and the p5 sketch are ready.
 * Called from both initUI() and sketch.js's setup(), since either
 * one might finish loading first.
 */
function tryStartGame() {
  if (!domReady || !p5Ready) return;
  startGame();
}

/** Applies mode defaults, resets counters, and starts a fresh Game. */
function startGame() {
  autoHints = selectedMode === '1p' && selectedDifficulty === 'beginner';
  applyModeDefaults();

  loadScore();
  moveCount = { dark: 0, light: 0 };
  captures = { dark: 0, light: 0 };
  gameOverScored = false;
  game.start();
  clearSelection();
  updateSidebarForMode();
  updateTurnIndicator();
  updateMoveCountUI();
}

/**
 * Sets undo/hint/scoreboard visibility defaults based on difficulty:
 * beginner and intermediate get more assistance (undo, hints) but no
 * scoreboard; advanced and 2-player get the reverse.
 */
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

// ==== Sidebar ====

/** Wires up all sidebar buttons: drawer toggle, undo, hint, restart, home, rules, settings. */
function bindSidebar() {
  document.getElementById('sidebar-toggle-btn').addEventListener('click', toggleSidebarDrawer);
  document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebarDrawer);

  document.getElementById('sidebar-home-btn').addEventListener('click', () => {
    location.href = '../index.html';
  });

  document.getElementById('sidebar-rules-btn').addEventListener('click', openRulesModal);

  document.getElementById('undo-btn').addEventListener('click', () => {
    if (!undoSettingEnabled) return;

    animation = null;
    pendingAutoMove = null;

    if (!game.canUndo()) return;

    // If the game had already ended and been scored, undo needs to reverse that score too
    if (gameOverScored) {
      const winner = game.getWinner();
      score[winner] = Math.max(0, score[winner] - 1);
      gameOverScored = false;
      saveScore();
    }

    const lastMover = game.history[game.history.length - 1].turnBefore;
    game.undo();

    // In 1P mode, undoing a bot move should also undo the player's move that preceded it
    if (selectedMode === '1p' && lastMover === 'light' && game.canUndo()) {
      game.undo();
    }

    incrementMoveCount(lastMover);

    clearSelection();
    updateTurnIndicator();
  });

  document.getElementById('hint-btn').addEventListener('click', () => {
    if (autoHints) return;

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
    updateRestartButtonLabel();
  });

  document.getElementById('settings-btn').addEventListener('click', openSettingsModal);
}

function toggleSidebarDrawer() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-backdrop').classList.toggle('visible');
}

function closeSidebarDrawer() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

/** Shows/hides the undo and hint buttons per their settings, and refreshes the scoreboard. */
function updateSidebarForMode() {
  const undoBtn = document.getElementById('undo-btn');
  const hintBtn = document.getElementById('hint-btn');

  undoBtn.classList.toggle('hidden', !undoSettingEnabled);
  hintBtn.classList.toggle('hidden', !hintSettingEnabled);
  hintBtn.classList.toggle('active', manualHintActive);

  updateScoreboardUI();
}

// ==== Turn Indicator / Move Count ====

/**
 * @param {string} colour - 'dark' or 'light'.
 */
function incrementMoveCount(colour) {
  moveCount[colour] = moveCount[colour || 0] + 1;
  updateMoveCountUI();
}

function updateMoveCountUI() {
  updateScoreboardUI();
}

/** Updates the turn indicator text: difficulty label in 1P mode, whose turn it is in 2P mode. */
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

// ==== Scoreboard ====

/** Wires up the scoreboard's reset-score button. */
function bindScoreboard() {
  document.getElementById('scoreboard-reset-btn').addEventListener('click', () => {
    score = { dark: 0, light: 0 };
    saveScore();
    updateScoreboardUI();
  });
}

/** @returns {string} Storage key suffix, scoped per mode/difficulty so scores don't mix across them. */
function scoreStorageKey() {
  return selectedMode === '1p' ? `1p-${selectedDifficulty}` : '2p';
}

function loadScore() {
  const key = scoreStorageKey();
  score = {
    dark: parseInt(sessionStorage.getItem(`checkers-score-dark-${key}`), 10) || 0,
    light: parseInt(sessionStorage.getItem(`checkers-score-light-${key}`), 10) || 0,
  };
}

function saveScore() {
  const key = scoreStorageKey();
  sessionStorage.setItem(`checkers-score-dark-${key}`, score.dark);
  sessionStorage.setItem(`checkers-score-light-${key}`, score.light);
}

/** @returns {{dark: string, light: string}} Display labels for the scoreboard columns. */
function scoreboardLabels() {
  if (selectedMode === '1p') return { dark: 'You', light: 'Bot' };
  return { dark: ACTIVE_THEME.pieceDarkName, light: ACTIVE_THEME.pieceLightName };
}

/** Refreshes every scoreboard element (labels, score, captures, moves) per current settings. */
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

  document.getElementById('scoreboard-divider').classList.toggle('hidden', !keepScoreEnabled);
  document.getElementById('scoreboard-reset-btn').classList.toggle('hidden', !keepScoreEnabled);
}

/**
 * @param {string} colour - Colour of the player who made the capture.
 */
function recordCapture(colour) {
  captures[colour] = (captures[colour] || 0) + 1;
  updateScoreboardUI();
}

/** Records a win/draw exactly once per game, the first time isGameOver() becomes true. */
function checkForGameOverScore() {
  if (gameOverScored || !game.isGameOver()) return;

  const winner = game.getWinner();
  score[winner] = (score[winner] || 0) + 1;
  gameOverScored = true;
  saveScore();
  updateScoreboardUI();
}

// ==== Bot Move Scheduling ====

const BOT_MOVE_DELAY_MS = 300;

/** Schedules the bot's move after a short delay, if it's currently the bot's turn in 1P mode. */
function maybeTriggerBotMove() {
  if (selectedMode !== '1p') return;
  if (game.currentPlayer !== 'light') return;
  if (game.isGameOver()) return;

  setTimeout(() => playBotMove(new Bot(selectedDifficulty)), BOT_MOVE_DELAY_MS);
}

/**
 * Asks the bot to choose and play a move, if it's still validly the
 * bot's turn (guards against state changing during the delay).
 * @param {Bot} bot
 */
function playBotMove(bot) {
  if (selectedMode !== '1p') return;
  if (game.currentPlayer !== 'light') return;
  if (game.isGameOver()) return;

  const move = bot.chooseMove(game);
  if (move) applyMoveWithAnimation(move);
}

// ==== Rules Modal ====

/** Wires up the rules modal: close button, backdrop click, and the rules/demo tab switch. */
function bindRulesModal() {
  document.getElementById('close-rules-btn').addEventListener('click', closeRulesModal);

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
  closeSidebarDrawer();
  document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rules-modal').classList.add('hidden');

  // Always return to the rules tab (and stop the demo) so it's fresh next time it opens
  pauseDemoReplay();
  document.getElementById('demo-view').classList.add('hidden');
  document.getElementById('rules-view').classList.remove('hidden');
}

// ==== Settings Modal ====

/** Wires up every control inside the settings modal. */
function bindSettingsModal() {
  document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);

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

  updateSettingsUI();
}

function openSettingsModal() {
  closeSidebarDrawer();
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

/** @returns {boolean} Whether the settings modal is currently open (used to suppress board clicks). */
function isSettingsModalOpen() {
  return !document.getElementById('settings-modal').classList.contains('hidden');
}

// ==== Dark Mode / Theme ====

function toggleDarkMode() {
  darkModeOn = !darkModeOn;
  localStorage.setItem('checkers-dark-mode', darkModeOn);
  applyDarkModeClass();
  updateSettingsUI();
}

function applyDarkModeClass() {
  document.getElementById('game-screen').classList.toggle('dark-mode', darkModeOn);
}

/**
 * @param {number} direction - +1 for next theme, -1 for previous.
 */
function cycleTheme(direction) {
  themeIndex = (themeIndex + direction + THEME_ORDER.length) % THEME_ORDER.length;
  const themeKey = THEME_ORDER[themeIndex];
  ACTIVE_THEME = THEMES[themeKey];
  localStorage.setItem('checkers-theme', themeKey);
  updateSettingsUI();
  updateTurnIndicator();
}

// ==== Setting Toggles ====

function toggleUndoSetting() {
  undoSettingEnabled = !undoSettingEnabled;
  sessionStorage.setItem('checkers-undo-enabled', undoSettingEnabled);
  updateSettingsUI();
  updateSidebarForMode();
}

function toggleHintSetting() {
  hintSettingEnabled = !hintSettingEnabled;
  sessionStorage.setItem('checkers-hint-enabled', hintSettingEnabled);
  if (!hintSettingEnabled) manualHintActive = false;
  updateSettingsUI();
  updateSidebarForMode();
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
  updateSidebarForMode();
}

/** Syncs all settings-modal controls (switches, toggle groups, labels) to current state. */
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
