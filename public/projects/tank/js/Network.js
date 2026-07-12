const client = new Colyseus.Client(
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "ws://localhost:2567"
    : "wss://tank-game-server-kj3p.onrender.com"
);

// Example: quick join
async function quickJoin() {
  try {
    const room = await client.joinOrCreate("tank_room", { isPrivate: false });
    console.log("Joined room:", room.id);
    return room;
  } catch (e) {
    console.error("Quick join failed:", e);
  }
}