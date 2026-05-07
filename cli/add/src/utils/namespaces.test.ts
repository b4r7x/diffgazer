import assert from "node:assert/strict";
import test from "node:test";
import { allListNames, publicInstallNames, publicListNames } from "./namespaces.js";

test("publicInstallNames excludes non-installable theme items from CLI flows", () => {
  const names = publicInstallNames();

  assert.ok(names.includes("ui/button"));
  assert.ok(!names.includes("ui/theme"));
  assert.ok(!names.includes("theme"));
});

test("list names use canonical names without bare ui aliases", () => {
  const names = publicListNames();

  assert.ok(names.includes("ui/button"));
  assert.ok(!names.includes("button"));
  assert.equal(names.filter((name) => name === "ui/button").length, 1);
});

test("all list names include hidden installable ui items once", () => {
  const names = allListNames();

  assert.equal(names.filter((name) => name === "ui/portal").length, 1);
  assert.equal(names.filter((name) => name === "ui/dialog-shell").length, 1);
});
