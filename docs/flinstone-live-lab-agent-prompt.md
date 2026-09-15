# Implementation prompt: unblock the real Flinstone Live Lab

Copy the prompt below into an agent working in the Flinstone repository. Replace
`<PORTFOLIO_PR_URL>` with the URL of the open draft portfolio pull request once
GitHub assigns it. Until then, the branch comparison is:
https://github.com/BPForbes/Bailey-Forbes-Portfolio-Site.github.io/compare/main...feature/flinstone-live-lab

---

You are implementing the upstream dependencies required to embed the **real
Flinstone kernel/VM** in Bailey Forbes's portfolio Live Lab. Do not build a
JavaScript shell imitation and do not claim that an artifact is bootable unless
an independent VM smoke test boots it.

## Repositories and related work

- Flinstone repository (make changes here):
  https://github.com/BPForbes/Bailey-Forbes-Flinstone
- Existing browser artifact contract and compatibility audit, Flinstone PR #354:
  https://github.com/BPForbes/Bailey-Forbes-Flinstone/pull/354
- Portfolio repository (eventual iframe consumer):
  https://github.com/BPForbes/Bailey-Forbes-Portfolio-Site.github.io
- Draft portfolio integration PR: `<PORTFOLIO_PR_URL>`
- Portfolio integration branch while the PR URL is pending:
  https://github.com/BPForbes/Bailey-Forbes-Portfolio-Site.github.io/compare/main...feature/flinstone-live-lab

The portfolio PR exists to embed a separately deployed Flinstone lab in the
same Live Lab window pattern as QPU. The portfolio must host only the iframe
chrome and trusted readiness integration. Flinstone must own the kernel image,
emulator runtime, lab UI, build metadata, and deployment.

## Known state from PR #354

Start from the latest Flinstone `main`. Preserve the schema-versioned artifact
contract and fail-closed promotion gate introduced by PR #354. Its current
Outcome B is intentional and accurate:

- `make browser-kernel` currently produces a dynamically linked x86-64 Linux
  ELF, not a firmware-bootable kernel image.
- The current manifest reports `bootable: false` and `v86Compatible: false`.
- v86 cannot run the current x86-64 long-mode implementation.
- `VM/` is a limited 16/32-bit synthetic CPU demonstration; it does not execute
  the Flinstone shell/kernel ELF.
- The workflow must not publish a public kernel artifact until QEMU independently
  observes `FLINTSTONE_KERNEL_BOOT_OK`.

Read these before editing:

- `docs/browser-kernel-lab.md`
- `.github/workflows/browser-kernel-artifact.yml`
- `contracts/virtualization/contract_p8_browser_artifact.h`
- `scripts/package_browser_kernel_artifact.sh`
- `scripts/test_browser_kernel_artifact.sh`
- `tests/test_browser_kernel_promotion_gate.sh`
- `tools/browser-lab/`

## Goal

Produce and deploy a static, browser-hosted lab that boots a real Flinstone
image, exposes the real shell and server/chat behavior, supports several
simultaneous user sessions on one browser/device, and can be embedded by the
portfolio. The image used in the browser must derive from the same build output
validated under QEMU.

## Required implementation

### 1. Create a real boot boundary

Add a freestanding x86-64 target instead of renaming the hosted ELF. Provide:

- a firmware/bootloader entry (Multiboot2 + GRUB, Limine, or another documented
  x86-64 boot protocol);
- a freestanding linker script, stack, `.bss` initialization, and stable kernel
  C entry point;
- long-mode GDT/IDT and early exception diagnostics;
- early NS16550-compatible COM1 initialization;
- a bootable raw image or ISO that both QEMU and the chosen browser emulator can
  consume;
- explicit capability reporting for subsystems not yet available without the
  Linux runtime.

Do not silently stub identity, filesystem, networking, or server behavior while
reporting them as available. Port or replace hosted `pthread`, SQLite, OpenSSL,
and libc dependencies where the lab's required features use them.

### 2. Validate the boot independently

Extend the existing bounded QEMU probe. Emit exactly
`FLINTSTONE_KERNEL_BOOT_OK` over initialized COM1 only after the minimum boot
sequence succeeds. CI, not build metadata, must observe the marker. Update
`build-info.json` to `bootable: true` only when that is truthful.

Keep the promotion gate fail-closed. A failed build or boot must leave the last
known-good public lab deployed.

### 3. Select a compatible browser emulator

Prove an emulator against the produced image. It must provide x86-64 long mode,
the required instruction set, the chosen BIOS/boot path, VGA, PS/2 keyboard,
PIC, PIT, the selected block device, COM1 capture, sufficient RAM, lifecycle
controls, and static hosting. Do not set `v86Compatible: true` unless the
artifact genuinely becomes compatible with v86. If another emulator is used,
evolve the manifest compatibly to name and validate it.

