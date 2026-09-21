const KEYWORDS = [
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
      "mailbox"
    ]
  ],
  [
    "quantum",
    ["qubit", "quantum", "gate", "circuit correction", "quantum instruction"]
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
      "signature"
    ]
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
      "captcha"
    ]
  ],
  [
    "storage",
    ["sqlite", "fat32", "disk", "postgres", "database", "backup", "volume"]
  ],
  [
    "medical",
    ["patient", "nutrition", "hospital", "medical", "hipaa"]
  ],
  [
    "quantum",
    ["qpu", "workbench compile", "truth-table"]
  ],
  [
    "compute",
    ["scheduler", "mlq", "cpu", "thread-safe allocator", "neural", "moderation model"]
  ],
  [
    "community",
    ["chat", "room", "ticket", "mention", "tutoring", "discord", "community"]
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
      "endpoint"
    ]
  ]
];
function themeForEvent(event) {
  if (event.theme !== void 0) {
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
export {
  themeForEvent
};
