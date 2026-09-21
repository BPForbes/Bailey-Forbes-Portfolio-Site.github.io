import { PORTFOLIO } from "./data.js";
import { icon } from "./icons.js";
import { timelineEvents } from "./projectMetadata.js";
import { themeForEvent } from "./releaseThemes.js";
function isProjectId(value) {
  return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}
function orderedEventsFor(project) {
  return timelineEvents().map((event, index) => ({ event, index })).filter((row) => row.event.project === project).sort((a, b) => b.event.date.localeCompare(a.event.date) || b.index - a.index).map((row) => row.event);
}
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function accentColor() {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--action").trim();
  return value === "" ? "#c98a4a" : value;
}
const TRANSITION_MS = 600;
let activeExplorer = null;
function mountReleaseExplorers() {
  document.querySelectorAll("[data-release-explorer-trigger]").forEach((trigger) => {
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
async function openExplorer(project, events, trigger) {
  if (activeExplorer) {
    return;
  }
  const [{ buildScene }, { Scene, PerspectiveCamera, AmbientLight, DirectionalLight, WebGLRenderer }] = await Promise.all([
    import("./releaseScenes.js"),
    import("three")
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
  const listEl = overlay.querySelector("[data-explorer-list]");
  const detailEl = overlay.querySelector("[data-explorer-detail]");
  const canvas = overlay.querySelector("[data-explorer-canvas]");
  const closeBtn = overlay.querySelector("[data-explorer-close]");
  const stage = overlay.querySelector(".release-explorer-stage");
  const itemButtons = events.map((event, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "release-explorer-item";
    item.setAttribute("role", "listitem");
    item.dataset.index = String(index);
    item.innerHTML = `<span class="release-explorer-item-date">${event.date}</span><span class="release-explorer-item-title">${event.title}</span>`;
    listEl.appendChild(item);
    return item;
  });
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 20);
  camera.position.set(0, 0.3, 3.4);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(16777215, 0.6));
  const key = new DirectionalLight(16777215, 1.1);
  key.position.set(2, 3, 4);
  scene.add(key);
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  function resize() {
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
  let current = null;
  let outgoing = null;
  let incoming = null;
  function showTheme(theme) {
    if (current && current.theme === theme) {
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
    nextScene.group.scale.setScalar(1e-3);
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
  function selectIndex(index) {
    itemButtons.forEach((button, i) => {
      const isSelected = i === index;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-current", isSelected ? "true" : "false");
      button.tabIndex = isSelected ? 0 : -1;
    });
    const event = events[index];
    if (event === void 0) {
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
  listEl.addEventListener("keydown", (event) => {
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
  const startTime = performance.now();
  renderer.setAnimationLoop(() => {
    const elapsedSeconds = (performance.now() - startTime) / 1e3;
    const reduced = prefersReducedMotion();
    if (outgoing) {
      const t = Math.min(1, (performance.now() - outgoing.startedAt) / TRANSITION_MS);
      const eased = 1 - (1 - t) * (1 - t);
      const scale = Math.max(1e-3, 1 - eased);
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
  function focusable() {
    return [closeBtn, ...itemButtons];
  }
  function onKeydown(event) {
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
    if (first === void 0 || last === void 0) {
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
  function close() {
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
export {
  mountReleaseExplorers
};
