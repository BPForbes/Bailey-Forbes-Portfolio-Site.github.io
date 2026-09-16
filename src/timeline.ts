/**
 * The project timeline: a scrubbing deck of commit cards on the right rail.
 *
 * Newest commit first. Scrolling the page moves through history, and only the
 * card you are on is expanded — the rest collapse to a date and a title, so the
 * whole history stays scannable while exactly one commit is readable. Between
 * two cards the expansion crossfades, which is what makes it a scrub rather
 * than a jump.
 *
 * Everything advances on one ~24fps clock, the same one the off-the-clock decks
 * use: stepped motion reads as cards being turned one at a time.
 *
 * There is no dramatic tilt. An earlier pass leaned the deck back to 45 degrees
 * and it cost more legibility than it bought, so the depth cue is now a small
 * scale and fade — a deck you can still read (DESIGN.md R14).
 *
 * The track is absolutely positioned inside a fixed-height window, so opening a
 * card never changes the rail's own height. A rail that grew and shrank while
 * you scrolled would move the page under the reader.
 */

const FRAMES_PER_SECOND = 24;
const STEP_MS = 1000 / FRAMES_PER_SECOND;

/** Where the current card's top sits inside the window, as a fraction. */
const ANCHOR = 0.3;

/** Cards this far from the current one have faded out entirely. */
const FADE_OVER = 5;

interface Card {
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
  window_: HTMLElement,
  track: HTMLElement,
  items: HTMLElement[],
  links: HTMLElement[],
  region: HTMLElement,
): void {
  if (items.length === 0) {
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const cards: Card[] = [];
  let position = 0;
  let raf = 0;
  let lastStep = 0;
  let phase = 0;
  let speed = 0;
  let focusLock = -1;
  // Scroll position is continuous, so a rest between two commits would leave
  // both part-open. While scrolling they crossfade; once it stops, the deck
  // settles onto exactly one card.
  let scrolling = false;
  let idleTimer = 0;

  function measure(): void {
    cards.length = 0;
    for (const item of items) {
      const detail = item.querySelector<HTMLElement>(".tl-detail");
      if (detail === null) {
        continue;
      }

      // Measure open, then leave it to the paint below.
      detail.style.height = "auto";
      detail.style.opacity = "1";
      const open = detail.scrollHeight;
      detail.style.height = "0px";
      const head = item.getBoundingClientRect().height;
      cards.push({ item, detail, head, open });
    }

    const tallest = cards.reduce((m, c) => Math.max(m, c.open), 0);
    const heads = cards.reduce((m, c) => m + c.head, 0);
    // The window shows a few rows either side of the open one. Sized so the
    // open card always fits, whichever one it is.
    const visibleHeads = Math.min(heads, cards[0] !== undefined ? cards[0].head * 8 : 0);
    window_.style.height = `${Math.round(visibleHeads + tallest)}px`;
  }

  function scrollTarget(): number {
    if (focusLock >= 0) {
      return focusLock;
    }

    const box = region.getBoundingClientRect();
    const travel = Math.max(1, box.height - globalThis.innerHeight * 0.55);
    const progress = clamp((globalThis.innerHeight * 0.3 - box.top) / travel, 0, 1);
    const raw = progress * (cards.length - 1);
    return scrolling ? raw : Math.round(raw);
  }

  function paint(): void {
    const wavePhase = phase * 0.26;
    const amp = reduced.matches ? 0 : 0.35 + speed * 2.2;

    let y = 0;
    let anchorY = 0;

    cards.forEach((card, index) => {
      const d = index - position;
      const open = clamp(1 - Math.abs(d), 0, 1);
      const away = Math.abs(d);

      card.detail.style.height = `${(card.open * open).toFixed(1)}px`;
      card.detail.style.opacity = open.toFixed(3);

      if (index === Math.round(position)) {
        anchorY = y;
      }

      // Depth cue: a small recede and fade, no dramatic tilt.
      const scale = 1 - Math.min(0.1, away * 0.03);
      const tilt = reduced.matches ? 0 : Math.sin(wavePhase + index * 0.85) * amp;
      const float = reduced.matches ? 0 : Math.sin(wavePhase * 1.15 + index * 0.7) * amp;

      card.item.style.transform = `translateY(${float.toFixed(2)}px) scale(${scale.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
      card.item.style.opacity = clamp(1 - away / FADE_OVER, 0, 1).toFixed(3);
      card.item.dataset.current = String(open > 0.5);
      // A row faded out should not sit over one you can read.
      card.item.style.pointerEvents = away > FADE_OVER - 0.6 ? "none" : "auto";

      y += card.head + card.open * open;
    });

    const windowHeight = window_.getBoundingClientRect().height;
    track.style.transform = `translateY(${(windowHeight * ANCHOR - anchorY).toFixed(1)}px)`;

    graph.style.setProperty("--tl-progress", String(position / Math.max(1, cards.length - 1)));
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
      // three frames and the deck turns at 20fps, not 24.
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
      phase += 1;
      paint();
    }

    raf = requestAnimationFrame(tick);
  }

  function schedule(): void {
    if (raf === 0) {
      raf = requestAnimationFrame(tick);
    }
  }

  globalThis.addEventListener(
    "scroll",
    () => {
      scrolling = true;
      globalThis.clearTimeout(idleTimer);
      idleTimer = globalThis.setTimeout(() => {
        scrolling = false;
        schedule();
      }, 140);
      schedule();
    },
    { passive: true },
  );
  globalThis.addEventListener("resize", () => {
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
