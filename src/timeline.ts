/**
 * The project timeline: a deck of commit cards on the right rail.
 *
 * Newest first. Scrolling the page scrubs the deck — position is continuous,
 * so the page drives it directly, and the deal is sampled at ~24fps for the
 * same reason the off-the-clock stacks are: stepped motion reads as cards being
 * turned one at a time where a smooth tween reads as a glide.
 *
 * The card in front sits square on and is fully readable. The ones behind
 * recede and tip back toward 45 degrees, which is what makes it a deck rather
 * than a list — but text at 45 degrees is not text anyone reads, so the tilt is
 * strictly for the cards you are not reading yet (DESIGN.md R14: an effect has
 * to leave the content legible).
 *
 * Every card is a link to its commit and stays in the tab order, and focusing
 * one brings it to the front. That is the whole keyboard path: Tab walks the
 * history and each commit becomes readable as you reach it.
 */

const FRAMES_PER_SECOND = 24;
const STEP_MS = 1000 / FRAMES_PER_SECOND;

/** Cards drawn behind the front one before they are faded out entirely. */
const DEPTH = 4;

/** How far the deck tips back. The front card is never tilted. */
const MAX_TILT_DEG = 45;

interface Pose {
  y: number;
  z: number;
  rx: number;
  rz: number;
  o: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Where a card sits when it is `d` cards behind the front. Negative d is a card
 * the scroll has already passed: it lifts away and tips back as it goes.
 */
function poseAt(d: number): Pose {
  if (d <= 0) {
    const t = clamp(-d, 0, 1);
    return {
      y: -t * 42,
      z: -t * 150,
      rx: t * MAX_TILT_DEG,
      rz: 0,
      o: 1 - t,
    };
  }

  const ahead = clamp(d, 0, DEPTH + 1);
  return {
    // Cards behind stand up out of the top of the pile, the same way the
    // off-the-clock decks show what is next rather than hiding it.
    // The perspective shrink already pulls a receding card's top edge down, so
    // the lift has to beat it before any of the next card shows at all.
    y: -ahead * 58,
    z: -ahead * 95,
    // Reaches the full tilt by the second card back, so only the front card and
    // its immediate follower carry readable type.
    rx: Math.min(MAX_TILT_DEG, ahead * 26),
    rz: 0,
    o: Math.max(0, 1 - ahead * 0.3),
  };
}

export function mountTimelineDeck(
  graph: HTMLElement,
  items: HTMLElement[],
  links: HTMLElement[],
  region: HTMLElement,
): void {
  if (items.length === 0) {
    return;
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let position = 0;
  let target = 0;
  let speed = 0;
  let raf = 0;
  let lastStep = 0;
  let phase = 0;
  let focusLock = -1;

  function scrollTarget(): number {
    if (focusLock >= 0) {
      return focusLock;
    }

    // How far the page has read through the section the rail belongs to.
    const box = region.getBoundingClientRect();
    const travel = Math.max(1, box.height - window.innerHeight * 0.6);
    const progress = clamp((window.innerHeight * 0.35 - box.top) / travel, 0, 1);
    return progress * (items.length - 1);
  }

  function paint(_now: number): void {
    // One radian step per ~24fps frame keeps the roll on the same clock.
    const wavePhase = phase * 0.26;

    items.forEach((card, index) => {
      const d = index - position;
      const pose = poseAt(d);

      // The wave: a slow travelling roll down the deck. Its amplitude rises
      // with scroll activity and settles to a small idle float, so it never
      // becomes constant motion competing with the prose beside it (R27).
      const amp = reduced.matches ? 0 : 0.7 + speed * 5.5;
      const rz = Math.sin(wavePhase + index * 0.85) * amp;
      const lift = Math.sin(wavePhase * 1.15 + index * 0.7) * amp * 1.4;

      const front = Math.abs(d) < 0.5;
      card.style.transform =
        `translate3d(0, ${pose.y + lift}px, ${pose.z}px) ` +
        `rotateX(${pose.rx}deg) rotateZ(${pose.rz + rz}deg)`;
      card.style.opacity = String(pose.o);
      // Strictly monotonic in distance from the front. Rounding to whole card
      // indices lets two cards mid-scrub share a z-index, and the one behind
      // paints over the one being read.
      card.style.zIndex = String(Math.round(1000 - Math.abs(d) * 12));
      card.dataset.front = String(front);
      // A card you cannot read should not be a click target sitting over one
      // you can.
      card.style.pointerEvents = pose.o < 0.35 ? "none" : "auto";
    });

    graph.style.setProperty("--tl-progress", String(position / Math.max(1, items.length - 1)));
    graph.style.setProperty("--tl-speed", speed.toFixed(3));
  }

  /**
   * The single clock. Position, wave and paint all advance on the same ~24fps
   * grid — painting every display frame would put the deck back at 60fps even
   * with the position stepping, because the wave moves on every frame it is
   * given.
   */
  function tick(now: number): void {
    raf = 0;
    target = scrollTarget();

    if (reduced.matches) {
      position = target;
      speed = 0;
      paint(lastStep);
      return;
    }

    if (now - lastStep >= STEP_MS) {
      // Advance the grid by exactly one step rather than snapping it to now.
      // A display frame is 16.7ms and a step is 41.7ms, so snapping rounds
      // every step up to three frames and the deck turns at 20fps, not 24.
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
      paint(lastStep);
    }

    raf = requestAnimationFrame(tick);
  }

  function schedule(): void {
    if (raf === 0) {
      raf = requestAnimationFrame(tick);
    }
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
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

  schedule();
}
