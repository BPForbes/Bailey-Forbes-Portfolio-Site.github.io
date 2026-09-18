/**
 * Turning public GitHub history into timeline entries worth showing.
 *
 * The timeline on this site is a curated project history, not `git log`. The
 * default answer for any given pull request is therefore "no": an entry has to
 * earn its place by looking like a feature, a release, or a security/perf/
 * architecture change. Everything unmatched is dropped rather than shown,
 * which is the conservative direction to be wrong in — a missing entry can be
 * added by hand, a flood of "bump deps" entries devalues the whole rail.
 *
 * Individual commits are never timeline entries. Merged pull request titles and
 * releases carry a human summary; raw commits mostly do not.
 */

/** @typedef {import("./types.mjs").GeneratedTimelineEvent} GeneratedTimelineEvent */

/**
 * Routine work. Checked first, so `chore(deps): bump feature-flags` cannot
 * sneak through on the word "feature".
 */
const NOISE = [
  /^(chore|ci|build|style|test|tests|docs?|refactor)\s*(\([^)]*\))?\s*!?:/i,
  /\bbump\b[\s\S]*\bfrom\b[\s\S]*\bto\b/i,
  /^(deps|dependabot|renovate)\b/i,
  /^merge\s+(branch|pull request|remote|main|develop)\b/i,
  /^revert\b/i,
  /\b(typo|typos|whitespace|formatting|reformat|lint|linting|prettier|eslint|clippy|rustfmt)\b/i,
  /^(update|fix|tidy|clean up|cleanup)\s+(the\s+)?(readme|changelog|comments?|docs?)\b/i,
  // Documentation carries no product change, however it is phrased. Without
  // this, "Add README with local dev setup instructions" qualifies on the word
  // "Add" — BPForbes/Homework-Central#34, which touched README.md and nothing
  // else, reached the generated timeline that way.
  //
  // The trailing group matters: the documentation noun has to be what the verb
  // acts on, so "Add a docs generator to the build" stays eligible. That is a
  // title-level test rather than a per-pull-request file listing, which would
  // cost one extra API request for every candidate; it catches the phrasings
  // that occur in practice and errs towards dropping, which is the direction
  // this whole classifier already leans.
  /^(add|adds|create|creates|write|writes|improve|improves|expand|expands)\s+(a\s+|an\s+|the\s+)?(readme|changelog|contributing|licence|license|code of conduct|docs?|documentation)(\s+(file|files|entry|entries|section|sections|guide|notes?|badge|instructions))*(\s*$|[.,:;!?]|\s+(with|for|to|and|about|on|in|covering|explaining|documenting|describing))/i,
  // "Document the release process" — the verb alone is enough here.
  /^documents?(ing)?\b/i,
  /\bversion lock\b/i,
  /^\s*wip\b/i,
  // A repair is not a milestone. "fix" is deliberately absent from the
  // significance list, so a fix that happens to mention "migration" or
  // "architecture" must not qualify on that word alone.
  /^fix(es|ed)?\b/i,
  /^[^\w]*\b(coderabbit|copilot|codex|sourcery|imgbot|allcontributors)\b/i,
  /\bcoderabbit\s+chat\b/i,
];

/**
 * A conventional-commit type marked breaking, e.g. "refactor(core)!:". Checked
 * before the noise list, because the "!" is the author saying this one matters.
 */
const BREAKING = /^[a-z]+(\([^)]*\))?!:/i;

/** Bot accounts whose unattended output is never portfolio history. */
const BOT_AUTHORS = new Set([
  "dependabot",
  "dependabot[bot]",
  "renovate",
  "renovate[bot]",
  "github-actions",
  "github-actions[bot]",
  "pre-commit-ci[bot]",
  "snyk-bot",
]);

/**
 * Conventional-commit types and prose that mark a portfolio-worthy change.
 * Deliberately narrower than "anything that is not noise".
 */
const SIGNIFICANT = [
  /^(feat|feature|release|perf|security|breaking|major|milestone|architecture)\s*(\([^)]*\))?\s*!?:/i,
  /\b(add|adds|introduce|introduces|implement|implements|ship|ships|launch|launches)\b/i,
  /\b(rewrite|redesign|re-architect|architecture|overhaul|migrate|migration)\b/i,
  /\b(security|hardening|harden|vulnerability)\b/i,
  /\b(promote|promotion)\b.*\b(ga|main|production)\b/i,
];

/**
 * Decide whether a merged PR title (or release name) belongs on the timeline.
 *
 * @param {string} title
 * @param {{ author?: string|undefined }} [context]
 * @returns {boolean}
 */
export function isSignificantTitle(title, context = {}) {
  if (typeof title !== "string") {
    return false;
  }
  const text = title.trim();
  if (text === "") {
    return false;
  }
  const author = context.author?.toLowerCase();
  if (author !== undefined && BOT_AUTHORS.has(author)) {
    return false;
  }
  // A conventional-commit breaking marker outranks the noise list: a breaking
  // change to the driver ABI is portfolio history even when it is spelled
  // "refactor(core)!:", which the routine-work patterns would otherwise drop.
  if (BREAKING.test(text)) {
    return true;
  }
  if (NOISE.some((pattern) => pattern.test(text))) {
    return false;
  }
  return SIGNIFICANT.some((pattern) => pattern.test(text));
}

/**
 * Strip a conventional-commit prefix for display. The chip already says whether
 * the entry is a feature or a release, so "feat(lab): " is redundant noise in
 * the title line.
 *
 * @param {string} title
 * @returns {string}
 */
