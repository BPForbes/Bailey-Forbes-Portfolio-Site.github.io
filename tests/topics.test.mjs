/**
 * Topic labels and the filter's pure logic, plus the markup that uses them.
 *
 * The filter matches what a visitor reads: an item's topics are its
 * `.chip[data-topic]` elements. So the pages are checked here too. Every
 * data-topic must be a known id, its chip must say exactly that topic's label,
 * and every filterable item must carry at least one topic.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  TOPICS,
  TOPIC_KIND_LABELS,
  matchesSelection,
  parseTopicsParam,
  serializeTopics,
  topicById,
} from "../modules/topics.js";

const PAGES = ["home/index.html", "projects/index.html"];
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("topic ids and labels are unique, and every kind has a label", () => {
  const ids = TOPICS.map((topic) => topic.id);
  const labels = TOPICS.map((topic) => topic.label);
  assert.equal(new Set(ids).size, ids.length, "duplicate id");
  assert.equal(new Set(labels).size, labels.length, "duplicate label");
  for (const topic of TOPICS) {
    assert.match(topic.id, /^[a-z0-9-]+$/, `${topic.id} is not a slug`);
    assert.ok(TOPIC_KIND_LABELS[topic.kind], `${topic.id} has an unknown kind`);
  }
});

test("matching is OR across the selection, and nothing selected matches everything", () => {
  assert.equal(matchesSelection(["rust"], new Set()), true);
  assert.equal(matchesSelection([], new Set()), true);
  assert.equal(matchesSelection(["rust", "sqlite"], new Set(["sqlite"])), true);
  assert.equal(matchesSelection(["rust"], new Set(["typescript", "rust"])), true);
  assert.equal(matchesSelection(["c"], new Set(["rust"])), false);
  assert.equal(matchesSelection([], new Set(["rust"])), false);
});

test("the URL parameter keeps known ids only, in canonical order, once each", () => {
  assert.deepEqual(parseTopicsParam(""), []);
  assert.deepEqual(parseTopicsParam("?topics="), []);
  assert.deepEqual(parseTopicsParam("?topics=rust"), ["rust"]);
  assert.deepEqual(parseTopicsParam("?topics=cloudflare,Rust,rust,nonsense"), ["rust", "cloudflare"]);
  assert.deepEqual(parseTopicsParam("?other=1&topics=%20security%20"), ["security"]);
  const roundTrip = new Set(["security", "c", "cloudflare"]);
  assert.equal(serializeTopics(roundTrip), "c,cloudflare,security");
  assert.deepEqual(parseTopicsParam(`?topics=${serializeTopics(roundTrip)}`), ["c", "cloudflare", "security"]);
  assert.equal(serializeTopics(new Set()), "");
});

for (const page of PAGES) {
  test(`${page}: every topic chip is a known topic and says its label`, () => {
    const html = read(page);
    const chips = [...html.matchAll(/<span class="chip" data-topic="([^"]+)">([^<]*)<\/span>/g)];
    assert.ok(chips.length > 0, "no topic chips found");
    const stray = [...html.matchAll(/data-topic="([^"]+)"/g)].length - chips.length;
    assert.equal(stray, 0, "a data-topic is used on something other than a plain chip");
    for (const [, id, text] of chips) {
      const topic = topicById(id);
      assert.ok(topic, `unknown topic id "${id}"`);
      assert.equal(text, topic.label, `chip for "${id}" says "${text}"`);
    }
  });

  test(`${page}: every filter item carries at least one topic, and the control is hidden without script`, () => {
    const html = read(page);
    const items = html.split(/(?=<(?:article|li)\b[^>]*\bdata-filter-item\b)/).slice(1);
    assert.ok(items.length > 0, "no filter items");
    for (const item of items) {
      // Close on the item's own tag: a role entry holds <li> bullets of its own.
      const tag = /^<(article|li)\b/.exec(item)[1];
      const body = item.slice(0, item.indexOf(`</${tag}>`, tag === "li" ? item.indexOf("</a>") : 0));
      assert.match(body, /data-topic="/, `filter item without a topic: ${body.slice(0, 120)}`);
    }
    assert.match(html, /data-topic-filter[^>]*\bhidden\b/, "the filter control must start hidden");
  });
}

test("every topic is used somewhere on the site", () => {
  const html = PAGES.map(read).join("\n");
  const unused = TOPICS.filter((topic) => !html.includes(`data-topic="${topic.id}"`)).map((t) => t.id);
  assert.deepEqual(unused, [], "topics defined but never tagged");
});
