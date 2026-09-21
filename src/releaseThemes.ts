import type { ReleaseTheme, TimelineEvent } from "./types.js";

/**
 * Which scene the release explorer shows for an event it wasn't hand-tagged
 * for.
 *
 * Curated events (`src/data.ts`) carry a `theme` a person assigned after
 * reading what the entry actually says — that's a categorical judgment about
 * an already-published fact, and always wins outright (see `themeForEvent`
 * below). Generated events are auto-synced from GitHub daily with no human
 * in the loop, so there is nothing to hand-tag; this keyword table is a
 * best-effort *decorative* guess for those, not a claim about the project.
 * Getting one wrong picks the wrong background prop, not a wrong fact on the
 * page — the event's real title and detail text render unchanged either way.
 *
 * Order matters within a bucket only in that the first matching bucket in
 * iteration order wins when text matches more than one; buckets are ordered
 * roughly specific-to-general so e.g. "SQLite" (storage) is checked before a
 * more generic word could steer it elsewhere.
 */
const KEYWORDS: ReadonlyArray<readonly [ReleaseTheme, readonly string[]]> = [
  [
    "networking",
    [
      "wi-fi",
      "wifi",
      "wpa",
      "802.11",
      "nl80211",
      "dhcp",
      "dns",
      "tcp",
      "udp",
      "ipv4",
      "ipv6",
      "ndp",
      "arp",
      "icmp",
      "netdev",
      "portproxy",
      "macvlan",
      "networking",
      "network",
      "relay",
      "mailbox",
    ],
  ],
  [
    "quantum",
    ["qubit", "quantum", "gate", "circuit correction", "quantum instruction"],
  ],
  [
    "crypto",
    [
      "secret-sharing",
      "secret sharing",
      "quorum",
      "hardware key",
      "encrypt",
      "m-of-n",
      "signature",
    ],
  ],
  [
    "security",
    [
      "fs_jail",
      "audit",
      "authz",
      "authorization",
      "pbkdf2",
      "sudo",
      "su/",
      "login",
      "elevation",
      "hardening",
      "hipaa",
      "captcha",
    ],
  ],
  [
    "storage",
    ["sqlite", "fat32", "disk", "postgres", "database", "backup", "volume"],
  ],
  [
    "medical",
    ["patient", "nutrition", "hospital", "medical", "hipaa"],
  ],
  [
    "quantum",
    ["qpu", "workbench compile", "truth-table"],
  ],
  [
    "compute",
    ["scheduler", "mlq", "cpu", "thread-safe allocator", "neural", "moderation model"],
  ],
  [
    "community",
    ["chat", "room", "ticket", "mention", "tutoring", "discord", "community"],
  ],
  [
    "infrastructure",
    [
      "ci",
      "docker",
      "deploy",
      "pages",
      "workflow",
      "portfolio",
      "cloudflare",
      "server",
      "api",
      "endpoint",
    ],
  ],
];

/**
 * @returns The event's hand-tagged `theme` if it has one; otherwise the
 * first keyword bucket whose word appears in the title or detail,
 * case-insensitively; otherwise `"core"`. Pure — see
 * tests/releaseThemes.test.mjs.
 */
export function themeForEvent(event: TimelineEvent): ReleaseTheme {
  if (event.theme !== undefined) {
    return event.theme;
  }

  const haystack = `${event.title} ${event.detail}`.toLowerCase();
  for (const [theme, words] of KEYWORDS) {
    if (words.some((word) => haystack.includes(word))) {
      return theme;
    }
  }
  return "core";
}
