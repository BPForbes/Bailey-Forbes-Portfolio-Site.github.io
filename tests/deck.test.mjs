import assert from "node:assert/strict";
import { mock, test } from "node:test";

/**
 * Just enough of a document for mountDecks to bind a stack and report which
 * card is on top. Reduced motion makes a release commit or spring back in the
 * same turn, so the count is the flick decision.
 */
function el(tag, { className = "", attrs = {}, text = "" } = {}, children = []) {
  const classes = new Set(className.split(/\s+/).filter(Boolean));
  const node = {
    tag,
    attrs,
    children,
    parent: null,
    classes,
    dataset: {},
    style: {},
    hidden: false,
    tabIndex: 0,
    textContent: text,
    listeners: {},
    classList: {
      add(...names) {
        for (const name of names) classes.add(name);
      },
      remove(...names) {
        for (const name of names) classes.delete(name);
      },
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] ?? null;
    },
    querySelectorAll(selector) {
      const found = [];
      const walk = (current) => {
        if (current !== this && matches(current, selector)) found.push(current);
        for (const child of current.children) walk(child);
      };
      walk(this);
      return found;
    },
    closest(selector) {
      let current = this;
      while (current !== null) {
        if (matches(current, selector)) return current;
        current = current.parent;
      }
      return null;
    },
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture() {
      return true;
    },
    getBoundingClientRect() {
      return { width: 320, height: 200, x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 200 };
    },
  };
  for (const child of children) child.parent = node;
  return node;
}

function matches(node, selector) {
  if (selector.startsWith(".")) return node.classes.has(selector.slice(1));
  if (selector.startsWith("[") && selector.endsWith("]")) {
    return Object.hasOwn(node.attrs, selector.slice(1, -1));
  }
  return node.tag === selector;
}

function card(title) {
  return el("li", { className: "note-card" }, [el("h4", { text: title })]);
}

function deck() {
  const count = el("p", { attrs: { "data-deck-count": "" } });
  const stack = el("ul", { attrs: { "data-deck-stack": "" } }, [card("First"), card("Second")]);
  const root = el("div", { attrs: { "data-deck": "" } }, [
    el("div", { attrs: { "data-deck-nav": "" } }, [
      el("button", { attrs: { "data-deck-prev": "" } }),
      count,
      el("button", { attrs: { "data-deck-next": "" } }),
    ]),
    el("div", { attrs: { "data-deck-frame": "" } }, [stack]),
    el("p", { attrs: { "data-deck-status": "" } }),
  ]);
  return { root, stack, count, front: stack.children[0] };
}

let now = 0;
mock.method(performance, "now", () => now);

globalThis.window = {
  matchMedia() {
    return { matches: true };
  },
  addEventListener() {},
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { mountDecks } = await import("../modules/deck.js");

function mount() {
  const built = deck();
  globalThis.document = {
    querySelectorAll() {
      return [built.root];
    },
  };
  mountDecks();
  return built;
}

function pointer(stack, type, x, target) {
  stack.listeners[type]({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: 0,
    target,
    preventDefault() {},
  });
}

test("a slow approach past the drag threshold is not a flick", () => {
  const built = mount();
  assert.equal(built.count.textContent, "1 of 2");

  now = 1_000;
  pointer(built.stack, "pointerdown", 0, built.front);
  // Past 6px, but only after a considered pause. Progress includes that whole
  // distance; the clock has to as well, or the last few milliseconds look fast.
  now = 1_500;
  pointer(built.stack, "pointermove", 8, built.front);
  now = 1_510;
  pointer(built.stack, "pointerup", 8, built.front);

  assert.equal(built.count.textContent, "1 of 2");
});

test("a fast short swipe still commits below the distance threshold", () => {
  const built = mount();
  now = 2_000;
  pointer(built.stack, "pointerdown", 0, built.front);
  now = 2_040;
  // 40px of a 192px travel is under COMMIT_AT. Release shares a timestamp with
  // the move that crosses the drag threshold; the clock still covers the whole
  // gesture, so the swipe stays a flick.
  pointer(built.stack, "pointermove", -40, built.front);
  pointer(built.stack, "pointerup", -40, built.front);

  assert.equal(built.count.textContent, "2 of 2");
});

test("a slow drag past half the card still commits", () => {
  const built = mount();
  now = 3_000;
  pointer(built.stack, "pointerdown", 0, built.front);
  now = 3_800;
  pointer(built.stack, "pointermove", -120, built.front);
  pointer(built.stack, "pointerup", -120, built.front);

  assert.equal(built.count.textContent, "2 of 2");
});
