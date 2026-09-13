import {
  GUEST_ORDER,
  GUESTS,
  isGuestId,
  isGuestReadyMessage,
  isLiveGuest,
  qpuGuestOrigin,
} from "./apps.js";
import type { GuestApp, GuestId, LiveGuest } from "./apps.js";

const BOOT_FALLBACK_MS = 8000;

type StatusTone = "live" | "wait" | "off";

interface GuestController {
  setGuest: (id: GuestId) => void;
  enterExpanded: () => Promise<void>;
  exitExpanded: () => Promise<void>;
}

const controllers: GuestController[] = [];

function isExpanded(shell: HTMLElement): boolean {
  return document.fullscreenElement === shell || shell.classList.contains("is-overlay");
}

export function mountGuestWindows(): void {
  document.querySelectorAll<HTMLElement>("[data-guest-window]").forEach((mount) => {
    controllers.push(createGuestWindow(mount));
  });

  document.querySelectorAll<HTMLElement>("[data-guest-launch]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const id = trigger.getAttribute("data-guest-launch") ?? "";
      if (isGuestId(id)) {
        void launchGuest(id);
      }
    });
  });
}

export async function launchGuest(id: GuestId): Promise<void> {
  const target = controllers[0];
  if (target === undefined) {
    return;
  }

  target.setGuest(id);
  await target.enterExpanded();
}

