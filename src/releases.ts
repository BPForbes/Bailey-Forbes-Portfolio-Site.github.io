/**
 * Named releases: a compact, collapsed-by-default timeline of the releases a
 * project's curator has decided are portfolio-worthy.
 *
 * This is deliberately not the commit/PR timeline in timeline.ts. That one is
 * automatic and comprehensive; this one is sparse and hand-picked (or picked
 * by an upstream project's own curated `metadata/releases.json`, republished
 * through its contract). A `<details>`/`<summary>` pair gives every row free,
 * fully keyboard-accessible expand/collapse with no JavaScript state to own
 * and no animation system to build (MVP scope: no filtering, no search, no
 * separate release page).
 */

import { icon } from "./icons.js";
import { attachScrollFade } from "./timeline.js";
import type { NamedRelease } from "./types.js";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

interface IsoDate {
  year: number;
  month: number; // 1-12
  day: number;
}

function parseIsoDate(value: string): IsoDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

/**
 * The collapsed row's date, e.g. "May 18–19, 2026" for a two-day release or
 * "May 12, 2026" for a single day. Falls back to the raw ISO string for a
 * date this parser does not recognise, rather than hiding it.
 */
function formatReleaseDate(startDate: string, endDate: string | null): string {
  const start = parseIsoDate(startDate);
  if (!start) {
    return startDate;
  }
  const startMonth = MONTHS[start.month - 1] ?? String(start.month);
  if (endDate === null) {
    return `${startMonth} ${start.day}, ${start.year}`;
  }
  const end = parseIsoDate(endDate);
  if (!end) {
    return `${startMonth} ${start.day}, ${start.year}`;
  }
  const endMonth = MONTHS[end.month - 1] ?? String(end.month);
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}–${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day} – ${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year} – ${endMonth} ${end.day}, ${end.year}`;
}

function renderRow(release: NamedRelease): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "release-row";

  const details = document.createElement("details");
  details.className = "release-disclosure";

  const summary = document.createElement("summary");
  summary.className = "release-summary";

  const marker = document.createElement("span");
  marker.className = "release-marker";
  marker.innerHTML = icon("tag");

  const main = document.createElement("span");
  main.className = "release-main";

  const versionDate = document.createElement("span");
  versionDate.className = "release-version-date";

  const version = document.createElement("span");
  version.className = "release-version";
  version.textContent = release.version;

  const date = document.createElement("span");
  date.className = "release-date";
  date.textContent = formatReleaseDate(release.startDate, release.endDate);

  versionDate.append(version, date);

  const summaryText = document.createElement("span");
  summaryText.className = "release-summary-text";
  summaryText.textContent = release.summary;

  main.append(versionDate, summaryText);

  const toggle = document.createElement("span");
  toggle.className = "release-toggle";
  toggle.setAttribute("aria-hidden", "true");

  summary.append(marker, main, toggle);

  // Bounded and scrollable, same as a commit card's body: an automated GM=1
  // promotion carries its full internal DESCRIPTION forward as the expanded
  // text (see docs/versioning.md in Flinstone), which can run to several
  // paragraphs — nothing like the one- or two-sentence prose a curator writes
  // by hand for the other rows. A hand-curated release still fits on one
  // screen either way, so this costs it nothing.
  const scroller = document.createElement("div");
  scroller.className = "release-body-scroll";

  const body = document.createElement("div");
  body.className = "release-body rt";
  body.tabIndex = 0;
  body.setAttribute("role", "region");
  body.setAttribute("aria-label", `${release.version}, full description`);

  // Shown immediately; the loaded renderer replaces it in place once it
  // resolves, so there is no empty box while React/react-markdown/KaTeX load.
  const placeholder = document.createElement("p");
  placeholder.className = "release-loading";
  placeholder.textContent = release.summary;
  body.appendChild(placeholder);
  scroller.appendChild(body);

  const link = document.createElement("a");
  link.className = "release-link";
  link.href = release.url;
  link.innerHTML = `View release ${icon("arrow-right")}`;

  details.append(summary, scroller, link);
  item.append(details);

  // Rendered on first expand, not eagerly for all eleven rows: a visitor who
  // never opens one should never fetch the renderer chunk at all.
  let rendered = false;
  details.addEventListener("toggle", () => {
    if (!details.open || rendered) {
      return;
    }
    rendered = true;
    void fillReleaseBody(scroller, body, placeholder, release.description);
  });

  return item;
}

/**
 * Replace the placeholder with the rendered description, the same way a
 * commit card's expanded body loads (see timeline.ts's `fillCard`): both
 * reach the same lazily-imported react-markdown/KaTeX chunk, so the weight
 * lands on the interaction that asked for it rather than on every page load.
 */
async function fillReleaseBody(
  scroller: HTMLElement,
  body: HTMLElement,
  placeholder: HTMLElement,
  markdown: string,
): Promise<void> {
  try {
    const { renderCommitBody } = await import("./commitBody.js");
    // The row may have been collapsed again while the chunk was loading.
    if (!body.isConnected) {
      return;
    }
    placeholder.remove();
    renderCommitBody(body, markdown);
  } catch (error) {
    console.warn("Release body renderer failed to load", error);
    placeholder.classList.add("release-degraded");
    const note = document.createElement("p");
    note.className = "release-degraded-note";
    note.textContent = "The full description could not be loaded.";
    body.appendChild(note);
    return;
  }
  attachScrollFade(scroller, body);
}

/**
 * Mounts every `[data-named-releases]` element found under `root` with that
 * project's curated release rows, newest first as the data already arrives.
 * An element for a project with no named releases is left untouched, rather
 * than rendered empty — the caller decides whether that section belongs on
 * the page at all.
 */
export function mountNamedReleases(
  releasesFor: (mount: HTMLElement) => readonly NamedRelease[],
  root: ParentNode = document,
): void {
  root.querySelectorAll<HTMLElement>("[data-named-releases]").forEach((mount) => {
    const releases = releasesFor(mount);
    if (releases.length === 0) {
      return;
    }
    const list = document.createElement("ol");
    list.className = "release-list";
    for (const release of releases) {
      list.appendChild(renderRow(release));
    }
    mount.replaceChildren(list);
  });
}
