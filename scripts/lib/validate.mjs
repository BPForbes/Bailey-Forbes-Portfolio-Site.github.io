/**
 * Guard rails applied before anything is written to disk.
 *
 * The rule this enforces is the one in the brief: a transient API failure must
 * never be able to publish "0 commits" or "0%". Validation runs on the merged
 * document, so a project that fell back to its previous snapshot is checked
 * with the same severity as one that fetched cleanly.
 */

import { sharesSumToWhole } from "./languages.mjs";
import { isValidDate } from "./timeline.mjs";

/**
 * @param {import("./types.mjs").ProjectMetadataDocument} document
 * @param {{ knownProjectIds: readonly string[] }} context
 * @returns {string[]} Problems found; empty means the document may be written.
 */
export function validateDocument(document, context) {
  /** @type {string[]} */
  const problems = [];

  if (document === null || typeof document !== "object") {
    return ["document is not an object"];
  }
  if (typeof document.generatedAt !== "string" || Number.isNaN(Date.parse(document.generatedAt))) {
    problems.push("generatedAt is not a valid timestamp");
  }
  if (document.projects === null || typeof document.projects !== "object") {
    return [...problems, "projects is not an object"];
  }

  for (const [projectId, project] of Object.entries(document.projects)) {
    const where = `projects.${projectId}`;

    if (!context.knownProjectIds.includes(projectId)) {
      problems.push(`${where}: "${projectId}" is not a published portfolio project`);
      continue;
    }
    if (project === null || typeof project !== "object") {
      problems.push(`${where}: not an object`);
      continue;
    }

    if (!/^[\w.-]+\/[\w.-]+$/.test(String(project.repository))) {
      problems.push(`${where}.repository: "${project.repository}" is not owner/name`);
    }
    if (!isGitHubUrl(project.repositoryUrl)) {
      problems.push(`${where}.repositoryUrl: "${project.repositoryUrl}" is not a github.com URL`);
    }
    if (typeof project.defaultBranch !== "string" || project.defaultBranch === "") {
      problems.push(`${where}.defaultBranch: missing`);
    }

    // Counts: zero is legitimate for a brand-new repository, negative and
    // non-integer never are.
    for (const field of ["commitCount", "mergedPullRequestCount", "pullRequestCount"]) {
      const value = project[field];
      if (!Number.isInteger(value) || value < 0) {
        problems.push(`${where}.${field}: ${String(value)} is not a non-negative integer`);
      }
    }
    // A repository that resolved at all has history. Zero here means a failed
    // fetch leaked through, which is exactly what must not be published.
    if (project.commitCount === 0 && project.stale !== true) {
      problems.push(`${where}.commitCount: 0 for a live fetch — refusing to publish an empty count`);
    }

    problems.push(...validateLanguages(project.languages, where));
    problems.push(...validateTimeline(project.generatedTimelineEvents, where, projectId));
    if (project.namedReleases !== undefined) {
      problems.push(...validateNamedReleases(project.namedReleases, where));
    }

    if (project.latestVersion !== undefined && typeof project.latestVersion !== "string") {
      problems.push(`${where}.latestVersion: not a string`);
    }
    if (project.latestReleaseUrl !== undefined && !isGitHubUrl(project.latestReleaseUrl)) {
      problems.push(`${where}.latestReleaseUrl: not a github.com URL`);
    }
    // The whole value, not its first ten characters: slicing would accept
    // "2026-09-17-invalid" and the emitter would then publish it verbatim.
    if (
      project.latestReleaseDate !== undefined &&
      (typeof project.latestReleaseDate !== "string" ||
        !isValidDate(project.latestReleaseDate))
    ) {
      problems.push(`${where}.latestReleaseDate: not a valid date`);
    }
    if (typeof project.fetchedAt !== "string" || Number.isNaN(Date.parse(project.fetchedAt))) {
      problems.push(`${where}.fetchedAt: not a valid timestamp`);
    }
  }

  return problems;
}

/**
 * @param {unknown} languages
 * @param {string} where
 * @returns {string[]}
 */
function validateLanguages(languages, where) {
  /** @type {string[]} */
  const problems = [];
  if (!Array.isArray(languages)) {
    return [`${where}.languages: not an array`];
  }
  // An empty array is allowed only as "no data"; the emitter keeps the previous
  // snapshot rather than rendering an empty bar, so this is not fatal here.
  if (languages.length === 0) {
    return problems;
  }

  const names = new Set();
  for (const [index, language] of languages.entries()) {
    const at = `${where}.languages[${index}]`;
    if (language === null || typeof language !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }
    if (typeof language.name !== "string" || language.name === "") {
      problems.push(`${at}.name: missing`);
    } else if (names.has(language.name)) {
      problems.push(`${at}.name: "${language.name}" appears twice`);
    } else {
      names.add(language.name);
    }
    if (!Number.isFinite(language.bytes) || language.bytes < 0) {
      problems.push(`${at}.bytes: ${String(language.bytes)} is negative or not a number`);
    }
    if (!Number.isFinite(language.pct) || language.pct < 0) {
      problems.push(`${at}.pct: ${String(language.pct)} is negative or not a number`);
    }
  }

  if (problems.length === 0 && !sharesSumToWhole(languages)) {
    const sum = languages.reduce((total, language) => total + language.pct, 0);
    problems.push(`${where}.languages: percentages sum to ${sum.toFixed(3)}, not 100`);
  }
  return problems;
}

