import assert from "node:assert/strict";
import { test } from "node:test";
import { findBlockedFirstPublishes, isPublicPackage } from "./guard-publish.mjs";

test("blocks an unpublished public package missing from the allowlist", () => {
  const blocked = findBlockedFirstPublishes({
    packages: [{ name: "@diffgazer/ui", file: "libs/ui/package.json" }],
    publishedNames: [],
    allowlist: ["diffgazer"],
  });
  assert.deepEqual(
    blocked.map((pkg) => pkg.name),
    ["@diffgazer/ui"],
  );
});

test("allows unpublished packages that are all allowlisted", () => {
  const blocked = findBlockedFirstPublishes({
    packages: [
      { name: "diffgazer", file: "cli/diffgazer/package.json" },
      { name: "@diffgazer/ui", file: "libs/ui/package.json" },
    ],
    publishedNames: [],
    allowlist: ["diffgazer", "@diffgazer/ui"],
  });
  assert.deepEqual(blocked, []);
});

test("already-published packages never block", () => {
  const blocked = findBlockedFirstPublishes({
    packages: [{ name: "@diffgazer/ui", file: "libs/ui/package.json" }],
    publishedNames: ["@diffgazer/ui"],
    allowlist: ["diffgazer"],
  });
  assert.deepEqual(blocked, []);
});

test("a published allowlisted package alongside an unpublished gated one blocks only the gated one", () => {
  const blocked = findBlockedFirstPublishes({
    packages: [
      { name: "diffgazer", file: "cli/diffgazer/package.json" },
      { name: "@diffgazer/keys", file: "libs/keys/package.json" },
    ],
    publishedNames: ["diffgazer"],
    allowlist: ["diffgazer"],
  });
  assert.deepEqual(
    blocked.map((pkg) => pkg.name),
    ["@diffgazer/keys"],
  );
});

test("private and unnamed packages are not public publish targets", () => {
  assert.equal(isPublicPackage({ name: "@diffgazer/core", private: true }), false);
  assert.equal(isPublicPackage({ private: true }), false);
  assert.equal(isPublicPackage({ name: undefined }), false);
  assert.equal(isPublicPackage({ name: "@diffgazer/ui" }), true);
});
