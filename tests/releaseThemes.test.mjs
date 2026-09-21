/**
 * Pure classification only — see src/releaseThemes.ts for why a hand-tagged
 * `theme` always wins over the keyword guess, and why the guess only ever
 * exists for generated (untagged) events.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { themeForEvent } from "../modules/releaseThemes.js";

const base = {
  date: "2026-01-01",
  kind: "feature",
  project: "flinstone",
  title: "",
  detail: "",
};

test("themeForEvent: an explicit theme always wins, even over matching keywords", () => {
  const event = { ...base, theme: "medical", title: "Wi-Fi station contract" };
  assert.equal(themeForEvent(event), "medical");
});

test("themeForEvent: networking keywords in the title are matched", () => {
  const event = { ...base, title: "Production Wi-Fi: 802.11ax and WPA3-SAE" };
  assert.equal(themeForEvent(event), "networking");
});

test("themeForEvent: networking keywords in the detail are matched too, not just the title", () => {
  const event = { ...base, title: "Milestone", detail: "Adds DHCPv4 and DNS resolution." };
  assert.equal(themeForEvent(event), "networking");
});

test("themeForEvent: matching is case-insensitive", () => {
  const event = { ...base, title: "WIFI STATION CONTRACT" };
  assert.equal(themeForEvent(event), "networking");
});

test("themeForEvent: storage keywords", () => {
  const event = { ...base, title: "SQLite-backed share schema" };
  assert.equal(themeForEvent(event), "storage");
});

test("themeForEvent: security keywords", () => {
  const event = { ...base, title: "Documents fs_jail and audit" };
  assert.equal(themeForEvent(event), "security");
});

test("themeForEvent: quantum keywords", () => {
  const event = { ...base, title: "Nine-qubit circuit compiled" };
  assert.equal(themeForEvent(event), "quantum");
});

test("themeForEvent: crypto keywords", () => {
  const event = { ...base, title: "Recursive M-of-N secret sharing" };
  assert.equal(themeForEvent(event), "crypto");
});

test("themeForEvent: community keywords", () => {
  const event = { ...base, title: "Chat room mentions and tickets" };
  assert.equal(themeForEvent(event), "community");
});

test("themeForEvent: infrastructure keywords", () => {
  const event = { ...base, title: "CI workflow deploys to Cloudflare Pages" };
  assert.equal(themeForEvent(event), "infrastructure");
});

test("themeForEvent: medical keywords", () => {
  const event = { ...base, title: "Patient nutrition record migration" };
  assert.equal(themeForEvent(event), "medical");
});

test("themeForEvent: compute keywords", () => {
  const event = { ...base, title: "MLQ scheduler with driver capabilities" };
  assert.equal(themeForEvent(event), "compute");
});

test("themeForEvent: nothing matches falls back to core", () => {
  const event = { ...base, title: "Renamed a variable", detail: "No behaviour change." };
  assert.equal(themeForEvent(event), "core");
});
