function mousePressed() {
  if (hud.handleClick(mouseX, mouseY)) return;

  const state = TankNetwork.getState();
  if (!state || !state.gameEnded) return;

  const { bx, by, bw, bh } = restartButtonBounds();
  if (mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh) {
    TankNetwork.sendRestart();
  }
}

function keyPressed() {
  const state = TankNetwork.getState();
  if (!state || isLevelOver(state) || !TankNetwork.isMyTurn()) return;

  const myTank = state.tanks.get(mySessionId);
  if (!myTank || myTank.falling) return;

  if (keyCode === UP_ARROW) TankNetwork.sendAction("rotateLeft");
  else if (keyCode === DOWN_ARROW) TankNetwork.sendAction("rotateRight");

  if (keyCode === LEFT_ARROW) TankNetwork.sendAction("moveLeft");
  else if (keyCode === RIGHT_ARROW) TankNetwork.sendAction("moveRight");

  if (key === 'w' || key === 'W') TankNetwork.sendAction("morePower");
  else if (key === 's' || key === 'S') TankNetwork.sendAction("lessPower");

  return false;
}

function keyReleased() {
  const state = TankNetwork.getState();
  if (!state) return;

  if (isLevelOver(state)) {
    if (key === 'r' || key === 'R') TankNetwork.sendRestart();
    return;
  }

  if (!TankNetwork.isMyTurn()) return;

  const myTank = state.tanks.get(mySessionId);
  if (!myTank || myTank.falling) return;

  const movementKeys = [UP_ARROW, DOWN_ARROW, LEFT_ARROW, RIGHT_ARROW];
  if (movementKeys.includes(keyCode) || 'wWsS'.includes(key)) {
    TankNetwork.sendAction("stopAdjustment");
  }

  if (keyCode === 32) { // space: fire and pass turn
    TankNetwork.sendAction("fire");
  }

  if (key === 'r' || key === 'R') TankNetwork.sendAction("repair");
  if (key === 'f' || key === 'F') TankNetwork.sendAction("addFuel");
  if (key === 'p' || key === 'P') TankNetwork.sendAction("addParachute");
  if (key === 'x' || key === 'X') TankNetwork.sendAction("xtra");

  return false;
}
