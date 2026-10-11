/**
 * Sheets: the one way this site opens a menu over the page.
 *
 * Below 56rem a sheet rises from the bottom edge. From 56rem it slides in from
 * the right. Both are the same element, a native modal <dialog>, and the
 * stylesheet decides which shape it takes, so a window resized mid-use changes
 * shape instead of breaking.
 *
 * Native <dialog>.showModal() is used on purpose, so the browser supplies what
 * a hand-built panel gets wrong: focus moves in and is trapped, the rest of the
 * page is inert for assistive technology, and Escape closes it. This module
 * adds what the element does not do:
 *
 *   - clicking the scrim (the ::backdrop, which reports the dialog as target)
 *   - returning focus to whatever opened it, and keeping its aria-expanded true
 *     only while open
 *   - a scroll lock on the page behind
 *   - on a phone, dragging the grab handle down to dismiss. That is a pointer
 *     shortcut only: the visible close button and Escape do the same job, so no
 *     function depends on a drag (WCAG 2.5.7).
 *
 * Nothing here is needed to reach the content a sheet holds. Both current
 * sheets are built by script from controls that already exist in the header.
 */
import { icon } from "./icons.js";

export interface SheetOptions {
  /** DOM id of the dialog. The opener's aria-controls should name it. */
  readonly id: string;
  /** Visible heading, and the dialog's accessible name. */
  readonly title: string;
}

export interface Sheet {
  readonly dialog: HTMLDialogElement;
  /** The element the caller fills with content. */
  readonly body: HTMLElement;
  open(opener: HTMLElement | null, focusTarget?: HTMLElement | null): void;
  close(): void;
  isOpen(): boolean;
}

const COMPACT = "(max-width: 55.99rem)";

export function createSheet(options: SheetOptions): Sheet {
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

  const body = dialog.querySelector<HTMLElement>(".sheet-body") as HTMLElement;
  const closeButton = dialog.querySelector<HTMLButtonElement>(".sheet-close") as HTMLButtonElement;
  const grab = dialog.querySelector<HTMLElement>(".sheet-grab") as HTMLElement;
  let opener: HTMLElement | null = null;

  const close = (): void => {
    if (dialog.open) dialog.close();
  };

  closeButton.addEventListener("click", close);

  // The ::backdrop belongs to the dialog, so a click on the scrim arrives with
  // the dialog itself as target. Content is wrapped in .sheet-surface, which
  // fills the box, so a click inside never has the dialog as its target.
  dialog.addEventListener("click", (event: MouseEvent) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener("close", () => {
    document.body.classList.remove("sheet-open");
    opener?.setAttribute("aria-expanded", "false");
    const target = opener;
    opener = null;
    // The dialog closes with an animation; focus must not wait for it.
    target?.focus();
  });

  // Drag the handle down to dismiss, on the compact layer only. The dialog is
  // moved by an inline transform while dragging and by its own transition
  // after release, so the closing motion starts where the finger left it.
  let startY = 0;
  let dragging = false;
  let travel = 0;
  grab.addEventListener("pointerdown", (event: PointerEvent) => {
    if (!window.matchMedia(COMPACT).matches) return;
    dragging = true;
    travel = 0;
    startY = event.clientY;
    grab.setPointerCapture(event.pointerId);
    dialog.style.transition = "none";
  });
  grab.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) return;
    travel = Math.max(0, event.clientY - startY);
    dialog.style.transform = `translateY(${travel}px)`;
  });
  const release = (): void => {
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
    },
  };
}
