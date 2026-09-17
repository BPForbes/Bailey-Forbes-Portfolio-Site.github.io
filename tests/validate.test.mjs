import assert from "node:assert/strict";
import { test } from "node:test";

import { hasMeaningfulChange, normalizeDocument, renderJson, renderTypeScript } from "../scripts/lib/emit.mjs";
import { isGitHubUrl, validateDocument } from "../scripts/lib/validate.mjs";
import { PORTFOLIO_PROJECT_IDS } from "../scripts/project-sources.mjs";

const CONTEXT = { knownProjectIds: PORTFOLIO_PROJECT_IDS };

function project(overrides = {}) {
  return {
    repository: "BPForbes/KeyQuorum",
    repositoryUrl: "https://github.com/BPForbes/KeyQuorum",
    owner: "BPForbes",
    name: "KeyQuorum",
    defaultBranch: "main",
    commitCount: 24,
    mergedPullRequestCount: 14,
    pullRequestCount: 21,
    languages: [{ name: "Rust", bytes: 48_231, pct: 100 }],
    generatedTimelineEvents: [],
    source: "github",
    fetchedAt: "2026-09-17T00:00:00Z",
    ...overrides,
  };
}

function document(projects) {
  return { schemaVersion: 1, generatedAt: "2026-09-17T00:00:00Z", projects };
}

test("a well-formed document passes", () => {
  assert.deepEqual(validateDocument(document({ keyquorum: project() }), CONTEXT), []);
});

test("an unknown project id is rejected", () => {
  const problems = validateDocument(document({ "not-a-project": project() }), CONTEXT);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /not a published portfolio project/);
});

test("a zero commit count on a live fetch is refused", () => {
  const problems = validateDocument(document({ keyquorum: project({ commitCount: 0 }) }), CONTEXT);
  assert.ok(problems.some((problem) => /refusing to publish an empty count/.test(problem)));
});

test("a zero commit count is tolerated on a snapshot that is explicitly stale", () => {
  // A carried-over entry is allowed to say whatever it said last time; what
  // must never happen is a *fresh* zero replacing a real number.
  const problems = validateDocument(
    document({ keyquorum: project({ commitCount: 0, stale: true }) }),
    CONTEXT,
  );
  assert.deepEqual(problems, []);
});

test("negative and non-integer counts are rejected", () => {
  for (const field of ["commitCount", "mergedPullRequestCount", "pullRequestCount"]) {
    const problems = validateDocument(document({ keyquorum: project({ [field]: -1 }) }), CONTEXT);
    assert.ok(problems.some((problem) => problem.includes(field)), `${field} should be rejected`);
    const fractional = validateDocument(document({ keyquorum: project({ [field]: 1.5 }) }), CONTEXT);
    assert.ok(fractional.some((problem) => problem.includes(field)));
  }
});

test("percentages that do not add up to 100 are rejected", () => {
  const problems = validateDocument(
    document({
      keyquorum: project({
        languages: [
          { name: "Rust", bytes: 10, pct: 50 },
          { name: "SQL", bytes: 10, pct: 30 },
        ],
      }),
    }),
    CONTEXT,
  );
  assert.ok(problems.some((problem) => /sum to 80/.test(problem)));
});

test("negative bytes or percentages are rejected", () => {
  const negativeBytes = validateDocument(
    document({ keyquorum: project({ languages: [{ name: "Rust", bytes: -1, pct: 100 }] }) }),
    CONTEXT,
  );
  assert.ok(negativeBytes.some((problem) => /bytes/.test(problem)));

  const negativePct = validateDocument(
    document({ keyquorum: project({ languages: [{ name: "Rust", bytes: 1, pct: -5 }] }) }),
    CONTEXT,
  );
  assert.ok(negativePct.some((problem) => /pct/.test(problem)));
});

test("a duplicated language is rejected", () => {
  const problems = validateDocument(
    document({
      keyquorum: project({
        languages: [
          { name: "Rust", bytes: 10, pct: 50 },
          { name: "Rust", bytes: 10, pct: 50 },
        ],
      }),
    }),
    CONTEXT,
  );
  assert.ok(problems.some((problem) => /appears twice/.test(problem)));
});

test("non-GitHub URLs are rejected wherever they appear", () => {
  assert.ok(
    validateDocument(
      document({ keyquorum: project({ repositoryUrl: "https://evil.example/BPForbes/KeyQuorum" }) }),
      CONTEXT,
    ).some((problem) => /repositoryUrl/.test(problem)),
  );

  assert.ok(
    validateDocument(
      document({
        keyquorum: project({
          generatedTimelineEvents: [
            {
              date: "2026-09-01",
              kind: "feature",
              project: "keyquorum",
              title: "Add a relay",
              detail: "d",
              href: "javascript:alert(1)",
              identity: "pr:o/r#1",
            },
          ],
        }),
      }),
      CONTEXT,
    ).some((problem) => /href/.test(problem)),
  );
});

