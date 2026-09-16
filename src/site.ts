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

function renderTimeline(mount: HTMLElement): void {
  const events = [...PORTFOLIO.events].sort((a, b) => a.date.localeCompare(b.date));
  const allowed = (mount.getAttribute("data-project") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(isProjectId);
  const hideProjectChip = mount.hasAttribute("data-hide-project-chip");

  const render = (): void => {
    const visible = events.filter(
      (event) => allowed.length === 0 || allowed.includes(event.project),
    );

    mount.replaceChildren();

    if (visible.length === 0) {
      const empty = document.createElement("p");
      empty.className = "timeline-empty";
      empty.textContent =
        "No timeline entries have been compiled for this project yet.";
      mount.appendChild(empty);
      return;
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

document.querySelectorAll<HTMLElement>("[data-timeline]").forEach(renderTimeline);

mountGuestWindows();
mountDecks();
