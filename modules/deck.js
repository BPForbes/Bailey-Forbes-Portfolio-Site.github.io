const POSES = [
  { x: 0, y: 0, r: 0, s: 1, o: 1 },
  { x: 13, y: -4.45, r: 2.4, s: 0.975, o: 1 },
  { x: -11, y: -5.65, r: -3, s: 0.95, o: 1 },
  { x: 7, y: -6.45, r: 1.7, s: 0.925, o: 1 },
  { x: 0, y: -6.45, r: 0, s: 0.925, o: 0 }
];
const BIAS_X = [0, -6, 7, 0, -3];
const BIAS_R = [0, -0.9, 1.1, 0, 1.4];
const FRAMES_PER_SECOND = 24;
const STEP_MS = 1e3 / FRAMES_PER_SECOND;
const TRANSITION_MS = 340;
const COMMIT_AT = 0.5;
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpPose(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    r: lerp(a.r, b.r, t),
    s: lerp(a.s, b.s, t),
    o: lerp(a.o, b.o, t)
  };
}
function poseAt(depth) {
  const last = POSES.length - 1;
  const clamped = Math.max(0, Math.min(last, depth));
  const low = Math.floor(clamped);
  const high = Math.min(last, low + 1);
  return lerpPose(POSES[low], POSES[high], clamped - low);
}
function easeOut(t) {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function mountDecks() {
  document.querySelectorAll("[data-deck]").forEach(mountDeck);
}
function mountDeck(deck) {
  const stack = deck.querySelector("[data-deck-stack]");
  const frame = deck.querySelector("[data-deck-frame]");
  if (stack === null || frame === null) {
    return;
  }
  const pile = stack;
  const cards = Array.from(pile.querySelectorAll(".note-card"));
  const count = cards.length;
  if (count < 2) {
    return;
  }
  const nav = deck.querySelector("[data-deck-nav]");
  const prev = deck.querySelector("[data-deck-prev]");
  const next = deck.querySelector("[data-deck-next]");
  const countEl = deck.querySelector("[data-deck-count]");
  const status = deck.querySelector("[data-deck-status]");
  let front = 0;
  let raf = 0;
  let busy = false;
  let finishCurrent = null;
  pile.classList.add("is-stacked");
  if (nav !== null) {
    nav.hidden = false;
  }
  frame.tabIndex = 0;
  const depthOf = (index) => (index - front + count) % count;
  function exitPose() {
    const width = pile.getBoundingClientRect().width || 320;
    return { x: -(width * 1.15), y: 0.4, r: -13, s: 1, o: 0 };
  }
  function place(card, pose, z) {
    card.style.transform = `translate(${pose.x}px, ${pose.y}rem) rotate(${pose.r}deg) scale(${pose.s})`;
    card.style.opacity = String(pose.o);
    card.style.zIndex = String(z);
  }
  function render(t, direction) {
    const exit = exitPose();
    cards.forEach((card, index) => {
      const depth = depthOf(index);
      const bias = {
        x: BIAS_X[index % BIAS_X.length] ?? 0,
        r: BIAS_R[index % BIAS_R.length] ?? 0
      };
      let pose;
      let z = count - depth;
      if (direction === 1 && depth === 0) {
        pose = lerpPose(POSES[0], exit, t);
      } else if (direction === 1) {
        pose = poseAt(depth - t);
      } else if (direction === -1 && depth === count - 1) {
        pose = lerpPose(exit, POSES[0], t);
        z = count + 1;
      } else if (direction === -1) {
        pose = poseAt(depth + t);
      } else {
        pose = poseAt(depth);
      }
      place(card, { ...pose, x: pose.x + bias.x, r: pose.r + bias.r }, z);
    });
  }
  function settle() {
    cards.forEach((card, index) => {
      card.dataset.depth = String(Math.min(depthOf(index), POSES.length - 1));
    });
    const position = `${front + 1} of ${count}`;
    if (countEl !== null) {
      countEl.textContent = position;
    }
    render(0, 0);
  }
  function announce() {
    if (status === null) {
      return;
    }
    const name = cards[front]?.querySelector("h4")?.textContent?.trim() ?? "";
    status.textContent = `${front + 1} of ${count}: ${name}`;
  }
  function commit(direction) {
    front = (front + direction + count) % count;
    settle();
  }
  function setBusy(value) {
    busy = value;
    pile.dataset.deckBusy = String(value);
  }
  function cancelAnimation() {
    if (raf !== 0) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }
  function finishNow() {
    const done = finishCurrent;
    cancelAnimation();
    finishCurrent = null;
    if (done !== null) {
      done();
    }
  }
  function run(direction, from, to, done) {
    cancelAnimation();
    if (prefersReducedMotion()) {
      finishCurrent = null;
      done();
      return;
    }
    finishCurrent = done;
    const steps = Math.max(1, Math.round(Math.abs(to - from) * TRANSITION_MS / STEP_MS));
    const start = performance.now();
    const tick = (now) => {
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
  function go(direction, from = 0) {
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
  function bringToFront(index) {
    if (busy) {
      finishNow();
    }
    if (index === front) {
      return;
    }
    const remaining = depthOf(index);
    setBusy(true);
    const stepOnce = (left) => {
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
  frame.addEventListener("keydown", (event) => {
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
    release: (t, direction, flicked) => {
      if (t >= COMMIT_AT || flicked) {
        go(direction, t);
        return;
      }
      setBusy(true);
      run(direction, t, 0, () => {
        settle();
        setBusy(false);
      });
    }
  });
  setBusy(false);
  window.addEventListener("resize", () => {
    if (!busy) {
      render(0, 0);
    }
  });
  settle();
}
const DRAG_THRESHOLD_PX = 6;
const FLICK_WINDOW_MS = 220;
const FLICK_RATE = COMMIT_AT / FLICK_WINDOW_MS;
function attachPointer(stack, cards, hooks) {
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let dragStartTime = 0;
  let pressedIndex = -1;
  let progress = 0;
  let direction = 1;
  function reset() {
    stack.classList.remove("is-dragging");
    pointerId = null;
    dragging = false;
    dragStartTime = 0;
    pressedIndex = -1;
    progress = 0;
  }
  function isFlick() {
    const elapsed = performance.now() - dragStartTime;
    return elapsed > 0 && progress / elapsed >= FLICK_RATE;
  }
  stack.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || hooks.isBusy()) {
      return;
    }
    const card = event.target?.closest(".note-card") ?? null;
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
  stack.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) {
        return;
      }
      if (Math.abs(dy) > Math.abs(dx)) {
        reset();
        return;
      }
      dragging = true;
      dragStartTime = performance.now();
      stack.classList.add("is-dragging");
      stack.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    direction = dx < 0 ? 1 : -1;
    const travel = (stack.getBoundingClientRect().width || 320) * 0.6;
    progress = Math.min(1, Math.abs(dx) / travel);
    hooks.drag(progress, direction);
  });
  function finish(event) {
    if (pointerId !== event.pointerId) {
      return;
    }
    const wasDragging = dragging;
    const tappedIndex = pressedIndex;
    const t = progress;
    const dir = direction;
    const flicked = wasDragging && isFlick();
    if (wasDragging && stack.hasPointerCapture(event.pointerId)) {
      stack.releasePointerCapture(event.pointerId);
    }
    reset();
    if (wasDragging) {
      hooks.release(t, dir, flicked);
      return;
    }
    if (tappedIndex >= 0 && hooks.depthOf(tappedIndex) !== 0) {
      hooks.bringToFront(tappedIndex);
    }
  }
  stack.addEventListener("pointerup", finish);
  stack.addEventListener("pointercancel", () => {
    const wasDragging = dragging;
    const t = progress;
    const dir = direction;
    const flicked = wasDragging && isFlick();
    reset();
    if (wasDragging) {
      hooks.release(t, dir, flicked);
    }
  });
}
export {
  mountDecks
};
