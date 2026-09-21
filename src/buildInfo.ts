/**
 * When this build of the site was published.
 *
 * The site is static: every deploy is a push to `main` running
 * .github/workflows/static.yml, which builds and then uploads the tree to
 * GitHub Pages. So the moment the bundle is built IS the moment the published
 * site changes, and tools/build.mjs stamps it in as a compile-time constant.
 *
 * Stamped rather than fetched, because a date is not worth a request — and
 * asking api.github.com for it at runtime would put a third-party call on
 * every page load, which DESIGN.md R29 does not allow.
 *
 * The constant only exists in the bundled output. The unbundled emit in
 * modules/ is built without it so that file stays byte-identical between
 * builds and does not churn in git; `typeof` on an undeclared name is defined
 * behaviour in JavaScript, so that build reads undefined here rather than
 * throwing.
 */
declare const __SITE_PUBLISHED_AT__: string | undefined;

/** @returns The build's publish instant as an ISO 8601 string, if stamped. */
export function publishedAt(): string | undefined {
  return typeof __SITE_PUBLISHED_AT__ === "string" ? __SITE_PUBLISHED_AT__ : undefined;
}
