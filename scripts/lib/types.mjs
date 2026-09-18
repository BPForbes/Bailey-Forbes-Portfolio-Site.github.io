/**
 * JSDoc type definitions shared across the sync script.
 *
 * The sync script is plain ESM so it can run under `node` with no build step,
 * but the shapes it produces are the same ones `src/types.d.ts` declares for the
 * browser bundle. Keeping them written down here means `npm run typecheck:scripts`
 * (tsc in checkJs mode) can catch a drift between the two.
 *
 * @module
 */

/**
 * @typedef {object} VersionManifestSource
 * @property {string} dir    Repository directory holding the version files.
 * @property {"flinstone-ver"} format  Parser name.
 */

/**
 * @typedef {object} ProjectSource
 * @property {string} repo                    "owner/name"
 * @property {string} [contractUrl]           Published project-metadata.json.
 * @property {VersionManifestSource} [versionManifest]
 * @property {string} [displayVersionPrefix]  e.g. "v"
 */

/**
 * @typedef {object} RepositoryLanguage
 * @property {string} name
 * @property {number} bytes
 * @property {number} pct
 */

/**
 * @typedef {object} GeneratedTimelineEvent
 * @property {string} date          YYYY-MM-DD
 * @property {"feature"|"release"} kind
 * @property {string} project       Portfolio project id.
 * @property {string} title
 * @property {string} detail
 * @property {string} [href]
 * @property {string} identity      Stable dedupe key, e.g. "pr:owner/repo#12".
 */

/**
 * @typedef {object} RepositoryMetadata
 * @property {string} repository
 * @property {string} repositoryUrl
 * @property {string} owner
 * @property {string} name
 * @property {string} defaultBranch
 * @property {string} [description]
 * @property {string} [createdAt]
 * @property {string} [pushedAt]
 * @property {number} commitCount
 * @property {number} mergedPullRequestCount
 * @property {number} pullRequestCount
 * @property {string} [latestVersion]
 * @property {string} [latestVersionSource]
 * @property {string} [latestReleaseUrl]
 * @property {string} [latestReleaseDate]
 * @property {RepositoryLanguage[]} languages
 * @property {GeneratedTimelineEvent[]} generatedTimelineEvents
 * @property {"contract"|"github"} source
 * @property {string} fetchedAt
 * @property {boolean} [stale]
 * @property {string} [lastError]
 */

/**
 * @typedef {object} ProjectMetadataDocument
 * @property {number} schemaVersion
 * @property {string} generatedAt
 * @property {Record<string, RepositoryMetadata>} projects
 */

export {};
