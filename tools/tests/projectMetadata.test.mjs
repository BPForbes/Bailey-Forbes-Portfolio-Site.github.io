/**
 * Hermetic tests for the metadata generator. No network: `fakeGithub` answers
 * from a fixture map, so these cover the parsing, derivation, and refusal paths
 * that decide whether a wrong number can reach the site.
 *
 * Run with `npm run test:metadata` (node --test, no test framework dependency).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assemblePortfolioMetadata,
  collectProjectMetadata,
  countViaPagination,
  generatePortfolioMetadata,
  githubGetAllPages,
  languageBreakdown,
  parseVerFile,
  resolveVersionFromFile,
  roundPercentage,
  summariseDescription,
  validatePortfolioMetadata,
} from '../projectMetadata.mjs';

const response = (body, { status = 200, headers = {}, text } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: String(status),
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => text ?? JSON.stringify(body),
});

/** A fetch stand-in backed by an exact-URL fixture map. */
const fakeGithub = (routes) => {
  const seen = [];
  const impl = async (url) => {
    seen.push(String(url));
    const route = routes[String(url)];
    if (route === undefined) throw new Error(`Unexpected request: ${url}`);
    return typeof route === 'function' ? route() : route;
  };
  impl.seen = seen;
  return impl;
};

describe('languageBreakdown', () => {
  it('derives percentages from Linguist byte counts', () => {
    const languages = languageBreakdown({ TypeScript: 900, CSS: 100 });
    assert.deepEqual(languages, [
      { name: 'TypeScript', bytes: 900, percentage: 90 },
      { name: 'CSS', bytes: 100, percentage: 10 },
    ]);
  });

  it('sorts largest first regardless of the order GitHub returned', () => {
    const languages = languageBreakdown({ CSS: 100, Rust: 400, C: 500 });
    assert.deepEqual(languages.map((language) => language.name), ['C', 'Rust', 'CSS']);
  });

  it('reports an empty repository as no languages rather than NaN', () => {
    assert.deepEqual(languageBreakdown({}), []);
  });

  it('refuses a malformed Languages payload instead of guessing', () => {
    assert.throws(() => languageBreakdown(null), /must return an object/);
    assert.throws(() => languageBreakdown([1, 2]), /must return an object/);
    assert.throws(() => languageBreakdown({ C: 'lots' }), /non-integer byte count/);
    assert.throws(() => languageBreakdown({ C: -5 }), /non-integer byte count/);
  });

  it('rounds to one decimal', () => {
    assert.equal(roundPercentage(92.44444), 92.4);
    assert.equal(roundPercentage(0.05), 0.1);
  });
});

describe('parseVerFile', () => {
  it('reads a single-line release row', () => {
    const row = parseVerFile([
      'MAJOR_VERSION=4',
      'STANDARD_VERSION=5',
      'RELEASE_VERSION=4',
      'DESCRIPTION=Browser lab chat no longer duplicates messages.',
      '',
      'RELEASE_DATE=2026-09-15',
    ].join('\n'));
    assert.equal(row.version, '4.5.4');
    assert.equal(row.releaseDate, '2026-09-15');
    assert.equal(row.prerelease, false);
    assert.match(row.description, /^Browser lab chat/);
  });

  it('reads a heredoc DESCRIPTION', () => {
    const row = parseVerFile([
      'MAJOR_VERSION=5',
      'STANDARD_VERSION=0',
      'RELEASE_VERSION=0',
      'DESCRIPTION<<DESC_END',
      '5.0.0: Machine-readable project metadata.',
      '',
      'Second paragraph that is not the summary.',
      'DESC_END',
      'RELEASE_DATE=2026-09-17',
    ].join('\n'));
    assert.equal(row.version, '5.0.0');
    assert.match(row.description, /^5\.0\.0: Machine-readable/);
    assert.equal(summariseDescription(row.description, row.version), 'Machine-readable project metadata.');
  });

  it('accepts the documented MINOR_VERSION / VERSION_PATCH aliases', () => {
    const row = parseVerFile('MAJOR_VERSION=2\nMINOR_VERSION=3\nVERSION_PATCH=1\n');
    assert.equal(row.version, '2.3.1');
  });

  it('flags prerelease and GM rows', () => {
    const row = parseVerFile('MAJOR_VERSION=1\nSTANDARD_VERSION=0\nRELEASE_VERSION=0\nPRERELEASE=1\nGM=1\n');
    assert.equal(row.prerelease, true);
    assert.equal(row.gm, true);
  });

  it('refuses rows it cannot trust', () => {
    assert.throws(() => parseVerFile('MAJOR_VERSION=1\n'), /missing MAJOR_VERSION/);
    assert.throws(
      () => parseVerFile('MAJOR_VERSION=1\nSTANDARD_VERSION=x\nRELEASE_VERSION=0\n'),
      /must be a non-negative integer/,
    );
    assert.throws(
      () => parseVerFile('MAJOR_VERSION=1\nSTANDARD_VERSION=0\nRELEASE_VERSION=0\nRELEASE_DATE=15 Sep 2026\n'),
      /RELEASE_DATE must be YYYY-MM-DD/,
    );
    assert.throws(
      () => parseVerFile('MAJOR_VERSION=1\nSTANDARD_VERSION=0\nRELEASE_VERSION=0\nDESCRIPTION<<END\nunterminated\n'),
      /never closed/,
    );
  });
});

