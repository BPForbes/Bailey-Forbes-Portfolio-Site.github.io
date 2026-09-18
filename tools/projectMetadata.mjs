/**
 * Portfolio project metadata: Linguist language bytes, repository statistics,
 * and a milestone timeline, gathered from the GitHub REST API for every project
 * in `tools/projects.registry.mjs`.
 *
 * This runs in GitHub Actions at build time and writes `data/projects.generated.json`
 * into the Pages artifact, so the deployed site stays static — the browser never
 * talks to api.github.com (docs/project-metadata.md).
 *
 * Two rules shape everything here:
 *
 *   1. Nothing is fabricated. Percentages are computed from GitHub's own byte
 *      counts, counts come from the API, and a field GitHub does not answer for
 *      is simply absent rather than guessed.
 *   2. Nothing partial is published. A malformed response throws, the document
 *      is validated before it is written, and the caller writes atomically — so
 *      a bad run fails the deploy and the previous Pages deployment keeps
 *      serving correct numbers.
 */
export const SCHEMA_VERSION = 1;
export const PERCENTAGE_DECIMALS = 1;
export const GITHUB_API_VERSION = '2022-11-28';

const DEFAULT_API_BASE = 'https://api.github.com';
const USER_AGENT = 'bailey-forbes-portfolio-metadata';
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/** Transient statuses worth one more attempt before failing the deploy. */
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/** Guard against a registry mistake turning into hundreds of blob reads. */
const MAX_VER_FILES = 200;

export const roundPercentage = (value) => {
  const factor = 10 ** PERCENTAGE_DECIMALS;
  return Math.round(value * factor) / factor;
};

/* -------------------------------------------------------------------------- */
/* GitHub transport                                                            */
/* -------------------------------------------------------------------------- */

const githubHeaders = (token, accept) => {
  const headers = {
    Accept: accept ?? 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': USER_AGENT,
  };
  // Authenticated requests get 5,000 requests/hour instead of 60, which is the
  // only reason a full refresh across five repositories fits in a build.
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A single GitHub request. Rate limiting and server errors are reported with
 * enough detail to diagnose from an Actions log, and never with the token.
 */
export const githubFetch = async (url, { token, fetchImpl = fetch, accept, attempt = 1 } = {}) => {
  const response = await fetchImpl(url, { headers: githubHeaders(token, accept) });
  const remaining = response.headers.get('x-ratelimit-remaining');
  const reset = response.headers.get('x-ratelimit-reset');

  if (response.status === 403 || response.status === 429) {
    const resetAt = reset ? new Date(Number(reset) * 1000).toISOString() : 'unknown';
    // A 403 with budget left is a permissions problem, not a rate limit; say so
    // rather than sending the maintainer to look at a quota that is fine.
    const cause = remaining === '0'
      ? `rate limited (reset ${resetAt})`
      : `forbidden — check the token's repository access (remaining=${remaining ?? 'n/a'})`;
    throw new Error(`GitHub API ${response.status} for ${url}: ${cause}`);
  }

  if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
    await sleep(2 ** attempt * 500);
    return githubFetch(url, { token, fetchImpl, accept, attempt: attempt + 1 });
  }

  if (!response.ok) {
    throw new Error(`GitHub API request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response;
};

export const githubGetJson = async (url, options = {}) => {
  const response = await githubFetch(url, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`GitHub API returned non-JSON for ${url}`);
  }
  return { data, headers: response.headers };
};

export const githubGetText = async (url, options = {}) => {
  const response = await githubFetch(url, { ...options, accept: 'application/vnd.github.raw' });
  return response.text();
};

/**
 * Walk a paginated collection.
 *
 * Pages are addressed by building `page=N` onto the caller's own URL rather
 * than following the `Link` header, because GitHub answers `Link` with the
 * `/repositories/{id}/...` form. Constructing them keeps every request on the
 * `/repos/{owner}/{repo}/...` path the token is scoped to, and makes the walk
 * independent of a header's URL shape.
 */
export const githubGetAllPages = async (url, options = {}) => {
  const target = new URL(url);
  const perPage = Number(target.searchParams.get('per_page') ?? 100);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new Error(`per_page must be between 1 and 100 when paginating ${url}.`);
  }

  const items = [];
  for (let page = 1; ; page += 1) {
    target.searchParams.set('page', String(page));
    const { data } = await githubGetJson(target.toString(), options);
    if (!Array.isArray(data)) {
      throw new Error(`GitHub API page for ${target} must be a JSON array.`);
    }
    items.push(...data);
    // A short page is the last page; a full one may or may not be, so ask again.
    if (data.length < perPage) return items;
    if (page > 200) {
      throw new Error(`Refusing to page past 200 pages of ${url}.`);
    }
  }
};

/**
 * Total item count for a paginated collection, without walking it.
 *
 * Asking for one item per page makes the `rel="last"` link's page number the
 * total. A collection that fits on one page has no `rel="last"`, so its length
 * is the answer.
 */
export const countViaPagination = async (url, options = {}) => {
  const separator = url.includes('?') ? '&' : '?';
  const { data, headers } = await githubGetJson(`${url}${separator}per_page=1`, options);
  if (!Array.isArray(data)) {
    throw new Error(`Expected a JSON array when counting ${url}.`);
  }
  const last = headers.get('link')?.split(',')
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="last"'))
    ?.match(/^<([^>]+)>/)?.[1];
  if (!last) return data.length;

  const page = Number(new URL(last).searchParams.get('page'));
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Could not read a page count from the Link header for ${url}.`);
  }
  return page;
};

