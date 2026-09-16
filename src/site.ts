import { PORTFOLIO } from "./data.js";
import { icon } from "./icons.js";
import { mountDecks } from "./deck.js";
import { mountGuestWindows } from "./guestWindow.js";
import { ROUTES } from "./routes.js";
import type { ProjectId } from "./types.js";

const page = document.body.getAttribute("data-page") ?? "";

const header = document.querySelector<HTMLElement>("[data-site-header]");
if (header) {
  header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="nav-wrap">
        <a class="brand" href="${ROUTES.home}">
          <span class="brand-mark" aria-hidden="true">BF</span>
          <span class="brand-text">
            <strong>Bailey Forbes</strong>
            <span>Indiana</span>
          </span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <ul class="nav-links" id="site-nav">
          <li><a data-nav="home" href="${ROUTES.home}">Home</a></li>
          <li><a data-nav="projects" href="${ROUTES.projects}">Projects</a></li>
          <li><a data-nav="experience" href="${ROUTES.experience}">Experience</a></li>
          <li><a data-nav="about" href="${ROUTES.about}">About</a></li>
          <li><a data-nav="contact" href="${ROUTES.contact}">Contact</a></li>
        </ul>
      </div>
    `;
}

const footer = document.querySelector<HTMLElement>("[data-site-footer]");
if (footer) {
  footer.innerHTML = `
      <div class="wrap footer-grid">
        <p>
          © 2026 Bailey P Forbes. Project timelines are compiled from public git history on
          <a href="https://github.com/BPForbes">github.com/BPForbes</a>, 11 Sep 2026.
        </p>
        <ul class="footer-links">
          <li><a href="mailto:baileyforbes@rocketmail.com">${icon("envelope")}Email Bailey</a></li>
          <li><a href="https://www.linkedin.com/in/bailey-preston-forbes">${icon("linkedin-in")}LinkedIn</a></li>
          <li><a href="https://github.com/BPForbes">${icon("github")}GitHub</a></li>
        </ul>
      </div>
    `;
}

document.querySelectorAll<HTMLAnchorElement>(`[data-nav="${page}"]`).forEach((link) => {
  link.setAttribute("aria-current", "page");
});

const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
const links = document.querySelector<HTMLElement>(".nav-links");
if (toggle && links) {
  const setOpen = (open: boolean): void => {
    links.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", () => {
    setOpen(!links.classList.contains("is-open"));
  });

  // A tapped destination must close the menu, otherwise an in-page hash link
  // leaves the panel covering the section it just scrolled to.
  links.addEventListener("click", (event: MouseEvent) => {
    if (event.target instanceof HTMLAnchorElement) {
      setOpen(false);
    }
  });

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape" && links.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

function isProjectId(value: string): value is ProjectId {
  return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}

document.querySelectorAll<HTMLElement>("[data-lang-bar]").forEach((el) => {
  const key = el.getAttribute("data-lang-bar");
  if (!key || !isProjectId(key)) {
    return;
  }

  const langs = PORTFOLIO.languages[key];
  if (!langs) {
    return;
  }

  const bar = document.createElement("div");
  bar.className = "lang-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    `Language split: ${langs.map((lang) => `${lang.name} ${lang.pct} percent`).join(", ")}`,
  );

  const legend = document.createElement("div");
  legend.className = "lang-legend";

  for (const lang of langs) {
    const seg = document.createElement("span");
    seg.className = "lang-seg";
    seg.style.width = `${lang.pct}%`;
    seg.style.background = lang.color;
    bar.appendChild(seg);

    const item = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = "lang-swatch";
    swatch.style.background = lang.color;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, document.createTextNode(`${lang.name} ${lang.pct}%`));
    legend.appendChild(item);
  }

  el.append(bar, legend);
});

/**
 * The project timeline: a vertical git graph down the right rail.
 *
 * Each entry is a link to the commit that carries it, so the whole row is one
 * target and the keyboard gets the reveal for free — the detail and the commit
 * line are shown on hover, on focus, and on whichever entry the page is
 * currently scrolled to. That last one matters: a reveal that only answers to
 * hover is unreachable on a touch screen (DESIGN.md R24).
 *
 * Entries without a commit are still rendered, as a span rather than a link,
 * because pretending they link somewhere would be worse than saying they do
 * not (R21).
 */
function renderTimeline(mount: HTMLElement): void {
  const events = [...PORTFOLIO.events].sort((a, b) => a.date.localeCompare(b.date));
  const allowed = (mount.getAttribute("data-project") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isProjectId);
  const hideProjectChip = mount.hasAttribute("data-hide-project-chip");

  const visible = events.filter(
    (event) => allowed.length === 0 || allowed.includes(event.project),
  );

  mount.replaceChildren();

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty";
    empty.textContent = "No timeline entries have been compiled for this project yet.";
    mount.appendChild(empty);
    return;
  }

  const graph = document.createElement("div");
  graph.className = "tl-graph";

  // The travelling glow. It is one element behind the spine, moved and scaled
  // from scroll position, so it costs a transform rather than a repaint.
  const glow = document.createElement("span");
  glow.className = "tl-glow";
  glow.setAttribute("aria-hidden", "true");
  graph.appendChild(glow);

  const list = document.createElement("ol");
  list.className = "tl-list";

  for (const event of visible) {
    const item = document.createElement("li");
    item.className = "tl-item";
    item.dataset.kind = event.kind;

    const row = document.createElement(event.href === undefined ? "span" : "a");
    row.className = "tl-node";
    if (row instanceof HTMLAnchorElement && event.href !== undefined) {
      row.href = event.href;
      row.rel = "noopener";
    }

    const mark = document.createElement("span");
    mark.className = "tl-mark";
    mark.setAttribute("aria-hidden", "true");

    const head = document.createElement("span");
    head.className = "tl-head";

    const date = document.createElement("time");
    date.className = "tl-date";
    date.dateTime = event.date;
    date.textContent = event.date;

    const title = document.createElement("span");
    title.className = "tl-title";
    title.textContent = event.title;
    head.append(date, title);

    const body = document.createElement("span");
    body.className = "tl-detail";

    // One child only: the 0fr -> 1fr collapse sizes a single row, so a second
    // direct child would land in an implicit auto row and escape the collapse.
    const inner = document.createElement("span");
    inner.className = "tl-detail-inner";
    body.appendChild(inner);

    const detail = document.createElement("span");
    detail.className = "tl-summary";
    detail.textContent = event.detail;
    inner.appendChild(detail);

    const meta = document.createElement("span");
    meta.className = "tl-meta";

    if (!hideProjectChip) {
      const projectChip = document.createElement("span");
      projectChip.className = "chip";
      projectChip.textContent = PORTFOLIO.projects[event.project];
      meta.appendChild(projectChip);
    }

    const kindChip = document.createElement("span");
    kindChip.className = "chip";
    kindChip.innerHTML = icon(event.kind === "release" ? "tag" : "code-branch");
    kindChip.append(event.kind);
    meta.appendChild(kindChip);

    if (event.href !== undefined) {
      const open = document.createElement("span");
      open.className = "chip tl-open";
      open.innerHTML = icon("arrow-up-right-from-square");
      open.append("View the commit");
      meta.appendChild(open);
    }

    inner.appendChild(meta);
    row.append(mark, head, body);
    item.appendChild(row);
    list.appendChild(item);
  }

  graph.appendChild(list);
  mount.appendChild(graph);
  trackTimeline(graph, list);
}

/**
 * Marks the entry the page is scrolled to, and drives the glow. The glow
 * stretches with scroll speed — slow reading barely shows it, a fast scrub
 * pulls it into a streak — and fades out once the page stops moving.
 */
function trackTimeline(graph: HTMLElement, list: HTMLElement): void {
  const items = Array.from(list.querySelectorAll<HTMLElement>(".tl-item"));
  if (items.length === 0) {
    return;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Still mark the active entry; just never animate the spine (R26).
    graph.dataset.still = "true";
  }

  let lastY = window.scrollY;
  let lastT = performance.now();
  let speed = 0;
  let queued = false;

  const update = (): void => {
    queued = false;
    const now = performance.now();
    const dt = Math.max(16, now - lastT);
    const dy = window.scrollY - lastY;
    // px per frame, smoothed, so one jumpy frame does not spike the streak
    speed = speed * 0.72 + Math.min(1, Math.abs(dy) / dt / 2.2) * 0.28;
    lastY = window.scrollY;
    lastT = now;

    const box = graph.getBoundingClientRect();
    const focusLine = window.innerHeight * 0.42;

    let active = -1;
    let best = Infinity;
    items.forEach((item, index) => {
      const r = item.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - focusLine);
      if (d < best) {
        best = d;
        active = index;
      }
    });

    items.forEach((item, index) => {
      item.dataset.active = String(index === active);
    });

    // Where the glow sits along the spine, 0 at the top of the graph.
    const progress = Math.min(1, Math.max(0, (focusLine - box.top) / Math.max(1, box.height)));
    graph.style.setProperty("--tl-progress", progress.toFixed(4));
    graph.style.setProperty("--tl-speed", speed.toFixed(3));
  };

  // Scroll events stop the moment the page does, so the smoothed speed would
  // freeze part-lit. Keep stepping until it has actually decayed to nothing.
  const settle = (): void => {
    if (speed <= 0.002) {
      speed = 0;
      graph.style.setProperty("--tl-speed", "0");
      return;
    }
    update();
    requestAnimationFrame(settle);
  };

  let settling = 0;
  const onScroll = (): void => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(update);
    }
    window.clearTimeout(settling);
    settling = window.setTimeout(settle, 90);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

document.querySelectorAll<HTMLElement>("[data-timeline]").forEach(renderTimeline);

mountGuestWindows();
mountDecks();
