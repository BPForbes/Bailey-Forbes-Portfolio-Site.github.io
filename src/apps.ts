export const QPU_GUEST_ORIGIN = "https://bpforbes.github.io";

export const QPU_GUEST_SRC =
  "https://bpforbes.github.io/BPForbes.QPU.github.io/?embed=1";

export const QPU_EMBED_SOURCE = "qpu-guest";
export const QPU_HOST_SOURCE = "qpu-host";

export const QPU_VIEW_IDS = [
  "builder",
  "docs",
  "qpu-docs",
  "particles",
  "module-tester",
  "files",
  "more",
] as const;

export type QpuViewId = (typeof QPU_VIEW_IDS)[number];

export interface QpuViewOption {
  id: QpuViewId;
  label: string;
}

export const QPU_FALLBACK_VIEWS: readonly QpuViewOption[] = [
  { id: "builder", label: "Circuit builder" },
  { id: "docs", label: "Wiki / docs" },
  { id: "qpu-docs", label: "QPU docs" },
  { id: "particles", label: "Particles" },
  { id: "module-tester", label: "Correction lab" },
  { id: "files", label: "Files" },
  { id: "more", label: "More" },
];

export interface GuestReadyMessage {
  source: typeof QPU_EMBED_SOURCE;
  type: "ready";
  view: QpuViewId;
  views: readonly QpuViewOption[];
  features: readonly string[];
}

export interface HostSetViewMessage {
  source: typeof QPU_HOST_SOURCE;
  type: "setView";
  view: QpuViewId;
}

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
  origin: string;
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
    subtitle: "Playground",
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

export const GUEST_ORDER: readonly GuestId[] = ["qpu", "flinstone", "keyquorum"];

export function isGuestId(value: string): value is GuestId {
  return Object.prototype.hasOwnProperty.call(GUESTS, value);
}

export function isLiveGuest(guest: GuestApp): guest is LiveGuest {
  return guest.kind === "live";
}

export function isQpuViewId(value: unknown): value is QpuViewId {
  return typeof value === "string" && (QPU_VIEW_IDS as readonly string[]).includes(value);
}

export function parseGuestReadyMessage(data: unknown): GuestReadyMessage | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  if (!("source" in data) || !("type" in data)) {
    return null;
  }

  if (data.source !== QPU_EMBED_SOURCE || data.type !== "ready") {
    return null;
  }

  const views = viewsFromReady(data);
  const view = viewFromReady(data, views);

  return {
    source: QPU_EMBED_SOURCE,
    type: "ready",
    view,
    views,
    features: featuresFromReady(data),
  };
}

export function isGuestReadyMessage(data: unknown): data is GuestReadyMessage {
  return parseGuestReadyMessage(data) !== null;
}

export function hostSetViewMessage(view: QpuViewId): HostSetViewMessage {
  return {
    source: QPU_HOST_SOURCE,
    type: "setView",
    view,
  };
}

function viewsFromReady(data: object): readonly QpuViewOption[] {
  if (!("views" in data) || !Array.isArray(data.views)) {
    return QPU_FALLBACK_VIEWS;
  }

  const views: QpuViewOption[] = [];
  const seen = new Set<QpuViewId>();

  for (const item of data.views) {
    if (typeof item !== "object" || item === null || !("id" in item)) {
      continue;
    }

    if (!isQpuViewId(item.id) || seen.has(item.id)) {
      continue;
    }

    const label =
      "label" in item && typeof item.label === "string" && item.label.trim() !== ""
        ? item.label
        : (QPU_FALLBACK_VIEWS.find((option) => option.id === item.id)?.label ?? item.id);

    seen.add(item.id);
    views.push({ id: item.id, label });
  }

  return views.length > 0 ? views : QPU_FALLBACK_VIEWS;
}

function viewFromReady(data: object, views: readonly QpuViewOption[]): QpuViewId {
  if ("view" in data && isQpuViewId(data.view)) {
    return data.view;
  }

  return views[0]?.id ?? "builder";
}

function featuresFromReady(data: object): readonly string[] {
  if (!("features" in data) || !Array.isArray(data.features)) {
    return [];
  }

  return data.features.filter((feature): feature is string => typeof feature === "string");
}
