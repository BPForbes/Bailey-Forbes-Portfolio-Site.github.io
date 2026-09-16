/**
 * The off-the-clock card decks.
 *
 * The scroller is a plain overflow container, so touch swipe, trackpad,
 * shift+wheel and arrow keys are the browser's, not ours. Everything here only
 * drives that same scroller:
 *
 *   - the arrow buttons scroll by one card and disable at each end, so their
 *     state is real rather than decorative (DESIGN.md R21);
 *   - pointer drag is added for mice, which get no swipe. It waits for a real
 *     drag before it starts, so clicking and selecting text still work;
 *   - the edge fade is set from scroll position, so it says "there is more
 *     this way" instead of decorating the edge permanently (R10).
 *
 * Nothing here animates on its own, and every scroll respects
 * prefers-reduced-motion (R26, R27).
 */

const DRAG_THRESHOLD_PX = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function mountDecks(): void {
  document.querySelectorAll<HTMLElement>("[data-deck]").forEach(mountDeck);
}

function mountDeck(deck: HTMLElement): void {
  const scroller = deck.querySelector<HTMLElement>("[data-deck-scroller]");
  if (scroller === null) {
    return;
  }

  const prev = deck.querySelector<HTMLButtonElement>("[data-deck-prev]");
  const next = deck.querySelector<HTMLButtonElement>("[data-deck-next]");

  function step(): number {
    const first = scroller?.querySelector<HTMLElement>(".note-card");
    if (!first || !scroller) {
      return 320;
    }

    const gap = parseFloat(getComputedStyle(scroller.firstElementChild ?? first).gap) || 0;
    return first.getBoundingClientRect().width + gap;
  }

  function sync(): void {
    if (scroller === null) {
      return;
    }

    // Sub-pixel layout means scrollLeft rarely lands exactly on the maximum.
    const max = scroller.scrollWidth - scroller.clientWidth;
    const atStart = scroller.scrollLeft <= 1;
    const atEnd = scroller.scrollLeft >= max - 1;
    const scrolls = max > 1;

    scroller.dataset.overflowStart = String(scrolls && !atStart);
    scroller.dataset.overflowEnd = String(scrolls && !atEnd);

    if (prev !== null) {
      prev.disabled = !scrolls || atStart;
    }
    if (next !== null) {
      next.disabled = !scrolls || atEnd;
    }
  }

  function scrollByCards(direction: -1 | 1): void {
    scroller?.scrollBy({
      left: step() * direction,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  prev?.addEventListener("click", () => {
    scrollByCards(-1);
  });
  next?.addEventListener("click", () => {
    scrollByCards(1);
  });

  scroller.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);

  // Fonts landing late change card widths, so re-measure once they do.
  if ("fonts" in document) {
    void document.fonts.ready.then(sync);
  }

  attachPointerDrag(scroller);
  sync();
}

/**
 * Drag-to-scroll for pointers that cannot swipe. Touch is left alone — it
 * already scrolls natively, and hijacking it would break momentum and snap.
 */
function attachPointerDrag(scroller: HTMLElement): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let dragging = false;

  scroller.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) {
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = scroller.scrollLeft;
    dragging = false;
  });

  scroller.addEventListener("pointermove", (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
      return;
    }

    const delta = event.clientX - startX;
    if (!dragging) {
      // Until the pointer has actually travelled, this is still a click or a
      // text selection and must be left alone.
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) {
        return;
      }

      dragging = true;
      scroller.classList.add("is-dragging");
      scroller.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    scroller.scrollLeft = startScroll - delta;
  });

  const end = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) {
      return;
    }

    if (dragging && scroller.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    pointerId = null;
    dragging = false;
    scroller.classList.remove("is-dragging");
  };

  scroller.addEventListener("pointerup", end);
  scroller.addEventListener("pointercancel", end);
}
