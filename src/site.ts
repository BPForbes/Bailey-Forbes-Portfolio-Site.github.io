import { PORTFOLIO } from "./data.js";
import {
  commitCountFor,
  languagesFor,
  mergedPullRequestsFor,
  namedReleasesFor,
  timelineEvents,
  versionFor,
} from "./projectMetadata.js";
import { icon } from "./icons.js";
import { mountDecks } from "./deck.js";
import { mountGuestWindows } from "./guestWindow.js";
import { mountNamedReleases } from "./releases.js";
import { mountTimelineWindow, type TimelineCard } from "./timeline.js";
import { ROUTES } from "./routes.js";
import type { NamedRelease, ProjectId } from "./types.js";

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

/**
 * One decimal, with a trailing ".0" trimmed.
 *
 * The sync rounds to a tenth and balances the remainder so a bar's figures add
 * up to 100.0. Printing "Rust 100%" rather than "Rust 100.0%" keeps the legend
 * reading the way the hand-written one did.
 */
function formatPct(pct: number): string {
  return pct.toFixed(1).replace(/\.0$/, "");
}

document.querySelectorAll<HTMLElement>("[data-lang-bar]").forEach((el) => {
  const key = el.getAttribute("data-lang-bar");
  if (!key || !isProjectId(key)) {
    return;
  }

  // Generated GitHub Linguist data when the project has a repository, the
  // curated split when it does not. Either way the renderer below is unchanged:
  // it has never assumed a language count, and must not start now.
  const langs = languagesFor(key);
  if (!langs || langs.length === 0) {
    return;
  }

  const bar = document.createElement("div");
  bar.className = "lang-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    `Language split: ${langs.map((lang) => `${lang.name} ${formatPct(lang.pct)} percent`).join(", ")}`,
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
    item.append(swatch, document.createTextNode(`${lang.name} ${formatPct(lang.pct)}%`));
    legend.appendChild(item);
  }

  el.append(bar, legend);
});

/**
 * Month- or day-granular ISO dates as the site writes them elsewhere.
 *
 * Spelled out rather than left to toLocaleDateString: en-GB abbreviates
 * September as "Sept" and the exact abbreviations depend on a runtime's ICU
 * data, so a date here would not necessarily match the prose beside it. The
 * machine-readable value stays on the `datetime` attribute.
 */
function formatEventDate(iso: string): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ] as const;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (full !== null) {
    const month = months[Number(full[2]) - 1];
    if (month !== undefined) {
      return `${Number(full[3])} ${month} ${full[1]}`;
    }
  }
  // The EMR engagement is recorded by month; it has no day to show.
  const partial = /^(\d{4})-(\d{2})$/.exec(iso);
  if (partial !== null) {
    const month = months[Number(partial[2]) - 1];
    if (month !== undefined) {
      return `${month} ${partial[1]}`;
    }
  }
  return iso;
}

/**
 * The project timeline: a vertical git branch, five commits at a time.
 *
 * The rail shows a window of five with a pager, rather than every entry at
 * once: an eighteen-entry history was a wall, and the previous scroll-driven
 * reveal jittered when scrubbed quickly because it recomputed which entry was
 * open on every scroll event while open entries changed the page's height.
 * Selection is now explicit, so nothing here reacts to scrolling at all.
 *
 * Detail arrives as Markdown — the sync copies pull request bodies — so the
 * expanded card renders it rather than printing the asterisks and backticks.
 *
 * An entry without a commit link still renders; it just has no link, because
 * pretending it points somewhere would be worse than saying it does not
 * (DESIGN.md R21).
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

  const cards: TimelineCard[] = visible.map((event) => {
    // Kind is not listed here: the card already ends with a chip for it, and
    // printing "Type: Feature" above a "feature" chip says it twice.
    const facts: Array<readonly [string, string]> = [
      ["Project", PORTFOLIO.projects[event.project]],
      ["Date", formatEventDate(event.date)],
    ];
    if (event.href !== undefined) {
      facts.push(["Source", event.href]);
    }
    return {
      date: event.date,
      dateLabel: formatEventDate(event.date),
      kind: event.kind,
      title: event.title,
      detail: event.detail,
      // The key the card fetches its full body by. Curated entries have none
      // and fall back to their own prose.
      ...(event.identity === undefined ? {} : { identity: event.identity }),
      ...(event.href === undefined ? {} : { href: event.href }),
      facts,
    };
  });

  mountTimelineWindow(mount, cards, { hideProjectChip });
}

document.querySelectorAll<HTMLElement>("[data-timeline]").forEach(renderTimeline);

mountNamedReleases((mount): readonly NamedRelease[] => {
  const key = mount.getAttribute("data-named-releases") ?? "";
  return isProjectId(key) ? namedReleasesFor(key) : [];
});

mountGuestWindows();
mountDecks();

/**
 * Repository-derived figures on otherwise static pages.
 *
 * Each hook names the project it belongs to, so the markup carries the
 * relationship and this code does no string matching against page copy:
 *
 *   <span data-project-version="flinstone">4.5.4</span>
 *   <span data-project-commits="flinstone">390 commits</span>
 *   <span data-project-prs="homework-central">76 PRs</span>
 *
 * The literal text in the HTML is the fallback, not the source of truth. It is
 * what a visitor sees before the module runs, and what stays if a project has
 * no generated metadata yet — so the page is never blank or wrong, just
 * occasionally a sync behind.
 *
 * `data-project-label="false"` renders the bare number, for prose that supplies
 * its own noun.
 */
function mountRepositoryFacts(): void {
  const render = (
    attribute: string,
    value: (project: ProjectId) => number | string | undefined,
    label: (text: string) => string,
  ): void => {
    document.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((el) => {
      const key = el.getAttribute(attribute);
      if (!key || !isProjectId(key)) {
        return;
      }
      const resolved = value(key);
      if (resolved === undefined) {
        return;
      }
      const text = String(resolved);
      el.textContent = el.getAttribute("data-project-label") === "false" ? text : label(text);
    });
  };

  render("data-project-version", versionFor, (text) => text);
  render("data-project-commits", commitCountFor, (text) => `${text} commits`);
  render("data-project-prs", mergedPullRequestsFor, (text) => `${text} merged PRs`);
}

mountRepositoryFacts();
