const WIDE_QUERY = "(min-width: 56rem)";
const STORAGE_KEY = "bf-layout";
const WIDE_VIEWPORT = "width=1120";
const AUTO_VIEWPORT = "width=device-width, initial-scale=1.0";
function readPreference() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "compact" || stored === "wide") {
      return stored;
    }
  } catch {
  }
  return "auto";
}
function writePreference(preference) {
  try {
    if (preference === "auto") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
  }
}
function resolveLayer(preference) {
  if (preference !== "auto") {
    return preference;
  }
  return window.matchMedia(WIDE_QUERY).matches ? "wide" : "compact";
}
function applyViewport(preference) {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    return;
  }
  meta.setAttribute("content", preference === "wide" ? WIDE_VIEWPORT : AUTO_VIEWPORT);
}
function applyLayer(preference) {
  const layer = resolveLayer(preference);
  const root = document.documentElement;
  const changed = !root.classList.contains(`layout-${layer}`);
  root.classList.toggle("layout-wide", layer === "wide");
  root.classList.toggle("layout-compact", layer === "compact");
  root.dataset.layoutPref = preference;
  applyViewport(preference);
  if (changed) {
    window.dispatchEvent(new CustomEvent("bf:layer", { detail: layer }));
  }
  return layer;
}
const NOTES = {
  auto: "This page is matching your screen.",
  compact: "Mobile layout is pinned for this browser.",
  wide: "Desktop layout is pinned for this browser."
};
function mountLayoutSwitch(mount) {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "layout-toggle";
  toggle.setAttribute("data-layout-toggle", "");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "layout-toggle";
  reset.setAttribute("data-layout-auto", "");
  reset.textContent = "Match my screen";
  const note = document.createElement("p");
  note.className = "layout-switch-note";
  note.setAttribute("role", "status");
  mount.append(toggle, reset, note);
  const render = (preference2, layer) => {
    toggle.textContent = layer === "wide" ? "Mobile site" : "Desktop site";
    toggle.setAttribute(
      "aria-label",
      layer === "wide" ? "Switch to the mobile layout" : "Switch to the desktop layout"
    );
    reset.hidden = preference2 === "auto";
    note.textContent = NOTES[preference2];
  };
  const set = (preference2) => {
    writePreference(preference2);
    render(preference2, applyLayer(preference2));
  };
  toggle.addEventListener("click", () => {
    const current = resolveLayer(readPreference());
    set(current === "wide" ? "compact" : "wide");
  });
  reset.addEventListener("click", () => {
    set("auto");
  });
  window.matchMedia(WIDE_QUERY).addEventListener("change", () => {
    const preference2 = readPreference();
    if (preference2 === "auto") {
      render(preference2, applyLayer(preference2));
    }
  });
  const preference = readPreference();
  render(preference, applyLayer(preference));
}
export {
  mountLayoutSwitch
};
