/**
 * The off-the-clock card stacks.
 *
 * One card is readable at a time; the ones behind rise out of the top of the
 * pile so you can see what is next, the way cards stand in a recipe box.
 * Advancing deals the front card off and shuffles the rest forward, so the
 * stack cycles and never dead-ends — which is why there is a visible "n of m",
 * otherwise there would be no way to tell you had been all the way round.
 *
 * Moving between cards is a real transition, not a swap: every card is posed
 * from a single continuous progress value, so the same code drives a drag
 * (progress follows your finger) and a button press (progress is animated).
 * Half way through a drag the stack is genuinely half way between two states.
 *
 * The geometry lives here rather than in the stylesheet because it has to be
 * interpolated at arbitrary points between the resting poses; CSS can only
 * name the ends. The stylesheet still owns how a card looks.
 *
 * The stacking is applied by this module, never by the markup. Without it the
 * cards are a plain vertical list and the nav stays `hidden`, because five
 * cards piled on top of each other with nothing to cycle them is unreadable
 * and a control that cannot work should not be on the page (DESIGN.md R21).
 *
 * Every card stays in the DOM and in the accessibility tree at its source
 * position, so assistive technology reads all five in order regardless of
 * which one is on top. Only the eye is asked to take them one at a time.
 */

/** Where a card sits at each depth. x is px, y is rem, r is degrees. */
interface Pose {
  x: number;
  y: number;
  r: number;
  s: number;
  o: number;
}

/** Resting poses, front first. The last is "deeper than the visible stack". */
const POSES: readonly Pose[] = [
  { x: 0, y: 0, r: 0, s: 1, o: 1 },
  { x: 13, y: -4.45, r: 2.4, s: 0.975, o: 1 },
  { x: -11, y: -5.65, r: -3, s: 0.95, o: 1 },
  { x: 7, y: -6.45, r: 1.7, s: 0.925, o: 1 },
  { x: 0, y: -6.45, r: 0, s: 0.925, o: 0 },
];

/** Per-card nudge, so the pile looks hand-stacked rather than machined. */
const BIAS_X = [0, -6, 7, 0, -3];
const BIAS_R = [0, -0.9, 1.1, 0, 1.4];

/**
 * Deliberately stepped rather than smooth: the transition is sampled at about
 * 24 fps so it reads like cards being dealt one at a time instead of a single
 * eased glide. Raise this to 60 for a conventional tween.
 */
const FRAMES_PER_SECOND = 24;
const STEP_MS = 1000 / FRAMES_PER_SECOND;

/** One card's worth of travel. */
const TRANSITION_MS = 340;

/** Fraction of a card's width a drag must cover to commit on release. */
const COMMIT_AT = 0.5;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    r: lerp(a.r, b.r, t),
    s: lerp(a.s, b.s, t),
    o: lerp(a.o, b.o, t),
  };
}