function createGuestWindow(mount: HTMLElement): GuestController {
  const requested = mount.getAttribute("data-guest") ?? "qpu";
  const initialId: GuestId = isGuestId(requested) ? requested : "qpu";
  let currentId: GuestId = initialId;
  let bootTimer = 0;
  let guestReady = false;

  const shell = document.createElement("article");
  shell.className = "guest-window";
  shell.setAttribute("aria-label", "Live lab");
  shell.innerHTML = `
    <header class="guest-titlebar">
      <div class="guest-traffic" role="group" aria-label="Window controls">
        <button type="button" class="guest-light guest-light-close" data-guest-close aria-label="Close"></button>
        <button type="button" class="guest-light guest-light-min" data-guest-min aria-label="Minimize"></button>
        <button type="button" class="guest-light guest-light-max" data-guest-max aria-label="Fullscreen"></button>
      </div>
      <div class="guest-heading">
        <p class="guest-title" data-guest-title>QPU</p>
        <p class="guest-subtitle" data-guest-subtitle>Circuit workbench</p>
      </div>
      <div class="guest-title-actions">
        <button type="button" class="guest-btn" data-guest-fullscreen>Fullscreen</button>
        <button type="button" class="guest-btn" data-guest-restore hidden>Window</button>
      </div>
      <p class="guest-status" data-guest-status data-tone="wait" aria-live="polite">Connecting…</p>
    </header>
    <nav class="guest-dock" data-guest-dock aria-label="Lab guests"></nav>
    <div class="guest-stage" data-guest-stage>
      <iframe
        class="guest-frame"
        data-guest-frame
        title="QPU workbench"
        allow="fullscreen; clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin"
        hidden
      ></iframe>
      <div class="guest-offline" data-guest-offline hidden>
        <p class="eyebrow">Offline</p>
        <h3>Not attached</h3>
        <p data-guest-offline-note></p>
        <a class="btn btn-ghost" data-guest-offline-repo href="#">Repository</a>
      </div>
      <div class="guest-boot" data-guest-boot hidden>
        <p class="eyebrow">Guest</p>
        <p>Attaching QPU…</p>
      </div>
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
  const offlineNoteEl = mustQuery(shell, "[data-guest-offline-note]");
  const offlineRepoEl = mustQuery(shell, "[data-guest-offline-repo]", HTMLAnchorElement);
  const bootEl = mustQuery(shell, "[data-guest-boot]");
  const fullscreenBtn = mustQuery(shell, "[data-guest-fullscreen]", HTMLButtonElement);
  const restoreBtn = mustQuery(shell, "[data-guest-restore]", HTMLButtonElement);
  const closeBtn = mustQuery(shell, "[data-guest-close]", HTMLButtonElement);
  const minBtn = mustQuery(shell, "[data-guest-min]", HTMLButtonElement);
  const maxBtn = mustQuery(shell, "[data-guest-max]", HTMLButtonElement);

  const dockButtons = new Map<GuestId, HTMLButtonElement>();
  const solo = mount.hasAttribute("data-guest-solo");

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
      }

      button.addEventListener("click", () => {
        setGuest(id);
      });

      dockEl.appendChild(button);
      dockButtons.set(id, button);
    }
  }

  function setStatus(text: string, tone: StatusTone): void {
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
  }

  function rememberSlot(): void {
    const height = Math.round(shell.getBoundingClientRect().height);
    if (height > 0) {
      mount.style.minHeight = `${height}px`;
    }
  }

  function forgetSlot(): void {
    if (!isExpanded(shell) && !shell.classList.contains("is-minimized")) {
      mount.style.minHeight = "";
    }
  }

  function syncChrome(): void {
    const expanded = isExpanded(shell);
    fullscreenBtn.hidden = expanded;
    restoreBtn.hidden = !expanded;
    shell.classList.toggle("is-expanded", expanded);
    document.body.classList.toggle("guest-overlay-open", shell.classList.contains("is-overlay"));
  }

  async function enterExpanded(): Promise<void> {
    shell.classList.remove("is-minimized");
    stageEl.hidden = false;
    refreshStatus();
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

  async function exitExpanded(): Promise<void> {
    if (document.fullscreenElement === shell) {
      try {
        await document.exitFullscreen();
      } catch {
        // Overlay fallback still needs a local restore.
      }
    }

    shell.classList.remove("is-overlay");
    syncChrome();
    forgetSlot();
  }

  function showBoot(): void {
    bootEl.hidden = false;
    window.clearTimeout(bootTimer);
    bootTimer = window.setTimeout(() => {
      bootEl.hidden = true;
    }, BOOT_FALLBACK_MS);
  }

  function hideBoot(): void {
    window.clearTimeout(bootTimer);
    bootTimer = 0;
    bootEl.hidden = true;
  }

  function attachLive(guest: LiveGuest): void {
    guestReady = false;
    offlineEl.hidden = true;
    iframe.hidden = false;
    iframe.title = `${guest.name} workbench`;
    showBoot();
    setStatus("Connecting…", "wait");
    iframe.src = guest.src;
  }

  function detachLive(): void {
    guestReady = false;
    hideBoot();
    iframe.src = "about:blank";
    iframe.hidden = true;
  }

  function showOffline(guest: GuestApp): void {
    if (isLiveGuest(guest)) {
      return;
    }

    detachLive();
    offlineNoteEl.textContent = guest.note;
    offlineRepoEl.href = guest.repo;
    offlineRepoEl.textContent = `${guest.name} repository`;
    offlineEl.hidden = false;
    setStatus("Not attached", "off");
  }

  function refreshStatus(): void {
    const guest = GUESTS[currentId];
    if (isLiveGuest(guest)) {
      setStatus(guestReady ? "Live · attached" : "Connecting…", guestReady ? "live" : "wait");
      return;
    }

    setStatus("Not attached", "off");
  }

  function setGuest(id: GuestId, force = false): void {
    const guest = GUESTS[id];
    const alreadyShowing = currentId === id && !force;

    shell.classList.remove("is-minimized");
    stageEl.hidden = false;
    titleEl.textContent = guest.name;
    subtitleEl.textContent = guest.subtitle;
    shell.dataset.guest = id;

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

  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.origin !== qpuGuestOrigin()) {
      return;
    }

    if (event.source !== iframe.contentWindow) {
      return;
    }

    if (!isGuestReadyMessage(event.data)) {
      return;
    }

    if (!isLiveGuest(GUESTS[currentId]) || iframe.hidden) {
      return;
    }

    guestReady = true;
    hideBoot();
    setStatus("Live · attached", "live");
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

  document.addEventListener("keydown", (event: KeyboardEvent) => {
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
  maxBtn.addEventListener("click", () => {
    void enterExpanded();
  });
  minBtn.addEventListener("click", () => {
    void exitExpanded().then(() => {
      shell.classList.add("is-minimized");
      stageEl.hidden = true;
      setStatus("Minimized", "off");
    });
  });
  closeBtn.addEventListener("click", () => {
    if (isExpanded(shell)) {
      void exitExpanded();
      return;
    }

    minBtn.click();
  });

  setGuest(initialId, true);
  syncChrome();

  return {
    setGuest,
    enterExpanded,
    exitExpanded,
  };
}

function mustQuery<T extends HTMLElement>(
  root: ParentNode,
  selector: string,
  ctor?: new () => T,
): T {
  const node = root.querySelector(selector);
  if (!(node instanceof (ctor ?? HTMLElement))) {
    throw new Error(`Live lab chrome missing ${selector}`);
  }

  return node as T;
}
