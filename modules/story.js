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
  ".lang-chart-figure"
].join(", ");
function mountReveals() {
  const targets = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
  if (targets.length === 0) return;
  targets.forEach((el) => el.classList.add("reveal"));
  const observer = new IntersectionObserver(
    (entries) => {
      let step = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.style.setProperty("--reveal-delay", `${Math.min(step, 6) * 60}ms`);
        el.classList.add("is-seen");
        observer.unobserve(el);
        step += 1;
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  targets.forEach((el) => observer.observe(el));
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
  const run = (item) => {
    const duration = 900;
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t) * (1 - t);
      item.shown.textContent = format(item.target * eased, item);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
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
    { threshold: 0.5 }
  );
  prepared.forEach((item) => observer.observe(item.dt));
}
function mountStoryLine() {
  const beats = Array.from(document.querySelectorAll(".story-beat"));
  if (beats.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        el.style.setProperty("--beat-delay", `${beats.indexOf(el) * 90}ms`);
        el.classList.add("is-seen");
        observer.unobserve(el);
      }
    },
    { threshold: 0.35 }
  );
  beats.forEach((el) => observer.observe(el));
}
function mountTrunk(reduced) {
  const main = document.querySelector("main");
  const sections = Array.from(
    document.querySelectorAll(".wrap > section:not(.hero)[id][aria-labelledby]")
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
    let current = 0;
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
function mountStory() {
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
