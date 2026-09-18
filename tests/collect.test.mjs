/**
 * Collection behaviour, driven entirely through a fake transport.
 *
 * No test here reaches the network: every GitHub response is injected, which is
 * what makes the failure cases testable at all.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { collectProject } from "../scripts/lib/collect.mjs";
import { GitHubClient, parseLastPage } from "../scripts/lib/github.mjs";

/**
 * Build a fetch stand-in from a path -> response map.
 *
 * @param {Record<string, { body?: unknown, status?: number, link?: string, text?: string }>} routes
 */
function fakeFetch(routes, log = []) {
  return async (url) => {
    log.push(url);
    const path = url.replace("https://api.github.com", "");
    // Longest prefix wins, so "/repos/o/r" cannot swallow
    // "/repos/o/r/contents/version/locked/5_0_0_x.ver".
    const key = Object.keys(routes)
      .filter((candidate) => path.startsWith(candidate))
      .sort((a, b) => b.length - a.length)[0];
    const route = key === undefined ? undefined : routes[key];
    if (route === undefined) {
      return new Response("{}", { status: 404, headers: { "Content-Type": "application/json" } });
    }
    if (route.error) {
      throw new TypeError("fetch failed");
    }
    const headers = new Headers({ "Content-Type": "application/json" });
    if (route.link) headers.set("link", route.link);
    const payload = route.text !== undefined ? route.text : JSON.stringify(route.body ?? {});
    return new Response(payload, { status: route.status ?? 200, headers });
  };
}

const REPO = "BPForbes/KeyQuorum";

/** A complete, healthy set of routes for one repository. */
function healthyRoutes(overrides = {}) {
  return {
    [`/repos/${REPO}/languages`]: { body: { Rust: 48_000, SQL: 2_000 } },
    [`/repos/${REPO}/commits`]: {
      body: [{ sha: "abc" }],
      link: `<https://api.github.com/repositories/1/commits?per_page=1&page=24>; rel="last"`,
    },
    [`/repos/${REPO}/pulls?state=closed`]: {
      body: [
        {
          number: 13,
          title: "Add Axum mailbox relay with API keys",
          merged_at: "2026-09-01T10:00:00Z",
          html_url: `https://github.com/${REPO}/pull/13`,
          user: { login: "BPForbes" },
        },
        { number: 12, title: "chore: tidy", merged_at: null, user: { login: "BPForbes" } },
      ],
    },
    [`/repos/${REPO}/pulls?state=open`]: { body: [] },
    [`/repos/${REPO}/releases`]: { body: [] },
    [`/repos/${REPO}/tags`]: { body: [] },
    [`/repos/${REPO}`]: {
      body: {
        full_name: REPO,
        default_branch: "main",
        html_url: `https://github.com/${REPO}`,
        description: "Hardware-key file sharing",
        created_at: "2026-08-24T17:17:46Z",
        pushed_at: "2026-09-02T22:14:00Z",
      },
    },
    ...overrides,
  };
}

function client(routes) {
  return new GitHubClient({ fetchImpl: fakeFetch(routes), retries: 0 });
}

test("a healthy repository produces normalized metadata", async () => {
  const { metadata, error } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO },
    client: client(healthyRoutes()),
  });

  assert.equal(error, undefined);
  assert.equal(metadata.commitCount, 24);
  assert.equal(metadata.mergedPullRequestCount, 1);
  assert.equal(metadata.pullRequestCount, 2);
  assert.equal(metadata.defaultBranch, "main");
  assert.equal(metadata.source, "github");
  assert.equal(metadata.repositoryUrl, `https://github.com/${REPO}`);
  assert.deepEqual(metadata.languages.map((l) => l.name), ["Rust", "SQL"]);
  assert.equal(metadata.languages.reduce((sum, l) => sum + l.pct, 0), 100);
  assert.equal(metadata.generatedTimelineEvents.length, 1);
  assert.equal(metadata.generatedTimelineEvents[0].identity, `pr:${REPO}#13`);
  // No releases and no tags and no manifest: the curated chip stands.
  assert.equal(metadata.latestVersion, undefined);
});

test("a failed fetch preserves the previous snapshot instead of zeroing it", async () => {
  const previous = {
    repository: REPO,
    repositoryUrl: `https://github.com/${REPO}`,
    owner: "BPForbes",
    name: "KeyQuorum",
    defaultBranch: "main",
    commitCount: 24,
    mergedPullRequestCount: 14,
    pullRequestCount: 21,
    languages: [{ name: "Rust", bytes: 48_231, pct: 100 }],
    generatedTimelineEvents: [],
    source: "github",
    fetchedAt: "2026-09-16T00:00:00Z",
  };

  const { metadata, error } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO },
    client: client({ [`/repos/${REPO}`]: { error: true } }),
    previous,
  });

  assert.ok(error, "the failure is still reported");
  assert.equal(metadata.stale, true);
  assert.ok(metadata.lastError);
  // The numbers that matter survived untouched.
  assert.equal(metadata.commitCount, 24);
  assert.equal(metadata.mergedPullRequestCount, 14);
  assert.deepEqual(metadata.languages, previous.languages);
});

test("a failure with no previous snapshot throws rather than emitting zeroes", async () => {
  await assert.rejects(
    collectProject({
      projectId: "keyquorum",
      source: { repo: REPO },
      client: client({ [`/repos/${REPO}`]: { error: true } }),
    }),
  );
});

