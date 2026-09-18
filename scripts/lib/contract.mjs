/**
 * Consuming a project's own published `project-metadata.json`.
 *
 * Two of the repositories behind this portfolio publish a schemaVersion-1
 * metadata document next to their GitHub Pages deployment, generated inside
 * their own validated build. Flinstone's docs/project-metadata.md states the
 * intent plainly: the portfolio "should not independently maintain language
 * percentages, PR history, release history", because that repository is the
 * source of truth for its own state.
 *
 * So when a contract is reachable it wins over anything this repository could
 * re-derive. When it is not — the deployment is mid-flight, the path moved, the
 * schema bumped — the caller falls back to the REST API and logs the reason.
 * The fallback produces the same normalized shape, so a missing contract costs
 * accuracy of provenance, not correctness.
 *
 * The document is treated as untrusted input: every field is checked, and
 * anything unexpected fails the parse rather than flowing into generated output.
 */

import { computeLanguageShares } from "./languages.mjs";
import { cleanTitle, dedupeEvents, isSignificantTitle, isValidDate, orderEvents } from "./timeline.mjs";
import { isGitHubUrl } from "./validate.mjs";

/** The only schema this consumer understands. */
export const SUPPORTED_SCHEMA_VERSION = 1;

export class ContractError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "ContractError";
  }
}

/**
 * Validate and normalize a published contract document.
 *
 * @param {unknown} document
 * @param {{ projectId: string, repo: string, maxTimeline?: number }} context
 * @returns {{
 *   languages: import("./types.mjs").RepositoryLanguage[],
 *   hasTimeline: boolean,
 *   generatedTimelineEvents: import("./types.mjs").GeneratedTimelineEvent[],
 *   hasNamedReleases: boolean,
 *   namedReleases: import("./types.mjs").NamedRelease[],
 *   defaultBranch?: string,
 *   description?: string,
 *   repositoryUrl?: string,
 *   latestVersion?: string,
 *   latestReleaseUrl?: string,
 *   latestReleaseDate?: string,
 * }}
 */
export function normalizeContract(document, context) {
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    throw new ContractError("contract is not a JSON object");
  }
  /** @type {Record<string, any>} */
  const doc = document;

  if (doc.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    throw new ContractError(
      `unsupported schemaVersion ${String(doc.schemaVersion)} (expected ${SUPPORTED_SCHEMA_VERSION})`,
    );
  }

  const repository = doc.repository;
  if (repository === null || typeof repository !== "object") {
    throw new ContractError("contract has no repository block");
  }
  const owner = typeof repository.owner === "string" ? repository.owner : "";
  const name = typeof repository.name === "string" ? repository.name : "";
  if (owner === "" || name === "") {
    throw new ContractError("contract repository block is missing owner/name");
  }
  // A document that describes a different repository is not this project's.
  if (`${owner}/${name}`.toLowerCase() !== context.repo.toLowerCase()) {
    throw new ContractError(
      `contract describes ${owner}/${name}, expected ${context.repo}`,
    );
  }

  return {
    languages: normalizeContractLanguages(doc.languages),
    // Whether the document carried a timeline at all, which is not the same
    // question as whether it produced any events. A contract that publishes an
    // empty timeline is asserting it has no milestones, and the caller must be
    // able to honour that instead of silently keeping REST-derived ones.
    hasTimeline: Array.isArray(doc.timeline),
    generatedTimelineEvents: normalizeContractTimeline(doc.timeline, context),
    // Same presence-vs-length distinction as the timeline above, and for the
    // same reason: a contract that has curated zero named releases is telling
    // the caller that, and must not be masked by carrying over a stale list
    // from a previous run that did have some.
    hasNamedReleases: Array.isArray(doc.releases),
    namedReleases: normalizeContractNamedReleases(doc.releases),
    ...(typeof repository.defaultBranch === "string" && repository.defaultBranch !== ""
      ? { defaultBranch: repository.defaultBranch }
      : {}),
    ...(typeof repository.description === "string" && repository.description !== ""
      ? { description: repository.description }
      : {}),
    ...(typeof repository.url === "string" && repository.url !== ""
      ? { repositoryUrl: repository.url }
      : {}),
    ...normalizeContractRelease(doc.timeline),
  };
}