/* -------------------------------------------------------------------------- */
/* Languages                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * GitHub's Languages endpoint answers with Linguist byte counts. Percentages
 * are derived here so they track the repository instead of being maintained by
 * hand, and raw bytes are kept so a consumer can recompute them.
 */
export const languageBreakdown = (languageBytes) => {
  if (!languageBytes || typeof languageBytes !== 'object' || Array.isArray(languageBytes)) {
    throw new Error('GitHub Languages API must return an object of language name → byte count.');
  }

  const entries = Object.entries(languageBytes).map(([name, bytes]) => {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Language names from GitHub Linguist must be non-empty strings.');
    }
    if (!Number.isInteger(bytes) || bytes < 0) {
      throw new Error(`Language '${name}' has a non-integer byte count: ${bytes}`);
    }
    return { name, bytes };
  });

  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  const languages = entries.map((entry) => ({
    name: entry.name,
    bytes: entry.bytes,
    percentage: total === 0 ? 0 : roundPercentage((entry.bytes / total) * 100),
  }));

  languages.sort((left, right) => (
    right.percentage - left.percentage
    || right.bytes - left.bytes
    || left.name.localeCompare(right.name)
  ));
  return languages;
};

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A `.ver` release row, as used by Flinstone's version-lock automation.
 *
 * `DESCRIPTION` is either a single line or a heredoc (`DESCRIPTION<<TOKEN` …
 * `TOKEN`). `STANDARD_VERSION`/`RELEASE_VERSION` have the documented
 * `MINOR_VERSION`/`VERSION_PATCH` aliases.
 */
