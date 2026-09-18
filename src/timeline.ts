/**
 * The project timeline: a vertical git branch, five commits at a time.
 *
 * This replaces a scroll-driven deck. That version derived which entry was open
 * from scroll position on a 24fps clock, which read well going slowly and badly
 * otherwise: scrubbing up and down reopened entries continuously, and because an
 * open entry is taller than a closed one, every change reflowed the rows below
 * it. Fast movement fed that back into itself as jitter.
 *
 * The fix is to stop deriving selection from scroll at all. The window holds
 * five entries, selection moves only when someone asks for it, and paging
 * replaces the contents of a fixed set of rows. Nothing about the page's height
 * depends on scroll position, so there is nothing left to oscillate.
 *
 * Three levels of detail, so the rail stays scannable while a single commit can
 * be read in full:
 *
 *   collapsed  date and title
 *   selected   + summary and chips              (one at a time)
 *   expanded   + the full card, rendered        (only when asked)
 *
 * Keyboard: up/down move the selection and page across the boundary, left/right
 * page directly, Home/End jump to either end, Enter toggles the card.
 */

import { icon, type IconName } from "./icons.js";

/** Entries visible at once. The sixth is what the pager is for. */
export const WINDOW_SIZE = 5;

export interface TimelineCard {
  date: string;
  /** Display date, already formatted. */
  dateLabel: string;
  kind: string;
  title: string;
  /** One-line summary for the collapsed row. May contain inline Markdown. */
  detail: string;
  /**
   * Key into data/commit-bodies.json, which the expanded card fetches on
   * demand. Absent for curated entries and bodyless sources, where `detail`
   * stands in.
   */
  identity?: string;
  href?: string;
  /** Rows shown in the expanded card, in order. */
  facts: ReadonlyArray<readonly [string, string]>;
}

/**
 * Full commit bodies, fetched once and shared by every card on the page.
 *
 * Kept out of the page bundle on purpose: the bodies run to about 100 KB across
 * the history, and only an expanded card ever reads one. Memoised as a promise
 * so five rapid expands make one request, and cached by the browser like any
 * other static file.
 */
const BODIES_URL = "/data/commit-bodies.json";
let bodiesRequest: Promise<Record<string, string>> | undefined;

function commitBodies(): Promise<Record<string, string>> {
  if (bodiesRequest === undefined) {
    bodiesRequest = fetch(BODIES_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: unknown) => {
        if (typeof data !== "object" || data === null) {
          return {};
        }
        const bodies = (data as { bodies?: unknown }).bodies;
        return typeof bodies === "object" && bodies !== null
          ? (bodies as Record<string, string>)
          : {};
      })
      .catch(() => ({}));
  }
  return bodiesRequest;
}

/**
 * Strip inline Markdown for the collapsed row's one line.
 *
 * Deliberately not the real renderer: that lives behind a dynamic import and
 * pulls in React and KaTeX, which would defeat the point of loading them only
 * when a card is expanded. This handles what a summary actually contains —
 * emphasis, code spans and links — and nothing else.
 */