/**
 * The contract publishes `percentage` alongside raw `bytes`, and says raw bytes
 * are preserved precisely so consumers can re-derive. This portfolio re-derives
 * from bytes rather than trusting the upstream rounding, so every project's bar
 * — contract-backed or API-backed — is rounded by exactly one implementation.
 *
 * @param {unknown} languages
 * @returns {import("./types.mjs").RepositoryLanguage[]}
 */
function normalizeContractLanguages(languages) {
  if (!Array.isArray(languages)) {
    throw new ContractError("contract languages is not an array");
  }
  /** @type {Record<string, number>} */
  const byteMap = {};
  for (const entry of languages) {
    if (entry === null || typeof entry !== "object") continue;
    const name = typeof entry.name === "string" ? entry.name : "";
    const bytes = typeof entry.bytes === "number" ? entry.bytes : Number(entry.bytes);
    if (name === "" || !Number.isFinite(bytes) || bytes <= 0) continue;
    byteMap[name] = bytes;
  }
  return computeLanguageShares(byteMap);
}

/**
 * @param {unknown} timeline
 * @param {{ projectId: string, repo: string, maxTimeline?: number }} context
 * @returns {import("./types.mjs").GeneratedTimelineEvent[]}
 */
function normalizeContractTimeline(timeline, context) {
  if (timeline === undefined) {
    return [];
  }
  if (!Array.isArray(timeline)) {
    throw new ContractError("contract timeline is not an array");
  }

  /** @type {import("./types.mjs").GeneratedTimelineEvent[]} */
  const events = [];
  for (const entry of timeline) {
    if (entry === null || typeof entry !== "object") continue;
    const date = typeof entry.date === "string" ? entry.date.slice(0, 10) : "";
    if (!isValidDate(date)) continue;
    const title = typeof entry.title === "string" ? entry.title : "";
    if (title.trim() === "") continue;
    const url = typeof entry.url === "string" && /^https:\/\/github\.com\//.test(entry.url)
      ? entry.url
      : undefined;

    if (entry.type === "pull_request") {
      if (typeof entry.number !== "number") continue;
      // The upstream generator's selection rules are its own; this portfolio
      // still applies its curation bar, so a contract cannot flood the rail.
      if (!isSignificantTitle(title, { author: entry.author })) continue;
      events.push({
        date,
        kind: "feature",
        project: context.projectId,
        title: cleanTitle(title),
        detail: `Merged pull request #${entry.number}: ${title.trim()}.`,
        ...(url ? { href: url } : {}),
        identity: `pr:${context.repo}#${entry.number}`,
      });
      continue;
    }

    if (entry.type === "release" || entry.type === "tag") {
      if (entry.prerelease === true) continue;
      const tag = typeof entry.tag === "string" ? entry.tag.trim() : "";
      if (tag === "") continue;
      events.push({
        date,
        kind: "release",
        project: context.projectId,
        title: cleanTitle(title),
        detail: `Release ${tag}.`,
        ...(url ? { href: url } : {}),
        identity: `release:${context.repo}@${tag}`,
      });
    }
  }

  return orderEvents(dedupeEvents(events), context.maxTimeline ?? 12);
}

/**
 * The curated `releases` array a project may publish alongside its automatic
 * `timeline`. Unlike the timeline, nothing here is inferred — a project states
 * explicitly which of its releases are portfolio-worthy, in
 * `metadata/releases.json` on its own side, so this only re-validates the
 * shape rather than re-deriving anything from it.
 *
 * @param {unknown} releases
 * @returns {import("./types.mjs").NamedRelease[]}
 */
