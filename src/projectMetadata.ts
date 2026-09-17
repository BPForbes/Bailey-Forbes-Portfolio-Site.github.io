/**
 * Where curated portfolio copy meets generated GitHub facts.
 *
 * The split this module maintains:
 *
 *   A. curated  — src/data.ts. Hand-written prose, descriptive chips, the
 *                 engagement history nobody can recover from an API. Never
 *                 overwritten.
 *   B. generated — src/generated/projectMetadata.ts. Language byte counts,
 *                 commit totals, versions, recent merged pull requests.
 *
 * Generated data wins for repository facts, because that is the whole point of
 * syncing them. Curated data wins for everything written by a person, because a
 * hand-written sentence beats a PR title every time. A project with no
 * generated entry — `emr`, whose tree is private — simply keeps its curated
 * values, which is why every accessor here falls back rather than failing.
 */

import { PORTFOLIO } from "./data.js";
import { GENERATED_PROJECT_METADATA } from "./generated/projectMetadata.js";
import { languageColor } from "./languageColors.js";
import type {
  LanguageShare,
  ProjectId,
  RepositoryMetadata,
  TimelineEvent,
} from "./types.js";

/** @returns The generated block for a project, if the sync produced one. */
export function repositoryMetadata(project: ProjectId): RepositoryMetadata | undefined {
  return GENERATED_PROJECT_METADATA.projects[project];
}

/**
 * Language shares for a project's bar and legend.
 *
 * Colours are resolved here, at render time, rather than baked into generated
 * data — so a language GitHub has never reported before still arrives with a
 * usable colour instead of an empty segment.
 */
export function languagesFor(project: ProjectId): readonly LanguageShare[] | undefined {
  const generated = repositoryMetadata(project)?.languages;
  if (generated !== undefined && generated.length > 0) {
    return generated.map((language) => ({
      name: language.name,
      pct: language.pct,
      color: languageColor(language.name),
    }));
  }
  // No repository, or a sync that never succeeded: the curated split stands.
  return PORTFOLIO.languages[project];
}

/**
 * Curated events plus generated ones, deduplicated, newest first left to the
 * caller's own sort.
 *
 * Two rules keep generated history from trampling hand-written history:
 *
 *   1. An event that matches a curated one — by link, or by the same project,
 *      date and normalised title — is dropped in favour of the curated copy.
 *   2. A generated event falling inside the period the curated entries already
 *      cover for that project is dropped outright. That window is written by
 *      hand, in better prose, and backfilling it would only produce thinner
 *      duplicates. "Covered" respects mixed-precision dates — see coverageEnd.
 *
 * Rule 2 means generated entries extend the timeline forward, which is what
 * automation is for, and leaves the written history alone.
 */
export function timelineEvents(): readonly TimelineEvent[] {
  const curated = PORTFOLIO.events;

  const curatedKeys = new Set<string>();
  const newestCuratedByProject = new Map<ProjectId, string>();
  for (const event of curated) {
    curatedKeys.add(softKey(event));
    if (event.href !== undefined) {
      curatedKeys.add(`href:${event.href}`);
    }
    // Tracked as coverage ends, so a month-granular entry protects its whole
    // month even when a later day-granular entry sits inside it.
    const covered = coverageEnd(event.date);
    const seen = newestCuratedByProject.get(event.project);
    if (seen === undefined || covered > seen) {
      newestCuratedByProject.set(event.project, covered);
    }
  }

  const merged: TimelineEvent[] = [...curated];
  const generatedKeys = new Set<string>();

  for (const [, metadata] of Object.entries(GENERATED_PROJECT_METADATA.projects)) {
    if (metadata === undefined) {
      continue;
    }
    for (const event of metadata.generatedTimelineEvents) {
      const cutoff = newestCuratedByProject.get(event.project);
      if (cutoff !== undefined && event.date <= cutoff) {
        continue;
      }
      const key = softKey(event);
      if (curatedKeys.has(key) || generatedKeys.has(key)) {
        continue;
      }
      if (event.href !== undefined && curatedKeys.has(`href:${event.href}`)) {
        continue;
      }
      generatedKeys.add(key);
      merged.push({
        date: event.date,
        kind: event.kind,
        project: event.project,
        title: event.title,
        detail: event.detail,
        ...(event.href !== undefined ? { href: event.href } : {}),
      });
    }
  }

  return merged;
}

/**
 * The last day a curated date covers.
 *
 * Curated dates are mixed precision: the EMR engagement is recorded by month
 * ("2021-08"), everything repository-era by day. A month-granular entry stands
 * for the whole month, so comparing it raw would let a generated "2026-09-01"
 * look newer than a curated "2026-09" and backfill a month already written by
 * hand. Expanding to day 31 gives a correct upper bound under the plain string
 * comparison used everywhere else here, because no real day sorts above it.
 */
function coverageEnd(date: string): string {
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-31` : date;
}

/**
 * Identity for cross-source comparison: project, day, and a title reduced to
 * its letters. Catches the same milestone arriving as curated prose and as a
 * merged PR title without demanding they be worded identically.
 */
function softKey(event: TimelineEvent): string {
  const title = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `${event.project}|${event.date}|${title}`;
}

/** The version to display, or undefined when nothing authoritative was found. */
export function versionFor(project: ProjectId): string | undefined {
  return repositoryMetadata(project)?.latestVersion;
}

/** Commits on the default branch, or undefined when unknown. */
export function commitCountFor(project: ProjectId): number | undefined {
  return repositoryMetadata(project)?.commitCount;
}

/** Merged pull requests, or undefined when unknown. */
export function mergedPullRequestsFor(project: ProjectId): number | undefined {
  return repositoryMetadata(project)?.mergedPullRequestCount;
}
