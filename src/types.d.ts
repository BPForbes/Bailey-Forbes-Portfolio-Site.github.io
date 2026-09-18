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
