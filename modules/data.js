const PORTFOLIO = {
  compiled: "2026-09-16",
  source: "Public git history, merged pull requests, and version/entries release notes on github.com/BPForbes",
  projects: {
    emr: "Electronic medical record",
    "homework-central": "Homework Central",
    flinstone: "Flinstone Kernel",
    keyquorum: "KeyQuorum",
    qpu: "QPU"
  },
  projectOrder: [
    "emr",
    "qpu",
    "flinstone",
    "homework-central",
    "keyquorum"
  ],
  languages: {
    emr: [
      { name: "Kotlin", pct: 40, color: "#A97BFF" },
      { name: "Java", pct: 35, color: "#b07219" },
      { name: "Firebase / REST", pct: 25, color: "#FFA000" }
    ],
    "homework-central": [
      { name: "C#", pct: 58.9, color: "#512bd4" },
      { name: "TypeScript", pct: 26.1, color: "#3178c6" },
      { name: "CSS", pct: 7.6, color: "#c98a4a" },
      { name: "PowerShell", pct: 3.8, color: "#5391FE" },
      { name: "Shell", pct: 3.5, color: "#7ea36a" }
    ],
    flinstone: [
      { name: "C", pct: 80.9, color: "#555555" },
      { name: "Shell", pct: 5.7, color: "#7ea36a" },
      { name: "Assembly", pct: 4.1, color: "#c98a4a" },
      { name: "JavaScript", pct: 4.1, color: "#f1e05a" },
      { name: "Python", pct: 2.8, color: "#3572A5" },
      { name: "C++", pct: 1.8, color: "#f34b7d" }
    ],
    keyquorum: [
      { name: "Rust", pct: 96.5, color: "#dea584" },
      { name: "SQL", pct: 3.5, color: "#e38c00" }
    ],
    qpu: [
      { name: "TypeScript", pct: 92.4, color: "#3178c6" },
      { name: "CSS", pct: 6.1, color: "#c98a4a" },
      { name: "JavaScript", pct: 0.8, color: "#f1e05a" },
      { name: "HTML", pct: 0.7, color: "#e34c26" }
    ]
  },
  events: [
    {
      date: "2021-08",
      kind: "release",
      project: "emr",
      title: "Planning and proof of concept",
      detail: "Engagement opens for an organization serving 26 hospital locations. August is planning and a PoC: scope Kotlin patient services, Java staff APIs, Firebase, and the move off spreadsheet workflows.",
      theme: "medical"
    },
    {
      date: "2021-10",
      kind: "feature",
      project: "emr",
      title: "Initial front end",
      detail: "September\u2013October: first client-facing UI, including login and the screens that sit on top of the PoC.",
      theme: "security"
    },
    {
      date: "2021-12",
      kind: "feature",
      project: "emr",
      title: "Client full stack",
      detail: "Remainder of 2021 is client-based end-to-end work \u2014 PPI and patient workflow records, Firebase persistence, and Kotlin patient services \u2014 rather than staff operations.",
      theme: "medical"
    },
    {
      date: "2022-02",
      kind: "feature",
      project: "emr",
      title: "Staff-side services",
      detail: "January\u2013February is primarily staff-based: Java staff endpoints, credentials, and the operational side of the record system.",
      theme: "infrastructure"
    },
    {
      date: "2022-03",
      kind: "feature",
      project: "emr",
      title: "Wiring client and staff",
      detail: "March into April connects the two stacks: client/patient flows and staff credentials share the same records and permissions.",
      theme: "infrastructure"
    },
    {
      date: "2022-04",
      kind: "feature",
      project: "emr",
      title: "HIPAA drill and hardening",
      detail: "Security and documentation ran the whole engagement; April is when HIPAA was drilled in earnest. April\u2013May concentrates on securing paths, backups, and automated checks.",
      theme: "security"
    },
    {
      date: "2022-05",
      kind: "release",
      project: "emr",
      title: "Sponsor handoff",
      detail: "May closes securing and transfers administrative ownership after onboarding. Team measured about 60% improvement in record-processing efficiency versus the spreadsheet baseline.",
      theme: "medical"
    },
    {
      date: "2025-05-28",
      kind: "release",
      project: "flinstone",
      title: "Flinstone repository created",
      detail: "Bailey-Forbes-Flinstone starts as a C filesystem and shell with hardware-level disk operations. This becomes the long-running kernel line.",
      theme: "storage",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone"
    },
    {
      date: "2025-09",
      kind: "feature",
      project: "homework-central",
      title: "Baker Hill internship",
      detail: "C#/.NET and TypeScript production work on loan-origination systems. NuComply integration is separated from HTTP transport and cut from months to days.",
      theme: "infrastructure"
    },
    {
      date: "2026-02-14",
      kind: "feature",
      project: "flinstone",
      title: "OS transformation wave",
      detail: "ASM memory layer, design-pattern file manager, drivers, thread-safe allocator, embedded x86 VM, MLQ scheduler, and unified x86-64/AArch64 driver API.",
      theme: "compute"
    },
    {
      date: "2026-04-12",
      kind: "feature",
      project: "flinstone",
      title: "Memory-safety and bare-metal pass",
      detail: "Six memory-safety bugs closed; layered driver model and architecture checks land on develop/main.",
      theme: "compute"
    },
    {
      date: "2026-05-07",
      kind: "feature",
      project: "flinstone",
      title: "WebAssembly host",
      detail: "Emscripten build embeds the VM in-page, with async stdin and interactive-mode fixes.",
      theme: "compute"
    },
    {
      date: "2026-05-11",
      kind: "release",
      project: "flinstone",
      title: "2.2.4 \u2192 3.2.0 version train",
      detail: "Semver lock files, FAT32 host volumes, AArch64 Makefile defaults for Raspberry Pi, FAT32-backed shell history, and cursor editing.",
      theme: "storage"
    },
    {
      date: "2026-05-12",
      kind: "release",
      project: "flinstone",
      title: "3.3.0 contracts, jail, audit",
      detail: "Versioned subsystem contracts, fs_jail discipline, and a post-exec audit log split from FL1 command history.",
      theme: "security"
    },
    {
      date: "2026-05-18",
      kind: "release",
      project: "flinstone",
      title: "4.0.0 system contracts",
      detail: "Major release: inheritable P0\u2013P9 contracts for foundations, runtime, identity, networking, drivers, storage, observability, operations, virtualization, and hardening.",
      theme: "core"
    },
    {
      date: "2026-05-19",
      kind: "release",
      project: "flinstone",
      title: "4.0.1 host hardening",
      detail: "Serial Makefile default, IPC errno semantics, VFS/FAT32 overflow guards, shell pool lifecycle, and PIC EOI fixes.",
      theme: "security"
    },
    {
      date: "2026-05-23",
      kind: "release",
      project: "flinstone",
      title: "4.1.0 identity and auth",
      detail: "SQLite user_db, PBKDF2 passwords, login/su/sudo, elevation pool, fs_jail elevation checks, and P0\u2013P2 integration.",
      theme: "security"
    },
    {
      date: "2026-05-24",
      kind: "release",
      project: "flinstone",
      title: "4.1.1 issue sweep",
      detail: "GM=1 BUILD 3 closes GitHub issues #169\u2013#222: ARM ABI, session hardening, batch argv clamps, SHA-256 dep fetches, threadpool OOM paths.",
      theme: "security"
    },
    {
      date: "2026-06-07",
      kind: "release",
      project: "homework-central",
      title: "Homework Central repository",
      detail: "Public repo opens for a purpose-built replacement of a 16,000-member Discord community.",
      theme: "community",
      href: "https://github.com/BPForbes/Homework-Central"
    },
    {
      date: "2026-06-08",
      kind: "release",
      project: "qpu",
      title: "QPU browser workbench",
      detail: "BPForbes.QPU.github.io (moved from BPForbes.github.io) ships a TypeScript/React circuit workbench: AST compiler, hamburger file tools, .qpucir storage, and PDF docs on Pages.",
      theme: "quantum",
      href: "https://github.com/BPForbes/BPForbes.QPU.github.io"
    },
    {
      date: "2026-06-09",
      kind: "feature",
      project: "qpu",
      title: "Circuit Correction Lab",
      detail: "Truth-table module tests, local Ollama correction, catalog downloads, and later partial truth tables plus a custom-gate engine.",
      theme: "quantum"
    },
    {
      date: "2026-06-19",
      kind: "release",
      project: "flinstone",
      title: "4.2.0 P3 networking",
      detail: "netdev, TAP, ARP, IPv4/IPv6, UDP/TCP shims, DNS, DHCP, Wi-Fi station, multi-device chat server, and WSL/Linux hosting. Latest GM main promote.",
      theme: "networking"
    },
    {
      date: "2026-06-27",
      kind: "feature",
      project: "homework-central",
      title: "Login and RBAC",
      detail: "PR #3: React/C# login with a role-based permission model. PR #4 the next day encodes permissions as bitmasks.",
      theme: "security"
    },
    {
      date: "2026-06-28",
      kind: "feature",
      project: "homework-central",
      title: "One-command Docker stack",
      detail: "run-dev scripts start Postgres, FCaptcha, the ASP.NET API, and the Vite frontend. Visual Studio F5 integration follows.",
      theme: "infrastructure"
    },
    {
      date: "2026-06-30",
      kind: "feature",
      project: "homework-central",
      title: ".NET 10 and tenant isolation",
      detail: "Upgrade to .NET 10.0.301, GitHub Actions CI, and per-developer tenant databases for /devlogin.",
      theme: "infrastructure"
    },
    {
      date: "2026-07-01",
      kind: "feature",
      project: "homework-central",
      title: "Chat rooms and visibility",
      detail: "Resource visibility primitive and chat-room access model (issue #10 / PR #12). Typing, reconnect, and seed-gate fixes land the same week.",
      theme: "community"
    },
    {
      date: "2026-07-04",
      kind: "feature",
      project: "homework-central",
      title: "Captcha and self-serve roles",
      detail: "Signup/dashboard FCaptcha verification and a Get Roles room. Docker image builds are optimized.",
      theme: "security"
    },
    {
      date: "2026-07-08",
      kind: "feature",
      project: "homework-central",
      title: "Mentions, inbox, custom roles",
      detail: "Mentions with cooldowns, inbox bulk delete, role colors, @ autocomplete, and infrastructure permission fixes.",
      theme: "community"
    },
    {
      date: "2026-07-15",
      kind: "feature",
      project: "homework-central",
      title: "Water-theme UI redesign",
      detail: "Persistent navigation, admin rail, custom channels, and a Preview editor gate rebase onto main (#47).",
      theme: "community"
    },
    {
      date: "2026-07-16",
      kind: "feature",
      project: "homework-central",
      title: "Tickets, media, Trial Tutor",
      detail: "PR #50 adds moderation tickets, media, votes, Trial Tutor, and an assessment pipeline \u2014 the Discord-replacement surface.",
      theme: "community"
    },
    {
      date: "2026-07-21",
      kind: "feature",
      project: "homework-central",
      title: "Moderation neural net",
      detail: "CPU ChatMonitor models, tutor subject processor, concurrent ticket generation, and training-session removal. Resume cites 35,600+ trainable weights.",
      theme: "compute"
    },
    {
      date: "2026-07-23",
      kind: "feature",
      project: "homework-central",
      title: "2D neural mesh and faster training",
      detail: "Mesh slices, worker projection, Kubernetes training/viz split, and fewer LLM round-trips for synthetic sessions.",
      theme: "compute"
    },
    {
      date: "2026-08-05",
      kind: "feature",
      project: "homework-central",
      title: "Live audit and weight UX",
      detail: "Single training LLM per NN session, live audit/weight UI, plus CodeQL and OOM fixes.",
      theme: "compute"
    },
    {
      date: "2026-08-24",
      kind: "release",
      project: "keyquorum",
      title: "KeyQuorum scaffolding",
      detail: "SQLite schema, password manager, expiring share links, password-locked files, then a hardened CLI the same day.",
      theme: "storage",
      href: "https://github.com/BPForbes/KeyQuorum"
    },
    {
      date: "2026-08-25",
      kind: "feature",
      project: "keyquorum",
      title: "Hardware-key registry and recursive splits",
      detail: "Key generation/register, M-of-N trees, signature verification, export bundles, PIN unlock windows.",
      theme: "crypto"
    },
    {
      date: "2026-08-30",
      kind: "feature",
      project: "keyquorum",
      title: "Arena tree and bridges",
      detail: "LCA reconstruct, cross-branch bridges, PSS eviction, then private sign bridges across independent stores.",
      theme: "crypto"
    },
    {
      date: "2026-09-01",
      kind: "feature",
      project: "keyquorum",
      title: "Mailbox relay",
      detail: "Axum mailbox with API keys is introduced, reverted, then re-landed with hardened merge, URL, and store integrity checks.",
      theme: "networking"
    },
    {
      date: "2026-09-02",
      kind: "feature",
      project: "keyquorum",
      title: "Provider trust and TTL",
      detail: "Date-based TTL for files, signed provider certificates, and a decision to drop network presence checks from the product.",
      theme: "crypto"
    },
    {
      date: "2026-09-08",
      kind: "feature",
      project: "homework-central",
      title: "Training pause and DevOps gates",
      detail: "Continuous training can pause without resetting the ticket cursor. DevOps thought files and CodeRabbit CLI gates land around it.",
      theme: "infrastructure"
    },
    {
      date: "2026-09-13",
      kind: "release",
      project: "flinstone",
      title: "4.3.0 production Wi-Fi",
      detail: "Closes the P3-10 and P4-01 station path: in-tree 802.11ax drivers, WPA2 and WPA3-SAE supplication, management-frame and EAPOL over-the-air transport, FullMAC and nl80211 backends, ESP AT over UART, TWT negotiation, and post-association DHCP.",
      theme: "networking",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/0dec66f"
    },
    {
      date: "2026-09-13",
      kind: "release",
      project: "flinstone",
      title: "4.4.0 browser-kernel contract",
      detail: "A schema-versioned P8 browser-kernel artifact contract, an architecture compatibility audit, a static lab harness, and a fail-closed v86/QEMU serial-marker CI promotion gate \u2014 without claiming v86 compatibility before a freestanding boot path existed.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/332fea9"
    },
    {
      date: "2026-09-14",
      kind: "release",
      project: "flinstone",
      title: "4.5.0 freestanding boot boundary",
      detail: "A fail-closed x86-64 freestanding BIOS boot candidate with long-mode entry, lab identity, concurrent sessions, keyboard and VGA validation, and a main-only Pages deploy of the validated lab. The entry is explicit that the guest is not the hosted ELF: filesystem, networking and server stay unavailable.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/55c5fff"
    },
    {
      date: "2026-09-14",
      kind: "feature",
      project: "flinstone",
      title: "4.5.1 relay CI and Cloudflare lab",
      detail: "Waits for the hub listen port before the WebSocket connect so relay CI stops flaking, documents the portfolio iframe integration, and ships Cloudflare Worker artifacts for first-visit lab boot on bailey-forbes.com.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/73e39e5"
    },
    {
      date: "2026-09-15",
      kind: "feature",
      project: "flinstone",
      title: "4.5.2 QMP cont timeout",
      detail: "Fixes the published lab\u2019s \u201CQEMU command timed out: cont\u201D. Resume is ignored unless the guest is paused, QMP commands are serialized so cont cannot race an in-flight VGA dump, and the guest shell runs every hosted verb as a lab analog.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/3f04eaf"
    },
    {
      date: "2026-09-15",
      kind: "feature",
      project: "flinstone",
      title: "4.5.3 guest DNS and lab chrome",
      detail: "Guest DNS prefers same-origin /lab-dns and only falls back to Cloudflare DoH when that path is missing, so ping works both locally and on Pages behind the isolation service worker. Lab chrome moves to a frosted window with a 24-bit VGA palette.",
      theme: "networking",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/ce8d63e"
    },
    {
      date: "2026-09-15",
      kind: "release",
      project: "flinstone",
      title: "4.5.4 Emscripten shell and shared relay",
      detail: "The default lab boots a sandboxed Emscripten Flinstone Shell, so su, useradd, sessions and server chat map onto the same identity and relay. Visitors auto-join a shared room backed by a Cloudflare Durable Object, falling back to same-origin BroadcastChannel if the hub is down. Latest GM promote on main.",
      theme: "networking",
      href: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/commit/da46784"
    },
    {
      date: "2026-09-12",
      kind: "feature",
      project: "qpu",
      title: "Pages recovery and embed mode",
      detail: "Fixes the white screen the repository rename left on GitHub Pages, then adds a compact embed mode so the workbench can be hosted inside a portfolio guest window rather than only run standalone.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/BPForbes.QPU.github.io/commit/da9f3e8"
    },
    {
      date: "2026-09-13",
      kind: "release",
      project: "qpu",
      title: "Textbook circuits and Play Sequence",
      detail: "Ships a set of textbook circuits, a Play Sequence runner that steps a circuit gate by gate, and vertical scrubbing through the playground.",
      theme: "quantum",
      href: "https://github.com/BPForbes/BPForbes.QPU.github.io/commit/56d04a1"
    },
    {
      date: "2026-09-13",
      kind: "feature",
      project: "qpu",
      title: "Mobile-safe playground routes",
      detail: "Splits the playground into separate routes that survive a narrow viewport, then adds horizontal scrolling across those pages so a wide circuit stays reachable on a phone.",
      theme: "infrastructure",
      href: "https://github.com/BPForbes/BPForbes.QPU.github.io/commit/6a34025"
    },
    {
      date: "2026-09-13",
      kind: "feature",
      project: "qpu",
      title: "Circuit protocol reference",
      detail: "Expands the QPU circuit protocol PDF reference that ships with the workbench.",
      theme: "quantum",
      href: "https://github.com/BPForbes/BPForbes.QPU.github.io/commit/87b77d4"
    }
  ],
  namedReleases: {
    flinstone: [
      {
        id: "2-2-4-3-2-3",
        version: "2.2.4 \u2013 3.2.3",
        startDate: "2026-05-11",
        endDate: "2026-05-12",
        summary: "Shell \xB7 FAT32 \xB7 AArch64 \xB7 disk history",
        description: "Syscall-style shell dispatch, FAT32 host volumes, AArch64/Pi defaults, disk-backed history, OS roadmap.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "3-3-0",
        version: "3.3.0",
        startDate: "2026-05-12",
        endDate: null,
        summary: "fs_jail \xB7 audit \xB7 FL1 history",
        description: "Contract surfaces for fs_jail and audit; FL1 history vs post-exec audit log.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-0-0-4-0-1",
        version: "4.0.0 / 4.0.1",
        startDate: "2026-05-18",
        endDate: "2026-05-19",
        summary: "Contracts \xB7 IPC/VFS \xB7 serial-j1",
        description: "Inheritable system contracts; then IPC/VFS/shell hardening and serial -j1 default builds.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-1-0-4-1-1",
        version: "4.1.0 / 4.1.1",
        startDate: "2026-05-23",
        endDate: "2026-05-24",
        summary: "Identity \xB7 su/sudo \xB7 issue sweep",
        description: "Identity stack; then issues #169-#222 (ARM ABI, sessions, batch argv, SHA-256 fetches, threadpool).",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-2-0",
        version: "4.2.0",
        startDate: "2026-06-19",
        endDate: null,
        summary: "P3 networking \xB7 WSL \xB7 Linux hosting",
        description: "P3 networking, server foundations, WSL and native Linux integration.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-3-0",
        version: "4.3.0",
        startDate: "2026-09-13",
        endDate: null,
        summary: "Wi-Fi \xB7 WPA2/WPA3-SAE \xB7 nl80211",
        description: "Production Wi-Fi: 802.11ax drivers, WPA2 and WPA3-SAE supplication, FullMAC and nl80211 backends, TWT, and post-association DHCP.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-4-0",
        version: "4.4.0",
        startDate: "2026-09-14",
        endDate: null,
        summary: "Browser-kernel contract \xB7 CI gate",
        description: "Schema-versioned P8 browser-kernel artifact contract, a static lab harness, and a fail-closed CI promotion gate.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-5-0",
        version: "4.5.0",
        startDate: "2026-09-14",
        endDate: null,
        summary: "Freestanding boot \xB7 lab identity",
        description: "Freestanding x86-64 BIOS boot candidate with long-mode entry, lab identity, and concurrent sessions. States plainly that the guest is not the hosted ELF.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-5-1-4-5-3",
        version: "4.5.1 \u2013 4.5.3",
        startDate: "2026-09-15",
        endDate: null,
        summary: "Relay CI \xB7 Cloudflare lab \xB7 guest DNS",
        description: "Relay CI stabilised and Cloudflare Worker artifacts for first-visit lab boot; the QMP cont timeout fixed; guest DNS moved to same-origin /lab-dns with a Cloudflare DoH fallback.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "4-5-4",
        version: "4.5.4",
        startDate: "2026-09-15",
        endDate: null,
        summary: "Emscripten shell \xB7 shared relay",
        description: "Sandboxed Emscripten Flinstone Shell as the default lab, and a shared relay room on a Cloudflare Durable Object with BroadcastChannel fallback. Latest GM promote on main.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      },
      {
        id: "5-0-0",
        version: "5.0.0",
        startDate: "2026-09-17",
        endDate: null,
        summary: "Project-metadata contract \xB7 Pages",
        description: "Flintstone publishes project-metadata.json alongside its validated browser lab on every promoted deploy: GitHub-derived languages, a merged-pull-request timeline, and release milestones, gated by the same fail-closed promotion checks as the lab itself. Latest GA on main.",
        url: "https://github.com/BPForbes/Bailey-Forbes-Flinstone/tree/main/version/locked"
      }
    ]
  }
};
export {
  PORTFOLIO
};
