/**
 * The off-the-clock card stacks.
 *
 * One card is readable at a time; the ones behind rise out of the top of the
 * pile so you can see what is next, the way cards stand in a recipe box.
 * Advancing sends the front card to the back, so the stack cycles and never
 * dead-ends — which is why there is a visible "n of m" count, otherwise there
 * would be no way to tell you had been all the way round (DESIGN.md R19).
 *
 * The stacking is applied by this module, never by the markup. Without it the
 * cards are a plain vertical list and the nav stays `hidden`, because five
 * cards piled on top of each other with nothing to cycle them is unreadable
 * and a control that cannot work should not be on the page (R21).
 *
 * Every card stays in the DOM and in the accessibility tree at its source
 * position, so assistive technology reads all five in order regardless of
 * which one is on top. Only the eye is asked to take them one at a time.
 */

/** Cards drawn behind the front one. Deeper cards are transparent. */
const VISIBLE_BEHIND = 3;

/** Pointer travel before a press counts as a swipe rather than a click. */
const SWIPE_THRESHOLD_PX = 48;

/** Travel before we take over the pointer and stop treating it as a click. */
const DRAG_THRESHOLD_PX = 6;

export function mountDecks(): void {
  document.querySelectorAll<HTMLElement>("[data-deck]").forEach(mountDeck);
}

function mountDeck(deck: HTMLElement): void {
  const stack = deck.querySelector<HTMLElement>("[data-deck-stack]");
  const frame = deck.querySelector<HTMLElement>("[data-deck-frame]");
  if (stack === null || frame === null) {
    return;
  }

  const cards = Array.from(stack.querySelectorAll<HTMLElement>(".note-card"));
  if (cards.length < 2) {
    return;
  }

  const nav = deck.querySelector<HTMLElement>("[data-deck-nav]");
  const prev = deck.querySelector<HTMLButtonElement>("[data-deck-prev]");
  const next = deck.querySelector<HTMLButtonElement>("[data-deck-next]");
  const count = deck.querySelector<HTMLElement>("[data-deck-count]");
  const status = deck.querySelector<HTMLElement>("[data-deck-status]");

  let front = 0;

  stack.classList.add("is-stacked");
  if (nav !== null) {
    nav.hidden = false;
  }

  // Now that the cards are one on top of another, the pile is the thing you
  // step to, and the arrow keys move through it.
  frame.tabIndex = 0;

  function depthOf(index: number): number {
    return (index - front + cards.length) % cards.length;
  }

  function nameOf(index: number): string {
    const card = cards[index];
    return card?.querySelector("h4")?.textContent?.trim() ?? "";
  }

  function apply(announce: boolean): void {
    cards.forEach((card, index) => {
      const depth = depthOf(index);
      card.dataset.depth = String(Math.min(depth, VISIBLE_BEHIND + 1));
      card.style.zIndex = String(cards.length - depth);
    });

    const position = `${front + 1} of ${cards.length}`;
    if (count !== null) {
      count.textContent = position;
    }
    // The visible count is not a live region, so this is the only announcement
    // and it does not double up.
    if (status !== null && announce) {
      status.textContent = `${position}: ${nameOf(front)}`;
    }
  }

  function go(direction: -1 | 1): void {
    front = (front + direction + cards.length) % cards.length;
    apply(true);
  }

  function bringToFront(index: number): void {
    if (index === front) {
      return;
    }

    front = index;
    apply(true);
  }

  prev?.addEventListener("click", () => {
    go(-1);
  });
  next?.addEventListener("click", () => {
    go(1);
  });

  frame.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      go(-1);
    }
  });

  attachPointer(stack, cards, {
    depthOf,
    bringToFront,
    go,
    reset: () => {
      apply(false);
    },
  });

  apply(false);
}

interface PointerHooks {
  depthOf: (index: number) => number;
  bringToFront: (index: number) => void;
  go: (direction: -1 | 1) => void;
  reset: () => void;
}

/**
 * One pointer handler covers touch swipe, mouse drag and the tap-a-card-behind
 * shortcut, because they are the same gesture at different distances: a press
 * that barely moves is a tap, and one that travels is a swipe.
 */
function attachPointer(stack: HTMLElement, cards: HTMLElement[], hooks: PointerHooks): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let frontCard: HTMLElement | null = null;
  let pressedIndex = -1;

  function clear(): void {
    if (frontCard !== null) {
      frontCard.style.transform = "";
      frontCard.style.opacity = "";
    }
    stack.classList.remove("is-dragging");
    pointerId = null;
    dragging = false;
    frontCard = null;
    pressedIndex = -1;
  }

  stack.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    const card = (event.target as Element | null)?.closest<HTMLElement>(".note-card") ?? null;
    if (card === null) {
      return;
    }

    pointerId = event.pointerId;
    pressedIndex = cards.indexOf(card);
    startX = event.clientX;
    startY = event.clientY;
    dragging = false;
    const frontIndex = cards.findIndex((_, i) => hooks.depthOf(i) === 0);
    frontCard = frontIndex >= 0 ? (cards[frontIndex] ?? null) : null;
  });

  stack.addEventListener("pointermove", (event: PointerEvent) => {
    if (pointerId !== event.pointerId || frontCard === null) {
      return;
    }

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) {
        return;
      }
      // A mostly-vertical drag is the page scrolling, not a swipe. Let it go.
      if (Math.abs(dy) > Math.abs(dx)) {
        clear();
        return;
      }

      dragging = true;
      stack.classList.add("is-dragging");
      stack.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const tilt = dx / 26;
    frontCard.style.transform = `translate(${dx}px, 0) rotate(${tilt}deg)`;
    frontCard.style.opacity = String(Math.max(0.45, 1 - Math.abs(dx) / 420));
  });

  function finish(event: PointerEvent): void {
    if (pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - startX;
    const wasDragging = dragging;
    const tappedIndex = pressedIndex;

    if (wasDragging && stack.hasPointerCapture(event.pointerId)) {
      stack.releasePointerCapture(event.pointerId);
    }

    clear();

    if (wasDragging) {
      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX) {
        hooks.go(dx < 0 ? 1 : -1);
      } else {
        hooks.reset();
      }
      return;
    }

    // A press that never travelled: if it landed on a card behind, deal that
    // one to the front.
    if (tappedIndex >= 0 && hooks.depthOf(tappedIndex) !== 0) {
      hooks.bringToFront(tappedIndex);
    }
  }

  stack.addEventListener("pointerup", finish);
  stack.addEventListener("pointercancel", () => {
    const wasDragging = dragging;
    clear();
    if (wasDragging) {
      hooks.reset();
    }
  });
}