### 4. Implement multi-user lab sessions (`switchuser`)

`switchuser` is **not Unix `su` and not a cosmetic prompt change**. It is a
hosted-lab session multiplexer: multiple authenticated/logical Flinstone user
contexts remain alive concurrently on one browser/device, similar to tmux but
organized around users.

Required semantics:

- `switchuser <username>` selects an existing live user session or creates/
  attaches one according to an explicit lab policy.
- Switching preserves every user's current shell state, working directory,
  environment, running jobs, server ownership, chat membership, and unread
  events.
- Only the selected session receives interactive keyboard input; background
  sessions and their services continue running.
- The displayed prompt, chat identity, permissions, filesystem access, and audit
  actor must derive from the selected real session.
- Expose `sessions` (or equivalent) to list users, active/background state,
  owned services, and unread activity.
- Expose a way to detach/close a user session without killing unrelated sessions.
- Gate the convenience command behind an explicit hosted-lab build capability,
  such as `FLINSTONE_HOSTED_LAB`; normal local and bare-metal builds must not
  register it.
- Do not bypass authorization inside server/chat logic. The lab may simplify
  login/bootstrap, but each session must still carry a distinct real identity.
- Audit session creation, selection, detach, and forced disconnect events.

Use stable session IDs internally rather than username alone. Define ownership
and disconnect behavior explicitly so a username rename or reconnect cannot
hijack a service.

### 5. Meet this server/chat acceptance scenario

Add an automated integration test for the following exact behavior:

1. Start/select Bob's hosted-lab session.
2. Bob starts a chat server; the server records Bob's session/user as owner.
3. Run `switchuser Sarah`; Bob's session and server remain alive in the
   background.
4. Sarah joins Bob's server and sends a message.
5. Run `switchuser Bob`; the visible chat perspective, identity, prompt, unread
   state, and permissions update to Bob without restarting the server.
6. Bob leaves/closes the owner session (or invokes the defined owner-leave
   operation).
7. The server shuts down and Sarah is kicked with a deterministic owner-left
   reason; Sarah's session itself remains available to switch back to.

Also test switching repeatedly, unknown users, duplicate attaches, disconnect
cleanup, background message delivery, authorization isolation, and attempts by
Sarah to perform owner-only operations.

If existing server semantics intentionally transfer ownership instead of
stopping, do not change them silently: document the conflict and implement the
explicit requirement above for hosted lab mode, with tests.

### 6. Add browser lab lifecycle and persistence

The standalone lab should provide Boot, Pause, Resume, Reset, and Power Off.
Capture the serial boot marker and display truthful states such as Loading,
Booting, Ready, Paused, Failed, and Blocked. Route keyboard focus into the
emulated PS/2 path. If snapshots or persistent disks are supported, version
them against the artifact schema and fail safely when incompatible.

### 7. Publish the standalone lab

Deploy a stable HTTPS URL containing the emulator, firmware, validated image,
and `build-info.json`. Configure it so the portfolio origin can frame it. The
lab must work standalone before portfolio integration.

After the real serial marker is observed, send the parent a narrowly scoped
message such as:

```js
window.parent.postMessage(
  {
    source: "flinstone-guest",
    type: "ready",
    schemaVersion: 1,
    commit: buildInfo.shortCommit,
  },
  "https://bailey-forbes.com",
);
```

Never send `ready` merely because the DOM, JavaScript, metadata, or emulator
runtime loaded.

## Testing expectations

At minimum, add and run:

- unit tests for the freestanding entry-support code and manifest parser;
- existing driver, in-process VM, invariant, and promotion-gate suites;
- QEMU boot smoke test observing the exact serial marker;
- browser-emulator boot test observing the same marker;
- session multiplexer tests covering identity and resource isolation;
- the Bob/Sarah server/chat integration scenario above;
- corrupted/missing artifact and metadata tests;
- browser lifecycle tests for reset and failure recovery;
- an iframe integration test that rejects wrong origins, sources, schemas, and
  premature readiness messages.

Document exact commands and results in the PR. Include a screenshot or recording
of the real booted lab and the Bob/Sarah scenario.

## Delivery and handoff

Keep commits reviewable and separate boot-boundary, kernel-porting,
multi-session, emulator, and deployment concerns. Update architecture and build
documentation. Do not commit generated secrets or depend on expiring Actions
artifact URLs.

When complete, report to the portfolio PR:

- standalone lab URL;
- exact allowed origin;
- readiness-message schema;
- artifact manifest URL and schema;
- validated Flinstone commit/image digest;
- browser and mobile support;
- lifecycle API or message contract, if exposed;
- proof that the QEMU and browser boot tests observed the marker;
- proof that the Bob/Sarah acceptance scenario passes.

Only then should the portfolio PR replace Flinstone's offline guest with the
real deployed iframe.

---
