import { PORTFOLIO } from "./data.js";
import { icon } from "./icons.js";
import { timelineEvents } from "./projectMetadata.js";
import { themeForEvent } from "./releaseThemes.js";
import type { ProjectId, ReleaseTheme, TimelineEvent } from "./types.js";

/**
 * An optional, opt-in alternate view of a project's timeline: releases on
 * the left, the selected one's own words below that, and a small themed 3D
 * scene on the right that fades from one theme to the next as the selection
 * moves — asked for directly, as a more engaging way into the same history
 * `mountTimelineWindow` (src/timeline.ts) already renders as an accessible
 * text pager. That pager is untouched and stays the primary, fully
 * accessible way to read this content; the canvas here is `aria-hidden` and
 * never carries information the list beside it doesn't already state in
 * real text (DESIGN.md R29's "decorative feature" framing — the same
 * reasoning already applied to `.project-motif`).
 *
 * `three` and the scene builders (`src/releaseScenes.ts`) are dynamically
 * imported only when this actually opens, the same lazy-loading discipline
 * `src/timeline.ts` and `src/releases.ts` already use for `commitBody.js` —
 * a visitor who never opens this never downloads any of it.
 *
 * This is the first `role="dialog"` in the codebase (no `.modal`/
 * `aria-modal` precedent existed before it — see DESIGN.md), so focus
 * management is spelled out in full here rather than borrowed: focus moves
 * to the close button on open, Tab is cycled within the dialog while it's
 * open, and focus returns to whichever trigger button opened it on close.
 * The overlay itself is a fixed, inset:0 element — the same shape as
 * `src/guestWindow.ts`'s `.is-overlay` CSS fallback, not the real
 * Fullscreen API: that API has per-browser permission/gesture quirks this
 * feature doesn't need, since the visible result (full-viewport, its own
 * escape hatch) is what was actually asked for, not real OS fullscreen.
 */

function isProjectId(value: string): value is ProjectId {
  return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}

/** Newest first, ties broken by authoring order — mirrors site.ts's own renderTimeline() ordering, so the two views never disagree. */
function orderedEventsFor(project: ProjectId): readonly TimelineEvent[] {
  return timelineEvents()
    .map((event, index) => ({ event, index }))
    .filter((row) => row.event.project === project)
    .sort((a, b) => b.event.date.localeCompare(a.event.date) || b.index - a.index)
    .map((row) => row.event);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function accentColor(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--action").trim();
  return value === "" ? "#c98a4a" : value;
}

const TRANSITION_MS = 600;

interface ExplorerState {
  readonly overlay: HTMLElement;
  readonly trigger: HTMLElement;
  close(): void;
}

let activeExplorer: ExplorerState | null = null;

export function mountReleaseExplorers(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-release-explorer-trigger]").forEach((trigger) => {
    const project = trigger.getAttribute("data-project");
    if (project === null || !isProjectId(project)) {
      return;
    }
    const events = orderedEventsFor(project);
    if (events.length === 0) {
      trigger.hidden = true;
      return;
    }
    trigger.addEventListener("click", () => {
      void openExplorer(project, events, trigger);
    });
  });
}

