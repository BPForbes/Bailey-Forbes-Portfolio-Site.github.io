/**
 * Generated project metadata, as consumed by the pages.
 *
 * `data/projects.generated.json` is written by `tools/generate-project-metadata.mjs`
 * during the Pages build and shipped inside the deployment artifact, so this is
 * a same-origin read of a static file — the browser never talks to the GitHub
 * API, and nothing here polls (docs/project-metadata.md).
 *
 * Everything degrades to the curated values in `data.ts`. A page served without
 * the file (a plain `git clone` plus `npm run build`, or a build where
 * generation was skipped) renders exactly as it did before this existed, rather
 * than rendering blank.
 */
import { PORTFOLIO } from "./data.js";
import type { LanguageShare, ProjectId, TimelineEvent } from "./types.js";
import { languageColor } from "./languageColors.js";

const METADATA_URL = "/data/projects.generated.json";

/** How long to wait for a same-origin static file before falling back. */
const LOAD_TIMEOUT_MS = 3000;

/**
 * Below this share a language is folded into "Other" instead of getting its own
 * legend row. GitHub reports every language Linguist detects, including ones
 * that round to 0.0%, and a legend of twelve entries is not the bar this page
 * has always shown.
 */
const LANGUAGE_MIN_PCT = 0.5;
const LANGUAGE_MAX_ROWS = 6;

export interface GeneratedLanguage {
  readonly name: string;
  readonly bytes: number;
  readonly percentage: number;
}

export interface GeneratedMilestone {
  readonly kind: "release" | "tag";
  readonly id: string;
  readonly version?: string;
  readonly title: string;
  readonly date: string;
  readonly detail?: string;
  readonly url?: string;
}

export interface GeneratedProject {
  readonly id: string;
  readonly label: string;
  readonly repo: string;
  readonly repoUrl: string;
  readonly liveUrl: string | null;
  readonly defaultBranch: string;
  readonly lastUpdated: string;
  readonly latestCommit: {
    readonly sha: string;
    readonly shortSha: string;
    readonly date: string;
    readonly url: string;
  };
  readonly version?: string;
  readonly stats: Readonly<Record<string, number>>;
  readonly languages: readonly GeneratedLanguage[];
  readonly milestones: readonly GeneratedMilestone[];
}

