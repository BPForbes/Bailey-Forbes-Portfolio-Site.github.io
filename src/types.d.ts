export type EventKind = "feature" | "release";

export type ProjectId =
  | "emr"
  | "homework-central"
  | "flinstone"
  | "keyquorum"
  | "qpu";

export interface LanguageShare {
  name: string;
  pct: number;
  color: string;
}

export interface TimelineEvent {
  date: string;
  kind: EventKind;
  project: ProjectId;
  title: string;
  detail: string;
  href?: string;
}

export interface PortfolioData {
  compiled: string;
  source: string;
  projects: Record<ProjectId, string>;
  projectOrder: readonly ProjectId[];
  languages: Partial<Record<ProjectId, readonly LanguageShare[]>>;
  events: readonly TimelineEvent[];
  /**
   * Curated named releases: hand-picked milestones, not every merge. This is
   * the fallback shown before a project's own repository publishes the same
   * shape in its contract (`RepositoryMetadata.namedReleases`), and stands in
   * for any project — like `emr` — that never will.
   */
  namedReleases: Partial<Record<ProjectId, readonly NamedRelease[]>>;
}

/**
 * A single portfolio-worthy release, curated rather than derived from commits.
 *
 * `startDate`/`endDate` are plain calendar days (`YYYY-MM-DD`); the renderer
 * formats them, so raw dates travel unopinionated from either the curated
 * fallback or a project's own generated contract.
 */
export interface NamedRelease {
  id: string;
  version: string;
  startDate: string;
  endDate: string | null;
  summary: string;
  description: string;
  url: string;
}

/**
 * A language share as GitHub Linguist reports it, plus the derived percentage.
 *
 * `bytes` is kept alongside `pct` so a consumer can re-derive or re-round
 * without another API call, and so the percentage can be sanity-checked against
 * its own input.
 */
export interface RepositoryLanguage {
  name: string;
  bytes: number;
  pct: number;
}

/** A timeline event produced by the sync script rather than written by hand. */
export interface GeneratedTimelineEvent extends TimelineEvent {
  /**
   * The author's full Markdown body, for the expanded commit card.
   *
   * `detail` is the lossy one-line summary the collapsed row shows. Absent on
   * snapshots written before bodies were carried, and on events whose source
   * had no body at all.
   */
  body?: string;
  /**
   * Stable dedupe key, e.g. "pr:owner/repo#12" or "release:owner/repo@v1.2.0".
   * Lets a regenerated event be recognised as the same event across runs.
   */
  identity: string;
}

/** Everything the sync script knows about one project's repository. */
export interface RepositoryMetadata {
  repository: string;
  repositoryUrl: string;
  owner: string;
  name: string;
  defaultBranch: string;
  description?: string;
  createdAt?: string;
  pushedAt?: string;
  commitCount: number;
  mergedPullRequestCount: number;
  /** Highest pull request number seen — i.e. pull requests ever opened. */
  pullRequestCount: number;
  latestVersion?: string;
  /** Which strategy produced latestVersion, for provenance in the JSON. */
  latestVersionSource?: string;
  latestReleaseUrl?: string;
  latestReleaseDate?: string;
  languages: readonly RepositoryLanguage[];
  generatedTimelineEvents: readonly GeneratedTimelineEvent[];
  /**
   * Curated, not derived — present only when the project's own contract has
   * published this field. Absent (rather than empty) means "this project has
   * not adopted the field yet"; an empty array is a project's explicit "no
   * named releases". Either way the curated fallback in `data.ts` stands in
   * until this is present and non-empty.
   */
  namedReleases?: readonly NamedRelease[];
  /** "contract" when the project published its own metadata document. */
  source: "contract" | "github";
  fetchedAt: string;
  /**
   * Run state, not repository state: set in memory when an entry is carried
   * over after a failed fetch, and deliberately stripped before the snapshot is
   * written. Present on the type because validation reads it.
   */
  stale?: boolean;
  lastError?: string;
}

export interface GeneratedProjectMetadata {
  schemaVersion: number;
  generatedAt: string;
  projects: Partial<Record<ProjectId, RepositoryMetadata>>;
}
