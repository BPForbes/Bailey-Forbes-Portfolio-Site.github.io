import { PORTFOLIO } from "./data.js";
import { GENERATED_PROJECT_METADATA } from "./generated/projectMetadata.js";
import { languageColor } from "./languageColors.js";
function repositoryMetadata(project) {
  return GENERATED_PROJECT_METADATA.projects[project];
}
function languagesFor(project) {
  const generated = repositoryMetadata(project)?.languages;
  if (generated !== void 0 && generated.length > 0) {
    return generated.map((language) => ({
      name: language.name,
      pct: language.pct,
      color: languageColor(language.name)
    }));
  }
  return PORTFOLIO.languages[project];
}
function timelineEvents() {
  const curated = PORTFOLIO.events;
  const curatedKeys = /* @__PURE__ */ new Set();
  const newestCuratedByProject = /* @__PURE__ */ new Map();
  for (const event of curated) {
    curatedKeys.add(softKey(event));
    if (event.href !== void 0) {
      curatedKeys.add(`href:${event.href}`);
    }
    const covered = coverageEnd(event.date);
    const seen = newestCuratedByProject.get(event.project);
    if (seen === void 0 || covered > seen) {
      newestCuratedByProject.set(event.project, covered);
    }
  }
  const merged = [...curated];
  const generatedKeys = /* @__PURE__ */ new Set();
  for (const [, metadata] of Object.entries(GENERATED_PROJECT_METADATA.projects)) {
    if (metadata === void 0) {
      continue;
    }
    for (const event of metadata.generatedTimelineEvents) {
      const cutoff = newestCuratedByProject.get(event.project);
      if (cutoff !== void 0 && event.date <= cutoff) {
        continue;
      }
      const key = softKey(event);
      if (curatedKeys.has(key) || generatedKeys.has(key)) {
        continue;
      }
      if (event.href !== void 0 && curatedKeys.has(`href:${event.href}`)) {
        continue;
      }
      generatedKeys.add(key);
      merged.push({
        date: event.date,
        kind: event.kind,
        project: event.project,
        title: event.title,
        detail: event.detail,
        // The key the expanded card looks the full body up by. The body itself
        // is deliberately not here: it would be inlined into the module every
        // page imports, for text only an expanded card ever shows.
        ...event.identity !== void 0 ? { identity: event.identity } : {},
        ...event.href !== void 0 ? { href: event.href } : {}
      });
    }
  }
  return merged;
}
function coverageEnd(date) {
  return /^\d{4}-\d{2}$/.test(date) ? `${date}-31` : date;
}
function softKey(event) {
  const title = event.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${event.project}|${event.date}|${title}`;
}
function namedReleasesFor(project) {
  const generated = repositoryMetadata(project)?.namedReleases;
  if (generated !== void 0) {
    return generated;
  }
  return PORTFOLIO.namedReleases[project] ?? [];
}
function versionFor(project) {
  return repositoryMetadata(project)?.latestVersion;
}
function commitCountFor(project) {
  return repositoryMetadata(project)?.commitCount;
}
function mergedPullRequestsFor(project) {
  return repositoryMetadata(project)?.mergedPullRequestCount;
}
export {
  commitCountFor,
  languagesFor,
  mergedPullRequestsFor,
  namedReleasesFor,
  repositoryMetadata,
  timelineEvents,
  versionFor
};
