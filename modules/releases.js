import { icon } from "./icons.js";
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return void 0;
  }
  const [, year, month, day] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}
function formatReleaseDate(startDate, endDate) {
  const start = parseIsoDate(startDate);
  if (!start) {
    return startDate;
  }
  const startMonth = MONTHS[start.month - 1] ?? String(start.month);
  if (endDate === null) {
    return `${startMonth} ${start.day}, ${start.year}`;
  }
  const end = parseIsoDate(endDate);
  if (!end) {
    return `${startMonth} ${start.day}, ${start.year}`;
  }
  const endMonth = MONTHS[end.month - 1] ?? String(end.month);
  if (start.year === end.year && start.month === end.month) {
    return `${startMonth} ${start.day}\u2013${end.day}, ${start.year}`;
  }
  if (start.year === end.year) {
    return `${startMonth} ${start.day} \u2013 ${endMonth} ${end.day}, ${start.year}`;
  }
  return `${startMonth} ${start.day}, ${start.year} \u2013 ${endMonth} ${end.day}, ${end.year}`;
}
function renderRow(release) {
  const item = document.createElement("li");
  item.className = "release-row";
  const details = document.createElement("details");
  details.className = "release-disclosure";
  const summary = document.createElement("summary");
  summary.className = "release-summary";
  const marker = document.createElement("span");
  marker.className = "release-marker";
  marker.innerHTML = icon("tag");
  const main = document.createElement("span");
  main.className = "release-main";
  const versionDate = document.createElement("span");
  versionDate.className = "release-version-date";
  const version = document.createElement("span");
  version.className = "release-version";
  version.textContent = release.version;
  const date = document.createElement("span");
  date.className = "release-date";
  date.textContent = formatReleaseDate(release.startDate, release.endDate);
  versionDate.append(version, date);
  const summaryText = document.createElement("span");
  summaryText.className = "release-summary-text";
  summaryText.textContent = release.summary;
  main.append(versionDate, summaryText);
  const toggle = document.createElement("span");
  toggle.className = "release-toggle";
  toggle.setAttribute("aria-hidden", "true");
  summary.append(marker, main, toggle);
  const body = document.createElement("div");
  body.className = "release-body";
  const description = document.createElement("p");
  description.textContent = release.description;
  const link = document.createElement("a");
  link.className = "release-link";
  link.href = release.url;
  link.innerHTML = `View release ${icon("arrow-right")}`;
  body.append(description, link);
  details.append(summary, body);
  item.append(details);
  return item;
}
function mountNamedReleases(releasesFor, root = document) {
  root.querySelectorAll("[data-named-releases]").forEach((mount) => {
    const releases = releasesFor(mount);
    if (releases.length === 0) {
      return;
    }
    const list = document.createElement("ol");
    list.className = "release-list";
    for (const release of releases) {
      list.appendChild(renderRow(release));
    }
    mount.replaceChildren(list);
  });
}
export {
  mountNamedReleases
};