async function openExplorer(
  project: ProjectId,
  events: readonly TimelineEvent[],
  trigger: HTMLElement,
): Promise<void> {
  if (activeExplorer) {
    return;
  }

  const [{ buildScene }, { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, WebGLRenderer }] = await Promise.all([
    import("./releaseScenes.js"),
    import("three"),
  ]);

  const projectName = PORTFOLIO.projects[project];
  const overlay = document.createElement("div");
  overlay.className = "release-explorer";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `${projectName} release explorer`);
  overlay.innerHTML = `
    <button type="button" class="release-explorer-close" data-explorer-close aria-label="Close release explorer">
      ${icon("xmark")}
    </button>
    <div class="release-explorer-body">
      <div class="release-explorer-panel">
        <div class="release-explorer-list" role="list" data-explorer-list></div>
        <div class="release-explorer-detail" data-explorer-detail></div>
      </div>
      <div class="release-explorer-stage" aria-hidden="true">
        <canvas data-explorer-canvas></canvas>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.classList.add("release-explorer-open");

  const listEl = overlay.querySelector<HTMLElement>("[data-explorer-list]")!;
  const detailEl = overlay.querySelector<HTMLElement>("[data-explorer-detail]")!;
  const canvas = overlay.querySelector<HTMLCanvasElement>("[data-explorer-canvas]")!;
  const closeBtn = overlay.querySelector<HTMLButtonElement>("[data-explorer-close]")!;
  const stage = overlay.querySelector<HTMLElement>(".release-explorer-stage")!;

  const itemButtons: HTMLButtonElement[] = events.map((event, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "release-explorer-item";
    item.setAttribute("role", "listitem");
    item.dataset.index = String(index);
    item.innerHTML = `<span class="release-explorer-item-date">${event.date}</span><span class="release-explorer-item-title">${event.title}</span>`;
    listEl.appendChild(item);
    return item;
  });

  // --- three.js setup -----------------------------------------------
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 20);
  camera.position.set(0, 0.3, 3.4);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, 0.6));
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(2, 3, 4);
  scene.add(key);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  const color = accentColor();
  type BuiltScene = ReturnType<typeof buildScene>;
  let current: { scene: BuiltScene; theme: ReleaseTheme } | null = null;
  let outgoing: { scene: BuiltScene; startedAt: number } | null = null;
  let incoming: { scene: BuiltScene; theme: ReleaseTheme; startedAt: number } | null = null;

  function showTheme(theme: ReleaseTheme): void {
    if (current && current.theme === theme) {
      // Same theme: a small acknowledgement pulse, no crossfade.
      const group = current.scene.group;
      const reduced = prefersReducedMotion();
      if (!reduced) {
        const originalScale = group.scale.x;
        group.scale.setScalar(originalScale * 1.12);
        window.setTimeout(() => {
          group.scale.setScalar(originalScale);
        }, 160);
      }
      return;
    }

    const nextScene = buildScene(theme, color);
    nextScene.group.scale.setScalar(0.001);
    scene.add(nextScene.group);

    if (prefersReducedMotion()) {
      if (current) {
        scene.remove(current.scene.group);
        current.scene.dispose();
      }
      nextScene.group.scale.setScalar(1);
      current = { scene: nextScene, theme };
      outgoing = null;
      incoming = null;
      return;
    }

    if (current) {
      outgoing = { scene: current.scene, startedAt: performance.now() };
    }
    incoming = { scene: nextScene, theme, startedAt: performance.now() };
    current = { scene: nextScene, theme };
  }

  function selectIndex(index: number): void {
    itemButtons.forEach((button, i) => {
      const isSelected = i === index;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-current", isSelected ? "true" : "false");
      button.tabIndex = isSelected ? 0 : -1;
    });
    const event = events[index];
    if (event === undefined) {
      return;
    }
    detailEl.innerHTML = `
      <p class="release-explorer-date">${event.date}</p>
      <h3 class="release-explorer-title">${event.title}</h3>
      <p class="release-explorer-text">${event.detail}</p>
    `;
    showTheme(themeForEvent(event));
  }

  itemButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectIndex(index));
  });

  listEl.addEventListener("keydown", (event: KeyboardEvent) => {
    const currentIndex = itemButtons.findIndex((b) => b.tabIndex === 0);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = Math.max(0, Math.min(itemButtons.length - 1, currentIndex + delta));
      selectIndex(next);
      itemButtons[next]?.focus();
    }
  });

  selectIndex(0);
  itemButtons[0]?.focus();

  // --- render loop -----------------------------------------------
  const startTime = performance.now();
  renderer.setAnimationLoop(() => {
    const elapsedSeconds = (performance.now() - startTime) / 1000;
    const reduced = prefersReducedMotion();

    if (outgoing) {
      const t = Math.min(1, (performance.now() - outgoing.startedAt) / TRANSITION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const scale = Math.max(0.001, 1 - eased);
      outgoing.scene.group.scale.setScalar(scale);
      if (t >= 1) {
        scene.remove(outgoing.scene.group);
        outgoing.scene.dispose();
        outgoing = null;
      }
    }
    if (incoming) {
      const t = Math.min(1, (performance.now() - incoming.startedAt) / TRANSITION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      incoming.scene.group.scale.setScalar(eased);
      if (t >= 1) {
        incoming = null;
      }
    }
    if (current && !incoming) {
      current.scene.animate(elapsedSeconds, reduced);
    } else if (incoming) {
      incoming.scene.animate(elapsedSeconds, reduced);
    }

    renderer.render(scene, camera);
  });

  // --- focus trap, escape, close -----------------------------------
  function focusable(): HTMLElement[] {
    return [closeBtn, ...itemButtons];
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") {
      return;
    }
    const items = focusable();
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close(): void {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    current?.scene.dispose();
    outgoing?.scene.dispose();
    if (incoming && incoming.scene !== current?.scene) {
      incoming.scene.dispose();
    }
    renderer.dispose();
    overlay.remove();
    document.body.classList.remove("release-explorer-open");
    document.removeEventListener("keydown", onKeydown);
    activeExplorer = null;
    trigger.focus();
  }

  document.addEventListener("keydown", onKeydown);
  closeBtn.addEventListener("click", close);

  activeExplorer = { overlay, trigger, close };
}
