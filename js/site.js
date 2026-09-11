import { PORTFOLIO } from "./data.js";
const root = document.body.getAttribute("data-root") ?? ".";
const page = document.body.getAttribute("data-page") ?? "";
const header = document.querySelector("[data-site-header]");
if (header) {
    header.innerHTML = `
      <a class="skip-link" href="#main">Skip to content</a>
      <div class="nav-wrap">
        <a class="brand" href="${root}/index.html">
          <span class="brand-mark">BF</span>
          <span class="brand-text">
            <strong>Bailey Forbes</strong>
            <span>Release ledger</span>
          </span>
        </a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <ul class="nav-links" id="site-nav">
          <li><a data-nav="home" href="${root}/index.html">Home</a></li>
          <li><a data-nav="projects" href="${root}/projects/index.html">Projects</a></li>
          <li><a data-nav="timeline" href="${root}/timeline.html">Timeline</a></li>
          <li><a data-nav="experience" href="${root}/index.html#experience">Experience</a></li>
        </ul>
      </div>
    `;
}
const footer = document.querySelector("[data-site-footer]");
if (footer) {
    footer.innerHTML = `
      <div class="wrap footer-grid">
        <p>© 2026 Bailey P Forbes. Timelines compiled from public git history on 11 Sep 2026.</p>
        <p>
          <a href="https://github.com/BPForbes">GitHub</a>
          · <a href="https://www.linkedin.com/in/bailey-forbes-506a12238">LinkedIn</a>
          · <a href="mailto:baileyforbes@rocketmail.com">Email</a>
        </p>
      </div>
    `;
}
document.querySelectorAll(`[data-nav="${page}"]`).forEach((link) => {
    link.setAttribute("aria-current", "page");
});
const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
if (toggle && links) {
    toggle.addEventListener("click", () => {
        const open = links.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
    });
}
function isProjectId(value) {
    return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}
document.querySelectorAll("[data-lang-bar]").forEach((el) => {
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
const mount = document.querySelector("[data-timeline]");
if (mount) {
    const events = [...PORTFOLIO.events].sort((a, b) => a.date.localeCompare(b.date));
    const allowed = (mount.getAttribute("data-project") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(isProjectId);
    const showFilters = mount.hasAttribute("data-filters");
    let filter = "all";
    const render = () => {
        const visible = events.filter((event) => {
            if (allowed.length > 0 && !allowed.includes(event.project)) {
                return false;
            }
            return filter === "all" || event.project === filter;
        });
        mount.replaceChildren();
        if (showFilters) {
            const keys = allowed.length > 0 ? ["all", ...allowed] : ["all", ...Object.keys(PORTFOLIO.projects).filter(isProjectId)];
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
            }
            else {
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
            const projectChip = document.createElement("span");
            projectChip.className = "chip";
            projectChip.textContent = PORTFOLIO.projects[event.project];
            const kindChip = document.createElement("span");
            kindChip.className = "chip";
            kindChip.textContent = event.kind;
            meta.append(projectChip, kindChip);
            body.append(heading, detail, meta);
            item.append(date, dot, body);
            list.appendChild(item);
        }
        mount.appendChild(list);
    };
    render();
}
