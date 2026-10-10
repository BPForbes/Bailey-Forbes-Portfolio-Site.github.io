// Rendered-page accessibility audit (see tools/README.md). Needs a server on :4173
// and playwright resolvable (NODE_PATH=$(npm root -g) node tools/audit-a11y.mjs).
// Rendered-page audit: text contrast against the real painted background,
// standalone target sizes, horizontal overflow, focus-ring visibility and the
// Display control's keyboard behaviour — in every theme/contrast rendering.
import { chromium } from "playwright";
const base = "http://localhost:4173";
const pages = ["/home/", "/projects/", "/projects/flinstone/", "/projects/homework-central/", "/projects/keyquorum/", "/projects/qpu/", "/projects/emr/", "/404.html"];
const renderings = [
  { tag: "dark", prefs: { theme: "dark", contrast: "standard" } },
  { tag: "light", prefs: { theme: "light", contrast: "standard" } },
  { tag: "dark-hc", prefs: { theme: "dark", contrast: "high" } },
  { tag: "light-hc", prefs: { theme: "light", contrast: "high" } },
];
const widths = [320, 768, 1280];
const browser = await chromium.launch();
let problems = 0;
const say = (m) => { problems++; console.log("  !! " + m); };

const CONTRAST_SCRIPT = () => {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r,g,b,a=1] = m[1].split(",").map(Number); return {r,g,b,a}; };
  const lum = ({r,g,b}) => { const f = (c) => { c/=255; return c<=0.03928? c/12.92 : ((c+0.055)/1.055)**2.4; }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const ratio = (a,b) => { const la=lum(a), lb=lum(b); return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05); };
  const blend = (fg, bg) => ({ r: fg.r*fg.a + bg.r*(1-fg.a), g: fg.g*fg.a + bg.g*(1-fg.a), b: fg.b*fg.a + bg.b*(1-fg.a), a: 1 });
  const bgOf = (el) => {
    let node = el; let acc = null;
    while (node && node !== document.documentElement) {
      const cs = getComputedStyle(node); const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { acc = acc ? blend(acc, c) : (c.a === 1 ? c : c); if (c.a === 1) return acc; }
      node = node.parentElement;
    }
    const body = parse(getComputedStyle(document.body).backgroundColor);
    return acc ? blend(acc, body) : body;
  };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.trim(); if (!text) continue;
    const el = n.parentElement; if (!el) continue;
    if (el.closest("[hidden], script, style, noscript, iframe, .visually-hidden, .skip-link, :disabled")) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") continue;
    const rect = el.getBoundingClientRect(); if (rect.width === 0 || rect.height === 0) continue;
    const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el);
    const fgb = fg.a < 1 ? blend(fg, bg) : fg;
    const size = parseFloat(cs.fontSize); const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(fgb, bg);
    if (r < (large ? 3 : 4.5)) out.push({ text: text.slice(0, 40), r: +r.toFixed(2), fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, size, sel: el.className || el.tagName });
  }
  return out;
};

