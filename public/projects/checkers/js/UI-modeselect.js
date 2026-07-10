/**
 * Mode/difficulty select page only. No game state lives here - this page's
 * only job is figuring out mode + difficulty and handing off to /game/
 * via the URL. The actual game (Board, GameLogic, etc.) has no idea this
 * page exists.
 */
function initUI() {
  bindModeSelectScreen();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

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
