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
  ".lang-chart-figure"
].join(", ");
function observeReplay(targets, handlers, enterOptions) {
  const shown = /* @__PURE__ */ new Set();
  const enter = new IntersectionObserver((entries) => {
    let step = 0;
    for (const entry of entries) {
      const el = entry.target;
      if (!entry.isIntersecting || shown.has(el)) continue;
      shown.add(el);
      handlers.enter(el, step);
      step += 1;
    }
  }, enterOptions);
  const leave = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (entry.isIntersecting || !shown.has(el)) continue;
        shown.delete(el);
        handlers.leave(el);
      }
    },
    { rootMargin: "35% 0px 35% 0px", threshold: 0 }
  );
  for (const el of targets) {
    enter.observe(el);
    leave.observe(el);
  }
}
function mountReveals() {
  const targets = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
  if (targets.length === 0) return;
  for (const el of targets) {
    el.classList.add("reveal");
    el.addEventListener("transitionend", (event) => {
      if (event.target === el && event.propertyName === "opacity" && el.classList.contains("is-seen")) {
        el.style.removeProperty("--reveal-delay");
      }
    });
  }
  observeReplay(
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
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  document.documentElement.classList.add("reveal-ready");
}
function mountCounters() {
  const figures = Array.from(document.querySelectorAll(".stat-list dt"));
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
  const format = (value, item) => {
    const fixed = value.toFixed(item.decimals);
    const [whole = "0", frac] = fixed.split(".");
    const body = item.grouped ? Number(whole).toLocaleString("en-US") : whole;
    return `${item.prefix}${body}${frac !== void 0 ? `.${frac}` : ""}${item.suffix}`;
  };
  const frames = /* @__PURE__ */ new Map();
  const settle = (item) => {
    item.shown.textContent = item.dt.querySelector(".visually-hidden")?.textContent ?? item.shown.textContent;
  };
  const stop = (item) => {
    const pending = frames.get(item.dt);
    if (pending !== void 0) cancelAnimationFrame(pending);
    frames.delete(item.dt);
  };
  const run = (item) => {
    stop(item);
    const duration = 900;
    const start = performance.now();
    const frame = (now) => {
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
  observeReplay(
    prepared.map((item) => item.dt),
    {
      enter(el) {
        const item = byElement.get(el);
        if (item) run(item);
      },
      leave(el) {
        const item = byElement.get(el);
        if (!item) return;
        stop(item);
        settle(item);
      }
    },
    { threshold: 0.5 }
  );
}
function mountStoryLine() {
  const beats = Array.from(document.querySelectorAll(".story-beat"));
  if (beats.length === 0) return;
  observeReplay(
    beats,
    {
      enter(el) {
        el.style.setProperty("--beat-delay", `${beats.indexOf(el) * 90}ms`);
        el.classList.add("is-seen");
      },
      leave(el) {
        el.classList.remove("is-seen");
        el.style.removeProperty("--beat-delay");
      }
    },
    { threshold: 0.35 }
  );
}
function mountTrunk(reduced) {
  const main = document.querySelector("main");
  const sections = Array.from(
    document.querySelectorAll(".wrap > section:not(.hero):not(.bento-section)[id][aria-labelledby]")
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
  const links = [];
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
  const setCurrent = (index) => {
    links.forEach((link, i) => {
      if (i === index) {
        link.setAttribute("aria-current", "location");
      } else {
        link.removeAttribute("aria-current");
      }
      link.classList.toggle("is-committed", i <= index);
    });
  };
  const update = () => {
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
  const onScroll = () => {
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
function mountLocalTime() {
  const el = document.querySelector("[data-local-time]");
  if (!el || typeof Intl === "undefined") return;
  const zone = "America/Indiana/Indianapolis";
  let clock;
  let stamp;
  try {
    clock = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    stamp = new Intl.DateTimeFormat("sv-SE", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return;
  }
  const tick = () => {
    const now = /* @__PURE__ */ new Date();
    el.textContent = clock.format(now);
    el.dateTime = stamp.format(now);
  };
  tick();
  const toNextMinute = 6e4 - Date.now() % 6e4;
  window.setTimeout(() => {
    tick();
    window.setInterval(tick, 6e4);
  }, toNextMinute);
}
function mountCopyEmail() {
  const mount = document.querySelector("[data-copy-email]");
  const status = document.querySelector("[data-copy-status]");
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
    }, 2e3);
  });
}
function mountStory() {
  mountLocalTime();
  mountCopyEmail();
  const reduced = prefersReducedMotion();
  if (!reduced && "IntersectionObserver" in window) {
    mountReveals();
    mountCounters();
    mountStoryLine();
  } else {
    document.querySelectorAll(".story-beat").forEach((el) => el.classList.add("is-seen"));
  }
  if (document.body.getAttribute("data-page") === "home") {
    mountTrunk(reduced);
  }
}
export {
  mountStory
};
