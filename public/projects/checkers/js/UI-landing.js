/**
 * Landing page only: the title screen and the Rules modal (with its
 * demo-replay tutorial). No game state, no board classes - just enough
 * to show the Rules modal and hand off to /play/ when Play is clicked.
 */

// Theme needs to be live here too, since the demo-replay tutorial inside
// the Rules modal renders pieces using ACTIVE_THEME's colours.
let themeIndex = Math.max(0, THEME_ORDER.indexOf(localStorage.getItem('checkers-theme')));
ACTIVE_THEME = THEMES[THEME_ORDER[themeIndex]];

function initUI() {
  bindLandingScreen();
  bindRulesModal();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

function bindLandingScreen() {
  document.getElementById('play-btn').addEventListener('click', () => {
    location.href = 'play/index.html';
  });

  document.getElementById('rules-btn').addEventListener('click', openRulesModal);
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
  document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rules-modal').classList.add('hidden');

  pauseDemoReplay();
  document.getElementById('demo-view').classList.add('hidden');
  document.getElementById('rules-view').classList.remove('hidden');
}