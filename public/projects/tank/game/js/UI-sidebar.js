// === SHARED REFS & HELPERS ===========================================
// Used by render.js's updateSidebarTurn/updateSidebarScoreboard as well.

const turnIndicatorEl = document.getElementById('turn-indicator-text');
const turnTimerBarEl = document.getElementById('turn-timer-bar');
const scoreboardRowsEl = document.getElementById('scoreboard-rows');
let lastScoreboardKey = null; // avoids re-writing the DOM every frame when nothing changed

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}


// === MOBILE SIDEBAR TOGGLE =============================================
// Hamburger button + backdrop, for small screens where the sidebar is
// hidden by default (see style.css) until opened.

const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebar.classList.add('open');
  sidebarBackdrop.classList.add('open');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarBackdrop.classList.remove('open');
}

sidebarToggleBtn.addEventListener('click', () => {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
sidebarBackdrop.addEventListener('click', closeSidebar);


// === Settings modal (appearance only) ===================================
// No gameplay settings live here yet — just the dark mode toggle below.

const settingsModal = document.getElementById('settings-modal');

document.getElementById('settings-btn').addEventListener('click', () => {
  settingsModal.classList.remove('hidden');
});
document.getElementById('close-settings-btn').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') {
    settingsModal.classList.add('hidden');
  }
});

// --- Dark mode toggle ----------------------------------------------------

const darkModeToggle = document.getElementById('dark-mode-toggle');
const gameScreen = document.getElementById('game-screen');

darkModeToggle.addEventListener('click', () => {
  const isDark = gameScreen.classList.toggle('dark-mode');
  darkModeToggle.setAttribute('aria-checked', String(isDark));
});


// === Shop / Info ======================================================
// Stubs only, not wired up yet.

document.getElementById('shop-btn').addEventListener('click', () => {});
document.getElementById('info-btn').addEventListener('click', () => {});


// === Leave room =========================================================
// Same mechanism as checkers' "Home" — bail out of the room via
// TankNetwork.leaveRoom(), then return to the lobby menu screen.

document.getElementById('sidebar-leave-btn').addEventListener('click', async () => {
  try {
    await TankNetwork.leaveRoom();
  } catch (e) {
    console.warn('Error leaving room:', e);
  }
  window.location.href = '../play/index-play.html';
});