describe('resolveVersionFromFile', () => {
  const source = [
    '#define VERSION_MAJOR    5',
    '#define VERSION_STANDARD 0',
    '#define VERSION_PATCH    0',
  ].join('\n');
  const patterns = [
    '^#define\\s+VERSION_MAJOR\\s+(\\d+)\\s*$',
    '^#define\\s+VERSION_STANDARD\\s+(\\d+)\\s*$',
    '^#define\\s+VERSION_PATCH\\s+(\\d+)\\s*$',
  ];

  it('joins the captures in order', () => {
    assert.equal(resolveVersionFromFile(source, { path: 'version_def.h', patterns }), '5.0.0');
  });

  it('fails the build rather than publishing a partial version', () => {
    const missingPatch = source.split('\n').slice(0, 2).join('\n');
    assert.throws(
      () => resolveVersionFromFile(missingPatch, { path: 'version_def.h', patterns }),
      /did not match/,
    );
  });
});

describe('countViaPagination', () => {
  const rel = (page) => `<https://api.github.com/x?per_page=1&page=${page}>; rel="last"`;

  it('reads the total from the last-page link', async () => {
    const fetchImpl = fakeGithub({
      'https://api.github.com/x?per_page=1': response([{}], { headers: { link: rel(398) } }),
    });
    assert.equal(await countViaPagination('https://api.github.com/x', { fetchImpl }), 398);
  });

  it('falls back to the page length when everything fits on one page', async () => {
    const fetchImpl = fakeGithub({ 'https://api.github.com/x?per_page=1': response([]) });
    assert.equal(await countViaPagination('https://api.github.com/x', { fetchImpl }), 0);
  });
});

describe('githubGetAllPages', () => {
  it('walks pages by number and stops on a short page', async () => {
    const fetchImpl = fakeGithub({
      'https://api.github.com/p?per_page=2&page=1': response([{ id: 1 }, { id: 2 }]),
      'https://api.github.com/p?per_page=2&page=2': response([{ id: 3 }]),
    });
    const items = await githubGetAllPages('https://api.github.com/p?per_page=2', { fetchImpl });
    assert.deepEqual(items.map((item) => item.id), [1, 2, 3]);
  });

  it('never follows the Link header, so requests stay on the repo-scoped path', async () => {
    const fetchImpl = fakeGithub({
      'https://api.github.com/repos/o/r/pulls?state=closed&per_page=1&page=1': response([{ id: 1 }], {
        headers: { link: '<https://api.github.com/repositories/42/pulls?page=2>; rel="next"' },
      }),
      'https://api.github.com/repos/o/r/pulls?state=closed&per_page=1&page=2': response([]),
    });
    await githubGetAllPages('https://api.github.com/repos/o/r/pulls?state=closed&per_page=1', { fetchImpl });
    assert.ok(fetchImpl.seen.every((url) => !url.includes('/repositories/')));
  });
});

