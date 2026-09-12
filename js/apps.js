export const QPU_GUEST_ORIGIN = "https://bpforbes.github.io";
export const QPU_GUEST_SRC = "https://bpforbes.github.io/BPForbes.QPU.github.io/?embed=1";
export const QPU_EMBED_SOURCE = "qpu-guest";
export const GUESTS = {
    qpu: {
        id: "qpu",
        kind: "live",
        name: "QPU",
        subtitle: "Circuit workbench",
        repo: "https://github.com/BPForbes/BPForbes.QPU.github.io",
        src: QPU_GUEST_SRC,
        origin: QPU_GUEST_ORIGIN,
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
export const GUEST_ORDER = ["qpu", "flinstone", "keyquorum"];
export function isGuestId(value) {
    return Object.prototype.hasOwnProperty.call(GUESTS, value);
}
export function isLiveGuest(guest) {
    return guest.kind === "live";
}
export function isGuestReadyMessage(data) {
    if (typeof data !== "object" || data === null) {
        return false;
    }
    if (!("source" in data) || !("type" in data)) {
        return false;
    }
    return data.source === QPU_EMBED_SOURCE && data.type === "ready";
}