test("an empty languages response is refused, not published as an empty bar", async () => {
  await assert.rejects(
    collectProject({
      projectId: "keyquorum",
      source: { repo: REPO },
      client: client(healthyRoutes({ [`/repos/${REPO}/languages`]: { body: {} } })),
    }),
    /no positive language bytes/,
  );
});

test("malformed JSON from GitHub fails the project rather than corrupting it", async () => {
  await assert.rejects(
    collectProject({
      projectId: "keyquorum",
      source: { repo: REPO },
      client: client(healthyRoutes({ [`/repos/${REPO}/languages`]: { text: "{not json" } })),
    }),
  );
});

test("a published release outranks tags and manifests", async () => {
  const { metadata } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO },
    client: client(
      healthyRoutes({
        [`/repos/${REPO}/releases`]: {
          body: [
            {
              tag_name: "v2.1.0",
              published_at: "2026-09-02T00:00:00Z",
              html_url: `https://github.com/${REPO}/releases/tag/v2.1.0`,
            },
          ],
        },
        [`/repos/${REPO}/tags`]: { body: [{ name: "v9.9.9" }] },
      }),
    ),
  });

  assert.equal(metadata.latestVersion, "2.1.0");
  assert.equal(metadata.latestVersionSource, "github-release");
  assert.equal(metadata.latestReleaseDate, "2026-09-02");
});

test("tags are used when there are no releases", async () => {
  const { metadata } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO },
    client: client(healthyRoutes({ [`/repos/${REPO}/tags`]: { body: [{ name: "v1.4.0" }, { name: "nightly" }] } })),
  });
  assert.equal(metadata.latestVersion, "1.4.0");
  assert.equal(metadata.latestVersionSource, "git-tag");
});

test("a version manifest is the last resort before curated data", async () => {
  const { metadata } = await collectProject({
    projectId: "flinstone",
    source: { repo: REPO, versionManifest: { dir: "version/locked", format: "flinstone-ver" } },
    client: client(
      healthyRoutes({
        [`/repos/${REPO}/contents/version/locked/5_0_0_x.ver`]: {
          text: "MAJOR_VERSION=5\nSTANDARD_VERSION=0\nRELEASE_VERSION=0\n",
        },
        [`/repos/${REPO}/contents/version/locked`]: {
          body: [
            { type: "file", name: "4_5_4_x.ver" },
            { type: "file", name: "5_0_0_x.ver" },
            { type: "file", name: "ABOUT.txt" },
          ],
        },
      }),
    ),
  });

  assert.equal(metadata.latestVersion, "5.0.0");
  assert.equal(metadata.latestVersionSource, "version-manifest:version/locked");
});

test("an empty contract timeline clears the REST-derived events", async () => {
  // The contract is the upstream source of truth for its own milestones, so an
  // empty timeline means "none" — not "fall back to whatever REST found".
  const contract = {
    schemaVersion: 1,
    repository: { owner: "BPForbes", name: "KeyQuorum", defaultBranch: "main" },
    languages: [{ name: "Rust", bytes: 48_000 }],
    timeline: [],
  };

  const { metadata } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO, contractUrl: "https://example.invalid/project-metadata.json" },
    client: client(healthyRoutes()),
    fetchImpl: async () =>
      new Response(JSON.stringify(contract), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });

  assert.equal(metadata.source, "contract");
  assert.deepEqual(metadata.generatedTimelineEvents, []);
});

test("an unreachable contract leaves the REST-derived events in place", async () => {
  const { metadata } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO, contractUrl: "https://example.invalid/project-metadata.json" },
    client: client(healthyRoutes()),
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
  });

  assert.equal(metadata.source, "github");
  assert.equal(metadata.generatedTimelineEvents.length, 1);
});

test("responses are cached so one run never asks the same question twice", async () => {
  const log = [];
  const routes = healthyRoutes();
  const cached = new GitHubClient({ fetchImpl: fakeFetch(routes, log), retries: 0 });

  await cached.repository(REPO);
  await cached.repository(REPO);
  await cached.languages(REPO);

  assert.equal(log.filter((url) => url.endsWith(`/repos/${REPO}`)).length, 1);
});

test("transient 5xx responses are retried, then succeed", async () => {
  let calls = 0;
  const flaky = new GitHubClient({
    retries: 3,
    retryDelayMs: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) {
        return new Response("{}", { status: 503 });
      }
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const repo = await flaky.repository(REPO);
  assert.equal(repo.default_branch, "main");
  assert.equal(calls, 3);
});

test("the commit count comes from the Link header without paging history", () => {
  assert.equal(
    parseLastPage('<https://api.github.com/repositories/1/commits?sha=main&per_page=1&page=398>; rel="last"'),
    398,
  );
  assert.equal(
    parseLastPage('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=398>; rel="last"'),
    398,
  );
  // A single-commit repository sends no Link header at all.
  assert.equal(parseLastPage(null), undefined);
  assert.equal(parseLastPage(""), undefined);
  assert.equal(parseLastPage('<https://api.github.com/x?page=2>; rel="next"'), undefined);
});

test("a one-commit repository counts its rows instead of guessing", async () => {
  const { metadata } = await collectProject({
    projectId: "keyquorum",
    source: { repo: REPO },
    client: client(healthyRoutes({ [`/repos/${REPO}/commits`]: { body: [{ sha: "only" }] } })),
  });
  assert.equal(metadata.commitCount, 1);
});
