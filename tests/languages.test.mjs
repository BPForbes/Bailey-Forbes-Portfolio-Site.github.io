import assert from "node:assert/strict";
import { test } from "node:test";

import { computeLanguageShares, roundTo, sharesSumToWhole } from "../scripts/lib/languages.mjs";

/**
 * Adding the printed tenths back up reintroduces binary-float error
 * (33.3 + 33.3 + 33.4 lands on 99.99999999999999), so the assertion rounds at
 * the same precision the values are printed at.
 */
function sum(shares) {
  return roundTo(shares.reduce((total, share) => total + share.pct, 0), 1);
}

test("byte totals become percentages that add up to exactly 100", () => {
  const shares = computeLanguageShares({
    TypeScript: 924_000,
    CSS: 61_000,
    JavaScript: 8_000,
    HTML: 7_000,
  });

  assert.equal(shares.length, 4);
  assert.deepEqual(
    shares.map((share) => share.name),
    ["TypeScript", "CSS", "JavaScript", "HTML"],
  );
  assert.equal(sum(shares), 100);
  assert.ok(sharesSumToWhole(shares));
});

test("raw byte counts survive alongside the percentage", () => {
  const shares = computeLanguageShares({ Rust: 2_000, SQL: 1_000 });
  assert.deepEqual(shares, [
    { name: "Rust", bytes: 2_000, pct: 66.7 },
    { name: "SQL", bytes: 1_000, pct: 33.3 },
  ]);
});

test("a single-language repository reads 100%", () => {
  const shares = computeLanguageShares({ Rust: 48_231 });
  assert.deepEqual(shares, [{ name: "Rust", bytes: 48_231, pct: 100 }]);
  assert.ok(sharesSumToWhole(shares));
});

test("thirds do not lose a tenth to rounding", () => {
  // Rounding each share alone gives 33.3 * 3 = 99.9 and a visible gap at the
  // end of the bar. Largest remainder hands the spare tenth to one of them.
  const shares = computeLanguageShares({ A: 1, B: 1, C: 1 });
  assert.equal(sum(shares), 100);
  assert.deepEqual(shares.map((share) => share.pct).sort(), [33.3, 33.3, 33.4]);
});

test("a language present in the repository never prints as 0.0%", () => {
  // Flinstone really does ship a 252-byte linker script against ~3.5MB of C.
  const shares = computeLanguageShares({ C: 3_500_000, "Linker Script": 252 });
  const linker = shares.find((share) => share.name === "Linker Script");
  assert.ok(linker);
  assert.equal(linker.pct, 0.1);
  assert.equal(sum(shares), 100);
});

test("adding a language recomputes every width", () => {
  const before = computeLanguageShares({ TypeScript: 900, CSS: 100 });
  const after = computeLanguageShares({ TypeScript: 900, CSS: 100, Python: 500 });

  assert.deepEqual(before.map((share) => share.name), ["TypeScript", "CSS"]);
  assert.deepEqual(after.map((share) => share.name), ["TypeScript", "Python", "CSS"]);
  assert.notEqual(before[0].pct, after[0].pct);
  assert.ok(sharesSumToWhole(after));
});

test("removing a language drops it and rebalances the rest", () => {
  const before = computeLanguageShares({ TypeScript: 900, CSS: 100, JavaScript: 50 });
  const after = computeLanguageShares({ TypeScript: 900, CSS: 100 });

  assert.ok(before.some((share) => share.name === "JavaScript"));
  assert.ok(!after.some((share) => share.name === "JavaScript"));
  assert.ok(sharesSumToWhole(after));
});

test("a twelve-language repository still totals 100", () => {
  const shares = computeLanguageShares({
    C: 2_792_382,
    Shell: 187_879,
    Python: 160_312,
    Assembly: 142_369,
    JavaScript: 141_218,
    Makefile: 74_680,
    "C++": 62_853,
    CSS: 13_588,
    CMake: 13_576,
    HTML: 6_538,
    Nix: 1_846,
    "Linker Script": 252,
  });

  assert.equal(shares.length, 12);
  assert.equal(sum(shares), 100);
  assert.equal(shares[0].name, "C");
  assert.ok(shares.every((share) => share.pct > 0));
});

test("malformed byte maps yield no data rather than zeroes", () => {
  assert.deepEqual(computeLanguageShares({}), []);
  assert.deepEqual(computeLanguageShares({ C: 0 }), []);
  assert.deepEqual(computeLanguageShares({ C: -5 }), []);
  assert.deepEqual(computeLanguageShares({ C: "nonsense" }), []);
  assert.deepEqual(computeLanguageShares(null), []);
  assert.deepEqual(computeLanguageShares([1, 2, 3]), []);
  assert.deepEqual(computeLanguageShares("not an object"), []);
});

test("garbage entries are skipped without discarding the good ones", () => {
  const shares = computeLanguageShares({ C: 1_000, Broken: Number.NaN, Empty: 0, Rust: 1_000 });
  assert.deepEqual(
    shares.map((share) => share.name),
    ["C", "Rust"],
  );
  assert.equal(sum(shares), 100);
});

test("ordering is deterministic when two languages tie", () => {
  const first = computeLanguageShares({ Zig: 100, Ada: 100 });
  const second = computeLanguageShares({ Ada: 100, Zig: 100 });
  assert.deepEqual(first, second);
});

test("sharesSumToWhole rejects an empty or skewed set", () => {
  assert.equal(sharesSumToWhole([]), false);
  assert.equal(sharesSumToWhole([{ name: "C", bytes: 1, pct: 80 }]), false);
  assert.equal(sharesSumToWhole([{ name: "C", bytes: 1, pct: 100 }]), true);
});

test("roundTo does not drift on the classic float cases", () => {
  assert.equal(roundTo(1.005, 2), 1.01);
  assert.equal(roundTo(92.35, 1), 92.4);
  assert.equal(roundTo(0.1 + 0.2, 1), 0.3);
});