export const parseVerFile = (text, label = '.ver') => {
  if (typeof text !== 'string') {
    throw new Error(`${label} must be text.`);
  }

  const fields = new Map();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const heredoc = lines[index].match(/^([A-Z_][A-Z0-9_]*)<<([A-Za-z0-9_]+)\s*$/);
    if (heredoc) {
      const [, key, token] = heredoc;
      const body = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== token) {
        body.push(lines[index]);
        index += 1;
      }
      if (index >= lines.length) {
        throw new Error(`${label}: heredoc for ${key} is never closed by ${token}.`);
      }
      fields.set(key, body.join('\n').trim());
      continue;
    }
    const assignment = lines[index].match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (assignment) fields.set(assignment[1], assignment[2].trim());
  }

  const numeric = (...keys) => {
    for (const key of keys) {
      if (!fields.has(key)) continue;
      const value = Number(fields.get(key));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${label}: ${key} must be a non-negative integer, got '${fields.get(key)}'.`);
      }
      return value;
    }
    return undefined;
  };

  const major = numeric('MAJOR_VERSION');
  const standard = numeric('STANDARD_VERSION', 'MINOR_VERSION');
  const release = numeric('RELEASE_VERSION', 'VERSION_PATCH');
  if (major === undefined || standard === undefined || release === undefined) {
    throw new Error(`${label}: missing MAJOR_VERSION / STANDARD_VERSION / RELEASE_VERSION.`);
  }

  const releaseDate = fields.get('RELEASE_DATE');
  if (releaseDate !== undefined && !DATE_PATTERN.test(releaseDate)) {
    throw new Error(`${label}: RELEASE_DATE must be YYYY-MM-DD, got '${releaseDate}'.`);
  }

  return {
    version: `${major}.${standard}.${release}`,
    description: fields.get('DESCRIPTION') ?? '',
    releaseDate,
    prerelease: fields.get('PRERELEASE') === '1',
    gm: fields.get('GM') === '1',
  };
};

/** First paragraph of a release note, with a leading `A.B.C:` prefix removed. */
export const summariseDescription = (description, version) => {
  const paragraph = String(description ?? '').split(/\n\s*\n/)[0].trim();
  const prefix = new RegExp(`^${version.replace(/\./g, '\\.')}\\s*:\\s*`);
  return paragraph.replace(prefix, '').trim();
};

const milestone = ({ kind, id, version, title, date, detail, url }) => ({
  kind,
  id,
  ...(version ? { version } : {}),
  title,
  date,
  ...(detail ? { detail } : {}),
  ...(url ? { url } : {}),
});

/* -------------------------------------------------------------------------- */
/* Version resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Join the first capture group of each pattern against a tracked file. Every
 * pattern must match: a version_def.h that stopped declaring VERSION_PATCH
 * should fail the build, not quietly publish `5.0`.
 */
export const resolveVersionFromFile = (text, { path, patterns, join = '.' }) => {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error(`Version source for ${path} needs at least one pattern.`);
  }
  const parts = patterns.map((source) => {
    const match = text.match(new RegExp(source, 'm'));
    if (!match || typeof match[1] !== 'string') {
      throw new Error(`Version pattern ${source} did not match ${path}.`);
    }
    return match[1];
  });
  return parts.join(join);
};

/* -------------------------------------------------------------------------- */
/* Per-project collection                                                      */
/* -------------------------------------------------------------------------- */

const releaseMilestone = (release) => milestone({
  kind: 'release',
  id: `release:${release.tag_name}`,
  version: release.tag_name,
  title: release.name?.trim() || release.tag_name,
  date: release.published_at.slice(0, 10),
  detail: summariseDescription(release.body ?? '', release.tag_name) || undefined,
  url: release.html_url,
});

const collectVerMilestones = async (repoUrl, path, options) => {
  // The Contents API lists a directory in one request and hands back a
  // download_url per file, so the cost is 1 + N rather than a tree walk.
  const { data: listing } = await githubGetJson(`${repoUrl}/contents/${encodeURI(path)}`, options);
  if (!Array.isArray(listing)) {
    throw new Error(`Expected ${path} to be a directory in the repository.`);
  }

  const verFiles = listing.filter((entry) => entry?.type === 'file' && entry.name?.endsWith('.ver'));
  if (verFiles.length > MAX_VER_FILES) {
    throw new Error(`${path} holds ${verFiles.length} .ver files, above the ${MAX_VER_FILES} cap.`);
  }

  const milestones = [];
  for (const entry of verFiles) {
    const text = await githubGetText(`${repoUrl}/contents/${encodeURI(entry.path)}`, options);
    const row = parseVerFile(text, entry.path);
    // Preproduction rows are not published releases; version/locked should not
    // hold any, and a stray one must not reach the portfolio.
    if (row.prerelease) continue;
    if (!row.releaseDate) continue;
    milestones.push(milestone({
      kind: 'release',
      id: `ver:${row.version}`,
      version: row.version,
      title: row.version,
      date: row.releaseDate,
      detail: summariseDescription(row.description, row.version) || undefined,
    }));
  }
  return milestones;
};

/**
 * Everything the portfolio shows for one registry entry.
 *
 * Calls are sequential on purpose: five repositories at roughly ten requests
 * each is far inside the authenticated budget, and a serial walk keeps the
 * Actions log readable when one repository is the one that failed.
 */
export const collectProjectMetadata = async (project, {
  token,
  apiBase = DEFAULT_API_BASE,
  fetchImpl = fetch,
} = {}) => {
  const [owner, name] = project.repo.split('/');
  if (!owner || !name) {
    throw new Error(`Registry entry '${project.id}' has a malformed repo '${project.repo}'.`);
  }
  const options = { token, fetchImpl };
  const repoUrl = `${apiBase}/repos/${owner}/${name}`;
  const webUrl = `https://github.com/${owner}/${name}`;

  const { data: repoData } = await githubGetJson(repoUrl, options);
  if (!repoData || typeof repoData !== 'object' || Array.isArray(repoData)) {
    throw new Error(`GitHub repository payload for ${project.repo} must be an object.`);
  }
  const defaultBranch = repoData.default_branch;
  if (typeof defaultBranch !== 'string' || !defaultBranch) {
    throw new Error(`${project.repo} did not report a default branch.`);
  }

  const { data: languageBytes } = await githubGetJson(`${repoUrl}/languages`, options);
  const languages = languageBreakdown(languageBytes);

  const { data: headCommits } = await githubGetJson(
    `${repoUrl}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
    options,
  );
  if (!Array.isArray(headCommits) || headCommits.length === 0) {
    throw new Error(`${project.repo} returned no commits on ${defaultBranch}.`);
  }
  const head = headCommits[0];
  const headDate = head?.commit?.committer?.date ?? head?.commit?.author?.date;
  if (typeof head?.sha !== 'string' || typeof headDate !== 'string') {
    throw new Error(`${project.repo} returned a commit without a sha or a date.`);
  }

  const stats = {};
  if (project.countCommits !== false) {
    stats.commits = await countViaPagination(
      `${repoUrl}/commits?sha=${encodeURIComponent(defaultBranch)}`,
      options,
    );
  }
  if (project.countMergedPullRequests !== false) {
    // Counted by walking closed pull requests a hundred at a time rather than
    // through /search/issues: the search API is a separate, much smaller rate
    // limit, and staying on /repos/{owner}/{repo}/... means the whole generator
    // needs nothing beyond repository-scoped read access.
    const closed = await githubGetAllPages(`${repoUrl}/pulls?state=closed&per_page=100`, options);
    stats.mergedPullRequests = closed.filter(
      (pull) => typeof pull?.merged_at === 'string' && pull.merged_at,
    ).length;
    // Every pull request ever opened, merged or not. Kept alongside the merged
    // total because they answer different questions and the site shows both
    // kinds of claim.
    stats.pullRequests = await countViaPagination(`${repoUrl}/pulls?state=all`, options);
  }

  const releases = (await githubGetAllPages(`${repoUrl}/releases?per_page=100`, options))
    .filter((release) => release && release.draft !== true && release.prerelease !== true
      && typeof release.published_at === 'string' && typeof release.tag_name === 'string');
  const releaseTags = new Set(releases.map((release) => release.tag_name));

  const signals = project.milestones ?? [{ from: 'releases' }, { from: 'tags' }];
  const milestones = [];

  for (const signal of signals) {
    if (signal.from === 'releases') {
      milestones.push(...releases.map(releaseMilestone));
    } else if (signal.from === 'tags') {
      const tags = await githubGetAllPages(`${repoUrl}/tags?per_page=100`, options);
      for (const tag of tags) {
        if (!tag?.name || releaseTags.has(tag.name)) continue;
        const sha = tag.commit?.sha;
        if (!sha) continue;
        const { data: commit } = await githubGetJson(`${repoUrl}/commits/${sha}`, options);
        const date = commit?.commit?.committer?.date ?? commit?.commit?.author?.date;
        if (typeof date !== 'string') continue;
        milestones.push(milestone({
          kind: 'tag',
          id: `tag:${tag.name}`,
          version: tag.name,
          title: tag.name,
          date: date.slice(0, 10),
          url: `${webUrl}/releases/tag/${encodeURIComponent(tag.name)}`,
        }));
      }
    } else if (signal.from === 'verEntries') {
      if (typeof signal.path !== 'string' || !signal.path) {
        throw new Error(`Registry entry '${project.id}' has a verEntries signal without a path.`);
      }
      const rows = await collectVerMilestones(repoUrl, signal.path, options);
      milestones.push(...rows.map((row) => ({
        ...row,
        url: `${webUrl}/blob/${defaultBranch}/${signal.path}`,
      })));
    } else {
      throw new Error(`Registry entry '${project.id}' has an unknown milestone source '${signal.from}'.`);
    }
  }

  // Later signals must not displace an earlier one for the same release: the
  // registry lists them in priority order.
  const seen = new Set();
  const uniqueMilestones = milestones.filter((entry) => {
    // `v4.5.4` from a tag and `4.5.4` from a .ver row are the same release.
    const key = entry.version ? entry.version.replace(/^v/i, '') : entry.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => right.date.localeCompare(left.date)
    || right.title.localeCompare(left.title));

  let version;
  if (project.version?.from === 'release') {
    version = uniqueMilestones.find((entry) => entry.kind === 'release')?.version;
  } else if (project.version?.from === 'file') {
    const text = await githubGetText(`${repoUrl}/contents/${encodeURI(project.version.path)}`, options);
    version = resolveVersionFromFile(text, project.version);
  }

  return {
    id: project.id,
    label: project.label,
    repo: `${owner}/${name}`,
    repoUrl: repoData.html_url ?? webUrl,
    liveUrl: project.liveUrl ?? null,
    defaultBranch,
    description: typeof repoData.description === 'string' ? repoData.description : null,
    createdAt: repoData.created_at ?? null,
    pushedAt: repoData.pushed_at ?? null,
    lastUpdated: (repoData.pushed_at ?? headDate).slice(0, 10),
    latestCommit: {
      sha: head.sha,
      shortSha: head.sha.slice(0, 7),
      date: headDate.slice(0, 10),
      url: head.html_url ?? `${webUrl}/commit/${head.sha}`,
    },
    ...(version ? { version } : {}),
    stats,
    languages,
    milestones: uniqueMilestones,
  };
};

/* -------------------------------------------------------------------------- */
/* Document assembly and validation                                            */
/* -------------------------------------------------------------------------- */

const assertString = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Metadata field '${label}' must be a non-empty string.`);
  }
};

