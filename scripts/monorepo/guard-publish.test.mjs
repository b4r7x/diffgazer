import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  createPublishPlan,
  findVersionChangedPackageNames,
  isPublicPackage,
} from "./guard-publish.mjs";

const packageFixtures = [
  { name: "diffgazer", version: "0.1.4", file: "cli/diffgazer/package.json" },
  { name: "@diffgazer/add", version: "0.1.1", file: "cli/add/package.json" },
  { name: "@diffgazer/ui", version: "0.1.0", file: "libs/ui/package.json" },
  { name: "@diffgazer/keys", version: "0.1.0", file: "libs/keys/package.json" },
];
const publishedVersionsByName = {
  diffgazer: ["0.1.3"],
  "@diffgazer/add": [],
  "@diffgazer/ui": [],
  "@diffgazer/keys": [],
};
const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function runPublisherChild({
  allowlist,
  pendingNames,
  registryVersions = publishedVersionsByName,
  pnpmExitCodes = [0],
}) {
  const directory = mkdtempSync(path.join(tmpdir(), "diffgazer-publish-guard-"));
  temporaryDirectories.push(directory);
  const binDirectory = path.join(directory, "bin");
  const logFile = path.join(directory, "publish.log");
  const fakePnpm = path.join(binDirectory, "pnpm");
  mkdirSync(binDirectory);
  writeFileSync(
    fakePnpm,
    `#!/usr/bin/env node
const { appendFileSync, existsSync, readFileSync } = require("node:fs");
const previousInvocations = existsSync(process.env.PUBLISH_LOG)
  ? readFileSync(process.env.PUBLISH_LOG, "utf8").trim().split("\\n").filter(Boolean).length
  : 0;
appendFileSync(process.env.PUBLISH_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
const exitCodes = JSON.parse(process.env.PNPM_EXIT_CODES);
process.exit(exitCodes[previousInvocations] ?? 0);
`,
    { mode: 0o755 },
  );
  chmodSync(fakePnpm, 0o755);

  const moduleUrl = pathToFileURL(path.resolve("scripts/monorepo/guard-publish.mjs")).href;
  const input = {
    packages: packageFixtures,
    publishedVersionsByName: registryVersions,
    allowlist,
    pendingNames,
  };
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { publishPendingPackages } from ${JSON.stringify(moduleUrl)};
publishPendingPackages(${JSON.stringify(input)});`,
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_LOG: logFile,
        PNPM_EXIT_CODES: JSON.stringify(pnpmExitCodes),
      },
    },
  );
  const invocations = existsSync(logFile)
    ? readFileSync(logFile, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  return { child, invocations };
}

function writeExecutable(file, source) {
  writeFileSync(file, `#!/usr/bin/env node\n${source}\n`, { mode: 0o755 });
  chmodSync(file, 0o755);
}

function runGit(directory, args) {
  const result = spawnSync("git", args, { cwd: directory, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function writePackage(directory, file, name, version, isPrivate = false) {
  const packageFile = path.join(directory, file);
  mkdirSync(path.dirname(packageFile), { recursive: true });
  writeFileSync(packageFile, `${JSON.stringify({ name, version, private: isPrivate })}\n`);
}

function runMainChild({ allowlist, versions, registryVersions = publishedVersionsByName }) {
  const directory = mkdtempSync(path.join(tmpdir(), "diffgazer-publish-main-"));
  temporaryDirectories.push(directory);
  const binDirectory = path.join(directory, "bin");
  const publishLog = path.join(directory, "publish.log");
  mkdirSync(binDirectory);

  const manifests = [
    ["cli/diffgazer/package.json", "diffgazer", "0.1.3"],
    ["cli/add/package.json", "@diffgazer/add", "0.1.0"],
    ["libs/ui/package.json", "@diffgazer/ui", "0.1.0"],
    ["libs/keys/package.json", "@diffgazer/keys", "0.1.0"],
  ];
  writePackage(directory, "package.json", "fixture", "0.0.0", true);
  for (const [file, name, version] of manifests) {
    writePackage(directory, file, name, version);
  }
  runGit(directory, ["init", "--quiet"]);
  runGit(directory, ["config", "user.email", "fixture@example.test"]);
  runGit(directory, ["config", "user.name", "Fixture"]);
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "-m", "baseline"]);

  for (const [file, name, previousVersion] of manifests) {
    writePackage(directory, file, name, versions[name] ?? previousVersion);
  }
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "--quiet", "-m", "version packages"]);

  writeExecutable(
    path.join(binDirectory, "npm"),
    `const versions = JSON.parse(process.env.REGISTRY_VERSIONS);
const name = process.argv[3];
if (!(name in versions)) {
  console.error("E404 404 Not Found");
  process.exit(1);
}
process.stdout.write(JSON.stringify(versions[name]));`,
  );
  writeExecutable(
    path.join(binDirectory, "pnpm"),
    `require("node:fs").appendFileSync(
  process.env.PUBLISH_LOG,
  JSON.stringify(process.argv.slice(2)) + "\\n",
);`,
  );

  const moduleUrl = pathToFileURL(path.resolve("scripts/monorepo/guard-publish.mjs")).href;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { main } from ${JSON.stringify(moduleUrl)};
