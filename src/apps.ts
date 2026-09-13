// Same-origin copy of the QPU playground. The upstream Pages site stacks every
// view in one scroller; this hosted build shows one page at a time.
export const QPU_GUEST_SRC = "/workbench/?embed=1";

export function qpuGuestOrigin(win: Pick<Window, "location"> = window): string {
  return win.location.origin;
}

export const QPU_EMBED_SOURCE = "qpu-guest";

export type GuestId = "qpu" | "flinstone" | "keyquorum";

interface GuestBase {
  name: string;
  subtitle: string;
  repo: string;
}

export interface LiveGuest extends GuestBase {
  id: "qpu";
  kind: "live";
  src: string;
}

export interface FlinstoneGuest extends GuestBase {
  id: "flinstone";
  kind: "offline";
  note: string;
}

export interface KeyQuorumGuest extends GuestBase {
  id: "keyquorum";
  kind: "offline";
  note: string;
}

export type OfflineGuest = FlinstoneGuest | KeyQuorumGuest;

export type GuestApp = LiveGuest | OfflineGuest;

export const GUESTS: { readonly [K in GuestId]: Extract<GuestApp, { id: K }> } = {
  qpu: {
    id: "qpu",
    kind: "live",
    name: "QPU",
    subtitle: "Circuit workbench",
    repo: "https://github.com/BPForbes/BPForbes.QPU.github.io",
    src: QPU_GUEST_SRC,
  },
  flinstone: {
    id: "flinstone",
    kind: "offline",
    name: "Flinstone",
    subtitle: "Kernel host",
    repo: "https://github.com/BPForbes/Bailey-Forbes-Flinstone",
    note: "Not attached. The Emscripten host stays in the Flinstone repo — this site does not vendor WASM or kernel binaries.",
  },
  keyquorum: {
    id: "keyquorum",
    kind: "offline",
    name: "KeyQuorum",
    subtitle: "Hardware-key CLI",
    repo: "https://github.com/BPForbes/KeyQuorum",
    note: "Not attached. The CLI stays in the KeyQuorum repo — this window only hosts a URL, and none is wired yet.",
  },
};

export const GUEST_ORDER: readonly GuestId[] = ["qpu", "flinstone", "keyquorum"];

export function isGuestId(value: string): value is GuestId {
  return Object.prototype.hasOwnProperty.call(GUESTS, value);
}

export function isLiveGuest(guest: GuestApp): guest is LiveGuest {
  return guest.kind === "live";
}

export function isGuestReadyMessage(data: unknown): boolean {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  if (!("source" in data) || !("type" in data)) {
    return false;
  }

  return data.source === QPU_EMBED_SOURCE && data.type === "ready";
}
