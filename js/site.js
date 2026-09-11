(function () {
  const root = document.body.getAttribute("data-root") || ".";
  const page = document.body.getAttribute("data-page") || "";

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

  document.querySelectorAll("[data-lang-bar]").forEach((el) => {
    const key = el.getAttribute("data-lang-bar");
    const langs = window.PORTFOLIO?.languages?.[key];
    if (!langs) return;
    const bar = document.createElement("div");
    bar.className = "lang-bar";
    const legend = document.createElement("div");
    legend.className = "lang-legend";
    langs.forEach((lang) => {
      const seg = document.createElement("span");
      seg.className = "lang-seg";
      seg.style.width = `${lang.pct}%`;
      seg.style.background = lang.color;
      seg.title = `${lang.name} ${lang.pct}%`;
      bar.appendChild(seg);
      const item = document.createElement("span");
      item.textContent = `${lang.name} ${lang.pct}%`;
      legend.appendChild(item);
    });
    el.append(bar, legend);
  });

  const mount = document.querySelector("[data-timeline]");
  if (!mount || !window.PORTFOLIO) return;

  const events = window.PORTFOLIO.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const allowed = (mount.getAttribute("data-project") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const showFilters = mount.hasAttribute("data-filters");

  let filter = "all";

  function render() {
    const visible = events.filter((event) => {
      if (allowed.length && !allowed.includes(event.project)) return false;
      return filter === "all" || event.project === filter;
    });

    mount.innerHTML = "";
    if (showFilters) {
      const keys = allowed.length
        ? ["all", ...allowed]
        : ["all", ...Object.keys(window.PORTFOLIO.projects)];
      const filters = document.createElement("div");
      filters.className = "filters";
      keys.forEach((key) => {
        const btn = document.createElement("button");
        btn.className = "filter-btn";
        btn.type = "button";
        btn.setAttribute("aria-pressed", String(key === filter));
        btn.textContent = key === "all" ? "All work" : window.PORTFOLIO.projects[key] || key;
        btn.addEventListener("click", () => {
          filter = key;
          render();
        });
        filters.appendChild(btn);
      });
      mount.appendChild(filters);
    }

    const list = document.createElement("div");
    list.className = "timeline";
    visible.forEach((event) => {
      const item = document.createElement("article");
      item.className = "tl-item";
      item.dataset.kind = event.kind;
      const title = event.href
        ? `<h3><a href="${event.href}">${event.title}</a></h3>`
        : `<h3>${event.title}</h3>`;
      item.innerHTML = `
        <p class="tl-date">${event.date}</p>
        <span class="tl-dot" aria-hidden="true"></span>
        <div class="tl-body">
          ${title}
          <p>${event.detail}</p>
          <div class="tl-meta">
            <span class="chip">${window.PORTFOLIO.projects[event.project] || event.project}</span>
            <span class="chip">${event.kind}</span>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
    mount.appendChild(list);
  }

  render();
})();
