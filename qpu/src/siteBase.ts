/**
 * Portfolio-hosted workbench prefix.
 *
 * The circuit playground is built into `/workbench/` on
 * bailey-forbes.com so the live lab iframe can load a same-origin
 * copy instead of the stacked-page GitHub Pages guest.
 */
export const GITHUB_PAGES_BASE = '/workbench/';

export const resolveAppBase = (options: {
  command: 'build' | 'serve';
  isPreview?: boolean;
}): string => (
  options.command === 'build' || options.isPreview ? GITHUB_PAGES_BASE : '/'
);
