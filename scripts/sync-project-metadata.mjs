#!/usr/bin/env node
/**
 * Refresh the portfolio's GitHub-derived project metadata.
 *
 *   node scripts/sync-project-metadata.mjs [--check] [--project <id>] [--max-timeline <n>]
 *                                          [--skip-contract] [--quiet]
 *
 *   --check          Report whether the generated files would change, write
 *                    nothing, exit 1 if they would. For CI drift checks.
 *   --project        Sync one project only; repeatable.
 *   --max-timeline   Generated timeline entries kept per project (default 12).
 *   --skip-contract  Ignore published project-metadata.json contracts and
 *                    derive everything from the REST API.
 *
 * Authentication comes from GITHUB_TOKEN or PORTFOLIO_GITHUB_TOKEN. Both are
 * optional — every repository here is public, so an unauthenticated run works,
 * just against a 60-request/hour budget. Tokens are only ever sent as request
 * headers and never reach generated output, logs, or the browser.
 *
 * Exit codes: 0 success (with or without changes), 1 validation failure or
 * --check drift, 2 one or more repositories could not be fetched AND had no
 * previous snapshot to fall back to.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PORTFOLIO_PROJECT_IDS, PROJECT_SOURCES } from "./project-sources.mjs";
import { collectProject } from "./lib/collect.mjs";
import { hasMeaningfulChange, renderJson, renderTypeScript } from "./lib/emit.mjs";
import { GitHubClient } from "./lib/github.mjs";
import { validateDocument } from "./lib/validate.mjs";

const SCHEMA_VERSION = 1;
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const JSON_PATH = resolve(ROOT, "data/project-metadata.json");
const TS_PATH = resolve(ROOT, "src/generated/projectMetadata.ts");

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ check: boolean, projects: string[], maxTimeline: number, skipContract: boolean, quiet: boolean }} */
  const args = { check: false, projects: [], maxTimeline: 12, skipContract: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") args.check = true;
    else if (arg === "--skip-contract") args.skipContract = true;
    else if (arg === "--quiet") args.quiet = true;
    else if (arg === "--project") args.projects.push(String(argv[++index]));
    else if (arg === "--max-timeline") args.maxTimeline = Number(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]}*/\n`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!Number.isInteger(args.maxTimeline) || args.maxTimeline < 0) {
    throw new Error("--max-timeline must be a non-negative integer");
  }
  return args;
}

/** @param {string} path */
function readIfPresent(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = args.quiet ? () => {} : (/** @type {string} */ message) => process.stdout.write(`${message}\n`);

  const token = process.env.PORTFOLIO_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  log(token ? "Authenticated GitHub requests." : "Unauthenticated GitHub requests (60/hour).");

  const previousJson = readIfPresent(JSON_PATH);
  /** @type {Record<string, import("./lib/types.mjs").RepositoryMetadata>} */
  let previousProjects = {};
  if (previousJson !== undefined) {
    try {
      previousProjects = JSON.parse(previousJson).projects ?? {};
    } catch {
      log("! data/project-metadata.json is unreadable; treating this as a first run.");
    }
  }

  const selected = Object.entries(PROJECT_SOURCES).filter(
    ([projectId]) => args.projects.length === 0 || args.projects.includes(projectId),
  );
  if (selected.length === 0) {
    throw new Error(`No project sources matched ${args.projects.join(", ")}`);
  }

  const client = new GitHubClient({ token });
  /** @type {Record<string, import("./lib/types.mjs").RepositoryMetadata>} */
  const projects = {};
  /** @type {string[]} */
  const unrecoverable = [];
  let degraded = 0;

  for (const [projectId, source] of selected) {
    if (!PORTFOLIO_PROJECT_IDS.includes(projectId)) {
      throw new Error(
        `PROJECT_SOURCES has "${projectId}", which is not a published portfolio project`,
      );
    }
    log(`- ${projectId} <- ${source.repo}`);
    try {
      const { metadata, error } = await collectProject({
        projectId,
        source,
        client,
        maxTimeline: args.maxTimeline,
        skipContract: args.skipContract,
        log,
        ...(previousProjects[projectId] ? { previous: previousProjects[projectId] } : {}),
      });
      projects[projectId] = metadata;
      if (error) degraded += 1;
      else {
        log(
          `    ${metadata.commitCount} commits · ${metadata.languages.length} languages · ` +
            `${metadata.mergedPullRequestCount} merged PRs · ` +
            `version ${metadata.latestVersion ?? "(curated)"} · via ${metadata.source}`,
        );
      }
    } catch (error) {
      unrecoverable.push(projectId);
      log(`    ! ${projectId} has no usable data and will fall back to curated values`);
    }
  }

  // Projects not selected this run keep whatever the snapshot already had, so
  // `--project qpu` cannot wipe the others.
  for (const [projectId, metadata] of Object.entries(previousProjects)) {
    if (!(projectId in projects)) {
      projects[projectId] = metadata;
    }
  }

  /** @type {import("./lib/types.mjs").ProjectMetadataDocument} */
  const document = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    projects,
  };

  const problems = validateDocument(document, { knownProjectIds: PORTFOLIO_PROJECT_IDS });
  if (problems.length > 0) {
    process.stderr.write("Refusing to write invalid metadata:\n");
    for (const problem of problems) {
      process.stderr.write(`  - ${problem}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const changed = hasMeaningfulChange(previousJson, document);

  if (args.check) {
    log(changed ? "Generated metadata is out of date." : "Generated metadata is up to date.");
    process.exitCode = changed ? 1 : 0;
    return;
  }

  if (!changed) {
    log("No repository facts changed; leaving generated files untouched.");
  } else {
    mkdirSync(dirname(JSON_PATH), { recursive: true });
    mkdirSync(dirname(TS_PATH), { recursive: true });
    writeFileSync(JSON_PATH, renderJson(document));
    writeFileSync(TS_PATH, renderTypeScript(document));
    log(`Wrote ${JSON_PATH}`);
    log(`Wrote ${TS_PATH}`);
  }

  if (degraded > 0) {
    log(`${degraded} project(s) kept their previous snapshot after a fetch failure.`);
  }
  if (unrecoverable.length > 0) {
    process.stderr.write(
      `Could not fetch and had no previous data: ${unrecoverable.join(", ")}\n`,
    );
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
