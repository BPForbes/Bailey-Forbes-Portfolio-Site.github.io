/**
 * Collecting one project's metadata, and deciding what to keep when that fails.
 *
 * Order of operations per project:
 *
 *   1. repository facts, languages, commit count, pull requests  (REST)
 *   2. version: release -> stable tag -> version manifest -> curated
 *   3. if the project publishes a contract, overlay its languages and timeline,
 *      because that repository is the source of truth for its own state
 *   4. on any failure, reuse the previous snapshot for that project
 *
 * Step 4 is the important one. A project that throws is returned as its last
 * known-good entry marked `stale`, with the error recorded. It is never
 * returned as zeros, and never dropped — dropping it would silently revert the
 * site to curated values that are known to be out of date.
 */

import { fetchContract } from "./contract.mjs";
import { GitHubClient } from "./github.mjs";
import { computeLanguageShares } from "./languages.mjs";
import {
  dedupeEvents,
  eventFromPullRequest,
  eventFromRelease,
  orderEvents,
} from "./timeline.mjs";
import {
  compareSemver,
  formatVersion,
  pickLatestManifestVersion,
  pickLatestRelease,
  pickLatestTag,
  shortlistManifestFiles,
} from "./version.mjs";

/**
 * @param {object} options
 * @param {string} options.projectId
 * @param {import("./types.mjs").ProjectSource} options.source
 * @param {GitHubClient} options.client
 * @param {import("./types.mjs").RepositoryMetadata} [options.previous]
 * @param {number} [options.maxTimeline]
 * @param {boolean} [options.skipContract]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ metadata: import("./types.mjs").RepositoryMetadata, error?: Error }>}
 */
export async function collectProject(options) {
  const { projectId, source, client, previous, log = () => {} } = options;
  const maxTimeline = options.maxTimeline ?? 12;

  try {
    const metadata = await collect(options, maxTimeline);
    return { metadata };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    log(`  ! ${projectId} (${source.repo}) failed: ${reason}`);

    if (previous) {
      log(`    keeping the previous snapshot (fetched ${previous.fetchedAt})`);
      return {
        metadata: { ...previous, stale: true, lastError: reason },
        error: error instanceof Error ? error : new Error(reason),
      };
    }

    // No previous data and no fetch: emit nothing at all, so the site keeps
    // using its curated values rather than rendering an empty language bar.
    log(`    no previous snapshot — leaving ${projectId} on curated data`);
    throw error instanceof Error ? error : new Error(reason);
  }
}

/**
 * @param {Parameters<typeof collectProject>[0]} options
 * @param {number} maxTimeline
 * @returns {Promise<import("./types.mjs").RepositoryMetadata>}
 */
async function collect(options, maxTimeline) {
  const { projectId, source, client, log = () => {} } = options;
  const repo = source.repo;

  const repository = await client.repository(repo);
  const defaultBranch =
    typeof repository.default_branch === "string" && repository.default_branch !== ""
      ? repository.default_branch
      : "main";

  const [languageBytes, commitCount, closedPulls, openPulls, releases, tags] = await Promise.all([
    client.languages(repo),
    client.commitCount(repo, defaultBranch),
    client.closedPullRequests(repo),
    client.openPullRequests(repo),
    client.releases(repo),
    client.tags(repo),
  ]);

  const mergedPulls = closedPulls.filter(
    (pull) => pull && typeof pull.merged_at === "string" && pull.merged_at !== "",
  );

  let languages = computeLanguageShares(languageBytes);
  if (languages.length === 0) {
    // GitHub answered, but with nothing usable. Refuse to publish an empty bar.
    throw new Error(`no positive language bytes reported for ${repo}`);
  }

  /** @type {import("./types.mjs").GeneratedTimelineEvent[]} */
  let events = [];
  for (const release of releases) {
    const event = eventFromRelease(release, projectId, repo);
    if (event) events.push(event);
  }
  for (const pull of mergedPulls) {
    const event = eventFromPullRequest(pull, projectId, repo);
    if (event) events.push(event);
  }
  events = orderEvents(dedupeEvents(events), maxTimeline);

  const version = await resolveVersion({ client, source, releases, tags, log });

  /** @type {import("./types.mjs").RepositoryMetadata} */
  const metadata = {
    repository: repo,
    repositoryUrl:
      typeof repository.html_url === "string" ? repository.html_url : `https://github.com/${repo}`,
    owner: repo.split("/")[0],
    name: repo.split("/")[1],
    defaultBranch,
    ...(typeof repository.description === "string" && repository.description !== ""
      ? { description: repository.description }
      : {}),
    ...(typeof repository.created_at === "string" ? { createdAt: repository.created_at } : {}),
    ...(typeof repository.pushed_at === "string" ? { pushedAt: repository.pushed_at } : {}),
    commitCount,
    mergedPullRequestCount: mergedPulls.length,
    pullRequestCount: closedPulls.length + openPulls.length,
    ...version,
    languages,
    generatedTimelineEvents: events,
    source: "github",
    fetchedAt: new Date().toISOString(),
  };

  if (source.contractUrl && options.skipContract !== true) {
    await overlayContract(metadata, options, maxTimeline);
  }

  return metadata;
}

