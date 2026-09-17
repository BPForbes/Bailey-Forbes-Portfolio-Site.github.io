import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cleanTitle,
  dedupeEvents,
  eventFromPullRequest,
  eventFromRelease,
  isSignificantTitle,
  isValidDate,
  orderEvents,
  summarize,
} from "../scripts/lib/timeline.mjs";

test("portfolio-worthy work is recognised", () => {
  for (const title of [
    "feat(lab): Emscripten Flinstone Shell sandbox and relay identity fixes",
    "release: 4.5.0 freestanding boot boundary",
    "perf: cut synthetic training LLM round-trips",
    "security: refuse known default passwords",
    "Add Axum mailbox relay with API keys and Swagger",
    "Introduce recursive M-of-N key trees",
    "refactor(core)!: replace the driver ABI",
  ]) {
    assert.equal(isSignificantTitle(title), true, `expected significant: ${title}`);
  }
});

test("routine noise is excluded", () => {
  for (const title of [
    "chore(deps): bump serde from 1.0.1 to 1.0.2",
    "Bump actions/checkout from 4 to 5",
    "docs: update README",
    "Fix typo in comment",
    "style: reformat with prettier",
    "Merge branch 'develop' into main",
    "Merge pull request #12 from BPForbes/feature",
    "Revert \"Add Axum mailbox relay\"",
    "ci: retry flaky job",
    "test: add missing coverage",
    "WIP: still thinking",
    "Update README",
    "📝 CodeRabbit Chat: Implement requested code changes",
  ]) {
    assert.equal(isSignificantTitle(title), false, `expected noise: ${title}`);
  }
});

test("a repair is not a milestone even when it name-drops architecture", () => {
  // Real Homework-Central PR title. "migration" used to make this qualify.
  assert.equal(
    isSignificantTitle("Fix AddAITracking migration SQL Server types breaking CI"),
    false,
  );
});

test("a dependency chore cannot qualify on the word 'feature'", () => {
  assert.equal(isSignificantTitle("chore(deps): bump feature-flags from 1 to 2"), false);
});

test("bot authors are dropped regardless of title", () => {
  assert.equal(isSignificantTitle("Add automated update", { author: "dependabot[bot]" }), false);
  assert.equal(isSignificantTitle("Add automated update", { author: "github-actions[bot]" }), false);
  assert.equal(isSignificantTitle("Add automated update", { author: "BPForbes" }), true);
});

test("empty and non-string titles are not significant", () => {
  for (const value of ["", "   ", null, undefined, 42, {}]) {
    assert.equal(isSignificantTitle(value), false);
  }
});

test("conventional prefixes are stripped for display", () => {
  assert.equal(cleanTitle("feat(lab): Emscripten shell"), "Emscripten shell");
  assert.equal(cleanTitle("release: 4.5.0 boot boundary"), "4.5.0 boot boundary");
  assert.equal(cleanTitle("Add keyquorum CLI binary"), "Add keyquorum CLI binary");
  // A title that is nothing but a prefix keeps its original text.
  assert.equal(cleanTitle("feat:"), "Feat:");
});

test("a merged pull request becomes a dated, linked event", () => {
  const event = eventFromPullRequest(
    {
      number: 359,
      title: "feat(lab): Emscripten Flinstone Shell sandbox",
      merged_at: "2026-09-15T17:45:54Z",
      html_url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/pull/359",
      user: { login: "BPForbes" },
      body: "Boots a sandboxed Emscripten shell as the default lab.\n\n- [ ] checklist",
    },
    "flinstone",
    "BPForbes/Bailey-Forbes-Flinstone",
  );

  assert.equal(event.date, "2026-09-15");
  assert.equal(event.kind, "feature");
  assert.equal(event.project, "flinstone");
  assert.equal(event.title, "Emscripten Flinstone Shell sandbox");
  assert.equal(event.detail, "Boots a sandboxed Emscripten shell as the default lab.");
  assert.equal(event.identity, "pr:BPForbes/Bailey-Forbes-Flinstone#359");
});

