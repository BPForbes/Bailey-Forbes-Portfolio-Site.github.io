import { PORTFOLIO } from "./data.js";
import {
  commitCountFor,
  languagesFor,
  mergedPullRequestsFor,
  namedReleasesFor,
  timelineEvents,
  versionFor
} from "./projectMetadata.js";
import { icon } from "./icons.js";
import { mountDecks } from "./deck.js";
import { mountGuestWindows } from "./guestWindow.js";
import { mountNamedReleases } from "./releases.js";
import { mountTimelineWindow } from "./timeline.js";
import { ROUTES } from "./routes.js";
const page = document.body.getAttribute("data-page") ?? "";
const header = document.querySelector("[data-site-header]");
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
const footer = document.querySelector("[data-site-footer]");
if (footer) {
  footer.innerHTML = `
      <div class="wrap footer-grid">
        <p>
          \xA9 2026 Bailey P Forbes. Project timelines are compiled from public git history on
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
document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
  link.setAttribute("aria-current", "page");
});
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle && links) {
  const setOpen = (open) => {
    links.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => {
    setOpen(!links.classList.contains("is-open"));
  });
  links.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      setOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && links.classList.contains("is-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}
function isProjectId(value) {
  return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}
function formatPct(pct) {
  return pct.toFixed(1).replace(/\.0$/, "");
}
document.querySelectorAll("[data-lang-bar]").forEach((el) => {
  const key = el.getAttribute("data-lang-bar");
  if (!key || !isProjectId(key)) {
    return;
  }
  const langs = languagesFor(key);
  if (!langs || langs.length === 0) {
    return;
  }
  const bar = document.createElement("div");
  bar.className = "lang-bar";
  bar.setAttribute("role", "img");
  bar.setAttribute(
    "aria-label",
    `Language split: ${langs.map((lang) => `${lang.name} ${formatPct(lang.pct)} percent`).join(", ")}`
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
function formatEventDate(iso) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (full !== null) {
    const month = months[Number(full[2]) - 1];
    if (month !== void 0) {
      return `${Number(full[3])} ${month} ${full[1]}`;
    }
  }
  const partial = /^(\d{4})-(\d{2})$/.exec(iso);
  if (partial !== null) {
    const month = months[Number(partial[2]) - 1];
    if (month !== void 0) {
      return `${month} ${partial[1]}`;
    }
  }
  return iso;
}
function renderTimeline(mount) {
  const events = timelineEvents().map((event, index) => ({ event, index })).sort((a, b) => b.event.date.localeCompare(a.event.date) || b.index - a.index).map((row) => row.event);
  const allowed = (mount.getAttribute("data-project") ?? "").split(",").map((value) => value.trim()).filter(isProjectId);
  const hideProjectChip = mount.hasAttribute("data-hide-project-chip");
  const visible = events.filter(
    (event) => allowed.length === 0 || allowed.includes(event.project)
  );
  mount.replaceChildren();
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.className = "timeline-empty";
    empty.textContent = "No timeline entries have been compiled for this project yet.";
    mount.appendChild(empty);
    return;
  }
  const cards = visible.map((event) => {
    const facts = [
      ["Project", PORTFOLIO.projects[event.project]],
      ["Date", formatEventDate(event.date)]
    ];
    if (event.href !== void 0) {
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
      ...event.identity === void 0 ? {} : { identity: event.identity },
      ...event.href === void 0 ? {} : { href: event.href },
      facts
    };
  });
  mountTimelineWindow(mount, cards, { hideProjectChip });
}
document.querySelectorAll("[data-timeline]").forEach(renderTimeline);
mountNamedReleases((mount) => {
  const key = mount.getAttribute("data-named-releases") ?? "";
  return isProjectId(key) ? namedReleasesFor(key) : [];
});
mountGuestWindows();
mountDecks();
function mountRepositoryFacts() {
  const render = (attribute, value, label) => {
    document.querySelectorAll(`[${attribute}]`).forEach((el) => {
      const key = el.getAttribute(attribute);
      if (!key || !isProjectId(key)) {
        return;
      }
      const resolved = value(key);
      if (resolved === void 0) {
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
