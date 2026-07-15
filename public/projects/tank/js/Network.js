/**
 * Loaded only on the GAME page (game/index.html). Reconnects to the
 * Colyseus room already joined in the lobby, using the token play page
 * saved to sessionStorage.
 *
 * Server-authoritative model: this no longer relays or applies gameplay
 * actions. sketch.js reads room.state directly (via getState()) every
 * frame for rendering — Colyseus schema objects are live/reactive, so
 * there's no need for a separate onStateChange snapshot. The only event
 * still needed is "shotFired", since the server doesn't sync a shot's
 * flight/landing moment-by-moment — see CosmeticProjectile.js.
 */
const TankNetwork = (function () {
  const client = new Colyseus.Client(
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      ? "ws://localhost:2567"
      : "wss://tank-game-server-kj3p.onrender.com"
  );

  let room = null;
  let mySessionId = null;
  let onShotFiredCallback = null;
  let onTankExplodedCallback = null;
  let onRestartCallback = null;

  let readyResolve;
  const ready = new Promise((res) => { readyResolve = res; });

  async function init() {
    const roomId = sessionStorage.getItem("tankRoomId");
    const token = sessionStorage.getItem("tankReconnectToken");
    mySessionId = sessionStorage.getItem("tankSessionId");

    if (!roomId || !token) {
      console.error("No lobby session found — returning to menu.");
      window.location.href = "../play/index.html";
      return;
    }

    try {
      room = await client.reconnect(token);
    } catch (err) {
      console.error("Reconnect to game room failed:", err);
      window.location.href = "../play/index.html";
      return;
    }

    room.onMessage("shotFired", (payload) => {
      if (onShotFiredCallback) onShotFiredCallback(payload);
    });

    room.onMessage("tankExploded", (payload) => {
      if (onTankExplodedCallback) onTankExplodedCallback(payload);
    });

    room.onMessage("restart", () => {
      if (onRestartCallback) onRestartCallback();
    });

    // reconnect() resolving only means the handshake succeeded — it does
    // NOT guarantee the first full state patch has arrived yet. Without
    // this wait, sketch.js's setup() could run while room.state.tanks is
    // still empty and crash on state.tanks.get(mySessionId).
    if (!room.state || !room.state.tanks || room.state.tanks.size === 0) {
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.error("Timed out waiting for initial game state.");
          resolve(); // let setup() proceed anyway rather than hang forever
        }, 8000);

        room.onStateChange(() => {
          if (room.state && room.state.tanks && room.state.tanks.size > 0) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    readyResolve();
  }

  init();

  return {
    ready,
    getState: () => room?.state,
    getMySessionId: () => mySessionId,
    isMyTurn: () => !!room && !!room.state && mySessionId === room.state.currentTurnSessionId,
    sendAction: (type, extra) => { if (room) room.send("action", Object.assign({ type }, extra)); },
    sendRestart: () => { if (room) room.send("restart"); },
    onShotFired: (cb) => { onShotFiredCallback = cb; },
    onTankExploded: (cb) => { onTankExplodedCallback = cb; },
    onRestart: (cb) => { onRestartCallback = cb; },
  };
})();
