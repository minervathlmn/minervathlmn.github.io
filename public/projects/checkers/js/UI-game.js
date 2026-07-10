/**
 * Game page only: sidebar, scoreboard, settings, rules modal, and the bot
 * hook. Mode/difficulty arrive via the URL (?mode=1p&difficulty=advanced),
 * set by the mode-select page - this page never sets them itself.
 */
let selectedMode = null;        // '1p' | '2p'
let selectedDifficulty = null;  // 'beginner' | 'intermediate' | 'advanced'
let autoHints = false;
let manualHintActive = false;
let moveCount = { dark: 0, light: 0 };
let score = {
  dark: parseInt(sessionStorage.getItem('checkers-score-dark'), 10) || 0,
  light: parseInt(sessionStorage.getItem('checkers-score-light'), 10) || 0,
};
let captures = { dark: 0, light: 0 };
let gameOverScored = false;

let darkModeOn = localStorage.getItem('checkers-dark-mode') === 'true';
let themeIndex = Math.max(0, THEME_ORDER.indexOf(localStorage.getItem('checkers-theme')));
ACTIVE_THEME = THEMES[THEME_ORDER[themeIndex]];

let undoSettingEnabled = sessionStorage.getItem('checkers-undo-enabled') !== 'false';
let hintSettingEnabled = sessionStorage.getItem('checkers-hint-enabled') !== 'false';
let keepScoreEnabled = sessionStorage.getItem('checkers-keep-score') === 'true';
let showCapturesEnabled = sessionStorage.getItem('checkers-show-captures') === 'true';
let showMovesEnabled = sessionStorage.getItem('checkers-show-moves') === 'true';

let domReady = false; // NEW - see tryStartGame()

function initUI() {
  const params = new URLSearchParams(location.search);
  selectedMode = params.get('mode');
  selectedDifficulty = params.get('difficulty');

  applyDarkModeClass();

  bindSidebar();
  bindScoreboard();
  bindRulesModal();
  bindSettingsModal();

  domReady = true;   // NEW
  tryStartGame();    // NEW
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// NEW - only fires once both the DOM bindings above AND p5's setup()
// (which creates `game`) have completed, in whichever order they happen
// to finish. Same shape as the DOMContentLoaded/millis race you already
// fixed in DemoReplay.js.
function tryStartGame() {
  if (!domReady || !p5Ready) return;
  startGame();
}

function startGame() {
  autoHints = selectedMode === '1p' && selectedDifficulty === 'beginner';
  applyModeDefaults();

  moveCount = { dark: 0, light: 0 };
  captures = { dark: 0, light: 0 };
  gameOverScored = false;
  game.start();
  clearSelection();
  updateSidebarForMode();
  updateTurnIndicator();
  updateMoveCountUI();
}

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

function updateSidebarForMode() {
  const undoBtn = document.getElementById('undo-btn');
  const hintBtn = document.getElementById('hint-btn');

  undoBtn.classList.toggle('hidden', !undoSettingEnabled);
  hintBtn.classList.toggle('hidden', !hintSettingEnabled);
  hintBtn.classList.toggle('active', manualHintActive);

  updateScoreboardUI();
}

function incrementMoveCount(colour) {
  moveCount[colour] = moveCount[colour || 0] + 1;
  updateMoveCountUI();
}

function updateMoveCountUI() {
  updateScoreboardUI();
}

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

// --- Sidebar ---------------------------------------------------------

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

    if (gameOverScored) {
      const winner = game.getWinner();
      score[winner] = Math.max(0, score[winner] - 1);
      gameOverScored = false;
      saveScore();
    }

    const lastMover = game.history[game.history.length - 1].turnBefore;
    game.undo();

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

// --- Scoreboard --------------------------------------------------------

function bindScoreboard() {
  document.getElementById('scoreboard-reset-btn').addEventListener('click', () => {
    score = { dark: 0, light: 0 };
    saveScore();
    updateScoreboardUI();
  });
}

function saveScore() {
  sessionStorage.setItem('checkers-score-dark', score.dark);
  sessionStorage.setItem('checkers-score-light', score.light);
}

function scoreboardLabels() {
  if (selectedMode === '1p') return { dark: 'You', light: 'Bot' };
  return { dark: ACTIVE_THEME.pieceDarkName, light: ACTIVE_THEME.pieceLightName };
}

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

function recordCapture(colour) {
  captures[colour] = (captures[colour] || 0) + 1;
  updateScoreboardUI();
}

function checkForGameOverScore() {
  if (gameOverScored || !game.isGameOver()) return;

  const winner = game.getWinner();
  score[winner] = (score[winner] || 0) + 1;
  gameOverScored = true;
  saveScore();
  updateScoreboardUI();
}

// --- Bot hook ------------------------------------------------------

const BOT_MOVE_DELAY_MS = 300;

function maybeTriggerBotMove() {
  if (selectedMode !== '1p') return;
  if (game.currentPlayer !== 'light') return;
  if (game.isGameOver()) return;

  setTimeout(() => playBotMove(new Bot(selectedDifficulty)), BOT_MOVE_DELAY_MS);
}

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

  pauseDemoReplay();
  document.getElementById('demo-view').classList.add('hidden');
  document.getElementById('rules-view').classList.remove('hidden');
}

// --- Settings modal ---------------------------------------------------

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

function isSettingsModalOpen() {
  return !document.getElementById('settings-modal').classList.contains('hidden');
}

function toggleDarkMode() {
  darkModeOn = !darkModeOn;
  localStorage.setItem('checkers-dark-mode', darkModeOn);
  applyDarkModeClass();
  updateSettingsUI();
}

function applyDarkModeClass() {
  document.getElementById('game-screen').classList.toggle('dark-mode', darkModeOn);
}

function toggleUndoSetting() {
  undoSettingEnabled = !undoSettingEnabled;
  sessionStorage.setItem('checkers-undo-enabled', undoSettingEnabled);
  updateSettingsUI();
  updateSidebarForMode(); // NEW - was gated behind `if (appState === 'game')`, always true here
}

function toggleHintSetting() {
  hintSettingEnabled = !hintSettingEnabled;
  sessionStorage.setItem('checkers-hint-enabled', hintSettingEnabled);
  if (!hintSettingEnabled) manualHintActive = false;
  updateSettingsUI();
  updateSidebarForMode(); // NEW
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
  updateSidebarForMode(); // NEW
}

function cycleTheme(direction) {
  themeIndex = (themeIndex + direction + THEME_ORDER.length) % THEME_ORDER.length;
  const themeKey = THEME_ORDER[themeIndex];
  ACTIVE_THEME = THEMES[themeKey];
  localStorage.setItem('checkers-theme', themeKey);
  updateSettingsUI();
  updateTurnIndicator(); // NEW
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
