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
 *      counter runs, and the trunk is drawn complete. If it is set after the
 *      page has loaded, every effect is disposed on the spot (see
 *      mountStory()), so the choice does not wait for a reload.
 *   3. **Motion explains change, and replays it.** A section fades up each
 *      time it enters the screen, scrolling down or back up; the story's line
 *      redraws as its beats are reached again; figures count up again. An
 *      element is reset only after it is well off screen, so no one ever sees
 *      a reset. Nothing loops while you read.
 */
import { prefersReducedMotion } from "./display.js";

const REVEAL_SELECTOR = [
  ".bento > .tile",
  ".page-hero > :not([data-project-motif])",
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

/**
 * Run `enter` each time an element comes into view and `leave` each time it
 * has gone well out of view, so an animation can be replayed on the way back.
 *
 * Two observers do it. The first fires as an element crosses the viewport; the
 * second watches a band 35% of a screen taller on both sides and fires only
 * once the element has left that band. The gap is the point: the reset happens
 * where nobody is looking, so scrolling back never shows a half-reset element.
 * `enter` receives the element's position among those that crossed in the same
 * callback, for staggering.
 *
 * The returned function disposes of the effect: it disconnects both observers
 * and calls `settle` on every target, which must leave the element in its final
 * state with nothing of the effect remaining.
 */
function observeReplay(
  targets: readonly HTMLElement[],
  handlers: {
    enter(el: HTMLElement, step: number): void;
    leave(el: HTMLElement): void;
    settle(el: HTMLElement): void;
  },
  enterOptions: IntersectionObserverInit,
): () => void {
  const shown = new Set<HTMLElement>();

  const enter = new IntersectionObserver((entries) => {
    let step = 0;
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      if (!entry.isIntersecting || shown.has(el)) continue;
      shown.add(el);
      handlers.enter(el, step);
      step += 1;
    }
  }, enterOptions);

  const leave = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting || !shown.has(el)) continue;
        shown.delete(el);
        handlers.leave(el);
      }
    },
    { rootMargin: "35% 0px 35% 0px", threshold: 0 },
  );

  for (const el of targets) {
    enter.observe(el);
    leave.observe(el);
  }

  return () => {
    enter.disconnect();
    leave.disconnect();
    shown.clear();
    for (const el of targets) handlers.settle(el);
  };
}

/** Fade-up on every entry, with a small stagger between elements that arrive together. */
function mountReveals(): (() => void) | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR));
  if (targets.length === 0) return null;

  for (const el of targets) {
    el.classList.add("reveal");
    // The stagger delay is for the entrance only. Once the fade has finished,
    // drop it so a later hover transition on the same element is not delayed.
    el.addEventListener("transitionend", (event: TransitionEvent) => {
      if (event.target === el && event.propertyName === "opacity" && el.classList.contains("is-seen")) {
        el.style.removeProperty("--reveal-delay");
      }
    });
  }

  const dispose = observeReplay(
    targets,
    {
      // Elements that cross together are staggered 60ms apart (the skill's
      // 0.02–0.1s band), so a column of records deals in rather than popping
      // as one slab.
      enter(el, step) {
        el.style.setProperty("--reveal-delay", `${Math.min(step, 6) * 60}ms`);
        el.classList.add("is-seen");
      },
      leave(el) {
        el.classList.remove("is-seen");
        el.style.removeProperty("--reveal-delay");
      },
      // Reduced motion chosen after load: no class, nothing hidden.
      settle(el) {
        el.classList.remove("reveal", "is-seen");
        el.style.removeProperty("--reveal-delay");
      },
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );

  // From here the stylesheet's own hidden state takes over from the
  // pre-hide that covered the first paint (see "the story" in styles.css).
  document.documentElement.classList.add("reveal-ready");
  return dispose;
}

/**
 * Count a résumé figure up to itself, every time it comes into view. The
 * element's text is the truth and stays in the tree for assistive technology
 * inside a visually-hidden span; the counting happens in an aria-hidden twin,
 * so a screen reader never hears "two thousand" on its way to "sixteen
 * thousand". Leaving the screen cancels a count in progress and puts the
 * authored text back, so the figure is never left showing a number it did not
 * reach.
 */
