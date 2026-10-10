/**
 * Agent instruction files must refer to each other, in both directions.
 *
 * The set is every AGENTS.md and CLAUDE.md in the tree, plus DESIGN.md and
 * docs/agents/*.md. A reference is a relative markdown link, or an `@path`
 * import line (how CLAUDE.md pulls in its AGENTS.md). If file A refers to file
 * B, B must refer back to A, every target must exist, every AGENTS.md must have
 * a CLAUDE.md that imports it, and no file in the set may stand alone.
 *
 * The "Related instruction files" sections are generated from one edge list.
 * When this test fails, add or remove the reference on the other side too.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SKIP = new Set(["node_modules", ".git", ".claude", ".wrangler"]);

function walk(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, found);
    else if (entry === "AGENTS.md" || entry === "CLAUDE.md") found.push(full);
  }
  return found;
}

const toRepoPath = (abs) => relative(REPO, abs).split("\\").join("/");

const instructionFiles = [
  ...walk(REPO),
  join(REPO, "DESIGN.md"),
  ...readdirSync(join(REPO, "docs/agents"))
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(REPO, "docs/agents", name)),
].map(toRepoPath).sort();

const SET = new Set(instructionFiles);

/** Repo-relative paths of every instruction file this file refers to. */
function referencesFrom(repoPath) {
  const source = readFileSync(join(REPO, repoPath), "utf8");
  const dir = dirname(join(REPO, repoPath));
  const out = new Set();
  for (const match of source.matchAll(/\]\(([^)\s#]+\.md)(#[^)]*)?\)/g)) {
    const target = match[1];
    if (/^[a-z]+:/i.test(target)) continue;
    out.add(toRepoPath(normalize(join(dir, target))));
  }
  for (const line of source.split("\n")) {
    const imported = /^@(\S+\.md)\s*$/.exec(line.trim());
    if (imported) out.add(toRepoPath(normalize(join(dir, imported[1]))));
  }
  return [...out];
}

const references = new Map(instructionFiles.map((file) => [file, referencesFrom(file)]));

test("every reference from an instruction file resolves to a file", () => {
  const broken = [];
  for (const [file, targets] of references) {
    for (const target of targets) {
      if (!existsSync(join(REPO, target))) broken.push(`${file} -> ${target}`);
    }
  }
  assert.deepEqual(broken, [], "broken references");
});

test("references between instruction files are reciprocal", () => {
  const oneWay = [];
  for (const [file, targets] of references) {
    for (const target of targets) {
      if (!SET.has(target)) continue;
      if (!references.get(target).includes(file)) oneWay.push(`${file} -> ${target} (no way back)`);
    }
  }
  assert.deepEqual(oneWay, [], "one-way references");
});

test("every AGENTS.md has a CLAUDE.md beside it that imports it", () => {
  const missing = [];
  for (const file of instructionFiles.filter((f) => f.endsWith("AGENTS.md"))) {
    const claudePath = join(dirname(file), "CLAUDE.md").split("\\").join("/");
    if (!SET.has(claudePath)) {
      missing.push(`${file}: no ${claudePath}`);
      continue;
    }
    const source = readFileSync(join(REPO, claudePath), "utf8");
    if (!/^@AGENTS\.md\s*$/m.test(source)) missing.push(`${claudePath} does not import AGENTS.md`);
  }
  assert.deepEqual(missing, [], "missing or unlinked Claude Code entry points");
});

test("no instruction file stands alone", () => {
  const orphans = instructionFiles.filter((file) => {
    const outbound = references.get(file).filter((target) => SET.has(target) && target !== file);
    return outbound.length === 0;
  });
  assert.deepEqual(orphans, [], "instruction files with no reference to another");
});