export function cleanTitle(title) {
  const stripped = title
    .trim()
    .replace(/^(feat|feature|release|perf|security|fix|refactor|breaking|major|milestone|architecture)\s*(\([^)]*\))?\s*!?:\s*/i, "");
  const text = stripped === "" ? title.trim() : stripped;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Normalise a title for cross-source comparison: case, punctuation and
 * conventional prefixes removed, so "feat(lab): Emscripten shell" and
 * "Emscripten shell" collapse onto each other.
 *
 * @param {string} title
 * @returns {string}
 */
export function normalizeTitle(title) {
  return cleanTitle(String(title ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Build a generated event from a merged pull request.
 *
 * @param {Record<string, any>} pull
 * @param {string} projectId
 * @param {string} repo
 * @returns {GeneratedTimelineEvent|undefined}
 */
export function eventFromPullRequest(pull, projectId, repo) {
  if (pull === null || typeof pull !== "object") return undefined;
  if (typeof pull.merged_at !== "string" || pull.merged_at === "") return undefined;
  if (typeof pull.number !== "number" || !Number.isInteger(pull.number)) return undefined;
  const title = typeof pull.title === "string" ? pull.title : "";
  const author = typeof pull.user?.login === "string" ? pull.user.login : undefined;
  if (!isSignificantTitle(title, { author })) return undefined;

  const date = pull.merged_at.slice(0, 10);
  if (!isValidDate(date)) return undefined;

  return {
    date,
    kind: "feature",
    project: projectId,
    title: cleanTitle(title),
    detail: buildDetail(pull, title),
    href:
      typeof pull.html_url === "string"
        ? pull.html_url
        : `https://github.com/${repo}/pull/${pull.number}`,
    identity: `pr:${repo}#${pull.number}`,
  };
}

/**
 * Build a generated event from a published GitHub release.
 *
 * @param {Record<string, any>} release
 * @param {string} projectId
 * @param {string} repo
 * @returns {GeneratedTimelineEvent|undefined}
 */
export function eventFromRelease(release, projectId, repo) {
  if (release === null || typeof release !== "object") return undefined;
  // Drafts are unpublished and prereleases are not shipped versions. The
  // contract path already drops both; this is the same bar for the REST path.
  if (release.draft === true || release.prerelease === true) return undefined;
  const tag = typeof release.tag_name === "string" ? release.tag_name.trim() : "";
  if (tag === "") return undefined;
  const published = typeof release.published_at === "string" ? release.published_at : "";
  const date = published.slice(0, 10);
  if (!isValidDate(date)) return undefined;

  const name = typeof release.name === "string" && release.name.trim() !== "" ? release.name.trim() : tag;
  const body = typeof release.body === "string" ? release.body : "";

  return {
    date,
    kind: "release",
    project: projectId,
    title: cleanTitle(name),
    detail: summarize(body) || `Release ${tag}.`,
    href:
      typeof release.html_url === "string"
        ? release.html_url
        : `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
    identity: `release:${repo}@${tag}`,
  };
}

/**
 * A PR body is often a template with checklists and screenshots. Take the first
 * real prose paragraph and cap it, so the rail stays readable.
 *
 * @param {Record<string, any>} pull
 * @param {string} fallbackTitle
 * @returns {string}
 */
function buildDetail(pull, fallbackTitle) {
  const summary = summarize(typeof pull.body === "string" ? pull.body : "");
  if (summary !== "") {
    return summary;
  }
  return `Merged pull request #${pull.number}: ${fallbackTitle.trim()}.`;
}

/**
 * @param {string} markdown
 * @returns {string}
 */
export function summarize(markdown, limit = 320) {
  if (typeof markdown !== "string" || markdown.trim() === "") {
    return "";
  }
  const lines = markdown
    .replace(/\r\n/g, "\n")
    // Drop HTML comments, which is where PR templates hide their instructions.
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n");

  /** @type {string[]} */
  const prose = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      if (prose.length > 0) break;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;      // headings
    if (/^[-*+]\s*\[[ xX]\]/.test(line)) continue; // task list rows
    if (/^!\[/.test(line)) continue;            // images
    if (/^\|/.test(line)) continue;             // tables
    if (/^```/.test(line)) break;               // code fence
    prose.push(line);
  }

  const text = prose.join(" ").replace(/\s+/g, " ").trim();
  if (text === "") {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  const cut = text.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`;
}

/**
 * @param {string} value
 * @returns {boolean} True for a real YYYY-MM-DD that round-trips.
 */
export function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Drop repeats within a generated set. Identity wins; a project/date/title
 * match is the backstop for the same change arriving as both a release and the
 * pull request that produced it.
 *
 * @param {GeneratedTimelineEvent[]} events
 * @returns {GeneratedTimelineEvent[]}
 */
export function dedupeEvents(events) {
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {GeneratedTimelineEvent[]} */
  const kept = [];
  for (const event of events) {
    const identity = event.identity;
    const softKey = `${event.project}|${event.date}|${normalizeTitle(event.title)}`;
    if (seen.has(identity) || seen.has(softKey)) {
      continue;
    }
    seen.add(identity);
    seen.add(softKey);
    kept.push(event);
  }
  return kept;
}

/**
 * Newest first, matching how the rail renders. Ties fall back to identity so
 * repeated runs produce byte-identical output and the Action does not commit
 * churn.
 *
 * @param {GeneratedTimelineEvent[]} events
 * @param {number} [limit]
 * @returns {GeneratedTimelineEvent[]}
 */
export function orderEvents(events, limit) {
  const ordered = [...events].sort(
    (a, b) => b.date.localeCompare(a.date) || b.identity.localeCompare(a.identity),
  );
  return typeof limit === "number" ? ordered.slice(0, limit) : ordered;
}