describe('validatePortfolioMetadata', () => {
  const valid = () => ({
    schemaVersion: 1,
    generatedAt: '2026-09-18T00:00:00.000Z',
    sourceCommit: 'a'.repeat(40),
    projects: [{
      id: 'qpu',
      label: 'QPU',
      repo: 'BPForbes/BPForbes.QPU.github.io',
      repoUrl: 'https://github.com/BPForbes/BPForbes.QPU.github.io',
      liveUrl: null,
      defaultBranch: 'main',
      description: null,
      createdAt: null,
      pushedAt: null,
      lastUpdated: '2026-09-18',
      latestCommit: { sha: 'b'.repeat(40), shortSha: 'bbbbbbb', date: '2026-09-18', url: 'https://example.invalid/c' },
      stats: { commits: 49 },
      languages: [{ name: 'TypeScript', bytes: 900, percentage: 100 }],
      milestones: [],
    }],
    untracked: [],
  });

  it('accepts a well-formed document', () => {
    assert.doesNotThrow(() => validatePortfolioMetadata(valid()));
  });

  it('rejects language percentages that do not come from one byte total', () => {
    const data = valid();
    data.projects[0].languages = [
      { name: 'TypeScript', bytes: 900, percentage: 60 },
      { name: 'CSS', bytes: 100, percentage: 10 },
    ];
    assert.throws(() => validatePortfolioMetadata(data), /sum to 70/);
  });

  it('rejects languages that are not sorted largest-first', () => {
    const data = valid();
    data.projects[0].languages = [
      { name: 'CSS', bytes: 100, percentage: 10 },
      { name: 'TypeScript', bytes: 900, percentage: 90 },
    ];
    assert.throws(() => validatePortfolioMetadata(data), /sorted from largest/);
  });

  it('rejects milestones that are not newest-first', () => {
    const data = valid();
    data.projects[0].milestones = [
      { kind: 'release', id: 'ver:1.0.0', version: '1.0.0', title: '1.0.0', date: '2026-01-01' },
      { kind: 'release', id: 'ver:2.0.0', version: '2.0.0', title: '2.0.0', date: '2026-06-01' },
    ];
    assert.throws(() => validatePortfolioMetadata(data), /ordered newest-first/);
  });

  it('rejects a negative or fractional statistic', () => {
    const data = valid();
    data.projects[0].stats = { commits: -1 };
    assert.throws(() => validatePortfolioMetadata(data), /non-negative integer/);
  });

  it('rejects duplicate project ids', () => {
    const data = valid();
    data.projects.push({ ...data.projects[0] });
    assert.throws(() => validatePortfolioMetadata(data), /duplicated/);
  });

  it('refuses anything credential-shaped', () => {
    const withToken = valid();
    withToken.projects[0].description = 'deploy key ghp_0123456789abcdefghijklmnopqrstuvwxyz';
    assert.throws(() => validatePortfolioMetadata(withToken), /must not contain a GitHub token/);

    const withEmail = valid();
    withEmail.projects[0].description = 'contact someone@example.com';
    assert.throws(() => validatePortfolioMetadata(withEmail), /must not contain email addresses/);

    const withSecret = valid();
    withSecret.projects[0].secret = 'x';
    assert.throws(() => validatePortfolioMetadata(withSecret), /credential-shaped/);
  });

  it('rejects a document with no projects at all', () => {
    const data = valid();
    data.projects = [];
    assert.throws(() => validatePortfolioMetadata(data), /non-empty array/);
  });
});

const base = 'https://api.github.com/repos/BPForbes/Demo';
const demoRoutes = {
  [base]: response({
    name: 'Demo',
    owner: { login: 'BPForbes' },
    default_branch: 'main',
    html_url: 'https://github.com/BPForbes/Demo',
    description: 'A demo',
    created_at: '2026-01-01T00:00:00Z',
    pushed_at: '2026-09-18T10:00:00Z',
  }),
  [`${base}/languages`]: response({ Rust: 900, SQL: 100 }),
  [`${base}/commits?sha=main&per_page=1`]: response(
    [{ sha: 'c'.repeat(40), commit: { committer: { date: '2026-09-18T09:00:00Z' } }, html_url: 'https://example.invalid/c' }],
    { headers: { link: '<https://api.github.com/x?per_page=1&page=24>; rel="last"' } },
  ),
  [`${base}/pulls?state=closed&per_page=100&page=1`]: response([
    { merged_at: '2026-09-01T00:00:00Z' },
    { merged_at: null },
  ]),
  [`${base}/pulls?state=all&per_page=1`]: response([{}], {
    headers: { link: '<https://api.github.com/x?per_page=1&page=21>; rel="last"' },
  }),
  [`${base}/releases?per_page=100&page=1`]: response([{
    tag_name: 'v1.2.0',
    name: 'Mailbox relay',
    published_at: '2026-09-02T00:00:00Z',
    html_url: 'https://github.com/BPForbes/Demo/releases/tag/v1.2.0',
    body: 'Sealed envelopes.',
    draft: false,
    prerelease: false,
  }]),
  [`${base}/tags?per_page=100&page=1`]: response([{ name: 'v1.2.0', commit: { sha: 'd'.repeat(40) } }]),
};