/**
 * @param {unknown} releases
 * @param {string} where
 * @returns {string[]}
 */
function validateNamedReleases(releases, where) {
  /** @type {string[]} */
  const problems = [];
  if (!Array.isArray(releases)) {
    return [`${where}.namedReleases: not an array`];
  }

  const ids = new Set();
  let previousStartDate;
  for (const [index, release] of releases.entries()) {
    const at = `${where}.namedReleases[${index}]`;
    if (release === null || typeof release !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }
    if (typeof release.id !== "string" || release.id === "") {
      problems.push(`${at}.id: missing`);
    } else if (ids.has(release.id)) {
      problems.push(`${at}.id: "${release.id}" is duplicated`);
    } else {
      ids.add(release.id);
    }
    if (typeof release.version !== "string" || release.version.trim() === "") {
      problems.push(`${at}.version: missing`);
    }
    if (!isValidDate(release.startDate)) {
      problems.push(`${at}.startDate: "${String(release.startDate)}" is not YYYY-MM-DD`);
    }
    if (release.endDate !== null && !isValidDate(release.endDate)) {
      problems.push(`${at}.endDate: must be YYYY-MM-DD or null, got ${JSON.stringify(release.endDate)}`);
    }
    if (typeof release.summary !== "string" || release.summary.trim() === "") {
      problems.push(`${at}.summary: missing`);
    }
    if (typeof release.description !== "string" || release.description.trim() === "") {
      problems.push(`${at}.description: missing`);
    }
    if (!isGitHubUrl(release.url)) {
      problems.push(`${at}.url: "${String(release.url)}" is not a github.com URL`);
    }
    // Newest-first, the same invariant the timeline enforces.
    if (previousStartDate !== undefined && typeof release.startDate === "string"
      && release.startDate > previousStartDate) {
      problems.push(`${at}.startDate: releases must be ordered newest-first`);
    }
    if (typeof release.startDate === "string") {
      previousStartDate = release.startDate;
    }
  }
  return problems;
}

/**
 * @param {unknown} events
 * @param {string} where
 * @param {string} projectId
 * @returns {string[]}
 */
function validateTimeline(events, where, projectId) {
  /** @type {string[]} */
  const problems = [];
  if (!Array.isArray(events)) {
    return [`${where}.generatedTimelineEvents: not an array`];
  }

  const identities = new Set();
  for (const [index, event] of events.entries()) {
    const at = `${where}.generatedTimelineEvents[${index}]`;
    if (event === null || typeof event !== "object") {
      problems.push(`${at}: not an object`);
      continue;
    }
    if (!isValidDate(event.date)) {
      problems.push(`${at}.date: "${String(event.date)}" does not parse`);
    }
    if (event.kind !== "feature" && event.kind !== "release") {
      problems.push(`${at}.kind: "${String(event.kind)}" is not feature or release`);
    }
    if (event.project !== projectId) {
      problems.push(`${at}.project: "${String(event.project)}" does not match ${projectId}`);
    }
    if (typeof event.title !== "string" || event.title.trim() === "") {
      problems.push(`${at}.title: missing`);
    }
    if (typeof event.detail !== "string" || event.detail.trim() === "") {
      problems.push(`${at}.detail: missing`);
    }
    // Optional: a snapshot written before full bodies were carried has none,
    // and the card falls back to the summary.
    if (event.body !== undefined && typeof event.body !== "string") {
      problems.push(`${at}.body: must be a string when present`);
    }
    if (event.href !== undefined && !isGitHubUrl(event.href)) {
      problems.push(`${at}.href: "${String(event.href)}" is not a github.com URL`);
    }
    if (typeof event.identity !== "string" || event.identity === "") {
      problems.push(`${at}.identity: missing`);
    } else if (identities.has(event.identity)) {
      problems.push(`${at}.identity: "${event.identity}" is duplicated`);
    } else {
      identities.add(event.identity);
    }
  }
  return problems;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isGitHubUrl(value) {
  if (typeof value !== "string" || value === "") {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "github.com" || url.hostname === "www.github.com");
  } catch {
    return false;
  }
}