function normalizeContractNamedReleases(releases) {
  if (releases === undefined) {
    return [];
  }
  if (!Array.isArray(releases)) {
    throw new ContractError("contract releases is not an array");
  }

  /** @type {import("./types.mjs").NamedRelease[]} */
  const named = [];
  const seenIds = new Set();
  for (const entry of releases) {
    if (entry === null || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" ? entry.id : "";
    const version = typeof entry.version === "string" ? entry.version : "";
    const startDate = typeof entry.startDate === "string" ? entry.startDate : "";
    const summary = typeof entry.summary === "string" ? entry.summary : "";
    const description = typeof entry.description === "string" ? entry.description : "";
    const url = typeof entry.url === "string" ? entry.url : "";
    // A malformed row is dropped rather than failing the whole sync: the
    // upstream generator already validates its own document before
    // publishing, so a row this consumer cannot make sense of is far more
    // likely a schema drift this build predates than a row worth losing the
    // rest of the release list over.
    if (id === "" || seenIds.has(id)) continue;
    if (version === "" || summary === "" || description === "") continue;
    if (!isValidDate(startDate)) continue;
    if (!isGitHubUrl(url)) continue;
    const endDate = entry.endDate;
    if (endDate !== null && !(typeof endDate === "string" && isValidDate(endDate))) continue;

    seenIds.add(id);
    named.push({ id, version, startDate, endDate: endDate ?? null, summary, description, url });
  }

  // Newest-first, matching every other list this consumer produces.
  named.sort((left, right) => right.startDate.localeCompare(left.startDate) || right.version.localeCompare(left.version));
  return named;
}

/**
 * Derive a version from the contract's release entries, when it has any.
 *
 * Both current contracts publish zero releases (their repositories have none),
 * so this normally returns nothing and the caller moves on to the REST and
 * manifest strategies. Nothing is fabricated from a tag that is not there.
 *
 * @param {unknown} timeline
 * @returns {{ latestVersion?: string, latestReleaseUrl?: string, latestReleaseDate?: string }}
 */
function normalizeContractRelease(timeline) {
  if (!Array.isArray(timeline)) {
    return {};
  }
  /** @type {{ date: string, tag: string, url?: string }|undefined} */
  let newest;
  for (const entry of timeline) {
    if (entry === null || typeof entry !== "object") continue;
    if (entry.type !== "release" || entry.prerelease === true) continue;
    const tag = typeof entry.tag === "string" ? entry.tag.trim() : "";
    const date = typeof entry.date === "string" ? entry.date.slice(0, 10) : "";
    if (tag === "" || !isValidDate(date)) continue;
    if (newest && newest.date >= date) continue;
    newest = {
      date,
      tag,
      // Checked here, the same way the timeline path checks its links. An
      // unchecked URL would be overlaid onto otherwise valid REST metadata and
      // then rejected by the document validator, failing the whole sync — so a
      // single bad link upstream would stop every scheduled refresh instead of
      // falling back to the REST API. Dropping it keeps the release usable.
      ...(isGitHubUrl(entry.url) ? { url: entry.url } : {}),
    };
  }
  if (!newest) {
    return {};
  }
  return {
    latestVersion: newest.tag,
    latestReleaseDate: newest.date,
    ...(newest.url ? { latestReleaseUrl: newest.url } : {}),
  };
}

/**
 * Fetch and normalize a contract. Returns undefined (never throws) so a
 * contract problem degrades to the REST path instead of failing the run.
 *
 * @param {string} url
 * @param {{ projectId: string, repo: string, maxTimeline?: number, fetchImpl?: typeof fetch, timeoutMs?: number }} context
 * @returns {Promise<{ ok: true, value: ReturnType<typeof normalizeContract> }|{ ok: false, reason: string }>}
 */
export async function fetchContract(url, context) {
  const fetchImpl = context.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, context.timeoutMs ?? 15_000);

  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const text = await response.text();
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, reason: "response was not valid JSON" };
    }
    return { ok: true, value: normalizeContract(parsed, context) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
