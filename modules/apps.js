const GITHUB_PAGES_ORIGIN = "https://bpforbes.github.io";
const QPU_GUEST_SRC = "https://bpforbes.github.io/BPForbes.QPU.github.io/?embed=1";
const FLINTSTONE_GUEST_SRC = "https://bpforbes.github.io/Bailey-Forbes-Flinstone/";
const QPU_EMBED_SOURCE = "qpu-guest";
const FLINTSTONE_EMBED_SOURCE = "flinstone-guest";
const GUESTS = {
  qpu: {
    id: "qpu",
    kind: "live",
    name: "QPU",
    subtitle: "Circuit workbench",
    repo: "https://github.com/BPForbes/BPForbes.QPU.github.io",
    src: QPU_GUEST_SRC,
    origin: GITHUB_PAGES_ORIGIN,
    embedSource: QPU_EMBED_SOURCE,
    iframeAllow: "fullscreen; clipboard-write"
  },
  flinstone: {
    id: "flinstone",
    kind: "live",
    name: "Flinstone",
    subtitle: "Kernel lab",
    repo: "https://github.com/BPForbes/Bailey-Forbes-Flinstone",
    src: FLINTSTONE_GUEST_SRC,
    origin: GITHUB_PAGES_ORIGIN,
    embedSource: FLINTSTONE_EMBED_SOURCE,
    iframeAllow: "cross-origin-isolated; fullscreen; clipboard-write"
  },
  keyquorum: {
    id: "keyquorum",
    kind: "offline",
    name: "KeyQuorum",
    subtitle: "Hardware-key CLI",
    repo: "https://github.com/BPForbes/KeyQuorum",
    note: "Not attached. The CLI stays in the KeyQuorum repo \u2014 this window only hosts a URL, and none is wired yet."
  }
};
const GUEST_ORDER = ["qpu", "flinstone", "keyquorum"];
function isGuestId(value) {
  return Object.prototype.hasOwnProperty.call(GUESTS, value);
}
function isLiveGuest(guest) {
  return guest.kind === "live";
}
function isGuestReadyMessage(guest, data) {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  if (!("source" in data) || !("type" in data)) {
    return false;
  }
  if (data.source !== guest.embedSource || data.type !== "ready") {
    return false;
  }
  if (guest.id === "flinstone") {
    return "schemaVersion" in data && data.schemaVersion === 1 && "commit" in data && typeof data.commit === "string" && data.commit.length > 0;
  }
  return true;
}
export {
  FLINTSTONE_EMBED_SOURCE,
  FLINTSTONE_GUEST_SRC,
  GITHUB_PAGES_ORIGIN,
  GUESTS,
  GUEST_ORDER,
  QPU_EMBED_SOURCE,
  QPU_GUEST_SRC,
  isGuestId,
  isGuestReadyMessage,
  isLiveGuest
};