/**
 * Structural validation of the whole document. This runs before the file is
 * written and again over the exact bytes that were written, so a truncated or
 * hand-edited `projects.generated.json` cannot reach the Pages artifact.
 */
export const validatePortfolioMetadata = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('projects.generated.json must be a JSON object.');
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`schemaVersion must be ${SCHEMA_VERSION}.`);
  }
  assertString(data.generatedAt, 'generatedAt');
  if (!ISO_PATTERN.test(data.generatedAt)) {
    throw new Error('generatedAt must be an ISO-8601 UTC timestamp.');
  }
  if (data.sourceCommit !== null) {
    assertString(data.sourceCommit, 'sourceCommit');
    if (!SHA_PATTERN.test(data.sourceCommit)) {
      throw new Error('sourceCommit must be a git SHA or null.');
    }
  }
  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    throw new Error('projects must be a non-empty array.');
  }

  const ids = new Set();
  data.projects.forEach((project, index) => {
    const at = `projects[${index}]`;
    if (!project || typeof project !== 'object') throw new Error(`${at} must be an object.`);
    assertString(project.id, `${at}.id`);
    if (ids.has(project.id)) throw new Error(`${at}.id '${project.id}' is duplicated.`);
    ids.add(project.id);
    assertString(project.label, `${at}.label`);
    assertString(project.repo, `${at}.repo`);
    assertString(project.repoUrl, `${at}.repoUrl`);
    assertString(project.defaultBranch, `${at}.defaultBranch`);
    assertString(project.lastUpdated, `${at}.lastUpdated`);
    if (!DATE_PATTERN.test(project.lastUpdated)) {
      throw new Error(`${at}.lastUpdated must be YYYY-MM-DD.`);
    }

    if (!project.latestCommit || typeof project.latestCommit !== 'object') {
      throw new Error(`${at}.latestCommit is required.`);
    }
    assertString(project.latestCommit.sha, `${at}.latestCommit.sha`);
    if (!SHA_PATTERN.test(project.latestCommit.sha)) {
      throw new Error(`${at}.latestCommit.sha must be a git SHA.`);
    }

    if (!project.stats || typeof project.stats !== 'object' || Array.isArray(project.stats)) {
      throw new Error(`${at}.stats must be an object.`);
    }
    for (const [key, value] of Object.entries(project.stats)) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${at}.stats.${key} must be a non-negative integer.`);
      }
    }

    if (!Array.isArray(project.languages)) throw new Error(`${at}.languages must be an array.`);
    let percentageTotal = 0;
    project.languages.forEach((language, languageIndex) => {
      const path = `${at}.languages[${languageIndex}]`;
      assertString(language?.name, `${path}.name`);
      if (!Number.isInteger(language.bytes) || language.bytes < 0) {
        throw new Error(`${path}.bytes must be a non-negative integer.`);
      }
      if (typeof language.percentage !== 'number' || !Number.isFinite(language.percentage)) {
        throw new Error(`${path}.percentage must be a finite number.`);
      }
      percentageTotal += language.percentage;
    });
    // Rounding to one decimal can leave a few tenths on the table; anything
    // wider than that means the breakdown was not derived from one byte total.
    if (project.languages.length > 0 && Math.abs(percentageTotal - 100) > 1) {
      throw new Error(`${at}.languages percentages sum to ${percentageTotal.toFixed(1)}, not ~100.`);
    }
    const sorted = [...project.languages].sort((left, right) => (
      right.percentage - left.percentage || right.bytes - left.bytes || left.name.localeCompare(right.name)
    ));
    sorted.forEach((language, languageIndex) => {
      if (language.name !== project.languages[languageIndex].name) {
        throw new Error(`${at}.languages must be sorted from largest percentage to smallest.`);
      }
    });

    if (!Array.isArray(project.milestones)) throw new Error(`${at}.milestones must be an array.`);
    project.milestones.forEach((entry, milestoneIndex) => {
      const path = `${at}.milestones[${milestoneIndex}]`;
      if (entry?.kind !== 'release' && entry?.kind !== 'tag') {
        throw new Error(`${path}.kind '${entry?.kind}' is not supported.`);
      }
      assertString(entry.id, `${path}.id`);
      assertString(entry.title, `${path}.title`);
      assertString(entry.date, `${path}.date`);
      if (!DATE_PATTERN.test(entry.date)) throw new Error(`${path}.date must be YYYY-MM-DD.`);
    });
    const ordered = [...project.milestones].sort((left, right) => (
      right.date.localeCompare(left.date) || right.title.localeCompare(left.title)
    ));
    ordered.forEach((entry, milestoneIndex) => {
      if (entry.id !== project.milestones[milestoneIndex].id) {
        throw new Error(`${at}.milestones must be ordered newest-first.`);
      }
    });
  });

  // Structural refusal of anything credential-shaped. The generator never puts
  // one here, and this makes a future change that does fail the build.
  const serialized = JSON.stringify(data);
  if (/"(?:token|authorization|password|secret)"\s*:/i.test(serialized)) {
    throw new Error('Metadata must not carry credential-shaped fields.');
  }
  if (/\bgh[pousr]_[A-Za-z0-9]{16,}/.test(serialized) || /\bgithub_pat_[A-Za-z0-9_]{20,}/.test(serialized)) {
    throw new Error('Metadata must not contain a GitHub token.');
  }
  if (EMAIL_PATTERN.test(serialized)) {
    throw new Error('Metadata must not contain email addresses.');
  }

  return data;
};

export const assemblePortfolioMetadata = ({
  projects,
  untracked = [],
  generatedAt,
  sourceCommit = null,
  trigger = null,
}) => validatePortfolioMetadata({
  schemaVersion: SCHEMA_VERSION,
  generatedAt,
  sourceCommit,
  ...(trigger ? { trigger } : {}),
  projects,
  untracked,
});

/**
 * Query GitHub for every tracked registry entry.
 *
 * Untracked entries (no public repository) are recorded with their reason so
 * the site can say why a project has no live statistics instead of implying the
 * generator forgot it.
 */
export const generatePortfolioMetadata = async ({
  token,
  registry,
  generatedAt = new Date().toISOString(),
  sourceCommit = null,
  trigger = null,
  apiBase = DEFAULT_API_BASE,
  fetchImpl = fetch,
} = {}) => {
  if (!token) {
    throw new Error('A GitHub token is required: unauthenticated builds hit the 60 requests/hour limit.');
  }
  if (!Array.isArray(registry) || registry.length === 0) {
    throw new Error('The project registry is empty.');
  }

  const projects = [];
  const untracked = [];
  for (const entry of registry) {
    if (!entry.metadataEnabled || typeof entry.repo !== 'string') {
      untracked.push({
        id: entry.id,
        label: entry.label,
        reason: entry.note ?? 'Metadata generation is disabled for this project in the registry.',
      });
      continue;
    }
    // Name the project before the request so a failure names the repository
    // that caused it, not just a URL.
    console.log(`  · ${entry.id} (${entry.repo})`);
    projects.push(await collectProjectMetadata(entry, { token, apiBase, fetchImpl }));
  }

  return assemblePortfolioMetadata({ projects, untracked, generatedAt, sourceCommit, trigger });
};
