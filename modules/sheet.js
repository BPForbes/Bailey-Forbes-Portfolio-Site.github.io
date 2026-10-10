import { icon } from "./icons.js";
const COMPACT = "(max-width: 55.99rem)";
function createSheet(options) {
  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.id = options.id;
  dialog.setAttribute("aria-labelledby", `${options.id}-title`);
  dialog.innerHTML = `
    <div class="sheet-surface">
      <div class="sheet-grab" aria-hidden="true"><span></span></div>
      <div class="sheet-head">
        <h2 id="${options.id}-title">${options.title}</h2>
        <button class="sheet-close" type="button" aria-label="Close ${options.title.toLowerCase()}">${icon("xmark")}</button>
      </div>
      <div class="sheet-body"></div>
    </div>`;
  document.body.appendChild(dialog);
  const body = dialog.querySelector(".sheet-body");
  const closeButton = dialog.querySelector(".sheet-close");
  const grab = dialog.querySelector(".sheet-grab");
  let opener = null;
  const close = () => {
    if (dialog.open) dialog.close();
  };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("sheet-open");
    opener?.setAttribute("aria-expanded", "false");
    const target = opener;
    opener = null;
    target?.focus();
  });
  let startY = 0;
  let dragging = false;
  let travel = 0;
  grab.addEventListener("pointerdown", (event) => {
    if (!window.matchMedia(COMPACT).matches) return;
    dragging = true;
    travel = 0;
    startY = event.clientY;
    grab.setPointerCapture(event.pointerId);
    dialog.style.transition = "none";
  });
  grab.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    travel = Math.max(0, event.clientY - startY);
    dialog.style.transform = `translateY(${travel}px)`;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    dialog.style.transition = "";
    const dismiss = travel > dialog.getBoundingClientRect().height * 0.28;
    dialog.style.transform = "";
    if (dismiss) close();
  };
  grab.addEventListener("pointerup", release);
  grab.addEventListener("pointercancel", release);
  return {
    dialog,
    body,
    isOpen: () => dialog.open,
    close,
    open(from, focusTarget) {
      if (dialog.open) return;
      opener = from;
      opener?.setAttribute("aria-expanded", "true");
      document.body.classList.add("sheet-open");
      dialog.showModal();
      (focusTarget ?? closeButton).focus();
    }
  };
}
export {
  createSheet
};