/** The resting pose at a fractional depth, so 1.5 is half way between two. */
function poseAt(depth: number): Pose {
  const last = POSES.length - 1;
  const clamped = Math.max(0, Math.min(last, depth));
  const low = Math.floor(clamped);
  const high = Math.min(last, low + 1);
  return lerpPose(POSES[low] as Pose, POSES[high] as Pose, clamped - low);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function mountDecks(): void {
  document.querySelectorAll<HTMLElement>("[data-deck]").forEach(mountDeck);
}

type Direction = -1 | 0 | 1;

function mountDeck(deck: HTMLElement): void {
  const stack = deck.querySelector<HTMLElement>("[data-deck-stack]");
  const frame = deck.querySelector<HTMLElement>("[data-deck-frame]");
  if (stack === null || frame === null) {
    return;
  }

  const pile = stack;
  const cards = Array.from(pile.querySelectorAll<HTMLElement>(".note-card"));
  const count = cards.length;
  if (count < 2) {
    return;
  }

  const nav = deck.querySelector<HTMLElement>("[data-deck-nav]");
  const prev = deck.querySelector<HTMLButtonElement>("[data-deck-prev]");
  const next = deck.querySelector<HTMLButtonElement>("[data-deck-next]");
  const countEl = deck.querySelector<HTMLElement>("[data-deck-count]");
  const status = deck.querySelector<HTMLElement>("[data-deck-status]");

  let front = 0;
  let raf = 0;
  let busy = false;
  // Set while an in-flight transition still owes its commit, so a press that
  // arrives mid-deal can finish it rather than be dropped.
  let finishCurrent: (() => void) | null = null;

  pile.classList.add("is-stacked");
  if (nav !== null) {
    nav.hidden = false;
  }
  frame.tabIndex = 0;

  const depthOf = (index: number): number => (index - front + count) % count;

  /** Off the side of the pile, far enough to clear it whatever the width. */
  function exitPose(): Pose {
    const width = pile.getBoundingClientRect().width || 320;
    return { x: -(width * 1.15), y: 0.4, r: -13, s: 1, o: 0 };
  }

  function place(card: HTMLElement, pose: Pose, z: number): void {
    card.style.transform =
      `translate(${pose.x}px, ${pose.y}rem) rotate(${pose.r}deg) scale(${pose.s})`;
    card.style.opacity = String(pose.o);
    card.style.zIndex = String(z);
  }

  /**
   * Pose every card for a transition that is `t` of the way from the current
   * arrangement to the next one. At t = 0 this is the resting stack, so it
   * doubles as the at-rest renderer.
   */
  function render(t: number, direction: Direction): void {
    const exit = exitPose();

    cards.forEach((card, index) => {
      const depth = depthOf(index);
      const bias = {
        x: BIAS_X[index % BIAS_X.length] ?? 0,
        r: BIAS_R[index % BIAS_R.length] ?? 0,
      };

      let pose: Pose;
      let z = count - depth;

      if (direction === 1 && depth === 0) {
        // The front card is being dealt away; it stays on top as it goes.
        pose = lerpPose(POSES[0] as Pose, exit, t);
      } else if (direction === 1) {
        pose = poseAt(depth - t);
      } else if (direction === -1 && depth === count - 1) {
        // The card at the bottom is coming back round to the front.
        pose = lerpPose(exit, POSES[0] as Pose, t);
        z = count + 1;
      } else if (direction === -1) {
        pose = poseAt(depth + t);
      } else {
        pose = poseAt(depth);
      }

      place(card, { ...pose, x: pose.x + bias.x, r: pose.r + bias.r }, z);
    });
  }

  function settle(): void {
    cards.forEach((card, index) => {
      card.dataset.depth = String(Math.min(depthOf(index), POSES.length - 1));
    });

    const position = `${front + 1} of ${count}`;
    if (countEl !== null) {
      countEl.textContent = position;
    }
    render(0, 0);
  }

  function announce(): void {
    if (status === null) {
      return;
    }
    const name = cards[front]?.querySelector("h4")?.textContent?.trim() ?? "";
    status.textContent = `${front + 1} of ${count}: ${name}`;
  }

  function commit(direction: Exclude<Direction, 0>): void {
    front = (front + direction + count) % count;
    settle();
  }

  function setBusy(value: boolean): void {
    busy = value;
    pile.dataset.deckBusy = String(value);
  }

  function cancelAnimation(): void {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  /**
   * Land the in-flight transition at once. Dropping input mid-deal makes a
   * quick double-press feel broken, so a new press finishes the current card
   * instead — which is also what riffling a real deck does.
   */
  function finishNow(): void {
    const done = finishCurrent;
    cancelAnimation();
    finishCurrent = null;
    if (done !== null) {
      done();
    }
  }

  /**
   * Walk progress between `from` and `to` in ~24 fps steps. Sampling the eased
   * curve at discrete steps — rather than every display frame — is what gives
   * the dealt-by-hand feel the smooth version does not have.
   */
  function run(direction: Exclude<Direction, 0>, from: number, to: number, done: () => void): void {
    cancelAnimation();

    if (prefersReducedMotion()) {
      finishCurrent = null;
      done();
      return;
    }

    finishCurrent = done;

    const steps = Math.max(1, Math.round((Math.abs(to - from) * TRANSITION_MS) / STEP_MS));
    const start = performance.now();

    const tick = (now: number): void => {
      // Derive the step from elapsed time rather than counting animation
      // frames. A step is 41.7ms and a display frame is 16.7ms, so counting
      // frames rounds every step up to three of them and the deal runs at
      // 20fps instead of 24.
      const step = Math.min(steps, Math.floor((now - start) / STEP_MS) + 1);
      const progress = Math.min(1, step / steps);
      render(lerp(from, to, easeOut(progress)), direction);

      if (progress >= 1) {
        raf = 0;
        finishCurrent = null;
        done();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  }

  function go(direction: Exclude<Direction, 0>, from = 0): void {
    if (busy) {
      finishNow();
    }

    setBusy(true);
    run(direction, from, 1, () => {
      commit(direction);
      announce();
      setBusy(false);
    });
  }

  /** Deal forward one card at a time until `index` is on top. */
  function bringToFront(index: number): void {
    if (busy) {
      finishNow();
    }
    if (index === front) {
      return;
    }

    const remaining = depthOf(index);
    setBusy(true);

    const stepOnce = (left: number): void => {
      if (left === 0) {
        announce();
        setBusy(false);
        return;
      }

      run(1, 0, 1, () => {
        commit(1);
        stepOnce(left - 1);
      });
    };

    stepOnce(remaining);
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

  attachPointer(pile, cards, {
    depthOf,
    bringToFront,
    isBusy: () => busy,
    drag: (t, direction) => {
      render(t, direction);
    },
    release: (t, direction) => {
      if (t >= COMMIT_AT) {
        go(direction, t);
        return;
      }

      setBusy(true);
      run(direction, t, 0, () => {
        settle();
        setBusy(false);
      });
    },
  });

  setBusy(false);

  window.addEventListener("resize", () => {
    if (!busy) {
      render(0, 0);
    }
  });

  settle();
}

interface PointerHooks {
  depthOf: (index: number) => number;
  bringToFront: (index: number) => void;
  isBusy: () => boolean;
  drag: (t: number, direction: Exclude<Direction, 0>) => void;
  release: (t: number, direction: Exclude<Direction, 0>) => void;
}

/** Travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD_PX = 6;

/**
 * One handler covers touch swipe, mouse drag and the tap-a-card-behind
 * shortcut, because they are the same gesture at different distances: a press
 * that barely moves is a tap, one that travels is a drag. Dragging reports
 * progress continuously, so the pile follows the pointer instead of waiting
 * for release to jump.
 */
function attachPointer(stack: HTMLElement, cards: HTMLElement[], hooks: PointerHooks): void {
  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let pressedIndex = -1;
  let progress = 0;
  let direction: Exclude<Direction, 0> = 1;

  function reset(): void {
    stack.classList.remove("is-dragging");
    pointerId = null;
    dragging = false;
    pressedIndex = -1;
    progress = 0;
  }

  stack.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || hooks.isBusy()) {
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
    progress = 0;
  });

  stack.addEventListener("pointermove", (event: PointerEvent) => {
    if (pointerId !== event.pointerId) {
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
        reset();
        return;
      }

      dragging = true;
      stack.classList.add("is-dragging");
      stack.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    direction = dx < 0 ? 1 : -1;
    const travel = (stack.getBoundingClientRect().width || 320) * 0.6;
    progress = Math.min(1, Math.abs(dx) / travel);
    hooks.drag(progress, direction);
  });

  function finish(event: PointerEvent): void {
    if (pointerId !== event.pointerId) {
      return;
    }

    const wasDragging = dragging;
    const tappedIndex = pressedIndex;
    const t = progress;
    const dir = direction;

    if (wasDragging && stack.hasPointerCapture(event.pointerId)) {
      stack.releasePointerCapture(event.pointerId);
    }

    reset();

    if (wasDragging) {
      hooks.release(t, dir);
      return;
    }

    // A press that never travelled: if it landed on a card behind, deal down
    // to it.
    if (tappedIndex >= 0 && hooks.depthOf(tappedIndex) !== 0) {
      hooks.bringToFront(tappedIndex);
    }
  }

  stack.addEventListener("pointerup", finish);
  stack.addEventListener("pointercancel", () => {
    const wasDragging = dragging;
    const t = progress;
    const dir = direction;
    reset();
    if (wasDragging) {
      hooks.release(t, dir);
    }
  });
}