const demoProject = {
  id: 'demo',
  label: 'Demo',
  repo: 'BPForbes/Demo',
  liveUrl: null,
  metadataEnabled: true,
  milestones: [{ from: 'releases' }, { from: 'tags' }],
};

describe('collectProjectMetadata', () => {
  it('assembles statistics, languages and milestones from the API', async () => {
    const result = await collectProjectMetadata(demoProject, { token: 't', fetchImpl: fakeGithub(demoRoutes) });
    assert.equal(result.defaultBranch, 'main');
    assert.equal(result.lastUpdated, '2026-09-18');
    assert.equal(result.latestCommit.shortSha, 'ccccccc');
    assert.deepEqual(result.stats, { commits: 24, mergedPullRequests: 1, pullRequests: 21 });
    assert.deepEqual(result.languages.map((l) => l.percentage), [90, 10]);
    assert.equal(result.milestones.length, 1, 'the tag duplicating the release is dropped');
    assert.equal(result.milestones[0].title, 'Mailbox relay');
  });

  it('fails loudly when a repository reports no default branch', async () => {
    const broken = { ...demoRoutes, [base]: response({ name: 'Demo', owner: { login: 'BPForbes' } }) };
    await assert.rejects(
      collectProjectMetadata(demoProject, { token: 't', fetchImpl: fakeGithub(broken) }),
      /did not report a default branch/,
    );
  });

  it('fails loudly when a repository reports no commits', async () => {
    const broken = { ...demoRoutes, [`${base}/commits?sha=main&per_page=1`]: response([]) };
    await assert.rejects(
      collectProjectMetadata(demoProject, { token: 't', fetchImpl: fakeGithub(broken) }),
      /returned no commits/,
    );
  });

  it('turns a rate limit into an actionable message and no output', async () => {
    const limited = {
      ...demoRoutes,
      [`${base}/languages`]: response({}, {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1789000000' },
      }),
    };
    await assert.rejects(
      collectProjectMetadata(demoProject, { token: 't', fetchImpl: fakeGithub(limited) }),
      /rate limited/,
    );
  });

  it('distinguishes a permissions 403 from a rate limit', async () => {
    const forbidden = {
      ...demoRoutes,
      [`${base}/languages`]: response({}, { status: 403, headers: { 'x-ratelimit-remaining': '4999' } }),
    };
    await assert.rejects(
      collectProjectMetadata(demoProject, { token: 't', fetchImpl: fakeGithub(forbidden) }),
      /check the token's repository access/,
    );
  });
});

describe('generatePortfolioMetadata', () => {
  it('requires a token rather than silently falling back to 60 requests/hour', async () => {
    await assert.rejects(
      generatePortfolioMetadata({ registry: [{ id: 'x', label: 'X', repo: 'a/b', metadataEnabled: true }] }),
      /token is required/,
    );
  });

  it('records registry entries with no public repository instead of dropping them', async () => {
    const metadata = await generatePortfolioMetadata({
      token: 't',
      registry: [
        { id: 'emr', label: 'EMR', repo: null, metadataEnabled: false, note: 'Not public.' },
        { ...demoProject, milestones: [] },
      ],
      fetchImpl: fakeGithub(demoRoutes),
    });
    assert.deepEqual(metadata.projects.map((project) => project.id), ['demo']);
    assert.deepEqual(metadata.untracked, [{ id: 'emr', label: 'EMR', reason: 'Not public.' }]);
  });

  it('refuses a registry in which nothing is tracked, rather than shipping an empty site', async () => {
    await assert.rejects(generatePortfolioMetadata({
      token: 't',
      registry: [{ id: 'emr', label: 'EMR', repo: null, metadataEnabled: false }],
      fetchImpl: fakeGithub({}),
    }), /non-empty array/);
  });
});

describe('assemblePortfolioMetadata', () => {
  it('validates as it assembles, so a bad field cannot be written', () => {
    assert.throws(() => assemblePortfolioMetadata({
      projects: [{ id: 'x' }],
      generatedAt: '2026-09-18T00:00:00.000Z',
    }), /must be a non-empty string/);
  });
});
