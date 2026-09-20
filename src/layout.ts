/**
 * The layer switch.
 *
 * The site has two presentation layers over one document — compact and wide —
 * and this decides which is active. The decision is normally automatic, from
 * the width of the window, but a visitor can pin either layer: a phone that
 * wants the full desktop grid, or a desktop that wants to read the page the
 * way a phone does.
 *
 * Three things follow from that being a CLASS on <html> rather than a media
 * query:
 *
 *   1. It can be overridden from the document. A media query cannot.
 *   2. The layers are stated once each in the stylesheet, so they cannot
 *      drift apart the way parallel `max-width` / `min-width` rules do.
 *   3. Compact is what a visitor without JavaScript gets, which is the right
 *      fallback — a readable single column, not a desktop grid on a phone.
 *
 * The first application happens in an inline <head> script, before first
 * paint, so a pinned layer never flashes the other one. This module owns the
 * same contract afterwards; the two must agree, so the constants below are
 * repeated verbatim in that snippet.
 */

/** Where the wide layer starts. Matches the stylesheet's own boundary. */
const WIDE_QUERY = "(min-width: 56rem)";

const STORAGE_KEY = "bf-layout";

/** What a phone renders at when a visitor asks for the desktop layer. */
const WIDE_VIEWPORT = "width=1120";

const AUTO_VIEWPORT = "width=device-width, initial-scale=1.0";

export type LayoutPreference = "auto" | "compact" | "wide";

export type Layer = "compact" | "wide";

function readPreference(): LayoutPreference {
  // Private browsing and blocked storage both throw rather than return null.
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "compact" || stored === "wide") {
      return stored;
    }
  } catch {
    /* No stored preference is a valid state: it means automatic. */
  }
  return "auto";
}

function writePreference(preference: LayoutPreference): void {
  try {
    if (preference === "auto") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    /* The layer still applies to this page; it just will not be remembered. */
  }
}

function resolveLayer(preference: LayoutPreference): Layer {
  if (preference !== "auto") {
    return preference;
  }
  return window.matchMedia(WIDE_QUERY).matches ? "wide" : "compact";
}

/**
 * Pinning the wide layer on a phone is not only a matter of CSS: at a 390px
 * viewport a 1120px grid would simply overflow. Widening the layout viewport
 * is what "Desktop site" means in a browser's own menu — the page lays out at
 * desktop width and the device scales it to fit, pinch-zoom included.
 */
function applyViewport(preference: LayoutPreference): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    return;
  }
  meta.setAttribute("content", preference === "wide" ? WIDE_VIEWPORT : AUTO_VIEWPORT);
}

function applyLayer(preference: LayoutPreference): Layer {
  const layer = resolveLayer(preference);
  const root = document.documentElement;
  const changed = !root.classList.contains(`layout-${layer}`);
  root.classList.toggle("layout-wide", layer === "wide");
  root.classList.toggle("layout-compact", layer === "compact");
  root.dataset.layoutPref = preference;
  applyViewport(preference);
  if (changed) {
    // Anything holding layer-specific state — the compact menu's open/closed
    // flag, above all — needs to hear that it no longer applies.
    window.dispatchEvent(new CustomEvent<Layer>("bf:layer", { detail: layer }));
  }
  return layer;
}

const NOTES: Record<LayoutPreference, string> = {
  auto: "This page is matching your screen.",
  compact: "Mobile layout is pinned for this browser.",
  wide: "Desktop layout is pinned for this browser.",
};

/**
 * Renders the switch into the footer and keeps it in step with the page.
 *
 * The button always offers the layer you are not in, so its label is the
 * outcome of pressing it rather than the current state — "Desktop site" means
 * you will get one, not that you have one.
 */
export function mountLayoutSwitch(mount: HTMLElement): void {
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
  // The switch changes the page around it, so the change is announced rather
  // than left to be noticed (R25).
  note.setAttribute("role", "status");

  mount.append(toggle, reset, note);

  const render = (preference: LayoutPreference, layer: Layer): void => {
    toggle.textContent = layer === "wide" ? "Mobile site" : "Desktop site";
    toggle.setAttribute(
      "aria-label",
      layer === "wide" ? "Switch to the mobile layout" : "Switch to the desktop layout",
    );
    reset.hidden = preference === "auto";
    note.textContent = NOTES[preference];
  };

  const set = (preference: LayoutPreference): void => {
    writePreference(preference);
    render(preference, applyLayer(preference));
  };

  toggle.addEventListener("click", () => {
    const current = resolveLayer(readPreference());
    set(current === "wide" ? "compact" : "wide");
  });

  reset.addEventListener("click", () => {
    set("auto");
  });

  // A resized window only decides anything while the choice is still automatic;
  // a pinned layer is a pinned layer at any width.
  window.matchMedia(WIDE_QUERY).addEventListener("change", () => {
    const preference = readPreference();
    if (preference === "auto") {
      render(preference, applyLayer(preference));
    }
  });

  const preference = readPreference();
  render(preference, applyLayer(preference));
}
