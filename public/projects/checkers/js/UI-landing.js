// checkers/js/UI-landing.js

/**
 * DOM logic for the landing screen (checkers/index.html): the Play/Rules
 * buttons and the rules modal (including its rules/demo tab switch).
 */

// ==== Theme (persisted from a previous game session) ====

let themeIndex = Math.max(0, THEME_ORDER.indexOf(localStorage.getItem('checkers-theme')));
ACTIVE_THEME = THEMES[THEME_ORDER[themeIndex]];

// ==== Init ====

function initUI() {
  bindLandingScreen();
  bindRulesModal();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// ==== Landing Screen ====

/** Wires up the Play and Rules buttons. */
function bindLandingScreen() {
  document.getElementById('play-btn').addEventListener('click', () => {
    location.href = 'play/index.html';
  });

  document.getElementById('rules-btn').addEventListener('click', openRulesModal);
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
  document.getElementById('rules-modal').classList.remove('hidden');
}

function closeRulesModal() {
  document.getElementById('rules-modal').classList.add('hidden');

  // Always return to the rules tab (and stop the demo) so it's fresh next time it opens
  pauseDemoReplay();
  document.getElementById('demo-view').classList.add('hidden');
  document.getElementById('rules-view').classList.remove('hidden');
}
