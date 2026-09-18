#!/usr/bin/env node
/**
 * Writes data/projects.generated.json for the Pages build.
 *
 *   node tools/generate-project-metadata.mjs            # refresh from GitHub
 *   node tools/generate-project-metadata.mjs --validate  # re-check what is on disk
 *   node tools/generate-project-metadata.mjs --output <path>
 *
 * Needs GITHUB_TOKEN. In Actions that is the workflow's own token, which is
 * enough for public repositories and keeps the build inside the authenticated
 * rate limit. The token is only ever passed to api.github.com as a header; it
 * is never written to the output or the log.
 *
 * Failure is loud and total. A bad response throws, the document is validated
 * before and after writing, and the write is atomic — so the artifact either
 * carries a complete, correct document or the deploy fails and the previous
 * GitHub Pages deployment keeps serving (docs/project-metadata.md).
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTS } from './projects.registry.mjs';
import { generatePortfolioMetadata, validatePortfolioMetadata } from './projectMetadata.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const defaultOutput = resolve(repositoryRoot, 'data', 'projects.generated.json');

const parseArgs = (argv) => {
  const flag = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? (argv[index + 1] ?? null) : undefined;
  };
  const validate = flag('--validate');
  if (validate !== undefined) {
    return { mode: 'validate', path: resolve(validate ?? defaultOutput) };
  }
  const output = flag('--output');
  return {
    mode: 'generate',
    path: resolve(output ?? process.env.METADATA_OUTPUT ?? defaultOutput),
  };
};

const readJsonFile = (path) => {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Write through a sibling temporary file and rename over the target, so an
 * interrupted run cannot leave a half-written document where the build expects
 * a complete one.
 */
const writeAtomically = (path, contents) => {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, contents);
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
};

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'validate') {
  const metadata = validatePortfolioMetadata(readJsonFile(args.path));
  console.log(
    `Validated ${args.path}: schemaVersion ${metadata.schemaVersion}, `
    + `${metadata.projects.length} tracked project(s), generated ${metadata.generatedAt}.`,
  );
} else {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  // The dispatch payload is echoed so an Actions log says which project asked
  // for this refresh. The payload is untrusted input and is never used to pick
  // what to query — the registry decides that.
  const trigger = process.env.DISPATCH_REPOSITORY
    ? {
      repository: process.env.DISPATCH_REPOSITORY,
      ...(process.env.DISPATCH_SHA ? { sha: process.env.DISPATCH_SHA } : {}),
      ...(process.env.DISPATCH_WORKFLOW ? { workflow: process.env.DISPATCH_WORKFLOW } : {}),
    }
    : null;

  if (trigger) {
    console.log(`Refresh requested by ${trigger.repository}${trigger.sha ? `@${trigger.sha.slice(0, 7)}` : ''}.`);
  }
  console.log(`Querying GitHub for ${PROJECTS.length} registry entr${PROJECTS.length === 1 ? 'y' : 'ies'}:`);

  const metadata = await generatePortfolioMetadata({
    token,
    registry: PROJECTS,
    sourceCommit: process.env.GITHUB_SHA ?? null,
    trigger,
  });

  const contents = `${JSON.stringify(metadata, null, 2)}\n`;
  writeAtomically(args.path, contents);

  // Re-validate the bytes that actually landed, not the object in memory.
  validatePortfolioMetadata(readJsonFile(args.path));

  for (const project of metadata.projects) {
    const languages = project.languages.slice(0, 3)
      .map((language) => `${language.name} ${language.percentage}%`).join(', ');
    console.log(
      `  ✓ ${project.id}: ${project.stats.commits ?? '?'} commits, `
      + `${project.milestones.length} milestone(s)${project.version ? `, v${project.version}` : ''}`
      + `${languages ? ` — ${languages}` : ''}`,
    );
  }
  for (const entry of metadata.untracked) {
    console.log(`  – ${entry.id}: not queried (${entry.reason})`);
  }
  console.log(`Wrote ${args.path}.`);
}