export interface GeneratedMetadata {
  readonly schemaVersion: number;
  readonly generatedAt: string;
  readonly projects: readonly GeneratedProject[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Structural check before anything is rendered.
 *
 * The generator validates far more thoroughly at build time; this exists so a
 * truncated or stale-schema file is rejected wholesale rather than producing a
 * page with some numbers missing and no sign anything went wrong.
 */
function parseMetadata(value: unknown): GeneratedMetadata | null {
  if (!isRecord(value) || value["schemaVersion"] !== 1) {
    return null;
  }
  const rawProjects = value["projects"];
  if (!Array.isArray(rawProjects) || rawProjects.length === 0) {
    return null;
  }

  const projects: GeneratedProject[] = [];
  for (const raw of rawProjects) {
    if (!isRecord(raw) || !isString(raw["id"]) || !isString(raw["repo"])) {
      return null;
    }

    const commit = raw["latestCommit"];
    if (!isRecord(commit) || !isString(commit["sha"]) || !isString(commit["shortSha"])) {
      return null;
    }

    const rawLanguages = raw["languages"];
    if (!Array.isArray(rawLanguages)) {
      return null;
    }
    const languages: GeneratedLanguage[] = [];
    for (const language of rawLanguages) {
      if (!isRecord(language) || !isString(language["name"])
        || !isCount(language["bytes"]) || !isCount(language["percentage"])) {
        return null;
      }
      languages.push({
        name: language["name"],
        bytes: language["bytes"],
        percentage: language["percentage"],
      });
    }

    const rawMilestones = raw["milestones"];
    if (!Array.isArray(rawMilestones)) {
      return null;
    }
    const milestones: GeneratedMilestone[] = [];
    for (const milestone of rawMilestones) {
      if (!isRecord(milestone) || !isString(milestone["id"])
        || !isString(milestone["title"]) || !isString(milestone["date"])) {
        return null;
      }
      const kind = milestone["kind"];
      if (kind !== "release" && kind !== "tag") {
        return null;
      }
      const version = milestone["version"];
      const detail = milestone["detail"];
      const url = milestone["url"];
      milestones.push({
        kind,
        id: milestone["id"],
        title: milestone["title"],
        date: milestone["date"],
        ...(isString(version) ? { version } : {}),
        ...(isString(detail) ? { detail } : {}),
        ...(isString(url) ? { url } : {}),
      });
    }

    const stats: Record<string, number> = {};
    const rawStats = raw["stats"];
    if (isRecord(rawStats)) {
      for (const [key, count] of Object.entries(rawStats)) {
        if (isCount(count)) {
          stats[key] = count;
        }
      }
    }

    const version = raw["version"];
    const liveUrl = raw["liveUrl"];
    projects.push({
      id: raw["id"],
      label: isString(raw["label"]) ? raw["label"] : raw["id"],
      repo: raw["repo"],
      repoUrl: isString(raw["repoUrl"]) ? raw["repoUrl"] : `https://github.com/${raw["repo"]}`,
      liveUrl: isString(liveUrl) ? liveUrl : null,
      defaultBranch: isString(raw["defaultBranch"]) ? raw["defaultBranch"] : "main",
      lastUpdated: isString(raw["lastUpdated"]) ? raw["lastUpdated"] : "",
      latestCommit: {
        sha: commit["sha"],
        shortSha: commit["shortSha"],
        date: isString(commit["date"]) ? commit["date"] : "",
        url: isString(commit["url"]) ? commit["url"] : "",
      },
      ...(isString(version) ? { version } : {}),
      stats,
      languages,
      milestones,
    });
  }

  const generatedAt = value["generatedAt"];
  return {
    schemaVersion: 1,
    generatedAt: isString(generatedAt) ? generatedAt : "",
    projects,
  };
}

/**
 * Read the generated file once.
 *
 * The timeout matters: this is awaited before the first render so the page does
 * not paint curated numbers and then visibly swap them for generated ones. A
 * static same-origin file answers in milliseconds, and a request that somehow
 * does not is abandoned in favour of the curated values.
 */
async function loadMetadata(): Promise<GeneratedMetadata | null> {
  if (typeof fetch !== "function") {
    return null;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => {
    controller.abort();
  }, LOAD_TIMEOUT_MS);

  try {
    const response = await fetch(METADATA_URL, {
      signal: controller.signal,
      cache: "no-cache",
    });
    if (!response.ok) {
      return null;
    }
    const parsed = parseMetadata(await response.json());
    if (parsed === null) {
      console.warn(`${METADATA_URL} did not match the expected schema; using compiled values.`);
    }
    return parsed;
  } catch {
    // Offline, aborted, or served without the file: the curated values stand.
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export const METADATA = await loadMetadata();

const byId = new Map<string, GeneratedProject>(
  (METADATA?.projects ?? []).map((project) => [project.id, project]),
);

export function generatedProject(id: ProjectId): GeneratedProject | undefined {
  return byId.get(id);
}

/**
 * The language split to draw for a project.
 *
 * Percentages come from GitHub's byte counts. Colours do not: they are a design
 * choice and live in `languageColors.ts`, so nothing about the palette is
 * presented as something GitHub reported.
 */
export function languageShares(id: ProjectId): readonly LanguageShare[] | undefined {
  const generated = byId.get(id);
  if (generated === undefined || generated.languages.length === 0) {
    return PORTFOLIO.languages[id];
  }

  const shown = generated.languages
    .filter((language) => language.percentage >= LANGUAGE_MIN_PCT)
    .slice(0, LANGUAGE_MAX_ROWS);
  const shares: LanguageShare[] = shown.map((language) => ({
    name: language.name,
    pct: language.percentage,
    color: languageColor(language.name),
  }));

  // Keep the bar a whole bar. Anything trimmed above is collected rather than
  // dropped, so the segments still add up to the repository.
  const remainder = generated.languages
    .filter((language) => !shown.includes(language))
    .reduce((sum, language) => sum + language.percentage, 0);
  if (remainder >= 0.1) {
    shares.push({ name: "Other", pct: Math.round(remainder * 10) / 10, color: languageColor("Other") });
  }

  return shares.length > 0 ? shares : PORTFOLIO.languages[id];
}

/** A named statistic, or undefined when this build has no generated metadata. */
export function stat(id: ProjectId, key: string): number | undefined {
  return byId.get(id)?.stats[key];
}

/** The published version for a project, when the registry knows how to find one. */
export function version(id: ProjectId): string | undefined {
  return byId.get(id)?.version;
}

/**
 * The timeline for a project: curated prose, then generated milestones that are
 * newer than all of it.
 *
 * The cutoff is what keeps this deterministic and keeps the page looking the
 * way it was written. The curated entries in `data.ts` are a finished account
 * of the work up to the day they were compiled; generated milestones continue
 * that account forward and never reach back into it, so a release the author
 * already described in their own words is never restated by the generator, and
 * no new release can be missed.
 *
 * A project with no curated entries at all — a future one — gets its whole
 * generated history, because there is nothing to preserve.
 */
export function timelineEvents(): readonly TimelineEvent[] {
  if (METADATA === null) {
    return PORTFOLIO.events;
  }

  const cutoff = new Map<string, string>();
  for (const event of PORTFOLIO.events) {
    const current = cutoff.get(event.project);
    if (current === undefined || event.date > current) {
      cutoff.set(event.project, event.date);
    }
  }

  const generated: TimelineEvent[] = [];
  for (const project of METADATA.projects) {
    if (!isProjectId(project.id)) {
      continue;
    }
    const after = cutoff.get(project.id);
    for (const milestone of project.milestones) {
      if (after !== undefined && milestone.date <= after) {
        continue;
      }
      generated.push({
        date: milestone.date,
        kind: "release",
        project: project.id,
        title: milestone.title,
        detail: milestone.detail ?? `Published as ${milestone.version ?? milestone.title}.`,
        ...(milestone.url === undefined ? {} : { href: milestone.url }),
      });
    }
  }

  return generated.length === 0 ? PORTFOLIO.events : [...PORTFOLIO.events, ...generated];
}

function isProjectId(value: string): value is ProjectId {
  return Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, value);
}
