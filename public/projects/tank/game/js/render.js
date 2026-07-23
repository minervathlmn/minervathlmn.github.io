function drawBackground(state) {
  const img = sprites[state.backgroundImageName];
  if (img) {
    image(img, 0, 0, Board.WIDTH, Board.HEIGHT);
    return;
  }

  const fallback = FALLBACK_BACKGROUND_COLOURS[state.backgroundImageName] ?? FALLBACK_BACKGROUND_COLOURS['basic.png'];
  const c1 = color(fallback[0]);
  const c2 = color(fallback[1]);
  for (let y = 0; y < Board.HEIGHT; y++) {
    stroke(lerpColor(c1, c2, y / Board.HEIGHT));
    line(0, y, Board.WIDTH, y);
  }
  noStroke();
}

function drawTerrain(state) {
  stroke(state.terrainColourR, state.terrainColourG, state.terrainColourB);
  for (let x = 0; x < Board.WIDTH; x++) {
    const y = state.terrainPosition[x];
    line(x, y, x, Board.HEIGHT);
  }
  noStroke();
}

function drawTrees(state) {
  const img = sprites[state.treeImageName];
  for (const x of state.trees) {
    const y = state.terrainPosition[x] - 32;
    if (img) {
      image(img, x - Board.CELLSIZE / 2, y, Board.CELLSIZE, Board.CELLSIZE);
    } else {
      fill(...FALLBACK_TREE_COLOUR);
      triangle(x, y, x - 12, y + 32, x + 12, y + 32);
      noStroke();
    }
  }
}

// Inlines what client Tank.draw()/deployParachute() used to do — the
// server's Tank no longer draws itself (it's a plain simulation object),
// so this reads the synced TankState fields directly.
function drawTankVisual(t) {
  const rad = radians(t.turretAngle);
  const turretX = t.x + Math.floor(Constants.TURRET_LENGTH * sin(rad));
  const turretY = t.y - 6 - Math.floor(Constants.TURRET_LENGTH * cos(rad));

  strokeWeight(5);
  stroke(0);
  line(t.x, t.y - 6, turretX, turretY);

  // stroke(t.colourR, t.colourG, t.colourB);
  // line(t.x - 4, t.y - 4, t.x + 4, t.y - 4);
  // line(t.x - 8, t.y, t.x + 8, t.y);
  // noStroke();
  
  const [r, g, b] = t.isBot ? botShade([t.colourR, t.colourG, t.colourB]) : [t.colourR, t.colourG, t.colourB];
  stroke(r, g, b);
  line(t.x - 4, t.y - 4, t.x + 4, t.y - 4);
  line(t.x - 8, t.y, t.x + 8, t.y);
  noStroke();

  // parachute deploy inferred from synced falling+parachute fields,
  // instead of Tank calling deployParachute() itself during tick()
  if (t.falling && t.parachute > 0) {
    const img = sprites['parachute.png'];
    if (img) {
      image(img, t.x - 32, t.y - 66, Board.CELLSIZE * 2, Board.CELLSIZE * 2);
    } else {
      fill(255);
      triangle(t.x - 20, t.y - 40, t.x + 20, t.y - 40, t.x, t.y - 10);
      noStroke();
    }
  }
}

function drawTanks(state) {
  for (const tankState of state.tanks.values()) {
    if (!tankState.alive) continue;
    drawTankVisual(tankState);
  }
}

function drawShots(state) {
  const dt = deltaTime / 1000;
  activeShots = activeShots.filter(shot => {
    shot.tick(dt, state.terrainPosition, state.wind);
    shot.draw();
    return shot.status !== 'done';
  });
}

function drawHUD(state) {
  const windRowY = 32;

  const myTank = state.tanks.get(mySessionId);

  updateSidebarTurn(state);
  updateSidebarTimer(state);
  updateSidebarScoreboard(state);

  hud.tank = myTank;
  hud.draw();

  if (state.wind !== 0) {
    const windImg = state.wind < 0 ? sprites['wind-1.png'] : sprites['wind.png'];
    if (windImg) {
      image(windImg, Board.WIDTH - 115, windRowY - 14, Board.CELLSIZE * 1.5, Board.CELLSIZE * 1.5);
    }
  }
  
  textSize(16);
  textAlign(RIGHT, TOP);
  fill(...UI_THEME.hudText);
  text(Math.round(state.wind), Board.WIDTH - 30, windRowY);
  textAlign(LEFT, TOP);
}

function drawGameEnd(state) {
  fill(0, 150);
  rect(0, 0, Board.WIDTH, Board.HEIGHT);

  const tanks = [...state.tanks.values()].sort((a, b) => b.score - a.score);
  const first = tanks[0];
  const second = tanks[1];

  textAlign(CENTER, TOP);
  textSize(24);
  if (first && second && first.score > second.score) {
    fill(first.colourR, first.colourG, first.colourB);
    text(`${first.nickname || `Player ${first.letter}`} wins!`, Board.WIDTH / 2, 100);
  } else {
    fill(255);
    text("It's a tie!", Board.WIDTH / 2, 100);
  }

  const { bx, by, bw, bh } = restartButtonBounds();
  const hovered = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;

  stroke(0);
  strokeWeight(2);
  fill(hovered ? 220 : 255);
  rect(bx, by, bw, bh);

  noStroke();
  fill(0);
  textAlign(CENTER, CENTER);
  textSize(15);
  text('Start Over', bx + bw / 2, by + bh / 2);
}

function restartButtonBounds() {
  const bw = 100, bh = 35;
  return { bx: Board.WIDTH / 2 - bw / 2, by: Board.HEIGHT - bh * 3, bw, bh };
}

function isLevelOver(state) {
  let aliveCount = 0;
  for (const t of state.tanks.values()) if (t.alive) aliveCount++;
  return aliveCount <= 1;
}

function updateSidebarTurn(state) {
  if (!turnIndicatorEl) return;
  const turnTank = state.tanks.get(state.currentTurnSessionId);
  turnIndicatorEl.textContent = TankNetwork.isMyTurn()
    ? 'Your turn'
    : `${turnTank?.colourName || 'Player'}'s turn`;
}

function updateSidebarTimer(state) {
  if (!turnTimerBarEl) return;
  const remaining = state.turnEndsAt - Date.now();
  const frac = clamp(remaining / Constants.TURN_TIME_LIMIT_MS, 0, 1);
  turnTimerBarEl.style.width = `${frac * 100}%`;
}

function updateSidebarScoreboard(state) {
  if (!scoreboardRowsEl) return;

  const tanks = [...state.tanks.values()].sort((a, b) => a.letter.localeCompare(b.letter));

  const key = tanks.map(t => `${t.letter}:${t.score}:${t.health}`).join(',');
  if (key === lastScoreboardKey) return;
  lastScoreboardKey = key;

  scoreboardRowsEl.innerHTML = tanks.map(t => {
    const name = t.nickname || `Player ${t.letter}`;
    const colour = `rgb(${t.colourR}, ${t.colourG}, ${t.colourB})`;
    const healthPct = clamp(t.health, 0, 100);
    return `
      <div class="scoreboard-player-row">
        <div class="scoreboard-player-row-top">
          <span class="player-name" style="color: ${colour}">${escapeHtml(name)}</span>
          <span class="player-score">${t.score}</span>
        </div>
        <div class="player-health-track">
          <div class="player-health-bar" style="width:${healthPct}%; background:${colour}"></div>
        </div>
      </div>`;
  }).join('');
}
