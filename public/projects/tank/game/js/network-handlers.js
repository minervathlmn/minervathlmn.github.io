function bindNetworkHandlers() {
  TankNetwork.onShotFired((payload) => {
    // Server broadcasts this the instant a tank fires. payload carries
    // the shot's start position/angle/power (see CosmeticProjectile's
    // constructor) plus shooterSessionId so we know whose tank fired.
    const state = TankNetwork.getState();
    const shooter = state.tanks.get(payload.shooterSessionId);
    const colour = shooter ? [shooter.colourR, shooter.colourG, shooter.colourB] : [0, 0, 0];
    // Falls back to black if, for some edge case (shooter disconnected
    // mid-event?), the tank isn't found in state anymore.
    activeShots.push(new CosmeticProjectile(payload, colour));
    // Adds a new animating shell to the array drawShots() iterates each frame.
  });

  TankNetwork.onTankExploded((payload) => {
    // Server broadcasts this on tank death (health hit 0, fell off map,
    // disconnect elimination) — no shell travel involved, so this jumps
    // straight to a blast animation using the server's own explosion coords.
    activeShots.push(new CosmeticExplosion(payload));
  });

  TankNetwork.onRestart(() => {
    activeShots = [];
    // If a new round starts while old shots/explosions are still
    // mid-animation, wipe them rather than let stale visuals bleed
    // into the new round.
  });
}
