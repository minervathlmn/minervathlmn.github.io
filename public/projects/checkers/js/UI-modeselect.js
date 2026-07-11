// checkers/js/UI-modeselect.js

/**
 * DOM logic for the mode-select screen (checkers/play/index.html):
 * lets the player choose 1P (then a difficulty) or 2P, and navigates
 * to the game screen with the choice encoded in the URL query string.
 */

// ==== Init ====

function initUI() {
  bindModeSelectScreen();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// ==== Mode Select Screen ====

/** Wires up the 1P/2P buttons, difficulty buttons, and back button. */
function bindModeSelectScreen() {
  document.getElementById('one-player-btn').addEventListener('click', () => {
    document.getElementById('difficulty-select').classList.remove('hidden');
  });

  document.getElementById('two-player-btn').addEventListener('click', () => {
    location.href = '../game/index.html?mode=2p';
  });

  document.querySelectorAll('#difficulty-select [data-difficulty]').forEach(btn => {
    btn.addEventListener('click', () => {
      location.href = `../game/index.html?mode=1p&difficulty=${btn.dataset.difficulty}`;
    });
  });

  document.getElementById('mode-back-btn').addEventListener('click', () => {
    location.href = '../index.html';
  });
}
