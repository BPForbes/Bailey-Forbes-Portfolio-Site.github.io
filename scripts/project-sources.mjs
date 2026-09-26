/**
 * Canonical portfolio project -> GitHub repository mapping.
 *
 * This is the ONE file to edit when a portfolio project gains (or loses) a
 * public GitHub repository. Everything downstream — the sync script, the
 * generated metadata, the rendered chips and language bars — reads from here.
 *
 * A project that is absent from this table is not an error: it simply keeps the
 * hand-curated metadata in `src/data.ts` forever. `emr` is the current example —
 * the client tree is private, and `projects/emr/index.html` says so explicitly.
 *
 * Per-project fields
 * ------------------
 * repo              "owner/name" on github.com. Required.
 *
 * contractUrl       Optional. Some of these repositories publish their own
 *                   `project-metadata.json` (schemaVersion 1) alongside their
 *                   GitHub Pages deployment, specifically so this portfolio
 *                   reads one pointer instead of duplicating their state. When
 *                   present it is preferred over re-deriving from the REST API;
 *                   if it cannot be fetched or fails validation the sync falls
 *                   back to the REST API and says so in the run log.
 *
 * versionManifest   Optional. For repositories that version themselves with a
 *                   file convention rather than GitHub Releases or tags. Only
 *                   consulted after releases and tags come up empty.
 *                     dir     directory holding the version files
 *                     format  parser name (see scripts/lib/version.mjs)
 *
 * displayVersionPrefix
 *                   Optional. "v" keeps a leading v on the rendered version for
 *                   projects whose own convention shows one. Default is bare.
 */

/** @type {Readonly<Record<string, import("./lib/types.mjs").ProjectSource>>} */
export const PROJECT_SOURCES = Object.freeze({
  flinstone: {
    repo: "BPForbes/Bailey-Forbes-Flinstone",
    // Documented in the upstream repo at docs/project-metadata.md.
    contractUrl:
      "https://bpforbes.github.io/Bailey-Forbes-Flinstone/project-metadata.json",
    // Flinstone ships no GitHub Releases and no tags. Its shipped GA version is
    // the highest semver triple under version/locked, per that repo's
    // version/entries/ABOUT.txt ("shipped VERSION_* / VERSION follow the
    // highest triple in version/locked only").
    versionManifest: { dir: "version/locked", format: "flinstone-ver" },
  },
  qpu: {
    repo: "BPForbes/BPForbes.QPU.github.io",
    contractUrl:
      "https://bpforbes.github.io/BPForbes.QPU.github.io/project-metadata.json",
  },
  "homework-central": {
    repo: "BPForbes/Homework-Central",
  },
  keyquorum: {
    repo: "BPForbes/KeyQuorum",
    // Published next to KeyQuorum Lab by its deploy-lab.yml workflow.
    contractUrl: "https://bpforbes.github.io/KeyQuorum/project-metadata.json",
  },
});

/**
 * Portfolio project ids that exist on the site, including the ones with no
 * repository. Kept in sync with `ProjectId` in src/types.d.ts; the sync script
 * validates generated ids against this list so a typo in PROJECT_SOURCES cannot
 * emit metadata for a project the site does not publish.
 */
export const PORTFOLIO_PROJECT_IDS = Object.freeze([
  "emr",
  "homework-central",
  "flinstone",
  "keyquorum",
  "qpu",
]);
