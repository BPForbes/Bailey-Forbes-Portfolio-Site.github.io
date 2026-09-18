import { icon } from "./icons.js";
const WINDOW_SIZE = 5;
const BODIES_URL = "/data/commit-bodies.json";
let bodiesRequest;
function commitBodies() {
  if (bodiesRequest === void 0) {
    bodiesRequest = fetch(BODIES_URL).then((response) => response.ok ? response.json() : Promise.reject(new Error(String(response.status)))).then((data) => {
      if (typeof data !== "object" || data === null) {
        return {};
      }
      const bodies = data.bodies;
      return typeof bodies === "object" && bodies !== null ? bodies : {};
    }).catch(() => ({}));
  }
  return bodiesRequest;
}
function plainSummary(markdown) {
  return markdown.replace(/`([^`]*)`/g, "$1").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/(\*\*|~~)(.*?)\1/g, "$2").replace(/(^|[\s([{])\*(\S[^*]*?)\*/g, "$1$2").replace(/\s+/g, " ").trim();
}
function chip(label, iconName) {
  const el = document.createElement("span");
  el.className = "chip";
  if (iconName !== void 0) {
    el.innerHTML = icon(iconName);
  }
  el.append(label);
  return el;
}
function mountTimelineWindow(mount, cards, options = {}) {
  if (cards.length === 0) {
    return;
  }
  const size = Math.min(WINDOW_SIZE, cards.length);
  const lastStart = Math.max(0, cards.length - size);
  const graph = document.createElement("div");
  graph.className = "tl-graph";
  const list = document.createElement("ol");
  list.className = "tl-list";
  graph.appendChild(list);
  const mountId = `tl-${(mount.getAttribute("data-project") ?? "all").replace(/[^a-z0-9-]/gi, "")}`;
  const rows = [];
  for (let offset = 0; offset < size; offset += 1) {
    const item = document.createElement("li");
    item.className = "tl-item";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tl-node";
    const markEl = document.createElement("span");
    markEl.className = "tl-mark";
    markEl.setAttribute("aria-hidden", "true");
    const head = document.createElement("span");
    head.className = "tl-head";
    const dateEl = document.createElement("time");
    dateEl.className = "tl-date";
    const titleEl = document.createElement("span");
    titleEl.className = "tl-title";
    const stepEl = document.createElement("span");
    stepEl.className = "tl-step";
    head.append(dateEl, titleEl, stepEl);
    const detail = document.createElement("span");
    detail.className = "tl-detail";
    const summary = document.createElement("span");
    summary.className = "tl-summary";
    detail.appendChild(summary);
    button.append(markEl, head, detail);
    item.appendChild(button);
    const card = document.createElement("div");
    card.className = "tl-card";
    card.id = `${mountId}-card-${offset}`;
    card.hidden = true;
    const actions = document.createElement("div");
    actions.className = "tl-actions";
    const expand = document.createElement("button");
    expand.type = "button";
    expand.className = "chip tl-expand";
    expand.setAttribute("aria-expanded", "false");
    expand.setAttribute("aria-controls", card.id);
    const linkEl = document.createElement("a");
    linkEl.className = "chip tl-open";
    linkEl.rel = "noopener";
    linkEl.innerHTML = icon("arrow-up-right-from-square");
    linkEl.append("View the commit");
    actions.append(expand, linkEl);
    item.append(actions, card);
    list.appendChild(item);
    rows.push({
      item,
      button,
      detail,
      summary,
      card,
      expand,
      dateEl,
      titleEl,
      stepEl,
      markEl,
      linkEl
    });
  }
  const pager = document.createElement("div");
  pager.className = "tl-pager";
  const older = document.createElement("button");
  older.type = "button";
  older.className = "btn btn-ghost tl-page";
  older.innerHTML = icon("arrow-right");
  older.append("Older");
  const newer = document.createElement("button");
  newer.type = "button";
  newer.className = "btn btn-ghost tl-page";
  newer.innerHTML = icon("arrow-left");
  newer.append("Newer");
  const status = document.createElement("p");
  status.className = "tl-range";
  status.setAttribute("aria-live", "polite");
  pager.append(newer, status, older);
  mount.replaceChildren(graph, pager);
  let start = 0;
  let selected = 0;
  let expandedIndex = -1;
  function render() {
    rows.forEach((row, offset) => {
      const index = start + offset;
      const card = cards[index];
      if (card === void 0) {
        row.item.hidden = true;
        return;
      }
      row.item.hidden = false;
      row.item.dataset.kind = card.kind;
      row.dateEl.dateTime = card.date;
      row.dateEl.textContent = card.dateLabel;
      row.titleEl.textContent = card.title;
      row.stepEl.textContent = `${index + 1} / ${cards.length}`;
      const isSelected = index === selected;
      row.item.dataset.current = String(isSelected);
      if (isSelected) {
        row.button.setAttribute("aria-current", "true");
      } else {
        row.button.removeAttribute("aria-current");
      }
      row.button.tabIndex = isSelected ? 0 : -1;
      const isExpanded = index === expandedIndex;
      row.detail.hidden = !isSelected || isExpanded;
      if (isSelected && !isExpanded) {
        row.summary.textContent = plainSummary(card.detail);
      }
      row.card.hidden = !isExpanded;
      row.expand.hidden = !isSelected;
      row.expand.setAttribute("aria-expanded", String(isExpanded));
      row.expand.replaceChildren();
      row.expand.innerHTML = icon(isExpanded ? "compress" : "expand");
      row.expand.append(isExpanded ? "Hide details" : "Show details");
      if (card.href === void 0) {
        row.linkEl.hidden = true;
      } else {
        row.linkEl.hidden = !isSelected;
        row.linkEl.href = card.href;
      }
      if (isExpanded) {
        void fillCard(row, card, options.hideProjectChip === true);
      }
    });
    const first = start + 1;
    const last = Math.min(start + size, cards.length);
    status.textContent = `${first}\u2013${last} of ${cards.length}`;
    newer.disabled = start === 0;
    older.disabled = start >= lastStart;
    graph.dataset.hasOlder = String(start < lastStart);
    graph.dataset.hasNewer = String(start > 0);
  }
  function select(next, focusRow = false) {
    const clamped = Math.min(cards.length - 1, Math.max(0, next));
    if (clamped !== selected) {
      expandedIndex = -1;
    }
    selected = clamped;
    if (selected < start) {
      start = selected;
    } else if (selected >= start + size) {
      start = Math.min(lastStart, selected - size + 1);
    }
    render();
    if (focusRow) {
      rows[selected - start]?.button.focus();
    }
  }
  function page(delta) {
    const next = Math.min(lastStart, Math.max(0, start + delta * size));
    if (next === start) {
      return;
    }
    start = next;
    selected = Math.min(cards.length - 1, Math.max(start, Math.min(selected, start + size - 1)));
    expandedIndex = -1;
    render();
  }
  function toggleExpanded(index) {
    expandedIndex = expandedIndex === index ? -1 : index;
    render();
  }
  rows.forEach((row, offset) => {
    row.button.addEventListener("click", () => {
      const index = start + offset;
      if (index === selected) {
        toggleExpanded(index);
      } else {
        select(index);
      }
    });
    row.expand.addEventListener("click", () => {
      toggleExpanded(start + offset);
    });
  });
  newer.addEventListener("click", () => {
    page(-1);
  });
  older.addEventListener("click", () => {
    page(1);
  });
  graph.addEventListener("keydown", (event) => {
    if (event.target instanceof Element && event.target.closest(".tl-card") !== null) {
      return;
    }
    const handled = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    switch (event.key) {
      case "ArrowDown":
        handled();
        select(selected + 1, true);
        break;
      case "ArrowUp":
        handled();
        select(selected - 1, true);
        break;
      case "ArrowRight":
      case "PageDown":
        handled();
        page(1);
        break;
      case "ArrowLeft":
      case "PageUp":
        handled();
        page(-1);
        break;
      case "Home":
        handled();
        select(0, true);
        break;
      case "End":
        handled();
        select(cards.length - 1, true);
        break;
      case "Enter":
      case " ":
        if (event.target === rows[selected - start]?.button) {
          handled();
          toggleExpanded(selected);
        }
        break;
      default:
        break;
    }
  });
  render();
}
async function fillCard(row, card, hideProjectChip) {
  const body = document.createElement("div");
  body.className = "tl-card-body rt";
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", `${card.title}, full details`);
  const placeholder = document.createElement("p");
  placeholder.className = "tl-card-loading";
  placeholder.textContent = plainSummary(card.detail);
  body.appendChild(placeholder);
  const scroller = document.createElement("div");
  scroller.className = "tl-card-scroll";
  scroller.appendChild(body);
  const facts = card.facts.filter(([label]) => !(hideProjectChip && label === "Project"));
  const fragment = document.createDocumentFragment();
  fragment.appendChild(scroller);
  if (facts.length > 0) {
    const table = document.createElement("dl");
    table.className = "tl-facts";
    for (const [label, value] of facts) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value;
      table.append(term, description);
    }
    fragment.appendChild(table);
  }
  const chips = document.createElement("div");
  chips.className = "tl-card-chips";
  chips.appendChild(chip(card.kind, card.kind === "release" ? "tag" : "code-branch"));
  fragment.appendChild(chips);
  row.card.replaceChildren(fragment);
  try {
    const [{ renderCommitBody }, bodies] = await Promise.all([
      import("./commitBody.js"),
      card.identity === void 0 ? Promise.resolve({}) : commitBodies()
    ]);
    if (row.card.hidden || !row.card.contains(body)) {
      return;
    }
    const markdown = (card.identity === void 0 ? void 0 : bodies[card.identity]) ?? card.detail;
    placeholder.remove();
    renderCommitBody(body, markdown);
  } catch (error) {
    console.warn("Commit body renderer failed to load", error);
    placeholder.classList.add("tl-card-degraded");
    const note = document.createElement("p");
    note.className = "tl-card-degraded-note";
    note.textContent = "Full details could not be loaded. Open the commit to read it on GitHub.";
    body.appendChild(note);
    return;
  }
  attachScrollFade(scroller, body);
}
function attachScrollFade(scroller, body) {
  const update = () => {
    const max = body.scrollHeight - body.clientHeight;
    scroller.dataset.more = String(max > 4 && body.scrollTop < max - 1);
  };
  body.addEventListener("scroll", update, { passive: true });
  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(update);
    observer.observe(body);
    for (const child of Array.from(body.children)) {
      observer.observe(child);
    }
    const mutations = new MutationObserver(() => {
      for (const child of Array.from(body.children)) {
        observer.observe(child);
      }
      update();
    });
    mutations.observe(body, { childList: true, subtree: true });
  }
  update();
}
export {
  WINDOW_SIZE,
  mountTimelineWindow
};
