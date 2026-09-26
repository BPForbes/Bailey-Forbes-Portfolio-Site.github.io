import {
  acceptsGuestReady,
  GUEST_ORDER,
  GUESTS,
  isGuestId,
  isLiveGuest
} from "./apps.js";
import { icon } from "./icons.js";
const ATTACH_TIMEOUT_MS = 12e3;
function isExpanded(shell) {
  return document.fullscreenElement === shell || shell.classList.contains("is-overlay");
}
function mountGuestWindows() {
  document.querySelectorAll("[data-guest-window]").forEach((mount) => {
    createGuestWindow(mount);
  });
}
function createGuestWindow(mount) {
  const requested = mount.getAttribute("data-guest") ?? "qpu";
  const initialId = isGuestId(requested) ? requested : "qpu";
  let currentId = initialId;
  let attachTimer = 0;
  let guestReady = false;
  let frameLoaded = false;
  const shell = document.createElement("article");
  shell.className = "guest-window";
  shell.innerHTML = `
    <header class="guest-titlebar">
      <div class="guest-heading">
        <h3 class="guest-title" data-guest-title>QPU</h3>
        <p class="guest-subtitle" data-guest-subtitle>Circuit workbench</p>
      </div>
      <p class="guest-status" data-guest-status data-tone="wait" role="status">Connecting\u2026</p>
      <div class="guest-title-actions">
        <button type="button" class="guest-btn" data-guest-retry hidden>${icon("rotate-right")}Reload the lab</button>
        <button type="button" class="guest-btn" data-guest-fullscreen>${icon("expand")}Fullscreen</button>
        <button type="button" class="guest-btn" data-guest-restore hidden>${icon("compress")}Exit fullscreen</button>
        <button type="button" class="guest-btn" data-guest-min>${icon("compress")}Minimize</button>
      </div>
    </header>
    <nav class="guest-dock" data-guest-dock aria-label="Choose a lab"></nav>
    <div class="guest-stage" data-guest-stage>
      <iframe
        class="guest-frame"
        data-guest-frame
        title="QPU workbench"
        allow="fullscreen; clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
        hidden
      ></iframe>
      <div class="guest-panel guest-offline" data-guest-offline hidden>
        <p class="eyebrow">Not attached</p>
        <h3 data-guest-offline-title>Nothing to run here yet</h3>
        <p data-guest-offline-note></p>
        <div class="guest-panel-actions">
          <a class="btn btn-ghost" data-guest-offline-repo href="#">${icon("github")}<span data-guest-offline-repo-text>Repository</span></a>
        </div>
      </div>
      <div class="guest-panel guest-error" data-guest-error hidden>
        <p class="eyebrow">Could not attach</p>
        <h3 data-guest-error-title>The lab did not respond</h3>
        <p data-guest-error-note></p>
        <div class="guest-panel-actions">
          <button type="button" class="btn btn-primary" data-guest-error-retry>${icon("play")}Try attaching again</button>
          <a class="btn btn-ghost" data-guest-error-open href="#" target="_blank" rel="noopener">
            ${icon("arrow-up-right-from-square")}<span data-guest-error-open-text>Open the lab in a new tab</span>
          </a>
        </div>
      </div>
      <div class="guest-panel guest-boot" data-guest-boot hidden>
        <p class="eyebrow">Attaching</p>
        <p data-guest-boot-text>Connecting\u2026</p>
      </div>
    </div>
    <div class="guest-restore-bar" data-guest-restore-bar hidden>
      <span data-guest-restore-text>The lab is minimized.</span>
      <button type="button" class="guest-btn" data-guest-show>${icon("expand")}Show the lab</button>
    </div>
  `;
  mount.replaceChildren(shell);
  const titleEl = mustQuery(shell, "[data-guest-title]");
  const subtitleEl = mustQuery(shell, "[data-guest-subtitle]");
  const statusEl = mustQuery(shell, "[data-guest-status]");
  const dockEl = mustQuery(shell, "[data-guest-dock]");
  const stageEl = mustQuery(shell, "[data-guest-stage]");
  const iframe = mustQuery(shell, "[data-guest-frame]", HTMLIFrameElement);
  const offlineEl = mustQuery(shell, "[data-guest-offline]");
  const offlineTitleEl = mustQuery(shell, "[data-guest-offline-title]");
  const offlineNoteEl = mustQuery(shell, "[data-guest-offline-note]");
  const offlineRepoEl = mustQuery(shell, "[data-guest-offline-repo]", HTMLAnchorElement);
  const offlineRepoTextEl = mustQuery(shell, "[data-guest-offline-repo-text]");
  const errorEl = mustQuery(shell, "[data-guest-error]");
  const errorTitleEl = mustQuery(shell, "[data-guest-error-title]");
  const errorNoteEl = mustQuery(shell, "[data-guest-error-note]");
  const errorRetryEl = mustQuery(shell, "[data-guest-error-retry]", HTMLButtonElement);
  const errorOpenEl = mustQuery(shell, "[data-guest-error-open]", HTMLAnchorElement);
  const errorOpenTextEl = mustQuery(shell, "[data-guest-error-open-text]");
  const bootEl = mustQuery(shell, "[data-guest-boot]");
  const bootTextEl = mustQuery(shell, "[data-guest-boot-text]");
  const retryBtn = mustQuery(shell, "[data-guest-retry]", HTMLButtonElement);
  const fullscreenBtn = mustQuery(shell, "[data-guest-fullscreen]", HTMLButtonElement);
  const restoreBtn = mustQuery(shell, "[data-guest-restore]", HTMLButtonElement);
  const minBtn = mustQuery(shell, "[data-guest-min]", HTMLButtonElement);
  const restoreBar = mustQuery(shell, "[data-guest-restore-bar]");
  const restoreText = mustQuery(shell, "[data-guest-restore-text]");
  const showBtn = mustQuery(shell, "[data-guest-show]", HTMLButtonElement);
  const dockButtons = /* @__PURE__ */ new Map();
  const solo = mount.hasAttribute("data-guest-solo");
  shell.setAttribute("aria-label", `${GUESTS[initialId].name} live lab`);
  if (solo) {
    dockEl.hidden = true;
  } else {
    for (const id of GUEST_ORDER) {
      const guest = GUESTS[id];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "guest-dock-btn";
      button.dataset.guestId = id;
      button.setAttribute("aria-pressed", "false");
      const name = document.createElement("span");
      name.textContent = guest.name;
      button.appendChild(name);
      if (isLiveGuest(guest)) {
        const live = document.createElement("span");
        live.className = "guest-live-dot";
        live.setAttribute("aria-hidden", "true");
        button.appendChild(live);
        const runnable = document.createElement("span");
        runnable.className = "visually-hidden";
        runnable.textContent = " (runnable)";
        button.appendChild(runnable);
      }
      button.addEventListener("click", () => {
        setGuest(id);
      });
      dockEl.appendChild(button);
      dockButtons.set(id, button);
    }
  }
  const STATUS_ICON = {
    live: "circle-check",
    wait: "circle-notch",
    error: "circle-exclamation",
    off: "circle-notch"
  };
  function setStatus(text, tone) {
    statusEl.innerHTML = `${icon(STATUS_ICON[tone])}<span>${text}</span>`;
    statusEl.dataset.tone = tone;
  }
  function rememberSlot() {
    const height = Math.round(shell.getBoundingClientRect().height);
    if (height > 0) {
      mount.style.minHeight = `${height}px`;
    }
  }
  function forgetSlot() {
    if (!isExpanded(shell) && !shell.classList.contains("is-minimized")) {
      mount.style.minHeight = "";
    }
  }
  function syncChrome() {
    const expanded = isExpanded(shell);
    fullscreenBtn.hidden = expanded;
    restoreBtn.hidden = !expanded;
    shell.classList.toggle("is-expanded", expanded);
    document.body.classList.toggle("guest-overlay-open", shell.classList.contains("is-overlay"));
  }
  async function enterExpanded() {
    showStage();
    rememberSlot();
    if (document.fullscreenElement === shell) {
      syncChrome();
      return;
    }
    try {
      await shell.requestFullscreen();
    } catch {
      shell.classList.add("is-overlay");
    }
    syncChrome();
  }
  async function exitExpanded() {
    if (document.fullscreenElement === shell) {
      try {
        await document.exitFullscreen();
      } catch {
      }
    }
    shell.classList.remove("is-overlay");
    syncChrome();
    forgetSlot();
  }
  function clearAttachTimer() {
    window.clearTimeout(attachTimer);
    attachTimer = 0;
  }
  function failAttach(guest) {
    clearAttachTimer();
    bootEl.hidden = true;
    iframe.hidden = true;
    errorTitleEl.textContent = `${guest.name} did not respond`;
    errorNoteEl.textContent = frameLoaded ? `${guest.name} responded but never completed its handshake, so this page cannot tell whether it is running. It may have failed to load inside the frame, or your browser may be blocking it. Opening it on its own origin is the reliable check.` : `${guest.name} is served from ${guest.origin} and did not respond within ${Math.round(ATTACH_TIMEOUT_MS / 1e3)} seconds. It may be offline, or your browser may be blocking the embedded frame.`;
    errorOpenEl.href = guest.src;
    errorOpenTextEl.textContent = `Open ${guest.name} in a new tab`;
    errorEl.hidden = false;
    retryBtn.hidden = false;
    setStatus("Could not attach", "error");
  }
  function attachLive(guest) {
    guestReady = false;
    frameLoaded = false;
    offlineEl.hidden = true;
    errorEl.hidden = true;
    retryBtn.hidden = true;
    iframe.hidden = false;
    iframe.title = `${guest.name} \u2014 ${guest.subtitle}`;
    iframe.setAttribute("allow", guest.iframeAllow);
    iframe.referrerPolicy = guest.id === "flinstone" ? "strict-origin" : "strict-origin-when-cross-origin";
    bootTextEl.textContent = `Attaching ${guest.name} from ${guest.origin}\u2026`;
    bootEl.hidden = false;
    setStatus("Connecting\u2026", "wait");
    clearAttachTimer();
    attachTimer = window.setTimeout(() => {
      failAttach(guest);
    }, ATTACH_TIMEOUT_MS);
    iframe.src = guest.src;
  }
  function detachLive() {
    guestReady = false;
    frameLoaded = false;
    clearAttachTimer();
    bootEl.hidden = true;
    errorEl.hidden = true;
    retryBtn.hidden = true;
    iframe.src = "about:blank";
    iframe.hidden = true;
  }
  function showOffline(guest) {
    if (isLiveGuest(guest)) {
      return;
    }
    detachLive();
    offlineTitleEl.textContent = `${guest.name} has no web build`;
    offlineNoteEl.textContent = guest.note;
    offlineRepoEl.href = guest.repo;
    offlineRepoTextEl.textContent = `Open the ${guest.name} repository`;
    offlineEl.hidden = false;
    setStatus("Not attached", "off");
  }
  function showStage() {
    shell.classList.remove("is-minimized");
    stageEl.hidden = false;
    restoreBar.hidden = true;
    refreshStatus();
  }
  function minimize() {
    shell.classList.add("is-minimized");
    stageEl.hidden = true;
    restoreText.textContent = `${GUESTS[currentId].name} is minimized. It keeps running in the background.`;
    restoreBar.hidden = false;
    setStatus("Minimized", "off");
  }
  function refreshStatus() {
    const guest = GUESTS[currentId];
    if (!isLiveGuest(guest)) {
      setStatus("Not attached", "off");
      return;
    }
    if (!errorEl.hidden) {
      setStatus("Could not attach", "error");
      return;
    }
    if (guestReady) {
      setStatus("Attached \xB7 live", "live");
      return;
    }
    setStatus(frameLoaded ? "Loaded \xB7 no handshake" : "Connecting\u2026", "wait");
  }
  function setGuest(id, force = false) {
    const guest = GUESTS[id];
    const alreadyShowing = currentId === id && !force;
    showStage();
    titleEl.textContent = guest.name;
    subtitleEl.textContent = guest.subtitle;
    shell.dataset.guest = id;
    shell.setAttribute("aria-label", `${guest.name} live lab`);
    for (const [dockId, button] of dockButtons) {
      button.setAttribute("aria-pressed", String(dockId === id));
    }
    if (alreadyShowing && isLiveGuest(guest) && !iframe.hidden) {
      refreshStatus();
      return;
    }
    if (alreadyShowing && !isLiveGuest(guest) && !offlineEl.hidden) {
      refreshStatus();
      return;
    }
    const switchingAwayFromLive = currentId !== id && isLiveGuest(GUESTS[currentId]);
    currentId = id;
    if (switchingAwayFromLive || !isLiveGuest(guest)) {
      detachLive();
    }
    if (isLiveGuest(guest)) {
      attachLive(guest);
      return;
    }
    showOffline(guest);
  }
  function retry() {
    const guest = GUESTS[currentId];
    if (!isLiveGuest(guest)) {
      return;
    }
    showStage();
    detachLive();
    attachLive(guest);
  }
  iframe.addEventListener("load", () => {
    if (iframe.src === "about:blank" || iframe.hidden) {
      return;
    }
    frameLoaded = true;
    if (!guestReady && errorEl.hidden) {
      bootTextEl.textContent = `${GUESTS[currentId].name} loaded. Waiting for its handshake\u2026`;
      refreshStatus();
    }
  });
  window.addEventListener("message", (event) => {
    const guest = GUESTS[currentId];
    if (!isLiveGuest(guest) || iframe.hidden) {
      return;
    }
    if (!acceptsGuestReady(guest, event, iframe.contentWindow)) {
      return;
    }
    guestReady = true;
    clearAttachTimer();
    bootEl.hidden = true;
    errorEl.hidden = true;
    retryBtn.hidden = true;
    setStatus("Attached \xB7 live", "live");
  });
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement !== shell) {
      shell.classList.remove("is-overlay");
    }
    syncChrome();
    if (!isExpanded(shell)) {
      forgetSlot();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    if (shell.classList.contains("is-overlay")) {
      event.preventDefault();
      void exitExpanded();
    }
  });
  fullscreenBtn.addEventListener("click", () => {
    void enterExpanded();
  });
  restoreBtn.addEventListener("click", () => {
    void exitExpanded();
  });
  minBtn.addEventListener("click", () => {
    void exitExpanded().then(() => {
      minimize();
      showBtn.focus();
    });
  });
  showBtn.addEventListener("click", () => {
    showStage();
    minBtn.focus();
  });
  retryBtn.addEventListener("click", retry);
  errorRetryEl.addEventListener("click", retry);
  setGuest(initialId, true);
  syncChrome();
}
function mustQuery(root, selector, ctor) {
  const node = root.querySelector(selector);
  if (!(node instanceof (ctor ?? HTMLElement))) {
    throw new Error(`Live lab chrome missing ${selector}`);
  }
  return node;
}
export {
  mountGuestWindows
};