test("an unmerged or malformed pull request produces nothing", () => {
  const repo = "BPForbes/KeyQuorum";
  assert.equal(eventFromPullRequest({ number: 1, title: "Add a thing", merged_at: null }, "keyquorum", repo), undefined);
  assert.equal(eventFromPullRequest({ number: 1, title: "Add a thing" }, "keyquorum", repo), undefined);
  assert.equal(eventFromPullRequest({ title: "Add a thing", merged_at: "2026-01-01T00:00:00Z" }, "keyquorum", repo), undefined);
  assert.equal(eventFromPullRequest({ number: 1, title: "Add it", merged_at: "not-a-date" }, "keyquorum", repo), undefined);
  assert.equal(eventFromPullRequest(null, "keyquorum", repo), undefined);
  assert.equal(eventFromPullRequest("nonsense", "keyquorum", repo), undefined);
});

test("a published release becomes a release event", () => {
  const event = eventFromRelease(
    {
      tag_name: "v4.5.4",
      name: "Flintstone Kernel v4.5.4",
      published_at: "2026-09-15T00:00:00Z",
      html_url: "https://github.com/o/r/releases/tag/v4.5.4",
      body: "Shared relay room and Emscripten shell.",
    },
    "flinstone",
    "o/r",
  );
  assert.equal(event.kind, "release");
  assert.equal(event.identity, "release:o/r@v4.5.4");
  assert.equal(event.detail, "Shared relay room and Emscripten shell.");
});

test("draft and tagless releases produce nothing", () => {
  assert.equal(eventFromRelease({ tag_name: "v1.0.0", draft: true, published_at: "2026-01-01T00:00:00Z" }, "qpu", "o/r"), undefined);
  assert.equal(eventFromRelease({ tag_name: "", published_at: "2026-01-01T00:00:00Z" }, "qpu", "o/r"), undefined);
  assert.equal(eventFromRelease({ tag_name: "v1.0.0", published_at: null }, "qpu", "o/r"), undefined);
  assert.equal(eventFromRelease(null, "qpu", "o/r"), undefined);
});

test("the same event is never added twice", () => {
  const base = { date: "2026-09-15", kind: "feature", project: "flinstone", detail: "d" };
  const deduped = dedupeEvents([
    { ...base, title: "Emscripten shell", identity: "pr:o/r#1" },
    { ...base, title: "Emscripten shell", identity: "pr:o/r#1" },
    // Same day, same milestone, different wording and source.
    { ...base, title: "feat(lab): Emscripten shell", identity: "release:o/r@v4.5.4" },
    { ...base, title: "Something else entirely", identity: "pr:o/r#2" },
  ]);

  assert.equal(deduped.length, 2);
  assert.deepEqual(deduped.map((event) => event.identity), ["pr:o/r#1", "pr:o/r#2"]);
});

test("events order newest first and cap deterministically", () => {
  const make = (date, id) => ({ date, kind: "feature", project: "qpu", title: id, detail: "d", identity: id });
  const ordered = orderEvents([make("2026-01-01", "a"), make("2026-03-01", "c"), make("2026-02-01", "b")], 2);
  assert.deepEqual(ordered.map((event) => event.date), ["2026-03-01", "2026-02-01"]);

  // Same input in a different order must produce the same output.
  const shuffled = orderEvents([make("2026-02-01", "b"), make("2026-01-01", "a"), make("2026-03-01", "c")], 2);
  assert.deepEqual(ordered, shuffled);
});

test("dates must be real calendar days", () => {
  assert.equal(isValidDate("2026-09-15"), true);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("2026-09"), false);
  assert.equal(isValidDate("not a date"), false);
  assert.equal(isValidDate(undefined), false);
});

test("a pull request body is reduced to its first real paragraph", () => {
  assert.equal(summarize("## Summary\n\nAdds the thing.\n\nMore detail."), "Adds the thing.");
  assert.equal(summarize("<!-- template -->\nReal prose here."), "Real prose here.");
  assert.equal(summarize("- [ ] task\n- [x] done\n\nActual prose."), "Actual prose.");
  assert.equal(summarize(""), "");
  assert.equal(summarize("```\ncode\n```"), "");
  assert.equal(summarize(undefined), "");
  assert.ok(summarize("word ".repeat(200)).length <= 321);
});
