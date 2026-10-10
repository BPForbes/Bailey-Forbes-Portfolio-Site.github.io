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
 *   3. **The panel is native form controls in a native dialog.** Radios in
 *      fieldsets give grouping, arrow-key movement and announcement for free,
 *      and src/sheet.ts supplies the dialog: a bottom sheet on a phone, a side
 *      sheet on a wide screen, with Escape, scrim click and focus return.
 *
 * Nothing here is required for the site to work: with the key empty the
 * page is exactly what the OS preferences make it.
 */
import { icon } from "./icons.js";
import { createSheet } from "./sheet.js";

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
  const chosen =
    typeof document !== "undefined" ? (document.documentElement?.getAttribute("data-motion") ?? null) : null;
  if (chosen === "reduced") return true;
  if (chosen === "full") return false;
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
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
    </button>`;
  const toggle = mount.querySelector<HTMLButtonElement>(".display-toggle");
  if (!toggle) {
    return;
  }

  // The panel is a sheet: a bottom sheet on a phone, a side sheet beside the
  // page on a wide screen (src/sheet.ts). The toggle stays in the header.
  const sheet = createSheet({ id: "display-panel", title: "Display" });
  sheet.body.innerHTML = `
    <p class="display-hint">Kept on this device.</p>
    <form data-display-form>
      ${renderGroup("theme", prefs.theme)}
      ${renderGroup("contrast", prefs.contrast)}
      ${renderGroup("motion", prefs.motion)}
      ${renderGroup("text", prefs.text)}
      <button class="btn btn-ghost display-reset" type="button" data-display-reset>Use system settings</button>
    </form>`;

  const form = sheet.body.querySelector<HTMLFormElement>("[data-display-form]");
  const reset = sheet.body.querySelector<HTMLButtonElement>("[data-display-reset]");
  if (!form || !reset) {
    return;
  }

  // Scripts that animate (src/story.ts) cannot see an attribute change, so a
  // choice made after load is announced to them.
  const announce = (): void => {
    document.dispatchEvent(new Event("display-change"));
  };

  toggle.addEventListener("click", () => {
    // Land on the current theme choice, so a keyboard visitor is inside the
    // first group rather than on the close button.
    sheet.open(toggle, form.querySelector<HTMLInputElement>('input[name="theme"]:checked'));
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
    announce();
  });

  reset.addEventListener("click", () => {
    prefs = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS) as Array<keyof DisplayPrefs>) {
      const input = form.querySelector<HTMLInputElement>(`#${optionId(key, DEFAULTS[key])}`);
      if (input) input.checked = true;
    }
    applyPrefs(prefs);
    savePrefs(prefs);
    announce();
  });
}
