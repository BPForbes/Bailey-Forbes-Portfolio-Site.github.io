/**
 * Resolving "what version is this project on right now".
 *
 * Precedence, highest first:
 *
 *   1. the newest published GitHub Release that is neither a draft nor a
 *      prerelease;
 *   2. the highest stable semver tag;
 *   3. a repository version manifest, for projects that version themselves with
 *      a file convention instead (opt-in per project, see project-sources.mjs);
 *   4. nothing — the caller keeps whatever the site already showed.
 *
 * Step 3 exists because neither Flinstone nor QPU publishes releases or tags,
 * and step 4 is a real outcome rather than a failure: a project with no version
 * scheme keeps its curated chip.
 */

/** Matches a semver core with an optional leading v and optional pre/build. */
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

/**
 * @typedef {object} ParsedVersion
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 * @property {string|undefined} prerelease
 * @property {string} raw
 */

/**
 * @param {unknown} value
 * @returns {ParsedVersion|undefined}
 */
export function parseSemver(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = SEMVER.exec(value.trim());
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4],
    raw: value.trim(),
  };
}

/**
 * Compare two parsed versions. A prerelease sorts below its own release, per
 * semver, so 5.0.0-rc.1 never outranks 5.0.0.
 *
 * @param {ParsedVersion} a
 * @param {ParsedVersion} b
 * @returns {number}
 */
export function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

/**
 * Strip a leading "v" for display unless the project's own convention keeps it.
 *
 * @param {string} raw
 * @param {string} [prefix]
 * @returns {string}
 */
export function formatVersion(raw, prefix) {
  const bare = raw.trim().replace(/^v/i, "");
  return prefix === "v" ? `v${bare}` : bare;
}

/**
 * Pick the newest shipped release from a GitHub /releases payload.
 *
 * Draft and prerelease entries are skipped. An entry with no usable tag is
 * skipped too — QPU currently has exactly one release row and it is an
 * unpublished draft with an empty tag_name, which must not become a version.
 *
 * @param {unknown} releases
 * @returns {{ version: ParsedVersion, url?: string, date?: string }|undefined}
 */
export function pickLatestRelease(releases) {
  if (!Array.isArray(releases)) {
    return undefined;
  }
  /** @type {{ version: ParsedVersion, url?: string, date?: string }|undefined} */
  let best;
  for (const release of releases) {
    if (release === null || typeof release !== "object") continue;
    if (release.draft === true || release.prerelease === true) continue;
    if (typeof release.published_at !== "string" || release.published_at === "") continue;
    const version = parseSemver(release.tag_name);
    if (!version || version.prerelease !== undefined) continue;
    if (best && compareSemver(version, best.version) <= 0) continue;
    best = {
      version,
      ...(typeof release.html_url === "string" ? { url: release.html_url } : {}),
      date: release.published_at.slice(0, 10),
    };
  }
  return best;
}

/**
 * Highest stable semver tag from a GitHub /tags payload.
 *
 * Tags that are not semver are ignored rather than guessed at, so a repository
 * that tags `nightly` or `lab-2026-09` cannot have that read as a product
 * version.
 *
 * @param {unknown} tags
 * @returns {ParsedVersion|undefined}
 */
export function pickLatestTag(tags) {
  if (!Array.isArray(tags)) {
    return undefined;
  }
  /** @type {ParsedVersion|undefined} */
  let best;
  for (const tag of tags) {
    if (tag === null || typeof tag !== "object") continue;
    const version = parseSemver(tag.name);
    if (!version || version.prerelease !== undefined) continue;
    if (!best || compareSemver(version, best) > 0) {
      best = version;
    }
  }
  return best;
}

/**
 * Parse a Flinstone `*.ver` file into a version.
 *
 * The format is documented in that repository's version/entries/ABOUT.txt. The
 * declared fields are authoritative — ABOUT.txt says ordering "uses
 * MAJOR/STANDARD/RELEASE inside the file, not the filename prefix" — so the
 * filename only ever decides what order the files are read in, never which
 * version wins.
 *
 * Rows carrying PRERELEASE=1 are in-flight and are not the shipped version.
 *
 * @param {string} text
 * @returns {ParsedVersion|undefined}
 */
export function parseFlinstoneVer(text) {
  if (typeof text !== "string") {
    return undefined;
  }
  /** @type {Record<string, string>} */
  const fields = {};
  for (const line of text.split(/\r?\n/)) {
    // Stop at the heredoc; DESCRIPTION bodies can contain anything, including
    // lines that look like KEY=VALUE.
    if (/^DESCRIPTION<</.test(line)) break;
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  if (fields.PRERELEASE === "1") {
    return undefined;
  }
  const major = Number(fields.MAJOR_VERSION);
  const minor = Number(fields.STANDARD_VERSION);
  // The format calls the third component RELEASE_VERSION, with MINOR_VERSION and
  // VERSION_PATCH accepted as aliases.
  const patchRaw =
    fields.RELEASE_VERSION ?? fields.VERSION_PATCH ?? fields.MINOR_VERSION;
  const patch = Number(patchRaw);
  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    return undefined;
  }
  return {
    major,
    minor,
    patch,
    prerelease: undefined,
    raw: `${major}.${minor}.${patch}`,
  };
}

/** Parsers available to `versionManifest.format` in project-sources.mjs. */
export const MANIFEST_PARSERS = Object.freeze({
  "flinstone-ver": {
    /** Only files that could plausibly carry a version are fetched. */
    matches: (/** @type {string} */ name) => name.endsWith(".ver"),
    parse: parseFlinstoneVer,
  },
});

/**
 * Highest version across a set of already-fetched manifest file bodies.
 *
 * @param {{ name: string, text: string }[]} files
 * @param {keyof typeof MANIFEST_PARSERS} format
 * @returns {ParsedVersion|undefined}
 */
export function pickLatestManifestVersion(files, format) {
  const parser = MANIFEST_PARSERS[format];
  if (!parser) {
    return undefined;
  }
  /** @type {ParsedVersion|undefined} */
  let best;
  for (const file of files) {
    const version = parser.parse(file.text);
    if (!version) continue;
    if (!best || compareSemver(version, best) > 0) {
      best = version;
    }
  }
  return best;
}

/**
 * Every manifest filename worth fetching, newest-looking first.
 *
 * The declared fields inside the files decide the winner — that repository's
 * ABOUT.txt is explicit that ordering "uses MAJOR/STANDARD/RELEASE inside the
 * file, not the filename prefix" — so the ranking here only decides read order,
 * never the outcome. Every candidate is returned: capping the list would let a
 * file whose name understates its contents (a 9.9.9 declared inside
 * `001_2_2_4_baseline.ver`) be skipped before it was ever parsed, and publish an
 * older version. Reading a couple of dozen small blobs once a day is the
 * cheaper mistake.
 *
 * `limit` remains for callers that genuinely want a subset, with a high default
 * guarding against a pathological directory.
 *
 * @param {string[]} names
 * @param {keyof typeof MANIFEST_PARSERS} format
 * @param {number} [limit]
 * @returns {string[]}
 */
export function shortlistManifestFiles(names, format, limit = 200) {
  const parser = MANIFEST_PARSERS[format];
  if (!parser) {
    return [];
  }
  const candidates = names.filter((name) => parser.matches(name));
  const ranked = candidates.map((name) => {
    const match = /(\d+)[._-](\d+)[._-](\d+)/.exec(name);
    const rank = match
      ? Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3])
      : -1;
    return { name, rank };
  });
  ranked.sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name));
  return ranked.slice(0, limit).map((entry) => entry.name);
}