function mountCounters(): (() => void) | null {
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
  if (prepared.length === 0) return null;

  const format = (value: number, item: (typeof prepared)[number]): string => {
    const fixed = value.toFixed(item.decimals);
    const [whole = "0", frac] = fixed.split(".");
    const body = item.grouped ? Number(whole).toLocaleString("en-US") : whole;
    return `${item.prefix}${body}${frac !== undefined ? `.${frac}` : ""}${item.suffix}`;
  };

  const frames = new Map<HTMLElement, number>();

  const settle = (item: (typeof prepared)[number]): void => {
    // Land exactly on the authored text, whatever the rounding did.
    item.shown.textContent = item.dt.querySelector(".visually-hidden")?.textContent ?? item.shown.textContent;
  };

  const stop = (item: (typeof prepared)[number]): void => {
    const pending = frames.get(item.dt);
    if (pending !== undefined) cancelAnimationFrame(pending);
    frames.delete(item.dt);
  };

  const run = (item: (typeof prepared)[number]): void => {
    stop(item);
    const duration = 900;
    const start = performance.now();
    const frame = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      item.shown.textContent = format(item.target * eased, item);
      if (t < 1) {
        frames.set(item.dt, requestAnimationFrame(frame));
      } else {
        frames.delete(item.dt);
        settle(item);
      }
    };
    item.shown.textContent = format(0, item);
    frames.set(item.dt, requestAnimationFrame(frame));
  };

  const byElement = new Map(prepared.map((item) => [item.dt, item]));
  const finish = (el: HTMLElement): void => {
    const item = byElement.get(el);
    if (!item) return;
    stop(item);
    settle(item);
  };
  return observeReplay(
    prepared.map((item) => item.dt),
    {
      enter(el) {
        const item = byElement.get(el);
        if (item) run(item);
      },
      leave: finish,
      settle: finish,
    },
    { threshold: 0.5 },
  );
}

/**
 * The story strip: a line that draws from beat to beat each time the beats are
 * reached, scrolling down or back up. The beats are plain list items; the line
 * is CSS, keyed off `.is-seen` on each item, so this only toggles the class.
 */
function mountStoryLine(): (() => void) | null {
  const beats = Array.from(document.querySelectorAll<HTMLElement>(".story-beat"));
  if (beats.length === 0) return null;
  return observeReplay(
    beats,
    {
      enter(el) {
        el.style.setProperty("--beat-delay", `${beats.indexOf(el) * 90}ms`);
        el.classList.add("is-seen");
      },
      leave(el) {
        el.classList.remove("is-seen");
        el.style.removeProperty("--beat-delay");
      },
      // Final state of the strip is fully drawn.
      settle(el) {
        el.classList.add("is-seen");
        el.style.removeProperty("--beat-delay");
      },
    },
    { threshold: 0.35 },
  );
}

/**
 * The trunk: a page-local nav drawn down the left margin of the home page,
 * one node per numbered chapter, the line between them filling as the
 * reader moves down. It is a real <nav> of real links (so it is also a table
 * of contents) and the current chapter carries aria-current. Only built
 * where there is a margin to put it in; the media query below is the point
 * at which the ruled ground's margin is wide enough to hold a 2.5rem column.
 */
function mountTrunk(): void {
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
    const progress = prefersReducedMotion() ? 1 : Math.max(0, Math.min(1, (probe - first) / Math.max(1, last - first)));
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

/**
 * Mount every effect, and keep the page honest if the motion choice changes
 * while it is open. The Display control announces a change with a
 * `display-change` event on the document; the OS setting is watched directly.
 * Going to reduced motion disposes of each effect at once (observers
 * disconnected, counters settled, reveal classes removed, the story strip
 * drawn complete). Going back to full motion is picked up on the next load.
 */
export function mountStory(): void {
  mountLocalTime();
  mountCopyEmail();
  const disposers: Array<() => void> = [];
  if (!prefersReducedMotion() && "IntersectionObserver" in window) {
    for (const mount of [mountReveals, mountCounters, mountStoryLine]) {
      const dispose = mount();
      if (dispose) disposers.push(dispose);
    }
  } else {
    // Final state, immediately: the story line fully drawn, nothing hidden.
    document.querySelectorAll<HTMLElement>(".story-beat").forEach((el) => el.classList.add("is-seen"));
  }
  if (document.body.getAttribute("data-page") === "home") {
    mountTrunk();
  }

  const onMotionChange = (): void => {
    if (!prefersReducedMotion()) return;
    for (const dispose of disposers.splice(0)) dispose();
  };
  document.addEventListener("display-change", onMotionChange);
  if (typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", onMotionChange);
  }
}
