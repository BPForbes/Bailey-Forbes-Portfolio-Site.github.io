/**
 * The live-lab guest table and its ready-handshake checks, through the
 * compiled modules/ output (see runtime.test.mjs for why).
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  acceptsGuestReady,
  GITHUB_PAGES_ORIGIN,
  GUEST_ORDER,
  GUESTS,
  isGuestReadyMessage,
  isLiveGuest,
  KEYQUORUM_GUEST_SRC,
} from "../modules/apps.js";

const frame = { name: "the attached iframe's window" };
const ready = (overrides = {}) => ({
  source: "keyquorum-guest",
  type: "ready",
  schemaVersion: 1,
  commit: "2cf8623",
  ...overrides,
});
const event = (data, overrides = {}) => ({ origin: GITHUB_PAGES_ORIGIN, source: frame, data, ...overrides });

test("every guest in the dock is runnable, KeyQuorum included", () => {
  assert.deepEqual([...GUEST_ORDER], ["qpu", "flinstone", "keyquorum"]);
  for (const id of GUEST_ORDER) {
    assert.equal(isLiveGuest(GUESTS[id]), true, `${id} should be live`);
  }
});

test("KeyQuorum attaches the lab KeyQuorum publishes on GitHub Pages", () => {
  const guest = GUESTS.keyquorum;
  assert.equal(KEYQUORUM_GUEST_SRC, "https://bpforbes.github.io/KeyQuorum/");
  assert.equal(guest.src, KEYQUORUM_GUEST_SRC);
  assert.equal(guest.origin, "https://bpforbes.github.io");
  assert.equal(new URL(guest.src).origin, guest.origin);
  assert.equal(guest.embedSource, "keyquorum-guest");
  assert.equal(guest.iframeAllow, "fullscreen; clipboard-write");
});

test("KeyQuorum's strict ready message is accepted from its own frame", () => {
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, event(ready()), frame), true);
});

test("a ready message from the wrong origin is rejected", () => {
  const wrong = event(ready(), { origin: "https://evil.example" });
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, wrong, frame), false);
  const lookalike = event(ready(), { origin: "https://bpforbes.github.io.evil.example" });
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, lookalike, frame), false);
});

test("a ready message from another window is rejected", () => {
  const other = event(ready(), { source: { name: "some other frame" } });
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, other, frame), false);
  // A detached iframe has no window; nothing can match it.
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, event(ready(), { source: null }), null), false);
});

test("a KeyQuorum ready message with the wrong schema, source, type, or commit is rejected", () => {
  const guest = GUESTS.keyquorum;
  for (const data of [
    ready({ schemaVersion: 2 }),
    ready({ schemaVersion: "1" }),
    ready({ source: "flinstone-guest" }),
    ready({ type: "loaded" }),
    ready({ commit: "" }),
    ready({ commit: 1234567 }),
    { source: "keyquorum-guest", type: "ready" },
    null,
    "ready",
  ]) {
    assert.equal(isGuestReadyMessage(guest, data), false, JSON.stringify(data));
    assert.equal(acceptsGuestReady(guest, event(data), frame), false);
  }
});

test("KeyQuorum's handshake cannot attach another guest, and vice versa", () => {
  assert.equal(acceptsGuestReady(GUESTS.flinstone, event(ready()), frame), false);
  const flinstoneReady = ready({ source: "flinstone-guest" });
  assert.equal(acceptsGuestReady(GUESTS.flinstone, event(flinstoneReady), frame), true);
  assert.equal(acceptsGuestReady(GUESTS.keyquorum, event(flinstoneReady), frame), false);
});

test("QPU's existing handshake is unchanged", () => {
  const qpu = GUESTS.qpu;
  assert.equal(qpu.src, "https://bpforbes.github.io/BPForbes.QPU.github.io/?embed=1");
  assert.equal(acceptsGuestReady(qpu, event({ source: "qpu-guest", type: "ready" }), frame), true);
  assert.equal(acceptsGuestReady(qpu, event({ source: "keyquorum-guest", type: "ready" }), frame), false);
});

test("Flinstone's existing configuration is unchanged", () => {
  const flinstone = GUESTS.flinstone;
  assert.equal(flinstone.src, "https://bpforbes.github.io/Bailey-Forbes-Flinstone/");
  assert.equal(flinstone.iframeAllow, "cross-origin-isolated; fullscreen; clipboard-write");
  assert.equal(isGuestReadyMessage(flinstone, { source: "flinstone-guest", type: "ready" }), false);
});
