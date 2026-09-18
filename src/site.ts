import { PORTFOLIO } from "./data.js";
import { icon } from "./icons.js";
import { generatedProject, languageShares, stat, timelineEvents, version } from "./metadata.js";
import { mountDecks } from "./deck.js";
import { mountGuestWindows } from "./guestWindow.js";
import { mountTimelineDeck } from "./timeline.js";
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

  const langs = languageShares(key);
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
 * Generated repository numbers, written into the markup that already showed
 * them.
 *
 * A `data-metric="<project>:<field>"` element keeps its authored text as the
 * fallback and is only rewritten when this build actually carries generated
 * metadata for that project — so a build without `data/projects.generated.json`
 * renders the page exactly as it was written, and a number is never blanked out
 * or replaced by a placeholder.
 *
 * `data-metric-suffix` carries the unit, so the markup still reads as the chip
 * it is ("390 commits") rather than a bare count.
 */
document.querySelectorAll<HTMLElement>("[data-metric]").forEach((el) => {
  const [key, field] = (el.getAttribute("data-metric") ?? "").split(":");
  if (key === undefined || field === undefined || !isProjectId(key)) {
    return;
  }

  let value: string | undefined;
  if (field === "version") {
    value = version(key);
  } else {
    const count = stat(key, field);
    value = count === undefined ? undefined : count.toLocaleString("en-US");
  }
  if (value === undefined) {
    // An element with authored text keeps it as the fallback. An empty one was
    // only ever a placeholder for a generated number, so it leaves rather than
    // sitting there blank — and nothing on the page becomes a figure nobody
    // maintains.
    if (el.textContent?.trim() === "") {
      el.remove();
    }
    return;
  }

  el.textContent = `${value}${el.getAttribute("data-metric-suffix") ?? ""}`;
  el.removeAttribute("hidden");
  el.setAttribute("data-metric-generated", "true");
});

/**
 * The repository statistics strip under a project's language bar.
 *
 * Rendered entirely from generated metadata, so it is absent rather than stale
 * when a build carries none — and absent for a project with no public
 * repository, which is why the EMR page does not mount one. Each figure is
 * whatever GitHub answered at build time; nothing here is maintained by hand.
 */
document.querySelectorAll<HTMLElement>("[data-repo-stats]").forEach((el) => {
  const key = el.getAttribute("data-repo-stats");
  if (!key || !isProjectId(key)) {
    return;
  }

  const project = generatedProject(key);
  if (project === undefined) {
    return;
  }

  const figures: Array<{ label: string; value: string; href?: string }> = [];
  if (project.version !== undefined) {
    figures.push({ label: "version", value: project.version });
  }

  const commits = project.stats["commits"];
  if (commits !== undefined) {
    figures.push({ label: "commits", value: commits.toLocaleString("en-US") });
  }

  const merged = project.stats["mergedPullRequests"];
  if (merged !== undefined) {
    figures.push({ label: "merged PRs", value: merged.toLocaleString("en-US") });
  }

  if (project.latestCommit.shortSha !== "") {
    figures.push({
      label: "latest commit",
      value: project.latestCommit.shortSha,
      ...(project.latestCommit.url === "" ? {} : { href: project.latestCommit.url }),
    });
  }

  if (project.lastUpdated !== "") {
    figures.push({ label: "updated", value: formatDay(project.lastUpdated) });
  }

  if (figures.length === 0) {
    return;
  }

  for (const figure of figures) {
    const item = document.createElement("span");
    item.className = "repo-stat";

    const value = document.createElement(figure.href === undefined ? "strong" : "a");
    value.textContent = figure.value;
    if (value instanceof HTMLAnchorElement && figure.href !== undefined) {
      value.href = figure.href;
      value.rel = "noopener";
    }

    const label = document.createElement("span");
    label.className = "repo-stat-label";
    label.textContent = figure.label;

    // A real space, not just the flex gap: the gap is invisible to anything
    // reading text content, and "398commits" is what a screen reader would
    // otherwise announce.
    item.append(value, document.createTextNode(" "), label);
    el.appendChild(item);
  }

  el.setAttribute("data-repo-stats-generated", "true");
});

/**
 * `2026-09-18` as `18 Sep 2026`, matching how dates are written elsewhere on
 * the site.
 *
 * Spelled out rather than left to toLocaleDateString: en-GB abbreviates
 * September as "Sept", and the exact abbreviations a runtime produces depend on
 * its ICU data, so a date would not necessarily read the same in the browser as
 * in the prose beside it.
 */
function formatDay(iso: string): string {
  // Declared inside the function, not beside it: `formatDay` is hoisted and is
  // called from the rendering above, so a module-level `const` here would still
  // be in its temporal dead zone by then.
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ] as const;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) {
    return iso;
  }
  const month = months[Number(match[2]) - 1];
  if (month === undefined) {
    return iso;
  }
  return `${Number(match[3])} ${month} ${match[1]}`;
}

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
  // Newest first: the most recent commit is the card you land on. Dates are
  // month- or day-granular and several releases share one, so ties fall back to
  // authoring order reversed — otherwise 4.5.4 and 4.5.2 land in whichever
  // order the sort happened to leave them.
  const events = timelineEvents()
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.date.localeCompare(a.event.date) || b.index - a.index)
    .map((row) => row.event);
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

  // The travelling glow on the spine. One element, moved by transform.
  const glow = document.createElement("span");
  glow.className = "tl-glow";
  glow.setAttribute("aria-hidden", "true");
  graph.appendChild(glow);

  const list = document.createElement("ol");
  list.className = "tl-list";

  const items: HTMLElement[] = [];
  const links: HTMLElement[] = [];

  visible.forEach((event, index) => {
    const item = document.createElement("li");
    item.className = "tl-item";
    item.dataset.kind = event.kind;

    const node = document.createElement(event.href === undefined ? "span" : "a");
    node.className = "tl-node";
    if (node instanceof HTMLAnchorElement && event.href !== undefined) {
      node.href = event.href;
      node.rel = "noopener";
    }

    // The dot sits on the spine; it is the commit on the branch.
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

    const step = document.createElement("span");
    step.className = "tl-step";
    step.textContent = `${index + 1} / ${visible.length}`;
    head.append(date, title, step);

    // One wrapper only: the open/close is driven by the wrapper's height, and a
    // second direct child would sit outside it and escape the collapse.
    const detail = document.createElement("span");
    detail.className = "tl-detail";

    const inner = document.createElement("span");
    inner.className = "tl-detail-inner";

    const summary = document.createElement("span");
    summary.className = "tl-summary";
    summary.textContent = event.detail;
    inner.appendChild(summary);

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
    detail.appendChild(inner);

    node.append(mark, head, detail);
    item.appendChild(node);
    list.appendChild(item);
    items.push(item);
    links.push(node);
  });

  graph.appendChild(list);
  mount.appendChild(graph);

  mountTimelineDeck(graph, items, links);
}

document.querySelectorAll<HTMLElement>("[data-timeline]").forEach(renderTimeline);

mountGuestWindows();
mountDecks();
