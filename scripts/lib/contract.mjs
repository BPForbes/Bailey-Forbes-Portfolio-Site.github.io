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
 *   generatedTimelineEvents: import("./types.mjs").GeneratedTimelineEvent[],
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
    generatedTimelineEvents: normalizeContractTimeline(doc.timeline, context),
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
      ...(typeof entry.url === "string" ? { url: entry.url } : {}),
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
