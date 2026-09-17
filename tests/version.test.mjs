import assert from "node:assert/strict";
import { test } from "node:test";

import {
  compareSemver,
  formatVersion,
  parseFlinstoneVer,
  parseSemver,
  pickLatestManifestVersion,
  pickLatestRelease,
  pickLatestTag,
  shortlistManifestFiles,
} from "../scripts/lib/version.mjs";

test("semver parses with and without a leading v", () => {
  assert.deepEqual(parseSemver("4.5.4"), {
    major: 4, minor: 5, patch: 4, prerelease: undefined, raw: "4.5.4",
  });
  assert.equal(parseSemver("v4.5.5").major, 4);
  assert.equal(parseSemver("v1.2.3-rc.1").prerelease, "rc.1");
});

test("non-versions are rejected rather than guessed at", () => {
  for (const value of ["nightly", "lab-2026-09", "", "4.5", "v", null, undefined, 42, {}]) {
    assert.equal(parseSemver(value), undefined, `should reject ${String(value)}`);
  }
});

test("a prerelease sorts below its own release", () => {
  const rc = parseSemver("5.0.0-rc.1");
  const ga = parseSemver("5.0.0");
  assert.ok(compareSemver(rc, ga) < 0);
  assert.ok(compareSemver(parseSemver("5.0.0"), parseSemver("4.9.9")) > 0);
  assert.equal(compareSemver(parseSemver("1.2.3"), parseSemver("v1.2.3")), 0);
});

test("the leading v is dropped for display unless the project keeps one", () => {
  assert.equal(formatVersion("v4.5.5"), "4.5.5");
  assert.equal(formatVersion("4.5.5"), "4.5.5");
  assert.equal(formatVersion("v4.5.5", "v"), "v4.5.5");
  assert.equal(formatVersion("4.5.5", "v"), "v4.5.5");
});

test("the newest published release wins, skipping drafts and prereleases", () => {
  const picked = pickLatestRelease([
    { tag_name: "v1.0.0", published_at: "2026-01-01T00:00:00Z", html_url: "https://github.com/o/r/releases/tag/v1.0.0" },
    { tag_name: "v2.0.0", published_at: "2026-02-01T00:00:00Z", html_url: "https://github.com/o/r/releases/tag/v2.0.0" },
    { tag_name: "v3.0.0", published_at: "2026-03-01T00:00:00Z", draft: true },
    { tag_name: "v2.5.0-rc.1", published_at: "2026-02-15T00:00:00Z", prerelease: true },
  ]);
  assert.equal(picked.version.raw, "v2.0.0");
  assert.equal(picked.date, "2026-02-01");
  assert.equal(picked.url, "https://github.com/o/r/releases/tag/v2.0.0");
});

test("an unpublished draft with an empty tag is not a version", () => {
  // This is QPU's actual /releases payload: one draft row, no tag.
  assert.equal(pickLatestRelease([{ tag_name: "", draft: true, prerelease: false, published_at: null }]), undefined);
});

test("a repository with no releases yields no version", () => {
  assert.equal(pickLatestRelease([]), undefined);
  assert.equal(pickLatestRelease(undefined), undefined);
  assert.equal(pickLatestRelease({ message: "Not Found" }), undefined);
});

test("only semver tags are treated as product versions", () => {
  assert.equal(pickLatestTag([{ name: "nightly" }, { name: "lab-2026-09" }]), undefined);
  assert.equal(pickLatestTag([{ name: "v1.0.0" }, { name: "v1.4.0" }, { name: "junk" }]).raw, "v1.4.0");
  assert.equal(pickLatestTag([]), undefined);
});

test("a Flinstone .ver row parses from its declared fields", () => {
  const version = parseFlinstoneVer(
    [
      "MAJOR_VERSION=5",
      "STANDARD_VERSION=0",
      "RELEASE_VERSION=0",
      "DESCRIPTION<<END",
      // The heredoc body may contain anything, including lines shaped like
      // fields. Parsing must stop before it.
      "MAJOR_VERSION=99",
      "5.0.0: a release summary",
      "END",
      "RELEASE_DATE=2026-09-17",
    ].join("\n"),
  );
  assert.equal(version.raw, "5.0.0");
});

test("an in-flight prerelease row is not the shipped version", () => {
  const version = parseFlinstoneVer(
    ["MAJOR_VERSION=6", "STANDARD_VERSION=0", "RELEASE_VERSION=0", "PRERELEASE=1", "GM=0"].join("\n"),
  );
  assert.equal(version, undefined);
});

test("malformed .ver bodies are rejected, not coerced to zero", () => {
  assert.equal(parseFlinstoneVer(""), undefined);
  assert.equal(parseFlinstoneVer("nothing useful here"), undefined);
  assert.equal(parseFlinstoneVer("MAJOR_VERSION=x\nSTANDARD_VERSION=0\nRELEASE_VERSION=0"), undefined);
  assert.equal(parseFlinstoneVer("MAJOR_VERSION=-1\nSTANDARD_VERSION=0\nRELEASE_VERSION=0"), undefined);
  assert.equal(parseFlinstoneVer(null), undefined);
});

test("the highest declared manifest version wins regardless of filename", () => {
  const version = pickLatestManifestVersion(
    [
      { name: "001_2_2_4_baseline.ver", text: "MAJOR_VERSION=2\nSTANDARD_VERSION=2\nRELEASE_VERSION=4" },
      // Filename says 4.5.4, contents say 5.0.0 — the contents decide.
      { name: "4_5_4_mislabelled.ver", text: "MAJOR_VERSION=5\nSTANDARD_VERSION=0\nRELEASE_VERSION=0" },
    ],
    "flinstone-ver",
  );
  assert.equal(version.raw, "5.0.0");
});

test("the manifest shortlist ranks by embedded semver, newest first", () => {
  const names = [
    "001_2_2_4_baseline.ver",
    "4_5_4_lab_relay_identity.ver",
    "5_0_0_project_metadata_contract.ver",
    "3_3_0_contracts_jail_audit.ver",
    "ABOUT.txt",
  ];
  const shortlist = shortlistManifestFiles(names, "flinstone-ver", 2);
  assert.deepEqual(shortlist, ["5_0_0_project_metadata_contract.ver", "4_5_4_lab_relay_identity.ver"]);
  assert.ok(!shortlist.includes("ABOUT.txt"));
});

test("an unknown manifest format degrades to no version", () => {
  assert.deepEqual(shortlistManifestFiles(["a.ver"], "not-a-format"), []);
  assert.equal(pickLatestManifestVersion([{ name: "a", text: "x" }], "not-a-format"), undefined);
});
