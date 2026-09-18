/**
 * Consuming a project's published project-metadata.json.
 *
 * The document comes from another repository's deployment, so it is treated as
 * untrusted input throughout: anything unexpected raises rather than flowing
 * into generated output.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ContractError, fetchContract, normalizeContract } from "../scripts/lib/contract.mjs";

const REPO = "BPForbes/Bailey-Forbes-Flinstone";
const CONTEXT = { projectId: "flinstone", repo: REPO };

/** A minimal valid schema-1 document. */
function contract(overrides = {}) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-09-17T12:00:00Z",
    sourceCommit: "a".repeat(40),
    repository: {
      owner: "BPForbes",
      name: "Bailey-Forbes-Flinstone",
      defaultBranch: "main",
      url: `https://github.com/${REPO}`,
      description: "A portable kernel",
    },
    languages: [
      { name: "C", bytes: 2_792_382, percentage: 79 },
      { name: "Shell", bytes: 187_879, percentage: 5.3 },
    ],
    timeline: [
      {
        type: "pull_request",
        date: "2026-09-15T17:45:54Z",
        number: 359,
        title: "feat(lab): Emscripten Flinstone Shell sandbox",
        mergedAt: "2026-09-15T17:45:54Z",
        url: `https://github.com/${REPO}/pull/359`,
        author: "BPForbes",
      },
    ],
    ...overrides,
  };
}

test("a valid contract normalizes into the portfolio's own shape", () => {
  const result = normalizeContract(contract(), CONTEXT);

  assert.equal(result.defaultBranch, "main");
  assert.equal(result.description, "A portable kernel");
  assert.deepEqual(result.languages.map((l) => l.name), ["C", "Shell"]);
  // Percentages are re-derived from the published byte counts, so every bar on
  // the site is rounded by exactly one implementation.
  assert.equal(result.languages.reduce((sum, l) => sum + l.pct, 0), 100);
  assert.equal(result.generatedTimelineEvents.length, 1);
  assert.equal(result.generatedTimelineEvents[0].identity, `pr:${REPO}#359`);
  assert.equal(result.generatedTimelineEvents[0].title, "Emscripten Flinstone Shell sandbox");
});

test("a contract describing a different repository is rejected", () => {
  const wrong = contract({ repository: { owner: "someone", name: "else" } });
  assert.throws(() => normalizeContract(wrong, CONTEXT), ContractError);
});

test("an unsupported schema version is rejected rather than guessed at", () => {
  assert.throws(() => normalizeContract(contract({ schemaVersion: 2 }), CONTEXT), /schemaVersion/);
  assert.throws(() => normalizeContract(contract({ schemaVersion: undefined }), CONTEXT), /schemaVersion/);
});

test("structurally broken documents are rejected", () => {
  for (const value of [null, undefined, "a string", 42, []]) {
    assert.throws(() => normalizeContract(value, CONTEXT), ContractError);
  }
  assert.throws(() => normalizeContract(contract({ repository: null }), CONTEXT), /repository/);
  assert.throws(() => normalizeContract(contract({ languages: "nope" }), CONTEXT), /languages/);
  assert.throws(() => normalizeContract(contract({ timeline: "nope" }), CONTEXT), /timeline/);
});

test("the portfolio's curation bar still applies to a contract's timeline", () => {
  const noisy = contract({
    timeline: [
      { type: "pull_request", date: "2026-09-15T00:00:00Z", number: 1, title: "chore(deps): bump serde", author: "BPForbes" },
      { type: "pull_request", date: "2026-09-15T00:00:00Z", number: 2, title: "Add a real feature", author: "BPForbes" },
    ],
  });
  const result = normalizeContract(noisy, CONTEXT);
  assert.equal(result.generatedTimelineEvents.length, 1);
  assert.equal(result.generatedTimelineEvents[0].identity, `pr:${REPO}#2`);
});

test("zero releases is a supported state and fabricates no version", () => {
  const result = normalizeContract(contract(), CONTEXT);
  assert.equal(result.latestVersion, undefined);
  assert.equal(result.latestReleaseUrl, undefined);
});

