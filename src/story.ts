/**
 * The site's theme is a commit log, and this module is what makes the home
 * page read as one: the trunk the chapters sit on, the story strip that
 * draws its line as you read it, sections that arrive as you reach them,
 * and résumé figures that count up to the number the page already states.
 *
 * Three rules hold everything here to DESIGN.md R27/R28:
 *
 *   1. **Nothing depends on this running.** Every element is in the DOM at
 *      its final state before this module touches it. The reveal classes
 *      are ADDED here, so with scripting off nothing is hidden; the counter
 *      animates a visible copy and leaves the real figure for assistive
 *      technology; the trunk is a page-local nav that is only built when
 *      there is room for it.
 *   2. **Reduced motion means the final state, immediately.** Both sources
 *      (OS preference and the Display control) are read through
 *      prefersReducedMotion(); when it is set, no observer is attached, no
 *      counter runs, and the trunk is drawn complete.
 *   3. **Motion explains change.** A section fades up once, as it enters;
 *      the story's line draws once, as its beats are reached; the trunk
 *      fills in step with how far the reader has come. None of it loops.
 */
import { prefersReducedMotion } from "./display.js";

const REVEAL_SELECTOR = [
  ".section-head",
  ".ledger-row",
  ".entry",
  ".stat-list > div",
  ".strength",
  ".about-col",
  ".deck",
  ".about-outro",
  ".contact-pair",
  ".prose > p",
  ".prose > h2",
  ".shot",
  ".transcript",
  ".lang-chart-figure",
].join(", ");

/** Fade-up on entry, once, with a small stagger between siblings that arrive together. */
function mountReveals(): void {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  if (targets.length === 0) return;

  targets.forEach((el) => el.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      // Elements that cross together are staggered by their order, 60ms
      // apart (the skill's 0.02–0.1s band), so a column of records deals in
      // rather than popping as one slab.
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.setProperty("--reveal-delay", `${Math.min(step, 6) * 60}ms`);
        el.classList.add("is-seen");
        observer.unobserve(el);
        step += 1;
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  targets.forEach((el) => observer.observe(el));
}

/**
 * Count a résumé figure up to itself. The element's text is the truth and
 * stays in the tree for assistive technology inside a visually-hidden span;
 * the counting happens in an aria-hidden twin, so a screen reader never
 * hears "two thousand" on its way to "sixteen thousand".
 */
function mountCounters(): void {
  const figures = Array.from(document.querySelectorAll<HTMLElement>(".stat-list dt"));
  const pattern = /^([^\d]*)(\d[\d,]*)(\.\d+)?(.*)$/s;

  const prepared = figures.flatMap((dt) => {
    const text = dt.textContent?.trim() ?? "";
    const match = pattern.exec(text);
    if (!match) return [];
    const [, prefix = "", whole = "0", fraction = "", suffix = ""] = match;
    const target = Number(whole.replace(/,/g, ""));
    if (!Number.isFinite(target)) return [];
    const decimals = fraction ? fraction.length - 1 : 0;
    const grouped = whole.includes(",");

    const real = document.createElement("span");
    real.className = "visually-hidden";
    real.textContent = text;
    const shown = document.createElement("span");
    shown.setAttribute("aria-hidden", "true");
    shown.textContent = text;
    dt.replaceChildren(real, shown);

    return [{ dt, shown, prefix, suffix, target, decimals, grouped, fraction }];
  });
  if (prepared.length === 0) return;

  const format = (value: number, item: (typeof prepared)[number]): string => {
    const fixed = value.toFixed(item.decimals);
    const [whole = "0", frac] = fixed.split(".");
    const body = item.grouped ? Number(whole).toLocaleString("en-US") : whole;
    return `${item.prefix}${body}${frac !== undefined ? `.${frac}` : ""}${item.suffix}`;
  };

  const run = (item: (typeof prepared)[number]): void => {
    const duration = 900;
    const start = performance.now();
    const frame = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      item.shown.textContent = format(item.target * eased, item);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Land exactly on the authored text, whatever the rounding did.
        item.shown.textContent = item.dt.querySelector(".visually-hidden")?.textContent ?? item.shown.textContent;
      }
    };
    item.shown.textContent = format(0, item);
    requestAnimationFrame(frame);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = prepared.find((candidate) => candidate.dt === entry.target);
        if (item) run(item);
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.5 },
  );
  prepared.forEach((item) => observer.observe(item.dt));
}

/**
 * The story strip: a line that draws from beat to beat as each is reached.
 * The beats are plain list items; the line is CSS, keyed off `.is-seen` on
 * each item, so this only has to observe.
 */
function mountStoryLine(): void {
  const beats = Array.from(document.querySelectorAll<HTMLElement>(".story-beat"));
  if (beats.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.style.setProperty("--beat-delay", `${beats.indexOf(el) * 90}ms`);
        el.classList.add("is-seen");
        observer.unobserve(el);
      }
    },
    { threshold: 0.35 },
  );
  beats.forEach((el) => observer.observe(el));
}

