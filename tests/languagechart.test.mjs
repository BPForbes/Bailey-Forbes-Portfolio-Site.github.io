/**
 * Pure geometry only — src/languageChart.ts keeps DOM construction in a
 * separate function precisely so the arc math can be checked without a
 * browser. See tests/runtime.test.mjs for why modules/ rather than js/.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { donutSegments } from "../modules/languageChart.js";

const CIRCUMFERENCE = 2 * Math.PI * 24;

test("donutSegments: empty input yields no segments", () => {
  assert.deepEqual(donutSegments([]), []);
});

test("donutSegments: preserves order, name, pct, and colour", () => {
  const langs = [
    { name: "Rust", pct: 60, color: "#dea584" },
    { name: "SQLite", pct: 40, color: "#003b57" },
  ];
  const segs = donutSegments(langs);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].name, "Rust");
  assert.equal(segs[0].pct, 60);
  assert.equal(segs[0].color, "#dea584");
  assert.equal(segs[1].name, "SQLite");
});

test("donutSegments: first segment starts at offset 0", () => {
  const [first] = donutSegments([{ name: "A", pct: 100, color: "#000" }]);
  assert.equal(first.dashoffset, -0);
});

test("donutSegments: each later segment's offset is the running total of pct before it", () => {
  const langs = [
    { name: "A", pct: 25, color: "#111" },
    { name: "B", pct: 50, color: "#222" },
    { name: "C", pct: 25, color: "#333" },
  ];
  const [a, b, c] = donutSegments(langs);
  assert.equal(a.dashoffset, -0);
  assert.ok(Math.abs(b.dashoffset - -(0.25 * CIRCUMFERENCE)) < 1e-9);
  assert.ok(Math.abs(c.dashoffset - -(0.75 * CIRCUMFERENCE)) < 1e-9);
});

test("donutSegments: dasharray's drawn length approximates its share of the circle, net of its own gap", () => {
  const [seg] = donutSegments([{ name: "Solo", pct: 50, color: "#fff" }]);
  const [drawn] = seg.dasharray.split(" ").map(Number);
  const expected = 0.5 * CIRCUMFERENCE;
  // The gap is capped at 30% of the segment's own length, so drawn length
  // is always within that band of the raw share — never negative, never
  // equal to the untouched raw share once a gap applies.
  assert.ok(drawn > expected * 0.69 && drawn <= expected, `${drawn} vs ${expected}`);
});

test("donutSegments: a single 100% language still draws almost a full ring, not a sliver", () => {
  const [seg] = donutSegments([{ name: "Solo", pct: 100, color: "#fff" }]);
  const [drawn] = seg.dasharray.split(" ").map(Number);
  // Gap capped at 30% of a full circle would be absurd; the fixed 1.6-unit
  // cap dominates here, so the drawn arc should be well over 95% of the circle.
  assert.ok(drawn / CIRCUMFERENCE > 0.95, `${drawn} / ${CIRCUMFERENCE}`);
});

test("donutSegments: many small languages never produce a negative dash length", () => {
  const langs = Array.from({ length: 6 }, (_, i) => ({
    name: `Lang${i}`,
    pct: 100 / 6,
    color: "#abc",
  }));
  for (const seg of donutSegments(langs)) {
    const [drawn] = seg.dasharray.split(" ").map(Number);
    assert.ok(drawn >= 0, `negative dash length: ${drawn}`);
  }
});
