/**
 * The Display control: theme, contrast, motion and text size, chosen by the
 * visitor and kept between visits.
 *
 * The choice is written onto <html> as data attributes and the stylesheet
 * does the rest (css/styles.css, "tokens"). Three facts shape the design:
 *
 *   1. **An absent attribute means "follow the OS."** `data-theme` is only
 *      set for an explicit dark or light; with none set, `prefers-color-scheme`
 *      decides, in CSS, with or without this script. The same for contrast
 *      and motion. So the no-JS rendering, the first paint and the settled
 *      page all agree, and nobody is handed a theme they did not ask for.
 *   2. **The saved choice is applied before first paint** by a four-line
 *      inline script in every page's <head> (see home/index.html), which
 *      reads the same localStorage key this module writes. This module never
 *      has to race the stylesheet; it only draws the panel and handles
 *      changes.
 *   3. **The panel is native form controls.** Radios in fieldsets give
 *      grouping, arrow-key movement and announcement for free; the script
 *      adds only open/close, Escape, click-outside and focus return.
 *
 * Nothing here is required for the site to work: with the key empty the
 * page is exactly what the OS preferences make it.
 */
import { icon } from "./icons.js";

export const STORAGE_KEY = "bf-display";

export type Theme = "system" | "dark" | "light";
export type Contrast = "system" | "standard" | "high";
export type Motion = "system" | "full" | "reduced";
export type TextSize = "default" | "large";

export interface DisplayPrefs {
  theme: Theme;
  contrast: Contrast;
  motion: Motion;
  text: TextSize;
}

const DEFAULTS: DisplayPrefs = { theme: "system", contrast: "system", motion: "system", text: "default" };

const OPTIONS: { [K in keyof DisplayPrefs]: ReadonlyArray<DisplayPrefs[K]> } = {
  theme: ["system", "dark", "light"],
  contrast: ["system", "standard", "high"],
  motion: ["system", "full", "reduced"],
  text: ["default", "large"],
};

const LABELS: Record<keyof DisplayPrefs, string> = {
  theme: "Theme",
  contrast: "Contrast",
  motion: "Motion",
  text: "Text size",
};

const OPTION_LABELS: Record<string, string> = {
  system: "System",
  dark: "Dark",
  light: "Paper",
  standard: "Standard",
  high: "High",
  full: "Full",
  reduced: "Reduced",
  default: "Default",
  large: "Larger",
};

function isOption<K extends keyof DisplayPrefs>(key: K, value: unknown): value is DisplayPrefs[K] {
  return (OPTIONS[key] as ReadonlyArray<unknown>).includes(value);
}

/** The saved preferences, with anything unreadable or unknown replaced by the default. */
export function readPrefs(): DisplayPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ...DEFAULTS };
  }
  if (raw === null) {
    return { ...DEFAULTS };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULTS };
  }
  const prefs: DisplayPrefs = { ...DEFAULTS };
  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    if (isOption("theme", record.theme)) prefs.theme = record.theme;
    if (isOption("contrast", record.contrast)) prefs.contrast = record.contrast;
    if (isOption("motion", record.motion)) prefs.motion = record.motion;
    if (isOption("text", record.text)) prefs.text = record.text;
  }
  return prefs;
}

/**
 * Write the preferences onto <html>. Mirrors the inline boot script exactly;
 * if the two ever disagree the page will flash on load.
 */
export function applyPrefs(prefs: DisplayPrefs): void {
  const root = document.documentElement;
  const set = (name: string, value: string, unsetWhen: string): void => {
    if (value === unsetWhen) {
      root.removeAttribute(name);
    } else {
      root.setAttribute(name, value);
    }
  };
  set("data-theme", prefs.theme, "system");
  set("data-contrast", prefs.contrast, "system");
  set("data-motion", prefs.motion, "system");
  set("data-text", prefs.text, "default");
}