test("a published release in the contract supplies the version", () => {
  const withRelease = contract({
    timeline: [
      {
        type: "release",
        date: "2026-09-15T00:00:00Z",
        tag: "v4.5.4",
        title: "Flintstone Kernel v4.5.4",
        url: `https://github.com/${REPO}/releases/tag/v4.5.4`,
        prerelease: false,
      },
    ],
  });
  const result = normalizeContract(withRelease, CONTEXT);
  assert.equal(result.latestVersion, "v4.5.4");
  assert.equal(result.latestReleaseDate, "2026-09-15");
});

test("a prerelease entry is not treated as the current version", () => {
  const pre = contract({
    timeline: [{ type: "release", date: "2026-09-16T00:00:00Z", tag: "v5.0.0-rc.1", title: "rc", prerelease: true }],
  });
  const result = normalizeContract(pre, CONTEXT);
  assert.equal(result.latestVersion, undefined);
  assert.equal(result.generatedTimelineEvents.length, 0);
});

test("entries with unparsable dates or non-GitHub links are discarded", () => {
  const bad = contract({
    timeline: [
      { type: "pull_request", date: "2026-02-30T00:00:00Z", number: 1, title: "Add a thing", author: "BPForbes" },
      { type: "pull_request", date: "2026-09-15T00:00:00Z", number: 2, title: "Add a thing", url: "javascript:alert(1)", author: "BPForbes" },
    ],
  });
  const result = normalizeContract(bad, CONTEXT);
  assert.equal(result.generatedTimelineEvents.length, 1);
  // The bad link is dropped; the entry survives without one.
  assert.equal(result.generatedTimelineEvents[0].href, undefined);
});

test("a release URL that is not a GitHub URL is dropped, not propagated", () => {
  // Left in place it would be overlaid onto valid REST metadata and then
  // rejected by the document validator, failing the entire sync — so one bad
  // link upstream would stop every scheduled refresh.
  const result = normalizeContract(
    contract({
      timeline: [
        {
          type: "release",
          date: "2026-09-15T00:00:00Z",
          tag: "v4.5.4",
          title: "Flintstone Kernel v4.5.4",
          url: "https://evil.example/releases/tag/v4.5.4",
          prerelease: false,
        },
      ],
    }),
    CONTEXT,
  );
  assert.equal(result.latestVersion, "v4.5.4", "the release itself is still usable");
  assert.equal(result.latestReleaseUrl, undefined, "but the bad link never escapes");
});

test("an empty contract timeline is distinguished from an absent one", () => {
  const present = normalizeContract(contract({ timeline: [] }), CONTEXT);
  assert.equal(present.hasTimeline, true);
  assert.deepEqual(present.generatedTimelineEvents, []);

  const absent = normalizeContract(contract({ timeline: undefined }), CONTEXT);
  assert.equal(absent.hasTimeline, false);
  assert.deepEqual(absent.generatedTimelineEvents, []);
});

test("an unreachable contract reports a reason instead of throwing", async () => {
  const result = await fetchContract("https://example.invalid/project-metadata.json", {
    ...CONTEXT,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /fetch failed/);
});

test("a 404 contract degrades to the REST path", async () => {
  const result = await fetchContract("https://example.invalid/project-metadata.json", {
    ...CONTEXT,
    fetchImpl: async () => new Response("not found", { status: 404 }),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /404/);
});

test("a contract that is not JSON degrades to the REST path", async () => {
  const result = await fetchContract("https://example.invalid/project-metadata.json", {
    ...CONTEXT,
    fetchImpl: async () => new Response("<!doctype html><title>404</title>", { status: 200 }),
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /not valid JSON/);
});

test("a reachable, valid contract is returned", async () => {
  const result = await fetchContract("https://example.invalid/project-metadata.json", {
    ...CONTEXT,
    fetchImpl: async () =>
      new Response(JSON.stringify(contract()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.languages[0].name, "C");
});
