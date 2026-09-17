/**
 * The browser-side merge layer, exercised through the compiled output in js/.
 *
 * These run against what tsc actually emits rather than a re-implementation, so
 * `npm test` builds first (see the `pretest` script). Nothing here touches the
 * DOM — src/projectMetadata.ts is deliberately free of it, which is what makes
 * the merge rules testable at all.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { PORTFOLIO } from "../js/data.js";
import { GENERATED_PROJECT_METADATA } from "../js/generated/projectMetadata.js";
import { hasCuratedColor, languageColor } from "../js/languageColors.js";
import {
  commitCountFor,
  languagesFor,
  mergedPullRequestsFor,
  repositoryMetadata,
  timelineEvents,
  versionFor,
} from "../js/projectMetadata.js";

test("curated language colours are preserved exactly", () => {
  assert.equal(languageColor("TypeScript"), "#3178c6");
  assert.equal(languageColor("CSS"), "#c98a4a");
  assert.equal(languageColor("JavaScript"), "#f1e05a");
  assert.equal(languageColor("HTML"), "#e34c26");
  assert.equal(languageColor("C"), "#555555");
  assert.equal(languageColor("Rust"), "#dea584");
  assert.equal(languageColor("Kotlin"), "#A97BFF");
  assert.equal(languageColor("Firebase / REST"), "#FFA000");
});

test("an unknown language gets a deterministic fallback rather than breaking", () => {
  const first = languageColor("Brainfuck");
  assert.match(first, /^#[0-9a-f]{6}$/i);
  assert.equal(languageColor("Brainfuck"), first, "must be stable across calls");
  assert.equal(hasCuratedColor("Brainfuck"), false);

  // The fallback palette is small and deliberately so, which means two unknown
  // languages can share a swatch. What matters is that the hash spreads across
  // the palette rather than parking every unknown on one colour.
  const spread = new Set(
    ["Jupyter Notebook", "Zephyr", "Nim", "Crystal", "Elixir", "Haskell", "OCaml", "Raku", "Ada", "Prolog"]
      .map(languageColor),
  );
  assert.ok(spread.size >= 4, `expected a spread of fallback colours, got ${spread.size}`);

  // Edge inputs still return a usable colour.
  assert.match(languageColor(""), /^#[0-9a-f]{6}$/i);
});

test("every language in the generated snapshot resolves to a colour", () => {
  for (const metadata of Object.values(GENERATED_PROJECT_METADATA.projects)) {
    for (const language of metadata.languages) {
      assert.match(
        languageColor(language.name),
        /^#[0-9a-f]{6}$/i,
        `${language.name} must resolve`,
      );
    }
  }
});

test("a project with a repository renders generated languages", () => {
  const languages = languagesFor("flinstone");
  assert.ok(languages && languages.length > 0);
  assert.ok(languages.every((language) => typeof language.color === "string"));
  assert.ok(
    Math.abs(languages.reduce((sum, language) => sum + language.pct, 0) - 100) < 0.05,
    "the rendered bar must still fill its track",
  );
});

test("a project without a repository keeps its curated split", () => {
  // The EMR client tree is private; its page says the split is an estimate.
  assert.equal(repositoryMetadata("emr"), undefined);
  assert.deepEqual(languagesFor("emr"), PORTFOLIO.languages.emr);
  assert.equal(versionFor("emr"), undefined);
  assert.equal(commitCountFor("emr"), undefined);
  assert.equal(mergedPullRequestsFor("emr"), undefined);
});

test("a single-language repository renders one full-width segment", () => {
  const languages = languagesFor("keyquorum");
  assert.equal(languages.length, 1);
  assert.equal(languages[0].name, "Rust");
  assert.equal(languages[0].pct, 100);
});

test("repository facts are exposed for the page hooks", () => {
  assert.equal(typeof commitCountFor("flinstone"), "number");
  assert.ok(commitCountFor("flinstone") > 0);
  assert.equal(typeof mergedPullRequestsFor("homework-central"), "number");
  assert.equal(versionFor("flinstone"), GENERATED_PROJECT_METADATA.projects.flinstone.latestVersion);
});

test("every curated event survives the merge", () => {
  const merged = timelineEvents();
  for (const curated of PORTFOLIO.events) {
    assert.ok(
      merged.some(
        (event) =>
          event.date === curated.date &&
          event.title === curated.title &&
          event.project === curated.project &&
          event.detail === curated.detail,
      ),
      `curated event lost: ${curated.date} ${curated.title}`,
    );
  }
});

test("the merge introduces no duplicate entries", () => {
  const merged = timelineEvents();
  const keys = merged.map(
    (event) => `${event.project}|${event.date}|${event.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`,
  );
  assert.equal(new Set(keys).size, keys.length, "a milestone appears twice");
});

test("generated events never backfill a period already written by hand", () => {
  const curatedNewest = new Map();
  for (const event of PORTFOLIO.events) {
    const seen = curatedNewest.get(event.project);
    if (seen === undefined || event.date > seen) {
      curatedNewest.set(event.project, event.date);
    }
  }

  const curatedKeys = new Set(
    PORTFOLIO.events.map((event) => `${event.project}|${event.date}|${event.title}`),
  );

  for (const event of timelineEvents()) {
    if (curatedKeys.has(`${event.project}|${event.date}|${event.title}`)) {
      continue;
    }
    const cutoff = curatedNewest.get(event.project);
    assert.ok(
      cutoff === undefined || event.date > cutoff,
      `generated event ${event.date} "${event.title}" falls inside curated coverage (through ${cutoff})`,
    );
  }
});

test("every merged event is renderable by the timeline", () => {
  for (const event of timelineEvents()) {
    assert.match(event.date, /^\d{4}-\d{2}(-\d{2})?$/);
    assert.ok(event.kind === "feature" || event.kind === "release");
    assert.ok(typeof event.title === "string" && event.title.trim() !== "");
    assert.ok(typeof event.detail === "string" && event.detail.trim() !== "");
    assert.ok(Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, event.project));
    if (event.href !== undefined) {
      assert.match(event.href, /^https:\/\/github\.com\//);
    }
  }
});

test("the generated snapshot only describes published portfolio projects", () => {
  for (const projectId of Object.keys(GENERATED_PROJECT_METADATA.projects)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(PORTFOLIO.projects, projectId),
      `${projectId} is not a published project`,
    );
  }
});