function savePrefs(prefs: DisplayPrefs): void {
  try {
    const isDefault = (Object.keys(DEFAULTS) as Array<keyof DisplayPrefs>).every((key) => prefs[key] === DEFAULTS[key]);
    if (isDefault) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {
    // Private mode or storage blocked: the choice still applies for this page.
  }
}

/**
 * Whether motion should be reduced right now, from either source. Scripts
 * that animate (deck.ts) ask this rather than the media query alone, so the
 * Display control's choice reaches them too.
 */
export function prefersReducedMotion(): boolean {
  // deck.ts is exercised in Node with a partial document (tests/deck.test.mjs),
  // so neither the root element nor matchMedia can be assumed to exist.
  const chosen = document.documentElement?.getAttribute("data-motion") ?? null;
  if (chosen === "reduced") return true;
  if (chosen === "full") return false;
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

function optionId(key: keyof DisplayPrefs, value: string): string {
  return `display-${key}-${value}`;
}

function renderGroup(key: keyof DisplayPrefs, current: string): string {
  const options = OPTIONS[key]
    .map(
      (value) => `
        <label class="display-option" for="${optionId(key, value)}">
          <input type="radio" name="${key}" value="${value}" id="${optionId(key, value)}"${value === current ? " checked" : ""} />
          ${OPTION_LABELS[value] ?? value}
        </label>`,
    )
    .join("");
  return `
    <fieldset class="display-group">
      <legend>${LABELS[key]}</legend>
      <div class="display-options">${options}</div>
    </fieldset>`;
}

/** Draw the control into `mount` (inside the site header) and wire it up. */
export function mountDisplayControl(mount: HTMLElement): void {
  let prefs = readPrefs();

  mount.innerHTML = `
    <button class="display-toggle" type="button" aria-expanded="false" aria-controls="display-panel" aria-label="Display settings">
      ${icon("sliders")}<span class="display-toggle-label" aria-hidden="true">Display</span>
    </button>
    <div class="display-panel" id="display-panel" role="dialog" aria-labelledby="display-title" hidden>
      <div class="display-panel-head">
        <h2 id="display-title">Display</h2>
        <p>Kept on this device.</p>
      </div>
      <form data-display-form>
        ${renderGroup("theme", prefs.theme)}
        ${renderGroup("contrast", prefs.contrast)}
        ${renderGroup("motion", prefs.motion)}
        ${renderGroup("text", prefs.text)}
        <button class="btn btn-ghost display-reset" type="button" data-display-reset>Use system settings</button>
      </form>
    </div>`;

  const toggle = mount.querySelector<HTMLButtonElement>(".display-toggle");
  const panel = mount.querySelector<HTMLElement>(".display-panel");
  const form = mount.querySelector<HTMLFormElement>("[data-display-form]");
  const reset = mount.querySelector<HTMLButtonElement>("[data-display-reset]");
  if (!toggle || !panel || !form || !reset) {
    return;
  }

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    setOpen(open);
    if (open) {
      // Land on the current theme choice, so a keyboard visitor is inside
      // the first group rather than back on the button that opened it.
      form.querySelector<HTMLInputElement>('input[name="theme"]:checked')?.focus();
    }
  });

  form.addEventListener("change", () => {
    const data = new FormData(form);
    const pick = <K extends keyof DisplayPrefs>(key: K): DisplayPrefs[K] => {
      const value = data.get(key);
      return isOption(key, value) ? value : DEFAULTS[key];
    };
    prefs = { theme: pick("theme"), contrast: pick("contrast"), motion: pick("motion"), text: pick("text") };
    applyPrefs(prefs);
    savePrefs(prefs);
  });

  reset.addEventListener("click", () => {
    prefs = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as Array<keyof DisplayPrefs>) {
      const input = form.querySelector<HTMLInputElement>(`#${optionId(key, DEFAULTS[key])}`);
      if (input) input.checked = true;
    }
    applyPrefs(prefs);
    savePrefs(prefs);
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!panel.hidden && event.target instanceof Node && !mount.contains(event.target)) {
      setOpen(false);
    }
  });

  // Tabbing out of the panel's last control closes it, so the next Tab stop
  // is the page, not a panel the visitor has visibly left behind.
  panel.addEventListener("focusout", (event: FocusEvent) => {
    if (event.relatedTarget instanceof Node && !mount.contains(event.relatedTarget)) {
      setOpen(false);
    }
  });
}
