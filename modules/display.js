import { icon } from "./icons.js";
const STORAGE_KEY = "bf-display";
const DEFAULTS = { theme: "system", contrast: "system", motion: "system", text: "default" };
const OPTIONS = {
  theme: ["system", "dark", "light"],
  contrast: ["system", "standard", "high"],
  motion: ["system", "full", "reduced"],
  text: ["default", "large"]
};
const LABELS = {
  theme: "Theme",
  contrast: "Contrast",
  motion: "Motion",
  text: "Text size"
};
const OPTION_LABELS = {
  system: "System",
  dark: "Dark",
  light: "Paper",
  standard: "Standard",
  high: "High",
  full: "Full",
  reduced: "Reduced",
  default: "Default",
  large: "Larger"
};
function isOption(key, value) {
  return OPTIONS[key].includes(value);
}
function readPrefs() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { ...DEFAULTS };
  }
  if (raw === null) {
    return { ...DEFAULTS };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULTS };
  }
  const prefs = { ...DEFAULTS };
  if (typeof parsed === "object" && parsed !== null) {
    const record = parsed;
    if (isOption("theme", record.theme)) prefs.theme = record.theme;
    if (isOption("contrast", record.contrast)) prefs.contrast = record.contrast;
    if (isOption("motion", record.motion)) prefs.motion = record.motion;
    if (isOption("text", record.text)) prefs.text = record.text;
  }
  return prefs;
}
function applyPrefs(prefs) {
  const root = document.documentElement;
  const set = (name, value, unsetWhen) => {
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
function savePrefs(prefs) {
  try {
    const isDefault = Object.keys(DEFAULTS).every((key) => prefs[key] === DEFAULTS[key]);
    if (isDefault) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    }
  } catch {
  }
}
function prefersReducedMotion() {
  const chosen = document.documentElement?.getAttribute("data-motion") ?? null;
  if (chosen === "reduced") return true;
  if (chosen === "full") return false;
  return typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false;
}
function optionId(key, value) {
  return `display-${key}-${value}`;
}
function renderGroup(key, current) {
  const options = OPTIONS[key].map(
    (value) => `
        <label class="display-option" for="${optionId(key, value)}">
          <input type="radio" name="${key}" value="${value}" id="${optionId(key, value)}"${value === current ? " checked" : ""} />
          ${OPTION_LABELS[value] ?? value}
        </label>`
  ).join("");
  return `
    <fieldset class="display-group">
      <legend>${LABELS[key]}</legend>
      <div class="display-options">${options}</div>
    </fieldset>`;
}
function mountDisplayControl(mount) {
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
  const toggle = mount.querySelector(".display-toggle");
  const panel = mount.querySelector(".display-panel");
  const form = mount.querySelector("[data-display-form]");
  const reset = mount.querySelector("[data-display-reset]");
  if (!toggle || !panel || !form || !reset) {
    return;
  }
  const setOpen = (open) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => {
    const open = panel.hidden;
    setOpen(open);
    if (open) {
      form.querySelector('input[name="theme"]:checked')?.focus();
    }
  });
  form.addEventListener("change", () => {
    const data = new FormData(form);
    const pick = (key) => {
      const value = data.get(key);
      return isOption(key, value) ? value : DEFAULTS[key];
    };
    prefs = { theme: pick("theme"), contrast: pick("contrast"), motion: pick("motion"), text: pick("text") };
    applyPrefs(prefs);
    savePrefs(prefs);
  });
  reset.addEventListener("click", () => {
    prefs = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      const input = form.querySelector(`#${optionId(key, DEFAULTS[key])}`);
      if (input) input.checked = true;
    }
    applyPrefs(prefs);
    savePrefs(prefs);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!panel.hidden && event.target instanceof Node && !mount.contains(event.target)) {
      setOpen(false);
    }
  });
  panel.addEventListener("focusout", (event) => {
    if (event.relatedTarget instanceof Node && !mount.contains(event.relatedTarget)) {
      setOpen(false);
    }
  });
}
export {
  STORAGE_KEY,
  applyPrefs,
  mountDisplayControl,
  prefersReducedMotion,
  readPrefs
};
