(function () {
  "use strict";

  // ---------------------------------------------------------------
  // Colyseus client
  // ---------------------------------------------------------------
  const client = new Colyseus.Client(
    (location.hostname === "localhost" || location.hostname === "127.0.0.1")
      ? "ws://localhost:2567"
      : "wss://tank-game-server-kj3p.onrender.com"
  );

  let room = null;           // current joined room, if any
  let mySessionId = null;

  // ---------------------------------------------------------------
  // Lobby reconnection — separate sessionStorage namespace from the
  // tankRoomId/tankReconnectToken/tankSessionId keys game/index.html's
  // Network.js uses, so a lobby refresh and a game-page refresh never
  // clobber each other's saved session.
  // ---------------------------------------------------------------
  const LOBBY_ROOM_ID_KEY = "tankLobbyRoomId";
  const LOBBY_TOKEN_KEY = "tankLobbyToken";

  function saveLobbySession(joinedRoom) {
    sessionStorage.setItem(LOBBY_ROOM_ID_KEY, joinedRoom.roomId);
    sessionStorage.setItem(LOBBY_TOKEN_KEY, joinedRoom.reconnectionToken);
  }

  function clearLobbySession() {
    sessionStorage.removeItem(LOBBY_ROOM_ID_KEY);
    sessionStorage.removeItem(LOBBY_TOKEN_KEY);
  }

  // ---------------------------------------------------------------
  // Screen router — reflects current screen in the URL query string
  // ---------------------------------------------------------------
  const screens = ["menu", "join", "room"];

  function showScreen(name, extraParams) {
    screens.forEach((s) => {
      document.getElementById("screen-" + s).classList.toggle("active", s === name);
    });
    const params = new URLSearchParams(extraParams || {});
    params.set("screen", name);
    history.replaceState(null, "", "?" + params.toString());
  }

  // ---------------------------------------------------------------
  // Nickname handling (localStorage + modal)
  // ---------------------------------------------------------------
  const NICK_KEY = "tank-nickname";
  let pendingAction = null; // function to run once we have a nickname
  let sessionNickname = null; // nickname for THIS visit, whether saved or not

  function getSavedNickname() {
    return localStorage.getItem(NICK_KEY);
  }

  function updatePlayingAsRow() {
    const row = document.getElementById("playingAsRow");
    if (sessionNickname) {
      row.style.display = "block";
      document.getElementById("playingAsName").textContent = sessionNickname;
    } else {
      row.style.display = "none";
    }
  }

  function openNicknameModal() {
    const saved = getSavedNickname();
    const backdrop = document.getElementById("nicknameBackdrop");
    const returningView = document.getElementById("modalReturning");
    const entryView = document.getElementById("modalEntry");
    document.getElementById("nicknameError").textContent = "";

    if (saved && !sessionNickname) {
      returningView.style.display = "block";
      entryView.style.display = "none";
      document.getElementById("returningName").textContent = saved;
      document.getElementById("continueSavedName").textContent = saved;
    } else {
      returningView.style.display = "none";
      entryView.style.display = "block";
      document.getElementById("nicknameInput").value = sessionNickname || "";
    }
    backdrop.classList.add("open");

    if (entryView.style.display !== "none") {
      // Wait a tick for the backdrop to actually become visible/interactive
      // before focusing, otherwise some browsers ignore the focus() call.
      setTimeout(() => document.getElementById("nicknameInput").focus(), 0);
    }
  }

  function closeNicknameModal() {
    document.getElementById("nicknameBackdrop").classList.remove("open");
  }

  function requireNickname(action) {
    if (sessionNickname) { action(); return; }
    pendingAction = action;
    openNicknameModal();
  }

  document.getElementById("continueSavedBtn").addEventListener("click", () => {
    sessionNickname = getSavedNickname();
    updatePlayingAsRow();
    closeNicknameModal();
    if (pendingAction) { pendingAction(); pendingAction = null; }
  });

  document.getElementById("useDifferentBtn").addEventListener("click", () => {
    document.getElementById("modalReturning").style.display = "none";
    document.getElementById("modalEntry").style.display = "block";
    document.getElementById("nicknameInput").value = "";
    document.getElementById("nicknameInput").focus();
  });

  document.getElementById("confirmNicknameBtn").addEventListener("click", () => {
    const val = document.getElementById("nicknameInput").value.trim();
    if (!val) {
      document.getElementById("nicknameError").textContent = "Enter a nickname first.";
      return;
    }
    sessionNickname = val.slice(0, 16);
    if (document.getElementById("rememberMeCheckbox").checked) {
      localStorage.setItem(NICK_KEY, sessionNickname);
    } else {
      localStorage.removeItem(NICK_KEY);
    }
    updatePlayingAsRow();
    closeNicknameModal();
    if (pendingAction) { pendingAction(); pendingAction = null; }
  });

  document.getElementById("cancelNicknameBtn").addEventListener("click", () => {
    pendingAction = null;
    closeNicknameModal();
  });

  // Allow pressing Enter while focused on the nickname input to submit,
  // same as clicking Continue.
  document.getElementById("nicknameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("confirmNicknameBtn").click();
    }
  });

  document.getElementById("changeNameBtn").addEventListener("click", () => {
    sessionNickname = null;
    requireNickname(() => { }); // just reopens the picker; no action queued
  });

  // ---------------------------------------------------------------
  // Menu screen actions
  // ---------------------------------------------------------------
  document.getElementById("backToLandingBtn").addEventListener("click", () => {
    window.location.href = "../index-play.html";
  });

  document.getElementById("quickJoinBtn").addEventListener("click", () => {
    requireNickname(doQuickJoin);
  });

  document.getElementById("createLobbyBtn").addEventListener("click", () => {
    requireNickname(doCreateLobby);
  });

  document.getElementById("joinOthersBtn").addEventListener("click", () => {
    showScreen("join");
    refreshPublicRoomList();
    document.getElementById("codeInput").focus();
  });

  // ---------------------------------------------------------------
  // Quick Join
  // ---------------------------------------------------------------
  const QUICK_JOIN_MIN_DISPLAY_MS = 900; // keep the "searching" feel even on a fast/instant response

  async function doQuickJoin() {
    const overlay = document.getElementById("searchingOverlay");
    overlay.classList.add("open");
    const startedAt = Date.now();

    try {
      // Look up public, non-full rooms ourselves instead of relying on
      // joinOrCreate — joinOrCreate auto-creates a room when none match,
      // which means it can never actually "fail to find a game" the way
      // we want it to for showing the create-lobby prompt.
      const response = await client.http.get("/rooms/tank_room");
      const rooms = response.data || [];
      const openRooms = rooms.filter(
        (r) => r.metadata && r.metadata.isPrivate === false && r.clients < r.maxClients
      );

      if (openRooms.length === 0) {
        await waitOutMinDisplay(startedAt);
        overlay.classList.remove("open");
        showQuickJoinFailModal();
        return;
      }

      // Pick a random open lobby rather than always the first in the list,
      // so quick join doesn't pile everyone into the same one room.
      const pick = openRooms[Math.floor(Math.random() * openRooms.length)];
      const joined = await client.joinById(pick.roomId, { nickname: sessionNickname });

      await waitOutMinDisplay(startedAt);
      overlay.classList.remove("open");
      attachRoom(joined);
    } catch (err) {
      console.error("Quick join failed:", err);
      await waitOutMinDisplay(startedAt);
      overlay.classList.remove("open");
      showQuickJoinFailModal();
    }
  }

  // Pads out the overlay so it never flashes for less than
  // QUICK_JOIN_MIN_DISPLAY_MS, even if the server responded almost instantly.
  function waitOutMinDisplay(startedAt) {
    const elapsed = Date.now() - startedAt;
    const remaining = QUICK_JOIN_MIN_DISPLAY_MS - elapsed;
    return remaining > 0 ? new Promise((res) => setTimeout(res, remaining)) : Promise.resolve();
  }

  function showQuickJoinFailModal() {
    document.getElementById("quickJoinFailBackdrop").classList.add("open");
  }

  document.getElementById("quickJoinCreateBtn").addEventListener("click", () => {
    document.getElementById("quickJoinFailBackdrop").classList.remove("open");
    doCreateLobby();
  });

  document.getElementById("quickJoinCancelBtn").addEventListener("click", () => {
    document.getElementById("quickJoinFailBackdrop").classList.remove("open");
  });

  // ---------------------------------------------------------------
  // Create Lobby
  // ---------------------------------------------------------------
  async function doCreateLobby() {
    try {
      const created = await client.create("tank_room", {
        isPrivate: false,
        nickname: sessionNickname,
      });
      attachRoom(created);
    } catch (err) {
      console.error("Create lobby failed:", err);
      alert("Couldn't create a lobby right now. Please try again.");
    }
  }

  // ---------------------------------------------------------------
  // Join Others — tabs
  // ---------------------------------------------------------------
  document.getElementById("tabPrivateBtn").addEventListener("click", () => setJoinTab("private"));
  document.getElementById("tabPublicBtn").addEventListener("click", () => setJoinTab("public"));

  function setJoinTab(tab) {
    document.getElementById("tabPrivateBtn").classList.toggle("active", tab === "private");
    document.getElementById("tabPublicBtn").classList.toggle("active", tab === "public");
    document.getElementById("panel-private").classList.toggle("active", tab === "private");
    document.getElementById("panel-public").classList.toggle("active", tab === "public");
    if (tab === "public") refreshPublicRoomList();
    if (tab === "private") document.getElementById("codeInput").focus();
  }

  document.getElementById("joinBackBtn").addEventListener("click", () => showScreen("menu"));

  document.getElementById("joinQuickJoinBtn").addEventListener("click", () => {
    requireNickname(doQuickJoin);
  });

  // Code input: digits only
  document.getElementById("codeInput").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
  });

  document.getElementById("submitCodeBtn").addEventListener("click", () => {
    requireNickname(doJoinByCode);
  });

  // Allow pressing Enter while focused on the code input to submit, same as clicking Join
  document.getElementById("codeInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      requireNickname(doJoinByCode);
    }
  });

  async function doJoinByCode() {
    const code = document.getElementById("codeInput").value.trim();
    const errorEl = document.getElementById("codeError");
    errorEl.textContent = "";

    if (code.length !== 4) {
      errorEl.textContent = "Enter the 4-digit code.";
      return;
    }

    try {
      const response = await client.http.get("/rooms/tank_room");
      const rooms = response.data || [];
      const match = rooms.find((r) => r.metadata && r.metadata.code === code);
      if (!match) {
        errorEl.textContent = "No lobby found with that code.";
        return;
      }
      const joined = await client.joinById(match.roomId, {
        nickname: sessionNickname,
        code,
      });
      attachRoom(joined);
    } catch (err) {
      console.error("Join by code failed:", err);
      errorEl.textContent = "That lobby is no longer available.";
    }
  }

  // Public room list
  async function refreshPublicRoomList() {
    const listEl = document.getElementById("publicRoomList");
    const emptyEl = document.getElementById("publicListEmpty");
    listEl.innerHTML = "";

    let rooms = [];
    try {
      const response = await client.http.get("/rooms/tank_room");
      rooms = response.data || [];
    } catch (err) {
      console.error("Failed to fetch room list:", err);
      emptyEl.textContent = "Couldn't load public lobbies right now — try Quick Join instead.";
      emptyEl.style.display = "block";
      return;
    }

    const publicRooms = rooms.filter((r) => r.metadata && r.metadata.isPrivate === false);
    emptyEl.style.display = publicRooms.length === 0 ? "block" : "none";

    publicRooms.forEach((r) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      const owner = (r.metadata && r.metadata.ownerNickname) || "Someone";
      const count = (r.metadata && r.metadata.playerCount) || 0;
      btn.textContent = owner + "'s Lobby  (" + count + "/4)";
      btn.addEventListener("click", () => {
        requireNickname(() => doJoinPublicRoom(r.roomId));
      });
      li.appendChild(btn);
      listEl.appendChild(li);
    });
  }

  async function doJoinPublicRoom(roomId) {
    try {
      const joined = await client.joinById(roomId, { nickname: sessionNickname });
      attachRoom(joined);
    } catch (err) {
      console.error("Join failed:", err);
      alert("That lobby just filled up or closed. Pick another.");
      refreshPublicRoomList();
    }
  }

  // ---------------------------------------------------------------
  // Room screen — shared by Create Lobby, Quick Join, and Join Others
  // ---------------------------------------------------------------
  function attachRoom(joinedRoom) {
    room = joinedRoom;
    mySessionId = room.sessionId;
    saveLobbySession(joinedRoom);

    // Every callback below is guarded with `room !== joinedRoom`. Closing a
    // lobby (or being kicked, or leaving) doesn't tear down the Colyseus
    // connection instantly — the "lobbyClosed"/"kicked" message and the
    // eventual onLeave for THIS room object can still be in flight after
    // the player has already dismissed the alert and created/joined a
    // different lobby, which reassigns the shared `room`/`mySessionId`
    // variables to the new room. Without this guard, that late-arriving
    // event calls cleanupRoom() and nulls out `room` out from under the
    // *new* lobby — which is exactly what broke "close lobby, create
    // again" (private code, Start, etc. all silently stopped working
    // because every handler's `if (room) ...` check started failing).
    room.onStateChange(() => {
      if (room !== joinedRoom) return;
      renderRoom();
    });

    room.onMessage("gameStart", (payload) => {
      if (room !== joinedRoom) return;
      clearLobbySession(); // handing off to game/index.html's own reconnect flow below
      sessionStorage.setItem("tankRoomId", room.roomId);
      sessionStorage.setItem("tankReconnectToken", room.reconnectionToken);
      sessionStorage.setItem("tankSessionId", mySessionId);
      sessionStorage.setItem("tankSeed", String(payload.seed));
      window.location.href = "../game/index-game.html";
    });

    room.onMessage("startFailed", (payload) => {
      if (room !== joinedRoom) return;
      alert(payload?.reason || "Couldn't start the game. Please try again.");
    });

    room.onMessage("lobbyClosed", () => {
      if (room !== joinedRoom) return;
      alert("The host closed this lobby.");
      cleanupRoom();
      clearLobbySession();
      showScreen("menu");
    });

    room.onMessage("kicked", () => {
      if (room !== joinedRoom) return;
      alert("You were removed from the lobby by the host.");
      cleanupRoom();
      clearLobbySession();
      showScreen("menu");
    });

    room.onLeave(() => {
      if (room !== joinedRoom) return;
      cleanupRoom();
    });

    showScreen("room");
    renderRoom();
  }

  function cleanupRoom() {
    room = null;
    mySessionId = null;
  }

  function renderRoom() {
    // room.state itself is assigned as soon as join() resolves, but its
    // sub-fields (like players, a MapSchema) can arrive a moment later
    // as the first state sync completes. Bail out safely until then —
    // onStateChange will re-fire renderRoom the instant it's ready.
    if (!room || !room.state || !room.state.players) return;
    const state = room.state;
    const me = state.players.get(mySessionId);
    const isOwner = !!(me && me.isOwner);

    // Player list
    const listEl = document.getElementById("playerList");
    listEl.innerHTML = "";
    state.players.forEach((player, sessionId) => {
      const li = document.createElement("li");
      li.classList.toggle("is-you", sessionId === mySessionId);

      const nameSpan = document.createElement("span");
      nameSpan.textContent = player.nickname;
      li.appendChild(nameSpan);
      if (!player.connected) {
        const tag = document.createElement("span");
        tag.className = "reconnecting-tag";
        tag.textContent = "Reconnecting…";
        li.appendChild(tag);
      }
      if (player.isOwner) {
        const tag = document.createElement("span");
        tag.className = "owner-tag";
        tag.textContent = "Owner";
        li.appendChild(tag);
      } else if (isOwner) {
        const kickBtn = document.createElement("button");
        kickBtn.className = "btn-kick";
        kickBtn.textContent = "Kick";
        kickBtn.addEventListener("click", () => {
          if (room) room.send("kickPlayer", { sessionId });
        });
        li.appendChild(kickBtn);
      }
      listEl.appendChild(li);
    });

    // Owner vs guest controls
    document.getElementById("ownerCloseBtn").style.display = isOwner ? "inline-block" : "none";
    document.getElementById("guestLeaveBtn").style.display = isOwner ? "none" : "inline-block";
    document.getElementById("startBtn").style.display = isOwner ? "inline-block" : "none";
    document.getElementById("waitingNote").style.display = isOwner ? "none" : "block";

    const enoughPlayers = state.players.size >= 2;
    document.getElementById("startBtn").disabled = !enoughPlayers;

    // Visibility toggle — single button, label + style reflect current state.
    // Owner can change it; guests see it as a static, disabled state.
    const visBtn = document.getElementById("visibilityToggleBtn");
    visBtn.textContent = state.isPrivate ? "Private" : "Public";
    visBtn.classList.toggle("is-private", state.isPrivate);
    visBtn.disabled = !isOwner;

    const codeDisplay = document.getElementById("codeDisplay");
    if (state.isPrivate && state.code) {
      codeDisplay.style.display = "flex";
      const digitsEl = document.getElementById("codeDigits");
      digitsEl.innerHTML = "";
      state.code.split("").forEach((d) => {
        const span = document.createElement("span");
        span.className = "digit";
        span.textContent = d;
        digitsEl.appendChild(span);
      });
    } else {
      codeDisplay.style.display = "none";
    }
  }

  document.getElementById("visibilityToggleBtn").addEventListener("click", () => {
    if (!room) return;
    room.send("setVisibility", { isPrivate: !room.state.isPrivate });
  });

  document.getElementById("ownerCloseBtn").addEventListener("click", () => {
    if (room) room.send("closeLobby");
  });

  document.getElementById("guestLeaveBtn").addEventListener("click", () => {
    if (room) {
      room.send("leaveLobby");
      room.leave();
    }
    cleanupRoom();
    clearLobbySession();
    showScreen("menu");
  });

  document.getElementById("roomBackBtn").addEventListener("click", () => {
    if (room) {
      room.send("leaveLobby");
      room.leave();
    }
    cleanupRoom();
    clearLobbySession();
    showScreen("menu");
  });

  document.getElementById("startBtn").addEventListener("click", () => {
    if (room) room.send("start");
  });

  // Allow the room owner to press Enter to start the game, as a
  // keyboard-accessible alternative to clicking the Start button.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const startBtn = document.getElementById("startBtn");
    const isVisible = startBtn.style.display !== "none";
    const isEnabled = !startBtn.disabled;

    if (isVisible && isEnabled) {
      startBtn.click();
    }
  });

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  // Restore a saved nickname on load so "Playing as X (not you?)" survives
  // a refresh instead of only appearing after going through the modal.
  sessionNickname = getSavedNickname();
  updatePlayingAsRow();

  async function init() {
    const lobbyRoomId = sessionStorage.getItem(LOBBY_ROOM_ID_KEY);
    const lobbyToken = sessionStorage.getItem(LOBBY_TOKEN_KEY);

    // A refresh (or flaky-connection drop) while in the room screen: try
    // to silently rejoin the same lobby before showing anything else. This
    // is the client half of the server's lobby reconnection grace — the
    // token only matters if the server side is still holding the seat.
    if (lobbyRoomId && lobbyToken) {
      try {
        const rejoined = await client.reconnect(lobbyToken);
        attachRoom(rejoined);
        return;
      } catch (err) {
        console.warn("Lobby reconnect failed or expired — starting fresh.", err);
        clearLobbySession();
      }
    }

    showScreen("menu");
  }

  init();

  // The lobby-reconnect attempt above only runs once, at initial script
  // execution — it does NOT run again when the browser restores this page
  // from bfcache (back-forward cache), which is exactly what happens when
  // pressing Back from game/index.html (showScreen() uses replaceState, so
  // there's no separate history entry per screen; Back navigates straight
  // to whatever this page's DOM/JS state was the moment we left for
  // game/index.html — still showing screen-room, with `room` pointing at a
  // connection that's long gone). Without this, that's the exact "broken
  // page with only Public and Back" ghost-room bug. We treat it as an
  // intentional leave (send "leaveLobby" before room.leave()) rather than
  // letting the server wait out a reconnection grace it'll never use.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    if (room) {
      try { room.send("leaveLobby"); } catch (e) { /* already gone */ }
      try { room.leave(); } catch (e) { /* already gone, nothing to clean up */ }
    }
    cleanupRoom();
    clearLobbySession();
    showScreen("menu");
  });
})();