/**
 * The trunk: a page-local nav drawn down the left margin of the home page,
 * one node per numbered chapter, the line between them filling as the
 * reader moves down. It is a real <nav> of real links (so it is also a table
 * of contents) and the current chapter carries aria-current. Only built
 * where there is a margin to put it in; the media query below is the point
 * at which the ruled ground's margin is wide enough to hold a 2.5rem column.
 */
function mountTrunk(reduced: boolean): void {
  const main = document.querySelector<HTMLElement>("main");
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>(".wrap > section:not(.hero):not(.bento-section)[id][aria-labelledby]"),
  );
  if (!main || sections.length < 2) return;

  const nav = document.createElement("nav");
  nav.className = "trunk";
  nav.setAttribute("aria-label", "Chapters on this page");

  const track = document.createElement("div");
  track.className = "trunk-track";
  track.setAttribute("aria-hidden", "true");
  const fill = document.createElement("div");
  fill.className = "trunk-fill";
  track.appendChild(fill);

  const list = document.createElement("ol");
  list.className = "trunk-list";
  const links: HTMLAnchorElement[] = [];
  sections.forEach((section, index) => {
    const heading = document.getElementById(section.getAttribute("aria-labelledby") ?? "");
    const title = heading?.textContent?.trim() ?? section.id;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.className = "trunk-node";
    link.innerHTML = `<span class="trunk-numeral" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span class="trunk-label">${title}</span>`;
    item.appendChild(link);
    list.appendChild(item);
    links.push(link);
  });

  nav.append(track, list);
  main.prepend(nav);

  const setCurrent = (index: number): void => {
    links.forEach((link, i) => {
      if (i === index) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
      link.classList.toggle("is-committed", i <= index);
    });
  };

  // Progress along the trunk: 0 at the first chapter's top, 1 at the last.
  const update = (): void => {
    const probe = window.scrollY + window.innerHeight * 0.4;
    const tops = sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
    const first = tops[0] ?? 0;
    const last = tops[tops.length - 1] ?? first;
    const progress = reduced ? 1 : Math.max(0, Math.min(1, (probe - first) / Math.max(1, last - first)));
    fill.style.setProperty("--trunk-progress", String(progress));
    let current = -1;
    tops.forEach((top, i) => {
      if (probe >= top) current = i;
    });
    setCurrent(current);
  };

  let ticking = false;
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

/**
 * The local time where he is, in the spec sheet. A fact about the place, kept
 * live: it is read once a minute and never announced (aria-live="off" in the
 * markup), so a screen reader hears whatever it is when it gets there.
 */
function mountLocalTime(): void {
  const el = document.querySelector<HTMLTimeElement>("[data-local-time]");
  if (!el || typeof Intl === "undefined") return;
  const zone = "America/Indiana/Indianapolis";
  let clock: Intl.DateTimeFormat;
  let stamp: Intl.DateTimeFormat;
  try {
    clock = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return;
  }
  const tick = (): void => {
    const now = new Date();
    el.textContent = clock.format(now);
    el.dateTime = stamp.format(now);
  };
  tick();
  // Align to the next minute, then every minute.
  const toNextMinute = 60_000 - (Date.now() % 60_000);
  window.setTimeout(() => {
    tick();
    window.setInterval(tick, 60_000);
  }, toNextMinute);
}

/**
 * "Copy" beside the email address, only where the clipboard API exists: the
 * mailto link is the real route and works regardless. The result is spoken
 * through the tile's status line and shown on the button for ~2s.
 */
function mountCopyEmail(): void {
  const mount = document.querySelector<HTMLElement>("[data-copy-email]");
  const status = document.querySelector<HTMLElement>("[data-copy-status]");
  const address = mount?.getAttribute("data-copy-email") ?? "";
  if (!mount || !status || !address || !navigator.clipboard?.writeText) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-btn";
  button.textContent = "Copy";
  button.setAttribute("aria-label", `Copy ${address}`);
  mount.replaceChildren(button);

  let timer = 0;
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(address);
      button.textContent = "Copied";
      button.setAttribute("data-copied", "true");
      status.textContent = `${address} copied to the clipboard.`;
    } catch {
      button.textContent = "Copy";
      status.textContent = "Could not copy. The address is the link beside this button.";
      return;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.textContent = "Copy";
      button.removeAttribute("data-copied");
    }, 2000);
  });
}

export function mountStory(): void {
  mountLocalTime();
  mountCopyEmail();
  const reduced = prefersReducedMotion();
  if (!reduced && "IntersectionObserver" in window) {
    mountReveals();
    mountCounters();
    mountStoryLine();
  } else {
    // Final state, immediately: the story line fully drawn, nothing hidden.
    document.querySelectorAll<HTMLElement>(".story-beat").forEach((el) => el.classList.add("is-seen"));
  }
  if (document.body.getAttribute("data-page") === "home") {
    mountTrunk(reduced);
  }
}
