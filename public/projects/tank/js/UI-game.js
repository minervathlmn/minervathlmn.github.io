// --- Sidebar (HTML, outside the canvas) -----------------------------

const turnIndicatorEl = document.getElementById('turn-indicator');
const scoreboardRowsEl = document.getElementById('scoreboard-rows');
let lastScoreboardKey = null; // avoids re-writing the DOM every frame when nothing changed

function updateSidebarTurn(state) {
  if (!turnIndicatorEl) return;
  const turnTank = state.tanks.get(state.currentTurnSessionId);
  turnIndicatorEl.textContent = TankNetwork.isMyTurn()
    ? 'Your turn'
    : `${turnTank?.colourName || 'Player'}'s turn`;
}

// Ported from the Processing displayScoreboard(): one row per tank,
// name in that player's colour, score right-aligned — but as HTML rows
// in the sidebar instead of being drawn onto the board each frame.
function updateSidebarScoreboard(state) {
  if (!scoreboardRowsEl) return;

  const tanks = [...state.tanks.values()].sort((a, b) => a.letter.localeCompare(b.letter));

  const key = tanks.map(t => `${t.letter}:${t.score}`).join(',');
  if (key === lastScoreboardKey) return;
  lastScoreboardKey = key;

  scoreboardRowsEl.innerHTML = tanks.map(t => {
    const name = t.nickname || `Player ${t.letter}`;
    const colour = `rgb(${t.colourR}, ${t.colourG}, ${t.colourB})`;
    return `
      <div class="scoreboard-player-row">
        <span class="player-name" style="color: ${colour}">${escapeHtml(name)}</span>
        <span class="player-score">${t.score}</span>
      </div>`;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}