const TARGET_SCRIPT = () => {
  const out = [];
  for (const el of document.querySelectorAll("a, button, input, select, textarea, summary, [tabindex]")) {
    if (el.closest("[hidden], .visually-hidden, .skip-link")) continue;
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    if (el.type === "radio") continue; // visually hidden; its label is the target
    const parent = el.parentElement;
    const inline = el.tagName === "A" && parent && parent.textContent.trim().length > el.textContent.trim().length + 2 && cs.display === "inline";
    if (inline) continue;
    if (r.width < 24 || r.height < 24) out.push({ sel: el.className || el.tagName, text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out;
};

for (const rendering of renderings) {
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((p) => { try { localStorage.setItem("bf-display", JSON.stringify(p)); } catch {} }, rendering.prefs);
    await ctx.route("**/challenges.cloudflare.com/**", (r) => r.abort());
    for (const path of pages) {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => { if (m.type() === "error" && !/turnstile|challenges|net::ERR|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
      await page.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(300);
      const label = `${rendering.tag} ${width}px ${path}`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (overflow) say(`${label}: horizontal overflow (${await page.evaluate(() => document.documentElement.scrollWidth)} > ${width})`);
      const attrs = await page.evaluate(() => [document.documentElement.getAttribute("data-theme"), document.documentElement.getAttribute("data-contrast")]);
      if (attrs[0] !== rendering.prefs.theme || attrs[1] !== rendering.prefs.contrast) say(`${label}: prefs not applied ${attrs}`);
      const low = await page.evaluate(CONTRAST_SCRIPT);
      for (const l of low) say(`${label}: contrast ${l.r} "${l.text}" ${l.fg} on ${l.bg} (${l.sel}, ${l.size}px)`);
      const small = await page.evaluate(TARGET_SCRIPT);
      for (const t of small) say(`${label}: target ${t.w}x${t.h} "${t.text}" (${t.sel})`);
      if (errors.length) say(`${label}: errors ${errors.join(" | ")}`);
      // The Display control, keyboard only, once per page in the first rendering/width.
      if (rendering.tag === "dark" && width === 1280) {
        const toggle = page.locator(".display-toggle");
        await toggle.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
        const open = await page.locator("#display-panel").isVisible();
        const focused = await page.evaluate(() => document.activeElement?.id);
        if (!open || focused !== "display-theme-dark") say(`${label}: panel open=${open} focus=${focused}`);
        // The sheet is open and nothing is mid-transition: audit its own text
        // and targets now, before the theme is changed below. (After a switch,
        // links inside not-yet-revealed content keep their old colour until
        // they scroll into view, which would be reported as a false failure.)
        for (const l of await page.evaluate(CONTRAST_SCRIPT)) say(label + ": sheet contrast " + l.r + ' "' + l.text + '" (' + l.sel + ")");
        for (const t of await page.evaluate(TARGET_SCRIPT)) say(label + ": sheet target " + t.w + "x" + t.h + ' "' + t.text + '" (' + t.sel + ")");
        await page.keyboard.press("ArrowRight");
        const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (theme !== "light") say(`${label}: arrow key did not switch theme (got ${theme})`);
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("bf-display")));
        if (stored.theme !== "light") say(`${label}: not persisted ${JSON.stringify(stored)}`);
        await page.keyboard.press("Escape");
        // Closing is a transition; wait for the sheet to be hidden, not a fixed delay.
        await page.locator("#display-panel").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
        const closed = await page.locator("#display-panel").isHidden();
        const back = await page.evaluate(() => document.activeElement?.className);
        if (!closed || !/display-toggle/.test(back)) say(`${label}: Escape close=${closed} focus=${back}`);
        // every focusable gets a visible ring
        const rings = await page.evaluate(() => {
          const out = []; const els = [...document.querySelectorAll("a, button, summary, [tabindex]:not([tabindex='-1'])")].filter((e) => !e.closest("[hidden]") && e.getBoundingClientRect().width > 0);
          for (const e of els.slice(0, 80)) { if (e.disabled) continue; e.focus(); if (document.activeElement !== e) { out.push("UNFOCUSABLE " + (e.className || e.tagName) + " " + (e.textContent||"").trim().slice(0,20)); continue; } const cs = getComputedStyle(e); if (cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2) out.push(e.className || e.tagName); }
          return out;
        });
        for (const r of rings) say(`${label}: no focus ring on ${r}`);
      }
      // The compact menu is a bottom sheet: keyboard open, content, close, focus.
      if (rendering.tag === "dark" && width === 320) {
        const navToggle = page.locator(".nav-toggle");
        await navToggle.focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
        const visible = await page.locator("#nav-sheet").isVisible();
        const links = await page.locator("#nav-sheet a").count();
        const expanded = await navToggle.getAttribute("aria-expanded");
        if (!visible || links !== 5 || expanded !== "true") say(label + ": nav sheet visible=" + visible + " links=" + links + " expanded=" + expanded);
        for (const l of await page.evaluate(CONTRAST_SCRIPT)) say(label + ": nav sheet contrast " + l.r + ' "' + l.text + '" (' + l.sel + ")");
        for (const t of await page.evaluate(TARGET_SCRIPT)) say(label + ": nav sheet target " + t.w + "x" + t.h + ' "' + t.text + '" (' + t.sel + ")");
        await page.keyboard.press("Escape");
        await page.locator("#nav-sheet").waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
        const closedNav = await page.locator("#nav-sheet").isHidden();
        const backTo = await page.evaluate(() => document.activeElement?.className);
        if (!closedNav || !/nav-toggle/.test(backTo)) say(label + ": nav sheet Escape closed=" + closedNav + " focus=" + backTo);
      }
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(problems === 0 ? "AUDIT CLEAN" : `AUDIT: ${problems} problems`);
