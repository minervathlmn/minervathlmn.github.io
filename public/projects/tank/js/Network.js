/**
 * Loaded only on the GAME page (game/index.html). Reconnects to the
 * Colyseus room already joined in the lobby, using the token play page
 * saved to sessionStorage, then exposes a small API sketch.js uses to
 * send turn-gated input and receive input relayed from the active player.
 */
const TankNetwork = (function () {
  const client = new Colyseus.Client(
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      ? "ws://localhost:2567"
      : "wss://tank-game-server-kj3p.onrender.com"
  );

  let room = null;
  let mySessionId = null;
  let turnOrder = [];        // sessionIds, fixed at game start, owner first = "A"
  let currentTurnSessionId = null;
  let seed = 1;
  let onActionCallback = null;
  let onRestartCallback = null;

  let readyResolve;
  const ready = new Promise((res) => { readyResolve = res; });

  async function init() {
    const roomId = sessionStorage.getItem("tankRoomId");
    const token = sessionStorage.getItem("tankReconnectToken");
    mySessionId = sessionStorage.getItem("tankSessionId");
    turnOrder = JSON.parse(sessionStorage.getItem("tankTurnOrder") || "[]");
    seed = Number(sessionStorage.getItem("tankSeed")) || 1;
    currentTurnSessionId = turnOrder[0] || null;

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

    room.onMessage("action", (payload) => {
      if (onActionCallback) onActionCallback(payload.type);
    });

    room.onMessage("restart", () => {
      if (onRestartCallback) onRestartCallback();
    });

    room.onStateChange((state) => {
      if (state.currentTurnSessionId) currentTurnSessionId = state.currentTurnSessionId;
    });

    readyResolve();
  }

  init();

  return {
    ready,
    getSeed: () => seed,
    getTurnOrder: () => turnOrder,
    getMyLetterIndex: () => turnOrder.indexOf(mySessionId),
    isMyTurn: () => mySessionId !== null && mySessionId === currentTurnSessionId,
    sendAction: (type, extra) => { if (room) room.send("action", Object.assign({ type }, extra)); },
    sendRestart: () => { if (room) room.send("restart"); },
    onAction: (cb) => { onActionCallback = cb; },
    onRestart: (cb) => { onRestartCallback = cb; },
  };
})();