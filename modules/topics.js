const TOPICS = [
  { id: "c", label: "C", kind: "language" },
  { id: "assembly", label: "Assembly", kind: "language" },
  { id: "rust", label: "Rust", kind: "language" },
  { id: "typescript", label: "TypeScript", kind: "language" },
  { id: "csharp", label: "C#", kind: "language" },
  { id: "kotlin", label: "Kotlin", kind: "language" },
  { id: "java", label: "Java", kind: "language" },
  { id: "react", label: "React", kind: "platform" },
  { id: "postgresql", label: "PostgreSQL", kind: "platform" },
  { id: "sqlite", label: "SQLite", kind: "platform" },
  { id: "firebase", label: "Firebase", kind: "platform" },
  { id: "docker", label: "Docker", kind: "platform" },
  { id: "webassembly", label: "WebAssembly", kind: "platform" },
  { id: "cloudflare", label: "Cloudflare", kind: "platform" },
  { id: "systems", label: "Systems programming", kind: "practice" },
  { id: "networking", label: "Networking", kind: "practice" },
  { id: "security", label: "Security", kind: "practice" },
  { id: "sysadmin", label: "System administration", kind: "practice" },
  { id: "ci-cd", label: "CI/CD", kind: "practice" },
  { id: "machine-learning", label: "Machine learning", kind: "practice" },
  { id: "compilers", label: "Compilers", kind: "practice" },
  { id: "quantum", label: "Quantum computing", kind: "practice" }
];
const TOPIC_KIND_LABELS = {
  language: "Languages",
  platform: "Platforms",
  practice: "Practice"
};
const BY_ID = new Map(TOPICS.map((topic) => [topic.id, topic]));
function topicById(id) {
  return BY_ID.get(id);
}
function matchesSelection(itemTopics, selected) {
  if (selected.size === 0) return true;
  for (const topic of itemTopics) {
    if (selected.has(topic)) return true;
  }
  return false;
}
function parseTopicsParam(search) {
  const raw = new URLSearchParams(search).get("topics");
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((part) => part.trim().toLowerCase()));
  return TOPICS.filter((topic) => wanted.has(topic.id)).map((topic) => topic.id);
}
function serializeTopics(selected) {
  return TOPICS.filter((topic) => selected.has(topic.id)).map((topic) => topic.id).join(",");
}
function plural(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
function topicsOf(item) {
  return Array.from(item.querySelectorAll(".chip[data-topic]")).map((chip) => chip.dataset.topic ?? "").filter((id) => BY_ID.has(id));
}
function mountTopicFilters() {
  const mounts = Array.from(document.querySelectorAll("[data-topic-filter]"));
  const items = Array.from(document.querySelectorAll("[data-filter-item]"));
  if (mounts.length === 0 || items.length === 0) return;
  const itemTopics = new Map(items.map((item) => [item, topicsOf(item)]));
  const counts = /* @__PURE__ */ new Map();
  for (const topics of itemTopics.values()) {
    for (const id of new Set(topics)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const present = TOPICS.filter((topic) => counts.has(topic.id));
  if (present.length === 0) return;
  const groups = Array.from(document.querySelectorAll("[data-filter-group]")).map((group) => {
    const empty = document.createElement("p");
    empty.className = "filter-empty";
    empty.hidden = true;
    empty.textContent = group.dataset.filterEmpty ?? "Nothing here matches the selected topics.";
    group.after(empty);
    return {
      group,
      empty,
      noun: group.dataset.filterNoun ?? "item",
      members: items.filter((item) => group.contains(item))
    };
  });
  const selected = new Set(parseTopicsParam(window.location.search).filter((id) => counts.has(id)));
  const buttons = [];
  const statuses = [];
  const clears = [];
  const summaries = [];
  const apply = (announce) => {
    for (const [item, topics] of itemTopics) {
      item.hidden = !matchesSelection(topics, selected);
      item.querySelectorAll(".chip[data-topic]").forEach((chip) => {
        chip.toggleAttribute("data-match", selected.has(chip.dataset.topic ?? ""));
      });
    }
    for (const { members, empty } of groups) {
      empty.hidden = selected.size === 0 || members.some((item) => !item.hidden);
    }
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(selected.has(button.dataset.topicToggle ?? "")));
    }
    for (const clear of clears) clear.disabled = selected.size === 0;
    for (const summary of summaries) {
      summary.textContent = selected.size === 0 ? "" : `${selected.size} selected`;
    }
    if (announce) {
      const labels = TOPICS.filter((topic) => selected.has(topic.id)).map((topic) => topic.label);
      const parts = groups.filter(({ members }) => members.length > 0).map(({ members, noun }) => `${members.filter((item) => !item.hidden).length} of ${plural(members.length, noun)}`);
      const text = selected.size === 0 ? "Showing everything." : `Showing ${parts.join(" and ")} tagged ${labels.join(" or ")}.`;
      for (const status of statuses) status.textContent = text;
    }
    const url = new URL(window.location.href);
    const value = serializeTopics(selected);
    if (value) url.searchParams.set("topics", value);
    else url.searchParams.delete("topics");
    const href = url.href.replace(/%2C/gi, ",");
    if (href !== window.location.href) window.history.replaceState(null, "", href);
  };
  const wide = window.matchMedia("(min-width: 56rem)").matches;
  mounts.forEach((mount, mountIndex) => {
    const disclosure = document.createElement("details");
    disclosure.className = "topic-disclosure";
    disclosure.open = wide || selected.size > 0;
    const summary = document.createElement("summary");
    summary.className = "topic-summary";
    summary.innerHTML = `<span class="disclosure-toggle" aria-hidden="true"></span><span>Choose topics</span><span class="topic-selected"></span>`;
    summaries.push(summary.querySelector(".topic-selected"));
    const body = document.createElement("div");
    body.className = "topic-filter-body";
    for (const kind of Object.keys(TOPIC_KIND_LABELS)) {
      const ofKind = present.filter((topic) => topic.kind === kind);
      if (ofKind.length === 0) continue;
      const labelId = `topic-kind-${kind}-${mountIndex}`;
      const group = document.createElement("div");
      group.className = "topic-group";
      group.setAttribute("role", "group");
      group.setAttribute("aria-labelledby", labelId);
      const label = document.createElement("p");
      label.className = "topic-group-label";
      label.id = labelId;
      label.textContent = TOPIC_KIND_LABELS[kind];
      const list = document.createElement("div");
      list.className = "topic-options";
      for (const topic of ofKind) {
        const count = counts.get(topic.id) ?? 0;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "topic-btn";
        button.dataset.topicToggle = topic.id;
        button.setAttribute("aria-pressed", "false");
        button.innerHTML = `<span class="topic-btn-label"></span><span class="topic-count" aria-hidden="true">${count}</span><span class="visually-hidden">, ${plural(count, "item")}</span>`;
        button.querySelector(".topic-btn-label").textContent = topic.label;
        button.addEventListener("click", () => {
          if (selected.has(topic.id)) selected.delete(topic.id);
          else selected.add(topic.id);
          apply(true);
        });
        buttons.push(button);
        list.appendChild(button);
      }
      group.append(label, list);
      body.appendChild(group);
    }
    disclosure.append(summary, body);
    const footer = document.createElement("div");
    footer.className = "topic-filter-footer";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn btn-ghost topic-clear";
    clear.textContent = "Clear topics";
    clear.addEventListener("click", () => {
      selected.clear();
      apply(true);
      buttons[0]?.focus();
    });
    clears.push(clear);
    const status = document.createElement("p");
    status.className = "topic-status";
    status.setAttribute("role", "status");
    statuses.push(status);
    footer.append(clear, status);
    mount.append(disclosure, footer);
    mount.hidden = false;
  });
  apply(selected.size > 0);
}
export {
  TOPICS,
  TOPIC_KIND_LABELS,
  matchesSelection,
  mountTopicFilters,
  parseTopicsParam,
  serializeTopics,
  topicById
};
