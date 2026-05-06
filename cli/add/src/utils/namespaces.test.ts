import assert from "node:assert/strict";
import test from "node:test";
import { publicInstallNames } from "./namespaces.js";

test("publicInstallNames excludes non-installable theme items from CLI flows", () => {
  const names = publicInstallNames();

  assert.ok(names.includes("ui/button"));
  assert.ok(!names.includes("ui/theme"));
  assert.ok(!names.includes("theme"));
});
