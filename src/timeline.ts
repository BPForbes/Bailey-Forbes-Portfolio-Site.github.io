/**
 * The project timeline: a vertical git branch down the right rail.
 *
 * Newest commit first. The spine is the trunk, each dot is a commit on it, and
 * only the entry you have scrolled to is expanded — the rest stay as a date and
 * a title, so an eighteen-entry history is still scannable while exactly one
 * commit is readable. Between two entries the open crossfades, which is the
 * gradual part; once scrolling stops it settles onto one.
 *
 * The open/close runs on a ~24fps clock, the same one the off-the-clock decks
 * use: stepped motion reads as turning through something rather than sliding.
 *
 * Entries sit in normal flow, so opening one moves the ones below it. That is
 * fine here and a fixed-height window is not needed, because the rail is always
 * shorter than the prose column beside it — the grid row is sized by the prose,
 * so the page's own height never changes and the reader is never moved.
 */

const FRAMES_PER_SECOND = 24;
const STEP_MS = 1000 / FRAMES_PER_SECOND;

/** Where down the viewport an entry counts as the one being read. */
const FOCUS = 0.38;

interface Row {
  item: HTMLElement;
  detail: HTMLElement;
  /** Height of the collapsed row: the header alone. */
  head: number;
  /** Natural height of the detail when fully open. */
  open: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function mountTimelineDeck(
  graph: HTMLElement,
  items: HTMLElement[],
  links: HTMLElement[],
): void {
  if (items.length === 0) {
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rows: Row[] = [];
  let position = 0;
  let raf = 0;
  let lastStep = 0;
  let speed = 0;
  let focusLock = -1;
  let scrolling = false;
  let idleTimer = 0;

  function measure(): void {
    rows.length = 0;
    for (const item of items) {
      const detail = item.querySelector<HTMLElement>(".tl-detail");
      if (detail === null) {
        continue;
      }

      const previous = detail.style.height;
      detail.style.height = "auto";
      const open = detail.scrollHeight;
      detail.style.height = "0px";
      const head = item.getBoundingClientRect().height;
      detail.style.height = previous === "" ? "0px" : previous;
      rows.push({ item, detail, head, open });
    }
  }

  /**
   * Which entry the page is on. Measured from the rail's own top plus the
   * heights this module already knows, so it never reads back a layout it just
   * wrote — reading positions that the open state had changed would let the
   * open entry push itself off the focus line and oscillate.
   */
  function scrollTarget(): number {
    if (focusLock >= 0) {
      return focusLock;
    }

    const top = graph.getBoundingClientRect().top;
    const focusY = window.innerHeight * FOCUS;

    let y = 0;
    let best = 0;
    let bestDistance = Infinity;

    rows.forEach((row, index) => {
      const openness = clamp(1 - Math.abs(index - position), 0, 1);
      const centre = top + y + row.head / 2;
      const distance = Math.abs(centre - focusY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
      y += row.head + row.open * openness;
    });

    if (scrolling) {
      // Nudge toward the neighbour the focus line is heading for, so the two
      // crossfade instead of snapping.
      const row = rows[best];
      if (row !== undefined) {
        const offset = clamp((focusY - (top + centreOf(best))) / row.head, -0.5, 0.5);
        return clamp(best - offset, 0, rows.length - 1);
      }
    }

    return best;
  }

  function centreOf(target: number): number {
    let y = 0;
    for (let i = 0; i < target; i += 1) {
      const row = rows[i];
      if (row === undefined) {
        continue;
      }
      y += row.head + row.open * clamp(1 - Math.abs(i - position), 0, 1);
    }
    const row = rows[target];
    return y + (row === undefined ? 0 : row.head / 2);
  }

  function paint(): void {
    let y = 0;
    let currentY = 0;
    let total = 0;

    rows.forEach((row, index) => {
      const openness = clamp(1 - Math.abs(index - position), 0, 1);
      row.detail.style.height = `${(row.open * openness).toFixed(1)}px`;
      row.detail.style.opacity = openness.toFixed(3);
      row.item.dataset.current = String(openness > 0.5);

      if (index === Math.round(position)) {
        currentY = y + row.head / 2;
      }
      y += row.head + row.open * openness;
    });

    total = Math.max(1, y);
    graph.style.setProperty("--tl-progress", String(clamp(currentY / total, 0, 1)));
    graph.style.setProperty("--tl-speed", speed.toFixed(3));
  }

  function tick(now: number): void {
    raf = 0;
    const target = scrollTarget();

    if (reduced.matches) {
      position = target;
      speed = 0;
      paint();
      return;
    }

    if (now - lastStep >= STEP_MS) {
      // Advance the grid by one step rather than snapping it to now: a step is
      // 41.7ms and a display frame 16.7ms, so snapping rounds every step up to
      // three frames and it runs at 20fps, not 24.
      lastStep = now - lastStep > STEP_MS * 3 ? now : lastStep + STEP_MS;
      const delta = target - position;
      position += delta * 0.45;
      if (Math.abs(delta) < 0.002) {
        position = target;
      }
      speed = speed * 0.65 + Math.min(1, Math.abs(delta)) * 0.35;
      if (speed < 0.004) {
        speed = 0;
      }
      paint();
    }

    raf = requestAnimationFrame(tick);
  }

  function schedule(): void {
    if (raf === 0) {
      raf = requestAnimationFrame(tick);
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      scrolling = true;
      window.clearTimeout(idleTimer);
      // Once scrolling stops the deck settles onto exactly one entry; scroll
      // position is continuous, so a rest between two would leave both part
      // open.
      idleTimer = window.setTimeout(() => {
        scrolling = false;
        schedule();
      }, 140);
      schedule();
    },
    { passive: true },
  );
  window.addEventListener("resize", () => {
    measure();
    schedule();
  });
  reduced.addEventListener("change", schedule);

  links.forEach((link, index) => {
    link.addEventListener("focus", () => {
      focusLock = index;
      schedule();
    });
    link.addEventListener("blur", () => {
      focusLock = -1;
      schedule();
    });
  });

  measure();
  schedule();

  // Webfonts landing late change every row's height.
  if ("fonts" in document) {
    void document.fonts.ready.then(() => {
      measure();
      schedule();
    });
  }
}