test("timeline dates must parse and identities must be unique", () => {
  const event = (overrides) => ({
    date: "2026-09-01",
    kind: "feature",
    project: "keyquorum",
    title: "Add a relay",
    detail: "d",
    identity: "pr:o/r#1",
    ...overrides,
  });

  assert.ok(
    validateDocument(
      document({ keyquorum: project({ generatedTimelineEvents: [event({ date: "2026-02-30" })] }) }),
      CONTEXT,
    ).some((problem) => /does not parse/.test(problem)),
  );

  assert.ok(
    validateDocument(
      document({ keyquorum: project({ generatedTimelineEvents: [event(), event()] }) }),
      CONTEXT,
    ).some((problem) => /duplicated/.test(problem)),
  );

  assert.ok(
    validateDocument(
      document({ keyquorum: project({ generatedTimelineEvents: [event({ kind: "banana" })] }) }),
      CONTEXT,
    ).some((problem) => /not feature or release/.test(problem)),
  );

  assert.ok(
    validateDocument(
      document({ keyquorum: project({ generatedTimelineEvents: [event({ project: "qpu" })] }) }),
      CONTEXT,
    ).some((problem) => /does not match keyquorum/.test(problem)),
  );
});

test("isGitHubUrl accepts only https github.com", () => {
  assert.equal(isGitHubUrl("https://github.com/o/r"), true);
  assert.equal(isGitHubUrl("http://github.com/o/r"), false);
  assert.equal(isGitHubUrl("https://github.com.evil.test/o/r"), false);
  assert.equal(isGitHubUrl("https://bpforbes.github.io/x"), false);
  assert.equal(isGitHubUrl("not a url"), false);
  assert.equal(isGitHubUrl(undefined), false);
});

test("a run that changes nothing produces no commit", () => {
  const before = document({ keyquorum: project() });
  const json = renderJson(before);

  // Same facts, later run: only the timestamps moved.
  const after = {
    ...before,
    generatedAt: "2026-09-18T00:00:00Z",
    projects: { keyquorum: project({ fetchedAt: "2026-09-18T00:00:00Z" }) },
  };
  assert.equal(hasMeaningfulChange(json, after), false);

  // A real change is detected.
  const moved = { ...after, projects: { keyquorum: project({ commitCount: 25 }) } };
  assert.equal(hasMeaningfulChange(json, moved), true);

  // A first run, or an unreadable previous file, always writes.
  assert.equal(hasMeaningfulChange(undefined, before), true);
  assert.equal(hasMeaningfulChange("{not json", before), true);
});

test("an outage changes the published snapshot in no way at all", () => {
  // The single most important property: a day when GitHub is unreachable must
  // produce no diff, so no commit and no redeploy. The previous facts are
  // carried forward and the failure lives in the run log, not the artefact.
  const healthy = document({ keyquorum: project() });
  const json = renderJson(healthy);

  const outage = document({
    keyquorum: project({
      stale: true,
      lastError: "GitHub responded 503 for https://api.github.com/repos/BPForbes/KeyQuorum",
    }),
  });

  assert.equal(hasMeaningfulChange(json, outage), false);
  // And the markers never reach disk, so a later recovery cannot leave a
  // "stale" behind on a project that is no longer stale.
  assert.equal(renderJson(outage), json);
  assert.ok(!renderJson(outage).includes("lastError"));
  assert.ok(!renderJson(outage).includes("503"));
});

test("generated output is deterministic and carries the do-not-edit header", () => {
  const doc = document({ qpu: project(), keyquorum: project() });
  const ts = renderTypeScript(doc);

  assert.match(ts, /AUTO-GENERATED FILE\./);
  assert.match(ts, /DO NOT EDIT BY HAND\./);
  assert.match(ts, /scripts\/sync-project-metadata\.mjs/);
  assert.match(ts, /GeneratedProjectMetadata/);
  assert.equal(renderTypeScript(doc), ts);

  // Project keys are sorted, so a reordered input still produces one diff-free file.
  const reordered = document({ keyquorum: project(), qpu: project() });
  assert.equal(renderJson(reordered), renderJson(doc));
  assert.deepEqual(Object.keys(normalizeDocument(doc).projects), ["keyquorum", "qpu"]);
});
