import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FLINTSTONE_EMBED_SOURCE,
  FLINTSTONE_SECURITY_GUEST_SRC,
  GITHUB_PAGES_ORIGIN,
  GUEST_ORDER,
  GUESTS,
  isGuestReadyMessage,
  isLiveGuest,
  KEYQUORUM_EMBED_SOURCE,
  KEYQUORUM_GUEST_SRC,
} from "../modules/apps.js";

test("the security build is a live guest on its own Pages path, outside the dock", () => {
  const guest = GUESTS["flinstone-security"];

  assert.equal(isLiveGuest(guest), true);
  assert.equal(guest.src, FLINTSTONE_SECURITY_GUEST_SRC);
  assert.equal(guest.src, "https://bpforbes.github.io/Bailey-Forbes-Flinstone/security/");
  assert.equal(guest.origin, GITHUB_PAGES_ORIGIN);
  assert.equal(guest.embedSource, FLINTSTONE_EMBED_SOURCE);
  assert.equal(GUEST_ORDER.includes("flinstone-security"), false);
});

test("the security build answers the same versioned Flinstone ready handshake", () => {
  const guest = GUESTS["flinstone-security"];
  const ready = {
    source: "flinstone-guest",
    type: "ready",
    schemaVersion: 1,
    commit: "9ec1a2b",
  };

  assert.equal(isGuestReadyMessage(guest, ready), true);
  assert.equal(isGuestReadyMessage(guest, { ...ready, schemaVersion: 2 }), false);
  assert.equal(isGuestReadyMessage(guest, { ...ready, commit: "" }), false);
});

test("KeyQuorum is configured as a live GitHub Pages guest", () => {
  const guest = GUESTS.keyquorum;

  assert.equal(isLiveGuest(guest), true);
  assert.equal(guest.src, KEYQUORUM_GUEST_SRC);
  assert.equal(guest.src, "https://bpforbes.github.io/KeyQuorum/");
  assert.equal(guest.origin, GITHUB_PAGES_ORIGIN);
  assert.equal(guest.embedSource, KEYQUORUM_EMBED_SOURCE);
});

test("KeyQuorum requires its versioned ready handshake", () => {
  const guest = GUESTS.keyquorum;
  const ready = {
    source: "keyquorum-guest",
    type: "ready",
    schemaVersion: 1,
    commit: "944b454",
  };

  assert.equal(isGuestReadyMessage(guest, ready), true);
  assert.equal(isGuestReadyMessage(guest, { ...ready, source: "qpu-guest" }), false);
  assert.equal(isGuestReadyMessage(guest, { ...ready, schemaVersion: 2 }), false);
  assert.equal(isGuestReadyMessage(guest, { ...ready, commit: "" }), false);
});