main({ allowlist: ${JSON.stringify(allowlist)}, requestedNames: [] });`,
    ],
    {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_LOG: publishLog,
        REGISTRY_VERSIONS: JSON.stringify(
          Object.fromEntries(
            Object.entries(registryVersions).filter(
              ([, packageVersions]) => packageVersions.length > 0,
            ),
          ),
        ),
      },
    },
  );
  const invocations = existsSync(publishLog)
    ? readFileSync(publishLog, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  return { child, invocations };
}

test("derives the publish set from version changes instead of registry absence", () => {
  const previousVersionsByFile = new Map([
    ["cli/diffgazer/package.json", "0.1.3"],
    ["cli/add/package.json", "0.1.1"],
    ["libs/ui/package.json", "0.1.0"],
    ["libs/keys/package.json", "0.1.0"],
  ]);

  assert.deepEqual(
    findVersionChangedPackageNames({ packages: packageFixtures, previousVersionsByFile }),
    ["diffgazer"],
  );
});

test("plans pending versions as publications or registry recoveries", () => {
  const plan = createPublishPlan({
    packages: packageFixtures,
    publishedVersionsByName: {
      ...publishedVersionsByName,
      diffgazer: ["0.1.3", "0.1.4"],
    },
    allowlist: ["diffgazer", "@diffgazer/add"],
    pendingNames: ["diffgazer", "@diffgazer/add"],
  });

  assert.deepEqual(
    plan.map((pkg) => [pkg.name, pkg.publication]),
    [
      ["diffgazer", "recover"],
      ["@diffgazer/add", "publish"],
    ],
  );
});

test("a gated package in the pending set fails before publication", () => {
  assert.throws(
    () =>
      createPublishPlan({
        packages: packageFixtures,
        publishedVersionsByName,
        allowlist: ["diffgazer"],
        pendingNames: ["@diffgazer/add"],
      }),
    /refusing to first-publish gated packages: @diffgazer\/add/,
  );
});

test("child publisher for the add rollout never attempts unrelated unpublished packages", () => {
  const { child, invocations } = runMainChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    versions: { "@diffgazer/add": "0.1.1" },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, [["--filter", "@diffgazer/add", "publish", "--no-git-checks"]]);
  assert.doesNotMatch(JSON.stringify(invocations), /@diffgazer\/(ui|keys)/);
});

test("child publisher supports the inverse UI and keys rollout without attempting add", () => {
  const { child, invocations } = runMainChild({
    allowlist: ["diffgazer", "@diffgazer/ui", "@diffgazer/keys"],
    versions: { "@diffgazer/ui": "0.1.1", "@diffgazer/keys": "0.1.1" },
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(invocations, [
    ["--filter", "@diffgazer/keys", "publish", "--no-git-checks"],
    ["--filter", "@diffgazer/ui", "publish", "--no-git-checks"],
  ]);
  assert.doesNotMatch(JSON.stringify(invocations), /@diffgazer\/add/);
});

test("default pending set rejects a gated target without starting pnpm", () => {
  const pendingNames = findVersionChangedPackageNames({
    packages: packageFixtures,
    previousVersionsByFile: new Map([
      ["cli/diffgazer/package.json", "0.1.3"],
      ["cli/add/package.json", "0.1.0"],
      ["libs/ui/package.json", "0.1.0"],
      ["libs/keys/package.json", "0.1.0"],
    ]),
  });
  assert.deepEqual(pendingNames, ["diffgazer", "@diffgazer/add"]);

  const { child, invocations } = runPublisherChild({
    allowlist: ["diffgazer"],
    pendingNames,
  });

  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /refusing to first-publish gated packages/);
  assert.deepEqual(invocations, []);
});

test("reports successfully published versions in the changesets action tag format", () => {
  const { child } = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    pendingNames: ["diffgazer", "@diffgazer/add"],
  });

  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(child.stdout.match(/^New tag: .+$/gm), [
    "New tag: diffgazer@0.1.4",
    "New tag: @diffgazer/add@0.1.1",
  ]);
});

test("recovers a partial publication without republishing the completed package", () => {
  const firstAttempt = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    pendingNames: ["diffgazer", "@diffgazer/add"],
    pnpmExitCodes: [0, 1],
  });

  assert.notEqual(firstAttempt.child.status, 0);
  assert.deepEqual(firstAttempt.invocations, [
    ["--filter", "diffgazer", "publish", "--no-git-checks"],
    ["--filter", "@diffgazer/add", "publish", "--no-git-checks"],
  ]);
  assert.doesNotMatch(firstAttempt.child.stdout, /^New tag:/m);

  const retry = runPublisherChild({
    allowlist: ["diffgazer", "@diffgazer/add"],
    pendingNames: ["diffgazer", "@diffgazer/add"],
    registryVersions: {
      ...publishedVersionsByName,
      diffgazer: ["0.1.3", "0.1.4"],
    },
  });

  assert.equal(retry.child.status, 0, retry.child.stderr);
  assert.deepEqual(retry.invocations, [
    ["--filter", "@diffgazer/add", "publish", "--no-git-checks"],
  ]);
  assert.deepEqual(retry.child.stdout.match(/^New tag: .+$/gm), [
    "New tag: diffgazer@0.1.4",
    "New tag: @diffgazer/add@0.1.1",
  ]);
});

test("does not report a tag when an unpublished package fails", () => {
  const { child } = runPublisherChild({
    allowlist: ["@diffgazer/add"],
    pendingNames: ["@diffgazer/add"],
    pnpmExitCodes: [1],
  });

  assert.notEqual(child.status, 0);
  assert.doesNotMatch(child.stdout, /^New tag:/m);
});

test("private and unnamed packages are not public publish targets", () => {
  assert.equal(isPublicPackage({ name: "@diffgazer/core", private: true }), false);
  assert.equal(isPublicPackage({ private: true }), false);
  assert.equal(isPublicPackage({ name: undefined }), false);
  assert.equal(isPublicPackage({ name: "@diffgazer/ui" }), true);
});