/**
 * Let a published contract supersede the REST-derived languages and timeline.
 *
 * @param {import("./types.mjs").RepositoryMetadata} metadata
 * @param {Parameters<typeof collectProject>[0]} options
 * @param {number} maxTimeline
 */
async function overlayContract(metadata, options, maxTimeline) {
  const { projectId, source, log = () => {} } = options;
  const url = source.contractUrl;
  if (!url) return;

  const result = await fetchContract(url, {
    projectId,
    repo: source.repo,
    maxTimeline,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });

  if (!result.ok) {
    log(`    contract unavailable (${result.reason}); using the GitHub REST API`);
    return;
  }

  const contract = result.value;
  if (contract.languages.length > 0) {
    metadata.languages = contract.languages;
  }
  if (contract.generatedTimelineEvents.length > 0) {
    metadata.generatedTimelineEvents = contract.generatedTimelineEvents;
  }
  if (contract.description !== undefined && metadata.description === undefined) {
    metadata.description = contract.description;
  }
  // A release published in the contract outranks a manifest-derived version.
  if (contract.latestVersion !== undefined) {
    metadata.latestVersion = formatVersion(contract.latestVersion, source.displayVersionPrefix);
    metadata.latestVersionSource = "contract-release";
    if (contract.latestReleaseUrl !== undefined) {
      metadata.latestReleaseUrl = contract.latestReleaseUrl;
    }
    if (contract.latestReleaseDate !== undefined) {
      metadata.latestReleaseDate = contract.latestReleaseDate;
    }
  }
  metadata.source = "contract";
  log(`    contract applied from ${url}`);
}

/**
 * Release -> stable tag -> version manifest. Returns nothing when a project has
 * no version scheme, which leaves the curated chip in place.
 *
 * @param {object} args
 * @param {GitHubClient} args.client
 * @param {import("./types.mjs").ProjectSource} args.source
 * @param {any[]} args.releases
 * @param {any[]} args.tags
 * @param {(message: string) => void} args.log
 * @returns {Promise<Partial<import("./types.mjs").RepositoryMetadata>>}
 */
async function resolveVersion({ client, source, releases, tags, log }) {
  const release = pickLatestRelease(releases);
  if (release) {
    return {
      latestVersion: formatVersion(release.version.raw, source.displayVersionPrefix),
      latestVersionSource: "github-release",
      ...(release.url ? { latestReleaseUrl: release.url } : {}),
      ...(release.date ? { latestReleaseDate: release.date } : {}),
    };
  }

  const tag = pickLatestTag(tags);
  if (tag) {
    return {
      latestVersion: formatVersion(tag.raw, source.displayVersionPrefix),
      latestVersionSource: "git-tag",
    };
  }

  const manifest = source.versionManifest;
  if (!manifest) {
    return {};
  }

  const names = await client.listDirectory(source.repo, manifest.dir);
  if (names.length === 0) {
    log(`    version manifest ${manifest.dir} is empty or missing`);
    return {};
  }
  const shortlist = shortlistManifestFiles(names, manifest.format);
  /** @type {{ name: string, text: string }[]} */
  const files = [];
  for (const name of shortlist) {
    const text = await client.readFile(source.repo, `${manifest.dir}/${name}`);
    if (typeof text === "string") {
      files.push({ name, text });
    }
  }
  const version = pickLatestManifestVersion(files, manifest.format);
  if (!version) {
    log(`    no parsable version in ${manifest.dir}`);
    return {};
  }
  return {
    latestVersion: formatVersion(version.raw, source.displayVersionPrefix),
    latestVersionSource: `version-manifest:${manifest.dir}`,
  };
}

export { compareSemver };
