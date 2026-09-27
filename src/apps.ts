export const GITHUB_PAGES_ORIGIN = "https://bpforbes.github.io";

export const QPU_GUEST_SRC =
  "https://bpforbes.github.io/BPForbes.QPU.github.io/?embed=1";

export const FLINTSTONE_GUEST_SRC =
  "https://bpforbes.github.io/Bailey-Forbes-Flinstone/";

export const KEYQUORUM_GUEST_SRC =
  "https://bpforbes.github.io/KeyQuorum/";

export const QPU_EMBED_SOURCE = "qpu-guest";
export const FLINTSTONE_EMBED_SOURCE = "flinstone-guest";
export const KEYQUORUM_EMBED_SOURCE = "keyquorum-guest";

export type GuestId = "qpu" | "flinstone" | "keyquorum";

interface GuestBase {
  name: string;
  subtitle: string;
  repo: string;
}

interface LiveGuestBase extends GuestBase {
  kind: "live";
  src: string;
  origin: string;
  embedSource: string;
  iframeAllow: string;
}

export interface QpuGuest extends LiveGuestBase {
  id: "qpu";
}

export interface FlinstoneGuest extends LiveGuestBase {
  id: "flinstone";
}

export interface KeyQuorumGuest extends LiveGuestBase {
  id: "keyquorum";
}

export type LiveGuest = QpuGuest | FlinstoneGuest | KeyQuorumGuest;
export interface OfflineGuest extends GuestBase {
  id: GuestId;
  kind: "offline";
  note: string;
}

export type GuestApp = LiveGuest | OfflineGuest;

export const GUESTS: { readonly [K in GuestId]: Extract<GuestApp, { id: K }> } = {
  qpu: {
    id: "qpu",
    kind: "live",
    name: "QPU",
    subtitle: "Circuit workbench",
    repo: "https://github.com/BPForbes/BPForbes.QPU.github.io",
    src: QPU_GUEST_SRC,
    origin: GITHUB_PAGES_ORIGIN,
    embedSource: QPU_EMBED_SOURCE,
    iframeAllow: "fullscreen; clipboard-write",
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
    iframeAllow: "cross-origin-isolated; fullscreen; clipboard-write",
  },
  keyquorum: {
    id: "keyquorum",
    kind: "live",
    name: "KeyQuorum",
    subtitle: "Security lab",
    repo: "https://github.com/BPForbes/KeyQuorum",
    src: KEYQUORUM_GUEST_SRC,
    origin: GITHUB_PAGES_ORIGIN,
    embedSource: KEYQUORUM_EMBED_SOURCE,
    iframeAllow: "fullscreen; clipboard-write",
  },
};

export const GUEST_ORDER: readonly GuestId[] = ["qpu", "flinstone", "keyquorum"];

export function isGuestId(value: string): value is GuestId {
  return Object.prototype.hasOwnProperty.call(GUESTS, value);
}

export function isLiveGuest(guest: GuestApp): guest is LiveGuest {
  return guest.kind === "live";
}

export function isGuestReadyMessage(guest: LiveGuest, data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("source" in data) || !("type" in data)) {
    return false;
  }

  if (data.source !== guest.embedSource || data.type !== "ready") {
    return false;
  }

  if (guest.id === "flinstone" || guest.id === "keyquorum") {
    return (
      "schemaVersion" in data &&
      data.schemaVersion === 1 &&
      "commit" in data &&
      typeof data.commit === "string" &&
      data.commit.length > 0
    );
  }

  return true;
}