function plainSummary(markdown: string): string {
  return markdown
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|~~)(.*?)\1/g, "$2")
    .replace(/(^|[\s([{])\*(\S[^*]*?)\*/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

interface Row {
  item: HTMLElement;
  button: HTMLButtonElement;
  detail: HTMLElement;
  summary: HTMLElement;
  card: HTMLElement;
  expand: HTMLButtonElement;
  dateEl: HTMLTimeElement;
  titleEl: HTMLElement;
  stepEl: HTMLElement;
  markEl: HTMLElement;
  linkEl: HTMLAnchorElement;
}

function chip(label: string, iconName?: IconName): HTMLElement {
  const el = document.createElement("span");
  el.className = "chip";
  if (iconName !== undefined) {
    el.innerHTML = icon(iconName);
  }
  el.append(label);
  return el;
}

/**
 * Build the fixed set of rows once, then rebind them as the window moves.
 *
 * Rebinding rather than re-creating keeps focus where it is when paging with
 * the keyboard — re-rendering the list would drop focus to the body on every
 * page, which makes the whole thing unusable without a mouse.
 */
export function mountTimelineWindow(
  mount: HTMLElement,
  cards: readonly TimelineCard[],
  options: { hideProjectChip?: boolean } = {},
): void {
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

  // Ids are per-mount: a page can hold more than one timeline, and duplicate
  // ids would point every control at the first card on the page.
  const mountId = `tl-${(mount.getAttribute("data-project") ?? "all").replace(/[^a-z0-9-]/gi, "")}`;

  const rows: Row[] = [];
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

    // The card sits outside the button: it holds a link and its own control,
    // and interactive elements cannot be nested inside a button.
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
      item, button, detail, summary, card, expand,
      dateEl, titleEl, stepEl, markEl, linkEl,
    });
  }

  // --- pager ---------------------------------------------------------------

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
  // Announced on change so a screen reader hears the window move; the rows
  // themselves are not a live region, which would be far too chatty.
  status.setAttribute("aria-live", "polite");

  pager.append(newer, status, older);

  mount.replaceChildren(graph, pager);

  // --- state ---------------------------------------------------------------

  let start = 0;
  let selected = 0;
  let expandedIndex = -1;

  function render(): void {
    rows.forEach((row, offset) => {
      const index = start + offset;
      const card = cards[index];
      if (card === undefined) {
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
      // Only the selected row is a tab stop, so tabbing past the timeline takes
      // one press rather than five.
      row.button.tabIndex = isSelected ? 0 : -1;

      const isExpanded = index === expandedIndex;

      // The card carries the same text, rendered. Showing both put the summary
      // directly above a fuller copy of itself.
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

      if (card.href === undefined) {
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
    status.textContent = `${first}–${last} of ${cards.length}`;
    newer.disabled = start === 0;
    older.disabled = start >= lastStart;
    graph.dataset.hasOlder = String(start < lastStart);
    graph.dataset.hasNewer = String(start > 0);
  }

  /** Move the selection, paging the window when it would leave the view. */
  function select(next: number, focusRow = false): void {
    const clamped = Math.min(cards.length - 1, Math.max(0, next));
    if (clamped !== selected) {
      // Collapsing on move is what keeps the rail a rail: two open cards would
      // put the fifth entry off-screen, which is what the window is avoiding.
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

  function page(delta: number): void {
    const next = Math.min(lastStart, Math.max(0, start + delta * size));
    if (next === start) {
      return;
    }
    start = next;
    // Keep the selection inside the window rather than dragging it along, so
    // paging is a way to look around without losing your place entirely.
    selected = Math.min(cards.length - 1, Math.max(start, Math.min(selected, start + size - 1)));
    expandedIndex = -1;
    render();
  }

  function toggleExpanded(index: number): void {
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

  graph.addEventListener("keydown", (event: KeyboardEvent) => {
    // Inside an expanded card the arrows belong to the card: it is a scrollable
    // region, and stealing them would leave a long body unreadable by keyboard.
    if (event.target instanceof Element && event.target.closest(".tl-card") !== null) {
      return;
    }
    const handled = (): void => {
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

/**
 * Fill an expanded card: the body rendered, then the facts, then the chip.
 *
 * The renderer arrives through a dynamic `import()`, so React, react-markdown
 * and KaTeX are fetched the first time anyone expands a card and never for a
 * visitor who does not. Until it lands the card shows the summary it already
 * has, so there is no empty box and no layout jump into nothing; the rendered
 * body replaces it in place.
 */
async function fillCard(row: Row, card: TimelineCard, hideProjectChip: boolean): Promise<void> {
  const body = document.createElement("div");
  body.className = "tl-card-body rt";
  // Bounded and scrollable: bodies run to thousands of words, and a card that
  // pushed the next four commits off the screen would undo the window.
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", `${card.title}, full details`);

  // Shown immediately, replaced once the renderer resolves.
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
    // Both in flight at once: the renderer chunk and the bodies file do not
    // depend on each other.
    const [{ renderCommitBody }, bodies] = await Promise.all([
      import("./commitBody.js"),
      card.identity === undefined
        ? Promise.resolve<Record<string, string>>({})
        : commitBodies(),
    ]);
    // The card may have been collapsed or paged away while those loaded.
    if (row.card.hidden || !row.card.contains(body)) {
      return;
    }
    const markdown = (card.identity === undefined ? undefined : bodies[card.identity])
      ?? card.detail;
    placeholder.remove();
    renderCommitBody(body, markdown);
  } catch (error) {
    // Offline, or the chunk failed to load. The summary already on screen is
    // the honest fallback; say why rather than leaving it looking truncated.
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

/**
 * The "more below" fade at the foot of a card whose body overflows.
 *
 * No buttons: the body itself scrolls — by wheel, touch, or the keyboard, since
 * it is focusable and `overflow-y: auto` already makes it a native scroll
 * region. This only toggles the bottom fade that hints there is more to read,
 * and only once there genuinely is one — a fade under a three-line commit
 * message would be a decoration with nothing behind it.
 *
 * Driven by a ResizeObserver rather than measured once: React commits
 * asynchronously, so anything that measures right after `render()` sees an
 * empty box and concludes there is nothing to scroll. The observer also covers
 * what a one-shot measurement would miss — a reflow at a new viewport width,
 * and KaTeX or a webfont landing late and changing the height.
 */
export function attachScrollFade(scroller: HTMLElement, body: HTMLElement): void {
  const update = (): void => {
    const max = body.scrollHeight - body.clientHeight;
    scroller.dataset.more = String(max > 4 && body.scrollTop < max - 1);
  };

  body.addEventListener("scroll", update, { passive: true });

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(update);
    observer.observe(body);
    // The body grows as React fills it, so watch the content too, not just the
    // box — a box with a fixed max-height never changes size on its own.
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
