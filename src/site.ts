import { PORTFOLIO } from "./data.js";
import { mountGuestWindows } from "./guestWindow.js";
import type { ProjectId, TimelineFilter } from "./types.js";

const root = document.body.getAttribute("data-root") ?? ".";
const page = document.body.getAttribute("data-page") ?? "";

function fromRoot(path: string): string {
  const rel = path.replace(/^\/+/, "");
  if (root === "" || root === "/") {
    return `/${rel}`;
  }
  return `${root.replace(/\/+$/, "")}/${rel}`;
}

const header = document.querySelector<HTMLElement>("[data-site-header]");
if (header) {
  header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="nav-wrap">
        <a class="brand" href="${fromRoot("index.html")}">
          <span class="brand-mark">BF</span>
          <span class="brand-text">
            <strong>Bailey Forbes</strong>
            <span>Release ledger</span>
          </span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <ul class="nav-links" id="site-nav">
          <li><a data-nav="home" href="${fromRoot("index.html")}">Home</a></li>
          <li><a data-nav="projects" href="${fromRoot("projects/index.html")}">Projects</a></li>
          <li><a data-nav="timeline" href="${fromRoot("timeline.html")}">Timeline</a></li>
          <li><a data-nav="experience" href="${fromRoot("index.html#experience")}">Experience</a></li>
        </ul>
      </div>
    `;
}

const footer = document.querySelector<HTMLElement>("[data-site-footer]");
if (footer) {
  footer.innerHTML = `
      <div class="wrap footer-grid">
        <p>© 2026 Bailey P Forbes. Timelines compiled from public git history on 11 Sep 2026.</p>
        <p>
          <a href="https://github.com/BPForbes">GitHub</a>
          · <a href="https://www.linkedin.com/in/bailey-preston-forbes">LinkedIn</a>
          · <a href="mailto:baileyforbes@rocketmail.com">Email</a>
        </p>
      </div>
    `;
}

document.querySelectorAll<HTMLAnchorElement>(`[data-nav="${page}"]`).forEach((link) => {
  link.setAttribute("aria-current", "page");
});

const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
const links = document.querySelector<HTMLElement>(".nav-links");
if (toggle && links) {
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
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
  const legend = document.createElement("div");
  legend.className = "lang-legend";

  for (const lang of langs) {
    const seg = document.createElement("span");
    seg.className = "lang-seg";
    seg.style.width = `${lang.pct}%`;
    seg.style.background = lang.color;
    seg.title = `${lang.name} ${lang.pct}%`;
    bar.appendChild(seg);

    const item = document.createElement("span");
    item.textContent = `${lang.name} ${lang.pct}%`;
    legend.appendChild(item);
  }

  el.append(bar, legend);
});

function renderTimeline(mount: HTMLElement): void {
  const events = [...PORTFOLIO.events].sort((a, b) => a.date.localeCompare(b.date));
  const allowed = (mount.getAttribute("data-project") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isProjectId);
  const showFilters = mount.hasAttribute("data-filters");
  const hideProjectChip = mount.hasAttribute("data-hide-project-chip");

  let filter: TimelineFilter = "all";

  const render = (): void => {
    const visible = events.filter((event) => {
      if (allowed.length > 0 && !allowed.includes(event.project)) {
        return false;
      }
      return filter === "all" || event.project === filter;
    });

    mount.replaceChildren();

    if (showFilters) {
      const keys: TimelineFilter[] =
        allowed.length > 0 ? ["all", ...allowed] : ["all", ...PORTFOLIO.projectOrder];

      const filters = document.createElement("div");
      filters.className = "filters";

      for (const key of keys) {
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(key === filter));
        btn.textContent = key === "all" ? "All work" : (PORTFOLIO.projects[key] ?? key);
        btn.addEventListener("click", () => {
          filter = key;
          render();
        });
        filters.appendChild(btn);
      }

      mount.appendChild(filters);
    }

    const list = document.createElement("div");
    list.className = "timeline";

    for (const event of visible) {
      const item = document.createElement("article");
      item.className = "tl-item";
      item.dataset.kind = event.kind;

      const heading = document.createElement("h3");
      if (event.href !== undefined) {
        const link = document.createElement("a");
        link.href = event.href;
        link.textContent = event.title;
        heading.appendChild(link);
      } else {
        heading.textContent = event.title;
      }

      const date = document.createElement("p");
      date.className = "tl-date";
      date.textContent = event.date;

      const dot = document.createElement("span");
      dot.className = "tl-dot";
      dot.setAttribute("aria-hidden", "true");

      const body = document.createElement("div");
      body.className = "tl-body";

      const detail = document.createElement("p");
      detail.textContent = event.detail;

      const meta = document.createElement("div");
      meta.className = "tl-meta";

      if (!hideProjectChip) {
        const projectChip = document.createElement("span");
        projectChip.className = "chip";
        projectChip.textContent = PORTFOLIO.projects[event.project];
        meta.appendChild(projectChip);
      }

      const kindChip = document.createElement("span");
      kindChip.className = "chip";
      kindChip.textContent = event.kind;
      meta.appendChild(kindChip);

      body.append(heading, detail, meta);
      item.append(date, dot, body);
      list.appendChild(item);
    }

    mount.appendChild(list);
  };

  render();
}

const grouped = document.querySelector<HTMLElement>("[data-project-timelines]");
if (grouped) {
  const toc = document.createElement("nav");
  toc.className = "timeline-toc";
  toc.setAttribute("aria-label", "Project timelines");

  for (const id of PORTFOLIO.projectOrder) {
    const href = document.createElement("a");
    href.className = "chip";
    href.href = `#timeline-${id}`;
    href.textContent = PORTFOLIO.projects[id];
    toc.appendChild(href);
  }
  grouped.appendChild(toc);

  for (const id of PORTFOLIO.projectOrder) {
    const section = document.createElement("section");
    section.className = "project-timeline";
    section.id = `timeline-${id}`;

    const head = document.createElement("div");
    head.className = "section-head";
    const title = document.createElement("h2");
    title.textContent = PORTFOLIO.projects[id];
    head.appendChild(title);
    section.appendChild(head);

    const mount = document.createElement("div");
    mount.setAttribute("data-timeline", "");
    mount.setAttribute("data-project", id);
    mount.setAttribute("data-hide-project-chip", "");
    section.appendChild(mount);
    grouped.appendChild(section);
    renderTimeline(mount);
  }
}

document.querySelectorAll<HTMLElement>("[data-timeline]").forEach((mount) => {
  if (mount.closest("[data-project-timelines]")) {
    return;
  }
  renderTimeline(mount);
});

mountGuestWindows();
